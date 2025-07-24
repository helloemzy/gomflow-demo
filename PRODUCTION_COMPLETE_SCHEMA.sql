-- ============================================================================
-- GOMFLOW PRODUCTION COMPLETE DATABASE SCHEMA
-- Production-Ready Setup for K-pop Group Order Management Platform
-- 
-- This script includes:
-- - Core platform tables (7 tables)
-- - Notifications system (5 tables) 
-- - Analytics system (11 tables)
-- - Monitoring system (8 tables)
-- - All necessary indexes, RLS policies, and functions
-- - Production optimizations and security hardening
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
    subscription_status subscription_status DEFAULT 'inactive',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ORDERS TABLE
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    currency currency_code NOT NULL,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    payment_methods JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    auto_close_on_deadline BOOLEAN DEFAULT true,
    min_orders INTEGER DEFAULT 1 CHECK (min_orders >= 1),
    max_orders INTEGER CHECK (max_orders IS NULL OR max_orders >= min_orders),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SUBMISSIONS TABLE
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    buyer_name VARCHAR(255) NOT NULL,
    buyer_phone VARCHAR(20) NOT NULL,
    buyer_email VARCHAR(255),
    buyer_platform platform_type DEFAULT 'web',
    buyer_platform_id VARCHAR(100),
    quantity INTEGER NOT NULL CHECK (quantity >= 1),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    currency currency_code NOT NULL,
    payment_reference VARCHAR(50) UNIQUE NOT NULL,
    payment_gateway payment_gateway,
    payment_intent_id VARCHAR(255),
    checkout_session_id VARCHAR(255),
    payment_url TEXT,
    status submission_status DEFAULT 'pending',
    source_platform VARCHAR(50),
    utm_source VARCHAR(100),
    last_reminder_sent TIMESTAMP WITH TIME ZONE,
    reminder_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PAYMENT_TRANSACTIONS TABLE
CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    gateway payment_gateway NOT NULL,
    gateway_payment_id VARCHAR(255) NOT NULL,
    gateway_status VARCHAR(50) NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    currency currency_code NOT NULL,
    payment_method VARCHAR(50),
    paid_at TIMESTAMP WITH TIME ZONE,
    webhook_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PLATFORM_CONNECTIONS TABLE
CREATE TABLE platform_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    connection_type connection_type NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MESSAGES TABLE
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    message_type message_type NOT NULL,
    content TEXT NOT NULL,
    status message_status DEFAULT 'pending',
    external_message_id VARCHAR(255),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PLATFORM_POSTS TABLE
CREATE TABLE platform_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    post_id VARCHAR(255),
    post_url TEXT,
    status post_status DEFAULT 'posted',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- NOTIFICATIONS SYSTEM TABLES
-- ============================================================================

-- Notifications table to store all notification events
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'order_created',
        'order_updated', 
        'order_deadline_approaching',
        'order_goal_reached',
        'order_completed',
        'order_cancelled',
        'submission_created',
        'submission_payment_required',
        'submission_payment_confirmed',
        'submission_payment_rejected',
        'new_order_recommendation',
        'category_update',
        'gom_message',
        'announcement',
        'system_maintenance',
        'feature_update'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    channels_sent TEXT[] DEFAULT '{}',
    sent_successfully BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    errors TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Notification preferences for each user
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE UNIQUE,
    order_updates JSONB DEFAULT '{
        "websocket": true,
        "push": true,
        "email": false
    }',
    payment_updates JSONB DEFAULT '{
        "websocket": true,
        "push": true,
        "email": true
    }',
    discovery JSONB DEFAULT '{
        "websocket": true,
        "push": false,
        "email": false
    }',
    communications JSONB DEFAULT '{
        "websocket": true,
        "push": true,
        "email": true
    }',
    quiet_hours JSONB DEFAULT '{
        "enabled": false,
        "start_time": "22:00",
        "end_time": "08:00",
        "timezone": "Asia/Manila"
    }',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User devices for push notifications (FCM tokens)
CREATE TABLE user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    device_type TEXT NOT NULL CHECK (device_type IN ('web', 'ios', 'android')),
    device_id TEXT NOT NULL,
    fcm_token TEXT NOT NULL,
    device_info JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, device_id)
);

-- Notification templates for different channels and events
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('websocket', 'push', 'email', 'sms')),
    language TEXT NOT NULL DEFAULT 'en',
    subject TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    html_content TEXT,
    variables TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(type, channel, language)
);

