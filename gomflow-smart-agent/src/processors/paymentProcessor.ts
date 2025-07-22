import crypto from 'crypto'
import { Config } from '@/config'
import ImageService from '@/services/imageService'
import OCRService from '@/services/ocrService'
import AIVisionService from '@/services/aiVisionService'
import DatabaseService from '@/services/databaseService'
import { 
  ProcessedImage, 
  OCRResult, 
  AIVisionResult,
  PaymentExtraction, 
  PaymentMatch,
  ImageProcessingJob 
} from '@/types'
import { logger } from '@/utils/logger'

export class PaymentProcessor {
  private imageService: ImageService
  private ocrService: OCRService
  private aiVisionService: AIVisionService
  private databaseService: DatabaseService

  constructor() {
    this.imageService = new ImageService()
    this.ocrService = new OCRService()
    this.aiVisionService = new AIVisionService()
    this.databaseService = new DatabaseService()
  }

  /**
   * Process payment screenshot end-to-end
   */
  async processPaymentScreenshot(job: ImageProcessingJob): Promise<PaymentMatch> {
    const startTime = Date.now()
    logger.info('Starting payment screenshot processing', {
      job_id: job.id,
      platform: job.platform,
      original_name: job.imageData.originalName,
      size: job.imageData.size,
      has_context: !!job.submissionContext
    })

    try {
      // Step 1: Process and optimize image
      const processedImage = await this.processImage(job)
      
      // Step 2: Extract text using OCR
      const ocrResult = await this.performOCR(processedImage)
      
      // Step 3: Analyze using AI Vision
      const aiResult = await this.performAIAnalysis(processedImage)
      
      // Step 4: Combine and extract payment information
      const extraction = await this.extractPaymentInfo(
        job.id,
        processedImage,
        ocrResult,
        aiResult,
        job.submissionContext?.currency || 'PHP'
      )
      
      // Step 5: Match with pending submissions
      const paymentMatch = await this.matchWithSubmissions(extraction, job.submissionContext)
      
      // Step 6: Store results and take action
      await this.handleMatchResult(paymentMatch, job)

      const processingTime = Date.now() - startTime
      
      logger.info('Payment screenshot processing completed', {
        job_id: job.id,
        overall_confidence: extraction.overallConfidence,
        payments_extracted: extraction.extractedPayments.length,
        matches_found: paymentMatch.matches.length,
        auto_approve: paymentMatch.bestMatch?.autoApprove,
        processing_time_ms: processingTime
      })

      return paymentMatch

    } catch (error: any) {
      const processingTime = Date.now() - startTime
      logger.error('Payment screenshot processing failed', {
        job_id: job.id,
        error: error.message,
        stack: error.stack,
        processing_time_ms: processingTime
      })
      throw error
    }
  }

  /**
   * Step 1: Process and optimize image
   */
  private async processImage(job: ImageProcessingJob): Promise<ProcessedImage> {
    try {
      const processedImage = await this.imageService.processImage(
        job.imageData.buffer,
        job.imageData.originalName,
        job.imageData.mimeType
      )

      // Create OCR-optimized version
      await this.imageService.createOCROptimizedImage(processedImage.processedPath)
      
      // Create thumbnail for review UI
      await this.imageService.createThumbnail(processedImage.processedPath)

      return processedImage

    } catch (error: any) {
      logger.error('Image processing failed', {
        job_id: job.id,
        error: error.message
      })
      throw new Error(`Image processing failed: ${error.message}`)
    }
  }

  /**
   * Step 2: Perform OCR text extraction
   */
  private async performOCR(processedImage: ProcessedImage): Promise<OCRResult> {
    try {
      // Use OCR-optimized version if available
      const ocrImagePath = processedImage.processedPath.replace('.jpg', '_ocr.jpg')
      const imagePath = await this.imageService.getImageBuffer(ocrImagePath) ? ocrImagePath : processedImage.processedPath

      const ocrResult = await this.ocrService.extractText(imagePath)

      logger.debug('OCR extraction completed', {
        confidence: ocrResult.confidence,
        text_length: ocrResult.text.length,
        words_extracted: ocrResult.words.length
      })

      return ocrResult

    } catch (error: any) {
      logger.error('OCR processing failed', {
        image_path: processedImage.processedPath,
        error: error.message
      })
      throw new Error(`OCR processing failed: ${error.message}`)
    }
  }

