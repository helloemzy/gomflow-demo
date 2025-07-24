-- ============================================================================
-- GOMFLOW PRODUCTION COMPLETE DATABASE SCHEMA - SUPABASE COMPATIBLE
-- Fixed version without CONCURRENT indexes for Supabase SQL Editor
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- For query monitoring

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================
CREATE TYPE user_plan AS ENUM ('free', 'pro', 'gateway', 'business');
CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'cancelled');
CREATE TYPE country_code AS ENUM ('PH', 'MY');
CREATE TYPE currency_code AS ENUM ('PHP', 'MYR');
CREATE TYPE submission_status AS ENUM ('pending', 'paid', 'failed', 'expired', 'cancelled');
CREATE TYPE platform_type AS ENUM ('whatsapp', 'telegram', 'discord', 'web');
CREATE TYPE message_type AS ENUM ('reminder', 'confirmation', 'query_response', 'custom');
CREATE TYPE message_status AS ENUM ('pending', 'sent', 'failed', 'delivered');
CREATE TYPE payment_gateway AS ENUM ('paymongo', 'billplz');
CREATE TYPE connection_type AS ENUM ('group', 'channel', 'webhook');
CREATE TYPE post_status AS ENUM ('posted', 'failed', 'deleted');

-- ============================================================================
-- CORE PLATFORM TABLES
-- ============================================================================

-- PROFILES TABLE (Replaces users - links to auth.users)
CREATE TABLE profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    country country_code NOT NULL DEFAULT 'PH',
    timezone TEXT NOT NULL DEFAULT 'Asia/Manila',
    whatsapp_enabled BOOLEAN DEFAULT false,
    telegram_enabled BOOLEAN DEFAULT false,
    discord_enabled BOOLEAN DEFAULT false,
    plan user_plan DEFAULT 'free',
    subscription_status subscription_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ORDERS TABLE
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    product_category TEXT NOT NULL DEFAULT 'album',
    product_type TEXT NOT NULL DEFAULT 'physical',
    unit_price DECIMAL(10,2) NOT NULL,
    currency currency_code NOT NULL,
    minimum_quantity INTEGER NOT NULL DEFAULT 1,
    maximum_quantity INTEGER,
    current_quantity INTEGER DEFAULT 0,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SUBMISSIONS TABLE
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    buyer_email TEXT NOT NULL,
    buyer_name TEXT NOT NULL,
    buyer_phone TEXT,
    buyer_country country_code NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method TEXT NOT NULL,
    payment_proof_url TEXT,
    status submission_status DEFAULT 'pending',
    platform platform_type DEFAULT 'web',
    platform_user_id TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PAYMENT_TRANSACTIONS TABLE
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    gateway payment_gateway NOT NULL,
    gateway_transaction_id TEXT UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    currency currency_code NOT NULL,
    gateway_status TEXT NOT NULL,
    gateway_response JSONB,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PLATFORM_CONNECTIONS TABLE
CREATE TABLE platform_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    platform_user_id TEXT NOT NULL,
    platform_username TEXT,
    connection_type connection_type NOT NULL,
    connection_data JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, platform, platform_user_id)
);

-- MESSAGES TABLE
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
    platform platform_type NOT NULL,
    recipient_platform_id TEXT NOT NULL,
    message_type message_type NOT NULL,
    content TEXT NOT NULL,
    status message_status DEFAULT 'pending',
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PLATFORM_POSTS TABLE
CREATE TABLE platform_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    platform_post_id TEXT,
    post_content TEXT NOT NULL,
    status post_status DEFAULT 'posted',
    engagement_data JSONB DEFAULT '{}',
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- NOTIFICATIONS SYSTEM TABLES
-- ============================================================================

-- NOTIFICATIONS TABLE
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    data JSONB DEFAULT '{}',
    read_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- NOTIFICATION_PREFERENCES TABLE
CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
    email_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT false,
    whatsapp_enabled BOOLEAN DEFAULT true,
    telegram_enabled BOOLEAN DEFAULT true,
    discord_enabled BOOLEAN DEFAULT true,
    quiet_hours_start TIME DEFAULT '22:00',
    quiet_hours_end TIME DEFAULT '08:00',
    timezone TEXT DEFAULT 'Asia/Manila',
    order_reminders BOOLEAN DEFAULT true,
    payment_confirmations BOOLEAN DEFAULT true,
    system_alerts BOOLEAN DEFAULT true,
    marketing BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- USER_DEVICES TABLE
CREATE TABLE user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    device_token TEXT NOT NULL,
    device_type TEXT NOT NULL, -- 'ios', 'android', 'web'
    device_info JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, device_token)
);

-- NOTIFICATION_TEMPLATES TABLE
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    subject TEXT,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '{}',
    channel TEXT NOT NULL, -- 'email', 'push', 'sms', 'whatsapp', 'telegram', 'discord'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- NOTIFICATION_DELIVERIES TABLE
