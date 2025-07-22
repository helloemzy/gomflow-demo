import { createClient } from '@supabase/supabase-js';
import { createAdapter } from '@redis/client';
import { Queue, Job } from 'bull';
import { subDays, startOfHour, startOfDay, startOfWeek, startOfMonth, format } from 'date-fns';
import { groupBy, sumBy, meanBy, countBy, uniqBy } from 'lodash';
import cron from 'node-cron';

import config from '../config';
import logger from '../utils/logger';
import {
  AnalyticsEvent,
  AnalyticsEventType,
  DataPipelineInterface,
  AnalyticsAggregationModel,
  TimeSeriesData
} from '../types';

export class DataPipelineService implements DataPipelineInterface {
  private supabase: any;
  private redis: any;
  private processingQueue: Queue;
  private initialized = false;
  private cronJobs: cron.ScheduledTask[] = [];

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

      // Initialize processing queue
      this.processingQueue = new Queue('data-pipeline', {
        redis: {
          host: config.REDIS_HOST,
          port: config.REDIS_PORT,
          password: config.REDIS_PASSWORD
        }
      });

      // Setup queue processors
      this.setupQueueProcessors();

      // Setup cron jobs
      this.setupCronJobs();

      this.initialized = true;
      logger.info('Data pipeline service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize data pipeline service:', error);
      throw error;
    }
  }

  private setupQueueProcessors(): void {
    // Process batch events
    this.processingQueue.process('process-batch-events', async (job: Job) => {
      const { events } = job.data;
      await this.processBatchEvents(events);
    });

    // Aggregate metrics
    this.processingQueue.process('aggregate-metrics', async (job: Job) => {
      const { timeRange, bucketSize } = job.data;
      await this.aggregateMetricsForTimeRange(timeRange, bucketSize);
    });

    // Cleanup old data
    this.processingQueue.process('cleanup-old-data', async (job: Job) => {
      const { retentionDays } = job.data;
      await this.cleanupOldData(retentionDays);
    });

    // Generate derived metrics
    this.processingQueue.process('generate-derived-metrics', async (job: Job) => {
      const { timeRange } = job.data;
      await this.generateDerivedMetrics(timeRange);
    });
  }

  private setupCronJobs(): void {
    // Aggregate metrics every 5 minutes
    const aggregationJob = cron.schedule(config.ANALYTICS_AGGREGATION_INTERVAL, async () => {
      await this.scheduleAggregation();
    });

    // Cleanup old data daily
    const cleanupJob = cron.schedule(config.ANALYTICS_CLEANUP_INTERVAL, async () => {
      await this.scheduleCleanup();
    });

    // Generate derived metrics hourly
    const derivedMetricsJob = cron.schedule('0 * * * *', async () => {
      await this.scheduleDerivedMetrics();
    });

    this.cronJobs = [aggregationJob, cleanupJob, derivedMetricsJob];
    logger.info('Cron jobs scheduled for data pipeline');
  }

  // Public Methods
  public async processEvents(events: AnalyticsEvent[]): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Data pipeline service not initialized');
      }

      // Queue events for batch processing
      await this.processingQueue.add('process-batch-events', 
        { events }, 
        { 
          attempts: 3,
          backoff: 'exponential',
          removeOnComplete: 100,
          removeOnFail: 50
        }
      );

      logger.debug('Queued events for processing', { count: events.length });
    } catch (error) {
      logger.error('Failed to process events:', error);
      throw error;
    }
  }

  public async aggregateMetrics(timeRange: Date[]): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Data pipeline service not initialized');
      }

      // Queue aggregation for different time buckets
      const bucketSizes = ['minute', 'hour', 'day', 'week', 'month'];
      
      for (const bucketSize of bucketSizes) {
        await this.processingQueue.add('aggregate-metrics', 
          { timeRange, bucketSize },
          {
            attempts: 2,
            backoff: 'exponential',
            removeOnComplete: 50,
            removeOnFail: 25
          }
        );
      }

      logger.info('Queued metric aggregation', { timeRange, bucketSizes });
    } catch (error) {
      logger.error('Failed to aggregate metrics:', error);
      throw error;
    }
  }

  public async cleanupOldData(retentionDays: number): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Data pipeline service not initialized');
      }

      await this.processingQueue.add('cleanup-old-data', 
        { retentionDays },
        {
          attempts: 2,
          backoff: 'exponential',
          removeOnComplete: 10,
          removeOnFail: 10
        }
      );

      logger.info('Queued data cleanup', { retentionDays });
    } catch (error) {
      logger.error('Failed to cleanup old data:', error);
      throw error;
    }
  }

  // Private Processing Methods
  private async processBatchEvents(events: AnalyticsEvent[]): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Process events in batches to avoid overwhelming the database
      const batchSize = 100;
      const batches = [];
      
      for (let i = 0; i < events.length; i += batchSize) {
        batches.push(events.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        await this.processBatch(batch);
      }

      // Update processing metrics
      await this.updateProcessingMetrics(events.length, Date.now() - startTime);

      logger.info('Processed batch events', {
        eventCount: events.length,
        batchCount: batches.length,
        processingTime: Date.now() - startTime
      });
    } catch (error) {
      logger.error('Failed to process batch events:', error);
      throw error;
    }
  }

  private async processBatch(events: AnalyticsEvent[]): Promise<void> {
    try {
      // Validate and transform events
      const validEvents = events.filter(event => this.validateEvent(event));
      
      if (validEvents.length === 0) {
        logger.warn('No valid events in batch');
        return;
      }

      // Store events in database
      const eventRecords = validEvents.map(event => ({
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
      }));

      const { error } = await this.supabase
        .from('analytics_events')
        .insert(eventRecords);

      if (error) {
        throw new Error(`Failed to insert events: ${error.message}`);
      }

      // Update real-time counters
      await this.updateRealTimeCounters(validEvents);

      // Trigger immediate aggregation for critical metrics
      await this.triggerImmediateAggregation(validEvents);

    } catch (error) {
      logger.error('Failed to process event batch:', error);
      throw error;
    }
  }

  private async aggregateMetricsForTimeRange(
    timeRange: Date[], 
    bucketSize: 'minute' | 'hour' | 'day' | 'week' | 'month'
  ): Promise<void> {
    try {
      const [startDate, endDate] = timeRange;
      
      // Get events for the time range
      const { data: events, error } = await this.supabase
        .from('analytics_events')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString());

      if (error) {
        throw new Error(`Failed to fetch events: ${error.message}`);
      }

      if (!events || events.length === 0) {
        logger.debug('No events found for aggregation', { timeRange, bucketSize });
        return;
      }

      // Group events by time bucket
      const timeBuckets = this.groupEventsByTimeBucket(events, bucketSize);

      // Calculate aggregations for each bucket
      const aggregations: AnalyticsAggregationModel[] = [];

      for (const [timeBucket, bucketEvents] of Object.entries(timeBuckets)) {
        const bucketAggregations = await this.calculateBucketAggregations(
          bucketEvents,
          new Date(timeBucket),
          bucketSize
        );
        aggregations.push(...bucketAggregations);
      }

      // Store aggregations
      if (aggregations.length > 0) {
        await this.storeAggregations(aggregations);
      }

      logger.info('Completed metric aggregation', {
        timeRange,
        bucketSize,
        eventCount: events.length,
        aggregationCount: aggregations.length
      });
    } catch (error) {
      logger.error('Failed to aggregate metrics for time range:', error);
      throw error;
    }
  }

  private groupEventsByTimeBucket(
    events: any[], 
    bucketSize: 'minute' | 'hour' | 'day' | 'week' | 'month'
  ): Record<string, any[]> {
    return groupBy(events, event => {
      const timestamp = new Date(event.created_at);
      
      switch (bucketSize) {
        case 'minute':
          return format(timestamp, 'yyyy-MM-dd HH:mm:00');
        case 'hour':
          return format(startOfHour(timestamp), 'yyyy-MM-dd HH:00:00');
        case 'day':
          return format(startOfDay(timestamp), 'yyyy-MM-dd 00:00:00');
        case 'week':
          return format(startOfWeek(timestamp), 'yyyy-MM-dd 00:00:00');
        case 'month':
          return format(startOfMonth(timestamp), 'yyyy-MM-01 00:00:00');
        default:
          return format(startOfHour(timestamp), 'yyyy-MM-dd HH:00:00');
      }
    });
  }

  private async calculateBucketAggregations(
    events: any[],
    timeBucket: Date,
    bucketSize: 'minute' | 'hour' | 'day' | 'week' | 'month'
  ): Promise<AnalyticsAggregationModel[]> {
    const aggregations: AnalyticsAggregationModel[] = [];

    // Group events by type
    const eventsByType = groupBy(events, 'event_type');

    // Calculate basic event counts
    for (const [eventType, typeEvents] of Object.entries(eventsByType)) {
      aggregations.push({
        id: `${eventType}_count_${timeBucket.getTime()}`,
        metric_name: `${eventType}_count`,
        metric_value: typeEvents.length,
        dimensions: { event_type: eventType },
        time_bucket: timeBucket,
        bucket_size: bucketSize,
        created_at: new Date()
      });
    }

    // Calculate unique user counts
    const uniqueUsers = uniqBy(events, 'user_id').length;
    aggregations.push({
      id: `unique_users_${timeBucket.getTime()}`,
      metric_name: 'unique_users',
      metric_value: uniqueUsers,
      dimensions: {},
      time_bucket: timeBucket,
      bucket_size: bucketSize,
      created_at: new Date()
    });

    // Calculate platform distribution
    const platformCounts = countBy(events, 'platform');
    for (const [platform, count] of Object.entries(platformCounts)) {
      aggregations.push({
        id: `platform_${platform}_${timeBucket.getTime()}`,
        metric_name: 'platform_usage',
        metric_value: count,
        dimensions: { platform },
        time_bucket: timeBucket,
        bucket_size: bucketSize,
        created_at: new Date()
      });
    }

    // Calculate country distribution
    const countryCounts = countBy(events, 'country');
    for (const [country, count] of Object.entries(countryCounts)) {
      if (country && country !== 'undefined') {
        aggregations.push({
          id: `country_${country}_${timeBucket.getTime()}`,
          metric_name: 'country_distribution',
          metric_value: count,
          dimensions: { country },
          time_bucket: timeBucket,
          bucket_size: bucketSize,
          created_at: new Date()
        });
      }
    }

    // Calculate conversion metrics
    const submissions = events.filter(e => e.event_type === AnalyticsEventType.SUBMISSION_CREATED);
    const verifications = events.filter(e => e.event_type === AnalyticsEventType.SUBMISSION_PAYMENT_VERIFIED);
    
    if (submissions.length > 0) {
      const conversionRate = (verifications.length / submissions.length) * 100;
      aggregations.push({
        id: `conversion_rate_${timeBucket.getTime()}`,
        metric_name: 'conversion_rate',
        metric_value: conversionRate,
        dimensions: {},
        time_bucket: timeBucket,
        bucket_size: bucketSize,
        created_at: new Date()
      });
    }

    return aggregations;
  }

  private async storeAggregations(aggregations: AnalyticsAggregationModel[]): Promise<void> {
    try {
      // Use upsert to handle potential duplicates
      const { error } = await this.supabase
        .from('analytics_aggregations')
        .upsert(aggregations, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        });

      if (error) {
        throw new Error(`Failed to store aggregations: ${error.message}`);
      }
    } catch (error) {
      logger.error('Failed to store aggregations:', error);
      throw error;
    }
  }

  private async generateDerivedMetrics(timeRange: Date[]): Promise<void> {
    try {
      const [startDate, endDate] = timeRange;
      
      // Calculate complex derived metrics
      await Promise.all([
        this.calculateRetentionMetrics(startDate, endDate),
        this.calculateRevenueMetrics(startDate, endDate),
        this.calculateEngagementMetrics(startDate, endDate),
        this.calculatePerformanceMetrics(startDate, endDate)
      ]);

      logger.info('Generated derived metrics', { timeRange });
    } catch (error) {
      logger.error('Failed to generate derived metrics:', error);
      throw error;
    }
  }

  private async calculateRetentionMetrics(startDate: Date, endDate: Date): Promise<void> {
    // Implementation for retention metrics calculation
    // This would involve cohort analysis and user return patterns
    logger.debug('Calculating retention metrics', { startDate, endDate });
  }

  private async calculateRevenueMetrics(startDate: Date, endDate: Date): Promise<void> {
    // Implementation for revenue metrics calculation
    // This would involve order values and payment confirmations
    logger.debug('Calculating revenue metrics', { startDate, endDate });
  }

  private async calculateEngagementMetrics(startDate: Date, endDate: Date): Promise<void> {
    // Implementation for engagement metrics calculation
    // This would involve user session lengths and interaction patterns
    logger.debug('Calculating engagement metrics', { startDate, endDate });
  }

  private async calculatePerformanceMetrics(startDate: Date, endDate: Date): Promise<void> {
    // Implementation for performance metrics calculation
    // This would involve response times and error rates
    logger.debug('Calculating performance metrics', { startDate, endDate });
  }

  // Helper Methods
  private validateEvent(event: AnalyticsEvent): boolean {
    return !!(
      event.id &&
      event.type &&
      event.timestamp &&
      Object.values(AnalyticsEventType).includes(event.type)
    );
  }

  private async updateRealTimeCounters(events: AnalyticsEvent[]): Promise<void> {
    try {
      const eventCounts = countBy(events, 'type');
      
      for (const [eventType, count] of Object.entries(eventCounts)) {
        const key = `realtime_${eventType}`;
        await this.redis.incrby(key, count);
        await this.redis.expire(key, 300); // 5 minutes
      }
    } catch (error) {
      logger.error('Failed to update real-time counters:', error);
    }
  }

  private async triggerImmediateAggregation(events: AnalyticsEvent[]): Promise<void> {
    try {
      // Trigger immediate aggregation for critical events
      const criticalEvents = events.filter(event => 
        [
          AnalyticsEventType.ORDER_CREATED,
          AnalyticsEventType.SUBMISSION_PAYMENT_VERIFIED,
          AnalyticsEventType.ERROR_OCCURRED
        ].includes(event.type)
      );

      if (criticalEvents.length > 0) {
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        
        await this.processingQueue.add('aggregate-metrics', 
          { 
            timeRange: [fiveMinutesAgo, now], 
            bucketSize: 'minute' 
          },
          { 
            priority: 10, // High priority
            attempts: 1
          }
        );
      }
    } catch (error) {
      logger.error('Failed to trigger immediate aggregation:', error);
    }
  }

  private async updateProcessingMetrics(eventCount: number, processingTime: number): Promise<void> {
    try {
      await this.redis.setex('processing_metrics', 300, JSON.stringify({
        lastProcessedEvents: eventCount,
        lastProcessingTime: processingTime,
        eventsPerSecond: eventCount / (processingTime / 1000),
        timestamp: new Date()
      }));
    } catch (error) {
      logger.error('Failed to update processing metrics:', error);
    }
  }

  // Cron Job Schedulers
  private async scheduleAggregation(): Promise<void> {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      await this.aggregateMetrics([fiveMinutesAgo, now]);
      logger.debug('Scheduled aggregation completed');
    } catch (error) {
      logger.error('Scheduled aggregation failed:', error);
    }
  }

  private async scheduleCleanup(): Promise<void> {
    try {
      await this.cleanupOldData(config.ANALYTICS_RETENTION_DAYS);
      logger.debug('Scheduled cleanup completed');
    } catch (error) {
      logger.error('Scheduled cleanup failed:', error);
    }
  }

  private async scheduleDerivedMetrics(): Promise<void> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      await this.processingQueue.add('generate-derived-metrics', 
        { timeRange: [oneHourAgo, now] },
        { attempts: 2 }
      );
      
      logger.debug('Scheduled derived metrics generation');
    } catch (error) {
      logger.error('Scheduled derived metrics generation failed:', error);
    }
  }

  public async shutdown(): Promise<void> {
    try {
      // Stop cron jobs
      this.cronJobs.forEach(job => job.stop());
      
      // Close queue
      await this.processingQueue.close();
      
      // Close Redis connection
      await this.redis.quit();
      
      logger.info('Data pipeline service shut down successfully');
    } catch (error) {
      logger.error('Failed to shutdown data pipeline service:', error);
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}

export default DataPipelineService;