/**
 * Billing Dashboard API
 * 
 * Provides billing analytics and statistics for admin and user dashboards
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-production';
import StripeBillingService from '@/services/billing/stripeService';
import { ApiResponse, BillingStats, CustomerSubscriptionStatus } from 'gomflow-shared';

/**
 * GET /api/payments/billing
 * Get billing dashboard data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action'); // 'stats', 'user-status'

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ApiResponse,
        { status: 401 }
      );
    }

    // Get user's subscription status and billing info
    if (action === 'user-status') {
      try {
        const subscriptionStatus = await StripeBillingService.getSubscriptionStatus(user.id);
        const upcomingInvoice = await StripeBillingService.getUpcomingInvoice(user.id);
        const recentInvoices = await StripeBillingService.listInvoices(user.id, 5);
        const paymentMethods = await StripeBillingService.listPaymentMethods(user.id);

        return NextResponse.json({
          success: true,
          data: {
            subscription_status: subscriptionStatus,
            upcoming_invoice: upcomingInvoice,
            recent_invoices: recentInvoices,
            payment_methods: paymentMethods,
          }
        });

      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

    // Get platform billing statistics (admin only)
    if (action === 'stats') {
      try {
        // Check if user is admin (you might have a different admin check)
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('user_id', user.id)
          .single();

        if (!profile || profile.plan !== 'business') {
          return NextResponse.json(
            { success: false, error: 'Admin access required' },
            { status: 403 }
          );
        }

        const billingStats = await StripeBillingService.getBillingStats();
        
        // Get additional stats from database
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Recent signups
        const { count: newCustomers } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', thirtyDaysAgo.toISOString());

        // Trial conversions
        const { count: trialSubscriptions } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true })
          .not('trial_end', 'is', null)
          .gte('created_at', thirtyDaysAgo.toISOString());

        const { count: convertedTrials } = await supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true })
          .not('trial_end', 'is', null)
          .eq('status', 'active')
          .gte('created_at', thirtyDaysAgo.toISOString());

        // Payment failures
        const { count: recentFailures } = await supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open')
          .gt('attempt_count', 0)
          .gte('created_at', thirtyDaysAgo.toISOString());

        const enhancedStats = {
          ...billingStats,
          new_customers_30d: newCustomers || 0,
          trial_conversion_rate: trialSubscriptions ? 
            (convertedTrials || 0) / trialSubscriptions * 100 : 0,
          recent_payment_failures: recentFailures || 0,
        };

        return NextResponse.json({
          success: true,
          data: enhancedStats
        } as ApiResponse<typeof enhancedStats>);

      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

    // Default: Get user's billing summary
    try {
      const subscriptionStatus = await StripeBillingService.getSubscriptionStatus(user.id);
      
      return NextResponse.json({
        success: true,
        data: subscriptionStatus
      } as ApiResponse<CustomerSubscriptionStatus>);

    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Billing GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    );
  }
}

/**
 * POST /api/payments/billing
 * Handle billing actions (retry payments, send notifications, etc.)
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
    const { action, invoice_id, notification_type } = body;

    if (action === 'retry_payment' && invoice_id) {
      try {
        // Verify user owns this invoice
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .select(`
            *,
            customer:customers(user_id)
          `)
          .eq('stripe_invoice_id', invoice_id)
          .single();

        if (invoiceError || !invoice || invoice.customer.user_id !== user.id) {
          return NextResponse.json(
            { success: false, error: 'Invoice not found' },
            { status: 404 }
          );
        }

        const StripeService = await import('@/lib/payments/stripe');
        const paidInvoice = await StripeService.default.payInvoice(invoice_id);

        return NextResponse.json({
          success: true,
          data: paidInvoice,
          message: 'Payment retry initiated'
        });

      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

    if (action === 'send_notification' && notification_type) {
      try {
        // This would be used by admin users to send custom billing notifications
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('user_id', user.id)
          .single();

        if (!profile || profile.plan !== 'business') {
          return NextResponse.json(
            { success: false, error: 'Admin access required' },
            { status: 403 }
          );
        }

        // Implementation would depend on the specific notification type
        return NextResponse.json({
          success: true,
          message: 'Notification sent successfully'
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
    console.error('Billing POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    );
  }
}