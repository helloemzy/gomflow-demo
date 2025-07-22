# GOMFLOW MVP: Launch in 2 Weeks for <$500

## Executive Summary: Ultra-Lean MVP Strategy

**Goal**: Test market demand with 10 real GOMs in 2 weeks for under $500
**Core Hypothesis**: GOMs will pay $9/month to save 15+ hours of manual work
**Success Metrics**: 3 paying customers within 30 days

## The Brutal Truth: What We DON'T Need Yet

❌ **Microservices** - Overkill for 10 users
❌ **Custom payment processing** - Use existing tools
❌ **Mobile app** - Web-first
❌ **AI assistant** - Manual support initially
❌ **Multi-channel messaging** - WhatsApp only
❌ **Analytics dashboard** - Basic metrics only
❌ **Multi-region deployment** - Philippines only
❌ **Advanced security** - Basic auth sufficient

## The MVP: "GOMFLOW Lite"

### Core Value Proposition (30-second pitch)
*"Create beautiful order forms in 2 minutes, get payment notifications instantly via WhatsApp, and export shipping labels with one click. Stop spending 20 hours on spreadsheets."*

### Absolute Minimum Features

#### 1. **Simple Order Form Builder** (Day 1-3)
```
- 5 pre-built templates (album, photocard, merchandise, concert goods, limited edition)
- Basic fields: Item name, price, variant options, quantity, deadline
- Buyer form: Name, phone, quantity, payment proof upload
- Shareable link generation
- Mobile-responsive (most buyers use phones)
```

#### 2. **Payment Tracking Dashboard** (Day 4-6)
```
- Simple table view: Buyer name, item, amount, payment status
- Manual status updates (Pending → Paid → Shipped)
- Payment proof image viewer
- Basic order statistics (total orders, total revenue, pending count)
- CSV export for shipping labels
```

#### 3. **WhatsApp Notifications** (Day 7-8)
```
- New order notification to GOM
- Payment confirmation to buyer (manual trigger)
- Bulk status update messages
- Simple message templates
```

#### 4. **Basic GOM Dashboard** (Day 9-10)
```
- Login/signup with Google
- Create/edit/duplicate order forms
- View all orders in one place
- Basic profile settings
```

### Technical Architecture: "Good Enough" Stack

#### Frontend: Next.js (Vercel)
```typescript
// Ultra-simple tech stack
Framework: Next.js 14 (full-stack)
Database: Supabase (PostgreSQL + Auth)
Payments: Manual (screenshot verification initially)
Messaging: WhatsApp Business API (via Twilio)
Hosting: Vercel (free tier)
Storage: Supabase Storage (images)
Analytics: Vercel Analytics
```

#### Database Schema (Minimal)
```sql
-- 3 tables only
CREATE TABLE goms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gom_id UUID REFERENCES goms(id),
  title TEXT,
  description TEXT,
  items JSONB, -- [{name, price, variants}]
  deadline TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES forms(id),
  buyer_name TEXT,
  buyer_phone TEXT,
  items JSONB, -- [{item_id, quantity, variant}]
  total_amount DECIMAL,
  payment_proof_url TEXT,
  status TEXT DEFAULT 'pending', -- pending, paid, shipped
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Core Application Structure
```
gomflow-mvp/
├── pages/
│   ├── index.tsx              # Landing page
│   ├── signup.tsx             # GOM signup
│   ├── dashboard.tsx          # GOM dashboard
│   ├── form/[id].tsx          # Public order form
│   └── api/
│       ├── orders.ts          # Order CRUD
│       ├── forms.ts           # Form CRUD
│       └── whatsapp.ts        # WhatsApp webhook
├── components/
│   ├── FormBuilder.tsx        # Drag-drop form builder
│   ├── OrderTable.tsx         # Payment tracking table
│   └── WhatsAppSender.tsx     # Message composer
├── lib/
│   ├── supabase.ts           # Database client
│   ├── whatsapp.ts           # Twilio WhatsApp API
│   └── utils.ts              # Helpers
└── styles/
    └── globals.css           # Tailwind CSS
