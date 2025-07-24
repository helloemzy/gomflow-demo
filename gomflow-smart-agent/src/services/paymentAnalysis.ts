import { AIVisionService } from './aiVisionService'
import { OCRService } from './ocrService'
import { DatabaseService } from './databaseService'
import { ImageService } from './imageService'
import { createClient } from '@supabase/supabase-js'
import { PaymentProof, AIAnalysisResult, VerificationStatus } from 'gomflow-shared'
import { Config } from '@/config'
import { logger } from '@/utils/logger'

export interface PaymentAnalysisRequest {
  payment_proof_id: string
  file_url: string
  analysis_type: 'payment_verification' | 'reprocess'
  context?: {
    submission_id?: string
    expected_amount?: number
    currency?: 'PHP' | 'MYR'
    payment_method_type?: string
  }
}

export interface PaymentAnalysisResult {
  payment_proof_id: string
  analysis_result: AIAnalysisResult
  verification_status: VerificationStatus
  confidence_score: number
  extracted_amount?: number
  extracted_reference?: string
  extracted_method?: string
  requires_manual_review: boolean
  processing_time_ms: number
  error?: string
}

export class PaymentAnalysisService {
  private aiVision: AIVisionService
  private ocr: OCRService
  private database: DatabaseService
  private imageService: ImageService
  private supabase: any

  constructor() {
    this.aiVision = new AIVisionService()
    this.ocr = new OCRService()
    this.database = new DatabaseService()
    this.imageService = new ImageService()
    
    // Initialize Supabase client with service role key for database operations
    this.supabase = createClient(
      Config.database.supabase.url,
      Config.database.supabase.serviceKey
    )
  }

  /**
   * Analyze payment proof using AI and OCR
   */
  async analyzePaymentProof(request: PaymentAnalysisRequest): Promise<PaymentAnalysisResult> {
    const startTime = Date.now()
    
    try {
      logger.info('Starting payment proof analysis', {
        paymentProofId: request.payment_proof_id,
        analysisType: request.analysis_type
      })

      // Get payment proof details from database
      const paymentProof = await this.getPaymentProofDetails(request.payment_proof_id)
      if (!paymentProof) {
        throw new Error('Payment proof not found')
      }

      // Download and process image
      const imagePath = await this.downloadImage(request.file_url, request.payment_proof_id)
      
      // Update processing attempt
      await this.updateProcessingAttempt(request.payment_proof_id)

      // Perform AI analysis
      const aiResult = await this.aiVision.analyzePaymentScreenshot(imagePath)
      
      // Perform OCR analysis for backup/validation
      let ocrResult = null
      try {
        ocrResult = await this.ocr.extractText(imagePath)
      } catch (ocrError) {
        logger.warn('OCR analysis failed, continuing with AI only', {
          paymentProofId: request.payment_proof_id,
          error: ocrError
        })
      }

      // Combine results and determine confidence
      const analysisResult = this.combineAnalysisResults(
        aiResult,
        ocrResult,
        paymentProof,
        request.context
      )

      // Determine verification status based on confidence and business rules
      const verificationStatus = this.determineVerificationStatus(
        analysisResult,
        paymentProof
      )

      // Save analysis results to database
      await this.saveAnalysisResults(request.payment_proof_id, analysisResult, verificationStatus)

      // Handle auto-verification if confidence is high enough
      if (verificationStatus === 'approved') {
        await this.autoApprovePayment(request.payment_proof_id, paymentProof.submission_id)
      }

      // Clean up temporary image file
      await this.imageService.cleanup(imagePath)

      const processingTime = Date.now() - startTime

      logger.info('Payment proof analysis completed', {
        paymentProofId: request.payment_proof_id,
        verificationStatus,
        confidence: analysisResult.confidence,
        processingTimeMs: processingTime
      })

      return {
        payment_proof_id: request.payment_proof_id,
        analysis_result: analysisResult,
        verification_status: verificationStatus,
        confidence_score: analysisResult.confidence,
        extracted_amount: analysisResult.amount,
        extracted_reference: analysisResult.referenceNumber,
        extracted_method: analysisResult.paymentMethod,
        requires_manual_review: verificationStatus === 'requires_review' || verificationStatus === 'flagged',
        processing_time_ms: processingTime
      }

    } catch (error: any) {
      const processingTime = Date.now() - startTime
      
      logger.error('Payment proof analysis failed', {
        paymentProofId: request.payment_proof_id,
        error: error.message,
        processingTimeMs: processingTime
      })

      // Update payment proof with error status
      await this.markAnalysisFailed(request.payment_proof_id, error.message)

      return {
        payment_proof_id: request.payment_proof_id,
        analysis_result: {
          confidence: 0,
          reasoning: `Analysis failed: ${error.message}`,
          extractedAt: new Date().toISOString(),
          model: 'error'
        },
        verification_status: 'requires_review',
        confidence_score: 0,
        requires_manual_review: true,
        processing_time_ms: processingTime,
        error: error.message
      }
    }
  }

