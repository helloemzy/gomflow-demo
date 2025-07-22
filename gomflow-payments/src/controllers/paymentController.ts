import { Request, Response } from 'express'
import { z } from 'zod'
import { PayMongoService } from '@/services/paymongoService'
import { BillplzService } from '@/services/billplzService'
import DatabaseService from '@/services/databaseService'
import { logger } from '@/utils/logger'
import { 
  CreatePaymentSessionSchema, 
  PaymentServiceResponse,
  PaymentSessionResponse 
} from '@/types'
import { Config } from '@/config'

const paymongoService = new PayMongoService()
const billplzService = new BillplzService()
const databaseService = new DatabaseService()

export class PaymentController {
  /**
   * Create payment session for a submission
   */
  async createPaymentSession(req: Request, res: Response) {
    try {
      // Validate request body
      const validatedData = CreatePaymentSessionSchema.parse(req.body)
      const { submission_id, payment_method, return_url, cancel_url } = validatedData

      logger.info('Creating payment session', {
        submission_id,
        payment_method,
        ip: req.ip
      })

      // Get submission details
      const submission = await databaseService.getSubmission(submission_id)
      if (!submission || !submission.order) {
        return res.status(404).json<PaymentServiceResponse>({
          success: false,
          error: 'Submission not found'
        })
      }

      // Check if submission is still pending
      if (submission.status !== 'pending') {
        return res.status(400).json<PaymentServiceResponse>({
          success: false,
          error: 'Submission is not in pending status'
        })
      }

      // Check if order deadline has passed
      if (new Date(submission.order.deadline) < new Date()) {
        return res.status(400).json<PaymentServiceResponse>({
          success: false,
          error: 'Order deadline has passed'
        })
      }

      // Determine payment gateway based on currency
      const gateway = submission.currency === 'PHP' ? 'paymongo' : 'billplz'
      let paymentSession: PaymentSessionResponse

      if (gateway === 'paymongo') {
        // Validate payment method for PayMongo
        const supportedMethods = ['gcash', 'paymaya', 'grab_pay', 'card']
        if (!supportedMethods.includes(payment_method)) {
          return res.status(400).json<PaymentServiceResponse>({
            success: false,
            error: `Payment method ${payment_method} not supported for Philippines`
          })
        }

        paymentSession = await paymongoService.createCheckoutSession(validatedData, {
          id: submission.id,
          payment_reference: submission.payment_reference,
          total_amount: submission.total_amount,
          buyer_name: submission.buyer_name,
          buyer_email: submission.buyer_email || undefined,
          order_title: submission.order.title
        })
      } else {
        // Billplz for Malaysia
        if (!billplzService.isPaymentMethodSupported(payment_method)) {
          return res.status(400).json<PaymentServiceResponse>({
            success: false,
            error: `Payment method ${payment_method} not supported for Malaysia`
          })
        }

        paymentSession = await billplzService.createBill(validatedData, {
          id: submission.id,
          payment_reference: submission.payment_reference,
          total_amount: submission.total_amount,
          buyer_name: submission.buyer_name,
          buyer_email: submission.buyer_email || undefined,
          buyer_phone: submission.buyer_phone,
          order_title: submission.order.title
        })
      }

      // Update submission with payment session details
      await databaseService.updateSubmissionPaymentInfo(submission_id, {
        payment_gateway: gateway,
        payment_intent_id: gateway === 'paymongo' ? paymentSession.session_id : undefined,
        checkout_session_id: gateway === 'paymongo' ? paymentSession.session_id : paymentSession.session_id,
        payment_url: paymentSession.payment_url
      })

      logger.info('Payment session created successfully', {
        submission_id,
        gateway,
        session_id: paymentSession.session_id,
        amount: paymentSession.amount
      })

      res.status(201).json<PaymentServiceResponse<PaymentSessionResponse>>({
        success: true,
        data: paymentSession,
        message: 'Payment session created successfully'
      })

    } catch (error: any) {
      logger.error('Failed to create payment session', {
        error: error.message,
        body: req.body,
        ip: req.ip
      })

      if (error instanceof z.ZodError) {
        return res.status(400).json<PaymentServiceResponse>({
          success: false,
          error: 'Invalid request data',
          message: error.errors.map(e => e.message).join(', ')
        })
      }

      res.status(500).json<PaymentServiceResponse>({
        success: false,
        error: 'Internal server error'
      })
    }
  }

