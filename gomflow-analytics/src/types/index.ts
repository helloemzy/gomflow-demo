import { CountryCode, CurrencyCode, PaymentMethod } from '@gomflow/shared';

// Analytics Event Types
export enum AnalyticsEventType {
  // Order Events
  ORDER_CREATED = 'order_created',
  ORDER_UPDATED = 'order_updated',
  ORDER_DEADLINE_REACHED = 'order_deadline_reached',
  ORDER_GOAL_REACHED = 'order_goal_reached',
  ORDER_COMPLETED = 'order_completed',
  ORDER_CANCELLED = 'order_cancelled',
  
  // Submission Events
  SUBMISSION_CREATED = 'submission_created',
  SUBMISSION_UPDATED = 'submission_updated',
  SUBMISSION_PAYMENT_UPLOADED = 'submission_payment_uploaded',
  SUBMISSION_PAYMENT_VERIFIED = 'submission_payment_verified',
  SUBMISSION_PAYMENT_REJECTED = 'submission_payment_rejected',
  
  // User Events
  USER_REGISTERED = 'user_registered',
  USER_LOGIN = 'user_login',
  USER_PROFILE_UPDATED = 'user_profile_updated',
  
  // Platform Events
  PLATFORM_MESSAGE_SENT = 'platform_message_sent',
  PLATFORM_MESSAGE_RECEIVED = 'platform_message_received',
  PLATFORM_NOTIFICATION_SENT = 'platform_notification_sent',
  
  // Error Events
  ERROR_OCCURRED = 'error_occurred',
  API_ERROR = 'api_error',
  PAYMENT_ERROR = 'payment_error',
}

// Analytics Event Structure
export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  timestamp: Date;
  userId?: string;
  orderId?: string;
  submissionId?: string;
  guildId?: string;
  platform?: 'web' | 'mobile' | 'discord' | 'telegram' | 'whatsapp';
  country?: CountryCode;
  currency?: CurrencyCode;
  data: Record<string, any>;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
}

// Time-based Analytics Aggregations
export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  metadata?: Record<string, any>;
}

export interface AnalyticsMetrics {
  // Order Metrics
  totalOrders: number;
  activeOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  totalRevenue: number;
  
  // Submission Metrics
  totalSubmissions: number;
  pendingSubmissions: number;
  verifiedSubmissions: number;
  rejectedSubmissions: number;
  conversionRate: number;
  averageSubmissionTime: number;
  
  // User Metrics
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  returnUsers: number;
  
  // Platform Metrics
  platformUsage: Record<string, number>;
  countryDistribution: Record<CountryCode, number>;
  paymentMethodUsage: Record<PaymentMethod, number>;
  
  // Performance Metrics
  averageResponseTime: number;
  errorRate: number;
  uptimePercentage: number;
}

// Reporting Interfaces
export interface ReportFilter {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  orderId?: string;
  country?: CountryCode;
  platform?: string;
  eventType?: AnalyticsEventType;
  customFilters?: Record<string, any>;
}

export interface ReportConfig {
  id: string;
  name: string;
  description: string;
  type: 'realtime' | 'scheduled' | 'on_demand';
  format: 'json' | 'csv' | 'pdf' | 'excel';
  filters: ReportFilter;
  metrics: string[];
  schedule?: string; // Cron format
  recipients?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Dashboard Widgets
export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'map' | 'funnel';
  title: string;
  description?: string;
  config: {
    metric?: string;
    chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
    timeRange?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
    groupBy?: string;
    filters?: ReportFilter;
    size?: 'small' | 'medium' | 'large';
    position?: { x: number; y: number; w: number; h: number };
  };
  data?: any;
  refreshInterval?: number;
}

// Advanced Analytics Features
export interface CohortAnalysis {
  period: 'daily' | 'weekly' | 'monthly';
  metric: 'retention' | 'revenue' | 'orders';
  cohorts: {
    cohortDate: Date;
    cohortSize: number;
    periods: number[];
  }[];
}