  /**
   * Batch analyze multiple payment proofs
   */
  async batchAnalyzePaymentProofs(requests: PaymentAnalysisRequest[]): Promise<PaymentAnalysisResult[]> {
    logger.info('Starting batch payment proof analysis', {
      batchSize: requests.length
    })

    const results: PaymentAnalysisResult[] = []
    const concurrencyLimit = Config.processing.concurrentAnalyses || 3

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < requests.length; i += concurrencyLimit) {
      const batch = requests.slice(i, i + concurrencyLimit)
      
      const batchPromises = batch.map(request => 
        this.analyzePaymentProof(request).catch(error => ({
          payment_proof_id: request.payment_proof_id,
          analysis_result: {
            confidence: 0,
            reasoning: `Batch analysis failed: ${error.message}`,
            extractedAt: new Date().toISOString(),
            model: 'error'
          },
          verification_status: 'requires_review' as VerificationStatus,
          confidence_score: 0,
          requires_manual_review: true,
          processing_time_ms: 0,
          error: error.message
        }))
      )

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Small delay between batches to prevent rate limiting
      if (i + concurrencyLimit < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    logger.info('Batch payment proof analysis completed', {
      totalProcessed: results.length,
      successful: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length
    })

    return results
  }

  /**
   * Get payment proof details from database
   */
  private async getPaymentProofDetails(paymentProofId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('payment_proofs')
      .select(`
        *,
        submission:submissions!inner(
          id,
          buyer_name,
          total_amount,
          currency,
          payment_reference,
          order:orders!inner(
            id,
            title,
            user_id
          )
        ),
        payment_method:payment_methods(
          method_type,
          display_name
        )
      `)
      .eq('id', paymentProofId)
      .single()

    if (error) {
      throw new Error(`Failed to get payment proof details: ${error.message}`)
    }

    return data
  }

  /**
   * Download image from URL to temporary file
   */
  private async downloadImage(fileUrl: string, paymentProofId: string): Promise<string> {
    try {
      const response = await fetch(fileUrl)
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`)
      }

      const buffer = await response.arrayBuffer()
      const fileName = `${paymentProofId}_${Date.now()}.jpg`
      
      return await this.imageService.saveTemporaryFile(Buffer.from(buffer), fileName)
    } catch (error) {
      throw new Error(`Failed to download image: ${error}`)
    }
  }

  /**
   * Update processing attempt counter
   */
  private async updateProcessingAttempt(paymentProofId: string): Promise<void> {
    await this.supabase
      .from('payment_proofs')
      .update({
        processing_attempts: this.supabase.raw('processing_attempts + 1'),
        last_processed_at: new Date().toISOString()
      })
      .eq('id', paymentProofId)
  }

  /**
   * Combine AI and OCR analysis results
   */
  private combineAnalysisResults(
    aiResult: any,
    ocrResult: any,
    paymentProof: any,
    context?: any
  ): AIAnalysisResult {
    const submission = paymentProof.submission
    const expectedAmount = submission.total_amount
    const expectedCurrency = submission.currency

    // Start with AI result as primary
    let combinedResult: AIAnalysisResult = {
      paymentMethod: aiResult.detectedElements.paymentMethod,
      amount: aiResult.detectedElements.amount,
      currency: aiResult.detectedElements.currency as 'PHP' | 'MYR',
      senderInfo: aiResult.detectedElements.senderInfo,
      recipientInfo: aiResult.detectedElements.recipientInfo,
      transactionId: aiResult.detectedElements.transactionId,
      timestamp: aiResult.detectedElements.timestamp,
      bankName: aiResult.detectedElements.bankName,
      referenceNumber: aiResult.detectedElements.referenceNumber,
      confidence: aiResult.confidence,
      reasoning: aiResult.reasoning,
      extractedAt: aiResult.extractedAt,
      model: aiResult.model,
      tokenUsage: aiResult.tokenUsage
    }

    // Validate and adjust confidence based on business rules
    let confidenceAdjustments: string[] = []

    // Check amount matching
    if (combinedResult.amount && expectedAmount) {
      const amountDifference = Math.abs(combinedResult.amount - expectedAmount)
      const percentageDifference = (amountDifference / expectedAmount) * 100

      if (amountDifference <= 1.0) {
        // Perfect or near-perfect match
        combinedResult.confidence = Math.min(1.0, combinedResult.confidence + 0.1)
        confidenceAdjustments.push('exact_amount_match')
      } else if (percentageDifference <= 5) {
        // Small difference, might be fees or rounding
        confidenceAdjustments.push('close_amount_match')
      } else if (percentageDifference > 20) {
        // Significant difference, reduce confidence
        combinedResult.confidence = Math.max(0.1, combinedResult.confidence - 0.3)
        confidenceAdjustments.push('amount_mismatch')
      }
    }

    // Check currency matching
    if (combinedResult.currency && expectedCurrency) {
      if (combinedResult.currency === expectedCurrency) {
        combinedResult.confidence = Math.min(1.0, combinedResult.confidence + 0.05)
        confidenceAdjustments.push('currency_match')
      } else {
        combinedResult.confidence = Math.max(0.1, combinedResult.confidence - 0.2)
        confidenceAdjustments.push('currency_mismatch')
      }
    }

    // Check if payment method is recognized
    if (combinedResult.paymentMethod) {
      const knownMethods = [
        'gcash', 'paymaya', 'maya', 'bpi', 'bdo', 'metrobank',
        'maybank2u', 'cimb', 'touch n go', 'boost', 'grabpay'
      ]
      
      const isKnownMethod = knownMethods.some(method => 
        combinedResult.paymentMethod?.toLowerCase().includes(method)
      )
      
      if (isKnownMethod) {
        combinedResult.confidence = Math.min(1.0, combinedResult.confidence + 0.05)
        confidenceAdjustments.push('known_payment_method')
      }
    }

    // Update reasoning with confidence adjustments
    if (confidenceAdjustments.length > 0) {
      combinedResult.reasoning += ` Confidence adjusted for: ${confidenceAdjustments.join(', ')}`
    }

    return combinedResult
  }

  /**
   * Determine verification status based on analysis results
   */
  private determineVerificationStatus(
    analysis: AIAnalysisResult,
    paymentProof: any
  ): VerificationStatus {
    const submission = paymentProof.submission
    const expectedAmount = submission.total_amount
    const confidence = analysis.confidence

    // High confidence and amount matches - auto approve
    if (confidence >= 0.9 && analysis.amount && expectedAmount) {
      const amountDifference = Math.abs(analysis.amount - expectedAmount)
      if (amountDifference <= 1.0) {
        return 'approved'
      }
    }

    // Very high confidence but some discrepancies - requires review
    if (confidence >= 0.8) {
      return 'requires_review'
    }

    // Low confidence or suspicious patterns - flag for manual review
    if (confidence < 0.5) {
      return 'flagged'
    }

    // Medium confidence - pending for GOM review
    return 'pending'
  }

  /**
   * Save analysis results to database
   */
  private async saveAnalysisResults(
    paymentProofId: string,
    analysis: AIAnalysisResult,
    verificationStatus: VerificationStatus
  ): Promise<void> {
    await this.supabase
      .from('payment_proofs')
      .update({
        ai_analysis_result: analysis,
        ai_confidence_score: analysis.confidence,
        extracted_amount: analysis.amount,
        extracted_reference: analysis.referenceNumber || analysis.transactionId,
        extracted_method: analysis.paymentMethod,
        verification_status: verificationStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentProofId)
  }

  /**
   * Auto-approve payment if confidence is high enough
   */
  private async autoApprovePayment(paymentProofId: string, submissionId: string): Promise<void> {
    try {
      // Update submission status to paid
      await this.supabase
        .from('submissions')
        .update({ status: 'paid' })
        .eq('id', submissionId)

      // Update payment proof with auto-approval details
      await this.supabase
        .from('payment_proofs')
        .update({
          verified_at: new Date().toISOString(),
          manual_review_notes: 'Auto-approved by Smart Agent based on high confidence analysis'
        })
        .eq('id', paymentProofId)

      logger.info('Payment auto-approved', {
        paymentProofId,
        submissionId
      })

    } catch (error) {
      logger.error('Failed to auto-approve payment', {
        paymentProofId,
        submissionId,
        error
      })
    }
  }

  /**
   * Mark analysis as failed
   */
  private async markAnalysisFailed(paymentProofId: string, errorMessage: string): Promise<void> {
    await this.supabase
      .from('payment_proofs')
      .update({
        verification_status: 'requires_review',
        ai_analysis_result: {
          confidence: 0,
          reasoning: `Analysis failed: ${errorMessage}`,
          extractedAt: new Date().toISOString(),
          model: 'error'
        },
        ai_confidence_score: 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentProofId)
  }

  /**
   * Get analysis statistics
   */
  async getAnalysisStats(userId?: string, orderIds?: string[]): Promise<any> {
    let query = this.supabase
      .from('payment_proofs')
      .select(`
        verification_status,
        ai_confidence_score,
        processing_attempts,
        created_at,
        submission:submissions!inner(
          order:orders!inner(
            user_id
          )
        )
      `)

    if (userId) {
      query = query.eq('submission.order.user_id', userId)
    }

    if (orderIds && orderIds.length > 0) {
      query = query.in('submission.order_id', orderIds)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to get analysis stats: ${error.message}`)
    }

    // Calculate statistics
    const total = data?.length || 0
    const byStatus = data?.reduce((acc: any, proof: any) => {
      acc[proof.verification_status] = (acc[proof.verification_status] || 0) + 1
      return acc
    }, {}) || {}

    const avgConfidence = total > 0 
      ? data?.reduce((sum: number, proof: any) => sum + (proof.ai_confidence_score || 0), 0) / total 
      : 0

    const autoApproved = byStatus.approved || 0
    const requiresReview = (byStatus.requires_review || 0) + (byStatus.flagged || 0)

    return {
      total_processed: total,
      auto_approved: autoApproved,
      requires_review: requiresReview,
      pending: byStatus.pending || 0,
      average_confidence: Math.round(avgConfidence * 100) / 100,
      by_status: byStatus,
      auto_approval_rate: total > 0 ? Math.round((autoApproved / total) * 100) : 0
    }
  }

