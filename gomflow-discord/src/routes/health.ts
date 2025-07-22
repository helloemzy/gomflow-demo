import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';

const router = Router();

// Basic health check
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'gomflow-discord',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Detailed health check
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const app = req.app;
    const discordBot = app.locals.discordBot;
    const databaseService = app.locals.databaseService;
    const queueService = app.locals.queueService;

    // Check Discord bot status
    const discordStatus = discordBot?.client?.isReady() ? 'connected' : 'disconnected';
    const discordPing = discordBot?.client?.ws?.ping || -1;

    // Check database status
    let databaseStatus = 'unknown';
    try {
      await databaseService?.supabase.from('users').select('id').limit(1);
      databaseStatus = 'connected';
    } catch (error) {
      databaseStatus = 'error';
      logger.error('Database health check failed:', error);
    }

    // Check queue status
    let queueStatus = 'unknown';
    let queueStats = {};
    try {
      queueStats = await queueService?.getAllQueueStats();
      queueStatus = 'healthy';
    } catch (error) {
      queueStatus = 'error';
      logger.error('Queue health check failed:', error);
    }

    res.json({
      status: 'healthy',
      service: 'gomflow-discord',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      discord: {
        status: discordStatus,
        ping: discordPing,
        guilds: discordBot?.client?.guilds?.cache?.size || 0,
      },
      database: {
        status: databaseStatus,
      },
      queues: {
        status: queueStatus,
        stats: queueStats,
      },
    });
  } catch (error) {
    logger.error('Detailed health check error:', error);
    res.status(500).json({
      status: 'error',
      service: 'gomflow-discord',
      error: error.message,
    });
  }
});

export default router;