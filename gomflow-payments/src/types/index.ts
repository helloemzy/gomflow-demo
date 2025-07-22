import { z } from 'zod'

// Re-export shared types
export * from '@gomflow/shared'

// Payment gateway specific types
export type PaymentGateway = 'paymongo' | 'billplz'

// PayMongo specific types
export interface PayMongoPaymentIntent {
  id: string
  type: 'payment_intent'
  attributes: {
    amount: number
    currency: 'PHP'
    description: string
    statement_descriptor: string
    status: 'awaiting_payment_method' | 'awaiting_next_action' | 'processing' | 'succeeded' | 'cancelled'
    livemode: boolean
    client_key: string
    created_at: number
    updated_at: number
    last_payment_error?: any
    payment_method_allowed: string[]
    payments: PayMongoPayment[]
    next_action?: {
      type: string
      redirect?: {
        url: string
        return_url: string
      }
    }
    payment_method_options?: any
    description?: string
    statement_descriptor?: string
    metadata?: Record<string, any>
  }
}

export interface PayMongoPayment {
  id: string
  type: 'payment'
  attributes: {
    access_url?: string
    amount: number
    balance_transaction_id: string
    billing?: any
    currency: 'PHP'
    description: string
    disputed: boolean
    external_reference_number: string
    fee: number
    foreign_fee: number
    livemode: boolean
    net_amount: number
    origin: string
    payment_intent_id: string
    payout?: string
    source: PayMongoSource
    statement_descriptor: string
    status: 'pending' | 'paid' | 'failed' | 'cancelled'
    tax_amount?: number
    refunds: any[]
    taxes: any[]
    available_at: number
    created_at: number
    credited_at?: number
    paid_at?: number
    updated_at: number
    metadata?: Record<string, any>
  }
}

export interface PayMongoSource {
  id: string
  type: 'source'
  attributes: {
    amount: number
    billing?: any
    currency: 'PHP'
    description: string
    livemode: boolean
    redirect: {
      checkout_url: string
      failed: string
      success: string
    }
    status: 'pending' | 'chargeable' | 'cancelled' | 'expired' | 'paid'
    type: 'gcash' | 'grab_pay' | 'paymaya' | 'card'
    created_at: number
    updated_at: number
    metadata?: Record<string, any>
  }
}

export interface PayMongoCheckoutSession {
  id: string
  type: 'checkout_session'
  attributes: {
    billing?: any
    cancel_url: string
    checkout_url: string
    customer_email?: string
    description: string
    line_items: Array<{
      amount: number
      currency: 'PHP'
      description: string
      name: string
      quantity: number
    }>
    livemode: boolean
    payment_method_types: string[]
    reference_number: string
    send_email_receipt: boolean
    show_description: boolean
    show_line_items: boolean
    status: 'active' | 'expired'
    success_url: string
    created_at: number
    updated_at: number
    metadata?: Record<string, any>
  }
}

// Billplz specific types
export interface BillplzBill {
  id: string
  collection_id: string
  paid: boolean
  state: 'overdue' | 'paid' | 'due'
  amount: string
  paid_amount: string
  due_at: string
  email: string
  mobile?: string
  name: string
  url: string
  reference_1_label?: string
  reference_1?: string
  reference_2_label?: string
  reference_2?: string
  redirect_url?: string
  callback_url: string
  description: string
  paid_at?: string
  created_at: string
  updated_at: string
}

export interface BillplzWebhook {
  id: string
  collection_id: string
  paid: boolean
  state: 'paid'
  amount: string
  paid_amount: string
  due_at: string
  email: string
  mobile?: string
  name: string
  url: string
  paid_at: string
  transaction_id?: string
  transaction_status?: string
  x_signature: string
}

// Webhook event types
export interface PayMongoWebhookEvent {
  data: {
    id: string
    type: 'event'
    attributes: {
      type: 'payment_intent.payment_failed' | 'payment_intent.succeeded' | 'payment.paid' | 'payment.failed' | 'source.chargeable'
      livemode: boolean
      data: PayMongoPaymentIntent | PayMongoPayment | PayMongoSource
      previous_data?: any
      created_at: number
      updated_at: number
    }
  }
}

// Request/Response schemas
export const CreatePaymentSessionSchema = z.object({
  submission_id: z.string().uuid(),
  payment_method: z.enum(['gcash', 'paymaya', 'grab_pay', 'card', 'fpx', 'bank_transfer']),
  return_url: z.string().url(),
  cancel_url: z.string().url(),
  webhook_url: z.string().url().optional()
})

export const ProcessWebhookSchema = z.object({
  gateway: z.enum(['paymongo', 'billplz']),
  signature: z.string(),
  payload: z.any()
})

export type CreatePaymentSessionRequest = z.infer<typeof CreatePaymentSessionSchema>
export type ProcessWebhookRequest = z.infer<typeof ProcessWebhookSchema>

// Payment session response
export interface PaymentSessionResponse {
  session_id: string
  payment_url: string
  gateway: PaymentGateway
  payment_method: string
  amount: number
  currency: 'PHP' | 'MYR'
  expires_at: string
  metadata: {
    submission_id: string
    payment_reference: string
    order_title: string
  }
}

// Service response types
export interface PaymentServiceResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Queue job types
export interface WebhookProcessingJob {
  gateway: PaymentGateway
  event_type: string
  event_id: string
  submission_id?: string
  payment_data: any
  webhook_data: any
}

export interface PaymentConfirmationJob {
  submission_id: string
  payment_transaction_id: string
  gateway: PaymentGateway
  amount: number
  currency: 'PHP' | 'MYR'
  paid_at: string
  gateway_payment_id: string
}

export interface PaymentRefundJob {
  submission_id: string
  payment_transaction_id: string
  gateway: PaymentGateway
  amount: number
  currency: 'PHP' | 'MYR'
  reason: string
  gateway_refund_id?: string
}