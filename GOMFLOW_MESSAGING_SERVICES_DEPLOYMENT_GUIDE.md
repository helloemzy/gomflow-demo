# GOMFLOW Messaging Services Deployment Guide (Railway)

## Overview

This guide provides step-by-step instructions for deploying GOMFLOW's multi-platform messaging services to Railway. These services enable automated buyer communication and are a key differentiator for GOMFLOW, providing 95% time reduction in order management.

## Services Architecture

### Messaging Services
1. **gomflow-whatsapp** - WhatsApp Business API service with Twilio integration
2. **gomflow-telegram** - Telegram Bot with comprehensive command suite  
3. **gomflow-discord** - Discord Bot with slash commands and embeds

### Key Features
- **Automated Buyer Communication**: Payment reminders, order confirmations, status updates
- **Smart Agent Integration**: AI-powered payment processing and intelligent responses
- **Multi-Platform Support**: WhatsApp, Telegram, and Discord from single interface
- **Advanced Bot Commands**: Complete buyer and GOM workflows
- **Queue-Based Processing**: Redis + Bull for reliable message delivery
- **Rate Limiting & Security**: Production-grade protection and monitoring

## Prerequisites

### 1. Required Accounts & Tokens
- **Railway Account**: For microservices deployment
- **Supabase**: Database access (already configured)
- **Redis**: Message queuing (Railway Redis plugin)
- **Twilio Account**: WhatsApp Business API
- **Telegram Bot**: Created via @BotFather
- **Discord Application**: Bot application with permissions

### 2. Required Environment Variables

#### Common Variables (All Services)
```env
# Database & Core
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
REDIS_URL=redis://localhost:6379
SERVICE_SECRET=your_random_service_secret_32_chars_min

# Service Communication
CORE_API_URL=https://gomflow-core.vercel.app
PAYMENT_SERVICE_URL=https://gomflow-payments.railway.app
SMART_AGENT_SERVICE_URL=https://gomflow-smart-agent.railway.app
```

#### WhatsApp Service Specific
```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Webhook Configuration
WEBHOOK_PATH=/webhooks/whatsapp
WEBHOOK_VALIDATION_TOKEN=your_webhook_validation_token
```

#### Telegram Service Specific
```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_WEBHOOK_URL=https://gomflow-telegram.railway.app/webhook/telegram
TELEGRAM_WEBHOOK_SECRET=your_random_webhook_secret

# Bot Features
ENABLE_INLINE_PAYMENTS=true
ENABLE_SMART_PAYMENT_DETECTION=true
AUTO_DELETE_PROCESSED_IMAGES=true
MAX_FILE_SIZE=20971520

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_MESSAGES=30
RATE_LIMIT_MAX_UPLOADS=5
```

#### Discord Service Specific
```env
# Discord Bot Configuration
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_application_client_id
DISCORD_GUILD_ID=your_test_guild_id_optional

# Bot Features
ENABLE_SLASH_COMMANDS=true
ENABLE_BUTTON_INTERACTIONS=true
ENABLE_MODAL_INTERACTIONS=true
```

## Deployment Steps

### Step 1: Prepare Services for Production

#### 1.1 Build Shared Module
```bash
cd gomflow-shared
npm install
npm run build
cd ..
```

#### 1.2 Install Dependencies for Each Service
```bash
# WhatsApp Service
cd gomflow-whatsapp
npm install
npm run build
cd ..

# Telegram Service
cd gomflow-telegram
npm install
npm run build
cd ..

# Discord Service
cd gomflow-discord
npm install
npm run build
cd ..
```

#### 1.3 Run Tests (Recommended)
```bash
# Test all messaging services
for service in gomflow-whatsapp gomflow-telegram gomflow-discord; do
    echo "Testing $service..."
    cd $service
    npm test
    cd ..
done
```

### Step 2: Railway Project Setup

#### 2.1 Create Railway Projects
```bash
# Install Railway CLI if not installed
npm install -g @railway/cli

# Login to Railway
railway login

# Create separate projects for each service
railway create gomflow-whatsapp-prod
railway create gomflow-telegram-prod
railway create gomflow-discord-prod
```

#### 2.2 Add Redis Plugin
For each project, add Redis plugin:
```bash
railway add redis
```

