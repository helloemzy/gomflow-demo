import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

import config from '../config';
import logger from '../utils/logger';
import { 
  NotificationEvent, 
  NotificationEventType, 
  NotificationChannel, 
  NotificationPriority,
  NotificationPreferences,
  NotificationTemplate,
  NotificationStats
} from '../types';
import WebSocketService from './websocketService';
import PushNotificationService from './pushNotificationService';
import EmailService from './emailService';

export class NotificationService {
  private supabase;
  private websocketService: WebSocketService;
  private pushService: PushNotificationService;
  private emailService: EmailService;
  private templates: Map<string, NotificationTemplate> = new Map();

  constructor(
    websocketService: WebSocketService,
    pushService: PushNotificationService,
    emailService: EmailService
  ) {
    this.supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
    this.websocketService = websocketService;
    this.pushService = pushService;
    this.emailService = emailService;
    
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    // Order notification templates
    this.templates.set('order_created_websocket', {
      type: NotificationEventType.ORDER_CREATED,
      channel: NotificationChannel.WEBSOCKET,
      title: 'New Order Created',
      message: 'Your order "{{orderTitle}}" has been created successfully',
      variables: ['orderTitle', 'orderId']
    });

    this.templates.set('order_goal_reached_websocket', {
      type: NotificationEventType.ORDER_GOAL_REACHED,
      channel: NotificationChannel.WEBSOCKET,
      title: 'Order Goal Reached! 🎉',
      message: 'The order "{{orderTitle}}" has reached its minimum quantity goal',
      variables: ['orderTitle', 'orderId', 'currentQuantity', 'minQuantity']
    });

    this.templates.set('submission_payment_confirmed_websocket', {
      type: NotificationEventType.SUBMISSION_PAYMENT_CONFIRMED,
      channel: NotificationChannel.WEBSOCKET,
      title: 'Payment Confirmed ✅',
      message: 'Your payment for "{{orderTitle}}" has been confirmed',
      variables: ['orderTitle', 'orderId', 'amount', 'currency']
    });

    this.templates.set('order_deadline_approaching_push', {
      type: NotificationEventType.ORDER_DEADLINE_APPROACHING,
      channel: NotificationChannel.PUSH,
      title: 'Order Deadline Approaching ⏰',
      message: 'Order "{{orderTitle}}" closes in {{timeRemaining}}',
      variables: ['orderTitle', 'orderId', 'timeRemaining']
    });

    this.templates.set('submission_payment_confirmed_email', {
      type: NotificationEventType.SUBMISSION_PAYMENT_CONFIRMED,
      channel: NotificationChannel.EMAIL,
      subject: 'Payment Confirmed - {{orderTitle}}',
      title: 'Payment Confirmation',
      message: 'Your payment for order {{orderTitle}} has been successfully confirmed.',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7C3AED;">Payment Confirmed ✅</h2>
          <p>Dear {{buyerName}},</p>
          <p>We're pleased to confirm that your payment for the following order has been successfully processed:</p>
          
          <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0;">{{orderTitle}}</h3>
            <p style="margin: 5px 0;"><strong>Amount:</strong> {{currency}}{{amount}}</p>
            <p style="margin: 5px 0;"><strong>Payment Reference:</strong> {{paymentReference}}</p>
            <p style="margin: 5px 0;"><strong>Quantity:</strong> {{quantity}}</p>
          </div>
          
          <p>Your order is now confirmed and will proceed to fulfillment once the order deadline is reached.</p>
          <p>You can track your order status anytime through the GOMFLOW dashboard.</p>
          
          <div style="margin: 30px 0;">
            <a href="{{orderUrl}}" style="background: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Order Details</a>
          </div>
          
          <p>Thank you for using GOMFLOW!</p>
          <p>The GOMFLOW Team</p>
        </div>
      `,
      variables: ['orderTitle', 'orderId', 'buyerName', 'amount', 'currency', 'paymentReference', 'quantity', 'orderUrl']
    });

    logger.info('Notification templates initialized', { 
      templateCount: this.templates.size 
    });
  }

  public async sendNotification(notification: NotificationEvent): Promise<{
    sent: boolean;
    channels: { [key in NotificationChannel]?: boolean };
    errors: string[];
  }> {
    const result = {
      sent: false,
      channels: {} as { [key in NotificationChannel]?: boolean },
      errors: [] as string[]
    };

    // Get user notification preferences
    const preferences = await this.getUserPreferences(notification.userId);
    const enabledChannels = this.getEnabledChannels(notification, preferences);

    logger.info('Sending notification', {
      notificationId: notification.id,
      userId: notification.userId,
      type: notification.type,
      channels: enabledChannels,
      priority: notification.priority
    });

    // Send through each enabled channel
    for (const channel of enabledChannels) {
      try {
        let success = false;

        switch (channel) {
          case NotificationChannel.WEBSOCKET:
            success = await this.sendWebSocketNotification(notification);
            break;
          case NotificationChannel.PUSH:
            success = await this.sendPushNotification(notification);
            break;
          case NotificationChannel.EMAIL:
            success = await this.sendEmailNotification(notification);
            break;
          default:
            logger.warn('Unsupported notification channel', { channel });
            continue;
        }

        result.channels[channel] = success;
        if (success) {
          result.sent = true;
        }

      } catch (error) {
        logger.error(`Failed to send notification via ${channel}`, {
          notificationId: notification.id,
          userId: notification.userId,
          channel,
          error
        });
        result.channels[channel] = false;
        result.errors.push(`${channel}: ${error.message}`);
      }
    }

    // Store notification in database
    await this.storeNotification(notification, result);

    return result;
  }

  private async sendWebSocketNotification(notification: NotificationEvent): Promise<boolean> {
    try {
      const success = await this.websocketService.sendToUser(notification.userId, notification);
      
      if (success) {
        logger.debug('WebSocket notification sent successfully', {
          notificationId: notification.id,
          userId: notification.userId
        });
      }

      return success;
    } catch (error) {
      logger.error('WebSocket notification failed', {
        notificationId: notification.id,
        userId: notification.userId,
        error
      });
      return false;
    }
  }

  private async sendPushNotification(notification: NotificationEvent): Promise<boolean> {
    try {
      const success = await this.pushService.sendToUser(notification.userId, {
        title: notification.title,
        body: notification.message,
        data: notification.data || {},
        clickAction: notification.data?.orderUrl || '/dashboard'
      });

      if (success) {
        logger.debug('Push notification sent successfully', {
          notificationId: notification.id,
          userId: notification.userId
        });
      }

      return success;
    } catch (error) {
      logger.error('Push notification failed', {
        notificationId: notification.id,
        userId: notification.userId,
        error
      });
      return false;
    }
  }

  private async sendEmailNotification(notification: NotificationEvent): Promise<boolean> {
    try {
      // Get user email
      const { data: user } = await this.supabase
        .from('users')
        .select('email, full_name')
        .eq('id', notification.userId)
        .single();

      if (!user?.email) {
        logger.warn('User email not found for email notification', {
          notificationId: notification.id,
          userId: notification.userId
        });
        return false;
      }

      // Get email template
      const templateKey = `${notification.type}_email`;
      const template = this.templates.get(templateKey);

      if (!template) {
        logger.warn('Email template not found', {
          notificationId: notification.id,
          templateKey
        });
        return false;
      }

      // Render template with notification data
      const subject = this.renderTemplate(template.subject || template.title, notification.data);
      const htmlContent = this.renderTemplate(template.htmlContent || template.message, {
        ...notification.data,
        buyerName: user.full_name
      });

      const success = await this.emailService.sendEmail({
        to: user.email,
        subject,
        html: htmlContent
      });

      if (success) {
        logger.debug('Email notification sent successfully', {
          notificationId: notification.id,
          userId: notification.userId,
          email: user.email
        });
      }

      return success;
    } catch (error) {
      logger.error('Email notification failed', {
        notificationId: notification.id,
        userId: notification.userId,
        error
      });
      return false;
    }
  }

  private renderTemplate(template: string, data: Record<string, any> = {}): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  private async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      const { data, error } = await this.supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        logger.error('Failed to fetch user notification preferences', { userId, error });
        return null;
      }

      return data || null;
    } catch (error) {
      logger.error('Error fetching user notification preferences', { userId, error });
      return null;
    }
  }

  private getEnabledChannels(
    notification: NotificationEvent, 
    preferences: NotificationPreferences | null
  ): NotificationChannel[] {
    // If no preferences found, use default channels based on priority
    if (!preferences) {
      return this.getDefaultChannels(notification);
    }

    const enabledChannels: NotificationChannel[] = [];

    // Check each channel based on notification type and user preferences
    const eventTypeCategory = this.getEventTypeCategory(notification.type);
    const categoryPrefs = preferences[eventTypeCategory];

    if (categoryPrefs) {
      if (categoryPrefs.websocket) enabledChannels.push(NotificationChannel.WEBSOCKET);
      if (categoryPrefs.push) enabledChannels.push(NotificationChannel.PUSH);
      if (categoryPrefs.email) enabledChannels.push(NotificationChannel.EMAIL);
    }

    // Always include websocket for high priority notifications
    if (notification.priority === NotificationPriority.URGENT || 
        notification.priority === NotificationPriority.HIGH) {
      if (!enabledChannels.includes(NotificationChannel.WEBSOCKET)) {
        enabledChannels.push(NotificationChannel.WEBSOCKET);
      }
    }

    return enabledChannels.length > 0 ? enabledChannels : this.getDefaultChannels(notification);
  }

  private getEventTypeCategory(type: NotificationEventType): keyof Omit<NotificationPreferences, 'userId' | 'quietHours' | 'createdAt' | 'updatedAt'> {
    if ([NotificationEventType.ORDER_CREATED, NotificationEventType.ORDER_UPDATED, 
         NotificationEventType.ORDER_DEADLINE_APPROACHING, NotificationEventType.ORDER_GOAL_REACHED,
         NotificationEventType.ORDER_COMPLETED].includes(type)) {
      return 'orderUpdates';
    }
    
    if ([NotificationEventType.SUBMISSION_PAYMENT_REQUIRED, NotificationEventType.SUBMISSION_PAYMENT_CONFIRMED,
         NotificationEventType.SUBMISSION_PAYMENT_REJECTED].includes(type)) {
      return 'paymentUpdates';
    }
    
    if ([NotificationEventType.NEW_ORDER_RECOMMENDATION, NotificationEventType.CATEGORY_UPDATE].includes(type)) {
      return 'discovery';
    }
    
    return 'communications';
  }

  private getDefaultChannels(notification: NotificationEvent): NotificationChannel[] {
    const channels: NotificationChannel[] = [NotificationChannel.WEBSOCKET];

    // Add push for high priority notifications
    if (notification.priority === NotificationPriority.HIGH || 
        notification.priority === NotificationPriority.URGENT) {
      channels.push(NotificationChannel.PUSH);
    }

    // Add email for specific important events
    if ([NotificationEventType.SUBMISSION_PAYMENT_CONFIRMED, 
         NotificationEventType.ORDER_COMPLETED].includes(notification.type)) {
      channels.push(NotificationChannel.EMAIL);
    }

    return channels;
  }

  private async storeNotification(
    notification: NotificationEvent, 
    result: { sent: boolean; channels: { [key in NotificationChannel]?: boolean }; errors: string[] }
  ): Promise<void> {
    try {
      await this.supabase.from('notifications').insert({
        id: notification.id,
        user_id: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        priority: notification.priority,
        channels_sent: Object.keys(result.channels),
        sent_successfully: result.sent,
        errors: result.errors.length > 0 ? result.errors : null,
        created_at: notification.createdAt.toISOString(),
        scheduled_for: notification.scheduledFor?.toISOString(),
        expires_at: notification.expiresAt?.toISOString()
      });

      logger.debug('Notification stored in database', {
        notificationId: notification.id,
        userId: notification.userId
      });
    } catch (error) {
      logger.error('Failed to store notification in database', {
        notificationId: notification.id,
        userId: notification.userId,
        error
      });
    }
  }

  // Public methods for creating and sending specific notification types

  public async notifyOrderCreated(orderId: string, gomId: string, orderTitle: string): Promise<void> {
    const notification: NotificationEvent = {
      id: uuidv4(),
      type: NotificationEventType.ORDER_CREATED,
      userId: gomId,
      title: 'Order Created Successfully',
      message: `Your order "${orderTitle}" has been created and is now live`,
      data: { orderId, orderTitle, orderUrl: `/orders/${orderId}` },
      channels: [NotificationChannel.WEBSOCKET, NotificationChannel.PUSH],
      priority: NotificationPriority.NORMAL,
      createdAt: new Date()
    };

    await this.sendNotification(notification);
  }

  public async notifyOrderGoalReached(orderId: string, orderTitle: string, userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      const notification: NotificationEvent = {
        id: uuidv4(),
        type: NotificationEventType.ORDER_GOAL_REACHED,
        userId,
        title: 'Order Goal Reached! 🎉',
        message: `The order "${orderTitle}" has reached its minimum quantity goal`,
        data: { orderId, orderTitle, orderUrl: `/orders/${orderId}` },
        channels: [NotificationChannel.WEBSOCKET, NotificationChannel.PUSH],
        priority: NotificationPriority.HIGH,
        createdAt: new Date()
      };

      await this.sendNotification(notification);
    }

    // Also send to order room via WebSocket
    const orderNotification: NotificationEvent = {
      id: uuidv4(),
      type: NotificationEventType.ORDER_GOAL_REACHED,
      userId: 'system',
      title: 'Order Goal Reached! 🎉',
      message: `This order has reached its minimum quantity goal`,
      data: { orderId, orderTitle },
      channels: [NotificationChannel.WEBSOCKET],
      priority: NotificationPriority.HIGH,
      createdAt: new Date()
    };

    await this.websocketService.sendToOrder(orderId, orderNotification);
  }

  public async notifyPaymentConfirmed(
    userId: string, 
    orderId: string, 
    orderTitle: string, 
    amount: number, 
    currency: string,
    paymentReference: string,
    quantity: number
  ): Promise<void> {
    const notification: NotificationEvent = {
      id: uuidv4(),
      type: NotificationEventType.SUBMISSION_PAYMENT_CONFIRMED,
      userId,
      title: 'Payment Confirmed ✅',
      message: `Your payment for "${orderTitle}" has been confirmed`,
      data: { 
        orderId, 
        orderTitle, 
        amount, 
        currency, 
        paymentReference, 
        quantity,
        orderUrl: `/orders/${orderId}` 
      },
      channels: [NotificationChannel.WEBSOCKET, NotificationChannel.PUSH, NotificationChannel.EMAIL],
      priority: NotificationPriority.HIGH,
      createdAt: new Date()
    };

    await this.sendNotification(notification);
  }

  public async getNotificationStats(): Promise<NotificationStats> {
    try {
      const { data: stats } = await this.supabase
        .from('notifications')
        .select('type, channels_sent, sent_successfully, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

      if (!stats) return this.getEmptyStats();

      const totalSent = stats.length;
      const sentByChannel = stats.reduce((acc, notification) => {
        if (notification.channels_sent) {
          notification.channels_sent.forEach((channel: string) => {
            acc[channel] = (acc[channel] || 0) + 1;
          });
        }
        return acc;
      }, { websocket: 0, push: 0, email: 0 });

      const sentByType = stats.reduce((acc, notification) => {
        acc[notification.type] = (acc[notification.type] || 0) + 1;
        return acc;
      }, {} as Record<NotificationEventType, number>);

      const successfulDeliveries = stats.filter(n => n.sent_successfully).length;
      const deliveryRate = totalSent > 0 ? (successfulDeliveries / totalSent) * 100 : 0;

      return {
        totalSent,
        sentByChannel,
        sentByType,
        deliveryRate: Math.round(deliveryRate * 100) / 100,
        averageDeliveryTime: 0 // TODO: Calculate based on actual delivery times
      };
    } catch (error) {
      logger.error('Failed to get notification stats', { error });
      return this.getEmptyStats();
    }
  }

  private getEmptyStats(): NotificationStats {
    return {
      totalSent: 0,
      sentByChannel: { websocket: 0, push: 0, email: 0 },
      sentByType: {} as Record<NotificationEventType, number>,
      deliveryRate: 0,
      averageDeliveryTime: 0
    };
  }
}

export default NotificationService;