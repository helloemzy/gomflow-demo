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

// Manual Payment System Types
export type PaymentMethodType = 
  | 'gcash' | 'paymaya' | 'maya' | 'grabpay_ph' | 'shopeepay_ph'
  | 'bpi' | 'bdo' | 'metrobank' | 'unionbank' | 'rcbc' | 'pnb'
  | 'maybank2u' | 'cimb' | 'public_bank' | 'hong_leong' | 'ambank' | 'rhb'
  | 'tng' | 'boost' | 'grabpay_my' | 'shopeepay_my' | 'touch_n_go'
  | 'bank_transfer_ph' | 'bank_transfer_my' | 'crypto' | 'other';

export type VerificationStatus = 'pending' | 'approved' | 'rejected' | 'flagged' | 'requires_review';
export type VerificationAction = 'submitted' | 'reviewed' | 'approved' | 'rejected' | 'flagged' | 'bulk_approved' | 'bulk_rejected';

export interface ManualPaymentMethod {
  id: string;
  user_id: string;
  method_type: PaymentMethodType;
  display_name: string;
  account_number?: string;
  account_name?: string;
  bank_name?: string;
  qr_code_url?: string;
  instructions?: string;
  minimum_amount: number;
  maximum_amount?: number;
  processing_fee: number;
  processing_fee_percentage: number;
  is_active: boolean;
  sort_order: number;
  requires_proof: boolean;
  auto_verify_threshold?: number;
  created_at: Date;
  updated_at: Date;
}

export interface PaymentProof {
  id: string;
  submission_id: string;
  payment_method_id?: string;
  file_url: string;
  file_name: string;
  file_size: number;
  file_type: string;
  uploaded_by_name?: string;
  uploaded_by_phone?: string;
  verification_status: VerificationStatus;
  verified_by?: string;
  verified_at?: Date;
  rejection_reason?: string;
  ai_analysis_result?: Record<string, any>;
  ai_confidence_score?: number;
  extracted_amount?: number;
  extracted_reference?: string;
  extracted_method?: string;
  manual_review_notes?: string;
  flagged_reasons?: string[];
  processing_attempts: number;
  last_processed_at?: Date;
  created_at: Date;
  updated_at: Date;
  submission?: Submission;
  payment_method?: ManualPaymentMethod;
}

