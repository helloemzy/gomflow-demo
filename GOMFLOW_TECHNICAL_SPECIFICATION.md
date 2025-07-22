# GOMFLOW: Complete Technical Specification
## CTO & Product Owner Requirements Document

### Document Purpose
This document defines the exact technical requirements, architecture, and implementation details for GOMFLOW MVP with real automation. Every feature is specified with precise technical implementation requirements.

---

## System Overview

### Core Value Proposition
**Eliminate 95% of manual work in group order management through API-driven automation**

### Primary User Journey
1. GOM creates order → System auto-distributes to all platforms
2. Buyers place orders → System tracks across all sources  
3. Buyers upload payment proof → AI auto-verifies and confirms
4. System handles all communication automatically

---

## Technical Architecture

### Core Technology Stack
```yaml
Frontend:
  Framework: Next.js 14 (App Router)
  Language: TypeScript 5.x
  Styling: Tailwind CSS + shadcn/ui
  State Management: React hooks + SWR for server state
  
Backend:
  Runtime: Node.js 20 LTS
  Framework: Next.js API routes
  Language: TypeScript 5.x
  
Database:
  Primary: Supabase (PostgreSQL 15)
  Auth: Supabase Auth
  Storage: Supabase Storage
  
External APIs:
  WhatsApp: Twilio WhatsApp Business API
  AI Vision: OpenAI GPT-4 Vision API
  Telegram: Telegram Bot API
  Discord: Discord.js library
  
Hosting:
  Platform: Vercel
  Domain: gomflow.com
  CDN: Vercel Edge Network
  
Monitoring:
  Analytics: Vercel Analytics
  Errors: Built-in Next.js error tracking
  Logs: Vercel Functions logs
```

---

## Database Schema

### Core Tables

```sql
-- Users (GOMs)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL, -- for URLs
  phone TEXT NOT NULL, -- for WhatsApp notifications
  country TEXT NOT NULL DEFAULT 'PH', -- PH, MY
  timezone TEXT NOT NULL DEFAULT 'Asia/Manila',
  
  -- Platform Integration Settings
  whatsapp_enabled BOOLEAN DEFAULT true,
  telegram_enabled BOOLEAN DEFAULT false,
  discord_enabled BOOLEAN DEFAULT false,
  
  -- Subscription
  plan TEXT DEFAULT 'free', -- free, pro, business
  subscription_status TEXT DEFAULT 'active',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Platform Connections
CREATE TABLE platform_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- whatsapp, telegram, discord
  connection_type TEXT NOT NULL, -- group, channel, webhook
  
  -- Connection Details (JSON)
  config JSONB NOT NULL, -- {group_id, webhook_url, etc}
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Orders (Products/Drops)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Basic Info
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PHP',
  
  -- Timing
  deadline TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- URL
  slug TEXT NOT NULL,
  
  -- Payment Info
  payment_methods JSONB NOT NULL, -- [{type: 'gcash', number: '09171234567', name: 'Sarah Cruz'}]
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  auto_close_on_deadline BOOLEAN DEFAULT true,
  
  -- Targets
  min_orders INTEGER DEFAULT 1,
  max_orders INTEGER,
  
  UNIQUE(user_id, slug)
);

-- Order Submissions
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Buyer Info
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  buyer_platform TEXT NOT NULL, -- whatsapp, telegram, discord
  buyer_platform_id TEXT, -- telegram user ID, discord user ID, etc
  
  -- Order Details
  quantity INTEGER NOT NULL DEFAULT 1,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Payment Tracking
  payment_reference TEXT UNIQUE NOT NULL, -- Auto-generated: GF-001-ANNA
  payment_proof_url TEXT,
  payment_analysis JSONB, -- AI analysis results
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, overdue, cancelled
  
  -- Tracking
  source_platform TEXT, -- Where order came from
  utm_source TEXT,
  
  -- Communication
  last_reminder_sent TIMESTAMP,
  reminder_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Messages (Communication Log)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  
  -- Message Details
  platform TEXT NOT NULL, -- whatsapp, telegram, discord
  message_type TEXT NOT NULL, -- reminder, confirmation, query_response
  content TEXT NOT NULL,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, failed, delivered
  external_message_id TEXT, -- Platform's message ID
  
  -- Metadata
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Payment Analysis (AI Results)
CREATE TABLE payment_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  
  -- AI Analysis
  detected_amount DECIMAL(10,2),
  detected_reference TEXT,
  detected_sender TEXT,
  detected_method TEXT,
  confidence_score DECIMAL(3,2), -- 0.00 to 1.00
  
  -- Verification
  matches_expected BOOLEAN,
  auto_approved BOOLEAN DEFAULT false,
  manual_review_required BOOLEAN DEFAULT false,
  
  -- Raw Data
  image_url TEXT NOT NULL,
  ai_response JSONB, -- Full OpenAI response
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Platform Posts (Track where orders were posted)
CREATE TABLE platform_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  
  platform TEXT NOT NULL,
  post_id TEXT, -- Platform's post ID
  post_url TEXT,
  
  status TEXT DEFAULT 'posted', -- posted, failed, deleted
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes for Performance
```sql
-- Core performance indexes
CREATE INDEX idx_submissions_order_id ON submissions(order_id);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_payment_ref ON submissions(payment_reference);
CREATE INDEX idx_messages_submission_id ON messages(submission_id);
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_slug ON orders(slug);
CREATE INDEX idx_orders_deadline ON orders(deadline);

