import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';

export const validateRequest = (
  schema: z.ZodSchema<any>,
  property: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const dataToValidate = req[property];
      
      const result = schema.safeParse(dataToValidate);
      
      if (!result.success) {
        const errors = result.error.errors.map(error => ({
          field: error.path.join('.'),
          message: error.message,
          code: error.code
        }));

        logger.debug('Validation failed:', { errors, data: dataToValidate });

        res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: 'Request validation failed',
          details: errors
        });
        return;
      }

      // Replace the original data with validated/transformed data
      req[property] = result.data;
      next();
    } catch (error) {
      logger.error('Validation middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Validation error',
        message: error instanceof Error ? error.message : 'Unknown validation error'
      });
    }
  };
};

// Custom validation for analytics events
export const validateAnalyticsEvent = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { type, data } = req.body;
    
    if (!type) {
      res.status(400).json({
        success: false,
        error: 'Missing event type',
        message: 'Event type is required'
      });
      return;
    }

    // Validate event-specific data based on type
    switch (type) {
      case 'order_created':
        if (!data.orderId) {
          res.status(400).json({
            success: false,
            error: 'Missing order ID',
            message: 'Order ID is required for order events'
          });
          return;
        }
        break;
        
      case 'submission_created':
      case 'submission_payment_verified':
      case 'submission_payment_rejected':
        if (!data.submissionId) {
          res.status(400).json({
            success: false,
            error: 'Missing submission ID',
            message: 'Submission ID is required for submission events'
          });
          return;
        }
        break;
        
      case 'user_registered':
      case 'user_login':
        if (!data.userId) {
          res.status(400).json({
            success: false,
            error: 'Missing user ID',
            message: 'User ID is required for user events'
          });
          return;
        }
        break;
    }

    next();
  } catch (error) {
    logger.error('Analytics event validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation error',
      message: error instanceof Error ? error.message : 'Unknown validation error'
    });
  }
};

// Validate date range
export const validateDateRange = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { startDate, endDate } = req.query;
    
    if (startDate && endDate) {
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format',
          message: 'Please provide valid ISO 8601 date strings'
        });
        return;
      }
      
      if (start >= end) {
        res.status(400).json({
          success: false,
          error: 'Invalid date range',
          message: 'Start date must be before end date'
        });
        return;
      }
      
      // Limit date range to prevent excessive queries
      const maxRangeMs = 90 * 24 * 60 * 60 * 1000; // 90 days
      if (end.getTime() - start.getTime() > maxRangeMs) {
        res.status(400).json({
          success: false,
          error: 'Date range too large',
          message: 'Date range cannot exceed 90 days'
        });
        return;
      }
    }

    next();
  } catch (error) {
    logger.error('Date range validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation error',
      message: error instanceof Error ? error.message : 'Unknown validation error'
    });
  }
};

// Validate pagination parameters
export const validatePagination = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { page = '1', limit = '50' } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    
    if (isNaN(pageNum) || pageNum < 1) {
      res.status(400).json({
        success: false,
        error: 'Invalid page number',
        message: 'Page must be a positive integer'
      });
      return;
    }
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 1000) {
      res.status(400).json({
        success: false,
        error: 'Invalid limit',
        message: 'Limit must be between 1 and 1000'
      });
      return;
    }
    
    // Add validated pagination to request
    req.pagination = {
      page: pageNum,
      limit: limitNum,
      offset: (pageNum - 1) * limitNum
    };

    next();
  } catch (error) {
    logger.error('Pagination validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation error',
      message: error instanceof Error ? error.message : 'Unknown validation error'
    });
  }
};

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      pagination?: {
        page: number;
        limit: number;
        offset: number;
      };
    }
  }
}

export default validateRequest;