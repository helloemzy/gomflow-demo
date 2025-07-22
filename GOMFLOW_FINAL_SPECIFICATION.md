# GOMFLOW: Final Technical Specification
## Updated Based on Product Decisions

### Product Decisions Incorporated:
1. ✅ **WhatsApp**: Twilio Sandbox (free)
2. ✅ **Payment**: Direct payment gateway integration (no screenshots)
3. ✅ **AI Fallback**: Manual review only
4. ✅ **Architecture**: Separate services for each platform
5. ✅ **Pricing**: Approved Free/Pro tier structure
6. ✅ **Markets**: Philippines + Malaysia simultaneous

---

## Revolutionary Change: Direct Payment Integration

### The Game-Changer
Instead of payment screenshot verification, buyers pay directly through integrated payment gateways. This eliminates:
- ❌ Payment screenshot uploads
- ❌ AI analysis complexity 
- ❌ Manual verification delays
- ❌ Payment matching confusion

### New Payment Flow:
1. **Buyer places order** → Gets unique payment link
2. **Clicks payment link** → Redirected to secure gateway
3. **Completes payment** → Instant webhook confirmation
4. **Order auto-confirmed** → Immediate notifications to buyer & GOM

---

## Updated Technical Architecture

### Microservices Architecture (Separate Services)

```yaml
Services Architecture:
  core-api:
    purpose: "Main application logic, database, auth"
    tech: "Next.js + Supabase"
    hosting: "Vercel"
    
  whatsapp-service:
    purpose: "WhatsApp Business API integration"
    tech: "Node.js + Express"
    hosting: "Railway.app"
    
  telegram-service:
    purpose: "Telegram Bot API"
    tech: "Node.js + Express" 
    hosting: "Railway.app"
    
  discord-service:
    purpose: "Discord Bot integration"
    tech: "Node.js + Express"
    hosting: "Railway.app"
    
  payment-service:
    purpose: "Payment gateway webhooks"
    tech: "Node.js + Express"
    hosting: "Railway.app"
```

### Payment Gateway Integration

#### Philippines: PayMongo
```typescript
class PayMongoService {
  private apiKey: string;
  private webhookSecret: string;
  
  constructor() {
    this.apiKey = process.env.PAYMONGO_SECRET_KEY;
    this.webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  }
  
  async createPaymentIntent(submission: Submission) {
    const response = await fetch('https://api.paymongo.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: submission.total_amount * 100, // Convert to centavos
            currency: 'PHP',
            description: `${submission.order.title} - ${submission.buyer_name}`,
            statement_descriptor: 'GOMFLOW ORDER',
            metadata: {
              submission_id: submission.id,
              order_id: submission.order_id,
              payment_reference: submission.payment_reference
            }
          }
        }
      })
    });
    
    const paymentIntent = await response.json();
    return paymentIntent.data;
  }
  
  async createCheckoutSession(paymentIntentId: string, submission: Submission) {
    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: {
          attributes: {
            cancel_url: `${process.env.BASE_URL}/order/${submission.order.slug}?cancelled=true`,
            success_url: `${process.env.BASE_URL}/order/${submission.order.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
            payment_method_types: ['gcash', 'paymaya', 'grab_pay', 'card'],
            reference_number: submission.payment_reference,
            description: submission.order.title,
            line_items: [{
              name: submission.order.title,
              quantity: submission.quantity,
              amount: submission.order.price * 100,
              currency: 'PHP',
              description: submission.order.description || ''
            }],
            payment_intent: {
              id: paymentIntentId
            }
          }
        }
      })
    });
    
    const checkoutSession = await response.json();
    return checkoutSession.data;
  }
  
  async handleWebhook(req: Request) {
    const signature = req.headers['paymongo-signature'];
    const body = JSON.stringify(req.body);
    
    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('hex');
      
    if (signature !== expectedSignature) {
      throw new Error('Invalid webhook signature');
    }
    
    const event = req.body;
    
    switch (event.data.attributes.type) {
      case 'payment_intent.payment_succeeded':
        await this.handlePaymentSuccess(event.data.attributes.data);
        break;
        
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.attributes.data);
        break;
    }
  }
  
  private async handlePaymentSuccess(paymentIntent: any) {
    const submissionId = paymentIntent.attributes.metadata.submission_id;
    
    // Update submission status
    await updateSubmissionStatus(submissionId, 'paid');
    
    // Get submission details
    const submission = await getSubmissionById(submissionId);
    
    // Send confirmation to buyer
    await whatsappService.sendPaymentConfirmation(submission);
    
    // Notify GOM
    await whatsappService.sendMessage(
      submission.order.user.phone,
      `💰 Payment received! ${submission.buyer_name} paid ₱${submission.total_amount} for ${submission.order.title}`
    );
  }
}
```

#### Malaysia: Billplz
```typescript
class BillplzService {
  private apiKey: string;
  private collectionId: string;
  