-- Query optimization indexes
CREATE INDEX idx_submissions_overdue ON submissions(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_messages_pending ON messages(status, created_at) WHERE status = 'pending';
```

---

## Feature Specifications

### 1. Order Creation & Auto-Distribution

#### Feature: Create Order
**Input Form Fields:**
```typescript
interface OrderForm {
  title: string; // max 100 chars
  description?: string; // max 500 chars
  price: number; // positive decimal
  currency: 'PHP' | 'MYR';
  deadline: Date; // must be future
  minOrders: number; // default 1
  maxOrders?: number; // optional
  paymentMethods: PaymentMethod[];
}

interface PaymentMethod {
  type: 'gcash' | 'paymaya' | 'bank_transfer' | 'maybank2u' | 'tng';
  number: string;
  name: string;
  instructions?: string;
}
```

**API Endpoint:**
```typescript
// POST /api/orders
async function createOrder(req: Request, res: Response) {
  // 1. Validate input
  // 2. Generate unique slug
  // 3. Create order in database
  // 4. Auto-distribute to configured platforms
  // 5. Return order with shareable URL
}
```

#### Feature: Auto-Distribution
**Technical Implementation:**
```typescript
async function autoDistributeOrder(order: Order, user: User) {
  const distributions = [];
  
  // WhatsApp Groups
  if (user.whatsapp_enabled) {
    const whatsappGroups = await getPlatformConnections(user.id, 'whatsapp');
    for (const group of whatsappGroups) {
      distributions.push(
        whatsappService.postOrderToGroup(group.config.group_id, order)
      );
    }
  }
  
  // Telegram Channels
  if (user.telegram_enabled) {
    const telegramChannels = await getPlatformConnections(user.id, 'telegram');
    for (const channel of telegramChannels) {
      distributions.push(
        telegramService.postOrderToChannel(channel.config.channel_id, order)
      );
    }
  }
  
  // Discord Channels
  if (user.discord_enabled) {
    const discordChannels = await getPlatformConnections(user.id, 'discord');
    for (const channel of discordChannels) {
      distributions.push(
        discordService.postOrderToChannel(channel.config.webhook_url, order)
      );
    }
  }
  
  // Execute all distributions in parallel
  const results = await Promise.allSettled(distributions);
  
  // Log results to platform_posts table
  await logDistributionResults(order.id, results);
}
```

### 2. Order Page & Submission

#### Feature: Public Order Page
**URL Structure:** `gomflow.com/u/{username}/{slug}`

**Page Components:**
```typescript
interface OrderPageProps {
  order: {
    id: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    deadline: Date;
    paymentMethods: PaymentMethod[];
    user: {
      username: string;
      name: string;
    };
    stats: {
      currentOrders: number;
      minOrders: number;
      maxOrders?: number;
    };
  };
}
```

**Submission Form:**
```typescript
interface SubmissionForm {
  buyerName: string; // required, max 100 chars
  buyerPhone: string; // required, validated format
  quantity: number; // min 1, max 10
  platform: 'whatsapp' | 'telegram' | 'discord' | 'web';
  platformId?: string; // auto-detected if from bot
}
```

#### Feature: Order Submission Processing
```typescript
// POST /api/orders/[slug]/submit
async function submitOrder(req: Request, res: Response) {
  const { orderSlug } = req.query;
  const submissionData = req.body;
  
  // 1. Validate order is still active
  const order = await getOrderBySlug(orderSlug);
  if (!order.is_active || new Date() > order.deadline) {
    return res.status(400).json({ error: 'Order closed' });
  }
  
  // 2. Check max orders limit
  const currentCount = await getSubmissionCount(order.id);
  if (order.max_orders && currentCount >= order.max_orders) {
    return res.status(400).json({ error: 'Order full' });
  }
  
  // 3. Generate unique payment reference
  const paymentReference = generatePaymentReference(order, submissionData);
  
  // 4. Calculate total amount
  const totalAmount = order.price * submissionData.quantity;
  
  // 5. Create submission
  const submission = await createSubmission({
    ...submissionData,
    order_id: order.id,
    total_amount: totalAmount,
    payment_reference: paymentReference,
    source_platform: getSourcePlatform(req),
  });
  
  // 6. Send confirmation message
  await sendOrderConfirmation(submission);
  
  return res.json({ 
    success: true, 
    paymentReference,
    paymentInstructions: formatPaymentInstructions(order.paymentMethods, paymentReference)
  });
}

function generatePaymentReference(order: Order, submission: any): string {
  // Format: GF-{order_id_short}-{buyer_initials}-{random}
  const orderShort = order.id.split('-')[0].slice(0, 6).toUpperCase();
  const initials = submission.buyerName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return `GF-${orderShort}-${initials}-${random}`;
}
```

### 3. WhatsApp Integration

#### Service Implementation:
```typescript
class WhatsAppService {
  private client: Twilio;
  
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  
  async postOrderToGroup(groupId: string, order: Order) {
    const message = this.formatOrderMessage(order);
    
    return await this.client.messages.create({
      from: 'whatsapp:+14155238886', // Twilio sandbox
      to: `whatsapp:${groupId}`,
      body: message
    });
  }
  
  async sendOrderConfirmation(submission: Submission) {
    const message = `✅ Order received!
    
Order: ${submission.order.title}
Quantity: ${submission.quantity}
Total: ${submission.currency}${submission.total_amount}
Reference: ${submission.payment_reference}

Please send payment with this reference code to complete your order.

Payment methods:
${this.formatPaymentMethods(submission.order.payment_methods)}`;

    return await this.sendMessage(submission.buyer_phone, message);
  }
  
  async sendPaymentReminder(submission: Submission) {
    const hoursLeft = differenceInHours(submission.order.deadline, new Date());
    
    const message = `⏰ Payment reminder
    
Hi ${submission.buyer_name}! Your order for ${submission.order.title} expires in ${hoursLeft} hours.

Amount: ${submission.currency}${submission.total_amount}
Reference: ${submission.payment_reference}

Pay now to secure your order!`;

    return await this.sendMessage(submission.buyer_phone, message);
  }
  
  async sendPaymentConfirmation(submission: Submission) {
    const message = `🎉 Payment confirmed!

Your order for ${submission.order.title} is secured!
Quantity: ${submission.quantity}
Total: ${submission.currency}${submission.total_amount}

You'll receive updates when the order is ready for shipping.`;

    return await this.sendMessage(submission.buyer_phone, message);
  }
  
  private async sendMessage(to: string, body: string) {
    try {
      const message = await this.client.messages.create({
        from: 'whatsapp:+14155238886',
        to: `whatsapp:${to}`,
        body
      });
      
      return { success: true, messageId: message.sid };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  // Webhook handler for incoming messages
  async handleIncomingMessage(req: Request) {
    const { Body, From, To } = req.body;
    const phoneNumber = From.replace('whatsapp:', '');
    
    // Auto-reply to common queries
    if (Body.toLowerCase().includes('status')) {
      const submissions = await getSubmissionsByPhone(phoneNumber);
      if (submissions.length > 0) {
        const status = submissions[0].status;
        await this.sendMessage(phoneNumber, `Your order status: ${status}`);
      }
    }
    
    if (Body.toLowerCase().includes('payment') || Body.toLowerCase().includes('reference')) {
      const submissions = await getSubmissionsByPhone(phoneNumber);
      if (submissions.length > 0) {
        const ref = submissions[0].payment_reference;
        await this.sendMessage(phoneNumber, `Your payment reference: ${ref}`);
      }
    }
  }
  
  private formatOrderMessage(order: Order): string {
    return `🛒 NEW GROUP ORDER!

${order.title}
💰 ${order.currency}${order.price} per item
📅 Deadline: ${format(order.deadline, 'MMM dd, yyyy HH:mm')}

${order.description}

🔗 Order here: ${process.env.BASE_URL}/u/${order.user.username}/${order.slug}

React with 👍 if interested!`;
  }
}
```

### 4. AI Payment Screenshot Analysis

#### Implementation:
```typescript
class PaymentAnalysisService {
  private openai: OpenAI;
  
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  
  async analyzePaymentScreenshot(
    imageBase64: string, 
    expectedAmount: number, 
    expectedReference: string,
    submission: Submission
  ) {
    const prompt = `Analyze this payment screenshot for a group order system.

Expected details:
- Amount: ${expectedAmount} ${submission.order.currency}
- Reference code: ${expectedReference}
- Payment methods: ${submission.order.payment_methods.map(pm => pm.type).join(', ')}

Extract and verify:
1. Payment amount (number only)
2. Reference code (exact match)
3. Sender name
4. Payment method (GCash, PayMaya, bank transfer, etc.)
5. Date/time of payment
6. Recipient details

Return JSON only:
{
  "amount": number,
  "reference": "string",
  "sender": "string", 
  "method": "string",
  "date": "string",
  "recipient": "string",
  "confidence": number (0-1),
  "matches_expected": boolean,
  "issues": ["array of any issues found"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { 
              type: 'image_url', 
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
            }
          ]
        }],
        max_tokens: 500,
        temperature: 0
      });
      
      const analysisText = response.choices[0].message.content;
      const analysis = JSON.parse(analysisText);
      
      // Store analysis in database
      await this.storeAnalysis(submission.id, analysis, imageBase64);
      
      // Auto-approve if high confidence and matches expected
      if (analysis.confidence >= 0.9 && analysis.matches_expected) {
        await this.autoApprovePayment(submission, analysis);
        return { ...analysis, auto_approved: true };
      } else {
        await this.flagForManualReview(submission, analysis);
        return { ...analysis, manual_review_required: true };
      }
      
    } catch (error) {
      console.error('Payment analysis failed:', error);
      return { 
        success: false, 
        error: 'Analysis failed',
        manual_review_required: true 
      };
    }
  }
  
  private async autoApprovePayment(submission: Submission, analysis: any) {
    // Update submission status
    await updateSubmissionStatus(submission.id, 'paid');
    
    // Send confirmation to buyer
    await whatsappService.sendPaymentConfirmation(submission);
    
    // Notify GOM
    await whatsappService.sendMessage(
      submission.order.user.phone,
      `💰 Payment auto-verified! ${submission.buyer_name} paid ${submission.total_amount} for ${submission.order.title}`
    );
  }
  
  private async flagForManualReview(submission: Submission, analysis: any) {
    // Add to manual review queue
    await createManualReviewTask(submission.id, analysis);
    
    // Notify GOM for review
    await whatsappService.sendMessage(
      submission.order.user.phone,
      `⚠️ Payment needs review: ${submission.buyer_name} - ${submission.order.title}. Check your dashboard.`
    );
  }
}
```

### 5. Telegram Bot Integration

#### Implementation:
```typescript
class TelegramService {
  private bot: TelegramBot;
  
  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
      polling: false 
    });
    this.setupWebhook();
    this.setupCommands();
  }
  
  async setupWebhook() {
    const webhookUrl = `${process.env.BASE_URL}/api/telegram/webhook`;
    await this.bot.setWebHook(webhookUrl);
  }
  
  async postOrderToChannel(channelId: string, order: Order) {
    const keyboard = {
      inline_keyboard: [[
        { 
          text: '🛒 Order Now', 
          url: `${process.env.BASE_URL}/u/${order.user.username}/${order.slug}` 
        },
        { 
          text: '📊 Check Progress', 
          callback_data: `progress_${order.id}` 
        }
      ]]
    };
    
    const message = `🛒 *NEW GROUP ORDER*

*${order.title}*
💰 ${order.currency}${order.price} per item
📅 Deadline: ${format(order.deadline, 'MMM dd, yyyy HH:mm')}

${order.description}

Click button below to order!`;

    return await this.bot.sendMessage(channelId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
  }
  
  private setupCommands() {
    // Track order command
    this.bot.onText(/\/track (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const reference = match[1];
      
      const submission = await getSubmissionByReference(reference);
      if (submission) {
        const statusMessage = `📦 *Order Status*

Order: ${submission.order.title}
Amount: ${submission.currency}${submission.total_amount}
Status: ${submission.status}
Reference: ${submission.payment_reference}

${submission.status === 'pending' ? '⏰ Payment still needed' : '✅ Payment confirmed'}`;

        await this.bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
      } else {
        await this.bot.sendMessage(chatId, '❌ Order not found. Please check your reference code.');
      }
    });
    
    // Handle callback queries
    this.bot.on('callback_query', async (callbackQuery) => {
      const { data, message } = callbackQuery;
      
      if (data.startsWith('progress_')) {
        const orderId = data.split('_')[1];
        const order = await getOrderWithStats(orderId);
        
        const progressMessage = `📊 *Order Progress*

${order.title}
Current orders: ${order.current_orders}
Target: ${order.min_orders}${order.max_orders ? ` - ${order.max_orders}` : ''}
Progress: ${Math.round((order.current_orders / order.min_orders) * 100)}%

${order.current_orders >= order.min_orders ? '✅ Target reached!' : '⏰ Still accepting orders'}`;

        await this.bot.editMessageText(progressMessage, {
          chat_id: message.chat.id,
          message_id: message.message_id,
          parse_mode: 'Markdown'
        });
      }
    });
  }
  
  // Webhook handler
  async handleWebhook(req: Request) {
    const update = req.body;
    this.bot.processUpdate(update);
  }
}
```

### 6. Dashboard Implementation

#### Core Dashboard Features:
```typescript
interface DashboardData {
  stats: {
    totalOrders: number;
    activeOrders: number;
    totalSubmissions: number;
    pendingPayments: number;
    overduePayments: number;
    totalRevenue: number;
    pendingRevenue: number;
  };
  recentOrders: Order[];
  recentSubmissions: Submission[];
  pendingPayments: Submission[];
  overduePayments: Submission[];
}

// API endpoint: GET /api/dashboard
async function getDashboardData(userId: string): Promise<DashboardData> {
  const [stats, recentOrders, recentSubmissions, pendingPayments, overduePayments] = 
    await Promise.all([
      getDashboardStats(userId),
      getRecentOrders(userId, 5),
      getRecentSubmissions(userId, 10),
      getPendingPayments(userId),
      getOverduePayments(userId)
    ]);
    
  return {
    stats,
    recentOrders,
    recentSubmissions,
    pendingPayments,
    overduePayments
  };
}
```

#### Bulk Actions:
```typescript
// API endpoint: POST /api/submissions/bulk-action
async function handleBulkAction(req: Request) {
  const { action, submissionIds, messageTemplate } = req.body;
  
  switch (action) {
    case 'send_reminder':
      return await bulkSendReminders(submissionIds);
      
    case 'mark_paid':
      return await bulkMarkAsPaid(submissionIds);
      
    case 'send_custom_message':
      return await bulkSendCustomMessage(submissionIds, messageTemplate);
      
    case 'export_csv':
      return await exportSubmissionsCSV(submissionIds);
  }
}

async function bulkSendReminders(submissionIds: string[]) {
  const submissions = await getSubmissionsByIds(submissionIds);
  const results = [];
  
  for (const submission of submissions) {
    if (submission.status === 'pending') {
      const result = await whatsappService.sendPaymentReminder(submission);
      results.push({ submissionId: submission.id, ...result });
      
      // Update reminder tracking
      await updateReminderSent(submission.id);
    }
  }
  
  return results;
}
```

---

## Decision Points Required

### 1. **WhatsApp Integration Level**
**Decision Needed:** How deep should WhatsApp integration be?

**Options:**
- A) **Twilio Sandbox** (Free, limited to verified numbers)
- B) **Twilio Production** ($15/month + $0.005/message)  
- C) **WhatsApp Business API Direct** (Requires business verification)

**Recommendation Needed:** Which option for MVP launch?

### 2. **Payment Screenshot Upload**
**Decision Needed:** How should buyers upload payment proofs?

**Options:**
- A) **Web upload only** (Simple, works everywhere)
- B) **WhatsApp media upload** (Convenient, requires webhook handling)
- C) **Both options** (Best UX, more complexity)

