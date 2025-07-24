# 🚀 GOMFLOW Core API - Production Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the GOMFLOW Core API to production on Vercel. The deployment includes database setup, environment configuration, security hardening, monitoring, and performance optimization.

## 📋 Prerequisites

### Required Accounts & Services
- [x] **Vercel Account** (Pro plan recommended for production features)
- [x] **Supabase Account** (Pro plan for production database)
- [x] **GitHub Repository** with GOMFLOW Core code
- [x] **Domain Name** (e.g., gomflow.com)
- [x] **SSL Certificate** (managed by Vercel)

### Optional Monitoring Services
- [ ] **Sentry Account** (for error tracking)
- [ ] **DataDog Account** (for performance monitoring)
- [ ] **Slack Workspace** (for alerts)
- [ ] **Discord Server** (for notifications)

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Users/Buyers  │◄──►│   Vercel CDN     │◄──►│  GOMFLOW Core   │
│   (Global)      │    │  (Global Edge)   │    │  (Singapore)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                 │                         │
                                 ▼                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Static Assets  │    │   API Routes     │    │  Supabase DB    │
│  (Edge Cache)   │    │  (Serverless)    │    │  (Singapore)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                 │
                                 ▼
                       ┌──────────────────┐
                       │   Microservices  │
                       │   (Railway)      │
                       └──────────────────┘
```

## 🔧 Step 1: Database Setup

### 1.1 Create Supabase Production Project

1. **Go to [Supabase Dashboard](https://supabase.com/dashboard)**
2. **Create New Project**:
   - Organization: Your organization
   - Name: `gomflow-production`
   - Database Password: Generate strong password (save securely)
   - Region: `ap-southeast-1` (Singapore)
   - Plan: **Pro** (required for production features)

3. **Configure Project Settings**:
   - Enable Point-in-time Recovery
   - Configure Daily Backups (2 AM UTC)
   - Set Connection Pooling (max 20 connections)

### 1.2 Deploy Database Schema

1. **Navigate to SQL Editor** in Supabase Dashboard
2. **Execute Production Schema**:
   ```sql
   -- Copy and execute the complete schema from:
   -- /Users/emily-gryfyn/Documents/gomflow/PRODUCTION_COMPLETE_SCHEMA.sql
   ```

3. **Verify Schema Deployment**:
   ```sql
   SELECT 'GOMFLOW production database schema deployed successfully! 🚀' as status,
          'Total tables created: 31' as tables,
          'Core: 7, Notifications: 5, Analytics: 11, Monitoring: 8' as breakdown;
   ```

### 1.3 Configure Storage Buckets

1. **Go to Storage** in Supabase Dashboard
2. **Create Required Buckets**:
   - `payment-proofs` (Private)
   - `profile-images` (Public)  
   - `order-images` (Public)
   - `export-files` (Private)

3. **Configure Storage Policies** for each bucket based on RLS requirements

## 🌐 Step 2: Domain & DNS Setup

### 2.1 Configure Domain

1. **Purchase Domain** (e.g., gomflow.com) from registrar
2. **Configure DNS Records**:
   ```
   Type    Name    Value                    TTL
   A       @       76.76.19.19             300
   CNAME   www     cname.vercel-dns.com    300
   ```

### 2.2 SSL Certificate

- Vercel automatically provisions and renews SSL certificates
- Certificate will be ready within 24 hours of DNS configuration

## 🔐 Step 3: Environment Variables Configuration

### 3.1 Core Environment Variables

Copy from the production template and fill in real values:

```bash
# Application Configuration
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://gomflow.com
NEXT_PUBLIC_APP_NAME=GOMFLOW
NEXT_PUBLIC_APP_VERSION=1.0.0
NEXT_PUBLIC_ENVIRONMENT=production

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]

