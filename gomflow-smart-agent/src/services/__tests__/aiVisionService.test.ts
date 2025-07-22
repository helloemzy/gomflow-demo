import { AIVisionService } from '../aiVisionService'
import OpenAI from 'openai'

// Mock OpenAI
jest.mock('openai')

const mockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>

describe('AIVisionService', () => {
  let aiVisionService: AIVisionService
  let mockOpenAIInstance: any

  beforeEach(() => {
    mockOpenAIInstance = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    }
    
    mockOpenAI.mockImplementation(() => mockOpenAIInstance)
    aiVisionService = new AIVisionService()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('analyzePaymentScreenshot', () => {
    it('should analyze GCash payment screenshot successfully', async () => {
      const imagePath = '/test/gcash-payment.jpg'
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              success: true,
              payment_method: 'gcash',
              amount: 1500,
              currency: 'PHP',
              reference_number: 'GC123456789',
              sender_name: 'John Doe',
              receiver_name: 'Jane Smith',
              transaction_date: '2025-01-15',
              confidence: 0.92,
              additional_info: {
                app_name: 'GCash',
                transaction_type: 'Send Money'
              }
            })
          }
        }]
      }
      
      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockResponse)

      const result = await aiVisionService.analyzePaymentScreenshot(imagePath)
      
      expect(result.success).toBe(true)
      expect(result.payment_method).toBe('gcash')
      expect(result.amount).toBe(1500)
      expect(result.currency).toBe('PHP')
      expect(result.reference_number).toBe('GC123456789')
      expect(result.confidence).toBe(0.92)
    })

    it('should handle PayMaya payment analysis', async () => {
      const imagePath = '/test/paymaya-payment.jpg'
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              success: true,
              payment_method: 'paymaya',
              amount: 750.5,
              currency: 'PHP',
              reference_number: 'PM987654321',
              sender_name: 'Alice Brown',
              receiver_name: 'Bob Wilson',
              confidence: 0.88
            })
          }
        }]
      }
      
      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockResponse)

      const result = await aiVisionService.analyzePaymentScreenshot(imagePath)
      
      expect(result.payment_method).toBe('paymaya')
      expect(result.amount).toBe(750.5)
      expect(result.reference_number).toBe('PM987654321')
    })

    it('should handle Malaysian payment methods', async () => {
      const imagePath = '/test/maybank-payment.jpg'
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              success: true,
              payment_method: 'maybank',
              amount: 125,
              currency: 'MYR',
              reference_number: 'MB555666777',
              sender_name: 'Ahmad Ibrahim',
              receiver_name: 'Siti Nurhaliza',
              confidence: 0.85
            })
          }
        }]
      }
      
      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockResponse)

      const result = await aiVisionService.analyzePaymentScreenshot(imagePath)
      
      expect(result.payment_method).toBe('maybank')
      expect(result.currency).toBe('MYR')
      expect(result.amount).toBe(125)
    })

    it('should handle unrecognizable images', async () => {
      const imagePath = '/test/random-image.jpg'
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              success: false,
              payment_method: 'unknown',
              error: 'No payment information detected in image',
              confidence: 0.15
            })
          }
        }]
      }
      
      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockResponse)

      const result = await aiVisionService.analyzePaymentScreenshot(imagePath)
      
      expect(result.success).toBe(false)
      expect(result.payment_method).toBe('unknown')
      expect(result.error).toContain('No payment information detected')
    })

    it('should handle OpenAI API errors', async () => {
      const imagePath = '/test/payment.jpg'
      
      mockOpenAIInstance.chat.completions.create.mockRejectedValue(
        new Error('OpenAI API rate limit exceeded')
      )

      await expect(aiVisionService.analyzePaymentScreenshot(imagePath))
        .rejects.toThrow('OpenAI API rate limit exceeded')
    })

    it('should handle invalid JSON responses', async () => {
      const imagePath = '/test/payment.jpg'
      const mockResponse = {
        choices: [{
          message: {
            content: 'Invalid JSON response from AI'
          }
        }]
      }
      
      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockResponse)

      await expect(aiVisionService.analyzePaymentScreenshot(imagePath))
        .rejects.toThrow('Failed to parse AI response')
    })
  })

  describe('extractTextFromImage', () => {
    it('should extract readable text from image', async () => {
      const imagePath = '/test/text-image.jpg'
      const mockResponse = {
        choices: [{
          message: {
            content: 'GCash Payment\nAmount: PHP 1,500.00\nReference: GC123456789\nReceiver: John Doe'
          }
        }]
      }
      
      mockOpenAIInstance.chat.completions.create.mockResolvedValue(mockResponse)

      const result = await aiVisionService.extractTextFromImage(imagePath)
      
      expect(result).toContain('GCash Payment')
      expect(result).toContain('PHP 1,500.00')
      expect(result).toContain('GC123456789')
    })
  })

  describe('validatePaymentData', () => {
    it('should validate complete payment data', () => {
      const paymentData = {
        success: true,
        payment_method: 'gcash',
        amount: 1500,
        currency: 'PHP',
        reference_number: 'GC123456789',
        sender_name: 'John Doe',
        confidence: 0.92
      }
      
      const result = aiVisionService.validatePaymentData(paymentData)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should detect missing required fields', () => {
      const paymentData = {
        success: true,
        payment_method: 'gcash',
        // Missing amount and currency
        reference_number: 'GC123456789'
      }
      
      const result = aiVisionService.validatePaymentData(paymentData)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Missing amount')
      expect(result.errors).toContain('Missing currency')
    })

    it('should validate amount ranges', () => {
      const paymentData = {
        success: true,
        payment_method: 'gcash',
        amount: -100, // Invalid negative amount
        currency: 'PHP',
        reference_number: 'GC123456789'
      }
      
      const result = aiVisionService.validatePaymentData(paymentData)
      
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Invalid amount')
    })
  })

  describe('calculateConfidence', () => {
    it('should calculate high confidence for complete data', () => {
      const paymentData = {
        payment_method: 'gcash',
        amount: 1500,
        currency: 'PHP',
        reference_number: 'GC123456789',
        sender_name: 'John Doe',
        receiver_name: 'Jane Smith',
        transaction_date: '2025-01-15'
      }
      
      const confidence = aiVisionService.calculateConfidence(paymentData)
      
      expect(confidence).toBeGreaterThan(0.8)
    })

    it('should calculate lower confidence for incomplete data', () => {
      const paymentData = {
        payment_method: 'unknown',
        amount: 1500,
        currency: 'PHP'
        // Missing reference and names
      }
      
      const confidence = aiVisionService.calculateConfidence(paymentData)
      
      expect(confidence).toBeLessThan(0.6)
    })
  })
})