  /**
   * Reprocess failed or low-confidence analyses
   */
  async reprocessFailedAnalyses(userId: string, limit = 10): Promise<PaymentAnalysisResult[]> {
    // Get payment proofs that need reprocessing
    const { data: proofs, error } = await this.supabase
      .from('payment_proofs')
      .select(`
        id,
        file_url,
        submission:submissions!inner(
          order:orders!inner(
            user_id
          )
        )
      `)
      .eq('submission.order.user_id', userId)
      .or('verification_status.eq.requires_review,ai_confidence_score.lt.0.5')
      .lt('processing_attempts', 3)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error || !proofs?.length) {
      return []
    }

    const requests: PaymentAnalysisRequest[] = proofs.map(proof => ({
      payment_proof_id: proof.id,
      file_url: proof.file_url,
      analysis_type: 'reprocess'
    }))

    return await this.batchAnalyzePaymentProofs(requests)
  }

  /**
   * Get service health status
   */
  getHealthStatus(): { 
    status: 'healthy' | 'degraded' | 'unhealthy'
    services: Record<string, boolean>
    version: string
  } {
    return {
      status: 'healthy',
      services: {
        ai_vision: this.aiVision.getStatus().ready,
        ocr: true, // OCR service doesn't have a status method
        database: true, // Assume healthy if no connection errors
        image_processing: true
      },
      version: '1.0.0'
    }
  }
}

export default PaymentAnalysisService