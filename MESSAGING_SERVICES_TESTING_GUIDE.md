# GOMFLOW Messaging Services Testing Guide

## Overview

This guide provides comprehensive testing procedures for GOMFLOW's messaging services after deployment to Railway. These tests ensure that all automated messaging workflows, Smart Agent integrations, and bot commands function correctly in production.

## Testing Environment Setup

### Prerequisites
- All messaging services deployed to Railway
- Bot tokens and webhooks configured
- Test Telegram account and Discord server
- WhatsApp Business account (for production testing)
- Access to production database
- Smart Agent service running

### Test Accounts Required
- **Telegram**: Personal account for bot testing
- **Discord**: Test server with admin permissions  
- **WhatsApp**: Business account or sandbox number
- **GOMFLOW**: Test GOM and buyer accounts

## Service Health Testing

### 1. Basic Health Checks

#### Check All Service Endpoints
```bash
# WhatsApp Service
curl https://gomflow-whatsapp.railway.app/api/health

# Telegram Service  
curl https://gomflow-telegram.railway.app/api/health

# Discord Service
curl https://gomflow-discord.railway.app/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-23T...",
  "services": {
    "database": "connected",
    "redis": "connected",
    "bot": "connected"
  }
}
```

#### Verify Database Connections
```bash
# Test database connectivity for each service
curl -X POST https://gomflow-telegram.railway.app/api/health/database \
  -H "Authorization: Bearer $SERVICE_SECRET"
```

#### Verify Redis Connections
```bash
# Test Redis connectivity for message queues
curl -X POST https://gomflow-telegram.railway.app/api/health/redis \
  -H "Authorization: Bearer $SERVICE_SECRET"
```

### 2. Bot Status Verification

