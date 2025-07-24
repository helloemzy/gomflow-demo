import { createSupabaseAdminClient } from './supabase-production'
import { v4 as uuidv4 } from 'uuid'

// Production file upload configuration
export interface FileUploadConfig {
  bucket: string
  maxSize: number
  allowedTypes: string[]
  path?: string
  isPublic?: boolean
}

// File upload configurations for different use cases
export const uploadConfigs: Record<string, FileUploadConfig> = {
  paymentProofs: {
    bucket: 'payment-proofs',
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    path: 'proofs',
    isPublic: false
  },
  profileImages: {
    bucket: 'profile-images',
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
    path: 'profiles',
    isPublic: true
  },
  orderImages: {
    bucket: 'order-images', 
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
    path: 'orders',
    isPublic: true
  },
  exportFiles: {
    bucket: 'export-files',
    maxSize: 50 * 1024 * 1024, // 50MB
    allowedTypes: ['application/pdf', 'text/csv', 'application/xlsx'],
    path: 'exports',
    isPublic: false
  }
}

// File validation utilities
export const fileValidation = {
  validateFileType(file: File, allowedTypes: string[]): boolean {
    return allowedTypes.includes(file.type)
  },

  validateFileSize(file: File, maxSize: number): boolean {
    return file.size <= maxSize
  },

  sanitizeFileName(fileName: string): string {
    // Remove dangerous characters and ensure safe filename
    return fileName
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .toLowerCase()
      .substring(0, 100) // Limit length
  },

  generateSecureFileName(originalName: string, prefix?: string): string {
    const timestamp = Date.now()
    const uuid = uuidv4().substring(0, 8)
    const sanitizedName = this.sanitizeFileName(originalName)
    const extension = sanitizedName.split('.').pop() || ''
    
    return `${prefix ? prefix + '_' : ''}${timestamp}_${uuid}.${extension}`
  }
}

// Production file upload service
export class ProductionStorageService {
  private supabase = createSupabaseAdminClient()

  async uploadFile(
    file: File,
    configKey: keyof typeof uploadConfigs,
    userId?: string,
    options?: {
      customPath?: string
      customFileName?: string
      metadata?: Record<string, any>
    }
  ): Promise<{
    success: boolean
    data?: {
      path: string
      url: string
      publicUrl?: string
    }
    error?: string
  }> {
    try {
      const config = uploadConfigs[configKey]
      if (!config) {
        return { success: false, error: 'Invalid upload configuration' }
      }

      // Validate file type
      if (!fileValidation.validateFileType(file, config.allowedTypes)) {
        return { 
          success: false, 
          error: `File type not allowed. Allowed types: ${config.allowedTypes.join(', ')}` 
        }
      }

      // Validate file size
      if (!fileValidation.validateFileSize(file, config.maxSize)) {
        return { 
          success: false, 
          error: `File too large. Maximum size: ${Math.round(config.maxSize / 1024 / 1024)}MB` 
        }
      }

      // Generate secure file path
      const fileName = options?.customFileName || 
        fileValidation.generateSecureFileName(file.name, configKey)
      
      const basePath = options?.customPath || config.path || ''
      const userPath = userId ? `${userId}/` : ''
      const fullPath = `${basePath}/${userPath}${fileName}`

      // Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(config.bucket)
        .upload(fullPath, file, {
          cacheControl: '3600',
          upsert: false,
          metadata: {
            uploaded_by: userId || 'anonymous',
            original_name: file.name,
            upload_time: new Date().toISOString(),
            file_size: file.size,
            mime_type: file.type,
            ...options?.metadata
          }
        })

      if (error) {
        console.error('Storage upload error:', error)
        return { success: false, error: 'Failed to upload file' }
      }

      // Get file URLs
      const { data: urlData } = this.supabase.storage
        .from(config.bucket)
        .getPublicUrl(data.path)

      const response = {
        success: true,
        data: {
          path: data.path,
          url: urlData.publicUrl
        }
      }

      // Add public URL if the bucket is public
      if (config.isPublic) {
        response.data.publicUrl = urlData.publicUrl
      }

      return response

    } catch (error) {
      console.error('File upload error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Upload failed' 
      }
    }
  }