CREATE TABLE notification_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    recipient TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
    external_id TEXT, -- ID from external service (email service, push service, etc.)
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ANALYTICS SYSTEM TABLES
-- ============================================================================

-- ANALYTICS_EVENTS TABLE
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    session_id TEXT,
    event_type TEXT NOT NULL,
    event_name TEXT NOT NULL,
    properties JSONB DEFAULT '{}',
    page_url TEXT,
    referrer TEXT,
    user_agent TEXT,
    ip_address INET,
    country TEXT,
    city TEXT,
    device_type TEXT,
    browser TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ANALYTICS_AGGREGATIONS TABLE
CREATE TABLE analytics_aggregations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name TEXT NOT NULL,
    metric_value NUMERIC NOT NULL,
    dimensions JSONB DEFAULT '{}',
    time_bucket TIMESTAMP WITH TIME ZONE NOT NULL,
    bucket_size TEXT NOT NULL, -- 'hour', 'day', 'week', 'month'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metric_name, time_bucket, bucket_size, dimensions)
);

-- ANALYTICS_REPORTS TABLE
CREATE TABLE analytics_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    query TEXT NOT NULL,
    parameters JSONB DEFAULT '{}',
    schedule TEXT, -- cron expression
    format TEXT DEFAULT 'json', -- 'json', 'csv', 'pdf'
    is_active BOOLEAN DEFAULT true,
    generated_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ANALYTICS_ALERTS TABLE
CREATE TABLE analytics_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    metric_name TEXT NOT NULL,
    condition_operator TEXT NOT NULL, -- '>', '<', '>=', '<=', '=', '!='
    threshold_value NUMERIC NOT NULL,
    time_window TEXT NOT NULL, -- '5m', '1h', '1d', etc.
    is_active BOOLEAN DEFAULT true,
    notification_channels JSONB DEFAULT '[]', -- ['email', 'slack', 'discord']
    last_triggered TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ANALYTICS_EXPORT_JOBS TABLE
CREATE TABLE analytics_export_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    query TEXT NOT NULL,
    format TEXT NOT NULL, -- 'csv', 'json', 'excel', 'pdf'
    parameters JSONB DEFAULT '{}',
    status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    file_path TEXT,
    error_message TEXT,
    requested_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ANALYTICS_DASHBOARDS TABLE
CREATE TABLE analytics_dashboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    layout JSONB NOT NULL DEFAULT '{}',
    widgets JSONB NOT NULL DEFAULT '[]',
    is_public BOOLEAN DEFAULT false,
    created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ANALYTICS_USER_SESSIONS TABLE
CREATE TABLE analytics_user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
    session_id TEXT UNIQUE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP WITH TIME ZONE,
    page_views INTEGER DEFAULT 0,
    events_count INTEGER DEFAULT 0,
    referrer TEXT,
    landing_page TEXT,
    exit_page TEXT,
    device_info JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ANALYTICS_FUNNELS TABLE
CREATE TABLE analytics_funnels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    steps JSONB NOT NULL DEFAULT '[]', -- Array of step definitions
    time_window TEXT DEFAULT '30d', -- How long users have to complete funnel
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ANALYTICS_COHORTS TABLE
CREATE TABLE analytics_cohorts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    definition JSONB NOT NULL DEFAULT '{}', -- Cohort definition criteria
    size INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ANALYTICS_SEGMENTS TABLE
CREATE TABLE analytics_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL DEFAULT '{}', -- Segmentation criteria
    user_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    last_computed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ANALYTICS_AB_TESTS TABLE
CREATE TABLE analytics_ab_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    hypothesis TEXT,
    variants JSONB NOT NULL DEFAULT '[]', -- Test variants configuration
    traffic_allocation JSONB DEFAULT '{}', -- Traffic split configuration
    status TEXT DEFAULT 'draft', -- 'draft', 'running', 'paused', 'completed'
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MONITORING SYSTEM TABLES
-- ============================================================================

-- MONITORING_METRICS TABLE
CREATE TABLE monitoring_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value NUMERIC NOT NULL,
    metric_type TEXT NOT NULL, -- 'counter', 'gauge', 'histogram', 'summary'
    tags JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MONITORING_ALERTS TABLE
CREATE TABLE monitoring_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_name TEXT NOT NULL,
    service_name TEXT NOT NULL,
    severity TEXT NOT NULL, -- 'critical', 'warning', 'info'
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    status TEXT DEFAULT 'active', -- 'active', 'acknowledged', 'resolved'
    acknowledged_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MONITORING_LOGS TABLE
