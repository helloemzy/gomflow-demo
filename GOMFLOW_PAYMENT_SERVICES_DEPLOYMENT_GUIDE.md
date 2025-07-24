# GOMFLOW Payment Gateway and Smart Agent Services - Railway Deployment Guide

## Executive Summary

This guide provides comprehensive instructions for deploying the critical GOMFLOW payment processing services to Railway. These services enable the core value proposition of automated payment tracking, reducing manual processing from 20 hours to 10 minutes.

**Services to Deploy:**
- **gomflow-payments** (Port 3004): Payment gateway service handling PayMongo/Billplz webhooks
- **gomflow-smart-agent** (Port 3005): AI service for payment proof processing with OCR + GPT-4

## Current Service Architecture Analysis

### gomflow-payments Service Structure
```
gomflow-payments/
├── src/
│   ├── config/index.ts           # Configuration with Zod validation
│   ├── controllers/
│   │   ├── paymentController.ts  # Payment creation/management
│   │   └── webhookController.ts  # PayMongo/Billplz webhook handlers
│   ├── services/
│   │   ├── paymongoService.ts    # PayMongo API integration
│   │   ├── billplzService.ts     # Billplz API integration
│   │   └── databaseService.ts    # Supabase database operations
│   ├── routes/index.ts           # Express routes
│   ├── middleware/auth.ts        # Service authentication
│   └── index.ts                  # Express app entry point
├── Dockerfile                    # Production container config
├── railway.json                  # Railway deployment config
├── package.json                  # Dependencies and scripts
└── __tests__/                    # Comprehensive test suite
```

**Key Features:**
- PayMongo integration (Philippines) - GCash, PayMaya, Cards
- Billplz integration (Malaysia) - FPX, Bank Transfer, Cards
- Webhook signature verification for security
- Real-time payment status updates
- Database integration with Supabase
- Comprehensive error handling and logging

### gomflow-smart-agent Service Structure
```
gomflow-smart-agent/
├── src/
│   ├── config/index.ts           # AI/ML service configuration
│   ├── controllers/
│   │   └── smartAgentController.ts # Image processing endpoints
│   ├── services/
│   │   ├── imageService.ts       # Image preprocessing
│   │   ├── ocrService.ts         # Tesseract OCR integration
│   │   ├── aiVisionService.ts    # GPT-4 Vision API
│   │   └── databaseService.ts    # Payment matching database
│   ├── processors/
│   │   └── paymentProcessor.ts   # Main processing pipeline
│   └── index.ts                  # Express app entry point
├── Dockerfile                    # AI/ML optimized container
├── railway.json                  # Railway deployment config
└── package.json                  # AI/ML dependencies
```

**Key Features:**
- GPT-4 Vision API for payment screenshot analysis
- Tesseract OCR for multi-language text extraction (English/Filipino/Malay)
- Automated payment matching with confidence scoring
- Support for multiple payment methods and currencies
- File upload handling with security validation
- Processing queue with Redis for scalability

## Production Environment Configuration

### gomflow-payments Environment Variables

Create a `.env.production` file with these variables:

```bash
# Service Configuration
NODE_ENV=production
PORT=3000
SERVICE_SECRET=your_32_character_service_secret_here

# Database Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Redis Configuration
REDIS_URL=redis://red-xxxxx:6379

# PayMongo Configuration (Philippines)
PAYMONGO_SECRET_KEY=sk_live_your_paymongo_secret_key
PAYMONGO_WEBHOOK_SECRET=whsec_your_webhook_secret
PAYMONGO_API_URL=https://api.paymongo.com/v1

# Billplz Configuration (Malaysia)
BILLPLZ_API_KEY=your_billplz_api_key
BILLPLZ_COLLECTION_ID=your_collection_id
BILLPLZ_WEBHOOK_SECRET=your_webhook_secret
BILLPLZ_API_URL=https://www.billplz.com/api/v3

# Service URLs (Set after Railway deployment)
CORE_API_URL=https://gomflow.com/api
WHATSAPP_SERVICE_URL=https://gomflow-whatsapp.railway.app
TELEGRAM_SERVICE_URL=https://gomflow-telegram.railway.app
DISCORD_SERVICE_URL=https://gomflow-discord.railway.app

# Webhook Configuration
WEBHOOK_BASE_URL=https://gomflow-payments.railway.app
PAYMONGO_WEBHOOK_URL=https://gomflow-payments.railway.app/api/webhooks/paymongo
BILLPLZ_WEBHOOK_URL=https://gomflow-payments.railway.app/api/webhooks/billplz

# Security
CORS_ORIGIN=https://gomflow.com,https://www.gomflow.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Logging
LOG_LEVEL=info
LOG_FILE=logs/payment-service.log
```

