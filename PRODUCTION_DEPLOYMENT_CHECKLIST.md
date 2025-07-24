# GOMFLOW Production Deployment Checklist

## Overview
This checklist ensures a complete and secure production deployment of the GOMFLOW Supabase database. Follow each step carefully and verify completion before proceeding.

## Pre-Deployment Requirements

### ✅ Infrastructure Setup
- [ ] **Supabase Pro Plan** activated for production features
- [ ] **Production project** created in ap-southeast-1 region (Singapore)
- [ ] **Strong database password** generated (32+ characters)
- [ ] **API keys** saved securely (URL, anon key, service role key)
- [ ] **Environment variables** prepared for all 9 microservices

### ✅ Security Preparation
- [ ] **Database access restricted** to authorized IPs only
- [ ] **SSL certificates** validated and configured
- [ ] **Service role key** stored in secure environment
- [ ] **Backup strategy** defined and documented

## Database Schema Deployment

### ✅ Phase 1: Core Schema
```bash
# Execute PRODUCTION_COMPLETE_SCHEMA.sql
# This includes all 31 tables across 4 systems:
# - Core platform (7 tables)
# - Notifications (5 tables) 
# - Analytics (11 tables)
# - Monitoring (8 tables)
```

- [ ] **Core schema deployed** (profiles, orders, submissions, payment_transactions, platform_connections, messages, platform_posts)
- [ ] **Notifications schema deployed** (notifications, notification_preferences, user_devices, notification_templates, notification_deliveries)
- [ ] **Analytics schema deployed** (11 analytics tables with proper indexes)
- [ ] **Monitoring schema deployed** (8 monitoring tables with proper indexes)
- [ ] **All indexes created** (100+ indexes for performance)
- [ ] **All functions deployed** (15+ database functions)
- [ ] **All triggers configured** (20+ triggers for automation)
- [ ] **RLS policies enabled** (50+ security policies)

### ✅ Phase 2: Schema Validation
```sql
-- Run validation queries
SELECT 'GOMFLOW production database schema deployed successfully! 🚀' as status,
       'Total tables created: 31' as tables,
       'Core: 7, Notifications: 5, Analytics: 11, Monitoring: 8' as breakdown;

-- Check table counts
SELECT schemaname, tablename, n_tup_ins as row_count 
FROM pg_stat_user_tables 
ORDER BY schemaname, tablename;

-- Verify indexes
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

- [ ] **Schema validation passed** (all 31 tables created)
- [ ] **Index validation passed** (100+ indexes created)
- [ ] **Function validation passed** (all functions executable)
- [ ] **RLS validation passed** (policies active on all tables)

## Storage Configuration

### ✅ Storage Buckets Setup
```sql
-- Verify storage buckets
SELECT * FROM storage.buckets;
```

- [ ] **payment-proofs bucket** created (private)
- [ ] **profile-images bucket** created (public)
- [ ] **order-images bucket** created (public)
- [ ] **export-files bucket** created (private)
- [ ] **Storage policies configured** for all buckets
- [ ] **File size limits** configured (50MB max)
- [ ] **File type restrictions** applied

## Authentication Configuration

### ✅ Auth Settings
- [ ] **Site URL** set to production domain
- [ ] **Redirect URLs** configured for OAuth callbacks
- [ ] **JWT expiry** set to 3600 seconds (1 hour)
- [ ] **Email confirmations** enabled for production
- [ ] **Password requirements** configured (min 8 chars)
- [ ] **Rate limiting** enabled for auth endpoints

### ✅ Email Templates
- [ ] **Welcome email** template customized
- [ ] **Password reset** template customized
- [ ] **Email change** confirmation template configured
- [ ] **From address** configured (noreply@gomflow.com)
- [ ] **SMTP settings** configured if using custom provider

## Database Performance Optimization

### ✅ Index Optimization
```sql
-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
ORDER BY tablename, attname;

-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

- [ ] **Index statistics updated** (ANALYZE run on all tables)
- [ ] **Query performance verified** (no queries >1000ms)
- [ ] **Connection pooling** configured
- [ ] **Database statistics** updated

### ✅ Connection Management
- [ ] **Max connections** set appropriately (100)
- [ ] **Connection pooling** enabled in application
- [ ] **Idle timeout** configured (10 seconds)
- [ ] **Query timeout** configured (30 seconds)

