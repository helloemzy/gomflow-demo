import { createClient } from '@supabase/supabase-js';
import { createAdapter } from '@redis/client';
import { Queue } from 'bull';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import si from 'systeminformation';
import pidusage from 'pidusage';
import cron from 'node-cron';

import config from '../config';
import logger from '../utils/logger';
import {
  SystemMetrics,
  ServiceHealth,
  PerformanceMetrics,
  Alert,
  AlertType,
  AlertSeverity,
  AlertStatus,
  MonitoringServiceInterface,
  ServiceConfig,
  HealthCheckResult
} from '../types';

export class MonitoringService implements MonitoringServiceInterface {
  private supabase: any;
  private redis: any;
  private metricsQueue: Queue;
  private alertQueue: Queue;
  private initialized = false;
  private cronJobs: cron.ScheduledTask[] = [];
  private services: Record<string, ServiceConfig> = {};

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize Supabase client
      this.supabase = createClient(
        config.SUPABASE_URL,
        config.SUPABASE_SERVICE_ROLE_KEY
      );

      // Initialize Redis client
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

      // Initialize Bull queues
      this.metricsQueue = new Queue('monitoring-metrics', {
        redis: {
          host: config.REDIS_HOST,
          port: config.REDIS_PORT,
          password: config.REDIS_PASSWORD
        }
      });

      this.alertQueue = new Queue('monitoring-alerts', {
        redis: {
          host: config.REDIS_HOST,
          port: config.REDIS_PORT,
          password: config.REDIS_PASSWORD
        }
      });

      // Setup queue processors
      this.setupQueueProcessors();

      // Initialize services configuration
      this.initializeServices();

      // Setup cron jobs
      this.setupCronJobs();

