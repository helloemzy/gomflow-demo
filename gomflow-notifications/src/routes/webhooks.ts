import { Router } from 'express';
import { z } from 'zod';

import config from '../config';
import logger from '../utils/logger';
import { NotificationEventType, NotificationPriority } from '../types';

const router = Router();

// Middleware for webhook authentication
const authenticateWebhook = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const expectedSecret = `Bearer ${config.CORE_API_SECRET}`;

  if (!authHeader || authHeader !== expectedSecret) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  next();
};

// Schema for webhook events
const webhookEventSchema = z.object({
  event: z.string(),
  data: z.record(z.any()),
  timestamp: z.string().datetime().optional()
});

// Main webhook endpoint for Core API events
router.post('/core-api', authenticateWebhook, async (req, res) => {
  try {
    const { event, data } = webhookEventSchema.parse(req.body);
    const notificationService = req.app.locals.notificationService;

    logger.info('Webhook event received', { event, data });

    switch (event) {
      case 'order.created':
        await notificationService.notifyOrderCreated(
          data.orderId,
          data.gomId,
          data.orderTitle
        );
        break;

      case 'order.goal_reached':
        await notificationService.notifyOrderGoalReached(
          data.orderId,
          data.orderTitle,
          data.userIds
        );
        break;

      case 'submission.payment_confirmed':
        await notificationService.notifyPaymentConfirmed(
          data.userId,
          data.orderId,
          data.orderTitle,
          data.amount,
          data.currency,
          data.paymentReference,
          data.quantity
        );
        break;

      case 'order.deadline_approaching':
        // Send deadline reminder notifications
        for (const userId of data.userIds) {
          const notification = {
            id: require('uuid').v4(),
            type: NotificationEventType.ORDER_DEADLINE_APPROACHING,
            userId,
            title: 'Order Deadline Approaching ⏰',
            message: `Order "${data.orderTitle}" closes in ${data.timeRemaining}`,
            data: {
              orderId: data.orderId,
              orderTitle: data.orderTitle,
              timeRemaining: data.timeRemaining,
              orderUrl: `/orders/${data.orderId}`
            },
            channels: [],
            priority: NotificationPriority.HIGH,
            createdAt: new Date()
          };

          await notificationService.sendNotification(notification);
        }
        break;

      case 'submission.created':
        // Notify GOM about new submission
        const submissionNotification = {
          id: require('uuid').v4(),
          type: NotificationEventType.SUBMISSION_CREATED,
          userId: data.gomId,
          title: 'New Order Submission 📝',
          message: `${data.buyerName} joined your order "${data.orderTitle}"`,
          data: {
            orderId: data.orderId,
            orderTitle: data.orderTitle,
            buyerName: data.buyerName,
            quantity: data.quantity,
            orderUrl: `/orders/${data.orderId}/manage`
          },
          channels: [],
          priority: NotificationPriority.NORMAL,
          createdAt: new Date()
        };

        await notificationService.sendNotification(submissionNotification);
        break;

      default:
        logger.warn('Unknown webhook event', { event });
        return res.status(400).json({ error: 'Unknown event type' });
    }

    res.json({ success: true, processed: true });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid webhook payload',
        details: error.errors
      });
    }

    logger.error('Webhook processing failed', { error, body: req.body });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Webhook for Smart Agent payment processing
router.post('/smart-agent', authenticateWebhook, async (req, res) => {
  try {
    const { event, data } = webhookEventSchema.parse(req.body);
    const notificationService = req.app.locals.notificationService;

    logger.info('Smart Agent webhook event received', { event, data });

    switch (event) {
      case 'payment.processed':
        if (data.status === 'confirmed') {
          await notificationService.notifyPaymentConfirmed(
            data.userId,
            data.orderId,
            data.orderTitle,
            data.amount,
            data.currency,
            data.paymentReference,
            data.quantity
          );
        } else if (data.status === 'rejected') {
          const rejectionNotification = {
            id: require('uuid').v4(),
            type: NotificationEventType.SUBMISSION_PAYMENT_REJECTED,
            userId: data.userId,
            title: 'Payment Verification Failed ❌',
            message: `Your payment for "${data.orderTitle}" could not be verified. Please upload a clearer screenshot.`,
            data: {
              orderId: data.orderId,
              orderTitle: data.orderTitle,
              reason: data.reason,
              orderUrl: `/orders/${data.orderId}/payment?ref=${data.paymentReference}`
            },
            channels: [],
            priority: NotificationPriority.HIGH,
            createdAt: new Date()
          };

          await notificationService.sendNotification(rejectionNotification);
        }
        break;

      default:
        logger.warn('Unknown Smart Agent webhook event', { event });
        return res.status(400).json({ error: 'Unknown event type' });
    }

    res.json({ success: true, processed: true });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid webhook payload',
        details: error.errors
      });
    }

    logger.error('Smart Agent webhook processing failed', { error, body: req.body });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Test webhook endpoint for development
router.post('/test', (req, res) => {
  if (config.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Endpoint not found' });
  }

  logger.info('Test webhook called', { body: req.body });
  res.json({ 
    success: true, 
    message: 'Test webhook received',
    timestamp: new Date().toISOString()
  });
});

export default router;