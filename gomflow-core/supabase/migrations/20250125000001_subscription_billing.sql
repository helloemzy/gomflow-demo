-- ============================================================================
-- SUBSCRIPTION BILLING SYSTEM MIGRATION
-- Adds Stripe subscription billing and invoice management
-- ============================================================================

-- Create billing-specific enums
CREATE TYPE billing_interval AS ENUM ('month', 'year');
CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible');
CREATE TYPE payment_status AS ENUM ('succeeded', 'pending', 'failed', 'canceled');
CREATE TYPE customer_status AS ENUM ('active', 'inactive', 'suspended');

-- ============================================================================
-- CUSTOMERS TABLE (Stripe customer data)
-- ============================================================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    country country_code NOT NULL,
    currency currency_code NOT NULL,
    tax_id TEXT, -- For VAT/GST compliance
    tax_exempt BOOLEAN DEFAULT false,
    status customer_status DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers indexes
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_stripe_customer_id ON customers(stripe_customer_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_country ON customers(country);
CREATE INDEX idx_customers_status ON customers(status);

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL, -- Stripe status: active, incomplete, trialing, etc.
    price_id TEXT NOT NULL, -- Stripe price ID
    quantity INTEGER DEFAULT 1,
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    billing_interval billing_interval NOT NULL,
    amount_per_period DECIMAL(10,2) NOT NULL,
    currency currency_code NOT NULL,
    tax_percent DECIMAL(5,2), -- For VAT/GST
    discount_coupon TEXT, -- Stripe coupon ID
    discount_percent DECIMAL(5,2),
    discount_amount DECIMAL(10,2),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions indexes
CREATE INDEX idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_current_period_end ON subscriptions(current_period_end);
CREATE INDEX idx_subscriptions_trial_end ON subscriptions(trial_end);

-- ============================================================================
-- PAYMENT METHODS TABLE (Stripe payment methods)
-- ============================================================================
CREATE TABLE stripe_payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    stripe_payment_method_id TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL, -- card, fpx, grabpay, etc.
    brand TEXT, -- visa, mastercard, etc. (for cards)
    last4 TEXT, -- Last 4 digits (for cards)
    exp_month INTEGER, -- Expiry month (for cards)
    exp_year INTEGER, -- Expiry year (for cards)
    country TEXT, -- Issuing country
    funding TEXT, -- credit, debit, prepaid (for cards)
    is_default BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment methods indexes
CREATE INDEX idx_stripe_payment_methods_customer_id ON stripe_payment_methods(customer_id);
CREATE INDEX idx_stripe_payment_methods_stripe_payment_method_id ON stripe_payment_methods(stripe_payment_method_id);
CREATE INDEX idx_stripe_payment_methods_type ON stripe_payment_methods(type);
CREATE INDEX idx_stripe_payment_methods_is_default ON stripe_payment_methods(is_default);

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    stripe_invoice_id TEXT UNIQUE NOT NULL,
    invoice_number TEXT UNIQUE NOT NULL,
    status invoice_status NOT NULL,
    currency currency_code NOT NULL,
    amount_due DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    amount_remaining DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    attempted_at TIMESTAMP WITH TIME ZONE,
    next_payment_attempt TIMESTAMP WITH TIME ZONE,
    attempt_count INTEGER DEFAULT 0,
    payment_intent_id TEXT, -- Stripe payment intent ID
    charge_id TEXT, -- Stripe charge ID
    receipt_url TEXT,
    invoice_pdf TEXT, -- URL to PDF
    hosted_invoice_url TEXT, -- Stripe hosted invoice URL
    description TEXT,
    statement_descriptor TEXT,
    footer TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoices indexes
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX idx_invoices_stripe_invoice_id ON invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_paid_at ON invoices(paid_at);
CREATE INDEX idx_invoices_period_start ON invoices(period_start);
CREATE INDEX idx_invoices_period_end ON invoices(period_end);

-- ============================================================================
-- INVOICE LINE ITEMS TABLE
-- ============================================================================
CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    stripe_line_item_id TEXT,
    type TEXT NOT NULL, -- subscription, invoice_item
    description TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    amount DECIMAL(10,2) NOT NULL,
    unit_amount DECIMAL(10,2),
    currency currency_code NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    price_id TEXT, -- Stripe price ID
    product_id TEXT, -- Stripe product ID
    tax_rates JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invoice line items indexes
CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_type ON invoice_line_items(type);
CREATE INDEX idx_invoice_line_items_price_id ON invoice_line_items(price_id);

-- ============================================================================
-- BILLING EVENTS TABLE (Audit log for billing events)
-- ============================================================================
CREATE TABLE billing_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL, -- invoice.paid, subscription.created, etc.
    event_data JSONB NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Billing events indexes
CREATE INDEX idx_billing_events_customer_id ON billing_events(customer_id);
CREATE INDEX idx_billing_events_subscription_id ON billing_events(subscription_id);
CREATE INDEX idx_billing_events_invoice_id ON billing_events(invoice_id);
CREATE INDEX idx_billing_events_stripe_event_id ON billing_events(stripe_event_id);
CREATE INDEX idx_billing_events_event_type ON billing_events(event_type);
CREATE INDEX idx_billing_events_processed_at ON billing_events(processed_at);
CREATE INDEX idx_billing_events_created_at ON billing_events(created_at);

-- ============================================================================
-- BILLING NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE billing_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    notification_type TEXT NOT NULL, -- payment_succeeded, payment_failed, invoice_upcoming, etc.
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, sent, failed
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Billing notifications indexes
CREATE INDEX idx_billing_notifications_customer_id ON billing_notifications(customer_id);
CREATE INDEX idx_billing_notifications_invoice_id ON billing_notifications(invoice_id);
CREATE INDEX idx_billing_notifications_subscription_id ON billing_notifications(subscription_id);
CREATE INDEX idx_billing_notifications_status ON billing_notifications(status);
CREATE INDEX idx_billing_notifications_notification_type ON billing_notifications(notification_type);
CREATE INDEX idx_billing_notifications_created_at ON billing_notifications(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_notifications ENABLE ROW LEVEL SECURITY;

-- Customers policies
CREATE POLICY "Users can view their own customer record" ON customers
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.user_id = customers.user_id 
        AND profiles.user_id = auth.uid()
    ));

