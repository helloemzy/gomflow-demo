/**
 * GOMFLOW Stripe Billing Service
 * 
 * High-level service for managing subscriptions, customers, and billing
 * Integrates with database and handles business logic
 */

import { createClient } from '@/lib/supabase-production';
import StripeService from '@/lib/payments/stripe';
import { 
  Customer, 
  Subscription, 
  Invoice,
  StripePaymentMethod,
  CreateSubscriptionRequest,
  CustomerSubscriptionStatus,
  BillingStats,
  ApiResponse
} from 'gomflow-shared';
import Stripe from 'stripe';

export class StripeBillingService {
  
  // ============================================================================
  // CUSTOMER LIFECYCLE
  // ============================================================================

  /**
   * Create or sync Stripe customer with database
   */
  static async createOrSyncCustomer(userId: string): Promise<Customer> {
    const supabase = createClient();
    
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      throw new Error('User profile not found');
    }

    // Check if customer already exists
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (existingCustomer) {
      return existingCustomer;
    }

    // Create Stripe customer
    const stripeCustomer = await StripeService.createCustomer({
      email: profile.email,
      name: profile.name,
      phone: profile.phone,
      country: profile.country,
      metadata: {
        user_id: userId,
        username: profile.username,
      },
    });

    // Save to database
    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        user_id: userId,
        stripe_customer_id: stripeCustomer.id,
        email: profile.email,
        name: profile.name,
        phone: profile.phone,
        country: profile.country,
        currency: profile.country === 'PH' ? 'PHP' : 'MYR',
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save customer: ${error.message}`);
    }

    return customer;
  }

  /**
   * Get customer by user ID
   */
  static async getCustomerByUserId(userId: string): Promise<Customer | null> {
    const supabase = createClient();
    
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get customer: ${error.message}`);
    }

    return customer;
  }

  /**
   * Update customer information
   */
  static async updateCustomer(
    userId: string, 
    updates: Partial<{ name: string; email: string; phone: string }>
  ): Promise<Customer> {
    const supabase = createClient();
    
    const customer = await this.getCustomerByUserId(userId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Update in Stripe
    await StripeService.updateCustomer(customer.stripe_customer_id, updates);

    // Update in database
    const { data: updatedCustomer, error } = await supabase
      .from('customers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update customer: ${error.message}`);
    }

    return updatedCustomer;
  }

  // ============================================================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================================================

  /**
   * Create subscription for user
   */
  static async createSubscription(
    userId: string,
    request: CreateSubscriptionRequest
  ): Promise<{ subscription: Subscription; client_secret?: string }> {
    const supabase = createClient();
    
    // Ensure customer exists
    let customer = await this.getCustomerByUserId(userId);
    if (!customer) {
      customer = await this.createOrSyncCustomer(userId);
    }

    // Create subscription in Stripe
    const stripeSubscription = await StripeService.createSubscription(
      customer.stripe_customer_id,
      request
    );

    // Save to database
    const subscriptionData = {
      customer_id: customer.id,
      stripe_subscription_id: stripeSubscription.id,
      status: stripeSubscription.status,
      price_id: stripeSubscription.items.data[0].price.id,
      quantity: stripeSubscription.items.data[0].quantity || 1,
      current_period_start: new Date(stripeSubscription.current_period_start * 1000),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000),
      billing_interval: stripeSubscription.items.data[0].price.recurring?.interval === 'year' ? 
        'year' as const : 'month' as const,
      amount_per_period: stripeSubscription.items.data[0].price.unit_amount || 0,
      currency: customer.currency,
      trial_start: stripeSubscription.trial_start ? 
        new Date(stripeSubscription.trial_start * 1000) : null,
      trial_end: stripeSubscription.trial_end ? 
        new Date(stripeSubscription.trial_end * 1000) : null,
      metadata: request.metadata || {},
    };

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save subscription: ${error.message}`);
    }

    // Get client secret if subscription is incomplete
    let client_secret: string | undefined;
    if (stripeSubscription.status === 'incomplete') {
      const latestInvoice = stripeSubscription.latest_invoice as Stripe.Invoice;
      if (latestInvoice?.payment_intent) {
        const paymentIntent = latestInvoice.payment_intent as Stripe.PaymentIntent;
        client_secret = paymentIntent.client_secret || undefined;
      }
    }

    return { subscription, client_secret };
  }

  /**
   * Get user's active subscription
   */
  static async getActiveSubscription(userId: string): Promise<Subscription | null> {
    const supabase = createClient();
    
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        customer:customers(*)
      `)
      .eq('customer.user_id', userId)
      .in('status', ['active', 'trialing', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get subscription: ${error.message}`);
    }

    return subscription;
  }

  /**
   * Get subscription status for user
   */
  static async getSubscriptionStatus(userId: string): Promise<CustomerSubscriptionStatus> {
    const subscription = await this.getActiveSubscription(userId);
    
    if (!subscription) {
      return {
        has_active_subscription: false,
        current_plan: 'free',
        is_trial: false,
        payment_method_required: false,
      };
    }

    const now = new Date();
    const isTrialing = subscription.trial_end ? new Date(subscription.trial_end) > now : false;
    const daysUntilRenewal = subscription.current_period_end ? 
      Math.ceil((new Date(subscription.current_period_end).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 
      undefined;

    // Determine plan based on amount
    let currentPlan = 'pro';
    if (subscription.currency === 'PHP') {
      if (subscription.amount_per_period >= 119900) currentPlan = 'gateway';
    } else {
      if (subscription.amount_per_period >= 5900) currentPlan = 'gateway';
    }

    return {
      has_active_subscription: subscription.status === 'active' || subscription.status === 'trialing',
      current_plan: currentPlan,
      subscription_end_date: subscription.current_period_end,
      is_trial: isTrialing,
      trial_end_date: subscription.trial_end,
      days_until_renewal: daysUntilRenewal,
      payment_method_required: subscription.status === 'past_due',
    };
  }

  /**
   * Cancel user's subscription
   */
  static async cancelSubscription(
    userId: string, 
    immediately: boolean = false
  ): Promise<Subscription> {
    const supabase = createClient();
    
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription) {
      throw new Error('No active subscription found');
    }

    // Cancel in Stripe
    const stripeSubscription = await StripeService.cancelSubscription(
      subscription.stripe_subscription_id,
      immediately
    );

    // Update in database
    const { data: updatedSubscription, error } = await supabase
      .from('subscriptions')
      .update({
        status: stripeSubscription.status,
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        canceled_at: stripeSubscription.canceled_at ? 
          new Date(stripeSubscription.canceled_at * 1000) : null,
        ended_at: stripeSubscription.ended_at ? 
          new Date(stripeSubscription.ended_at * 1000) : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update subscription: ${error.message}`);
    }

    return updatedSubscription;
  }

  // ============================================================================
  // PAYMENT METHOD MANAGEMENT
  // ============================================================================

  /**
   * Get setup intent for adding payment method
   */
  static async createPaymentMethodSetup(userId: string) {
    let customer = await this.getCustomerByUserId(userId);
    if (!customer) {
      customer = await this.createOrSyncCustomer(userId);
    }

    return await StripeService.createSetupIntent(
      customer.stripe_customer_id,
      customer.country
    );
  }

  /**
   * List user's payment methods
   */
  static async listPaymentMethods(userId: string): Promise<StripePaymentMethod[]> {
    const supabase = createClient();
    
    const customer = await this.getCustomerByUserId(userId);
    if (!customer) {
      return [];
    }

    // Get from Stripe
    const stripePaymentMethods = await StripeService.listPaymentMethods(
      customer.stripe_customer_id
    );

    // Sync with database
    for (const pm of stripePaymentMethods) {
      await supabase
        .from('stripe_payment_methods')
        .upsert({
          customer_id: customer.id,
          stripe_payment_method_id: pm.id,
          type: pm.type,
          brand: pm.card?.brand,
          last4: pm.card?.last4,
          exp_month: pm.card?.exp_month,
          exp_year: pm.card?.exp_year,
          country: pm.card?.country,
          funding: pm.card?.funding,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'stripe_payment_method_id',
        });
    }

    // Return from database
    const { data: paymentMethods, error } = await supabase
      .from('stripe_payment_methods')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get payment methods: ${error.message}`);
    }

    return paymentMethods;
  }

  /**
   * Set default payment method
   */
  static async setDefaultPaymentMethod(
    userId: string, 
    paymentMethodId: string
  ): Promise<void> {
    const supabase = createClient();
    
    const customer = await this.getCustomerByUserId(userId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Update in Stripe
    await StripeService.setDefaultPaymentMethod(
      customer.stripe_customer_id,
      paymentMethodId
    );

    // Update in database
    await supabase
      .from('stripe_payment_methods')
      .update({ is_default: false })
      .eq('customer_id', customer.id);

    await supabase
      .from('stripe_payment_methods')
      .update({ is_default: true })
      .eq('customer_id', customer.id)
      .eq('stripe_payment_method_id', paymentMethodId);
  }

  // ============================================================================
  // INVOICE MANAGEMENT
  // ============================================================================

  /**
   * List user's invoices
   */
  static async listInvoices(userId: string, limit: number = 10): Promise<Invoice[]> {
    const supabase = createClient();
    
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(*),
        subscription:subscriptions(*),
        line_items:invoice_line_items(*)
      `)
      .eq('customer.user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get invoices: ${error.message}`);
    }

    return invoices;
  }

  /**
   * Get upcoming invoice for user
   */
  static async getUpcomingInvoice(userId: string): Promise<any> {
    const customer = await this.getCustomerByUserId(userId);
    if (!customer) {
      return null;
    }

    return await StripeService.getUpcomingInvoice(customer.stripe_customer_id);
  }

  // ============================================================================
  // BILLING ANALYTICS
  // ============================================================================

  /**
   * Get billing dashboard stats
   */
  static async getBillingStats(): Promise<BillingStats> {
    const supabase = createClient();
    
    // Get customer count
    const { count: totalCustomers } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get active subscriptions
    const { count: activeSubscriptions } = await supabase
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .in('status', ['active', 'trialing']);

    // Calculate MRR and ARR (simplified)
    const { data: subscriptionRevenue } = await supabase
      .from('subscriptions')
      .select('amount_per_period, billing_interval, currency')
      .in('status', ['active', 'trialing']);

    let monthlyRecurringRevenue = 0;
    let annualRecurringRevenue = 0;

    if (subscriptionRevenue) {
      for (const sub of subscriptionRevenue) {
        const monthlyAmount = sub.billing_interval === 'year' ? 
          sub.amount_per_period / 12 : sub.amount_per_period;
        monthlyRecurringRevenue += monthlyAmount / 100; // Convert from cents
        annualRecurringRevenue += monthlyAmount * 12 / 100;
      }
    }

    // Get failed payments count
    const { count: failedPayments } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open')
      .gt('attempt_count', 0);

    return {
      total_customers: totalCustomers || 0,
      active_subscriptions: activeSubscriptions || 0,
      monthly_recurring_revenue: monthlyRecurringRevenue,
      annual_recurring_revenue: annualRecurringRevenue,
      churn_rate: 0, // Would need historical data to calculate
      average_revenue_per_user: activeSubscriptions ? 
        monthlyRecurringRevenue / activeSubscriptions : 0,
      failed_payments: failedPayments || 0,
      upcoming_renewals: 0, // Would need to calculate from subscription dates
      trial_conversions: 0, // Would need historical trial data
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Format amount for display
   */
  static formatAmount(amount: number, currency: 'PHP' | 'MYR'): string {
    return StripeService.formatAmount(amount, currency.toLowerCase() as 'php' | 'myr');
  }

  /**
   * Get supported payment methods for country
   */
  static getSupportedPaymentMethods(country: 'PH' | 'MY'): string[] {
    return StripeService.getSupportedPaymentMethods(country);
  }
}

export default StripeBillingService;