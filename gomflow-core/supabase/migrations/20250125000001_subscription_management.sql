-- ============================================================================
-- GOMFLOW SUBSCRIPTION MANAGEMENT SYSTEM
-- ============================================================================
-- Created: January 2025
-- Description: Comprehensive subscription management for GOMFLOW commercial launch
-- Supports: Freemium, Starter, Professional, Enterprise tiers with multi-currency

-- Create subscription-related ENUMs
CREATE TYPE subscription_tier AS ENUM ('freemium', 'starter', 'professional', 'enterprise');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'annually');
CREATE TYPE subscription_status_new AS ENUM ('trial', 'active', 'past_due', 'cancelled', 'suspended', 'expired');
CREATE TYPE billing_status AS ENUM ('paid', 'pending', 'failed', 'refunded', 'partial');
CREATE TYPE usage_metric_type AS ENUM ('orders_created', 'api_calls', 'storage_mb', 'messages_sent', 'submissions_received');

-- ============================================================================
-- SUBSCRIPTION PLANS TABLE
-- ============================================================================
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    tier subscription_tier NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Pricing per region/currency
    price_php DECIMAL(10,2),
    price_myr DECIMAL(10,2), 
    price_thb DECIMAL(10,2),
    price_idr DECIMAL(10,2),
    price_usd DECIMAL(10,2),
    
    -- Annual pricing (discounted)
    annual_price_php DECIMAL(10,2),
    annual_price_myr DECIMAL(10,2),
    annual_price_thb DECIMAL(10,2), 
    annual_price_idr DECIMAL(10,2),
    annual_price_usd DECIMAL(10,2),
    
    -- Plan features and limits
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    limits JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    -- Plan configuration
    trial_days INTEGER DEFAULT 14,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription plans indexes
CREATE INDEX idx_subscription_plans_tier ON subscription_plans(tier);
CREATE INDEX idx_subscription_plans_is_active ON subscription_plans(is_active);
CREATE INDEX idx_subscription_plans_sort_order ON subscription_plans(sort_order);

-- ============================================================================
-- USER SUBSCRIPTIONS TABLE  
-- ============================================================================
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    
    -- Subscription details
    status subscription_status_new DEFAULT 'trial',
    tier subscription_tier NOT NULL,
    billing_cycle billing_cycle DEFAULT 'monthly',
    
    -- Pricing and currency
    currency currency_code NOT NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    
    -- Billing dates
    trial_start_date TIMESTAMP WITH TIME ZONE,
    trial_end_date TIMESTAMP WITH TIME ZONE,
    billing_start_date TIMESTAMP WITH TIME ZONE,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    next_billing_date TIMESTAMP WITH TIME ZONE,
    
    -- Cancellation
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    cancel_at_period_end BOOLEAN DEFAULT false,
    
    -- Payment gateway integration
    gateway_subscription_id VARCHAR(255), -- Stripe/PayMongo subscription ID
    gateway_customer_id VARCHAR(255), -- Stripe/PayMongo customer ID
    
    -- Usage tracking
    usage_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_active_user_subscription UNIQUE (user_id) DEFERRABLE INITIALLY DEFERRED
);

-- User subscriptions indexes
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_plan_id ON user_subscriptions(plan_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_user_subscriptions_tier ON user_subscriptions(tier);
CREATE INDEX idx_user_subscriptions_next_billing_date ON user_subscriptions(next_billing_date);
CREATE INDEX idx_user_subscriptions_current_period_end ON user_subscriptions(current_period_end);
CREATE INDEX idx_user_subscriptions_trial_end_date ON user_subscriptions(trial_end_date);

-- ============================================================================
-- USAGE TRACKING TABLE
-- ============================================================================
CREATE TABLE usage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
    
    -- Usage details
    metric_type usage_metric_type NOT NULL,
    metric_value INTEGER NOT NULL DEFAULT 0 CHECK (metric_value >= 0),
    
    -- Time period
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicate tracking
    CONSTRAINT unique_usage_period UNIQUE (user_id, subscription_id, metric_type, period_start)
);

-- Usage tracking indexes
CREATE INDEX idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX idx_usage_tracking_subscription_id ON usage_tracking(subscription_id);
CREATE INDEX idx_usage_tracking_metric_type ON usage_tracking(metric_type);
CREATE INDEX idx_usage_tracking_period ON usage_tracking(period_start, period_end);
CREATE INDEX idx_usage_tracking_recorded_at ON usage_tracking(recorded_at);

