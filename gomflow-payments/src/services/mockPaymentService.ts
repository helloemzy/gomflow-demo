/**
 * Mock Payment Service for Demo Environment
 * Simulates PayMongo and Billplz payment flows without real API calls
 */

import { Config } from '@/config'
import { logger } from '@/utils/logger'
import {
  PaymentSessionResponse,
  CreatePaymentSessionRequest,
  PayMongoPaymentIntent,
  BillplzBill,
  PaymentMethod,
  PaymentStatus
} from '@/types'

export class MockPaymentService {
  private static simulatedDelay = parseInt(process.env.MOCK_PAYMENT_DELAY || '2000')
  private static successRate = parseFloat(process.env.SIMULATE_PAYMENT_SUCCESS_RATE || '0.9')

  /**
   * Mock PayMongo payment session creation
   */
  static async createPayMongoSession(request: CreatePaymentSessionRequest): Promise<PaymentSessionResponse> {
    logger.info('🎭 Mock PayMongo: Creating payment session', {
      amount: request.amount,
      currency: request.currency,
      country: request.country
    })

    // Simulate API delay
    await this.delay(this.simulatedDelay)

    // Simulate occasional failures
    if (Math.random() > this.successRate) {
      throw new Error('Mock PayMongo: Simulated payment creation failure')
    }

    const mockPayment: PayMongoPaymentIntent = {
      id: `pi_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'payment_intent',
      attributes: {
        amount: request.amount,
        currency: request.currency.toLowerCase() as 'php',
        description: request.description || 'GOMFLOW Demo Payment',
        statement_descriptor: 'GOMFLOW DEMO',
        status: 'awaiting_payment_method' as PaymentStatus,
        livemode: false,
        client_key: `pi_mock_client_${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_payment_error: null,
        payment_method_allowed: ['card', 'gcash', 'paymaya', 'grab_pay'],
        payments: [],
        next_action: null,
        payment_method_options: {
          card: { request_three_d_secure: 'automatic' }
        },
        setup_future_usage: null,
        capture_type: 'automatic'
      }
    }

    return {
      success: true,
      payment_id: mockPayment.id,
      checkout_url: `https://demo-checkout.gomflow.com/payments/${mockPayment.id}`,
      status: 'awaiting_payment_method',
      amount: request.amount,
      currency: request.currency,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      payment_methods: ['gcash', 'paymaya', 'card', 'grab_pay'],
      qr_code_url: `https://demo.gomflow.com/qr/${mockPayment.id}.png`,
      reference_number: `GOMF-DEMO-${Date.now()}`,
      instructions: {
        gcash: 'Scan QR code or enter reference number in GCash app (DEMO)',
        paymaya: 'Use PayMaya app to pay with reference number (DEMO)',
        card: 'Use test card: 4343434343434345 (DEMO)',
        grab_pay: 'Open GrabPay and scan QR code (DEMO)'
      }
    }
  }

  /**
   * Mock Billplz bill creation
   */
  static async createBillplzBill(request: CreatePaymentSessionRequest): Promise<PaymentSessionResponse> {
    logger.info('🎭 Mock Billplz: Creating bill', {
      amount: request.amount,
      currency: request.currency,
      country: request.country
    })

    // Simulate API delay
    await this.delay(this.simulatedDelay)

    // Simulate occasional failures
    if (Math.random() > this.successRate) {
      throw new Error('Mock Billplz: Simulated bill creation failure')
    }

    const mockBill: BillplzBill = {
      id: `bill_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      collection_id: Config.paymentGateways.billplz.collectionId || 'mock_collection',
      paid: false,
      state: 'due',
      amount: request.amount,
      paid_amount: 0,
      due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      email: request.buyer_email || 'demo@gomflow.com',
      mobile: request.buyer_phone || '+60123456789',
      name: request.buyer_name || 'Demo Buyer',
      url: `https://demo-billplz.gomflow.com/bills/mock_${Date.now()}`,
      reference_1_label: 'Order ID',
      reference_1: request.order_id || `order_demo_${Date.now()}`,
      reference_2_label: 'Buyer ID',
      reference_2: request.buyer_id || `buyer_demo_${Date.now()}`,
      redirect_url: request.success_url || 'https://demo.gomflow.com/payment/success',
      callback_url: request.webhook_url || 'https://demo.gomflow.com/webhooks/billplz',
      description: request.description || 'GOMFLOW Demo Payment'
    }

    return {
      success: true,
      payment_id: mockBill.id,
      checkout_url: mockBill.url,
      status: 'awaiting_payment',
      amount: request.amount,
      currency: request.currency,
      expires_at: mockBill.due_at,
      payment_methods: ['fpx', 'maybank2u', 'touch_n_go', 'boost', 'shopeepay'],
      qr_code_url: `https://demo.gomflow.com/qr/billplz_${mockBill.id}.png`,
      reference_number: `BILLPLZ-DEMO-${Date.now()}`,
      instructions: {
        fpx: 'Select your bank and login to complete payment (DEMO)',
        maybank2u: 'Login to Maybank2u to authorize payment (DEMO)',
        touch_n_go: 'Scan QR with Touch n Go eWallet (DEMO)',
        boost: 'Open Boost app and scan QR code (DEMO)',
        shopeepay: 'Use ShopeePay to scan QR code (DEMO)'
      }
    }
  }

