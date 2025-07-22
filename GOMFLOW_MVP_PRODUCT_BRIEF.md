# GOMFLOW MVP: Product Brief & Design Document
## The Linktree for Group Orders

### Executive Summary

**Product Name**: GOMFLOW MVP  
**Tagline**: "Create beautiful order pages in 30 seconds"  
**Launch Timeline**: 5 days  
**Budget**: $12 (domain only)  
**Target**: 10 GOMs processing 300+ orders in first 30 days  

**Core Value Proposition**: Give GOMs a professional storefront link they can share anywhere, eliminating the chaos of Google Forms and manual payment tracking.

---

## The Problem (Refined)

Current GOM workflow:
1. Create Google Form (ugly, no payment info, limited)
2. Share link across multiple platforms repeatedly
3. Answer "how do I pay?" 50+ times
4. Track payments in spreadsheet hell
5. No professional presence or trust signals

**The Insight**: GOMs don't need complex software - they need a professional-looking page that handles the basics and works with their existing distribution channels.

---

## The Solution: GOMFLOW Links

### One-Line Pitch
"Linktree for group orders - create a beautiful order page with payment instructions in 30 seconds and share one link everywhere."

### How It Works
1. **Sign up** (Google auth, 10 seconds)
2. **Create a drop** (product info + payment methods, 30 seconds)  
3. **Get your link** (`gomflow.link/yourname/seventeen-album`)
4. **Share anywhere** (WhatsApp, Twitter, Discord, Instagram bio)
5. **Track orders** (simple list with payment status)

---

## User Personas (Ultra-Focused)

### Primary: Sarah the Overworked GOM
- **Current pain**: Spends 3 hours setting up each group order across platforms
- **Behavior**: Copies and pastes the same payment info 100+ times
- **Need**: One professional link that works everywhere
- **Success metric**: Sets up new drops in under 1 minute

### Secondary: Lisa the Anxious Buyer  
- **Current pain**: Confused about payment methods and order status
- **Behavior**: DMs GOM repeatedly asking for payment details
- **Need**: Clear, professional page with all info in one place
- **Success metric**: Completes order without needing to DM

---

## Feature Set (Absolute Minimum)

### V1.0 - Launch Week (Days 1-5)

#### 1. GOM Dashboard (Bare Minimum)
```
- Google login/signup
- Create/edit drops (max 5 fields)
- View orders list
- Toggle order status (pending/paid)
- Copy link button
```

#### 2. Drop Creation (30 Seconds or Less)
```
Required Fields Only:
- Product name
- Price
- Description (optional)
- Deadline
- Payment instructions (text field)

That's it. No variants, no inventory, no complexity.
```

#### 3. Public Drop Page (Mobile-First)
```
Elements:
- Product info
- Countdown timer to deadline
- Order form (name, phone, quantity)
- Payment instructions (clearly displayed)
- "Order Submitted" confirmation
```

#### 4. Order Management (Simplest Possible)
```
- List view: Buyer name | Phone | Quantity | Total | Status
- Click to toggle: Pending ↔ Paid
- Export CSV button
- Running totals at top
```

### What We're NOT Building (Yet)
- ❌ Payment gateway integration
- ❌ Automated messaging
- ❌ Complex variants/options  
- ❌ Inventory tracking
- ❌ Analytics beyond basic counts
- ❌ Multi-language support
- ❌ Team features
- ❌ API

---

## Technical Specifications

### Tech Stack (Production-Ready but Minimal)

```yaml
Frontend:
  Framework: Next.js 14 (App Router)
  Styling: Tailwind CSS + shadcn/ui components
  State: React hooks (no Redux needed)
  
Backend:
  Database: Supabase (PostgreSQL)
  Auth: Supabase Auth (Google OAuth)
  Storage: Supabase Storage (for future payment proofs)
  
Hosting:
  Platform: Vercel (free tier)
  Domain: gomflow.link ($12/year)
  
Analytics:
  Basic: Vercel Analytics (free)
  
Total Infrastructure Cost: $0/month for first 1000 users
```

### Database Schema (3 Tables Only)

```sql
-- Users (GOMs)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  username TEXT UNIQUE, -- for URL: gomflow.link/username
  created_at TIMESTAMP DEFAULT NOW()
);

-- Drops (Products)
CREATE TABLE drops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL, -- URL slug
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'PHP',
  deadline TIMESTAMP,
  payment_instructions TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drop_id UUID REFERENCES drops(id) ON DELETE CASCADE,
  buyer_name TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  total_amount DECIMAL(10,2),
  status TEXT DEFAULT 'pending', -- pending, paid
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_drops_user_id ON drops(user_id);
CREATE INDEX idx_drops_slug ON drops(slug);
CREATE INDEX idx_orders_drop_id ON orders(drop_id);
CREATE INDEX idx_orders_status ON orders(status);
```

