import { Router } from 'express';
import { z } from 'zod';
import { AnalyticsService } from '../services/analyticsService';
import { DataPipelineService } from '../services/dataPipelineService';
import { AnalyticsEventType, ReportFilter } from '../types';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import logger from '../utils/logger';

const router = Router();

// Initialize services
const analyticsService = new AnalyticsService();
const dataPipelineService = new DataPipelineService();

// Validation schemas
const trackEventSchema = z.object({
  type: z.nativeEnum(AnalyticsEventType),
  userId: z.string().optional(),
  orderId: z.string().optional(),
  submissionId: z.string().optional(),
  guildId: z.string().optional(),
  platform: z.enum(['web', 'mobile', 'discord', 'telegram', 'whatsapp']).optional(),
  country: z.enum(['PH', 'MY']).optional(),
  currency: z.enum(['PHP', 'MYR']).optional(),
  data: z.record(z.any()).default({}),
  sessionId: z.string().optional(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional()
});

const getMetricsSchema = z.object({
  startDate: z.string().optional().transform(date => date ? new Date(date) : undefined),
  endDate: z.string().optional().transform(date => date ? new Date(date) : undefined),
  userId: z.string().optional(),
  orderId: z.string().optional(),
  country: z.enum(['PH', 'MY']).optional(),
  platform: z.string().optional(),
  eventType: z.nativeEnum(AnalyticsEventType).optional()
});

const getTimeSeriesSchema = z.object({
  metric: z.string(),
  startDate: z.string().optional().transform(date => date ? new Date(date) : undefined),
  endDate: z.string().optional().transform(date => date ? new Date(date) : undefined),
  userId: z.string().optional(),
  country: z.enum(['PH', 'MY']).optional(),
  platform: z.string().optional()
});

const createAlertSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  metric: z.string(),
  condition: z.enum(['above', 'below', 'equals', 'changes_by']),
  threshold: z.number(),
  timeWindow: z.number(),
  recipients: z.array(z.string()),
  channels: z.array(z.enum(['email', 'slack', 'webhook'])),
  webhookUrl: z.string().optional()
});

const exportDataSchema = z.object({
  format: z.enum(['csv', 'json', 'excel', 'pdf']),
  reportType: z.enum(['orders', 'submissions', 'users', 'analytics', 'custom']),
  filters: z.object({
    startDate: z.string().optional().transform(date => date ? new Date(date) : undefined),
    endDate: z.string().optional().transform(date => date ? new Date(date) : undefined),
    userId: z.string().optional(),
    orderId: z.string().optional(),
    country: z.enum(['PH', 'MY']).optional(),
    platform: z.string().optional(),
    eventType: z.nativeEnum(AnalyticsEventType).optional()
  }),
  columns: z.array(z.string()).optional(),
  email: z.string().email().optional()
});

// Routes

