import dotenv from 'dotenv'
import { z } from 'zod'

// Load environment variables
dotenv.config()

// Configuration schema validation
const configSchema = z.object({
  // Service Configuration
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3005'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  SERVICE_SECRET: z.string().min(32, 'Service secret must be at least 32 characters'),

  // Database Configuration
  SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),

  // Redis Configuration
  REDIS_URL: z.string().url('Invalid Redis URL').default('redis://localhost:6379'),

  // AI/ML Configuration
  OPENAI_API_KEY: z.string().startsWith('sk-', 'OpenAI API key must start with sk-'),
  OPENAI_MODEL: z.string().default('gpt-4-vision-preview'),
  OPENAI_MAX_TOKENS: z.string().transform(Number).default('1500'),

  // OCR Configuration
  TESSERACT_LANG: z.string().default('eng+fil+msa'), // English + Filipino + Malay
  OCR_CONFIDENCE_THRESHOLD: z.string().transform(Number).default('60'),

  // Image Processing
  MAX_IMAGE_SIZE: z.string().transform(Number).default('10485760'), // 10MB
  ALLOWED_IMAGE_TYPES: z.string().default('image/jpeg,image/png,image/webp'),
  IMAGE_QUALITY: z.string().transform(Number).default('85'),
  MAX_IMAGE_WIDTH: z.string().transform(Number).default('2048'),
  MAX_IMAGE_HEIGHT: z.string().transform(Number).default('2048'),

  // Payment Detection Thresholds
  MIN_CONFIDENCE_AUTO_MATCH: z.string().transform(Number).default('0.85'),
  MIN_CONFIDENCE_SUGGEST: z.string().transform(Number).default('0.60'),
  MIN_AMOUNT_THRESHOLD: z.string().transform(Number).default('1.00'),
  MAX_AMOUNT_THRESHOLD: z.string().transform(Number).default('100000.00'),

  // Service URLs
  CORE_API_URL: z.string().url().default('http://localhost:3000'),
  PAYMENT_SERVICE_URL: z.string().url().default('http://localhost:3004'),
  WHATSAPP_SERVICE_URL: z.string().url().default('http://localhost:3001'),
  TELEGRAM_SERVICE_URL: z.string().url().default('http://localhost:3002'),
  DISCORD_SERVICE_URL: z.string().url().default('http://localhost:3003'),

  // Security
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX: z.string().transform(Number).default('50'),

  // Queue Configuration
  QUEUE_CONCURRENCY: z.string().transform(Number).default('3'),
  QUEUE_MAX_ATTEMPTS: z.string().transform(Number).default('3'),
  QUEUE_BACKOFF_DELAY: z.string().transform(Number).default('5000'),

  // File Storage
  UPLOAD_DIR: z.string().default('uploads'),
  PROCESSED_DIR: z.string().default('processed'),
  TEMP_DIR: z.string().default('temp'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('logs/smart-agent.log'),

  // Monitoring
  ENABLE_METRICS: z.string().transform(val => val === 'true').default('true'),
  METRICS_PORT: z.string().transform(Number).default('9090')
})

