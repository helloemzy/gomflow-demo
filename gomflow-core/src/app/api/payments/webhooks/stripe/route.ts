/**
 * Stripe Webhook Handler
 * 
 * Processes Stripe webhook events for subscription billing:
 * - invoice.payment_succeeded
 * - invoice.payment_failed
 * - customer.subscription.created
 * - customer.subscription.updated
 * - customer.subscription.deleted
 * - payment_method.attached
 * - payment_method.detached
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase-production';
import StripeService from '@/lib/payments/stripe';
import { InvoiceService } from '@/services/billing/invoiceService';
import Stripe from 'stripe';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = headers().get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = StripeService.constructWebhookEvent(body, signature, WEBHOOK_SECRET);
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  const supabase = createClient();

  try {
    // Log the event
    await supabase
      .from('billing_events')
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        event_data: event.data as any,
        processed_at: new Date().toISOString(),
      });

    // Handle different event types
    switch (event.type) {
      
      // ========================================================================
      // CUSTOMER EVENTS
      // ========================================================================
      
      case 'customer.created':
        await handleCustomerCreated(event.data.object as Stripe.Customer);
        break;

      case 'customer.updated':
        await handleCustomerUpdated(event.data.object as Stripe.Customer);
        break;

      case 'customer.deleted':
        await handleCustomerDeleted(event.data.object as Stripe.Customer);
        break;

      // ========================================================================
      // SUBSCRIPTION EVENTS
      // ========================================================================

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      // ========================================================================
      // INVOICE EVENTS
      // ========================================================================

      case 'invoice.created':
        await handleInvoiceCreated(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.finalized':
        await handleInvoiceFinalized(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.upcoming':
        await handleInvoiceUpcoming(event.data.object as Stripe.Invoice);
        break;

      // ========================================================================
      // PAYMENT METHOD EVENTS
      // ========================================================================

      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
        break;

      case 'payment_method.detached':
        await handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
        break;

      case 'setup_intent.succeeded':
        await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent);
        break;

      // ========================================================================
      // PAYMENT EVENTS
      // ========================================================================

      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
        break;
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    
    // Log the error
    await supabase
      .from('billing_events')
      .update({
        error_message: error.message,
        retry_count: 1,
      })
      .eq('stripe_event_id', event.id);

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// CUSTOMER EVENT HANDLERS
// ============================================================================

async function handleCustomerCreated(customer: Stripe.Customer) {
  const supabase = createClient();
  
  // Customer should already exist from our creation flow, but sync if needed
  if (customer.metadata?.user_id) {
    await supabase
      .from('customers')
      .upsert({
        user_id: customer.metadata.user_id,
        stripe_customer_id: customer.id,
        email: customer.email!,
        name: customer.name!,
        phone: customer.phone,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'stripe_customer_id',
      });
  }
}

async function handleCustomerUpdated(customer: Stripe.Customer) {
  const supabase = createClient();
  
  await supabase
    .from('customers')
    .update({
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customer.id);
}

async function handleCustomerDeleted(customer: Stripe.Customer) {
  const supabase = createClient();
  
  await supabase
    .from('customers')
    .update({
      status: 'inactive',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customer.id);
}

// ============================================================================
// SUBSCRIPTION EVENT HANDLERS
// ============================================================================

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const supabase = createClient();
  
  // Get customer
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('stripe_customer_id', subscription.customer as string)
    .single();

  if (!customer) return;

  // Create subscription record
  await supabase
    .from('subscriptions')
    .upsert({
      customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      price_id: subscription.items.data[0].price.id,
      quantity: subscription.items.data[0].quantity || 1,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      billing_interval: subscription.items.data[0].price.recurring?.interval === 'year' ? 
        'year' : 'month',
      amount_per_period: subscription.items.data[0].price.unit_amount || 0,
      currency: customer.currency,
      trial_start: subscription.trial_start ? 
        new Date(subscription.trial_start * 1000) : null,
      trial_end: subscription.trial_end ? 
        new Date(subscription.trial_end * 1000) : null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'stripe_subscription_id',
    });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = createClient();
  
  await supabase
    .from('subscriptions')
    .update({
      status: subscription.status,
      price_id: subscription.items.data[0].price.id,
      quantity: subscription.items.data[0].quantity || 1,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? 
        new Date(subscription.canceled_at * 1000) : null,
      ended_at: subscription.ended_at ? 
        new Date(subscription.ended_at * 1000) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = createClient();
  
  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      ended_at: new Date(),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handleTrialWillEnd(subscription: Stripe.Subscription) {
  // Send trial ending notification
  await InvoiceService.sendTrialEndingNotification(subscription.id);
}

// ============================================================================
// INVOICE EVENT HANDLERS
// ============================================================================

async function handleInvoiceCreated(invoice: Stripe.Invoice) {
  const supabase = createClient();
  
  // Get customer and subscription
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('stripe_customer_id', invoice.customer as string)
    .single();

  if (!customer) return;

  let subscription = null;
  if (invoice.subscription) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('stripe_subscription_id', invoice.subscription as string)
      .single();
    subscription = sub;
  }

  // Create invoice record
  await supabase
    .from('invoices')
    .upsert({
      customer_id: customer.id,
      subscription_id: subscription?.id,
      stripe_invoice_id: invoice.id,
      invoice_number: invoice.number!,
      status: invoice.status === null ? 'draft' : invoice.status,
      currency: customer.currency,
      amount_due: invoice.amount_due,
      amount_paid: invoice.amount_paid,
      amount_remaining: invoice.amount_remaining,
      subtotal: invoice.subtotal,
      tax: invoice.tax || 0,
      total: invoice.total,
      period_start: new Date(invoice.period_start * 1000),
      period_end: new Date(invoice.period_end * 1000),
      due_date: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'stripe_invoice_id',
    });
}

async function handleInvoiceFinalized(invoice: Stripe.Invoice) {
  const supabase = createClient();
  
  await supabase
    .from('invoices')
    .update({
      status: 'open',
      invoice_pdf: invoice.invoice_pdf,
      hosted_invoice_url: invoice.hosted_invoice_url,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_invoice_id', invoice.id);
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const supabase = createClient();
  
  await supabase
    .from('invoices')
    .update({
      status: 'paid',
      amount_paid: invoice.amount_paid,
      amount_remaining: invoice.amount_remaining,
      paid_at: new Date(),
      payment_intent_id: invoice.payment_intent as string || null,
      charge_id: invoice.charge as string || null,
      receipt_url: invoice.receipt_url,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_invoice_id', invoice.id);

  // Send payment success notification
  await InvoiceService.sendPaymentSuccessNotification(invoice.id);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const supabase = createClient();
  
  await supabase
    .from('invoices')
    .update({
      attempted_at: new Date(),
      attempt_count: invoice.attempt_count,
      next_payment_attempt: invoice.next_payment_attempt ? 
        new Date(invoice.next_payment_attempt * 1000) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_invoice_id', invoice.id);

  // Send payment failed notification
  await InvoiceService.sendPaymentFailedNotification(invoice.id);
}

async function handleInvoiceUpcoming(invoice: Stripe.Invoice) {
  // Send upcoming invoice notification
  await InvoiceService.sendUpcomingInvoiceNotification(invoice.id);
}

// ============================================================================
// PAYMENT METHOD EVENT HANDLERS
// ============================================================================

async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  const supabase = createClient();
  
  // Get customer
  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('stripe_customer_id', paymentMethod.customer as string)
    .single();

  if (!customer) return;

  // Save payment method
  await supabase
    .from('stripe_payment_methods')
    .upsert({
      customer_id: customer.id,
      stripe_payment_method_id: paymentMethod.id,
      type: paymentMethod.type,
      brand: paymentMethod.card?.brand,
      last4: paymentMethod.card?.last4,
      exp_month: paymentMethod.card?.exp_month,
      exp_year: paymentMethod.card?.exp_year,
      country: paymentMethod.card?.country,
      funding: paymentMethod.card?.funding,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'stripe_payment_method_id',
    });
}

async function handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod) {
  const supabase = createClient();
  
  await supabase
    .from('stripe_payment_methods')
    .delete()
    .eq('stripe_payment_method_id', paymentMethod.id);
}

async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent) {
  // Payment method setup completed successfully
  console.log(`Setup intent ${setupIntent.id} succeeded for customer ${setupIntent.customer}`);
}

// ============================================================================
// PAYMENT EVENT HANDLERS
// ============================================================================

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log(`Payment intent ${paymentIntent.id} succeeded`);
  // Additional payment success logic if needed
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log(`Payment intent ${paymentIntent.id} failed: ${paymentIntent.last_payment_error?.message}`);
  // Additional payment failure logic if needed
}

// Disable body parsing to handle raw Stripe webhook data
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';