export interface VerificationLog {
  id: string;
  payment_proof_id: string;
  submission_id: string;
  order_id: string;
  user_id?: string;
  action: VerificationAction;
  previous_status?: VerificationStatus;
  new_status?: VerificationStatus;
  notes?: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

export interface BulkVerificationJob {
  id: string;
  user_id: string;
  order_id?: string;
  action: VerificationAction;
  total_proofs: number;
  processed_proofs: number;
  successful_proofs: number;
  failed_proofs: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  started_at?: Date;
  completed_at?: Date;
  error_message?: string;
  proof_ids: string[];
  created_at: Date;
}

// AI Analysis Result
export interface AIAnalysisResult {
  paymentMethod?: string;
  amount?: number;
  currency?: 'PHP' | 'MYR';
  senderInfo?: string;
  recipientInfo?: string;
  transactionId?: string;
  timestamp?: string;
  bankName?: string;
  referenceNumber?: string;
  confidence: number;
  reasoning: string;
  extractedAt: string;
  model: string;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

// Payment Method Configuration for UI
export interface PaymentMethodConfig {
  type: PaymentMethodType;
  name: string;
  icon: string;
  color: string;
  country: 'PH' | 'MY';
  category: 'ewallet' | 'bank' | 'crypto' | 'other';
  supports_qr: boolean;
  requires_account_number: boolean;
  requires_account_name: boolean;
  requires_bank_name: boolean;
  placeholder_account?: string;
  validation_pattern?: string;
}

// Verification Queue Stats
export interface VerificationQueueStats {
  pending_verifications: number;
  flagged_verifications: number;
  requires_review: number;
  high_confidence_pending: number;
  low_confidence_pending: number;
  oldest_pending?: Date;
  avg_processing_time?: number;
}

// Payment Method Stats
export interface PaymentMethodStats {
  total_methods: number;
  active_methods: number;
  methods_by_type: Record<PaymentMethodType, number>;
}

// ============================================================================
// SUBSCRIPTION BILLING TYPES
// ============================================================================

export type BillingInterval = 'month' | 'year';
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
export type PaymentStatus = 'succeeded' | 'pending' | 'failed' | 'canceled';
export type CustomerStatus = 'active' | 'inactive' | 'suspended';
export type SubscriptionStatus = 'active' | 'incomplete' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';

// Stripe Customer
export interface Customer {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  email: string;
  name: string;
  phone?: string;
  country: 'PH' | 'MY';
  currency: 'PHP' | 'MYR';
  tax_id?: string;
  tax_exempt: boolean;
  status: CustomerStatus;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// Subscription
export interface Subscription {
  id: string;
  customer_id: string;
  stripe_subscription_id: string;
  status: SubscriptionStatus;
  price_id: string;
  quantity: number;
  trial_start?: Date;
  trial_end?: Date;
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  canceled_at?: Date;
  ended_at?: Date;
  billing_interval: BillingInterval;
  amount_per_period: number;
  currency: 'PHP' | 'MYR';
  tax_percent?: number;
  discount_coupon?: string;
  discount_percent?: number;
  discount_amount?: number;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  customer?: Customer;
}

// Stripe Payment Method
export interface StripePaymentMethod {
  id: string;
  customer_id: string;
  stripe_payment_method_id: string;
  type: string; // card, fpx, grabpay, etc.
  brand?: string; // visa, mastercard, etc.
  last4?: string;
  exp_month?: number;
  exp_year?: number;
  country?: string;
  funding?: string; // credit, debit, prepaid
  is_default: boolean;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

// Invoice
export interface Invoice {
  id: string;
  customer_id: string;
  subscription_id?: string;
  stripe_invoice_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  currency: 'PHP' | 'MYR';
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  subtotal: number;
  tax: number;
  total: number;
  period_start: Date;
  period_end: Date;
  due_date?: Date;
  paid_at?: Date;
  attempted_at?: Date;
  next_payment_attempt?: Date;
  attempt_count: number;
  payment_intent_id?: string;
  charge_id?: string;
  receipt_url?: string;
  invoice_pdf?: string;
  hosted_invoice_url?: string;
  description?: string;
  statement_descriptor?: string;
  footer?: string;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  customer?: Customer;
  subscription?: Subscription;
  line_items?: InvoiceLineItem[];
}

// Invoice Line Item
export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  stripe_line_item_id?: string;
  type: string; // subscription, invoice_item
  description: string;
  quantity: number;
  amount: number;
  unit_amount?: number;
  currency: 'PHP' | 'MYR';
  period_start?: Date;
  period_end?: Date;
  price_id?: string;
  product_id?: string;
  tax_rates: any[];
  metadata: Record<string, any>;
  created_at: Date;
}

// Billing Event
export interface BillingEvent {
  id: string;
  customer_id?: string;
  subscription_id?: string;
  invoice_id?: string;
  stripe_event_id: string;
  event_type: string;
  event_data: Record<string, any>;
  processed_at?: Date;
  error_message?: string;
  retry_count: number;
  created_at: Date;
}

// Billing Notification
export interface BillingNotification {
  id: string;
  customer_id: string;
  invoice_id?: string;
  subscription_id?: string;
  notification_type: string;
  email: string;
  subject: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  sent_at?: Date;
  error_message?: string;
  retry_count: number;
  metadata: Record<string, any>;
  created_at: Date;
}

// Subscription Plan Configuration
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: 'PHP' | 'MYR';
  stripe_price_id_monthly: string;
  stripe_price_id_yearly: string;
  features: string[];
  max_orders?: number;
  max_submissions?: number;
  analytics_included: boolean;
  api_access: boolean;
  priority_support: boolean;
  custom_branding: boolean;
}

// Billing Dashboard Stats
export interface BillingStats {
  total_customers: number;
  active_subscriptions: number;
  monthly_recurring_revenue: number;
  annual_recurring_revenue: number;
  churn_rate: number;
  average_revenue_per_user: number;
  failed_payments: number;
  upcoming_renewals: number;
  trial_conversions: number;
}

// Customer Subscription Status
export interface CustomerSubscriptionStatus {
  has_active_subscription: boolean;
  current_plan: string;
  subscription_end_date?: Date;
  is_trial: boolean;
  trial_end_date?: Date;
  days_until_renewal?: number;
  payment_method_required: boolean;
}

// Payment Method Setup Intent
export interface PaymentMethodSetup {
  client_secret: string;
  customer_id: string;
  setup_intent_id: string;
  payment_method_types: string[];
}

// Subscription Creation Request
export interface CreateSubscriptionRequest {
  price_id: string;
  payment_method_id?: string;
  trial_days?: number;
  coupon?: string;
  metadata?: Record<string, any>;
}

// Invoice Email Template Data
export interface InvoiceEmailData {
  customer_name: string;
  invoice_number: string;
  amount_due: number;
  currency: string;
  due_date: string;
  invoice_url: string;
  period_start: string;
  period_end: string;
  plan_name: string;
}

// Payment Method Update Request
export interface UpdatePaymentMethodRequest {
  payment_method_id: string;
  set_as_default?: boolean;
}

// Subscription Modification Request
export interface ModifySubscriptionRequest {
  price_id?: string;
  quantity?: number;
  proration_behavior?: 'create_prorations' | 'none' | 'always_invoice';
  billing_cycle_anchor?: 'now' | 'unchanged';
}

// ============================================================================
// SUBSCRIPTION MANAGEMENT TYPES
// ============================================================================

export type SubscriptionTier = 'freemium' | 'starter' | 'professional' | 'enterprise';
export type BillingCycle = 'monthly' | 'annually';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled' | 'suspended' | 'expired';
export type BillingStatus = 'paid' | 'pending' | 'failed' | 'refunded' | 'partial';
export type UsageMetricType = 'orders_created' | 'api_calls' | 'storage_mb' | 'messages_sent' | 'submissions_received';
export type CurrencyCode = 'PHP' | 'MYR' | 'THB' | 'IDR' | 'USD';

// Subscription Plan
export interface SubscriptionPlan {
  id: string;
  name: string;
  tier: SubscriptionTier;
  display_name: string;
  description?: string;
  
