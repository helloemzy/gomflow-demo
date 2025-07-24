import { 
  UsageMetrics, 
  SubscriptionPlan, 
  UsageLimitAlert, 
  FeatureUsageLog 
} from '@gomflow/shared';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { featureGating } from './featureGating';

// =============================================================================
// USAGE ENFORCEMENT SYSTEM
// =============================================================================

export interface UsageTrackingConfig {
  enableRealTimeUpdates: boolean;
  batchUpdateInterval: number; // milliseconds
  alertThresholds: number[]; // [80, 90, 95, 100]
  enforceHardLimits: boolean;
  gracePeriodHours: number;
}

export interface UsageValidationResult {
  allowed: boolean;
  reason?: string;
  currentUsage: number;
  limit: number;
  percentage: number;
  resetDate?: Date;
  gracePeriodEnd?: Date;
  recommendations?: string[];
}

export interface UsageIncrementOptions {
  skipValidation?: boolean;
  bypassLimits?: boolean;
  metadata?: Record<string, any>;
  batchId?: string;
}

export class UsageEnforcementService {
  private supabase = createClientComponentClient();
  private config: UsageTrackingConfig = {
    enableRealTimeUpdates: true,
    batchUpdateInterval: 5000, // 5 seconds
    alertThresholds: [80, 90, 95, 100],
    enforceHardLimits: true,
    gracePeriodHours: 24,
  };

  private pendingUpdates = new Map<string, Map<string, number>>();
  private batchUpdateTimer: NodeJS.Timeout | null = null;

  constructor() {
    if (this.config.enableRealTimeUpdates) {
      this.startBatchUpdateTimer();
    }
  }

  // =============================================================================
  // CORE USAGE VALIDATION
  // =============================================================================

  async validateUsage(
    userId: string,
    featureName: string,
    incrementBy: number = 1
  ): Promise<UsageValidationResult> {
    try {
      const userAccess = await featureGating.getUserFeatureAccess(userId);
      const feature = userAccess.features[featureName];

      if (!feature) {
        return {
          allowed: false,
          reason: 'Feature not found',
          currentUsage: 0,
          limit: 0,
          percentage: 0,
        };
      }

      if (!feature.enabled) {
        return {
          allowed: false,
          reason: 'Feature not enabled on current plan',
          currentUsage: feature.used || 0,
          limit: feature.limit || 0,
          percentage: 0,
        };
      }

      // No limit means unlimited usage
      if (!feature.limit) {
        return {
          allowed: true,
          currentUsage: feature.used || 0,
          limit: -1, // Unlimited
          percentage: 0,
        };
      }

      const currentUsage = feature.used || 0;
      const newUsage = currentUsage + incrementBy;
      const percentage = (newUsage / feature.limit) * 100;

      // Check if the increment would exceed the limit
      if (newUsage > feature.limit) {
        // Check for grace period
        const gracePeriod = await this.getGracePeriod(userId, featureName);
        if (gracePeriod && new Date() < gracePeriod) {
          return {
            allowed: true,
            currentUsage: newUsage,
            limit: feature.limit,
            percentage,
            resetDate: feature.reset_date,
            gracePeriodEnd: gracePeriod,
            recommendations: this.getUsageRecommendations(percentage, userAccess.plan),
          };
        }

        return {
          allowed: false,
          reason: `Usage limit exceeded for ${featureName}`,
          currentUsage,
          limit: feature.limit,
          percentage: (currentUsage / feature.limit) * 100,
          resetDate: feature.reset_date,
          recommendations: this.getUsageRecommendations(percentage, userAccess.plan),
        };
      }

      return {
        allowed: true,
        currentUsage: newUsage,
        limit: feature.limit,
        percentage,
        resetDate: feature.reset_date,
        recommendations: percentage > 80 ? 
          this.getUsageRecommendations(percentage, userAccess.plan) : undefined,
      };

    } catch (error) {
      console.error('Usage validation failed:', error);
      return {
        allowed: false,
        reason: 'Usage validation error',
        currentUsage: 0,
        limit: 0,
        percentage: 0,
      };
    }
  }

