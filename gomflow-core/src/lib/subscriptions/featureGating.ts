import { 
  SubscriptionPlan, 
  SubscriptionStatus, 
  UserFeatureAccess, 
  FeatureAccess,
  SubscriptionPlanConfig 
} from '@gomflow/shared';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// =============================================================================
// FEATURE GATING SYSTEM
// =============================================================================

export interface FeatureGateResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: SubscriptionPlan;
  trialAvailable?: boolean;
  gracePeriodEnd?: Date;
  usageInfo?: {
    used: number;
    limit: number;
    percentage: number;
  };
}

export interface GradualDegradationConfig {
  enableWarnings: boolean;
  warningThresholds: number[]; // [80, 90, 95] for 80%, 90%, 95%
  gracePeriodDays: number;
  readOnlyMode: boolean;
  featureLockdown: string[]; // features to disable first
}

export class FeatureGatingService {
  private supabase = createClientComponentClient();
  private degradationConfig: GradualDegradationConfig = {
    enableWarnings: true,
    warningThresholds: [80, 90, 95],
    gracePeriodDays: 7,
    readOnlyMode: true,
    featureLockdown: ['bulk_messaging', 'advanced_reporting', 'api_access'],
  };

  // =============================================================================
  // CORE FEATURE GATING
  // =============================================================================

  async checkFeatureAccess(
    userId: string,
    featureName: string,
    options: {
      allowTrial?: boolean;
      allowGracePeriod?: boolean;
      countUsage?: boolean;
    } = {}
  ): Promise<FeatureGateResult> {
    try {
      const userAccess = await this.getUserFeatureAccess(userId);
      const feature = userAccess.features[featureName];

      if (!feature) {
        return {
          allowed: false,
          reason: 'Feature not found',
        };
      }

      // Check basic feature availability
      if (!feature.enabled) {
        // Check if trial provides access
        if (options.allowTrial && userAccess.trial_features_enabled) {
          return { allowed: true, trialAvailable: true };
        }

        return {
          allowed: false,
          reason: `${featureName} is not available on your current plan`,
          upgradeRequired: feature.upgrade_plan,
        };
      }

      // Check usage limits
      if (feature.limit && feature.used !== undefined) {
        const usagePercentage = (feature.used / feature.limit) * 100;

        // Hard limit reached
        if (feature.used >= feature.limit) {
          // Check grace period
          if (options.allowGracePeriod && userAccess.grace_period_until) {
            const now = new Date();
            if (now < userAccess.grace_period_until) {
              return {
                allowed: true,
                reason: 'Grace period access',
                gracePeriodEnd: userAccess.grace_period_until,
                usageInfo: {
                  used: feature.used,
                  limit: feature.limit,
                  percentage: usagePercentage,
                },
              };
            }
          }

          return {
            allowed: false,
            reason: `${featureName} usage limit exceeded`,
            upgradeRequired: this.getUpgradePlan(userAccess.plan),
            usageInfo: {
              used: feature.used,
              limit: feature.limit,
              percentage: usagePercentage,
            },
          };
        }

        // Count usage if requested
        if (options.countUsage) {
          await this.incrementUsage(userId, featureName);
        }

        return {
          allowed: true,
          usageInfo: {
            used: feature.used,
            limit: feature.limit,
            percentage: usagePercentage,
          },
        };
      }

      return { allowed: true };

    } catch (error) {
      console.error('Feature access check failed:', error);
      return {
        allowed: false,
        reason: 'Feature access validation failed',
      };
    }
  }

  // =============================================================================
  // GRACEFUL DEGRADATION
  // =============================================================================

  async getDegradedFeatureSet(userId: string): Promise<{
    availableFeatures: string[];
    restrictedFeatures: string[];
    degradationLevel: 'none' | 'warning' | 'limited' | 'readonly' | 'locked';
    reasoning: string;
  }> {
    const userAccess = await this.getUserFeatureAccess(userId);
    
    // Determine degradation level
    const degradationLevel = this.calculateDegradationLevel(userAccess);
    
    const availableFeatures: string[] = [];
    const restrictedFeatures: string[] = [];

    Object.entries(userAccess.features).forEach(([featureName, feature]) => {
      if (this.isFeatureAvailableInDegradedMode(
        featureName, 
        feature, 
        degradationLevel, 
        userAccess
      )) {
        availableFeatures.push(featureName);
      } else {
        restrictedFeatures.push(featureName);
      }
    });

    return {
      availableFeatures,
      restrictedFeatures,
      degradationLevel,
      reasoning: this.getDegradationReasoning(degradationLevel, userAccess),
    };
  }

