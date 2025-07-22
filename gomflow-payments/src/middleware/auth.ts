import { Request, Response, NextFunction } from 'express'
import { Config } from '@/config'
import { logger } from '@/utils/logger'

/**
 * Service authentication middleware
 * Validates requests from other GOMFLOW services
 */
export const serviceAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  const serviceSecret = req.headers['x-service-secret'] as string

  // Check for service secret in header
  if (serviceSecret === Config.SERVICE_SECRET) {
    return next()
  }

  // Check for Bearer token (for service-to-service communication)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    if (token === Config.SERVICE_SECRET) {
      return next()
    }
  }

  logger.warn('Unauthorized service request', {
    ip: req.ip,
    path: req.path,
    user_agent: req.headers['user-agent']
  })

  res.status(401).json({
    success: false,
    error: 'Unauthorized'
  })
}

/**
 * Public endpoint middleware (no authentication required)
 */
export const publicAccess = (req: Request, res: Response, next: NextFunction) => {
  next()
}

/**
 * Webhook authentication middleware
 * For webhook endpoints that use signature verification
 */
export const webhookAuth = (req: Request, res: Response, next: NextFunction) => {
  // Webhooks are authenticated via signature verification in the controller
  // This middleware just logs the request for monitoring
  logger.info('Webhook request received', {
    ip: req.ip,
    path: req.path,
    user_agent: req.headers['user-agent'],
    content_length: req.headers['content-length']
  })
  
  next()
}