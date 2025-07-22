import sharp from 'sharp'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs/promises'
import { Config } from '@/config'
import { ProcessedImage } from '@/types'
import { logger } from '@/utils/logger'

export class ImageService {
  constructor() {
    this.ensureDirectories()
  }

  /**
   * Ensure upload directories exist
   */
  private async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(Config.paths.uploads, { recursive: true })
      await fs.mkdir(Config.paths.processed, { recursive: true })
      await fs.mkdir(Config.paths.temp, { recursive: true })
    } catch (error: any) {
      logger.error('Failed to create directories', { error: error.message })
    }
  }

  /**
   * Validate image file
   */
  validateImage(buffer: Buffer, mimeType: string, originalName: string): { valid: boolean; error?: string } {
    // Check file size
    if (buffer.length > Config.imageSettings.maxSize) {
      return {
        valid: false,
        error: `Image too large. Maximum size: ${Config.imageSettings.maxSize / 1024 / 1024}MB`
      }
    }

    // Check mime type
    if (!Config.imageSettings.allowedTypes.includes(mimeType)) {
      return {
        valid: false,
        error: `Invalid image type. Allowed types: ${Config.imageSettings.allowedTypes.join(', ')}`
      }
    }

    // Check for potential security issues
    const extension = path.extname(originalName).toLowerCase()
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp']
    if (!allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`
      }
    }

    return { valid: true }
  }

  /**
   * Process and optimize image for OCR/AI analysis
   */
  async processImage(
    buffer: Buffer,
    originalName: string,
    mimeType: string
  ): Promise<ProcessedImage> {
    try {
      // Validate image
      const validation = this.validateImage(buffer, mimeType, originalName)
      if (!validation.valid) {
        throw new Error(validation.error)
      }

      // Generate file hash and paths
      const fileHash = crypto.createHash('sha256').update(buffer).digest('hex')
      const timestamp = new Date().toISOString()
      const safeOriginalName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_')
      
      const originalPath = path.join(Config.paths.uploads, `${fileHash}_${safeOriginalName}`)
      const processedPath = path.join(Config.paths.processed, `${fileHash}_processed.jpg`)

      // Save original file
      await fs.writeFile(originalPath, buffer)

      logger.info('Processing image for OCR optimization', {
        originalName,
        fileHash: fileHash.substring(0, 8),
        size: buffer.length
      })

      // Process image with Sharp for optimal OCR
      const sharpInstance = sharp(buffer)
      const metadata = await sharpInstance.metadata()

      // Optimize for OCR: convert to grayscale, enhance contrast, resize if needed
      let processedBuffer = await sharpInstance
        .resize({
          width: Math.min(metadata.width || Config.imageSettings.maxWidth, Config.imageSettings.maxWidth),
          height: Math.min(metadata.height || Config.imageSettings.maxHeight, Config.imageSettings.maxHeight),
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({
          quality: Config.imageSettings.quality,
          progressive: true,
          mozjpeg: true
        })
        .toBuffer()

      // Save processed image
      await fs.writeFile(processedPath, processedBuffer)

      // Get final metadata
      const processedMetadata = await sharp(processedBuffer).metadata()

      const result: ProcessedImage = {
        originalPath,
        processedPath,
        width: processedMetadata.width || 0,
        height: processedMetadata.height || 0,
        size: processedBuffer.length,
        format: 'jpeg',
        quality: Config.imageSettings.quality,
        metadata: {
          originalName,
          uploadedAt: timestamp,
          processedAt: new Date().toISOString(),
          fileHash
        }
      }

      logger.info('Image processed successfully', {
        fileHash: fileHash.substring(0, 8),
        originalSize: buffer.length,
        processedSize: processedBuffer.length,
        dimensions: `${result.width}x${result.height}`,
        compression: `${((1 - processedBuffer.length / buffer.length) * 100).toFixed(1)}%`
      })

      return result

    } catch (error: any) {
      logger.error('Image processing failed', {
        originalName,
        error: error.message,
        stack: error.stack
      })
      throw new Error(`Image processing failed: ${error.message}`)
    }
  }

  /**
   * Create OCR-optimized version of image
   */
  async createOCROptimizedImage(imagePath: string): Promise<string> {
    try {
      const ocrPath = imagePath.replace('.jpg', '_ocr.jpg')
      
      // Enhanced processing for OCR
      await sharp(imagePath)
        .greyscale() // Convert to grayscale for better OCR
        .sharpen() // Enhance text sharpness
        .normalise() // Improve contrast
        .threshold(128) // Convert to black and white for clear text
        .jpeg({ quality: 95 }) // High quality for text recognition
        .toFile(ocrPath)

      logger.debug('Created OCR-optimized image', {
        original: imagePath,
        ocr: ocrPath
      })

      return ocrPath

    } catch (error: any) {
      logger.error('Failed to create OCR-optimized image', {
        imagePath,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Create thumbnail for quick preview
   */
  async createThumbnail(imagePath: string, size: number = 200): Promise<string> {
    try {
      const thumbnailPath = imagePath.replace('.jpg', '_thumb.jpg')
      
      await sharp(imagePath)
        .resize(size, size, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath)

      return thumbnailPath

    } catch (error: any) {
      logger.error('Failed to create thumbnail', {
        imagePath,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Clean up old processed files
   */
  async cleanupOldFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      const directories = [Config.paths.uploads, Config.paths.processed, Config.paths.temp]
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000)

      for (const dir of directories) {
        const files = await fs.readdir(dir)
        
        for (const file of files) {
          const filePath = path.join(dir, file)
          const stats = await fs.stat(filePath)
          
          if (stats.mtime.getTime() < cutoffTime) {
            await fs.unlink(filePath)
            logger.debug('Cleaned up old file', { filePath, age: maxAgeHours })
          }
        }
      }

      logger.info('File cleanup completed', { maxAgeHours })

    } catch (error: any) {
      logger.error('File cleanup failed', { error: error.message })
    }
  }

  /**
   * Get image buffer from file path
   */
  async getImageBuffer(imagePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(imagePath)
    } catch (error: any) {
      logger.error('Failed to read image file', {
        imagePath,
        error: error.message
      })
      throw new Error(`Failed to read image: ${error.message}`)
    }
  }

  /**
   * Get image info without processing
   */
  async getImageInfo(buffer: Buffer): Promise<{
    width: number
    height: number
    format: string
    size: number
    channels: number
  }> {
    try {
      const metadata = await sharp(buffer).metadata()
      
      return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || 'unknown',
        size: buffer.length,
        channels: metadata.channels || 0
      }

    } catch (error: any) {
      logger.error('Failed to get image info', { error: error.message })
      throw error
    }
  }
}

export default ImageService