  constructor() {
    this.apiKey = process.env.BILLPLZ_API_KEY;
    this.collectionId = process.env.BILLPLZ_COLLECTION_ID;
  }
  
  async createBill(submission: Submission) {
    const response = await fetch('https://www.billplz.com/api/v3/bills', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        collection_id: this.collectionId,
        email: submission.buyer_email || 'noreply@gomflow.com',
        name: submission.buyer_name,
        amount: (submission.total_amount * 100).toString(), // Convert to sen
        callback_url: `${process.env.PAYMENT_SERVICE_URL}/webhooks/billplz`,
        description: `${submission.order.title} - Order #${submission.payment_reference}`,
        reference_1_label: 'Order Reference',
        reference_1: submission.payment_reference,
        reference_2_label: 'Submission ID',
        reference_2: submission.id
      })
    });
    
    const bill = await response.json();
    return bill;
  }
  
  async handleWebhook(req: Request) {
    const { id, paid, state, amount, reference_1, reference_2 } = req.body;
    
    if (paid === 'true' && state === 'paid') {
      const submissionId = reference_2;
      
      // Update submission status
      await updateSubmissionStatus(submissionId, 'paid');
      
      // Get submission details
      const submission = await getSubmissionById(submissionId);
      
      // Send confirmations
      await whatsappService.sendPaymentConfirmation(submission);
      await whatsappService.sendMessage(
        submission.order.user.phone,
        `💰 Payment received! ${submission.buyer_name} paid RM${submission.total_amount} for ${submission.order.title}`
      );
    }
  }
}
```

---

## Updated Database Schema

### Payment-Focused Schema Changes

```sql
-- Updated submissions table
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Buyer Info
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  buyer_email TEXT, -- Required for some payment gateways
  buyer_platform TEXT NOT NULL,
  
  -- Order Details
  quantity INTEGER NOT NULL DEFAULT 1,
  total_amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL, -- PHP, MYR
  
  -- Payment Integration
  payment_reference TEXT UNIQUE NOT NULL,
  payment_gateway TEXT, -- paymongo, billplz
  payment_intent_id TEXT, -- Gateway's payment ID
  checkout_session_id TEXT, -- Gateway's checkout session ID
  payment_url TEXT, -- Direct payment link
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed, expired
  
  -- Tracking
  source_platform TEXT,
  
  -- Communication
  last_reminder_sent TIMESTAMP,
  reminder_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Payment transactions log
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  
  -- Gateway Info
  gateway TEXT NOT NULL, -- paymongo, billplz
  gateway_payment_id TEXT NOT NULL,
  gateway_status TEXT NOT NULL,
  
  -- Transaction Details
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL,
  payment_method TEXT, -- gcash, paymaya, fpx, card
  
  -- Timestamps
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Raw webhook data
  webhook_data JSONB
);

