import OpenAI from 'openai'
import fs from 'fs/promises'
import { Config } from '@/config'
import { AIVisionResult, AIPromptTemplates } from '@/types'
import { logger } from '@/utils/logger'

export class AIVisionService {
  private openai: OpenAI
  private prompts: AIPromptTemplates

  constructor() {
    this.openai = new OpenAI({
      apiKey: Config.aiSettings.openai.apiKey
    })

    // Initialize AI prompts for payment analysis
    this.prompts = {
      paymentAnalysis: `You are an expert at analyzing payment screenshots from Southeast Asian mobile payment apps and banking systems. 

Analyze this payment screenshot and extract the following information:
- Payment method (GCash, PayMaya, Maya, BPI, Maybank, CIMB, Touch 'n Go, etc.)
- Amount paid (look for currency symbols ₱ for PHP or RM for MYR)
- Sender information (name, phone number)
- Recipient information (name, phone number)
- Transaction ID or reference number
- Timestamp of payment
- Bank or service name

Respond in JSON format with this structure:
{
  "paymentMethod": "string",
  "amount": number,
  "currency": "PHP" or "MYR",
  "senderInfo": "string",
  "recipientInfo": "string", 
  "transactionId": "string",
  "timestamp": "string",
  "bankName": "string",
  "referenceNumber": "string",
  "confidence": number (0-1),
  "reasoning": "explanation of what you found"
}

Be especially careful about:
1. Distinguishing between sender and recipient
2. Identifying the correct amount (not fees or balances)
3. Reading phone numbers correctly (09XXXXXXXXX for PH, 01XXXXXXXX for MY)
4. Finding transaction references that buyers would use to prove payment`,

      amountExtraction: `Extract all monetary amounts from this payment screenshot. Look for:
- Main payment amount
- Fees or charges
- Balance amounts
- Any other monetary values

Focus on the actual payment amount sent, not account balances or fees.
Currency symbols: ₱ for Philippines Peso, RM for Malaysian Ringgit.`,

      methodIdentification: `Identify the payment method used in this screenshot. Common methods include:
Philippines: GCash, PayMaya/Maya, GrabPay, BPI, BDO, Metrobank, UnionBank
Malaysia: Maybank2u, CIMB, Touch 'n Go, Boost, GrabPay, Public Bank, Hong Leong Bank`,

      referenceExtraction: `Extract transaction reference numbers, IDs, or confirmation codes from this payment screenshot. Look for:
- Transaction ID
- Reference number
- Confirmation code  
- Receipt number
- Any alphanumeric code that proves this transaction`
    }
  }

