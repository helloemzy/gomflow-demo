-- ============================================================================
-- GOMFLOW SUBSCRIPTION SYSTEM MIGRATION
-- Complete subscription management with usage tracking and analytics
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CUSTOM TYPES FOR SUBSCRIPTION SYSTEM
-- ============================================================================

CREATE TYPE subscription_plan AS ENUM ('freemium', 'starter', 'professional', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'cancelled', 'trial', 'expired', 'suspended');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'yearly');
CREATE TYPE trial_status AS ENUM ('active', 'expired', 'converted', 'cancelled');
CREATE TYPE subscription_event_type AS ENUM (
  'created', 'updated', 'cancelled', 'trial_started', 'trial_ended', 
  'trial_converted', 'payment_failed', 'payment_succeeded', 'downgraded', 'upgraded'
);
CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'uncollectible', 'void');
CREATE TYPE verification_action AS ENUM (
  'submitted', 'reviewed', 'approved', 'rejected', 'flagged', 
  'bulk_approved', 'bulk_rejected'
);

-- ============================================================================
-- USER SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    plan subscription_plan NOT NULL DEFAULT 'freemium',
    status subscription_status NOT NULL DEFAULT 'inactive',
    billing_cycle billing_cycle NOT NULL DEFAULT 'monthly',
    amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    trial_start_date TIMESTAMP WITH TIME ZONE,
    trial_end_date TIMESTAMP WITH TIME ZONE,
    trial_status trial_status,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    last_invoice_id VARCHAR(255),
    next_billing_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for user_subscriptions
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_plan ON user_subscriptions(plan);
CREATE INDEX idx_user_subscriptions_trial_end ON user_subscriptions(trial_end_date);
CREATE INDEX idx_user_subscriptions_next_billing ON user_subscriptions(next_billing_date);
CREATE INDEX idx_user_subscriptions_stripe_id ON user_subscriptions(stripe_subscription_id);

-- ============================================================================
-- USAGE METRICS TABLE
-- ============================================================================

CREATE TABLE usage_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    orders_created INTEGER DEFAULT 0 CHECK (orders_created >= 0),
    submissions_received INTEGER DEFAULT 0 CHECK (submissions_received >= 0),
    api_calls_made INTEGER DEFAULT 0 CHECK (api_calls_made >= 0),
    sms_sent INTEGER DEFAULT 0 CHECK (sms_sent >= 0),
    storage_used_mb INTEGER DEFAULT 0 CHECK (storage_used_mb >= 0),
    webhook_calls INTEGER DEFAULT 0 CHECK (webhook_calls >= 0),
    payment_proofs_processed INTEGER DEFAULT 0 CHECK (payment_proofs_processed >= 0),
    team_member_invites INTEGER DEFAULT 0 CHECK (team_member_invites >= 0),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, period_start)
);

-- Indexes for usage_metrics
CREATE INDEX idx_usage_metrics_user_id ON usage_metrics(user_id);
CREATE INDEX idx_usage_metrics_period ON usage_metrics(period_start, period_end);
CREATE INDEX idx_usage_metrics_last_updated ON usage_metrics(last_updated);

-- ============================================================================
-- USAGE LIMIT ALERTS TABLE
-- ============================================================================

CREATE TABLE usage_limit_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    limit_value INTEGER NOT NULL CHECK (limit_value > 0),
    current_value INTEGER NOT NULL CHECK (current_value >= 0),
    percentage_used DECIMAL(5,2) NOT NULL CHECK (percentage_used >= 0 AND percentage_used <= 100),
    alert_threshold INTEGER NOT NULL CHECK (alert_threshold IN (80, 90, 95, 100)),
    alert_sent BOOLEAN DEFAULT false,
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for usage_limit_alerts
CREATE INDEX idx_usage_limit_alerts_user_id ON usage_limit_alerts(user_id);
CREATE INDEX idx_usage_limit_alerts_resolved ON usage_limit_alerts(resolved);
CREATE INDEX idx_usage_limit_alerts_threshold ON usage_limit_alerts(alert_threshold);
CREATE INDEX idx_usage_limit_alerts_metric ON usage_limit_alerts(metric_type);

-- ============================================================================
-- SUBSCRIPTION EVENTS TABLE
-- ============================================================================

CREATE TABLE subscription_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    event_type subscription_event_type NOT NULL,
    previous_plan subscription_plan,
    new_plan subscription_plan,
    metadata JSONB DEFAULT '{}'::jsonb,
    stripe_event_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for subscription_events
