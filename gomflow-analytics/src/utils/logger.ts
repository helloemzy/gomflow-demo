import winston from 'winston';
import config from '../config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue'
};

// Add colors to winston
winston.addColors(colors);

// Create custom format
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Create console format for development
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} ${level}: ${message}`;
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }
    
    return log;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  levels,
  format: customFormat,
  transports: [
    // Console transport with different format for development
    new winston.transports.Console({
      format: config.NODE_ENV === 'development' ? consoleFormat : customFormat
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: 'logs/exceptions.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: 'logs/rejections.log',
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Add request ID to logs (if present)
logger.addRequestId = (requestId: string) => {
  return logger.child({ requestId });
};

// Add analytics-specific logging methods
logger.analytics = {
  event: (eventType: string, data: any) => {
    logger.info('Analytics event', {
      type: 'analytics_event',
      eventType,
      data
    });
  },
  
  metric: (metricName: string, value: number, dimensions?: any) => {
    logger.info('Analytics metric', {
      type: 'analytics_metric',
      metricName,
      value,
      dimensions
    });
  },
  
  error: (operation: string, error: Error, context?: any) => {
    logger.error('Analytics error', {
      type: 'analytics_error',
      operation,
      error: error.message,
      stack: error.stack,
      context
    });
  },
  
  performance: (operation: string, duration: number, metadata?: any) => {
    logger.info('Analytics performance', {
      type: 'analytics_performance',
      operation,
      duration,
      metadata
    });
  }
};

// Extend logger interface
declare module 'winston' {
  interface Logger {
    addRequestId: (requestId: string) => winston.Logger;
    analytics: {
      event: (eventType: string, data: any) => void;
      metric: (metricName: string, value: number, dimensions?: any) => void;
      error: (operation: string, error: Error, context?: any) => void;
      performance: (operation: string, duration: number, metadata?: any) => void;
    };
  }
}

// Create logs directory if it doesn't exist
if (typeof window === 'undefined') {
  const fs = require('fs');
  const path = require('path');
  
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

export default logger;