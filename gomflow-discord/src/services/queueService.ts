import Bull, { Queue, Job, JobOptions, QueueOptions } from 'bull';
import { logger } from '../utils/logger';
import { Config } from '../config';
import type { 
  MessageJob, 
  NotificationJob, 
  PaymentProcessingJob,
  InteractionDeferJob 
} from '../types';

export class QueueService {
  private config: Config;
  private queues: Map<string, Queue> = new Map();
  
  // Queue names
  private readonly QUEUES = {
    MESSAGE: 'discord-messages',
    NOTIFICATION: 'discord-notifications',
    PAYMENT: 'discord-payments',
    INTERACTION: 'discord-interactions',
  } as const;

  constructor(config: Config) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      const queueOptions: QueueOptions = {
        redis: {
          host: this.config.redis.host,
          port: this.config.redis.port,
          password: this.config.redis.password,
          db: this.config.redis.db,
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      };

      // Initialize queues
      for (const [key, name] of Object.entries(this.QUEUES)) {
        const queue = new Bull(name, queueOptions);
        this.queues.set(name, queue);
        
        // Set up error handlers
        queue.on('error', (error) => {
          logger.error(`Queue ${name} error:`, error);
        });

        queue.on('failed', (job, error) => {
          logger.error(`Job ${job.id} in queue ${name} failed:`, error);
        });

        // Log successful completions in development
        if (this.config.nodeEnv === 'development') {
          queue.on('completed', (job) => {
            logger.debug(`Job ${job.id} in queue ${name} completed`);
          });
        }
      }

      logger.info('Queue service initialized with all queues');
    } catch (error) {
      logger.error('Failed to initialize queue service:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      const closePromises = Array.from(this.queues.values()).map(queue => queue.close());
      await Promise.all(closePromises);
      logger.info('All queues closed successfully');
    } catch (error) {
      logger.error('Error closing queues:', error);
      throw error;
    }
  }

  // Message Queue Methods
  async addMessage(data: MessageJob, options?: JobOptions): Promise<Job<MessageJob>> {
    const queue = this.queues.get(this.QUEUES.MESSAGE);
    if (!queue) throw new Error('Message queue not initialized');

    const job = await queue.add(data, {
      ...options,
      priority: data.priority || 0,
    });

    logger.debug(`Added message job ${job.id} to queue`);
    return job;
  }

  async processMessages(processor: (job: Job<MessageJob>) => Promise<void>): Promise<void> {
    const queue = this.queues.get(this.QUEUES.MESSAGE);
    if (!queue) throw new Error('Message queue not initialized');

    queue.process(this.config.queueConcurrency, async (job) => {
      try {
        await processor(job);
      } catch (error) {
        logger.error(`Error processing message job ${job.id}:`, error);
        throw error;
      }
    });
  }

  // Notification Queue Methods
  async addNotification(data: NotificationJob, options?: JobOptions): Promise<Job<NotificationJob>> {
    const queue = this.queues.get(this.QUEUES.NOTIFICATION);
    if (!queue) throw new Error('Notification queue not initialized');

    const job = await queue.add(data, {
      ...options,
      delay: data.scheduledFor ? new Date(data.scheduledFor).getTime() - Date.now() : 0,
    });

    logger.debug(`Added notification job ${job.id} to queue`);
    return job;
  }

  async addBulkNotifications(notifications: NotificationJob[], options?: JobOptions): Promise<Job<NotificationJob>[]> {
    const queue = this.queues.get(this.QUEUES.NOTIFICATION);
    if (!queue) throw new Error('Notification queue not initialized');

    const jobs = await queue.addBulk(
      notifications.map(data => ({
        data,
        opts: {
          ...options,
          delay: data.scheduledFor ? new Date(data.scheduledFor).getTime() - Date.now() : 0,
        },
      }))
    );

    logger.info(`Added ${jobs.length} notification jobs to queue`);
    return jobs;
  }

  async processNotifications(processor: (job: Job<NotificationJob>) => Promise<void>): Promise<void> {
    const queue = this.queues.get(this.QUEUES.NOTIFICATION);
    if (!queue) throw new Error('Notification queue not initialized');

    queue.process(this.config.queueConcurrency, async (job) => {
      try {
        await processor(job);
      } catch (error) {
        logger.error(`Error processing notification job ${job.id}:`, error);
        throw error;
      }
    });
  }

  // Payment Processing Queue Methods
  async addPaymentProcessing(data: PaymentProcessingJob, options?: JobOptions): Promise<Job<PaymentProcessingJob>> {
    const queue = this.queues.get(this.QUEUES.PAYMENT);
    if (!queue) throw new Error('Payment queue not initialized');

    const job = await queue.add(data, {
      ...options,
      priority: 10, // High priority for payment processing
    });

    logger.info(`Added payment processing job ${job.id} for attachment ${data.attachmentUrl}`);
    return job;
  }

  async processPayments(processor: (job: Job<PaymentProcessingJob>) => Promise<void>): Promise<void> {
    const queue = this.queues.get(this.QUEUES.PAYMENT);
    if (!queue) throw new Error('Payment queue not initialized');

    // Process payment jobs one at a time to avoid overwhelming the Smart Agent
    queue.process(1, async (job) => {
      try {
        await processor(job);
      } catch (error) {
        logger.error(`Error processing payment job ${job.id}:`, error);
        throw error;
      }
    });
  }

  // Interaction Defer Queue Methods (for Discord's 3-second response requirement)
  async addInteractionDefer(data: InteractionDeferJob): Promise<Job<InteractionDeferJob>> {
    const queue = this.queues.get(this.QUEUES.INTERACTION);
    if (!queue) throw new Error('Interaction queue not initialized');

    const job = await queue.add(data, {
      priority: 100, // Highest priority
      removeOnComplete: true,
      attempts: 1, // No retries for deferred interactions
    });

    logger.debug(`Added interaction defer job ${job.id}`);
    return job;
  }

  async processInteractions(processor: (job: Job<InteractionDeferJob>) => Promise<void>): Promise<void> {
    const queue = this.queues.get(this.QUEUES.INTERACTION);
    if (!queue) throw new Error('Interaction queue not initialized');

    queue.process(this.config.queueConcurrency * 2, async (job) => {
      try {
        await processor(job);
      } catch (error) {
        logger.error(`Error processing interaction job ${job.id}:`, error);
        // Don't throw - interactions should fail silently
      }
    });
  }

  // Queue Management Methods
  async getQueueStats(queueName: string): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  async getAllQueueStats(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    for (const [name, queue] of this.queues.entries()) {
      stats[name] = await this.getQueueStats(name);
    }

    return stats;
  }

  async cleanQueue(queueName: string, grace: number = 5000): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    await queue.clean(grace, 'completed');
    await queue.clean(grace, 'failed');
    logger.info(`Cleaned queue ${queueName}`);
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    await queue.pause();
    logger.info(`Paused queue ${queueName}`);
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) throw new Error(`Queue ${queueName} not found`);

    await queue.resume();
    logger.info(`Resumed queue ${queueName}`);
  }

  // Utility method to get queue by name
  getQueue(queueName: string): Queue | undefined {
    return this.queues.get(queueName);
  }
}