CREATE INDEX idx_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX idx_subscription_events_subscription_id ON subscription_events(subscription_id);
CREATE INDEX idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX idx_subscription_events_created_at ON subscription_events(created_at);

-- ============================================================================
-- BILLING INVOICES TABLE
-- ============================================================================

CREATE TABLE billing_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE SET NULL,
    stripe_invoice_id VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status invoice_status NOT NULL DEFAULT 'draft',
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    invoice_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for billing_invoices
CREATE INDEX idx_billing_invoices_user_id ON billing_invoices(user_id);
CREATE INDEX idx_billing_invoices_subscription_id ON billing_invoices(subscription_id);
CREATE INDEX idx_billing_invoices_status ON billing_invoices(status);
CREATE INDEX idx_billing_invoices_due_date ON billing_invoices(due_date);
CREATE INDEX idx_billing_invoices_stripe_id ON billing_invoices(stripe_invoice_id);

-- ============================================================================
-- FEATURE USAGE LOGS TABLE
-- ============================================================================

CREATE TABLE feature_usage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for feature_usage_logs
CREATE INDEX idx_feature_usage_logs_user_id ON feature_usage_logs(user_id);
CREATE INDEX idx_feature_usage_logs_feature ON feature_usage_logs(feature_name);
CREATE INDEX idx_feature_usage_logs_timestamp ON feature_usage_logs(timestamp);
CREATE INDEX idx_feature_usage_logs_action ON feature_usage_logs(action);

-- ============================================================================
-- CHURN PREDICTIONS TABLE
-- ============================================================================

CREATE TABLE churn_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    churn_probability DECIMAL(5,2) NOT NULL CHECK (churn_probability >= 0 AND churn_probability <= 100),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    contributing_factors JSONB DEFAULT '[]'::jsonb,
    recommended_actions JSONB DEFAULT '[]'::jsonb,
    last_activity_date TIMESTAMP WITH TIME ZONE,
    engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 100),
    support_tickets INTEGER DEFAULT 0,
    payment_failures INTEGER DEFAULT 0,
    feature_usage_decline DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for churn_predictions
CREATE INDEX idx_churn_predictions_user_id ON churn_predictions(user_id);
CREATE INDEX idx_churn_predictions_risk_level ON churn_predictions(risk_level);
CREATE INDEX idx_churn_predictions_probability ON churn_predictions(churn_probability);
CREATE INDEX idx_churn_predictions_created_at ON churn_predictions(created_at);

-- ============================================================================
-- TRIAL EXTENSIONS TABLE
-- ============================================================================

CREATE TABLE trial_extensions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    original_trial_end TIMESTAMP WITH TIME ZONE NOT NULL,
    extended_trial_end TIMESTAMP WITH TIME ZONE NOT NULL,
    extension_days INTEGER NOT NULL CHECK (extension_days > 0),
    reason TEXT NOT NULL,
    granted_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for trial_extensions
CREATE INDEX idx_trial_extensions_user_id ON trial_extensions(user_id);
CREATE INDEX idx_trial_extensions_created_at ON trial_extensions(created_at);

-- ============================================================================
-- PLAN CHANGE REQUESTS TABLE
-- ============================================================================

CREATE TABLE plan_change_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    current_plan subscription_plan NOT NULL,
    requested_plan subscription_plan NOT NULL,
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('upgrade', 'downgrade')),
    reason TEXT,
    scheduled_for TIMESTAMP WITH TIME ZONE,
    proration_amount DECIMAL(10,2),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'completed', 'failed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for plan_change_requests
CREATE INDEX idx_plan_change_requests_user_id ON plan_change_requests(user_id);
CREATE INDEX idx_plan_change_requests_status ON plan_change_requests(status);
CREATE INDEX idx_plan_change_requests_scheduled ON plan_change_requests(scheduled_for);

-- ============================================================================
-- SUBSCRIPTION PAYMENT METHODS TABLE
-- ============================================================================

CREATE TABLE subscription_payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    stripe_payment_method_id VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('card', 'bank_account')),
    card_brand VARCHAR(20),
    card_last4 VARCHAR(4),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for subscription_payment_methods
CREATE INDEX idx_subscription_payment_methods_user_id ON subscription_payment_methods(user_id);
CREATE INDEX idx_subscription_payment_methods_default ON subscription_payment_methods(is_default);
CREATE INDEX idx_subscription_payment_methods_stripe_id ON subscription_payment_methods(stripe_payment_method_id);

