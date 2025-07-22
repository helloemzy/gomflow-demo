import { OCRService } from '../ocrService'
import Tesseract from 'tesseract.js'

// Mock Tesseract
jest.mock('tesseract.js')

const mockTesseract = Tesseract as jest.Mocked<typeof Tesseract>

describe('OCRService', () => {
  let ocrService: OCRService
  let mockWorker: any

  beforeEach(() => {
    mockWorker = {
      loadLanguage: jest.fn().mockResolvedValue(undefined),
      initialize: jest.fn().mockResolvedValue(undefined),
      setParameters: jest.fn().mockResolvedValue(undefined),
      recognize: jest.fn(),
      terminate: jest.fn().mockResolvedValue(undefined)
    }
    
    mockTesseract.createWorker.mockResolvedValue(mockWorker)
    ocrService = new OCRService()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('extractText', () => {
    it('should extract text from image buffer', async () => {
      const imageBuffer = Buffer.from('image-data')
      const mockResult = {
        data: {
          text: 'GCash Payment\nAmount: PHP 1,500.00\nReference: GC123456789\nReceiver: John Doe',
          confidence: 85
        }
      }
      
      mockWorker.recognize.mockResolvedValue(mockResult)

      const result = await ocrService.extractText(imageBuffer)
      
      expect(result.text).toBe(mockResult.data.text)
      expect(result.confidence).toBe(85)
      expect(result.success).toBe(true)
      expect(mockWorker.recognize).toHaveBeenCalledWith(imageBuffer)
    })

    it('should handle OCR failures gracefully', async () => {
      const imageBuffer = Buffer.from('corrupted-image')
      
      mockWorker.recognize.mockRejectedValue(new Error('OCR processing failed'))

      const result = await ocrService.extractText(imageBuffer)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('OCR processing failed')
      expect(result.text).toBe('')
      expect(result.confidence).toBe(0)
    })

    it('should use correct language settings', async () => {
      const imageBuffer = Buffer.from('image-data')
      const mockResult = {
        data: {
          text: 'Extracted text',
          confidence: 90
        }
      }
      
      mockWorker.recognize.mockResolvedValue(mockResult)

      await ocrService.extractText(imageBuffer, 'fil')
      
      expect(mockWorker.loadLanguage).toHaveBeenCalledWith('eng+fil')
      expect(mockWorker.initialize).toHaveBeenCalledWith('eng+fil')
    })
  })

  describe('extractPaymentData', () => {
    it('should extract GCash payment information', async () => {
      const imageBuffer = Buffer.from('gcash-payment')
      const ocrText = 'GCash Payment\nAmount: PHP 1,500.00\nReference Number: GC123456789\nReceiver: John Doe\nDate: Jan 15, 2025'
      
      mockWorker.recognize.mockResolvedValue({
        data: { text: ocrText, confidence: 88 }
      })

      const result = await ocrService.extractPaymentData(imageBuffer, 'PH')
      
      expect(result.success).toBe(true)
      expect(result.paymentMethod).toBe('gcash')
      expect(result.amount).toBe(1500)
      expect(result.currency).toBe('PHP')
      expect(result.reference).toBe('GC123456789')
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should extract PayMaya payment information', async () => {
      const imageBuffer = Buffer.from('paymaya-payment')
      const ocrText = 'PayMaya\nYou sent PHP 850.50\nTransaction ID: PM987654321\nTo: Jane Smith'
      
      mockWorker.recognize.mockResolvedValue({
        data: { text: ocrText, confidence: 92 }
      })

      const result = await ocrService.extractPaymentData(imageBuffer, 'PH')
      
      expect(result.success).toBe(true)
      expect(result.paymentMethod).toBe('paymaya')
      expect(result.amount).toBe(850.5)
      expect(result.currency).toBe('PHP')
      expect(result.reference).toBe('PM987654321')
    })

    it('should extract Malaysian payment information', async () => {
      const imageBuffer = Buffer.from('maybank-payment')
      const ocrText = 'Maybank Transfer\nAmount: RM 125.00\nReference: MB555666777\nTo: Ahmad Ibrahim'
      
      mockWorker.recognize.mockResolvedValue({
        data: { text: ocrText, confidence: 87 }
      })

      const result = await ocrService.extractPaymentData(imageBuffer, 'MY')
      
      expect(result.success).toBe(true)
      expect(result.paymentMethod).toBe('maybank')
      expect(result.amount).toBe(125)
      expect(result.currency).toBe('MYR')
      expect(result.reference).toBe('MB555666777')
    })

    it('should handle unrecognizable payment screenshots', async () => {
      const imageBuffer = Buffer.from('random-image')
      const ocrText = 'Random text that does not contain payment information'
      
      mockWorker.recognize.mockResolvedValue({
        data: { text: ocrText, confidence: 45 }
      })

      const result = await ocrService.extractPaymentData(imageBuffer, 'PH')
      
      expect(result.success).toBe(false)
      expect(result.paymentMethod).toBe('unknown')
      expect(result.amount).toBe(0)
      expect(result.error).toContain('No payment information found')
    })
  })

  describe('extractPhoneNumbers', () => {
    it('should extract Philippine phone numbers', () => {
      const text = 'Contact: +639171234567 or 09281234567'
      
      const result = ocrService.extractPhoneNumbers(text, 'PH')
      
      expect(result).toEqual(['+639171234567', '09281234567'])
    })

    it('should extract Malaysian phone numbers', () => {
      const text = 'Call me at +60123456789 or 012-345-6789'
      
      const result = ocrService.extractPhoneNumbers(text, 'MY')
      
      expect(result).toHaveLength(2)
      expect(result[0]).toMatch(/^\+601/)
    })
  })

  describe('extractAmounts', () => {
    it('should extract PHP amounts with various formats', () => {
      const text = 'Total: PHP 1,500.00\nFee: ₱25.50\nBalance: P 2000'
      
      const result = ocrService.extractAmounts(text, 'PHP')
      
      expect(result).toEqual([1500, 25.5, 2000])
    })

    it('should extract MYR amounts', () => {
      const text = 'Amount: RM 125.50\nCharge: MYR 5.00'
      
      const result = ocrService.extractAmounts(text, 'MYR')
      
      expect(result).toEqual([125.5, 5])
    })
  })

  describe('extractReferences', () => {
    it('should extract GCash reference numbers', () => {
      const text = 'Reference: GC123456789\nTransaction ID GC987654321'
      
      const result = ocrService.extractReferences(text, 'gcash')
      
      expect(result).toEqual(['GC123456789', 'GC987654321'])
    })

    it('should extract PayMaya transaction IDs', () => {
      const text = 'ID: PM555666777\nTransaction PM111222333'
      
      const result = ocrService.extractReferences(text, 'paymaya')
      
      expect(result).toEqual(['PM555666777', 'PM111222333'])
    })
  })

  describe('cleanup', () => {
    it('should terminate OCR worker', async () => {
      await ocrService.cleanup()
      
      expect(mockWorker.terminate).toHaveBeenCalled()
    })
  })
})