// Parse and validate configuration
const rawConfig = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  SERVICE_SECRET: process.env.SERVICE_SECRET,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  REDIS_URL: process.env.REDIS_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_MAX_TOKENS: process.env.OPENAI_MAX_TOKENS,
  TESSERACT_LANG: process.env.TESSERACT_LANG,
  OCR_CONFIDENCE_THRESHOLD: process.env.OCR_CONFIDENCE_THRESHOLD,
  MAX_IMAGE_SIZE: process.env.MAX_IMAGE_SIZE,
  ALLOWED_IMAGE_TYPES: process.env.ALLOWED_IMAGE_TYPES,
  IMAGE_QUALITY: process.env.IMAGE_QUALITY,
  MAX_IMAGE_WIDTH: process.env.MAX_IMAGE_WIDTH,
  MAX_IMAGE_HEIGHT: process.env.MAX_IMAGE_HEIGHT,
  MIN_CONFIDENCE_AUTO_MATCH: process.env.MIN_CONFIDENCE_AUTO_MATCH,
  MIN_CONFIDENCE_SUGGEST: process.env.MIN_CONFIDENCE_SUGGEST,
  MIN_AMOUNT_THRESHOLD: process.env.MIN_AMOUNT_THRESHOLD,
  MAX_AMOUNT_THRESHOLD: process.env.MAX_AMOUNT_THRESHOLD,
  CORE_API_URL: process.env.CORE_API_URL,
  PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL,
  WHATSAPP_SERVICE_URL: process.env.WHATSAPP_SERVICE_URL,
  TELEGRAM_SERVICE_URL: process.env.TELEGRAM_SERVICE_URL,
  DISCORD_SERVICE_URL: process.env.DISCORD_SERVICE_URL,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
  QUEUE_CONCURRENCY: process.env.QUEUE_CONCURRENCY,
  QUEUE_MAX_ATTEMPTS: process.env.QUEUE_MAX_ATTEMPTS,
  QUEUE_BACKOFF_DELAY: process.env.QUEUE_BACKOFF_DELAY,
  UPLOAD_DIR: process.env.UPLOAD_DIR,
  PROCESSED_DIR: process.env.PROCESSED_DIR,
  TEMP_DIR: process.env.TEMP_DIR,
  LOG_LEVEL: process.env.LOG_LEVEL,
  LOG_FILE: process.env.LOG_FILE,
  ENABLE_METRICS: process.env.ENABLE_METRICS,
  METRICS_PORT: process.env.METRICS_PORT
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

  // Image processing settings
  imageSettings: {
    maxSize: config.MAX_IMAGE_SIZE,
    allowedTypes: config.ALLOWED_IMAGE_TYPES.split(',').map(type => type.trim()),
    quality: config.IMAGE_QUALITY,
    maxWidth: config.MAX_IMAGE_WIDTH,
    maxHeight: config.MAX_IMAGE_HEIGHT
  },

  // AI/ML settings
  aiSettings: {
    openai: {
      apiKey: config.OPENAI_API_KEY,
      model: config.OPENAI_MODEL,
      maxTokens: config.OPENAI_MAX_TOKENS
    },
    ocr: {
      languages: config.TESSERACT_LANG,
      confidenceThreshold: config.OCR_CONFIDENCE_THRESHOLD
    }
  },

  // Detection thresholds
  detectionThresholds: {
    autoMatch: config.MIN_CONFIDENCE_AUTO_MATCH,
    suggest: config.MIN_CONFIDENCE_SUGGEST,
    minAmount: config.MIN_AMOUNT_THRESHOLD,
    maxAmount: config.MAX_AMOUNT_THRESHOLD
  },

  // Queue settings
  queueSettings: {
    concurrency: config.QUEUE_CONCURRENCY,
    maxAttempts: config.QUEUE_MAX_ATTEMPTS,
    backoffDelay: config.QUEUE_BACKOFF_DELAY,
    queues: {
      imageProcessing: 'image-processing',
      paymentDetection: 'payment-detection',
      matchingEngine: 'matching-engine',
      notifications: 'notifications'
    }
  },

  // File paths
  paths: {
    uploads: config.UPLOAD_DIR,
    processed: config.PROCESSED_DIR,
    temp: config.TEMP_DIR
  },

  // Payment method patterns for different countries
  paymentPatterns: {
    PH: {
      gcash: {
        keywords: ['gcash', 'g-cash', 'globe cash'],
        numberPattern: /09\d{9}/,
        amountPattern: /₱?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g
      },
      paymaya: {
        keywords: ['paymaya', 'maya', 'pay maya'],
        numberPattern: /09\d{9}/,
        amountPattern: /₱?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g
      },
      bpi: {
        keywords: ['bpi', 'bank of the philippine islands'],
        numberPattern: /\d{4}\s?\d{4}\s?\d{4}/,
        amountPattern: /₱?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g
      }
    },
    MY: {
      maybank: {
        keywords: ['maybank', 'maybank2u'],
        numberPattern: /\d{12}/,
        amountPattern: /RM?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g
      },
      cimb: {
        keywords: ['cimb', 'cimb bank'],
        numberPattern: /\d{10,14}/,
        amountPattern: /RM?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g
      },
      tng: {
        keywords: ['touch n go', 'tng', 'touchngo'],
        numberPattern: /01\d{8,9}/,
        amountPattern: /RM?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g
      }
    }
  }
}

export type AppConfig = typeof Config
export default Config