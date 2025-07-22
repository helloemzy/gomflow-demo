import { CountryCode, CurrencyCode } from '@gomflow/shared';

// System Metrics Types
export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number; // percentage
    load: number[];
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number; // percentage
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number; // percentage
  };
  network: {
    rx: number; // bytes received
    tx: number; // bytes transmitted
  };
}

// Service Health Types
export interface ServiceHealth {
  serviceName: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  responseTime: number; // ms
  lastChecked: Date;
  uptime: number; // seconds
  version?: string;
  details?: Record<string, any>;
  dependencies?: ServiceDependency[];
}

export interface ServiceDependency {
  name: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime?: number;
  lastChecked: Date;
}

// Performance Metrics Types
export interface PerformanceMetrics {
  serviceName: string;
  timestamp: Date;
  responseTime: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    rps: number; // requests per second
    rpm: number; // requests per minute
  };
  errors: {
    total: number;
    rate: number; // percentage
    byType: Record<string, number>;
  };
  database: {
    connections: number;
    queries: {
      total: number;
      avg_time: number;
      slow_queries: number;
    };
  };
  queue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

// Alert Types
export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  service: string;
  title: string;
  description: string;
  threshold: number;
  currentValue: number;
  status: AlertStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

export enum AlertType {
  CPU_HIGH = 'cpu_high',
  MEMORY_HIGH = 'memory_high',
  DISK_FULL = 'disk_full',
  SERVICE_DOWN = 'service_down',
  RESPONSE_TIME_HIGH = 'response_time_high',
  ERROR_RATE_HIGH = 'error_rate_high',
  QUEUE_BACKLOG = 'queue_backlog',
  DATABASE_SLOW = 'database_slow',
  CUSTOM = 'custom'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AlertStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  ACKNOWLEDGED = 'acknowledged',
  SUPPRESSED = 'suppressed'
}

// Dashboard Types
export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'status' | 'alert' | 'logs';
  title: string;
  config: {
    metric?: string;
    service?: string;
    timeRange?: string;
    chartType?: 'line' | 'bar' | 'gauge' | 'pie';
    refreshInterval?: number;
    thresholds?: {
      warning: number;
      critical: number;
    };
  };
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: DashboardWidget[];
  isPublic: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Monitoring Configuration Types
export interface MonitoringConfig {
  services: ServiceConfig[];
  alerts: AlertConfig[];
  thresholds: ThresholdConfig;
  notifications: NotificationConfig;
}

export interface ServiceConfig {
  name: string;
  url: string;
  healthEndpoint: string;
  metricsEndpoint?: string;
  checkInterval: number;
  timeout: number;
  retries: number;
  enabled: boolean;
}

export interface AlertConfig {
  id: string;
  name: string;
  type: AlertType;
  service: string;
  metric: string;
  condition: 'above' | 'below' | 'equals';
  threshold: number;
  duration: number; // seconds
  severity: AlertSeverity;
  enabled: boolean;
  notifications: string[];
}

export interface ThresholdConfig {
  cpu: {
    warning: number;
    critical: number;
  };
  memory: {
    warning: number;
    critical: number;
  };
  disk: {
    warning: number;
    critical: number;
  };
  responseTime: {
    warning: number;
    critical: number;
  };
  errorRate: {
    warning: number;
    critical: number;
  };
}

export interface NotificationConfig {
  channels: NotificationChannel[];
  templates: NotificationTemplate[];
}

export interface NotificationChannel {
  id: string;
  type: 'email' | 'slack' | 'discord' | 'webhook';
  name: string;
  config: {
    webhook_url?: string;
    email?: string;
    channel?: string;
    token?: string;
  };
  enabled: boolean;
}

export interface NotificationTemplate {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  variables: string[];
}

// Log Types
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug';
  service: string;
  message: string;
  metadata?: Record<string, any>;
  traceId?: string;
  userId?: string;
}

