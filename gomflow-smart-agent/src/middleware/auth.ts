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

  logger.warn('Unauthorized Smart Agent request', {
    ip: req.ip,
    path: req.path,
    user_agent: req.headers['user-agent'],
    has_auth_header: !!authHeader,
    has_service_secret: !!serviceSecret
  })

  res.status(401).json({
    success: false,
    error: 'Unauthorized',
    message: 'Valid service authentication required'
  })
}

/**
 * Rate limiting middleware for AI processing
 */
export const rateLimitAI = (req: Request, res: Response, next: NextFunction) => {
  // TODO: Implement proper rate limiting for AI processing
  // This would prevent abuse of expensive AI/OCR operations
  
  logger.debug('AI processing request', {
    ip: req.ip,
    path: req.path,
    file_size: req.headers['content-length']
  })
  
  next()
}

/**
 * Request validation middleware for image processing
 */
export const validateImageRequest = (req: Request, res: Response, next: NextFunction) => {
  // Check if this is an image processing endpoint
  if (req.path === '/process') {
    // Validate content type for multipart/form-data
    if (!req.headers['content-type']?.includes('multipart/form-data')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid content type',
        message: 'Image processing requires multipart/form-data'
      })
    }

    // Check file size before processing
    const contentLength = parseInt(req.headers['content-length'] || '0')
    if (contentLength > Config.imageSettings.maxSize) {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        message: `Maximum file size: ${Config.imageSettings.maxSize / 1024 / 1024}MB`
      })
    }
  }

  next()
}