  // Pricing per currency
  price_php?: number;
  price_myr?: number;
  price_thb?: number;
  price_idr?: number;
  price_usd?: number;
  
  // Annual pricing (discounted)
  annual_price_php?: number;
  annual_price_myr?: number;
  annual_price_thb?: number;
  annual_price_idr?: number;
  annual_price_usd?: number;
  
  // Plan configuration
  features: Record<string, boolean>;
  limits: Record<UsageMetricType, number>; // -1 means unlimited
  trial_days: number;
  is_active: boolean;
  sort_order: number;
  
  created_at: Date;
  updated_at: Date;
}

// User Subscription
export interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  
  // Subscription details
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  billing_cycle: BillingCycle;
  
  // Pricing and currency
  currency: CurrencyCode;
  amount: number;
  
  // Billing dates
  trial_start_date?: Date;
  trial_end_date?: Date;
  billing_start_date?: Date;
  current_period_start?: Date;
  current_period_end?: Date;
  next_billing_date?: Date;
  
  // Cancellation
  cancelled_at?: Date;
  cancellation_reason?: string;
  cancel_at_period_end: boolean;
  
  // Payment gateway integration
  gateway_subscription_id?: string;
  gateway_customer_id?: string;
  
  // Usage tracking
  usage_reset_date: Date;
  
