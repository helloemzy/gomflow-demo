/**
 * Media Processing and Optimization Service
 * Handles media file processing, format conversion, and platform optimization
 */

import { createClient } from '@/lib/supabase/server';

export interface MediaFile {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  thumbnailUrl?: string;
  altText?: string;
  tags: string[];
  platformVersions: Record<string, string>;
  metadata: MediaMetadata;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaMetadata {
  width?: number;
  height?: number;
  duration?: number; // For videos
  fps?: number; // For videos
  bitrate?: number; // For videos/audio
  format?: string;
  colorSpace?: string;
  hasAudio?: boolean; // For videos
  orientation?: number; // EXIF orientation
  aspectRatio?: string;
  fileHash?: string; // For duplicate detection
}

export interface ProcessingOptions {
  platforms: string[];
  quality?: 'low' | 'medium' | 'high' | 'original';
  preserveOriginal?: boolean;
  generateThumbnail?: boolean;
  optimizeForWeb?: boolean;
  watermark?: {
    text?: string;
    imageUrl?: string;
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
    opacity: number;
  };
}

export interface PlatformSpecification {
  platform: string;
  formats: string[];
  maxDimensions: { width: number; height: number };
  minDimensions: { width: number; height: number };
  aspectRatios: string[];
  maxSizeMB: number;
  maxDurationSeconds?: number; // For videos
  recommendedBitrate?: number; // For videos
  supportedCodecs?: string[]; // For videos
}

export interface ProcessingResult {
  originalFile: MediaFile;
  processedVersions: Record<string, ProcessedVersion>;
  thumbnail?: ProcessedVersion;
  processingTime: number;
  optimizationSavings: number; // Percentage
  errors: string[];
  warnings: string[];
}

export interface ProcessedVersion {
  platform: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  dimensions: { width: number; height: number };
  metadata: MediaMetadata;
  optimizations: string[];
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'optimizing' | 'completed' | 'error';
  currentStep?: string;
  estimatedTimeRemaining?: number;
}

export class MediaProcessor {
  private supabase;
  private processingQueue: Map<string, UploadProgress> = new Map();

