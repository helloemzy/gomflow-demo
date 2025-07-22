#!/usr/bin/env node

import { Config } from '@/config'
import { logger } from '@/utils/logger'
import TelegramBotApp from '@/app'

/**
 * Main server entry point
 */
async function main(): Promise<void> {
  try {
    // Log startup information
    logger.info('Starting GOMFLOW Telegram Bot Service...', {
      version: '1.0.0',
      environment: Config.NODE_ENV,
      port: Config.PORT,
      bot_features: {
        smart_payments: Config.botFeatures.smartPaymentDetection,
        inline_payments: Config.botFeatures.inlinePayments
      },
      webhook_url: Config.TELEGRAM_WEBHOOK_URL || 'polling mode'
    })

    // Validate critical environment variables
    validateEnvironment()

    // Create and start the application
    const app = new TelegramBotApp()
    await app.start()

    logger.info('✅ GOMFLOW Telegram Bot Service started successfully')

  } catch (error: any) {
    logger.error('❌ Failed to start GOMFLOW Telegram Bot Service', {
      error: error.message,
      stack: error.stack
    })
    process.exit(1)
  }
}

/**
 * Validate required environment variables
 */
function validateEnvironment(): void {
  const required = [
    'TELEGRAM_BOT_TOKEN',
    'SERVICE_SECRET',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'REDIS_URL'
  ]

  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    logger.error('Missing required environment variables', {
      missing_variables: missing
    })
    
    console.error('\n❌ Missing required environment variables:')
    missing.forEach(key => {
      console.error(`   - ${key}`)
    })
    console.error('\nPlease check your .env file and ensure all required variables are set.\n')
    
    process.exit(1)
  }

  // Validate Telegram bot token format
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (botToken && !/^\d+:[a-zA-Z0-9_-]+$/.test(botToken)) {
    logger.error('Invalid Telegram bot token format')
    console.error('\n❌ Invalid TELEGRAM_BOT_TOKEN format. Expected format: 123456789:ABCdefGhIJKlmNOpQRsTUVwxyz\n')
    process.exit(1)
  }

  // Validate service secret length
  const serviceSecret = process.env.SERVICE_SECRET
  if (serviceSecret && serviceSecret.length < 32) {
    logger.error('Service secret too short', {
      length: serviceSecret.length,
      minimum: 32
    })
    console.error('\n❌ SERVICE_SECRET must be at least 32 characters long\n')
    process.exit(1)
  }

  // Validate URLs
  const urls = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    TELEGRAM_WEBHOOK_URL: process.env.TELEGRAM_WEBHOOK_URL
  }

  Object.entries(urls).forEach(([key, value]) => {
    if (value && key !== 'TELEGRAM_WEBHOOK_URL') {
      try {
        new URL(value)
      } catch {
        logger.error(`Invalid URL format for ${key}`, { value })
        console.error(`\n❌ Invalid ${key} format. Must be a valid URL.\n`)
        process.exit(1)
      }
    }
  })

  logger.info('Environment validation passed ✅')
}

// Start the server
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error during startup:', error)
    process.exit(1)
  })
}

export default main