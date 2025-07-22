import { createClient } from '@supabase/supabase-js';
import { createAdapter } from '@redis/client';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import { addDays, subDays, startOfDay, endOfDay, format } from 'date-fns';
import { groupBy, sumBy, meanBy, countBy } from 'lodash';

import config from '../config';
import logger from '../utils/logger';
import {
  AnalyticsEvent,
  AnalyticsEventType,
  AnalyticsMetrics,
  TimeSeriesData,
  ReportFilter,
  ReportConfig,
  AlertConfig,
  ExportRequest,
  ExportJob,
  AnalyticsServiceInterface,
  RealTimeMetrics,
  CohortAnalysis,
  FunnelAnalysis,
  SegmentAnalysis,
  PredictiveInsight,
  DashboardWidget
} from '../types';

export class AnalyticsService implements AnalyticsServiceInterface {
  private supabase: any;
  private redis: any;
  private eventQueue: Queue;
  private aggregationQueue: Queue;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize Supabase client
      this.supabase = createClient(
        config.SUPABASE_URL,
        config.SUPABASE_SERVICE_ROLE_KEY
      );

      // Initialize Redis client
      if (config.REDIS_URL) {
        this.redis = createAdapter({ url: config.REDIS_URL });
      } else {
        this.redis = createAdapter({
          socket: {
            host: config.REDIS_HOST,
            port: config.REDIS_PORT
          },
          password: config.REDIS_PASSWORD
        });
      }

      await this.redis.connect();

      // Initialize Bull queues
      this.eventQueue = new Queue('analytics-events', {
        redis: {
          host: config.REDIS_HOST,
          port: config.REDIS_PORT,
          password: config.REDIS_PASSWORD
        }
      });

      this.aggregationQueue = new Queue('analytics-aggregation', {
        redis: {
          host: config.REDIS_HOST,
          port: config.REDIS_PORT,
          password: config.REDIS_PASSWORD
        }
      });

      // Setup queue processors
      this.setupQueueProcessors();

