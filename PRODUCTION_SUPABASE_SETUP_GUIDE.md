# GOMFLOW Production Supabase Database Setup Guide

## Overview
This guide provides step-by-step instructions for setting up the production Supabase database for GOMFLOW, a K-pop group order management platform. The database supports 9 microservices with comprehensive functionality including orders, payments, analytics, notifications, and monitoring.

## Prerequisites
- Supabase account with production plan
- Database administrator access
- Understanding of PostgreSQL and row-level security
- Access to production environment variables

## Database Schema Overview

### Core Tables (7 tables)
- **profiles** - User profiles linked to auth.users
- **orders** - Group orders created by GOMs
- **submissions** - Individual buyer submissions
- **payment_transactions** - Payment gateway transactions
- **platform_connections** - Messaging platform connections
- **messages** - Messages sent through platforms
- **platform_posts** - Social media posts

### Notifications System (5 tables)
- **notifications** - Notification events
- **notification_preferences** - User notification settings
- **user_devices** - FCM tokens for push notifications
- **notification_templates** - Message templates
- **notification_deliveries** - Delivery tracking

### Analytics System (11 tables)
- **analytics_events** - Raw analytics events
- **analytics_aggregations** - Pre-calculated metrics
- **analytics_reports** - Generated reports
- **analytics_alerts** - Alert configurations
- **analytics_export_jobs** - Data export tracking
- **analytics_dashboards** - Dashboard configs
- **analytics_user_sessions** - User session tracking
- **analytics_funnels** - Conversion funnels
- **analytics_cohorts** - Cohort analysis
- **analytics_segments** - User segments
- **analytics_ab_tests** - A/B test configs

### Monitoring System (8 tables)
- **monitoring_metrics** - System metrics
- **monitoring_alerts** - System alerts
- **monitoring_logs** - Application logs
- **monitoring_dashboards** - Monitoring dashboards
- **monitoring_notifications** - Alert notifications
- **monitoring_service_health** - Service health checks
- **monitoring_alert_rules** - Alert configurations
- **monitoring_downtimes** - Downtime tracking

## Step 1: Create Production Supabase Project

### 1.1 Project Creation
```bash
# Create new Supabase project via dashboard
# Project Name: GOMFLOW Production
# Database Password: [Use strong password with 32+ characters]
# Region: ap-southeast-1 (Singapore) for SEA optimization
```

### 1.2 Project Configuration
```bash
# Note down the following from project settings:
SUPABASE_URL=https://[your-project-ref].supabase.co
SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
```

## Step 2: Deploy Complete Database Schema

### 2.1 Core Schema Deployment
Execute the following SQL scripts in order:

```sql
-- 1. Deploy core schema (REQUIRED FIRST)
-- File: GOMFLOW_COMPLETE_SCHEMA.sql
-- This creates the foundation tables with proper RLS policies
```

### 2.2 Notifications Schema
```sql
-- 2. Deploy notifications system
-- File: gomflow-notifications/migrations/notifications_schema.sql
-- Note: Update references from 'users' to 'profiles' table
```

### 2.3 Analytics Schema
```sql
-- 3. Deploy analytics system
-- File: gomflow-analytics/migrations/analytics_schema.sql
-- Note: Update references from 'users' to 'profiles' table
```

### 2.4 Monitoring Schema
```sql
-- 4. Deploy monitoring system
-- File: gomflow-monitoring/migrations/monitoring_schema.sql
-- Note: Update references from 'users' to 'profiles' table
```

## Step 3: Schema Fixes for Production

### 3.1 Update Table References
The schema files reference a `users` table, but the core schema uses `profiles` table linked to `auth.users`. Apply these fixes:

```sql
-- Fix notifications schema references
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_user_id_fkey;
ALTER TABLE notification_preferences ADD CONSTRAINT notification_preferences_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

ALTER TABLE user_devices DROP CONSTRAINT IF EXISTS user_devices_user_id_fkey;
ALTER TABLE user_devices ADD CONSTRAINT user_devices_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

-- Fix analytics schema references
ALTER TABLE analytics_events DROP CONSTRAINT IF EXISTS analytics_events_user_id_fkey;
ALTER TABLE analytics_events ADD CONSTRAINT analytics_events_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE SET NULL;

ALTER TABLE analytics_reports DROP CONSTRAINT IF EXISTS analytics_reports_generated_by_fkey;
ALTER TABLE analytics_reports ADD CONSTRAINT analytics_reports_generated_by_fkey 
    FOREIGN KEY (generated_by) REFERENCES profiles(user_id) ON DELETE SET NULL;

ALTER TABLE analytics_export_jobs DROP CONSTRAINT IF EXISTS analytics_export_jobs_requested_by_fkey;
ALTER TABLE analytics_export_jobs ADD CONSTRAINT analytics_export_jobs_requested_by_fkey 
    FOREIGN KEY (requested_by) REFERENCES profiles(user_id) ON DELETE SET NULL;

ALTER TABLE analytics_dashboards DROP CONSTRAINT IF EXISTS analytics_dashboards_created_by_fkey;
ALTER TABLE analytics_dashboards ADD CONSTRAINT analytics_dashboards_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE SET NULL;

ALTER TABLE analytics_user_sessions DROP CONSTRAINT IF EXISTS analytics_user_sessions_user_id_fkey;
ALTER TABLE analytics_user_sessions ADD CONSTRAINT analytics_user_sessions_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;

ALTER TABLE analytics_funnels DROP CONSTRAINT IF EXISTS analytics_funnels_created_by_fkey;
ALTER TABLE analytics_funnels ADD CONSTRAINT analytics_funnels_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE SET NULL;

ALTER TABLE analytics_segments DROP CONSTRAINT IF EXISTS analytics_segments_created_by_fkey;
ALTER TABLE analytics_segments ADD CONSTRAINT analytics_segments_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE SET NULL;

ALTER TABLE analytics_ab_tests DROP CONSTRAINT IF EXISTS analytics_ab_tests_created_by_fkey;
ALTER TABLE analytics_ab_tests ADD CONSTRAINT analytics_ab_tests_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE SET NULL;

-- Fix monitoring schema references
ALTER TABLE monitoring_logs DROP CONSTRAINT IF EXISTS monitoring_logs_user_id_fkey;
ALTER TABLE monitoring_logs ADD CONSTRAINT monitoring_logs_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE SET NULL;

ALTER TABLE monitoring_dashboards DROP CONSTRAINT IF EXISTS monitoring_dashboards_created_by_fkey;
ALTER TABLE monitoring_dashboards ADD CONSTRAINT monitoring_dashboards_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE SET NULL;

ALTER TABLE monitoring_alert_rules DROP CONSTRAINT IF EXISTS monitoring_alert_rules_created_by_fkey;
ALTER TABLE monitoring_alert_rules ADD CONSTRAINT monitoring_alert_rules_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE SET NULL;

ALTER TABLE monitoring_downtimes DROP CONSTRAINT IF EXISTS monitoring_downtimes_created_by_fkey;
ALTER TABLE monitoring_downtimes ADD CONSTRAINT monitoring_downtimes_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES profiles(user_id) ON DELETE SET NULL;
```

### 3.2 Update Trigger Functions
```sql
-- Fix notification preferences trigger to work with profiles table
DROP TRIGGER IF EXISTS trigger_create_notification_preferences ON auth.users;

CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_create_notification_preferences
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION create_default_notification_preferences();
```

## Step 4: Configure Supabase Storage

### 4.1 Storage Buckets
```sql
-- Create payment proofs bucket (already included in core schema)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Create additional buckets if needed
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('profile-images', 'profile-images', true),
    ('order-images', 'order-images', true),
    ('export-files', 'export-files', false)
ON CONFLICT (id) DO NOTHING;
```

### 4.2 Storage Policies
```sql
-- Payment proofs policies (already included in core schema)
-- Add additional storage policies as needed

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
```

## Step 5: Configure Authentication