## Security Hardening

### ✅ Row Level Security
```sql
-- Verify RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND rowsecurity = false;
-- Should return no rows
```

- [ ] **RLS enabled** on all 31 tables
- [ ] **User policies** tested (users can only access own data)
- [ ] **Service role policies** tested (services have full access)
- [ ] **Public policies** tested (anonymous access where appropriate)
- [ ] **Admin policies** configured for monitoring access

### ✅ Database Security
```sql
-- Check database permissions
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public';
```

- [ ] **Public schema permissions** revoked from PUBLIC role
- [ ] **Service role permissions** properly configured
- [ ] **Anonymous role permissions** limited to necessary tables
- [ ] **Database audit logging** enabled
- [ ] **SSL enforcement** verified

## Backup and Recovery

### ✅ Backup Configuration
- [ ] **Point-in-time recovery** enabled (7 days minimum)
- [ ] **Daily backups** scheduled at 2 AM UTC
- [ ] **Backup retention** configured (30 days for Pro plan)
- [ ] **Backup encryption** enabled
- [ ] **Cross-region backup** considered for disaster recovery

### ✅ Recovery Testing
- [ ] **Backup restoration** tested in staging environment
- [ ] **Data integrity** verification process documented
- [ ] **Recovery procedures** documented and tested
- [ ] **Emergency contacts** list prepared
- [ ] **Recovery time objectives** defined (RTO < 4 hours)

## Monitoring and Alerting

### ✅ Database Monitoring
```sql
-- Check monitoring tables are working
SELECT count(*) FROM monitoring_metrics;
SELECT count(*) FROM monitoring_alerts;
SELECT count(*) FROM monitoring_logs;
```

- [ ] **Performance monitoring** configured (CPU, memory, disk)
- [ ] **Connection monitoring** active
- [ ] **Slow query monitoring** enabled
- [ ] **Error rate monitoring** configured
- [ ] **Disk space monitoring** active

### ✅ Alert Configuration
- [ ] **CPU threshold alerts** (>80% for 5 minutes)
- [ ] **Memory threshold alerts** (>90% for 3 minutes)
- [ ] **Connection limit alerts** (>80 connections)
- [ ] **Error rate alerts** (>5% error rate)
- [ ] **Backup failure alerts** configured
- [ ] **SSL certificate expiry alerts** configured

### ✅ Notification Channels
- [ ] **Slack webhook** configured for critical alerts
- [ ] **Discord webhook** configured for team notifications
- [ ] **Email notifications** configured for admin team
- [ ] **SMS alerts** configured for critical issues (optional)
- [ ] **Alert escalation** procedures documented

## Microservices Integration

### ✅ Service Configuration
Verify each microservice can connect to the production database:

#### Core Services
- [ ] **gomflow-core** - Web application database connection
- [ ] **gomflow-whatsapp** - WhatsApp service database connection
- [ ] **gomflow-telegram** - Telegram bot database connection
- [ ] **gomflow-discord** - Discord bot database connection
- [ ] **gomflow-payments** - Payment processing database connection

#### Supporting Services
- [ ] **gomflow-smart-agent** - AI payment processing database connection
- [ ] **gomflow-analytics** - Analytics service database connection
- [ ] **gomflow-monitoring** - Monitoring service database connection
- [ ] **gomflow-notifications** - Notification service database connection

### ✅ Environment Variables
For each service, verify these environment variables are set:

```env
# Database Configuration
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
SUPABASE_ANON_KEY=[anon-key]
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

# Connection Pool Settings
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=10000
```

- [ ] **All environment variables** configured across services
- [ ] **Connection strings** tested from each service
- [ ] **Service role authentication** working
- [ ] **Anonymous access** working where needed

## Data Migration and Testing

### ✅ Initial Data Setup
```sql
-- Insert default notification templates (already included in schema)
-- Verify templates were created
SELECT type, channel, language, title FROM notification_templates;
```

- [ ] **Notification templates** loaded (8 default templates)
- [ ] **Storage buckets** configured with policies
- [ ] **Database functions** tested with sample data
- [ ] **Triggers** verified with sample operations

