import { 
  SubscriptionPlan, 
  TrialStatus, 
  TrialExtension, 
  UserSubscription 
} from '@gomflow/shared';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// =============================================================================
// TRIAL MANAGEMENT SYSTEM
// =============================================================================

export interface TrialConfig {
  defaultTrialDays: number;
  extensionLimits: {
    maxExtensions: number;
    maxExtensionDays: number;
    totalMaxTrialDays: number;
  };
  autoConversionEnabled: boolean;
  preExpirationNotifications: number[]; // Days before expiration to send notifications
}

export interface TrialInfo {
  isActive: boolean;
  status: TrialStatus;
  startDate: Date;
  endDate: Date;
  daysRemaining: number;
  daysUsed: number;
  totalTrialDays: number;
  extensions: TrialExtension[];
  canExtend: boolean;
  conversionEligible: boolean;
  nextNotificationDate?: Date;
}

export interface ConversionMetrics {
  trialUsage: {
    ordersCreated: number;
    submissionsReceived: number;
    featuresUsed: string[];
    lastActivityDate: Date;
    engagementScore: number;
  };
  conversionProbability: number;
  recommendedPlan: SubscriptionPlan;
  conversionIncentives: string[];
}

export class TrialManagementService {
  private supabase = createClientComponentClient();
  private config: TrialConfig = {
    defaultTrialDays: 14,
    extensionLimits: {
      maxExtensions: 2,
      maxExtensionDays: 7,
      totalMaxTrialDays: 30,
    },
    autoConversionEnabled: true,
    preExpirationNotifications: [7, 3, 1], // Days before expiration
  };

  // =============================================================================
  // TRIAL INITIALIZATION
  // =============================================================================

  async startTrial(
    userId: string,
    plan: SubscriptionPlan = 'starter',
    customTrialDays?: number
  ): Promise<{
    success: boolean;
    subscription?: UserSubscription;
    trialInfo?: TrialInfo;
    error?: string;
  }> {
    try {
      // Check if user already has an active subscription
      const { data: existingSubscription } = await this.supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (existingSubscription) {
        return {
          success: false,
          error: 'User already has an active subscription',
        };
      }

      // Check if user has already used a trial
      const { data: previousTrial } = await this.supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .not('trial_start_date', 'is', null)
        .single();

      if (previousTrial) {
        return {
          success: false,
          error: 'Trial already used for this account',
        };
      }

      const trialDays = customTrialDays || this.config.defaultTrialDays;
      const now = new Date();
      const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

      // Create trial subscription
      const { data: subscription, error: subscriptionError } = await this.supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan,
          status: 'trial',
          billing_cycle: 'monthly',
          amount: 0,
          currency: 'USD',
          trial_start_date: now.toISOString(),
          trial_end_date: trialEnd.toISOString(),
          trial_status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: trialEnd.toISOString(),
          cancel_at_period_end: false,
        })
        .select()
        .single();

      if (subscriptionError) {
        throw new Error(`Failed to create trial subscription: ${subscriptionError.message}`);
      }

      // Update user profile
      await this.supabase
        .from('profiles')
        .update({
          subscription_status: 'trial',
          plan,
        })
        .eq('user_id', userId);

      // Schedule trial notifications
      await this.scheduleTrialNotifications(userId, trialEnd);

      // Log trial event
      await this.logSubscriptionEvent(userId, subscription.id, 'trial_started', {
        plan,
        trial_days: trialDays,
      });

      const trialInfo = await this.getTrialInfo(userId);

