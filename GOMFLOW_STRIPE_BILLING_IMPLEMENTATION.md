# GOMFLOW Stripe Billing System Implementation

This document outlines the complete Stripe integration for GOMFLOW's subscription billing system, enabling actual revenue collection from Southeast Asian customers.

## 🏗️ Architecture Overview

The billing system consists of:
- **Stripe Integration Service** - Core Stripe API operations
- **Billing Service Layer** - Business logic and database integration
- **Webhook Processing** - Real-time event handling from Stripe
- **Invoice Management** - Email notifications and PDF generation
- **API Endpoints** - Frontend integration points

## 📁 File Structure

```
gomflow-core/
├── src/
│   ├── lib/payments/
│   │   └── stripe.ts                    # Core Stripe integration
│   ├── services/billing/
│   │   ├── stripeService.ts            # High-level billing service
│   │   └── invoiceService.ts           # Invoice and email handling
│   └── app/api/payments/
│       ├── webhooks/stripe/route.ts    # Stripe webhook handler
│       ├── methods/route.ts            # Payment methods API (updated)
│       ├── subscriptions/route.ts      # Subscription management API
│       ├── invoices/route.ts           # Invoice management API
│       └── billing/route.ts            # Billing dashboard API
└── supabase/migrations/
    └── 20250125000001_subscription_billing.sql  # Database schema
```

## 🗄️ Database Schema

### Core Tables Added

1. **customers** - Stripe customer data linked to GOMFLOW users
2. **subscriptions** - Active and historical subscription records
3. **stripe_payment_methods** - Stored payment methods for recurring billing
4. **invoices** - Invoice records with payment status
5. **invoice_line_items** - Individual line items for each invoice
6. **billing_events** - Audit log of all Stripe webhook events
7. **billing_notifications** - Email notifications sent for billing events

### Key Features

- **Row Level Security (RLS)** on all tables
- **Automated triggers** for subscription status updates
- **Multi-currency support** (PHP, MYR)
- **Tax calculation functions**
- **Comprehensive indexing** for performance

## 🔧 Core Services

### 1. StripeService (`/lib/payments/stripe.ts`)

Low-level Stripe API integration with:
- Customer management (create, update, retrieve)
- Payment method handling (setup intents, card management)
- Subscription lifecycle (create, update, cancel, reactivate)
- Invoice operations (retrieve, pay, send)
- Southeast Asia payment method support
- Error handling with user-friendly messages

**Key Features:**
- Multi-currency pricing (PHP/MYR)
- Regional payment methods (GCash, GrabPay, FPX, etc.)
- Tax calculation for Philippines (12% VAT) and Malaysia (6% GST)
- Webhook signature verification

### 2. StripeBillingService (`/services/billing/stripeService.ts`)

High-level business logic layer:
- Customer synchronization with database
- Subscription status management
- Payment method synchronization
- Invoice listing and management
- Billing analytics and statistics

**Key Methods:**
- `createOrSyncCustomer()` - Ensures customer exists in both Stripe and database
- `createSubscription()` - Handles complete subscription creation flow
- `getSubscriptionStatus()` - Returns user's current billing status
- `listPaymentMethods()` - Syncs and returns payment methods

### 3. InvoiceService (`/services/billing/invoiceService.ts`)

Email notifications and invoice management:
- Payment success notifications
- Payment failure alerts with retry information
- Upcoming invoice reminders
- Trial ending notifications
- Professional HTML email templates
- Integration with Resend API for email delivery

**Email Templates:**
- Payment confirmation with receipt details
- Payment failure with troubleshooting steps
- Upcoming renewal reminders
- Trial ending notifications with conversion prompts

## 🔗 API Endpoints

### Payment Methods (`/api/payments/methods`)

**Enhanced Endpoints:**
- `GET ?action=stripe` - List Stripe payment methods
- `GET ?action=setup` - Create setup intent for adding payment methods
- `PUT` with `type=stripe` - Manage Stripe payment methods (set default, detach)

### Subscriptions (`/api/payments/subscriptions`)