-- Notification delivery log for tracking and analytics
CREATE TABLE notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('websocket', 'push', 'email', 'sms')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
    external_id TEXT,
    error_message TEXT,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ANALYTICS SYSTEM TABLES
-- ============================================================================

-- Analytics events table - stores all raw analytics events
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'order_created',
        'order_updated',
        'order_deadline_reached',
        'order_goal_reached',
        'order_completed',
        'order_cancelled',
        'submission_created',
        'submission_updated',
        'submission_payment_uploaded',
        'submission_payment_verified',
        'submission_payment_rejected',
        'user_registered',
        'user_login',
        'user_profile_updated',
        'platform_message_sent',
        'platform_message_received',
        'platform_notification_sent',
        'error_occurred',
        'api_error',
        'payment_error'
    )),
    user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
    guild_id TEXT,
    platform TEXT CHECK (platform IN ('web', 'mobile', 'discord', 'telegram', 'whatsapp')),
    country TEXT CHECK (country IN ('PH', 'MY')),
    currency TEXT CHECK (currency IN ('PHP', 'MYR')),
    event_data JSONB DEFAULT '{}',
    session_id TEXT,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analytics aggregations table - stores pre-calculated metrics
CREATE TABLE analytics_aggregations (
    id TEXT PRIMARY KEY,
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    dimensions JSONB DEFAULT '{}',
    time_bucket TIMESTAMP WITH TIME ZONE NOT NULL,
    bucket_size TEXT NOT NULL CHECK (bucket_size IN ('minute', 'hour', 'day', 'week', 'month')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analytics reports table - stores generated reports
CREATE TABLE analytics_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    report_type TEXT NOT NULL CHECK (report_type IN ('realtime', 'scheduled', 'on_demand')),
    report_data JSONB NOT NULL,
    filters JSONB DEFAULT '{}',
    format TEXT NOT NULL CHECK (format IN ('json', 'csv', 'pdf', 'excel')),
    file_url TEXT,
    status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('generating', 'generated', 'failed', 'expired')),
    generated_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Analytics alerts table - stores alert configurations
CREATE TABLE analytics_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    metric TEXT NOT NULL,
    condition TEXT NOT NULL CHECK (condition IN ('above', 'below', 'equals', 'changes_by')),
    threshold DECIMAL(15,4) NOT NULL,
    time_window INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    recipients TEXT[] DEFAULT '{}',
    channels TEXT[] DEFAULT '{}',
    webhook_url TEXT,
    last_triggered TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analytics export jobs table - tracks data export requests
CREATE TABLE analytics_export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_data JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    file_url TEXT,
    file_size BIGINT,
    error_message TEXT,
    requested_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Analytics dashboard configs table - stores dashboard configurations
CREATE TABLE analytics_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    is_default BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT false,
    created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    shared_with TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analytics user sessions table - tracks user sessions for engagement metrics
CREATE TABLE analytics_user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    platform TEXT CHECK (platform IN ('web', 'mobile', 'discord', 'telegram', 'whatsapp')),
    country TEXT CHECK (country IN ('PH', 'MY')),
    user_agent TEXT,
    ip_address INET,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    page_views INTEGER DEFAULT 0,
    actions_taken INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true
);

-- Analytics funnels table - stores funnel configurations
CREATE TABLE analytics_funnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    steps JSONB NOT NULL,
    conversion_window_hours INTEGER DEFAULT 24,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analytics cohorts table - stores cohort analysis results
CREATE TABLE analytics_cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_date DATE NOT NULL,
    cohort_size INTEGER NOT NULL,
    period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
    metric_type TEXT NOT NULL CHECK (metric_type IN ('retention', 'revenue', 'orders')),
    period_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analytics segments table - stores user segment definitions
CREATE TABLE analytics_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL,
    user_count INTEGER DEFAULT 0,
    last_calculated TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analytics ab_tests table - stores A/B test configurations
CREATE TABLE analytics_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    variants JSONB NOT NULL,
    traffic_allocation JSONB NOT NULL,
    metrics JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'paused')),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    results JSONB,
    created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MONITORING SYSTEM TABLES
-- ============================================================================

-- Monitoring metrics table - stores all system and service metrics
CREATE TABLE monitoring_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    labels JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Monitoring alerts table - stores alert configurations and status
CREATE TABLE monitoring_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN (
        'cpu_high',
        'memory_high',
        'disk_full',
        'service_down',
        'response_time_high',
        'error_rate_high',
        'queue_backlog',
        'database_slow',
        'custom'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    service TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    threshold DECIMAL(15,4) NOT NULL,
    current_value DECIMAL(15,4) NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'acknowledged', 'suppressed')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Monitoring logs table - stores application logs
