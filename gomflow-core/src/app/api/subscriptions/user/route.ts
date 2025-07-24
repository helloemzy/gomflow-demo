import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  UserSubscription, 
  ApiResponse, 
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  PlanSwitchRequest,
  SubscriptionSummary,
  BillingEvent,
  CurrencyCode,
  BillingCycle,
  SubscriptionStatus
} from 'gomflow-shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/subscriptions/user
 * Get current user's subscription details
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

    // Get subscription summary using database function
    const { data: summaryData, error: summaryError } = await supabase
      .rpc('get_subscription_summary', { p_user_id: userId });

    if (summaryError) {
      console.error('Error fetching subscription summary:', summaryError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to fetch subscription summary'
      }, { status: 500 });
    }

    // If user has no subscription, return freemium status
    if (!summaryData.has_subscription) {
      return NextResponse.json<ApiResponse<SubscriptionSummary>>({
        success: true,
        data: {
          has_subscription: false,
          tier: 'freemium'
        },
        message: 'User has no active subscription'
      });
    }

    // Get detailed subscription info
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('user_id', userId)
      .in('status', ['trial', 'active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('Error fetching detailed subscription:', subError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to fetch subscription details'
      }, { status: 500 });
    }

    // Transform dates
    const transformedSummary: SubscriptionSummary = {
      ...summaryData,
      current_period_start: summaryData.current_period_start ? new Date(summaryData.current_period_start) : undefined,
      current_period_end: summaryData.current_period_end ? new Date(summaryData.current_period_end) : undefined,
      next_billing_date: summaryData.next_billing_date ? new Date(summaryData.next_billing_date) : undefined,
      trial_end_date: summaryData.trial_end_date ? new Date(summaryData.trial_end_date) : undefined
    };

    return NextResponse.json<ApiResponse<SubscriptionSummary>>({
      success: true,
      data: transformedSummary,
      message: 'Subscription details retrieved successfully'
    });

  } catch (error) {
    console.error('Get user subscription error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * POST /api/subscriptions/user
 * Create a new subscription for user
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

    const body: CreateSubscriptionRequest = await request.json();
    const { plan_id, billing_cycle, currency, payment_method_id } = body;

    // Validate required fields
    if (!plan_id || !billing_cycle || !currency) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required fields: plan_id, billing_cycle, currency'
      }, { status: 400 });
    }

    // Check if user already has active subscription
    const { data: existingSubscription } = await supabase
      .from('user_subscriptions')
      .select('id, status')
      .eq('user_id', userId)
      .in('status', ['trial', 'active', 'past_due'])
      .single();

    if (existingSubscription) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'User already has an active subscription'
      }, { status: 400 });
    }

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', plan_id)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid or inactive subscription plan'
      }, { status: 400 });
    }

    // Calculate pricing
    const { data: planPrice } = await supabase
      .rpc('get_plan_price', {
        plan_id,
        p_currency: currency,
        p_billing_cycle: billing_cycle
      });

    if (!planPrice && plan.tier !== 'freemium') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Plan pricing not available for currency: ${currency}`
      }, { status: 400 });
    }

    // Calculate dates
    const now = new Date();
    const trialEndDate = new Date(now.getTime() + (plan.trial_days * 24 * 60 * 60 * 1000));
    const billingStartDate = plan.tier === 'freemium' ? now : trialEndDate;
    const periodEnd = new Date(billingStartDate);
    
    if (billing_cycle === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // Create subscription
    const subscriptionData = {
      user_id: userId,
      plan_id,
      status: plan.tier === 'freemium' ? 'active' as SubscriptionStatus : 'trial' as SubscriptionStatus,
      tier: plan.tier,
      billing_cycle,
      currency,
      amount: planPrice || 0,
      trial_start_date: plan.tier === 'freemium' ? null : now.toISOString(),
      trial_end_date: plan.tier === 'freemium' ? null : trialEndDate.toISOString(),
      billing_start_date: billingStartDate.toISOString(),
      current_period_start: billingStartDate.toISOString(),
      current_period_end: periodEnd.toISOString(),
      next_billing_date: plan.tier === 'freemium' ? null : periodEnd.toISOString(),
      usage_reset_date: now.toISOString(),
      gateway_customer_id: payment_method_id, // This would come from payment gateway
      metadata: {
        created_via: 'api',
        payment_method_id
      }
    };

    const { data: subscription, error: createError } = await supabase
      .from('user_subscriptions')
      .insert([subscriptionData])
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .single();

    if (createError) {
      console.error('Error creating subscription:', createError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to create subscription'
      }, { status: 500 });
    }

    // Create billing event
    const billingEvent = {
      user_id: userId,
      subscription_id: subscription.id,
      event_type: 'subscription_created',
      event_description: `Subscription created for ${plan.display_name}`,
      amount: planPrice || 0,
      currency,
      status: 'paid' as const,
      metadata: {
        plan_name: plan.name,
        billing_cycle,
        trial_days: plan.trial_days
      }
    };

    await supabase
      .from('billing_events')
      .insert([billingEvent]);

    // Update user plan in users table for backward compatibility
    await supabase
      .from('users')
      .update({
        plan: plan.tier === 'freemium' ? 'free' : 'pro', // Map to old enum
        subscription_status: subscription.status === 'trial' ? 'active' : subscription.status
      })
      .eq('id', userId);

    return NextResponse.json<ApiResponse<UserSubscription>>({
      success: true,
      data: {
        ...subscription,
        created_at: new Date(subscription.created_at),
        updated_at: new Date(subscription.updated_at),
        trial_start_date: subscription.trial_start_date ? new Date(subscription.trial_start_date) : undefined,
        trial_end_date: subscription.trial_end_date ? new Date(subscription.trial_end_date) : undefined,
        billing_start_date: subscription.billing_start_date ? new Date(subscription.billing_start_date) : undefined,
        current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start) : undefined,
        current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end) : undefined,
        next_billing_date: subscription.next_billing_date ? new Date(subscription.next_billing_date) : undefined,
        usage_reset_date: new Date(subscription.usage_reset_date)
      },
      message: 'Subscription created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Create subscription error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * PUT /api/subscriptions/user
 * Update user's subscription (plan switching, cancellation)
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

    const body = await request.json();
    const action = body.action || 'update';

    // Get current subscription
    const { data: currentSubscription, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('user_id', userId)
      .in('status', ['trial', 'active', 'past_due'])
      .single();

    if (fetchError || !currentSubscription) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'No active subscription found'
      }, { status: 404 });
    }

    switch (action) {
      case 'switch_plan':
        return await handlePlanSwitch(userId, currentSubscription, body as PlanSwitchRequest);
      
      case 'cancel':
        return await handleCancellation(userId, currentSubscription, body.cancellation_reason);
      
      case 'update':
        return await handleSubscriptionUpdate(userId, currentSubscription, body as UpdateSubscriptionRequest);
      
      default:
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Invalid action. Use: switch_plan, cancel, or update'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Update subscription error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Helper Functions

async function handlePlanSwitch(userId: string, currentSubscription: any, request: PlanSwitchRequest) {
  const { new_plan_id, billing_cycle, prorate = true } = request;

  // Get new plan details
  const { data: newPlan, error: planError } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('id', new_plan_id)
    .eq('is_active', true)
    .single();

  if (planError || !newPlan) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Invalid or inactive subscription plan'
    }, { status: 400 });
  }

  // Get new plan price
  const { data: newPrice } = await supabase
    .rpc('get_plan_price', {
      plan_id: new_plan_id,
      p_currency: currentSubscription.currency,
      p_billing_cycle: billing_cycle || currentSubscription.billing_cycle
    });

  const now = new Date();
  const currentPeriodEnd = new Date(currentSubscription.current_period_end);
  const daysUsed = Math.floor((now.getTime() - new Date(currentSubscription.current_period_start).getTime()) / (1000 * 60 * 60 * 24));
  const totalDays = Math.floor((currentPeriodEnd.getTime() - new Date(currentSubscription.current_period_start).getTime()) / (1000 * 60 * 60 * 24));

  let prorationAmount = 0;
  if (prorate && currentSubscription.tier !== 'freemium' && newPlan.tier !== 'freemium') {
    const { data: calculatedProration } = await supabase
      .rpc('calculate_proration', {
        old_amount: currentSubscription.amount,
        new_amount: newPrice || 0,
        days_used: daysUsed,
        total_days: totalDays
      });
    
    prorationAmount = calculatedProration || 0;
  }

  // Update subscription
  const updateData = {
    plan_id: new_plan_id,
    tier: newPlan.tier,
    billing_cycle: billing_cycle || currentSubscription.billing_cycle,
    amount: newPrice || 0,
    updated_at: now.toISOString()
  };

  const { data: updatedSubscription, error: updateError } = await supabase
    .from('user_subscriptions')
    .update(updateData)
    .eq('id', currentSubscription.id)
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .single();

  if (updateError) {
    console.error('Error updating subscription:', updateError);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to update subscription'
    }, { status: 500 });
  }

  // Create billing event for plan switch
  const billingEvent = {
    user_id: userId,
    subscription_id: currentSubscription.id,
    event_type: 'plan_switched',
    event_description: `Plan switched from ${currentSubscription.plan.display_name} to ${newPlan.display_name}`,
    amount: newPrice || 0,
    currency: currentSubscription.currency,
    status: 'paid' as const,
    proration_amount: prorationAmount,
    proration_details: {
      old_plan: currentSubscription.plan.name,
      new_plan: newPlan.name,
      days_used: daysUsed,
      total_days: totalDays
    }
  };

  await supabase
    .from('billing_events')
    .insert([billingEvent]);

  return NextResponse.json<ApiResponse<UserSubscription>>({
    success: true,
    data: {
      ...updatedSubscription,
      created_at: new Date(updatedSubscription.created_at),
      updated_at: new Date(updatedSubscription.updated_at),
      current_period_start: new Date(updatedSubscription.current_period_start),
      current_period_end: new Date(updatedSubscription.current_period_end),
      next_billing_date: updatedSubscription.next_billing_date ? new Date(updatedSubscription.next_billing_date) : undefined,
      usage_reset_date: new Date(updatedSubscription.usage_reset_date)
    },
    message: `Plan switched successfully${prorationAmount > 0 ? ` (Pro-ration: ${prorationAmount} ${currentSubscription.currency})` : ''}`
  });
}

async function handleCancellation(userId: string, currentSubscription: any, cancellationReason?: string) {
  const now = new Date();

  // Update subscription to cancel at period end
  const { data: cancelledSubscription, error: cancelError } = await supabase
    .from('user_subscriptions')
    .update({
      cancel_at_period_end: true,
      cancellation_reason: cancellationReason,
      updated_at: now.toISOString()
    })
    .eq('id', currentSubscription.id)
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .single();

  if (cancelError) {
    console.error('Error cancelling subscription:', cancelError);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to cancel subscription'
    }, { status: 500 });
  }

  // Create billing event
  const billingEvent = {
    user_id: userId,
    subscription_id: currentSubscription.id,
    event_type: 'subscription_cancelled',
    event_description: `Subscription cancelled (will end at ${currentSubscription.current_period_end})`,
    currency: currentSubscription.currency,
    status: 'pending' as const,
    metadata: {
      cancellation_reason: cancellationReason,
      cancel_at_period_end: true,
      effective_date: currentSubscription.current_period_end
    }
  };

  await supabase
    .from('billing_events')
    .insert([billingEvent]);

  return NextResponse.json<ApiResponse<UserSubscription>>({
    success: true,
    data: {
      ...cancelledSubscription,
      created_at: new Date(cancelledSubscription.created_at),
      updated_at: new Date(cancelledSubscription.updated_at),
      current_period_start: new Date(cancelledSubscription.current_period_start),
      current_period_end: new Date(cancelledSubscription.current_period_end),
      next_billing_date: cancelledSubscription.next_billing_date ? new Date(cancelledSubscription.next_billing_date) : undefined,
      usage_reset_date: new Date(cancelledSubscription.usage_reset_date)
    },
    message: `Subscription will be cancelled at the end of the current period (${new Date(currentSubscription.current_period_end).toLocaleDateString()})`
  });
}

async function handleSubscriptionUpdate(userId: string, currentSubscription: any, request: UpdateSubscriptionRequest) {
  const updateData: any = {
    updated_at: new Date().toISOString()
  };

  if (request.billing_cycle !== undefined) {
    updateData.billing_cycle = request.billing_cycle;
  }

  if (request.cancel_at_period_end !== undefined) {
    updateData.cancel_at_period_end = request.cancel_at_period_end;
  }

  if (request.cancellation_reason !== undefined) {
    updateData.cancellation_reason = request.cancellation_reason;
  }

  const { data: updatedSubscription, error: updateError } = await supabase
    .from('user_subscriptions')
    .update(updateData)
    .eq('id', currentSubscription.id)
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .single();

  if (updateError) {
    console.error('Error updating subscription:', updateError);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to update subscription'
    }, { status: 500 });
  }

  return NextResponse.json<ApiResponse<UserSubscription>>({
    success: true,
    data: {
      ...updatedSubscription,
      created_at: new Date(updatedSubscription.created_at),
      updated_at: new Date(updatedSubscription.updated_at),
      current_period_start: new Date(updatedSubscription.current_period_start),
      current_period_end: new Date(updatedSubscription.current_period_end),
      next_billing_date: updatedSubscription.next_billing_date ? new Date(updatedSubscription.next_billing_date) : undefined,
      usage_reset_date: new Date(updatedSubscription.usage_reset_date)
    },
    message: 'Subscription updated successfully'
  });
}