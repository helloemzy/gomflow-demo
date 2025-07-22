import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import compression from 'compression'
import { Config } from '@/config'
import { logger } from '@/utils/logger'
import routes from '@/routes'

// Create Express app
const app = express()

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for API service
  crossOriginEmbedderPolicy: false
}))

// CORS configuration
app.use(cors({
  origin: Config.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-signature', 'paymongo-signature']
}))

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',
  verify: (req: any, res, buf) => {
    // Store raw body for webhook signature verification
    req.rawBody = buf.toString('utf8')
  }
}))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Compression middleware
app.use(compression())

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}))

// Request ID middleware
app.use((req: any, res, next) => {
  req.id = Math.random().toString(36).substring(2, 15)
  res.setHeader('X-Request-ID', req.id)
  next()
})

// Health check endpoint (before routes)
app.get('/', (req, res) => {
  res.json({
    service: 'GOMFLOW Payment Service',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: Config.NODE_ENV
  })
})

// API routes
app.use('/api', routes)

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  })
})

// Global error handler
app.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    request_id: req.id
  })

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    request_id: req.id
  })
})

// Graceful shutdown handler
const gracefulShutdown = (signal: string) => {
  return (code: any) => {
    logger.info(`Received ${signal}, shutting down gracefully`, { code })
    
    server.close(() => {
      logger.info('HTTP server closed')
      process.exit(0)
    })

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down')
      process.exit(1)
    }, 10000)
  }
}

// Handle process signals
process.on('SIGTERM', gracefulShutdown('SIGTERM'))
process.on('SIGINT', gracefulShutdown('SIGINT'))

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack })
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise })
  process.exit(1)
})

// Start server
const server = app.listen(Config.PORT, () => {
  logger.info(`🚀 GOMFLOW Payment Service started`, {
    port: Config.PORT,
    environment: Config.NODE_ENV,
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })

  // Log configuration (redacted)
  logger.info('Service configuration loaded', {
    port: Config.PORT,
    environment: Config.NODE_ENV,
    cors_origin: Config.CORS_ORIGIN,
    supabase_url: Config.SUPABASE_URL,
    webhook_base_url: Config.WEBHOOK_BASE_URL,
    paymongo_configured: !!Config.paymentGateways.paymongo.secretKey,
    billplz_configured: !!Config.paymentGateways.billplz.apiKey
  })
})

export default app