      this.initialized = true;
      logger.info('Analytics service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize analytics service:', error);
      throw error;
    }
  }

  private setupQueueProcessors(): void {
    // Process analytics events
    this.eventQueue.process('track-event', async (job) => {
      const event: AnalyticsEvent = job.data;
      await this.persistEvent(event);
    });

    // Process aggregations
    this.aggregationQueue.process('aggregate-metrics', async (job) => {
      const { timeRange, metrics } = job.data;
      await this.performAggregation(timeRange, metrics);
    });
  }

  // Core Analytics Methods
  public async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Analytics service not initialized');
      }

      // Add event to queue for processing
      await this.eventQueue.add('track-event', event, {
        attempts: 3,
        backoff: 'exponential',
        delay: 0
      });

      // Cache real-time metrics
      await this.updateRealTimeMetrics(event);

      logger.debug('Analytics event tracked', {
        type: event.type,
        userId: event.userId,
        orderId: event.orderId
      });
    } catch (error) {
      logger.error('Failed to track analytics event:', error);
      throw error;
    }
  }

  public async getMetrics(filters: ReportFilter): Promise<AnalyticsMetrics> {
    try {
      const { startDate, endDate, userId, country, platform } = filters;

      // Build query conditions
      let query = this.supabase
        .from('analytics_events')
        .select('*');

      if (startDate) query = query.gte('created_at', startDate.toISOString());
      if (endDate) query = query.lte('created_at', endDate.toISOString());
      if (userId) query = query.eq('user_id', userId);
      if (country) query = query.eq('country', country);
      if (platform) query = query.eq('platform', platform);

      const { data: events, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch analytics events: ${error.message}`);
      }

      // Calculate metrics from events
      const metrics = await this.calculateMetrics(events || []);

      return metrics;
    } catch (error) {
      logger.error('Failed to get analytics metrics:', error);
      throw error;
    }
  }

  public async getTimeSeries(metric: string, filters: ReportFilter): Promise<TimeSeriesData[]> {
    try {
      const { startDate, endDate } = filters;
      const start = startDate || subDays(new Date(), 30);
      const end = endDate || new Date();

      // Query aggregated data
      const { data: aggregations, error } = await this.supabase
        .from('analytics_aggregations')
        .select('*')
        .eq('metric_name', metric)
        .gte('time_bucket', start.toISOString())
        .lte('time_bucket', end.toISOString())
        .order('time_bucket', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch time series data: ${error.message}`);
      }

      return (aggregations || []).map(agg => ({
        timestamp: new Date(agg.time_bucket),
        value: agg.metric_value,
        metadata: agg.dimensions
      }));
    } catch (error) {
      logger.error('Failed to get time series data:', error);
      throw error;
    }
  }

  public async generateReport(config: ReportConfig): Promise<any> {
    try {
      const metrics = await this.getMetrics(config.filters);
      const timeSeries = await Promise.all(
        config.metrics.map(metric => this.getTimeSeries(metric, config.filters))
      );

      const report = {
        id: config.id,
        name: config.name,
        description: config.description,
        generatedAt: new Date(),
        filters: config.filters,
        metrics,
        timeSeries: config.metrics.reduce((acc, metric, index) => {
          acc[metric] = timeSeries[index];
          return acc;
        }, {} as Record<string, TimeSeriesData[]>)
      };

      // Store report in database
      await this.supabase
        .from('analytics_reports')
        .insert({
          id: uuidv4(),
          config_id: config.id,
          report_data: report,
          created_at: new Date().toISOString()
        });

      return report;
    } catch (error) {
      logger.error('Failed to generate report:', error);
      throw error;
    }
  }

  public async createAlert(config: AlertConfig): Promise<AlertConfig> {
    try {
      const { data, error } = await this.supabase
        .from('analytics_alerts')
        .insert({
          id: config.id,
          name: config.name,
          description: config.description,
          metric: config.metric,
          condition: config.condition,
          threshold: config.threshold,
          time_window: config.timeWindow,
          is_active: config.isActive,
          recipients: config.recipients,
          channels: config.channels,
          webhook_url: config.webhookUrl,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create alert: ${error.message}`);
      }

      return data;
    } catch (error) {
      logger.error('Failed to create alert:', error);
      throw error;
    }
  }

  public async exportData(request: ExportRequest): Promise<ExportJob> {
    try {
      const jobId = uuidv4();
      const job: ExportJob = {
        id: jobId,
        status: 'pending',
        request,
        createdAt: new Date(),
        downloadCount: 0,
        expiresAt: addDays(new Date(), 7) // Expire after 7 days
      };

      // Store export job
      await this.supabase
        .from('analytics_export_jobs')
        .insert({
          id: jobId,
          status: job.status,
          request_data: request,
          created_at: job.createdAt.toISOString(),
          expires_at: job.expiresAt.toISOString()
        });

      // Queue export processing
      await this.eventQueue.add('process-export', { jobId, request }, {
        attempts: 3,
        backoff: 'exponential'
      });

      return job;
    } catch (error) {
      logger.error('Failed to create export job:', error);
      throw error;
    }
  }

  // Advanced Analytics Methods
  public async getCohortAnalysis(
    period: 'daily' | 'weekly' | 'monthly',
    metric: 'retention' | 'revenue' | 'orders'
  ): Promise<CohortAnalysis> {
    try {
      // Implementation for cohort analysis
      const { data: users, error } = await this.supabase
        .from('users')
        .select('id, created_at')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group users by cohort periods
      const cohorts = groupBy(users, user => {
        const date = new Date(user.created_at);
        switch (period) {
          case 'daily':
            return format(date, 'yyyy-MM-dd');
          case 'weekly':
            return format(startOfDay(date), 'yyyy-MM-dd');
          case 'monthly':
            return format(date, 'yyyy-MM');
          default:
            return format(date, 'yyyy-MM-dd');
        }
      });

      // Calculate cohort metrics
      const cohortData = await Promise.all(
        Object.entries(cohorts).map(async ([cohortDate, cohortUsers]) => {
          const periods = await this.calculateCohortPeriods(
            cohortUsers,
            new Date(cohortDate),
            period,
            metric
          );

          return {
            cohortDate: new Date(cohortDate),
            cohortSize: cohortUsers.length,
            periods
          };
        })
      );

      return {
        period,
        metric,
        cohorts: cohortData
      };
    } catch (error) {
      logger.error('Failed to generate cohort analysis:', error);
      throw error;
    }
  }

  public async getFunnelAnalysis(eventTypes: AnalyticsEventType[]): Promise<FunnelAnalysis> {
    try {
      const funnelSteps = await Promise.all(
        eventTypes.map(async (eventType, index) => {
          const { data: events, error } = await this.supabase
            .from('analytics_events')
            .select('user_id')
            .eq('event_type', eventType)
            .gte('created_at', subDays(new Date(), 30).toISOString());

          if (error) throw error;

          const uniqueUsers = new Set(events.map(e => e.user_id)).size;
          const previousStepUsers = index > 0 ? 
            await this.getUniqueUsersForEvent(eventTypes[index - 1]) : 
            uniqueUsers;

          return {
            name: eventType,
            eventType,
            users: uniqueUsers,
            conversionRate: previousStepUsers > 0 ? (uniqueUsers / previousStepUsers) * 100 : 100,
            dropoffRate: previousStepUsers > 0 ? ((previousStepUsers - uniqueUsers) / previousStepUsers) * 100 : 0
          };
        })
      );

      const totalConversionRate = funnelSteps.length > 0 ? 
        (funnelSteps[funnelSteps.length - 1].users / funnelSteps[0].users) * 100 : 0;

      return {
        name: 'User Journey Funnel',
        steps: funnelSteps,
        totalConversionRate
      };
    } catch (error) {
      logger.error('Failed to generate funnel analysis:', error);
      throw error;
    }
  }

  public async getSegmentAnalysis(segmentName: string, criteria: Record<string, any>): Promise<SegmentAnalysis> {
    try {
      // Get users matching segment criteria
      let userQuery = this.supabase.from('users').select('id');
      
      Object.entries(criteria).forEach(([key, value]) => {
        userQuery = userQuery.eq(key, value);
      });

      const { data: users, error } = await userQuery;
      if (error) throw error;

      const userIds = users.map(u => u.id);

      // Get metrics for this segment
      const metrics = await this.getMetrics({
        userId: userIds.length === 1 ? userIds[0] : undefined,
        // For multiple users, we'd need to modify getMetrics to handle arrays
      });

      // Get trends for this segment
      const trends = await this.getTimeSeries('active_users', {
        startDate: subDays(new Date(), 30),
        endDate: new Date()
      });

      return {
        segmentName,
        criteria,
        userCount: userIds.length,
        metrics,
        trends
      };
    } catch (error) {
      logger.error('Failed to generate segment analysis:', error);
      throw error;
    }
  }

  public async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    try {
      // Get cached real-time metrics
      const cached = await this.redis.get('realtime_metrics');
      if (cached) {
        return JSON.parse(cached);
      }

      // Calculate real-time metrics
      const now = new Date();
      const oneHourAgo = subDays(now, 0);
      oneHourAgo.setHours(now.getHours() - 1);

      const [activeUsers, ordersInProgress, submissions, revenue] = await Promise.all([
        this.getActiveUsersCount(oneHourAgo),
        this.getOrdersInProgressCount(),
        this.getSubmissionsPerMinute(),
        this.getRevenueTodayTotal()
      ]);

      const metrics: RealTimeMetrics = {
        activeUsers,
        ordersInProgress,
        submissionsPerMinute: submissions,
        revenueToday: revenue,
        errorRate: 0, // TODO: Implement error rate calculation
        responseTime: 0, // TODO: Implement response time calculation
        timestamp: now
      };

      // Cache for 1 minute
      await this.redis.setex('realtime_metrics', 60, JSON.stringify(metrics));

      return metrics;
    } catch (error) {
      logger.error('Failed to get real-time metrics:', error);
      throw error;
    }
  }

  // Helper Methods
  private async persistEvent(event: AnalyticsEvent): Promise<void> {
    try {
      await this.supabase
        .from('analytics_events')
        .insert({
          id: event.id,
          event_type: event.type,
          user_id: event.userId,
          order_id: event.orderId,
          submission_id: event.submissionId,
          guild_id: event.guildId,
          platform: event.platform,
          country: event.country,
          currency: event.currency,
          event_data: event.data,
          session_id: event.sessionId,
          user_agent: event.userAgent,
          ip_address: event.ipAddress,
          created_at: event.timestamp.toISOString()
        });
    } catch (error) {
      logger.error('Failed to persist analytics event:', error);
      throw error;
    }
  }

  private async updateRealTimeMetrics(event: AnalyticsEvent): Promise<void> {
    try {
      // Update various real-time counters based on event type
      const key = `realtime_${event.type}`;
      await this.redis.incr(key);
      await this.redis.expire(key, 300); // Expire after 5 minutes
    } catch (error) {
      logger.error('Failed to update real-time metrics:', error);
    }
  }

  private async calculateMetrics(events: any[]): Promise<AnalyticsMetrics> {
    // Group events by type
    const eventsByType = groupBy(events, 'event_type');

    // Calculate order metrics
    const orderEvents = eventsByType[AnalyticsEventType.ORDER_CREATED] || [];
    const completedOrders = eventsByType[AnalyticsEventType.ORDER_COMPLETED] || [];
    const cancelledOrders = eventsByType[AnalyticsEventType.ORDER_CANCELLED] || [];

    // Calculate submission metrics
    const submissionEvents = eventsByType[AnalyticsEventType.SUBMISSION_CREATED] || [];
    const verifiedSubmissions = eventsByType[AnalyticsEventType.SUBMISSION_PAYMENT_VERIFIED] || [];
    const rejectedSubmissions = eventsByType[AnalyticsEventType.SUBMISSION_PAYMENT_REJECTED] || [];

    // Calculate user metrics
    const userEvents = eventsByType[AnalyticsEventType.USER_REGISTERED] || [];
    const loginEvents = eventsByType[AnalyticsEventType.USER_LOGIN] || [];

    return {
      totalOrders: orderEvents.length,
      activeOrders: orderEvents.length - completedOrders.length - cancelledOrders.length,
      completedOrders: completedOrders.length,
      cancelledOrders: cancelledOrders.length,
      averageOrderValue: 0, // TODO: Calculate from order data
      totalRevenue: 0, // TODO: Calculate from order data
      
      totalSubmissions: submissionEvents.length,
      pendingSubmissions: submissionEvents.length - verifiedSubmissions.length - rejectedSubmissions.length,
      verifiedSubmissions: verifiedSubmissions.length,
      rejectedSubmissions: rejectedSubmissions.length,
      conversionRate: submissionEvents.length > 0 ? (verifiedSubmissions.length / submissionEvents.length) * 100 : 0,
      averageSubmissionTime: 0, // TODO: Calculate from submission data
      
      totalUsers: userEvents.length,
      activeUsers: new Set(loginEvents.map(e => e.user_id)).size,
      newUsers: userEvents.length,
      returnUsers: loginEvents.length - userEvents.length,
      
      platformUsage: countBy(events, 'platform'),
      countryDistribution: countBy(events, 'country'),
      paymentMethodUsage: {}, // TODO: Extract from submission data
      
      averageResponseTime: 0, // TODO: Calculate from performance data
      errorRate: 0, // TODO: Calculate from error events
      uptimePercentage: 100 // TODO: Calculate from uptime data
    };
  }

  private async performAggregation(timeRange: Date[], metrics: string[]): Promise<void> {
    try {
      // Implementation for metric aggregation
      logger.info('Performing metric aggregation', { timeRange, metrics });
      
      // This would aggregate raw events into time-bucketed metrics
      // for faster querying of historical data
    } catch (error) {
      logger.error('Failed to perform aggregation:', error);
      throw error;
    }
  }

  private async calculateCohortPeriods(
    users: any[],
    cohortDate: Date,
    period: string,
    metric: string
  ): Promise<number[]> {
    // Implementation for cohort period calculation
    return [];
  }

  private async getUniqueUsersForEvent(eventType: AnalyticsEventType): Promise<number> {
    const { data: events, error } = await this.supabase
      .from('analytics_events')
      .select('user_id')
      .eq('event_type', eventType)
      .gte('created_at', subDays(new Date(), 30).toISOString());

    if (error) throw error;

    return new Set(events.map(e => e.user_id)).size;
  }

  private async getActiveUsersCount(since: Date): Promise<number> {
    const { data: events, error } = await this.supabase
      .from('analytics_events')
      .select('user_id')
      .gte('created_at', since.toISOString());

    if (error) throw error;

    return new Set(events.map(e => e.user_id)).size;
  }

  private async getOrdersInProgressCount(): Promise<number> {
    const { data: orders, error } = await this.supabase
      .from('orders')
      .select('id')
      .eq('status', 'active');

    if (error) throw error;

    return orders.length;
  }

  private async getSubmissionsPerMinute(): Promise<number> {
    const oneMinuteAgo = new Date(Date.now() - 60000);
    
    const { data: submissions, error } = await this.supabase
      .from('submissions')
      .select('id')
      .gte('created_at', oneMinuteAgo.toISOString());

    if (error) throw error;

    return submissions.length;
  }

  private async getRevenueTodayTotal(): Promise<number> {
    const today = startOfDay(new Date());
    
    const { data: submissions, error } = await this.supabase
      .from('submissions')
      .select('order_id, quantity')
      .eq('payment_status', 'confirmed')
      .gte('created_at', today.toISOString());

    if (error) throw error;

    // TODO: Calculate actual revenue from orders and submissions
    return 0;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}

export default AnalyticsService;