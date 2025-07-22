-- GOMFLOW Initial Database Schema
-- Created: January 2025
-- Description: Complete database schema for GOMFLOW microservices platform

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- Create custom types
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
-- USERS TABLE
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    country country_code NOT NULL DEFAULT 'PH',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Manila',
    whatsapp_enabled BOOLEAN DEFAULT false,
    telegram_enabled BOOLEAN DEFAULT false,
    discord_enabled BOOLEAN DEFAULT false,
    plan user_plan DEFAULT 'free',
    subscription_status subscription_status DEFAULT 'inactive',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_country ON users(country);
CREATE INDEX idx_users_plan ON users(plan);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================================================
-- ORDERS TABLE  
-- ============================================================================
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
CREATE OR REPLACE FUNCTION get_dashboard_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_orders', (
            SELECT COUNT(*) FROM orders WHERE user_id = user_uuid
        ),
        'active_orders', (
            SELECT COUNT(*) FROM orders 
            WHERE user_id = user_uuid AND is_active = true
        ),
        'total_submissions', (
            SELECT COUNT(*) FROM submissions s
            JOIN orders o ON s.order_id = o.id
            WHERE o.user_id = user_uuid
        ),
        'pending_payments', (
            SELECT COUNT(*) FROM submissions s
            JOIN orders o ON s.order_id = o.id
            WHERE o.user_id = user_uuid AND s.status = 'pending'
        ),
        'overdue_payments', (
            SELECT COUNT(*) FROM submissions s
            JOIN orders o ON s.order_id = o.id
            WHERE o.user_id = user_uuid 
            AND s.status = 'pending' 
            AND o.deadline < NOW()
        ),
        'total_revenue', (
            SELECT COALESCE(SUM(s.total_amount), 0) FROM submissions s
            JOIN orders o ON s.order_id = o.id
            WHERE o.user_id = user_uuid AND s.status = 'paid'
        ),
        'pending_revenue', (
            SELECT COALESCE(SUM(s.total_amount), 0) FROM submissions s
            JOIN orders o ON s.order_id = o.id
            WHERE o.user_id = user_uuid AND s.status = 'pending'
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at triggers for all tables
CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_submissions_updated_at BEFORE UPDATE ON submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_posts ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Orders policies  
CREATE POLICY "Users can view own orders" ON orders
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create orders" ON orders
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own orders" ON orders
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own orders" ON orders
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Public policy for order viewing (for buyers)
CREATE POLICY "Public can view active orders" ON orders
    FOR SELECT USING (is_active = true);

-- Submissions policies
CREATE POLICY "Users can view submissions for own orders" ON submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = submissions.order_id 
            AND orders.user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Anyone can create submissions" ON submissions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update submissions for own orders" ON submissions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = submissions.order_id 
            AND orders.user_id::text = auth.uid()::text
        )
    );

-- Payment transactions policies
CREATE POLICY "Users can view payment transactions for own orders" ON payment_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN orders o ON s.order_id = o.id
            WHERE s.id = payment_transactions.submission_id 
            AND o.user_id::text = auth.uid()::text
        )
    );

-- Platform connections policies
CREATE POLICY "Users can manage own platform connections" ON platform_connections
    FOR ALL USING (auth.uid()::text = user_id::text);

-- Messages policies
CREATE POLICY "Users can view messages for own orders" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM submissions s
            JOIN orders o ON s.order_id = o.id
            WHERE s.id = messages.submission_id 
            AND o.user_id::text = auth.uid()::text
        )
    );

-- Platform posts policies
CREATE POLICY "Users can manage posts for own orders" ON platform_posts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = platform_posts.order_id 
            AND orders.user_id::text = auth.uid()::text
        )
    );

-- ============================================================================
-- SAMPLE DATA (for development)
-- ============================================================================

-- Sample user (will be replaced with actual auth)
INSERT INTO users (
    id, email, name, username, phone, country, plan, subscription_status
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'demo@gomflow.com',
    'Demo User',
    'demo',
    '+639123456789',
    'PH',
    'pro',
    'active'
) ON CONFLICT (id) DO NOTHING;

-- Sample order
INSERT INTO orders (
    id, user_id, title, description, price, currency, deadline, slug, 
    payment_methods, min_orders, max_orders
) VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'SEVENTEEN - GOD OF MUSIC Album',
    'Pre-order for the latest SEVENTEEN album with exclusive photocard set',
    850.00,
    'PHP',
    NOW() + INTERVAL '7 days',
    'seventeen-god-of-music-2025',
    '[
        {"type": "gcash", "number": "09123456789", "name": "Maria Santos", "instructions": "Send payment to GCash 09123456789 (Maria Santos)"},
        {"type": "paymaya", "number": "09123456789", "name": "Maria Santos", "instructions": "Send payment to PayMaya 09123456789 (Maria Santos)"}
    ]'::jsonb,
    20,
    100
) ON CONFLICT (id) DO NOTHING;

-- Sample submissions
INSERT INTO submissions (
    id, order_id, buyer_name, buyer_phone, buyer_platform, quantity, 
    total_amount, currency, payment_reference, status
) VALUES 
(
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    'Juan dela Cruz',
    '+639987654321',
    'whatsapp',
    1,
    850.00,
    'PHP',
    'PH-ABC12345',
    'pending'
),
(
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000002',
    'Anna Reyes',
    '+639876543210',
    'telegram',
    2,
    1700.00,
    'PHP',
    'PH-DEF67890',
    'paid'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- COMPLETION
-- ============================================================================

-- Create a view for order summaries (useful for dashboard)
CREATE VIEW order_summaries AS
SELECT 
    o.*,
    u.name as user_name,
    u.username,
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
JOIN users u ON o.user_id = u.id
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

COMMENT ON TABLE users IS 'Group Order Managers (GOMs) and their account information';
COMMENT ON TABLE orders IS 'Group orders created by GOMs for merchandise/products';
COMMENT ON TABLE submissions IS 'Individual buyer submissions/orders within a group order';
COMMENT ON TABLE payment_transactions IS 'Payment gateway transactions for tracking payments';
COMMENT ON TABLE platform_connections IS 'User connections to messaging platforms (WhatsApp/Telegram/Discord)';
COMMENT ON TABLE messages IS 'Messages sent to buyers through various platforms';
COMMENT ON TABLE platform_posts IS 'Posts made to platforms to promote orders';

-- Success message
SELECT 'GOMFLOW database schema created successfully! 🚀' as status;