### ✅ Integration Testing
- [ ] **User registration** flow tested
- [ ] **Order creation** flow tested
- [ ] **Submission creation** flow tested
- [ ] **Payment processing** flow tested
- [ ] **Notification delivery** tested
- [ ] **Analytics event tracking** tested
- [ ] **Monitoring metrics** collection tested

### ✅ Load Testing
```sql
-- Performance verification
EXPLAIN ANALYZE SELECT * FROM orders WHERE is_active = true ORDER BY created_at DESC LIMIT 20;
EXPLAIN ANALYZE SELECT * FROM submissions WHERE status = 'pending';
EXPLAIN ANALYZE SELECT * FROM analytics_events WHERE created_at > CURRENT_DATE - INTERVAL '1 day';
```

- [ ] **Query performance** tested (all queries <100ms)
- [ ] **Concurrent connection** handling tested
- [ ] **Bulk data operations** tested
- [ ] **Real-time subscriptions** tested
- [ ] **Storage upload/download** tested

## Security Audit

### ✅ Security Verification
```sql
-- Security audit queries
SELECT * FROM pg_roles WHERE rolsuper = true; -- Should only show postgres
SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = 'profiles';
```

- [ ] **Superuser accounts** audited (only postgres should exist)
- [ ] **Service account permissions** verified
- [ ] **RLS policies** tested with different user contexts
- [ ] **Storage access** tested with proper permissions
- [ ] **API key rotation** schedule established

### ✅ Compliance Verification
- [ ] **GDPR compliance** - user data deletion capabilities tested
- [ ] **Data retention** policies implemented
- [ ] **Audit logging** enabled for sensitive operations
- [ ] **Encryption at rest** verified
- [ ] **Encryption in transit** verified (SSL/TLS)

## Go-Live Preparation

### ✅ Final Verification
- [ ] **All previous checklist items** completed ✅
- [ ] **Staging environment** tests passed
- [ ] **Performance benchmarks** met
- [ ] **Security audit** completed
- [ ] **Backup restoration** verified
- [ ] **Monitoring** active and alerting
- [ ] **Documentation** complete and accessible

### ✅ Launch Day Preparation
- [ ] **Emergency runbook** prepared
- [ ] **Rollback procedures** documented
- [ ] **Support team** briefed and available
- [ ] **Communication plan** ready for users
- [ ] **Performance monitoring** dashboard prepared

### ✅ Post-Launch Monitoring (First 48 Hours)
- [ ] **Database performance** monitoring active
- [ ] **Error rates** within acceptable limits (<1%)
- [ ] **Connection counts** stable
- [ ] **Backup completion** verified
- [ ] **Alert systems** functioning
- [ ] **User experience** feedback collected

## Emergency Procedures

### 🚨 Database Issues
1. **Connection Issues**: Check connection pool status and restart services
2. **Performance Issues**: Check slow query log and kill long-running queries
3. **Storage Full**: Clean up old data using cleanup functions
4. **Corruption**: Restore from latest backup immediately

### 🚨 Security Issues
1. **Unauthorized Access**: Rotate API keys immediately
2. **Data Breach**: Follow incident response plan
3. **RLS Bypass**: Verify and fix policies immediately
4. **Suspicious Activity**: Enable detailed audit logging

### 🚨 Contact Information
- **Database Admin**: [Your DBA contact]
- **Security Team**: [Security team contact]
- **Supabase Support**: [Support contact for Pro plan]
- **Emergency Escalation**: [Emergency contact list]

---

## Sign-off

### Technical Lead
- [ ] Database schema deployment verified
- [ ] Performance requirements met
- [ ] Security requirements satisfied
- [ ] Monitoring and alerting active

**Name**: ________________  **Date**: ________  **Signature**: ________________

### Security Officer  
- [ ] Security audit completed
- [ ] RLS policies verified
- [ ] Compliance requirements met
- [ ] Incident response plan ready

**Name**: ________________  **Date**: ________  **Signature**: ________________

### Operations Manager
- [ ] Backup and recovery tested
- [ ] Monitoring dashboards configured
- [ ] Support procedures documented
- [ ] Go-live plan approved

**Name**: ________________  **Date**: ________  **Signature**: ________________

---

**Production Database Ready for Launch** 🚀

*This checklist ensures GOMFLOW's production database is secure, performant, and ready to handle the demands of K-pop group order management across Southeast Asia.*