  // =============================================================================
  // USAGE TRACKING & INCREMENTS
  // =============================================================================

  async incrementUsage(
    userId: string,
    featureName: string,
    amount: number = 1,
    options: UsageIncrementOptions = {}
  ): Promise<{
    success: boolean;
    newUsage?: number;
    limitExceeded?: boolean;
    alertTriggered?: boolean;
    error?: string;
  }> {
    try {
      // Validate usage unless explicitly skipped
      if (!options.skipValidation) {
        const validation = await this.validateUsage(userId, featureName, amount);
        if (!validation.allowed && !options.bypassLimits) {
          return {
            success: false,
            limitExceeded: true,
            error: validation.reason,
          };
        }
      }

      // Track the usage increment
      const result = await this.trackUsageIncrement(userId, featureName, amount, options);

      // Check for alerts
      const alertTriggered = await this.checkAndCreateAlerts(userId, featureName, result.newUsage);

      // Log the feature usage
      await this.logFeatureUsage(userId, featureName, 'increment', {
        amount,
        newUsage: result.newUsage,
        ...options.metadata,
      });

      return {
        success: true,
        newUsage: result.newUsage,
        alertTriggered,
      };

    } catch (error) {
      console.error('Usage increment failed:', error);
      return {
        success: false,
        error: 'Failed to increment usage',
      };
    }
  }

  private async trackUsageIncrement(
    userId: string,
    featureName: string,
    amount: number,
    options: UsageIncrementOptions
  ): Promise<{ newUsage: number }> {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    if (this.config.enableRealTimeUpdates && !options.batchId) {
      // Use batch updates for better performance
      return this.addToPendingUpdates(userId, featureName, amount);
    }

    // Direct database update
    const { data, error } = await this.supabase
      .rpc('increment_usage_metric', {
        p_user_id: userId,
        p_feature_name: featureName,
        p_increment: amount,
        p_period_start: currentMonth.toISOString(),
        p_period_end: nextMonth.toISOString(),
      });

    if (error) {
      throw new Error(`Failed to increment usage: ${error.message}`);
    }

    return { newUsage: data };
  }

  private addToPendingUpdates(
    userId: string,
    featureName: string,
    amount: number
  ): Promise<{ newUsage: number }> {
    if (!this.pendingUpdates.has(userId)) {
      this.pendingUpdates.set(userId, new Map());
    }

    const userUpdates = this.pendingUpdates.get(userId)!;
    const currentPending = userUpdates.get(featureName) || 0;
    userUpdates.set(featureName, currentPending + amount);

    // Return estimated new usage (this is approximate until batch is processed)
    return Promise.resolve({ newUsage: currentPending + amount });
  }

  // =============================================================================
  // BATCH PROCESSING
  // =============================================================================

  private startBatchUpdateTimer(): void {
    this.batchUpdateTimer = setInterval(() => {
      this.processPendingUpdates();
    }, this.config.batchUpdateInterval);
  }

  private async processPendingUpdates(): Promise<void> {
    if (this.pendingUpdates.size === 0) return;

    const updates = Array.from(this.pendingUpdates.entries());
    this.pendingUpdates.clear();

    try {
      for (const [userId, userUpdates] of updates) {
        for (const [featureName, amount] of userUpdates.entries()) {
          await this.trackUsageIncrement(userId, featureName, amount, { batchId: 'auto' });
        }
      }
    } catch (error) {
      console.error('Batch update processing failed:', error);
      // Re-add failed updates back to pending
      for (const [userId, userUpdates] of updates) {
        if (!this.pendingUpdates.has(userId)) {
          this.pendingUpdates.set(userId, new Map());
        }
        const existingUpdates = this.pendingUpdates.get(userId)!;
        for (const [featureName, amount] of userUpdates.entries()) {
          const existing = existingUpdates.get(featureName) || 0;
          existingUpdates.set(featureName, existing + amount);
        }
      }
    }
  }

  // =============================================================================
  // ALERT MANAGEMENT
  // =============================================================================