### Step 3: Deploy WhatsApp Service

#### 3.1 Configure Environment Variables
```bash
cd gomflow-whatsapp
railway link gomflow-whatsapp-prod

# Set environment variables
railway env set NODE_ENV=production
railway env set PORT=3000
railway env set SUPABASE_URL="$SUPABASE_URL"
railway env set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
railway env set SERVICE_SECRET="$SERVICE_SECRET"
railway env set TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID"
railway env set TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN"
railway env set TWILIO_WHATSAPP_NUMBER="$TWILIO_WHATSAPP_NUMBER"
railway env set CORE_API_URL="https://gomflow-core.vercel.app"
railway env set PAYMENT_SERVICE_URL="https://gomflow-payments.railway.app"
railway env set SMART_AGENT_SERVICE_URL="https://gomflow-smart-agent.railway.app"
```

#### 3.2 Deploy Service
```bash
railway deploy
```

#### 3.3 Get Service URL
```bash
railway status
# Note the service URL for webhook configuration
```

### Step 4: Deploy Telegram Service

#### 4.1 Configure Environment Variables
```bash
cd ../gomflow-telegram
railway link gomflow-telegram-prod

# Set environment variables
railway env set NODE_ENV=production
railway env set PORT=3000
railway env set SUPABASE_URL="$SUPABASE_URL"
railway env set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
railway env set SERVICE_SECRET="$SERVICE_SECRET"
railway env set TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN"
railway env set TELEGRAM_WEBHOOK_SECRET="$TELEGRAM_WEBHOOK_SECRET"
railway env set CORE_API_URL="https://gomflow-core.vercel.app"
railway env set PAYMENT_SERVICE_URL="https://gomflow-payments.railway.app"
railway env set SMART_AGENT_SERVICE_URL="https://gomflow-smart-agent.railway.app"
railway env set WHATSAPP_SERVICE_URL="https://gomflow-whatsapp.railway.app"
railway env set DISCORD_SERVICE_URL="https://gomflow-discord.railway.app"
railway env set ENABLE_INLINE_PAYMENTS=true
railway env set ENABLE_SMART_PAYMENT_DETECTION=true
railway env set AUTO_DELETE_PROCESSED_IMAGES=true
railway env set MAX_FILE_SIZE=20971520
railway env set RATE_LIMIT_WINDOW_MS=60000
railway env set RATE_LIMIT_MAX_MESSAGES=30
railway env set RATE_LIMIT_MAX_UPLOADS=5
```

#### 4.2 Deploy Service
```bash
railway deploy
```

#### 4.3 Configure Telegram Webhook
```bash
# Get service URL
TELEGRAM_URL=$(railway status --json | jq -r '.deployments[0].url')

# Set webhook URL
railway env set TELEGRAM_WEBHOOK_URL="$TELEGRAM_URL/webhook/telegram"
```

### Step 5: Deploy Discord Service

#### 5.1 Configure Environment Variables
```bash
cd ../gomflow-discord
railway link gomflow-discord-prod

# Set environment variables
railway env set NODE_ENV=production
railway env set PORT=3000
railway env set SUPABASE_URL="$SUPABASE_URL"
railway env set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
railway env set SERVICE_SECRET="$SERVICE_SECRET"
railway env set DISCORD_TOKEN="$DISCORD_TOKEN"
railway env set DISCORD_CLIENT_ID="$DISCORD_CLIENT_ID"
railway env set CORE_API_URL="https://gomflow-core.vercel.app"
railway env set PAYMENT_SERVICE_URL="https://gomflow-payments.railway.app"
railway env set SMART_AGENT_SERVICE_URL="https://gomflow-smart-agent.railway.app"
railway env set WHATSAPP_SERVICE_URL="https://gomflow-whatsapp.railway.app"
railway env set TELEGRAM_SERVICE_URL="https://gomflow-telegram.railway.app"
railway env set ENABLE_SLASH_COMMANDS=true
railway env set ENABLE_BUTTON_INTERACTIONS=true
railway env set ENABLE_MODAL_INTERACTIONS=true
```

#### 5.2 Deploy Service
```bash
railway deploy
```

#### 5.3 Deploy Discord Slash Commands
```bash
# Wait for service to be ready, then deploy commands
railway run npm run deploy:commands
```

