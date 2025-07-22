/**
 * Facebook Posting Service
 * Handles posting to Facebook using Graph API
 */

import { BasePostingService, MediaFile, PostingResult, MediaUploadResult, PostMetrics, RateLimitInfo } from './base';
import { GeneratedContent } from '../../content/generator';

export class FacebookPostingService extends BasePostingService {
  private readonly apiBaseUrl = 'https://graph.facebook.com/v18.0';

  constructor() {
    super('facebook');
  }

  /**
   * Publish to Facebook
   */
  async publishPost(
    accessToken: string,
    content: GeneratedContent,
    mediaFiles: MediaFile[]
  ): Promise<PostingResult> {
    try {
      this.validateContent(content, mediaFiles);

      // Get Facebook Page ID (assuming we're posting to a page)
      const pageId = await this.getPageId(accessToken);
      const pageAccessToken = await this.getPageAccessToken(accessToken, pageId);
      
      if (mediaFiles.length === 0) {
        // Text-only post
        return await this.createTextPost(pageAccessToken, pageId, content);
      } else if (mediaFiles.length === 1) {
        // Single media post
        return await this.createSingleMediaPost(pageAccessToken, pageId, content, mediaFiles[0]);
      } else {
        // Multiple media post
        return await this.createMultiMediaPost(pageAccessToken, pageId, content, mediaFiles);
      }
    } catch (error) {
      this.handleApiError(error, 'post to Facebook');
    }
  }

  /**
   * Create text-only post
   */
  private async createTextPost(
    pageAccessToken: string,
    pageId: string,
    content: GeneratedContent
  ): Promise<PostingResult> {
    const params = {
      message: this.formatTextContent(content),
      access_token: pageAccessToken,
    };

    const response = await fetch(`${this.apiBaseUrl}/${pageId}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to create Facebook post: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      postId: data.id,
      url: `https://www.facebook.com/${data.id}`,
      platformData: data,
      success: true,
    };
  }

  /**
   * Create single media post
   */
  private async createSingleMediaPost(
    pageAccessToken: string,
    pageId: string,
    content: GeneratedContent,
    mediaFile: MediaFile
  ): Promise<PostingResult> {
    const isVideo = mediaFile.mimeType.startsWith('video/');
    const endpoint = isVideo ? 'videos' : 'photos';
    
    const params = {
      message: this.formatTextContent(content),
      url: mediaFile.fileUrl,
      access_token: pageAccessToken,
    };

    if (mediaFile.altText) {
      params['alt_text'] = mediaFile.altText;
    }

    const response = await fetch(`${this.apiBaseUrl}/${pageId}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to create Facebook ${endpoint} post: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      postId: data.id || data.post_id,
      url: `https://www.facebook.com/${data.id || data.post_id}`,
      platformData: data,
      success: true,
    };
  }

  /**
   * Create multi-media post
   */
  private async createMultiMediaPost(
    pageAccessToken: string,
    pageId: string,
    content: GeneratedContent,
    mediaFiles: MediaFile[]
  ): Promise<PostingResult> {
    // Upload media attachments first
    const attachments: any[] = [];
    
    for (const mediaFile of mediaFiles) {
      const isVideo = mediaFile.mimeType.startsWith('video/');
      
      if (isVideo) {
        // Upload video
        const videoUpload = await this.uploadVideo(pageAccessToken, pageId, mediaFile);
        attachments.push({
          media_fbid: videoUpload.id,
        });
      } else {
        // Upload photo
        const photoUpload = await this.uploadPhoto(pageAccessToken, pageId, mediaFile);
        attachments.push({
          media_fbid: photoUpload.id,
        });
      }
    }

    // Create post with attachments
    const params = {
      message: this.formatTextContent(content),
      attached_media: JSON.stringify(attachments),
      access_token: pageAccessToken,
    };

    const response = await fetch(`${this.apiBaseUrl}/${pageId}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to create Facebook multi-media post: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      postId: data.id,
      url: `https://www.facebook.com/${data.id}`,
      platformData: data,
      success: true,
    };
  }

  /**
   * Upload media to Facebook
   */
  async uploadMedia(
    accessToken: string,
    mediaFile: MediaFile
  ): Promise<MediaUploadResult> {
    try {
      if (!this.isMediaTypeSupported(mediaFile.mimeType)) {
        throw new Error(`Unsupported media type: ${mediaFile.mimeType}`);
      }

      const pageId = await this.getPageId(accessToken);
      const pageAccessToken = await this.getPageAccessToken(accessToken, pageId);
      
      const isVideo = mediaFile.mimeType.startsWith('video/');
      
      if (isVideo) {
        const result = await this.uploadVideo(pageAccessToken, pageId, mediaFile);
        return {
          mediaId: result.id,
          url: result.source,
        };
      } else {
        const result = await this.uploadPhoto(pageAccessToken, pageId, mediaFile);
        return {
          mediaId: result.id,
          url: result.source,
        };
      }
    } catch (error) {
      return {
        mediaId: '',
        error: error.message,
      };
    }
  }

