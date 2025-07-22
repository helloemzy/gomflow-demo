import { Request, Response } from 'express'
import { PayMongoService } from '@/services/paymongoService'
import { BillplzService } from '@/services/billplzService'
import DatabaseService from '@/services/databaseService'
import { logger } from '@/utils/logger'
import { PaymentServiceResponse, PayMongoWebhookEvent, BillplzWebhook } from '@/types'

const paymongoService = new PayMongoService()
const billplzService = new BillplzService()
const databaseService = new DatabaseService()

export class WebhookController {
  /**
   * Handle PayMongo webhooks
   */
  async handlePayMongoWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers['paymongo-signature'] as string
      const payload = JSON.stringify(req.body)

      if (!signature) {
        logger.warn('PayMongo webhook missing signature', { ip: req.ip })
        return res.status(400).json<PaymentServiceResponse>({
          success: false,
          error: 'Missing signature'
        })
      }

      // Process webhook
      const event = await paymongoService.processWebhook(payload, signature)
      if (!event) {
        return res.status(400).json<PaymentServiceResponse>({
          success: false,
          error: 'Invalid webhook'
        })
      }

      logger.info('Processing PayMongo webhook', {
        event_type: event.data.attributes.type,
        event_id: event.data.id
      })

      // Process based on event type
      await this.processPayMongoEvent(event)

