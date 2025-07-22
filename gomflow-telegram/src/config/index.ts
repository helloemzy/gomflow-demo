import dotenv from 'dotenv'
import { z } from 'zod'

// Load environment variables
dotenv.config()

// Configuration schema validation
const configSchema = z.object({
  // Service Configuration
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3002'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  SERVICE_SECRET: z.string().min(32, 'Service secret must be at least 32 characters'),

  // Database Configuration
  SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),

  // Redis Configuration
  REDIS_URL: z.string().url('Invalid Redis URL').default('redis://localhost:6379'),

  // Telegram Bot Configuration
  TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[a-zA-Z0-9_-]+$/, 'Invalid Telegram bot token format'),
  TELEGRAM_WEBHOOK_URL: z.string().url('Invalid webhook URL').optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16, 'Webhook secret must be at least 16 characters').optional(),

  // Service URLs
  CORE_API_URL: z.string().url().default('http://localhost:3000'),
  PAYMENT_SERVICE_URL: z.string().url().default('http://localhost:3004'),
  SMART_AGENT_SERVICE_URL: z.string().url().default('http://localhost:3005'),
  WHATSAPP_SERVICE_URL: z.string().url().default('http://localhost:3001'),
  DISCORD_SERVICE_URL: z.string().url().default('http://localhost:3003'),

  // File Upload Configuration
  MAX_FILE_SIZE: z.string().transform(Number).default('20971520'), // 20MB
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/webp'),
  TEMP_UPLOAD_DIR: z.string().default('temp'),

  // Bot Features
  ENABLE_INLINE_PAYMENTS: z.string().transform(val => val === 'true').default('true'),
  ENABLE_SMART_PAYMENT_DETECTION: z.string().transform(val => val === 'true').default('true'),
  AUTO_DELETE_PROCESSED_IMAGES: z.string().transform(val => val === 'true').default('true'),
  IMAGE_RETENTION_HOURS: z.string().transform(Number).default('24'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'), // 1 minute
  RATE_LIMIT_MAX_MESSAGES: z.string().transform(Number).default('30'),
  RATE_LIMIT_MAX_UPLOADS: z.string().transform(Number).default('5'),

  // Security
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  WEBHOOK_IP_WHITELIST: z.string().default('149.154.160.0/20,91.108.4.0/22'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('logs/telegram-service.log'),

  // Queue Configuration
  QUEUE_CONCURRENCY: z.string().transform(Number).default('5'),
  MESSAGE_QUEUE_NAME: z.string().default('telegram-messages'),
  NOTIFICATION_QUEUE_NAME: z.string().default('telegram-notifications'),

  // Bot Behavior
  DEFAULT_LANGUAGE: z.enum(['en', 'fil', 'ms']).default('en'),
  COMMAND_TIMEOUT_MS: z.string().transform(Number).default('30000'),
  SESSION_TIMEOUT_MINUTES: z.string().transform(Number).default('30'),
  MAX_CONCURRENT_SESSIONS: z.string().transform(Number).default('100')
})