  private async checkAndCreateAlerts(
    userId: string,
    featureName: string,
    newUsage: number
  ): Promise<boolean> {
    try {
      const userAccess = await featureGating.getUserFeatureAccess(userId);
      const feature = userAccess.features[featureName];

      if (!feature?.limit) return false;

      const percentage = (newUsage / feature.limit) * 100;
      let alertTriggered = false;

      for (const threshold of this.config.alertThresholds) {
        if (percentage >= threshold) {
          const created = await this.createUsageLimitAlert(
            userId,
            featureName,
            newUsage,
            feature.limit,
            threshold
          );
          if (created) alertTriggered = true;
        }
      }

      return alertTriggered;

    } catch (error) {
      console.error('Alert check failed:', error);
      return false;
    }
  }

  private async createUsageLimitAlert(
    userId: string,
    featureName: string,
    currentUsage: number,
    limit: number,
    threshold: number
  ): Promise<boolean> {
    try {
      // Check if alert already exists for this threshold
      const { data: existingAlert } = await this.supabase
        .from('usage_limit_alerts')
        .select('id')
        .eq('user_id', userId)
        .eq('metric_type', featureName)
        .eq('alert_threshold', threshold)
        .eq('resolved', false)
        .single();

      if (existingAlert) return false;

      // Create new alert
      const { error } = await this.supabase
        .from('usage_limit_alerts')
        .insert({
          user_id: userId,
          metric_type: featureName,
          limit_value: limit,
          current_value: currentUsage,
          percentage_used: (currentUsage / limit) * 100,
          alert_threshold: threshold,
          alert_sent: false,
          resolved: false,
        });

      if (error) {
        console.error('Failed to create usage alert:', error);
        return false;
      }

      // Trigger notification (would integrate with notification service)
      await this.triggerUsageAlert(userId, featureName, currentUsage, limit, threshold);

      return true;

    } catch (error) {
      console.error('Alert creation failed:', error);
      return false;
    }
  }

  private async triggerUsageAlert(
    userId: string,
    featureName: string,
    currentUsage: number,
    limit: number,
    threshold: number
  ): Promise<void> {
    // This would integrate with your notification service
    console.log(`Usage alert triggered for user ${userId}: ${featureName} at ${threshold}% (${currentUsage}/${limit})`);
    
    // Example: Send to notification service
    // await notificationService.send({
    //   userId,
    //   type: 'usage_alert',
    //   template: 'usage_limit_warning',
    //   data: { featureName, currentUsage, limit, threshold },
    // });
  }

  // =============================================================================
  // USAGE ANALYTICS
  // =============================================================================

