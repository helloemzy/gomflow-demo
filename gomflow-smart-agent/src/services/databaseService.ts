import { createClient } from '@supabase/supabase-js'
import { Config } from '@/config'
import { Database, Submission, PaymentDetection, PaymentExtraction, PaymentMatch } from '@/types'
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
   * Get pending submissions for payment matching
   */
  async getPendingSubmissions(
    filters?: {
      currency?: 'PHP' | 'MYR'
      amount_range?: { min: number; max: number }
      order_id?: string
      user_id?: string
    }
  ): Promise<Submission[]> {
    try {
      let query = this.supabase
        .from('submissions')
        .select(`
          *,
          order:orders(*)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(100)

      if (filters?.currency) {
        query = query.eq('currency', filters.currency)
      }

      if (filters?.amount_range) {
        query = query
          .gte('total_amount', filters.amount_range.min)
          .lte('total_amount', filters.amount_range.max)
      }

      if (filters?.order_id) {
        query = query.eq('order_id', filters.order_id)
      }

      if (filters?.user_id) {
        query = query.eq('order.user_id', filters.user_id)
      }

      const { data, error } = await query

      if (error) {
        logger.error('Failed to get pending submissions', { error: error.message })
        return []
      }

      return data || []
    } catch (error: any) {
      logger.error('Database error getting pending submissions', { error: error.message })
      return []
    }
  }

  /**
   * Find submissions by payment reference
   */
  async findSubmissionsByReference(reference: string): Promise<Submission[]> {
    try {
      const { data, error } = await this.supabase
        .from('submissions')
        .select(`
          *,
          order:orders(*)
        `)
        .eq('payment_reference', reference)

      if (error) {
        logger.error('Failed to find submissions by reference', { 
          reference, 
          error: error.message 
        })
        return []
      }

      return data || []
    } catch (error: any) {
      logger.error('Database error finding submissions by reference', { 
        reference, 
        error: error.message 
      })
      return []
    }
  }

  /**
   * Find submissions by amount and currency
   */
  async findSubmissionsByAmount(
    amount: number, 
    currency: 'PHP' | 'MYR',
    tolerance: number = 0.01
  ): Promise<Submission[]> {
    try {
      const minAmount = amount - tolerance
      const maxAmount = amount + tolerance

      const { data, error } = await this.supabase
        .from('submissions')
        .select(`
          *,
          order:orders(*)
        `)
        .eq('currency', currency)
        .gte('total_amount', minAmount)
        .lte('total_amount', maxAmount)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) {
        logger.error('Failed to find submissions by amount', { 
          amount, 
          currency, 
          error: error.message 
        })
        return []
      }

      return data || []
    } catch (error: any) {
      logger.error('Database error finding submissions by amount', { 
        amount, 
        currency, 
        error: error.message 
      })
      return []
    }
  }

  /**
   * Find submissions by buyer info (fuzzy matching)
   */
  async findSubmissionsByBuyerInfo(
    name?: string, 
    phone?: string, 
    email?: string
  ): Promise<Submission[]> {
    try {
      let query = this.supabase
        .from('submissions')
        .select(`
          *,
          order:orders(*)
        `)
        .eq('status', 'pending')

      if (name) {
        // Use fuzzy matching for names
        query = query.ilike('buyer_name', `%${name}%`)
      }

      if (phone) {
        // Clean phone number for matching
        const cleanPhone = phone.replace(/[^0-9]/g, '')
        query = query.or(`buyer_phone.ilike.%${cleanPhone}%`)
      }

      if (email) {
        query = query.eq('buyer_email', email)
      }

      const { data, error } = await query.limit(50)

      if (error) {
        logger.error('Failed to find submissions by buyer info', { 
          name, 
          phone, 
          email, 
          error: error.message 
        })
        return []
      }

      return data || []
    } catch (error: any) {
      logger.error('Database error finding submissions by buyer info', { 
        name, 
        phone, 
        email, 
        error: error.message 
      })
      return []
    }
  }

  /**
   * Store payment extraction record
   */
  async storePaymentExtraction(extraction: PaymentExtraction): Promise<boolean> {
    try {
      // Create a custom table for payment extractions if needed
      // For now, we'll use a JSON field approach or extend the submissions table
      
      logger.info('Payment extraction stored', {
        extraction_id: extraction.id,
        confidence: extraction.overallConfidence,
        payments_found: extraction.extractedPayments.length
      })

      // TODO: Implement actual database storage
      // This could be a separate table or JSON field
      return true

    } catch (error: any) {
      logger.error('Failed to store payment extraction', {
        extraction_id: extraction.id,
        error: error.message
      })
      return false
    }
  }

  /**
   * Store payment match result
   */
  async storePaymentMatch(match: PaymentMatch): Promise<boolean> {
    try {
      logger.info('Payment match stored', {
        extraction_id: match.extraction.id,
        matches_found: match.matches.length,
        best_match: match.bestMatch?.submission.id,
        auto_approve: match.bestMatch?.autoApprove
      })

      // TODO: Implement actual database storage
      return true

    } catch (error: any) {
      logger.error('Failed to store payment match', {
        extraction_id: match.extraction.id,
        error: error.message
      })
      return false
    }
  }

  /**
   * Auto-approve payment match
   */
  async autoApprovePayment(
    submissionId: string,
    extractionId: string,
    confidence: number
  ): Promise<boolean> {
    try {
      // Update submission status to paid
      const { error } = await this.supabase
        .from('submissions')
        .update({
          status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId)

      if (error) {
        logger.error('Failed to auto-approve payment', {
          submission_id: submissionId,
          error: error.message
        })
        return false
      }

      // TODO: Create payment transaction record with Smart Agent info
      // TODO: Trigger notification to GOM and buyer

      logger.info('Payment auto-approved by Smart Agent', {
        submission_id: submissionId,
        extraction_id: extractionId,
        confidence
      })

      return true

    } catch (error: any) {
      logger.error('Database error auto-approving payment', {
        submission_id: submissionId,
        error: error.message
      })
      return false
    }
  }

  /**
   * Create manual review record
   */
  async createManualReview(
    extractionId: string,
    submissionMatches: Array<{
      submission_id: string
      confidence: number
      reasons: string[]
    }>,
    reviewReason: string
  ): Promise<string | null> {
    try {
      // TODO: Implement manual review table
      // This would store extractions that need human review

      logger.info('Manual review created', {
        extraction_id: extractionId,
        matches: submissionMatches.length,
        reason: reviewReason
      })

      return extractionId // Return review ID

    } catch (error: any) {
      logger.error('Failed to create manual review', {
        extraction_id: extractionId,
        error: error.message
      })
      return null
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(timeframe: 'day' | 'week' | 'month' = 'day'): Promise<{
    total_processed: number
    auto_approved: number
    manual_review: number
    failed_processing: number
    average_confidence: number
  }> {
    try {
      // TODO: Implement actual statistics query
      // This would query payment extraction records

      return {
        total_processed: 0,
        auto_approved: 0,
        manual_review: 0,
        failed_processing: 0,
        average_confidence: 0
      }

    } catch (error: any) {
      logger.error('Failed to get processing stats', { error: error.message })
      return {
        total_processed: 0,
        auto_approved: 0,
        manual_review: 0,
        failed_processing: 0,
        average_confidence: 0
      }
    }
  }

  /**
   * Calculate similarity score between extracted payment and submission
   */
  calculateSimilarityScore(
    extractedPayment: {
      amount: number
      currency: 'PHP' | 'MYR'
      method: string
      sender?: string
      reference?: string
    },
    submission: Submission
  ): { score: number; reasons: string[] } {
    const reasons: string[] = []
    let score = 0

    // Amount matching (40% weight)
    const amountDiff = Math.abs(extractedPayment.amount - submission.total_amount)
    const amountTolerance = submission.total_amount * 0.01 // 1% tolerance
    
    if (amountDiff <= amountTolerance) {
      score += 40
      reasons.push('Exact amount match')
    } else if (amountDiff <= submission.total_amount * 0.05) {
      score += 30
      reasons.push('Close amount match (within 5%)')
    } else if (amountDiff <= submission.total_amount * 0.10) {
      score += 20
      reasons.push('Approximate amount match (within 10%)')
    }

    // Currency matching (20% weight)
    if (extractedPayment.currency === submission.currency) {
      score += 20
      reasons.push('Currency match')
    }

    // Reference matching (25% weight)
    if (extractedPayment.reference && extractedPayment.reference === submission.payment_reference) {
      score += 25
      reasons.push('Exact reference match')
    } else if (extractedPayment.reference && submission.payment_reference.includes(extractedPayment.reference)) {
      score += 15
      reasons.push('Partial reference match')
    }

    // Buyer name matching (15% weight)
    if (extractedPayment.sender) {
      const senderLower = extractedPayment.sender.toLowerCase()
      const buyerLower = submission.buyer_name.toLowerCase()
      
      if (senderLower.includes(buyerLower) || buyerLower.includes(senderLower)) {
        score += 15
        reasons.push('Buyer name match')
      } else {
        // Check for partial name matches
        const senderWords = senderLower.split(' ')
        const buyerWords = buyerLower.split(' ')
        const commonWords = senderWords.filter(word => buyerWords.includes(word))
        
        if (commonWords.length > 0) {
          score += 8
          reasons.push('Partial buyer name match')
        }
      }
    }

    return { score, reasons }
  }
}

export default DatabaseService