-- Remove payment analysis table (no longer needed)
-- DROP TABLE payment_analyses;
```

---

## Updated Order Submission Flow

### New Payment-Integrated Flow:

```typescript
// POST /api/orders/[slug]/submit
async function submitOrder(req: Request, res: Response) {
  const { orderSlug } = req.query;
  const submissionData = req.body;
  
  // 1. Validate order
  const order = await getOrderBySlug(orderSlug);
  if (!order.is_active || new Date() > order.deadline) {
    return res.status(400).json({ error: 'Order closed' });
  }
  
  // 2. Create submission
  const submission = await createSubmission({
    ...submissionData,
    order_id: order.id,
    total_amount: order.price * submissionData.quantity,
    payment_reference: generatePaymentReference(order, submissionData),
    currency: order.currency
  });
  
  // 3. Create payment based on country
  let paymentUrl: string;
  
  if (order.currency === 'PHP') {
    // Philippines - PayMongo
    const paymentIntent = await payMongoService.createPaymentIntent(submission);
    const checkoutSession = await payMongoService.createCheckoutSession(
      paymentIntent.id, 
      submission
    );
    
    paymentUrl = checkoutSession.attributes.checkout_url;
    
    // Update submission with payment details
    await updateSubmission(submission.id, {
      payment_gateway: 'paymongo',
      payment_intent_id: paymentIntent.id,
      checkout_session_id: checkoutSession.id,
      payment_url: paymentUrl
    });
    
  } else if (order.currency === 'MYR') {
    // Malaysia - Billplz
    const bill = await billplzService.createBill(submission);
    
    paymentUrl = bill.url;
    
    // Update submission with payment details
    await updateSubmission(submission.id, {
      payment_gateway: 'billplz',
      payment_intent_id: bill.id,
      payment_url: paymentUrl
    });
  }
  
  // 4. Send order confirmation with payment link
  await whatsappService.sendOrderConfirmationWithPayment(submission, paymentUrl);
  
  return res.json({ 
    success: true,
    submissionId: submission.id,
    paymentUrl,
    paymentReference: submission.payment_reference
  });
}
```

### Updated WhatsApp Messages:

```typescript
async sendOrderConfirmationWithPayment(submission: Submission, paymentUrl: string) {
  const timeLeft = formatDistanceToNow(submission.order.deadline);
  
  const message = `✅ Order confirmed!

🛒 ${submission.order.title}
📦 Quantity: ${submission.quantity}
💰 Total: ${submission.currency}${submission.total_amount}
🔢 Reference: ${submission.payment_reference}

💳 PAY NOW (secure payment):
${paymentUrl}

⏰ Payment due in ${timeLeft}

Supported methods:
${submission.currency === 'PHP' ? 
  '• GCash\n• PayMaya\n• GrabPay\n• Credit/Debit Card' : 
  '• FPX (Online Banking)\n• Credit/Debit Card'}

Pay now to secure your order! 🚀`;

  return await this.sendMessage(submission.buyer_phone, message);
}
```

---

## Service Architecture Details

### 1. Core API Service (main app)
```yaml
Repository: gomflow-core
Tech Stack: Next.js + Supabase
Hosting: Vercel
Responsibilities:
  - Web dashboard
  - Order management
  - User authentication
  - Database operations
  - API endpoints
```

### 2. WhatsApp Service
```yaml
Repository: gomflow-whatsapp
Tech Stack: Node.js + Express
Hosting: Railway.app
Environment Variables:
  - TWILIO_ACCOUNT_SID
  - TWILIO_AUTH_TOKEN
  - CORE_API_URL
  - WEBHOOK_SECRET
Responsibilities:
  - Send WhatsApp messages
  - Handle incoming webhooks
  - Auto-reply to queries
  - Broadcast to groups
```

### 3. Telegram Service
```yaml
Repository: gomflow-telegram
Tech Stack: Node.js + Express
Hosting: Railway.app
Environment Variables:
  - TELEGRAM_BOT_TOKEN
  - CORE_API_URL
  - WEBHOOK_SECRET
Responsibilities:
  - Telegram bot commands
  - Channel posting
  - Interactive callbacks
  - Order tracking
```

### 4. Discord Service
```yaml
Repository: gomflow-discord
Tech Stack: Node.js + Express + Discord.js
Hosting: Railway.app
Environment Variables:
  - DISCORD_BOT_TOKEN
  - CORE_API_URL
  - WEBHOOK_SECRET
Responsibilities:
  - Discord bot commands
  - Server posting
  - Slash commands
  - Role management
```

### 5. Payment Service
```yaml
Repository: gomflow-payments
Tech Stack: Node.js + Express
Hosting: Railway.app
Environment Variables:
  - PAYMONGO_SECRET_KEY
  - PAYMONGO_WEBHOOK_SECRET
  - BILLPLZ_API_KEY
  - BILLPLZ_COLLECTION_ID
  - CORE_API_URL
Responsibilities:
  - Payment gateway webhooks
  - Transaction processing
  - Payment status updates
  - Refund handling
```

---

## Inter-Service Communication

### Service-to-Service API Authentication:
```typescript
// Shared authentication middleware
export function validateServiceToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-service-token'];
  const expectedToken = process.env.SERVICE_SECRET;
  
  if (token !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized service call' });
  }
  
  next();
}