  async getUserUsageMetrics(userId: string): Promise<{
    currentPeriod: UsageMetrics | null;
    previousPeriod: UsageMetrics | null;
    growthRate: Record<string, number>;
    projectedUsage: Record<string, number>;
    riskScore: number;
  }> {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Get current period metrics
    const { data: currentPeriod } = await this.supabase
      .from('usage_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('period_start', currentMonth.toISOString())
      .single();

    // Get previous period metrics
    const { data: previousPeriod } = await this.supabase
      .from('usage_metrics')
      .select('*')
      .eq('user_id', userId)
      .eq('period_start', previousMonth.toISOString())
      .single();

    // Calculate growth rates and projections
    const growthRate: Record<string, number> = {};
    const projectedUsage: Record<string, number> = {};

    if (currentPeriod && previousPeriod) {
      const metrics = [
        'orders_created',
        'submissions_received',
        'api_calls_made',
        'sms_sent',
        'storage_used_mb',
        'webhook_calls',
      ];

      for (const metric of metrics) {
        const current = currentPeriod[metric] || 0;
        const previous = previousPeriod[metric] || 0;
        
        growthRate[metric] = previous > 0 ? ((current - previous) / previous) * 100 : 0;
        
        // Simple projection based on current trend
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const daysElapsed = now.getDate();
        const dailyAverage = current / daysElapsed;
        projectedUsage[metric] = dailyAverage * daysInMonth;
      }
    }

    // Calculate risk score (0-100)
    const riskScore = this.calculateRiskScore(currentPeriod, userId);

    return {
      currentPeriod,
      previousPeriod,
      growthRate,
      projectedUsage,
      riskScore,
    };
  }

  private calculateRiskScore(usage: UsageMetrics | null, userId: string): number {
    if (!usage) return 0;

    // This would be more sophisticated in a real implementation
    let riskScore = 0;

    // Factor 1: Usage trends (40% of score)
    // This would look at growth rates and projections

    // Factor 2: Limit proximity (30% of score)
    // Calculate how close to limits the user is

    // Factor 3: Payment history (20% of score)
    // Look at payment failures, downgrades, etc.

    // Factor 4: Support interactions (10% of score)
    // Frequency of support tickets related to limits

    return Math.min(100, riskScore);
  }

  // =============================================================================
  // UTILITY FUNCTIONS
  // =============================================================================

  private async getGracePeriod(userId: string, featureName: string): Promise<Date | null> {
    // Check if user has active grace period for this feature
    const { data } = await this.supabase
      .from('usage_grace_periods')
      .select('expires_at')
      .eq('user_id', userId)
      .eq('feature_name', featureName)
      .eq('is_active', true)
      .gte('expires_at', new Date().toISOString())
      .single();

    return data?.expires_at ? new Date(data.expires_at) : null;
  }

  private getUsageRecommendations(percentage: number, plan: SubscriptionPlan): string[] {
    const recommendations: string[] = [];

    if (percentage >= 95) {
      recommendations.push('Consider upgrading your plan to avoid service interruption');
      recommendations.push('Contact support for assistance with your usage patterns');
    } else if (percentage >= 90) {
      recommendations.push('You\'re approaching your usage limit - consider upgrading');
      recommendations.push('Review your usage patterns to optimize efficiency');
    } else if (percentage >= 80) {
      recommendations.push('Monitor your usage closely as you approach the limit');
      recommendations.push('Consider upgrading if usage continues to grow');
    }

    // Plan-specific recommendations
    if (plan === 'freemium') {
      recommendations.push('Upgrade to Starter for 4x more capacity');
    } else if (plan === 'starter') {
      recommendations.push('Upgrade to Professional for unlimited usage');
    }

    return recommendations;
  }

  private async logFeatureUsage(
    userId: string,
    featureName: string,
    action: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await this.supabase
        .from('feature_usage_logs')
        .insert({
          user_id: userId,
          feature_name: featureName,
          action,
          metadata,
          timestamp: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Failed to log feature usage:', error);
    }
  }

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  async bulkIncrementUsage(
    updates: Array<{
      userId: string;
      featureName: string;
      amount: number;
      metadata?: Record<string, any>;
    }>
  ): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ userId: string; featureName: string; error: string }>;
  }> {
    let successful = 0;
    let failed = 0;
    const errors: Array<{ userId: string; featureName: string; error: string }> = [];

    for (const update of updates) {
      try {
        const result = await this.incrementUsage(
          update.userId,
          update.featureName,
          update.amount,
          { metadata: update.metadata, batchId: 'bulk' }
        );

        if (result.success) {
          successful++;
        } else {
          failed++;
          errors.push({
            userId: update.userId,
            featureName: update.featureName,
            error: result.error || 'Unknown error',
          });
        }
      } catch (error) {
        failed++;
        errors.push({
          userId: update.userId,
          featureName: update.featureName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { successful, failed, errors };
  }

  async resetUsageForPeriod(userId: string, periodStart: Date): Promise<void> {
    const { error } = await this.supabase
      .from('usage_metrics')
      .delete()
      .eq('user_id', userId)
      .eq('period_start', periodStart.toISOString());

    if (error) {
      throw new Error(`Failed to reset usage: ${error.message}`);
    }
  }

  // =============================================================================
  // CLEANUP
  // =============================================================================

  destroy(): void {
    if (this.batchUpdateTimer) {
      clearInterval(this.batchUpdateTimer);
      this.batchUpdateTimer = null;
    }

    // Process any remaining pending updates
    if (this.pendingUpdates.size > 0) {
      this.processPendingUpdates();
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const usageEnforcement = new UsageEnforcementService();