CREATE TABLE monitoring_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name TEXT NOT NULL,
    level TEXT NOT NULL, -- 'error', 'warn', 'info', 'debug'
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    request_id TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MONITORING_DASHBOARDS TABLE
CREATE TABLE monitoring_dashboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}',
    is_public BOOLEAN DEFAULT false,
    created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MONITORING_NOTIFICATIONS TABLE
CREATE TABLE monitoring_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID NOT NULL REFERENCES monitoring_alerts(id) ON DELETE CASCADE,
    channel TEXT NOT NULL, -- 'email', 'slack', 'discord', 'webhook'
    recipient TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    response TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MONITORING_SERVICE_HEALTH TABLE
CREATE TABLE monitoring_service_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name TEXT NOT NULL,
    status TEXT NOT NULL, -- 'healthy', 'degraded', 'unhealthy'
    response_time INTEGER, -- in milliseconds
    uptime_percentage NUMERIC(5,2),
    last_check TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service_name)
);

-- MONITORING_ALERT_RULES TABLE
CREATE TABLE monitoring_alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    service_name TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    condition_operator TEXT NOT NULL, -- '>', '<', '>=', '<=', '=', '!='
    threshold_value NUMERIC NOT NULL,
    time_window TEXT NOT NULL, -- '5m', '1h', '1d', etc.
    severity TEXT NOT NULL, -- 'critical', 'warning', 'info'
    notification_channels JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MONITORING_DOWNTIMES TABLE
CREATE TABLE monitoring_downtimes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_name TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    reason TEXT,
    impact_level TEXT, -- 'low', 'medium', 'high', 'critical'
    affected_features JSONB DEFAULT '[]',
    created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- PERFORMANCE INDEXES (Non-concurrent for Supabase compatibility)
-- ============================================================================