```

### Day-by-Day Development Plan

#### **Day 1-2: Setup & Landing Page**
```bash
# MVP Setup Checklist
□ Create Next.js project with TypeScript
□ Setup Supabase project (free tier)
□ Configure Google OAuth
□ Build landing page with signup
□ Deploy to Vercel
□ Setup custom domain (gomflow.com)
```

#### **Day 3-4: Form Builder**
```typescript
// Simple form builder component
const FormBuilder = () => {
  const [items, setItems] = useState([]);
  
  const addItem = () => {
    setItems([...items, {
      name: '',
      price: 0,
      variants: [],
      maxQuantity: 1
    }]);
  };
  
  // 5 pre-built templates for common K-pop items
  const templates = {
    album: { name: "Album Pre-order", price: 25, variants: ["Version A", "Version B"] },
    photocard: { name: "Photocard Set", price: 15, variants: ["Member 1", "Member 2"] },
    // ... 3 more templates
  };
};
```

#### **Day 5-6: Order Management**
```typescript
// Order tracking dashboard
const OrderDashboard = ({ formId }) => {
  const [orders, setOrders] = useState([]);
  
  const updateStatus = async (orderId, status) => {
    await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);
    
    // Send WhatsApp notification
    if (status === 'paid') {
      await sendWhatsApp(order.buyer_phone, 
        `✅ Payment confirmed for ${order.items[0].name}! We'll notify you when shipped.`);
    }
  };
  
  const exportCSV = () => {
    const csv = orders.map(o => 
      `${o.buyer_name},${o.buyer_phone},${o.items[0].name},${o.total_amount}`
    ).join('\n');
    downloadCSV(csv, `orders-${formId}.csv`);
  };
};
```

#### **Day 7-8: WhatsApp Integration**
```typescript
// Twilio WhatsApp integration (simplest possible)
const sendWhatsApp = async (to: string, message: string) => {
  const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  
  await client.messages.create({
    from: 'whatsapp:+14155238886', // Twilio sandbox
    to: `whatsapp:${to}`,
    body: message
  });
};

// Webhook for incoming messages
export default async function handler(req, res) {
  const { Body, From } = req.body;
  
  // Simple command handling
  if (Body.toLowerCase().includes('track')) {
    const orders = await getOrdersByPhone(From);
    const status = orders.length > 0 ? orders[0].status : 'not found';
    await sendWhatsApp(From, `Your order status: ${status}`);
  }
  
  res.status(200).send('OK');
}
```

#### **Day 9-10: Polish & Testing**
```typescript
// Essential features only
const essentials = {
  formValidation: true,
  errorHandling: true,
  basicSEO: true,
  mobileResponsive: true,
  loadingStates: true,
  successMessages: true
};

// Skip these for now
const skipForMVP = {
  advancedValidation: false,
  realTimeUpdates: false,
  imageOptimization: false,
  internationalPhoneFormat: false,
  multiLanguage: false
};
```

### Cost Breakdown (Total: <$500)

```yaml
Monthly Costs:
  Vercel Pro: $20/month (needed for Serverless Functions)
  Supabase Pro: $25/month (better limits)
  Domain: $12/year
  Twilio WhatsApp: $5-20/month (usage-based)
  
Total Monthly: $50-65
Setup Costs: $50 (domain, initial setup)
Development Time: $0 (founder time)

Total for 3 months: <$250
```

### Free Tier Strategy (First Month = $12)
```yaml
Vercel: Free (100GB bandwidth, 1000 serverless functions)
Supabase: Free (500MB database, 2GB storage, 50K API requests)
Twilio: $0 (use sandbox for testing)
Domain: $12/year
Google Auth: Free
Tailwind CSS: Free

Total Month 1: $12
```

### Launch Strategy: "Stealth Beta"

#### Week 1: Soft Launch
```
Target: 3 Filipino GOMs from existing networks
Method: Direct outreach to known GOMs on Twitter/Instagram
Offer: Free for 3 months + personal onboarding call
Goal: Validate core workflow and get feedback
```

#### Week 2: Limited Beta
```
Target: 10 total GOMs (expand to Thailand/Indonesia)
Method: 
  - Referrals from Week 1 users
  - Posts in K-pop Facebook groups
  - Direct messages to active GOMs