# Security
INTERNAL_SERVICE_KEY=[generate-256-bit-key]
JWT_SECRET=[generate-256-bit-key]
NEXTAUTH_SECRET=[generate-256-bit-key]

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
ALLOWED_ORIGINS=https://gomflow.com,https://www.gomflow.com
```

### 3.2 Microservice URLs

```bash
# Microservice Endpoints (update with actual Railway URLs)
WHATSAPP_SERVICE_URL=https://gomflow-whatsapp.railway.app
TELEGRAM_SERVICE_URL=https://gomflow-telegram.railway.app  
DISCORD_SERVICE_URL=https://gomflow-discord.railway.app
PAYMENT_SERVICE_URL=https://gomflow-payments.railway.app
SMART_AGENT_SERVICE_URL=https://gomflow-smart-agent.railway.app
ANALYTICS_SERVICE_URL=https://gomflow-analytics.railway.app
MONITORING_SERVICE_URL=https://gomflow-monitoring.railway.app
```

### 3.3 Payment Gateway Configuration

```bash
# PayMongo (Philippines) - Live Keys
PAYMONGO_SECRET_KEY=sk_live_[your-live-secret-key]
PAYMONGO_PUBLIC_KEY=pk_live_[your-live-public-key]
PAYMONGO_WEBHOOK_SECRET=[your-webhook-secret]

# Billplz (Malaysia) - Live Keys
BILLPLZ_API_KEY=[your-live-api-key]
BILLPLZ_COLLECTION_ID=[your-collection-id]
BILLPLZ_X_SIGNATURE_KEY=[your-signature-key]
```

### 3.4 Monitoring & Analytics

```bash
# Sentry Error Tracking
SENTRY_DSN=https://[your-sentry-dsn]
SENTRY_ORG=[your-sentry-org]
SENTRY_PROJECT=gomflow-core

# DataDog Performance Monitoring
DATADOG_API_KEY=[your-datadog-api-key]

# Vercel Analytics
VERCEL_ANALYTICS_ID=[your-analytics-id]

