/**
 * Instagram Posting Service
 * Handles posting to Instagram using Graph API
 */

import { BasePostingService, MediaFile, PostingResult, MediaUploadResult, PostMetrics, RateLimitInfo } from './base';
import { GeneratedContent } from '../../content/generator';

export class InstagramPostingService extends BasePostingService {
  private readonly apiBaseUrl = 'https://graph.instagram.com';

  constructor() {
    super('instagram');
  }

  /**
   * Publish to Instagram
   */
  async publishPost(
    accessToken: string,
    content: GeneratedContent,
    mediaFiles: MediaFile[]
  ): Promise<PostingResult> {
    try {
      this.validateContent(content, mediaFiles);

      // Get Instagram Business Account ID
      const accountId = await this.getInstagramAccountId(accessToken);
      
      if (mediaFiles.length === 0) {
        throw new Error('Instagram posts require at least one media file');
      }

      // Determine post type
      const postType = this.determinePostType(mediaFiles);
      
      let creationId: string;
      
      if (postType === 'carousel') {
        creationId = await this.createCarouselPost(accessToken, accountId, content, mediaFiles);
      } else {
        creationId = await this.createSingleMediaPost(accessToken, accountId, content, mediaFiles[0]);
      }

      // Publish the media
      const publishResult = await this.publishMedia(accessToken, accountId, creationId);
      
      return {
        postId: publishResult.id,
        url: `https://www.instagram.com/p/${publishResult.id}/`,
        platformData: publishResult,
        success: true,
      };
    } catch (error) {
      this.handleApiError(error, 'post to Instagram');
    }
  }

  /**
   * Upload media to Instagram (handled within creation process)
   */
  async uploadMedia(
    accessToken: string,
    mediaFile: MediaFile
  ): Promise<MediaUploadResult> {
    try {
      if (!this.isMediaTypeSupported(mediaFile.mimeType)) {
        throw new Error(`Unsupported media type: ${mediaFile.mimeType}`);
      }

      // For Instagram, media is uploaded during the creation process
      // This method is mainly for validation
      return {
        mediaId: mediaFile.id,
        url: mediaFile.fileUrl,
      };
    } catch (error) {
      return {
        mediaId: '',
        error: error.message,
      };
    }
  }

  /**
   * Create single media post
   */
  private async createSingleMediaPost(
    accessToken: string,
    accountId: string,
    content: GeneratedContent,
    mediaFile: MediaFile
  ): Promise<string> {
    const isVideo = mediaFile.mimeType.startsWith('video/');
    const mediaType = isVideo ? 'VIDEO' : 'IMAGE';
    
    const params = {
      [isVideo ? 'video_url' : 'image_url']: mediaFile.fileUrl,
      media_type: mediaType,
      caption: this.formatTextContent(content),
      access_token: accessToken,
    };

    const response = await fetch(`${this.apiBaseUrl}/${accountId}/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to create Instagram media: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  }

  /**
   * Create carousel post
   */
  private async createCarouselPost(
    accessToken: string,
    accountId: string,
    content: GeneratedContent,
    mediaFiles: MediaFile[]
  ): Promise<string> {
    // Create individual media items first
    const mediaIds: string[] = [];
    
    for (const mediaFile of mediaFiles) {
      const isVideo = mediaFile.mimeType.startsWith('video/');
      const mediaType = isVideo ? 'VIDEO' : 'IMAGE';
      
      const params = {
        [isVideo ? 'video_url' : 'image_url']: mediaFile.fileUrl,
        media_type: mediaType,
        is_carousel_item: 'true',
        access_token: accessToken,
      };

      const response = await fetch(`${this.apiBaseUrl}/${accountId}/media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params).toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to create carousel item: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      mediaIds.push(data.id);
    }

    // Create carousel container
    const carouselParams = {
      media_type: 'CAROUSEL',
      children: mediaIds.join(','),
      caption: this.formatTextContent(content),
      access_token: accessToken,
    };

