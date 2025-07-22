import { Request, Response } from 'express'
import { z } from 'zod'
import { logger } from '@/utils/logger'
import DatabaseService from '@/services/databaseService'
import QueueService from '@/services/queueService'
import { TelegramServiceResponse, InlineKeyboard } from '@/types'

// Request validation schemas
const SendMessageSchema = z.object({
  chat_id: z.number().int(),
  message: z.string().min(1).max(4096),
  keyboard: z.array(z.array(z.object({
    text: z.string(),
    callback_data: z.string().optional(),
    url: z.string().url().optional()
  }))).optional(),
  options: z.object({
    parse_mode: z.enum(['Markdown', 'HTML']).optional(),
    disable_web_page_preview: z.boolean().optional(),
    reply_to_message_id: z.number().int().optional()
  }).optional()
})

const BulkNotificationSchema = z.object({
  type: z.enum(['order_update', 'payment_update', 'reminder', 'announcement']),
  recipients: z.array(z.number().int()).min(1).max(1000),
  message: z.string().min(1).max(4096),
  keyboard: z.array(z.array(z.object({
    text: z.string(),
    callback_data: z.string().optional(),
    url: z.string().url().optional()
  }))).optional(),
  schedule_at: z.string().datetime().optional()
})

const BroadcastToGOMsSchema = z.object({
  message: z.string().min(1).max(4096),
  keyboard: z.array(z.array(z.object({
    text: z.string(),
    callback_data: z.string().optional(),
    url: z.string().url().optional()
  }))).optional(),
  urgent: z.boolean().default(false)
})

export class NotificationController {
  private databaseService: DatabaseService
  private queueService: QueueService

  constructor(databaseService: DatabaseService, queueService: QueueService) {
    this.databaseService = databaseService
    this.queueService = queueService
  }