**Recommendation Needed:** Which approach for MVP?

### 3. **AI Analysis Fallback**
**Decision Needed:** What happens when AI analysis fails?

**Options:**
- A) **Always flag for manual review** (Safe, but manual work)
- B) **Auto-approve if payment amount matches** (Risky but faster)
- C) **Partial automation based on confidence score** (Balanced approach)

**Recommendation Needed:** Fallback strategy preference?

### 4. **Multi-Platform Bot Hosting**
**Decision Needed:** How to handle multiple bot tokens/webhooks?

**Options:**
- A) **Single Vercel deployment** (Simple, might hit limits)
- B) **Separate services for each platform** (Scalable, more complex)
- C) **Queue-based processing** (Reliable, requires Redis/RabbitMQ)

**Recommendation Needed:** Architecture preference?

### 5. **Pricing Model for Platform Features**
**Decision Needed:** Which features should be free vs paid?

**Free Tier Proposal:**
- Up to 30 orders/month
- Basic WhatsApp integration
- Manual payment verification
- Single platform connection

**Pro Tier Proposal ($9/month):**
- Unlimited orders
- AI payment analysis
- Multi-platform integration
- Automated reminders

**Recommendation Needed:** Approve this pricing structure?

### 6. **Geographic Rollout**
**Decision Needed:** Should we support both PH and MY from day 1?

