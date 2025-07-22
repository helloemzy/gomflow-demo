# 🎭 GOMFLOW Demo Testing Guide

## Welcome to GOMFLOW Demo Environment!

This demo version allows you to test **all platform features** without real API keys, payments, or external integrations. Everything is mocked and simulated for safe testing.

---

## 🚀 Quick Start

### 1. Start Demo Environment
```bash
./start-demo.sh
```

This starts all 9 microservices in demo mode:
- 🌐 Web App: http://localhost:3000
- 📱 WhatsApp Service: http://localhost:3001
- 💬 Telegram Service: http://localhost:3002
- 🎮 Discord Service: http://localhost:3003
- 💳 Payment Service: http://localhost:3004
- 🧠 Smart Agent: http://localhost:3005
- 📊 Analytics: http://localhost:3006
- 📈 Monitoring: http://localhost:3007
- 🔔 Notifications: http://localhost:3009

### 2. Access the Platform
- **Main App**: http://localhost:3000
- **Demo Login**: Use any email/password (authentication is mocked)

### 3. Stop Demo Environment
```bash
./stop-demo.sh
```

---

## 🎯 Testing Scenarios

### Scenario 1: Complete GOM Workflow (Philippines)

#### Step 1: Create Group Order
1. Go to http://localhost:3000/orders/create
2. Fill in order details:
   - **Title**: "SEVENTEEN God of Music Album"
   - **Price**: 1800 PHP
   - **Minimum**: 20 orders
   - **Deadline**: 7 days from now
   - **Country**: Philippines
3. Click "Create Order"

#### Step 2: Test Order Discovery
1. Go to http://localhost:3000/browse
2. See your order in the public listing
3. Click on your order to view details

#### Step 3: Submit Order as Buyer
1. Open order page
2. Click "Join Group Order"
3. Fill buyer information:
   - **Name**: Test Buyer
   - **Email**: buyer@test.com
   - **Phone**: +639123456789
   - **Quantity**: 1
4. Select payment method: GCash
5. Click "Submit Order"

#### Step 4: Upload Payment Proof
1. On submission confirmation page
2. Upload any image as "payment proof"
3. Add reference: GC-TEST-001
4. Click "Submit Proof"

#### Step 5: View GOM Dashboard
1. Go to http://localhost:3000/dashboard
2. See order statistics and submissions
3. Check payment status (will show as "Processing")

### Scenario 2: Malaysia Workflow (Billplz)

#### Step 1: Create Malaysian Order
1. Create new order with:
   - **Country**: Malaysia
   - **Price**: 95 MYR
   - **Title**: "NewJeans Get Up Album"

#### Step 2: Test FPX Payment
1. Submit order as buyer
2. Select "FPX" payment method
3. Mock payment page will show bank selection
4. Payment will auto-confirm in demo mode

### Scenario 3: Multi-Platform Bot Testing

#### Telegram Bot Simulation
1. Go to http://localhost:3002/demo
2. Simulate sending commands:
   - `/start` - Welcome message
   - `/orders` - List orders
   - `/create` - Create order flow
   - `/dashboard` - View stats

#### Discord Bot Simulation
1. Visit http://localhost:3003/demo
2. Test slash commands:
   - `/help` - Command list
   - `/order create` - Order creation
   - `/payment status` - Payment check

#### WhatsApp Simulation
1. Check http://localhost:3001/demo
2. Simulate message flows:
   - Payment confirmations
   - Order updates
   - Bulk notifications

### Scenario 4: Advanced Features Testing

#### AI Smart Agent (Payment Processing)
1. Upload payment screenshot (any image)
2. AI will "process" and extract details
3. Check processing results in dashboard

#### Analytics Dashboard
1. Go to http://localhost:3000/analytics
2. View demo charts and metrics:
   - Order trends
   - Payment method distribution
   - Geographic data
   - Revenue analytics

#### Collaboration Features
1. Go to http://localhost:3000/collaboration
2. Test workspace creation
3. Simulate real-time editing
4. Check activity feeds

---

## 🎭 Demo Features & Limitations

### ✅ What Works (Fully Simulated):

#### Payment Processing
- ✅ PayMongo (Philippines): GCash, PayMaya, Cards
- ✅ Billplz (Malaysia): FPX, Touch 'n Go, Maybank2U
- ✅ Mock payment confirmation (2-second delay)
- ✅ Payment proof upload and AI processing
- ✅ Refund simulation

#### Bot Services
- ✅ Telegram bot commands and responses
- ✅ Discord slash commands and embeds
- ✅ WhatsApp message templates
- ✅ Bulk messaging simulation
- ✅ Bot statistics and analytics

#### Core Features
- ✅ Order creation and management
- ✅ Buyer submissions and tracking
- ✅ Real-time notifications (WebSocket)
- ✅ Analytics and reporting
- ✅ File uploads and processing
- ✅ Multi-country/currency support

#### Advanced Features
- ✅ AI content generation
- ✅ Market intelligence
- ✅ Collaboration workspaces
- ✅ Social media integration
- ✅ Predictive analytics

### 🎭 Demo Simulations:

#### Payment Success Rates
- 90% payments succeed automatically
- 10% simulate failures for testing
- 2-second processing delay

#### Bot Response Rates
- Telegram: 96.8% success rate
- Discord: 98.2% success rate  
- WhatsApp: 97.1% success rate

