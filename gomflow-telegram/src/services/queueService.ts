import Bull, { Queue, Job, JobOptions } from 'bull'
import Redis from 'ioredis'
import { Config } from '@/config'
import { logger } from '@/utils/logger'
import { 
  MessageJob, 
  NotificationJob, 
  PaymentProcessingJob,
  TelegramContext,
  InlineKeyboard
} from '@/types'

export class QueueService {
  private redis: Redis
  private messageQueue: Queue<MessageJob>
  private notificationQueue: Queue<NotificationJob>
  private paymentQueue: Queue<PaymentProcessingJob>
  private telegramBot: any // Will be injected

  constructor() {
    // Initialize Redis connection
    this.redis = new Redis(Config.REDIS_URL, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    })

    // Initialize queues
    this.messageQueue = new Bull(Config.queues.messageQueue, {
      redis: Config.REDIS_URL,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    })

    this.notificationQueue = new Bull(Config.queues.notificationQueue, {
      redis: Config.REDIS_URL,
      defaultJobOptions: {
        removeOnComplete: 50,
        removeOnFail: 25,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    })

    this.paymentQueue = new Bull('telegram-payment-processing', {
      redis: Config.REDIS_URL,
      defaultJobOptions: {
        removeOnComplete: 20,
        removeOnFail: 10,
        attempts: 2,
        backoff: {
          type: 'fixed',
          delay: 10000
        }
      }
    })

    this.setupProcessors()
    this.setupEventHandlers()
  }

  /**
   * Set Telegram bot instance for sending messages
   */
  setBotInstance(bot: any): void {
    this.telegramBot = bot
  }

  /**
   * Setup queue processors
   */
  private setupProcessors(): void {
    // Message queue processor
    this.messageQueue.process('send-message', Config.queues.concurrency, async (job: Job<MessageJob>) => {
      return this.processSendMessage(job.data)
    })

    // Notification queue processor
    this.notificationQueue.process('send-notification', Config.queues.concurrency, async (job: Job<NotificationJob>) => {
      return this.processSendNotification(job.data)
    })

    // Payment processing queue
    this.paymentQueue.process('process-payment-screenshot', 2, async (job: Job<PaymentProcessingJob>) => {
      return this.processPaymentScreenshot(job.data)
    })
  }

  /**
   * Setup event handlers for monitoring
   */
  private setupEventHandlers(): void {
    // Message queue events
    this.messageQueue.on('completed', (job, result) => {
      logger.debug('Message job completed', {
        job_id: job.id,
        chat_id: job.data.chat_id,
        duration: Date.now() - job.timestamp
      })
    })

    this.messageQueue.on('failed', (job, err) => {
      logger.error('Message job failed', {
        job_id: job.id,
        chat_id: job.data.chat_id,
        error: err.message,
        attempts: job.attemptsMade
      })
    })

    // Notification queue events
    this.notificationQueue.on('completed', (job, result) => {
      logger.debug('Notification job completed', {
        job_id: job.id,
        type: job.data.type,
        recipients: job.data.recipients.length
      })
    })

    this.notificationQueue.on('failed', (job, err) => {
      logger.error('Notification job failed', {
        job_id: job.id,
        type: job.data.type,
        error: err.message
      })
    })

    // Payment queue events
    this.paymentQueue.on('completed', (job, result) => {
      logger.info('Payment processing completed', {
        job_id: job.id,
        file_id: job.data.file_id,
        success: result.success
      })
    })

    this.paymentQueue.on('failed', (job, err) => {
      logger.error('Payment processing failed', {
        job_id: job.id,
        file_id: job.data.file_id,
        error: err.message
      })
    })
  }

