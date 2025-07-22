import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';
import { ValidationError } from '../types';
import { z } from 'zod';

const router = Router();

// Validation schemas
const sendNotificationSchema = z.object({
  userId: z.string().optional(),
  guildId: z.string().optional(),
  channelId: z.string().optional(),
  message: z.object({
    content: z.string().optional(),
    embeds: z.array(z.any()).optional(),
    components: z.array(z.any()).optional(),
  }),
  type: z.enum(['order_update', 'payment_reminder', 'submission_confirmation', 'general']),
});

const bulkNotificationSchema = z.object({
  recipients: z.array(z.object({
    userId: z.string().optional(),
    guildId: z.string().optional(),
    channelId: z.string().optional(),
  })),
  message: z.object({
    content: z.string().optional(),
    embeds: z.array(z.any()).optional(),
  }),
  type: z.enum(['order_update', 'payment_reminder', 'general']),
  scheduled: z.boolean().optional(),
  scheduledFor: z.string().datetime().optional(),
});

// Send single notification
router.post('/send', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = sendNotificationSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError('Invalid notification data', validation.error.errors);
    }

    const { userId, guildId, channelId, message, type } = validation.data;
    const queueService = req.app.locals.queueService;

    // Add to notification queue
    const job = await queueService.addNotification({
      type,
      userId,
      guildId,
      channelId,
      message,
      metadata: {
        source: req.service,
        timestamp: new Date().toISOString(),
      },
    });

    logger.info(`Notification queued: ${job.id} for ${type}`);

    res.json({
      success: true,
      jobId: job.id,
      message: 'Notification queued for delivery',
    });
  } catch (error) {
    logger.error('Error queueing notification:', error);
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    res.status(500).json({ error: 'Failed to queue notification' });
  }
});

// Send bulk notifications
router.post('/bulk', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = bulkNotificationSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ValidationError('Invalid bulk notification data', validation.error.errors);
    }

    const { recipients, message, type, scheduled, scheduledFor } = validation.data;
    const queueService = req.app.locals.queueService;

    // Create notification jobs for each recipient
    const notificationJobs = recipients.map(recipient => ({
      type,
      ...recipient,
      message,
      scheduled,
      scheduledFor,
      metadata: {
        source: req.service,
        timestamp: new Date().toISOString(),
        bulk: true,
      },
    }));

    // Add all to queue
    const jobs = await queueService.addBulkNotifications(notificationJobs);

    logger.info(`Bulk notifications queued: ${jobs.length} jobs for ${type}`);

    res.json({
      success: true,
      jobIds: jobs.map(j => j.id),
      count: jobs.length,
      message: `${jobs.length} notifications queued for delivery`,
    });
  } catch (error) {
    logger.error('Error queueing bulk notifications:', error);
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    res.status(500).json({ error: 'Failed to queue bulk notifications' });
  }
});

// Send order update notification
router.post('/order-update', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId, userId, status, message } = req.body;
    const discordBot = req.app.locals.discordBot;
    const databaseService = req.app.locals.databaseService;

    // Get user's Discord ID
    const connection = await databaseService.getDiscordConnectionByUserId(userId);
    if (!connection) {
      return res.status(404).json({ error: 'User not connected to Discord' });
    }

    // Create order update embed
    const embed = discordBot.createOrderUpdateEmbed(orderId, status, message);

    // Queue notification
    const queueService = req.app.locals.queueService;
    const job = await queueService.addNotification({
      type: 'order_update',
      userId: connection.platform_user_id,
      message: {
        embeds: [embed],
      },
      metadata: {
        orderId,
        status,
        source: req.service,
      },
    });

    res.json({
      success: true,
      jobId: job.id,
    });
  } catch (error) {
    logger.error('Error sending order update:', error);
    res.status(500).json({ error: 'Failed to send order update' });
  }
});

// Send payment reminder
router.post('/payment-reminder', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId, orderId, userId, deadline } = req.body;
    const discordBot = req.app.locals.discordBot;
    const databaseService = req.app.locals.databaseService;

    // Get user's Discord ID
    const connection = await databaseService.getDiscordConnectionByUserId(userId);
    if (!connection) {
      return res.status(404).json({ error: 'User not connected to Discord' });
    }

    // Create payment reminder embed
    const embed = discordBot.createPaymentReminderEmbed(submissionId, orderId, deadline);

    // Queue notification
    const queueService = req.app.locals.queueService;
    const job = await queueService.addNotification({
      type: 'payment_reminder',
      userId: connection.platform_user_id,
      message: {
        content: `⏰ **Payment Reminder** for your order!`,
        embeds: [embed],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 1,
                label: 'Upload Payment',
                custom_id: `upload_payment:${submissionId}`,
                emoji: '💳',
              },
              {
                type: 2,
                style: 2,
                label: 'View Order',
                custom_id: `order_details:${orderId}`,
                emoji: '📋',
              },
            ],
          },
        ],
      },
      metadata: {
        submissionId,
        orderId,
        source: req.service,
      },
    });

    res.json({
      success: true,
      jobId: job.id,
    });
  } catch (error) {
    logger.error('Error sending payment reminder:', error);
    res.status(500).json({ error: 'Failed to send payment reminder' });
  }
});

// Get notification status
router.get('/status/:jobId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { jobId } = req.params;
    const queueService = req.app.locals.queueService;

    const job = await queueService.getQueue('discord-notifications')?.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const state = await job.getState();
    const progress = job.progress();

    res.json({
      jobId: job.id,
      state,
      progress,
      data: job.data,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
    });
  } catch (error) {
    logger.error('Error getting notification status:', error);
    res.status(500).json({ error: 'Failed to get notification status' });
  }
});

export default router;