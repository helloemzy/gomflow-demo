import { Router } from 'express'
import webhookRoutes from './webhook'
import healthRoutes from './health'
import notificationRoutes from './notifications'
import DatabaseService from '@/services/databaseService'
import QueueService from '@/services/queueService'
import TelegramBotService from '@/services/telegramBotService'

// Initialize services
const databaseService = new DatabaseService()
const queueService = new QueueService()
const telegramBot = new TelegramBotService()

// Set bot instance for queue service
queueService.setBotInstance(telegramBot.getBot())

const router = Router()

// Mount route modules with dependencies
router.use('/webhook', webhookRoutes(telegramBot))
router.use('/health', healthRoutes(databaseService, queueService, telegramBot))
router.use('/notifications', notificationRoutes(databaseService, queueService))

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'GOMFLOW Telegram Bot Service',
      version: '1.0.0',
      description: 'Telegram bot integration for group order management',
      endpoints: {
        webhook: '/api/webhook',
        health: '/api/health',
        notifications: '/api/notifications'
      },
      documentation: 'https://docs.gomflow.com/telegram-api'
    }
  })
})

// Export services for external use
export { databaseService, queueService, telegramBot }
export default router