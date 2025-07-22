export interface NotificationEvent {
  id: string;
  type: NotificationEventType;
  userId: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  createdAt: Date;
  scheduledFor?: Date;
  expiresAt?: Date;
}

export enum NotificationEventType {
  // Order Events
  ORDER_CREATED = 'order_created',
  ORDER_UPDATED = 'order_updated',
  ORDER_DEADLINE_APPROACHING = 'order_deadline_approaching',
  ORDER_GOAL_REACHED = 'order_goal_reached',
  ORDER_COMPLETED = 'order_completed',
  ORDER_CANCELLED = 'order_cancelled',
  
  // Submission Events
  SUBMISSION_CREATED = 'submission_created',
  SUBMISSION_PAYMENT_REQUIRED = 'submission_payment_required',
  SUBMISSION_PAYMENT_CONFIRMED = 'submission_payment_confirmed',
  SUBMISSION_PAYMENT_REJECTED = 'submission_payment_rejected',
  
  // Discovery Events
  NEW_ORDER_RECOMMENDATION = 'new_order_recommendation',
  CATEGORY_UPDATE = 'category_update',
  
  // Communication Events
  GOM_MESSAGE = 'gom_message',
  ANNOUNCEMENT = 'announcement',
  
  // System Events
  SYSTEM_MAINTENANCE = 'system_maintenance',
  FEATURE_UPDATE = 'feature_update'
}

export enum NotificationChannel {
  WEBSOCKET = 'websocket',
  PUSH = 'push',
  EMAIL = 'email',
  SMS = 'sms'
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export interface NotificationPreferences {
  userId: string;
  orderUpdates: {
    websocket: boolean;
    push: boolean;
    email: boolean;
  };
  paymentUpdates: {
    websocket: boolean;
    push: boolean;
    email: boolean;
  };
  discovery: {
    websocket: boolean;
    push: boolean;
    email: boolean;
  };
  communications: {
    websocket: boolean;
    push: boolean;
    email: boolean;
  };
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:mm format
    endTime: string;   // HH:mm format
    timezone: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface WebSocketAuthData {
  userId: string;
  userType: 'buyer' | 'gom';
  country: 'PH' | 'MY';
  sessionId: string;
}

export interface SocketUser extends WebSocketAuthData {
  socketId: string;
  connectedAt: Date;
  lastActivity: Date;
}

export interface NotificationTemplate {
  type: NotificationEventType;
  channel: NotificationChannel;
  subject?: string; // For email
  title: string;    // For push/websocket
  message: string;
  htmlContent?: string; // For email
  variables: string[]; // Template variables like {{orderTitle}}, {{amount}}
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  icon?: string;
  clickAction?: string;
}

export interface EmailNotificationPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface QueueJob {
  id: string;
  type: 'notification' | 'email' | 'push';
  data: any;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  processAt: Date;
}

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  connectionsByUserType: {
    buyer: number;
    gom: number;
  };
  connectionsByCountry: {
    PH: number;
    MY: number;
  };
  averageConnectionTime: number;
}

export interface NotificationStats {
  totalSent: number;
  sentByChannel: {
    websocket: number;
    push: number;
    email: number;
  };
  sentByType: Record<NotificationEventType, number>;
  deliveryRate: number;
  averageDeliveryTime: number;
}