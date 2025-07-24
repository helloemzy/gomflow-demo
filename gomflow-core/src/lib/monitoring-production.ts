// Production monitoring and error tracking configuration
import { createSupabaseAdminClient } from './supabase-production'

// Monitoring configuration
export interface MonitoringConfig {
  sentry?: {
    dsn: string
    environment: string
    tracesSampleRate: number
    profilesSampleRate: number
  }
  datadog?: {
    apiKey: string
    site: string
    service: string
    version: string
  }
  vercel?: {
    analyticsId: string
  }
  custom?: {
    endpoint: string
    apiKey: string
  }
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Performance metrics interface
export interface PerformanceMetrics {
  requestId: string
  method: string
  url: string
  duration: number
  statusCode: number
  userAgent: string
  ip: string
  userId?: string
  timestamp: string
  region: string
  memory?: number
  cpu?: number
}

// Error tracking interface
export interface ErrorEvent {
  id: string
  message: string
  stack?: string
  severity: ErrorSeverity
  context: Record<string, any>
  userId?: string
  sessionId?: string
  userAgent: string
  url: string
  timestamp: string
  fingerprint: string
}

// Business metrics interface
export interface BusinessMetrics {
  event: string
  userId?: string
  properties: Record<string, any>
  timestamp: string
}

class ProductionMonitoringService {
  private config: MonitoringConfig
  private supabase = createSupabaseAdminClient()
  
  constructor() {
    this.config = {
      sentry: process.env.SENTRY_DSN ? {
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'production',
        tracesSampleRate: 0.1, // 10% sampling for performance
        profilesSampleRate: 0.1
      } : undefined,
      datadog: process.env.DATADOG_API_KEY ? {
        apiKey: process.env.DATADOG_API_KEY,
        site: process.env.DATADOG_SITE || 'datadoghq.com',
        service: 'gomflow-core',
        version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'
      } : undefined,
      vercel: process.env.VERCEL_ANALYTICS_ID ? {
        analyticsId: process.env.VERCEL_ANALYTICS_ID
      } : undefined,
      custom: process.env.MONITORING_ENDPOINT ? {
        endpoint: process.env.MONITORING_ENDPOINT,
        apiKey: process.env.MONITORING_API_KEY || ''
      } : undefined
    }
  }

  // Initialize monitoring services
  async initialize(): Promise<void> {
    try {
      // Initialize Sentry if configured
      if (this.config.sentry && typeof window === 'undefined') {
        await this.initializeSentry()
      }

      // Initialize DataDog if configured
      if (this.config.datadog) {
        await this.initializeDataDog()
      }

      console.log('✅ Production monitoring initialized')
    } catch (error) {
      console.error('❌ Failed to initialize monitoring:', error)
    }
  }

  private async initializeSentry(): Promise<void> {
    try {
      // Dynamic import to avoid issues if Sentry is not installed
      const Sentry = await import('@sentry/nextjs')
      
      Sentry.init({
        dsn: this.config.sentry!.dsn,
        environment: this.config.sentry!.environment,
        tracesSampleRate: this.config.sentry!.tracesSampleRate,
        profilesSampleRate: this.config.sentry!.profilesSampleRate,
        
        beforeSend(event) {
          // Filter out noise and sensitive data
          if (event.exception) {
            const error = event.exception.values?.[0]
            
            // Skip certain error types
            if (error?.type === 'ChunkLoadError' || 
                error?.value?.includes('Loading chunk')) {
              return null
            }
          }
          
          // Remove sensitive headers
          if (event.request?.headers) {
            delete event.request.headers['authorization']
            delete event.request.headers['cookie']
          }
          
          return event
        },

        integrations: [
          new Sentry.Integrations.Http({ tracing: true }),
          new Sentry.Integrations.OnUncaughtException(),
          new Sentry.Integrations.OnUnhandledRejection()
        ]
      })

      console.log('✅ Sentry initialized')
    } catch (error) {
      console.error('❌ Failed to initialize Sentry:', error)
    }
  }

  private async initializeDataDog(): Promise<void> {
    try {
      // Initialize DataDog browser logs if in browser
      if (typeof window !== 'undefined') {
        const { datadogLogs } = await import('@datadog/browser-logs')
        
        datadogLogs.init({
          clientToken: this.config.datadog!.apiKey,
          site: this.config.datadog!.site,
          service: this.config.datadog!.service,
          version: this.config.datadog!.version,
          env: this.config.sentry?.environment || 'production',
          forwardErrorsToLogs: true,
          sampleRate: 20 // Sample 20% of logs
        })
      }

      console.log('✅ DataDog initialized')
    } catch (error) {
      console.error('❌ Failed to initialize DataDog:', error)
    }
  }