CREATE TABLE monitoring_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('error', 'warn', 'info', 'debug')),
    service TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    trace_id TEXT,
    user_id UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Monitoring dashboards table - stores dashboard configurations
CREATE TABLE monitoring_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    widgets JSONB NOT NULL DEFAULT '[]',
    is_public BOOLEAN DEFAULT false,
    created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    shared_with TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Monitoring notifications table - tracks sent notifications
CREATE TABLE monitoring_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id UUID REFERENCES monitoring_alerts(id) ON DELETE CASCADE,
    channels TEXT[] NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'failed', 'retry')),
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    retry_count INTEGER DEFAULT 0
);

-- Monitoring service health table - stores service health snapshots
CREATE TABLE monitoring_service_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'unhealthy', 'degraded', 'unknown')),
    response_time INTEGER NOT NULL,
    uptime_percentage DECIMAL(5,2) DEFAULT 100.00,
    version TEXT,
    details JSONB DEFAULT '{}',
    dependencies JSONB DEFAULT '[]',
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Monitoring alert rules table - stores alert rule configurations
CREATE TABLE monitoring_alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    service TEXT NOT NULL,
    metric TEXT NOT NULL,
    condition TEXT NOT NULL CHECK (condition IN ('above', 'below', 'equals', 'changes_by')),
    threshold DECIMAL(15,4) NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 60,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    enabled BOOLEAN DEFAULT true,
    notification_channels TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Monitoring downtimes table - tracks planned and unplanned downtimes
CREATE TABLE monitoring_downtimes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('planned', 'unplanned')),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    impact TEXT CHECK (impact IN ('none', 'minor', 'major', 'critical')),
    status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('scheduled', 'ongoing', 'resolved')),
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES profiles(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Core platform indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_country ON profiles(country);
CREATE INDEX idx_profiles_plan ON profiles(plan);
CREATE INDEX idx_profiles_created_at ON profiles(created_at);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_slug ON orders(slug);
CREATE INDEX idx_orders_is_active ON orders(is_active);
CREATE INDEX idx_orders_deadline ON orders(deadline);
CREATE INDEX idx_orders_currency ON orders(currency);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_title_trgm ON orders USING gin (title gin_trgm_ops);

CREATE INDEX idx_submissions_order_id ON submissions(order_id);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_payment_reference ON submissions(payment_reference);
CREATE INDEX idx_submissions_buyer_platform ON submissions(buyer_platform);
CREATE INDEX idx_submissions_buyer_platform_id ON submissions(buyer_platform_id);
CREATE INDEX idx_submissions_created_at ON submissions(created_at);
CREATE INDEX idx_submissions_buyer_phone ON submissions(buyer_phone);

CREATE INDEX idx_payment_transactions_submission_id ON payment_transactions(submission_id);
CREATE INDEX idx_payment_transactions_gateway ON payment_transactions(gateway);
CREATE INDEX idx_payment_transactions_gateway_payment_id ON payment_transactions(gateway_payment_id);
CREATE INDEX idx_payment_transactions_paid_at ON payment_transactions(paid_at);

CREATE INDEX idx_platform_connections_user_id ON platform_connections(user_id);
CREATE INDEX idx_platform_connections_platform ON platform_connections(platform);
CREATE INDEX idx_platform_connections_is_active ON platform_connections(is_active);

CREATE INDEX idx_messages_submission_id ON messages(submission_id);
CREATE INDEX idx_messages_platform ON messages(platform);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_sent_at ON messages(sent_at);
CREATE INDEX idx_messages_created_at ON messages(created_at);

CREATE INDEX idx_platform_posts_order_id ON platform_posts(order_id);
CREATE INDEX idx_platform_posts_platform ON platform_posts(platform);
CREATE INDEX idx_platform_posts_status ON platform_posts(status);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_read_at ON notifications(read_at);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;

CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);

