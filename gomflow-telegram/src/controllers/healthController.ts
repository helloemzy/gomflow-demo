import { Request, Response } from 'express'
import { logger } from '@/utils/logger'
import DatabaseService from '@/services/databaseService'
import QueueService from '@/services/queueService'
import TelegramBotService from '@/services/telegramBotService'
import { TelegramServiceResponse } from '@/types'

export class HealthController {
  private databaseService: DatabaseService
  private queueService: QueueService
  private telegramBot: TelegramBotService

  constructor(
    databaseService: DatabaseService,
    queueService: QueueService,
    telegramBot: TelegramBotService
  ) {
    this.databaseService = databaseService
    this.queueService = queueService
    this.telegramBot = telegramBot
  }

  /**
   * Basic health check
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const timestamp = new Date().toISOString()
      
      res.json({
        success: true,
        data: {
          status: 'healthy',
          service: 'gomflow-telegram',
          timestamp,
          version: '1.0.0',
          uptime: Math.floor(process.uptime())
        }
      })
    } catch (error: any) {
      logger.error('Health check failed', { error: error.message })
      
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        message: error.message
      })
    }
  }

  /**
   * Detailed health check with dependencies
   */
  async detailedHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const timestamp = new Date().toISOString()
      const startTime = Date.now()

      // Check all dependencies in parallel
      const [databaseHealth, queueHealth, botHealth] = await Promise.allSettled([
        this.checkDatabaseHealth(),
        this.checkQueueHealth(),
        this.checkBotHealth()
      ])

      const responseTime = Date.now() - startTime

      const healthData = {
        status: 'healthy',
        service: 'gomflow-telegram',
        timestamp,
        version: '1.0.0',
        uptime: Math.floor(process.uptime()),
        response_time_ms: responseTime,
        dependencies: {
          database: this.getHealthResult(databaseHealth),
          queue: this.getHealthResult(queueHealth),
          telegram_bot: this.getHealthResult(botHealth)
        }
      }

      // Determine overall status
      const allHealthy = Object.values(healthData.dependencies).every(dep => dep.status === 'healthy')
      healthData.status = allHealthy ? 'healthy' : 'degraded'

      const statusCode = allHealthy ? 200 : 503
      
      res.status(statusCode).json({
        success: allHealthy,
        data: healthData
      })

    } catch (error: any) {
      logger.error('Detailed health check failed', { error: error.message })
      
      res.status(500).json({
        success: false,
        error: 'Health check failed',
        message: error.message,
        data: {
          status: 'unhealthy',
          service: 'gomflow-telegram',
          timestamp: new Date().toISOString()
        }
      })
    }
  }

  /**
   * Get service metrics
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const [queueStats, botAnalytics] = await Promise.allSettled([
        this.queueService.getQueueStats(),
        this.databaseService.getBotAnalytics()
      ])

      const metrics = {
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor(process.uptime()),
        memory_usage: process.memoryUsage(),
        queue_stats: queueStats.status === 'fulfilled' ? queueStats.value : null,
        bot_analytics: botAnalytics.status === 'fulfilled' ? botAnalytics.value : null
      }

      res.json({
        success: true,
        data: metrics
      })

    } catch (error: any) {
      logger.error('Metrics collection failed', { error: error.message })
      
      res.status(500).json({
        success: false,
        error: 'Failed to collect metrics',
        message: error.message
      })
    }
  }

  /**
   * Check readiness for receiving traffic
   */
  async readinessCheck(req: Request, res: Response): Promise<void> {
    try {
      // Check if all required services are ready
      const [databaseReady, queueReady, botReady] = await Promise.allSettled([
        this.checkDatabaseHealth(),
        this.checkQueueHealth(),
        this.checkBotHealth()
      ])

      const isReady = [
        databaseReady,
        queueReady,
        botReady
      ].every(result => result.status === 'fulfilled' && result.value.status === 'healthy')

      if (isReady) {
        res.json({
          success: true,
          data: {
            status: 'ready',
            timestamp: new Date().toISOString()
          }
        })
      } else {
        res.status(503).json({
          success: false,
          error: 'Service not ready',
          data: {
            status: 'not_ready',
            timestamp: new Date().toISOString()
          }
        })
      }

    } catch (error: any) {
      logger.error('Readiness check failed', { error: error.message })
      
      res.status(503).json({
        success: false,
        error: 'Readiness check failed',
        message: error.message
      })
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<{ status: string; details?: any }> {
    try {
      const result = await this.databaseService.healthCheck()
      return {
        status: result.success ? 'healthy' : 'unhealthy',
        details: result.data
      }
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      }
    }
  }

  /**
   * Check queue health
   */
  private async checkQueueHealth(): Promise<{ status: string; details?: any }> {
    try {
      const result = await this.queueService.healthCheck()
      return {
        status: (result.redis && result.queues) ? 'healthy' : 'unhealthy',
        details: result
      }
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      }
    }
  }

  /**
   * Check bot health
   */
  private async checkBotHealth(): Promise<{ status: string; details?: any }> {
    try {
      // Try to get bot info to verify connection
      const botInfo = await this.telegramBot.getBot().telegram.getMe()
      return {
        status: 'healthy',
        details: {
          bot_id: botInfo.id,
          bot_username: botInfo.username,
          can_join_groups: botInfo.can_join_groups,
          can_read_all_group_messages: botInfo.can_read_all_group_messages
        }
      }
    } catch (error: any) {
      return {
        status: 'unhealthy',
        details: { error: error.message }
      }
    }
  }

  /**
   * Extract health result from Promise.allSettled result
   */
  private getHealthResult(result: PromiseSettledResult<{ status: string; details?: any }>): { status: string; details?: any } {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      return {
        status: 'unhealthy',
        details: { error: result.reason?.message || 'Unknown error' }
      }
    }
  }
}

export default HealthController