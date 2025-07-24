import { Request, Response } from 'express'
import multer from 'multer'
import { z } from 'zod'
import PaymentProcessor from '@/processors/paymentProcessor'
import DatabaseService from '@/services/databaseService'
import PaymentAnalysisService from '@/services/paymentAnalysis'
import { Config } from '@/config'
import { logger } from '@/utils/logger'
import { 
  ProcessImageSchema, 
  ReviewDetectionSchema,
  SmartAgentResponse,
  ImageProcessingJob 
} from '@/types'
import crypto from 'crypto'

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Config.imageSettings.maxSize,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (Config.imageSettings.allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`Invalid file type. Allowed: ${Config.imageSettings.allowedTypes.join(', ')}`))
    }
  }
})

const paymentProcessor = new PaymentProcessor()
const databaseService = new DatabaseService()
const paymentAnalysisService = new PaymentAnalysisService()

export class SmartAgentController {
  /**
   * Process payment screenshot
   */
  async processScreenshot(req: Request, res: Response) {
    try {
      // Validate file upload
      if (!req.file) {
        return res.status(400).json<SmartAgentResponse>({
          success: false,
          error: 'No image file provided'
        })
      }

      // Validate request body
      const validatedData = ProcessImageSchema.parse(req.body)
      
      logger.info('Processing payment screenshot', {
        platform: validatedData.platform,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        has_context: !!validatedData.submission_id
      })

      // Create processing job
      const job: ImageProcessingJob = {
        id: `job_${crypto.randomUUID()}`,
        imageData: {
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size
        },
        submissionContext: validatedData.submission_id ? {
          submission_id: validatedData.submission_id,
          order_id: validatedData.order_id!,
          expected_amount: validatedData.expected_amount!,
          currency: validatedData.currency!,
          payment_reference: '', // Would be fetched from database
          buyer_info: {
            name: '',
            phone: '',
            email: ''
          }
        } : undefined,
        platform: validatedData.platform,
        userId: validatedData.user_id,
        priority: validatedData.priority,
        createdAt: new Date().toISOString()
      }

      // Process the screenshot
      const startTime = Date.now()
      const paymentMatch = await paymentProcessor.processPaymentScreenshot(job)
      const processingTime = Date.now() - startTime

      logger.info('Payment screenshot processed', {
        job_id: job.id,
        extraction_id: paymentMatch.extraction.id,
        overall_confidence: paymentMatch.extraction.overallConfidence,
        matches_found: paymentMatch.matches.length,
        auto_approved: paymentMatch.bestMatch?.autoApprove,
        processing_time_ms: processingTime
      })

      res.json<SmartAgentResponse>({
        success: true,
        data: {
          job_id: job.id,
          extraction: {
            id: paymentMatch.extraction.id,
            confidence: paymentMatch.extraction.overallConfidence,
            payments_found: paymentMatch.extraction.extractedPayments.length,
            requires_review: paymentMatch.extraction.requiresReview
          },
          matches: paymentMatch.matches.map(match => ({
            submission_id: match.submission.id,
            buyer_name: match.submission.buyer_name,
            amount: match.submission.total_amount,
            currency: match.submission.currency,
            payment_reference: match.submission.payment_reference,
            match_score: match.matchScore,
            confidence: match.confidence,
            auto_approve: match.autoApprove,
            reasons: match.matchReasons
          })),
          best_match: paymentMatch.bestMatch ? {
            submission_id: paymentMatch.bestMatch.submission.id,
            confidence: paymentMatch.bestMatch.confidence,
            auto_approved: paymentMatch.bestMatch.autoApprove
          } : null,
          review_required: paymentMatch.reviewRequired
        },
        message: paymentMatch.bestMatch?.autoApprove 
          ? 'Payment automatically approved' 
          : paymentMatch.matches.length > 0 
            ? 'Payment matches found - review required'
            : 'No matches found - manual review required',
        processingTime
      })

    } catch (error: any) {
      logger.error('Screenshot processing failed', {
        error: error.message,
        filename: req.file?.originalname,
        body: req.body
      })

      if (error instanceof z.ZodError) {
        return res.status(400).json<SmartAgentResponse>({
          success: false,
          error: 'Invalid request data',
          message: error.errors.map(e => e.message).join(', ')
        })
      }

      if (error instanceof multer.MulterError) {
        return res.status(400).json<SmartAgentResponse>({
          success: false,
          error: 'File upload error',
          message: error.message
        })
      }

      res.status(500).json<SmartAgentResponse>({
        success: false,
        error: 'Processing failed',
        message: error.message
      })
    }
  }