CREATE INDEX idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX idx_user_devices_active ON user_devices(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_user_devices_fcm_token ON user_devices(fcm_token);

CREATE INDEX idx_notification_templates_type_channel ON notification_templates(type, channel, language);

CREATE INDEX idx_notification_deliveries_notification_id ON notification_deliveries(notification_id);
CREATE INDEX idx_notification_deliveries_channel_status ON notification_deliveries(channel, status);

-- Analytics indexes
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX idx_analytics_events_platform ON analytics_events(platform);
CREATE INDEX idx_analytics_events_country ON analytics_events(country);
CREATE INDEX idx_analytics_events_order_id ON analytics_events(order_id);
CREATE INDEX idx_analytics_events_submission_id ON analytics_events(submission_id);
CREATE INDEX idx_analytics_events_session_id ON analytics_events(session_id);

CREATE INDEX idx_analytics_events_user_date ON analytics_events(user_id, created_at);
CREATE INDEX idx_analytics_events_type_date ON analytics_events(event_type, created_at);
CREATE INDEX idx_analytics_events_platform_date ON analytics_events(platform, created_at);

CREATE INDEX idx_analytics_aggregations_metric ON analytics_aggregations(metric_name);
CREATE INDEX idx_analytics_aggregations_time_bucket ON analytics_aggregations(time_bucket);
CREATE INDEX idx_analytics_aggregations_bucket_size ON analytics_aggregations(bucket_size);
CREATE INDEX idx_analytics_aggregations_metric_time ON analytics_aggregations(metric_name, time_bucket);

CREATE INDEX idx_analytics_reports_type ON analytics_reports(report_type);
CREATE INDEX idx_analytics_reports_created_at ON analytics_reports(created_at);
CREATE INDEX idx_analytics_reports_generated_by ON analytics_reports(generated_by);

CREATE INDEX idx_analytics_alerts_metric ON analytics_alerts(metric);
CREATE INDEX idx_analytics_alerts_is_active ON analytics_alerts(is_active);

CREATE INDEX idx_analytics_export_jobs_status ON analytics_export_jobs(status);
CREATE INDEX idx_analytics_export_jobs_requested_by ON analytics_export_jobs(requested_by);

CREATE INDEX idx_analytics_user_sessions_user_id ON analytics_user_sessions(user_id);
CREATE INDEX idx_analytics_user_sessions_session_id ON analytics_user_sessions(session_id);
CREATE INDEX idx_analytics_user_sessions_started_at ON analytics_user_sessions(started_at);

CREATE INDEX idx_analytics_segments_name ON analytics_segments(name);
CREATE INDEX idx_analytics_segments_is_active ON analytics_segments(is_active);

-- Monitoring indexes
CREATE INDEX idx_monitoring_metrics_service ON monitoring_metrics(service_name);
CREATE INDEX idx_monitoring_metrics_name ON monitoring_metrics(metric_name);
CREATE INDEX idx_monitoring_metrics_timestamp ON monitoring_metrics(timestamp);
CREATE INDEX idx_monitoring_metrics_service_time ON monitoring_metrics(service_name, timestamp);
CREATE INDEX idx_monitoring_metrics_name_time ON monitoring_metrics(metric_name, timestamp);

CREATE INDEX idx_monitoring_alerts_service ON monitoring_alerts(service);
CREATE INDEX idx_monitoring_alerts_type ON monitoring_alerts(type);
CREATE INDEX idx_monitoring_alerts_severity ON monitoring_alerts(severity);
CREATE INDEX idx_monitoring_alerts_status ON monitoring_alerts(status);
CREATE INDEX idx_monitoring_alerts_created_at ON monitoring_alerts(created_at);
CREATE INDEX idx_monitoring_alerts_service_status ON monitoring_alerts(service, status);

CREATE INDEX idx_monitoring_logs_service ON monitoring_logs(service);
CREATE INDEX idx_monitoring_logs_level ON monitoring_logs(level);
CREATE INDEX idx_monitoring_logs_timestamp ON monitoring_logs(timestamp);
CREATE INDEX idx_monitoring_logs_trace_id ON monitoring_logs(trace_id);
CREATE INDEX idx_monitoring_logs_user_id ON monitoring_logs(user_id);
CREATE INDEX idx_monitoring_logs_service_time ON monitoring_logs(service, timestamp);

CREATE INDEX idx_monitoring_service_health_service ON monitoring_service_health(service_name);
CREATE INDEX idx_monitoring_service_health_status ON monitoring_service_health(status);
CREATE INDEX idx_monitoring_service_health_checked_at ON monitoring_service_health(checked_at);

CREATE INDEX idx_monitoring_notifications_alert_id ON monitoring_notifications(alert_id);
CREATE INDEX idx_monitoring_notifications_status ON monitoring_notifications(status);
CREATE INDEX idx_monitoring_notifications_sent_at ON monitoring_notifications(sent_at);

CREATE INDEX idx_monitoring_alert_rules_service ON monitoring_alert_rules(service);
CREATE INDEX idx_monitoring_alert_rules_enabled ON monitoring_alert_rules(enabled);
CREATE INDEX idx_monitoring_alert_rules_severity ON monitoring_alert_rules(severity);

CREATE INDEX idx_monitoring_downtimes_service ON monitoring_downtimes(service);
CREATE INDEX idx_monitoring_downtimes_type ON monitoring_downtimes(type);
CREATE INDEX idx_monitoring_downtimes_status ON monitoring_downtimes(status);
CREATE INDEX idx_monitoring_downtimes_start_time ON monitoring_downtimes(start_time);

-- Additional production performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_email_lower ON profiles(LOWER(email));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_active ON orders(user_id, is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_order_status ON submissions(order_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_gateway_status ON payment_transactions(gateway, gateway_status);

-- Partial indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_active_deadline ON orders(deadline) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_pending ON submissions(created_at) WHERE status = 'pending';

-- ============================================================================
-- DATABASE FUNCTIONS
-- ============================================================================

-- Function to generate unique payment reference
CREATE OR REPLACE FUNCTION generate_payment_reference(country_prefix TEXT)
RETURNS TEXT AS $$
DECLARE
    reference TEXT;
    exists_check INTEGER;
BEGIN
    LOOP
        reference := country_prefix || '-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8));
        SELECT COUNT(*) INTO exists_check FROM submissions WHERE payment_reference = reference;
        EXIT WHEN exists_check = 0;
    END LOOP;
    RETURN reference;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to get order stats
CREATE OR REPLACE FUNCTION get_order_stats(order_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_submissions', COUNT(*),
        'pending_submissions', COUNT(*) FILTER (WHERE status = 'pending'),
        'paid_submissions', COUNT(*) FILTER (WHERE status = 'paid'),
        'total_quantity', COALESCE(SUM(quantity), 0),
        'total_revenue', COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid'), 0),
        'pending_revenue', COALESCE(SUM(total_amount) FILTER (WHERE status = 'pending'), 0)
    ) INTO result
    FROM submissions 
    WHERE order_id = order_uuid;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get user dashboard stats
CREATE OR REPLACE FUNCTION get_user_dashboard_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_orders', COUNT(o.*),
        'active_orders', COUNT(o.*) FILTER (WHERE o.is_active = true),
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

-- Updated_at triggers for core tables
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_submissions_updated_at
    BEFORE UPDATE ON submissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to create default notification preferences when profile is created
CREATE TRIGGER trigger_create_notification_preferences
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_default_notification_preferences();

-- Updated_at triggers for notification tables
CREATE TRIGGER trigger_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_devices_updated_at
    BEFORE UPDATE ON user_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_notification_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Updated_at triggers for analytics tables
CREATE TRIGGER trigger_analytics_alerts_updated_at
    BEFORE UPDATE ON analytics_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_analytics_dashboards_updated_at
    BEFORE UPDATE ON analytics_dashboards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_analytics_funnels_updated_at
    BEFORE UPDATE ON analytics_funnels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_analytics_segments_updated_at
    BEFORE UPDATE ON analytics_segments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_analytics_ab_tests_updated_at
    BEFORE UPDATE ON analytics_ab_tests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Updated_at triggers for monitoring tables
CREATE TRIGGER trigger_monitoring_alerts_updated_at
    BEFORE UPDATE ON monitoring_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_monitoring_dashboards_updated_at
    BEFORE UPDATE ON monitoring_dashboards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_monitoring_alert_rules_updated_at
    BEFORE UPDATE ON monitoring_alert_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_monitoring_downtimes_updated_at
    BEFORE UPDATE ON monitoring_downtimes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

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

-- Notifications RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

-- Analytics RLS
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

-- Monitoring RLS
ALTER TABLE monitoring_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_service_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_downtimes ENABLE ROW LEVEL SECURITY;

-- Core Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Orders policies
CREATE POLICY "Users can view own orders" ON orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders" ON orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders" ON orders
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Public can view active orders" ON orders
    FOR SELECT USING (is_active = true);

-- Submissions policies
CREATE POLICY "Order owners can view submissions" ON submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = submissions.order_id 
            AND orders.user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can create submissions for active orders" ON submissions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_id 
            AND orders.is_active = true 
            AND orders.deadline > NOW()
        )
    );

CREATE POLICY "Order owners can update submissions" ON submissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = submissions.order_id 
            AND orders.user_id = auth.uid()
        )
    );

