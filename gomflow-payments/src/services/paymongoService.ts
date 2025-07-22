import axios, { AxiosInstance } from 'axios'
import crypto from 'crypto'
import { Config } from '@/config'
import { 
  PayMongoPaymentIntent, 
  PayMongoCheckoutSession, 
  PayMongoWebhookEvent,
  PaymentSessionResponse,
  CreatePaymentSessionRequest 
} from '@/types'
import { logger } from '@/utils/logger'

export class PayMongoService {
  private client: AxiosInstance
  private webhookSecret: string

  constructor() {
    this.webhookSecret = Config.paymentGateways.paymongo.webhookSecret
    
    // Create PayMongo API client
    this.client = axios.create({
      baseURL: Config.paymentGateways.paymongo.apiUrl,
      headers: {
        'Authorization': `Basic ${Buffer.from(Config.paymentGateways.paymongo.secretKey).toString('base64')}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    })

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('PayMongo API Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          data: config.data ? '[REDACTED]' : undefined
        })
        return config
      }
    )

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('PayMongo API Response', {
          status: response.status,
          data: response.data ? '[DATA_PRESENT]' : '[NO_DATA]'
        })
        return response
      },
      (error) => {
        logger.error('PayMongo API Error', {
          status: error.response?.status,
          message: error.message,
          data: error.response?.data
        })
        return Promise.reject(error)
      }
    )
  }

  /**
   * Create a checkout session for a submission
   */
  async createCheckoutSession(
    request: CreatePaymentSessionRequest,
    submissionData: {
      id: string
      payment_reference: string
      total_amount: number
      buyer_name: string
      buyer_email?: string
      order_title: string
    }
  ): Promise<PaymentSessionResponse> {
    try {
      const { submission_id, payment_method, return_url, cancel_url } = request
      const { payment_reference, total_amount, buyer_name, buyer_email, order_title } = submissionData

      // Convert amount to centavos (PayMongo requires amount in smallest currency unit)
      const amountInCentavos = Math.round(total_amount * 100)

      const checkoutData = {
        data: {
          attributes: {
            send_email_receipt: !!buyer_email,
            show_description: true,
            show_line_items: true,
            cancel_url,
            success_url: return_url,
            payment_method_types: this.getPayMongoPaymentMethods(payment_method),
            line_items: [
              {
                currency: 'PHP',
                amount: amountInCentavos,
                description: order_title,
                name: order_title,
                quantity: 1
              }
            ],
            description: `Order: ${order_title}`,
            reference_number: payment_reference,
            customer_email: buyer_email,
            metadata: {
              submission_id,
              payment_reference,
              order_title: order_title.substring(0, 50), // Limit length
              buyer_name: buyer_name.substring(0, 50)
            }
          }
        }
      }

      logger.info('Creating PayMongo checkout session', {
        submission_id,
        payment_reference,
        amount: total_amount,
        payment_method
      })

      const response = await this.client.post<{ data: PayMongoCheckoutSession }>('/checkout_sessions', checkoutData)
      
      const session = response.data.data
      
      logger.info('PayMongo checkout session created', {
        session_id: session.id,
        checkout_url: session.attributes.checkout_url,
        submission_id
      })

      return {
        session_id: session.id,
        payment_url: session.attributes.checkout_url,
        gateway: 'paymongo',
        payment_method,
        amount: total_amount,
        currency: 'PHP',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        metadata: {
          submission_id,
          payment_reference,
          order_title
        }
      }

    } catch (error: any) {
      logger.error('Failed to create PayMongo checkout session', {
        submission_id: request.submission_id,
        error: error.message,
        response: error.response?.data
      })
      throw new Error(`PayMongo checkout session creation failed: ${error.message}`)
    }
  }

  /**
   * Create a payment intent (for direct API integration)
   */
  async createPaymentIntent(
    submissionData: {
      id: string
      payment_reference: string
      total_amount: number
      buyer_email?: string
      order_title: string
    },
    paymentMethodTypes: string[] = ['card', 'gcash', 'paymaya']
  ): Promise<PayMongoPaymentIntent> {
    try {
      const { payment_reference, total_amount, buyer_email, order_title } = submissionData
      const amountInCentavos = Math.round(total_amount * 100)

      const paymentIntentData = {
        data: {
          attributes: {
            amount: amountInCentavos,
            payment_method_allowed: paymentMethodTypes,
            payment_method_options: {
              card: {
                request_three_d_secure: 'automatic'
              }
            },
            currency: 'PHP',
            description: order_title,
            statement_descriptor: 'GOMFLOW',
            metadata: {
              submission_id: submissionData.id,
              payment_reference,
              order_title: order_title.substring(0, 50)
            }
          }
        }
      }

      const response = await this.client.post<{ data: PayMongoPaymentIntent }>('/payment_intents', paymentIntentData)
      
      logger.info('PayMongo payment intent created', {
        payment_intent_id: response.data.data.id,
        submission_id: submissionData.id,
        amount: total_amount
      })

      return response.data.data

    } catch (error: any) {
      logger.error('Failed to create PayMongo payment intent', {
        submission_id: submissionData.id,
        error: error.message,
        response: error.response?.data
      })
      throw new Error(`PayMongo payment intent creation failed: ${error.message}`)
    }
  }

  /**
   * Retrieve a payment intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<PayMongoPaymentIntent> {
    try {
      const response = await this.client.get<{ data: PayMongoPaymentIntent }>(`/payment_intents/${paymentIntentId}`)
      return response.data.data
    } catch (error: any) {
      logger.error('Failed to retrieve PayMongo payment intent', {
        payment_intent_id: paymentIntentId,
        error: error.message
      })
      throw new Error(`Failed to retrieve payment intent: ${error.message}`)
    }
  }

  /**
   * Retrieve a checkout session
   */
  async getCheckoutSession(sessionId: string): Promise<PayMongoCheckoutSession> {
    try {
      const response = await this.client.get<{ data: PayMongoCheckoutSession }>(`/checkout_sessions/${sessionId}`)
      return response.data.data
    } catch (error: any) {
      logger.error('Failed to retrieve PayMongo checkout session', {
        session_id: sessionId,
        error: error.message
      })
      throw new Error(`Failed to retrieve checkout session: ${error.message}`)
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      // PayMongo uses HMAC-SHA256 for webhook signatures
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret.replace('whsec_', ''))
        .update(payload)
        .digest('hex')

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    } catch (error) {
      logger.error('Failed to verify PayMongo webhook signature', { error })
      return false
    }
  }

  /**
   * Process webhook event
   */
  async processWebhook(payload: string, signature: string): Promise<PayMongoWebhookEvent | null> {
    try {
      // Verify signature
      if (!this.verifyWebhookSignature(payload, signature)) {
        logger.warn('Invalid PayMongo webhook signature')
        return null
      }

      // Parse payload
      const event: PayMongoWebhookEvent = JSON.parse(payload)
      
      logger.info('Processing PayMongo webhook', {
        event_type: event.data.attributes.type,
        event_id: event.data.id
      })

      return event

    } catch (error: any) {
      logger.error('Failed to process PayMongo webhook', {
        error: error.message,
        payload: payload.substring(0, 100) // First 100 chars for debugging
      })
      return null
    }
  }

  /**
   * Map GOMFLOW payment methods to PayMongo payment method types
   */
  private getPayMongoPaymentMethods(method: string): string[] {
    const methodMap: Record<string, string[]> = {
      'gcash': ['gcash'],
      'paymaya': ['paymaya'],
      'grab_pay': ['grab_pay'],
      'card': ['card'],
      'all': ['card', 'gcash', 'paymaya', 'grab_pay']
    }

    return methodMap[method] || ['card']
  }
}

export default PayMongoService