  /**
   * Analyze payment proof for manual verification system
   */
  async analyzePaymentProof(req: Request, res: Response) {
    try {
      const { payment_proof_id, file_url, analysis_type, context } = req.body

      if (!payment_proof_id || !file_url) {
        return res.status(400).json<SmartAgentResponse>({
          success: false,
          error: 'Payment proof ID and file URL are required'
        })
      }

      logger.info('Starting payment proof analysis', {
        paymentProofId: payment_proof_id,
        analysisType: analysis_type || 'payment_verification'
      })

      const startTime = Date.now()
      
      const analysisResult = await paymentAnalysisService.analyzePaymentProof({
        payment_proof_id,
        file_url,
        analysis_type: analysis_type || 'payment_verification',
        context
      })

      const processingTime = Date.now() - startTime

      logger.info('Payment proof analysis completed', {
        paymentProofId: payment_proof_id,
        verificationStatus: analysisResult.verification_status,
        confidence: analysisResult.confidence_score,
        processingTimeMs: processingTime
      })

      res.json<SmartAgentResponse>({
        success: true,
        data: analysisResult,
        message: analysisResult.verification_status === 'approved' 
          ? 'Payment auto-approved based on high confidence analysis'
          : analysisResult.requires_manual_review
            ? 'Payment requires manual review'
            : 'Payment analysis completed',
        processingTime
      })

    } catch (error: any) {
      logger.error('Payment proof analysis failed', {
        error: error.message,
        body: req.body
      })

      res.status(500).json<SmartAgentResponse>({
        success: false,
        error: 'Payment proof analysis failed',
        message: error.message
      })
    }
  }

  /**
   * Batch analyze multiple payment proofs
   */
  async batchAnalyzePaymentProofs(req: Request, res: Response) {
    try {
      const { requests } = req.body

      if (!Array.isArray(requests) || requests.length === 0) {
        return res.status(400).json<SmartAgentResponse>({
          success: false,
          error: 'Array of analysis requests is required'
        })
      }

      logger.info('Starting batch payment proof analysis', {
        batchSize: requests.length
      })

      const startTime = Date.now()
      
      const results = await paymentAnalysisService.batchAnalyzePaymentProofs(requests)
      
      const processingTime = Date.now() - startTime
      const successful = results.filter(r => !r.error).length
      const failed = results.filter(r => r.error).length

      logger.info('Batch payment proof analysis completed', {
        totalProcessed: results.length,
        successful,
        failed,
        processingTimeMs: processingTime
      })

      res.json<SmartAgentResponse>({
        success: true,
        data: {
          results,
          summary: {
            total_processed: results.length,
            successful,
            failed,
            auto_approved: results.filter(r => r.verification_status === 'approved').length,
            requires_review: results.filter(r => r.requires_manual_review).length
          }
        },
        message: `Batch analysis completed: ${successful} successful, ${failed} failed`,
        processingTime
      })

    } catch (error: any) {
      logger.error('Batch payment proof analysis failed', {
        error: error.message,
        body: req.body
      })

      res.status(500).json<SmartAgentResponse>({
        success: false,
        error: 'Batch payment proof analysis failed',
        message: error.message
      })
    }
  }

  /**
   * Get analysis statistics for a user or orders
   */
  async getAnalysisStats(req: Request, res: Response) {
    try {
      const { user_id, order_ids } = req.query
      
      const stats = await paymentAnalysisService.getAnalysisStats(
        user_id as string,
        order_ids ? (order_ids as string).split(',') : undefined
      )

      res.json<SmartAgentResponse>({
        success: true,
        data: stats
      })

    } catch (error: any) {
      logger.error('Failed to get analysis stats', {
        error: error.message,
        query: req.query
      })

      res.status(500).json<SmartAgentResponse>({
        success: false,
        error: 'Failed to get analysis statistics',
        message: error.message
      })
    }
  }

  /**
   * Reprocess failed analyses
   */
  async reprocessFailedAnalyses(req: Request, res: Response) {
    try {
      const { user_id, limit = 10 } = req.body

      if (!user_id) {
        return res.status(400).json<SmartAgentResponse>({
          success: false,
          error: 'User ID is required'
        })
      }

      logger.info('Starting failed analysis reprocessing', {
        userId: user_id,
        limit
      })

      const results = await paymentAnalysisService.reprocessFailedAnalyses(user_id, limit)

      res.json<SmartAgentResponse>({
        success: true,
        data: {
          results,
          reprocessed_count: results.length
        },
        message: `Reprocessed ${results.length} failed analyses`
      })

    } catch (error: any) {
      logger.error('Failed analysis reprocessing failed', {
        error: error.message,
        body: req.body
      })

      res.status(500).json<SmartAgentResponse>({
        success: false,
        error: 'Failed to reprocess analyses',
        message: error.message
      })
    }
  }