-- Core table indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON profiles(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles(country);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_active_deadline ON orders(deadline) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_submissions_order_id ON submissions(order_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_buyer_email ON submissions(buyer_email);
CREATE INDEX IF NOT EXISTS idx_submissions_pending ON submissions(created_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_payment_transactions_submission_id ON payment_transactions(submission_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_gateway_status ON payment_transactions(gateway, gateway_status);

CREATE INDEX IF NOT EXISTS idx_platform_connections_user_platform ON platform_connections(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_messages_order_id ON messages(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_platform_recipient ON messages(platform, recipient_platform_id);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification_id ON notification_deliveries(notification_id);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created ON analytics_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created ON analytics_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_aggregations_metric_time ON analytics_aggregations(metric_name, time_bucket);

-- Monitoring indexes
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_service_time ON monitoring_metrics(service_name, timestamp);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_service_status ON monitoring_alerts(service_name, status);
CREATE INDEX IF NOT EXISTS idx_monitoring_logs_service_level_time ON monitoring_logs(service_name, level, timestamp);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_aggregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_service_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_downtimes ENABLE ROW LEVEL SECURITY;

-- Core platform policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own orders" ON orders FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view submissions for their orders" ON submissions FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = submissions.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Anyone can create submissions" ON submissions FOR INSERT WITH CHECK (true);

-- Service role policies (for microservices)
CREATE POLICY "Service role full access profiles" ON profiles FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access orders" ON orders FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access submissions" ON submissions FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access payments" ON payment_transactions FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access messages" ON messages FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access platform_posts" ON platform_posts FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access notifications" ON notifications FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access analytics" ON analytics_events FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role full access monitoring" ON monitoring_metrics FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Create storage buckets for file uploads
INSERT INTO storage.buckets (id, name, public) VALUES 
    ('payment-proofs', 'payment-proofs', false),
    ('profile-images', 'profile-images', true),
    ('order-images', 'order-images', true),
    ('export-files', 'export-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload payment proofs" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view own payment proofs" ON storage.objects
    FOR SELECT USING (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Service role can access all payment proofs" ON storage.objects
    FOR ALL USING (bucket_id = 'payment-proofs' AND auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- NOTIFICATION TEMPLATES
-- ============================================================================

-- Insert default notification templates
INSERT INTO notification_templates (name, subject, content, variables, channel) VALUES
('order_created_whatsapp', '', 'Hi {{buyer_name}}! Your order for "{{order_title}}" has been created. Please submit your details: {{order_link}}', '{"buyer_name": "string", "order_title": "string", "order_link": "string"}', 'whatsapp'),
('payment_reminder_whatsapp', '', 'Reminder: Payment deadline for "{{order_title}}" is {{deadline}}. Please submit payment proof: {{order_link}}', '{"order_title": "string", "deadline": "string", "order_link": "string"}', 'whatsapp'),
('payment_confirmed_whatsapp', '', 'Payment confirmed for "{{order_title}}"! Amount: {{amount}} {{currency}}. Thank you!', '{"order_title": "string", "amount": "number", "currency": "string"}', 'whatsapp'),
('order_completed_whatsapp', '', 'Order "{{order_title}}" is complete! {{total_submissions}} orders collected. Shipping details will follow.', '{"order_title": "string", "total_submissions": "number"}', 'whatsapp'),
('new_submission_telegram', 'New Order Submission', '🔔 New submission for "{{order_title}}"!\n\nBuyer: {{buyer_name}}\nAmount: {{amount}} {{currency}}\nTotal submissions: {{current_quantity}}/{{maximum_quantity}}', '{"order_title": "string", "buyer_name": "string", "amount": "number", "currency": "string", "current_quantity": "number", "maximum_quantity": "number"}', 'telegram'),
('payment_received_telegram', 'Payment Received', '💰 Payment received for "{{order_title}}"!\n\nBuyer: {{buyer_name}}\nAmount: {{amount}} {{currency}}\nStatus: Confirmed ✅', '{"order_title": "string", "buyer_name": "string", "amount": "number", "currency": "string"}', 'telegram'),
('order_deadline_discord', 'Order Deadline Reminder', '⏰ **Deadline Alert**\n\nOrder: {{order_title}}\nDeadline: {{deadline}}\nCurrent: {{current_quantity}}/{{minimum_quantity}} minimum\n\nShare the order link to get more buyers!', '{"order_title": "string", "deadline": "string", "current_quantity": "number", "minimum_quantity": "number"}', 'discord'),
('weekly_summary_email', 'Weekly Order Summary', 'Your weekly GOMFLOW summary: {{total_orders}} orders, {{total_revenue}} {{currency}} revenue, {{total_buyers}} buyers. Keep growing your business!', '{"total_orders": "number", "total_revenue": "number", "currency": "string", "total_buyers": "number"}', 'email')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- DATABASE FUNCTIONS
-- ============================================================================

-- Function to get order statistics for a user
CREATE OR REPLACE FUNCTION get_user_order_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_orders', COUNT(o.id),
        'active_orders', COUNT(o.id) FILTER (WHERE o.is_active = true),
        'total_submissions', COALESCE(SUM((SELECT COUNT(*) FROM submissions s WHERE s.order_id = o.id)), 0),
        'total_revenue', COALESCE(SUM((SELECT SUM(s.total_amount) FROM submissions s WHERE s.order_id = o.id AND s.status = 'paid')), 0),
        'pending_revenue', COALESCE(SUM((SELECT SUM(s.total_amount) FROM submissions s WHERE s.order_id = o.id AND s.status = 'pending')), 0)
    ) INTO result
    FROM orders o
    WHERE o.user_id = user_uuid;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create notification preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count for a user
CREATE OR REPLACE FUNCTION get_unread_notification_count(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM notifications
        WHERE user_id = user_uuid
        AND read_at IS NULL
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications
    SET read_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = notification_uuid
    AND user_id = user_uuid
    AND read_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Clean old notifications (30 days)
    DELETE FROM notifications
    WHERE (
        (read_at IS NOT NULL AND created_at < CURRENT_TIMESTAMP - INTERVAL '30 days')
        OR
        (expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days')
    );
    
    -- Clean old analytics events (365 days)
    DELETE FROM analytics_events WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '365 days';
    
    -- Clean old monitoring data (30 days)
    DELETE FROM monitoring_metrics WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    -- Clean old expired submissions (90 days)
    DELETE FROM submissions 
    WHERE status = 'expired' 
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    -- Clean old messages (60 days)
    DELETE FROM messages 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '60 days';
    
    RAISE NOTICE 'Cleanup completed successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for database health check
CREATE OR REPLACE FUNCTION database_health_check()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'timestamp', CURRENT_TIMESTAMP,
        'status', 'healthy',
        'version', version(),
        'connections', (
            SELECT count(*) FROM pg_stat_activity 
            WHERE state = 'active'
        ),
        'database_size', (
            SELECT pg_size_pretty(pg_database_size(current_database()))
        ),
        'table_counts', json_build_object(
            'profiles', (SELECT count(*) FROM profiles),
            'orders', (SELECT count(*) FROM orders),
            'submissions', (SELECT count(*) FROM submissions),
            'notifications', (SELECT count(*) FROM notifications),
            'analytics_events', (SELECT count(*) FROM analytics_events),
            'monitoring_metrics', (SELECT count(*) FROM monitoring_metrics)
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to create notification preferences for new users
CREATE TRIGGER trigger_create_notification_preferences
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION create_default_notification_preferences();

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

SELECT 'GOMFLOW production database schema deployed successfully! 🚀' as status,
       'Total tables created: 31' as tables,
       'Core: 7, Notifications: 5, Analytics: 11, Monitoring: 8' as breakdown,
       'All RLS policies, indexes, and functions configured' as security,
       'Storage buckets and notification templates ready' as features;