import { Router } from 'express'
import HealthController from '@/controllers/healthController'
import DatabaseService from '@/services/databaseService'
import QueueService from '@/services/queueService'
import TelegramBotService from '@/services/telegramBotService'

function createHealthRoutes(
  databaseService: DatabaseService,
  queueService: QueueService,
  telegramBot: TelegramBotService
): Router {
  const router = Router()
  const healthController = new HealthController(databaseService, queueService, telegramBot)

  /**
   * GET /api/health
   * Basic health check
   */
  router.get('/', async (req, res) => {
    await healthController.healthCheck(req, res)
  })

  /**
   * GET /api/health/detailed
   * Detailed health check with all dependencies
   */
  router.get('/detailed', async (req, res) => {
    await healthController.detailedHealthCheck(req, res)
  })

  /**
   * GET /api/health/ready
   * Readiness check for Kubernetes
   */
  router.get('/ready', async (req, res) => {
    await healthController.readinessCheck(req, res)
  })

  /**
   * GET /api/health/metrics
   * Service metrics and statistics
   */
  router.get('/metrics', async (req, res) => {
    await healthController.getMetrics(req, res)
  })

  return router
}

export default createHealthRoutes