-- ============================================================================
-- BILLING EVENTS TABLE
-- ============================================================================
CREATE TABLE billing_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES user_subscriptions(id) ON DELETE CASCADE,
    
    -- Event details
    event_type VARCHAR(50) NOT NULL, -- subscription_created, invoice_paid, payment_failed, etc.
    event_description TEXT,
    
    -- Financial details
    amount DECIMAL(10,2),
    currency currency_code,
    status billing_status,
    
    -- Payment gateway details
    gateway_event_id VARCHAR(255),
    gateway_invoice_id VARCHAR(255),
    gateway_payment_intent_id VARCHAR(255),
    
    -- Pro-ration calculations
    proration_amount DECIMAL(10,2),
    proration_details JSONB,
    
    -- Dates
    event_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Billing events indexes
CREATE INDEX idx_billing_events_user_id ON billing_events(user_id);
CREATE INDEX idx_billing_events_subscription_id ON billing_events(subscription_id);
CREATE INDEX idx_billing_events_event_type ON billing_events(event_type);
CREATE INDEX idx_billing_events_status ON billing_events(status);
CREATE INDEX idx_billing_events_event_date ON billing_events(event_date);
CREATE INDEX idx_billing_events_gateway_event_id ON billing_events(gateway_event_id);

-- ============================================================================
-- DATABASE FUNCTIONS
-- ============================================================================

-- Function to get subscription plan price by currency
CREATE OR REPLACE FUNCTION get_plan_price(
    plan_id UUID,
    p_currency currency_code,
    p_billing_cycle billing_cycle DEFAULT 'monthly'
)
RETURNS DECIMAL AS $$
DECLARE
    price DECIMAL(10,2);