  private calculateDegradationLevel(
    userAccess: UserFeatureAccess
  ): 'none' | 'warning' | 'limited' | 'readonly' | 'locked' {
    const { subscription_status, grace_period_until } = userAccess;
    const now = new Date();

    // Active subscription
    if (subscription_status === 'active') {
      // Check if approaching limits
      const highUsageFeatures = Object.values(userAccess.features).filter(feature => {
        if (!feature.limit || !feature.used) return false;
        const percentage = (feature.used / feature.limit) * 100;
        return percentage >= this.degradationConfig.warningThresholds[0]; // 80%
      });

      if (highUsageFeatures.length > 0) {
        return 'warning';
      }
      return 'none';
    }

    // Trial period
    if (subscription_status === 'trial') {
      return 'none'; // Full access during trial
    }

    // Grace period
    if (grace_period_until && now < grace_period_until) {
      const daysRemaining = Math.ceil(
        (grace_period_until.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysRemaining > 3) {
        return 'limited';
      } else {
        return 'readonly';
      }
    }

    // Subscription expired/cancelled
    if (['expired', 'cancelled', 'inactive'].includes(subscription_status)) {
      return 'locked';
    }

    return 'locked';
  }

  private isFeatureAvailableInDegradedMode(
    featureName: string,
    feature: FeatureAccess,
    degradationLevel: 'none' | 'warning' | 'limited' | 'readonly' | 'locked',
    userAccess: UserFeatureAccess
  ): boolean {
    // Core features that should always be available for data access
    const coreReadOnlyFeatures = [
      'analytics_dashboard',
      'export_functionality',
      'payment_tracking',
    ];

    // Essential features that should work in limited mode
    const essentialFeatures = [
      'order_creation',
      'payment_tracking',
      'whatsapp_integration',
      'telegram_integration',
      'discord_integration',
    ];

    switch (degradationLevel) {
      case 'none':
        return feature.enabled;

      case 'warning':
        return feature.enabled;

      case 'limited':
        // Allow essential features but restrict advanced ones
        if (essentialFeatures.includes(featureName)) {
          return feature.enabled;
        }
        if (this.degradationConfig.featureLockdown.includes(featureName)) {
          return false;
        }
        return feature.enabled;

      case 'readonly':
        // Only allow read-only features
        return coreReadOnlyFeatures.includes(featureName) && feature.enabled;

      case 'locked':
        // Very limited access - only viewing existing data
        return featureName === 'analytics_dashboard' && feature.enabled;

      default:
        return false;
    }
  }

  private getDegradationReasoning(
    degradationLevel: 'none' | 'warning' | 'limited' | 'readonly' | 'locked',
    userAccess: UserFeatureAccess
  ): string {
    switch (degradationLevel) {
      case 'none':
        return 'Full access to all features';

      case 'warning':
        return 'Approaching usage limits - consider upgrading soon';

      case 'limited':
        return `Grace period active - limited features available until ${userAccess.grace_period_until?.toLocaleDateString()}`;

      case 'readonly':
        return 'Grace period ending soon - read-only access to preserve your data';

      case 'locked':
        return 'Subscription expired - upgrade to restore full access';

      default:
        return 'Access restricted';
    }
  }

  // =============================================================================
  // USAGE TRACKING
  // =============================================================================

  async incrementUsage(
    userId: string,
    featureName: string,
    amount: number = 1
  ): Promise<void> {
    try {
      const now = new Date();
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      // Update or create usage metrics for current period
      const { error } = await this.supabase
        .from('usage_metrics')
        .upsert({
          user_id: userId,
          period_start: currentMonth.toISOString(),
          period_end: nextMonth.toISOString(),
          [`${featureName}_used`]: amount,
          last_updated: now.toISOString(),
        }, {
          onConflict: 'user_id,period_start',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error('Failed to increment usage:', error);
      }

      // Check if user is approaching limits
      await this.checkUsageLimits(userId, featureName);

    } catch (error) {
      console.error('Usage increment failed:', error);
    }
  }

  private async checkUsageLimits(userId: string, featureName: string): Promise<void> {
    const userAccess = await this.getUserFeatureAccess(userId);
    const feature = userAccess.features[featureName];

    if (!feature?.limit || !feature?.used) return;

    const percentage = (feature.used / feature.limit) * 100;
    
    // Check if we've crossed any warning thresholds
    for (const threshold of this.degradationConfig.warningThresholds) {
      if (percentage >= threshold) {
        await this.createUsageLimitAlert(userId, featureName, feature, threshold);
      }
    }
  }

  private async createUsageLimitAlert(
    userId: string,
    featureName: string,
    feature: FeatureAccess,
    threshold: number
  ): Promise<void> {
    try {
      // Check if alert already sent for this threshold
      const { data: existingAlert } = await this.supabase
        .from('usage_limit_alerts')
        .select('id')
        .eq('user_id', userId)
        .eq('metric_type', featureName)
        .eq('alert_threshold', threshold)
        .eq('resolved', false)
        .single();

      if (existingAlert) return; // Alert already sent

      // Create new alert
      await this.supabase
        .from('usage_limit_alerts')
        .insert({
          user_id: userId,
          metric_type: featureName,
          limit_value: feature.limit!,
          current_value: feature.used!,
          percentage_used: (feature.used! / feature.limit!) * 100,
          alert_threshold: threshold,
          alert_sent: false, // Will be sent by notification service
          resolved: false,
        });

    } catch (error) {
      console.error('Failed to create usage limit alert:', error);
    }
  }

  // =============================================================================
  // FEATURE ACCESS UTILITIES
  // =============================================================================

  async getUserFeatureAccess(userId: string): Promise<UserFeatureAccess> {
    // Get user profile
    const { data: profile, error: profileError } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    // Get current usage metrics
    const { data: usage } = await this.supabase
      .from('usage_metrics')
      .select('*')
      .eq('user_id', userId)
      .gte('period_end', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return this.buildUserFeatureAccess(profile, usage);
  }

  private buildUserFeatureAccess(profile: any, usage: any): UserFeatureAccess {
    const plan = profile.plan as SubscriptionPlan;
    const subscriptionStatus = profile.subscription_status as SubscriptionStatus;
    
    // This would normally come from your subscription plans configuration
    const planConfig = this.getPlanConfiguration(plan);
    
    const features: Record<string, FeatureAccess> = {};
    
    Object.entries(planConfig.features).forEach(([featureName, enabled]) => {
      const limit = planConfig.limits[featureName as keyof typeof planConfig.limits];
      const used = usage ? usage[`${featureName}_used`] || 0 : 0;

      features[featureName] = {
        feature_name: featureName,
        enabled: Boolean(enabled),
        limit: typeof limit === 'number' ? limit : undefined,
        used: typeof used === 'number' ? used : undefined,
        reset_date: usage?.period_end ? new Date(usage.period_end) : undefined,
        upgrade_required: !enabled,
        upgrade_plan: !enabled ? this.getMinimumPlanForFeature(featureName) : undefined,
      };
    });

    return {
      user_id: profile.user_id,
      plan,
      subscription_status: subscriptionStatus,
      features,
      trial_features_enabled: subscriptionStatus === 'trial',
      grace_period_until: this.calculateGracePeriodEnd(profile),
    };
  }

  private getPlanConfiguration(plan: SubscriptionPlan): SubscriptionPlanConfig {
    // Import your plan configurations
    const { SUBSCRIPTION_PLANS } = require('../middleware/subscriptionCheck');
    return SUBSCRIPTION_PLANS[plan];
  }

  private getMinimumPlanForFeature(featureName: string): SubscriptionPlan {
    const { SUBSCRIPTION_PLANS } = require('../middleware/subscriptionCheck');
    
    for (const [planId, planConfig] of Object.entries(SUBSCRIPTION_PLANS)) {
      if ((planConfig as any).features[featureName]) {
        return planId as SubscriptionPlan;
      }
    }
    return 'starter';
  }

  private getUpgradePlan(currentPlan: SubscriptionPlan): SubscriptionPlan {
    const planOrder: SubscriptionPlan[] = ['freemium', 'starter', 'professional', 'enterprise'];
    const currentIndex = planOrder.indexOf(currentPlan);
    return planOrder[currentIndex + 1] || 'enterprise';
  }

  private calculateGracePeriodEnd(profile: any): Date | undefined {
    if (!['cancelled', 'expired'].includes(profile.subscription_status)) {
      return undefined;
    }

    // Calculate grace period end (would normally be stored in database)
    const gracePeriodDays = this.degradationConfig.gracePeriodDays;
    const cancelledAt = profile.cancelled_at ? new Date(profile.cancelled_at) : new Date();
    
    return new Date(cancelledAt.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000);
  }

  // =============================================================================
  // BATCH OPERATIONS
  // =============================================================================

  async checkMultipleFeatures(
    userId: string,
    featureNames: string[],
    options: { allowTrial?: boolean; allowGracePeriod?: boolean } = {}
  ): Promise<Record<string, FeatureGateResult>> {
    const userAccess = await this.getUserFeatureAccess(userId);
    const results: Record<string, FeatureGateResult> = {};

    for (const featureName of featureNames) {
      const feature = userAccess.features[featureName];
      
      if (!feature) {
        results[featureName] = {
          allowed: false,
          reason: 'Feature not found',
        };
        continue;
      }

      results[featureName] = await this.checkFeatureAccess(userId, featureName, options);
    }

    return results;
  }

  async getFeatureUsageSummary(userId: string): Promise<{
    totalFeatures: number;
    enabledFeatures: number;
    featuresAtLimit: number;
    featuresNearLimit: number;
    overallUsageHealth: 'good' | 'warning' | 'critical';
  }> {
    const userAccess = await this.getUserFeatureAccess(userId);
    const features = Object.values(userAccess.features);

    const totalFeatures = features.length;
    const enabledFeatures = features.filter(f => f.enabled).length;
    const featuresAtLimit = features.filter(f => 
      f.limit && f.used && f.used >= f.limit
    ).length;
    const featuresNearLimit = features.filter(f => 
      f.limit && f.used && (f.used / f.limit) >= 0.8 && f.used < f.limit
    ).length;

    let overallUsageHealth: 'good' | 'warning' | 'critical' = 'good';
    if (featuresAtLimit > 0) {
      overallUsageHealth = 'critical';
    } else if (featuresNearLimit > 2) {
      overallUsageHealth = 'warning';
    }

    return {
      totalFeatures,
      enabledFeatures,
      featuresAtLimit,
      featuresNearLimit,
      overallUsageHealth,
    };
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const featureGating = new FeatureGatingService();