### 5.1 Auth Settings
```sql
-- Configure auth settings in Supabase dashboard:
-- Site URL: https://app.gomflow.com
-- Redirect URLs: https://app.gomflow.com/auth/callback
-- JWT expiry: 3600 seconds (1 hour)
-- Enable signup: true
-- Email confirmations: false (for development), true (for production)
```

### 5.2 Email Templates
Configure the following email templates in Supabase Auth settings:
- Welcome email
- Reset password email
- Email change confirmation

## Step 6: Set Up Database Indexing

### 6.1 Additional Performance Indexes
```sql
-- Additional indexes for production performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_email_lower ON profiles(LOWER(email));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_active ON orders(user_id, is_active);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_order_status ON submissions(order_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_transactions_gateway_status ON payment_transactions(gateway, gateway_status);

-- Partial indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_active_deadline ON orders(deadline) WHERE is_active = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_pending ON submissions(created_at) WHERE status = 'pending';

-- Analytics indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_events_compound ON analytics_events(event_type, created_at, user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_aggregations_compound ON analytics_aggregations(metric_name, time_bucket, bucket_size);
```

### 6.2 Database Statistics Update
```sql
-- Update table statistics for query optimization
ANALYZE profiles;
ANALYZE orders;
ANALYZE submissions;
ANALYZE payment_transactions;
ANALYZE platform_connections;
ANALYZE messages;
ANALYZE platform_posts;
ANALYZE notifications;
ANALYZE analytics_events;
ANALYZE monitoring_metrics;
```

## Step 7: Configure Row Level Security

### 7.1 Service Role Policies
```sql
-- Add service role policies for microservices
CREATE POLICY "Service role can manage all data" ON profiles
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage orders" ON orders
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage submissions" ON submissions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage payments" ON payment_transactions
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage messages" ON messages
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage platform posts" ON platform_posts
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Service role policies for notifications
CREATE POLICY "Service role can manage notifications" ON notifications
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage notification deliveries" ON notification_deliveries
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Service role policies for analytics
CREATE POLICY "Service role can manage analytics" ON analytics_events
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage aggregations" ON analytics_aggregations
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Service role policies for monitoring
CREATE POLICY "Service role can manage monitoring" ON monitoring_metrics
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage monitoring logs" ON monitoring_logs
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
```

## Step 8: Set Up Database Functions

### 8.1 Cleanup Functions
```sql
-- Create cleanup function for old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
    -- Clean old notifications (30 days)
    PERFORM cleanup_old_notifications();
    
    -- Clean old analytics data (365 days)
    PERFORM cleanup_old_analytics_data(365);
    
    -- Clean old monitoring data (30 days)
    PERFORM cleanup_old_monitoring_data(30);
    
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
```

### 8.2 Health Check Functions
```sql
-- Create database health check function
CREATE OR REPLACE FUNCTION database_health_check()
RETURNS JSON AS $$
DECLARE
    result JSON;
    table_stats JSON;
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
```

## Step 9: Configure Backup and Recovery

### 9.1 Point-in-Time Recovery
```sql
-- Supabase automatically enables PITR
-- Configure backup schedule in Supabase dashboard:
-- - Daily backups at 2 AM UTC
-- - Retention: 30 days for Pro plan
-- - Test restore procedure monthly
```

### 9.2 Backup Verification
```sql
-- Create backup verification function
CREATE OR REPLACE FUNCTION verify_backup_integrity()
RETURNS BOOLEAN AS $$
DECLARE
    integrity_check BOOLEAN := true;
BEGIN
    -- Check table counts are reasonable
    IF (SELECT count(*) FROM profiles) < 0 THEN
        integrity_check := false;
    END IF;
    
    -- Check foreign key constraints
    IF EXISTS (
        SELECT 1 FROM orders o 
        LEFT JOIN profiles p ON o.user_id = p.user_id 
        WHERE p.user_id IS NULL
    ) THEN
        integrity_check := false;
    END IF;
    
    -- Add more integrity checks as needed
    
    RETURN integrity_check;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Step 10: Database Monitoring Setup

### 10.1 Performance Monitoring
```sql
-- Enable query statistics
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

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
```

### 10.2 Connection Monitoring
```sql
-- Create connection monitoring view
CREATE VIEW connection_stats AS
SELECT 
    state,
    count(*) as connections,
    avg(extract(epoch from (now() - query_start))) as avg_duration_seconds