Offer: 50% off first year ($4.50/month)
Goal: Prove people will pay and use it regularly
```

### Success Metrics (Prove/Disprove Hypotheses)

#### Primary Metrics (Week 1-2)
```
□ 3 GOMs complete onboarding
□ 30+ orders processed through the platform
□ Average 10+ hours saved per GOM (self-reported)
□ 80%+ of orders marked as "paid" within 48 hours
□ Zero critical bugs reported
```

#### Conversion Metrics (Week 3-4)
```
□ 30% of beta users convert to paid
□ 2+ referrals from satisfied users
□ $27+ MRR (3 paying users × $9)
□ 90%+ user satisfaction score
□ Feature requests indicate product-market fit
```

### Risk Mitigation

#### Technical Risks
```
Risk: Supabase free tier limits
Mitigation: Upgrade to Pro ($25/month) if needed

Risk: WhatsApp sandbox limitations
Mitigation: Apply for production access immediately

Risk: Vercel function limits
Mitigation: Optimize for minimal API calls, cache aggressively
```

#### Market Risks
```
Risk: GOMs don't want to change workflow
Mitigation: Make onboarding identical to current process

Risk: Payment integration too complex
Mitigation: Start with manual verification, add automation later

Risk: Not enough time savings
Mitigation: Track actual time saved, optimize biggest pain points
```

### What Happens If It Works?

#### Month 2-3: Double Down
```
□ Add 2C2P payment integration (real automation)
□ Improve WhatsApp templates and bulk messaging
□ Add order analytics dashboard
□ Target 50 paying GOMs
□ Implement referral program
```

#### Month 4-6: Scale Foundation
```
□ Build proper mobile app
□ Add Telegram and Discord integration
□ Launch affiliate/referral system
□ Expand to Malaysia and Singapore
□ Target 200 paying GOMs
```

### What Happens If It Doesn't Work?

#### Pivot Options (Based on Feedback)
```
Option 1: Focus on buyers instead of GOMs
  - Group order discovery platform
  - Price comparison tool
  - Order tracking for buyers

Option 2: B2B tool for brands
  - Help brands manage their own group orders
  - White-label solution for distributors
  - Analytics for merchandise demand

Option 3: Broader commerce tool
  - General-purpose form builder for SEA
  - Focus on pre-orders and crowdfunding
  - Expand beyond entertainment merchandise
```

## The 48-Hour Test

Before building anything, spend 48 hours validating demand:

1. **Create landing page** (Carrd.co - $19/year)
2. **Run Facebook ads** targeting GOMs ($50 budget)
3. **Measure signups** for "early access"
4. **Interview 5 GOMs** about their current pain points
5. **If <100 signups**, reconsider the approach

## MVP Feature Roadmap (Post-Launch)

### Week 3-4: Based on User Feedback
```
Most Requested → Build First:
□ Automated payment notifications
□ Better mobile experience  
□ Inventory tracking
□ Multiple payment methods
□ Batch messaging improvements
```

### Month 2: Retention Features
```
□ Order templates and duplication
□ Customer database for repeat buyers
□ Basic analytics (best-selling items, peak order times)
□ Integration with Google Sheets (familiar workflow)
```

### Month 3: Growth Features
```
□ Referral program
□ Public GOM directory
□ Social sharing tools
□ Basic API for power users
```

## Final Reality Check

**This MVP tests the core hypothesis**: GOMs will pay for a tool that saves them 15+ hours per order cycle.

**What we're NOT testing**: Advanced features, perfect UX, scalability, or comprehensive functionality.

**What we ARE testing**: Basic workflow improvement, willingness to pay, and core value proposition.

**If successful**: We'll have 3+ paying customers and clear direction for iteration.
**If unsuccessful**: We'll have spent <$500 and 2 weeks to learn the market isn't ready.

The goal isn't to build the final product—it's to prove that someone, somewhere, will pay for a solution to this problem.

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"id": "1", "content": "Define absolute minimum features for market validation", "status": "completed", "priority": "high"}, {"id": "2", "content": "Design simple tech stack using existing tools", "status": "completed", "priority": "high"}, {"id": "3", "content": "Create 2-week launch plan", "status": "completed", "priority": "high"}, {"id": "4", "content": "Identify cost-cutting opportunities", "status": "completed", "priority": "medium"}]