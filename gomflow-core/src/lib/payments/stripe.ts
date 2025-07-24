/**
 * GOMFLOW Stripe Integration Service
 * 
 * Handles all Stripe operations for subscription billing:
 * - Customer management
 * - Subscription lifecycle
 * - Payment method management
 * - Invoice handling
 * - Southeast Asia specific payment methods
 */

import Stripe from 'stripe';
import { 
  Customer,
  Subscription,
  StripePaymentMethod,
  Invoice,
  CreateSubscriptionRequest,
  PaymentMethodSetup,
  UpdatePaymentMethodRequest,
  ModifySubscriptionRequest,
  CustomerSubscriptionStatus
} from 'gomflow-shared';

// Initialize Stripe with API key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
  typescript: true,
});

// Stripe configuration for Southeast Asia
const STRIPE_CONFIG = {
  // Philippine Peso pricing
  PHP: {
    currency: 'php',
    minimum_amount: 5000, // 50 PHP minimum
    tax_rate: 0.12, // 12% VAT
    payment_methods: ['card', 'grabpay', 'gcash', 'paymaya', 'fpx'],
  },
  // Malaysian Ringgit pricing
  MYR: {
    currency: 'myr',
    minimum_amount: 1000, // 10 MYR minimum
    tax_rate: 0.06, // 6% GST
    payment_methods: ['card', 'grabpay', 'fpx', 'maybank2u'],
  },
} as const;

// Subscription plan configurations
const SUBSCRIPTION_PLANS = {
  pro_monthly_php: {
    price_id: process.env.STRIPE_PRO_MONTHLY_PHP_PRICE_ID!,
    amount: 59900, // 599 PHP
    currency: 'php',
    interval: 'month' as const,
  },
  pro_yearly_php: {
    price_id: process.env.STRIPE_PRO_YEARLY_PHP_PRICE_ID!,
    amount: 599900, // 5999 PHP (2 months free)
    currency: 'php',
    interval: 'year' as const,
  },
  gateway_monthly_php: {
    price_id: process.env.STRIPE_GATEWAY_MONTHLY_PHP_PRICE_ID!,
    amount: 119900, // 1199 PHP
    currency: 'php',
    interval: 'month' as const,
  },
  gateway_yearly_php: {
    price_id: process.env.STRIPE_GATEWAY_YEARLY_PHP_PRICE_ID!,
    amount: 1199900, // 11999 PHP (2 months free)
    currency: 'php',
    interval: 'year' as const,
  },
  pro_monthly_myr: {
    price_id: process.env.STRIPE_PRO_MONTHLY_MYR_PRICE_ID!,
    amount: 2900, // 29 MYR
    currency: 'myr',
    interval: 'month' as const,
  },
  pro_yearly_myr: {
    price_id: process.env.STRIPE_PRO_YEARLY_MYR_PRICE_ID!,
    amount: 29900, // 299 MYR (2 months free)
    currency: 'myr',
    interval: 'year' as const,
  },
  gateway_monthly_myr: {
    price_id: process.env.STRIPE_GATEWAY_MONTHLY_MYR_PRICE_ID!,
    amount: 5900, // 59 MYR
    currency: 'myr',
    interval: 'month' as const,
  },
  gateway_yearly_myr: {
    price_id: process.env.STRIPE_GATEWAY_YEARLY_MYR_PRICE_ID!,
    amount: 59900, // 599 MYR (2 months free)
    currency: 'myr',
    interval: 'year' as const,
  },
} as const;

export class StripeService {
  
  // ============================================================================
  // CUSTOMER MANAGEMENT
  // ============================================================================

  /**
   * Create or retrieve a Stripe customer
   */
  static async createCustomer(userData: {
    email: string;
    name: string;
    phone?: string;
    country: 'PH' | 'MY';
    metadata?: Record<string, string>;
  }): Promise<Stripe.Customer> {
    const customer = await stripe.customers.create({
      email: userData.email,
      name: userData.name,
      phone: userData.phone,
      metadata: {
        country: userData.country,
        source: 'gomflow',
        ...userData.metadata,
      },
    });

    return customer;
  }