export interface FunnelAnalysis {
  name: string;
  steps: {
    name: string;
    eventType: AnalyticsEventType;
    users: number;
    conversionRate: number;
    dropoffRate: number;
  }[];
  totalConversionRate: number;
}

export interface SegmentAnalysis {
  segmentName: string;
  criteria: Record<string, any>;
  userCount: number;
  metrics: AnalyticsMetrics;
  trends: TimeSeriesData[];
}

// Alert Configuration
export interface AlertConfig {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: 'above' | 'below' | 'equals' | 'changes_by';
  threshold: number;
  timeWindow: number; // Minutes
  isActive: boolean;
  recipients: string[];
  channels: ('email' | 'slack' | 'webhook')[];
  webhookUrl?: string;
  lastTriggered?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Export Types
export interface ExportRequest {
  format: 'csv' | 'json' | 'excel' | 'pdf';
  reportType: 'orders' | 'submissions' | 'users' | 'analytics' | 'custom';
  filters: ReportFilter;
  columns?: string[];
  email?: string;
}

export interface ExportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  request: ExportRequest;
  fileUrl?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  downloadCount: number;
  expiresAt: Date;
}

// Real-time Analytics
export interface RealTimeMetrics {
  activeUsers: number;
  ordersInProgress: number;
  submissionsPerMinute: number;
  revenueToday: number;
  errorRate: number;
  responseTime: number;
  timestamp: Date;
}

// Predictive Analytics
export interface PredictiveInsight {
  type: 'order_completion' | 'revenue_forecast' | 'user_churn' | 'demand_prediction';
  confidence: number;
  prediction: any;
  factors: string[];
  timeHorizon: number; // Days
  createdAt: Date;
}

// A/B Testing
export interface ABTest {
  id: string;
  name: string;
  description: string;
  variants: {
    id: string;
    name: string;
    traffic: number; // Percentage
    config: Record<string, any>;
  }[];
  metrics: string[];
  status: 'draft' | 'running' | 'completed' | 'paused';
  startDate: Date;
  endDate?: Date;
  results?: {
    winner?: string;
    significance: number;
    metrics: Record<string, any>;
  };
}

// Database Models
export interface AnalyticsEventModel {
  id: string;
  event_type: AnalyticsEventType;
  user_id?: string;
  order_id?: string;
  submission_id?: string;
  guild_id?: string;
  platform?: string;
  country?: CountryCode;
  currency?: CurrencyCode;
  event_data: Record<string, any>;
  session_id?: string;
  user_agent?: string;
  ip_address?: string;
  created_at: Date;
}

export interface AnalyticsAggregationModel {
  id: string;
  metric_name: string;
  metric_value: number;
  dimensions: Record<string, any>;
  time_bucket: Date;
  bucket_size: 'minute' | 'hour' | 'day' | 'week' | 'month';
  created_at: Date;
}

// API Response Types
export interface AnalyticsApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    total?: number;
    page?: number;
    limit?: number;
    filters?: ReportFilter;
    generatedAt?: Date;
  };
}

// Service Interfaces
export interface AnalyticsServiceInterface {
  trackEvent(event: AnalyticsEvent): Promise<void>;
  getMetrics(filters: ReportFilter): Promise<AnalyticsMetrics>;
  getTimeSeries(metric: string, filters: ReportFilter): Promise<TimeSeriesData[]>;
  generateReport(config: ReportConfig): Promise<any>;
  createAlert(config: AlertConfig): Promise<AlertConfig>;
  exportData(request: ExportRequest): Promise<ExportJob>;
}

export interface DataPipelineInterface {
  processEvents(events: AnalyticsEvent[]): Promise<void>;
  aggregateMetrics(timeRange: Date[]): Promise<void>;
  cleanupOldData(retentionDays: number): Promise<void>;
}

export interface ReportingServiceInterface {
  generateDashboard(widgets: DashboardWidget[]): Promise<any>;
  runScheduledReports(): Promise<void>;
  createExport(request: ExportRequest): Promise<ExportJob>;
  getExportStatus(jobId: string): Promise<ExportJob>;
}