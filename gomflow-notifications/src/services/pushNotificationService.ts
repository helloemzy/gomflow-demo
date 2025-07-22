import admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';

import config from '../config';
import logger from '../utils/logger';
import { NotificationEvent, NotificationPriority } from '../types';

export interface FCMDevice {
  userId: string;
  token: string;
  deviceId: string;
  deviceType: 'web' | 'ios' | 'android';
  deviceInfo?: Record<string, any>;
}

export interface FCMDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  token?: string;
}

export class PushNotificationService {
  private initialized: boolean = false;
  private firebaseApp: admin.app.App | null = null;
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
      if (!config.FIREBASE_PROJECT_ID || !config.FIREBASE_PRIVATE_KEY || !config.FIREBASE_CLIENT_EMAIL) {
        logger.warn('Firebase configuration not complete, push notifications will be disabled');
        return;
      }

      const serviceAccount: ServiceAccount = {
        projectId: config.FIREBASE_PROJECT_ID,
        privateKey: config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        clientEmail: config.FIREBASE_CLIENT_EMAIL,
      };

      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: config.FIREBASE_PROJECT_ID,
      }, 'gomflow-notifications');

      this.initialized = true;
      logger.info('Push notification service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize push notification service:', error);
      this.initialized = false;
    }
  }

  public async sendNotification(notification: NotificationEvent, token: string): Promise<FCMDeliveryResult> {
    if (!this.initialized || !this.firebaseApp) {
      return { success: false, error: 'Firebase not initialized', token };
    }

    try {
      const message = this.buildFCMMessage(notification, token);
      const response = await admin.messaging(this.firebaseApp).send(message);
      
      logger.info('FCM notification sent successfully', {
        messageId: response,
        token: token.substring(0, 20) + '...',
        notificationId: notification.id
      });

      // Record delivery in database
      await this.recordDelivery(notification.id, 'push', 'sent', response);

      return {
        success: true,
        messageId: response,
        token
      };

    } catch (error: any) {
      logger.error('Failed to send FCM notification:', {
        error: error.message,
        code: error.code,
        token: token.substring(0, 20) + '...',
        notificationId: notification.id
      });

      // Record failure in database
      await this.recordDelivery(notification.id, 'push', 'failed', null, error.message);

      return {
        success: false,
        error: error.message,
        token
      };
    }
  }

  public async sendToUser(userId: string, notification: NotificationEvent): Promise<boolean> {
    if (!this.initialized) {
      logger.debug('Push notifications not initialized, skipping', { userId });
      return false;
    }

    try {
      // Get user's FCM tokens from database
      const tokens = await this.getUserTokens(userId);
      
      if (tokens.length === 0) {
        logger.debug('No FCM tokens found for user', { userId });
        return false;
      }

      // Send to all user tokens
      const results = await Promise.allSettled(
        tokens.map(token => this.sendNotification(notification, token))
      );

      const successResults = results.filter(result => 
        result.status === 'fulfilled' && result.value.success
      ) as PromiseFulfilledResult<FCMDeliveryResult>[];

      const failedResults = results.filter(result => 
        result.status === 'fulfilled' && !result.value.success
      ) as PromiseFulfilledResult<FCMDeliveryResult>[];

      // Clean up invalid tokens
      const invalidTokens = failedResults
        .map(result => result.value.token)
        .filter(token => token) as string[];

      if (invalidTokens.length > 0) {
        await this.removeInvalidTokens(userId, invalidTokens);
      }

      logger.debug('Push notification sent to user', {
        userId,
        tokensAttempted: tokens.length,
        successCount: successResults.length,
        failedCount: failedResults.length
      });

      return successResults.length > 0;
    } catch (error) {
      logger.error('Failed to send push notification to user', { userId, error });
      return false;
    }
  }

  public async sendToMultipleUsers(userIds: string[], payload: PushNotificationPayload): Promise<number> {
    if (!this.initialized) {
      logger.debug('Push notifications not initialized, skipping batch send');
      return 0;
    }

    let successCount = 0;
    
    const promises = userIds.map(async (userId) => {
      const success = await this.sendToUser(userId, payload);
      if (success) successCount++;
      return success;
    });

    await Promise.allSettled(promises);

    logger.info('Batch push notification completed', {
      userCount: userIds.length,
      successCount
    });

    return successCount;
  }

  public async sendToTopic(topic: string, payload: PushNotificationPayload): Promise<boolean> {
    if (!this.initialized) {
      logger.debug('Push notifications not initialized, skipping topic send');
      return false;
    }

    try {
      const message = {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: payload.icon || '/icon-192x192.png',
        },
        data: payload.data || {},
        webpush: {
          fcmOptions: {
            link: payload.clickAction || '/dashboard'
          }
        },
        topic
      };

      await admin.messaging(this.firebaseApp!).send(message);

      logger.info('Topic push notification sent successfully', { topic });
      return true;
    } catch (error) {
      logger.error('Failed to send topic push notification', { topic, error });
      return false;
    }
  }

  public async subscribeToTopic(userId: string, topic: string): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      const tokens = await this.getUserTokens(userId);
      
      if (tokens.length === 0) {
        logger.debug('No FCM tokens found for topic subscription', { userId, topic });
        return false;
      }

      await admin.messaging(this.firebaseApp!).subscribeToTopic(tokens, topic);
      
      logger.debug('User subscribed to topic', { userId, topic, tokenCount: tokens.length });
      return true;
    } catch (error) {
      logger.error('Failed to subscribe user to topic', { userId, topic, error });
      return false;
    }
  }

  public async unsubscribeFromTopic(userId: string, topic: string): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      const tokens = await this.getUserTokens(userId);
      
      if (tokens.length === 0) {
        return true; // No tokens to unsubscribe
      }

      await admin.messaging(this.firebaseApp!).unsubscribeFromTopic(tokens, topic);
      
      logger.debug('User unsubscribed from topic', { userId, topic, tokenCount: tokens.length });
      return true;
    } catch (error) {
      logger.error('Failed to unsubscribe user from topic', { userId, topic, error });
      return false;
    }
  }

  public async registerToken(userId: string, token: string, deviceInfo: Partial<FCMDevice>): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('user_devices')
        .upsert({
          user_id: userId,
          device_id: deviceInfo.deviceId || `device_${Date.now()}`,
          device_type: deviceInfo.deviceType || 'web',
          fcm_token: token,
          device_info: deviceInfo.deviceInfo || {},
          is_active: true,
          last_used_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,device_id'
        });

      if (error) {
        logger.error('Failed to register FCM token:', error);
        return false;
      }

      logger.info('FCM token registered successfully', {
        userId,
        deviceType: deviceInfo.deviceType,
        token: token.substring(0, 20) + '...'
      });

      return true;
    } catch (error) {
      logger.error('Error registering FCM token:', error);
      return false;
    }
  }

  public async removeToken(userId: string, token: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('user_devices')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('fcm_token', token);

      if (error) {
        logger.error('Failed to remove FCM token:', error);
        return false;
      }

      logger.info('FCM token removed successfully', {
        userId,
        token: token.substring(0, 20) + '...'
      });

      return true;
    } catch (error) {
      logger.error('Error removing FCM token:', error);
      return false;
    }
  }

  private async getUserTokens(userId: string): Promise<string[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_devices')
        .select('fcm_token')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        logger.error('Failed to get user FCM tokens:', error);
        return [];
      }

      return data?.map(device => device.fcm_token) || [];
    } catch (error) {
      logger.error('Error getting user FCM tokens:', error);
      return [];
    }
  }

  private async removeInvalidTokens(userId: string, tokens: string[]): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_devices')
        .update({ is_active: false })
        .eq('user_id', userId)
        .in('fcm_token', tokens);

      if (error) {
        logger.error('Failed to remove invalid FCM tokens:', error);
        return;
      }

      logger.debug('Invalid FCM tokens removed', { userId, tokenCount: tokens.length });
    } catch (error) {
      logger.error('Failed to remove invalid FCM tokens', { userId, error });
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  // Helper methods for building FCM messages
  private buildFCMMessage(notification: NotificationEvent, token: string): any {
    const payload = this.buildNotificationPayload(notification);
    const dataPayload = this.buildDataPayload(notification);

    return {
      token,
      notification: payload,
      data: dataPayload,
      android: {
        priority: this.getAndroidPriority(notification.priority),
        notification: {
          icon: 'ic_notification',
          color: '#4F46E5',
          sound: notification.priority === NotificationPriority.URGENT ? 'urgent' : 'default',
          tag: notification.type,
          clickAction: dataPayload.clickAction
        }
      },
      apns: {
        payload: {
          aps: {
            sound: notification.priority === NotificationPriority.URGENT ? 'urgent.wav' : 'default',
            badge: 1,
            category: notification.type,
            'mutable-content': 1
          }
        }
      },
      webpush: {
        notification: {
          icon: '/images/notification-icon.png',
          badge: '/images/notification-badge.png',
          tag: notification.type,
          requireInteraction: notification.priority === NotificationPriority.URGENT,
          actions: this.getWebPushActions(notification)
        }
      }
    };
  }

  private buildNotificationPayload(notification: NotificationEvent): any {
    return {
      title: notification.title,
      body: notification.message,
      icon: this.getIconForType(notification.type),
      sound: notification.priority === NotificationPriority.URGENT ? 'urgent' : 'default'
    };
  }

  private buildDataPayload(notification: NotificationEvent): Record<string, string> {
    const data: Record<string, string> = {
      notificationId: notification.id,
      type: notification.type,
      priority: notification.priority,
      timestamp: notification.createdAt.toISOString(),
      clickAction: this.getClickActionForType(notification.type, notification.data)
    };

    // Add notification data as strings (FCM requirement)
    if (notification.data) {
      Object.keys(notification.data).forEach(key => {
        data[`data_${key}`] = String(notification.data![key]);
      });
    }

    return data;
  }

  private getAndroidPriority(priority: NotificationPriority): 'high' | 'normal' {
    return priority === NotificationPriority.HIGH || priority === NotificationPriority.URGENT ? 'high' : 'normal';
  }

  private getIconForType(type: string): string {
    const iconMap: Record<string, string> = {
      order_created: 'ic_order',
      order_deadline_approaching: 'ic_clock',
      submission_payment_confirmed: 'ic_payment',
      submission_payment_required: 'ic_payment_required',
      order_goal_reached: 'ic_success',
      new_order_recommendation: 'ic_discovery'
    };
    return iconMap[type] || 'ic_notification';
  }

  private getClickActionForType(type: string, data?: Record<string, any>): string {
    const baseUrl = config.FRONTEND_URL || 'https://gomflow.com';
    
    switch (type) {
      case 'order_created':
      case 'order_deadline_approaching':
      case 'order_goal_reached':
        return `${baseUrl}/orders/${data?.orderId || ''}`;
      case 'submission_payment_required':
      case 'submission_payment_confirmed':
        return `${baseUrl}/orders/${data?.orderId || ''}/payment`;
      case 'new_order_recommendation':
        return `${baseUrl}/discover`;
      default:
        return `${baseUrl}/notifications`;
    }
  }

  private getWebPushActions(notification: NotificationEvent): any[] {
    const actions = [];
    
    switch (notification.type) {
      case 'order_deadline_approaching':
        actions.push({
          action: 'view_order',
          title: 'View Order',
          icon: '/images/view-icon.png'
        });
        break;
      case 'submission_payment_required':
        actions.push({
          action: 'make_payment',
          title: 'Pay Now',
          icon: '/images/payment-icon.png'
        });
        break;
      case 'new_order_recommendation':
        actions.push({
          action: 'discover',
          title: 'Discover',
          icon: '/images/discover-icon.png'
        });
        break;
    }

    return actions;
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
      logger.error('Failed to record notification delivery:', error);
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
        .eq('channel', 'push')
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
      logger.error('Failed to get delivery stats:', error);
      return { sent: 0, delivered: 0, failed: 0, successRate: 0 };
    }
  }
}

export default PushNotificationService;