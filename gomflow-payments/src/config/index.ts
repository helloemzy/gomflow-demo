import dotenv from 'dotenv'
import { z } from 'zod'

// Load environment variables
dotenv.config()

// Configuration schema validation
const configSchema = z.object({
  // Service Configuration
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3004'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  SERVICE_SECRET: z.string().min(32, 'Service secret must be at least 32 characters'),

  // Database Configuration
  SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),

  // Redis Configuration
  REDIS_URL: z.string().url('Invalid Redis URL').default('redis://localhost:6379'),

  // PayMongo Configuration
  PAYMONGO_SECRET_KEY: z.string().startsWith('sk_', 'PayMongo secret key must start with sk_'),
  PAYMONGO_WEBHOOK_SECRET: z.string().startsWith('whsec_', 'PayMongo webhook secret must start with whsec_'),
  PAYMONGO_API_URL: z.string().url().default('https://api.paymongo.com/v1'),

  // Billplz Configuration
  BILLPLZ_API_KEY: z.string().min(1, 'Billplz API key is required'),
  BILLPLZ_COLLECTION_ID: z.string().min(1, 'Billplz collection ID is required'),
  BILLPLZ_WEBHOOK_SECRET: z.string().min(1, 'Billplz webhook secret is required'),
  BILLPLZ_API_URL: z.string().url().default('https://www.billplz.com/api/v3'),

  // Service URLs
  CORE_API_URL: z.string().url().default('http://localhost:3000'),
  WHATSAPP_SERVICE_URL: z.string().url().default('http://localhost:3001'),
  TELEGRAM_SERVICE_URL: z.string().url().default('http://localhost:3002'),
  DISCORD_SERVICE_URL: z.string().url().default('http://localhost:3003'),

  // Webhook URLs
  WEBHOOK_BASE_URL: z.string().url('Webhook base URL is required for production'),
  PAYMONGO_WEBHOOK_URL: z.string().url().optional(),
  BILLPLZ_WEBHOOK_URL: z.string().url().optional(),

  // Security
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('logs/payment-service.log')
})

// Parse and validate configuration
const rawConfig = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  SERVICE_SECRET: process.env.SERVICE_SECRET,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  REDIS_URL: process.env.REDIS_URL,
  PAYMONGO_SECRET_KEY: process.env.PAYMONGO_SECRET_KEY,
  PAYMONGO_WEBHOOK_SECRET: process.env.PAYMONGO_WEBHOOK_SECRET,
  PAYMONGO_API_URL: process.env.PAYMONGO_API_URL,
  BILLPLZ_API_KEY: process.env.BILLPLZ_API_KEY,
  BILLPLZ_COLLECTION_ID: process.env.BILLPLZ_COLLECTION_ID,
  BILLPLZ_WEBHOOK_SECRET: process.env.BILLPLZ_WEBHOOK_SECRET,
  BILLPLZ_API_URL: process.env.BILLPLZ_API_URL,
  CORE_API_URL: process.env.CORE_API_URL,
  WHATSAPP_SERVICE_URL: process.env.WHATSAPP_SERVICE_URL,
  TELEGRAM_SERVICE_URL: process.env.TELEGRAM_SERVICE_URL,
  DISCORD_SERVICE_URL: process.env.DISCORD_SERVICE_URL,
  WEBHOOK_BASE_URL: process.env.WEBHOOK_BASE_URL,
  PAYMONGO_WEBHOOK_URL: process.env.PAYMONGO_WEBHOOK_URL,
  BILLPLZ_WEBHOOK_URL: process.env.BILLPLZ_WEBHOOK_URL,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
  LOG_LEVEL: process.env.LOG_LEVEL,
  LOG_FILE: process.env.LOG_FILE
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

  // Webhook URLs with fallbacks
  webhooks: {
    paymongo: config.PAYMONGO_WEBHOOK_URL || `${config.WEBHOOK_BASE_URL}/api/webhooks/paymongo`,
    billplz: config.BILLPLZ_WEBHOOK_URL || `${config.WEBHOOK_BASE_URL}/api/webhooks/billplz`
  },

  // Payment gateway configurations
  paymentGateways: {
    paymongo: {
      secretKey: config.PAYMONGO_SECRET_KEY,
      webhookSecret: config.PAYMONGO_WEBHOOK_SECRET,
      apiUrl: config.PAYMONGO_API_URL,
      country: 'PH' as const,
      currency: 'PHP' as const,
      supportedMethods: ['gcash', 'paymaya', 'grab_pay', 'card']
    },
    billplz: {
      apiKey: config.BILLPLZ_API_KEY,
      collectionId: config.BILLPLZ_COLLECTION_ID,
      webhookSecret: config.BILLPLZ_WEBHOOK_SECRET,
      apiUrl: config.BILLPLZ_API_URL,
      country: 'MY' as const,
      currency: 'MYR' as const,
      supportedMethods: ['fpx', 'bank_transfer', 'card']
    }
  },

  // Queue configurations
  queues: {
    webhookProcessing: 'webhook-processing',
    paymentConfirmation: 'payment-confirmation',
    paymentRefund: 'payment-refund'
  }
}

export type AppConfig = typeof Config
export default Config