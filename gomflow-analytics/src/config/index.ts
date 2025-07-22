import { z } from 'zod';

const configSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(3007),
  HOST: z.string().default('0.0.0.0'),

  // Database Configuration
  SUPABASE_URL: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),

  // Redis Configuration (for caching and job queue)
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

  // Analytics Configuration
  ANALYTICS_RETENTION_DAYS: z.string().transform(Number).default(365),
  ANALYTICS_AGGREGATION_INTERVAL: z.string().default('*/5 * * * *'), // Every 5 minutes
  ANALYTICS_CLEANUP_INTERVAL: z.string().default('0 0 * * *'), // Daily at midnight

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default(100),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // External Services
  NOTIFICATION_SERVICE_URL: z.string().default('http://localhost:3005'),
  NOTIFICATION_SERVICE_SECRET: z.string(),
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