  // Track performance metrics
  async trackPerformance(metrics: PerformanceMetrics): Promise<void> {
    try {
      // Store in database for analysis
      await this.supabase
        .from('monitoring_metrics')
        .insert({
          type: 'performance',
          data: metrics,
          created_at: new Date().toISOString()
        })

      // Send to external monitoring services
      await Promise.allSettled([
        this.sendToDataDog('performance', metrics),
        this.sendToCustomEndpoint('performance', metrics)
      ])

      // Log slow requests
      if (metrics.duration > 2000) {
        console.warn(`🐌 Slow request: ${metrics.method} ${metrics.url} - ${metrics.duration}ms`)
      }
    } catch (error) {
      console.error('Failed to track performance metrics:', error)
    }
  }

  // Track errors
  async trackError(error: ErrorEvent): Promise<void> {
    try {
      // Store in database
      await this.supabase
        .from('monitoring_errors')
        .insert({
          error_id: error.id,
          message: error.message,
          stack: error.stack,
          severity: error.severity,
          context: error.context,
          user_id: error.userId,
          session_id: error.sessionId,
          user_agent: error.userAgent,
          url: error.url,
          fingerprint: error.fingerprint,
          created_at: error.timestamp
        })

      // Send to external error tracking
      await Promise.allSettled([
        this.sendToSentry(error),
        this.sendToDataDog('error', error),
        this.sendToCustomEndpoint('error', error)
      ])

      // Log critical errors immediately
      if (error.severity === ErrorSeverity.CRITICAL) {
        console.error(`🚨 CRITICAL ERROR: ${error.message}`)
        // In production, this could trigger immediate alerts
        await this.sendCriticalAlert(error)
      }
    } catch (err) {
      console.error('Failed to track error:', err)
    }
  }

  // Track business metrics
  async trackBusinessMetric(metric: BusinessMetrics): Promise<void> {
    try {
      // Store in database
      await this.supabase
        .from('analytics_events')
        .insert({
          event: metric.event,
          user_id: metric.userId,
          properties: metric.properties,
          created_at: metric.timestamp
        })

      // Send to analytics services
      await Promise.allSettled([
        this.sendToDataDog('business', metric),
        this.sendToCustomEndpoint('business', metric)
      ])
    } catch (error) {
      console.error('Failed to track business metric:', error)
    }
  }