// Parse and validate configuration
const rawConfig = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  SERVICE_SECRET: process.env.SERVICE_SECRET,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  REDIS_URL: process.env.REDIS_URL,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_WEBHOOK_URL: process.env.TELEGRAM_WEBHOOK_URL,
  TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
  CORE_API_URL: process.env.CORE_API_URL,
  PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL,
  SMART_AGENT_SERVICE_URL: process.env.SMART_AGENT_SERVICE_URL,
  WHATSAPP_SERVICE_URL: process.env.WHATSAPP_SERVICE_URL,
  DISCORD_SERVICE_URL: process.env.DISCORD_SERVICE_URL,
  MAX_FILE_SIZE: process.env.MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES: process.env.ALLOWED_FILE_TYPES,
  TEMP_UPLOAD_DIR: process.env.TEMP_UPLOAD_DIR,
  ENABLE_INLINE_PAYMENTS: process.env.ENABLE_INLINE_PAYMENTS,
  ENABLE_SMART_PAYMENT_DETECTION: process.env.ENABLE_SMART_PAYMENT_DETECTION,
  AUTO_DELETE_PROCESSED_IMAGES: process.env.AUTO_DELETE_PROCESSED_IMAGES,
  IMAGE_RETENTION_HOURS: process.env.IMAGE_RETENTION_HOURS,
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_MESSAGES: process.env.RATE_LIMIT_MAX_MESSAGES,
  RATE_LIMIT_MAX_UPLOADS: process.env.RATE_LIMIT_MAX_UPLOADS,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  WEBHOOK_IP_WHITELIST: process.env.WEBHOOK_IP_WHITELIST,
  LOG_LEVEL: process.env.LOG_LEVEL,
  LOG_FILE: process.env.LOG_FILE,
  QUEUE_CONCURRENCY: process.env.QUEUE_CONCURRENCY,
  MESSAGE_QUEUE_NAME: process.env.MESSAGE_QUEUE_NAME,
  NOTIFICATION_QUEUE_NAME: process.env.NOTIFICATION_QUEUE_NAME,
  DEFAULT_LANGUAGE: process.env.DEFAULT_LANGUAGE,
  COMMAND_TIMEOUT_MS: process.env.COMMAND_TIMEOUT_MS,
  SESSION_TIMEOUT_MINUTES: process.env.SESSION_TIMEOUT_MINUTES,
  MAX_CONCURRENT_SESSIONS: process.env.MAX_CONCURRENT_SESSIONS
}

let config: z.infer<typeof configSchema>

try {
  config = configSchema.parse(rawConfig)
} catch (error) {
  console.error('❌ Invalid configuration:', error)
  process.exit(1)
}

// Derived configuration
export const Config = {
  ...config,
  
  // Environment flags
  isDevelopment: config.NODE_ENV === 'development',
  isProduction: config.NODE_ENV === 'production',
  isStaging: config.NODE_ENV === 'staging',

  // File upload settings
  fileSettings: {
    maxSize: config.MAX_FILE_SIZE,
    allowedTypes: config.ALLOWED_FILE_TYPES.split(',').map(type => type.trim()),
    tempDir: config.TEMP_UPLOAD_DIR,
    retentionHours: config.IMAGE_RETENTION_HOURS
  },

  // Bot capabilities
  botFeatures: {
    inlinePayments: config.ENABLE_INLINE_PAYMENTS,
    smartPaymentDetection: config.ENABLE_SMART_PAYMENT_DETECTION,
    autoDeleteImages: config.AUTO_DELETE_PROCESSED_IMAGES
  },

  // Rate limiting settings
  rateLimits: {
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    maxMessages: config.RATE_LIMIT_MAX_MESSAGES,
    maxUploads: config.RATE_LIMIT_MAX_UPLOADS
  },

  // Queue settings
  queues: {
    concurrency: config.QUEUE_CONCURRENCY,
    messageQueue: config.MESSAGE_QUEUE_NAME,
    notificationQueue: config.NOTIFICATION_QUEUE_NAME
  },

  // Bot behavior
  bot: {
    defaultLanguage: config.DEFAULT_LANGUAGE,
    commandTimeout: config.COMMAND_TIMEOUT_MS,
    sessionTimeout: config.SESSION_TIMEOUT_MINUTES * 60 * 1000, // Convert to ms
    maxSessions: config.MAX_CONCURRENT_SESSIONS
  },

  // Security settings
  security: {
    webhookIPs: config.WEBHOOK_IP_WHITELIST.split(',').map(ip => ip.trim()),
    webhookSecret: config.TELEGRAM_WEBHOOK_SECRET
  },

  // Telegram bot commands
  commands: {
    // Public commands (available to all users)
    start: 'start',
    help: 'help',
    orders: 'orders',
    submit: 'submit',
    status: 'status',
    
    // GOM commands (for order managers)
    create: 'create',
    manage: 'manage',
    payments: 'payments',
    notify: 'notify',
    export: 'export',
    
    // Payment commands
    pay: 'pay',
    confirm: 'confirm',
    screenshot: 'screenshot',
    
    // Settings commands  
    settings: 'settings',
    language: 'language',
    cancel: 'cancel'
  }
}

export type AppConfig = typeof Config
export default Config