#### AI Processing
- Mock OCR results for uploaded images
- Simulated GPT-4 analysis
- Random confidence scores (85-98%)

---

## 📊 Pre-loaded Demo Data

The demo environment includes:

### Demo Users
- **emily_demo** (GOM) - Philippines
- **sarah_demo** (GOM) - Malaysia  
- **buyer1_demo** (Buyer) - Philippines
- **buyer2_demo** (Buyer) - Malaysia
- **buyer3_demo** (Buyer) - Philippines

### Demo Orders
1. **SEVENTEEN "God of Music" Album** (Active - 24/30 orders)
2. **BLACKPINK Limited Photobook** (Completed - 50/50 orders)
3. **STRAY KIDS Concert Goods** (Active - 8/20 orders)
4. **NewJeans Special Edition** (Collecting - 15/25 orders)
5. **IVE Love Dive Merchandise** (Active - 5/10 orders)

### Demo Transactions
- 15+ payment submissions
- Various payment methods tested
- Different order statuses
- Communication history

---

## 🐛 Testing Edge Cases

### Payment Failures
1. Try submitting 10+ payments quickly
2. Some will simulate failures
3. Test error handling and retry logic

### Order Capacity
1. Create order with low maximum (5 orders)
2. Submit 6 orders to test overflow handling
3. Check waiting list functionality

### File Upload Limits
1. Upload very large files (will be rejected)
2. Upload unsupported formats
3. Test file processing errors

### Network Simulation
1. Services simulate network delays
2. Some requests will timeout (5% rate)
3. Test retry mechanisms

---

## 📈 Monitoring & Logs

### Service Health Checks
Visit health endpoints to check service status:
- http://localhost:3000/api/health (Core)
- http://localhost:3004/api/health (Payments)
- http://localhost:3002/api/health (Telegram)

### Log Files
Demo logs are saved in each service's `logs/` directory:
```
gomflow-core/logs/gomflow-core-demo.log
gomflow-payments/logs/gomflow-payments-demo.log
gomflow-telegram/logs/gomflow-telegram-demo.log
```

### Real-time Monitoring
Dashboard shows simulated metrics:
- Response times: 50-200ms
- Success rates: 95-99%
- Active users: 150-300
- Order volumes: Realistic trends

---

## 🎯 Key Testing Goals

### 1. User Experience Testing
- ✅ Complete order creation flow
- ✅ Buyer submission process
- ✅ Payment handling experience
- ✅ Dashboard usability
- ✅ Mobile responsiveness

### 2. Feature Completeness
- ✅ All major features accessible
- ✅ Error handling works properly
- ✅ Edge cases handled gracefully
- ✅ Multi-platform functionality
- ✅ Real-time updates working

### 3. Performance Validation
- ✅ Page load times reasonable
- ✅ API response times fast
- ✅ File uploads work smoothly
- ✅ Real-time features responsive
- ✅ Bulk operations handle well

### 4. Integration Testing
- ✅ Service-to-service communication
- ✅ Database operations
- ✅ File storage and retrieval
- ✅ Notification delivery
- ✅ Analytics data flow

---

## 🔧 Troubleshooting

### Services Won't Start
```bash
# Check Node.js version (needs 18+)
node -v

# Check for port conflicts
lsof -i :3000

# Clean up and restart
./stop-demo.sh
./start-demo.sh
```

### Database Connection Issues
```bash
# Demo uses mock database
# Check if .env.local was created
ls -la .env.local

# Verify demo environment
cat .env.local | grep DEMO_MODE
```

### Performance Issues
```bash
# Check system resources
top

# Reduce service load
# Edit start-demo.sh and comment out some services
```

---

## ✅ Demo Completion Checklist

Use this checklist to ensure you've tested all major features:

### Basic Functionality
- [ ] Created a group order
- [ ] Submitted order as buyer
- [ ] Uploaded payment proof
- [ ] Viewed GOM dashboard
- [ ] Browsed public orders

### Payment Testing
- [ ] Tested Philippines (GCash/PayMaya)
- [ ] Tested Malaysia (FPX/Touch 'n Go)
- [ ] Simulated payment failures
- [ ] Tested refund process

### Bot Integration
- [ ] Tried Telegram commands
- [ ] Tested Discord interactions
- [ ] Simulated WhatsApp messages
- [ ] Tested bulk notifications

### Advanced Features
- [ ] Used AI Smart Agent
- [ ] Viewed analytics dashboard
- [ ] Tried collaboration features
- [ ] Tested social media integration

### Mobile Experience
- [ ] Accessed on mobile browser
- [ ] Tested touch interactions
- [ ] Verified responsive design
- [ ] Tested file uploads on mobile

---

## 🎉 Next Steps After Demo

Once you've completed testing the demo:

1. **Production Setup**
   - Get real API keys (PayMongo, Billplz, etc.)
   - Set up production database
   - Configure real bot tokens

2. **Domain & Hosting**
   - Purchase gomflow.com domain
   - Set up production hosting
   - Configure SSL certificates

3. **Beta Testing**
   - Invite real GOMs to test
   - Collect feedback and iterate
   - Monitor real transactions

4. **Commercial Launch**
   - Marketing campaign
   - Community outreach
   - Scale monitoring and support

---

**🎭 Enjoy testing GOMFLOW! All features work exactly like production, but completely safe to experiment with!**

---

*Demo Guide Version: 1.0.0*  
*Last Updated: January 2025*  
*Support: emily@gomflow.com*