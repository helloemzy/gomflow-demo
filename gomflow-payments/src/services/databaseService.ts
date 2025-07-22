import { createClient } from '@supabase/supabase-js'
import { Config } from '@/config'
import { Database, Submission, PaymentTransaction, Order } from '@/types'
import { logger } from '@/utils/logger'

class DatabaseService {
  private supabase

  constructor() {
    this.supabase = createClient<Database>(
      Config.SUPABASE_URL,
      Config.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )
  }

  /**
   * Get submission by ID with order details
   */
  async getSubmission(submissionId: string): Promise<(Submission & { order?: Order }) | null> {
    try {
      const { data, error } = await this.supabase
        .from('submissions')
        .select(`
          *,
          order:orders(*)
        `)
        .eq('id', submissionId)
        .single()

      if (error) {
        logger.error('Failed to get submission', { 
          submission_id: submissionId, 
          error: error.message 
        })
        return null
      }

      return data
    } catch (error: any) {
      logger.error('Database error getting submission', { 
        submission_id: submissionId, 
        error: error.message 
      })
      return null
    }
  }

  /**
   * Get submission by payment reference
   */
  async getSubmissionByPaymentReference(paymentReference: string): Promise<(Submission & { order?: Order }) | null> {
    try {
      const { data, error } = await this.supabase
        .from('submissions')
        .select(`
          *,
          order:orders(*)
        `)
        .eq('payment_reference', paymentReference)
        .single()

      if (error) {
        logger.error('Failed to get submission by payment reference', { 
          payment_reference: paymentReference, 
          error: error.message 
        })
        return null
      }

      return data
    } catch (error: any) {
      logger.error('Database error getting submission by payment reference', { 
        payment_reference: paymentReference, 
        error: error.message 
      })
      return null
    }
  }

  /**
   * Update submission with payment gateway information
   */
  async updateSubmissionPaymentInfo(
    submissionId: string, 
    updates: {
      payment_gateway?: 'paymongo' | 'billplz'
      payment_intent_id?: string
      checkout_session_id?: string
      payment_url?: string
      status?: 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled'
    }
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('submissions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId)

      if (error) {
        logger.error('Failed to update submission payment info', { 
          submission_id: submissionId, 
          updates,
          error: error.message 
        })
        return false
      }

      logger.info('Updated submission payment info', { 
        submission_id: submissionId, 
        updates 
      })
      return true
    } catch (error: any) {
      logger.error('Database error updating submission payment info', { 
        submission_id: submissionId, 
        error: error.message 
      })
      return false
    }
  }

  /**
   * Create payment transaction record
   */
  async createPaymentTransaction(transaction: {
    submission_id: string
    gateway: 'paymongo' | 'billplz'
    gateway_payment_id: string
    gateway_status: string
    amount: number
    currency: 'PHP' | 'MYR'
    payment_method?: string
    paid_at?: string
    webhook_data?: Record<string, any>
  }): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('payment_transactions')
        .insert({
          submission_id: transaction.submission_id,
          gateway: transaction.gateway,
          gateway_payment_id: transaction.gateway_payment_id,
          gateway_status: transaction.gateway_status,
          amount: transaction.amount,
          currency: transaction.currency,
          payment_method: transaction.payment_method,
          paid_at: transaction.paid_at,
          webhook_data: transaction.webhook_data,
          created_at: new Date().toISOString()
        })
        .select('id')
        .single()

      if (error) {
        logger.error('Failed to create payment transaction', { 
          transaction,
          error: error.message 
        })
        return null
      }

      logger.info('Created payment transaction', { 
        transaction_id: data.id,
        submission_id: transaction.submission_id,
        gateway: transaction.gateway,
        amount: transaction.amount
      })

