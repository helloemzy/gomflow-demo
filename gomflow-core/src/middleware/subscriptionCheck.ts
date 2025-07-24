import { NextRequest, NextResponse } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { 
  SubscriptionPlan, 
  SubscriptionStatus, 
  UserFeatureAccess,
  FeatureAccess,
  UsageMetrics
} from '@gomflow/shared';

// =============================================================================
// SUBSCRIPTION PLAN CONFIGURATIONS
// =============================================================================

export const SUBSCRIPTION_PLANS = {
  freemium: {
    id: 'freemium' as SubscriptionPlan,
    name: 'Freemium',
    description: 'Perfect for trying out GOMFLOW with basic features',
    price_monthly: 0,
    price_yearly: 0,
    currency: 'USD' as const,
    limits: {
      max_orders_per_month: 50,
      max_submissions_per_order: 100,
      max_api_calls_per_day: 100,
      max_sms_per_month: 0,
      max_storage_mb: 100,
      max_webhook_calls_per_day: 50,
      max_team_members: 1,
      custom_branding: false,
      priority_support: false,
      api_access: false,
      advanced_analytics: false,
      white_label: false,
      custom_integrations: false,
      sla_guarantee: false,
    },
    features: {
      order_creation: true,
      payment_tracking: true,
      whatsapp_integration: true,
      telegram_integration: true,
      discord_integration: true,
      smart_payment_agent: false,
      bulk_messaging: false,
      analytics_dashboard: true,
      export_functionality: false,
      custom_domains: false,
      team_collaboration: false,
      api_access: false,
      webhook_notifications: false,
      priority_processing: false,
      custom_branding: false,
      advanced_reporting: false,
      fraud_protection: false,
      dedicated_support: false,
    },
    popular: false,
    trial_days: 14,
    setup_fee: 0,
  },
  starter: {
    id: 'starter' as SubscriptionPlan,
    name: 'Starter',
    description: 'Great for growing GOMs who need more capacity',
    price_monthly: 12,
    price_yearly: 120,
    currency: 'USD' as const,
    limits: {
      max_orders_per_month: 200,
      max_submissions_per_order: 500,
      max_api_calls_per_day: 1000,
      max_sms_per_month: 100,
      max_storage_mb: 1000,
      max_webhook_calls_per_day: 500,
      max_team_members: 3,
      custom_branding: true,
      priority_support: true,
      api_access: false,
      advanced_analytics: true,
      white_label: false,
      custom_integrations: false,
      sla_guarantee: false,
    },
    features: {
      order_creation: true,
      payment_tracking: true,
      whatsapp_integration: true,
      telegram_integration: true,
      discord_integration: true,
      smart_payment_agent: true,
      bulk_messaging: true,
      analytics_dashboard: true,
      export_functionality: true,
      custom_domains: false,
      team_collaboration: true,
      api_access: false,
      webhook_notifications: true,
      priority_processing: false,
      custom_branding: true,
      advanced_reporting: true,
      fraud_protection: true,
      dedicated_support: false,
    },
    popular: true,
    trial_days: 14,
    setup_fee: 0,
  },
  professional: {
    id: 'professional' as SubscriptionPlan,
    name: 'Professional',
    description: 'For professional GOMs who need unlimited scale',
    price_monthly: 25,
    price_yearly: 250,
    currency: 'USD' as const,
    limits: {
      max_orders_per_month: null, // unlimited
      max_submissions_per_order: null,
      max_api_calls_per_day: 10000,
      max_sms_per_month: 1000,
      max_storage_mb: 10000,
      max_webhook_calls_per_day: 5000,
      max_team_members: 10,
      custom_branding: true,
      priority_support: true,
      api_access: true,
      advanced_analytics: true,
      white_label: false,
      custom_integrations: true,
      sla_guarantee: true,
    },
    features: {
      order_creation: true,
      payment_tracking: true,
      whatsapp_integration: true,
      telegram_integration: true,
      discord_integration: true,
      smart_payment_agent: true,
      bulk_messaging: true,
      analytics_dashboard: true,
      export_functionality: true,
      custom_domains: true,
      team_collaboration: true,
      api_access: true,
      webhook_notifications: true,
      priority_processing: true,
      custom_branding: true,
      advanced_reporting: true,
      fraud_protection: true,
      dedicated_support: false,
    },
    popular: false,
    trial_days: 14,
    setup_fee: 0,
  },
  enterprise: {
    id: 'enterprise' as SubscriptionPlan,
    name: 'Enterprise',
    description: 'For large organizations with custom needs',
    price_monthly: 100,
    price_yearly: 1000,
    currency: 'USD' as const,
    limits: {
      max_orders_per_month: null,
      max_submissions_per_order: null,
      max_api_calls_per_day: 100000,
      max_sms_per_month: 10000,
      max_storage_mb: 100000,
      max_webhook_calls_per_day: 50000,
      max_team_members: null, // unlimited
      custom_branding: true,
      priority_support: true,
      api_access: true,
      advanced_analytics: true,
      white_label: true,
      custom_integrations: true,
      sla_guarantee: true,
    },
    features: {
      order_creation: true,
      payment_tracking: true,
      whatsapp_integration: true,
      telegram_integration: true,
      discord_integration: true,
      smart_payment_agent: true,
      bulk_messaging: true,
      analytics_dashboard: true,
      export_functionality: true,
      custom_domains: true,
      team_collaboration: true,
      api_access: true,
      webhook_notifications: true,
      priority_processing: true,
      custom_branding: true,
      advanced_reporting: true,
      fraud_protection: true,
      dedicated_support: true,
    },
    popular: false,
    trial_days: 30,
    setup_fee: 0,
  },
};