-- ============================================================================
-- SUBSCRIPTION DISCOUNTS TABLE
-- ============================================================================

CREATE TABLE subscription_discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES user_subscriptions(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('percentage', 'fixed_amount')),
    value DECIMAL(10,2) NOT NULL CHECK (value > 0),
    duration VARCHAR(20) NOT NULL CHECK (duration IN ('once', 'repeating', 'forever')),
    duration_in_months INTEGER,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for subscription_discounts
CREATE INDEX idx_subscription_discounts_user_id ON subscription_discounts(user_id);
CREATE INDEX idx_subscription_discounts_subscription_id ON subscription_discounts(subscription_id);
CREATE INDEX idx_subscription_discounts_code ON subscription_discounts(code);
CREATE INDEX idx_subscription_discounts_expires_at ON subscription_discounts(expires_at);

-- ============================================================================
-- SUBSCRIPTION ADMIN ACTIONS TABLE
-- ============================================================================

CREATE TABLE subscription_admin_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'extend_trial', 'upgrade_plan', 'downgrade_plan', 
        'cancel_subscription', 'refund_payment', 'apply_discount'
    )),
    reason TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for subscription_admin_actions
CREATE INDEX idx_subscription_admin_actions_admin ON subscription_admin_actions(admin_user_id);
CREATE INDEX idx_subscription_admin_actions_target ON subscription_admin_actions(target_user_id);
CREATE INDEX idx_subscription_admin_actions_action ON subscription_admin_actions(action);
CREATE INDEX idx_subscription_admin_actions_created_at ON subscription_admin_actions(created_at);

-- ============================================================================
-- DATABASE FUNCTIONS FOR SUBSCRIPTION SYSTEM
-- ============================================================================

-- Function to increment usage metrics
CREATE OR REPLACE FUNCTION increment_usage_metric(
    p_user_id UUID,
    p_feature_name TEXT,
    p_increment INTEGER,
    p_period_start TIMESTAMP WITH TIME ZONE,
    p_period_end TIMESTAMP WITH TIME ZONE
)
RETURNS INTEGER AS $$
DECLARE
    new_usage INTEGER;
    column_name TEXT;