  /**
   * Upload photo to Facebook
   */
  private async uploadPhoto(
    pageAccessToken: string,
    pageId: string,
    mediaFile: MediaFile
  ): Promise<any> {
    const params = {
      url: mediaFile.fileUrl,
      published: 'false', // Don't publish immediately
      access_token: pageAccessToken,
    };

    if (mediaFile.altText) {
      params['alt_text'] = mediaFile.altText;
    }

    const response = await fetch(`${this.apiBaseUrl}/${pageId}/photos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to upload photo: ${errorData.error?.message || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Upload video to Facebook
   */
  private async uploadVideo(
    pageAccessToken: string,
    pageId: string,
    mediaFile: MediaFile
  ): Promise<any> {
    const params = {
      file_url: mediaFile.fileUrl,
      published: 'false', // Don't publish immediately
      access_token: pageAccessToken,
    };

    if (mediaFile.altText) {
      params['description'] = mediaFile.altText;
    }

    const response = await fetch(`${this.apiBaseUrl}/${pageId}/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to upload video: ${errorData.error?.message || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get Facebook Page ID
   */
  private async getPageId(accessToken: string): Promise<string> {
    const response = await fetch(`${this.apiBaseUrl}/me/accounts?access_token=${accessToken}`);
    
    if (!response.ok) {
      throw new Error('Failed to get Facebook Pages');
    }

    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      throw new Error('No Facebook Pages found');
    }

    return data.data[0].id; // Use first page
  }

  /**
   * Get Page Access Token
   */
  private async getPageAccessToken(userAccessToken: string, pageId: string): Promise<string> {
    const response = await fetch(`${this.apiBaseUrl}/${pageId}?fields=access_token&access_token=${userAccessToken}`);
    
    if (!response.ok) {
      throw new Error('Failed to get page access token');
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Get post metrics
   */
  async getPostMetrics(accessToken: string, postId: string): Promise<PostMetrics> {
    try {
      const pageId = await this.getPageId(accessToken);
      const pageAccessToken = await this.getPageAccessToken(accessToken, pageId);
      
      // Get post insights
      const response = await this.makeRequest(
        `${this.apiBaseUrl}/${postId}/insights?metric=post_impressions,post_engaged_users,post_clicks`,
        { method: 'GET' },
        pageAccessToken
      );

      const data = await response.json();
      const insights = data.data || [];

      // Get basic metrics (likes, comments, shares)
      const basicResponse = await this.makeRequest(
        `${this.apiBaseUrl}/${postId}?fields=likes.summary(true),comments.summary(true),shares`,
        { method: 'GET' },
        pageAccessToken
      );

      const basicData = await basicResponse.json();

      // Map insights to metrics
      const metricsMap: Record<string, number> = {};
      insights.forEach((insight: any) => {
        metricsMap[insight.name] = insight.values[0]?.value || 0;
      });

      return {
        likes: basicData.likes?.summary?.total_count || 0,
        shares: basicData.shares?.count || 0,
        comments: basicData.comments?.summary?.total_count || 0,
        reach: metricsMap.post_engaged_users || 0,
        impressions: metricsMap.post_impressions || 0,
        clicks: metricsMap.post_clicks || 0,
      };
    } catch (error) {
      this.handleApiError(error, 'get Facebook metrics');
    }
  }

  /**
   * Delete a Facebook post
   */
  async deletePost(accessToken: string, postId: string): Promise<boolean> {
    try {
      const pageId = await this.getPageId(accessToken);
      const pageAccessToken = await this.getPageAccessToken(accessToken, pageId);
      
      const response = await this.makeRequest(
        `${this.apiBaseUrl}/${postId}`,
        { method: 'DELETE' },
        pageAccessToken
      );

      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('Failed to delete Facebook post:', error);
      return false;
    }
  }

  /**
   * Get rate limit information
   */
  async getRateLimitInfo(accessToken: string, endpoint = 'feed'): Promise<RateLimitInfo> {
    try {
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
      throw new Error(`Facebook post exceeds ${limits.maxTextLength} characters`);
    }

    if (mediaFiles.length > limits.maxMediaFiles) {
      throw new Error(`Too many media files. Maximum ${limits.maxMediaFiles} allowed`);
    }

    // Check media types
    for (const mediaFile of mediaFiles) {
      if (!this.isMediaTypeSupported(mediaFile.mimeType)) {
        throw new Error(`Unsupported media type: ${mediaFile.mimeType}`);
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
      'image/gif',
      'video/mp4',
      'video/mov',
      'video/avi',
    ];
  }

  /**
   * Get posting limits
   */
  protected getPostingLimits() {
    return {
      maxTextLength: 63206,
      maxMediaFiles: 10,
      maxMediaSizeMB: 1024, // 1GB for videos
    };
  }
}

export default FacebookPostingService;