### Step 6: Configure Webhooks & Integrations

#### 6.1 Configure Twilio WhatsApp Webhook
```bash
# Get WhatsApp service URL
WHATSAPP_URL=$(cd gomflow-whatsapp && railway status --json | jq -r '.deployments[0].url')

# Configure Twilio webhook (via Twilio Console or API)
curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Applications.json" \
    -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
    -d "StatusCallback=$WHATSAPP_URL/webhook/status" \
    -d "StatusCallbackMethod=POST"
```

#### 6.2 Configure Telegram Webhook
```bash
# Get Telegram service URL
TELEGRAM_URL=$(cd gomflow-telegram && railway status --json | jq -r '.deployments[0].url')

# Set Telegram webhook
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
    -H "Content-Type: application/json" \
    -d "{
        \"url\": \"$TELEGRAM_URL/webhook/telegram\",
        \"secret_token\": \"$TELEGRAM_WEBHOOK_SECRET\",
        \"allowed_updates\": [\"message\", \"callback_query\", \"inline_query\"]
    }"
```

#### 6.3 Verify Webhook Configurations
```bash
# Check Telegram webhook status
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"

# Test service health endpoints
curl "$WHATSAPP_URL/api/health"
curl "$TELEGRAM_URL/api/health"
curl "$DISCORD_URL/api/health"
```

### Step 7: Configure Service Communication

#### 7.1 Update Core API with Service URLs
Update your core API's environment variables with the deployed service URLs:

```bash
# In gomflow-core (Vercel)
vercel env add WHATSAPP_SERVICE_URL production <<< "$WHATSAPP_URL"
vercel env add TELEGRAM_SERVICE_URL production <<< "$TELEGRAM_URL"
vercel env add DISCORD_SERVICE_URL production <<< "$DISCORD_URL"
```

#### 7.2 Test Service Communication
```bash
# Test Smart Agent integration
curl -X POST "$SMART_AGENT_SERVICE_URL/api/process-payment" \
    -H "Authorization: Bearer $SERVICE_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"test": true}'

# Test messaging service integration
curl -X POST "$TELEGRAM_URL/api/notifications/test" \
    -H "Authorization: Bearer $SERVICE_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"test_message": true}'
```

## Production Configuration

### Railway.json Configurations

#### WhatsApp Service (railway.json)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 2,
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
    }
  }
}
```

#### Telegram Service (railway.json)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 2,
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
    }
  }
}
```

#### Discord Service (railway.json)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 2,
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
    }
  }
}
```

## Testing & Validation

### 1. Health Check Tests
```bash
# Test all service health endpoints
curl https://gomflow-whatsapp.railway.app/api/health
curl https://gomflow-telegram.railway.app/api/health
curl https://gomflow-discord.railway.app/api/health
```

### 2. Bot Command Tests

#### Telegram Bot Commands
```bash
# Test in Telegram:
/start - Should show welcome message and setup options
/help - Should display all available commands
/orders - Should show public orders
/submit ORDER_ID - Should start order submission flow
/status REF_ID - Should show submission status
```

#### Discord Bot Commands
```bash
# Test in Discord server:
/help - Show all commands
/orders - Display public orders with embeds
/submit order_id:ORDER_ID - Start submission modal
/create - Open order creation modal (GOM only)
/dashboard - Show GOM dashboard (GOM only)
```

### 3. Integration Tests

#### WhatsApp Message Flow
1. Create test order via dashboard
2. Submit order via Telegram/Discord
3. Verify WhatsApp confirmation message received
4. Upload payment proof
5. Verify WhatsApp payment confirmation

#### Smart Agent Integration
1. Upload payment screenshot via bot
2. Verify Smart Agent processes image
3. Check payment status updated automatically
4. Verify GOM notification sent

## Monitoring & Maintenance

### 1. Service Monitoring
- Monitor Railway dashboard for service health
- Set up Railway alerts for downtime
- Monitor Redis queue lengths
- Track message delivery rates

### 2. Bot Health Monitoring
```bash
# Check bot status regularly
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"
curl "$DISCORD_URL/api/commands/status"
```

### 3. Webhook Health Checks
```bash
# Verify webhook configurations
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