  async deleteFile(
    bucket: string,
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase.storage
        .from(bucket)
        .remove([path])

      if (error) {
        console.error('Storage delete error:', error)
        return { success: false, error: 'Failed to delete file' }
      }

      return { success: true }
    } catch (error) {
      console.error('File delete error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Delete failed' 
      }
    }
  }

  async getSignedUrl(
    bucket: string,
    path: string,
    expiresIn: number = 3600 // 1 hour default
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresIn)

      if (error) {
        console.error('Signed URL error:', error)
        return { success: false, error: 'Failed to generate signed URL' }
      }

      return { success: true, url: data.signedUrl }
    } catch (error) {
      console.error('Signed URL generation error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'URL generation failed' 
      }
    }
  }

  async listFiles(
    bucket: string,
    path?: string,
    options?: {
      limit?: number
      offset?: number
      sortBy?: { column: string; order: 'asc' | 'desc' }
    }
  ): Promise<{
    success: boolean
    files?: Array<{
      name: string
      id: string
      updated_at: string
      created_at: string
      last_accessed_at: string
      metadata: Record<string, any>
    }>
    error?: string
  }> {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .list(path, {
          limit: options?.limit || 100,
          offset: options?.offset || 0,
          sortBy: options?.sortBy || { column: 'created_at', order: 'desc' }
        })

      if (error) {
        console.error('Storage list error:', error)
        return { success: false, error: 'Failed to list files' }
      }

      return { success: true, files: data || [] }
    } catch (error) {
      console.error('File list error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'List failed' 
      }
    }
  }

  // Bulk operations for better performance
  async uploadMultipleFiles(
    files: File[],
    configKey: keyof typeof uploadConfigs,
    userId?: string
  ): Promise<{
    success: boolean
    results: Array<{
      file: string
      success: boolean
      data?: { path: string; url: string }
      error?: string
    }>
  }> {
    const results = await Promise.allSettled(
      files.map(file => 
        this.uploadFile(file, configKey, userId)
      )
    )

    const formattedResults = results.map((result, index) => ({
      file: files[index].name,
      success: result.status === 'fulfilled' && result.value.success,
      ...(result.status === 'fulfilled' 
        ? (result.value.success ? { data: result.value.data } : { error: result.value.error })
        : { error: 'Upload promise rejected' }
      )
    }))

    const successCount = formattedResults.filter(r => r.success).length

    return {
      success: successCount === files.length,
      results: formattedResults
    }
  }

  async cleanupExpiredFiles(): Promise<void> {
    try {
      // Clean up temporary files older than 24 hours
      const oneDayAgo = new Date()
      oneDayAgo.setHours(oneDayAgo.getHours() - 24)

      const tempBuckets = ['temp-files', 'temp-exports']
      
      for (const bucket of tempBuckets) {
        const { data: files } = await this.supabase.storage
          .from(bucket)
          .list('', { limit: 1000 })

        if (files) {
          const expiredFiles = files.filter(file => 
            new Date(file.created_at) < oneDayAgo
          )

          if (expiredFiles.length > 0) {
            const filesToDelete = expiredFiles.map(file => file.name)
            await this.supabase.storage
              .from(bucket)
              .remove(filesToDelete)

            console.log(`🧹 Cleaned up ${expiredFiles.length} expired files from ${bucket}`)
          }
        }
      }
    } catch (error) {
      console.error('File cleanup error:', error)
    }
  }

  // Health check for storage service
  async healthCheck(): Promise<boolean> {
    try {
      // Try to list files from a known bucket
      const { data, error } = await this.supabase.storage
        .from('payment-proofs')
        .list('', { limit: 1 })

      return !error
    } catch (error) {
      console.error('Storage health check failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const storageService = new ProductionStorageService()

// Initialize cleanup job for production
if (process.env.NODE_ENV === 'production') {
  // Clean up expired files every 6 hours
  setInterval(async () => {
    await storageService.cleanupExpiredFiles()
  }, 6 * 60 * 60 * 1000)
}

// Helper function for API routes
export async function handleFileUpload(
  request: Request,
  configKey: keyof typeof uploadConfigs,
  userId?: string
): Promise<Response> {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return Response.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    const result = await storageService.uploadFile(file, configKey, userId)
    
    if (result.success) {
      return Response.json(result.data)
    } else {
      return Response.json(
        { error: result.error },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('File upload handler error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}