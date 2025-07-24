-- ============================================================================
-- GOMFLOW COMPLETE DATABASE SCHEMA
-- Production-Ready Setup for K-pop Group Order Management Platform
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

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
-- PROFILES TABLE (Replaces users - links to auth.users)
-- ============================================================================
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

-- Profiles indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_country ON profiles(country);
CREATE INDEX idx_profiles_plan ON profiles(plan);
CREATE INDEX idx_profiles_created_at ON profiles(created_at);

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================
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

-- Orders indexes
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_slug ON orders(slug);
CREATE INDEX idx_orders_is_active ON orders(is_active);
CREATE INDEX idx_orders_deadline ON orders(deadline);
CREATE INDEX idx_orders_currency ON orders(currency);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_title_trgm ON orders USING gin (title gin_trgm_ops);

-- ============================================================================
-- SUBMISSIONS TABLE
-- ============================================================================
CREATE TABLE submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    buyer_name VARCHAR(255) NOT NULL,
    buyer_phone VARCHAR(20) NOT NULL,
    buyer_email VARCHAR(255),
    buyer_platform platform_type DEFAULT 'web',
    buyer_platform_id VARCHAR(100), -- WhatsApp number, Telegram ID, Discord ID
    quantity INTEGER NOT NULL CHECK (quantity >= 1),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    currency currency_code NOT NULL,
    payment_reference VARCHAR(50) UNIQUE NOT NULL,
    payment_gateway payment_gateway,
    payment_intent_id VARCHAR(255), -- For gateway payments
    checkout_session_id VARCHAR(255), -- For gateway payments  
    payment_url TEXT, -- For gateway payments
    status submission_status DEFAULT 'pending',
    source_platform VARCHAR(50),
    utm_source VARCHAR(100),
    last_reminder_sent TIMESTAMP WITH TIME ZONE,
    reminder_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Submissions indexes
CREATE INDEX idx_submissions_order_id ON submissions(order_id);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_payment_reference ON submissions(payment_reference);
CREATE INDEX idx_submissions_buyer_platform ON submissions(buyer_platform);
CREATE INDEX idx_submissions_buyer_platform_id ON submissions(buyer_platform_id);
CREATE INDEX idx_submissions_created_at ON submissions(created_at);
CREATE INDEX idx_submissions_buyer_phone ON submissions(buyer_phone);

-- ============================================================================
-- PAYMENT_TRANSACTIONS TABLE
-- ============================================================================
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

-- Payment transactions indexes
CREATE INDEX idx_payment_transactions_submission_id ON payment_transactions(submission_id);
CREATE INDEX idx_payment_transactions_gateway ON payment_transactions(gateway);
CREATE INDEX idx_payment_transactions_gateway_payment_id ON payment_transactions(gateway_payment_id);
CREATE INDEX idx_payment_transactions_paid_at ON payment_transactions(paid_at);

-- ============================================================================
-- PLATFORM_CONNECTIONS TABLE
-- ============================================================================
CREATE TABLE platform_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    connection_type connection_type NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Platform connections indexes  
CREATE INDEX idx_platform_connections_user_id ON platform_connections(user_id);
CREATE INDEX idx_platform_connections_platform ON platform_connections(platform);
CREATE INDEX idx_platform_connections_is_active ON platform_connections(is_active);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    message_type message_type NOT NULL,
    content TEXT NOT NULL,
    status message_status DEFAULT 'pending',
    external_message_id VARCHAR(255), -- Platform-specific message ID
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages indexes
CREATE INDEX idx_messages_submission_id ON messages(submission_id);
CREATE INDEX idx_messages_platform ON messages(platform);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_sent_at ON messages(sent_at);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- ============================================================================
-- PLATFORM_POSTS TABLE
-- ============================================================================
CREATE TABLE platform_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    platform platform_type NOT NULL,
    post_id VARCHAR(255), -- Platform-specific post ID
    post_url TEXT,
    status post_status DEFAULT 'posted',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Platform posts indexes
CREATE INDEX idx_platform_posts_order_id ON platform_posts(order_id);
CREATE INDEX idx_platform_posts_platform ON platform_posts(platform);
CREATE INDEX idx_platform_posts_status ON platform_posts(status);

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

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update updated_at on profiles
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on orders
CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on submissions
CREATE TRIGGER trigger_submissions_updated_at
    BEFORE UPDATE ON submissions
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

-- Profiles policies
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

-- ============================================================================
-- STORAGE SETUP
-- ============================================================================

-- Create storage bucket for payment proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment proofs
CREATE POLICY "Order owners can view payment proofs" ON storage.objects
    FOR SELECT USING (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can upload payment proofs" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'payment-proofs' AND auth.role() = 'authenticated');

CREATE POLICY "Service role can manage payment proofs" ON storage.objects
    FOR ALL USING (bucket_id = 'payment-proofs' AND auth.role() = 'service_role');