CREATE POLICY "Users can update their own customer record" ON customers
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.user_id = customers.user_id 
        AND profiles.user_id = auth.uid()
    ));

-- Subscriptions policies
CREATE POLICY "Users can view their own subscriptions" ON subscriptions
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM customers 
        JOIN profiles ON profiles.user_id = customers.user_id
        WHERE customers.id = subscriptions.customer_id 
        AND profiles.user_id = auth.uid()
    ));

-- Payment methods policies
CREATE POLICY "Users can view their own payment methods" ON stripe_payment_methods
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM customers 
        JOIN profiles ON profiles.user_id = customers.user_id
        WHERE customers.id = stripe_payment_methods.customer_id 
        AND profiles.user_id = auth.uid()
    ));

-- Invoices policies
CREATE POLICY "Users can view their own invoices" ON invoices
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM customers 
        JOIN profiles ON profiles.user_id = customers.user_id
        WHERE customers.id = invoices.customer_id 
        AND profiles.user_id = auth.uid()
    ));

-- Invoice line items policies
CREATE POLICY "Users can view their own invoice line items" ON invoice_line_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM invoices
        JOIN customers ON customers.id = invoices.customer_id
        JOIN profiles ON profiles.user_id = customers.user_id
        WHERE invoices.id = invoice_line_items.invoice_id 
        AND profiles.user_id = auth.uid()
    ));

-- Billing events policies (admin only for now)
CREATE POLICY "Service role can manage billing events" ON billing_events
    FOR ALL USING (auth.role() = 'service_role');

-- Billing notifications policies
CREATE POLICY "Users can view their own billing notifications" ON billing_notifications
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM customers 
        JOIN profiles ON profiles.user_id = customers.user_id
        WHERE customers.id = billing_notifications.customer_id 
        AND profiles.user_id = auth.uid()
    ));

