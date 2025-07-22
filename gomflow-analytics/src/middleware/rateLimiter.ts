import { Request, Response, NextFunction } from 'express';
import { createAdapter } from '@redis/client';
import config from '../config';
import logger from '../utils/logger';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

class RateLimiter {
  private redis: any;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      if (config.REDIS_URL) {
        this.redis = createAdapter({ url: config.REDIS_URL });
      } else {
        this.redis = createAdapter({
          socket: {
            host: config.REDIS_HOST,
            port: config.REDIS_PORT
          },
          password: config.REDIS_PASSWORD
        });
      }

      await this.redis.connect();
      this.initialized = true;
      logger.info('Rate limiter initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize rate limiter:', error);
      throw error;
    }
  }

  public createLimiter(rateLimitConfig: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!this.initialized) {
          logger.warn('Rate limiter not initialized, skipping rate limiting');
          next();
          return;
        }

        const {
          windowMs,
          maxRequests,
          keyGenerator = (req: Request) => req.ip,
          skipSuccessfulRequests = false,
          skipFailedRequests = false
        } = rateLimitConfig;

        const key = `rate_limit:${keyGenerator(req)}`;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean up old entries and count current requests
        const pipeline = this.redis.multi();
        pipeline.zremrangebyscore(key, 0, windowStart);
        pipeline.zcard(key);
        pipeline.expire(key, Math.ceil(windowMs / 1000));
        
        const results = await pipeline.exec();
        const currentRequests = results[1][1];

        if (currentRequests >= maxRequests) {
          const resetTime = new Date(now + windowMs);
          
          res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            message: `Too many requests. Try again at ${resetTime.toISOString()}`,
            retryAfter: Math.ceil(windowMs / 1000)
          });
          
          res.set({
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetTime.toISOString()
          });
          
          return;
        }

        // Add current request to the sliding window
        await this.redis.zadd(key, now, `${now}-${Math.random()}`);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': (maxRequests - currentRequests - 1).toString(),
          'X-RateLimit-Reset': new Date(now + windowMs).toISOString()
        });

        next();
      } catch (error) {
        logger.error('Rate limiter error:', error);
        // Fail open - don't block requests if rate limiter fails
        next();
      }
    };
  }

  public async shutdown(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.quit();
      }
      logger.info('Rate limiter shut down successfully');
    } catch (error) {
      logger.error('Failed to shutdown rate limiter:', error);
    }
  }
}

const rateLimiter = new RateLimiter();

// Default rate limiter (100 requests per 15 minutes)
export const defaultRateLimit = rateLimiter.createLimiter({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  maxRequests: config.RATE_LIMIT_MAX_REQUESTS
});

// Strict rate limiter for sensitive endpoints (10 requests per 15 minutes)
export const strictRateLimit = rateLimiter.createLimiter({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  maxRequests: 10
});

// Per-user rate limiter
export const userRateLimit = rateLimiter.createLimiter({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise fall back to IP
    const user = (req as any).user;
    return user ? `user:${user.id}` : `ip:${req.ip}`;
  }
});

// Event tracking rate limiter (higher limits for analytics)
export const eventTrackingRateLimit = rateLimiter.createLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 1000, // 1000 events per minute
  keyGenerator: (req: Request) => {
    const user = (req as any).user;
    return user ? `events:user:${user.id}` : `events:ip:${req.ip}`;
  }
});

// Export rate limiter for custom configurations
export { rateLimiter };

export default defaultRateLimit;