// Time Series Data
export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

// Service Interfaces
export interface MonitoringServiceInterface {
  collectSystemMetrics(): Promise<SystemMetrics>;
  checkServiceHealth(service: string): Promise<ServiceHealth>;
  getPerformanceMetrics(service: string): Promise<PerformanceMetrics>;
  createAlert(alert: Omit<Alert, 'id' | 'createdAt' | 'updatedAt'>): Promise<Alert>;
  resolveAlert(alertId: string): Promise<void>;
}

export interface AlertServiceInterface {
  evaluateAlerts(): Promise<void>;
  sendNotification(alert: Alert, channels: string[]): Promise<void>;
  getActiveAlerts(): Promise<Alert[]>;
  acknowledgeAlert(alertId: string, userId: string): Promise<void>;
}

export interface MetricsServiceInterface {
  recordMetric(name: string, value: number, labels?: Record<string, string>): Promise<void>;
  getMetrics(name: string, timeRange: Date[]): Promise<TimeSeriesData[]>;
  getMetricsSummary(timeRange: Date[]): Promise<Record<string, any>>;
}

// Database Models
export interface MonitoringMetricModel {
  id: string;
  service_name: string;
  metric_name: string;
  metric_value: number;
  labels: Record<string, string>;
  timestamp: Date;
  created_at: Date;
}

export interface MonitoringAlertModel {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  service: string;
  title: string;
  description: string;
  threshold: number;
  current_value: number;
  status: AlertStatus;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date;
}

export interface MonitoringLogModel {
  id: string;
  timestamp: Date;
  level: string;
  service: string;
  message: string;
  metadata: Record<string, any>;
  trace_id?: string;
  user_id?: string;
  created_at: Date;
}

// API Response Types
export interface MonitoringApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    timestamp: Date;
    service: string;
    version: string;
  };
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: 'metric' | 'alert' | 'health' | 'log';
  data: any;
  timestamp: Date;
  service?: string;
}

// Prometheus Types
export interface PrometheusMetric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  labels?: string[];
}

export interface PrometheusRegistry {
  register(metric: PrometheusMetric): void;
  metrics(): string;
  clear(): void;
}

// Health Check Types
export interface HealthCheckResult {
  status: 'pass' | 'fail' | 'warn';
  version?: string;
  releaseId?: string;
  notes?: string[];
  output?: string;
  details?: Record<string, any>;
  links?: Record<string, string>;
  serviceId?: string;
  description?: string;
}

export interface HealthCheckResponse {
  status: 'pass' | 'fail' | 'warn';
  version: string;
  releaseId: string;
  notes: string[];
  output: string;
  serviceId: string;
  description: string;
  checks: Record<string, HealthCheckResult[]>;
  links: Record<string, string>;
}

// Configuration Types
export interface MonitoringConfiguration {
  services: Record<string, ServiceConfig>;
  alerts: Record<string, AlertConfig>;
  thresholds: ThresholdConfig;
  notifications: NotificationConfig;
  dashboards: Record<string, Dashboard>;
}

export default {
  SystemMetrics,
  ServiceHealth,
  PerformanceMetrics,
  Alert,
  AlertType,
  AlertSeverity,
  AlertStatus,
  DashboardWidget,
  Dashboard,
  MonitoringConfig,
  ServiceConfig,
  AlertConfig,
  ThresholdConfig,
  NotificationConfig,
  NotificationChannel,
  NotificationTemplate,
  LogEntry,
  TimeSeriesData,
  MonitoringServiceInterface,
  AlertServiceInterface,
  MetricsServiceInterface,
  MonitoringMetricModel,
  MonitoringAlertModel,
  MonitoringLogModel,
  MonitoringApiResponse,
  WebSocketMessage,
  PrometheusMetric,
  PrometheusRegistry,
  HealthCheckResult,
  HealthCheckResponse,
  MonitoringConfiguration
};