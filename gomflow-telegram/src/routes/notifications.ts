import { Router } from 'express'
import NotificationController from '@/controllers/notificationController'
import DatabaseService from '@/services/databaseService'
import QueueService from '@/services/queueService'

function createNotificationRoutes(
  databaseService: DatabaseService,
  queueService: QueueService
): Router {
  const router = Router()
  const notificationController = new NotificationController(databaseService, queueService)

  /**
   * POST /api/notifications/send
   * Send a single message to a specific chat
   */
  router.post('/send', async (req, res) => {
    await notificationController.sendMessage(req, res)
  })

  /**
   * POST /api/notifications/bulk
   * Send bulk notification to multiple users
   */
  router.post('/bulk', async (req, res) => {
    await notificationController.sendBulkNotification(req, res)
  })

  /**
   * POST /api/notifications/broadcast-goms
   * Broadcast message to all GOM users
   */
  router.post('/broadcast-goms', async (req, res) => {
    await notificationController.broadcastToGOMs(req, res)
  })

  /**
   * POST /api/notifications/order-update
   * Send order update notification
   */
  router.post('/order-update', async (req, res) => {
    await notificationController.sendOrderUpdate(req, res)
  })

  /**
   * POST /api/notifications/payment-reminder
   * Send payment reminder notification
   */
  router.post('/payment-reminder', async (req, res) => {
    await notificationController.sendPaymentReminder(req, res)
  })

  /**
   * GET /api/notifications/history
   * Get notification history
   */
  router.get('/history', async (req, res) => {
    await notificationController.getNotificationHistory(req, res)
  })

  /**
   * GET /api/notifications/queue-status
   * Get queue status and statistics
   */
  router.get('/queue-status', async (req, res) => {
    await notificationController.getQueueStatus(req, res)
  })

  return router
}

export default createNotificationRoutes