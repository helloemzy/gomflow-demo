import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  UsageTracking, 
  ApiResponse, 
  UsageCheckRequest,
  UsageRecordRequest,
  UsageLimitCheck,
  UsageMetricType,
  SubscriptionAnalytics
} from 'gomflow-shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/subscriptions/usage
 * Get usage statistics for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const userId = authHeader?.replace('Bearer ', '');

    if (!userId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'User authentication required'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const metricType = searchParams.get('metric_type') as UsageMetricType;
    const period = searchParams.get('period') || 'current'; // current, last_month, all_time
    const detailed = searchParams.get('detailed') === 'true';

    // Get current subscription
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:subscription_plans(features, limits)
      `)
      .eq('user_id', userId)
      .in('status', ['trial', 'active'])
      .single();

    if (subError || !subscription) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'No active subscription found'
      }, { status: 404 });
    }

    // If specific metric requested, get just that metric
    if (metricType) {
      const { data: currentUsage } = await supabase
        .rpc('get_current_usage', {
          p_user_id: userId,
          p_metric_type: metricType
        });

      const limit = subscription.plan.limits[metricType] || -1;
      const isUnlimited = limit === -1;
      const remaining = isUnlimited ? -1 : Math.max(0, limit - (currentUsage || 0));
      const usagePercentage = isUnlimited ? 0 : Math.min(100, ((currentUsage || 0) / limit) * 100);

      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          metric_type: metricType,
          current_usage: currentUsage || 0,
          limit: limit,
          remaining: remaining,
          usage_percentage: usagePercentage,
          is_unlimited: isUnlimited,
          is_approaching_limit: !isUnlimited && usagePercentage >= 80,
          is_over_limit: !isUnlimited && (currentUsage || 0) > limit
        },
        message: `Usage data for ${metricType}`
      });
    }

    // Get all usage metrics
    const usageMetrics: UsageMetricType[] = [
      'orders_created',
      'api_calls', 
      'storage_mb',
      'messages_sent',
      'submissions_received'
    ];

    const usageData: Record<string, any> = {};

    for (const metric of usageMetrics) {
      const { data: currentUsage } = await supabase
        .rpc('get_current_usage', {
          p_user_id: userId,
          p_metric_type: metric
        });

      const limit = subscription.plan.limits[metric] || -1;
      const isUnlimited = limit === -1;
      const remaining = isUnlimited ? -1 : Math.max(0, limit - (currentUsage || 0));
      const usagePercentage = isUnlimited ? 0 : Math.min(100, ((currentUsage || 0) / limit) * 100);

      usageData[metric] = {
        current_usage: currentUsage || 0,
        limit: limit,
        remaining: remaining,
        usage_percentage: usagePercentage,
        is_unlimited: isUnlimited,
        is_approaching_limit: !isUnlimited && usagePercentage >= 80,
        is_over_limit: !isUnlimited && (currentUsage || 0) > limit
      };
    }

    // If detailed usage requested, get historical data
    if (detailed) {
      let query = supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', userId)
        .eq('subscription_id', subscription.id)
        .order('period_start', { ascending: false });

      if (period === 'current') {
        const currentPeriodStart = new Date(subscription.usage_reset_date);
        query = query.gte('period_start', currentPeriodStart.toISOString());
      } else if (period === 'last_month') {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        const lastMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
        const lastMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
        
        query = query
          .gte('period_start', lastMonthStart.toISOString())
          .lte('period_start', lastMonthEnd.toISOString());
      }

      const { data: historicalUsage, error: historyError } = await query;

      if (!historyError && historicalUsage) {
        usageData.historical = historicalUsage.map((record: any) => ({
          ...record,
          period_start: new Date(record.period_start),
          period_end: new Date(record.period_end),
          recorded_at: new Date(record.recorded_at)
        }));
      }
    }

    // Calculate overall usage health
    const totalLimits = Object.values(subscription.plan.limits).filter(limit => limit !== -1).length;
    const approachingLimits = Object.values(usageData).filter((data: any) => 
      data.is_approaching_limit && !data.is_unlimited
    ).length;
    const overLimits = Object.values(usageData).filter((data: any) => 
      data.is_over_limit && !data.is_unlimited
    ).length;

    const usageHealth = overLimits > 0 ? 'critical' : 
                       approachingLimits > 0 ? 'warning' : 'healthy';

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        subscription_tier: subscription.tier,
        billing_period: {
          start: new Date(subscription.current_period_start),
          end: new Date(subscription.current_period_end),
          reset_date: new Date(subscription.usage_reset_date)
        },
        usage_health: usageHealth,
        metrics: usageData,
        summary: {
          total_limits: totalLimits,
          approaching_limits: approachingLimits,
          over_limits: overLimits,
          unlimited_metrics: Object.values(usageData).filter((data: any) => data.is_unlimited).length
        }
      },
      message: 'Usage statistics retrieved successfully'
    });

  } catch (error) {
    console.error('Get usage statistics error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * POST /api/subscriptions/usage/check
 * Check if user can perform an action (usage limit check)
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const userId = authHeader?.replace('Bearer ', '');

    if (!userId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'User authentication required'
      }, { status: 401 });
    }

    const body: UsageCheckRequest = await request.json();
    const { metric_type, increment = 1 } = body;

    if (!metric_type) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required field: metric_type'
      }, { status: 400 });
    }

    // Use database function to check usage limit
    const { data: limitCheck, error: checkError } = await supabase
      .rpc('check_usage_limit', {
        p_user_id: userId,
        p_metric_type: metric_type,
        p_increment: increment
      });

    if (checkError) {
      console.error('Error checking usage limit:', checkError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to check usage limit'
      }, { status: 500 });
    }

    const response: UsageLimitCheck = {
      allowed: limitCheck.allowed,
      reason: limitCheck.reason,
      current_usage: limitCheck.current_usage,
      limit: limitCheck.limit,
      remaining: limitCheck.remaining,
      would_be: limitCheck.would_be
    };

    const statusCode = limitCheck.allowed ? 200 : 429; // 429 Too Many Requests for exceeded limits

    return NextResponse.json<ApiResponse<UsageLimitCheck>>({
      success: true,
      data: response,
      message: limitCheck.allowed ? 
        'Action allowed within usage limits' : 
        `Usage limit exceeded: ${limitCheck.reason}`
    }, { status: statusCode });

  } catch (error) {
    console.error('Check usage limit error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * POST /api/subscriptions/usage/record
 * Record usage for a specific metric
 */
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const userId = authHeader?.replace('Bearer ', '');

    if (!userId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'User authentication required'
      }, { status: 401 });
    }

    const body: UsageRecordRequest = await request.json();
    const { metric_type, increment, metadata } = body;

    if (!metric_type || increment === undefined) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required fields: metric_type, increment'
      }, { status: 400 });
    }

    if (increment <= 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Increment must be positive'
      }, { status: 400 });
    }

    // First check if usage is allowed
    const { data: limitCheck, error: checkError } = await supabase
      .rpc('check_usage_limit', {
        p_user_id: userId,
        p_metric_type: metric_type,
        p_increment: increment
      });

    if (checkError) {
      console.error('Error checking usage limit:', checkError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to check usage limit'
      }, { status: 500 });
    }

    if (!limitCheck.allowed) {
      return NextResponse.json<ApiResponse<UsageLimitCheck>>({
        success: false,
        data: {
          allowed: false,
          reason: limitCheck.reason,
          current_usage: limitCheck.current_usage,
          limit: limitCheck.limit,
          remaining: limitCheck.remaining,
          would_be: limitCheck.would_be
        },
        error: `Usage limit exceeded: ${limitCheck.reason}`
      }, { status: 429 });
    }

    // Record the usage
    const { data: recordResult, error: recordError } = await supabase
      .rpc('record_usage', {
        p_user_id: userId,
        p_metric_type: metric_type,
        p_increment: increment
      });

    if (recordError) {
      console.error('Error recording usage:', recordError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to record usage'
      }, { status: 500 });
    }

    // Get updated usage stats
    const { data: updatedUsage } = await supabase
      .rpc('get_current_usage', {
        p_user_id: userId,
        p_metric_type: metric_type
      });

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        metric_type: metric_type,
        increment_recorded: increment,
        new_usage_total: updatedUsage || 0,
        limit: limitCheck.limit,
        remaining: limitCheck.limit === -1 ? -1 : Math.max(0, limitCheck.limit - (updatedUsage || 0)),
        period_start: recordResult.period_start,
        period_end: recordResult.period_end,
        metadata
      },
      message: `Recorded ${increment} ${metric_type} usage`
    });

  } catch (error) {
    console.error('Record usage error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * GET /api/subscriptions/usage/analytics
 * Get usage analytics across all users (Admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    // This would typically require admin authentication
    const authHeader = request.headers.get('authorization');
    const isAdmin = authHeader?.includes('admin'); // Simplified admin check

    if (!isAdmin) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Admin authentication required'
      }, { status: 401 });
    }

    // Get subscription analytics
    const { data: subscriptionStats, error: statsError } = await supabase
      .from('user_subscriptions')
      .select('tier, status, currency, amount')
      .in('status', ['trial', 'active', 'past_due', 'cancelled']);

    if (statsError) {
      console.error('Error fetching subscription stats:', statsError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to fetch subscription analytics'
      }, { status: 500 });
    }

    // Calculate metrics
    const totalSubscribers = subscriptionStats?.length || 0;
    const activeSubscribers = subscriptionStats?.filter(s => s.status === 'active').length || 0;
    const trialSubscribers = subscriptionStats?.filter(s => s.status === 'trial').length || 0;
    const cancelledSubscribers = subscriptionStats?.filter(s => s.status === 'cancelled').length || 0;

    // Calculate MRR and ARR
    const monthlyRevenue = subscriptionStats
      ?.filter(s => s.status === 'active')
      .reduce((sum, s) => sum + (s.amount || 0), 0) || 0;

    const averageRevenuePerUser = totalSubscribers > 0 ? monthlyRevenue / totalSubscribers : 0;

    // Tier distribution
    const subscribersByTier = subscriptionStats?.reduce((acc, s) => {
      acc[s.tier] = (acc[s.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const revenueByTier = subscriptionStats
      ?.filter(s => s.status === 'active')
      .reduce((acc, s) => {
        acc[s.tier] = (acc[s.tier] || 0) + (s.amount || 0);
        return acc;
      }, {} as Record<string, number>) || {};

    // Get usage statistics
    const { data: usageStats, error: usageError } = await supabase
      .from('usage_tracking')
      .select('metric_type, metric_value')
      .gte('period_start', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const averageUsageByMetric = usageStats?.reduce((acc, u) => {
      if (!acc[u.metric_type]) {
        acc[u.metric_type] = { total: 0, count: 0 };
      }
      acc[u.metric_type].total += u.metric_value;
      acc[u.metric_type].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>) || {};

    const finalAverages = Object.entries(averageUsageByMetric).reduce((acc, [key, value]) => {
      acc[key] = value.count > 0 ? Math.round(value.total / value.count) : 0;
      return acc;
    }, {} as Record<string, number>);

    const analytics: SubscriptionAnalytics = {
      // User metrics
      total_subscribers: totalSubscribers,
      active_subscribers: activeSubscribers,
      trial_subscribers: trialSubscribers,
      cancelled_subscribers: cancelledSubscribers,

      // Revenue metrics
      monthly_recurring_revenue: monthlyRevenue,
      annual_recurring_revenue: monthlyRevenue * 12,
      average_revenue_per_user: averageRevenuePerUser,

      // Tier distribution
      subscribers_by_tier: subscribersByTier as Record<any, number>,
      revenue_by_tier: revenueByTier as Record<any, number>,

      // Usage metrics
      average_usage_by_metric: finalAverages as Record<UsageMetricType, number>,
      users_approaching_limits: 0, // Would need more complex query
      users_exceeded_limits: 0, // Would need more complex query

      // Billing metrics (simplified)
      successful_payments: activeSubscribers,
      failed_payments: 0,
      payment_retry_attempts: 0,
      churn_rate: totalSubscribers > 0 ? (cancelledSubscribers / totalSubscribers) * 100 : 0
    };

    return NextResponse.json<ApiResponse<SubscriptionAnalytics>>({
      success: true,
      data: analytics,
      message: 'Subscription analytics retrieved successfully'
    });

  } catch (error) {
    console.error('Get subscription analytics error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}