-- ============================================================================
-- DATABASE FUNCTIONS
-- ============================================================================

-- Function to update subscription status based on Stripe webhooks
CREATE OR REPLACE FUNCTION update_subscription_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user plan based on subscription status
    UPDATE profiles 
    SET 
        plan = CASE 
            WHEN NEW.status = 'active' THEN 
                CASE 
                    WHEN NEW.amount_per_period <= 12 THEN 'pro'::user_plan
                    WHEN NEW.amount_per_period <= 25 THEN 'gateway'::user_plan
                    ELSE 'business'::user_plan
                END
            ELSE 'free'::user_plan
        END,
        subscription_status = CASE 
            WHEN NEW.status IN ('active', 'trialing') THEN 'active'::subscription_status
            WHEN NEW.status = 'canceled' THEN 'cancelled'::subscription_status
            ELSE 'inactive'::subscription_status
        END,
        updated_at = NOW()
    FROM customers
    WHERE customers.id = NEW.customer_id 
    AND profiles.user_id = customers.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for subscription status updates
CREATE TRIGGER trigger_update_subscription_status
    AFTER INSERT OR UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_status();

-- Function to calculate invoice totals
CREATE OR REPLACE FUNCTION calculate_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
    line_items_total DECIMAL(10,2);
    tax_amount DECIMAL(10,2) := 0;
BEGIN
    -- Calculate subtotal from line items
    SELECT COALESCE(SUM(amount), 0) INTO line_items_total
    FROM invoice_line_items 
    WHERE invoice_id = NEW.id;
    
    -- Update invoice totals
    NEW.subtotal := line_items_total;
    NEW.tax := tax_amount;
    NEW.total := line_items_total + tax_amount;
    NEW.amount_due := NEW.total - NEW.amount_paid;
    NEW.amount_remaining := NEW.amount_due;
    NEW.updated_at := NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invoice total calculations
CREATE TRIGGER trigger_calculate_invoice_totals
    BEFORE INSERT OR UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION calculate_invoice_totals();

-- Function to get customer subscription status
CREATE OR REPLACE FUNCTION get_customer_subscription_status(customer_uuid UUID)
RETURNS TABLE (
    has_active_subscription BOOLEAN,
    current_plan TEXT,
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    is_trial BOOLEAN,
    trial_end_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE WHEN s.status IN ('active', 'trialing') THEN true ELSE false END as has_active_subscription,
        CASE 
            WHEN s.amount_per_period <= 12 THEN 'pro'
            WHEN s.amount_per_period <= 25 THEN 'gateway'
            ELSE 'business'
        END as current_plan,
        s.current_period_end as subscription_end_date,
        CASE WHEN s.trial_end > NOW() THEN true ELSE false END as is_trial,
        s.trial_end as trial_end_date
    FROM subscriptions s
    WHERE s.customer_id = customer_uuid
    AND s.status IN ('active', 'trialing', 'past_due')
    ORDER BY s.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INITIAL DATA AND CONFIGURATION
-- ============================================================================

-- Insert default subscription pricing tiers (these would map to Stripe prices)
-- This is informational - actual prices are managed in Stripe
INSERT INTO billing_events (stripe_event_id, event_type, event_data, processed_at) VALUES
('initial_setup', 'setup.completed', '{"note": "Billing system initialized"}', NOW());

COMMENT ON TABLE customers IS 'Stripe customer records synced with GOMFLOW users';
COMMENT ON TABLE subscriptions IS 'Active and historical subscription records from Stripe';
COMMENT ON TABLE stripe_payment_methods IS 'Payment methods stored in Stripe for recurring billing';
COMMENT ON TABLE invoices IS 'Invoice records from Stripe with payment status';
COMMENT ON TABLE invoice_line_items IS 'Individual line items for each invoice';
COMMENT ON TABLE billing_events IS 'Audit log of all Stripe webhook events';
COMMENT ON TABLE billing_notifications IS 'Email notifications sent for billing events';