      res.json<PaymentServiceResponse>({
        success: true,
        message: 'Webhook processed successfully'
      })

    } catch (error: any) {
      logger.error('PayMongo webhook processing failed', {
        error: error.message,
        ip: req.ip,
        headers: req.headers
      })

      res.status(500).json<PaymentServiceResponse>({
        success: false,
        error: 'Webhook processing failed'
      })
    }
  }

  /**
   * Handle Billplz webhooks
   */
  async handleBillplzWebhook(req: Request, res: Response) {
    try {
      const signature = req.headers['x-signature'] as string || req.body.x_signature
      const payload = req.body

      if (!signature) {
        logger.warn('Billplz webhook missing signature', { ip: req.ip })
        return res.status(400).json<PaymentServiceResponse>({
          success: false,
          error: 'Missing signature'
        })
      }

      // Process webhook
      const webhook = await billplzService.processWebhook(payload, signature)
      if (!webhook) {
        return res.status(400).json<PaymentServiceResponse>({
          success: false,
          error: 'Invalid webhook'
        })
      }

      logger.info('Processing Billplz webhook', {
        bill_id: webhook.id,
        state: webhook.state,
        paid: webhook.paid
      })

      // Process webhook
      await this.processBillplzWebhook(webhook)

      res.json<PaymentServiceResponse>({
        success: true,
        message: 'Webhook processed successfully'
      })

    } catch (error: any) {
      logger.error('Billplz webhook processing failed', {
        error: error.message,
        ip: req.ip,
        body: req.body
      })

      res.status(500).json<PaymentServiceResponse>({
        success: false,
        error: 'Webhook processing failed'
      })
    }
  }

  /**
   * Process PayMongo webhook events
   */
  private async processPayMongoEvent(event: PayMongoWebhookEvent): Promise<void> {
    const eventType = event.data.attributes.type
    const eventData = event.data.attributes.data

    switch (eventType) {
      case 'payment.paid':
        await this.handlePayMongoPaymentPaid(eventData as any)
        break
      
      case 'payment.failed':
        await this.handlePayMongoPaymentFailed(eventData as any)
        break
      
      case 'payment_intent.succeeded':
        await this.handlePayMongoPaymentIntentSucceeded(eventData as any)
        break
      
      case 'payment_intent.payment_failed':
        await this.handlePayMongoPaymentIntentFailed(eventData as any)
        break
      
      default:
        logger.info('Unhandled PayMongo event type', { event_type: eventType })
    }
  }

  /**
   * Handle PayMongo payment paid event
   */
  private async handlePayMongoPaymentPaid(payment: any): Promise<void> {
    try {
      const submissionId = payment.attributes.metadata?.submission_id
      if (!submissionId) {
        logger.warn('PayMongo payment paid event missing submission_id', {
          payment_id: payment.id
        })
        return
      }

      const success = await databaseService.markSubmissionAsPaid(submissionId, {
        gateway_payment_id: payment.id,
        gateway_status: payment.attributes.status,
        amount: payment.attributes.amount / 100, // Convert from centavos
        currency: 'PHP',
        payment_method: payment.attributes.source?.type,
        paid_at: new Date(payment.attributes.paid_at * 1000).toISOString(),
        webhook_data: payment
      })

      if (success) {
        logger.info('PayMongo payment confirmed', {
          submission_id: submissionId,
          payment_id: payment.id,
          amount: payment.attributes.amount / 100
        })

        // TODO: Trigger notification to messaging services
        // This will be implemented when messaging services are ready
      }
    } catch (error: any) {
      logger.error('Failed to process PayMongo payment paid event', {
        payment_id: payment.id,
        error: error.message
      })
    }
  }

  /**
   * Handle PayMongo payment failed event
   */
  private async handlePayMongoPaymentFailed(payment: any): Promise<void> {
    try {
      const submissionId = payment.attributes.metadata?.submission_id
      if (!submissionId) {
        logger.warn('PayMongo payment failed event missing submission_id', {
          payment_id: payment.id
        })
        return
      }

      await databaseService.markSubmissionAsFailed(
        submissionId,
        'Payment failed at gateway',
        {
          gateway_payment_id: payment.id,
          gateway_status: payment.attributes.status,
          webhook_data: payment
        }
      )

      logger.info('PayMongo payment marked as failed', {
        submission_id: submissionId,
        payment_id: payment.id
      })
    } catch (error: any) {
      logger.error('Failed to process PayMongo payment failed event', {
        payment_id: payment.id,
        error: error.message
      })
    }
  }

  /**
   * Handle PayMongo payment intent succeeded event
   */
  private async handlePayMongoPaymentIntentSucceeded(paymentIntent: any): Promise<void> {
    try {
      const submissionId = paymentIntent.attributes.metadata?.submission_id
      if (!submissionId) {
        logger.warn('PayMongo payment intent succeeded event missing submission_id', {
          payment_intent_id: paymentIntent.id
        })
        return
      }

      // Get the latest payment from the payment intent
      const payments = paymentIntent.attributes.payments || []
      const latestPayment = payments[payments.length - 1]

      if (latestPayment && latestPayment.attributes.status === 'paid') {
        await this.handlePayMongoPaymentPaid(latestPayment)
      }
    } catch (error: any) {
      logger.error('Failed to process PayMongo payment intent succeeded event', {
        payment_intent_id: paymentIntent.id,
        error: error.message
      })
    }
  }

  /**
   * Handle PayMongo payment intent failed event
   */
  private async handlePayMongoPaymentIntentFailed(paymentIntent: any): Promise<void> {
    try {
      const submissionId = paymentIntent.attributes.metadata?.submission_id
      if (!submissionId) {
        logger.warn('PayMongo payment intent failed event missing submission_id', {
          payment_intent_id: paymentIntent.id
        })
        return
      }

      await databaseService.markSubmissionAsFailed(
        submissionId,
        'Payment intent failed',
        {
          gateway_payment_id: paymentIntent.id,
          gateway_status: paymentIntent.attributes.status,
          webhook_data: paymentIntent
        }
      )

      logger.info('PayMongo payment intent marked as failed', {
        submission_id: submissionId,
        payment_intent_id: paymentIntent.id
      })
    } catch (error: any) {
      logger.error('Failed to process PayMongo payment intent failed event', {
        payment_intent_id: paymentIntent.id,
        error: error.message
      })
    }
  }

  /**
   * Process Billplz webhook
   */
  private async processBillplzWebhook(webhook: BillplzWebhook): Promise<void> {
    try {
      // Get submission by payment reference from the bill
      const submissionId = webhook.id.includes('-') ? 
        webhook.id.split('-')[1] : // If bill ID contains submission ID
        null

      let submission = null
      if (submissionId) {
        submission = await databaseService.getSubmission(submissionId)
      }

      // If we can't find by submission ID, try by payment reference
      if (!submission && webhook.name) {
        // Billplz sometimes includes payment reference in the name field
        submission = await databaseService.getSubmissionByPaymentReference(webhook.name)
      }

      if (!submission) {
        logger.warn('Billplz webhook: submission not found', {
          bill_id: webhook.id,
          name: webhook.name
        })
        return
      }

      if (webhook.paid && webhook.state === 'paid') {
        // Payment successful
        const success = await databaseService.markSubmissionAsPaid(submission.id, {
          gateway_payment_id: webhook.id,
          gateway_status: webhook.state,
          amount: parseFloat(webhook.paid_amount) / 100, // Convert from sens
          currency: 'MYR',
          paid_at: webhook.paid_at,
          webhook_data: webhook
        })

        if (success) {
          logger.info('Billplz payment confirmed', {
            submission_id: submission.id,
            bill_id: webhook.id,
            amount: parseFloat(webhook.paid_amount) / 100
          })

          // TODO: Trigger notification to messaging services
          // This will be implemented when messaging services are ready
        }
      } else {
        // Payment failed or other status
        logger.info('Billplz webhook processed (not paid)', {
          submission_id: submission.id,
          bill_id: webhook.id,
          state: webhook.state,
          paid: webhook.paid
        })
      }
    } catch (error: any) {
      logger.error('Failed to process Billplz webhook', {
        bill_id: webhook.id,
        error: error.message
      })
    }
  }
}

export default WebhookController