// Example service call from WhatsApp service to Core API
async function notifyOrderSubmission(submissionData: any) {
  const response = await fetch(`${process.env.CORE_API_URL}/api/submissions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Token': process.env.SERVICE_SECRET
    },
    body: JSON.stringify(submissionData)
  });
  
  return response.json();
}
```

---

## Multi-Country Support Implementation

### Country Detection & Configuration:
```typescript
interface CountryConfig {
  currency: 'PHP' | 'MYR';
  paymentGateway: 'paymongo' | 'billplz';
  phoneFormat: RegExp;
  supportedMethods: string[];
  timezone: string;
}

const COUNTRY_CONFIGS: Record<string, CountryConfig> = {
  PH: {
    currency: 'PHP',
    paymentGateway: 'paymongo',
    phoneFormat: /^(\+63|63|0)?9\d{9}$/,
    supportedMethods: ['gcash', 'paymaya', 'grab_pay', 'card'],
    timezone: 'Asia/Manila'
  },
  MY: {
    currency: 'MYR', 
    paymentGateway: 'billplz',
    phoneFormat: /^(\+60|60|0)?1\d{8,9}$/,
    supportedMethods: ['fpx', 'card'],
    timezone: 'Asia/Kuala_Lumpur'
  }
};

function detectCountry(phoneNumber: string): string {
  if (COUNTRY_CONFIGS.PH.phoneFormat.test(phoneNumber)) return 'PH';
  if (COUNTRY_CONFIGS.MY.phoneFormat.test(phoneNumber)) return 'MY';
  return 'PH'; // Default to Philippines
}
```

### Localized Messaging:
```typescript
const MESSAGES = {
  PH: {
    orderConfirmation: (data: any) => `✅ Order confirmed!\n\n🛒 ${data.title}\n💰 ₱${data.amount}\n\n💳 Pay securely: ${data.paymentUrl}\n\nSupported: GCash, PayMaya, GrabPay`,
    paymentSuccess: (data: any) => `🎉 Payment received!\n\nYour order for ${data.title} is confirmed!\nQuantity: ${data.quantity}\nAmount: ₱${data.amount}`
  },
  MY: {
    orderConfirmation: (data: any) => `✅ Pesanan disahkan!\n\n🛒 ${data.title}\n💰 RM${data.amount}\n\n💳 Bayar sekarang: ${data.paymentUrl}\n\nSupported: FPX, Credit Card`,
    paymentSuccess: (data: any) => `🎉 Pembayaran diterima!\n\nPesanan anda untuk ${data.title} telah disahkan!\nKuantiti: ${data.quantity}\nJumlah: RM${data.amount}`
  }
};
```

---

## Updated Implementation Timeline

### **Week 1-2: Core API + Payment Integration**
- Day 1-3: Database schema + authentication
- Day 4-6: Order CRUD + public pages
- Day 7-10: PayMongo + Billplz integration
- Day 11-14: Payment webhooks + testing

### **Week 3: WhatsApp Service**
- Day 1-2: Separate service setup
- Day 3-4: Twilio integration + messaging
- Day 5-7: Webhook handling + auto-replies

### **Week 4: Telegram Service**
- Day 1-2: Bot setup + commands
- Day 3-4: Channel posting + callbacks
- Day 5-7: Integration with core API

### **Week 5: Discord Service**
- Day 1-2: Bot setup + slash commands
- Day 3-4: Server posting + interactions
- Day 5-7: Final integration testing

### **Week 6: Testing + Launch**
- Day 1-3: End-to-end testing
- Day 4-5: Bug fixes + optimization
- Day 6-7: Beta launch with 10 GOMs

---

## Cost Analysis (Monthly)

```yaml
Infrastructure:
  Vercel Pro: $20 (for core API)
  Railway.app (4 services): $20 (4 × $5)
  Supabase Pro: $25
  Domain: $1
  
Payment Processing:
  PayMongo: 3.5% + ₱15 per transaction
  Billplz: 2.85% per transaction
  
Messaging:
  Twilio WhatsApp (sandbox): FREE
  Telegram Bot: FREE
  Discord Bot: FREE
  
Total Fixed Cost: $66/month
Variable Cost: ~3% of payment volume
```

---

## Success Metrics (Updated)

### Payment Integration Success:
- ✅ **95%+ payment completion rate** (vs 60% with manual)
- ✅ **<30 second payment confirmation** (vs hours)
- ✅ **Zero payment disputes** (automated processing)
- ✅ **100% accurate payment tracking** (webhook-driven)

### Automation Effectiveness:
- ✅ **Orders auto-distributed** to all platforms
- ✅ **Payment confirmations** sent instantly
- ✅ **GOM notifications** in real-time
- ✅ **Zero manual payment verification**

### Time Savings:
- ✅ **Order setup: 15 minutes → 2 minutes**
- ✅ **Payment tracking: 4 hours → 0 minutes**
- ✅ **Buyer support: 2 hours → 15 minutes**
- ✅ **Total: 20+ hours → 20 minutes per order cycle**

---

## Next Steps

**Ready to begin implementation with:**
1. ✅ All product decisions finalized
2. ✅ Payment gateway integration strategy
3. ✅ Microservices architecture planned
4. ✅ Multi-country support designed
5. ✅ 6-week development timeline

**This specification provides the complete roadmap for building GOMFLOW with real automation and direct payment processing.**

---

*Final Technical Specification v3.0*
*Updated with payment gateway integration*
*Ready for implementation*