### URL Structure

```
Landing: gomflow.link
GOM Dashboard: gomflow.link/dashboard
Create Drop: gomflow.link/dashboard/new
Edit Drop: gomflow.link/dashboard/edit/[id]
Public Drop: gomflow.link/[username]/[drop-slug]

Example: gomflow.link/sarah/seventeen-album-july
```

### Core User Flows

#### Flow 1: GOM Creates First Drop
```
1. Lands on gomflow.link
2. "Create your first drop - free" button
3. Google sign-in
4. Username selection (one-time)
5. Drop creation form (5 fields)
6. Success page with copy-able link
7. Redirect to orders page
```

#### Flow 2: Buyer Places Order
```
1. Clicks GOM's link from WhatsApp/Twitter
2. Sees professional product page
3. Enters name, phone, quantity
4. Sees payment instructions clearly
5. Submits order
6. Sees confirmation with order number
7. Screenshots payment page (no upload in MVP)
```

#### Flow 3: GOM Manages Orders
```
1. Dashboard shows active drops
2. Clicks drop to see orders
3. Marks orders as paid after checking payment
4. Exports CSV when ready to order from supplier
```

---

## UI/UX Design Specifications

### Design Principles
1. **Mobile-first**: 90% of buyers use phones
2. **Speed**: Every page loads in <1 second  
3. **Clarity**: No confusion about next steps
4. **Trust**: Professional appearance builds credibility

### Brand Identity
```
Primary Color: #8B5CF6 (Purple - K-pop associated)
Secondary: #F59E0B (Amber - CTA buttons)
Background: #FAFAFA (Off-white)
Text: #1F2937 (Dark gray)
Font: Inter (fast-loading, professional)
```

### Page Layouts

#### 1. Landing Page (gomflow.link)
```
[GOMFLOW Logo]

Create beautiful order pages 
in 30 seconds

[Create Your First Drop →] (CTA button)

✓ Professional storefront link
✓ Payment instructions included  
✓ Track orders easily
✓ Free to start

[Example drop page preview]

Trusted by 50+ GOMs
```

#### 2. Drop Page (Mobile View)
```
[Profile: @username ✓]

[Product Image - optional]

SEVENTEEN GOD OF MUSIC ALBUM
₱850 per album

Deadline: July 30, 2025
[⏰ 5 days 12 hours left]

📝 Description:
Includes all inclusions, 
POB from Target, etc.

[Order Now ↓] (Sticky button)

--- Order Form ---
Your Name*
[________________]

Phone Number* 
[________________]

Quantity*
[-] 1 [+]

Total: ₱850

[Continue →]

--- Payment Page ---
💳 How to Pay:

GCash: 09171234567
Name: Sarah Cruz

BPI: 1234-5678-90
Name: Sarah Cruz

[Submit Order]

--- Confirmation ---
✅ Order Received!
Order #: GF-2837

Please send payment and 
screenshot to GOM via DM.

[Copy Payment Details]
```

#### 3. Dashboard (Desktop View)
```
GOMFLOW                    Hi, Sarah [Sign Out]

Your Drops                              [+ New Drop]

Active Drops (2)
┌─────────────────────────────────────────────────┐
│ SEVENTEEN Album                    23 orders     │
│ gomflow.link/sarah/seventeen      ₱19,550       │
│ Ends in 3 days                    [View] [Edit] │
├─────────────────────────────────────────────────┤
│ NCT Photocard Set                 12 orders     │
│ gomflow.link/sarah/nct-pc         ₱3,600        │
│ Ends in 7 days                    [View] [Edit] │
└─────────────────────────────────────────────────┘

Past Drops (5)                              [View All]
```

#### 4. Orders View
```
SEVENTEEN Album - Orders

Summary: 23 orders | ₱19,550 total | 18 paid

[Export CSV]

Search: [____________]  Filter: [All ▼]

┌────────────────────────────────────────────────┐
│ □ | Buyer        | Phone      | Qty | Total | Status │
├────────────────────────────────────────────────┤
│ □ | Anna Lee     | 0917...567 | 2   | ₱1700 | ● Paid │
│ □ | John Cruz    | 0922...123 | 1   | ₱850  | ○ Pending │
│ □ | Lisa Park    | 0919...789 | 3   | ₱2550 | ● Paid │
└────────────────────────────────────────────────┘

Click status to toggle pending/paid
```

---

## Development Plan (5 Days)