  /**
   * Add message to queue
   */
  async addMessage(
    chatId: number,
    message: string,
    keyboard?: InlineKeyboard[][],
    options?: {
      priority?: 'high' | 'normal' | 'low'
      delay?: number
      parse_mode?: 'Markdown' | 'HTML'
      disable_web_page_preview?: boolean
      reply_to_message_id?: number
    }
  ): Promise<Job<MessageJob>> {
    const messageJob: MessageJob = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      chat_id: chatId,
      message,
      keyboard,
      options: options ? {
        parse_mode: options.parse_mode,
        disable_web_page_preview: options.disable_web_page_preview,
        reply_to_message_id: options.reply_to_message_id
      } : undefined,
      priority: options?.priority || 'normal',
      retry_count: 0,
      created_at: new Date().toISOString()
    }

    const jobOptions: JobOptions = {
      priority: this.getPriorityValue(options?.priority || 'normal'),
      delay: options?.delay || 0
    }

    const job = await this.messageQueue.add('send-message', messageJob, jobOptions)

    logger.debug('Message queued', {
      job_id: job.id,
      chat_id: chatId,
      priority: options?.priority || 'normal'
    })

    return job
  }

  /**
   * Add bulk notification to queue
   */
  async addBulkNotification(
    type: NotificationJob['type'],
    recipients: number[],
    message: string,
    keyboard?: InlineKeyboard[][],
    scheduleAt?: Date
  ): Promise<Job<NotificationJob>> {
    const notificationJob: NotificationJob = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      recipients,
      message,
      keyboard,
      schedule_at: scheduleAt?.toISOString(),
      created_at: new Date().toISOString()
    }

    const jobOptions: JobOptions = {
      priority: type === 'reminder' ? 10 : 5,
      delay: scheduleAt ? scheduleAt.getTime() - Date.now() : 0
    }

    const job = await this.notificationQueue.add('send-notification', notificationJob, jobOptions)

    logger.info('Bulk notification queued', {
      job_id: job.id,
      type,
      recipients: recipients.length,
      scheduled: !!scheduleAt
    })

    return job
  }

  /**
   * Add payment processing job
   */
  async addPaymentProcessing(
    chatId: number,
    messageId: number,
    fileId: string,
    userId: number,
    submissionContext?: PaymentProcessingJob['submission_context']
  ): Promise<Job<PaymentProcessingJob>> {
    const paymentJob: PaymentProcessingJob = {
      id: `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      chat_id: chatId,
      message_id: messageId,
      file_id: fileId,
      user_id: userId,
      submission_context: submissionContext,
      created_at: new Date().toISOString()
    }

    const job = await this.paymentQueue.add('process-payment-screenshot', paymentJob, {
      priority: 15 // High priority for payment processing
    })

    logger.info('Payment processing queued', {
      job_id: job.id,
      chat_id: chatId,
      file_id: fileId
    })

    return job
  }

  /**
   * Process single message
   */
  private async processSendMessage(jobData: MessageJob): Promise<{ success: boolean; message_id?: number }> {
    try {
      if (!this.telegramBot) {
        throw new Error('Telegram bot instance not set')
      }

      const sendOptions: any = {}
      
      if (jobData.keyboard) {
        sendOptions.reply_markup = {
          inline_keyboard: jobData.keyboard
        }
      }

      if (jobData.options) {
        Object.assign(sendOptions, jobData.options)
      }

      const result = await this.telegramBot.telegram.sendMessage(
        jobData.chat_id,
        jobData.message,
        sendOptions
      )

      return {
        success: true,
        message_id: result.message_id
      }
    } catch (error: any) {
      logger.error('Failed to send message', {
        job_id: jobData.id,
        chat_id: jobData.chat_id,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Process bulk notification
   */
  private async processSendNotification(jobData: NotificationJob): Promise<{ success: boolean; sent_count: number; failed_count: number }> {
    let sentCount = 0
    let failedCount = 0

    const sendOptions: any = {}
    if (jobData.keyboard) {
      sendOptions.reply_markup = {
        inline_keyboard: jobData.keyboard
      }
    }

    // Process recipients in batches to avoid rate limits
    const batchSize = 30
    for (let i = 0; i < jobData.recipients.length; i += batchSize) {
      const batch = jobData.recipients.slice(i, i + batchSize)
      
      const promises = batch.map(async (chatId) => {
        try {
          if (!this.telegramBot) {
            throw new Error('Telegram bot instance not set')
          }

          await this.telegramBot.telegram.sendMessage(
            chatId,
            jobData.message,
            sendOptions
          )
          return { success: true, chatId }
        } catch (error: any) {
          logger.warn('Failed to send notification to user', {
            chat_id: chatId,
            type: jobData.type,
            error: error.message
          })
          return { success: false, chatId, error: error.message }
        }
      })

      const results = await Promise.allSettled(promises)
      
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.success) {
          sentCount++
        } else {
          failedCount++
        }
      })

      // Wait between batches to respect rate limits
      if (i + batchSize < jobData.recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    logger.info('Bulk notification completed', {
      job_id: jobData.id,
      type: jobData.type,
      total: jobData.recipients.length,
      sent: sentCount,
      failed: failedCount
    })

    return {
      success: sentCount > 0,
      sent_count: sentCount,
      failed_count: failedCount
    }
  }

  /**
   * Process payment screenshot (delegated to Smart Agent)
   */
  private async processPaymentScreenshot(jobData: PaymentProcessingJob): Promise<{ success: boolean }> {
    try {
      // This would integrate with the Smart Agent service
      // For now, we'll simulate the processing
      logger.info('Processing payment screenshot', {
        job_id: jobData.id,
        file_id: jobData.file_id,
        chat_id: jobData.chat_id
      })

      // In a real implementation, this would:
      // 1. Download the file from Telegram
      // 2. Send to Smart Agent service
      // 3. Update the processing message with results
      // 4. Store results in database

      return { success: true }
    } catch (error: any) {
      logger.error('Payment screenshot processing failed', {
        job_id: jobData.id,
        file_id: jobData.file_id,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Get priority value for Bull queue
   */
  private getPriorityValue(priority: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high': return 20
      case 'normal': return 10
      case 'low': return 5
      default: return 10
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    messageQueue: { waiting: number; active: number; completed: number; failed: number }
    notificationQueue: { waiting: number; active: number; completed: number; failed: number }
    paymentQueue: { waiting: number; active: number; completed: number; failed: number }
  }> {
    const [messageStats, notificationStats, paymentStats] = await Promise.all([
      this.messageQueue.getJobCounts(),
      this.notificationQueue.getJobCounts(),
      this.paymentQueue.getJobCounts()
    ])

    return {
      messageQueue: messageStats,
      notificationQueue: notificationStats,
      paymentQueue: paymentStats
    }
  }

  /**
   * Clean up completed jobs
   */
  async cleanupJobs(): Promise<void> {
    try {
      await Promise.all([
        this.messageQueue.clean(24 * 60 * 60 * 1000, 'completed'), // 24 hours
        this.messageQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'), // 7 days
        this.notificationQueue.clean(24 * 60 * 60 * 1000, 'completed'),
        this.notificationQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed'),
        this.paymentQueue.clean(24 * 60 * 60 * 1000, 'completed'),
        this.paymentQueue.clean(7 * 24 * 60 * 60 * 1000, 'failed')
      ])

      logger.debug('Queue cleanup completed')
    } catch (error: any) {
      logger.error('Queue cleanup failed', { error: error.message })
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ redis: boolean; queues: boolean }> {
    try {
      // Test Redis connection
      await this.redis.ping()
      
      // Test queue connectivity
      const stats = await this.getQueueStats()
      
      return {
        redis: true,
        queues: true
      }
    } catch (error: any) {
      logger.error('Queue health check failed', { error: error.message })
      return {
        redis: false,
        queues: false
      }
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down queue service...')
      
      await Promise.all([
        this.messageQueue.close(),
        this.notificationQueue.close(),
        this.paymentQueue.close()
      ])
      
      await this.redis.disconnect()
      
      logger.info('Queue service shutdown complete')
    } catch (error: any) {
      logger.error('Error during queue shutdown', { error: error.message })
    }
  }
}

export default QueueService