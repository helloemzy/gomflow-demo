import axios, { AxiosInstance } from 'axios'
import crypto from 'crypto'
import { Config } from '@/config'
import { 
  BillplzBill, 
  BillplzWebhook,
  PaymentSessionResponse,
  CreatePaymentSessionRequest 
} from '@/types'
import { logger } from '@/utils/logger'

export class BillplzService {
  private client: AxiosInstance
  private webhookSecret: string
  private collectionId: string

  constructor() {
    this.webhookSecret = Config.paymentGateways.billplz.webhookSecret
    this.collectionId = Config.paymentGateways.billplz.collectionId

    // Create Billplz API client
    this.client = axios.create({
      baseURL: Config.paymentGateways.billplz.apiUrl,
      auth: {
        username: Config.paymentGateways.billplz.apiKey,
        password: ''
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      timeout: 30000
    })

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('Billplz API Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          data: config.data ? '[REDACTED]' : undefined
        })
        return config
      }
    )

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('Billplz API Response', {
          status: response.status,
          data: response.data ? '[DATA_PRESENT]' : '[NO_DATA]'
        })
        return response
      },
      (error) => {
        logger.error('Billplz API Error', {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        })
        return Promise.reject(error)
      }
    )
  }

  /**
   * Create a bill for a submission
   */
  async createBill(
    request: CreatePaymentSessionRequest,
    submissionData: {
      id: string
      payment_reference: string
      total_amount: number
      buyer_name: string
      buyer_email?: string
      buyer_phone?: string
      order_title: string
    }
  ): Promise<PaymentSessionResponse> {
    try {
      const { submission_id, return_url, cancel_url } = request
      const { payment_reference, total_amount, buyer_name, buyer_email, buyer_phone, order_title } = submissionData

      // Convert amount to sens (Billplz requires amount in smallest currency unit)
      const amountInSens = Math.round(total_amount * 100)

      // Prepare form data for Billplz
      const formData = new URLSearchParams({
        collection_id: this.collectionId,
        email: buyer_email || `${payment_reference}@gomflow.temp`,
        name: buyer_name,
        amount: amountInSens.toString(),
        callback_url: Config.webhooks.billplz,
        description: order_title.substring(0, 200), // Billplz has 200 char limit
        reference_1_label: 'Order Reference',
        reference_1: payment_reference,
        reference_2_label: 'Submission ID', 
        reference_2: submission_id,
        redirect_url: return_url
      })

      // Add mobile number if provided
      if (buyer_phone) {
        formData.append('mobile', buyer_phone)
      }

      logger.info('Creating Billplz bill', {
        submission_id,
        payment_reference,
        amount: total_amount,
        buyer_email: buyer_email || '[NO_EMAIL]'
      })

      const response = await this.client.post<BillplzBill>('/bills', formData.toString())
      
      const bill = response.data
      
      logger.info('Billplz bill created', {
        bill_id: bill.id,
        bill_url: bill.url,
        submission_id
      })

      return {
        session_id: bill.id,
        payment_url: bill.url,
        gateway: 'billplz',
        payment_method: 'fpx', // Default for Malaysia
        amount: total_amount,
        currency: 'MYR',
        expires_at: bill.due_at,
        metadata: {
          submission_id,
          payment_reference,
          order_title
        }
      }

    } catch (error: any) {
      logger.error('Failed to create Billplz bill', {
        submission_id: request.submission_id,
        error: error.message,
        response: error.response?.data
      })
      throw new Error(`Billplz bill creation failed: ${error.message}`)
    }
  }

  /**
   * Retrieve a bill
   */
  async getBill(billId: string): Promise<BillplzBill> {
    try {
      const response = await this.client.get<BillplzBill>(`/bills/${billId}`)
      return response.data
    } catch (error: any) {
      logger.error('Failed to retrieve Billplz bill', {
        bill_id: billId,
        error: error.message
      })
      throw new Error(`Failed to retrieve bill: ${error.message}`)
    }
  }

  /**
   * Delete a bill (for cancellations)
   */
  async deleteBill(billId: string): Promise<boolean> {
    try {
      await this.client.delete(`/bills/${billId}`)
      
      logger.info('Billplz bill deleted', { bill_id: billId })
      return true
    } catch (error: any) {
      logger.error('Failed to delete Billplz bill', {
        bill_id: billId,
        error: error.message
      })
      return false
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: Record<string, any>, signature: string): boolean {
    try {
      // Billplz webhook signature verification
      // Create signature from specific fields in order
      const signatureFields = ['amount', 'collection_id', 'due_at', 'email', 'id', 'mobile', 'name', 'paid', 'paid_at', 'state', 'url']
      
      const signatureString = signatureFields
        .filter(field => payload[field] !== undefined && payload[field] !== null)
        .map(field => {
          let value = payload[field]
          if (typeof value === 'boolean') {
            value = value ? 'true' : 'false'
          }
          return `${field}${value}`
        })
        .join('|') + `|${this.webhookSecret}`

      const expectedSignature = crypto
        .createHash('sha256')
        .update(signatureString)
        .digest('hex')

      return crypto.timingSafeEqual(
        Buffer.from(signature.toLowerCase()),
        Buffer.from(expectedSignature.toLowerCase())
      )
    } catch (error) {
      logger.error('Failed to verify Billplz webhook signature', { error })
      return false
    }
  }

  /**
   * Process webhook payload
   */
  async processWebhook(payload: Record<string, any>, signature: string): Promise<BillplzWebhook | null> {
    try {
      // Verify signature
      if (!this.verifyWebhookSignature(payload, signature)) {
        logger.warn('Invalid Billplz webhook signature')
        return null
      }

      // Transform payload to webhook interface
      const webhook: BillplzWebhook = {
        id: payload.id,
        collection_id: payload.collection_id,
        paid: payload.paid === 'true' || payload.paid === true,
        state: payload.state,
        amount: payload.amount,
        paid_amount: payload.paid_amount || payload.amount,
        due_at: payload.due_at,
        email: payload.email,
        mobile: payload.mobile,
        name: payload.name,
        url: payload.url,
        paid_at: payload.paid_at,
        transaction_id: payload.transaction_id,
        transaction_status: payload.transaction_status,
        x_signature: signature
      }
      
      logger.info('Processing Billplz webhook', {
        bill_id: webhook.id,
        state: webhook.state,
        paid: webhook.paid
      })

      return webhook

    } catch (error: any) {
      logger.error('Failed to process Billplz webhook', {
        error: error.message,
        payload: Object.keys(payload)
      })
      return null
    }
  }

  /**
   * Get FPX banks list (for displaying payment options)
   */
  async getFPXBanks(): Promise<Array<{ name: string, active: boolean }>> {
    try {
      const response = await this.client.get('/fpx_banks')
      return response.data.banks || []
    } catch (error: any) {
      logger.error('Failed to get FPX banks', { error: error.message })
      return []
    }
  }

  /**
   * Check if payment method is supported
   */
  isPaymentMethodSupported(method: string): boolean {
    const supportedMethods = ['fpx', 'bank_transfer', 'card', 'boost', 'grabpay', 'tng']
    return supportedMethods.includes(method)
  }
}

export default BillplzService