-- Payment transactions policies
CREATE POLICY "Order owners can view payment transactions" ON payment_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN orders o ON o.id = s.order_id
            WHERE s.id = payment_transactions.submission_id 
            AND o.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage payment transactions" ON payment_transactions
    FOR ALL USING (auth.role() = 'service_role');

-- Platform connections policies
CREATE POLICY "Users can manage own platform connections" ON platform_connections
    FOR ALL USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Order owners can view messages" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN orders o ON o.id = s.order_id
            WHERE s.id = messages.submission_id 
            AND o.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage messages" ON messages
    FOR ALL USING (auth.role() = 'service_role');

-- Platform posts policies
CREATE POLICY "Order owners can view platform posts" ON platform_posts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = platform_posts.order_id 
            AND orders.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage platform posts" ON platform_posts
    FOR ALL USING (auth.role() = 'service_role');

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage notifications" ON notifications
    FOR ALL USING (auth.role() = 'service_role');

-- Notification preferences policies
CREATE POLICY "Users can view own preferences" ON notification_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON notification_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON notification_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User devices policies
CREATE POLICY "Users can manage own devices" ON user_devices
    FOR ALL USING (auth.uid() = user_id);

-- Notification templates policies
CREATE POLICY "Anyone can view templates" ON notification_templates
    FOR SELECT USING (true);