### Day 1: Foundation
```
□ Next.js project setup with TypeScript
□ Supabase project creation and schema
□ Google OAuth configuration  
□ Basic routing structure
□ Tailwind + shadcn/ui setup
□ Deploy to Vercel, connect domain
```

### Day 2: Authentication & Drop Creation
```
□ Google sign-in flow
□ Username selection on first login
□ Drop creation form (5 fields)
□ Drop CRUD operations
□ Unique URL generation
□ Basic form validation
```

### Day 3: Public Drop Pages
```
□ Public drop page route handler
□ Mobile-responsive drop page
□ Order form with validation
□ Payment instructions display
□ Order submission to database
□ Confirmation page
```

### Day 4: Order Management
```
□ Orders list view
□ Payment status toggle
□ CSV export functionality
□ Basic search/filter
□ Order counts and totals
□ Dashboard home page
```

### Day 5: Polish & Launch
```
□ Loading states and error handling
□ SEO meta tags
□ Social sharing preview
□ Test with 3 beta GOMs
□ Fix critical bugs only
□ Launch announcement prep
```

---

## Success Metrics (First 30 Days)

### Primary KPIs
- **10 active GOMs** (signed up and created drops)
- **300+ orders processed** (30 average per GOM)
- **80% mobile traffic** (validates mobile-first approach)
- **<1 minute average drop creation time**

### Secondary KPIs
- **3 GOMs convert to requesting paid features**
- **50% of GOMs create multiple drops**
- **90% of orders marked as "paid" within 48 hours**
- **Zero critical bugs reported**

### Learning Goals
1. Which payment methods are most used?
2. What features do GOMs ask for most?
3. What's the average order value?
4. How do buyers discover the drops?

---

## Go-to-Market Strategy

### Week 1: Friends & Family
```
Target: 3 GOMs from personal network
Channel: Direct WhatsApp messages
Offer: Free forever for early adopters
Goal: Validate core workflow
```

### Week 2: Soft Launch
```
Target: 10 GOMs total
Channel: 
- Twitter/X posts in #GOManager tags
- Reddit r/kpophelp
- Facebook K-pop buy/sell groups
Offer: "Be our first 10 users"
Goal: Reach 300 orders processed
```

### Week 3-4: Feedback & Iteration
```
- Daily check-ins with active users
- Build most requested feature
- Prepare for paid tier launch
- Document success stories
```

---

## Future Roadmap (Post-MVP)

### Month 2: The Essentials
```
□ Payment proof uploads
□ WhatsApp integration (one-way notifications)
□ Variants/options for products
□ Basic analytics dashboard
□ Subscription billing ($9/month)
```

### Month 3: Growth Features
```
□ Multiple payment methods per drop
□ Inventory/quota tracking
□ Buyer messaging system
□ GOM profile pages
□ Social proof widgets
```

### Month 6: Platform Vision
```
□ Full payment gateway integration
□ Multi-channel messaging
□ Fan Intelligence dashboard
□ B2B API for brands
□ Mobile app
```

---

## Risk Mitigation

### Technical Risks
```
Risk: Supabase free tier limits
Mitigation: 500MB is ~500K orders, upgrade at $25/month if needed

Risk: Vercel function timeouts
Mitigation: Keep all operations under 10 seconds, use edge functions

Risk: Domain gets blocked
Mitigation: Register backup domains, use subdomains if needed
```

### Market Risks
```
Risk: GOMs don't want to change tools
Mitigation: Works alongside current tools, not replacement

Risk: Buyers confused by new flow
Mitigation: Make it clearer than Google Forms

Risk: Payment disputes
Mitigation: Clear disclaimer - we don't process payments (yet)
```

---

## Decision Log

### Why these choices?

1. **Linktree model**: Familiar pattern, proven to work
2. **No payment processing**: Reduces complexity by 90%
3. **Single link focus**: Solves #1 pain - sharing payment info repeatedly
4. **5 fields only**: Forces ultra-simple first version
5. **Supabase**: Free tier generous, scales well, includes auth
6. **No messaging**: GOMs already have distribution channels

### What we're betting on

The core bet: **GOMs want a professional storefront more than automation**. 

If true, we can add automation later. If false, we learn in 5 days for $12.

---

## Summary

GOMFLOW MVP is a 5-day experiment to validate that GOMs will use a link-in-bio style tool for group orders. By stripping everything except the core value (professional order pages), we can test the market with minimal investment and maximum learning speed.

**The dream**: In 30 days, Sarah the GOM posts "Just discovered @gomflow - turned my chaotic Google Forms into a professional shop in literally 30 seconds 🤯"

**The reality**: We'll know in 5 days if this solves a real problem.

---

*Document Version: 1.0*  
*Last Updated: July 2024*  
*Product Owner: Emily Ho (emily@gomflow.com)*