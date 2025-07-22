/**
 * Base Posting Service
 * Abstract class for platform-specific posting implementations
 */

import { GeneratedContent } from '../../content/generator';

export interface MediaFile {
  id: string;
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  mimeType: string;
  altText?: string;
  platformVersions?: Record<string, string>;
}

export interface PostingResult {
  postId: string;
  url?: string;
  platformData?: Record<string, any>;
  success: boolean;
  error?: string;
}

export interface MediaUploadResult {
  mediaId: string;
  url?: string;
  error?: string;
}

export interface PostMetrics {
  likes: number;
  shares: number;
  comments: number;
  reach: number;
  impressions?: number;
  saves?: number;
  clicks?: number;
  views?: number;
}

export interface RateLimitInfo {
  remaining: number;
  resetTime: Date;
  limitType: string;
}

export abstract class BasePostingService {
  protected platformId: string;

  constructor(platformId: string) {
    this.platformId = platformId;
  }

  /**
   * Publish content to the platform
   */
  abstract publishPost(
    accessToken: string,
    content: GeneratedContent,
    mediaFiles: MediaFile[]
  ): Promise<PostingResult>;

  /**
   * Upload media files to the platform
   */
  abstract uploadMedia(
    accessToken: string,
    mediaFile: MediaFile
  ): Promise<MediaUploadResult>;

  /**
   * Get post metrics/analytics
   */
  abstract getPostMetrics(
    accessToken: string,
    postId: string
  ): Promise<PostMetrics>;

  /**
   * Delete a post
   */
  abstract deletePost(
    accessToken: string,
    postId: string
  ): Promise<boolean>;

  /**
   * Check rate limit status
   */
  abstract getRateLimitInfo(
    accessToken: string,
    endpoint?: string
  ): Promise<RateLimitInfo>;

  /**
   * Validate content before posting
   */
  protected validateContent(content: GeneratedContent, mediaFiles: MediaFile[]): void {
    if (!content.text && mediaFiles.length === 0) {
      throw new Error('Post must contain either text content or media');
    }

    // Platform-specific validation will be implemented in subclasses
    this.validatePlatformSpecificContent(content, mediaFiles);
  }

  /**
   * Platform-specific content validation
   */
  protected abstract validatePlatformSpecificContent(
    content: GeneratedContent,
    mediaFiles: MediaFile[]
  ): void;

  /**
   * Handle API errors consistently
   */
  protected handleApiError(error: any, operation: string): never {
    console.error(`${this.platformId} API error during ${operation}:`, error);
    
    let errorMessage = `Failed to ${operation}`;
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 401:
          errorMessage = 'Authentication failed. Please reconnect your account.';
          break;
        case 403:
          errorMessage = 'Permission denied. Check your account permissions.';
          break;
        case 429:
          errorMessage = 'Rate limit exceeded. Please try again later.';
          break;
        case 400:
          errorMessage = data?.error?.message || data?.message || 'Invalid request';
          break;
        case 500:
        case 502:
        case 503:
          errorMessage = 'Platform service temporarily unavailable';
          break;
        default:
          errorMessage = data?.error?.message || data?.message || errorMessage;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }

  /**
   * Make authenticated API request
   */
  protected async makeRequest(
    url: string,
    options: RequestInit,
    accessToken: string
  ): Promise<Response> {
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw {
          response: {
            status: response.status,
            data: errorData,
          },
        };
      }

      return response;
    } catch (error) {
      if (error.response) {
        throw error;
      }
      
      throw new Error(`Network error: ${error.message}`);
    }
  }

  /**
   * Convert text with hashtags and mentions to platform format
   */
  protected formatTextContent(content: GeneratedContent): string {
    let formattedText = content.text;

    // Add hashtags if not already in text
    if (content.hashtags.length > 0) {
      const hashtagsText = content.hashtags
        .filter(tag => !formattedText.includes(`#${tag}`))
        .map(tag => `#${tag.replace(/^#/, '')}`)
        .join(' ');
      
      if (hashtagsText) {
        formattedText += formattedText.endsWith('\n') ? hashtagsText : `\n\n${hashtagsText}`;
      }
    }

    // Add mentions if not already in text
    if (content.mentions.length > 0) {
      const mentionsText = content.mentions
        .filter(mention => !formattedText.includes(`@${mention}`))
        .map(mention => `@${mention.replace(/^@/, '')}`)
        .join(' ');
      
      if (mentionsText) {
        formattedText += formattedText.endsWith('\n') ? mentionsText : `\n${mentionsText}`;
      }
    }

    return formattedText.trim();
  }

  /**
   * Download media file as buffer for upload
   */
  protected async downloadMedia(mediaFile: MediaFile): Promise<Buffer> {
    try {
      const response = await fetch(mediaFile.fileUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download media: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      throw new Error(`Failed to download media ${mediaFile.fileName}: ${error.message}`);
    }
  }

  /**
   * Get file extension from filename or mime type
   */
  protected getFileExtension(mediaFile: MediaFile): string {
    // Try to get extension from filename first
    const filenameParts = mediaFile.fileName.split('.');
    if (filenameParts.length > 1) {
      return filenameParts.pop()!.toLowerCase();
    }

    // Fallback to mime type
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/mov': 'mov',
      'video/avi': 'avi',
      'video/quicktime': 'mov',
    };

    return mimeToExt[mediaFile.mimeType] || 'bin';
  }

  /**
   * Check if media type is supported by platform
   */
  protected isMediaTypeSupported(mimeType: string): boolean {
    const supportedTypes = this.getSupportedMediaTypes();
    return supportedTypes.includes(mimeType);
  }

  /**
   * Get platform's supported media types
   */
  protected abstract getSupportedMediaTypes(): string[];

  /**
   * Get platform-specific posting limits
   */
  protected abstract getPostingLimits(): {
    maxTextLength: number;
    maxMediaFiles: number;
    maxMediaSizeMB: number;
  };

  /**
   * Sleep for specified milliseconds (for rate limiting)
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry operation with exponential backoff
   */
  protected async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        await this.sleep(delay);
        
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay`);
      }
    }

    throw lastError!;
  }

  /**
   * Get platform name for logging
   */
  getPlatformId(): string {
    return this.platformId;
  }
}

export default BasePostingService;