      return data.id
    } catch (error: any) {
      logger.error('Database error creating payment transaction', { 
        transaction,
        error: error.message 
      })
      return null
    }
  }

  /**
   * Update payment transaction
   */
  async updatePaymentTransaction(
    transactionId: string,
    updates: {
      gateway_status?: string
      payment_method?: string
      paid_at?: string
      webhook_data?: Record<string, any>
    }
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('payment_transactions')
        .update(updates)
        .eq('id', transactionId)

      if (error) {
        logger.error('Failed to update payment transaction', { 
          transaction_id: transactionId,
          updates,
          error: error.message 
        })
        return false
      }

      return true
    } catch (error: any) {
      logger.error('Database error updating payment transaction', { 
        transaction_id: transactionId,
        error: error.message 
      })
      return false
    }
  }

  /**
   * Get payment transaction by gateway payment ID
   */
  async getPaymentTransactionByGatewayId(
    gateway: 'paymongo' | 'billplz', 
    gatewayPaymentId: string
  ): Promise<PaymentTransaction | null> {
    try {
      const { data, error } = await this.supabase
        .from('payment_transactions')
        .select('*')
        .eq('gateway', gateway)
        .eq('gateway_payment_id', gatewayPaymentId)
        .single()

      if (error) {
        logger.error('Failed to get payment transaction by gateway ID', { 
          gateway,
          gateway_payment_id: gatewayPaymentId,
          error: error.message 
        })
        return null
      }

      return data
    } catch (error: any) {
      logger.error('Database error getting payment transaction by gateway ID', { 
        gateway,
        gateway_payment_id: gatewayPaymentId,
        error: error.message 
      })
      return null
    }
  }

  /**
   * Mark submission as paid
   */
  async markSubmissionAsPaid(
    submissionId: string,
    transactionData: {
      gateway_payment_id: string
      gateway_status: string
      amount: number
      currency: 'PHP' | 'MYR'
      payment_method?: string
      paid_at: string
      webhook_data?: Record<string, any>
    }
  ): Promise<boolean> {
    try {
      // Start a transaction
      const { data: submission, error: fetchError } = await this.supabase
        .from('submissions')
        .select('*')
        .eq('id', submissionId)
        .single()

      if (fetchError || !submission) {
        logger.error('Submission not found for payment confirmation', { 
          submission_id: submissionId 
        })
        return false
      }

      // Update submission status
      const { error: updateError } = await this.supabase
        .from('submissions')
        .update({
          status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId)

      if (updateError) {
        logger.error('Failed to update submission status to paid', { 
          submission_id: submissionId,
          error: updateError.message 
        })
        return false
      }

      // Create payment transaction record
      const transactionId = await this.createPaymentTransaction({
        submission_id: submissionId,
        gateway: submission.payment_gateway!,
        gateway_payment_id: transactionData.gateway_payment_id,
        gateway_status: transactionData.gateway_status,
        amount: transactionData.amount,
        currency: transactionData.currency,
        payment_method: transactionData.payment_method,
        paid_at: transactionData.paid_at,
        webhook_data: transactionData.webhook_data
      })

      if (!transactionId) {
        logger.error('Failed to create payment transaction during payment confirmation', { 
          submission_id: submissionId 
        })
        // Note: submission is already marked as paid, this is logged but not rolled back
        // In production, you might want to implement a proper transaction rollback
      }

      logger.info('Successfully marked submission as paid', { 
        submission_id: submissionId,
        transaction_id: transactionId,
        amount: transactionData.amount,
        gateway: submission.payment_gateway
      })

      return true
    } catch (error: any) {
      logger.error('Database error marking submission as paid', { 
        submission_id: submissionId,
        error: error.message 
      })
      return false
    }
  }

  /**
   * Mark submission as failed
   */
  async markSubmissionAsFailed(
    submissionId: string,
    failureReason: string,
    transactionData?: {
      gateway_payment_id: string
      gateway_status: string
      webhook_data?: Record<string, any>
    }
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('submissions')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId)

      if (error) {
        logger.error('Failed to update submission status to failed', { 
          submission_id: submissionId,
          error: error.message 
        })
        return false
      }

      // Create transaction record if provided
      if (transactionData) {
        const { data: submission } = await this.supabase
          .from('submissions')
          .select('payment_gateway, total_amount, currency')
          .eq('id', submissionId)
          .single()

        if (submission) {
          await this.createPaymentTransaction({
            submission_id: submissionId,
            gateway: submission.payment_gateway!,
            gateway_payment_id: transactionData.gateway_payment_id,
            gateway_status: transactionData.gateway_status,
            amount: submission.total_amount,
            currency: submission.currency,
            webhook_data: transactionData.webhook_data
          })
        }
      }

      logger.info('Marked submission as failed', { 
        submission_id: submissionId,
        reason: failureReason
      })

      return true
    } catch (error: any) {
      logger.error('Database error marking submission as failed', { 
        submission_id: submissionId,
        error: error.message 
      })
      return false
    }
  }
}

export default DatabaseService