      return {
        success: true,
        subscription,
        trialInfo: trialInfo!,
      };

    } catch (error) {
      console.error('Trial initialization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start trial',
      };
    }
  }

  // =============================================================================
  // TRIAL INFO & STATUS
  // =============================================================================

  async getTrialInfo(userId: string): Promise<TrialInfo | null> {
    try {
      const { data: subscription } = await this.supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .not('trial_start_date', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!subscription || !subscription.trial_start_date || !subscription.trial_end_date) {
        return null;
      }

      const startDate = new Date(subscription.trial_start_date);
      const endDate = new Date(subscription.trial_end_date);
      const now = new Date();

      const totalTrialDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysUsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      // Get trial extensions
      const { data: extensions } = await this.supabase
        .from('trial_extensions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const isActive = subscription.trial_status === 'active' && now < endDate;
      const canExtend = await this.canExtendTrial(userId);
      const conversionEligible = await this.isEligibleForConversion(userId);

      return {
        isActive,
        status: subscription.trial_status as TrialStatus,
        startDate,
        endDate,
        daysRemaining,
        daysUsed,
        totalTrialDays,
        extensions: extensions || [],
        canExtend,
        conversionEligible,
        nextNotificationDate: await this.getNextNotificationDate(userId, endDate),
      };

    } catch (error) {
      console.error('Failed to get trial info:', error);
      return null;
    }
  }

  // =============================================================================
  // TRIAL EXTENSIONS
  // =============================================================================

  async extendTrial(
    userId: string,
    extensionDays: number,
    reason: string,
    grantedBy?: string
  ): Promise<{
    success: boolean;
    newEndDate?: Date;
    extension?: TrialExtension;
    error?: string;
  }> {
    try {
      const canExtend = await this.canExtendTrial(userId);
      if (!canExtend.allowed) {
        return {
          success: false,
          error: canExtend.reason,
        };
      }

      // Get current subscription
      const { data: subscription } = await this.supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'trial')
        .single();

      if (!subscription) {
        return {
          success: false,
          error: 'No active trial found',
        };
      }

      const currentEndDate = new Date(subscription.trial_end_date);
      const newEndDate = new Date(currentEndDate.getTime() + extensionDays * 24 * 60 * 60 * 1000);

      // Update subscription
      const { error: updateError } = await this.supabase
        .from('user_subscriptions')
        .update({
          trial_end_date: newEndDate.toISOString(),
          current_period_end: newEndDate.toISOString(),
        })
        .eq('id', subscription.id);

      if (updateError) {
        throw new Error(`Failed to update trial: ${updateError.message}`);
      }

      // Create extension record
      const { data: extension, error: extensionError } = await this.supabase
        .from('trial_extensions')
        .insert({
          user_id: userId,
          original_trial_end: currentEndDate.toISOString(),
          extended_trial_end: newEndDate.toISOString(),
          extension_days: extensionDays,
          reason,
          granted_by: grantedBy,
        })
        .select()
        .single();

      if (extensionError) {
        throw new Error(`Failed to create extension record: ${extensionError.message}`);
      }

      // Update notification schedule
      await this.scheduleTrialNotifications(userId, newEndDate);

      // Log event
      await this.logSubscriptionEvent(userId, subscription.id, 'trial_extended', {
        extension_days: extensionDays,
        new_end_date: newEndDate.toISOString(),
        reason,
      });

      return {
        success: true,
        newEndDate,
        extension,
      };

    } catch (error) {
      console.error('Trial extension failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to extend trial',
      };
    }
  }

  private async canExtendTrial(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    remainingExtensions?: number;
  }> {
    // Get existing extensions
    const { data: extensions } = await this.supabase
      .from('trial_extensions')
      .select('*')
      .eq('user_id', userId);

    const extensionCount = extensions?.length || 0;

    if (extensionCount >= this.config.extensionLimits.maxExtensions) {
      return {
        allowed: false,
        reason: 'Maximum trial extensions reached',
      };
    }

    // Check total trial days
    const { data: subscription } = await this.supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'trial')
      .single();

    if (subscription) {
      const startDate = new Date(subscription.trial_start_date);
      const endDate = new Date(subscription.trial_end_date);
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      if (totalDays >= this.config.extensionLimits.totalMaxTrialDays) {
        return {
          allowed: false,
          reason: 'Maximum total trial period reached',
        };
      }
    }

    return {
      allowed: true,
      remainingExtensions: this.config.extensionLimits.maxExtensions - extensionCount,
    };
  }

  // =============================================================================
  // TRIAL CONVERSION
  // =============================================================================

  async convertTrialToPaid(
    userId: string,
    targetPlan: SubscriptionPlan,
    billingCycle: 'monthly' | 'yearly' = 'monthly',
    paymentMethodId?: string
  ): Promise<{
    success: boolean;
    subscription?: UserSubscription;
    error?: string;
  }> {
    try {
      // Get current trial subscription
      const { data: trialSubscription } = await this.supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'trial')
        .single();

      if (!trialSubscription) {
        return {
          success: false,
          error: 'No active trial found',
        };
      }

      // Calculate pricing
      const pricing = await this.calculateConversionPricing(targetPlan, billingCycle);

      // Create paid subscription
      const now = new Date();
      const nextBilling = new Date(
        now.getTime() + (billingCycle === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000
      );

      const { data: paidSubscription, error: subscriptionError } = await this.supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan: targetPlan,
          status: 'active',
          billing_cycle: billingCycle,
          amount: pricing.amount,
          currency: pricing.currency,
          current_period_start: now.toISOString(),
          current_period_end: nextBilling.toISOString(),
          next_billing_date: nextBilling.toISOString(),
          cancel_at_period_end: false,
        })
        .select()
        .single();

      if (subscriptionError) {
        throw new Error(`Failed to create paid subscription: ${subscriptionError.message}`);
      }

      // Update trial subscription status
      await this.supabase
        .from('user_subscriptions')
        .update({
          status: 'cancelled',
          trial_status: 'converted',
        })
        .eq('id', trialSubscription.id);

      // Update user profile
      await this.supabase
        .from('profiles')
        .update({
          subscription_status: 'active',
          plan: targetPlan,
        })
        .eq('user_id', userId);

      // Log conversion event
      await this.logSubscriptionEvent(userId, paidSubscription.id, 'trial_converted', {
        from_plan: trialSubscription.plan,
        to_plan: targetPlan,
        billing_cycle: billingCycle,
        conversion_amount: pricing.amount,
      });

      return {
        success: true,
        subscription: paidSubscription,
      };

    } catch (error) {
      console.error('Trial conversion failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert trial',
      };
    }
  }

  async getConversionMetrics(userId: string): Promise<ConversionMetrics | null> {
    try {
      const trialInfo = await this.getTrialInfo(userId);
      if (!trialInfo || !trialInfo.isActive) return null;

      // Get trial usage metrics
      const { data: usage } = await this.supabase
        .from('usage_metrics')
        .select('*')
        .eq('user_id', userId)
        .gte('period_start', trialInfo.startDate.toISOString())
        .single();

      // Get feature usage logs
      const { data: featureLogs } = await this.supabase
        .from('feature_usage_logs')
        .select('feature_name, timestamp')
        .eq('user_id', userId)
        .gte('timestamp', trialInfo.startDate.toISOString())
        .order('timestamp', { ascending: false });

      const ordersCreated = usage?.orders_created || 0;
      const submissionsReceived = usage?.submissions_received || 0;
      const featuresUsed = [...new Set(featureLogs?.map(log => log.feature_name) || [])];
      const lastActivityDate = featureLogs?.[0]?.timestamp ? 
        new Date(featureLogs[0].timestamp) : trialInfo.startDate;

      // Calculate engagement score (0-100)
      const engagementScore = this.calculateEngagementScore({
        ordersCreated,
        submissionsReceived,
        featuresUsed: featuresUsed.length,
        daysActive: trialInfo.daysUsed,
        totalTrialDays: trialInfo.totalTrialDays,
      });

      // Calculate conversion probability
      const conversionProbability = this.calculateConversionProbability({
        engagementScore,
        ordersCreated,
        submissionsReceived,
        daysRemaining: trialInfo.daysRemaining,
        featuresUsed: featuresUsed.length,
      });

      // Recommend plan based on usage
      const recommendedPlan = this.recommendPlanForConversion({
        ordersCreated,
        submissionsReceived,
        featuresUsed,
      });

      // Generate conversion incentives
      const conversionIncentives = this.generateConversionIncentives({
        daysRemaining: trialInfo.daysRemaining,
        engagementScore,
        recommendedPlan,
      });

      return {
        trialUsage: {
          ordersCreated,
          submissionsReceived,
          featuresUsed,
          lastActivityDate,
          engagementScore,
        },
        conversionProbability,
        recommendedPlan,
        conversionIncentives,
      };

    } catch (error) {
      console.error('Failed to get conversion metrics:', error);
      return null;
    }
  }

  // =============================================================================
  // TRIAL EXPIRATION HANDLING
  // =============================================================================

  async handleTrialExpiration(userId: string): Promise<void> {
    try {
      const trialInfo = await this.getTrialInfo(userId);
      if (!trialInfo || trialInfo.isActive) return;

      // Update subscription status
      await this.supabase
        .from('user_subscriptions')
        .update({
          status: 'expired',
          trial_status: 'expired',
        })
        .eq('user_id', userId)
        .eq('status', 'trial');

      // Update user profile
      await this.supabase
        .from('profiles')
        .update({
          subscription_status: 'expired',
          plan: 'freemium', // Downgrade to freemium
        })
        .eq('user_id', userId);

      // Log expiration event
      const { data: subscription } = await this.supabase
        .from('user_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('trial_status', 'expired')
        .single();

      if (subscription) {
        await this.logSubscriptionEvent(userId, subscription.id, 'trial_ended', {
          reason: 'expired',
        });
      }

      // Trigger post-trial sequence (notifications, offers, etc.)
      await this.initiatePostTrialSequence(userId);

    } catch (error) {
      console.error('Trial expiration handling failed:', error);
    }
  }

  // =============================================================================
  // UTILITY FUNCTIONS
  // =============================================================================

  private async calculateConversionPricing(
    plan: SubscriptionPlan,
    billingCycle: 'monthly' | 'yearly'
  ): Promise<{ amount: number; currency: string }> {
    // This would integrate with your pricing configuration
    const pricing = {
      starter: { monthly: 12, yearly: 120 },
      professional: { monthly: 25, yearly: 250 },
      enterprise: { monthly: 100, yearly: 1000 },
    };

    return {
      amount: pricing[plan as keyof typeof pricing]?.[billingCycle] || 0,
      currency: 'USD',
    };
  }

  private calculateEngagementScore(metrics: {
    ordersCreated: number;
    submissionsReceived: number;
    featuresUsed: number;
    daysActive: number;
    totalTrialDays: number;
  }): number {
    const weights = {
      orders: 30,
      submissions: 25,
      features: 20,
      consistency: 25,
    };

    const orderScore = Math.min(100, (metrics.ordersCreated / 10) * 100);
    const submissionScore = Math.min(100, (metrics.submissionsReceived / 50) * 100);
    const featureScore = Math.min(100, (metrics.featuresUsed / 10) * 100);
    const consistencyScore = (metrics.daysActive / metrics.totalTrialDays) * 100;

    return Math.round(
      (orderScore * weights.orders +
       submissionScore * weights.submissions +
       featureScore * weights.features +
       consistencyScore * weights.consistency) / 100
    );
  }

  private calculateConversionProbability(factors: {
    engagementScore: number;
    ordersCreated: number;
    submissionsReceived: number;
    daysRemaining: number;
    featuresUsed: number;
  }): number {
    // Simple scoring model - would be more sophisticated in production
    let probability = 0;

    // Engagement score influence (50%)
    probability += (factors.engagementScore / 100) * 50;

    // Order creation influence (20%)
    if (factors.ordersCreated > 0) probability += 20;
    else if (factors.ordersCreated > 5) probability += 30;

    // Feature adoption influence (15%)
    probability += Math.min(15, factors.featuresUsed * 3);

    // Time urgency influence (15%)
    if (factors.daysRemaining <= 1) probability += 15;
    else if (factors.daysRemaining <= 3) probability += 10;
    else if (factors.daysRemaining <= 7) probability += 5;

    return Math.min(100, Math.max(0, probability));
  }

  private recommendPlanForConversion(usage: {
    ordersCreated: number;
    submissionsReceived: number;
    featuresUsed: string[];
  }): SubscriptionPlan {
    if (usage.ordersCreated > 50 || usage.submissionsReceived > 200) {
      return 'professional';
    }
    
    if (usage.ordersCreated > 10 || usage.submissionsReceived > 50) {
      return 'starter';
    }

    return 'starter'; // Default recommendation
  }

  private generateConversionIncentives(factors: {
    daysRemaining: number;
    engagementScore: number;
    recommendedPlan: SubscriptionPlan;
  }): string[] {
    const incentives: string[] = [];

    if (factors.daysRemaining <= 1) {
      incentives.push('🔥 Last day of trial - Don\'t lose your data!');
      incentives.push('💰 Convert today and get 20% off your first month');
    } else if (factors.daysRemaining <= 3) {
      incentives.push('⏰ Only 3 days left in your trial');
      incentives.push('🎯 Convert now and get 15% off your first month');
    }

    if (factors.engagementScore > 70) {
      incentives.push('🌟 You\'re getting great results - keep the momentum going!');
    }

    incentives.push(`📈 Upgrade to ${factors.recommendedPlan} for unlimited growth`);

    return incentives;
  }

  private async isEligibleForConversion(userId: string): Promise<boolean> {
    // Check if user has completed key onboarding steps
    const { data: profile } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!profile) return false;

    // Basic eligibility criteria
    return profile.phone && profile.name;
  }

  private async scheduleTrialNotifications(userId: string, trialEndDate: Date): Promise<void> {
    // This would integrate with your notification scheduling system
    for (const days of this.config.preExpirationNotifications) {
      const notificationDate = new Date(trialEndDate.getTime() - days * 24 * 60 * 60 * 1000);
      
      // Schedule notification (implementation depends on your notification system)
      console.log(`Scheduling trial notification for ${userId} on ${notificationDate.toISOString()}`);
    }
  }

  private async getNextNotificationDate(userId: string, trialEndDate: Date): Promise<Date | undefined> {
    const now = new Date();
    
    for (const days of this.config.preExpirationNotifications) {
      const notificationDate = new Date(trialEndDate.getTime() - days * 24 * 60 * 60 * 1000);
      if (notificationDate > now) {
        return notificationDate;
      }
    }
    
    return undefined;
  }

  private async initiatePostTrialSequence(userId: string): Promise<void> {
    // This would trigger post-trial email sequences, special offers, etc.
    console.log(`Initiating post-trial sequence for user ${userId}`);
  }

  private async logSubscriptionEvent(
    userId: string,
    subscriptionId: string,
    eventType: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await this.supabase
        .from('subscription_events')
        .insert({
          user_id: userId,
          subscription_id: subscriptionId,
          event_type: eventType,
          metadata,
        });
    } catch (error) {
      console.error('Failed to log subscription event:', error);
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const trialManagement = new TrialManagementService();