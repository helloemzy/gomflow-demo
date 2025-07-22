import { z } from 'zod';

const configSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(3008),
  HOST: z.string().default('0.0.0.0'),

  // Database Configuration
  SUPABASE_URL: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),

  // Redis Configuration
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // JWT Configuration
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('24h'),

  // Core API Configuration
  CORE_API_URL: z.string().default('http://localhost:3000'),
  CORE_API_SECRET: z.string(),

  // Monitoring Configuration
  METRICS_RETENTION_DAYS: z.string().transform(Number).default(30),
  METRICS_COLLECTION_INTERVAL: z.string().transform(Number).default(10), // seconds
  HEALTH_CHECK_INTERVAL: z.string().transform(Number).default(30), // seconds
  ALERT_CHECK_INTERVAL: z.string().transform(Number).default(60), // seconds

  // Service URLs for monitoring
  WHATSAPP_SERVICE_URL: z.string().default('http://localhost:3001'),
  TELEGRAM_SERVICE_URL: z.string().default('http://localhost:3002'),
  DISCORD_SERVICE_URL: z.string().default('http://localhost:3003'),
  PAYMENTS_SERVICE_URL: z.string().default('http://localhost:3004'),
  SMART_AGENT_SERVICE_URL: z.string().default('http://localhost:3005'),
  ANALYTICS_SERVICE_URL: z.string().default('http://localhost:3007'),

  // External Services
  NOTIFICATION_SERVICE_URL: z.string().default('http://localhost:3006'),
  NOTIFICATION_SERVICE_SECRET: z.string(),

  // Prometheus Configuration
  PROMETHEUS_ENABLED: z.string().transform(Boolean).default(true),
  PROMETHEUS_PREFIX: z.string().default('gomflow_'),

  // Alert Configuration
  ALERT_WEBHOOK_URL: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().optional(),
  DISCORD_WEBHOOK_URL: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default(1000),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Performance Thresholds
  CPU_THRESHOLD: z.string().transform(Number).default(80),
  MEMORY_THRESHOLD: z.string().transform(Number).default(85),
  DISK_THRESHOLD: z.string().transform(Number).default(90),
  RESPONSE_TIME_THRESHOLD: z.string().transform(Number).default(2000), // ms
  ERROR_RATE_THRESHOLD: z.string().transform(Number).default(5), // percentage
});

export type Config = z.infer<typeof configSchema>;

export const config: Config = (() => {
  try {
    return configSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingFields = error.errors
        .filter(e => e.code === 'invalid_type' && e.received === 'undefined')
        .map(e => e.path.join('.'));
      
      if (missingFields.length > 0) {
        throw new Error(
          `Missing required environment variables: ${missingFields.join(', ')}\n` +
          'Please check your .env file or environment configuration.'
        );
      }
    }
    throw error;
  }
})();

export default config;