  /**
   * Get payment session status
   */
  async getPaymentStatus(req: Request, res: Response) {
    try {
      const { submission_id } = req.params

      if (!submission_id) {
        return res.status(400).json<PaymentServiceResponse>({
          success: false,
          error: 'Submission ID is required'
        })
      }

      const submission = await databaseService.getSubmission(submission_id)
      if (!submission) {
        return res.status(404).json<PaymentServiceResponse>({
          success: false,
          error: 'Submission not found'
        })
      }

      // Get latest payment session status from gateway
      let gatewayStatus = null
      if (submission.payment_gateway && submission.checkout_session_id) {
        try {
          if (submission.payment_gateway === 'paymongo') {
            const session = await paymongoService.getCheckoutSession(submission.checkout_session_id)
            gatewayStatus = {
              gateway: 'paymongo',
              session_id: session.id,
              status: session.attributes.status,
              payment_url: session.attributes.checkout_url,
              created_at: new Date(session.attributes.created_at * 1000).toISOString()
            }
          } else if (submission.payment_gateway === 'billplz') {
            const bill = await billplzService.getBill(submission.checkout_session_id)
            gatewayStatus = {
              gateway: 'billplz',
              bill_id: bill.id,
              status: bill.state,
              paid: bill.paid,
              payment_url: bill.url,
              due_at: bill.due_at
            }
          }
        } catch (error: any) {
          logger.warn('Failed to get gateway status', {
            submission_id,
            gateway: submission.payment_gateway,
            error: error.message
          })
        }
      }

      res.json<PaymentServiceResponse>({
        success: true,
        data: {
          submission: {
            id: submission.id,
            status: submission.status,
            payment_reference: submission.payment_reference,
            total_amount: submission.total_amount,
            currency: submission.currency,
            payment_gateway: submission.payment_gateway,
            payment_url: submission.payment_url,
            created_at: submission.created_at,
            updated_at: submission.updated_at
          },
          gateway_status: gatewayStatus
        }
      })

    } catch (error: any) {
      logger.error('Failed to get payment status', {
        submission_id: req.params.submission_id,
        error: error.message
      })

      res.status(500).json<PaymentServiceResponse>({
        success: false,
        error: 'Internal server error'
      })
    }
  }

  /**
   * Cancel payment session
   */
  async cancelPaymentSession(req: Request, res: Response) {
    try {
      const { submission_id } = req.params

      if (!submission_id) {
        return res.status(400).json<PaymentServiceResponse>({
          success: false,
          error: 'Submission ID is required'
        })
      }

      const submission = await databaseService.getSubmission(submission_id)
      if (!submission) {
        return res.status(404).json<PaymentServiceResponse>({
          success: false,
          error: 'Submission not found'
        })
      }

      if (submission.status !== 'pending') {
        return res.status(400).json<PaymentServiceResponse>({
          success: false,
          error: 'Can only cancel pending submissions'
        })
      }

      // Cancel at gateway level if possible
      if (submission.payment_gateway === 'billplz' && submission.checkout_session_id) {
        try {
          await billplzService.deleteBill(submission.checkout_session_id)
        } catch (error: any) {
          logger.warn('Failed to delete Billplz bill', {
            submission_id,
            bill_id: submission.checkout_session_id,
            error: error.message
          })
        }
      }

      // Update submission status to cancelled
      await databaseService.updateSubmissionPaymentInfo(submission_id, {
        status: 'cancelled'
      })

      logger.info('Payment session cancelled', { submission_id })

      res.json<PaymentServiceResponse>({
        success: true,
        message: 'Payment session cancelled successfully'
      })

    } catch (error: any) {
      logger.error('Failed to cancel payment session', {
        submission_id: req.params.submission_id,
        error: error.message
      })

      res.status(500).json<PaymentServiceResponse>({
        success: false,
        error: 'Internal server error'
      })
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response) {
    res.json({
      success: true,
      message: 'Payment service is healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    })
  }
}

export default PaymentController