### gomflow-smart-agent Environment Variables

```bash
# Service Configuration
NODE_ENV=production
PORT=3000
SERVICE_SECRET=your_32_character_service_secret_here

# Database Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Redis Configuration
REDIS_URL=redis://red-xxxxx:6379

# OpenAI Configuration
OPENAI_API_KEY=sk-your_openai_api_key_here
OPENAI_MODEL=gpt-4-vision-preview
OPENAI_MAX_TOKENS=1500

# OCR Configuration
TESSERACT_LANG=eng+fil+msa
OCR_CONFIDENCE_THRESHOLD=60

# Image Processing
MAX_IMAGE_SIZE=10485760
ALLOWED_IMAGE_TYPES=image/jpeg,image/png,image/webp
IMAGE_QUALITY=85
MAX_IMAGE_WIDTH=2048
MAX_IMAGE_HEIGHT=2048

# AI Detection Thresholds
MIN_CONFIDENCE_AUTO_MATCH=0.85
MIN_CONFIDENCE_SUGGEST=0.60
MIN_AMOUNT_THRESHOLD=1.00
MAX_AMOUNT_THRESHOLD=100000.00

# Service URLs
CORE_API_URL=https://gomflow.com/api
PAYMENT_SERVICE_URL=https://gomflow-payments.railway.app
WHATSAPP_SERVICE_URL=https://gomflow-whatsapp.railway.app
TELEGRAM_SERVICE_URL=https://gomflow-telegram.railway.app
DISCORD_SERVICE_URL=https://gomflow-discord.railway.app

# Security
CORS_ORIGIN=https://gomflow.com,https://www.gomflow.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=50

# Queue Configuration
QUEUE_CONCURRENCY=3
QUEUE_MAX_ATTEMPTS=3
QUEUE_BACKOFF_DELAY=5000

# File Storage
UPLOAD_DIR=uploads
PROCESSED_DIR=processed
TEMP_DIR=temp

# Logging
LOG_LEVEL=info
LOG_FILE=logs/smart-agent.log

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
```

## Railway Deployment Configuration

Both services are configured for Railway deployment with:
- **Dockerfile-based builds** for consistent environments
- **Health checks** on `/api/health` endpoints
- **Automatic restarts** on failure
- **Environment-specific configurations**

### Current railway.json Configuration

