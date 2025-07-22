/**
 * Jest test setup configuration for Smart Agent service
 */

import { jest } from '@jest/globals'

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.SERVICE_SECRET = 'test_service_secret_32_characters_long'
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_role_key'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.OPENAI_API_KEY = 'test_openai_key'
process.env.MAX_FILE_SIZE = '20971520'
process.env.ALLOWED_FILE_TYPES = 'image/jpeg,image/png,image/webp'
process.env.LOG_LEVEL = 'error'

// Mock external services
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }))
}))

jest.mock('tesseract.js', () => ({
  recognize: jest.fn(),
  createWorker: jest.fn()
}))

jest.mock('sharp', () => jest.fn().mockImplementation(() => ({
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('test'))
})))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null })
    })
  })
}))

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn().mockReturnValue({
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn()
  })
}))

// Global test utilities
global.createMockImage = () => Buffer.from('mock-image-data')
global.createMockPaymentScreenshot = () => ({
  buffer: Buffer.from('mock-payment-screenshot'),
  filename: 'payment.jpg',
  mimetype: 'image/jpeg',
  size: 1024000
})

// Increase timeout for AI processing tests
jest.setTimeout(30000)

// Console log suppression in tests
const originalConsole = console
beforeAll(() => {
  console.log = jest.fn()
  console.warn = jest.fn()
  console.error = jest.fn()
})

afterAll(() => {
  console.log = originalConsole.log
  console.warn = originalConsole.warn
  console.error = originalConsole.error
})