**New Endpoints:**
- `GET ?action=status` - Get subscription status
- `GET ?action=active` - Get active subscription
- `POST` - Create new subscription
- `PUT` - Cancel, reactivate, or modify subscription
- `DELETE` - Immediately cancel subscription

### Invoices (`/api/payments/invoices`)

**New Endpoints:**
- `GET` - List user's invoices
- `GET ?action=upcoming` - Get upcoming invoice
- `POST` - Pay or send invoice
- Individual invoice details endpoint

### Billing Dashboard (`/api/payments/billing`)

**New Endpoints:**
- `GET ?action=user-status` - Complete user billing info
- `GET ?action=stats` - Platform billing statistics (admin only)
- `POST` - Handle billing actions (retry payments, notifications)

## 🔄 Webhook Processing

### Supported Events

The webhook handler (`/api/payments/webhooks/stripe/route.ts`) processes:

**Customer Events:**
- `customer.created` - Sync new customer data
- `customer.updated` - Update customer information
- `customer.deleted` - Mark customer as inactive

**Subscription Events:**
- `customer.subscription.created` - Create subscription record
- `customer.subscription.updated` - Update subscription status
- `customer.subscription.deleted` - Cancel subscription
- `customer.subscription.trial_will_end` - Send trial ending notification

**Invoice Events:**
- `invoice.created` - Create invoice record
- `invoice.finalized` - Update invoice with PDF links
- `invoice.payment_succeeded` - Send payment confirmation
- `invoice.payment_failed` - Send payment failure notification
- `invoice.upcoming` - Send renewal reminder

**Payment Method Events:**
- `payment_method.attached` - Sync payment method
- `payment_method.detached` - Remove payment method
- `setup_intent.succeeded` - Confirm payment method setup

### Error Handling

- All events logged to `billing_events` table for audit trail
- Failed webhook processing triggers retry mechanism
- Comprehensive error logging and monitoring
- Signature verification for security

## 💰 Pricing Configuration

### Southeast Asia Pricing Tiers

**Philippines (PHP):**
- Pro Monthly: ₱599 (`STRIPE_PRO_MONTHLY_PHP_PRICE_ID`)
- Pro Yearly: ₱5,999 (2 months free)
- Gateway Monthly: ₱1,199 (`STRIPE_GATEWAY_MONTHLY_PHP_PRICE_ID`)
- Gateway Yearly: ₱11,999 (2 months free)

**Malaysia (MYR):**
- Pro Monthly: RM29 (`STRIPE_PRO_MONTHLY_MYR_PRICE_ID`)
- Pro Yearly: RM299 (2 months free)
- Gateway Monthly: RM59 (`STRIPE_GATEWAY_MONTHLY_MYR_PRICE_ID`)
- Gateway Yearly: RM599 (2 months free)

### Tax Handling
- **Philippines**: 12% VAT automatically calculated
- **Malaysia**: 6% GST automatically calculated
- Tax amounts stored separately in invoice records

## 🔐 Security Features

### PCI Compliance
- No card data stored in GOMFLOW database
- All sensitive data handled by Stripe
- Webhook signature verification required
- Environment variable protection for API keys

### Access Control
- Row Level Security (RLS) on all billing tables
- User can only access their own billing data
- Admin-only endpoints for platform statistics
- JWT authentication for all API calls

### Data Protection
- Customer data encryption at rest
- Secure webhook endpoint with signature verification
- Audit trail for all billing events
- GDPR-compliant data handling

## 🚀 Deployment Requirements

### Environment Variables

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs for each plan and country
STRIPE_PRO_MONTHLY_PHP_PRICE_ID=price_...
STRIPE_PRO_YEARLY_PHP_PRICE_ID=price_...
STRIPE_GATEWAY_MONTHLY_PHP_PRICE_ID=price_...
STRIPE_GATEWAY_YEARLY_PHP_PRICE_ID=price_...
STRIPE_PRO_MONTHLY_MYR_PRICE_ID=price_...
STRIPE_PRO_YEARLY_MYR_PRICE_ID=price_...
STRIPE_GATEWAY_MONTHLY_MYR_PRICE_ID=price_...
STRIPE_GATEWAY_YEARLY_MYR_PRICE_ID=price_...

