import { createClient } from '@supabase/supabase-js';
import { createAdapter } from '@redis/client';
import { v4 as uuidv4 } from 'uuid';
import { subDays, format } from 'date-fns';
import { groupBy, meanBy, maxBy, minBy } from 'lodash';

import config from '../config';
import logger from '../utils/logger';
import {
  Dashboard,
  DashboardWidget,
  TimeSeriesData,
  SystemMetrics,
  ServiceHealth,
  Alert,
  AlertSeverity
} from '../types';

export class DashboardService {
  private supabase: any;
  private redis: any;
  private initialized = false;

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

      this.initialized = true;
      logger.info('Dashboard service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize dashboard service:', error);
      throw error;
    }
  }

  // Dashboard Management
  public async createDashboard(
    name: string,
    description: string,
    widgets: DashboardWidget[],
    createdBy: string,
    isPublic: boolean = false
  ): Promise<Dashboard> {
    try {
      const dashboard: Dashboard = {
        id: uuidv4(),
        name,
        description,
        widgets,
        isPublic,
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store dashboard in database
      const { error } = await this.supabase
        .from('monitoring_dashboards')
        .insert({
          id: dashboard.id,
          name: dashboard.name,
          description: dashboard.description,
          widgets: dashboard.widgets,
          is_public: dashboard.isPublic,
          created_by: dashboard.createdBy,
          created_at: dashboard.createdAt.toISOString(),
          updated_at: dashboard.updatedAt.toISOString()
        });

      if (error) {
        throw new Error(`Failed to create dashboard: ${error.message}`);
      }

      logger.info('Dashboard created:', { id: dashboard.id, name: dashboard.name });
      return dashboard;
    } catch (error) {
      logger.error('Failed to create dashboard:', error);
      throw error;
    }
  }

  public async getDashboard(dashboardId: string): Promise<Dashboard | null> {
    try {
      // Try to get from cache first
      const cached = await this.redis.get(`dashboard:${dashboardId}`);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get from database
      const { data, error } = await this.supabase
        .from('monitoring_dashboards')
        .select('*')
        .eq('id', dashboardId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new Error(`Failed to get dashboard: ${error.message}`);
      }

      const dashboard: Dashboard = {
        id: data.id,
        name: data.name,
        description: data.description,
        widgets: data.widgets,
        isPublic: data.is_public,
        createdBy: data.created_by,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      // Cache for 5 minutes
      await this.redis.setex(
        `dashboard:${dashboardId}`,
        300,
        JSON.stringify(dashboard)
      );

      return dashboard;
    } catch (error) {
      logger.error('Failed to get dashboard:', error);
      throw error;
    }
  }

  public async getSystemOverview(): Promise<any> {
    try {
      // Check cache first
      const cached = await this.redis.get('dashboard:system_overview');
      if (cached) {
        return JSON.parse(cached);
      }

      // Get current system metrics
      const currentMetrics = await this.redis.get('metrics:system:current');
      const systemMetrics: SystemMetrics = currentMetrics 
        ? JSON.parse(currentMetrics)
        : null;

      // Get service health status
      const serviceHealth = await this.getAllServiceHealth();

      // Get active alerts
      const { data: alertsData } = await this.supabase
        .from('monitoring_alerts')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(10);

      const alerts = (alertsData || []).map((alert: any) => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        service: alert.service,
        title: alert.title,
        createdAt: new Date(alert.created_at)
      }));

      // Count alerts by severity
      const alertCounts = {
        critical: alerts.filter(a => a.severity === AlertSeverity.CRITICAL).length,
        high: alerts.filter(a => a.severity === AlertSeverity.HIGH).length,
        medium: alerts.filter(a => a.severity === AlertSeverity.MEDIUM).length,
        low: alerts.filter(a => a.severity === AlertSeverity.LOW).length
      };

      // Calculate overall system health
      const healthyServices = serviceHealth.filter(s => s.status === 'healthy').length;
      const totalServices = serviceHealth.length;
      const systemHealthPercentage = totalServices > 0 ? (healthyServices / totalServices) * 100 : 100;

      const overview = {
        timestamp: new Date(),
        systemMetrics,
        serviceHealth,
        alerts: {
          total: alerts.length,
          counts: alertCounts,
          recent: alerts.slice(0, 5)
        },
        systemHealth: {
          percentage: systemHealthPercentage,
          healthyServices,
          totalServices,
          status: systemHealthPercentage >= 90 ? 'healthy' : 
                  systemHealthPercentage >= 70 ? 'degraded' : 'unhealthy'
        },
        summary: {
          uptime: '99.9%', // This would be calculated from historical data
          avgResponseTime: this.calculateAverageResponseTime(serviceHealth),
          totalRequests: 0, // This would come from analytics
          errorRate: 0 // This would come from analytics
        }
      };

      // Cache for 30 seconds
      await this.redis.setex(
        'dashboard:system_overview',
        30,
        JSON.stringify(overview)
      );

      return overview;
    } catch (error) {
      logger.error('Failed to get system overview:', error);
      throw error;
    }
  }

  public async getServiceMetrics(serviceName: string, timeRange: string = '1h'): Promise<any> {
    try {
      const cacheKey = `dashboard:service_metrics:${serviceName}:${timeRange}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Calculate time range
      const endTime = new Date();
      const startTime = this.getStartTimeFromRange(timeRange);

      // Get metrics from database
      const { data: metricsData, error } = await this.supabase
        .from('monitoring_metrics')
        .select('*')
        .eq('service_name', serviceName)
        .gte('timestamp', startTime.toISOString())
        .lte('timestamp', endTime.toISOString())
        .order('timestamp', { ascending: true });

      if (error) {
        throw new Error(`Failed to get service metrics: ${error.message}`);
      }

      // Process metrics data
      const processedMetrics = this.processMetricsData(metricsData || []);

      // Get current service health
      const healthData = await this.redis.get(`health:${serviceName}`);
      const currentHealth = healthData ? JSON.parse(healthData) : null;

      const serviceMetrics = {
        serviceName,
        timeRange,
        startTime,
        endTime,
        currentHealth,
        metrics: processedMetrics,
        summary: {
          avgResponseTime: processedMetrics.responseTime ? 
            meanBy(processedMetrics.responseTime, 'value') : 0,
          totalDataPoints: (metricsData || []).length,
          lastUpdate: processedMetrics.responseTime?.length > 0 ? 
            processedMetrics.responseTime[processedMetrics.responseTime.length - 1].timestamp : null
        }
      };

      // Cache for 1 minute
      await this.redis.setex(cacheKey, 60, JSON.stringify(serviceMetrics));

      return serviceMetrics;
    } catch (error) {
      logger.error('Failed to get service metrics:', error);
      throw error;
    }
  }

  public async getAlertTrends(timeRange: string = '24h'): Promise<any> {
    try {
      const cacheKey = `dashboard:alert_trends:${timeRange}`;
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const endTime = new Date();
      const startTime = this.getStartTimeFromRange(timeRange);

      // Get alerts from database
      const { data: alertsData, error } = await this.supabase
        .from('monitoring_alerts')
        .select('*')
        .gte('created_at', startTime.toISOString())
        .lte('created_at', endTime.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to get alert trends: ${error.message}`);
      }

      // Process alert trends
      const trends = this.processAlertTrends(alertsData || [], timeRange);

      // Cache for 5 minutes
      await this.redis.setex(cacheKey, 300, JSON.stringify(trends));

      return trends;
    } catch (error) {
      logger.error('Failed to get alert trends:', error);
      throw error;
    }
  }

  // Private Helper Methods
  private async getAllServiceHealth(): Promise<ServiceHealth[]> {
    try {
      const services = [
        'gomflow-core',
        'gomflow-whatsapp',
        'gomflow-telegram',
        'gomflow-discord',
        'gomflow-payments',
        'gomflow-smart-agent',
        'gomflow-analytics'
      ];

      const healthPromises = services.map(async (serviceName) => {
        const healthData = await this.redis.get(`health:${serviceName}`);
        if (healthData) {
          return JSON.parse(healthData);
        }
        
        // Return default unhealthy status if no data
        return {
          serviceName,
          url: '',
          status: 'unknown',
          responseTime: 0,
          lastChecked: new Date(),
          uptime: 0
        };
      });

      return Promise.all(healthPromises);
    } catch (error) {
      logger.error('Failed to get all service health:', error);
      return [];
    }
  }

  private calculateAverageResponseTime(serviceHealth: ServiceHealth[]): number {
    if (serviceHealth.length === 0) return 0;
    
    const totalResponseTime = serviceHealth.reduce((sum, service) => 
      sum + (service.responseTime || 0), 0
    );
    
    return totalResponseTime / serviceHealth.length;
  }

  private getStartTimeFromRange(timeRange: string): Date {
    const now = new Date();
    
    switch (timeRange) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '6h':
        return new Date(now.getTime() - 6 * 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return subDays(now, 7);
      case '30d':
        return subDays(now, 30);
      default:
        return new Date(now.getTime() - 60 * 60 * 1000); // Default to 1 hour
    }
  }

  private processMetricsData(metricsData: any[]): any {
    const groupedMetrics = groupBy(metricsData, 'metric_name');
    const processedMetrics: any = {};

    for (const [metricName, metrics] of Object.entries(groupedMetrics)) {
      processedMetrics[metricName] = (metrics as any[]).map(metric => ({
        timestamp: new Date(metric.timestamp),
        value: metric.metric_value,
        labels: metric.labels
      }));
    }

    return processedMetrics;
  }

  private processAlertTrends(alertsData: any[], timeRange: string): any {
    const bucketSize = this.getBucketSize(timeRange);
    
    // Group alerts by time buckets
    const alertsByTime = groupBy(alertsData, (alert) => {
      const date = new Date(alert.created_at);
      return this.formatDateToBucket(date, bucketSize);
    });

    // Group alerts by severity
    const alertsBySeverity = groupBy(alertsData, 'severity');

    // Group alerts by service
    const alertsByService = groupBy(alertsData, 'service');

    // Group alerts by type
    const alertsByType = groupBy(alertsData, 'type');

    return {
      timeline: Object.entries(alertsByTime).map(([time, alerts]) => ({
        time,
        count: (alerts as any[]).length,
        critical: (alerts as any[]).filter(a => a.severity === 'critical').length,
        high: (alerts as any[]).filter(a => a.severity === 'high').length,
        medium: (alerts as any[]).filter(a => a.severity === 'medium').length,
        low: (alerts as any[]).filter(a => a.severity === 'low').length
      })),
      bySeverity: Object.entries(alertsBySeverity).map(([severity, alerts]) => ({
        severity,
        count: (alerts as any[]).length
      })),
      byService: Object.entries(alertsByService).map(([service, alerts]) => ({
        service,
        count: (alerts as any[]).length
      })),
      byType: Object.entries(alertsByType).map(([type, alerts]) => ({
        type,
        count: (alerts as any[]).length
      })),
      total: alertsData.length
    };
  }

  private getBucketSize(timeRange: string): string {
    switch (timeRange) {
      case '1h':
      case '6h':
        return 'minute';
      case '24h':
        return 'hour';
      case '7d':
        return 'day';
      case '30d':
        return 'day';
      default:
        return 'hour';
    }
  }

  private formatDateToBucket(date: Date, bucketSize: string): string {
    switch (bucketSize) {
      case 'minute':
        return format(date, 'yyyy-MM-dd HH:mm');
      case 'hour':
        return format(date, 'yyyy-MM-dd HH:00');
      case 'day':
        return format(date, 'yyyy-MM-dd');
      default:
        return format(date, 'yyyy-MM-dd HH:00');
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async shutdown(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.quit();
      }
      logger.info('Dashboard service shut down successfully');
    } catch (error) {
      logger.error('Failed to shutdown dashboard service:', error);
    }
  }
}

export default DashboardService;