# Alert Webhooks
SLACK_WEBHOOK_URL=[your-slack-webhook]
DISCORD_WEBHOOK_URL=[your-discord-webhook]
```

## 🚀 Step 4: Vercel Deployment

### 4.1 Connect Repository

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**
2. **Import Project**:
   - Connect GitHub account
   - Select GOMFLOW repository
   - Choose `gomflow-core` as root directory

### 4.2 Configure Build Settings

1. **Framework Preset**: Next.js
2. **Build Command**: `npm run build`
3. **Output Directory**: `.next`
4. **Install Command**: `npm ci --only=production`
5. **Root Directory**: `gomflow-core`

### 4.3 Production Configuration

1. **Upload Production Vercel Config**:
   ```bash
   # Use the production configuration
   cp vercel.production.json vercel.json
   ```

2. **Configure Environment Variables** in Vercel Dashboard:
   - Go to Project Settings → Environment Variables
   - Add all variables from Step 3
   - Set Environment: **Production**

### 4.4 Custom Domain Configuration

1. **Go to Project Settings → Domains**
2. **Add Domain**: `gomflow.com`
3. **Add Domain**: `www.gomflow.com` (redirect to main domain)
4. **Verify DNS Configuration**

## 🔒 Step 5: Security Hardening

### 5.1 Environment Security

1. **Verify Environment Variables**:
   - No secrets in public variables
   - All sensitive keys in Production environment only
   - Remove or disable demo/development variables

2. **API Key Rotation Schedule**:
   - Database keys: Every 90 days
   - Payment gateway keys: Every 180 days  
   - Service keys: Every 30 days

### 5.2 Database Security

1. **Enable Row Level Security** on all tables
2. **Configure Service Role** permissions properly
3. **Set up Database Auditing**
4. **Enable Connection Encryption**

### 5.3 Network Security

1. **Configure CORS** for production domains only
2. **Enable Rate Limiting** with production limits
3. **Set up DDoS Protection** via Vercel
4. **Configure Security Headers** (already in middleware)

## 📊 Step 6: Monitoring & Observability

### 6.1 Error Tracking Setup

1. **Sentry Configuration**:
   - Create new Sentry project
   - Configure error filtering
   - Set up alert rules
   - Integrate with Slack/Discord

2. **Custom Error Monitoring**:
   - Database error logging enabled
   - API error tracking active
   - Business logic error handling

### 6.2 Performance Monitoring

1. **Vercel Analytics**:
   - Enable in project settings
   - Configure performance budgets
   - Set up alert thresholds

2. **Custom Metrics**:
   - Request duration tracking
   - Database query performance
   - API response times
   - Memory usage monitoring

### 6.3 Business Intelligence

1. **Order Analytics**:
   - Order creation tracking
   - Payment conversion rates
   - User engagement metrics
   - Platform usage statistics

2. **Performance Dashboards**:
   - Real-time order processing
   - Payment success rates
   - Platform health status
   - User activity patterns

## 🔄 Step 7: CI/CD Pipeline

### 7.1 Automatic Deployments

Vercel automatically deploys on:
- **Production**: Pushes to `main` branch
- **Preview**: Pull requests and feature branches

### 7.2 Deployment Checks

Before each deployment:
1. **TypeScript Compilation** ✅
2. **ESLint Code Quality** ✅
3. **Unit Tests** ✅
4. **Build Success** ✅
5. **Environment Validation** ✅

### 7.3 Post-Deployment Validation

After each deployment:
1. **Health Check** endpoint verification
2. **Database Connection** validation
3. **External Service** connectivity
4. **Critical Path** testing

## 📈 Step 8: Performance Optimization

### 8.1 Edge Caching

```javascript
// Optimized cache headers by route type:
- Static assets: 1 year cache
- API responses: No cache
- Dashboard data: 60s cache with SWR
- Public data: 5min cache with SWR
```

### 8.2 Image Optimization

1. **Next.js Image Component** for automatic optimization
2. **WebP/AVIF Support** for modern browsers
3. **Responsive Images** with proper sizing
4. **Lazy Loading** for below-fold images

### 8.3 Bundle Optimization

1. **Code Splitting** by route and component
2. **Tree Shaking** for unused code elimination
3. **Dynamic Imports** for heavy dependencies
4. **Bundle Analysis** with `ANALYZE=true npm run build`

## 🧪 Step 9: Testing in Production

### 9.1 Smoke Tests

```bash
# Health check
curl https://gomflow.com/api/health

# User registration flow
curl -X POST https://gomflow.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Order creation
curl -X POST https://gomflow.com/api/orders \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Order","price":100,"currency":"PHP"}'
```

### 9.2 Performance Validation

1. **Core Web Vitals**:
   - LCP (Largest Contentful Paint): < 2.5s
   - FID (First Input Delay): < 100ms  
   - CLS (Cumulative Layout Shift): < 0.1

2. **API Performance**:
   - Average response time: < 300ms
   - 95th percentile: < 1000ms
   - Error rate: < 1%

### 9.3 Load Testing

```bash
# Use tools like Artillery or k6 for load testing
npm install -g artillery

# Test order creation endpoint
artillery quick --count 100 --num 10 https://gomflow.com/api/orders
```

## 🚨 Step 10: Incident Management

### 10.1 Monitoring Alerts

**Critical Alerts** (Immediate Response):
- API error rate > 5%
- Database connection failures
- Payment gateway errors
- Site downtime

**Warning Alerts** (Next Business Day):
- Slow API responses (> 2s)
- High memory usage (> 80%)
- Storage quota warnings
- SSL certificate expiry (< 30 days)

### 10.2 Escalation Procedures

1. **Severity 1** (Critical): 
   - Immediate Slack/Discord notification
   - SMS to on-call engineer
   - Email to management team

2. **Severity 2** (High):
   - Slack notification
   - Email to engineering team

3. **Severity 3** (Medium):
   - Daily digest email

### 10.3 Rollback Procedures

**Automatic Rollback Triggers**:
- Build failure
- Health check failure (> 3 consecutive failures)
- Critical error rate spike (> 10% in 5 minutes)

**Manual Rollback**:
```bash
# Rollback to previous deployment
vercel rollback [deployment-url]