// Track analytics event
router.post('/events', 
  authMiddleware,
  validateRequest(trackEventSchema),
  async (req, res) => {
    try {
      const eventData = req.body;
      const event = {
        id: `${Date.now()}-${Math.random()}`,
        type: eventData.type,
        timestamp: new Date(),
        userId: eventData.userId,
        orderId: eventData.orderId,
        submissionId: eventData.submissionId,
        guildId: eventData.guildId,
        platform: eventData.platform,
        country: eventData.country,
        currency: eventData.currency,
        data: eventData.data,
        sessionId: eventData.sessionId,
        userAgent: eventData.userAgent,
        ipAddress: eventData.ipAddress
      };

      await analyticsService.trackEvent(event);

      res.status(201).json({
        success: true,
        data: { eventId: event.id },
        message: 'Event tracked successfully'
      });
    } catch (error) {
      logger.error('Failed to track event:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to track event',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Get analytics metrics
router.get('/metrics',
  authMiddleware,
  validateRequest(getMetricsSchema, 'query'),
  async (req, res) => {
    try {
      const filters = req.query as any;
      const metrics = await analyticsService.getMetrics(filters);

      res.json({
        success: true,
        data: metrics,
        metadata: {
          filters,
          generatedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to get metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Get time series data
router.get('/timeseries',
  authMiddleware,
  validateRequest(getTimeSeriesSchema, 'query'),
  async (req, res) => {
    try {
      const { metric, ...filters } = req.query as any;
      const timeSeries = await analyticsService.getTimeSeries(metric, filters);

      res.json({
        success: true,
        data: timeSeries,
        metadata: {
          metric,
          filters,
          generatedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to get time series:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get time series',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Get real-time metrics
router.get('/realtime',
  authMiddleware,
  async (req, res) => {
    try {
      const metrics = await analyticsService.getRealTimeMetrics();

      res.json({
        success: true,
        data: metrics,
        metadata: {
          generatedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to get real-time metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get real-time metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Get cohort analysis
router.get('/cohort',
  authMiddleware,
  async (req, res) => {
    try {
      const { period = 'monthly', metric = 'retention' } = req.query;
      const cohortAnalysis = await analyticsService.getCohortAnalysis(
        period as 'daily' | 'weekly' | 'monthly',
        metric as 'retention' | 'revenue' | 'orders'
      );

      res.json({
        success: true,
        data: cohortAnalysis,
        metadata: {
          period,
          metric,
          generatedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to get cohort analysis:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cohort analysis',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Get funnel analysis
router.post('/funnel',
  authMiddleware,
  async (req, res) => {
    try {
      const { eventTypes } = req.body;
      
      if (!Array.isArray(eventTypes) || eventTypes.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid event types',
          message: 'eventTypes must be a non-empty array'
        });
      }

      const funnelAnalysis = await analyticsService.getFunnelAnalysis(eventTypes);

      res.json({
        success: true,
        data: funnelAnalysis,
        metadata: {
          eventTypes,
          generatedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to get funnel analysis:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get funnel analysis',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Get segment analysis
router.post('/segment',
  authMiddleware,
  async (req, res) => {
    try {
      const { segmentName, criteria } = req.body;
      
      if (!segmentName || !criteria) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'segmentName and criteria are required'
        });
      }

      const segmentAnalysis = await analyticsService.getSegmentAnalysis(segmentName, criteria);

      res.json({
        success: true,
        data: segmentAnalysis,
        metadata: {
          segmentName,
          criteria,
          generatedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to get segment analysis:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get segment analysis',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Create alert
router.post('/alerts',
  authMiddleware,
  validateRequest(createAlertSchema),
  async (req, res) => {
    try {
      const alertData = req.body;
      const alertConfig = {
        id: `alert-${Date.now()}-${Math.random()}`,
        ...alertData,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const createdAlert = await analyticsService.createAlert(alertConfig);

      res.status(201).json({
        success: true,
        data: createdAlert,
        message: 'Alert created successfully'
      });
    } catch (error) {
      logger.error('Failed to create alert:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create alert',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Export data
router.post('/export',
  authMiddleware,
  validateRequest(exportDataSchema),
  async (req, res) => {
    try {
      const exportRequest = req.body;
      const exportJob = await analyticsService.exportData(exportRequest);

      res.status(201).json({
        success: true,
        data: exportJob,
        message: 'Export job created successfully'
      });
    } catch (error) {
      logger.error('Failed to create export job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create export job',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Get export status
router.get('/export/:jobId',
  authMiddleware,
  async (req, res) => {
    try {
      const { jobId } = req.params;
      
      // Query export job status from database
      const { data: exportJob, error } = await analyticsService.supabase
        .from('analytics_export_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        return res.status(404).json({
          success: false,
          error: 'Export job not found',
          message: error.message
        });
      }

      res.json({
        success: true,
        data: {
          id: exportJob.id,
          status: exportJob.status,
          fileUrl: exportJob.file_url,
          createdAt: exportJob.created_at,
          completedAt: exportJob.completed_at,
          downloadCount: exportJob.download_count,
          expiresAt: exportJob.expires_at
        }
      });
    } catch (error) {
      logger.error('Failed to get export status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get export status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Health check
router.get('/health',
  async (req, res) => {
    try {
      const isAnalyticsReady = analyticsService.isInitialized();
      const isPipelineReady = dataPipelineService.isInitialized();

      res.json({
        success: true,
        data: {
          status: 'healthy',
          services: {
            analytics: isAnalyticsReady ? 'ready' : 'not ready',
            pipeline: isPipelineReady ? 'ready' : 'not ready'
          },
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;