  // Platform specifications
  private readonly platformSpecs: Record<string, PlatformSpecification> = {
    twitter: {
      platform: 'twitter',
      formats: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
      maxDimensions: { width: 4096, height: 4096 },
      minDimensions: { width: 32, height: 32 },
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
      maxSizeMB: 5, // Images: 5MB, Videos: 512MB
      maxDurationSeconds: 140,
      recommendedBitrate: 6000,
      supportedCodecs: ['h264', 'h265'],
    },
    instagram: {
      platform: 'instagram',
      formats: ['image/jpeg', 'image/png', 'video/mp4'],
      maxDimensions: { width: 1080, height: 1350 },
      minDimensions: { width: 320, height: 320 },
      aspectRatios: ['1:1', '4:5', '16:9', '9:16'],
      maxSizeMB: 100,
      maxDurationSeconds: 60,
      recommendedBitrate: 8000,
      supportedCodecs: ['h264'],
    },
    facebook: {
      platform: 'facebook',
      formats: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
      maxDimensions: { width: 2048, height: 2048 },
      minDimensions: { width: 32, height: 32 },
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
      maxSizeMB: 1024, // 1GB for videos
      maxDurationSeconds: 240,
      recommendedBitrate: 8000,
      supportedCodecs: ['h264', 'h265'],
    },
    tiktok: {
      platform: 'tiktok',
      formats: ['video/mp4'],
      maxDimensions: { width: 1080, height: 1920 },
      minDimensions: { width: 540, height: 960 },
      aspectRatios: ['9:16'],
      maxSizeMB: 500,
      maxDurationSeconds: 180,
      recommendedBitrate: 10000,
      supportedCodecs: ['h264', 'h265'],
    },
    discord: {
      platform: 'discord',
      formats: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
      maxDimensions: { width: 4096, height: 4096 },
      minDimensions: { width: 16, height: 16 },
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
      maxSizeMB: 8, // 50MB for Nitro users
      maxDurationSeconds: 600,
      recommendedBitrate: 6000,
      supportedCodecs: ['h264', 'h265'],
    },
    telegram: {
      platform: 'telegram',
      formats: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
      maxDimensions: { width: 1280, height: 1280 },
      minDimensions: { width: 32, height: 32 },
      aspectRatios: ['1:1', '4:3', '3:4', '16:9', '9:16'],
      maxSizeMB: 20, // Photos: 20MB, Files: 2GB
      maxDurationSeconds: 3600,
      recommendedBitrate: 4000,
      supportedCodecs: ['h264'],
    },
  };

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Upload and process media file
   */
  async uploadAndProcessMedia(
    userId: string,
    file: File,
    options: ProcessingOptions,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<ProcessingResult> {
    const fileId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      // Initialize progress tracking
      this.updateProgress(fileId, {
        fileId,
        fileName: file.name,
        progress: 0,
        status: 'uploading',
        currentStep: 'Uploading original file',
      }, onProgress);

      // Upload original file to storage
      const originalFileUrl = await this.uploadToStorage(userId, file, fileId);

      this.updateProgress(fileId, {
        progress: 20,
        status: 'processing',
        currentStep: 'Analyzing media metadata',
      }, onProgress);

      // Extract metadata
      const metadata = await this.extractMetadata(file);

      this.updateProgress(fileId, {
        progress: 40,
        status: 'optimizing',
        currentStep: 'Optimizing for platforms',
      }, onProgress);

      // Process for each platform
      const processedVersions: Record<string, ProcessedVersion> = {};
      const platformCount = options.platforms.length;
      let platformIndex = 0;

      for (const platform of options.platforms) {
        this.updateProgress(fileId, {
          progress: 40 + (platformIndex / platformCount) * 40,
          currentStep: `Optimizing for ${platform}`,
        }, onProgress);

        const processedVersion = await this.processForPlatform(
          file,
          originalFileUrl,
          platform,
          metadata,
          options
        );

        if (processedVersion) {
          processedVersions[platform] = processedVersion;
        }

        platformIndex++;
      }

      this.updateProgress(fileId, {
        progress: 80,
        currentStep: 'Generating thumbnail',
      }, onProgress);

      // Generate thumbnail if requested
      let thumbnail: ProcessedVersion | undefined;
      if (options.generateThumbnail) {
        thumbnail = await this.generateThumbnail(file, originalFileUrl, metadata);
      }

      this.updateProgress(fileId, {
        progress: 90,
        currentStep: 'Saving to database',
      }, onProgress);

      // Save to database
      const mediaFile = await this.saveMediaFile(userId, {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        fileUrl: originalFileUrl,
        thumbnailUrl: thumbnail?.fileUrl,
        metadata,
        platformVersions: Object.fromEntries(
          Object.entries(processedVersions).map(([platform, version]) => [
            platform,
            version.fileUrl,
          ])
        ),
      });

      const processingTime = Date.now() - startTime;
      const originalSize = file.size;
      const totalOptimizedSize = Object.values(processedVersions).reduce(
        (sum, version) => sum + version.fileSize,
        0
      );
      const optimizationSavings = ((originalSize - totalOptimizedSize / Object.keys(processedVersions).length) / originalSize) * 100;

      this.updateProgress(fileId, {
        progress: 100,
        status: 'completed',
        currentStep: 'Processing complete',
      }, onProgress);

      return {
        originalFile: mediaFile,
        processedVersions,
        thumbnail,
        processingTime,
        optimizationSavings: Math.max(0, optimizationSavings),
        errors: [],
        warnings: [],
      };
    } catch (error) {
      this.updateProgress(fileId, {
        progress: 0,
        status: 'error',
        currentStep: `Error: ${error.message}`,
      }, onProgress);

      throw new Error(`Media processing failed: ${error.message}`);
    } finally {
      this.processingQueue.delete(fileId);
    }
  }

  /**
   * Process existing media file for additional platforms
   */
  async reprocessForPlatforms(
    mediaFileId: string,
    additionalPlatforms: string[],
    options?: Partial<ProcessingOptions>
  ): Promise<Record<string, ProcessedVersion>> {
    try {
      // Get existing media file
      const mediaFile = await this.getMediaFile(mediaFileId);
      if (!mediaFile) {
        throw new Error('Media file not found');
      }

      // Download original file
      const fileBlob = await this.downloadFile(mediaFile.fileUrl);
      const file = new File([fileBlob], mediaFile.fileName, { type: mediaFile.mimeType });

      const processedVersions: Record<string, ProcessedVersion> = {};

      for (const platform of additionalPlatforms) {
        const processedVersion = await this.processForPlatform(
          file,
          mediaFile.fileUrl,
          platform,
          mediaFile.metadata,
          { platforms: [platform], ...options }
        );

        if (processedVersion) {
          processedVersions[platform] = processedVersion;
        }
      }

      // Update media file with new platform versions
      await this.updateMediaFilePlatforms(mediaFileId, processedVersions);

      return processedVersions;
    } catch (error) {
      throw new Error(`Media reprocessing failed: ${error.message}`);
    }
  }