      this.initialized = true;
      logger.info('Monitoring service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize monitoring service:', error);
      throw error;
    }
  }

  private initializeServices(): void {
    this.services = {
      'gomflow-core': {
        name: 'gomflow-core',
        url: config.CORE_API_URL,
        healthEndpoint: '/health',
        metricsEndpoint: '/metrics',
        checkInterval: 30,
        timeout: 5000,
        retries: 3,
        enabled: true
      },
      'gomflow-whatsapp': {
        name: 'gomflow-whatsapp',
        url: config.WHATSAPP_SERVICE_URL,
        healthEndpoint: '/health',
        checkInterval: 30,
        timeout: 5000,
        retries: 3,
        enabled: true
      },
      'gomflow-telegram': {
        name: 'gomflow-telegram',
        url: config.TELEGRAM_SERVICE_URL,
        healthEndpoint: '/health',
        checkInterval: 30,
        timeout: 5000,
        retries: 3,
        enabled: true
      },
      'gomflow-discord': {
        name: 'gomflow-discord',
        url: config.DISCORD_SERVICE_URL,
        healthEndpoint: '/health',
        checkInterval: 30,
        timeout: 5000,
        retries: 3,
        enabled: true
      },
      'gomflow-payments': {
        name: 'gomflow-payments',
        url: config.PAYMENTS_SERVICE_URL,
        healthEndpoint: '/health',
        checkInterval: 30,
        timeout: 5000,
        retries: 3,
        enabled: true
      },
      'gomflow-smart-agent': {
        name: 'gomflow-smart-agent',
        url: config.SMART_AGENT_SERVICE_URL,
        healthEndpoint: '/health',
        checkInterval: 30,
        timeout: 5000,
        retries: 3,
        enabled: true
      },
      'gomflow-analytics': {
        name: 'gomflow-analytics',
        url: config.ANALYTICS_SERVICE_URL,
        healthEndpoint: '/api/analytics/health',
        checkInterval: 30,
        timeout: 5000,
        retries: 3,
        enabled: true
      }
    };
  }

  private setupQueueProcessors(): void {
    // Process metrics collection
    this.metricsQueue.process('collect-metrics', async (job) => {
      await this.collectAndStoreMetrics();
    });

    // Process health checks
    this.metricsQueue.process('health-check', async (job) => {
      const { serviceName } = job.data;
      await this.performHealthCheck(serviceName);
    });

    // Process alert evaluation
    this.alertQueue.process('evaluate-alerts', async (job) => {
      await this.evaluateAllAlerts();
    });
  }

  private setupCronJobs(): void {
    // Collect system metrics every 10 seconds
    const metricsJob = cron.schedule(`*/${config.METRICS_COLLECTION_INTERVAL} * * * * *`, async () => {
      await this.metricsQueue.add('collect-metrics', {}, {
        attempts: 2,
        backoff: 'exponential'
      });
    });

    // Health checks every 30 seconds
    const healthJob = cron.schedule(`*/${config.HEALTH_CHECK_INTERVAL} * * * * *`, async () => {
      for (const serviceName of Object.keys(this.services)) {
        if (this.services[serviceName].enabled) {
          await this.metricsQueue.add('health-check', { serviceName }, {
            attempts: 3,
            backoff: 'exponential'
          });
        }
      }
    });

    // Alert evaluation every minute
    const alertJob = cron.schedule(`*/${config.ALERT_CHECK_INTERVAL} * * * * *`, async () => {
      await this.alertQueue.add('evaluate-alerts', {}, {
        attempts: 2,
        backoff: 'exponential'
      });
    });

    this.cronJobs = [metricsJob, healthJob, alertJob];
    logger.info('Monitoring cron jobs scheduled');
  }

  // Public Methods
  public async collectSystemMetrics(): Promise<SystemMetrics> {
    try {
      const [cpu, memory, disk, networkStats] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats()
      ]);

      const systemMetrics: SystemMetrics = {
        timestamp: new Date(),
        cpu: {
          usage: cpu.currentLoad,
          load: cpu.cpus?.map(c => c.load) || [],
          cores: cpu.cpus?.length || 0
        },
        memory: {
          total: memory.total,
          used: memory.used,
          free: memory.free,
          usage: (memory.used / memory.total) * 100
        },
        disk: {
          total: disk[0]?.size || 0,
          used: disk[0]?.used || 0,
          free: disk[0]?.available || 0,
          usage: disk[0]?.use || 0
        },
        network: {
          rx: networkStats[0]?.rx_bytes || 0,
          tx: networkStats[0]?.tx_bytes || 0
        }
      };

      return systemMetrics;
    } catch (error) {
      logger.error('Failed to collect system metrics:', error);
      throw error;
    }
  }

  public async checkServiceHealth(serviceName: string): Promise<ServiceHealth> {
    try {
      const serviceConfig = this.services[serviceName];
      if (!serviceConfig) {
        throw new Error(`Service configuration not found: ${serviceName}`);
      }

      const startTime = Date.now();
      const healthUrl = `${serviceConfig.url}${serviceConfig.healthEndpoint}`;

      try {
        const response = await axios.get(healthUrl, {
          timeout: serviceConfig.timeout,
          validateStatus: (status) => status < 500
        });

        const responseTime = Date.now() - startTime;
        const isHealthy = response.status >= 200 && response.status < 300;

        const serviceHealth: ServiceHealth = {
          serviceName,
          url: serviceConfig.url,
          status: isHealthy ? 'healthy' : 'degraded',
          responseTime,
          lastChecked: new Date(),
          uptime: this.calculateUptime(serviceName),
          version: response.data?.version,
          details: response.data,
          dependencies: await this.checkServiceDependencies(serviceName, response.data)
        };

        // Cache the health status
        await this.redis.setex(
          `health:${serviceName}`,
          60,
          JSON.stringify(serviceHealth)
        );

        return serviceHealth;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        
        const serviceHealth: ServiceHealth = {
          serviceName,
          url: serviceConfig.url,
          status: 'unhealthy',
          responseTime,
          lastChecked: new Date(),
          uptime: 0,
          details: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        };

        return serviceHealth;
      }
    } catch (error) {
      logger.error(`Failed to check health for ${serviceName}:`, error);
      throw error;
    }
  }

  public async getPerformanceMetrics(serviceName: string): Promise<PerformanceMetrics> {
    try {
      // Get cached metrics from Redis
      const cached = await this.redis.get(`performance:${serviceName}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // If no cached data, return default metrics
      const defaultMetrics: PerformanceMetrics = {
        serviceName,
        timestamp: new Date(),
        responseTime: {
          avg: 0,
          p50: 0,
          p95: 0,
          p99: 0
        },
        throughput: {
          rps: 0,
          rpm: 0
        },
        errors: {
          total: 0,
          rate: 0,
          byType: {}
        },
        database: {
          connections: 0,
          queries: {
            total: 0,
            avg_time: 0,
            slow_queries: 0
          }
        },
        queue: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0
        }
      };

      return defaultMetrics;
    } catch (error) {
      logger.error(`Failed to get performance metrics for ${serviceName}:`, error);
      throw error;
    }
  }

  public async createAlert(alertData: Omit<Alert, 'id' | 'createdAt' | 'updatedAt'>): Promise<Alert> {
    try {
      const alert: Alert = {
        id: uuidv4(),
        ...alertData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store alert in database
      const { error } = await this.supabase
        .from('monitoring_alerts')
        .insert({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          service: alert.service,
          title: alert.title,
          description: alert.description,
          threshold: alert.threshold,
          current_value: alert.currentValue,
          status: alert.status,
          metadata: alert.metadata || {},
          created_at: alert.createdAt.toISOString(),
          updated_at: alert.updatedAt.toISOString()
        });

      if (error) {
        throw new Error(`Failed to create alert: ${error.message}`);
      }

      // Cache alert for quick access
      await this.redis.setex(
        `alert:${alert.id}`,
        3600,
        JSON.stringify(alert)
      );

      logger.info('Alert created:', {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        service: alert.service
      });

      return alert;
    } catch (error) {
      logger.error('Failed to create alert:', error);
      throw error;
    }
  }

  public async resolveAlert(alertId: string): Promise<void> {
    try {
      const resolvedAt = new Date();

      // Update alert in database
      const { error } = await this.supabase
        .from('monitoring_alerts')
        .update({
          status: AlertStatus.RESOLVED,
          resolved_at: resolvedAt.toISOString(),
          updated_at: resolvedAt.toISOString()
        })
        .eq('id', alertId);

      if (error) {
        throw new Error(`Failed to resolve alert: ${error.message}`);
      }

      // Update cache
      const cached = await this.redis.get(`alert:${alertId}`);
      if (cached) {
        const alert = JSON.parse(cached);
        alert.status = AlertStatus.RESOLVED;
        alert.resolvedAt = resolvedAt;
        alert.updatedAt = resolvedAt;
        
        await this.redis.setex(
          `alert:${alertId}`,
          3600,
          JSON.stringify(alert)
        );
      }

      logger.info('Alert resolved:', { alertId });
    } catch (error) {
      logger.error('Failed to resolve alert:', error);
      throw error;
    }
  }

  // Private Helper Methods
  private async collectAndStoreMetrics(): Promise<void> {
    try {
      const systemMetrics = await this.collectSystemMetrics();
      
      // Store system metrics in database
      await this.supabase
        .from('monitoring_metrics')
        .insert({
          id: uuidv4(),
          service_name: 'system',
          metric_name: 'system_metrics',
          metric_value: 0, // We store the full object in labels
          labels: {
            cpu_usage: systemMetrics.cpu.usage,
            memory_usage: systemMetrics.memory.usage,
            disk_usage: systemMetrics.disk.usage,
            network_rx: systemMetrics.network.rx,
            network_tx: systemMetrics.network.tx
          },
          timestamp: systemMetrics.timestamp.toISOString()
        });

      // Cache current metrics
      await this.redis.setex(
        'metrics:system:current',
        300,
        JSON.stringify(systemMetrics)
      );

      logger.debug('System metrics collected and stored');
    } catch (error) {
      logger.error('Failed to collect and store metrics:', error);
    }
  }

  private async performHealthCheck(serviceName: string): Promise<void> {
    try {
      const health = await this.checkServiceHealth(serviceName);
      
      // Store health check result
      await this.supabase
        .from('monitoring_metrics')
        .insert({
          id: uuidv4(),
          service_name: serviceName,
          metric_name: 'health_check',
          metric_value: health.status === 'healthy' ? 1 : 0,
          labels: {
            status: health.status,
            response_time: health.responseTime,
            version: health.version || 'unknown'
          },
          timestamp: health.lastChecked.toISOString()
        });

      logger.debug(`Health check completed for ${serviceName}:`, {
        status: health.status,
        responseTime: health.responseTime
      });
    } catch (error) {
      logger.error(`Failed to perform health check for ${serviceName}:`, error);
    }
  }

  private async evaluateAllAlerts(): Promise<void> {
    try {
      // Get current system metrics
      const systemMetrics = await this.collectSystemMetrics();
      
      // Check CPU threshold
      if (systemMetrics.cpu.usage > config.CPU_THRESHOLD) {
        await this.createAlert({
          type: AlertType.CPU_HIGH,
          severity: AlertSeverity.HIGH,
          service: 'system',
          title: 'High CPU Usage',
          description: `CPU usage is ${systemMetrics.cpu.usage.toFixed(2)}%, above threshold of ${config.CPU_THRESHOLD}%`,
          threshold: config.CPU_THRESHOLD,
          currentValue: systemMetrics.cpu.usage,
          status: AlertStatus.ACTIVE
        });
      }

      // Check Memory threshold
      if (systemMetrics.memory.usage > config.MEMORY_THRESHOLD) {
        await this.createAlert({
          type: AlertType.MEMORY_HIGH,
          severity: AlertSeverity.HIGH,
          service: 'system',
          title: 'High Memory Usage',
          description: `Memory usage is ${systemMetrics.memory.usage.toFixed(2)}%, above threshold of ${config.MEMORY_THRESHOLD}%`,
          threshold: config.MEMORY_THRESHOLD,
          currentValue: systemMetrics.memory.usage,
          status: AlertStatus.ACTIVE
        });
      }

      // Check Disk threshold
      if (systemMetrics.disk.usage > config.DISK_THRESHOLD) {
        await this.createAlert({
          type: AlertType.DISK_FULL,
          severity: AlertSeverity.CRITICAL,
          service: 'system',
          title: 'Disk Space Low',
          description: `Disk usage is ${systemMetrics.disk.usage.toFixed(2)}%, above threshold of ${config.DISK_THRESHOLD}%`,
          threshold: config.DISK_THRESHOLD,
          currentValue: systemMetrics.disk.usage,
          status: AlertStatus.ACTIVE
        });
      }

      // Check service health
      for (const serviceName of Object.keys(this.services)) {
        const health = await this.checkServiceHealth(serviceName);
        
        if (health.status === 'unhealthy') {
          await this.createAlert({
            type: AlertType.SERVICE_DOWN,
            severity: AlertSeverity.CRITICAL,
            service: serviceName,
            title: `Service ${serviceName} is down`,
            description: `Service ${serviceName} is not responding to health checks`,
            threshold: 1,
            currentValue: 0,
            status: AlertStatus.ACTIVE
          });
        }

        if (health.responseTime > config.RESPONSE_TIME_THRESHOLD) {
          await this.createAlert({
            type: AlertType.RESPONSE_TIME_HIGH,
            severity: AlertSeverity.MEDIUM,
            service: serviceName,
            title: `High Response Time for ${serviceName}`,
            description: `Response time is ${health.responseTime}ms, above threshold of ${config.RESPONSE_TIME_THRESHOLD}ms`,
            threshold: config.RESPONSE_TIME_THRESHOLD,
            currentValue: health.responseTime,
            status: AlertStatus.ACTIVE
          });
        }
      }

      logger.debug('Alert evaluation completed');
    } catch (error) {
      logger.error('Failed to evaluate alerts:', error);
    }
  }

  private calculateUptime(serviceName: string): number {
    // This would typically calculate uptime based on historical health checks
    // For now, return a default value
    return 99.9;
  }

  private async checkServiceDependencies(serviceName: string, healthData: any): Promise<any[]> {
    // This would check service-specific dependencies
    // For now, return empty array
    return [];
  }

  public async shutdown(): Promise<void> {
    try {
      // Stop cron jobs
      this.cronJobs.forEach(job => job.stop());
      
      // Close queues
      await this.metricsQueue.close();
      await this.alertQueue.close();
      
      // Close Redis connection
      await this.redis.quit();
      
      logger.info('Monitoring service shut down successfully');
    } catch (error) {
      logger.error('Failed to shutdown monitoring service:', error);
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}

export default MonitoringService;