  /**
   * Review and approve/reject a payment detection
   */
  async reviewDetection(req: Request, res: Response) {
    try {
      const validatedData = ReviewDetectionSchema.parse(req.body)
      
      logger.info('Processing manual review', {
        extraction_id: validatedData.extraction_id,
        action: validatedData.action,
        approved_match: validatedData.approved_match_id
      })

      if (validatedData.action === 'approve' && validatedData.approved_match_id) {
        // Approve the selected match
        const success = await databaseService.autoApprovePayment(
          validatedData.approved_match_id,
          validatedData.extraction_id,
          0.95 // Manual approval gets high confidence
        )

        if (success) {
          logger.info('Manual payment approval completed', {
            submission_id: validatedData.approved_match_id,
            extraction_id: validatedData.extraction_id
          })

          return res.json<SmartAgentResponse>({
            success: true,
            message: 'Payment approved successfully'
          })
        } else {
          return res.status(500).json<SmartAgentResponse>({
            success: false,
            error: 'Failed to approve payment'
          })
        }
      } else if (validatedData.action === 'reject') {
        // Mark as rejected
        logger.info('Payment detection rejected', {
          extraction_id: validatedData.extraction_id,
          notes: validatedData.notes
        })

        // TODO: Implement rejection handling

        return res.json<SmartAgentResponse>({
          success: true,
          message: 'Payment detection rejected'
        })
      } else if (validatedData.action === 'modify') {
        // Apply manual corrections and re-process
        logger.info('Payment detection modified', {
          extraction_id: validatedData.extraction_id,
          corrections: validatedData.manual_corrections
        })

        // TODO: Implement modification handling

        return res.json<SmartAgentResponse>({
          success: true,
          message: 'Payment detection modified'
        })
      }

      res.status(400).json<SmartAgentResponse>({
        success: false,
        error: 'Invalid review action'
      })

    } catch (error: any) {
      logger.error('Review processing failed', {
        error: error.message,
        body: req.body
      })

      if (error instanceof z.ZodError) {
        return res.status(400).json<SmartAgentResponse>({
          success: false,
          error: 'Invalid request data',
          message: error.errors.map(e => e.message).join(', ')
        })
      }

      res.status(500).json<SmartAgentResponse>({
        success: false,
        error: 'Review processing failed'
      })
    }
  }

  /**
   * Get processing statistics
   */
  async getStats(req: Request, res: Response) {
    try {
      const timeframe = (req.query.timeframe as 'day' | 'week' | 'month') || 'day'
      
      const stats = await databaseService.getProcessingStats(timeframe)
      
      res.json<SmartAgentResponse>({
        success: true,
        data: {
          timeframe,
          ...stats,
          processing_rate: stats.total_processed > 0 
            ? (stats.auto_approved / stats.total_processed * 100).toFixed(1) + '%'
            : '0%',
          review_rate: stats.total_processed > 0
            ? (stats.manual_review / stats.total_processed * 100).toFixed(1) + '%'
            : '0%'
        }
      })

    } catch (error: any) {
      logger.error('Failed to get stats', { error: error.message })
      
      res.status(500).json<SmartAgentResponse>({
        success: false,
        error: 'Failed to get statistics'
      })
    }
  }

  /**
   * Get service status and health
   */
  async getStatus(req: Request, res: Response) {
    try {
      const processorStatus = paymentProcessor.getStatus()
      
      res.json<SmartAgentResponse>({
        success: true,
        data: {
          service: 'GOMFLOW Smart Payment Agent',
          version: '1.0.0',
          status: processorStatus.ready ? 'healthy' : 'degraded',
          timestamp: new Date().toISOString(),
          components: {
            payment_processor: processorStatus.ready,
            image_service: processorStatus.services.image,
            ocr_service: processorStatus.services.ocr,
            ai_vision: processorStatus.services.ai,
            database: processorStatus.services.database
          },
          configuration: {
            max_image_size: Config.imageSettings.maxSize,
            allowed_types: Config.imageSettings.allowedTypes,
            ocr_languages: Config.aiSettings.ocr.languages,
            ai_model: Config.aiSettings.openai.model,
            auto_match_threshold: Config.detectionThresholds.autoMatch,
            suggest_threshold: Config.detectionThresholds.suggest
          }
        }
      })

    } catch (error: any) {
      logger.error('Status check failed', { error: error.message })
      
      res.status(500).json<SmartAgentResponse>({
        success: false,
        error: 'Status check failed'
      })
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response) {
    const processorStatus = paymentProcessor.getStatus()
    
    if (processorStatus.ready) {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'gomflow-smart-agent'
      })
    } else {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'gomflow-smart-agent',
        issues: Object.entries(processorStatus.services)
          .filter(([_, ready]) => !ready)
          .map(([service, _]) => `${service} not ready`)
      })
    }
  }
}

// Export upload middleware
export const uploadMiddleware = upload.single('image')

export default SmartAgentController