BEGIN
    IF p_billing_cycle = 'annually' THEN
        SELECT 
            CASE p_currency
                WHEN 'PHP' THEN annual_price_php
                WHEN 'MYR' THEN annual_price_myr
                WHEN 'THB' THEN annual_price_thb
                WHEN 'IDR' THEN annual_price_idr
                WHEN 'USD' THEN annual_price_usd
            END
        INTO price
        FROM subscription_plans 
        WHERE id = plan_id;
    ELSE
        SELECT 
            CASE p_currency
                WHEN 'PHP' THEN price_php
                WHEN 'MYR' THEN price_myr
                WHEN 'THB' THEN price_thb
                WHEN 'IDR' THEN price_idr
                WHEN 'USD' THEN price_usd
            END
        INTO price
        FROM subscription_plans 
        WHERE id = plan_id;
    END IF;
    
    RETURN COALESCE(price, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate pro-ration amount
CREATE OR REPLACE FUNCTION calculate_proration(
    old_amount DECIMAL,
    new_amount DECIMAL,
    days_used INTEGER,
    total_days INTEGER
)
RETURNS DECIMAL AS $$
BEGIN
    IF total_days = 0 THEN
        RETURN 0;
    END IF;
    
    DECLARE
        unused_old_amount DECIMAL := old_amount * (total_days - days_used) / total_days;
        prorated_new_amount DECIMAL := new_amount * (total_days - days_used) / total_days;
    BEGIN
        RETURN GREATEST(prorated_new_amount - unused_old_amount, 0);
    END;
END;
$$ LANGUAGE plpgsql;

-- Function to get current usage for a user
CREATE OR REPLACE FUNCTION get_current_usage(
    p_user_id UUID,
    p_metric_type usage_metric_type
)
RETURNS INTEGER AS $$
DECLARE
    current_usage INTEGER;
    subscription_record user_subscriptions%ROWTYPE;
BEGIN
    -- Get current subscription
    SELECT * INTO subscription_record
    FROM user_subscriptions 
    WHERE user_id = p_user_id 
    AND status IN ('trial', 'active');
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- Get usage since last reset
    SELECT COALESCE(SUM(metric_value), 0) INTO current_usage
    FROM usage_tracking
    WHERE user_id = p_user_id
    AND subscription_id = subscription_record.id
    AND metric_type = p_metric_type
    AND period_start >= subscription_record.usage_reset_date;
    
    RETURN current_usage;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has exceeded usage limits
CREATE OR REPLACE FUNCTION check_usage_limit(
    p_user_id UUID,
    p_metric_type usage_metric_type,
    p_increment INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
    subscription_record user_subscriptions%ROWTYPE;
    plan_record subscription_plans%ROWTYPE;
    current_usage INTEGER;
    usage_limit INTEGER;
    result JSONB;
BEGIN
    -- Get current subscription
    SELECT * INTO subscription_record
    FROM user_subscriptions 
    WHERE user_id = p_user_id 
    AND status IN ('trial', 'active');
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'allowed', false,
            'reason', 'no_active_subscription',
            'current_usage', 0,
            'limit', 0
        );
    END IF;
    
    -- Get plan limits
    SELECT * INTO plan_record
    FROM subscription_plans
    WHERE id = subscription_record.plan_id;
    
    -- Extract limit for this metric type
    usage_limit := COALESCE((plan_record.limits->p_metric_type::text)::integer, -1);
    
    -- -1 means unlimited
    IF usage_limit = -1 THEN
        RETURN json_build_object(
            'allowed', true,
            'reason', 'unlimited',
            'current_usage', get_current_usage(p_user_id, p_metric_type),
            'limit', -1
        );
    END IF;
    
    -- Get current usage
    current_usage := get_current_usage(p_user_id, p_metric_type);
    
    -- Check if increment would exceed limit
    IF current_usage + p_increment > usage_limit THEN
        RETURN json_build_object(
            'allowed', false,
            'reason', 'limit_exceeded',
            'current_usage', current_usage,
            'limit', usage_limit,
            'would_be', current_usage + p_increment
        );
    END IF;
    
    RETURN json_build_object(
        'allowed', true,
        'reason', 'within_limit',
        'current_usage', current_usage,
        'limit', usage_limit,
        'remaining', usage_limit - current_usage
    );
END;
$$ LANGUAGE plpgsql;

-- Function to record usage
CREATE OR REPLACE FUNCTION record_usage(
    p_user_id UUID,
    p_metric_type usage_metric_type,
    p_increment INTEGER DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
    subscription_record user_subscriptions%ROWTYPE;
    current_period_start TIMESTAMP WITH TIME ZONE;
    current_period_end TIMESTAMP WITH TIME ZONE;
    usage_record usage_tracking%ROWTYPE;
BEGIN
    -- Get current subscription
    SELECT * INTO subscription_record
    FROM user_subscriptions 
    WHERE user_id = p_user_id 
    AND status IN ('trial', 'active');
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'no_active_subscription');
    END IF;
    
    -- Calculate current billing period
    current_period_start := DATE_TRUNC('month', subscription_record.usage_reset_date);
    current_period_end := current_period_start + INTERVAL '1 month';
    
    -- Check if usage record exists for this period
    SELECT * INTO usage_record
    FROM usage_tracking
    WHERE user_id = p_user_id
    AND subscription_id = subscription_record.id
    AND metric_type = p_metric_type
    AND period_start = current_period_start;
    
    IF FOUND THEN
        -- Update existing record
        UPDATE usage_tracking
        SET metric_value = metric_value + p_increment,
            recorded_at = NOW()
        WHERE id = usage_record.id;
    ELSE
        -- Create new record
        INSERT INTO usage_tracking (
            user_id, subscription_id, metric_type, 
            metric_value, period_start, period_end
        ) VALUES (
            p_user_id, subscription_record.id, p_metric_type,
            p_increment, current_period_start, current_period_end
        );
    END IF;
    
    RETURN json_build_object(
        'success', true, 
        'recorded', p_increment,
        'period_start', current_period_start,
        'period_end', current_period_end
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get subscription summary
CREATE OR REPLACE FUNCTION get_subscription_summary(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    subscription_record user_subscriptions%ROWTYPE;
    plan_record subscription_plans%ROWTYPE;
    usage_stats JSONB;
    result JSONB;
BEGIN
    -- Get current subscription
    SELECT * INTO subscription_record
    FROM user_subscriptions 
    WHERE user_id = p_user_id 
    AND status IN ('trial', 'active');
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'has_subscription', false,
            'tier', 'freemium'
        );
    END IF;
    
    -- Get plan details
    SELECT * INTO plan_record
    FROM subscription_plans
    WHERE id = subscription_record.plan_id;
    
    -- Build usage stats
    SELECT json_object_agg(metric_type, metric_value) INTO usage_stats
    FROM (
        SELECT 
            metric_type,
            get_current_usage(p_user_id, metric_type) as metric_value
        FROM (VALUES 
            ('orders_created'::usage_metric_type),
            ('api_calls'::usage_metric_type),
            ('storage_mb'::usage_metric_type),
            ('messages_sent'::usage_metric_type),
            ('submissions_received'::usage_metric_type)
        ) AS metrics(metric_type)
    ) usage_data;
    
    -- Build result
    result := json_build_object(
        'has_subscription', true,
        'subscription_id', subscription_record.id,
        'tier', subscription_record.tier,
        'status', subscription_record.status,
        'billing_cycle', subscription_record.billing_cycle,
        'currency', subscription_record.currency,
        'amount', subscription_record.amount,
        'current_period_start', subscription_record.current_period_start,
        'current_period_end', subscription_record.current_period_end,
        'next_billing_date', subscription_record.next_billing_date,
        'trial_end_date', subscription_record.trial_end_date,
        'cancel_at_period_end', subscription_record.cancel_at_period_end,
        'plan', json_build_object(
            'id', plan_record.id,
            'name', plan_record.name,
            'display_name', plan_record.display_name,
            'features', plan_record.features,
            'limits', plan_record.limits
        ),
        'usage', usage_stats
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at triggers
CREATE TRIGGER trigger_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- Subscription plans policies (public read for active plans)
CREATE POLICY "Anyone can view active subscription plans" ON subscription_plans
    FOR SELECT USING (is_active = true);

-- User subscriptions policies
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own subscriptions" ON user_subscriptions
    FOR UPDATE USING (auth.uid()::text = user_id::text);

-- Usage tracking policies
CREATE POLICY "Users can view own usage" ON usage_tracking
    FOR SELECT USING (auth.uid()::text = user_id::text);

-- Billing events policies
CREATE POLICY "Users can view own billing events" ON billing_events
    FOR SELECT USING (auth.uid()::text = user_id::text);

-- ============================================================================
-- SEED DATA: SUBSCRIPTION PLANS
-- ============================================================================

-- Freemium Plan
INSERT INTO subscription_plans (
    id, name, tier, display_name, description,
    price_php, price_myr, price_thb, price_idr, price_usd,
    annual_price_php, annual_price_myr, annual_price_thb, annual_price_idr, annual_price_usd,
    features, limits, trial_days, sort_order
) VALUES (
    '00000000-0000-0000-0001-000000000001',
    'freemium',
    'freemium'::subscription_tier,
    'Free Plan',
    'Perfect for trying out GOMFLOW with basic features',
    0.00, 0.00, 0.00, 0.00, 0.00,
    0.00, 0.00, 0.00, 0.00, 0.00,
    '{
        "order_creation": true,
        "basic_analytics": true,
        "whatsapp_integration": true,
        "telegram_integration": true,
        "discord_integration": true,
        "payment_tracking": true,
        "gomflow_branding": true,
        "community_support": true
    }'::jsonb,
    '{
        "orders_created": 50,
        "api_calls": 1000,
        "storage_mb": 100,
        "messages_sent": 500,
        "submissions_received": 200
    }'::jsonb,
    0, 1
) ON CONFLICT (id) DO NOTHING;

-- Starter Plan  
INSERT INTO subscription_plans (
    id, name, tier, display_name, description,
    price_php, price_myr, price_thb, price_idr, price_usd,
    annual_price_php, annual_price_myr, annual_price_thb, annual_price_idr, annual_price_usd,
    features, limits, trial_days, sort_order
) VALUES (
    '00000000-0000-0000-0001-000000000002',
    'starter',
    'starter'::subscription_tier,
    'Starter Plan',
    'Great for growing GOMs who need more capacity',
    599.00, 35.00, 420.00, 180000.00, 12.00,
    5990.00, 350.00, 4200.00, 1800000.00, 120.00,
    '{
        "order_creation": true,
        "basic_analytics": true,
        "advanced_analytics": false,
        "whatsapp_integration": true,
        "telegram_integration": true,
        "discord_integration": true,
        "payment_tracking": true,
        "remove_branding": true,
        "email_support": true,
        "real_time_notifications": true
    }'::jsonb,
    '{
        "orders_created": 200,
        "api_calls": 5000,
        "storage_mb": 500,
        "messages_sent": 2000,
        "submissions_received": 1000
    }'::jsonb,
    14, 2
) ON CONFLICT (id) DO NOTHING;

