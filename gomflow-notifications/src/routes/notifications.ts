import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

import config from '../config';
import logger from '../utils/logger';
import { NotificationEventType, NotificationPriority, NotificationChannel } from '../types';

const router = Router();

// Middleware for authentication
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, config.JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Schema for sending notifications
const sendNotificationSchema = z.object({
  type: z.nativeEnum(NotificationEventType),
  userId: z.string().uuid().optional(), // Optional for broadcast notifications
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  data: z.record(z.any()).optional(),
  channels: z.array(z.nativeEnum(NotificationChannel)).optional(),
  priority: z.nativeEnum(NotificationPriority).default(NotificationPriority.NORMAL),
  scheduledFor: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional()
});

const updatePreferencesSchema = z.object({
  orderUpdates: z.object({
    websocket: z.boolean(),
    push: z.boolean(),
    email: z.boolean()
  }).optional(),
  paymentUpdates: z.object({
    websocket: z.boolean(),
    push: z.boolean(),
    email: z.boolean()
  }).optional(),
  discovery: z.object({
    websocket: z.boolean(),
    push: z.boolean(),
    email: z.boolean()
  }).optional(),
  communications: z.object({
    websocket: z.boolean(),
    push: z.boolean(),
    email: z.boolean()
  }).optional(),
  quietHours: z.object({
    enabled: z.boolean(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    timezone: z.string()
  }).optional()
});

// Payment verification notification endpoints
router.post('/payment-proof-uploaded', authenticateToken, async (req, res) => {
  try {
    const { gomUserId, orderId, orderTitle, buyerName, amount, currency, paymentProofId } = req.body;
    
    if (!gomUserId || !orderId || !orderTitle || !buyerName || !amount || !currency || !paymentProofId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const notificationService = req.app.locals.notificationService;
    await notificationService.notifyPaymentProofUploaded(
      gomUserId,
      orderId,
      orderTitle,
      buyerName,
      amount,
      currency,
      paymentProofId
    );

    res.json({ success: true, message: 'Payment proof upload notification sent' });

  } catch (error) {
    logger.error('Failed to send payment proof upload notification', { error, body: req.body });
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

router.post('/payment-verified', authenticateToken, async (req, res) => {
  try {
    const { 
      buyerPhone, 
      orderId, 
      orderTitle, 
      status, // 'approved' or 'rejected'
      amount, 
      currency, 
      paymentReference,
      reason 
    } = req.body;
    
    if (!buyerPhone || !orderId || !orderTitle || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const notificationService = req.app.locals.notificationService;
    
    if (status === 'approved') {
      if (!amount || !currency || !paymentReference) {
        return res.status(400).json({ error: 'Amount, currency, and payment reference required for approval' });
      }
      
      await notificationService.notifyPaymentVerificationApproved(
        buyerPhone,
        orderId,
        orderTitle,
        amount,
        currency,
        paymentReference
      );
    } else if (status === 'rejected') {
      await notificationService.notifyPaymentVerificationRejected(
        buyerPhone,
        orderId,
        orderTitle,
        reason || 'Please contact the organizer for more information'
      );
    } else {
      return res.status(400).json({ error: 'Status must be "approved" or "rejected"' });
    }

    res.json({ success: true, message: `Payment verification ${status} notification sent` });

  } catch (error) {
    logger.error('Failed to send payment verification notification', { error, body: req.body });
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

router.post('/bulk-verification-completed', authenticateToken, async (req, res) => {
  try {
    const { 
      gomUserId, 
      jobId, 
      action, // 'approved' or 'rejected'
      totalProofs, 
      successfulProofs, 
      failedProofs 
    } = req.body;
    
    if (!gomUserId || !jobId || !action || typeof totalProofs !== 'number' || typeof successfulProofs !== 'number' || typeof failedProofs !== 'number') {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const notificationService = req.app.locals.notificationService;
    await notificationService.notifyBulkVerificationCompleted(
      gomUserId,
      jobId,
      action,
      totalProofs,
      successfulProofs,
      failedProofs
    );

    res.json({ success: true, message: 'Bulk verification completion notification sent' });

  } catch (error) {
    logger.error('Failed to send bulk verification notification', { error, body: req.body });
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

router.post('/auto-verification-completed', authenticateToken, async (req, res) => {
  try {
    const { gomUserId, autoApprovedCount, flaggedCount } = req.body;
    
    if (!gomUserId || typeof autoApprovedCount !== 'number' || typeof flaggedCount !== 'number') {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const notificationService = req.app.locals.notificationService;
    await notificationService.notifyAutoVerificationCompleted(
      gomUserId,
      autoApprovedCount,
      flaggedCount
    );

    res.json({ success: true, message: 'Auto-verification completion notification sent' });

  } catch (error) {
    logger.error('Failed to send auto-verification notification', { error, body: req.body });
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Send notification (for internal services)
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const data = sendNotificationSchema.parse(req.body);
    const notificationService = req.app.locals.notificationService;

    const notification = {
      id: require('uuid').v4(),
      type: data.type,
      userId: data.userId || req.user.sub,
      title: data.title,
      message: data.message,
      data: data.data || {},
      channels: data.channels || [],
      priority: data.priority,
      createdAt: new Date(),
      scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined
    };

    const result = await notificationService.sendNotification(notification);

    res.json({
      success: true,
      notificationId: notification.id,
      result
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    logger.error('Failed to send notification', { error, body: req.body });
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Get user's notifications
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unreadOnly === 'true';

    // Verify user can access these notifications
    if (req.user.sub !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // TODO: Implement database query to get user notifications
    // This would typically query the notifications table with proper filtering
    
    res.json({
      notifications: [],
      pagination: {
        limit,
        offset,
        total: 0,
        hasMore: false
      }
    });

  } catch (error) {
    logger.error('Failed to get user notifications', { error, userId: req.params.userId });
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Mark notification as read
router.patch('/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = req.params.notificationId;
    
    // TODO: Implement database update to mark notification as read
    // This would call mark_notification_read function
    
    res.json({ success: true });

  } catch (error) {
    logger.error('Failed to mark notification as read', { error, notificationId: req.params.notificationId });
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Get unread notification count
router.get('/unread/count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    
    // TODO: Implement database query to get unread count
    // This would call get_unread_notification_count function
    
    res.json({ count: 0 });

  } catch (error) {
    logger.error('Failed to get unread count', { error, userId: req.user.sub });
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Get notification preferences
router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    
    // TODO: Implement database query to get user preferences
    
    res.json({
      orderUpdates: { websocket: true, push: true, email: false },
      paymentUpdates: { websocket: true, push: true, email: true },
      discovery: { websocket: true, push: false, email: false },
      communications: { websocket: true, push: true, email: true },
      quietHours: { enabled: false, startTime: "22:00", endTime: "08:00", timezone: "Asia/Manila" }
    });

  } catch (error) {
    logger.error('Failed to get notification preferences', { error, userId: req.user.sub });
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// Update notification preferences
router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.sub;
    const data = updatePreferencesSchema.parse(req.body);
    
    // TODO: Implement database update for user preferences
    
    res.json({ success: true });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }

    logger.error('Failed to update notification preferences', { error, userId: req.user.sub });
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Register FCM token for push notifications
router.post('/fcm/register', authenticateToken, async (req, res) => {
  try {
    const { token, deviceId, deviceType, deviceInfo } = req.body;
    const userId = req.user.sub;

    if (!token || !deviceId || !deviceType) {
      return res.status(400).json({ error: 'Token, deviceId, and deviceType are required' });
    }

    const pushService = req.app.locals.pushService;
    const success = await pushService.registerToken(userId, token, { deviceId, deviceType, deviceInfo });

    res.json({ success });

  } catch (error) {
    logger.error('Failed to register FCM token', { error, userId: req.user.sub });
    res.status(500).json({ error: 'Failed to register token' });
  }
});

// Remove FCM token
router.delete('/fcm/token/:token', authenticateToken, async (req, res) => {
  try {
    const token = req.params.token;
    const userId = req.user.sub;

    const pushService = req.app.locals.pushService;
    const success = await pushService.removeToken(userId, token);

    res.json({ success });

  } catch (error) {
    logger.error('Failed to remove FCM token', { error, userId: req.user.sub });
    res.status(500).json({ error: 'Failed to remove token' });
  }
});

// Get notification statistics (admin only)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // Check admin permissions
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const notificationService = req.app.locals.notificationService;
    const websocketService = req.app.locals.websocketService;

    const [notificationStats, connectionStats] = await Promise.all([
      notificationService.getNotificationStats(),
      websocketService.getConnectionStats()
    ]);

    res.json({
      notifications: notificationStats,
      connections: connectionStats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get notification stats', { error });
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

export default router;