  // Metadata
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
  
  // Relations
  plan?: SubscriptionPlan;
  user?: User;
}

// Usage Tracking
export interface UsageTracking {
  id: string;
  user_id: string;
  subscription_id: string;
  
  // Usage details
  metric_type: UsageMetricType;
  metric_value: number;
  
  // Time period
  period_start: Date;
  period_end: Date;
  
  // Metadata
  metadata?: Record<string, any>;
  recorded_at: Date;
}

// Billing Event
export interface BillingEvent {
  id: string;
  user_id: string;
  subscription_id: string;
  
  // Event details
  event_type: string; // subscription_created, invoice_paid, payment_failed, etc.
  event_description?: string;
  
  // Financial details
  amount?: number;
  currency?: CurrencyCode;
  status?: BillingStatus;
  
  // Payment gateway details
  gateway_event_id?: string;
  gateway_invoice_id?: string;
  gateway_payment_intent_id?: string;
  
  // Pro-ration calculations
  proration_amount?: number;
  proration_details?: Record<string, any>;
  
  // Dates
  event_date: Date;
  processed_at?: Date;
  
  // Metadata
  metadata?: Record<string, any>;
  created_at: Date;
}

// Subscription API Types
export interface CreateSubscriptionRequest {
  plan_id: string;
  billing_cycle: BillingCycle;
  currency: CurrencyCode;
  payment_method_id?: string;
}

export interface UpdateSubscriptionRequest {
  plan_id?: string;
  billing_cycle?: BillingCycle;
  cancel_at_period_end?: boolean;
  cancellation_reason?: string;
}

export interface PlanSwitchRequest {
  new_plan_id: string;
  billing_cycle?: BillingCycle;
  prorate?: boolean;
}

export interface UsageCheckRequest {
  metric_type: UsageMetricType;
  increment?: number;
}

export interface UsageRecordRequest {
  metric_type: UsageMetricType;
  increment: number;
  metadata?: Record<string, any>;
}

// Subscription Summary (from database function)
export interface SubscriptionSummary {
  has_subscription: boolean;
  subscription_id?: string;
  tier: SubscriptionTier;
  status?: SubscriptionStatus;
  billing_cycle?: BillingCycle;
  currency?: CurrencyCode;
  amount?: number;
  current_period_start?: Date;
  current_period_end?: Date;
  next_billing_date?: Date;
  trial_end_date?: Date;
  cancel_at_period_end?: boolean;
  plan?: {
    id: string;
    name: string;
    display_name: string;
    features: Record<string, boolean>;
    limits: Record<string, number>;
  };
  usage?: Record<UsageMetricType, number>;
}

// Usage Limit Check Result
export interface UsageLimitCheck {
  allowed: boolean;
  reason: 'within_limit' | 'limit_exceeded' | 'unlimited' | 'no_active_subscription';
  current_usage: number;
  limit: number; // -1 means unlimited
  remaining?: number;
  would_be?: number;
}

// Plan Pricing Helper
export interface PlanPricing {
  monthly: Record<CurrencyCode, number>;
  annually: Record<CurrencyCode, number>;
  savings_percentage: number; // Annual savings vs monthly
}

// Subscription Analytics
export interface SubscriptionAnalytics {
  // User metrics
  total_subscribers: number;
  active_subscribers: number;
  trial_subscribers: number;
  cancelled_subscribers: number;
  
  // Revenue metrics
  monthly_recurring_revenue: number;
  annual_recurring_revenue: number;
  average_revenue_per_user: number;
  
  // Tier distribution
  subscribers_by_tier: Record<SubscriptionTier, number>;
  revenue_by_tier: Record<SubscriptionTier, number>;
  
  // Usage metrics
  average_usage_by_metric: Record<UsageMetricType, number>;
  users_approaching_limits: number;
  users_exceeded_limits: number;
  
