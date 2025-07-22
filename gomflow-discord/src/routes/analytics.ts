import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Get guild analytics
router.get('/guild/:guildId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { guildId } = req.params;
    const databaseService = req.app.locals.databaseService;

    const analytics = await databaseService.getGuildAnalytics(guildId);
    
    res.json({
      guildId,
      analytics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting guild analytics:', error);
    res.status(500).json({ error: 'Failed to get guild analytics' });
  }
});

// Get user analytics
router.get('/user/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const databaseService = req.app.locals.databaseService;

    // Get user's orders and submissions
    const [orders, submissions] = await Promise.all([
      databaseService.getUserOrders(userId),
      databaseService.getUserSubmissions(userId),
    ]);

    const analytics = {
      totalOrders: orders.length,
      activeOrders: orders.filter(o => o.status === 'active').length,
      completedOrders: orders.filter(o => o.status === 'completed').length,
      totalSubmissions: submissions.length,
      pendingPayments: submissions.filter(s => s.status === 'pending_payment').length,
      completedPayments: submissions.filter(s => s.status === 'payment_verified').length,
    };

    res.json({
      userId,
      analytics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting user analytics:', error);
    res.status(500).json({ error: 'Failed to get user analytics' });
  }
});

// Get bot-wide analytics
router.get('/bot', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const discordBot = req.app.locals.discordBot;
    const databaseService = req.app.locals.databaseService;
    const queueService = req.app.locals.queueService;

    // Get Discord bot stats
    const client = discordBot.client;
    const discordStats = {
      guilds: client.guilds.cache.size,
      users: client.users.cache.size,
      channels: client.channels.cache.size,
      uptime: client.uptime,
      ping: client.ws.ping,
    };

    // Get queue stats
    const queueStats = await queueService.getAllQueueStats();

    // Get database stats
    const dbStats = await databaseService.getDatabaseStats();

    res.json({
      discord: discordStats,
      queues: queueStats,
      database: dbStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting bot analytics:', error);
    res.status(500).json({ error: 'Failed to get bot analytics' });
  }
});

// Get order analytics
router.get('/orders', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { startDate, endDate, guildId } = req.query;
    const databaseService = req.app.locals.databaseService;

    const analytics = await databaseService.getOrderAnalytics({
      startDate: startDate as string,
      endDate: endDate as string,
      guildId: guildId as string,
    });

    res.json({
      analytics,
      filters: { startDate, endDate, guildId },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error getting order analytics:', error);
    res.status(500).json({ error: 'Failed to get order analytics' });
  }
});

// Track event
router.post('/track', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const trackEventSchema = z.object({
      event: z.string(),
      userId: z.string().optional(),
      guildId: z.string().optional(),
      properties: z.record(z.any()).optional(),
    });

    const validation = trackEventSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Invalid event data' });
    }

    const { event, userId, guildId, properties } = validation.data;

    // Log the event (in production, this would go to an analytics service)
    logger.info('Analytics event tracked', {
      event,
      userId,
      guildId,
      properties,
      source: req.service,
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error tracking event:', error);
    res.status(500).json({ error: 'Failed to track event' });
  }
});

export default router;