BEGIN
    -- Map feature name to column name
    column_name := p_feature_name || '_used';
    
    -- Upsert usage metrics
    EXECUTE format('
        INSERT INTO usage_metrics (user_id, period_start, period_end, %I, last_updated)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (user_id, period_start)
        DO UPDATE SET
            %I = usage_metrics.%I + $4,
            last_updated = NOW()
        RETURNING %I
    ', column_name, column_name, column_name, column_name)
    USING p_user_id, p_period_start, p_period_end, p_increment
    INTO new_usage;
    
    RETURN new_usage;
END;
$$ LANGUAGE plpgsql;

-- Function to get subscription analytics
CREATE OR REPLACE FUNCTION get_subscription_analytics(
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    start_date TIMESTAMP WITH TIME ZONE;
    end_date TIMESTAMP WITH TIME ZONE;
BEGIN
    start_date := COALESCE(p_start_date, NOW() - INTERVAL '1 year');
    end_date := COALESCE(p_end_date, NOW());
    
    SELECT json_build_object(
        'total_subscribers', COUNT(*),
        'active_subscribers', COUNT(*) FILTER (WHERE status = 'active'),
        'trial_users', COUNT(*) FILTER (WHERE status = 'trial'),
        'churned_users', COUNT(*) FILTER (WHERE status IN ('cancelled', 'expired')),
        'subscribers_by_plan', (
            SELECT json_object_agg(plan, count)
            FROM (
                SELECT plan, COUNT(*) as count
                FROM user_subscriptions
                WHERE created_at BETWEEN start_date AND end_date
                AND status = 'active'
                GROUP BY plan
            ) plan_counts
        ),
        'mrr', (
            SELECT COALESCE(SUM(
                CASE 
                    WHEN billing_cycle = 'monthly' THEN amount
                    WHEN billing_cycle = 'yearly' THEN amount / 12
                    ELSE 0
                END
            ), 0)
            FROM user_subscriptions
            WHERE status = 'active'
        )
    ) INTO result
    FROM user_subscriptions
    WHERE created_at BETWEEN start_date AND end_date;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate churn prediction score
CREATE OR REPLACE FUNCTION calculate_churn_score(
    p_user_id UUID,
    p_payment_failures INTEGER DEFAULT 0,
    p_support_tickets INTEGER DEFAULT 0,
    p_usage_decline DECIMAL DEFAULT 0,
    p_days_inactive INTEGER DEFAULT 0
)
RETURNS DECIMAL AS $$
DECLARE
    score DECIMAL := 0;
BEGIN
    -- Payment failures (max 25 points)
    score := score + LEAST(25, p_payment_failures * 12.5) * 0.25;
    
    -- Support tickets (max 15 points)
    score := score + LEAST(15, p_support_tickets * 5) * 0.15;
    
    -- Usage decline (max 20 points)
    score := score + LEAST(20, p_usage_decline) * 0.20;
    
    -- Inactivity (max 15 points)
    score := score + LEAST(15, (p_days_inactive / 30.0) * 15) * 0.15;
    
    RETURN LEAST(100, GREATEST(0, score));
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS FOR SUBSCRIPTION SYSTEM
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER trigger_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to log subscription events
CREATE OR REPLACE FUNCTION log_subscription_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Log subscription status changes
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        INSERT INTO subscription_events (
            user_id, subscription_id, event_type, 
            previous_plan, new_plan, metadata
        ) VALUES (
            NEW.user_id, NEW.id, 
            CASE NEW.status
                WHEN 'active' THEN 'updated'::subscription_event_type
                WHEN 'cancelled' THEN 'cancelled'::subscription_event_type
                WHEN 'trial' THEN 'trial_started'::subscription_event_type
                ELSE 'updated'::subscription_event_type
            END,
            OLD.plan, NEW.plan,
            json_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status,
                'changed_at', NOW()
            )
        );
    END IF;
    
    -- Log plan changes
    IF TG_OP = 'UPDATE' AND OLD.plan != NEW.plan THEN
        INSERT INTO subscription_events (
            user_id, subscription_id, event_type, 
            previous_plan, new_plan, metadata
        ) VALUES (
            NEW.user_id, NEW.id,
            CASE 
                WHEN get_plan_order(NEW.plan) > get_plan_order(OLD.plan) THEN 'upgraded'::subscription_event_type
                ELSE 'downgraded'::subscription_event_type
            END,
            OLD.plan, NEW.plan,
            json_build_object(
                'changed_at', NOW(),
                'billing_cycle', NEW.billing_cycle
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper function for plan ordering
CREATE OR REPLACE FUNCTION get_plan_order(plan subscription_plan)
RETURNS INTEGER AS $$
BEGIN
    CASE plan
        WHEN 'freemium' THEN RETURN 1;
        WHEN 'starter' THEN RETURN 2;
        WHEN 'professional' THEN RETURN 3;
        WHEN 'enterprise' THEN RETURN 4;
        ELSE RETURN 0;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Apply event logging trigger
CREATE TRIGGER trigger_log_subscription_events
    AFTER UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION log_subscription_event();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all subscription tables
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_limit_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_admin_actions ENABLE ROW LEVEL SECURITY;

-- User subscriptions policies
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions" ON user_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

-- Usage metrics policies
CREATE POLICY "Users can view own usage metrics" ON usage_metrics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage usage metrics" ON usage_metrics
    FOR ALL USING (auth.role() = 'service_role');

-- Usage limit alerts policies
CREATE POLICY "Users can view own usage alerts" ON usage_limit_alerts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own usage alerts" ON usage_limit_alerts
    FOR UPDATE USING (auth.uid() = user_id);

-- Subscription events policies
CREATE POLICY "Users can view own subscription events" ON subscription_events
    FOR SELECT USING (auth.uid() = user_id);

-- Billing invoices policies
CREATE POLICY "Users can view own invoices" ON billing_invoices
    FOR SELECT USING (auth.uid() = user_id);

-- Feature usage logs policies
CREATE POLICY "Users can view own feature usage" ON feature_usage_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage feature usage logs" ON feature_usage_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Churn predictions policies (admin only)
CREATE POLICY "Admin can view churn predictions" ON churn_predictions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() 
            AND plan = 'enterprise'
        )
    );

-- Trial extensions policies
CREATE POLICY "Users can view own trial extensions" ON trial_extensions
    FOR SELECT USING (auth.uid() = user_id);

-- Plan change requests policies
CREATE POLICY "Users can manage own plan change requests" ON plan_change_requests
    FOR ALL USING (auth.uid() = user_id);

-- Payment methods policies
CREATE POLICY "Users can manage own payment methods" ON subscription_payment_methods
    FOR ALL USING (auth.uid() = user_id);

-- Discounts policies
CREATE POLICY "Users can view own discounts" ON subscription_discounts
    FOR SELECT USING (auth.uid() = user_id);

-- Admin actions policies (admin only)
CREATE POLICY "Admin can view admin actions" ON subscription_admin_actions
    FOR SELECT USING (
        auth.uid() = admin_user_id OR auth.uid() = target_user_id
    );

-- ============================================================================
-- INITIAL DATA AND CONFIGURATION
-- ============================================================================

-- Update existing profiles table to include subscription columns (if not already present)
DO $$
BEGIN
    -- Check if plan column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'plan') THEN
        ALTER TABLE profiles ADD COLUMN plan subscription_plan DEFAULT 'freemium';
    END IF;
    
    -- Check if subscription_status column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_status') THEN
        ALTER TABLE profiles ADD COLUMN subscription_status subscription_status DEFAULT 'inactive';
    END IF;
