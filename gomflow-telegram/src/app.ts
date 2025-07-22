import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import { Config } from '@/config'
import { logger } from '@/utils/logger'
import apiRoutes, { databaseService, queueService, telegramBot } from '@/routes'
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler'
import { authMiddleware } from '@/middleware/auth'

class TelegramBotApp {
  public app: express.Application
  private isShuttingDown = false

  constructor() {
    this.app = express()
    this.setupMiddleware()
    this.setupRoutes()
    this.setupErrorHandling()
    this.setupGracefulShutdown()
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: false, // Disable CSP for API service
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }))

    // CORS configuration
    this.app.use(cors({
      origin: Config.CORS_ORIGIN,
      credentials: true,
      optionsSuccessStatus: 200
    }))

    // Compression
    this.app.use(compression())

    // Request logging
    this.app.use(morgan('combined', {
      stream: {
        write: (message: string) => {
          logger.info(message.trim(), { component: 'http' })
        }
      },
      skip: (req) => {
        // Skip health check logs in production
        return Config.isProduction && req.path.startsWith('/api/health')
      }
    }))

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }))

    // Rate limiting
    const limiter = rateLimit({
      windowMs: Config.rateLimits.windowMs,
      max: Config.rateLimits.maxMessages,
      message: {
        success: false,
        error: 'Too many requests',
        message: 'Please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => {
        // Skip rate limiting for webhook endpoint
        return req.path === '/api/webhook/telegram'
      }
    })
    this.app.use(limiter)

    // Trust proxy for accurate IP addresses
    if (Config.isProduction) {
      this.app.set('trust proxy', 1)
    }

    // Request ID middleware for tracing
    this.app.use((req, res, next) => {
      req.id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      res.setHeader('X-Request-ID', req.id)
      next()
    })

    // Request timing
    this.app.use((req, res, next) => {
      req.startTime = Date.now()
      next()
    })
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint (before auth)
    this.app.get('/ping', (req, res) => {
      res.json({ 
        success: true,
        data: { 
          status: 'pong',
          timestamp: new Date().toISOString(),
          service: 'gomflow-telegram'
        }
      })
    })

    // Main API routes with authentication
    this.app.use('/api', authMiddleware, apiRoutes)

    // Webhook endpoint (no auth for Telegram webhooks)
    this.app.post('/webhook/telegram', async (req, res) => {
      try {
        // This is a special case - bypass auth for Telegram webhooks
        // but still validate using webhook secret
        const { handleWebhook } = await import('@/controllers/webhookController')
        const webhookController = new (await import('@/controllers/webhookController')).WebhookController(telegramBot)
        await webhookController.handleWebhook(req, res)
      } catch (error: any) {
        logger.error('Webhook handling error', {
          error: error.message,
          ip: req.ip
        })
        res.status(500).json({ error: 'Internal server error' })
      }
    })

    // API documentation endpoint
    this.app.get('/docs', (req, res) => {
      res.json({
        success: true,
        data: {
          service: 'GOMFLOW Telegram Bot Service',
          version: '1.0.0',
          description: 'Telegram bot integration for group order management',
          base_url: `${req.protocol}://${req.get('host')}`,
          endpoints: {
            webhook: {
              'POST /webhook/telegram': 'Receive Telegram webhook updates',
              'POST /api/webhook/set': 'Set webhook URL',
              'GET /api/webhook/info': 'Get webhook information',
              'DELETE /api/webhook': 'Delete webhook'
            },
            health: {
              'GET /api/health': 'Basic health check',
              'GET /api/health/detailed': 'Detailed health check',
              'GET /api/health/ready': 'Readiness check',
              'GET /api/health/metrics': 'Service metrics'
            },
            notifications: {
              'POST /api/notifications/send': 'Send single message',
              'POST /api/notifications/bulk': 'Send bulk notification',
              'POST /api/notifications/broadcast-goms': 'Broadcast to GOMs',
              'POST /api/notifications/order-update': 'Send order update',
              'POST /api/notifications/payment-reminder': 'Send payment reminder'
            }
          },
          authentication: {
            type: 'Service Secret',
            header: 'x-service-secret',
            note: 'Required for all API endpoints except webhooks'
          }
        }
      })
    })
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler)

    // Global error handler
    this.app.use(errorHandler)
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2']
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        if (this.isShuttingDown) return
        
        this.isShuttingDown = true
        logger.info(`Received ${signal}, starting graceful shutdown...`)
        
        await this.shutdown()
      })
    })

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack
      })
      process.exit(1)
    })

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined
      })
      process.exit(1)
    })
  }

  /**
   * Start the server and bot
   */
  async start(): Promise<void> {
    try {
      // Start the Telegram bot
      await telegramBot.launch()
      
      // Start the Express server
      const server = this.app.listen(Config.PORT, () => {
        logger.info(`🚀 GOMFLOW Telegram Service started`, {
          port: Config.PORT,
          environment: Config.NODE_ENV,
          webhook_url: Config.TELEGRAM_WEBHOOK_URL || 'polling',
          features: {
            smart_payments: Config.botFeatures.smartPaymentDetection,
            inline_payments: Config.botFeatures.inlinePayments
          }
        })
      })

      // Store server reference for graceful shutdown
      this.app.set('server', server)

      // Start background tasks
      this.startBackgroundTasks()

    } catch (error: any) {
      logger.error('Failed to start Telegram service', {
        error: error.message,
        stack: error.stack
      })
      process.exit(1)
    }
  }

  /**
   * Start background tasks
   */
  private startBackgroundTasks(): void {
    // Cleanup expired sessions every hour
    setInterval(async () => {
      try {
        const deletedCount = await databaseService.cleanupExpiredSessions()
        if (deletedCount > 0) {
          logger.debug('Cleaned up expired sessions', { count: deletedCount })
        }
      } catch (error: any) {
        logger.error('Session cleanup failed', { error: error.message })
      }
    }, 60 * 60 * 1000) // 1 hour

    // Cleanup old queue jobs every 6 hours
    setInterval(async () => {
      try {
        await queueService.cleanupJobs()
        logger.debug('Queue cleanup completed')
      } catch (error: any) {
        logger.error('Queue cleanup failed', { error: error.message })
      }
    }, 6 * 60 * 60 * 1000) // 6 hours
  }

  /**
   * Graceful shutdown
   */
  private async shutdown(): Promise<void> {
    try {
      logger.info('Starting graceful shutdown...')
      
      const server = this.app.get('server')
      
      // Stop accepting new connections
      if (server) {
        server.close(() => {
          logger.info('HTTP server closed')
        })
      }

      // Stop services
      await Promise.allSettled([
        telegramBot.stop(),
        queueService.shutdown()
      ])

      logger.info('Graceful shutdown completed')
      process.exit(0)
    } catch (error: any) {
      logger.error('Error during shutdown', {
        error: error.message,
        stack: error.stack
      })
      process.exit(1)
    }
  }
}

export default TelegramBotApp