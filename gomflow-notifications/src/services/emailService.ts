import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

import config from '../config';
import logger from '../utils/logger';
import { NotificationEvent, NotificationEventType, NotificationPriority } from '../types';

export interface EmailNotificationPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface EmailTemplate {
  type: string;
  channel: 'email';
  language: string;
  subject?: string;
  title: string;
  message: string;
  html_content?: string;
  variables: string[];
}

export interface EmailDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  to: string | string[];
}

export class EmailService {
  private resend: Resend | null = null;
  private initialized: boolean = false;
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY
    );
    this.initialize();
  }

  private initialize(): void {
    try {
      if (!config.RESEND_API_KEY) {
        logger.warn('Resend API key not configured, email notifications will be disabled');
        return;
      }

      this.resend = new Resend(config.RESEND_API_KEY);
      this.initialized = true;
      
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      this.initialized = false;
    }
  }

  public async sendNotification(notification: NotificationEvent, userEmail: string): Promise<EmailDeliveryResult> {
    if (!this.initialized || !this.resend) {
      return { 
        success: false, 
        error: 'Email service not initialized', 
        to: userEmail 
      };
    }

    try {
      // Get email template for this notification type
      const template = await this.getTemplate(notification.type, 'en');
      if (!template) {
        return { 
          success: false, 
          error: 'Email template not found', 
          to: userEmail 
        };
      }

      // Render email content
      const emailContent = this.renderTemplate(template, notification);
      
      const result = await this.resend.emails.send({
        from: config.FROM_EMAIL,
        to: userEmail,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        replyTo: config.FROM_EMAIL,
        tags: [
          { name: 'service', value: 'gomflow-notifications' },
          { name: 'type', value: notification.type },
          { name: 'priority', value: notification.priority },
          { name: 'notification_id', value: notification.id }
        ]
      });

      if (result.error) {
        logger.error('Failed to send email notification', {
          to: userEmail,
          subject: emailContent.subject,
          notificationId: notification.id,
          error: result.error
        });

        // Record failure in database
        await this.recordDelivery(notification.id, 'email', 'failed', null, result.error.message);

        return { 
          success: false, 
          error: result.error.message, 
          to: userEmail 
        };
      }

      logger.info('Email notification sent successfully', {
        to: userEmail,
        subject: emailContent.subject,
        notificationId: notification.id,
        emailId: result.data?.id
      });

      // Record success in database
      await this.recordDelivery(notification.id, 'email', 'sent', result.data?.id);

      return { 
        success: true, 
        messageId: result.data?.id, 
        to: userEmail 
      };

    } catch (error: any) {
      logger.error('Email notification sending failed', {
        to: userEmail,
        notificationId: notification.id,
        error: error.message
      });

      // Record failure in database
      await this.recordDelivery(notification.id, 'email', 'failed', null, error.message);

      return { 
        success: false, 
        error: error.message, 
        to: userEmail 
      };
    }
  }

  public async sendEmail(payload: EmailNotificationPayload): Promise<boolean> {
    if (!this.initialized || !this.resend) {
      logger.debug('Email service not initialized, skipping email send', { to: payload.to });
      return false;
    }

    try {
      const result = await this.resend.emails.send({
        from: config.FROM_EMAIL,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: payload.replyTo || config.FROM_EMAIL,
        tags: [
          { name: 'service', value: 'gomflow-notifications' },
          { name: 'type', value: 'direct_email' }
        ]
      });

      if (result.error) {
        logger.error('Failed to send email via Resend', {
          to: payload.to,
          subject: payload.subject,
          error: result.error
        });
        return false;
      }

      logger.debug('Email sent successfully', {
        to: payload.to,
        subject: payload.subject,
        emailId: result.data?.id
      });

      return true;
    } catch (error) {
      logger.error('Email sending failed', {
        to: payload.to,
        subject: payload.subject,
        error
      });
      return false;
    }
  }

  public async sendBulkEmails(emails: EmailNotificationPayload[]): Promise<{
    sent: number;
    failed: number;
    errors: string[];
  }> {
    if (!this.initialized) {
      logger.debug('Email service not initialized, skipping bulk email send');
      return { sent: 0, failed: emails.length, errors: ['Email service not initialized'] };
    }

    const result = {
      sent: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Send emails in batches to avoid rate limiting
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < emails.length; i += batchSize) {
      batches.push(emails.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const promises = batch.map(async (email) => {
        try {
          const success = await this.sendEmail(email);
          if (success) {
            result.sent++;
          } else {
            result.failed++;
            result.errors.push(`Failed to send email to ${email.to}`);
          }
        } catch (error) {
          result.failed++;
          result.errors.push(`Error sending email to ${email.to}: ${error.message}`);
        }
      });

      await Promise.allSettled(promises);
      
      // Add delay between batches to respect rate limits
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    logger.info('Bulk email sending completed', {
      totalEmails: emails.length,
      sent: result.sent,
      failed: result.failed
    });

    return result;
  }

  public async sendWelcomeEmail(userEmail: string, userName: string, userType: 'buyer' | 'gom'): Promise<boolean> {
    const welcomeContent = userType === 'gom' 
      ? this.getGOMWelcomeContent(userName)
      : this.getBuyerWelcomeContent(userName);

    return this.sendEmail({
      to: userEmail,
      subject: `Welcome to GOMFLOW - ${userType === 'gom' ? 'Start Managing Orders' : 'Discover Group Orders'}`,
      html: welcomeContent
    });
  }

  public async sendPasswordResetEmail(userEmail: string, resetLink: string): Promise<boolean> {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7C3AED;">Password Reset Request</h2>
        <p>You requested a password reset for your GOMFLOW account.</p>
        <p>Click the button below to reset your password:</p>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${resetLink}" style="background: #7C3AED; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          This link will expire in 1 hour. If you didn't request this password reset, you can safely ignore this email.
        </p>
        
        <p>The GOMFLOW Team</p>
      </div>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: 'Reset Your GOMFLOW Password',
      html: htmlContent
    });
  }

  public async sendOrderSummaryEmail(
    userEmail: string,
    orderTitle: string,
    orderDetails: any
  ): Promise<boolean> {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #7C3AED;">Order Summary - ${orderTitle}</h2>
        
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 15px 0;">${orderTitle}</h3>
          <p style="margin: 5px 0;"><strong>Total Submissions:</strong> ${orderDetails.totalSubmissions}</p>
          <p style="margin: 5px 0;"><strong>Confirmed Payments:</strong> ${orderDetails.confirmedPayments}</p>
          <p style="margin: 5px 0;"><strong>Total Revenue:</strong> ${orderDetails.currency}${orderDetails.totalRevenue}</p>
          <p style="margin: 5px 0;"><strong>Order Status:</strong> ${orderDetails.status}</p>
        </div>
        
        <p>You can view detailed order information and manage submissions through your GOMFLOW dashboard.</p>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${orderDetails.orderUrl}" style="background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Manage Order</a>
        </div>
        
        <p>Thank you for using GOMFLOW!</p>
        <p>The GOMFLOW Team</p>
      </div>
    `;

    return this.sendEmail({
      to: userEmail,
      subject: `Order Summary: ${orderTitle}`,
      html: htmlContent
    });
  }

  private getGOMWelcomeContent(userName: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7C3AED; text-align: center;">Welcome to GOMFLOW!</h1>
        
        <p>Hi ${userName},</p>
        
        <p>Welcome to GOMFLOW - the professional platform for managing group orders! We're excited to help you transform your order management process.</p>
        
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #7C3AED; margin: 0 0 15px 0;">🚀 What you can do with GOMFLOW:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li>Create professional order forms in 2 minutes</li>
            <li>Automate payment tracking and verification</li>
            <li>Manage buyer communications seamlessly</li>
            <li>Scale from 50 to unlimited orders</li>
            <li>Get real-time analytics and insights</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="/dashboard" style="background: #7C3AED; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">Start Creating Orders</a>
        </div>
        
        <p>Need help getting started? Check out our <a href="/help" style="color: #7C3AED;">quick start guide</a> or contact our support team.</p>
        
        <p>Happy selling!</p>
        <p>The GOMFLOW Team</p>
      </div>
    `;
  }

  private getBuyerWelcomeContent(userName: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7C3AED; text-align: center;">Welcome to GOMFLOW!</h1>
        
        <p>Hi ${userName},</p>
        
        <p>Welcome to GOMFLOW - your gateway to amazing group orders! Discover exclusive items, save on shipping, and join a community of smart shoppers.</p>
        
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #7C3AED; margin: 0 0 15px 0;">🛍️ Start exploring:</h3>
          <ul style="margin: 0; padding-left: 20px;">
            <li>Browse trending group orders</li>
            <li>Join orders from trusted GOMs</li>
            <li>Track your orders in real-time</li>
            <li>Get notifications for new opportunities</li>
            <li>Save up to 80% on international shipping</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="/browse" style="background: #7C3AED; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">Browse Orders</a>
        </div>
        
        <p>Questions? Our <a href="/help" style="color: #7C3AED;">help center</a> has everything you need to know about group orders.</p>
        
        <p>Happy shopping!</p>
        <p>The GOMFLOW Team</p>
      </div>
    `;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  // Template management methods
  private async getTemplate(type: string, language: string = 'en'): Promise<EmailTemplate | null> {
    try {
      const { data, error } = await this.supabase
        .from('notification_templates')
        .select('*')
        .eq('type', type)
        .eq('channel', 'email')
        .eq('language', language)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        logger.warn('Email template not found', { type, language });
        return null;
      }

      return data as EmailTemplate;
    } catch (error) {
      logger.error('Failed to get email template', { type, language, error });
      return null;
    }
  }

  private renderTemplate(template: EmailTemplate, notification: NotificationEvent): {
    subject: string;
    html: string;
    text: string;
  } {
    const variables = {
      ...notification.data,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      timestamp: notification.createdAt.toISOString(),
      notificationId: notification.id
    };

    // Render subject
    const subject = this.replaceVariables(template.subject || template.title, variables);

    // Render HTML content
    const html = template.html_content 
      ? this.replaceVariables(template.html_content, variables)
      : this.generateDefaultHTML(template, variables);

    // Render text content
    const text = this.replaceVariables(template.message, variables);

    return { subject, html, text };
  }

  private replaceVariables(content: string, variables: Record<string, any>): string {
    let result = content;
    
    // Replace {{variable}} placeholders
    Object.keys(variables).forEach(key => {
      const value = variables[key];
      if (value !== undefined && value !== null) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, String(value));
      }
    });

    return result;
  }

  private generateDefaultHTML(template: EmailTemplate, variables: Record<string, any>): string {
    const { title, message, orderId, orderTitle, orderUrl } = variables;
    const baseUrl = config.FRONTEND_URL;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
            .content { padding: 30px 20px; }
            .message { font-size: 16px; margin-bottom: 20px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
            .button:hover { background: #5a67d8; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; border-top: 1px solid #e9ecef; }
            .order-details { background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; }
            .urgent { border-left: 4px solid #f56565; }
            .high { border-left: 4px solid #ed8936; }
            .normal { border-left: 4px solid #4299e1; }
            .low { border-left: 4px solid #48bb78; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🛍️ GOMFLOW</h1>
            </div>
            
            <div class="content">
              <div class="message ${variables.priority}">
                <h2 style="margin: 0 0 15px 0; color: #333;">${title}</h2>
                <p style="margin: 0; font-size: 16px;">${message}</p>
              </div>

              ${orderTitle ? `
                <div class="order-details">
                  <h3 style="margin: 0 0 10px 0; color: #667eea;">Order Details</h3>
                  <p style="margin: 5px 0;"><strong>Order:</strong> ${orderTitle}</p>
                  ${orderId ? `<p style="margin: 5px 0;"><strong>Order ID:</strong> ${orderId}</p>` : ''}
                </div>
              ` : ''}

              ${orderUrl ? `
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${orderUrl}" class="button">View Order</a>
                </div>
              ` : ''}

              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                You received this email because you have notifications enabled for your GOMFLOW account. 
                <a href="${baseUrl}/notifications/preferences" style="color: #667eea;">Manage your notification preferences</a>
              </p>
            </div>

            <div class="footer">
              <p style="margin: 0;">
                © 2025 GOMFLOW. All rights reserved.<br>
                <a href="${baseUrl}" style="color: #667eea;">Visit GOMFLOW</a> | 
                <a href="${baseUrl}/help" style="color: #667eea;">Help Center</a> | 
                <a href="${baseUrl}/notifications/unsubscribe" style="color: #667eea;">Unsubscribe</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private async recordDelivery(
    notificationId: string,
    channel: string,
    status: string,
    externalId?: string | null,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('notification_deliveries')
        .insert({
          notification_id: notificationId,
          channel,
          status,
          external_id: externalId,
          error_message: errorMessage,
          delivered_at: status === 'sent' ? new Date().toISOString() : null
        });
    } catch (error) {
      logger.error('Failed to record email delivery:', error);
    }
  }

  // Get user email by user ID
  public async getUserEmail(userId: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      if (error || !data) {
        logger.error('Failed to get user email', { userId, error });
        return null;
      }

      return data.email;
    } catch (error) {
      logger.error('Error getting user email', { userId, error });
      return null;
    }
  }

  // Statistics for monitoring
  public async getDeliveryStats(timeRange: '1h' | '24h' | '7d' = '24h'): Promise<{
    sent: number;
    delivered: number;
    failed: number;
    successRate: number;
  }> {
    try {
      const timeRangeMs = {
        '1h': 3600000,
        '24h': 86400000,
        '7d': 604800000
      };

      const { data, error } = await this.supabase
        .from('notification_deliveries')
        .select('status')
        .eq('channel', 'email')
        .gte('created_at', new Date(Date.now() - timeRangeMs[timeRange]).toISOString());

      if (error) throw error;

      const stats = data.reduce((acc, delivery) => {
        acc[delivery.status] = (acc[delivery.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const sent = stats.sent || 0;
      const delivered = stats.delivered || 0;
      const failed = stats.failed || 0;
      const total = sent + delivered + failed;

      return {
        sent,
        delivered,
        failed,
        successRate: total > 0 ? ((sent + delivered) / total) * 100 : 0
      };
    } catch (error) {
      logger.error('Failed to get email delivery stats:', error);
      return { sent: 0, delivered: 0, failed: 0, successRate: 0 };
    }
  }
}

export default EmailService;