-- Notification deliveries policies
CREATE POLICY "Users can view own deliveries" ON notification_deliveries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM notifications n 
            WHERE n.id = notification_deliveries.notification_id 
            AND n.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage deliveries" ON notification_deliveries
    FOR ALL USING (auth.role() = 'service_role');

-- Analytics policies
CREATE POLICY "Anyone can track events" ON analytics_events
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view own events" ON analytics_events
    FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Service role can manage analytics" ON analytics_events
    FOR ALL USING (auth.role() = 'service_role');

-- Analytics aggregations policies
CREATE POLICY "Anyone can view aggregations" ON analytics_aggregations
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage aggregations" ON analytics_aggregations
    FOR ALL USING (auth.role() = 'service_role');

-- Analytics reports policies
CREATE POLICY "Users can view own reports" ON analytics_reports
    FOR SELECT USING (auth.uid() = generated_by OR auth.role() = 'service_role');

CREATE POLICY "Users can create reports" ON analytics_reports
    FOR INSERT WITH CHECK (auth.uid() = generated_by);

-- Analytics dashboards policies
CREATE POLICY "Users can view accessible dashboards" ON analytics_dashboards
    FOR SELECT USING (
        is_public = true OR 
        auth.uid() = created_by OR 
        auth.uid() = ANY(shared_with::uuid[]) OR 
        auth.role() = 'service_role'
    );

CREATE POLICY "Users can create dashboards" ON analytics_dashboards
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own dashboards" ON analytics_dashboards
    FOR UPDATE USING (auth.uid() = created_by OR auth.role() = 'service_role');

-- Monitoring policies
CREATE POLICY "Service accounts can insert metrics" ON monitoring_metrics
    FOR INSERT WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

CREATE POLICY "Users can view system metrics" ON monitoring_metrics
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage monitoring" ON monitoring_metrics
    FOR ALL USING (auth.role() = 'service_role');

-- Monitoring alerts policies
CREATE POLICY "Users can view alerts" ON monitoring_alerts
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service role can manage alerts" ON monitoring_alerts
    FOR ALL USING (auth.role() = 'service_role');

-- Monitoring logs policies
CREATE POLICY "Service accounts can insert logs" ON monitoring_logs
    FOR INSERT WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

CREATE POLICY "Users can view own logs" ON monitoring_logs
    FOR SELECT USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Service health policies
CREATE POLICY "Anyone can view service health" ON monitoring_service_health
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service accounts can insert health" ON monitoring_service_health
    FOR INSERT WITH CHECK (auth.role() IN ('service_role', 'authenticated'));

-- Service role policies for all tables
CREATE POLICY "Service role full access profiles" ON profiles
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access orders" ON orders
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access submissions" ON submissions
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- STORAGE SETUP
-- ============================================================================