-- Professional Plan
INSERT INTO subscription_plans (
    id, name, tier, display_name, description,
    price_php, price_myr, price_thb, price_idr, price_usd,
    annual_price_php, annual_price_myr, annual_price_thb, annual_price_idr, annual_price_usd,
    features, limits, trial_days, sort_order
) VALUES (
    '00000000-0000-0000-0001-000000000003',
    'professional',
    'professional'::subscription_tier,
    'Professional Plan',
    'Perfect for serious GOMs who need unlimited capacity',
    1299.00, 75.00, 900.00, 380000.00, 25.00,
    12990.00, 750.00, 9000.00, 3800000.00, 250.00,
    '{
        "order_creation": true,
        "basic_analytics": true,
        "advanced_analytics": true,
        "predictive_analytics": true,
        "whatsapp_integration": true,
        "telegram_integration": true,
        "discord_integration": true,
        "payment_tracking": true,
        "remove_branding": true,
        "custom_branding": true,
        "priority_support": true,
        "api_access": true,
        "bulk_messaging": true,
        "collaboration_tools": true,
        "real_time_notifications": true
    }'::jsonb,
    '{
        "orders_created": -1,
        "api_calls": 50000,
        "storage_mb": 5000,
        "messages_sent": -1,
        "submissions_received": -1
    }'::jsonb,
    14, 3
) ON CONFLICT (id) DO NOTHING;