# Or redeploy specific commit
vercel --prod --force
```

## 📚 Step 11: Documentation & Training

### 11.1 Operations Runbook

1. **Daily Operations**:
   - Monitor dashboard checks
   - Review error logs
   - Validate backup completion

2. **Weekly Operations**:
   - Performance review
   - Security audit
   - Capacity planning review

3. **Monthly Operations**:
   - Dependency updates
   - Security patch reviews
   - Disaster recovery testing

### 11.2 Team Training

1. **Development Team**:
   - Production deployment process
   - Monitoring and alerting systems
   - Incident response procedures

2. **Operations Team**:
   - System architecture overview
   - Database management
   - Performance optimization techniques

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Production database schema deployed and verified
- [ ] All environment variables configured and tested
- [ ] Domain DNS configured and propagated
- [ ] SSL certificate provisioned
- [ ] Monitoring services configured
- [ ] Alert channels tested
- [ ] Backup procedures validated

### Deployment
- [ ] Code deployed to production
- [ ] Health checks passing
- [ ] Database connectivity verified
- [ ] External service integrations working
- [ ] File upload functionality tested
- [ ] Authentication flows working
- [ ] Payment processing tested (with test transactions)

### Post-Deployment
- [ ] Performance metrics within acceptable ranges
- [ ] Error rates below thresholds
- [ ] User acceptance testing completed
- [ ] Team notified of successful deployment
- [ ] Documentation updated
- [ ] Monitoring dashboards reviewed

## 🔗 Important URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Production Site** | https://gomflow.com | Main application |
| **Vercel Dashboard** | https://vercel.com/dashboard | Deployment management |
| **Supabase Dashboard** | https://supabase.com/dashboard | Database management |
| **Health Check** | https://gomflow.com/api/health | System status |
| **Sentry** | https://sentry.io | Error tracking |
| **Status Page** | https://status.gomflow.com | Public status |

## 📞 Emergency Contacts

| Role | Contact | Availability |
|------|---------|--------------|
| **Technical Lead** | emily@gomflow.com | M-F 9AM-6PM GMT+8 |
| **DevOps Engineer** | devops@gomflow.com | On-call rotation |
| **Security Officer** | security@gomflow.com | Emergency escalation |
| **Database Admin** | dba@gomflow.com | Critical issues only |

## 🎯 Success Metrics

### Technical KPIs
- **Uptime**: 99.9% (< 8.77 hours downtime/year)
- **Response Time**: 95th percentile < 1000ms
- **Error Rate**: < 1% of all requests
- **Build Success Rate**: > 98%

### Business KPIs  
- **Order Success Rate**: > 95%
- **Payment Success Rate**: > 98%
- **User Satisfaction**: > 4.5/5 stars
- **Platform Adoption**: Growing user base

---

## 🚀 Ready for Production!

Once you've completed all steps in this guide, your GOMFLOW Core API will be:

✅ **Secure** - Enterprise-grade security headers and authentication
✅ **Scalable** - Auto-scaling serverless architecture  
✅ **Monitored** - Comprehensive error tracking and performance monitoring
✅ **Optimized** - Edge caching and performance optimizations
✅ **Reliable** - Health checks, backups, and incident management

**Next Steps:**
1. Deploy microservices (WhatsApp, Telegram, Discord, Payments, Smart Agent)
2. Set up mobile app deployments (iOS/Android)
3. Configure marketing analytics and user tracking
4. Launch beta user program for Southeast Asian GOMs

---

*This guide was last updated: January 23, 2025*  
*Version: 1.0.0*  
*Contact: emily@gomflow.com for questions*