  /**
   * Step 3: Perform AI Vision analysis
   */
  private async performAIAnalysis(processedImage: ProcessedImage): Promise<AIVisionResult> {
    try {
      const aiResult = await this.aiVisionService.analyzePaymentScreenshot(processedImage.processedPath)

      // Validate extracted elements
      const validation = this.aiVisionService.validateExtraction(aiResult.detectedElements)
      if (!validation.valid) {
        logger.warn('AI extraction validation issues', {
          issues: validation.issues
        })
      }

      return aiResult

    } catch (error: any) {
      logger.error('AI vision analysis failed', {
        image_path: processedImage.processedPath,
        error: error.message
      })
      throw new Error(`AI vision analysis failed: ${error.message}`)
    }
  }

  /**
   * Step 4: Extract and combine payment information
   */
  private async extractPaymentInfo(
    jobId: string,
    processedImage: ProcessedImage,
    ocrResult: OCRResult,
    aiResult: AIVisionResult,
    currency: 'PHP' | 'MYR'
  ): Promise<PaymentExtraction> {
    try {
      const extractionId = `ext_${crypto.randomUUID()}`
      
      // Extract payment info from OCR
      const ocrPaymentInfo = this.ocrService.extractPaymentInfo(ocrResult, currency)
      
      // Combine OCR and AI results
      const extractedPayments = []

      // Process AI-detected payment
      if (aiResult.detectedElements.amount && aiResult.detectedElements.currency) {
        extractedPayments.push({
          amount: aiResult.detectedElements.amount,
          currency: aiResult.detectedElements.currency as 'PHP' | 'MYR',
          method: aiResult.detectedElements.paymentMethod || 'unknown',
          sender: aiResult.detectedElements.senderInfo,
          recipient: aiResult.detectedElements.recipientInfo,
          reference: aiResult.detectedElements.referenceNumber || aiResult.detectedElements.transactionId,
          timestamp: aiResult.detectedElements.timestamp,
          confidence: aiResult.confidence,
          source: 'ai' as const
        })
      }

      // Process OCR-detected amounts
      ocrPaymentInfo.amounts.forEach(amount => {
        // Find corresponding method and reference
        const method = ocrPaymentInfo.methods[0]?.value || 'unknown'
        const reference = ocrPaymentInfo.references[0]?.value
        
        extractedPayments.push({
          amount: amount.value,
          currency,
          method,
          reference,
          confidence: amount.confidence / 100, // Convert to 0-1 scale
          source: 'ocr' as const
        })
      })

      // Remove duplicates and rank by confidence
      const uniquePayments = this.deduplicatePayments(extractedPayments)
      
      // Calculate overall confidence
      const overallConfidence = uniquePayments.length > 0
        ? uniquePayments.reduce((sum, p) => sum + p.confidence, 0) / uniquePayments.length
        : 0

      // Determine if manual review is required
      const requiresReview = overallConfidence < Config.detectionThresholds.suggest ||
                            uniquePayments.length === 0 ||
                            uniquePayments.length > 3 // Multiple conflicting payments

      const extraction: PaymentExtraction = {
        id: extractionId,
        imageId: processedImage.metadata.fileHash,
        ocrResult,
        aiResult,
        extractedPayments: uniquePayments,
        overallConfidence,
        requiresReview,
        extractedAt: new Date().toISOString(),
        processingTimeMs: Date.now() - Date.parse(processedImage.metadata.processedAt)
      }

      // Store extraction record
      await this.databaseService.storePaymentExtraction(extraction)

      return extraction

    } catch (error: any) {
      logger.error('Payment info extraction failed', {
        job_id: jobId,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Step 5: Match extracted payment with pending submissions
   */
  private async matchWithSubmissions(
    extraction: PaymentExtraction,
    context?: ImageProcessingJob['submissionContext']
  ): Promise<PaymentMatch> {
    try {
      const matches = []

      for (const payment of extraction.extractedPayments) {
        // Get potential submission matches
        let potentialSubmissions = []

        // If we have specific context, start with that
        if (context?.submission_id) {
          const contextSubmission = await this.databaseService.getPendingSubmissions({
            order_id: context.order_id
          })
          potentialSubmissions.push(...contextSubmission.filter(s => s.id === context.submission_id))
        }

        // Find by exact reference match
        if (payment.reference) {
          const refMatches = await this.databaseService.findSubmissionsByReference(payment.reference)
          potentialSubmissions.push(...refMatches)
        }

        // Find by amount match
        const amountMatches = await this.databaseService.findSubmissionsByAmount(
          payment.amount,
          payment.currency,
          payment.amount * 0.05 // 5% tolerance
        )
        potentialSubmissions.push(...amountMatches)

        // Find by buyer info if available
        if (payment.sender) {
          const buyerMatches = await this.databaseService.findSubmissionsByBuyerInfo(payment.sender)
          potentialSubmissions.push(...buyerMatches)
        }

        // Remove duplicates
        const uniqueSubmissions = Array.from(
          new Map(potentialSubmissions.map(s => [s.id, s])).values()
        )

        // Calculate similarity scores
        for (const submission of uniqueSubmissions) {
          const similarity = this.databaseService.calculateSimilarityScore(payment, submission)
          
          if (similarity.score >= Config.detectionThresholds.suggest * 100) {
            matches.push({
              submission,
              matchScore: similarity.score,
              matchReasons: similarity.reasons,
              confidence: (similarity.score / 100) * payment.confidence,
              autoApprove: similarity.score >= Config.detectionThresholds.autoMatch * 100 &&
                          payment.confidence >= Config.detectionThresholds.autoMatch
            })
          }
        }
      }

      // Sort matches by confidence and pick best
      matches.sort((a, b) => b.confidence - a.confidence)
      const bestMatch = matches[0] || undefined

      const paymentMatch: PaymentMatch = {
        extraction,
        matches,
        bestMatch,
        matchedAt: new Date().toISOString(),
        reviewRequired: extraction.requiresReview || !bestMatch?.autoApprove
      }

      // Store match result
      await this.databaseService.storePaymentMatch(paymentMatch)

      return paymentMatch

    } catch (error: any) {
      logger.error('Payment matching failed', {
        extraction_id: extraction.id,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Step 6: Handle match result and take appropriate action
   */
  private async handleMatchResult(paymentMatch: PaymentMatch, job: ImageProcessingJob): Promise<void> {
    try {
      if (paymentMatch.bestMatch?.autoApprove) {
        // Auto-approve high-confidence matches
        const success = await this.databaseService.autoApprovePayment(
          paymentMatch.bestMatch.submission.id,
          paymentMatch.extraction.id,
          paymentMatch.bestMatch.confidence
        )

        if (success) {
          logger.info('Payment auto-approved', {
            submission_id: paymentMatch.bestMatch.submission.id,
            confidence: paymentMatch.bestMatch.confidence,
            job_id: job.id
          })

          // TODO: Trigger success notification to GOM and buyer
        }
      } else if (paymentMatch.matches.length > 0) {
        // Create manual review for potential matches
        await this.databaseService.createManualReview(
          paymentMatch.extraction.id,
          paymentMatch.matches.map(m => ({
            submission_id: m.submission.id,
            confidence: m.confidence,
            reasons: m.matchReasons
          })),
          'Potential matches found but require manual review'
        )

        logger.info('Manual review created for payment matches', {
          extraction_id: paymentMatch.extraction.id,
          matches: paymentMatch.matches.length,
          job_id: job.id
        })

        // TODO: Trigger review notification to GOM
      } else {
        // No matches found
        await this.databaseService.createManualReview(
          paymentMatch.extraction.id,
          [],
          'No matching submissions found'
        )

        logger.info('No matches found for payment', {
          extraction_id: paymentMatch.extraction.id,
          job_id: job.id
        })

        // TODO: Trigger unmatched payment notification
      }

    } catch (error: any) {
      logger.error('Failed to handle match result', {
        extraction_id: paymentMatch.extraction.id,
        error: error.message
      })
    }
  }

  /**
   * Deduplicate similar payments based on amount and confidence
   */
  private deduplicatePayments(payments: any[]): any[] {
    const uniquePayments = []
    const seenAmounts = new Set()

    // Sort by confidence descending
    payments.sort((a, b) => b.confidence - a.confidence)

    for (const payment of payments) {
      const amountKey = `${payment.amount}_${payment.currency}`
      
      if (!seenAmounts.has(amountKey)) {
        seenAmounts.add(amountKey)
        uniquePayments.push(payment)
      }
    }

    return uniquePayments
  }

  /**
   * Get processor status
   */
  getStatus(): {
    ready: boolean
    services: {
      image: boolean
      ocr: boolean
      ai: boolean
      database: boolean
    }
  } {
    return {
      ready: true,
      services: {
        image: true,
        ocr: this.ocrService.getStatus().ready,
        ai: this.aiVisionService.getStatus().ready,
        database: true
      }
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      await this.ocrService.cleanup()
      logger.info('Payment processor cleanup completed')
    } catch (error: any) {
      logger.error('Payment processor cleanup failed', { error: error.message })
    }
  }
}

export default PaymentProcessor