### 4. Log Monitoring
```bash
# Check service logs in Railway dashboard
railway logs --service gomflow-whatsapp-prod
railway logs --service gomflow-telegram-prod  
railway logs --service gomflow-discord-prod
```

## Automated Messaging Workflows

### Payment Reminder Automation
- **Trigger**: 24 hours before order deadline
- **Channels**: WhatsApp + Telegram + Discord (user preference)
- **Content**: Personalized reminder with payment instructions
- **Smart Agent**: Detects and processes payment proofs automatically

### Order Status Updates
- **Trigger**: Order status changes (quota reached, shipped, etc.)
- **Channels**: All subscribed platforms
- **Content**: Status-specific messages with next steps
- **Personalization**: Buyer name, order details, payment status

### GOM Notifications
- **New Submissions**: Instant notification to GOMs
- **Payment Confirmations**: Real-time payment updates
- **Deadline Alerts**: Automatic quota and deadline warnings
- **Analytics Summaries**: Daily/weekly performance reports

## Security Considerations

### 1. Token Management
- Store all tokens as Railway environment variables
- Use service secrets for inter-service communication
- Implement webhook signature verification
- Regular token rotation

### 2. Rate Limiting
- Implement per-user rate limits
- Monitor for bot spam/abuse
- Queue-based message processing
- Graceful degradation under load

### 3. Data Protection
- Encrypt payment screenshots in transit
- Auto-delete processed images
- Audit trail for all bot interactions
- GDPR compliance for user data

## Troubleshooting

### Common Issues

#### 1. Service Not Starting
```bash
# Check logs
railway logs --service SERVICE_NAME

# Common fixes:
# - Verify environment variables
# - Check Docker build process
# - Validate service dependencies
```

#### 2. Webhook Not Receiving Events
```bash
# Verify webhook URL
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"

# Re-configure webhook
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
    -d "url=$WEBHOOK_URL"
```

#### 3. Bot Commands Not Working
```bash
# Re-deploy Discord commands
railway run npm run deploy:commands

# Check bot permissions in Discord server
# Verify bot token validity
```

#### 4. Service Communication Failures
```bash
# Test service connectivity
curl -H "Authorization: Bearer $SERVICE_SECRET" \
    "$SERVICE_URL/api/health"

# Check service URLs in environment variables
# Verify service secret matches across services
```

## Deployment Checklist

### Pre-Deployment
- [ ] All environment variables configured
- [ ] Shared module built and published
- [ ] Services tested locally
- [ ] Bot tokens obtained and validated
- [ ] Webhook URLs planned

### Deployment
- [ ] WhatsApp service deployed to Railway
- [ ] Telegram service deployed to Railway
- [ ] Discord service deployed to Railway
- [ ] Redis plugins configured
- [ ] Health checks passing

### Post-Deployment
- [ ] Webhooks configured and verified
- [ ] Bot commands deployed (Discord)
- [ ] Service communication tested
- [ ] End-to-end message flow tested
- [ ] Monitoring and alerts configured

### Production Verification
- [ ] Create test order in production
- [ ] Submit order via each bot platform
- [ ] Verify WhatsApp notifications received
- [ ] Test payment proof upload and processing
- [ ] Confirm Smart Agent integration working
- [ ] Validate GOM notification delivery

## Service URLs (Production)

After successful deployment, your messaging services will be available at:

- **WhatsApp Service**: `https://gomflow-whatsapp.railway.app`
- **Telegram Service**: `https://gomflow-telegram.railway.app`  
- **Discord Service**: `https://gomflow-discord.railway.app`

These URLs should be configured in your core API and other services for proper inter-service communication.

## Support & Maintenance

### Regular Maintenance Tasks
1. **Weekly**: Review service logs and performance metrics
2. **Monthly**: Update dependencies and security patches
3. **Quarterly**: Review and optimize message templates
4. **Annually**: Rotate API keys and tokens

### Scaling Considerations
- Monitor message throughput and queue lengths
- Scale Railway replicas based on usage
- Consider Redis cluster for high-volume scenarios
- Implement horizontal scaling for bot services

---

**Next Steps**: After messaging services deployment, proceed with payment gateway services deployment to complete the GOMFLOW production infrastructure.