  /**
   * Mock payment status check
   */
  static async getPaymentStatus(paymentId: string, gateway: 'paymongo' | 'billplz'): Promise<{
    status: PaymentStatus
    paid_at?: string
    amount_paid?: number
    payment_method?: PaymentMethod
  }> {
    logger.info('🎭 Mock Payment Status Check', { paymentId, gateway })

    await this.delay(1000)

    // Simulate different payment statuses
    const statuses: PaymentStatus[] = ['succeeded', 'processing', 'awaiting_payment_method', 'failed']
    const randomStatus = Math.random()

    let status: PaymentStatus
    if (randomStatus < 0.7) status = 'succeeded'
    else if (randomStatus < 0.85) status = 'processing'
    else if (randomStatus < 0.95) status = 'awaiting_payment_method'
    else status = 'failed'

    const result: any = { status }

    if (status === 'succeeded') {
      result.paid_at = new Date().toISOString()
      result.amount_paid = 1000 // Demo amount
      result.payment_method = gateway === 'paymongo' ? 'gcash' : 'fpx'
    }

    return result
  }

  /**
   * Mock webhook processing
   */
  static async processWebhook(webhookData: any, gateway: 'paymongo' | 'billplz'): Promise<{
    verified: boolean
    event_type: string
    payment_id: string
    status: PaymentStatus
  }> {
    logger.info('🎭 Mock Webhook Processing', { gateway, event: webhookData.type })

    await this.delay(500)

    // Simulate webhook verification
    const verified = Math.random() > 0.05 // 95% success rate

    if (!verified) {
      throw new Error('Mock Webhook: Verification failed')
    }

    return {
      verified: true,
      event_type: webhookData.type || 'payment.succeeded',
      payment_id: webhookData.data?.id || `mock_${Date.now()}`,
      status: 'succeeded'
    }
  }

  /**
   * Mock refund processing
   */
  static async processRefund(paymentId: string, amount: number, reason?: string): Promise<{
    refund_id: string
    status: string
    amount: number
    reason?: string
  }> {
    logger.info('🎭 Mock Refund Processing', { paymentId, amount, reason })

    await this.delay(2000)

    // Simulate refund success/failure
    if (Math.random() > 0.95) {
      throw new Error('Mock Refund: Processing failed')
    }

    return {
      refund_id: `refund_mock_${Date.now()}`,
      status: 'succeeded',
      amount,
      reason: reason || 'Requested by customer (DEMO)'
    }
  }

  /**
   * Generate mock payment screenshot for testing
   */
  static generateMockPaymentScreenshot(paymentMethod: PaymentMethod): {
    filename: string
    url: string
    details: {
      amount: string
      reference: string
      timestamp: string
      method: PaymentMethod
    }
  } {
    const timestamp = new Date().toISOString()
    const reference = `MOCK-${Date.now()}`
    
    return {
      filename: `mock_payment_${paymentMethod}_${Date.now()}.png`,
      url: `https://demo.gomflow.com/mock-screenshots/${paymentMethod}_${Date.now()}.png`,
      details: {
        amount: 'RM 50.00',
        reference,
        timestamp,
        method: paymentMethod
      }
    }
  }

  /**
   * Simulate processing delay
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get mock payment statistics for dashboard
   */
  static getMockStatistics() {
    return {
      total_payments: 1247,
      successful_payments: 1120,
      failed_payments: 87,
      pending_payments: 40,
      total_revenue: 156780.50,
      average_amount: 125.75,
      top_payment_methods: [
        { method: 'gcash', count: 456, percentage: 36.5 },
        { method: 'fpx', count: 298, percentage: 23.9 },
        { method: 'paymaya', count: 234, percentage: 18.8 },
        { method: 'card', count: 132, percentage: 10.6 },
        { method: 'touch_n_go', count: 127, percentage: 10.2 }
      ],
      success_rate: 89.8,
      average_processing_time: '2.3 minutes'
    }
  }
}

export default MockPaymentService