  // Send critical alerts
  private async sendCriticalAlert(error: ErrorEvent): Promise<void> {
    try {
      // Send to Slack webhook if configured
      if (process.env.SLACK_WEBHOOK_URL) {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 CRITICAL ERROR in GOMFLOW`,
            attachments: [{
              color: 'danger',
              fields: [
                { title: 'Error', value: error.message, short: false },
                { title: 'URL', value: error.url, short: true },
                { title: 'User ID', value: error.userId || 'Anonymous', short: true },
                { title: 'Timestamp', value: error.timestamp, short: true }
              ]
            }]
          })
        })
      }

      // Send to Discord webhook if configured
      if (process.env.DISCORD_WEBHOOK_URL) {
        await fetch(process.env.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `🚨 **CRITICAL ERROR in GOMFLOW**`,
            embeds: [{
              title: 'Error Details',
              description: error.message,
              color: 0xff0000,
              fields: [
                { name: 'URL', value: error.url, inline: true },
                { name: 'User ID', value: error.userId || 'Anonymous', inline: true },
                { name: 'Timestamp', value: error.timestamp, inline: true }
              ]
            }]
          })
        })
      }
    } catch (err) {
      console.error('Failed to send critical alert:', err)
    }
  }

  // Send to Sentry
  private async sendToSentry(error: ErrorEvent): Promise<void> {
    try {
      if (!this.config.sentry) return

      const Sentry = await import('@sentry/nextjs')
      
      Sentry.withScope((scope) => {
        scope.setLevel(this.mapSeverityToSentryLevel(error.severity))
        scope.setUser({ id: error.userId })
        scope.setTag('url', error.url)
        scope.setContext('error_context', error.context)
        scope.setFingerprint([error.fingerprint])
        
        Sentry.captureException(new Error(error.message))
      })
    } catch (err) {
      console.error('Failed to send to Sentry:', err)
    }
  }

  // Send to DataDog
  private async sendToDataDog(type: string, data: any): Promise<void> {
    try {
      if (!this.config.datadog) return

      await fetch(`https://api.${this.config.datadog.site}/api/v1/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.config.datadog.apiKey
        },
        body: JSON.stringify({
          message: `GOMFLOW ${type}`,
          service: this.config.datadog.service,
          hostname: 'vercel',
          timestamp: new Date().toISOString(),
          level: type === 'error' ? 'error' : 'info',
          ...data
        })
      })
    } catch (err) {
      console.error('Failed to send to DataDog:', err)
    }
  }

  // Send to custom monitoring endpoint
  private async sendToCustomEndpoint(type: string, data: any): Promise<void> {
    try {
      if (!this.config.custom) return

      await fetch(this.config.custom.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.custom.apiKey}`
        },
        body: JSON.stringify({
          type,
          data,
          timestamp: new Date().toISOString(),
          service: 'gomflow-core'
        })
      })
    } catch (err) {
      console.error('Failed to send to custom endpoint:', err)
    }
  }

  // Utility methods
  private mapSeverityToSentryLevel(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.LOW: return 'info'
      case ErrorSeverity.MEDIUM: return 'warning'
      case ErrorSeverity.HIGH: return 'error'
      case ErrorSeverity.CRITICAL: return 'fatal'
      default: return 'error'
    }
  }

  // Generate error fingerprint for grouping
  generateErrorFingerprint(message: string, stack?: string, url?: string): string {
    const content = `${message}-${stack?.split('\n')[0] || ''}-${url || ''}`
    
    // Simple hash function
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36)
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      // Test database connection
      const { error } = await this.supabase
        .from('monitoring_metrics')
        .select('count')
        .limit(1)
        .maybeSingle()

      return !error
    } catch (error) {
      console.error('Monitoring health check failed:', error)
      return false
    }
  }

  // System metrics collection
  async collectSystemMetrics(): Promise<void> {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        platform: process.platform,
        version: process.version,
        env: process.env.NODE_ENV
      }

      await this.trackPerformance({
        requestId: 'system-metrics',
        method: 'SYSTEM',
        url: '/system/metrics',
        duration: 0,
        statusCode: 200,
        userAgent: 'system',
        ip: 'system',
        timestamp: metrics.timestamp,
        region: process.env.VERCEL_REGION || 'unknown',
        memory: metrics.memory.heapUsed,
        cpu: 0 // Would need additional library for CPU metrics
      })
    } catch (error) {
      console.error('Failed to collect system metrics:', error)
    }
  }
}

// Export singleton instance
export const monitoringService = new ProductionMonitoringService()

// Global error handlers for production
if (process.env.NODE_ENV === 'production') {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    monitoringService.trackError({
      id: `unhandled-${Date.now()}`,
      message: `Unhandled Promise Rejection: ${reason}`,
      severity: ErrorSeverity.HIGH,
      context: { promise: promise.toString() },
      userAgent: 'server',
      url: 'server',
      timestamp: new Date().toISOString(),
      fingerprint: monitoringService.generateErrorFingerprint(`unhandled-rejection-${reason}`)
    })
  })

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    monitoringService.trackError({
      id: `uncaught-${Date.now()}`,
      message: `Uncaught Exception: ${error.message}`,
      stack: error.stack,
      severity: ErrorSeverity.CRITICAL,
      context: { error: error.toString() },
      userAgent: 'server',
      url: 'server',
      timestamp: new Date().toISOString(),
      fingerprint: monitoringService.generateErrorFingerprint(error.message, error.stack)
    })
    
    // Give time for the error to be sent, then exit
    setTimeout(() => {
      process.exit(1)
    }, 1000)
  })

  // Collect system metrics every 5 minutes
  setInterval(() => {
    monitoringService.collectSystemMetrics()
  }, 5 * 60 * 1000)
}

// Helper functions for API routes
export function withMonitoring<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  options?: {
    trackPerformance?: boolean
    trackErrors?: boolean
  }
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now()
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    try {
      const response = await handler(...args)
      
      if (options?.trackPerformance !== false) {
        const request = args[0] as Request
        await monitoringService.trackPerformance({
          requestId,
          method: request.method,
          url: new URL(request.url).pathname,
          duration: Date.now() - startTime,
          statusCode: response.status,
          userAgent: request.headers.get('user-agent') || 'unknown',
          ip: request.headers.get('x-forwarded-for') || 'unknown',
          timestamp: new Date().toISOString(),
          region: process.env.VERCEL_REGION || 'unknown'
        })
      }
      
      return response
    } catch (error) {
      if (options?.trackErrors !== false) {
        const request = args[0] as Request
        await monitoringService.trackError({
          id: requestId,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          severity: ErrorSeverity.HIGH,
          context: {
            handler: handler.name,
            args: args.length
          },
          userAgent: request.headers.get('user-agent') || 'unknown',
          url: new URL(request.url).pathname,
          timestamp: new Date().toISOString(),
          fingerprint: monitoringService.generateErrorFingerprint(
            error instanceof Error ? error.message : 'unknown',
            error instanceof Error ? error.stack : undefined,
            new URL(request.url).pathname
          )
        })
      }
      
      throw error
    }
  }) as T
}

// Initialize monitoring on import
monitoringService.initialize()

export { ErrorSeverity, ProductionMonitoringService }