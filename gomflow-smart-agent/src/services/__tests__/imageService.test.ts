import { ImageService } from '../imageService'
import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'

// Mock sharp
jest.mock('sharp')
jest.mock('fs/promises')

const mockSharp = sharp as jest.MockedFunction<typeof sharp>
const mockFs = fs as jest.Mocked<typeof fs>

describe('ImageService', () => {
  let imageService: ImageService
  let mockSharpInstance: any

  beforeEach(() => {
    imageService = new ImageService()
    
    mockSharpInstance = {
      resize: jest.fn().mockReturnThis(),
      jpeg: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      toBuffer: jest.fn(),
      metadata: jest.fn()
    }
    
    mockSharp.mockReturnValue(mockSharpInstance)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('validateImage', () => {
    it('should validate valid image buffer', async () => {
      const buffer = Buffer.from('valid-image')
      const filename = 'test.jpg'
      
      mockSharpInstance.metadata.mockResolvedValue({
        width: 1920,
        height: 1080,
        format: 'jpeg',
        size: 1024000
      })

      const result = await imageService.validateImage(buffer, filename)
      
      expect(result.isValid).toBe(true)
      expect(result.metadata).toEqual({
        width: 1920,
        height: 1080,
        format: 'jpeg',
        size: 1024000
      })
    })

    it('should reject oversized images', async () => {
      const buffer = Buffer.from('large-image')
      const filename = 'large.jpg'
      
      mockSharpInstance.metadata.mockResolvedValue({
        width: 8000,
        height: 6000,
        format: 'jpeg',
        size: 50000000 // 50MB
      })

      const result = await imageService.validateImage(buffer, filename)
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('too large')
    })

    it('should reject invalid image formats', async () => {
      const buffer = Buffer.from('invalid-file')
      const filename = 'test.txt'
      
      mockSharpInstance.metadata.mockRejectedValue(new Error('Input file is missing'))

      const result = await imageService.validateImage(buffer, filename)
      
      expect(result.isValid).toBe(false)
      expect(result.error).toContain('Invalid image format')
    })
  })

  describe('optimizeForOCR', () => {
    it('should optimize image for OCR processing', async () => {
      const inputBuffer = Buffer.from('input-image')
      const optimizedBuffer = Buffer.from('optimized-image')
      
      mockSharpInstance.toBuffer.mockResolvedValue(optimizedBuffer)

      const result = await imageService.optimizeForOCR(inputBuffer)
      
      expect(mockSharpInstance.resize).toHaveBeenCalledWith({
        width: 2000,
        height: 2000,
        fit: 'inside',
        withoutEnlargement: true
      })
      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({
        quality: 95,
        progressive: false
      })
      expect(result).toEqual(optimizedBuffer)
    })

    it('should handle optimization errors', async () => {
      const inputBuffer = Buffer.from('input-image')
      
      mockSharpInstance.toBuffer.mockRejectedValue(new Error('Processing failed'))

      await expect(imageService.optimizeForOCR(inputBuffer))
        .rejects.toThrow('Failed to optimize image for OCR')
    })
  })

  describe('createThumbnail', () => {
    it('should create thumbnail with correct dimensions', async () => {
      const inputBuffer = Buffer.from('input-image')
      const thumbnailBuffer = Buffer.from('thumbnail-image')
      
      mockSharpInstance.toBuffer.mockResolvedValue(thumbnailBuffer)

      const result = await imageService.createThumbnail(inputBuffer, 300, 300)
      
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(300, 300, {
        fit: 'cover',
        position: 'center'
      })
      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 80 })
      expect(result).toEqual(thumbnailBuffer)
    })
  })

  describe('saveProcessedImage', () => {
    it('should save image to processed directory', async () => {
      const buffer = Buffer.from('processed-image')
      const filename = 'processed_123.jpg'
      const expectedPath = path.join(process.cwd(), 'src/processed', filename)
      
      mockFs.writeFile.mockResolvedValue()

      const result = await imageService.saveProcessedImage(buffer, filename)
      
      expect(mockFs.writeFile).toHaveBeenCalledWith(expectedPath, buffer)
      expect(result).toBe(expectedPath)
    })

    it('should handle save errors', async () => {
      const buffer = Buffer.from('processed-image')
      const filename = 'processed_123.jpg'
      
      mockFs.writeFile.mockRejectedValue(new Error('Write failed'))

      await expect(imageService.saveProcessedImage(buffer, filename))
        .rejects.toThrow('Failed to save processed image')
    })
  })

  describe('getImageMetadata', () => {
    it('should return comprehensive image metadata', async () => {
      const buffer = Buffer.from('image-data')
      const metadata = {
        width: 1920,
        height: 1080,
        format: 'jpeg',
        size: 1024000,
        density: 72,
        hasAlpha: false,
        channels: 3
      }
      
      mockSharpInstance.metadata.mockResolvedValue(metadata)

      const result = await imageService.getImageMetadata(buffer)
      
      expect(result).toEqual(metadata)
    })
  })

  describe('cleanup', () => {
    it('should remove old temporary files', async () => {
      const oldFiles = ['old1.jpg', 'old2.png']
      
      mockFs.readdir.mockResolvedValue(oldFiles as any)
      mockFs.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 25 * 60 * 60 * 1000) // 25 hours ago
      } as any)
      mockFs.unlink.mockResolvedValue()

      await imageService.cleanup()
      
      expect(mockFs.unlink).toHaveBeenCalledTimes(2)
    })
  })
})