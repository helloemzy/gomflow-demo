import { createClient } from '@supabase/supabase-js';
import {
  SubscriptionPlan,
  SubscriptionTier,
  CurrencyCode,
  BillingCycle,
  PlanPricing,
  RegionalPricing,
  PlanFeature,
  PlanLimit,
  UsageMetricType
} from 'gomflow-shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Plan management utilities
 */
export class PlanManager {
  /**
   * Get all active subscription plans
   */
  static async getActivePlans(currency?: CurrencyCode): Promise<SubscriptionPlan[]> {
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch active plans: ${error.message}`);
    }

    return plans?.map(plan => ({
      ...plan,
      created_at: new Date(plan.created_at),
      updated_at: new Date(plan.updated_at)
    })) || [];
  }

  /**
   * Get plan by ID
   */
  static async getPlanById(planId: string): Promise<SubscriptionPlan | null> {
    const { data: plan, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch plan: ${error.message}`);
    }

    return {
      ...plan,
      created_at: new Date(plan.created_at),
      updated_at: new Date(plan.updated_at)
    };
  }

  /**
   * Get plan by tier
   */
  static async getPlanByTier(tier: SubscriptionTier): Promise<SubscriptionPlan | null> {
    const { data: plan, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('tier', tier)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to fetch plan by tier: ${error.message}`);
    }

    return {
      ...plan,
      created_at: new Date(plan.created_at),
      updated_at: new Date(plan.updated_at)
    };
  }

  /**
   * Get plan pricing for specific currency and billing cycle
   */
  static async getPlanPricing(planId: string, currency: CurrencyCode, billingCycle: BillingCycle): Promise<number> {
    const { data: price, error } = await supabase
      .rpc('get_plan_price', {
        plan_id: planId,
        p_currency: currency,
        p_billing_cycle: billingCycle
      });

    if (error) {
      throw new Error(`Failed to get plan pricing: ${error.message}`);
    }

    return price || 0;
  }

  /**
   * Get all pricing for a plan
   */
  static async getAllPlanPricing(planId: string): Promise<PlanPricing> {
    const plan = await this.getPlanById(planId);
    if (!plan) {
      throw new Error('Plan not found');
    }

    const monthly = {
      PHP: plan.price_php || 0,
      MYR: plan.price_myr || 0,
      THB: plan.price_thb || 0,
      IDR: plan.price_idr || 0,
      USD: plan.price_usd || 0
    };

    const annually = {
      PHP: plan.annual_price_php || 0,
      MYR: plan.annual_price_myr || 0,
      THB: plan.annual_price_thb || 0,
      IDR: plan.annual_price_idr || 0,
      USD: plan.annual_price_usd || 0
    };

    // Calculate average savings percentage across all currencies
    const currencies: CurrencyCode[] = ['PHP', 'MYR', 'THB', 'IDR', 'USD'];
    let totalSavings = 0;
    let validCurrencies = 0;

    currencies.forEach(currency => {
      const monthlyPrice = monthly[currency];
      const annualPrice = annually[currency];
      
      if (monthlyPrice > 0 && annualPrice > 0) {
        const annualEquivalent = monthlyPrice * 12;
        const savings = ((annualEquivalent - annualPrice) / annualEquivalent) * 100;
        totalSavings += savings;
        validCurrencies++;
      }
    });

    const savingsPercentage = validCurrencies > 0 ? Math.round(totalSavings / validCurrencies) : 0;

    return {
      monthly,
      annually,
      savings_percentage: savingsPercentage
    };
  }

  /**
   * Calculate pro-ration amount for plan switching
   */
  static async calculateProration(
    oldAmount: number,
    newAmount: number,
    daysUsed: number,
    totalDays: number
  ): Promise<number> {
    const { data: prorationAmount, error } = await supabase
      .rpc('calculate_proration', {
        old_amount: oldAmount,
        new_amount: newAmount,
        days_used: daysUsed,
        total_days: totalDays
      });

    if (error) {
      throw new Error(`Failed to calculate proration: ${error.message}`);
    }

    return prorationAmount || 0;
  }

  /**
   * Compare two plans and return differences
   */
  static async comparePlans(planId1: string, planId2: string): Promise<{
    plan1: SubscriptionPlan;
    plan2: SubscriptionPlan;
    feature_differences: { feature: string; plan1_has: boolean; plan2_has: boolean }[];
    limit_differences: { metric: UsageMetricType; plan1_limit: number; plan2_limit: number }[];
  }> {
    const [plan1, plan2] = await Promise.all([
      this.getPlanById(planId1),
      this.getPlanById(planId2)
    ]);

    if (!plan1 || !plan2) {
      throw new Error('One or both plans not found');
    }

    // Compare features
    const allFeatures = new Set([
      ...Object.keys(plan1.features),
      ...Object.keys(plan2.features)
    ]);

    const feature_differences = Array.from(allFeatures).map(feature => ({
      feature,
      plan1_has: plan1.features[feature] || false,
      plan2_has: plan2.features[feature] || false
    })).filter(diff => diff.plan1_has !== diff.plan2_has);

    // Compare limits
    const allMetrics = new Set([
      ...Object.keys(plan1.limits),
      ...Object.keys(plan2.limits)
    ]) as Set<UsageMetricType>;

    const limit_differences = Array.from(allMetrics).map(metric => ({
      metric,
      plan1_limit: plan1.limits[metric] || 0,
      plan2_limit: plan2.limits[metric] || 0
    })).filter(diff => diff.plan1_limit !== diff.plan2_limit);

    return {
      plan1,
      plan2,
      feature_differences,
      limit_differences
    };
  }
}

/**
 * Plan configuration and constants
 */
export class PlanConfig {
  /**
   * Feature definitions for all GOMFLOW features
   */
  static readonly FEATURE_DEFINITIONS: Record<string, PlanFeature> = {
    order_creation: {
      key: 'order_creation',
      name: 'Order Creation',
      description: 'Create and manage group orders',
      category: 'core',
      icon: '📝'
    },
    basic_analytics: {
      key: 'basic_analytics',
      name: 'Basic Analytics',
      description: 'View order performance and basic statistics',
      category: 'analytics',
      icon: '📊'
    },
    advanced_analytics: {
      key: 'advanced_analytics',
      name: 'Advanced Analytics',
      description: 'Detailed insights, trends, and performance metrics',
      category: 'analytics',
      icon: '📈'
    },
    predictive_analytics: {
      key: 'predictive_analytics',
      name: 'Predictive Analytics',
      description: 'AI-powered demand forecasting and market intelligence',
      category: 'analytics',
      icon: '🔮'
    },
    market_intelligence: {
      key: 'market_intelligence',
      name: 'Market Intelligence',
      description: 'Real-time market trends and competitive analysis',
      category: 'analytics',
      icon: '🎯'
    },
    whatsapp_integration: {
      key: 'whatsapp_integration',
      name: 'WhatsApp Integration',
      description: 'Connect with WhatsApp Business for automated messaging',
      category: 'integrations',
      icon: '💬'
    },
    telegram_integration: {
      key: 'telegram_integration',
      name: 'Telegram Integration',
      description: 'Connect with Telegram bots for order management',
      category: 'integrations',
      icon: '✈️'
    },
    discord_integration: {
      key: 'discord_integration',
      name: 'Discord Integration',
      description: 'Integrate with Discord servers and channels',
      category: 'integrations',
      icon: '🎮'
    },
    payment_tracking: {
      key: 'payment_tracking',
      name: 'Payment Tracking',
      description: 'Track and verify payments automatically',
      category: 'core',
      icon: '💳'
    },
    remove_branding: {
      key: 'remove_branding',
      name: 'Remove GOMFLOW Branding',
      description: 'Remove "Powered by GOMFLOW" from order forms',
      category: 'branding',
      icon: '🎨'
    },
    custom_branding: {
      key: 'custom_branding',
      name: 'Custom Branding',
      description: 'Add your own logo and branding to order forms',
      category: 'branding',
      icon: '🏷️'
    },
    white_label: {
      key: 'white_label',
      name: 'White Label',
      description: 'Complete white-label solution with your branding',
      category: 'branding',
      icon: '⚪'
    },
    community_support: {
      key: 'community_support',
      name: 'Community Support',
      description: 'Access to community forums and documentation',
      category: 'support',
      icon: '👥'
    },
    email_support: {
      key: 'email_support',
      name: 'Email Support',
      description: 'Direct email support with response within 24 hours',
      category: 'support',
      icon: '📧'
    },
    priority_support: {
      key: 'priority_support',
      name: 'Priority Support',
      description: 'Priority email support with response within 4 hours',
      category: 'support',
      icon: '⚡'
    },
    dedicated_support: {
      key: 'dedicated_support',
      name: 'Dedicated Support',
      description: 'Dedicated account manager and phone support',
      category: 'support',
      icon: '🎧'
    },
    api_access: {
      key: 'api_access',
      name: 'API Access',
      description: 'Access to GOMFLOW REST API for integrations',
      category: 'integrations',
      icon: '🔌'
    },
    unlimited_api: {
      key: 'unlimited_api',
      name: 'Unlimited API',
      description: 'Unlimited API calls and higher rate limits',
      category: 'integrations',
      icon: '🚀'
    },
    bulk_messaging: {
      key: 'bulk_messaging',
      name: 'Bulk Messaging',
      description: 'Send bulk messages to buyers across all platforms',
      category: 'core',
      icon: '📢'
    },
    collaboration_tools: {
      key: 'collaboration_tools',
      name: 'Collaboration Tools',
      description: 'Share workspace and collaborate with team members',
      category: 'core',
      icon: '🤝'
    },
    multi_gom_management: {
      key: 'multi_gom_management',
      name: 'Multi-GOM Management',
      description: 'Manage multiple GOM accounts from one dashboard',
      category: 'core',
      icon: '👑'
    },
    custom_integrations: {
      key: 'custom_integrations',
      name: 'Custom Integrations',
      description: 'Custom integrations and webhook configurations',
      category: 'integrations',
      icon: '⚙️'
    },
    sla_guarantee: {
      key: 'sla_guarantee',
      name: 'SLA Guarantee',
      description: '99.9% uptime guarantee with service credits',
      category: 'support',
      icon: '🛡️'
    },
    real_time_notifications: {
      key: 'real_time_notifications',
      name: 'Real-time Notifications',
      description: 'Instant notifications for payments and order updates',
      category: 'core',
      icon: '🔔'
    }
  };

  /**
   * Usage limit definitions
   */
  static readonly LIMIT_DEFINITIONS: Record<UsageMetricType, PlanLimit> = {
    orders_created: {
      metric_type: 'orders_created',
      name: 'Orders Created',
      description: 'Number of group orders you can create per month',
      unit: 'orders',
      icon: '📝',
      unlimited_text: 'Unlimited orders'
    },
    api_calls: {
      metric_type: 'api_calls',
      name: 'API Calls',
      description: 'Number of API requests per month',
      unit: 'calls',
      icon: '🔌',
      unlimited_text: 'Unlimited API calls'
    },
    storage_mb: {
      metric_type: 'storage_mb',
      name: 'Storage',
      description: 'File storage for payment proofs and images',
      unit: 'MB',
      icon: '💾',
      unlimited_text: 'Unlimited storage'
    },
    messages_sent: {
      metric_type: 'messages_sent',
      name: 'Messages Sent',
      description: 'Automated messages sent to buyers',
      unit: 'messages',
      icon: '💬',
      unlimited_text: 'Unlimited messages'
    },
    submissions_received: {
      metric_type: 'submissions_received',
      name: 'Submissions',
      description: 'Number of buyer submissions you can receive',
      unit: 'submissions',
      icon: '📥',
      unlimited_text: 'Unlimited submissions'
    }
  };

  /**
   * Regional pricing configuration
   */
  static readonly REGIONAL_PRICING: Record<CurrencyCode, RegionalPricing> = {
    PHP: {
      currency: 'PHP',
      country_codes: ['PH'],
      exchange_rate: 1,
      tax_rate: 0.12, // 12% VAT in Philippines
      payment_methods: ['gcash', 'paymaya', 'bank_transfer', 'paymongo'],
      local_payment_providers: ['PayMongo', 'Xendit']
    },
    MYR: {
      currency: 'MYR',
      country_codes: ['MY'],
      exchange_rate: 0.05, // Approximate PHP to MYR
      tax_rate: 0.06, // 6% GST in Malaysia
      payment_methods: ['maybank2u', 'tng', 'grabpay', 'billplz'],
      local_payment_providers: ['Billplz', 'iPay88']
    },
    THB: {
      currency: 'THB',
      country_codes: ['TH'],
      exchange_rate: 1.5, // Approximate PHP to THB
      tax_rate: 0.07, // 7% VAT in Thailand
      payment_methods: ['promptpay', 'truemoney', 'bank_transfer'],
      local_payment_providers: ['2C2P', 'Omise']
    },
    IDR: {
      currency: 'IDR',
      country_codes: ['ID'],
      exchange_rate: 350, // Approximate PHP to IDR
      tax_rate: 0.11, // 11% VAT in Indonesia
      payment_methods: ['gopay', 'ovo', 'dana', 'bank_transfer'],
      local_payment_providers: ['Midtrans', 'Xendit']
    },
    USD: {
      currency: 'USD',
      country_codes: ['US', 'CA', 'AU', 'SG'],
      exchange_rate: 0.018, // Approximate PHP to USD
      tax_rate: 0, // Varies by region
      payment_methods: ['stripe', 'paypal', 'bank_transfer'],
      local_payment_providers: ['Stripe', 'PayPal']
    }
  };

  /**
   * Get feature definition by key
   */
  static getFeatureDefinition(featureKey: string): PlanFeature | undefined {
    return this.FEATURE_DEFINITIONS[featureKey];
  }

  /**
   * Get limit definition by metric type
   */
  static getLimitDefinition(metricType: UsageMetricType): PlanLimit | undefined {
    return this.LIMIT_DEFINITIONS[metricType];
  }

  /**
   * Get regional pricing by currency
   */
  static getRegionalPricing(currency: CurrencyCode): RegionalPricing | undefined {
    return this.REGIONAL_PRICING[currency];
  }

  /**
   * Get recommended currency for country code
   */
  static getRecommendedCurrency(countryCode: string): CurrencyCode {
    for (const [currency, pricing] of Object.entries(this.REGIONAL_PRICING)) {
      if (pricing.country_codes.includes(countryCode)) {
        return currency as CurrencyCode;
      }
    }
    return 'USD'; // Default fallback
  }

  /**
   * Format price with currency symbol
   */
  static formatPrice(amount: number, currency: CurrencyCode): string {
    const symbols: Record<CurrencyCode, string> = {
      PHP: '₱',
      MYR: 'RM',
      THB: '฿',
      IDR: 'Rp',
      USD: '$'
    };

    const formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

    return `${symbols[currency]}${formatter.format(amount)}`;
  }

  /**
   * Get plan recommendation based on usage
   */
  static getRecommendedPlan(currentUsage: Record<UsageMetricType, number>): SubscriptionTier {
    // Check if current usage exceeds freemium limits
    const freemiumLimits = {
      orders_created: 50,
      api_calls: 1000,
      storage_mb: 100,
      messages_sent: 500,
      submissions_received: 200
    };

    let exceedsFreemium = false;
    let exceedsStarter = false;

    for (const [metric, usage] of Object.entries(currentUsage)) {
      const freemiumLimit = freemiumLimits[metric as UsageMetricType];
      if (usage > freemiumLimit) {
        exceedsFreemium = true;
      }

      // Starter limits
      const starterLimits = {
        orders_created: 200,
        api_calls: 5000,
        storage_mb: 500,
        messages_sent: 2000,
        submissions_received: 1000
      };

      const starterLimit = starterLimits[metric as UsageMetricType];
      if (usage > starterLimit) {
        exceedsStarter = true;
      }
    }

    if (exceedsStarter) {
      return 'professional';
    } else if (exceedsFreemium) {
      return 'starter';
    } else {
      return 'freemium';
    }
  }
}