# Email Configuration
BILLING_EMAIL_FROM=billing@gomflow.com
BILLING_EMAIL_REPLY_TO=support@gomflow.com
RESEND_API_KEY=re_...
```

### Database Migration

Run the subscription billing migration:
```bash
supabase migration up --include 20250125000001_subscription_billing
```

### Stripe Setup

1. **Create Products and Prices** in Stripe Dashboard
2. **Configure Webhook Endpoint**: `https://your-domain.com/api/payments/webhooks/stripe`
3. **Enable Payment Methods** for Southeast Asia:
   - Cards (Visa, Mastercard)
   - GrabPay (PH/MY)
   - GCash (PH)
   - PayMaya (PH)
   - FPX (MY)
4. **Set up Tax Rates** for Philippines (12%) and Malaysia (6%)

## 🧪 Testing

### Test Cards for Development

```javascript
// Philippines test cards
const testCards = {
  visa: '4000007020000003',        // PH Visa
  mastercard: '5555555555554444',  // Standard Mastercard
  declined: '4000000000000002',    // Always declined
};
```

### Webhook Testing

Use Stripe CLI for local webhook testing:
```bash
stripe listen --forward-to localhost:3000/api/payments/webhooks/stripe
```

## 📊 Analytics and Monitoring

### Billing Dashboard Metrics

- Total customers and active subscriptions
- Monthly Recurring Revenue (MRR) and Annual Recurring Revenue (ARR)
- Churn rate and trial conversion rates
- Failed payments and retry success rates
- Revenue by country and plan type

### Email Notification Tracking

- Delivery status for all billing emails
- Open and click rates (if using advanced email service)
- Failed notification retry mechanism
- Customer engagement with billing communications

## 🔧 Maintenance Tasks

### Regular Monitoring

1. **Failed Payments**: Monitor and follow up on payment failures
2. **Webhook Health**: Ensure webhook endpoints are responding
3. **Email Delivery**: Monitor billing notification delivery rates
4. **Subscription Health**: Track trial conversions and churn

### Monthly Reports

- Revenue by plan and country
- Customer acquisition and retention metrics
- Payment method usage statistics
- Support ticket analysis related to billing

## 🚨 Troubleshooting

### Common Issues

1. **Webhook Failures**
   - Check webhook endpoint configuration in Stripe
   - Verify webhook secret environment variable
   - Monitor `billing_events` table for processing errors

2. **Payment Failures**
   - Check customer's payment method status
   - Verify tax calculation accuracy
   - Review Stripe Dashboard for decline reasons

3. **Email Delivery Issues**
   - Verify Resend API key configuration
   - Check billing notification status in database
   - Monitor email service quotas and limits

### Support Workflows

1. **Subscription Issues**: Direct customers to billing dashboard
2. **Payment Problems**: Guide through payment method update process
3. **Invoice Questions**: Provide direct links to Stripe-hosted invoices
4. **Cancellation Requests**: Process through subscription management API

## 🔮 Future Enhancements

### Planned Features

1. **Dunning Management**: Advanced retry logic for failed payments
2. **Usage-Based Billing**: Metered billing for high-volume customers
3. **Multi-seat Subscriptions**: Team and enterprise billing
4. **Advanced Analytics**: Cohort analysis and lifetime value tracking
5. **Regional Payment Methods**: Bank transfers, local wallets
6. **Invoice Customization**: Branded invoices with custom fields

### Integration Opportunities

1. **Accounting Software**: QuickBooks, Xero integration
2. **CRM Systems**: Customer data synchronization
3. **Support Tools**: Automatic ticket creation for billing issues
4. **Marketing Automation**: Billing event-triggered campaigns

---

This implementation provides a robust, secure, and scalable billing system that enables GOMFLOW to collect recurring revenue from customers across Southeast Asia while maintaining compliance with local tax requirements and payment preferences.