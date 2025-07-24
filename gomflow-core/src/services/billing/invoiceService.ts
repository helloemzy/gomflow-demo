/**
 * Invoice Service
 * 
 * Handles invoice-related operations:
 * - Email notifications for billing events
 * - Invoice PDF generation
 * - Payment reminders and dunning management
 */

import { createClient } from '@/lib/supabase-production';
import StripeService from '@/lib/payments/stripe';
import { InvoiceEmailData, BillingNotification } from 'gomflow-shared';

// Email service configuration
const EMAIL_CONFIG = {
  from: process.env.BILLING_EMAIL_FROM || 'billing@gomflow.com',
  replyTo: process.env.BILLING_EMAIL_REPLY_TO || 'support@gomflow.com',
  resendApiKey: process.env.RESEND_API_KEY,
};

export class InvoiceService {
  
  // ============================================================================
  // EMAIL NOTIFICATIONS
  // ============================================================================

  /**
   * Send payment success notification
   */
  static async sendPaymentSuccessNotification(invoiceId: string): Promise<void> {
    try {
      const supabase = createClient();
      
      // Get invoice and customer data
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(*),
          subscription:subscriptions(*)
        `)
        .eq('stripe_invoice_id', invoiceId)
        .single();

      if (error || !invoice) {
        console.error('Invoice not found for notification:', invoiceId);
        return;
      }

      const customer = invoice.customer;
      const subscription = invoice.subscription;

      const emailData: InvoiceEmailData = {
        customer_name: customer.name,
        invoice_number: invoice.invoice_number,
        amount_due: invoice.total / 100, // Convert from cents
        currency: invoice.currency,
        due_date: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '',
        invoice_url: invoice.hosted_invoice_url || '',
        period_start: new Date(invoice.period_start).toLocaleDateString(),
        period_end: new Date(invoice.period_end).toLocaleDateString(),
        plan_name: this.getPlanName(subscription?.price_id || '', customer.country),
      };

      const subject = `Payment Confirmed - GOMFLOW Invoice ${invoice.invoice_number}`;
      const body = this.generatePaymentSuccessEmail(emailData);

      await this.sendBillingEmail({
        customer_id: customer.id,
        invoice_id: invoice.id,
        subscription_id: subscription?.id,
        notification_type: 'payment_succeeded',
        email: customer.email,
        subject,
        body,
      });

    } catch (error) {
      console.error('Error sending payment success notification:', error);
    }
  }

  /**
   * Send payment failed notification
   */
  static async sendPaymentFailedNotification(invoiceId: string): Promise<void> {
    try {
      const supabase = createClient();
      
      const { data: invoice, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(*),
          subscription:subscriptions(*)
        `)
        .eq('stripe_invoice_id', invoiceId)
        .single();

      if (error || !invoice) {
        console.error('Invoice not found for notification:', invoiceId);
        return;
      }

      const customer = invoice.customer;
      const subscription = invoice.subscription;

      const emailData: InvoiceEmailData = {
        customer_name: customer.name,
        invoice_number: invoice.invoice_number,
        amount_due: invoice.amount_due / 100,
        currency: invoice.currency,
        due_date: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '',
        invoice_url: invoice.hosted_invoice_url || '',
        period_start: new Date(invoice.period_start).toLocaleDateString(),
        period_end: new Date(invoice.period_end).toLocaleDateString(),
        plan_name: this.getPlanName(subscription?.price_id || '', customer.country),
      };

      const subject = `Payment Failed - Action Required for GOMFLOW Invoice ${invoice.invoice_number}`;
      const body = this.generatePaymentFailedEmail(emailData, invoice.attempt_count);

      await this.sendBillingEmail({
        customer_id: customer.id,
        invoice_id: invoice.id,
        subscription_id: subscription?.id,
        notification_type: 'payment_failed',
        email: customer.email,
        subject,
        body,
      });

    } catch (error) {
      console.error('Error sending payment failed notification:', error);
    }
  }

  /**
   * Send upcoming invoice notification
   */
  static async sendUpcomingInvoiceNotification(invoiceId: string): Promise<void> {
    try {
      const stripeInvoice = await StripeService.getInvoice(invoiceId);
      const supabase = createClient();
      
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('stripe_customer_id', stripeInvoice.customer as string)
        .single();

      if (!customer) return;

      const subscription = stripeInvoice.subscription ? 
        await supabase
          .from('subscriptions')
          .select('*')
          .eq('stripe_subscription_id', stripeInvoice.subscription as string)
          .single() : null;

      const emailData: InvoiceEmailData = {
        customer_name: customer.name,
        invoice_number: stripeInvoice.number || 'Upcoming',
        amount_due: stripeInvoice.amount_due / 100,
        currency: stripeInvoice.currency.toUpperCase(),
        due_date: stripeInvoice.due_date ? 
          new Date(stripeInvoice.due_date * 1000).toLocaleDateString() : '',
        invoice_url: stripeInvoice.hosted_invoice_url || '',
        period_start: new Date(stripeInvoice.period_start * 1000).toLocaleDateString(),
        period_end: new Date(stripeInvoice.period_end * 1000).toLocaleDateString(),
        plan_name: this.getPlanName(
          stripeInvoice.lines.data[0]?.price?.id || '',
          customer.country
        ),
      };

      const subject = `Upcoming Payment - GOMFLOW Subscription Renewal`;
      const body = this.generateUpcomingInvoiceEmail(emailData);

      await this.sendBillingEmail({
        customer_id: customer.id,
        notification_type: 'invoice_upcoming',
        email: customer.email,
        subject,
        body,
      });

    } catch (error) {
      console.error('Error sending upcoming invoice notification:', error);
    }
  }

  /**
   * Send trial ending notification
   */
  static async sendTrialEndingNotification(subscriptionId: string): Promise<void> {
    try {
      const supabase = createClient();
      
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('stripe_subscription_id', subscriptionId)
        .single();

      if (error || !subscription) return;

      const customer = subscription.customer;
      const trialEndDate = subscription.trial_end ? 
        new Date(subscription.trial_end).toLocaleDateString() : '';

      const subject = `Your GOMFLOW trial ends soon - ${trialEndDate}`;
      const body = this.generateTrialEndingEmail({
        customer_name: customer.name,
        trial_end_date: trialEndDate,
        plan_name: this.getPlanName(subscription.price_id, customer.country),
        amount_due: subscription.amount_per_period / 100,
        currency: subscription.currency,
      });

      await this.sendBillingEmail({
        customer_id: customer.id,
        subscription_id: subscription.id,
        notification_type: 'trial_will_end',
        email: customer.email,
        subject,
        body,
      });

    } catch (error) {
      console.error('Error sending trial ending notification:', error);
    }
  }

  // ============================================================================
  // EMAIL TEMPLATES
  // ============================================================================

  private static generatePaymentSuccessEmail(data: InvoiceEmailData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF6B35; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .success { background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .invoice-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .button { background: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🧸 GOMFLOW</h1>
            <h2>Payment Confirmed!</h2>
          </div>
          
          <div class="content">
            <div class="success">
              <strong>✅ Payment Successfully Processed</strong>
            </div>
            
            <p>Hi ${data.customer_name},</p>
            
            <p>Great news! We've successfully processed your payment for your GOMFLOW subscription.</p>
            
            <div class="invoice-details">
              <h3>Payment Details</h3>
              <p><strong>Invoice:</strong> ${data.invoice_number}</p>
              <p><strong>Plan:</strong> ${data.plan_name}</p>
              <p><strong>Amount Paid:</strong> ${data.currency} ${data.amount_due.toFixed(2)}</p>
              <p><strong>Service Period:</strong> ${data.period_start} - ${data.period_end}</p>
            </div>
            
            <p>Your GOMFLOW subscription is now active and you can continue enjoying all the features to streamline your group order management.</p>
            
            ${data.invoice_url ? `<a href="${data.invoice_url}" class="button">View Invoice</a>` : ''}
            
            <p>Need help? Just reply to this email or contact our support team.</p>
            
            <p>Happy ordering!<br>The GOMFLOW Team</p>
          </div>
          
          <div class="footer">
            <p>GOMFLOW - Making group orders simple since 2024</p>
            <p>This is an automated billing notification from your GOMFLOW subscription.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private static generatePaymentFailedEmail(data: InvoiceEmailData, attemptCount: number): string {
    const urgencyLevel = attemptCount > 2 ? 'URGENT' : 'Action Required';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .alert { background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .invoice-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .button { background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🧸 GOMFLOW</h1>
            <h2>${urgencyLevel}: Payment Failed</h2>
          </div>
          
          <div class="content">
            <div class="alert">
              <strong>❌ Payment Could Not Be Processed</strong>
              ${attemptCount > 1 ? `<br>This is attempt #${attemptCount}` : ''}
            </div>
            
            <p>Hi ${data.customer_name},</p>
            
            <p>We were unable to process the payment for your GOMFLOW subscription. This could be due to:</p>
            
            <ul>
              <li>Insufficient funds</li>
              <li>Expired or invalid payment method</li>
              <li>Bank declining the transaction</li>
              <li>Payment method requiring authentication</li>
            </ul>
            
            <div class="invoice-details">
              <h3>Payment Details</h3>
              <p><strong>Invoice:</strong> ${data.invoice_number}</p>
              <p><strong>Plan:</strong> ${data.plan_name}</p>
              <p><strong>Amount Due:</strong> ${data.currency} ${data.amount_due.toFixed(2)}</p>
              <p><strong>Service Period:</strong> ${data.period_start} - ${data.period_end}</p>
              ${data.due_date ? `<p><strong>Due Date:</strong> ${data.due_date}</p>` : ''}
            </div>
            
            <p><strong>What happens next?</strong></p>
            <p>We'll automatically retry the payment in a few days. To avoid service interruption, please:</p>
            
            <ol>
              <li>Update your payment method in your GOMFLOW account</li>
              <li>Ensure sufficient funds are available</li>
              <li>Contact your bank if the issue persists</li>
            </ol>
            
            ${data.invoice_url ? `<a href="${data.invoice_url}" class="button">Update Payment Method</a>` : ''}
            
            <p>Need immediate help? Contact our support team and we'll assist you right away.</p>
            
            <p>Best regards,<br>The GOMFLOW Team</p>
          </div>
          
          <div class="footer">
            <p>GOMFLOW - Making group orders simple since 2024</p>
            <p>This is an automated billing notification from your GOMFLOW subscription.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private static generateUpcomingInvoiceEmail(data: InvoiceEmailData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #FF6B35; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .info { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .invoice-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .button { background: #FF6B35; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🧸 GOMFLOW</h1>
            <h2>Upcoming Payment</h2>
          </div>
          
          <div class="content">
            <div class="info">
              <strong>📅 Your subscription will renew soon</strong>
            </div>
            
            <p>Hi ${data.customer_name},</p>
            
            <p>This is a friendly reminder that your GOMFLOW subscription will automatically renew soon.</p>
            
            <div class="invoice-details">
              <h3>Renewal Details</h3>
              <p><strong>Plan:</strong> ${data.plan_name}</p>
              <p><strong>Amount:</strong> ${data.currency} ${data.amount_due.toFixed(2)}</p>
              <p><strong>Next Service Period:</strong> ${data.period_start} - ${data.period_end}</p>
              ${data.due_date ? `<p><strong>Payment Date:</strong> ${data.due_date}</p>` : ''}
            </div>
            
            <p>We'll automatically charge your default payment method. No action is required unless you want to:</p>
            
            <ul>
              <li>Update your payment method</li>
              <li>Change your subscription plan</li>
              <li>Cancel your subscription</li>
            </ul>
            
            <a href="https://gomflow.com/dashboard/billing" class="button">Manage Subscription</a>
            
            <p>Thank you for being a valued GOMFLOW customer!</p>
            
            <p>Best regards,<br>The GOMFLOW Team</p>
          </div>
          
          <div class="footer">
            <p>GOMFLOW - Making group orders simple since 2024</p>
            <p>This is an automated billing notification from your GOMFLOW subscription.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private static generateTrialEndingEmail(data: {
    customer_name: string;
    trial_end_date: string;
    plan_name: string;
    amount_due: number;
    currency: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6f42c1; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .trial-info { background: #e2e3ff; border: 1px solid #c5c6ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .plan-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
          .button { background: #6f42c1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🧸 GOMFLOW</h1>
            <h2>Your trial is ending soon</h2>
          </div>
          
          <div class="content">
            <div class="trial-info">
              <strong>⏰ Trial ends on ${data.trial_end_date}</strong>
            </div>
            
            <p>Hi ${data.customer_name},</p>
            
            <p>We hope you've enjoyed using GOMFLOW to streamline your group order management! Your free trial is ending soon.</p>
            
            <div class="plan-details">
              <h3>Your Selected Plan</h3>
              <p><strong>Plan:</strong> ${data.plan_name}</p>
              <p><strong>Price:</strong> ${data.currency} ${data.amount_due.toFixed(2)}</p>
              <p><strong>Trial Ends:</strong> ${data.trial_end_date}</p>
            </div>
            
            <p><strong>What happens next?</strong></p>
            <p>If you have a payment method on file, we'll automatically start your subscription when the trial ends. If not, you'll need to add one to continue using GOMFLOW.</p>
            
            <p><strong>Why continue with GOMFLOW?</strong></p>
            <ul>
              <li>🕐 Save 95% of your time on order management</li>
              <li>💰 Scale your GOM business to unlimited orders</li>
              <li>📱 Automated WhatsApp, Telegram & Discord integration</li>
              <li>🎯 Smart payment tracking with AI assistance</li>
              <li>📊 Real-time analytics and insights</li>
            </ul>
            
            <a href="https://gomflow.com/dashboard/billing" class="button">Add Payment Method</a>
            
            <p>Questions about billing or need help? Just reply to this email!</p>
            
            <p>Thanks for trying GOMFLOW,<br>The GOMFLOW Team</p>
          </div>
          
          <div class="footer">
            <p>GOMFLOW - Making group orders simple since 2024</p>
            <p>This is an automated notification about your trial subscription.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Send billing email using Resend API
   */
  private static async sendBillingEmail(notification: Omit<BillingNotification, 'id' | 'sent_at' | 'status' | 'error_message' | 'retry_count' | 'metadata' | 'created_at'>): Promise<void> {
    const supabase = createClient();
    
    try {
      // Save notification to database
      const { data: savedNotification, error: saveError } = await supabase
        .from('billing_notifications')
        .insert({
          ...notification,
          status: 'pending',
          retry_count: 0,
          metadata: {},
        })
        .select()
        .single();

      if (saveError) {
        console.error('Error saving billing notification:', saveError);
        return;
      }

      // Send email using Resend API (or your preferred email service)
      if (EMAIL_CONFIG.resendApiKey) {
        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${EMAIL_CONFIG.resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: EMAIL_CONFIG.from,
              to: [notification.email],
              subject: notification.subject,
              html: notification.body,
              reply_to: EMAIL_CONFIG.replyTo,
            }),
          });

          if (response.ok) {
            // Mark as sent
            await supabase
              .from('billing_notifications')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
              })
              .eq('id', savedNotification.id);
          } else {
            throw new Error(`Email API error: ${response.status}`);
          }
        } catch (emailError: any) {
          // Mark as failed
          await supabase
            .from('billing_notifications')
            .update({
              status: 'failed',
              error_message: emailError.message,
              retry_count: 1,
            })
            .eq('id', savedNotification.id);
        }
      } else {
        console.log('Email would be sent (no API key configured):', {
          to: notification.email,
          subject: notification.subject,
        });
        
        // Mark as sent in development
        await supabase
          .from('billing_notifications')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', savedNotification.id);
      }

    } catch (error) {
      console.error('Error in sendBillingEmail:', error);
    }
  }

  /**
   * Get plan name from price ID
   */
  private static getPlanName(priceId: string, country: 'PH' | 'MY'): string {
    const planMappings: Record<string, string> = {
      // Philippines plans
      [process.env.STRIPE_PRO_MONTHLY_PHP_PRICE_ID || '']: 'GOMFLOW Pro (Monthly)',
      [process.env.STRIPE_PRO_YEARLY_PHP_PRICE_ID || '']: 'GOMFLOW Pro (Yearly)',
      [process.env.STRIPE_GATEWAY_MONTHLY_PHP_PRICE_ID || '']: 'GOMFLOW Gateway (Monthly)',
      [process.env.STRIPE_GATEWAY_YEARLY_PHP_PRICE_ID || '']: 'GOMFLOW Gateway (Yearly)',
      // Malaysia plans
      [process.env.STRIPE_PRO_MONTHLY_MYR_PRICE_ID || '']: 'GOMFLOW Pro (Monthly)',
      [process.env.STRIPE_PRO_YEARLY_MYR_PRICE_ID || '']: 'GOMFLOW Pro (Yearly)',
      [process.env.STRIPE_GATEWAY_MONTHLY_MYR_PRICE_ID || '']: 'GOMFLOW Gateway (Monthly)',
      [process.env.STRIPE_GATEWAY_YEARLY_MYR_PRICE_ID || '']: 'GOMFLOW Gateway (Yearly)',
    };

    return planMappings[priceId] || 'GOMFLOW Subscription';
  }
}

export default InvoiceService;