  /**
   * Process file for specific platform
   */
  private async processForPlatform(
    file: File,
    originalUrl: string,
    platform: string,
    metadata: MediaMetadata,
    options: ProcessingOptions
  ): Promise<ProcessedVersion | null> {
    try {
      const spec = this.platformSpecs[platform];
      if (!spec) {
        console.warn(`No specifications found for platform: ${platform}`);
        return null;
      }

      // Check if file format is supported
      if (!spec.formats.includes(file.type)) {
        console.warn(`Unsupported format ${file.type} for platform ${platform}`);
        return null;
      }

      // For now, return original file if it meets platform requirements
      // In a real implementation, you would use image/video processing libraries
      // like sharp, ffmpeg, or cloud services like Cloudinary
      
      const needsOptimization = this.needsOptimization(metadata, spec, options);
      
      if (!needsOptimization) {
        return {
          platform,
          fileUrl: originalUrl,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          dimensions: { width: metadata.width || 0, height: metadata.height || 0 },
          metadata,
          optimizations: [],
        };
      }

      // Apply optimizations (placeholder implementation)
      const optimizedFile = await this.optimizeFile(file, spec, options);
      const optimizedUrl = await this.uploadOptimizedFile(optimizedFile, platform);
      const optimizedMetadata = await this.extractMetadata(optimizedFile);

      return {
        platform,
        fileUrl: optimizedUrl,
        fileName: `${platform}_${file.name}`,
        fileSize: optimizedFile.size,
        mimeType: optimizedFile.type,
        dimensions: { width: optimizedMetadata.width || 0, height: optimizedMetadata.height || 0 },
        metadata: optimizedMetadata,
        optimizations: this.getAppliedOptimizations(metadata, optimizedMetadata),
      };
    } catch (error) {
      console.error(`Failed to process for ${platform}:`, error);
      return null;
    }
  }

  /**
   * Check if file needs optimization for platform
   */
  private needsOptimization(
    metadata: MediaMetadata,
    spec: PlatformSpecification,
    options: ProcessingOptions
  ): boolean {
    // Check dimensions
    if (metadata.width && metadata.height) {
      if (metadata.width > spec.maxDimensions.width || metadata.height > spec.maxDimensions.height) {
        return true;
      }
    }

    // Check file size (simplified)
    // In reality, you'd need to check the actual file size against spec.maxSizeMB

    // Check quality setting
    if (options.quality && options.quality !== 'original') {
      return true;
    }

    // Check if watermark is requested
    if (options.watermark) {
      return true;
    }

    return false;
  }

  /**
   * Optimize file for platform (placeholder implementation)
   */
  private async optimizeFile(
    file: File,
    spec: PlatformSpecification,
    options: ProcessingOptions
  ): Promise<File> {
    // This is a placeholder implementation
    // In a real implementation, you would use libraries like:
    // - Sharp for image processing
    // - FFmpeg for video processing
    // - Canvas API for basic transformations
    // - Cloud services like Cloudinary, ImageKit, etc.

    return file; // Return original for now
  }

  /**
   * Generate thumbnail
   */
  private async generateThumbnail(
    file: File,
    originalUrl: string,
    metadata: MediaMetadata
  ): Promise<ProcessedVersion | undefined> {
    try {
      // For videos, extract frame at 1 second
      // For images, create smaller version
      // This is a placeholder implementation
      
      return {
        platform: 'thumbnail',
        fileUrl: originalUrl, // Would be actual thumbnail URL
        fileName: `thumb_${file.name}`,
        fileSize: Math.floor(file.size * 0.1), // Approximate
        mimeType: 'image/jpeg',
        dimensions: { width: 300, height: 300 },
        metadata: { ...metadata, width: 300, height: 300 },
        optimizations: ['thumbnail_generation'],
      };
    } catch (error) {
      console.error('Failed to generate thumbnail:', error);
      return undefined;
    }
  }

