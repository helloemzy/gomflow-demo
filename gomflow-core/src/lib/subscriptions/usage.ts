import { createClient } from '@supabase/supabase-js';
import {
  UsageTracking,
  UsageLimitCheck,
  UsageMetricType,
  SubscriptionTier,
  SubscriptionSummary
} from 'gomflow-shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Usage tracking and enforcement utilities
 */
export class UsageManager {
  /**
   * Check if user can perform an action based on usage limits
   */
  static async checkUsageLimit(
    userId: string,
    metricType: UsageMetricType,
    increment: number = 1
  ): Promise<UsageLimitCheck> {
    const { data: limitCheck, error } = await supabase
      .rpc('check_usage_limit', {
        p_user_id: userId,
        p_metric_type: metricType,
        p_increment: increment
      });

    if (error) {
      throw new Error(`Failed to check usage limit: ${error.message}`);
    }

    return {
      allowed: limitCheck.allowed,
      reason: limitCheck.reason,
      current_usage: limitCheck.current_usage,
      limit: limitCheck.limit,
      remaining: limitCheck.remaining,
      would_be: limitCheck.would_be
    };
  }

  /**
   * Record usage for a specific metric
   */
  static async recordUsage(
    userId: string,
    metricType: UsageMetricType,
    increment: number = 1,
    metadata?: Record<string, any>
  ): Promise<{
    success: boolean;
    recorded: number;
    new_total: number;
    period_start: Date;
    period_end: Date;
  }> {
    // First check if usage is allowed
    const limitCheck = await this.checkUsageLimit(userId, metricType, increment);
    
    if (!limitCheck.allowed) {
      throw new Error(`Usage limit exceeded: ${limitCheck.reason}`);
    }

    // Record the usage
    const { data: recordResult, error } = await supabase
      .rpc('record_usage', {
        p_user_id: userId,
        p_metric_type: metricType,
        p_increment: increment
      });

    if (error) {
      throw new Error(`Failed to record usage: ${error.message}`);
    }

    // Get updated usage
    const newTotal = await this.getCurrentUsage(userId, metricType);

    return {
      success: true,
      recorded: increment,
      new_total: newTotal,
      period_start: new Date(recordResult.period_start),
      period_end: new Date(recordResult.period_end)
    };
  }

  /**
   * Get current usage for a specific metric
   */
  static async getCurrentUsage(userId: string, metricType: UsageMetricType): Promise<number> {
    const { data: usage, error } = await supabase
      .rpc('get_current_usage', {
        p_user_id: userId,
        p_metric_type: metricType
      });

    if (error) {
      throw new Error(`Failed to get current usage: ${error.message}`);
    }

    return usage || 0;
  }

  /**
   * Get all usage metrics for a user
   */
  static async getAllUsage(userId: string): Promise<Record<UsageMetricType, number>> {
    const metrics: UsageMetricType[] = [
      'orders_created',
      'api_calls',
      'storage_mb',
      'messages_sent',
      'submissions_received'
    ];

    const usagePromises = metrics.map(async metric => {
      const usage = await this.getCurrentUsage(userId, metric);
      return [metric, usage] as [UsageMetricType, number];
    });

    const usageResults = await Promise.all(usagePromises);
    
    return Object.fromEntries(usageResults) as Record<UsageMetricType, number>;
  }

  /**
   * Get usage history for a user
   */
  static async getUsageHistory(
    userId: string,
    metricType?: UsageMetricType,
    days: number = 30
  ): Promise<UsageTracking[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', userId)
      .gte('period_start', startDate.toISOString())
      .order('period_start', { ascending: false });

    if (metricType) {
      query = query.eq('metric_type', metricType);
    }

    const { data: history, error } = await query;

    if (error) {
      throw new Error(`Failed to get usage history: ${error.message}`);
    }

    return history?.map(record => ({
      ...record,
      period_start: new Date(record.period_start),
      period_end: new Date(record.period_end),
      recorded_at: new Date(record.recorded_at)
    })) || [];
  }

