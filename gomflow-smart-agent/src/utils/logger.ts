import winston from 'winston'
import { Config } from '@/config'

// Create logger instance
export const logger = winston.createLogger({
  level: Config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      return JSON.stringify({
        level,
        message,
        timestamp,
        service: 'gomflow-smart-agent',
        ...meta
      })
    })
  ),
  defaultMeta: { 
    service: 'gomflow-smart-agent',
    version: '1.0.0'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
          return `${timestamp} [${level}] ${message}${metaStr}`
        })
      )
    })
  ]
})

// Add file transport for production
if (Config.isProduction) {
  logger.add(new winston.transports.File({
    filename: Config.LOG_FILE,
    maxsize: 10485760, // 10MB
    maxFiles: 5
  }))
}

// Add error file transport for errors
if (Config.isProduction || Config.isStaging) {
  logger.add(new winston.transports.File({
    filename: 'logs/smart-agent-error.log',
    level: 'error',
    maxsize: 10485760, // 10MB
    maxFiles: 5
  }))
}

export default logger