// =============================================================================
// MIDDLEWARE FUNCTIONS
// =============================================================================

export interface SubscriptionCheckOptions {
  requiresFeature?: string;
  requiresPlan?: SubscriptionPlan[];
  checkUsage?: keyof UsageMetrics;
  allowTrial?: boolean;
  gracePeriod?: boolean;
}

export async function checkSubscriptionAccess(
  request: NextRequest,
  options: SubscriptionCheckOptions = {}
): Promise<{
  hasAccess: boolean;
  userAccess?: UserFeatureAccess;
  error?: string;
  upgradeRequired?: SubscriptionPlan;
}> {
  try {
    const response = NextResponse.next();
    const supabase = createMiddlewareClient({ req: request, res: response });

    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return { hasAccess: false, error: 'Authentication required' };
    }

    // Get user profile and subscription info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    if (profileError || !profile) {
      return { hasAccess: false, error: 'User profile not found' };
    }

    // Get subscription details
    const subscriptionAccess = await getUserFeatureAccess(
      supabase,
      profile.user_id,
      profile.plan,
      profile.subscription_status
    );

    // Check if user has access
    const accessCheck = await validateAccess(subscriptionAccess, options);
    
    return {
      hasAccess: accessCheck.hasAccess,
      userAccess: subscriptionAccess,
      error: accessCheck.error,
      upgradeRequired: accessCheck.upgradeRequired,
    };

  } catch (error) {
    console.error('Subscription check error:', error);
    return { hasAccess: false, error: 'Subscription validation failed' };
  }
}

