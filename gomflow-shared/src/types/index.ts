// User types
export interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  phone: string;
  country: 'PH' | 'MY';
  timezone: string;
  whatsapp_enabled: boolean;
  telegram_enabled: boolean;
  discord_enabled: boolean;
  plan: 'free' | 'pro' | 'gateway' | 'business';
  subscription_status: 'active' | 'inactive' | 'cancelled';
  created_at: Date;
  updated_at: Date;
}

// Order types
export interface Order {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  price: number;
  currency: 'PHP' | 'MYR';
  deadline: Date;
  slug: string;
  payment_methods: PaymentMethod[];
  is_active: boolean;
  auto_close_on_deadline: boolean;
  min_orders: number;
  max_orders?: number;
  created_at: Date;
  user?: User;
}

export interface PaymentMethod {
  type: 'gcash' | 'paymaya' | 'bank_transfer' | 'maybank2u' | 'tng' | 'billplz' | 'paymongo';
  number?: string;
  name?: string;
  instructions?: string;
  is_gateway?: boolean;
}

// Submission types
export interface Submission {
  id: string;
  order_id: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_email?: string;
  buyer_platform: 'whatsapp' | 'telegram' | 'discord' | 'web';
  buyer_platform_id?: string;
  quantity: number;
  total_amount: number;
  currency: 'PHP' | 'MYR';
  payment_reference: string;
  payment_gateway?: 'paymongo' | 'billplz';
  payment_intent_id?: string;
  checkout_session_id?: string;
  payment_url?: string;
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled';
  source_platform?: string;
  utm_source?: string;
  last_reminder_sent?: Date;
  reminder_count: number;
  created_at: Date;
  updated_at: Date;
  order?: Order;
}

// Platform connection types
export interface PlatformConnection {
  id: string;
  user_id: string;
  platform: 'whatsapp' | 'telegram' | 'discord';
  connection_type: 'group' | 'channel' | 'webhook';
  config: Record<string, any>;
  is_active: boolean;
  created_at: Date;
}

// Message types
export interface Message {
  id: string;
  submission_id: string;
  platform: 'whatsapp' | 'telegram' | 'discord';
  message_type: 'reminder' | 'confirmation' | 'query_response' | 'custom';
  content: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  external_message_id?: string;
  sent_at?: Date;
  delivered_at?: Date;
  error_message?: string;
  created_at: Date;
}

// Payment transaction types
export interface PaymentTransaction {
  id: string;
  submission_id: string;
  gateway: 'paymongo' | 'billplz';
  gateway_payment_id: string;
  gateway_status: string;
  amount: number;
  currency: 'PHP' | 'MYR';
  payment_method?: string;
  paid_at?: Date;
  created_at: Date;
  webhook_data?: Record<string, any>;
}

// Platform post types
export interface PlatformPost {
  id: string;
  order_id: string;
  platform: 'whatsapp' | 'telegram' | 'discord';
  post_id?: string;
  post_url?: string;
  status: 'posted' | 'failed' | 'deleted';
  created_at: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Dashboard types
export interface DashboardStats {
  totalOrders: number;
  activeOrders: number;
  totalSubmissions: number;
  pendingPayments: number;
  overduePayments: number;
  totalRevenue: number;
  pendingRevenue: number;
}

// Payment detection types (for Smart Agent)
export interface PaymentDetection {
  amount: number;
  reference?: string;
  sender?: string;
  method: string;
  confidence: number;
  matched_submission?: Submission;
  requires_review: boolean;
}