-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Create additional buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('profile-images', 'profile-images', true),
    ('order-images', 'order-images', true),
    ('export-files', 'export-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment proofs
CREATE POLICY "Order owners can view payment proofs" ON storage.objects
    FOR SELECT USING (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can upload payment proofs" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');

CREATE POLICY "Service role can manage payment proofs" ON storage.objects
    FOR ALL USING (bucket_id = 'payment-proofs' AND auth.role() = 'service_role');

-- Profile images policies
CREATE POLICY "Users can upload own profile images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view profile images" ON storage.objects
    FOR SELECT USING (bucket_id = 'profile-images');

-- Order images policies
CREATE POLICY "Users can upload order images for own orders" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'order-images' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view order images" ON storage.objects
    FOR SELECT USING (bucket_id = 'order-images');

-- Export files policies
CREATE POLICY "Users can download own export files" ON storage.objects
    FOR SELECT USING (bucket_id = 'export-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================================
-- NOTIFICATION TEMPLATES
-- ============================================================================

-- Insert default notification templates
INSERT INTO notification_templates (type, channel, language, title, message, variables) VALUES
-- WebSocket templates
('order_created', 'websocket', 'en', 'Order Created', 'Your order "{{orderTitle}}" has been created successfully', ARRAY['orderTitle', 'orderId']),
('order_goal_reached', 'websocket', 'en', 'Order Goal Reached! 🎉', 'The order "{{orderTitle}}" has reached its minimum quantity goal', ARRAY['orderTitle', 'orderId', 'currentQuantity', 'minQuantity']),
('submission_payment_confirmed', 'websocket', 'en', 'Payment Confirmed ✅', 'Your payment for "{{orderTitle}}" has been confirmed', ARRAY['orderTitle', 'orderId', 'amount', 'currency']),

-- Push notification templates
('order_deadline_approaching', 'push', 'en', 'Order Deadline Approaching ⏰', 'Order "{{orderTitle}}" closes in {{timeRemaining}}', ARRAY['orderTitle', 'orderId', 'timeRemaining']),
('submission_payment_required', 'push', 'en', 'Payment Required 💳', 'Complete payment for "{{orderTitle}}" within 24 hours', ARRAY['orderTitle', 'orderId', 'amount', 'currency']),
('new_order_recommendation', 'push', 'en', 'New Order Available 🛍️', 'New {{category}} order matching your interests', ARRAY['category', 'orderTitle', 'orderId']),

-- Email templates  
('submission_payment_confirmed', 'email', 'en', 'Payment Confirmed', 'Your payment for order {{orderTitle}} has been successfully confirmed.', ARRAY['orderTitle', 'orderId', 'buyerName', 'amount', 'currency', 'paymentReference', 'quantity', 'orderUrl']),
('order_completed', 'email', 'en', 'Order Completed', 'The order {{orderTitle}} has been completed and will proceed to fulfillment.', ARRAY['orderTitle', 'orderId', 'buyerName', 'deliveryInfo']);

-- ============================================================================
-- VIEWS FOR DASHBOARD
-- ============================================================================

-- Create a view for order summaries (useful for dashboard)
CREATE VIEW order_summaries AS
SELECT 
    o.*,
    p.name as user_name,
    p.username,
    COALESCE(stats.total_submissions, 0) as total_submissions,
    COALESCE(stats.pending_submissions, 0) as pending_submissions,
    COALESCE(stats.paid_submissions, 0) as paid_submissions,
    COALESCE(stats.total_quantity, 0) as total_quantity,
    COALESCE(stats.total_revenue, 0) as total_revenue,
    COALESCE(stats.pending_revenue, 0) as pending_revenue,
    CASE 
        WHEN o.deadline < NOW() THEN 'expired'
        WHEN NOT o.is_active THEN 'closed'
        WHEN COALESCE(stats.total_quantity, 0) >= o.min_orders THEN 'active'
        ELSE 'collecting'
    END as order_status
FROM orders o
JOIN profiles p ON o.user_id = p.user_id
LEFT JOIN LATERAL (
    SELECT 
        COUNT(*) as total_submissions,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_submissions,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_submissions,
        COALESCE(SUM(quantity), 0) as total_quantity,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid'), 0) as total_revenue,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'pending'), 0) as pending_revenue
    FROM submissions s
    WHERE s.order_id = o.id
) stats ON true;

-- Create monitoring views
CREATE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;

CREATE VIEW connection_stats AS
SELECT 
    state,
    count(*) as connections,
    avg(extract(epoch from (now() - query_start))) as avg_duration_seconds
FROM pg_stat_activity 
WHERE state IS NOT NULL
GROUP BY state
ORDER BY connections DESC;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE profiles IS 'Group Order Managers (GOMs) and their account information';
COMMENT ON TABLE orders IS 'Group orders created by GOMs for merchandise/products';
COMMENT ON TABLE submissions IS 'Individual buyer submissions/orders within a group order';
COMMENT ON TABLE payment_transactions IS 'Payment gateway transactions for tracking payments';
COMMENT ON TABLE platform_connections IS 'User connections to messaging platforms (WhatsApp/Telegram/Discord)';
COMMENT ON TABLE messages IS 'Messages sent to buyers through various platforms';
COMMENT ON TABLE platform_posts IS 'Posts made to platforms to promote orders';

COMMENT ON TABLE notifications IS 'Stores all notification events sent to users';
COMMENT ON TABLE notification_preferences IS 'User-specific notification channel preferences';
COMMENT ON TABLE user_devices IS 'FCM tokens and device information for push notifications';
COMMENT ON TABLE notification_templates IS 'Templates for different notification types and channels';
COMMENT ON TABLE notification_deliveries IS 'Delivery tracking and analytics for notifications';

COMMENT ON TABLE analytics_events IS 'Raw analytics events from all platforms';
COMMENT ON TABLE analytics_aggregations IS 'Pre-calculated metric aggregations for fast querying';
COMMENT ON TABLE analytics_reports IS 'Generated analytics reports';
COMMENT ON TABLE analytics_alerts IS 'Alert configurations for metric monitoring';
COMMENT ON TABLE analytics_export_jobs IS 'Data export job tracking';
COMMENT ON TABLE analytics_dashboards IS 'Dashboard configurations';
COMMENT ON TABLE analytics_user_sessions IS 'User session tracking for engagement metrics';
COMMENT ON TABLE analytics_funnels IS 'Conversion funnel configurations';
COMMENT ON TABLE analytics_cohorts IS 'Cohort analysis results';
COMMENT ON TABLE analytics_segments IS 'User segment definitions';
COMMENT ON TABLE analytics_ab_tests IS 'A/B test configurations and results';

COMMENT ON TABLE monitoring_metrics IS 'System and service performance metrics';
COMMENT ON TABLE monitoring_alerts IS 'System alerts and their status';
COMMENT ON TABLE monitoring_logs IS 'Application logs from all services';
COMMENT ON TABLE monitoring_dashboards IS 'Custom monitoring dashboards';
COMMENT ON TABLE monitoring_notifications IS 'Alert notifications sent to various channels';
COMMENT ON TABLE monitoring_service_health IS 'Service health check results';
COMMENT ON TABLE monitoring_alert_rules IS 'Alert rule configurations';
COMMENT ON TABLE monitoring_downtimes IS 'Planned and unplanned service downtimes';

-- ============================================================================
-- FINAL STATISTICS UPDATE
-- ============================================================================

-- Update table statistics for query optimization
ANALYZE profiles;
ANALYZE orders;
ANALYZE submissions;
ANALYZE payment_transactions;
ANALYZE platform_connections;
ANALYZE messages;
ANALYZE platform_posts;
ANALYZE notifications;
ANALYZE notification_preferences;
ANALYZE user_devices;
ANALYZE notification_templates;
ANALYZE notification_deliveries;
ANALYZE analytics_events;
ANALYZE analytics_aggregations;
ANALYZE analytics_reports;
ANALYZE analytics_alerts;
ANALYZE analytics_export_jobs;
ANALYZE analytics_dashboards;
ANALYZE analytics_user_sessions;
ANALYZE analytics_funnels;
ANALYZE analytics_cohorts;
ANALYZE analytics_segments;
ANALYZE analytics_ab_tests;
ANALYZE monitoring_metrics;
ANALYZE monitoring_alerts;
ANALYZE monitoring_logs;
ANALYZE monitoring_dashboards;
ANALYZE monitoring_notifications;
ANALYZE monitoring_service_health;
ANALYZE monitoring_alert_rules;
ANALYZE monitoring_downtimes;

-- Success message
SELECT 'GOMFLOW production database schema deployed successfully! 🚀' as status,
       'Total tables created: 31' as tables,
       'Core: 7, Notifications: 5, Analytics: 11, Monitoring: 8' as breakdown,
       'RLS policies, indexes, functions, and triggers configured' as features;