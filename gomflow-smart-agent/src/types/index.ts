import { z } from 'zod'

// Re-export shared types
export * from '@gomflow/shared'

// Image processing types
export interface ProcessedImage {
  originalPath: string
  processedPath: string
  width: number
  height: number
  size: number
  format: string
  quality: number
  metadata: {
    originalName: string
    uploadedAt: string
    processedAt: string
    fileHash: string
  }
}

// OCR extraction result
export interface OCRResult {
  text: string
  confidence: number
  words: Array<{
    text: string
    confidence: number
    bbox: {
      x0: number
      y0: number
      x1: number
      y1: number
    }
  }>
  blocks: Array<{
    text: string
    confidence: number
    bbox: {
      x0: number
      y0: number
      x1: number
      y1: number
    }
  }>
  extractedAt: string
  language: string
}

// AI Vision analysis result
export interface AIVisionResult {
  description: string
  detectedElements: {
    paymentMethod?: string
    amount?: number
    currency?: string
    senderInfo?: string
    recipientInfo?: string
    transactionId?: string
    timestamp?: string
    bankName?: string
    referenceNumber?: string
  }
  confidence: number
  reasoning: string
  extractedAt: string
  model: string
  tokenUsage?: {
    prompt: number
    completion: number
    total: number
  }
}

// Payment extraction result combining OCR + AI
export interface PaymentExtraction {
  id: string
  imageId: string
  ocrResult: OCRResult
  aiResult: AIVisionResult
  extractedPayments: Array<{
    amount: number
    currency: 'PHP' | 'MYR'
    method: string
    sender?: string
    recipient?: string
    reference?: string
    timestamp?: string
    confidence: number
    source: 'ocr' | 'ai' | 'combined'
  }>
  overallConfidence: number
  requiresReview: boolean
  extractedAt: string
  processingTimeMs: number
}

// Payment matching result
export interface PaymentMatch {
  extraction: PaymentExtraction
  matches: Array<{
    submission: {
      id: string
      payment_reference: string
      buyer_name: string
      total_amount: number
      currency: 'PHP' | 'MYR'
      status: string
      created_at: string
    }
    matchScore: number
    matchReasons: string[]
    confidence: number
    autoApprove: boolean
  }>
  bestMatch?: {
    submission: any
    matchScore: number
    confidence: number
    autoApprove: boolean
  }
  matchedAt: string
  reviewRequired: boolean
}

// Smart Agent processing job types
export interface ImageProcessingJob {
  id: string
  imageData: {
    buffer: Buffer
    originalName: string
    mimeType: string
    size: number
  }
  submissionContext?: {
    submission_id: string
    order_id: string
    expected_amount: number
    currency: 'PHP' | 'MYR'
    payment_reference: string
    buyer_info: {
      name: string
      phone: string
      email?: string
    }
  }
  platform: 'whatsapp' | 'telegram' | 'discord' | 'web'
  userId?: string
  priority: 'high' | 'normal' | 'low'
  createdAt: string
}

export interface PaymentDetectionJob {
  id: string
  extractionId: string
  extraction: PaymentExtraction
  context?: {
    order_id?: string
    user_id?: string
    expected_amount?: number
    currency?: 'PHP' | 'MYR'
  }
  createdAt: string
}

export interface MatchingEngineJob {
  id: string
  extractionId: string
  extraction: PaymentExtraction
  potentialMatches: Array<{
    submission_id: string
    similarity_score: number
  }>
  createdAt: string
}

export interface NotificationJob {
  id: string
  type: 'payment_detected' | 'payment_matched' | 'review_required' | 'auto_approved'
  data: {
    extraction?: PaymentExtraction
    match?: PaymentMatch
    submission?: any
    user_id: string
  }
  platforms: Array<'whatsapp' | 'telegram' | 'discord' | 'web'>
  priority: 'high' | 'normal' | 'low'
  createdAt: string
}

// Request/Response schemas
export const ProcessImageSchema = z.object({
  platform: z.enum(['whatsapp', 'telegram', 'discord', 'web']),
  submission_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  expected_amount: z.number().positive().optional(),
  currency: z.enum(['PHP', 'MYR']).optional(),
  priority: z.enum(['high', 'normal', 'low']).default('normal')
})

export const ReviewDetectionSchema = z.object({
  extraction_id: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'modify']),
  approved_match_id: z.string().uuid().optional(),
  manual_corrections: z.object({
    amount: z.number().positive().optional(),
    currency: z.enum(['PHP', 'MYR']).optional(),
    method: z.string().optional(),
    reference: z.string().optional()
  }).optional(),
  notes: z.string().optional()
})

export type ProcessImageRequest = z.infer<typeof ProcessImageSchema>
export type ReviewDetectionRequest = z.infer<typeof ReviewDetectionSchema>

// Service response types
export interface SmartAgentResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  processingTime?: number
}

// Detection statistics
export interface DetectionStats {
  total_processed: number
  successful_extractions: number
  successful_matches: number
  auto_approved: number
  requires_review: number
  failed_processing: number
  average_confidence: number
  average_processing_time: number
  by_platform: {
    whatsapp: number
    telegram: number
    discord: number
    web: number
  }
  by_currency: {
    PHP: number
    MYR: number
  }
  by_payment_method: Record<string, number>
}

// AI prompt templates
export interface AIPromptTemplates {
  paymentAnalysis: string
  amountExtraction: string
  methodIdentification: string
  referenceExtraction: string
}