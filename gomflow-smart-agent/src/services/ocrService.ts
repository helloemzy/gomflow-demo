import Tesseract from 'tesseract.js'
import { Config } from '@/config'
import { OCRResult } from '@/types'
import { logger } from '@/utils/logger'

export class OCRService {
  private worker: Tesseract.Worker | null = null

  constructor() {
    this.initializeWorker()
  }

  /**
   * Initialize Tesseract worker
   */
  private async initializeWorker(): Promise<void> {
    try {
      logger.info('Initializing OCR worker', {
        languages: Config.aiSettings.ocr.languages,
        confidenceThreshold: Config.aiSettings.ocr.confidenceThreshold
      })

      this.worker = await Tesseract.createWorker(Config.aiSettings.ocr.languages, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            logger.debug('OCR progress', { progress: `${(m.progress * 100).toFixed(1)}%` })
          }
        }
      })

      // Configure OCR parameters for payment screenshot optimization
      await this.worker.setParameters({
        tessedit_char_whitelist: '0123456789.,₱RM+-:()[]ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/',
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, // Good for screenshots with various text layouts
        preserve_interword_spaces: '1'
      })

      logger.info('OCR worker initialized successfully')

    } catch (error: any) {
      logger.error('Failed to initialize OCR worker', { error: error.message })
      throw error
    }
  }

  /**
   * Extract text from image using OCR
   */
  async extractText(imagePath: string): Promise<OCRResult> {
    try {
      if (!this.worker) {
        await this.initializeWorker()
      }

      logger.info('Starting OCR text extraction', { imagePath })
      const startTime = Date.now()

      const { data } = await this.worker!.recognize(imagePath)
      const processingTime = Date.now() - startTime

      // Process words with confidence filtering
      const words = data.words
        .filter(word => word.confidence >= Config.aiSettings.ocr.confidenceThreshold)
        .map(word => ({
          text: word.text,
          confidence: word.confidence,
          bbox: {
            x0: word.bbox.x0,
            y0: word.bbox.y0,
            x1: word.bbox.x1,
            y1: word.bbox.y1
          }
        }))

      // Process blocks (paragraphs/lines)
      const blocks = data.blocks
        .filter(block => block.confidence >= Config.aiSettings.ocr.confidenceThreshold)
        .map(block => ({
          text: block.text,
          confidence: block.confidence,
          bbox: {
            x0: block.bbox.x0,
            y0: block.bbox.y0,
            x1: block.bbox.x1,
            y1: block.bbox.y1
          }
        }))

      const result: OCRResult = {
        text: data.text,
        confidence: data.confidence,
        words,
        blocks,
        extractedAt: new Date().toISOString(),
        language: Config.aiSettings.ocr.languages
      }

      logger.info('OCR extraction completed', {
        imagePath,
        confidence: data.confidence,
        wordsExtracted: words.length,
        blocksExtracted: blocks.length,
        processingTimeMs: processingTime,
        textLength: data.text.length
      })

      return result

    } catch (error: any) {
      logger.error('OCR extraction failed', {
        imagePath,
        error: error.message,
        stack: error.stack
      })
      throw new Error(`OCR extraction failed: ${error.message}`)
    }
  }

  /**
   * Extract specific payment information using pattern matching
   */
  extractPaymentInfo(ocrResult: OCRResult, currency: 'PHP' | 'MYR' = 'PHP'): {
    amounts: Array<{ value: number; confidence: number; position: any }>
    phoneNumbers: Array<{ value: string; confidence: number; position: any }>
    references: Array<{ value: string; confidence: number; position: any }>
    methods: Array<{ value: string; confidence: number; position: any }>
  } {
    try {
      const patterns = Config.paymentPatterns[currency]
      const text = ocrResult.text
      const words = ocrResult.words

      // Extract amounts
      const amounts: Array<{ value: number; confidence: number; position: any }> = []
      
      Object.values(patterns).forEach(pattern => {
        const matches = text.match(pattern.amountPattern) || []
        matches.forEach(match => {
          const cleanAmount = match.replace(/[₱RM,\s]/g, '')
          const amount = parseFloat(cleanAmount)
          
          if (!isNaN(amount) && amount >= Config.detectionThresholds.minAmount && amount <= Config.detectionThresholds.maxAmount) {
            // Find position in words
            const wordMatch = words.find(word => word.text.includes(cleanAmount))
            amounts.push({
              value: amount,
              confidence: wordMatch?.confidence || 0.8,
              position: wordMatch?.bbox
            })
          }
        })
      })

      // Extract phone numbers
      const phoneNumbers: Array<{ value: string; confidence: number; position: any }> = []
      
      Object.values(patterns).forEach(pattern => {
        if (pattern.numberPattern) {
          const matches = text.match(pattern.numberPattern) || []
          matches.forEach(match => {
            const wordMatch = words.find(word => word.text.includes(match))
            phoneNumbers.push({
              value: match,
              confidence: wordMatch?.confidence || 0.7,
              position: wordMatch?.bbox
            })
          })
        }
      })

      // Extract payment methods
      const methods: Array<{ value: string; confidence: number; position: any }> = []
      
      Object.entries(patterns).forEach(([methodName, pattern]) => {
        pattern.keywords.forEach(keyword => {
          if (text.toLowerCase().includes(keyword.toLowerCase())) {
            const wordMatch = words.find(word => 
              word.text.toLowerCase().includes(keyword.toLowerCase())
            )
            methods.push({
              value: methodName,
              confidence: wordMatch?.confidence || 0.8,
              position: wordMatch?.bbox
            })
          }
        })
      })

      // Extract reference numbers (common patterns)
      const references: Array<{ value: string; confidence: number; position: any }> = []
      const refPatterns = [
        /ref[:\s]*([a-zA-Z0-9]{8,20})/gi,
        /reference[:\s]*([a-zA-Z0-9]{8,20})/gi,
        /txn[:\s]*([a-zA-Z0-9]{8,20})/gi,
        /transaction[:\s]*([a-zA-Z0-9]{8,20})/gi,
        /[A-Z]{2,3}-[A-Z0-9]{6,12}/g // Format like PH-ABC123456
      ]

      refPatterns.forEach(pattern => {
        const matches = text.match(pattern) || []
        matches.forEach(match => {
          const wordMatch = words.find(word => word.text.includes(match))
          references.push({
            value: match,
            confidence: wordMatch?.confidence || 0.6,
            position: wordMatch?.bbox
          })
        })
      })

      logger.debug('Payment info extracted from OCR', {
        amounts: amounts.length,
        phoneNumbers: phoneNumbers.length,
        methods: methods.length,
        references: references.length
      })

      return {
        amounts: amounts.slice(0, 5), // Limit to top 5 results
        phoneNumbers: phoneNumbers.slice(0, 5),
        references: references.slice(0, 5),
        methods: methods.slice(0, 5)
      }

    } catch (error: any) {
      logger.error('Failed to extract payment info from OCR', {
        error: error.message
      })
      return { amounts: [], phoneNumbers: [], references: [], methods: [] }
    }
  }

  /**
   * Cleanup OCR worker
   */
  async cleanup(): Promise<void> {
    try {
      if (this.worker) {
        await this.worker.terminate()
        this.worker = null
        logger.info('OCR worker terminated')
      }
    } catch (error: any) {
      logger.error('Failed to cleanup OCR worker', { error: error.message })
    }
  }

  /**
   * Get OCR worker status
   */
  getStatus(): { initialized: boolean; ready: boolean } {
    return {
      initialized: this.worker !== null,
      ready: this.worker !== null
    }
  }
}

export default OCRService