async function getUserFeatureAccess(
  supabase: any,
  userId: string,
  plan: SubscriptionPlan,
  subscriptionStatus: SubscriptionStatus
): Promise<UserFeatureAccess> {
  const planConfig = SUBSCRIPTION_PLANS[plan];
  
  // Get current usage metrics
  const { data: usage } = await supabase
    .from('usage_metrics')
    .select('*')
    .eq('user_id', userId)
    .gte('period_end', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Check if in trial
  const isTrialActive = subscriptionStatus === 'trial';
  const hasGracePeriod = ['cancelled', 'expired'].includes(subscriptionStatus);

  // Build feature access object
  const features: Record<string, FeatureAccess> = {};
  
  Object.entries(planConfig.features).forEach(([featureName, enabled]) => {
    const limit = planConfig.limits[featureName as keyof typeof planConfig.limits];
    const used = usage ? usage[`${featureName}_used` as keyof typeof usage] || 0 : 0;

    features[featureName] = {
      feature_name: featureName,
      enabled: enabled || isTrialActive,
      limit: typeof limit === 'number' ? limit : undefined,
      used: typeof used === 'number' ? used : undefined,
      reset_date: usage?.period_end ? new Date(usage.period_end) : undefined,
      upgrade_required: !enabled && !isTrialActive,
      upgrade_plan: !enabled ? getMinimumPlanForFeature(featureName) : undefined,
    };
  });

  return {
    user_id: userId,
    plan,
    subscription_status: subscriptionStatus,
    features,
    trial_features_enabled: isTrialActive,
    grace_period_until: hasGracePeriod ? getGracePeriodEnd(userId) : undefined,
  };
}

async function validateAccess(
  userAccess: UserFeatureAccess,
  options: SubscriptionCheckOptions
): Promise<{
  hasAccess: boolean;
  error?: string;
  upgradeRequired?: SubscriptionPlan;
}> {
  const { requiresFeature, requiresPlan, checkUsage, allowTrial, gracePeriod } = options;

  // Check subscription status
  if (!['active', 'trial'].includes(userAccess.subscription_status)) {
    if (gracePeriod && userAccess.grace_period_until && new Date() < userAccess.grace_period_until) {
      // Allow access during grace period
    } else {
      return {
        hasAccess: false,
        error: 'Subscription not active',
        upgradeRequired: 'starter',
      };
    }
  }

  // Check plan requirements
  if (requiresPlan && !requiresPlan.includes(userAccess.plan)) {
    const minPlan = getMinimumPlan(requiresPlan);
    return {
      hasAccess: false,
      error: `Requires ${minPlan} plan or higher`,
      upgradeRequired: minPlan,
    };
  }

  // Check feature access
  if (requiresFeature) {
    const feature = userAccess.features[requiresFeature];
    if (!feature || !feature.enabled) {
      if (!allowTrial || !userAccess.trial_features_enabled) {
        return {
          hasAccess: false,
          error: `${requiresFeature} feature not available`,
          upgradeRequired: feature?.upgrade_plan || 'starter',
        };
      }
    }

    // Check usage limits
    if (feature?.limit && feature?.used && feature.used >= feature.limit) {
      return {
        hasAccess: false,
        error: `${requiresFeature} usage limit exceeded`,
        upgradeRequired: getNextPlan(userAccess.plan),
      };
    }
  }

  // Check specific usage metric
  if (checkUsage) {
    const feature = userAccess.features[checkUsage];
    if (feature?.limit && feature?.used && feature.used >= feature.limit) {
      return {
        hasAccess: false,
        error: `${checkUsage} limit exceeded`,
        upgradeRequired: getNextPlan(userAccess.plan),
      };
    }
  }

  return { hasAccess: true };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getMinimumPlanForFeature(featureName: string): SubscriptionPlan {
  for (const [planId, planConfig] of Object.entries(SUBSCRIPTION_PLANS)) {
    if (planConfig.features[featureName as keyof typeof planConfig.features]) {
      return planId as SubscriptionPlan;
    }
  }
  return 'starter';
}

function getMinimumPlan(plans: SubscriptionPlan[]): SubscriptionPlan {
  const planOrder: SubscriptionPlan[] = ['freemium', 'starter', 'professional', 'enterprise'];
  for (const plan of planOrder) {
    if (plans.includes(plan)) {
      return plan;
    }
  }
  return 'starter';
}

function getNextPlan(currentPlan: SubscriptionPlan): SubscriptionPlan {
  const planOrder: SubscriptionPlan[] = ['freemium', 'starter', 'professional', 'enterprise'];
  const currentIndex = planOrder.indexOf(currentPlan);
  return planOrder[currentIndex + 1] || 'enterprise';
}

async function getGracePeriodEnd(userId: string): Promise<Date | undefined> {
  // In a real implementation, this would check the database for grace period end date
  // For now, return 7 days from cancellation
  const gracePeriodDays = 7;
  return new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000);
}

// =============================================================================
// FEATURE VALIDATION HELPERS
// =============================================================================

export function canCreateOrder(userAccess: UserFeatureAccess): boolean {
  const feature = userAccess.features.order_creation;
  if (!feature?.enabled) return false;
  
  if (feature.limit && feature.used && feature.used >= feature.limit) {
    return false;
  }
  
  return true;
}

export function canUseAdvancedAnalytics(userAccess: UserFeatureAccess): boolean {
  return userAccess.features.advanced_reporting?.enabled || false;
}

export function canUseBulkMessaging(userAccess: UserFeatureAccess): boolean {
  return userAccess.features.bulk_messaging?.enabled || false;
}

export function canUseAPIAccess(userAccess: UserFeatureAccess): boolean {
  return userAccess.features.api_access?.enabled || false;
}

export function getRemainingOrderQuota(userAccess: UserFeatureAccess): number | null {
  const feature = userAccess.features.order_creation;
  if (!feature?.limit) return null; // unlimited
  
  const used = feature.used || 0;
  return Math.max(0, feature.limit - used);
}

export function getUsagePercentage(userAccess: UserFeatureAccess, featureName: string): number {
  const feature = userAccess.features[featureName];
  if (!feature?.limit || !feature?.used) return 0;
  
  return (feature.used / feature.limit) * 100;
}

// =============================================================================
// MIDDLEWARE RESPONSE HELPERS
// =============================================================================

export function createSubscriptionErrorResponse(
  error: string,
  upgradeRequired?: SubscriptionPlan,
  currentPlan?: SubscriptionPlan
): NextResponse {
  return new NextResponse(
    JSON.stringify({
      error: 'Subscription access denied',
      message: error,
      upgrade_required: upgradeRequired,
      current_plan: currentPlan,
      upgrade_url: `/dashboard/billing?upgrade=${upgradeRequired}`,
    }),
    {
      status: 402, // Payment Required
      headers: {
        'Content-Type': 'application/json',
        'X-Subscription-Error': error,
        'X-Upgrade-Required': upgradeRequired || '',
      },
    }
  );
}

export function createUsageLimitResponse(
  feature: string,
  used: number,
  limit: number,
  resetDate?: Date
): NextResponse {
  return new NextResponse(
    JSON.stringify({
      error: 'Usage limit exceeded',
      message: `You've reached your ${feature} limit`,
      feature,
      used,
      limit,
      reset_date: resetDate?.toISOString(),
      upgrade_url: '/dashboard/billing',
    }),
    {
      status: 429, // Too Many Requests
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetDate?.getTime().toString() || '',
      },
    }
  );
}

// =============================================================================
// ROUTE-SPECIFIC MIDDLEWARE
// =============================================================================

export async function checkOrderCreationAccess(request: NextRequest) {
  return checkSubscriptionAccess(request, {
    requiresFeature: 'order_creation',
    checkUsage: 'orders_created',
    allowTrial: true,
  });
}

export async function checkAnalyticsAccess(request: NextRequest) {
  return checkSubscriptionAccess(request, {
    requiresFeature: 'advanced_reporting',
    requiresPlan: ['professional', 'enterprise'],
    allowTrial: true,
  });
}

export async function checkAPIAccess(request: NextRequest) {
  return checkSubscriptionAccess(request, {
    requiresFeature: 'api_access',
    requiresPlan: ['professional', 'enterprise'],
    allowTrial: false,
  });
}

export async function checkBulkMessagingAccess(request: NextRequest) {
  return checkSubscriptionAccess(request, {
    requiresFeature: 'bulk_messaging',
    requiresPlan: ['starter', 'professional', 'enterprise'],
    allowTrial: true,
  });
}