Both services use identical Railway configurations:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "sleepApplication": false,
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300,
    "startCommand": "npm run start:prod"
  },
  "environments": {
    "production": {
      "variables": {
        "NODE_ENV": "production",
        "PORT": "3000"
      }
    },
    "staging": {
      "variables": {
        "NODE_ENV": "staging",
        "PORT": "3000"
      }
    }
  }
}
```

## Step-by-Step Deployment Instructions

### Prerequisites

1. **Railway CLI installed and authenticated**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Required API Keys and Credentials:**
   - PayMongo API keys (production)
   - Billplz API keys (production)
   - OpenAI API key (GPT-4 Vision access)
   - Supabase project URL and service role key
   - Redis instance URL (Railway Redis add-on)

### Step 1: Deploy gomflow-payments Service

1. **Create Railway project for payments service:**
   ```bash
   cd gomflow-payments
   railway login
   railway init gomflow-payments
   ```

2. **Add Redis add-on:**
   ```bash
   railway add redis
   ```

3. **Set environment variables:**
   ```bash
   # Set all environment variables from the configuration above
   railway variables set NODE_ENV=production
   railway variables set PORT=3000
   railway variables set SERVICE_SECRET=your_service_secret
   # ... (continue with all environment variables)
   ```

4. **Deploy the service:**
   ```bash
   railway up
   ```

5. **Verify deployment:**
   ```bash
   # Check service health
   curl https://gomflow-payments.railway.app/api/health
   
   # Expected response:
   {
     "service": "GOMFLOW Payment Service",
     "version": "1.0.0", 
     "status": "healthy",
     "timestamp": "2025-01-23T...",
     "environment": "production"
   }
   ```

### Step 2: Deploy gomflow-smart-agent Service

1. **Create Railway project for smart agent:**
   ```bash
   cd ../gomflow-smart-agent
   railway init gomflow-smart-agent
   ```

2. **Add Redis add-on (if not sharing):**
   ```bash
   railway add redis
   ```

3. **Set environment variables:**
   ```bash
   # Set all AI/ML service environment variables
   railway variables set NODE_ENV=production
   railway variables set OPENAI_API_KEY=sk-your_key
   railway variables set PAYMENT_SERVICE_URL=https://gomflow-payments.railway.app
   # ... (continue with all environment variables)
   ```

4. **Deploy the service:**
   ```bash
   railway up
   ```

5. **Verify deployment:**
   ```bash
   # Check service health and capabilities
   curl https://gomflow-smart-agent.railway.app/api/health
   
   # Expected response includes AI capabilities
   {
     "service": "GOMFLOW Smart Payment Agent",
     "status": "healthy",
     "capabilities": [
       "Payment screenshot analysis",
       "OCR text extraction", 
       "AI-powered payment detection",
       "Automatic submission matching"
     ]
   }
   ```

## Webhook Configuration

### PayMongo Webhook Setup

1. **Create webhook endpoint in PayMongo dashboard:**
   - URL: `https://gomflow-payments.railway.app/api/webhooks/paymongo`
   - Events: `payment.paid`, `payment.failed`, `payment_intent.succeeded`

2. **Or use the automated script:**
   ```bash
   cd ../../scripts
   ./configure-webhooks.sh production
   ```

### Billplz Webhook Setup

1. **Update collection webhook in Billplz dashboard:**
   - URL: `https://gomflow-payments.railway.app/api/webhooks/billplz`

2. **Webhook signature verification is automatic**

## Service-to-Service Communication

### Authentication Flow

All inter-service communication uses the `SERVICE_SECRET` for authentication:

```javascript
// Example service call from core to payments
const response = await fetch('https://gomflow-payments.railway.app/api/payments/create', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SERVICE_SECRET}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(paymentData)
})
```

### Key Service Endpoints

**gomflow-payments endpoints:**
- `POST /api/payments/create` - Create payment link
- `GET /api/payments/:id/status` - Check payment status
- `POST /api/webhooks/paymongo` - PayMongo webhook
- `POST /api/webhooks/billplz` - Billplz webhook
- `GET /api/health` - Health check

**gomflow-smart-agent endpoints:**
- `POST /api/process` - Process payment screenshot
- `POST /api/review` - Review detection result
- `GET /api/stats` - Processing statistics
- `GET /api/status` - Service status
- `GET /api/health` - Health check

## Error Handling and Monitoring

### Built-in Error Handling

Both services include:
- **Comprehensive logging** with Winston
- **Request ID tracking** for debugging
- **Graceful shutdown** handling
- **Circuit breaker patterns** for external API calls
- **Retry logic** with exponential backoff

### Monitoring Setup

1. **Health Check Monitoring:**
   ```bash
   # Set up monitoring with Railway's built-in metrics
   railway metrics
   ```

2. **Custom Metrics Endpoints:**
   - Payment service: `/api/metrics`
   - Smart agent: `/api/metrics` (port 9090)

3. **Log Aggregation:**
   Both services log to stdout for Railway log collection

## Testing Procedures

### Payment Gateway Testing

