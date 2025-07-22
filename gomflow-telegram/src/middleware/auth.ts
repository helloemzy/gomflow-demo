import { Request, Response, NextFunction } from 'express'
import { Config } from '@/config'
import { logger } from '@/utils/logger'
import { sendErrorResponse } from './errorHandler'

/**
 * Service-to-service authentication middleware
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Skip auth for health checks and docs
    if (req.path.startsWith('/api/health') || req.path === '/docs' || req.path === '/ping') {
      return next()
    }

    // Get service secret from headers
    const serviceSecret = req.headers['x-service-secret'] as string
    
    if (!serviceSecret) {
      logger.warn('Missing service secret', {
        url: req.url,
        method: req.method,
        ip: req.ip,
        user_agent: req.get('User-Agent')
      })
      
      sendErrorResponse(
        res,
        401,
        'UNAUTHORIZED',
        'Service secret is required'
      )
      return
    }

    // Validate service secret
    if (serviceSecret !== Config.SERVICE_SECRET) {
      logger.warn('Invalid service secret', {
        url: req.url,
        method: req.method,
        ip: req.ip,
        provided_secret: serviceSecret.substring(0, 8) + '...',
        user_agent: req.get('User-Agent')
      })
      
      sendErrorResponse(
        res,
        403,
        'FORBIDDEN',
        'Invalid service secret'
      )
      return
    }

    // Log successful authentication
    logger.debug('Service authenticated', {
      url: req.url,
      method: req.method,
      ip: req.ip
    })

    next()
    
  } catch (error: any) {
    logger.error('Authentication middleware error', {
      error: error.message,
      url: req.url,
      method: req.method
    })
    
    sendErrorResponse(
      res,
      500,
      'INTERNAL_SERVER_ERROR',
      'Authentication error occurred'
    )
  }
}

/**
 * Optional authentication for internal health checks
 */
export function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const serviceSecret = req.headers['x-service-secret'] as string
  
  if (serviceSecret && serviceSecret === Config.SERVICE_SECRET) {
    // Mark as authenticated for enhanced features
    req.authenticated = true
  }
  
  next()
}

/**
 * Webhook authentication middleware for Telegram
 */
export function webhookAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Check webhook secret if configured
    if (Config.security.webhookSecret) {
      const webhookSecret = req.headers['x-telegram-bot-api-secret-token'] as string
      
      if (!webhookSecret) {
        logger.warn('Missing webhook secret', {
          ip: req.ip,
          user_agent: req.get('User-Agent')
        })
        
        sendErrorResponse(
          res,
          401,
          'UNAUTHORIZED',
          'Webhook secret is required'
        )
        return
      }
      
      if (webhookSecret !== Config.security.webhookSecret) {
        logger.warn('Invalid webhook secret', {
          ip: req.ip,
          provided_secret: webhookSecret.substring(0, 8) + '...',
          user_agent: req.get('User-Agent')
        })
        
        sendErrorResponse(
          res,
          403,
          'FORBIDDEN',
          'Invalid webhook secret'
        )
        return
      }
    }

    // Verify IP whitelist if configured
    if (Config.security.webhookIPs.length > 0) {
      const clientIP = req.ip || req.connection.remoteAddress
      const isAllowed = isIPInWhitelist(clientIP, Config.security.webhookIPs)
      
      if (!isAllowed) {
        logger.warn('Webhook request from unauthorized IP', {
          ip: clientIP,
          allowed_ips: Config.security.webhookIPs
        })
        
        sendErrorResponse(
          res,
          403,
          'FORBIDDEN',
          'IP address not authorized'
        )
        return
      }
    }

    next()
    
  } catch (error: any) {
    logger.error('Webhook authentication error', {
      error: error.message,
      ip: req.ip
    })
    
    sendErrorResponse(
      res,
      500,
      'INTERNAL_SERVER_ERROR',
      'Webhook authentication error'
    )
  }
}

/**
 * Check if IP is in whitelist (simplified CIDR matching)
 */
function isIPInWhitelist(clientIP: string | undefined, allowedIPs: string[]): boolean {
  if (!clientIP || allowedIPs.length === 0) {
    return true
  }

  return allowedIPs.some(allowedIP => {
    if (allowedIP.includes('/')) {
      // CIDR notation - simplified check
      const [network, mask] = allowedIP.split('/')
      const maskBits = parseInt(mask)
      
      // Simple prefix matching (in production, use proper CIDR library)
      const prefixLength = Math.ceil(maskBits / 8)
      const networkPrefix = network.split('.').slice(0, prefixLength).join('.')
      const clientPrefix = clientIP.split('.').slice(0, prefixLength).join('.')
      
      return clientPrefix === networkPrefix
    } else {
      // Exact IP match
      return clientIP === allowedIP
    }
  })
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      authenticated?: boolean
      id?: string
      startTime?: number
    }
  }
}