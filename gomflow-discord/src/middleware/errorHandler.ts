import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { DiscordBotError, InteractionError, ValidationError } from '../types';

interface ErrorResponse {
  error: string;
  message: string;
  details?: any;
  stack?: string;
  requestId?: string;
}

export function errorHandler(
  err: Error | DiscordBotError | InteractionError | ValidationError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  logger.error('Error handler caught:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Determine status code
  let statusCode = 500;
  let errorType = 'Internal Server Error';

  if (err instanceof ValidationError) {
    statusCode = 400;
    errorType = 'Validation Error';
  } else if (err instanceof InteractionError) {
    statusCode = err.message.includes('not found') ? 404 : 400;
    errorType = 'Interaction Error';
  } else if (err instanceof DiscordBotError) {
    statusCode = 500;
    errorType = 'Discord Bot Error';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorType = 'Unauthorized';
  } else if (err.name === 'ForbiddenError') {
    statusCode = 403;
    errorType = 'Forbidden';
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    error: errorType,
    message: err.message || 'An unexpected error occurred',
    requestId: req.id,
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  // Add validation details if available
  if (err instanceof ValidationError && err.details) {
    errorResponse.details = err.details;
  }

  // Send response
  res.status(statusCode).json(errorResponse);
}