  /**
   * Update customer information
   */
  static async updateCustomer(
    customerId: string,
    updateData: Partial<{
      email: string;
      name: string;
      phone: string;
      metadata: Record<string, string>;
    }>
  ): Promise<Stripe.Customer> {
    const customer = await stripe.customers.update(customerId, updateData);
    return customer;
  }

  /**
   * Retrieve customer by ID
   */
  static async getCustomer(customerId: string): Promise<Stripe.Customer> {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      throw new Error('Customer has been deleted');
    }
    return customer as Stripe.Customer;
  }

  /**
   * Search for customer by email
   */
  static async findCustomerByEmail(email: string): Promise<Stripe.Customer | null> {
    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
    });

    return customers.data.length > 0 ? customers.data[0] : null;
  }

  // ============================================================================
  // PAYMENT METHOD MANAGEMENT
  // ============================================================================

  /**
   * Create a setup intent for adding payment methods
   */
  static async createSetupIntent(
    customerId: string,
    country: 'PH' | 'MY'
  ): Promise<PaymentMethodSetup> {
    const config = STRIPE_CONFIG[country];
    
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: config.payment_methods,
      usage: 'off_session',
      metadata: {
        country: country,
        purpose: 'subscription_billing',
      },
    });

    return {
      client_secret: setupIntent.client_secret!,
      customer_id: customerId,
      setup_intent_id: setupIntent.id,
      payment_method_types: config.payment_methods,
    };
  }

  /**
   * List customer's payment methods
   */
  static async listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    return paymentMethods.data;
  }

  /**
   * Set default payment method for customer
   */
  static async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<void> {
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  /**
   * Detach payment method from customer
   */
  static async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    await stripe.paymentMethods.detach(paymentMethodId);
  }

  // ============================================================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================================================

  /**
   * Create a new subscription
   */
  static async createSubscription(
    customerId: string,
    request: CreateSubscriptionRequest
  ): Promise<Stripe.Subscription> {
    const subscriptionData: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      items: [{ price: request.price_id }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: request.metadata || {},
    };

    // Add payment method if provided
    if (request.payment_method_id) {
      subscriptionData.default_payment_method = request.payment_method_id;
    }

    // Add trial period if specified
    if (request.trial_days) {
      subscriptionData.trial_period_days = request.trial_days;
    }

    // Add coupon if provided
    if (request.coupon) {
      subscriptionData.coupon = request.coupon;
    }

    const subscription = await stripe.subscriptions.create(subscriptionData);
    return subscription;
  }

  /**
   * Retrieve subscription by ID
   */
  static async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['customer', 'latest_invoice'],
    });
    return subscription;
  }

  /**
   * List customer's subscriptions
   */
  static async listCustomerSubscriptions(
    customerId: string,
    status?: Stripe.Subscription.Status
  ): Promise<Stripe.Subscription[]> {
    const params: Stripe.SubscriptionListParams = {
      customer: customerId,
      expand: ['data.latest_invoice'],
    };

    if (status) {
      params.status = status;
    }

    const subscriptions = await stripe.subscriptions.list(params);
    return subscriptions.data;
  }

  /**
   * Update subscription
   */
  static async updateSubscription(
    subscriptionId: string,
    updates: ModifySubscriptionRequest
  ): Promise<Stripe.Subscription> {
    const updateData: Stripe.SubscriptionUpdateParams = {};

    if (updates.price_id) {
      // Get current subscription to modify items
      const currentSub = await stripe.subscriptions.retrieve(subscriptionId);
      updateData.items = [
        {
          id: currentSub.items.data[0].id,
          price: updates.price_id,
        },
      ];
    }

    if (updates.quantity) {
      updateData.items = updateData.items || [];
      if (updateData.items.length === 0) {
        const currentSub = await stripe.subscriptions.retrieve(subscriptionId);
        updateData.items.push({ id: currentSub.items.data[0].id });
      }
      updateData.items[0].quantity = updates.quantity;
    }

    if (updates.proration_behavior) {
      updateData.proration_behavior = updates.proration_behavior;
    }

    if (updates.billing_cycle_anchor) {
      updateData.billing_cycle_anchor = updates.billing_cycle_anchor;
    }

    const subscription = await stripe.subscriptions.update(subscriptionId, updateData);
    return subscription;
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(
    subscriptionId: string,
    immediately: boolean = false
  ): Promise<Stripe.Subscription> {
    if (immediately) {
      return await stripe.subscriptions.cancel(subscriptionId);
    } else {
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
  }

  /**
   * Reactivate canceled subscription
   */
  static async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  }

  // ============================================================================
  // INVOICE MANAGEMENT
  // ============================================================================

  /**
   * Retrieve invoice by ID
   */
  static async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    const invoice = await stripe.invoices.retrieve(invoiceId, {
      expand: ['customer', 'subscription', 'payment_intent'],
    });
    return invoice;
  }

  /**
   * List customer invoices
   */
  static async listCustomerInvoices(
    customerId: string,
    limit: number = 10
  ): Promise<Stripe.Invoice[]> {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: limit,
      expand: ['data.subscription'],
    });
    return invoices.data;
  }

  /**
   * Get upcoming invoice for customer
   */
  static async getUpcomingInvoice(customerId: string): Promise<Stripe.Invoice | null> {
    try {
      const invoice = await stripe.invoices.retrieveUpcoming({
        customer: customerId,
      });
      return invoice;
    } catch (error: any) {
      if (error.code === 'invoice_upcoming_none') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Pay invoice manually
   */
  static async payInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    const invoice = await stripe.invoices.pay(invoiceId);
    return invoice;
  }

  /**
   * Send invoice to customer
   */
  static async sendInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    const invoice = await stripe.invoices.sendInvoice(invoiceId);
    return invoice;
  }

  // ============================================================================
  // BILLING UTILITIES
  // ============================================================================

  /**
   * Calculate tax amount for country
   */
  static calculateTax(amount: number, country: 'PH' | 'MY'): number {
    const taxRate = STRIPE_CONFIG[country].tax_rate;
    return Math.round(amount * taxRate);
  }

  /**
   * Format amount for display
   */
  static formatAmount(amount: number, currency: 'php' | 'myr'): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
    });
    return formatter.format(amount / 100);
  }

  /**
   * Get supported payment methods for country
   */
  static getSupportedPaymentMethods(country: 'PH' | 'MY'): string[] {
    return STRIPE_CONFIG[country].payment_methods;
  }

  /**
   * Get subscription plan details
   */
  static getSubscriptionPlan(priceId: string) {
    const plan = Object.entries(SUBSCRIPTION_PLANS).find(
      ([_, config]) => config.price_id === priceId
    );
    return plan ? { key: plan[0], ...plan[1] } : null;
  }

  /**
   * Validate minimum amount for country
   */
  static validateMinimumAmount(amount: number, country: 'PH' | 'MY'): boolean {
    return amount >= STRIPE_CONFIG[country].minimum_amount;
  }

  // ============================================================================
  // WEBHOOK UTILITIES
  // ============================================================================

  /**
   * Construct webhook event from raw body and signature
   */
  static constructWebhookEvent(
    body: string | Buffer,
    signature: string,
    endpointSecret: string
  ): Stripe.Event {
    return stripe.webhooks.constructEvent(body, signature, endpointSecret);
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(
    body: string | Buffer,
    signature: string,
    endpointSecret: string
  ): boolean {
    try {
      stripe.webhooks.constructEvent(body, signature, endpointSecret);
      return true;
    } catch (error) {
      return false;
    }
  }

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  /**
   * Handle Stripe errors with user-friendly messages
   */
  static handleStripeError(error: any): {
    message: string;
    code?: string;
    type: string;
  } {
    if (error.type === 'StripeCardError') {
      return {
        message: error.message || 'Your card was declined. Please try a different payment method.',
        code: error.code,
        type: 'card_error',
      };
    }

    if (error.type === 'StripeInvalidRequestError') {
      return {
        message: 'Invalid request. Please check your payment information.',
        code: error.code,
        type: 'invalid_request',
      };
    }

    if (error.type === 'StripeAPIError') {
      return {
        message: 'Payment processing is temporarily unavailable. Please try again later.',
        code: error.code,
        type: 'api_error',
      };
    }

    if (error.type === 'StripeConnectionError') {
      return {
        message: 'Network error occurred. Please check your connection and try again.',
        code: error.code,
        type: 'connection_error',
      };
    }

    return {
      message: 'An unexpected error occurred. Please try again or contact support.',
      type: 'unknown_error',
    };
  }
}

export default StripeService;