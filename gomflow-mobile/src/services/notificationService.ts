import { Platform } from 'react-native';
import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

import { store } from '../store';
import { updateUser } from '../store/slices/authSlice';
import { apiClient } from './apiClient';
import logger from '../utils/logger';

export interface NotificationPayload {
  type: 'order_update' | 'payment_reminder' | 'payment_confirmed' | 'order_completed' | 'system_announcement';
  orderId?: string;
  submissionId?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface NotificationPreferences {
  orderUpdates: boolean;
  paymentReminders: boolean;
  paymentConfirmations: boolean;
  systemAnnouncements: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // HH:MM format
  quietHoursEnd: string;   // HH:MM format
}

class NotificationService {
  private fcmToken: string | null = null;
  private isInitialized: boolean = false;
  private preferences: NotificationPreferences | null = null;

  constructor() {
    this.initializeNotifications();
  }

  /**
   * Initialize the notification service
   */
  async initializeNotifications(): Promise<void> {
    try {
      logger.info('Initializing notification service...');

      // Request permissions
      const authStatus = await this.requestPermissions();
      if (authStatus !== messaging.AuthorizationStatus.AUTHORIZED) {
        logger.warn('Push notification permissions not granted');
        return;
      }

      // Get FCM token
      await this.getFCMToken();

      // Configure local notifications
      this.configureLocalNotifications();

      // Set up message handlers
      this.setupMessageHandlers();

      // Load user preferences
      await this.loadPreferences();

      this.isInitialized = true;
      logger.info('Notification service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize notification service:', error);
    }
  }

  /**
   * Request notification permissions
   */
  private async requestPermissions(): Promise<messaging.AuthorizationStatus> {
    try {
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        return authStatus;
      } else {
        // Android permissions are handled in PushNotification configuration
        return messaging.AuthorizationStatus.AUTHORIZED;
      }
    } catch (error) {
      logger.error('Failed to request permissions:', error);
      return messaging.AuthorizationStatus.DENIED;
    }
  }

  /**
   * Get and store FCM token
   */
  private async getFCMToken(): Promise<void> {
    try {
      const token = await messaging().getToken();
      if (token) {
        this.fcmToken = token;
        await AsyncStorage.setItem('fcm_token', token);
        
        // Send token to backend
        await this.registerTokenWithBackend(token);
        
        logger.info('FCM token obtained and registered');
      }
    } catch (error) {
      logger.error('Failed to get FCM token:', error);
    }
  }

  /**
   * Configure local notifications
   */
  private configureLocalNotifications(): void {
    PushNotification.configure({
      onRegister: (token) => {
        logger.info('Local notification token registered:', token);
      },

      onNotification: (notification) => {
        this.handleNotificationReceived(notification);
      },

      onAction: (notification) => {
        this.handleNotificationAction(notification);
      },

      onRegistrationError: (error) => {
        logger.error('Local notification registration error:', error);
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    // Create notification channels for Android
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'gomflow_orders',
          channelName: 'Order Updates',
          channelDescription: 'Notifications about order status changes',
          soundName: 'default',
          importance: 4,
          vibrate: true,
        },
        (created) => logger.info('Order channel created:', created)
      );

      PushNotification.createChannel(
        {
          channelId: 'gomflow_payments',
          channelName: 'Payment Notifications',
          channelDescription: 'Notifications about payment status and reminders',
          soundName: 'default',
          importance: 4,
          vibrate: true,
        },
        (created) => logger.info('Payment channel created:', created)
      );

      PushNotification.createChannel(
        {
          channelId: 'gomflow_system',
          channelName: 'System Announcements',
          channelDescription: 'Important system announcements and updates',
          soundName: 'default',
          importance: 3,
          vibrate: false,
        },
        (created) => logger.info('System channel created:', created)
      );
    }
  }

