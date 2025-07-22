-- GOMFLOW Monitoring System Database Schema
-- This should be added to the main Supabase migration

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
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Monitoring dashboards table - stores dashboard configurations
CREATE TABLE monitoring_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    widgets JSONB NOT NULL DEFAULT '[]',
    is_public BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    shared_with TEXT[] DEFAULT '{}', -- User IDs who can access
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
    response_time INTEGER NOT NULL, -- milliseconds
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
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
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
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
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

-- RLS (Row Level Security) policies
ALTER TABLE monitoring_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_service_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_downtimes ENABLE ROW LEVEL SECURITY;

-- Monitoring metrics: Allow service accounts to insert, admins to select all
CREATE POLICY "Service accounts can insert metrics" ON monitoring_metrics
    FOR INSERT WITH CHECK (auth.jwt() ->> 'role' IN ('service', 'admin'));

CREATE POLICY "Admins can view all metrics" ON monitoring_metrics
    FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can view system metrics" ON monitoring_metrics
    FOR SELECT USING (auth.uid() IS NOT NULL AND service_name = 'system');

-- Monitoring alerts: Admins can manage, users can view
CREATE POLICY "Admins can manage alerts" ON monitoring_alerts
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can view alerts" ON monitoring_alerts
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Monitoring logs: Service accounts can insert, admins can view all
CREATE POLICY "Service accounts can insert logs" ON monitoring_logs
    FOR INSERT WITH CHECK (auth.jwt() ->> 'role' IN ('service', 'admin'));

CREATE POLICY "Admins can view all logs" ON monitoring_logs
    FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can view own logs" ON monitoring_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Monitoring dashboards: Users can manage their own, view public ones
CREATE POLICY "Users can view accessible dashboards" ON monitoring_dashboards
    FOR SELECT USING (
        is_public = true OR 
        auth.uid() = created_by OR 
        auth.uid() = ANY(shared_with::uuid[]) OR 
        auth.jwt() ->> 'role' = 'admin'
    );

