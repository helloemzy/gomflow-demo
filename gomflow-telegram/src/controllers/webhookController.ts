import { Request, Response } from 'express'
import crypto from 'crypto'
import { Config } from '@/config'
import { logger } from '@/utils/logger'
import TelegramBotService from '@/services/telegramBotService'
import { TelegramServiceResponse } from '@/types'

export class WebhookController {
  private telegramBot: TelegramBotService

  constructor(telegramBot: TelegramBotService) {
    this.telegramBot = telegramBot
  }

  /**
   * Handle Telegram webhook updates
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Verify webhook secret if configured
      if (Config.security.webhookSecret) {
        const secretToken = req.headers['x-telegram-bot-api-secret-token'] as string
        if (secretToken !== Config.security.webhookSecret) {
          logger.warn('Invalid webhook secret', {
            received_token: secretToken?.substring(0, 8) + '...',
            ip: req.ip
          })
          res.status(401).json({ error: 'Unauthorized' })
          return
        }
      }

      // Verify IP address if configured
      if (Config.security.webhookIPs.length > 0) {
        const clientIP = req.ip || req.connection.remoteAddress
        const isAllowedIP = this.isIPAllowed(clientIP)
        
        if (!isAllowedIP) {
          logger.warn('Webhook request from unauthorized IP', {
            ip: clientIP,
            allowed_ips: Config.security.webhookIPs
          })
          res.status(403).json({ error: 'Forbidden' })
          return
        }
      }

      // Process the update
      const update = req.body
      
      logger.debug('Webhook update received', {
        update_id: update.update_id,
        type: this.getUpdateType(update),
        user_id: update.message?.from?.id || update.callback_query?.from?.id,
        chat_id: update.message?.chat?.id || update.callback_query?.message?.chat?.id
      })

      // Handle the update with the bot
      await this.telegramBot.getBot().handleUpdate(update)

      // Always respond with 200 to acknowledge receipt
      res.status(200).json({ ok: true })

    } catch (error: any) {
      logger.error('Webhook processing error', {
        error: error.message,
        stack: error.stack,
        update: req.body
      })
      
      // Still respond with 200 to prevent Telegram from retrying
      res.status(200).json({ ok: false, error: 'Internal error' })
    }
  }

  /**
   * Set webhook URL
   */
  async setWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { url, secret_token } = req.body

      if (!url || typeof url !== 'string') {
        res.status(400).json({
          success: false,
          error: 'URL is required and must be a string'
        })
        return
      }

      // Validate URL
      try {
        new URL(url)
      } catch {
        res.status(400).json({
          success: false,
          error: 'Invalid URL format'
        })
        return
      }

      const setWebhookOptions: any = {
        url,
        allowed_updates: [
          'message',
          'callback_query',
          'my_chat_member',
          'chat_member'
        ],
        drop_pending_updates: true
      }

      if (secret_token) {
        setWebhookOptions.secret_token = secret_token
      }

      const result = await this.telegramBot.getBot().telegram.setWebhook(setWebhookOptions)

      if (result) {
        logger.info('Webhook set successfully', {
          url,
          has_secret: !!secret_token
        })

        res.json({
          success: true,
          message: 'Webhook set successfully',
          data: { url }
        })
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to set webhook'
        })
      }

    } catch (error: any) {
      logger.error('Set webhook error', {
        error: error.message,
        url: req.body.url
      })
      
      res.status(500).json({
        success: false,
        error: 'Failed to set webhook',
        message: error.message
      })
    }
  }

  /**
   * Get webhook info
   */
  async getWebhookInfo(req: Request, res: Response): Promise<void> {
    try {
      const webhookInfo = await this.telegramBot.getBot().telegram.getWebhookInfo()

      res.json({
        success: true,
        data: webhookInfo
      })

    } catch (error: any) {
      logger.error('Get webhook info error', {
        error: error.message
      })
      
      res.status(500).json({
        success: false,
        error: 'Failed to get webhook info',
        message: error.message
      })
    }
  }

  /**
   * Delete webhook (switch to polling)
   */
  async deleteWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { drop_pending_updates = true } = req.body

      const result = await this.telegramBot.getBot().telegram.deleteWebhook({
        drop_pending_updates
      })

      if (result) {
        logger.info('Webhook deleted successfully', {
          drop_pending_updates
        })

        res.json({
          success: true,
          message: 'Webhook deleted successfully'
        })
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to delete webhook'
        })
      }

    } catch (error: any) {
      logger.error('Delete webhook error', {
        error: error.message
      })
      
      res.status(500).json({
        success: false,
        error: 'Failed to delete webhook',
        message: error.message
      })
    }
  }

  /**
   * Get bot info
   */
  async getBotInfo(req: Request, res: Response): Promise<void> {
    try {
      const botInfo = await this.telegramBot.getBot().telegram.getMe()

      res.json({
        success: true,
        data: botInfo
      })

    } catch (error: any) {
      logger.error('Get bot info error', {
        error: error.message
      })
      
      res.status(500).json({
        success: false,
        error: 'Failed to get bot info',
        message: error.message
      })
    }
  }

  /**
   * Check if IP is in allowed list
   */
  private isIPAllowed(clientIP: string | undefined): boolean {
    if (!clientIP || Config.security.webhookIPs.length === 0) {
      return true
    }

    // Simple IP/CIDR matching (in production, use a proper library)
    return Config.security.webhookIPs.some(allowedIP => {
      if (allowedIP.includes('/')) {
        // CIDR notation - simplified check
        const [network, mask] = allowedIP.split('/')
        const maskBits = parseInt(mask)
        
        // For simplicity, just check if it starts with the network
        // In production, use proper CIDR matching
        return clientIP.startsWith(network.split('.').slice(0, Math.ceil(maskBits / 8)).join('.'))
      } else {
        // Exact IP match
        return clientIP === allowedIP
      }
    })
  }

  /**
   * Determine update type for logging
   */
  private getUpdateType(update: any): string {
    if (update.message) {
      if (update.message.photo) return 'photo'
      if (update.message.document) return 'document'
      if (update.message.text) return 'text'
      return 'message'
    }
    if (update.callback_query) return 'callback_query'
    if (update.my_chat_member) return 'my_chat_member'
    if (update.chat_member) return 'chat_member'
    if (update.inline_query) return 'inline_query'
    if (update.chosen_inline_result) return 'chosen_inline_result'
    return 'unknown'
  }
}

export default WebhookController