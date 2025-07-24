-- ============================================================================
-- GOMFLOW DATABASE RESET AND CLEAN DEPLOYMENT
-- This script safely resets the database and deploys fresh schema
-- ============================================================================

-- First, drop all existing GOMFLOW-related objects if they exist
-- This ensures a clean slate for deployment

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS monitoring_downtimes CASCADE;
DROP TABLE IF EXISTS monitoring_alert_rules CASCADE;
DROP TABLE IF EXISTS monitoring_notifications CASCADE;
DROP TABLE IF EXISTS monitoring_dashboards CASCADE;
DROP TABLE IF EXISTS monitoring_logs CASCADE;
DROP TABLE IF EXISTS monitoring_alerts CASCADE;
DROP TABLE IF EXISTS monitoring_service_health CASCADE;
DROP TABLE IF EXISTS monitoring_metrics CASCADE;

DROP TABLE IF EXISTS analytics_ab_tests CASCADE;
DROP TABLE IF EXISTS analytics_segments CASCADE;
DROP TABLE IF EXISTS analytics_cohorts CASCADE;
DROP TABLE IF EXISTS analytics_funnels CASCADE;
DROP TABLE IF EXISTS analytics_user_sessions CASCADE;
DROP TABLE IF EXISTS analytics_dashboards CASCADE;
DROP TABLE IF EXISTS analytics_export_jobs CASCADE;
DROP TABLE IF EXISTS analytics_alerts CASCADE;
DROP TABLE IF EXISTS analytics_reports CASCADE;
DROP TABLE IF EXISTS analytics_aggregations CASCADE;
DROP TABLE IF EXISTS analytics_events CASCADE;

DROP TABLE IF EXISTS notification_deliveries CASCADE;
DROP TABLE IF EXISTS notification_templates CASCADE;
DROP TABLE IF EXISTS user_devices CASCADE;
DROP TABLE IF EXISTS notification_preferences CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;

DROP TABLE IF EXISTS platform_posts CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS platform_connections CASCADE;
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop custom types if they exist
DROP TYPE IF EXISTS post_status CASCADE;
DROP TYPE IF EXISTS connection_type CASCADE;
DROP TYPE IF EXISTS payment_gateway CASCADE;
DROP TYPE IF EXISTS message_status CASCADE;
DROP TYPE IF EXISTS message_type CASCADE;
DROP TYPE IF EXISTS platform_type CASCADE;
DROP TYPE IF EXISTS submission_status CASCADE;
DROP TYPE IF EXISTS currency_code CASCADE;
DROP TYPE IF EXISTS country_code CASCADE;
DROP TYPE IF EXISTS subscription_status CASCADE;
DROP TYPE IF EXISTS user_plan CASCADE;

-- Drop custom functions if they exist
DROP FUNCTION IF EXISTS cleanup_old_notifications() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_analytics_data(integer) CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_monitoring_data(integer) CASCADE;
DROP FUNCTION IF EXISTS create_default_notification_preferences() CASCADE;
DROP FUNCTION IF EXISTS database_health_check() CASCADE;
DROP FUNCTION IF EXISTS verify_backup_integrity() CASCADE;
DROP FUNCTION IF EXISTS cleanup_old_data() CASCADE;

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS trigger_create_notification_preferences ON profiles;
DROP TRIGGER IF EXISTS trigger_create_notification_preferences ON auth.users;

-- Remove any existing storage buckets and policies (will be recreated)
DELETE FROM storage.objects WHERE bucket_id IN ('payment-proofs', 'profile-images', 'order-images', 'export-files');
DELETE FROM storage.buckets WHERE id IN ('payment-proofs', 'profile-images', 'order-images', 'export-files');

-- Drop any RLS policies that might exist
-- (These will be recreated with the schema)

-- Clean up any existing views
DROP VIEW IF EXISTS slow_queries CASCADE;
DROP VIEW IF EXISTS connection_stats CASCADE;

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- For query monitoring

SELECT 'Database cleaned successfully! Ready for fresh schema deployment.' as status;

-- ============================================================================
-- NOW EXECUTE THE COMPLETE SCHEMA FROM PRODUCTION_COMPLETE_SCHEMA.sql
-- ============================================================================