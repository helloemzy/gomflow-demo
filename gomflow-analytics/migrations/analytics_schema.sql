-- GOMFLOW Analytics System Database Schema
-- This should be added to the main Supabase migration

-- Analytics events table - stores all raw analytics events
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY,
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
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
    guild_id TEXT, -- Discord guild ID
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
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
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
    time_window INTEGER NOT NULL, -- Minutes
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
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
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
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    shared_with TEXT[] DEFAULT '{}', -- User IDs who can access
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analytics user sessions table - tracks user sessions for engagement metrics
CREATE TABLE analytics_user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
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
    steps JSONB NOT NULL, -- Array of step configurations
    conversion_window_hours INTEGER DEFAULT 24,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
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
    period_data JSONB NOT NULL, -- Array of period values
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
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analytics ab_tests table - stores A/B test configurations
CREATE TABLE analytics_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    variants JSONB NOT NULL, -- Array of variant configurations
    traffic_allocation JSONB NOT NULL, -- Traffic split configuration
    metrics JSONB NOT NULL, -- Metrics to track
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'paused')),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    results JSONB,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at);
CREATE INDEX idx_analytics_events_platform ON analytics_events(platform);
CREATE INDEX idx_analytics_events_country ON analytics_events(country);
CREATE INDEX idx_analytics_events_order_id ON analytics_events(order_id);
CREATE INDEX idx_analytics_events_submission_id ON analytics_events(submission_id);
CREATE INDEX idx_analytics_events_session_id ON analytics_events(session_id);

-- Composite indexes for common queries
CREATE INDEX idx_analytics_events_user_date ON analytics_events(user_id, created_at);
CREATE INDEX idx_analytics_events_type_date ON analytics_events(event_type, created_at);
CREATE INDEX idx_analytics_events_platform_date ON analytics_events(platform, created_at);

-- Aggregations indexes
CREATE INDEX idx_analytics_aggregations_metric ON analytics_aggregations(metric_name);
CREATE INDEX idx_analytics_aggregations_time_bucket ON analytics_aggregations(time_bucket);
CREATE INDEX idx_analytics_aggregations_bucket_size ON analytics_aggregations(bucket_size);
CREATE INDEX idx_analytics_aggregations_metric_time ON analytics_aggregations(metric_name, time_bucket);

-- Other table indexes
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

-- RLS (Row Level Security) policies
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

-- Analytics events: Allow all authenticated users to insert, only admins to select all
CREATE POLICY "Anyone can track events" ON analytics_events
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view own events" ON analytics_events
    FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

