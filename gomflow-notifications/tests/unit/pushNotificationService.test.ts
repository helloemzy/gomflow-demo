import PushNotificationService, { FCMDevice, FCMDeliveryResult } from '../../src/services/pushNotificationService';
import { NotificationEvent, NotificationEventType, NotificationPriority } from '../../src/types';
import admin from 'firebase-admin';

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn()
  },
  messaging: jest.fn()
}));

// Mock Supabase
const mockSupabase = {
  from: jest.fn(() => ({
    upsert: jest.fn().mockResolvedValue({ error: null }),
    update: jest.fn().mockResolvedValue({ error: null }),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ 
          data: [{ fcm_token: 'test-token-1' }, { fcm_token: 'test-token-2' }], 
          error: null 
        }),
        in: jest.fn().mockResolvedValue({ error: null })
      })),
      gte: jest.fn().mockResolvedValue({
        data: [
          { status: 'sent' },
          { status: 'sent' },
          { status: 'failed' }
        ],
        error: null
      })
    })),
    insert: jest.fn().mockResolvedValue({ error: null })
  }))
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

describe('PushNotificationService', () => {
  let pushService: PushNotificationService;
  let mockMessaging: any;
  let mockNotification: NotificationEvent;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup Firebase messaging mock
    mockMessaging = {
      send: jest.fn().mockResolvedValue('test-message-id'),
      sendMulticast: jest.fn().mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        responses: [
          { success: true, messageId: 'test-message-1' },
          { success: true, messageId: 'test-message-2' }
        ]
      })
    };

    (admin.messaging as jest.Mock).mockReturnValue(mockMessaging);

    // Create test notification
    mockNotification = {
      id: 'test-notification-123',
      type: NotificationEventType.ORDER_CREATED,
      userId: 'test-user-123',
      title: 'Test Order Created',
      message: 'Your test order has been created successfully',
      data: { orderId: 'order-123', orderTitle: 'Test Order' },
      channels: [],
      priority: NotificationPriority.NORMAL,
      createdAt: new Date()
    };

    // Mock environment variables
    process.env.FIREBASE_PROJECT_ID = 'test-project';
    process.env.FIREBASE_CLIENT_EMAIL = 'test@example.com';
    process.env.FIREBASE_PRIVATE_KEY = 'test-private-key';

    pushService = new PushNotificationService();
  });

  afterEach(() => {
    delete process.env.FIREBASE_PROJECT_ID;
    delete process.env.FIREBASE_CLIENT_EMAIL;
    delete process.env.FIREBASE_PRIVATE_KEY;
  });

  describe('Initialization', () => {
    test('should initialize successfully with valid Firebase config', () => {
      expect(pushService.isInitialized()).toBe(true);
      expect(admin.initializeApp).toHaveBeenCalledWith(
        expect.objectContaining({
          credential: expect.anything(),
          projectId: 'test-project'
        }),
        'gomflow-notifications'
      );
    });

    test('should fail to initialize without Firebase config', () => {
      delete process.env.FIREBASE_PROJECT_ID;
      const serviceWithoutConfig = new PushNotificationService();
      expect(serviceWithoutConfig.isInitialized()).toBe(false);
    });
  });

  describe('FCM Token Management', () => {
    test('should register FCM token successfully', async () => {
      const deviceInfo: Partial<FCMDevice> = {
        deviceId: 'device-123',
        deviceType: 'web',
        deviceInfo: { browser: 'Chrome', version: '100.0' }
      };

      const result = await pushService.registerToken('user-123', 'fcm-token-123', deviceInfo);

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_devices');
    });

    test('should handle registration errors gracefully', async () => {
      mockSupabase.from().upsert.mockResolvedValueOnce({ error: new Error('Database error') });

      const result = await pushService.registerToken('user-123', 'fcm-token-123', {});

      expect(result).toBe(false);
    });

    test('should remove FCM token successfully', async () => {
      const result = await pushService.removeToken('user-123', 'fcm-token-123');

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_devices');
    });

    test('should get user tokens from database', async () => {
      // This tests the private method indirectly through sendToUser
      const result = await pushService.sendToUser('user-123', mockNotification);

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_devices');
    });
  });

  describe('Single Notification Sending', () => {
    test('should send notification to single token successfully', async () => {
      const result = await pushService.sendNotification(mockNotification, 'test-token');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(result.token).toBe('test-token');
      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'test-token',
          notification: expect.objectContaining({
            title: mockNotification.title,
            body: mockNotification.message
          }),
          data: expect.objectContaining({
            notificationId: mockNotification.id,
            type: mockNotification.type
          })
        })
      );
    });

    test('should handle FCM send errors', async () => {
      const error = new Error('FCM Error');
      mockMessaging.send.mockRejectedValueOnce(error);

      const result = await pushService.sendNotification(mockNotification, 'test-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('FCM Error');
    });

    test('should not send when Firebase is not initialized', async () => {
      const uninitializedService = new PushNotificationService();
      // Clear environment variables to prevent initialization
      delete process.env.FIREBASE_PROJECT_ID;

      const result = await uninitializedService.sendNotification(mockNotification, 'test-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Firebase not initialized');
    });
  });

  describe('User Notification Sending', () => {
    test('should send notification to all user tokens', async () => {
      const result = await pushService.sendToUser('user-123', mockNotification);

      expect(result).toBe(true);
      expect(mockMessaging.send).toHaveBeenCalledTimes(2); // Two tokens from mock
    });

    test('should return false when user has no tokens', async () => {
      mockSupabase.from().select().eq().eq.mockResolvedValueOnce({ 
        data: [], 
        error: null 
      });

      const result = await pushService.sendToUser('user-with-no-tokens', mockNotification);

      expect(result).toBe(false);
    });

    test('should clean up invalid tokens on failure', async () => {
      mockMessaging.send
        .mockResolvedValueOnce('success-message-id')
        .mockRejectedValueOnce(new Error('Invalid token'));

      const result = await pushService.sendToUser('user-123', mockNotification);

      // Should still return true if at least one token succeeds
      expect(result).toBe(true);
      expect(mockSupabase.from().update).toHaveBeenCalled();
    });
  });

  describe('Message Building', () => {
    test('should build proper FCM message structure', async () => {
      await pushService.sendNotification(mockNotification, 'test-token');

      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'test-token',
          notification: expect.objectContaining({
            title: mockNotification.title,
            body: mockNotification.message,
            icon: expect.any(String)
          }),
          data: expect.objectContaining({
            notificationId: mockNotification.id,
            type: mockNotification.type,
            priority: mockNotification.priority,
            timestamp: expect.any(String),
            clickAction: expect.any(String)
          }),
          android: expect.objectContaining({
            priority: 'normal',
            notification: expect.objectContaining({
              icon: 'ic_notification',
              color: '#4F46E5',
              sound: 'default'
            })
          }),
          apns: expect.objectContaining({
            payload: expect.objectContaining({
              aps: expect.objectContaining({
                sound: 'default',
                badge: 1
              })
            })
          }),
          webpush: expect.objectContaining({
            notification: expect.objectContaining({
              icon: '/images/notification-icon.png',
              tag: mockNotification.type
            })
          })
        })
      );
    });

    test('should handle urgent priority notifications', async () => {
      const urgentNotification = {
        ...mockNotification,
        priority: NotificationPriority.URGENT
      };

      await pushService.sendNotification(urgentNotification, 'test-token');

      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          android: expect.objectContaining({
            priority: 'high',
            notification: expect.objectContaining({
              sound: 'urgent'
            })
          }),
          apns: expect.objectContaining({
            payload: expect.objectContaining({
              aps: expect.objectContaining({
                sound: 'urgent.wav'
              })
            })
          })
        })
      );
    });

    test('should include notification data in FCM data payload', async () => {
      const notificationWithData = {
        ...mockNotification,
        data: {
          orderId: 'order-123',
          orderTitle: 'Test Order',
          amount: 25.50
        }
      };

      await pushService.sendNotification(notificationWithData, 'test-token');

      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            data_orderId: 'order-123',
            data_orderTitle: 'Test Order',
            data_amount: '25.5'
          })
        })
      );
    });
  });

  describe('Click Actions', () => {
    test('should generate correct click actions for different notification types', async () => {
      const testCases = [
        {
          type: NotificationEventType.ORDER_CREATED,
          data: { orderId: 'order-123' },
          expectedAction: 'http://localhost:3000/orders/order-123'
        },
        {
          type: NotificationEventType.SUBMISSION_PAYMENT_REQUIRED,
          data: { orderId: 'order-456' },
          expectedAction: 'http://localhost:3000/orders/order-456/payment'
        },
        {
          type: NotificationEventType.NEW_ORDER_RECOMMENDATION,
          data: {},
          expectedAction: 'http://localhost:3000/discover'
        }
      ];

      for (const testCase of testCases) {
        const notification = {
          ...mockNotification,
          type: testCase.type,
          data: testCase.data
        };

        await pushService.sendNotification(notification, 'test-token');

        expect(mockMessaging.send).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              clickAction: testCase.expectedAction
            })
          })
        );
      }
    });
  });

  describe('Delivery Tracking', () => {
    test('should record successful delivery in database', async () => {
      await pushService.sendNotification(mockNotification, 'test-token');

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_deliveries');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        notification_id: mockNotification.id,
        channel: 'push',
        status: 'sent',
        external_id: 'test-message-id',
        error_message: undefined,
        delivered_at: expect.any(String)
      });
    });

    test('should record failed delivery in database', async () => {
      mockMessaging.send.mockRejectedValueOnce(new Error('Send failed'));

      await pushService.sendNotification(mockNotification, 'test-token');

      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        notification_id: mockNotification.id,
        channel: 'push',
        status: 'failed',
        external_id: null,
        error_message: 'Send failed',
        delivered_at: null
      });
    });
  });

  describe('Delivery Statistics', () => {
    test('should calculate delivery statistics correctly', async () => {
      const stats = await pushService.getDeliveryStats('24h');

      expect(stats).toEqual({
        sent: 2,
        delivered: 0,
        failed: 1,
        successRate: 66.66666666666666
      });
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_deliveries');
    });

    test('should handle empty statistics', async () => {
      mockSupabase.from().select().eq().gte.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const stats = await pushService.getDeliveryStats('1h');

      expect(stats).toEqual({
        sent: 0,
        delivered: 0,
        failed: 0,
        successRate: 0
      });
    });

    test('should handle database errors in statistics', async () => {
      mockSupabase.from().select().eq().gte.mockResolvedValueOnce({
        data: null,
        error: new Error('Database error')
      });

      const stats = await pushService.getDeliveryStats('7d');

      expect(stats).toEqual({
        sent: 0,
        delivered: 0,
        failed: 0,
        successRate: 0
      });
    });
  });

  describe('Icon Mapping', () => {
    test('should map notification types to correct icons', async () => {
      const iconTestCases = [
        { type: NotificationEventType.ORDER_CREATED, expectedIcon: 'ic_order' },
        { type: NotificationEventType.ORDER_DEADLINE_APPROACHING, expectedIcon: 'ic_clock' },
        { type: NotificationEventType.SUBMISSION_PAYMENT_CONFIRMED, expectedIcon: 'ic_payment' },
        { type: NotificationEventType.NEW_ORDER_RECOMMENDATION, expectedIcon: 'ic_discovery' }
      ];

      for (const testCase of iconTestCases) {
        const notification = { ...mockNotification, type: testCase.type };
        
        await pushService.sendNotification(notification, 'test-token');

        expect(mockMessaging.send).toHaveBeenCalledWith(
          expect.objectContaining({
            notification: expect.objectContaining({
              icon: testCase.expectedIcon
            })
          })
        );
      }
    });

    test('should use default icon for unknown notification types', async () => {
      const notification = { ...mockNotification, type: 'unknown_type' };
      
      await pushService.sendNotification(notification, 'test-token');

      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          notification: expect.objectContaining({
            icon: 'ic_notification'
          })
        })
      );
    });
  });
});