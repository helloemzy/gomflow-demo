-- GOMFLOW Notifications System Database Schema
-- This should be added to the main Supabase migration

-- Notifications table to store all notification events
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
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
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    external_id TEXT, -- FCM message ID, email message ID, etc.
    error_message TEXT,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
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

-- RLS (Row Level Security) policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

-- Notifications: Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Notification preferences: Users can manage their own preferences
CREATE POLICY "Users can view own preferences" ON notification_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON notification_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON notification_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User devices: Users can manage their own devices
CREATE POLICY "Users can view own devices" ON user_devices
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own devices" ON user_devices
    FOR ALL USING (auth.uid() = user_id);

-- Notification templates: Read-only for all users, admin can modify
CREATE POLICY "Anyone can view templates" ON notification_templates
    FOR SELECT USING (true);

-- Notification deliveries: Users can view deliveries for their notifications
CREATE POLICY "Users can view own deliveries" ON notification_deliveries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM notifications n 
            WHERE n.id = notification_deliveries.notification_id 
            AND n.user_id = auth.uid()
        )
    );

-- Functions for automated tasks

-- Function to automatically create notification preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default preferences when user is created
CREATE TRIGGER trigger_create_notification_preferences
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_notification_preferences();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updating updated_at
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

-- Function to clean up old notifications (run via cron)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete notifications older than 30 days that have been read
    -- or older than 7 days if they've expired
    DELETE FROM notifications
    WHERE (
        (read_at IS NOT NULL AND created_at < CURRENT_TIMESTAMP - INTERVAL '30 days')
        OR
        (expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP - INTERVAL '7 days')
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Set up realtime subscriptions for notifications table
SELECT pg_notify('supabase_realtime', 'notifications');

-- Comments for documentation
COMMENT ON TABLE notifications IS 'Stores all notification events sent to users';
COMMENT ON TABLE notification_preferences IS 'User-specific notification channel preferences';
COMMENT ON TABLE user_devices IS 'FCM tokens and device information for push notifications';
COMMENT ON TABLE notification_templates IS 'Templates for different notification types and channels';
COMMENT ON TABLE notification_deliveries IS 'Delivery tracking and analytics for notifications';

COMMENT ON COLUMN notifications.data IS 'JSON data for template variable substitution';
COMMENT ON COLUMN notifications.channels_sent IS 'Array of channels this notification was sent through';
COMMENT ON COLUMN notification_preferences.quiet_hours IS 'Time range when notifications should be suppressed';
COMMENT ON COLUMN user_devices.device_info IS 'Additional device metadata like OS version, app version, etc.';