import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  // Service configuration
  port: process.env.PORT || 3001,
  env: process.env.NODE_ENV || 'development',
  
  // Twilio configuration
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886',
  },
  
  // Core API configuration
  coreApi: {
    url: process.env.CORE_API_URL || 'http://localhost:3000',
    secret: process.env.SERVICE_SECRET!,
  },
  
  // Redis configuration
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  // Webhook configuration
  webhook: {
    path: process.env.WEBHOOK_PATH || '/webhooks/whatsapp',
    validationToken: process.env.WEBHOOK_VALIDATION_TOKEN,
  },
};

// Validate required configuration
export function validateConfig() {
  const required = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'SERVICE_SECRET',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}