**Philippines Focus:**
- Deeper GCash/PayMaya integration
- Tagalog language support
- Philippine phone number validation

**Malaysia Addition:**
- Maybank2u/TNG integration  
- Ringgit currency
- Malaysian phone formats

**Recommendation Needed:** Single country first or both simultaneously?

---

## Implementation Timeline

### **Week 1: Core Foundation**
- Day 1-2: Database schema + Supabase setup
- Day 3-4: Authentication + basic CRUD
- Day 5: Order creation + public pages

### **Week 2: WhatsApp Integration** 
- Day 1-2: Twilio integration + message sending
- Day 3-4: Webhook handling + auto-replies
- Day 5: Order confirmation + reminder flows

### **Week 3: AI Payment Analysis**
- Day 1-2: OpenAI Vision API integration
- Day 3-4: Payment verification workflow
- Day 5: Auto-approval + manual review system

### **Week 4: Multi-Platform**
- Day 1-2: Telegram Bot implementation
- Day 3-4: Discord integration
- Day 5: Auto-distribution system

### **Week 5: Dashboard + Polish**
- Day 1-2: Dashboard with real-time updates
- Day 3-4: Bulk actions + admin features
- Day 5: Testing + bug fixes

---

## Required Environment Variables

```env
# Database
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Authentication
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=

# AI
OPENAI_API_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=

# Discord
DISCORD_BOT_TOKEN=

# App
BASE_URL=
WEBHOOK_SECRET=
```

---

## Next Steps

**Immediate Actions Required:**
1. **Make decisions on the 6 decision points above**
2. **Approve technical architecture**
3. **Confirm implementation timeline**
4. **Set up development environment**
5. **Begin Week 1 development**

**This document serves as the complete technical specification for GOMFLOW MVP development with Claude Code.**