import { Request, Response, NextFunction } from 'express'
import { logger } from '@/utils/logger'
import { TelegramBotError, RateLimitError, ValidationError } from '@/types'

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  logger.error('API Error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    user_agent: req.get('User-Agent'),
    request_id: req.id
  })

  // Handle specific error types
  if (err instanceof TelegramBotError) {
    res.status(400).json({
      success: false,
      error: err.code,
      message: err.message,
      chat_id: err.chatId,
      user_id: err.userId
    })
    return
  }

  if (err instanceof RateLimitError) {
    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: err.message,
      chat_id: err.chatId
    })
    return
  }

  if (err instanceof ValidationError) {
    res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: err.message,
      chat_id: err.chatId
    })
    return
  }

  // Handle JSON syntax errors
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({
      success: false,
      error: 'INVALID_JSON',
      message: 'Invalid JSON in request body'
    })
    return
  }

  // Handle MongoDB/Database errors
  if (err.name === 'MongoError' || err.name === 'MongooseError') {
    res.status(500).json({
      success: false,
      error: 'DATABASE_ERROR',
      message: 'Database operation failed'
    })
    return
  }

  // Handle Redis errors
  if (err.message.includes('Redis') || err.message.includes('ECONNREFUSED')) {
    res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Queue service temporarily unavailable'
    })
    return
  }

  // Handle Telegram API errors
  if (err.message.includes('Telegram') || err.message.includes('Bot')) {
    res.status(502).json({
      success: false,
      error: 'TELEGRAM_API_ERROR',
      message: 'Telegram API error occurred'
    })
    return
  }

  // Handle timeout errors
  if (err.message.includes('timeout') || err.code === 'ETIMEDOUT') {
    res.status(504).json({
      success: false,
      error: 'TIMEOUT',
      message: 'Request timeout'
    })
    return
  }

  // Handle file upload errors
  if (err.message.includes('Multipart') || err.message.includes('File too large')) {
    res.status(413).json({
      success: false,
      error: 'FILE_TOO_LARGE',
      message: 'Uploaded file is too large'
    })
    return
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
    request_id: req.id
  })
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.warn('Route not found', {
    url: req.url,
    method: req.method,
    ip: req.ip,
    user_agent: req.get('User-Agent')
  })

  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.url} not found`,
    available_endpoints: {
      webhook: '/api/webhook',
      health: '/api/health',
      notifications: '/api/notifications',
      docs: '/docs'
    }
  })
}

/**
 * Async error wrapper for route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * Validation error formatter
 */
export function formatValidationError(errors: any[]): string {
  return errors
    .map(err => `${err.path?.join('.')} ${err.message}`)
    .join(', ')
}

/**
 * Error response helper
 */
export function sendErrorResponse(
  res: Response,
  statusCode: number,
  error: string,
  message?: string,
  details?: any
): void {
  res.status(statusCode).json({
    success: false,
    error,
    message: message || error,
    ...(details && { details })
  })
}