  /**
   * Send a single message to a specific chat
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = SendMessageSchema.parse(req.body)
      
      const job = await this.queueService.addMessage(
        validatedData.chat_id,
        validatedData.message,
        validatedData.keyboard,
        {
          priority: 'normal',
          parse_mode: validatedData.options?.parse_mode,
          disable_web_page_preview: validatedData.options?.disable_web_page_preview,
          reply_to_message_id: validatedData.options?.reply_to_message_id
        }
      )

      logger.info('Message queued', {
        job_id: job.id,
        chat_id: validatedData.chat_id,
        message_length: validatedData.message.length
      })

      res.json({
        success: true,
        data: {
          job_id: job.id,
          message: 'Message queued for delivery'
        }
      })

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        })
        return
      }

      logger.error('Send message error', {
        error: error.message,
        chat_id: req.body.chat_id
      })
      
      res.status(500).json({
        success: false,
        error: 'Failed to queue message',
        message: error.message
      })
    }
  }

  /**
   * Send bulk notification to multiple users
   */
  async sendBulkNotification(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = BulkNotificationSchema.parse(req.body)
      
      const scheduleAt = validatedData.schedule_at ? new Date(validatedData.schedule_at) : undefined
      
      // Validate schedule time is in the future
      if (scheduleAt && scheduleAt <= new Date()) {
        res.status(400).json({
          success: false,
          error: 'Schedule time must be in the future'
        })
        return
      }

      const job = await this.queueService.addBulkNotification(
        validatedData.type,
        validatedData.recipients,
        validatedData.message,
        validatedData.keyboard,
        scheduleAt
      )

      logger.info('Bulk notification queued', {
        job_id: job.id,
        type: validatedData.type,
        recipients: validatedData.recipients.length,
        scheduled: !!scheduleAt
      })

      res.json({
        success: true,
        data: {
          job_id: job.id,
          type: validatedData.type,
          recipients: validatedData.recipients.length,
          scheduled_for: scheduleAt?.toISOString(),
          message: 'Bulk notification queued for delivery'
        }
      })

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        })
        return
      }

      logger.error('Bulk notification error', {
        error: error.message,
        type: req.body.type,
        recipients: req.body.recipients?.length
      })
      
      res.status(500).json({
        success: false,
        error: 'Failed to queue bulk notification',
        message: error.message
      })
    }
  }

  /**
   * Broadcast message to all GOM users
   */
  async broadcastToGOMs(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = BroadcastToGOMsSchema.parse(req.body)
      
      // Get all GOM users
      const gomUsers = await this.databaseService.getGOMUsers()
      
      if (gomUsers.length === 0) {
        res.status(404).json({
          success: false,
          error: 'No GOM users found'
        })
        return
      }

      const recipients = gomUsers
        .filter(user => user.telegram_id)
        .map(user => user.telegram_id)

      if (recipients.length === 0) {
        res.status(404).json({
          success: false,
          error: 'No GOM users with Telegram ID found'
        })
        return
      }

      const job = await this.queueService.addBulkNotification(
        'announcement',
        recipients,
        validatedData.message,
        validatedData.keyboard
      )

      logger.info('GOM broadcast queued', {
        job_id: job.id,
        gom_count: recipients.length,
        urgent: validatedData.urgent
      })

      res.json({
        success: true,
        data: {
          job_id: job.id,
          recipients: recipients.length,
          message: 'Broadcast to GOMs queued for delivery'
        }
      })

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        })
        return
      }

      logger.error('GOM broadcast error', {
        error: error.message
      })
      
      res.status(500).json({
        success: false,
        error: 'Failed to queue GOM broadcast',
        message: error.message
      })
    }
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 50, offset = 0 } = req.query
      
      const notifications = await this.databaseService.getPendingNotifications(
        parseInt(limit as string)
      )

      res.json({
        success: true,
        data: {
          notifications,
          total: notifications.length,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      })

    } catch (error: any) {
      logger.error('Get notification history error', {
        error: error.message
      })
      
      res.status(500).json({
        success: false,
        error: 'Failed to get notification history',
        message: error.message
      })
    }
  }

  /**
   * Get queue status
   */
  async getQueueStatus(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.queueService.getQueueStats()

      res.json({
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          queues: stats
        }
      })

    } catch (error: any) {
      logger.error('Get queue status error', {
        error: error.message
      })
      
      res.status(500).json({
        success: false,
        error: 'Failed to get queue status',
        message: error.message
      })
    }
  }

  /**
   * Send order update notification
   */
  async sendOrderUpdate(req: Request, res: Response): Promise<void> {
    try {
      const { order_id, message, recipients } = req.body
      
      if (!order_id || !message || !Array.isArray(recipients)) {
        res.status(400).json({
          success: false,
          error: 'order_id, message, and recipients array are required'
        })
        return
      }

      const keyboard: InlineKeyboard[][] = [
        [
          { text: '📱 Check Order Status', callback_data: `order_status:${order_id}` },
          { text: '💬 Contact GOM', callback_data: `contact_gom:${order_id}` }
        ]
      ]

      const job = await this.queueService.addBulkNotification(
        'order_update',
        recipients,
        message,
        keyboard
      )

      logger.info('Order update notification queued', {
        job_id: job.id,
        order_id,
        recipients: recipients.length
      })

      res.json({
        success: true,
        data: {
          job_id: job.id,
          order_id,
          recipients: recipients.length,
          message: 'Order update notification queued'
        }
      })

    } catch (error: any) {
      logger.error('Order update notification error', {
        error: error.message,
        order_id: req.body.order_id
      })
      
      res.status(500).json({
        success: false,
        error: 'Failed to queue order update notification',
        message: error.message
      })
    }
  }

  /**
   * Send payment reminder
   */
  async sendPaymentReminder(req: Request, res: Response): Promise<void> {
    try {
      const { submission_id, chat_id, order_title, amount, currency, deadline } = req.body
      
      if (!submission_id || !chat_id || !order_title || !amount || !currency) {
        res.status(400).json({
          success: false,
          error: 'submission_id, chat_id, order_title, amount, and currency are required'
        })
        return
      }

      const deadlineText = deadline ? 
        `\n\n⏰ Payment deadline: ${new Date(deadline).toLocaleDateString()}` : ''

      const message = `💰 **Payment Reminder**\n\n` +
        `Your payment for "${order_title}" is still pending.\n\n` +
        `Amount: ${amount} ${currency}${deadlineText}\n\n` +
        `Please complete your payment to secure your order.`

      const keyboard: InlineKeyboard[][] = [
        [
          { text: '💳 Make Payment', callback_data: `pay:${submission_id}` },
          { text: '📷 Upload Screenshot', callback_data: `upload_payment:${submission_id}` }
        ],
        [
          { text: '❓ Need Help?', callback_data: `help_payment:${submission_id}` }
        ]
      ]

      const job = await this.queueService.addMessage(
        chat_id,
        message,
        keyboard,
        { priority: 'high', parse_mode: 'Markdown' }
      )

      logger.info('Payment reminder queued', {
        job_id: job.id,
        submission_id,
        chat_id,
        amount,
        currency
      })

      res.json({
        success: true,
        data: {
          job_id: job.id,
          submission_id,
          message: 'Payment reminder queued'
        }
      })

    } catch (error: any) {
      logger.error('Payment reminder error', {
        error: error.message,
        submission_id: req.body.submission_id
      })
      
      res.status(500).json({
        success: false,
        error: 'Failed to queue payment reminder',
        message: error.message
      })
    }
  }
}

export default NotificationController