    const carouselResponse = await fetch(`${this.apiBaseUrl}/${accountId}/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(carouselParams).toString(),
    });

    if (!carouselResponse.ok) {
      const errorData = await carouselResponse.json().catch(() => ({}));
      throw new Error(`Failed to create carousel: ${errorData.error?.message || carouselResponse.statusText}`);
    }

    const carouselData = await carouselResponse.json();
    return carouselData.id;
  }

  /**
   * Publish media to Instagram
   */
  private async publishMedia(accessToken: string, accountId: string, creationId: string): Promise<any> {
    const params = {
      creation_id: creationId,
      access_token: accessToken,
    };

    const response = await fetch(`${this.apiBaseUrl}/${accountId}/media_publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to publish Instagram media: ${errorData.error?.message || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get Instagram Business Account ID
   */
  private async getInstagramAccountId(accessToken: string): Promise<string> {
    // First get Facebook Pages
    const pagesResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`);
    
    if (!pagesResponse.ok) {
      throw new Error('Failed to get Facebook Pages');
    }

    const pagesData = await pagesResponse.json();
    
    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error('No Facebook Pages found');
    }

    // Get Instagram account from the first page
    const pageId = pagesData.data[0].id;
    const pageAccessToken = pagesData.data[0].access_token;
    
    const igAccountResponse = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}?fields=instagram_business_account&access_token=${pageAccessToken}`
    );

    if (!igAccountResponse.ok) {
      throw new Error('Failed to get Instagram Business Account');
    }

    const igAccountData = await igAccountResponse.json();
    
    if (!igAccountData.instagram_business_account) {
      throw new Error('No Instagram Business Account connected to this Facebook Page');
    }

    return igAccountData.instagram_business_account.id;
  }

  /**
   * Get post metrics
   */
  async getPostMetrics(accessToken: string, postId: string): Promise<PostMetrics> {
    try {
      const metrics = 'likes,comments,saves,reach,impressions';
      
      const response = await this.makeRequest(
        `${this.apiBaseUrl}/${postId}/insights?metric=${metrics}`,
        { method: 'GET' },
        accessToken
      );

      const data = await response.json();
      const insights = data.data || [];

      const metricsMap: Record<string, number> = {};
      insights.forEach((insight: any) => {
        metricsMap[insight.name] = insight.values[0]?.value || 0;
      });

      return {
        likes: metricsMap.likes || 0,
        shares: 0, // Instagram doesn't provide share count
        comments: metricsMap.comments || 0,
        reach: metricsMap.reach || 0,
        impressions: metricsMap.impressions || 0,
        saves: metricsMap.saves || 0,
      };
    } catch (error) {
      this.handleApiError(error, 'get Instagram metrics');
    }
  }

  /**
   * Delete an Instagram post
   */
  async deletePost(accessToken: string, postId: string): Promise<boolean> {
    try {
      const response = await this.makeRequest(
        `${this.apiBaseUrl}/${postId}`,
        { method: 'DELETE' },
        accessToken
      );

      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('Failed to delete Instagram post:', error);
      return false;
    }
  }

  /**
   * Get rate limit information
   */
  async getRateLimitInfo(accessToken: string, endpoint = 'media'): Promise<RateLimitInfo> {
    try {
      // Instagram uses Facebook's Graph API rate limiting
      // Make a test request to get rate limit headers
      const response = await fetch(`${this.apiBaseUrl}/me?access_token=${accessToken}`);
      
      const rateLimitHeader = response.headers.get('x-app-usage');
      let remaining = 100;
      
      if (rateLimitHeader) {
        const usage = JSON.parse(rateLimitHeader);
        remaining = 100 - (usage.call_count || 0);
      }

      return {
        remaining: Math.max(0, remaining),
        resetTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour window
        limitType: endpoint,
      };
    } catch (error) {
      return {
        remaining: 50,
        resetTime: new Date(Date.now() + 60 * 60 * 1000),
        limitType: endpoint,
      };
    }
  }

  /**
   * Platform-specific content validation
   */
  protected validatePlatformSpecificContent(content: GeneratedContent, mediaFiles: MediaFile[]): void {
    const limits = this.getPostingLimits();
    const formattedText = this.formatTextContent(content);

    if (formattedText.length > limits.maxTextLength) {
      throw new Error(`Instagram caption exceeds ${limits.maxTextLength} characters`);
    }

    if (mediaFiles.length === 0) {
      throw new Error('Instagram posts require at least one media file');
    }

    if (mediaFiles.length > limits.maxMediaFiles) {
      throw new Error(`Too many media files. Maximum ${limits.maxMediaFiles} allowed for carousel`);
    }

    // Check media types
    for (const mediaFile of mediaFiles) {
      if (!this.isMediaTypeSupported(mediaFile.mimeType)) {
        throw new Error(`Unsupported media type: ${mediaFile.mimeType}`);
      }
    }

    // Instagram specific rules
    if (mediaFiles.length > 1) {
      // Carousel - all items must be same type (all images or all videos)
      const hasImages = mediaFiles.some(f => f.mimeType.startsWith('image/'));
      const hasVideos = mediaFiles.some(f => f.mimeType.startsWith('video/'));
      
      if (hasImages && hasVideos) {
        throw new Error('Instagram carousel cannot mix images and videos');
      }
    }
  }

  /**
   * Get supported media types
   */
  protected getSupportedMediaTypes(): string[] {
    return [
      'image/jpeg',
      'image/png',
      'video/mp4',
      'video/mov',
    ];
  }

  /**
   * Get posting limits
   */
  protected getPostingLimits() {
    return {
      maxTextLength: 2200,
      maxMediaFiles: 10, // Carousel limit
      maxMediaSizeMB: 100,
    };
  }

  /**
   * Determine post type based on media files
   */
  private determinePostType(mediaFiles: MediaFile[]): 'single' | 'carousel' {
    return mediaFiles.length > 1 ? 'carousel' : 'single';
  }
}

export default InstagramPostingService;