CREATE POLICY "Users can create dashboards" ON monitoring_dashboards
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own dashboards" ON monitoring_dashboards
    FOR UPDATE USING (auth.uid() = created_by OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can delete own dashboards" ON monitoring_dashboards
    FOR DELETE USING (auth.uid() = created_by OR auth.jwt() ->> 'role' = 'admin');

-- Monitoring notifications: Admins can view all
CREATE POLICY "Admins can view notifications" ON monitoring_notifications
    FOR SELECT USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Service accounts can insert notifications" ON monitoring_notifications
    FOR INSERT WITH CHECK (auth.jwt() ->> 'role' IN ('service', 'admin'));

-- Service health: Anyone authenticated can view
CREATE POLICY "Anyone can view service health" ON monitoring_service_health
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Service accounts can insert health" ON monitoring_service_health
    FOR INSERT WITH CHECK (auth.jwt() ->> 'role' IN ('service', 'admin'));

-- Alert rules: Admins can manage, users can view
CREATE POLICY "Admins can manage alert rules" ON monitoring_alert_rules
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can view alert rules" ON monitoring_alert_rules
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Downtimes: Admins can manage, users can view
CREATE POLICY "Admins can manage downtimes" ON monitoring_downtimes
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can view downtimes" ON monitoring_downtimes
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Functions for monitoring calculations

-- Function to get service uptime percentage
CREATE OR REPLACE FUNCTION get_service_uptime(
    service_name_param TEXT,
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days'
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
    total_checks INTEGER;
    healthy_checks INTEGER;
    uptime_percentage DECIMAL(5,2);
BEGIN
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'healthy')
    INTO total_checks, healthy_checks
    FROM monitoring_service_health
    WHERE service_name = service_name_param
    AND checked_at >= start_date;
    
    IF total_checks = 0 THEN
        RETURN 100.00;
    END IF;
    
    uptime_percentage := (healthy_checks::DECIMAL / total_checks::DECIMAL) * 100;
    
    RETURN ROUND(uptime_percentage, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get alert summary for a service
CREATE OR REPLACE FUNCTION get_service_alert_summary(
    service_name_param TEXT,
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '7 days'
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'totalAlerts', COUNT(*),
        'criticalAlerts', COUNT(*) FILTER (WHERE severity = 'critical'),
        'highAlerts', COUNT(*) FILTER (WHERE severity = 'high'),
        'mediumAlerts', COUNT(*) FILTER (WHERE severity = 'medium'),
        'lowAlerts', COUNT(*) FILTER (WHERE severity = 'low'),
        'activeAlerts', COUNT(*) FILTER (WHERE status = 'active'),
        'resolvedAlerts', COUNT(*) FILTER (WHERE status = 'resolved'),
        'lastAlert', MAX(created_at),
        'alertTypes', json_agg(DISTINCT type) FILTER (WHERE type IS NOT NULL)
    )
    INTO result
    FROM monitoring_alerts
    WHERE service = service_name_param
    AND created_at >= start_date;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get system metrics summary
CREATE OR REPLACE FUNCTION get_system_metrics_summary(
    start_date DATE DEFAULT CURRENT_DATE - INTERVAL '24 hours'
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'totalMetrics', COUNT(*),
        'services', json_agg(DISTINCT service_name) FILTER (WHERE service_name IS NOT NULL),
        'metricTypes', json_agg(DISTINCT metric_name) FILTER (WHERE metric_name IS NOT NULL),
        'timeRange', json_build_object(
            'start', MIN(timestamp),
            'end', MAX(timestamp)
        ),
        'averageValues', json_object_agg(
            metric_name, 
            ROUND(AVG(metric_value), 2)
        ) FILTER (WHERE metric_name IS NOT NULL)
    )
    INTO result
    FROM monitoring_metrics
    WHERE timestamp >= start_date;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old monitoring data
CREATE OR REPLACE FUNCTION cleanup_old_monitoring_data(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    cutoff_date TIMESTAMP;
BEGIN
    cutoff_date := CURRENT_TIMESTAMP - (retention_days || ' days')::INTERVAL;
    
    -- Delete old metrics
    DELETE FROM monitoring_metrics WHERE created_at < cutoff_date;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old resolved alerts (keep for longer)
    DELETE FROM monitoring_alerts 
    WHERE created_at < cutoff_date - INTERVAL '7 days'
    AND status = 'resolved';
    
    -- Delete old logs
    DELETE FROM monitoring_logs WHERE created_at < cutoff_date;
    
    -- Delete old service health records (keep recent)
    DELETE FROM monitoring_service_health 
    WHERE checked_at < cutoff_date - INTERVAL '7 days';
    
    -- Delete old notifications
    DELETE FROM monitoring_notifications 
    WHERE sent_at < cutoff_date - INTERVAL '3 days';
    
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

-- Set up realtime subscriptions for monitoring tables
ALTER publication supabase_realtime ADD TABLE monitoring_alerts;
ALTER publication supabase_realtime ADD TABLE monitoring_service_health;
ALTER publication supabase_realtime ADD TABLE monitoring_notifications;

-- Comments for documentation
COMMENT ON TABLE monitoring_metrics IS 'System and service performance metrics';
COMMENT ON TABLE monitoring_alerts IS 'System alerts and their status';
COMMENT ON TABLE monitoring_logs IS 'Application logs from all services';
COMMENT ON TABLE monitoring_dashboards IS 'Custom monitoring dashboards';
COMMENT ON TABLE monitoring_notifications IS 'Alert notifications sent to various channels';
COMMENT ON TABLE monitoring_service_health IS 'Service health check results';
COMMENT ON TABLE monitoring_alert_rules IS 'Alert rule configurations';
COMMENT ON TABLE monitoring_downtimes IS 'Planned and unplanned service downtimes';

COMMENT ON COLUMN monitoring_metrics.labels IS 'Additional metric dimensions in JSON format';
COMMENT ON COLUMN monitoring_alerts.metadata IS 'Additional alert context and data';
COMMENT ON COLUMN monitoring_logs.metadata IS 'Structured log data and context';
COMMENT ON COLUMN monitoring_dashboards.widgets IS 'Dashboard widget configurations';
COMMENT ON COLUMN monitoring_service_health.details IS 'Detailed health check results';
COMMENT ON COLUMN monitoring_service_health.dependencies IS 'Service dependency health status';
COMMENT ON COLUMN monitoring_alert_rules.metadata IS 'Additional rule configuration';
COMMENT ON COLUMN monitoring_downtimes.metadata IS 'Downtime context and details';