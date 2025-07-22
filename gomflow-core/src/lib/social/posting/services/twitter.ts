/**
 * Twitter Posting Service
 * Handles posting to Twitter using OAuth and API v2
 */

import { BasePostingService, MediaFile, PostingResult, MediaUploadResult, PostMetrics, RateLimitInfo } from './base';
import { GeneratedContent } from '../../content/generator';

export class TwitterPostingService extends BasePostingService {
  private readonly apiBaseUrl = 'https://api.twitter.com/2';
  private readonly uploadBaseUrl = 'https://upload.twitter.com/1.1';

  constructor() {
    super('twitter');
  }

  /**
   * Publish a tweet
   */
  async publishPost(
    accessToken: string,
    content: GeneratedContent,
    mediaFiles: MediaFile[]
  ): Promise<PostingResult> {
    try {
      this.validateContent(content, mediaFiles);

      // Upload media files first
      const mediaIds: string[] = [];
      for (const mediaFile of mediaFiles) {
        const uploadResult = await this.uploadMedia(accessToken, mediaFile);
        if (uploadResult.error) {
          throw new Error(`Media upload failed: ${uploadResult.error}`);
        }
        mediaIds.push(uploadResult.mediaId);
      }

      // Prepare tweet data
      const tweetData: any = {
        text: this.formatTextContent(content),
      };

      if (mediaIds.length > 0) {
        tweetData.media = {
          media_ids: mediaIds,
        };
      }

      // Handle platform-specific features from content
      if (content.platformSpecific?.tweetData) {
        const platformData = content.platformSpecific.tweetData;
        
        if (platformData.replyToTweetId) {
          tweetData.reply = {
            in_reply_to_tweet_id: platformData.replyToTweetId,
          };
        }

        if (platformData.quoteTweetId) {
          tweetData.quote_tweet_id = platformData.quoteTweetId;
        }
      }

      // Post tweet
      const response = await this.makeRequest(
        `${this.apiBaseUrl}/tweets`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(tweetData),
        },
        accessToken
      );

      const responseData = await response.json();

      if (responseData.errors) {
        throw new Error(`Twitter API error: ${responseData.errors[0].detail}`);
      }

      const tweetId = responseData.data.id;
      const tweetUrl = `https://twitter.com/i/web/status/${tweetId}`;

      return {
        postId: tweetId,
        url: tweetUrl,
        platformData: responseData.data,
        success: true,
      };
    } catch (error) {
      this.handleApiError(error, 'post tweet');
    }
  }

  /**
   * Upload media to Twitter
   */
  async uploadMedia(
    accessToken: string,
    mediaFile: MediaFile
  ): Promise<MediaUploadResult> {
    try {
      if (!this.isMediaTypeSupported(mediaFile.mimeType)) {
        throw new Error(`Unsupported media type: ${mediaFile.mimeType}`);
      }

      // Download media file
      const mediaBuffer = await this.downloadMedia(mediaFile);
      
      // Check file size
      const maxSizeMB = this.getMaxMediaSizeForType(mediaFile.mimeType);
      const fileSizeMB = mediaBuffer.length / (1024 * 1024);
      
      if (fileSizeMB > maxSizeMB) {
        throw new Error(`File size ${fileSizeMB.toFixed(2)}MB exceeds limit of ${maxSizeMB}MB`);
      }

      // For large files, use chunked upload
      if (fileSizeMB > 5) {
        return await this.uploadMediaChunked(accessToken, mediaFile, mediaBuffer);
      }

      // Simple upload for small files
      return await this.uploadMediaSimple(accessToken, mediaFile, mediaBuffer);
    } catch (error) {
      return {
        mediaId: '',
        error: error.message,
      };
    }
  }

  /**
   * Simple media upload for small files
   */
  private async uploadMediaSimple(
    accessToken: string,
    mediaFile: MediaFile,
    mediaBuffer: Buffer
  ): Promise<MediaUploadResult> {
    const formData = new FormData();
    
    const blob = new Blob([mediaBuffer], { type: mediaFile.mimeType });
    formData.append('media', blob, mediaFile.fileName);
    
    if (mediaFile.altText) {
      formData.append('alt_text', JSON.stringify({ text: mediaFile.altText }));
    }

    const response = await fetch(`${this.uploadBaseUrl}/media/upload.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Upload failed: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    return {
      mediaId: data.media_id_string,
      url: data.url,
    };
  }

  /**
   * Chunked media upload for large files
   */
  private async uploadMediaChunked(
    accessToken: string,
    mediaFile: MediaFile,
    mediaBuffer: Buffer
  ): Promise<MediaUploadResult> {
    const mediaCategory = this.getMediaCategory(mediaFile.mimeType);
    const totalBytes = mediaBuffer.length;
    const chunkSize = 1024 * 1024; // 1MB chunks

    // Step 1: Initialize upload
    const initResponse = await this.makeRequest(
      `${this.uploadBaseUrl}/media/upload.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          command: 'INIT',
          total_bytes: totalBytes.toString(),
          media_type: mediaFile.mimeType,
          media_category: mediaCategory,
        }).toString(),
      },
      accessToken
    );

    const initData = await initResponse.json();
    const mediaId = initData.media_id_string;

    // Step 2: Upload chunks
    let segmentIndex = 0;
    for (let offset = 0; offset < totalBytes; offset += chunkSize) {
      const chunk = mediaBuffer.slice(offset, Math.min(offset + chunkSize, totalBytes));
      
      const formData = new FormData();
      formData.append('command', 'APPEND');
      formData.append('media_id', mediaId);
      formData.append('segment_index', segmentIndex.toString());
      formData.append('media', new Blob([chunk]));

      await fetch(`${this.uploadBaseUrl}/media/upload.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      segmentIndex++;
    }

    // Step 3: Finalize upload
    const finalizeResponse = await this.makeRequest(
      `${this.uploadBaseUrl}/media/upload.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          command: 'FINALIZE',
          media_id: mediaId,
        }).toString(),
      },
      accessToken
    );

    const finalizeData = await finalizeResponse.json();

    // Step 4: Wait for processing if needed
    if (finalizeData.processing_info) {
      await this.waitForProcessing(accessToken, mediaId);
    }

    // Step 5: Add alt text if provided
    if (mediaFile.altText) {
      await this.addAltText(accessToken, mediaId, mediaFile.altText);
    }

    return {
      mediaId: mediaId,
    };
  }

  /**
   * Wait for media processing to complete
   */
  private async waitForProcessing(accessToken: string, mediaId: string): Promise<void> {
    const maxWaitTime = 300000; // 5 minutes
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const statusResponse = await this.makeRequest(
        `${this.uploadBaseUrl}/media/upload.json?command=STATUS&media_id=${mediaId}`,
        { method: 'GET' },
        accessToken
      );

      const statusData = await statusResponse.json();
      
      if (statusData.processing_info?.state === 'succeeded') {
        return;
      }
      
      if (statusData.processing_info?.state === 'failed') {
        throw new Error(`Media processing failed: ${statusData.processing_info.error?.message}`);
      }

      // Wait before checking again
      const checkAfter = statusData.processing_info?.check_after_secs || 5;
      await this.sleep(checkAfter * 1000);
    }

    throw new Error('Media processing timeout');
  }

  /**
   * Add alt text to uploaded media
   */
  private async addAltText(accessToken: string, mediaId: string, altText: string): Promise<void> {
    await this.makeRequest(
      `${this.uploadBaseUrl}/media/metadata/create.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          media_id: mediaId,
          alt_text: { text: altText },
        }),
      },
      accessToken
    );
  }

  /**
   * Get tweet metrics
   */
  async getPostMetrics(accessToken: string, postId: string): Promise<PostMetrics> {
    try {
      const response = await this.makeRequest(
        `${this.apiBaseUrl}/tweets/${postId}?tweet.fields=public_metrics`,
        { method: 'GET' },
        accessToken
      );

      const data = await response.json();
      const metrics = data.data?.public_metrics || {};

      return {
        likes: metrics.like_count || 0,
        shares: metrics.retweet_count || 0,
        comments: metrics.reply_count || 0,
        reach: metrics.impression_count || 0,
        impressions: metrics.impression_count || 0,
      };
    } catch (error) {
      this.handleApiError(error, 'get tweet metrics');
    }
  }

  /**
   * Delete a tweet
   */
  async deletePost(accessToken: string, postId: string): Promise<boolean> {
    try {
      const response = await this.makeRequest(
        `${this.apiBaseUrl}/tweets/${postId}`,
        { method: 'DELETE' },
        accessToken
      );

      const data = await response.json();
      return data.data?.deleted === true;
    } catch (error) {
      console.error('Failed to delete tweet:', error);
      return false;
    }
  }

  /**
   * Get rate limit information
   */
  async getRateLimitInfo(accessToken: string, endpoint = 'tweets'): Promise<RateLimitInfo> {
    try {
      // Make a test request to get rate limit headers
      const response = await fetch(`${this.apiBaseUrl}/tweets/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const remaining = parseInt(response.headers.get('x-rate-limit-remaining') || '0');
      const resetTime = new Date(parseInt(response.headers.get('x-rate-limit-reset') || '0') * 1000);

      return {
        remaining,
        resetTime,
        limitType: endpoint,
      };
    } catch (error) {
      // Return default values if rate limit check fails
      return {
        remaining: 100,
        resetTime: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
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
      throw new Error(`Tweet text exceeds ${limits.maxTextLength} characters`);
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
      'image/webp',
      'video/mp4',
      'video/mov',
    ];
  }

  /**
   * Get posting limits
   */
  protected getPostingLimits() {
    return {
      maxTextLength: 280,
      maxMediaFiles: 4,
      maxMediaSizeMB: 512, // Video limit
    };
  }

  /**
   * Get media category for Twitter
   */
  private getMediaCategory(mimeType: string): string {
    if (mimeType.startsWith('video/')) {
      return 'tweet_video';
    }
    if (mimeType === 'image/gif') {
      return 'tweet_gif';
    }
    return 'tweet_image';
  }

  /**
   * Get maximum file size for media type
   */
  private getMaxMediaSizeForType(mimeType: string): number {
    if (mimeType.startsWith('video/')) {
      return 512; // 512MB for videos
    }
    if (mimeType === 'image/gif') {
      return 15; // 15MB for GIFs
    }
    return 5; // 5MB for images
  }
}

export default TwitterPostingService;