-- Enterprise Plan
INSERT INTO subscription_plans (
    id, name, tier, display_name, description,
    price_php, price_myr, price_thb, price_idr, price_usd,
    annual_price_php, annual_price_myr, annual_price_thb, annual_price_idr, annual_price_usd,
    features, limits, trial_days, sort_order
) VALUES (
    '00000000-0000-0000-0001-000000000004',
    'enterprise',
    'enterprise'::subscription_tier,
    'Enterprise Plan',
    'For large organizations and multi-GOM operations',
    2999.00, 180.00, 2100.00, 900000.00, 60.00,
    29990.00, 1800.00, 21000.00, 9000000.00, 600.00,
    '{
        "order_creation": true,
        "basic_analytics": true,
        "advanced_analytics": true,
        "predictive_analytics": true,
        "market_intelligence": true,
        "whatsapp_integration": true,
        "telegram_integration": true,
        "discord_integration": true,
        "payment_tracking": true,
        "remove_branding": true,
        "custom_branding": true,
        "white_label": true,
        "dedicated_support": true,
        "api_access": true,
        "unlimited_api": true,
        "bulk_messaging": true,
        "collaboration_tools": true,
        "multi_gom_management": true,
        "custom_integrations": true,
        "sla_guarantee": true,
        "real_time_notifications": true
    }'::jsonb,
    '{
        "orders_created": -1,
        "api_calls": -1,
        "storage_mb": -1,
        "messages_sent": -1,
        "submissions_received": -1
    }'::jsonb,
    14, 4
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- VIEWS FOR EASY QUERYING
-- ============================================================================

-- Subscription overview view
CREATE VIEW subscription_overview AS
SELECT 
    us.id as subscription_id,
    us.user_id,
    u.email,
    u.name as user_name,
    u.country,
    sp.name as plan_name,
    sp.display_name as plan_display_name,
    us.tier,
    us.status,
    us.billing_cycle,
    us.currency,
    us.amount,
    us.current_period_start,
    us.current_period_end,
    us.next_billing_date,
    us.trial_end_date,
    us.cancel_at_period_end,
    CASE 
        WHEN us.status = 'trial' AND us.trial_end_date < NOW() THEN 'expired'
        WHEN us.status = 'active' AND us.current_period_end < NOW() THEN 'overdue'
        ELSE us.status::text
    END as computed_status,
    sp.features,
    sp.limits,
    us.created_at as subscription_created_at
FROM user_subscriptions us
JOIN users u ON us.user_id = u.id
JOIN subscription_plans sp ON us.plan_id = sp.id;

-- Usage summary view
CREATE VIEW usage_summary AS
SELECT 
    ut.user_id,
    ut.subscription_id,
    ut.metric_type,
    SUM(ut.metric_value) as total_usage,
    ut.period_start,
    ut.period_end,
    sp.limits->(ut.metric_type::text) as usage_limit,
    CASE 
        WHEN (sp.limits->(ut.metric_type::text))::integer = -1 THEN 'unlimited'
        WHEN SUM(ut.metric_value) >= (sp.limits->(ut.metric_type::text))::integer THEN 'exceeded'
        WHEN SUM(ut.metric_value) >= (sp.limits->(ut.metric_type::text))::integer * 0.8 THEN 'warning'
        ELSE 'ok'
    END as usage_status
FROM usage_tracking ut
JOIN user_subscriptions us ON ut.subscription_id = us.id
JOIN subscription_plans sp ON us.plan_id = sp.id
GROUP BY ut.user_id, ut.subscription_id, ut.metric_type, ut.period_start, ut.period_end, sp.limits;

-- ============================================================================
-- COMPLETION
-- ============================================================================

COMMENT ON TABLE subscription_plans IS 'GOMFLOW subscription plan definitions with multi-currency pricing';
COMMENT ON TABLE user_subscriptions IS 'User subscription records with billing and status tracking';
COMMENT ON TABLE usage_tracking IS 'Real-time usage tracking for subscription limits';
COMMENT ON TABLE billing_events IS 'Billing events and payment history for subscriptions';

-- Success message
SELECT 'GOMFLOW Subscription Management System created successfully! 💰' as status;