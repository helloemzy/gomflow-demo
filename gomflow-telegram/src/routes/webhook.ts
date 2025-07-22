import { Router } from 'express'
import WebhookController from '@/controllers/webhookController'
import TelegramBotService from '@/services/telegramBotService'

function createWebhookRoutes(telegramBot: TelegramBotService): Router {
  const router = Router()
  const webhookController = new WebhookController(telegramBot)

  /**
   * POST /api/webhook/telegram
   * Main webhook endpoint for receiving Telegram updates
   */
  router.post('/telegram', async (req, res) => {
    await webhookController.handleWebhook(req, res)
  })

  /**
   * POST /api/webhook/set
   * Set webhook URL for the bot
   */
  router.post('/set', async (req, res) => {
    await webhookController.setWebhook(req, res)
  })

  /**
   * GET /api/webhook/info
   * Get current webhook information
   */
  router.get('/info', async (req, res) => {
    await webhookController.getWebhookInfo(req, res)
  })

  /**
   * DELETE /api/webhook
   * Delete webhook (switch to polling)
   */
  router.delete('/', async (req, res) => {
    await webhookController.deleteWebhook(req, res)
  })

  /**
   * GET /api/webhook/bot-info
   * Get bot information
   */
  router.get('/bot-info', async (req, res) => {
    await webhookController.getBotInfo(req, res)
  })

  return router
}

export default createWebhookRoutes