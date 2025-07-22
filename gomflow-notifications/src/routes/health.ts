import { Router } from 'express';
import logger from '../utils/logger';

const router = Router();

// Basic health check
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  try {
    const websocketService = req.app.locals.websocketService;
    const pushService = req.app.locals.pushService;
    const emailService = req.app.locals.emailService;

    const connectionStats = await websocketService.getConnectionStats();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        websocket: {
          status: 'healthy',
          connections: connectionStats
        },
        pushNotifications: {
          status: pushService.isInitialized() ? 'healthy' : 'disabled',
          initialized: pushService.isInitialized()
        },
        email: {
          status: emailService.isInitialized() ? 'healthy' : 'disabled',
          initialized: emailService.isInitialized()
        }
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Readiness probe for Kubernetes/Docker
router.get('/ready', (req, res) => {
  res.json({
    ready: true,
    timestamp: new Date().toISOString()
  });
});

// Liveness probe for Kubernetes/Docker
router.get('/live', (req, res) => {
  res.json({
    alive: true,
    timestamp: new Date().toISOString()
  });
});

export default router;