  /**
   * Get usage statistics and health for a user
   */
  static async getUsageHealth(userId: string): Promise<{
    overall_health: 'healthy' | 'warning' | 'critical';
    metrics: Record<UsageMetricType, {
      current_usage: number;
      limit: number;
      usage_percentage: number;
      status: 'healthy' | 'warning' | 'critical' | 'unlimited';
      remaining: number;
    }>;
    summary: {
      total_metrics: number;
      unlimited_metrics: number;
      warning_metrics: number;
      critical_metrics: number;
    };
  }> {
    // Get subscription summary
    const { data: subscription, error: subError } = await supabase
      .rpc('get_subscription_summary', { p_user_id: userId });

    if (subError) {
      throw new Error(`Failed to get subscription summary: ${subError.message}`);
    }

    if (!subscription.has_subscription) {
      throw new Error('User has no active subscription');
    }

    const metrics: UsageMetricType[] = [
      'orders_created',
      'api_calls',
      'storage_mb', 
      'messages_sent',
      'submissions_received'
    ];

    const usageHealth: Record<UsageMetricType, any> = {};
    let warningCount = 0;
    let criticalCount = 0;
    let unlimitedCount = 0;

    for (const metric of metrics) {
      const currentUsage = subscription.usage?.[metric] || 0;
      const limit = subscription.plan?.limits?.[metric] || 0;
      const isUnlimited = limit === -1;

      if (isUnlimited) {
        unlimitedCount++;
        usageHealth[metric] = {
          current_usage: currentUsage,
          limit: -1,
          usage_percentage: 0,
          status: 'unlimited',
          remaining: -1
        };
      } else {
        const usagePercentage = limit > 0 ? (currentUsage / limit) * 100 : 0;
        const remaining = Math.max(0, limit - currentUsage);

        let status: 'healthy' | 'warning' | 'critical';
        if (usagePercentage >= 100) {
          status = 'critical';
          criticalCount++;
        } else if (usagePercentage >= 80) {
          status = 'warning';
          warningCount++;
        } else {
          status = 'healthy';
        }

        usageHealth[metric] = {
          current_usage: currentUsage,
          limit: limit,
          usage_percentage: Math.round(usagePercentage),
          status: status,
          remaining: remaining
        };
      }
    }

    const overallHealth = criticalCount > 0 ? 'critical' : 
                         warningCount > 0 ? 'warning' : 'healthy';

    return {
      overall_health: overallHealth,
      metrics: usageHealth,
      summary: {
        total_metrics: metrics.length,
        unlimited_metrics: unlimitedCount,
        warning_metrics: warningCount,
        critical_metrics: criticalCount
      }
    };
  }

  /**
   * Reset usage for a user (typically at billing period start)
   */
  static async resetUsage(userId: string): Promise<boolean> {
    const now = new Date();

    // Update usage_reset_date in user_subscriptions
    const { error: updateError } = await supabase
      .from('user_subscriptions')
      .update({ usage_reset_date: now.toISOString() })
      .eq('user_id', userId)
      .in('status', ['trial', 'active']);

    if (updateError) {
      throw new Error(`Failed to reset usage: ${updateError.message}`);
    }

    return true;
  }

