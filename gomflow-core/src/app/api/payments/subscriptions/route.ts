/**
 * Subscription Management API
 * 
 * Handles subscription lifecycle operations:
 * - GET: List user's subscriptions
 * - POST: Create new subscription
 * - PUT: Update subscription
 * - DELETE: Cancel subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-production';
import StripeBillingService from '@/services/billing/stripeService';
import { 
  ApiResponse, 
  Subscription, 
  CreateSubscriptionRequest,
  ModifySubscriptionRequest,
  CustomerSubscriptionStatus
} from 'gomflow-shared';

/**
 * GET /api/payments/subscriptions
 * Get user's subscription information
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action'); // 'list', 'active', 'status'

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ApiResponse,
        { status: 401 }
      );
    }

    if (action === 'status') {
      try {
        const status = await StripeBillingService.getSubscriptionStatus(user.id);
        return NextResponse.json({
          success: true,
          data: status
        } as ApiResponse<CustomerSubscriptionStatus>);
      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

    if (action === 'active') {
      try {
        const subscription = await StripeBillingService.getActiveSubscription(user.id);
        return NextResponse.json({
          success: true,
          data: subscription
        } as ApiResponse<Subscription | null>);
      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

    // Default: List all subscriptions for user
    try {
      const supabase = createClient();
      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('customer.user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return NextResponse.json({
        success: true,
        data: subscriptions
      } as ApiResponse<Subscription[]>);

    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Subscriptions GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    );
  }
}

/**
 * POST /api/payments/subscriptions
 * Create a new subscription
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ApiResponse,
        { status: 401 }
      );
    }

    const body = await request.json();
    const { price_id, payment_method_id, trial_days, coupon, metadata } = body;

    if (!price_id) {
      return NextResponse.json(
        { success: false, error: 'Price ID is required' } as ApiResponse,
        { status: 400 }
      );
    }

    try {
      const subscriptionRequest: CreateSubscriptionRequest = {
        price_id,
        payment_method_id,
        trial_days,
        coupon,
        metadata: {
          user_id: user.id,
          ...metadata
        }
      };

      const result = await StripeBillingService.createSubscription(
        user.id,
        subscriptionRequest
      );

      return NextResponse.json({
        success: true,
        data: result,
        message: 'Subscription created successfully'
      } as ApiResponse<{ subscription: Subscription; client_secret?: string }>);

    } catch (error: any) {
      console.error('Subscription creation error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Subscriptions POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    );
  }
}

/**
 * PUT /api/payments/subscriptions
 * Update subscription (change plan, quantity, etc.)
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ApiResponse,
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, subscription_id, ...updateData } = body;

    if (action === 'cancel') {
      try {
        const immediately = updateData.immediately === true;
        const subscription = await StripeBillingService.cancelSubscription(
          user.id,
          immediately
        );

        return NextResponse.json({
          success: true,
          data: subscription,
          message: immediately ? 'Subscription canceled immediately' : 'Subscription set to cancel at period end'
        } as ApiResponse<Subscription>);

      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

    if (action === 'reactivate') {
      try {
        // Get the current subscription
        const subscription = await StripeBillingService.getActiveSubscription(user.id);
        if (!subscription) {
          return NextResponse.json(
            { success: false, error: 'No subscription found' },
            { status: 404 }
          );
        }

        // Reactivate via Stripe
        const stripeService = await import('@/lib/payments/stripe');
        const reactivatedSubscription = await stripeService.StripeService.reactivateSubscription(
          subscription.stripe_subscription_id
        );

        // Update in database
        await supabase
          .from('subscriptions')
          .update({
            cancel_at_period_end: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', subscription.id);

        return NextResponse.json({
          success: true,
          message: 'Subscription reactivated successfully'
        });

      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

    if (action === 'modify') {
      try {
        const subscription = await StripeBillingService.getActiveSubscription(user.id);
        if (!subscription) {
          return NextResponse.json(
            { success: false, error: 'No active subscription found' },
            { status: 404 }
          );
        }

        const modifyRequest: ModifySubscriptionRequest = {
          price_id: updateData.price_id,
          quantity: updateData.quantity,
          proration_behavior: updateData.proration_behavior || 'create_prorations',
          billing_cycle_anchor: updateData.billing_cycle_anchor || 'unchanged'
        };

        const stripeService = await import('@/lib/payments/stripe');
        const updatedSubscription = await stripeService.StripeService.updateSubscription(
          subscription.stripe_subscription_id,
          modifyRequest
        );

        return NextResponse.json({
          success: true,
          message: 'Subscription updated successfully'
        });

      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Subscriptions PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/payments/subscriptions
 * Cancel subscription immediately
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ApiResponse,
        { status: 401 }
      );
    }

    try {
      const subscription = await StripeBillingService.cancelSubscription(user.id, true);

      return NextResponse.json({
        success: true,
        data: subscription,
        message: 'Subscription canceled successfully'
      } as ApiResponse<Subscription>);

    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Subscriptions DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    );
  }
}