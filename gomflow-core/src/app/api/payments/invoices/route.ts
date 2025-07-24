/**
 * Invoice Management API
 * 
 * Handles invoice operations:
 * - GET: List user's invoices
 * - POST: Manually pay invoice
 * - PUT: Send invoice
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-production';
import StripeBillingService from '@/services/billing/stripeService';
import StripeService from '@/lib/payments/stripe';
import { ApiResponse, Invoice } from 'gomflow-shared';

/**
 * GET /api/payments/invoices
 * Get user's invoices
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const action = searchParams.get('action'); // 'upcoming'

    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ApiResponse,
        { status: 401 }
      );
    }

    if (action === 'upcoming') {
      try {
        const upcomingInvoice = await StripeBillingService.getUpcomingInvoice(user.id);
        return NextResponse.json({
          success: true,
          data: upcomingInvoice
        });
      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

    try {
      const invoices = await StripeBillingService.listInvoices(user.id, limit);
      return NextResponse.json({
        success: true,
        data: invoices
      } as ApiResponse<Invoice[]>);

    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Invoices GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    );
  }
}

/**
 * POST /api/payments/invoices
 * Manually pay an invoice
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
    const { invoice_id, action } = body;

    if (!invoice_id) {
      return NextResponse.json(
        { success: false, error: 'Invoice ID is required' } as ApiResponse,
        { status: 400 }
      );
    }

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

      if (action === 'pay') {
        const paidInvoice = await StripeService.payInvoice(invoice_id);
        
        return NextResponse.json({
          success: true,
          data: paidInvoice,
          message: 'Invoice paid successfully'
        });
      }

      if (action === 'send') {
        const sentInvoice = await StripeService.sendInvoice(invoice_id);
        
        return NextResponse.json({
          success: true,
          data: sentInvoice,
          message: 'Invoice sent successfully'
        });
      }

      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );

    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Invoices POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    );
  }
}

/**
 * GET /api/payments/invoices/[id]
 * Get specific invoice details
 */
export async function GETSingle(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' } as ApiResponse,
        { status: 401 }
      );
    }

    const invoiceId = params.id;

    try {
      // Verify user owns this invoice and get details
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(*),
          subscription:subscriptions(*),
          line_items:invoice_line_items(*)
        `)
        .eq('stripe_invoice_id', invoiceId)
        .eq('customer.user_id', user.id)
        .single();

      if (error || !invoice) {
        return NextResponse.json(
          { success: false, error: 'Invoice not found' },
          { status: 404 }
        );
      }

      // Get latest data from Stripe
      const stripeInvoice = await StripeService.getInvoice(invoiceId);

      return NextResponse.json({
        success: true,
        data: {
          ...invoice,
          stripe_data: stripeInvoice
        }
      } as ApiResponse<Invoice & { stripe_data: any }>);

    } catch (error: any) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Invoice GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' } as ApiResponse,
      { status: 500 }
    );
  }
}