-- Analytics aggregations: Read-only for authenticated users
CREATE POLICY "Anyone can view aggregations" ON analytics_aggregations
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Analytics reports: Users can view their own reports
CREATE POLICY "Users can view own reports" ON analytics_reports
    FOR SELECT USING (auth.uid() = generated_by OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can create reports" ON analytics_reports
    FOR INSERT WITH CHECK (auth.uid() = generated_by);

-- Analytics alerts: Users can manage their own alerts
CREATE POLICY "Users can manage own alerts" ON analytics_alerts
    FOR ALL USING (auth.uid() IN (SELECT unnest(string_to_array(recipients::text, ',')::uuid[])) OR auth.jwt() ->> 'role' = 'admin');

-- Analytics export jobs: Users can view their own export jobs
CREATE POLICY "Users can view own export jobs" ON analytics_export_jobs
    FOR SELECT USING (auth.uid() = requested_by OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can create export jobs" ON analytics_export_jobs
    FOR INSERT WITH CHECK (auth.uid() = requested_by);

-- Analytics dashboards: Users can view dashboards they have access to
CREATE POLICY "Users can view accessible dashboards" ON analytics_dashboards
    FOR SELECT USING (
        is_public = true OR 
        auth.uid() = created_by OR 
        auth.uid() = ANY(shared_with::uuid[]) OR 
        auth.jwt() ->> 'role' = 'admin'
    );

CREATE POLICY "Users can create dashboards" ON analytics_dashboards
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own dashboards" ON analytics_dashboards
    FOR UPDATE USING (auth.uid() = created_by OR auth.jwt() ->> 'role' = 'admin');

-- Analytics user sessions: Users can view their own sessions
CREATE POLICY "Users can view own sessions" ON analytics_user_sessions
    FOR SELECT USING (auth.uid() = user_id OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Anyone can track sessions" ON analytics_user_sessions
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own sessions" ON analytics_user_sessions
    FOR UPDATE USING (auth.uid() = user_id);

-- Other tables similar policies...

-- Functions for analytics calculations

-- Function to get user analytics summary
CREATE OR REPLACE FUNCTION get_user_analytics_summary(user_uuid UUID, start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days')
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'totalEvents', COUNT(*),
        'orderEvents', COUNT(*) FILTER (WHERE event_type LIKE 'order_%'),
        'submissionEvents', COUNT(*) FILTER (WHERE event_type LIKE 'submission_%'),
        'platforms', json_agg(DISTINCT platform) FILTER (WHERE platform IS NOT NULL),
        'countries', json_agg(DISTINCT country) FILTER (WHERE country IS NOT NULL),
        'sessionCount', COUNT(DISTINCT session_id) FILTER (WHERE session_id IS NOT NULL),
        'lastActivity', MAX(created_at),
        'firstActivity', MIN(created_at)
    )
    INTO result
    FROM analytics_events
    WHERE user_id = user_uuid
    AND created_at >= start_date;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get platform analytics summary
CREATE OR REPLACE FUNCTION get_platform_analytics_summary(platform_name TEXT, start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days')
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'totalEvents', COUNT(*),
        'uniqueUsers', COUNT(DISTINCT user_id),
        'topEvents', json_agg(
            json_build_object(
                'eventType', event_type,
                'count', event_count
            )
        )
    )
    INTO result
    FROM (
        SELECT 
            event_type,
            COUNT(*) as event_count
        FROM analytics_events
        WHERE platform = platform_name
        AND created_at >= start_date
        GROUP BY event_type
        ORDER BY COUNT(*) DESC
        LIMIT 10
    ) top_events;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate conversion funnel
CREATE OR REPLACE FUNCTION calculate_conversion_funnel(
    step_events TEXT[],
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
    end_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
    result JSON;
    step_data JSON[];
    i INTEGER;
    step_count INTEGER;
    prev_users INTEGER := 0;
BEGIN
    step_data := '{}';
    
    FOR i IN 1..array_length(step_events, 1) LOOP
        SELECT json_build_object(
            'step', i,
            'eventType', step_events[i],
            'users', COUNT(DISTINCT user_id),
            'conversionRate', CASE 
                WHEN i = 1 THEN 100.0
                WHEN prev_users > 0 THEN (COUNT(DISTINCT user_id)::FLOAT / prev_users) * 100
                ELSE 0
            END
        )
        INTO step_data[i]
        FROM analytics_events
        WHERE event_type = step_events[i]
        AND created_at >= start_date
        AND created_at <= end_date;
        
        -- Get user count for next iteration
        SELECT COUNT(DISTINCT user_id) INTO prev_users
        FROM analytics_events
        WHERE event_type = step_events[i]
        AND created_at >= start_date
        AND created_at <= end_date;
    END LOOP;
    
    SELECT json_build_object(
        'steps', step_data,
        'totalConversionRate', CASE 
            WHEN array_length(step_data, 1) > 0 THEN 
                (step_data[array_length(step_data, 1)]->>'users')::FLOAT / (step_data[1]->>'users')::FLOAT * 100
            ELSE 0
        END,
        'calculatedAt', CURRENT_TIMESTAMP
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get real-time metrics
CREATE OR REPLACE FUNCTION get_realtime_metrics()
RETURNS JSON AS $$
DECLARE
    result JSON;
    current_hour TIMESTAMP;
BEGIN
    current_hour := date_trunc('hour', CURRENT_TIMESTAMP);
    
    SELECT json_build_object(
        'activeUsers', COUNT(DISTINCT user_id) FILTER (WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'),
        'eventsLastHour', COUNT(*) FILTER (WHERE created_at >= current_hour),
        'ordersToday', COUNT(*) FILTER (WHERE event_type = 'order_created' AND created_at >= CURRENT_DATE),
        'submissionsToday', COUNT(*) FILTER (WHERE event_type = 'submission_created' AND created_at >= CURRENT_DATE),
        'verifiedToday', COUNT(*) FILTER (WHERE event_type = 'submission_payment_verified' AND created_at >= CURRENT_DATE),
        'platformBreakdown', json_object_agg(
            platform, 
            platform_count
        ) FILTER (WHERE platform IS NOT NULL)
    )
    INTO result
    FROM analytics_events
    LEFT JOIN LATERAL (
        SELECT platform, COUNT(*) as platform_count
        FROM analytics_events e2
        WHERE e2.platform = analytics_events.platform
        AND e2.created_at >= CURRENT_DATE
        GROUP BY platform
    ) platform_stats ON true
    WHERE created_at >= CURRENT_DATE - INTERVAL '1 day';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old analytics data
CREATE OR REPLACE FUNCTION cleanup_old_analytics_data(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
    cutoff_date TIMESTAMP;
BEGIN
    cutoff_date := CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL;
    
    -- Delete old events
    DELETE FROM analytics_events WHERE created_at < cutoff_date;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old aggregations (keep longer retention for aggregated data)
    DELETE FROM analytics_aggregations 
    WHERE created_at < cutoff_date - INTERVAL '30 days'
    AND bucket_size IN ('minute', 'hour');
    
    -- Delete old reports
    DELETE FROM analytics_reports 
    WHERE created_at < cutoff_date
    AND status IN ('generated', 'expired');
    
    -- Delete old export jobs
    DELETE FROM analytics_export_jobs 
    WHERE created_at < cutoff_date - INTERVAL '7 days';
    
    -- Delete old user sessions
    DELETE FROM analytics_user_sessions 
    WHERE started_at < cutoff_date;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
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

-- Set up realtime subscriptions for analytics tables
ALTER publication supabase_realtime ADD TABLE analytics_events;
ALTER publication supabase_realtime ADD TABLE analytics_aggregations;
ALTER publication supabase_realtime ADD TABLE analytics_reports;

-- Comments for documentation
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

COMMENT ON COLUMN analytics_events.event_data IS 'JSON data specific to each event type';
COMMENT ON COLUMN analytics_aggregations.dimensions IS 'Dimensional data for metric filtering';
COMMENT ON COLUMN analytics_reports.report_data IS 'Generated report content';
COMMENT ON COLUMN analytics_dashboards.config IS 'Dashboard widget configurations';
COMMENT ON COLUMN analytics_funnels.steps IS 'Funnel step configurations';
COMMENT ON COLUMN analytics_cohorts.period_data IS 'Cohort period performance data';
COMMENT ON COLUMN analytics_segments.criteria IS 'Segment filtering criteria';
COMMENT ON COLUMN analytics_ab_tests.variants IS 'A/B test variant configurations';