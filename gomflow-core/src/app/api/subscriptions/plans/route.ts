import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  SubscriptionPlan, 
  ApiResponse, 
  CurrencyCode, 
  BillingCycle,
  PlanPricing 
} from 'gomflow-shared';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/subscriptions/plans
 * Retrieve all active subscription plans with regional pricing
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get('currency') as CurrencyCode || 'PHP';
    const billing_cycle = searchParams.get('billing_cycle') as BillingCycle || 'monthly';
    const tier = searchParams.get('tier');
    const include_inactive = searchParams.get('include_inactive') === 'true';

    let query = supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order', { ascending: true });

    // Filter by tier if specified
    if (tier) {
      query = query.eq('tier', tier);
    }

    // Filter active plans unless explicitly requesting inactive
    if (!include_inactive) {
      query = query.eq('is_active', true);
    }

    const { data: plans, error } = await query;

    if (error) {
      console.error('Error fetching subscription plans:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to fetch subscription plans'
      }, { status: 500 });
    }

    // Transform plans to include pricing for requested currency and billing cycle
    const transformedPlans = plans?.map((plan: any) => {
      const monthlyPrice = getPlanPrice(plan, currency, 'monthly');
      const annualPrice = getPlanPrice(plan, currency, 'annually');
      
      return {
        ...plan,
        current_price: billing_cycle === 'annually' ? annualPrice : monthlyPrice,
        pricing: {
          monthly: {
            PHP: plan.price_php || 0,
            MYR: plan.price_myr || 0,
            THB: plan.price_thb || 0,
            IDR: plan.price_idr || 0,
            USD: plan.price_usd || 0
          },
          annually: {
            PHP: plan.annual_price_php || 0,
            MYR: plan.annual_price_myr || 0,
            THB: plan.annual_price_thb || 0,
            IDR: plan.annual_price_idr || 0,
            USD: plan.annual_price_usd || 0
          },
          savings_percentage: calculateSavingsPercentage(monthlyPrice, annualPrice)
        } as PlanPricing,
        created_at: new Date(plan.created_at),
        updated_at: new Date(plan.updated_at)
      };
    }) || [];

    return NextResponse.json<ApiResponse<SubscriptionPlan[]>>({
      success: true,
      data: transformedPlans,
      message: `Found ${transformedPlans.length} subscription plans`
    });

  } catch (error) {
    console.error('Subscription plans API error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * POST /api/subscriptions/plans
 * Create a new subscription plan (Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const {
      name,
      tier,
      display_name,
      description,
      features,
      limits,
      trial_days = 14,
      sort_order = 0,
      ...pricing
    } = body;

    if (!name || !tier || !display_name || !features || !limits) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Missing required fields: name, tier, display_name, features, limits'
      }, { status: 400 });
    }

    // Validate pricing (at least one currency must be set)
    const hasPricing = Object.values(pricing).some(price => 
      price !== null && price !== undefined && price > 0
    );

    if (!hasPricing && tier !== 'freemium') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'At least one currency price must be set for paid plans'
      }, { status: 400 });
    }

    // Insert the plan
    const { data: plan, error } = await supabase
      .from('subscription_plans')
      .insert([{
        name,
        tier,
        display_name,
        description,
        features: JSON.stringify(features),
        limits: JSON.stringify(limits),
        trial_days,
        sort_order,
        price_php: pricing.price_php || null,
        price_myr: pricing.price_myr || null,
        price_thb: pricing.price_thb || null,
        price_idr: pricing.price_idr || null,
        price_usd: pricing.price_usd || null,
        annual_price_php: pricing.annual_price_php || null,
        annual_price_myr: pricing.annual_price_myr || null,
        annual_price_thb: pricing.annual_price_thb || null,
        annual_price_idr: pricing.annual_price_idr || null,
        annual_price_usd: pricing.annual_price_usd || null,
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating subscription plan:', error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to create subscription plan'
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<SubscriptionPlan>>({
      success: true,
      data: {
        ...plan,
        created_at: new Date(plan.created_at),
        updated_at: new Date(plan.updated_at)
      },
      message: 'Subscription plan created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Create subscription plan error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * PUT /api/subscriptions/plans
 * Update a subscription plan (Admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Plan ID is required'
      }, { status: 400 });
    }

    // Check if plan exists
    const { data: existingPlan, error: fetchError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingPlan) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Subscription plan not found'
      }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    // Only update provided fields
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.tier !== undefined) updateData.tier = updates.tier;
    if (updates.display_name !== undefined) updateData.display_name = updates.display_name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.features !== undefined) updateData.features = JSON.stringify(updates.features);
    if (updates.limits !== undefined) updateData.limits = JSON.stringify(updates.limits);
    if (updates.trial_days !== undefined) updateData.trial_days = updates.trial_days;
    if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
    if (updates.sort_order !== undefined) updateData.sort_order = updates.sort_order;

    // Update pricing fields
    const pricingFields = [
      'price_php', 'price_myr', 'price_thb', 'price_idr', 'price_usd',
      'annual_price_php', 'annual_price_myr', 'annual_price_thb', 'annual_price_idr', 'annual_price_usd'
    ];

    pricingFields.forEach(field => {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    });

    // Update the plan
    const { data: updatedPlan, error: updateError } = await supabase
      .from('subscription_plans')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating subscription plan:', updateError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to update subscription plan'
      }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<SubscriptionPlan>>({
      success: true,
      data: {
        ...updatedPlan,
        created_at: new Date(updatedPlan.created_at),
        updated_at: new Date(updatedPlan.updated_at)
      },
      message: 'Subscription plan updated successfully'
    });

  } catch (error) {
    console.error('Update subscription plan error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/subscriptions/plans
 * Deactivate a subscription plan (Admin only)
 * Note: We don't actually delete plans to maintain referential integrity
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('id');

    if (!planId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Plan ID is required'
      }, { status: 400 });
    }

    // Check if plan has active subscriptions
    const { data: activeSubscriptions, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('plan_id', planId)
      .in('status', ['trial', 'active']);

    if (subscriptionError) {
      console.error('Error checking active subscriptions:', subscriptionError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to check active subscriptions'
      }, { status: 500 });
    }

    if (activeSubscriptions && activeSubscriptions.length > 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: `Cannot deactivate plan with ${activeSubscriptions.length} active subscriptions`
      }, { status: 400 });
    }

    // Deactivate the plan instead of deleting
    const { data: deactivatedPlan, error: deactivateError } = await supabase
      .from('subscription_plans')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString() 
      })
      .eq('id', planId)
      .select()
      .single();

    if (deactivateError) {
      console.error('Error deactivating subscription plan:', deactivateError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to deactivate subscription plan'
      }, { status: 500 });
    }

    if (!deactivatedPlan) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Subscription plan not found'
      }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Subscription plan deactivated successfully'
    });

  } catch (error) {
    console.error('Delete subscription plan error:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Helper Functions

function getPlanPrice(plan: any, currency: CurrencyCode, billingCycle: BillingCycle): number {
  const field = billingCycle === 'annually' 
    ? `annual_price_${currency.toLowerCase()}` 
    : `price_${currency.toLowerCase()}`;
  
  return plan[field] || 0;
}

function calculateSavingsPercentage(monthlyPrice: number, annualPrice: number): number {
  if (monthlyPrice === 0 || annualPrice === 0) return 0;
  
  const annualEquivalent = monthlyPrice * 12;
  const savings = annualEquivalent - annualPrice;
  
  return Math.round((savings / annualEquivalent) * 100);
}