  /**
   * Get users approaching their limits (for notifications)
   */
  static async getUsersApproachingLimits(
    threshold: number = 80
  ): Promise<Array<{
    user_id: string;
    email: string;
    name: string;
    tier: SubscriptionTier;
    metrics_approaching: Array<{
      metric_type: UsageMetricType;
      current_usage: number;
      limit: number;
      usage_percentage: number;
    }>;
  }>> {
    // Get all active subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select(`
        user_id,
        tier,
        plan:subscription_plans(limits),
        users(email, name)
      `)
      .in('status', ['trial', 'active']);

    if (subError) {
      throw new Error(`Failed to get subscriptions: ${subError.message}`);
    }

    const results = [];

    for (const subscription of subscriptions || []) {
      const userId = subscription.user_id;
      const metricsApproaching = [];

      const metrics: UsageMetricType[] = [
        'orders_created',
        'api_calls',
        'storage_mb',
        'messages_sent',
        'submissions_received'
      ];

      for (const metric of metrics) {
        const limit = subscription.plan?.limits?.[metric];
        
        // Skip unlimited metrics
        if (!limit || limit === -1) continue;
        
        const currentUsage = await this.getCurrentUsage(userId, metric);
        const usagePercentage = (currentUsage / limit) * 100;

        if (usagePercentage >= threshold) {
          metricsApproaching.push({
            metric_type: metric,
            current_usage: currentUsage,
            limit: limit,
            usage_percentage: Math.round(usagePercentage)
          });
        }
      }

      if (metricsApproaching.length > 0) {
        results.push({
          user_id: userId,
          email: subscription.users?.email || '',
          name: subscription.users?.name || '',
          tier: subscription.tier,
          metrics_approaching: metricsApproaching
        });
      }
    }

    return results;
  }

  /**
   * Batch record usage for multiple users/metrics (for system operations)
   */
  static async batchRecordUsage(
    records: Array<{
      user_id: string;
      metric_type: UsageMetricType;
      increment: number;
      metadata?: Record<string, any>;
    }>
  ): Promise<{
    success: number;
    failed: number;
    errors: Array<{ record: any; error: string }>;
  }> {
    let successCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const record of records) {
      try {
        await this.recordUsage(
          record.user_id,
          record.metric_type,
          record.increment,
          record.metadata
        );
        successCount++;
      } catch (error) {
        failedCount++;
        errors.push({
          record,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      success: successCount,
      failed: failedCount,
      errors
    };
  }
}

/**
 * Usage-based feature gating utilities
 */
export class FeatureGate {
  /**
   * Check if user can create a new order
   */
  static async canCreateOrder(userId: string): Promise<UsageLimitCheck> {
    return UsageManager.checkUsageLimit(userId, 'orders_created', 1);
  }

  /**
   * Check if user can make API calls
   */
  static async canMakeApiCall(userId: string, callCount: number = 1): Promise<UsageLimitCheck> {
    return UsageManager.checkUsageLimit(userId, 'api_calls', callCount);
  }

  /**
   * Check if user can send messages
   */
  static async canSendMessage(userId: string, messageCount: number = 1): Promise<UsageLimitCheck> {
    return UsageManager.checkUsageLimit(userId, 'messages_sent', messageCount);
  }

  /**
   * Check if user can receive submissions
   */
  static async canReceiveSubmission(userId: string): Promise<UsageLimitCheck> {
    return UsageManager.checkUsageLimit(userId, 'submissions_received', 1);
  }

  /**
   * Check if user can upload file (storage check)
   */
  static async canUploadFile(userId: string, fileSizeMB: number): Promise<UsageLimitCheck> {
    return UsageManager.checkUsageLimit(userId, 'storage_mb', Math.ceil(fileSizeMB));
  }

  /**
   * Universal feature gate check with automatic usage recording
   */
  static async executeWithGate<T>(
    userId: string,
    metricType: UsageMetricType,
    increment: number,
    action: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    // Check if action is allowed
    const limitCheck = await UsageManager.checkUsageLimit(userId, metricType, increment);
    
    if (!limitCheck.allowed) {
      throw new Error(`Feature not available: ${limitCheck.reason}`);
    }

    try {
      // Execute the action
      const result = await action();
      
      // Record usage after successful execution
      await UsageManager.recordUsage(userId, metricType, increment, metadata);
      
      return result;
    } catch (error) {
      // Don't record usage if action failed
      throw error;
    }
  }
}

/**
 * Usage analytics and reporting utilities
 */
export class UsageAnalytics {
  /**
   * Get platform-wide usage statistics
   */
  static async getPlatformUsageStats(days: number = 30): Promise<{
    total_users: number;
    active_users: number;
    usage_by_metric: Record<UsageMetricType, {
      total_usage: number;
      average_per_user: number;
      peak_usage: number;
    }>;
    usage_by_tier: Record<SubscriptionTier, {
      user_count: number;
      total_usage: Record<UsageMetricType, number>;
    }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get usage data for the period
    const { data: usageData, error: usageError } = await supabase
      .from('usage_tracking')
      .select(`
        metric_type,
        metric_value,
        user_id,
        subscription_id,
        user_subscriptions!inner(tier)
      `)
      .gte('period_start', startDate.toISOString());

    if (usageError) {
      throw new Error(`Failed to get platform usage stats: ${usageError.message}`);
    }

    // Get user counts
    const { data: userCounts, error: userError } = await supabase
      .from('user_subscriptions')
      .select('user_id, tier, status')
      .in('status', ['trial', 'active', 'past_due']);

    if (userError) {
      throw new Error(`Failed to get user counts: ${userError.message}`);
    }

    const totalUsers = new Set(userCounts?.map(u => u.user_id)).size;
    const activeUsers = new Set(usageData?.map(u => u.user_id)).size;

    // Calculate usage by metric
    const usageByMetric: Record<string, any> = {};
    const metrics: UsageMetricType[] = [
      'orders_created',
      'api_calls',
      'storage_mb',
      'messages_sent',
      'submissions_received'
    ];

    metrics.forEach(metric => {
      const metricData = usageData?.filter(u => u.metric_type === metric) || [];
      const totalUsage = metricData.reduce((sum, u) => sum + u.metric_value, 0);
      const uniqueUsers = new Set(metricData.map(u => u.user_id)).size;
      const averagePerUser = uniqueUsers > 0 ? totalUsage / uniqueUsers : 0;
      const peakUsage = Math.max(...metricData.map(u => u.metric_value), 0);

      usageByMetric[metric] = {
        total_usage: totalUsage,
        average_per_user: Math.round(averagePerUser),
        peak_usage: peakUsage
      };
    });

    // Calculate usage by tier
    const usageByTier: Record<string, any> = {};
    const tiers: SubscriptionTier[] = ['freemium', 'starter', 'professional', 'enterprise'];

    tiers.forEach(tier => {
      const tierUsers = userCounts?.filter(u => u.tier === tier) || [];
      const tierUserIds = new Set(tierUsers.map(u => u.user_id));
      const tierUsageData = usageData?.filter(u => tierUserIds.has(u.user_id)) || [];

      const tierUsage: Record<string, number> = {};
      metrics.forEach(metric => {
        tierUsage[metric] = tierUsageData
          .filter(u => u.metric_type === metric)
          .reduce((sum, u) => sum + u.metric_value, 0);
      });

      usageByTier[tier] = {
        user_count: tierUsers.length,
        total_usage: tierUsage
      };
    });

    return {
      total_users: totalUsers,
      active_users: activeUsers,
      usage_by_metric: usageByMetric as Record<UsageMetricType, any>,
      usage_by_tier: usageByTier as Record<SubscriptionTier, any>
    };
  }

  /**
   * Generate usage report for a specific user
   */
  static async generateUserUsageReport(
    userId: string,
    days: number = 30
  ): Promise<{
    user_summary: {
      user_id: string;
      tier: SubscriptionTier;
      billing_period: { start: Date; end: Date };
    };
    current_usage: Record<UsageMetricType, number>;
    usage_limits: Record<UsageMetricType, number>;
    usage_health: Record<UsageMetricType, 'healthy' | 'warning' | 'critical' | 'unlimited'>;
    historical_usage: UsageTracking[];
    recommendations: string[];
  }> {
    // Get user subscription info
    const { data: subscription, error: subError } = await supabase
      .rpc('get_subscription_summary', { p_user_id: userId });

    if (subError || !subscription.has_subscription) {
      throw new Error('User subscription not found');
    }

    // Get current usage and health
    const [currentUsage, usageHealth, historicalUsage] = await Promise.all([
      UsageManager.getAllUsage(userId),
      UsageManager.getUsageHealth(userId),
      UsageManager.getUsageHistory(userId, undefined, days)
    ]);

    // Generate recommendations
    const recommendations = [];
    const healthMetrics = usageHealth.metrics;

    Object.entries(healthMetrics).forEach(([metric, data]) => {
      if (data.status === 'critical') {
        recommendations.push(`Upgrade your plan - you've exceeded your ${metric.replace('_', ' ')} limit`);
      } else if (data.status === 'warning') {
        recommendations.push(`Consider upgrading - you're using ${data.usage_percentage}% of your ${metric.replace('_', ' ')} limit`);
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('Your usage is healthy - no action needed');
    }

    return {
      user_summary: {
        user_id: userId,
        tier: subscription.tier,
        billing_period: {
          start: new Date(subscription.current_period_start),
          end: new Date(subscription.current_period_end)
        }
      },
      current_usage: currentUsage,
      usage_limits: subscription.plan?.limits || {},
      usage_health: Object.fromEntries(
        Object.entries(healthMetrics).map(([k, v]) => [k, v.status])
      ) as Record<UsageMetricType, any>,
      historical_usage: historicalUsage,
      recommendations
    };
  }
}