  /**
   * Analyze payment screenshot using GPT-4 Vision
   */
  async analyzePaymentScreenshot(imagePath: string): Promise<AIVisionResult> {
    try {
      logger.info('Starting AI vision analysis', { imagePath })
      const startTime = Date.now()

      // Read and encode image
      const imageBuffer = await fs.readFile(imagePath)
      const base64Image = imageBuffer.toString('base64')
      const mimeType = this.getMimeTypeFromPath(imagePath)

      // Analyze with GPT-4 Vision
      const response = await this.openai.chat.completions.create({
        model: Config.aiSettings.openai.model,
        max_tokens: Config.aiSettings.openai.maxTokens,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: this.prompts.paymentAnalysis
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ]
      })

      const processingTime = Date.now() - startTime
      const aiResponse = response.choices[0]?.message?.content

      if (!aiResponse) {
        throw new Error('No response from AI vision analysis')
      }

      // Parse AI response
      let detectedElements
      let confidence = 0.5
      let reasoning = 'AI analysis completed'

      try {
        // Try to parse as JSON
        const parsed = JSON.parse(aiResponse)
        detectedElements = {
          paymentMethod: parsed.paymentMethod,
          amount: parsed.amount,
          currency: parsed.currency,
          senderInfo: parsed.senderInfo,
          recipientInfo: parsed.recipientInfo,
          transactionId: parsed.transactionId,
          timestamp: parsed.timestamp,
          bankName: parsed.bankName,
          referenceNumber: parsed.referenceNumber
        }
        confidence = parsed.confidence || 0.8
        reasoning = parsed.reasoning || 'AI analysis completed'
      } catch (parseError) {
        // If not JSON, extract information manually
        logger.warn('AI response not in JSON format, parsing manually', { response: aiResponse })
        detectedElements = this.parseNonJSONResponse(aiResponse)
        confidence = 0.6
        reasoning = 'Manual parsing of AI response'
      }

      const result: AIVisionResult = {
        description: aiResponse,
        detectedElements,
        confidence,
        reasoning,
        extractedAt: new Date().toISOString(),
        model: Config.aiSettings.openai.model,
        tokenUsage: {
          prompt: response.usage?.prompt_tokens || 0,
          completion: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0
        }
      }

      logger.info('AI vision analysis completed', {
        imagePath,
        confidence,
        processingTimeMs: processingTime,
        tokensUsed: result.tokenUsage?.total,
        elementsDetected: Object.keys(detectedElements).filter(key => detectedElements[key as keyof typeof detectedElements]).length
      })

      return result

    } catch (error: any) {
      logger.error('AI vision analysis failed', {
        imagePath,
        error: error.message,
        stack: error.stack
      })
      throw new Error(`AI vision analysis failed: ${error.message}`)
    }
  }

  /**
   * Perform focused analysis on specific aspect of payment
   */
  async focusedAnalysis(
    imagePath: string, 
    focus: 'amount' | 'method' | 'reference'
  ): Promise<{ result: string; confidence: number }> {
    try {
      const imageBuffer = await fs.readFile(imagePath)
      const base64Image = imageBuffer.toString('base64')
      const mimeType = this.getMimeTypeFromPath(imagePath)

      let prompt = ''
      switch (focus) {
        case 'amount':
          prompt = this.prompts.amountExtraction
          break
        case 'method':
          prompt = this.prompts.methodIdentification
          break
        case 'reference':
          prompt = this.prompts.referenceExtraction
          break
      }

      const response = await this.openai.chat.completions.create({
        model: Config.aiSettings.openai.model,
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: 'high'
                }
              }
            ]
          }
        ]
      })

      const result = response.choices[0]?.message?.content || ''
      
      logger.debug('Focused AI analysis completed', {
        focus,
        resultLength: result.length
      })

      return {
        result,
        confidence: 0.8 // Default confidence for focused analysis
      }

    } catch (error: any) {
      logger.error('Focused AI analysis failed', {
        imagePath,
        focus,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Parse non-JSON AI response manually
   */
  private parseNonJSONResponse(response: string): any {
    const result: any = {}

    // Extract payment method
    const methodMatch = response.match(/payment method[:\s]*([^\n,]+)/i)
    if (methodMatch) result.paymentMethod = methodMatch[1].trim()

    // Extract amount
    const amountMatch = response.match(/amount[:\s]*[₱RM]?\s?(\d+(?:,\d{3})*(?:\.\d{2})?)/i)
    if (amountMatch) result.amount = parseFloat(amountMatch[1].replace(/,/g, ''))

    // Extract currency
    if (response.includes('₱') || response.toLowerCase().includes('php') || response.toLowerCase().includes('peso')) {
      result.currency = 'PHP'
    } else if (response.includes('RM') || response.toLowerCase().includes('myr') || response.toLowerCase().includes('ringgit')) {
      result.currency = 'MYR'
    }

    // Extract sender info
    const senderMatch = response.match(/sender[:\s]*([^\n,]+)/i)
    if (senderMatch) result.senderInfo = senderMatch[1].trim()

    // Extract recipient info
    const recipientMatch = response.match(/recipient[:\s]*([^\n,]+)/i)
    if (recipientMatch) result.recipientInfo = recipientMatch[1].trim()

    // Extract transaction ID
    const transactionMatch = response.match(/transaction\s?id[:\s]*([^\n,\s]+)/i)
    if (transactionMatch) result.transactionId = transactionMatch[1].trim()

    // Extract reference number
    const refMatch = response.match(/reference[:\s]*([^\n,\s]+)/i)
    if (refMatch) result.referenceNumber = refMatch[1].trim()

    return result
  }

  /**
   * Get MIME type from file path
   */
  private getMimeTypeFromPath(imagePath: string): string {
    const extension = imagePath.toLowerCase().split('.').pop()
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg'
      case 'png':
        return 'image/png'
      case 'webp':
        return 'image/webp'
      default:
        return 'image/jpeg'
    }
  }

  /**
   * Validate extracted payment data
   */
  validateExtraction(elements: any): { valid: boolean; issues: string[] } {
    const issues: string[] = []

    // Check amount
    if (!elements.amount || isNaN(elements.amount)) {
      issues.push('No valid amount detected')
    } else if (elements.amount < Config.detectionThresholds.minAmount) {
      issues.push('Amount below minimum threshold')
    } else if (elements.amount > Config.detectionThresholds.maxAmount) {
      issues.push('Amount above maximum threshold')
    }

    // Check currency
    if (!elements.currency || !['PHP', 'MYR'].includes(elements.currency)) {
      issues.push('No valid currency detected')
    }

    // Check payment method
    if (!elements.paymentMethod) {
      issues.push('No payment method detected')
    }

    return {
      valid: issues.length === 0,
      issues
    }
  }

  /**
   * Get service status
   */
  getStatus(): { ready: boolean; model: string } {
    return {
      ready: !!this.openai,
      model: Config.aiSettings.openai.model
    }
  }
}

export default AIVisionService