  /**
   * Set up Firebase message handlers
   */
  private setupMessageHandlers(): void {
    // Handle background messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      logger.info('Background message received:', remoteMessage);
      await this.processRemoteMessage(remoteMessage);
    });

    // Handle foreground messages
    messaging().onMessage(async (remoteMessage) => {
      logger.info('Foreground message received:', remoteMessage);
      await this.processRemoteMessage(remoteMessage, true);
    });

    // Handle notification opened app
    messaging().onNotificationOpenedApp((remoteMessage) => {
      logger.info('Notification opened app:', remoteMessage);
      this.handleNotificationOpen(remoteMessage);
    });

    // Check if app was opened from a notification
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          logger.info('App opened from notification:', remoteMessage);
          this.handleNotificationOpen(remoteMessage);
        }
      });

    // Handle token refresh
    messaging().onTokenRefresh(async (token) => {
      logger.info('FCM token refreshed:', token);
      this.fcmToken = token;
      await AsyncStorage.setItem('fcm_token', token);
      await this.registerTokenWithBackend(token);
    });
  }

  /**
   * Process remote message from Firebase
   */
  private async processRemoteMessage(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage,
    isAppInForeground: boolean = false
  ): Promise<void> {
    try {
      const { notification, data } = remoteMessage;
      
      if (!notification) return;

      // Check user preferences
      if (!(await this.shouldShowNotification(data?.type || 'system_announcement'))) {
        logger.info('Notification blocked by user preferences');
        return;
      }

      // Show local notification if app is in foreground
      if (isAppInForeground) {
        this.showLocalNotification({
          type: data?.type as any || 'system_announcement',
          title: notification.title || 'GOMFLOW',
          body: notification.body || '',
          orderId: data?.orderId,
          submissionId: data?.submissionId,
          data: data || {},
        });
      }

      // Track notification analytics
      await this.trackNotificationReceived(data?.type || 'system_announcement');
    } catch (error) {
      logger.error('Failed to process remote message:', error);
    }
  }

  /**
   * Handle notification received
   */
  private handleNotificationReceived(notification: any): void {
    logger.info('Local notification received:', notification);
    
    // Update badge count
    this.updateBadgeCount();
  }

  /**
   * Handle notification action
   */
  private handleNotificationAction(notification: any): void {
    logger.info('Notification action triggered:', notification);
    
    // Handle deep linking
    if (notification.data) {
      this.handleDeepLink(notification.data);
    }
  }

  /**
   * Handle notification opening the app
   */
  private handleNotificationOpen(remoteMessage: FirebaseMessagingTypes.RemoteMessage): void {
    const { data } = remoteMessage;
    
    if (data) {
      // Delay navigation to ensure app is fully loaded
      setTimeout(() => {
        this.handleDeepLink(data);
      }, 1000);
    }
  }

  /**
   * Handle deep linking from notification
   */
  private handleDeepLink(data: Record<string, string>): void {
    try {
      const { type, orderId, submissionId } = data;
      
      switch (type) {
        case 'order_update':
        case 'order_completed':
          if (orderId) {
            const url = `gomflow://order/${orderId}`;
            Linking.openURL(url);
          }
          break;
          
        case 'payment_reminder':
        case 'payment_confirmed':
          if (submissionId) {
            const url = `gomflow://submission/${submissionId}`;
            Linking.openURL(url);
          } else if (orderId) {
            const url = `gomflow://order/${orderId}/payment`;
            Linking.openURL(url);
          }
          break;
          
        case 'system_announcement':
          const url = 'gomflow://dashboard';
          Linking.openURL(url);
          break;
      }
    } catch (error) {
      logger.error('Failed to handle deep link:', error);
    }
  }

  /**
   * Show local notification
   */
  showLocalNotification(payload: NotificationPayload): void {
    try {
      const channelId = this.getChannelIdForType(payload.type);
      
      PushNotification.localNotification({
        channelId,
        title: payload.title,
        message: payload.body,
        data: {
          type: payload.type,
          orderId: payload.orderId,
          submissionId: payload.submissionId,
          ...payload.data,
        },
        actions: this.getActionsForType(payload.type),
        soundName: 'default',
        vibrate: true,
        playSound: true,
        number: 1,
      });
    } catch (error) {
      logger.error('Failed to show local notification:', error);
    }
  }

  /**
   * Register FCM token with backend
   */
  private async registerTokenWithBackend(token: string): Promise<void> {
    try {
      const state = store.getState();
      const userId = state.auth.user?.id;
      
      if (!userId) {
        logger.warn('Cannot register FCM token: user not authenticated');
        return;
      }

      await apiClient.post('/notifications/register-device', {
        userId,
        fcmToken: token,
        platform: Platform.OS,
        deviceInfo: {
          model: Platform.constants.Model || 'Unknown',
          version: Platform.Version,
        },
      });

      // Update user data in store
      store.dispatch(updateUser({ fcmToken: token }));
      
      logger.info('FCM token registered with backend');
    } catch (error) {
      logger.error('Failed to register FCM token with backend:', error);
    }
  }

  /**
   * Load user notification preferences
   */
  private async loadPreferences(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('notification_preferences');
      if (stored) {
        this.preferences = JSON.parse(stored);
      } else {
        // Set default preferences
        this.preferences = {
          orderUpdates: true,
          paymentReminders: true,
          paymentConfirmations: true,
          systemAnnouncements: true,
          quietHoursEnabled: false,
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00',
        };
        await this.savePreferences();
      }
    } catch (error) {
      logger.error('Failed to load notification preferences:', error);
    }
  }

  /**
   * Save notification preferences
   */
  async savePreferences(): Promise<void> {
    try {
      if (this.preferences) {
        await AsyncStorage.setItem(
          'notification_preferences',
          JSON.stringify(this.preferences)
        );
        
        // Sync with backend
        await this.syncPreferencesWithBackend();
      }
    } catch (error) {
      logger.error('Failed to save notification preferences:', error);
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(updates: Partial<NotificationPreferences>): Promise<void> {
    try {
      this.preferences = { ...this.preferences, ...updates } as NotificationPreferences;
      await this.savePreferences();
    } catch (error) {
      logger.error('Failed to update notification preferences:', error);
    }
  }

  /**
   * Get notification preferences
   */
  getPreferences(): NotificationPreferences | null {
    return this.preferences;
  }

  /**
   * Check if notification should be shown based on preferences
   */
  private async shouldShowNotification(type: string): Promise<boolean> {
    if (!this.preferences) return true;

    // Check type-specific preferences
    switch (type) {
      case 'order_update':
      case 'order_completed':
        if (!this.preferences.orderUpdates) return false;
        break;
      case 'payment_reminder':
        if (!this.preferences.paymentReminders) return false;
        break;
      case 'payment_confirmed':
        if (!this.preferences.paymentConfirmations) return false;
        break;
      case 'system_announcement':
        if (!this.preferences.systemAnnouncements) return false;
        break;
    }

    // Check quiet hours
    if (this.preferences.quietHoursEnabled) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      const startTime = this.preferences.quietHoursStart;
      const endTime = this.preferences.quietHoursEnd;
      
      if (this.isTimeInRange(currentTime, startTime, endTime)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if current time is within quiet hours
   */
  private isTimeInRange(current: string, start: string, end: string): boolean {
    const currentMinutes = this.timeToMinutes(current);
    const startMinutes = this.timeToMinutes(start);
    const endMinutes = this.timeToMinutes(end);

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Quiet hours cross midnight
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }

  /**
   * Convert time string to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Get notification channel ID for type
   */
  private getChannelIdForType(type: string): string {
    switch (type) {
      case 'order_update':
      case 'order_completed':
        return 'gomflow_orders';
      case 'payment_reminder':
      case 'payment_confirmed':
        return 'gomflow_payments';
      case 'system_announcement':
        return 'gomflow_system';
      default:
        return 'gomflow_system';
    }
  }

  /**
   * Get notification actions for type
   */
  private getActionsForType(type: string): string[] {
    switch (type) {
      case 'order_update':
        return ['View Order', 'Dismiss'];
      case 'payment_reminder':
        return ['Pay Now', 'View Details', 'Dismiss'];
      case 'payment_confirmed':
        return ['View Order', 'Dismiss'];
      case 'order_completed':
        return ['View Order', 'Rate Experience', 'Dismiss'];
      default:
        return ['View', 'Dismiss'];
    }
  }

  /**
   * Update app badge count
   */
  private updateBadgeCount(): void {
    // This would integrate with your app's unread count logic
    PushNotification.setApplicationIconBadgeNumber(0); // Reset for now
  }

  /**
   * Sync preferences with backend
   */
  private async syncPreferencesWithBackend(): Promise<void> {
    try {
      const state = store.getState();
      const userId = state.auth.user?.id;
      
      if (!userId || !this.preferences) return;

      await apiClient.put('/notifications/preferences', {
        userId,
        preferences: this.preferences,
      });
    } catch (error) {
      logger.error('Failed to sync preferences with backend:', error);
    }
  }

  /**
   * Track notification analytics
   */
  private async trackNotificationReceived(type: string): Promise<void> {
    try {
      await apiClient.post('/analytics/events', {
        event: 'notification_received',
        properties: {
          type,
          timestamp: new Date().toISOString(),
          platform: Platform.OS,
        },
      });
    } catch (error) {
      logger.error('Failed to track notification analytics:', error);
    }
  }

  /**
   * Clear all notifications
   */
  clearAllNotifications(): void {
    PushNotification.cancelAllLocalNotifications();
    PushNotification.setApplicationIconBadgeNumber(0);
  }

  /**
   * Get FCM token
   */
  getFCMTokenSync(): string | null {
    return this.fcmToken;
  }

  /**
   * Check if service is initialized
   */
  isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}

export const notificationService = new NotificationService();
export default notificationService;