#### Telegram Bot Status
```bash
# Check bot info
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"

# Check webhook status
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

**Expected Webhook Response:**
```json
{
  "ok": true,
  "result": {
    "url": "https://gomflow-telegram.railway.app/webhook/telegram",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

#### Discord Bot Status
```bash
# Test Discord bot connection
curl -X GET https://gomflow-discord.railway.app/api/bot/status \
  -H "Authorization: Bearer $SERVICE_SECRET"
```

## Bot Command Testing

### Telegram Bot Commands

#### 1. Basic Commands Test

Start a chat with your bot and test these commands:

```
/start
```
**Expected**: Welcome message with role selection (GOM/Buyer)

```
/help
```
**Expected**: Command list based on user role

```
/orders
```
**Expected**: List of public orders with inline buttons

#### 2. Order Discovery Test

```
/orders trending
```
**Expected**: Trending orders with progress bars

```
/orders category album
```
**Expected**: Filtered orders by category

#### 3. Order Submission Test

```
/submit ORDER_ID
```
**Expected**: Step-by-step submission flow:
1. Quantity selection
2. Payment method choice
3. Contact information
4. Confirmation message

#### 4. Payment Processing Test

1. Submit an order via `/submit`
2. Upload payment screenshot
3. **Expected**: 
   - Smart Agent processes image
   - Payment status updated
   - Confirmation message sent

#### 5. GOM Commands Test (Admin Role)

```
/create
```
**Expected**: Order creation flow with inline keyboards

```
/manage
```
**Expected**: Order management dashboard

```
/dashboard
```
**Expected**: Analytics and statistics

```
/notify all Payment reminder for ORDER_TITLE
```
**Expected**: Bulk notification sent

### Discord Bot Commands

#### 1. Slash Commands Test

Test these commands in your Discord server:

```
/help
```
**Expected**: Embed with command descriptions

```
/orders
```
**Expected**: Rich embed with order cards and buttons

```
/submit order_id:123
```
**Expected**: Modal form for order submission

#### 2. Button Interactions Test

1. Use `/orders` command
2. Click "View Details" button
**Expected**: Detailed order information embed

3. Click "Submit Order" button  
**Expected**: Order submission modal opens

#### 3. Order Creation Test (GOM Role)

```
/create
```
**Expected**: Modal with order creation form

**Test Form Submission:**
1. Fill all required fields
2. Submit form
3. **Expected**: Order created and confirmation embed shown

#### 4. GOM Dashboard Test

```
/dashboard
```
**Expected**: Multi-embed dashboard with:
- Order statistics
- Recent submissions
- Payment status
- Action buttons

#### 5. Bulk Notifications Test

```
/notify type:payment_reminder message:Custom reminder text
```
**Expected**: Confirmation of bulk notifications sent

## WhatsApp Integration Testing

### 1. Message Delivery Test

#### Order Confirmation Test
1. Create test order via dashboard
2. Submit order with phone number
3. **Expected**: WhatsApp confirmation message received

#### Payment Reminder Test
1. Create order with near deadline
2. **Expected**: Automated reminder sent 24 hours before

#### Payment Confirmation Test
1. Upload payment proof via bot
2. **Expected**: WhatsApp confirmation message

### 2. Message Template Test

Test different message types:

#### Order Updates
- "Order quota reached"
- "Order deadline extended"  
- "Order cancelled"

#### Payment Updates
- "Payment received"
- "Payment rejected"
- "Refund processed"

#### GOM Notifications
- "New submission received"
- "Payment pending review"
- "Order completed"

## Smart Agent Integration Testing

### 1. Payment Screenshot Processing

#### Telegram Screenshot Test
1. Start order submission in Telegram
2. Upload payment screenshot (JPG/PNG)
3. **Expected**:
   - Image processed by Smart Agent
   - Payment details extracted
   - Status updated automatically
   - Confirmation message sent

#### Discord Screenshot Test
1. Use `/submit` command in Discord
2. Attach payment screenshot to modal
3. **Expected**: Same Smart Agent processing flow

### 2. OCR Accuracy Test

Test various payment screenshot types:

#### Bank Transfer Screenshots
- Local bank apps (GCash, Maya, TNG, etc.)
- International transfers
- Reference number extraction
- Amount verification

#### E-wallet Screenshots  
- PayMongo receipts
- Billplz confirmations
- QR code payments
- Digital wallet transfers

#### Expected Processing Results
- Payment method identified
- Amount extracted correctly
- Reference number captured
- Timestamp recorded
- Confidence score > 85%

### 3. Error Handling Test

#### Invalid Images
- Upload blurry screenshot
- **Expected**: Request for clearer image

#### Unrelated Images
- Upload non-payment image
- **Expected**: Error message with guidance

#### Processing Failures
- Upload corrupted file
- **Expected**: Graceful error handling

## Automated Workflow Testing

### 1. Payment Reminder Automation

#### Setup Test Scenario
1. Create order with deadline in 25 hours
2. Add test buyer with all messaging platforms
3. Wait for automated reminder (or trigger manually)

#### Expected Results
- Telegram message sent
- Discord DM sent  
- WhatsApp message sent
- All contain same information
- Links work correctly

### 2. Order Status Updates

#### Quota Reached Test
1. Create order with low quota (e.g., 5 items)
2. Submit 5 orders rapidly
3. **Expected**: Automatic notifications sent to all buyers

#### Deadline Reached Test
1. Create order with immediate deadline
2. **Expected**: Automatic closure and notifications

### 3. GOM Notification Automation

#### New Submission Alert
1. Submit order via any bot
2. **Expected**: Instant GOM notification via all channels

#### Payment Confirmation Alert
1. Upload valid payment proof
2. **Expected**: GOM notification with payment details

## Service Communication Testing

### 1. Inter-Service API Calls

#### Smart Agent to Messaging
```bash
# Test Smart Agent calling Telegram service
curl -X POST https://gomflow-smart-agent.railway.app/api/process-payment \
  -H "Authorization: Bearer $SERVICE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "submission_id": "test-123",
    "notification_channels": ["telegram", "discord", "whatsapp"]
  }'
```

#### Core API to Messaging
```bash
# Test Core API triggering notifications
curl -X POST https://gomflow-core.vercel.app/api/notifications/send \
  -H "Authorization: Bearer $SERVICE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment_reminder",
    "submission_id": "test-123",
    "channels": ["telegram", "whatsapp"]
  }'
```

### 2. Queue Processing Test

#### Message Queue Health
```bash
# Check queue status for each service
curl https://gomflow-telegram.railway.app/api/queues/status \
  -H "Authorization: Bearer $SERVICE_SECRET"
```

#### Queue Processing Test
1. Send bulk notification request
2. Monitor queue processing
3. **Expected**: Messages processed in order without loss

### 3. Error Recovery Test

#### Service Unavailability
1. Temporarily stop one messaging service
2. Send notifications
3. **Expected**: Other services continue working
4. Restart service
5. **Expected**: Queued messages processed

## Performance Testing

### 1. Load Testing

#### Concurrent Users Test
- Simulate 50 concurrent bot interactions
- Monitor response times
- **Expected**: < 2 second response times

#### Bulk Message Test
- Send 100 notifications simultaneously  
- Monitor delivery rates
- **Expected**: > 95% delivery success

### 2. Rate Limiting Test

#### Bot Rate Limits
1. Send messages rapidly to bot
2. **Expected**: Rate limiting kicks in
3. Graceful error messages shown

#### API Rate Limits
1. Make rapid API calls
2. **Expected**: 429 responses with retry headers

## End-to-End Workflow Testing

### 1. Complete Order Lifecycle

#### Scenario: Album Group Order
1. **GOM Creates Order** (via Discord)
   - Use `/create` command
   - Fill order details
   - Set deadline 2 days from now

2. **Order Announcement** (automated)
   - Check Telegram channel post
   - Verify Discord announcement
   - Confirm WhatsApp group message

3. **Buyer Discovers Order** (via Telegram)
   - Use `/orders` command
   - Browse available orders
   - View order details

4. **Order Submission** (via Telegram)
   - Use `/submit ORDER_ID` command
   - Complete submission flow
   - Receive confirmation

5. **Payment Processing** (Smart Agent)
   - Upload payment screenshot
   - Wait for automatic processing
   - Receive payment confirmation

6. **GOM Notifications** (all channels)
   - New submission alert
   - Payment confirmation alert
   - Dashboard updates

7. **Order Completion** (automated)
   - Quota reached notification
   - Final confirmations sent
   - Order marked complete

### 2. Error Recovery Scenario

#### Scenario: Payment Issues
1. Submit order with invalid payment
2. **Expected**: Smart Agent rejects payment
3. Buyer receives rejection notice
4. Buyer uploads correct payment
5. **Expected**: Automatic approval

### 3. Multi-Platform Scenario

#### Scenario: Cross-Platform Usage
1. GOM creates order via Discord
2. Buyer discovers via Telegram
3. Buyer submits via Discord
4. Payment uploaded via Telegram
5. **Expected**: Seamless experience across platforms

## Monitoring and Alerts Testing

### 1. Service Health Monitoring

#### Railway Dashboard Checks
- Monitor CPU/memory usage
- Check error rates
- Verify deployment status

#### Application Logs
```bash
# Check service logs
railway logs --service gomflow-telegram-prod
railway logs --service gomflow-discord-prod  
railway logs --service gomflow-whatsapp-prod
```

### 2. Error Tracking

#### Sentry Integration (if configured)
- Verify error capture
- Check error notifications
- Review error trends

#### Custom Monitoring
- API response time tracking
- Message delivery rates
- Queue processing metrics

## Troubleshooting Common Issues

### 1. Bot Not Responding

#### Telegram Bot Issues
```bash
# Check webhook status
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"

# Re-set webhook if needed
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://gomflow-telegram.railway.app/webhook/telegram"
```

#### Discord Bot Issues
```bash
# Check bot connection
curl https://gomflow-discord.railway.app/api/bot/status

# Re-deploy commands if needed
railway run npm run deploy:commands
```

### 2. Message Delivery Issues

#### WhatsApp Messages Not Sending
1. Check Twilio account status
2. Verify phone number format
3. Check rate limits
4. Review webhook configuration

#### Queue Processing Issues
1. Check Redis connectivity
2. Monitor queue lengths
3. Restart services if needed

### 3. Smart Agent Integration Issues

#### Payment Processing Failures
1. Check Smart Agent service health
2. Verify API keys and secrets
3. Test OCR service directly
4. Review image format requirements

## Test Result Documentation

### Testing Checklist

Create a test execution report with these sections:

#### Service Health ✓/✗
- [ ] WhatsApp service health check
- [ ] Telegram service health check  
- [ ] Discord service health check
- [ ] Database connectivity
- [ ] Redis connectivity

#### Bot Commands ✓/✗
- [ ] Telegram basic commands
- [ ] Telegram order submission
- [ ] Discord slash commands
- [ ] Discord button interactions
- [ ] WhatsApp message delivery

#### Smart Agent Integration ✓/✗
- [ ] Payment screenshot processing
- [ ] OCR accuracy > 85%
- [ ] Error handling
- [ ] Status updates

#### Automated Workflows ✓/✗
- [ ] Payment reminders
- [ ] Order status updates
- [ ] GOM notifications
- [ ] Cross-platform sync

#### Performance ✓/✗
- [ ] Response times < 2s
- [ ] Message delivery > 95%
- [ ] Rate limiting functional
- [ ] Load handling adequate

### Issue Tracking

Document any issues found:

| Issue | Service | Severity | Status | Resolution |
|-------|---------|----------|--------|------------|
| Bot timeout | Telegram | Medium | Fixed | Increased timeout |
| Webhook failure | Discord | High | Open | Investigating |

## Production Readiness Criteria

Before marking messaging services as production-ready:

### ✅ All Tests Passing
- [ ] Service health checks: 100%
- [ ] Bot command tests: 100%  
- [ ] Smart Agent integration: 100%
- [ ] Automated workflows: 100%
- [ ] Performance benchmarks: Met

### ✅ Monitoring Setup
- [ ] Railway monitoring configured
- [ ] Error tracking active
- [ ] Alert thresholds set
- [ ] Log aggregation working

### ✅ Documentation Complete
- [ ] Deployment guide updated
- [ ] Testing procedures documented
- [ ] Troubleshooting guide created
- [ ] Runbook for operations team

### ✅ Security Verified
- [ ] All tokens secured
- [ ] Webhook signatures verified
- [ ] Rate limiting active
- [ ] Access controls implemented

---

**Next Steps**: After successful testing, proceed with payment gateway services deployment to complete the GOMFLOW production infrastructure.