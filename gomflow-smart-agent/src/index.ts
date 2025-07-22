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
  allowedHeaders: ['Content-Type', 'Authorization', 'x-service-secret']
}))

// Body parsing middleware (with larger limits for image uploads)
app.use(express.json({ 
  limit: '50mb',
  verify: (req: any, res, buf) => {
    req.rawBody = buf.toString('utf8')
  }
}))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

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
    service: 'GOMFLOW Smart Payment Agent',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: Config.NODE_ENV,
    capabilities: [
      'Payment screenshot analysis',
      'OCR text extraction',
      'AI-powered payment detection',
      'Automatic submission matching',
      'Confidence scoring',
      'Manual review workflow'
    ]
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
    method: req.method,
    available_endpoints: [
      'POST /api/process - Process payment screenshot',
      'POST /api/review - Review detection result',
      'GET /api/stats - Get processing statistics',
      'GET /api/status - Get service status',
      'GET /api/health - Health check'
    ]
  })
})

// Global error handler
app.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body ? '[REQUEST_BODY_PRESENT]' : '[NO_BODY]',
    request_id: req.id
  })

  // Handle multer errors
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File too large',
      message: `Maximum file size: ${Config.imageSettings.maxSize / 1024 / 1024}MB`,
      request_id: req.id
    })
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'Unexpected file upload',
      message: 'Only single image uploads are allowed',
      request_id: req.id
    })
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: Config.isDevelopment ? error.message : 'An unexpected error occurred',
    request_id: req.id
  })
})

// Graceful shutdown handler
const gracefulShutdown = (signal: string) => {
  return (code: any) => {
    logger.info(`Received ${signal}, shutting down gracefully`, { code })
    
    // TODO: Cleanup payment processor resources
    // paymentProcessor.cleanup()
    
    server.close(() => {
      logger.info('HTTP server closed')
      process.exit(0)
    })

    // Force close after 30 seconds (longer for AI processing)
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down')
      process.exit(1)
    }, 30000)
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
  logger.info(`🤖 GOMFLOW Smart Payment Agent started`, {
    port: Config.PORT,
    environment: Config.NODE_ENV,
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })

  // Log configuration (redacted)
  logger.info('Smart Agent configuration loaded', {
    port: Config.PORT,
    environment: Config.NODE_ENV,
    cors_origin: Config.CORS_ORIGIN,
    max_image_size: `${Config.imageSettings.maxSize / 1024 / 1024}MB`,
    allowed_image_types: Config.imageSettings.allowedTypes.length,
    ocr_languages: Config.aiSettings.ocr.languages,
    ai_model: Config.aiSettings.openai.model,
    auto_match_threshold: Config.detectionThresholds.autoMatch,
    suggest_threshold: Config.detectionThresholds.suggest,
    openai_configured: !!Config.aiSettings.openai.apiKey,
    supabase_configured: !!Config.SUPABASE_URL
  })

  // Log AI capabilities
  logger.info('AI capabilities initialized', {
    vision_model: Config.aiSettings.openai.model,
    max_tokens: Config.aiSettings.openai.maxTokens,
    ocr_languages: Config.aiSettings.ocr.languages.split('+'),
    supported_currencies: ['PHP', 'MYR'],
    supported_methods: ['GCash', 'PayMaya', 'BPI', 'Maybank', 'CIMB', 'Touch n Go'],
    confidence_thresholds: {
      auto_approve: `≥${Config.detectionThresholds.autoMatch * 100}%`,
      suggest_match: `≥${Config.detectionThresholds.suggest * 100}%`,
      manual_review: `<${Config.detectionThresholds.suggest * 100}%`
    }
  })
})

export default app