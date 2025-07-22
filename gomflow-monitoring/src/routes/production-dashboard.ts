import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { DashboardService } from '../services/dashboardService';
import { MonitoringService } from '../services/monitoringService';
import { AlertService } from '../services/alertService';
import logger from '../utils/logger';

const router = Router();
const dashboardService = new DashboardService();
const monitoringService = new MonitoringService();
const alertService = new AlertService();

// Production System Overview Dashboard
router.get('/overview', authenticate, async (req, res) => {
  try {
    const overview = await dashboardService.getSystemOverview();
    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    logger.error('Failed to get system overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system overview'
    });
  }
});

// Real-time System Health Dashboard
router.get('/health', authenticate, async (req, res) => {
  try {
    const services = [
      'gomflow-core',
      'gomflow-whatsapp',
      'gomflow-telegram',
      'gomflow-discord',
      'gomflow-payments',
      'gomflow-smart-agent',
      'gomflow-analytics',
      'gomflow-monitoring',
      'gomflow-security'
    ];

    const healthPromises = services.map(async (service) => {
      try {
        const health = await monitoringService.getServiceHealth(service);
        return {
          service,
          ...health
        };
      } catch (error) {
        return {
          service,
          status: 'unhealthy',
          error: error.message
        };
      }
    });

    const serviceHealth = await Promise.all(healthPromises);
    
    // Calculate overall system health
    const healthyServices = serviceHealth.filter(s => s.status === 'healthy').length;
    const totalServices = serviceHealth.length;
    const overallHealth = (healthyServices / totalServices) * 100;

    res.json({
      success: true,
      data: {
        overallHealth,
        healthyServices,
        totalServices,
        services: serviceHealth,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get health dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get health dashboard'
    });
  }
});

// Performance Metrics Dashboard
router.get('/performance', authenticate, async (req, res) => {
  try {
    const timeRange = req.query.timeRange as string || '1h';
    const service = req.query.service as string;

    let metrics;
    if (service) {
      metrics = await dashboardService.getServiceMetrics(service, timeRange);
    } else {
      // Get metrics for all services
      const services = [
        'gomflow-core',
        'gomflow-whatsapp',
        'gomflow-telegram',
        'gomflow-discord',
        'gomflow-payments',
        'gomflow-smart-agent',
        'gomflow-analytics',
        'gomflow-monitoring',
        'gomflow-security'
      ];

      const metricsPromises = services.map(async (svc) => {
        try {
          const svcMetrics = await dashboardService.getServiceMetrics(svc, timeRange);
          return {
            service: svc,
            metrics: svcMetrics
          };
        } catch (error) {
          return {
            service: svc,
            error: error.message
          };
        }
      });

      metrics = await Promise.all(metricsPromises);
    }

    res.json({
      success: true,
      data: {
        timeRange,
        metrics,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get performance metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get performance metrics'
    });
  }
});

// Alerts Dashboard
router.get('/alerts', authenticate, async (req, res) => {
  try {
    const status = req.query.status as string || 'active';
    const severity = req.query.severity as string;
    const service = req.query.service as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const alerts = await alertService.getAlerts({
      status,
      severity,
      service,
      limit
    });

    const alertCounts = await alertService.getAlertCounts();
    const alertTrends = await dashboardService.getAlertTrends('24h');

    res.json({
      success: true,
      data: {
        alerts,
        counts: alertCounts,
        trends: alertTrends,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get alerts dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get alerts dashboard'
    });
  }
});

// Service-specific Dashboard
router.get('/service/:serviceName', authenticate, async (req, res) => {
  try {
    const serviceName = req.params.serviceName;
    const timeRange = req.query.timeRange as string || '1h';

    const [health, metrics, alerts] = await Promise.all([
      monitoringService.getServiceHealth(serviceName),
      dashboardService.getServiceMetrics(serviceName, timeRange),
      alertService.getAlerts({ service: serviceName, limit: 10 })
    ]);

    res.json({
      success: true,
      data: {
        serviceName,
        health,
        metrics,
        alerts,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error(`Failed to get service dashboard for ${req.params.serviceName}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to get service dashboard'
    });
  }
});

// Infrastructure Dashboard
router.get('/infrastructure', authenticate, async (req, res) => {
  try {
    // Get infrastructure metrics
    const infrastructure = await monitoringService.getInfrastructureMetrics();
    
    // Get database metrics
    const database = await monitoringService.getDatabaseMetrics();
    
    // Get cache metrics
    const cache = await monitoringService.getCacheMetrics();
    
    // Get queue metrics
    const queues = await monitoringService.getQueueMetrics();

    res.json({
      success: true,
      data: {
        infrastructure,
        database,
        cache,
        queues,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get infrastructure dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get infrastructure dashboard'
    });
  }
});

// Security Dashboard
router.get('/security', authenticate, async (req, res) => {
  try {
    // Get security metrics (would integrate with security service)
    const securityMetrics = {
      threatLevel: 'low',
      vulnerabilities: {
        critical: 0,
        high: 0,
        medium: 2,
        low: 5
      },
      lastSecurityScan: new Date(),
      failedLoginAttempts: 12,
      blockedIPs: 3,
      complianceScore: 95
    };

    // Get security alerts
    const securityAlerts = await alertService.getAlerts({
      service: 'gomflow-security',
      limit: 20
    });

    res.json({
      success: true,
      data: {
        metrics: securityMetrics,
        alerts: securityAlerts,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get security dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get security dashboard'
    });
  }
});

// Analytics Dashboard
router.get('/analytics', authenticate, async (req, res) => {
  try {
    const timeRange = req.query.timeRange as string || '24h';
    
    // Get analytics metrics (would integrate with analytics service)
    const analyticsMetrics = {
      totalUsers: 1250,
      activeUsers: 320,
      totalOrders: 850,
      totalRevenue: 125000,
      averageOrderValue: 147.06,
      conversionRate: 3.2,
      topServices: [
        { service: 'gomflow-core', requests: 15000 },
        { service: 'gomflow-whatsapp', requests: 8500 },
        { service: 'gomflow-payments', requests: 5200 }
      ]
    };

    res.json({
      success: true,
      data: {
        timeRange,
        metrics: analyticsMetrics,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Failed to get analytics dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics dashboard'
    });
  }
});

// Real-time Dashboard Data (WebSocket endpoint info)
router.get('/websocket-info', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        websocketUrl: process.env.WEBSOCKET_URL || 'ws://localhost:3007',
        channels: [
          'system-health',
          'performance-metrics',
          'alerts',
          'security-events',
          'analytics-updates'
        ],
        updateInterval: 5000, // 5 seconds
        reconnectStrategy: 'exponential-backoff'
      }
    });
  } catch (error) {
    logger.error('Failed to get WebSocket info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get WebSocket info'
    });
  }
});

// Export Dashboard Configuration
router.get('/export', authenticate, async (req, res) => {
  try {
    const format = req.query.format as string || 'json';
    
    const dashboardConfig = {
      version: '1.0.0',
      generatedAt: new Date(),
      dashboards: [
        {
          name: 'System Overview',
          endpoint: '/production-dashboard/overview',
          refreshInterval: 30000
        },
        {
          name: 'Health Monitoring',
          endpoint: '/production-dashboard/health',
          refreshInterval: 5000
        },
        {
          name: 'Performance Metrics',
          endpoint: '/production-dashboard/performance',
          refreshInterval: 10000
        },
        {
          name: 'Alerts Management',
          endpoint: '/production-dashboard/alerts',
          refreshInterval: 15000
        },
        {
          name: 'Security Dashboard',
          endpoint: '/production-dashboard/security',
          refreshInterval: 30000
        },
        {
          name: 'Analytics Dashboard',
          endpoint: '/production-dashboard/analytics',
          refreshInterval: 60000
        }
      ]
    };

    if (format === 'json') {
      res.json({
        success: true,
        data: dashboardConfig
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Unsupported export format'
      });
    }
  } catch (error) {
    logger.error('Failed to export dashboard config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export dashboard config'
    });
  }
});

export default router;