  // Billing metrics
  successful_payments: number;
  failed_payments: number;
  payment_retry_attempts: number;
  churn_rate: number;
}

// Regional Pricing Configuration
export interface RegionalPricing {
  currency: CurrencyCode;
  country_codes: string[];
  exchange_rate: number;
  tax_rate: number;
  payment_methods: string[];
  local_payment_providers: string[];
}

// Plan Feature Definitions
export interface PlanFeature {
  key: string;
  name: string;
  description: string;
  category: 'core' | 'analytics' | 'integrations' | 'support' | 'branding';
  icon?: string;
  tooltip?: string;
}

// Plan Limit Definitions  
export interface PlanLimit {
  metric_type: UsageMetricType;
  name: string;
  description: string;
  unit: string;
  icon?: string;
  unlimited_text?: string; // Text to show when limit is -1
}

// =============================================================================
// SUBSCRIPTION SYSTEM TYPES
// =============================================================================

export type SubscriptionPlan = 'freemium' | 'starter' | 'professional' | 'enterprise';
export type SubscriptionStatus = 'active' | 'inactive' | 'cancelled' | 'trial' | 'expired' | 'suspended';
export type BillingCycle = 'monthly' | 'yearly';
export type TrialStatus = 'active' | 'expired' | 'converted' | 'cancelled';

export interface SubscriptionLimits {
  max_orders_per_month: number | null; // null = unlimited
  max_submissions_per_order: number | null;
  max_api_calls_per_day: number;
  max_sms_per_month: number;
  max_storage_mb: number;
  max_webhook_calls_per_day: number;
  max_team_members: number;
  custom_branding: boolean;
  priority_support: boolean;
  api_access: boolean;
  advanced_analytics: boolean;
  white_label: boolean;
  custom_integrations: boolean;
  sla_guarantee: boolean;
}

export interface SubscriptionFeatures {
  order_creation: boolean;
  payment_tracking: boolean;
  whatsapp_integration: boolean;
  telegram_integration: boolean;
  discord_integration: boolean;
  smart_payment_agent: boolean;
  bulk_messaging: boolean;
  analytics_dashboard: boolean;
  export_functionality: boolean;
  custom_domains: boolean;
  team_collaboration: boolean;
  api_access: boolean;
  webhook_notifications: boolean;
  priority_processing: boolean;
  custom_branding: boolean;
  advanced_reporting: boolean;
  fraud_protection: boolean;
  dedicated_support: boolean;
}

export interface SubscriptionPlanConfig {
  id: SubscriptionPlan;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: 'PHP' | 'MYR' | 'USD';
  limits: SubscriptionLimits;
  features: SubscriptionFeatures;
  popular: boolean;
  trial_days: number;
  setup_fee: number;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  amount: number;
  currency: 'PHP' | 'MYR' | 'USD';
  trial_start_date?: Date;
  trial_end_date?: Date;
  trial_status?: TrialStatus;
  current_period_start: Date;
  current_period_end: Date;
  cancel_at_period_end: boolean;
  cancelled_at?: Date;
  cancellation_reason?: string;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  last_invoice_id?: string;
  next_billing_date?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface UsageMetrics {
  id: string;
  user_id: string;
  period_start: Date;
  period_end: Date;
  orders_created: number;
  submissions_received: number;
  api_calls_made: number;
  sms_sent: number;
  storage_used_mb: number;
  webhook_calls: number;
  payment_proofs_processed: number;
  team_member_invites: number;
  last_updated: Date;
  created_at: Date;
}

export interface UsageLimitAlert {
  id: string;
  user_id: string;
  metric_type: keyof UsageMetrics;
  limit_value: number;
  current_value: number;
  percentage_used: number;
  alert_threshold: 80 | 90 | 95 | 100; // percentage thresholds
  alert_sent: boolean;
  resolved: boolean;
  created_at: Date;
}

export interface SubscriptionEvent {
  id: string;
  user_id: string;
  subscription_id: string;
  event_type: 'created' | 'updated' | 'cancelled' | 'trial_started' | 'trial_ended' | 'trial_converted' | 'payment_failed' | 'payment_succeeded' | 'downgraded' | 'upgraded';
  previous_plan?: SubscriptionPlan;
  new_plan?: SubscriptionPlan;
  metadata?: Record<string, any>;
  stripe_event_id?: string;
  created_at: Date;
}

export interface BillingInvoice {
  id: string;
  user_id: string;
  subscription_id: string;
  stripe_invoice_id?: string;
  amount: number;
  currency: 'PHP' | 'MYR' | 'USD';
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  period_start: Date;
  period_end: Date;
  due_date: Date;
  paid_at?: Date;
  invoice_url?: string;
  created_at: Date;
}

export interface FeatureUsageLog {
  id: string;
  user_id: string;
  feature_name: string;
  action: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

// Subscription Analytics Types
export interface SubscriptionAnalytics {
  total_subscribers: number;
  active_subscribers: number;
  trial_users: number;
  churned_users: number;
  mrr: number; // Monthly Recurring Revenue
  arr: number; // Annual Recurring Revenue
  churn_rate: number;
  trial_conversion_rate: number;
  revenue_by_plan: Record<SubscriptionPlan, number>;
  subscribers_by_plan: Record<SubscriptionPlan, number>;
  average_revenue_per_user: number;
  customer_lifetime_value: number;
}

export interface ChurnPrediction {
  user_id: string;
  churn_probability: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  contributing_factors: string[];
  recommended_actions: string[];
  last_activity_date?: Date;
  engagement_score: number;
  support_tickets: number;
  payment_failures: number;
  feature_usage_decline: number;
  created_at: Date;
}

// Upgrade/Downgrade Types
export interface PlanChangeRequest {
  id: string;
  user_id: string;
  current_plan: SubscriptionPlan;
  requested_plan: SubscriptionPlan;
  change_type: 'upgrade' | 'downgrade';
  reason?: string;
  scheduled_for?: Date; // For end-of-period changes
  proration_amount?: number;
  status: 'pending' | 'approved' | 'completed' | 'failed' | 'cancelled';
  created_at: Date;
  processed_at?: Date;
}

// Trial Management Types
export interface TrialExtension {
  id: string;
  user_id: string;
  original_trial_end: Date;
  extended_trial_end: Date;
  extension_days: number;
  reason: string;
  granted_by?: string;
  created_at: Date;
}

// Feature Access Control
export interface FeatureAccess {
  feature_name: string;
  enabled: boolean;
  limit?: number;
  used?: number;
  reset_date?: Date;
  upgrade_required?: boolean;
  upgrade_plan?: SubscriptionPlan;
}

export interface UserFeatureAccess {
  user_id: string;
  plan: SubscriptionPlan;
  subscription_status: SubscriptionStatus;
  features: Record<string, FeatureAccess>;
  trial_features_enabled: boolean;
  grace_period_until?: Date;
}

// Billing and Payment Types
export interface PaymentMethod {
  id: string;
  user_id: string;
  stripe_payment_method_id: string;
  type: 'card' | 'bank_account';
  card_brand?: string;
  card_last4?: string;
  is_default: boolean;
  created_at: Date;
}

export interface SubscriptionDiscount {
  id: string;
  user_id: string;
  subscription_id: string;
  code: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  duration: 'once' | 'repeating' | 'forever';
  duration_in_months?: number;
  applied_at: Date;
  expires_at?: Date;
}

// Admin/Support Types
export interface SubscriptionAdminAction {
  id: string;
  admin_user_id: string;
  target_user_id: string;
  action: 'extend_trial' | 'upgrade_plan' | 'downgrade_plan' | 'cancel_subscription' | 'refund_payment' | 'apply_discount';
  reason: string;
  metadata?: Record<string, any>;
  created_at: Date;
}