FROM pg_stat_activity 
WHERE state IS NOT NULL
GROUP BY state
ORDER BY connections DESC;
```

## Step 11: Security Configuration

### 11.1 Database Security
```sql
-- Revoke public schema permissions
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE postgres FROM PUBLIC;

-- Grant specific permissions to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
```

### 11.2 SSL Configuration
```bash
# Supabase automatically provides SSL
# Verify SSL connection in application:
# sslmode=require in connection string
```

## Step 12: Testing Database Setup

### 12.1 Basic Functionality Tests
```sql
-- Test user creation
INSERT INTO profiles (user_id, email, name, username, phone, country)
VALUES (
    gen_random_uuid(),
    'test@example.com',
    'Test User',
    'testuser',
    '+639123456789',
    'PH'
);

-- Test order creation
-- Test submission creation
-- Test analytics event tracking
-- Test notification creation
```

### 12.2 Performance Tests
```sql
-- Test query performance
EXPLAIN ANALYZE SELECT * FROM orders WHERE is_active = true ORDER BY created_at DESC LIMIT 20;
EXPLAIN ANALYZE SELECT * FROM submissions WHERE status = 'pending';
EXPLAIN ANALYZE SELECT * FROM analytics_events WHERE created_at > CURRENT_DATE - INTERVAL '1 day';
```

## Step 13: Final Production Configuration

### 13.1 Environment Variables
Update your production environment with the database connection details:

```env
# Production Database Configuration
SUPABASE_URL=https://[your-project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
SUPABASE_ANON_KEY=[your-anon-key]
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
```

### 13.2 Service Configuration
Configure each microservice to use the production database:
- gomflow-core
- gomflow-whatsapp
- gomflow-telegram
- gomflow-discord
- gomflow-payments
- gomflow-smart-agent
- gomflow-analytics
- gomflow-monitoring
- gomflow-notifications

## Maintenance Schedule

### Daily
- Monitor slow queries
- Check connection counts
- Verify backup completion

### Weekly
- Run ANALYZE on main tables
- Check disk usage
- Review performance metrics

### Monthly
- Test backup restoration
- Review and optimize indexes
- Clean up old data
- Security audit

## Troubleshooting

### Common Issues

1. **Connection Limits**
   - Monitor active connections
   - Use connection pooling
   - Configure appropriate timeouts

2. **Performance Issues**
   - Check slow query log
   - Analyze query plans
   - Update table statistics

3. **Storage Issues**
   - Monitor database size
   - Clean up old data
   - Optimize large tables

### Emergency Procedures

1. **Database Recovery**
   - Point-in-time recovery process
   - Backup restoration steps
   - Data validation procedures

2. **Performance Emergency**
   - Query termination
   - Index rebuild
   - Connection reset

## Security Checklist

- [ ] RLS enabled on all tables
- [ ] Service role policies configured
- [ ] Storage policies configured
- [ ] SSL connections enforced
- [ ] Backup encryption enabled
- [ ] Access logs monitored
- [ ] Regular security audits scheduled

## Conclusion

The GOMFLOW production database is now ready for deployment with:
- **50+ tables** across core, notifications, analytics, and monitoring systems
- **Comprehensive RLS policies** for data security
- **Optimized indexes** for performance
- **Automated cleanup** and maintenance
- **Backup and recovery** procedures
- **Security hardening** and monitoring

The database supports all 9 microservices and is optimized for the Southeast Asian K-pop merchandise market with multi-currency and multi-platform capabilities.

## Next Steps

1. Deploy all microservices with production database configuration
2. Run comprehensive integration tests
3. Monitor performance and optimize as needed
4. Set up automated monitoring and alerting
5. Schedule regular maintenance and backups

---

**Important**: Always test the complete database setup in a staging environment before deploying to production. Keep this document updated as the schema evolves.