END
$$;

-- Create indexes on new profile columns
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON profiles(plan);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);

-- ============================================================================
-- SUBSCRIPTION SYSTEM CONFIGURATION
-- ============================================================================

-- Create a configuration table for subscription limits (optional)
CREATE TABLE subscription_plan_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan subscription_plan NOT NULL UNIQUE,
    config JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default plan configurations
INSERT INTO subscription_plan_configs (plan, config) VALUES
('freemium', '{
    "limits": {
        "max_orders_per_month": 50,
        "max_submissions_per_order": 100,
        "max_api_calls_per_day": 100,
        "max_sms_per_month": 0,
        "max_storage_mb": 100,
        "max_webhook_calls_per_day": 50,
        "max_team_members": 1
    },
    "features": {
        "order_creation": true,
        "payment_tracking": true,
        "whatsapp_integration": true,
        "telegram_integration": true,
        "discord_integration": true,
        "smart_payment_agent": false,
        "bulk_messaging": false,
        "analytics_dashboard": true,
        "export_functionality": false,
        "custom_branding": false,
        "api_access": false
    }
}'),
('starter', '{
    "limits": {
        "max_orders_per_month": 200,
        "max_submissions_per_order": 500,
        "max_api_calls_per_day": 1000,
        "max_sms_per_month": 100,
        "max_storage_mb": 1000,
        "max_webhook_calls_per_day": 500,
        "max_team_members": 3
    },
    "features": {
        "order_creation": true,
        "payment_tracking": true,
        "whatsapp_integration": true,
        "telegram_integration": true,
        "discord_integration": true,
        "smart_payment_agent": true,
        "bulk_messaging": true,
        "analytics_dashboard": true,
        "export_functionality": true,
        "custom_branding": true,
        "api_access": false
    }
}'),
('professional', '{
    "limits": {
        "max_orders_per_month": null,
        "max_submissions_per_order": null,
        "max_api_calls_per_day": 10000,
        "max_sms_per_month": 1000,
        "max_storage_mb": 10000,
        "max_webhook_calls_per_day": 5000,
        "max_team_members": 10
    },
    "features": {
        "order_creation": true,
        "payment_tracking": true,
        "whatsapp_integration": true,
        "telegram_integration": true,
        "discord_integration": true,
        "smart_payment_agent": true,
        "bulk_messaging": true,
        "analytics_dashboard": true,
        "export_functionality": true,
        "custom_branding": true,
        "api_access": true
    }
}'),
('enterprise', '{
    "limits": {
        "max_orders_per_month": null,
        "max_submissions_per_order": null,
        "max_api_calls_per_day": 100000,
        "max_sms_per_month": 10000,
        "max_storage_mb": 100000,
        "max_webhook_calls_per_day": 50000,
        "max_team_members": null
    },
    "features": {
        "order_creation": true,
        "payment_tracking": true,
        "whatsapp_integration": true,
        "telegram_integration": true,
        "discord_integration": true,
        "smart_payment_agent": true,
        "bulk_messaging": true,
        "analytics_dashboard": true,
        "export_functionality": true,
        "custom_branding": true,
        "api_access": true,
        "white_label": true,
        "dedicated_support": true
    }
}')
ON CONFLICT (plan) DO NOTHING;