1. **Test PayMongo integration:**
   ```bash
   # Create test payment
   curl -X POST https://gomflow-payments.railway.app/api/payments/create \
     -H "Authorization: Bearer ${SERVICE_SECRET}" \
     -H "Content-Type: application/json" \
     -d '{
       "amount": 1000,
       "currency": "PHP",
       "submission_id": "test-submission-123",
       "payment_method": "gcash"
     }'
   ```

2. **Test webhook processing:**
   ```bash
   # Check webhook logs in Railway dashboard
   railway logs
   ```

### Smart Agent Testing

1. **Test image processing:**
   ```bash
   # Upload test payment screenshot
   curl -X POST https://gomflow-smart-agent.railway.app/api/process \
     -H "Authorization: Bearer ${SERVICE_SECRET}" \
     -F "image=@test-payment-screenshot.jpg" \
     -F "platform=gcash" \
     -F "user_id=test-user"
   ```

2. **Verify AI detection:**
   ```bash
   # Check processing stats
   curl https://gomflow-smart-agent.railway.app/api/stats
   ```

## Production Deployment Checklist

### Pre-Deployment
- [ ] All API keys and credentials verified
- [ ] Environment variables configured
- [ ] Redis instances provisioned
- [ ] Database schema deployed to production Supabase
- [ ] SSL certificates configured (handled by Railway)

### Deployment
- [ ] gomflow-payments deployed and healthy
- [ ] gomflow-smart-agent deployed and healthy
- [ ] Service-to-service communication tested
- [ ] Webhook endpoints configured
- [ ] Payment gateway webhooks verified

### Post-Deployment
- [ ] Health checks passing for all services
- [ ] Payment flows tested end-to-end
- [ ] AI processing pipeline verified
- [ ] Monitoring and alerting configured
- [ ] Backup and recovery procedures documented

## Security Considerations

### API Security
- **Webhook signature verification** for all payment providers
- **Service-to-service authentication** with secrets
- **Rate limiting** on all endpoints
- **CORS configuration** for web security

### Data Security
- **No sensitive payment data stored** in logs
- **Encrypted environment variables**
- **Secure image processing** with file validation
- **Database security** with Row Level Security (RLS)

### Network Security
- **HTTPS-only communication**
- **IP whitelisting** for webhook endpoints (if required)
- **Service isolation** within Railway network

## Troubleshooting Guide

### Common Issues

1. **Webhook signature validation failures:**
   - Verify webhook secrets match provider settings
   - Check request body parsing in middleware

2. **AI processing timeouts:**
   - Monitor OpenAI API rate limits
   - Check image size and format requirements

3. **Database connection issues:**
   - Verify Supabase service role key
   - Check connection pool configuration

4. **Service communication failures:**
   - Verify SERVICE_SECRET consistency
   - Check network connectivity between services

### Debugging Commands

```bash
# Check service logs
railway logs --service gomflow-payments
railway logs --service gomflow-smart-agent

# Check environment variables
railway variables

# Test service endpoints
curl https://gomflow-payments.railway.app/api/health
curl https://gomflow-smart-agent.railway.app/api/health

# Monitor resource usage
railway metrics
```

## Maintenance and Updates

### Regular Maintenance
- **Weekly health checks** of all endpoints
- **Monthly dependency updates** 
- **Quarterly security reviews**

### Update Procedures
1. Test updates in staging environment first
2. Deploy during low-traffic periods
3. Monitor health checks post-deployment
4. Rollback procedures ready if needed

## Conclusion

The GOMFLOW Payment Gateway and Smart Agent services are production-ready for Railway deployment. The comprehensive configuration, testing procedures, and monitoring setup ensure reliable operation of the core payment processing functionality that enables GOMFLOW's 95% time reduction value proposition.

**Next Steps:**
1. Deploy services following this guide
2. Configure payment provider webhooks
3. Test complete payment workflows
4. Set up monitoring and alerting
5. Document operational procedures for ongoing maintenance

This deployment enables the automated payment tracking that differentiates GOMFLOW from manual Google Forms workflows, providing the foundation for scaling group order management from 50-300 orders to unlimited volume.