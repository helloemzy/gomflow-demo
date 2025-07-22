import dotenv from 'dotenv'
import { z } from 'zod'

// Load environment variables
dotenv.config()

// Configuration schema validation
const configSchema = z.object({
  // Service Configuration
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3003'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  SERVICE_SECRET: z.string().min(32, 'Service secret must be at least 32 characters'),

  // Database Configuration
  SUPABASE_URL: z.string().url('Invalid Supabase URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),

  // Redis Configuration
  REDIS_URL: z.string().url('Invalid Redis URL').default('redis://localhost:6379'),

  // Discord Bot Configuration
  DISCORD_BOT_TOKEN: z.string().min(1, 'Discord bot token is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'Discord client ID is required'),
  DISCORD_CLIENT_SECRET: z.string().min(1, 'Discord client secret is required'),
  INTERACTION_PUBLIC_KEY: z.string().min(1, 'Discord interaction public key is required'),

  // Service URLs
  CORE_API_URL: z.string().url().default('http://localhost:3000'),
  PAYMENT_SERVICE_URL: z.string().url().default('http://localhost:3004'),
  SMART_AGENT_SERVICE_URL: z.string().url().default('http://localhost:3005'),
  WHATSAPP_SERVICE_URL: z.string().url().default('http://localhost:3001'),
  TELEGRAM_SERVICE_URL: z.string().url().default('http://localhost:3002'),

  // File Upload Configuration
  MAX_FILE_SIZE: z.string().transform(Number).default('25165824'), // 24MB
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/webp,image/gif'),
  TEMP_UPLOAD_DIR: z.string().default('temp'),

  // Bot Features
  ENABLE_SLASH_COMMANDS: z.string().transform(val => val === 'true').default('true'),
  ENABLE_SMART_PAYMENT_DETECTION: z.string().transform(val => val === 'true').default('true'),
  AUTO_DELETE_PROCESSED_IMAGES: z.string().transform(val => val === 'true').default('true'),
  IMAGE_RETENTION_HOURS: z.string().transform(Number).default('24'),
  ENABLE_GUILD_COMMANDS: z.string().transform(val => val === 'true').default('true'),
  ENABLE_THREADING: z.string().transform(val => val === 'true').default('true'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'), // 1 minute
  RATE_LIMIT_MAX_MESSAGES: z.string().transform(Number).default('30'),
  RATE_LIMIT_MAX_UPLOADS: z.string().transform(Number).default('5'),
  RATE_LIMIT_MAX_COMMANDS: z.string().transform(Number).default('20'),

  // Security
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE: z.string().default('logs/discord-service.log'),

  // Queue Configuration
  QUEUE_CONCURRENCY: z.string().transform(Number).default('5'),
  MESSAGE_QUEUE_NAME: z.string().default('discord-messages'),
  NOTIFICATION_QUEUE_NAME: z.string().default('discord-notifications'),
  INTERACTION_QUEUE_NAME: z.string().default('discord-interactions'),

  // Bot Behavior
  DEFAULT_LANGUAGE: z.enum(['en', 'fil', 'ms']).default('en'),
  COMMAND_TIMEOUT_MS: z.string().transform(Number).default('30000'),
  INTERACTION_TIMEOUT_MS: z.string().transform(Number).default('15000'),
  MAX_CONCURRENT_INTERACTIONS: z.string().transform(Number).default('50'),

  // Discord-Specific Features
  EMBED_COLOR: z.string().default('#7C3AED'),
  EMBED_THUMBNAIL_URL: z.string().url().optional(),
  MAX_EMBED_FIELDS: z.string().transform(Number).default('25'),
  MAX_EMBED_DESCRIPTION_LENGTH: z.string().transform(Number).default('4096'),
  MAX_BUTTON_LABEL_LENGTH: z.string().transform(Number).default('80')
})

// Parse and validate configuration
const rawConfig = {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  SERVICE_SECRET: process.env.SERVICE_SECRET,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  REDIS_URL: process.env.REDIS_URL,
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  INTERACTION_PUBLIC_KEY: process.env.INTERACTION_PUBLIC_KEY,
  CORE_API_URL: process.env.CORE_API_URL,
  PAYMENT_SERVICE_URL: process.env.PAYMENT_SERVICE_URL,
  SMART_AGENT_SERVICE_URL: process.env.SMART_AGENT_SERVICE_URL,
  WHATSAPP_SERVICE_URL: process.env.WHATSAPP_SERVICE_URL,
  TELEGRAM_SERVICE_URL: process.env.TELEGRAM_SERVICE_URL,
  MAX_FILE_SIZE: process.env.MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES: process.env.ALLOWED_FILE_TYPES,
  TEMP_UPLOAD_DIR: process.env.TEMP_UPLOAD_DIR,
  ENABLE_SLASH_COMMANDS: process.env.ENABLE_SLASH_COMMANDS,
  ENABLE_SMART_PAYMENT_DETECTION: process.env.ENABLE_SMART_PAYMENT_DETECTION,
  AUTO_DELETE_PROCESSED_IMAGES: process.env.AUTO_DELETE_PROCESSED_IMAGES,
  IMAGE_RETENTION_HOURS: process.env.IMAGE_RETENTION_HOURS,
  ENABLE_GUILD_COMMANDS: process.env.ENABLE_GUILD_COMMANDS,
  ENABLE_THREADING: process.env.ENABLE_THREADING,
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_MESSAGES: process.env.RATE_LIMIT_MAX_MESSAGES,
  RATE_LIMIT_MAX_UPLOADS: process.env.RATE_LIMIT_MAX_UPLOADS,
  RATE_LIMIT_MAX_COMMANDS: process.env.RATE_LIMIT_MAX_COMMANDS,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  LOG_LEVEL: process.env.LOG_LEVEL,
  LOG_FILE: process.env.LOG_FILE,
  QUEUE_CONCURRENCY: process.env.QUEUE_CONCURRENCY,
  MESSAGE_QUEUE_NAME: process.env.MESSAGE_QUEUE_NAME,
  NOTIFICATION_QUEUE_NAME: process.env.NOTIFICATION_QUEUE_NAME,
  INTERACTION_QUEUE_NAME: process.env.INTERACTION_QUEUE_NAME,
  DEFAULT_LANGUAGE: process.env.DEFAULT_LANGUAGE,
  COMMAND_TIMEOUT_MS: process.env.COMMAND_TIMEOUT_MS,
  INTERACTION_TIMEOUT_MS: process.env.INTERACTION_TIMEOUT_MS,
  MAX_CONCURRENT_INTERACTIONS: process.env.MAX_CONCURRENT_INTERACTIONS,
  EMBED_COLOR: process.env.EMBED_COLOR,
  EMBED_THUMBNAIL_URL: process.env.EMBED_THUMBNAIL_URL,
  MAX_EMBED_FIELDS: process.env.MAX_EMBED_FIELDS,
  MAX_EMBED_DESCRIPTION_LENGTH: process.env.MAX_EMBED_DESCRIPTION_LENGTH,
  MAX_BUTTON_LABEL_LENGTH: process.env.MAX_BUTTON_LABEL_LENGTH
}

let config: z.infer<typeof configSchema>

try {
  config = configSchema.parse(rawConfig)
} catch (error) {
  console.error('❌ Invalid Discord service configuration:', error)
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
    slashCommands: config.ENABLE_SLASH_COMMANDS,
    smartPaymentDetection: config.ENABLE_SMART_PAYMENT_DETECTION,
    autoDeleteImages: config.AUTO_DELETE_PROCESSED_IMAGES,
    guildCommands: config.ENABLE_GUILD_COMMANDS,
    threading: config.ENABLE_THREADING
  },

  // Rate limiting settings
  rateLimits: {
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    maxMessages: config.RATE_LIMIT_MAX_MESSAGES,
    maxUploads: config.RATE_LIMIT_MAX_UPLOADS,
    maxCommands: config.RATE_LIMIT_MAX_COMMANDS
  },

  // Queue settings
  queues: {
    concurrency: config.QUEUE_CONCURRENCY,
    messageQueue: config.MESSAGE_QUEUE_NAME,
    notificationQueue: config.NOTIFICATION_QUEUE_NAME,
    interactionQueue: config.INTERACTION_QUEUE_NAME
  },

  // Bot behavior
  bot: {
    defaultLanguage: config.DEFAULT_LANGUAGE,
    commandTimeout: config.COMMAND_TIMEOUT_MS,
    interactionTimeout: config.INTERACTION_TIMEOUT_MS,
    maxConcurrentInteractions: config.MAX_CONCURRENT_INTERACTIONS
  },

  // Discord-specific settings
  discord: {
    embedColor: parseInt(config.EMBED_COLOR.replace('#', ''), 16),
    embedThumbnailUrl: config.EMBED_THUMBNAIL_URL,
    maxEmbedFields: config.MAX_EMBED_FIELDS,
    maxEmbedDescriptionLength: config.MAX_EMBED_DESCRIPTION_LENGTH,
    maxButtonLabelLength: config.MAX_BUTTON_LABEL_LENGTH
  },

  // Slash commands configuration
  commands: {
    // Order management commands
    order: {
      name: 'order',
      description: 'Manage group orders',
      subcommands: ['list', 'create', 'view', 'edit', 'delete']
    },
    submit: {
      name: 'submit',
      description: 'Submit an order for a group order',
      options: ['order_id', 'quantity', 'buyer_info']
    },
    pay: {
      name: 'pay',
      description: 'Upload payment screenshot or manage payments',
      subcommands: ['screenshot', 'status', 'history']
    },
    status: {
      name: 'status',
      description: 'Check order or payment status',
      options: ['order_id', 'submission_id']
    },
    manage: {
      name: 'manage',
      description: 'GOM management commands',
      subcommands: ['dashboard', 'analytics', 'export', 'notify']
    },
    notifications: {
      name: 'notifications',
      description: 'Manage notification settings',
      subcommands: ['settings', 'test', 'broadcast']
    },
    help: {
      name: 'help',
      description: 'Get help with GOMFLOW commands',
      options: ['command', 'topic']
    }
  }
}

export type AppConfig = typeof Config
export default Config