  /**
   * Extract media metadata
   */
  private async extractMetadata(file: File): Promise<MediaMetadata> {
    try {
      const metadata: MediaMetadata = {
        format: file.type,
        fileHash: await this.calculateFileHash(file),
      };

      if (file.type.startsWith('image/')) {
        // Extract image metadata
        const dimensions = await this.getImageDimensions(file);
        metadata.width = dimensions.width;
        metadata.height = dimensions.height;
        metadata.aspectRatio = this.calculateAspectRatio(dimensions.width, dimensions.height);
      } else if (file.type.startsWith('video/')) {
        // Extract video metadata
        const videoMetadata = await this.getVideoMetadata(file);
        metadata.width = videoMetadata.width;
        metadata.height = videoMetadata.height;
        metadata.duration = videoMetadata.duration;
        metadata.fps = videoMetadata.fps;
        metadata.hasAudio = videoMetadata.hasAudio;
        metadata.aspectRatio = this.calculateAspectRatio(videoMetadata.width, videoMetadata.height);
      }

      return metadata;
    } catch (error) {
      console.error('Failed to extract metadata:', error);
      return { format: file.type };
    }
  }

  /**
   * Get image dimensions
   */
  private async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  /**
   * Get video metadata
   */
  private async getVideoMetadata(file: File): Promise<{
    width: number;
    height: number;
    duration: number;
    fps: number;
    hasAudio: boolean;
  }> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
          fps: 30, // Default, would need more sophisticated analysis
          hasAudio: true, // Default, would need audio track analysis
        });
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load video'));
      };

      video.src = url;
    });
  }

  /**
   * Calculate file hash for duplicate detection
   */
  private async calculateFileHash(file: File): Promise<string> {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('Failed to calculate file hash:', error);
      return Date.now().toString(); // Fallback
    }
  }

  /**
   * Calculate aspect ratio
   */
  private calculateAspectRatio(width: number, height: number): string {
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    return `${width / divisor}:${height / divisor}`;
  }

  /**
   * Upload file to storage
   */
  private async uploadToStorage(userId: string, file: File, fileId: string): Promise<string> {
    try {
      const fileExtension = file.name.split('.').pop() || 'bin';
      const fileName = `${userId}/${fileId}.${fileExtension}`;

      const { data, error } = await this.supabase.storage
        .from('media-files')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('media-files')
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }
  }

  /**
   * Upload optimized file
   */
  private async uploadOptimizedFile(file: File, platform: string): Promise<string> {
    // Similar to uploadToStorage but with platform-specific path
    return this.uploadToStorage('optimized', file, `${platform}_${Date.now()}`);
  }

  /**
   * Save media file to database
   */
  private async saveMediaFile(userId: string, mediaData: {
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileUrl: string;
    thumbnailUrl?: string;
    metadata: MediaMetadata;
    platformVersions: Record<string, string>;
  }): Promise<MediaFile> {
    try {
      const { data, error } = await this.supabase
        .from('media_library')
        .insert({
          user_id: userId,
          file_name: mediaData.fileName,
          file_size: mediaData.fileSize,
          mime_type: mediaData.mimeType,
          file_url: mediaData.fileUrl,
          thumbnail_url: mediaData.thumbnailUrl,
          metadata: mediaData.metadata,
          platform_versions: mediaData.platformVersions,
          tags: [],
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database save failed: ${error.message}`);
      }

      return this.mapToMediaFile(data);
    } catch (error) {
      throw new Error(`Failed to save media file: ${error.message}`);
    }
  }

  /**
   * Get media file by ID
   */
  async getMediaFile(mediaFileId: string): Promise<MediaFile | null> {
    try {
      const { data, error } = await this.supabase
        .from('media_library')
        .select('*')
        .eq('id', mediaFileId)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapToMediaFile(data);
    } catch (error) {
      console.error('Failed to get media file:', error);
      return null;
    }
  }

  /**
   * Update media file platform versions
   */
  private async updateMediaFilePlatforms(
    mediaFileId: string,
    newVersions: Record<string, ProcessedVersion>
  ): Promise<void> {
    try {
      const platformVersions = Object.fromEntries(
        Object.entries(newVersions).map(([platform, version]) => [
          platform,
          version.fileUrl,
        ])
      );

      const { error } = await this.supabase
        .from('media_library')
        .update({
          platform_versions: platformVersions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', mediaFileId);

      if (error) {
        throw new Error(`Failed to update platform versions: ${error.message}`);
      }
    } catch (error) {
      throw new Error(`Platform update failed: ${error.message}`);
    }
  }

  /**
   * Download file from URL
   */
  private async downloadFile(url: string): Promise<Blob> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      return await response.blob();
    } catch (error) {
      throw new Error(`File download failed: ${error.message}`);
    }
  }

  /**
   * Get applied optimizations
   */
  private getAppliedOptimizations(
    original: MediaMetadata,
    optimized: MediaMetadata
  ): string[] {
    const optimizations: string[] = [];

    if (original.width && optimized.width && original.width > optimized.width) {
      optimizations.push('resize');
    }

    if (original.format !== optimized.format) {
      optimizations.push('format_conversion');
    }

    return optimizations;
  }

  /**
   * Update processing progress
   */
  private updateProgress(
    fileId: string,
    progress: Partial<UploadProgress>,
    callback?: (progress: UploadProgress) => void
  ): void {
    const existing = this.processingQueue.get(fileId) || {
      fileId,
      fileName: '',
      progress: 0,
      status: 'uploading' as const,
    };

    const updated = { ...existing, ...progress };
    this.processingQueue.set(fileId, updated);

    if (callback) {
      callback(updated);
    }
  }

  /**
   * Get user's media library
   */
  async getUserMediaLibrary(
    userId: string,
    filters: {
      mimeType?: string;
      tags?: string[];
      searchText?: string;
    } = {},
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    files: MediaFile[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      let query = this.supabase
        .from('media_library')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      if (filters.mimeType) {
        query = query.like('mime_type', `${filters.mimeType}%`);
      }

      if (filters.searchText) {
        query = query.ilike('file_name', `%${filters.searchText}%`);
      }

      if (filters.tags && filters.tags.length > 0) {
        query = query.overlaps('tags', filters.tags);
      }

      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Failed to get media library: ${error.message}`);
      }

      const files = (data || []).map(item => this.mapToMediaFile(item));
      const total = count || 0;
      const hasMore = offset + limit < total;

      return { files, total, hasMore };
    } catch (error) {
      throw new Error(`Media library fetch failed: ${error.message}`);
    }
  }

  /**
   * Delete media file
   */
  async deleteMediaFile(mediaFileId: string, userId: string): Promise<boolean> {
    try {
      // Get media file to get file paths
      const mediaFile = await this.getMediaFile(mediaFileId);
      if (!mediaFile || mediaFile.userId !== userId) {
        return false;
      }

      // Delete from storage
      await this.deleteFromStorage(mediaFile.fileUrl);
      
      // Delete platform versions
      for (const platformUrl of Object.values(mediaFile.platformVersions)) {
        await this.deleteFromStorage(platformUrl);
      }

      // Delete thumbnail
      if (mediaFile.thumbnailUrl) {
        await this.deleteFromStorage(mediaFile.thumbnailUrl);
      }

      // Delete from database
      const { error } = await this.supabase
        .from('media_library')
        .delete()
        .eq('id', mediaFileId)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Database deletion failed: ${error.message}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to delete media file:', error);
      return false;
    }
  }

  /**
   * Delete file from storage
   */
  private async deleteFromStorage(fileUrl: string): Promise<void> {
    try {
      // Extract file path from URL
      const url = new URL(fileUrl);
      const filePath = url.pathname.split('/').slice(-2).join('/'); // Get last two path segments

      await this.supabase.storage
        .from('media-files')
        .remove([filePath]);
    } catch (error) {
      console.warn('Failed to delete from storage:', error);
    }
  }

  /**
   * Map database row to MediaFile
   */
  private mapToMediaFile(data: any): MediaFile {
    return {
      id: data.id,
      fileName: data.file_name,
      fileSize: data.file_size,
      mimeType: data.mime_type,
      fileUrl: data.file_url,
      thumbnailUrl: data.thumbnail_url,
      altText: data.alt_text,
      tags: data.tags || [],
      platformVersions: data.platform_versions || {},
      metadata: data.metadata || {},
      usageCount: data.usage_count || 0,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Get platform specifications
   */
  getPlatformSpecifications(): Record<string, PlatformSpecification> {
    return { ...this.platformSpecs };
  }

  /**
   * Validate file for platform
   */
  validateFileForPlatform(file: File, platform: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const spec = this.platformSpecs[platform];
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!spec) {
      errors.push(`Unsupported platform: ${platform}`);
      return { valid: false, errors, warnings };
    }

    // Check file format
    if (!spec.formats.includes(file.type)) {
      errors.push(`Unsupported format ${file.type} for ${platform}`);
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > spec.maxSizeMB) {
      errors.push(`File size ${fileSizeMB.toFixed(2)}MB exceeds ${platform} limit of ${spec.maxSizeMB}MB`);
    }

    // Warnings for large files
    if (fileSizeMB > spec.maxSizeMB * 0.8) {
      warnings.push(`File size is close to ${platform} limit`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

export default MediaProcessor;