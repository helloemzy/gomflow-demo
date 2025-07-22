/**
 * TikTok Posting Service
 * Handles posting to TikTok using Content API
 */

import { BasePostingService, MediaFile, PostingResult, MediaUploadResult, PostMetrics, RateLimitInfo } from './base';
import { GeneratedContent } from '../../content/generator';

export class TikTokPostingService extends BasePostingService {
  private readonly apiBaseUrl = 'https://open-api.tiktok.com';

  constructor() {
    super('tiktok');
  }

  /**
   * Publish to TikTok
   */
  async publishPost(
    accessToken: string,
    content: GeneratedContent,
    mediaFiles: MediaFile[]
  ): Promise<PostingResult> {
    try {
      this.validateContent(content, mediaFiles);

      if (mediaFiles.length === 0 || !mediaFiles[0].mimeType.startsWith('video/')) {
        throw new Error('TikTok posts require a video file');
      }

      const videoFile = mediaFiles[0];
      
      // Step 1: Upload video
      const uploadResult = await this.uploadMedia(accessToken, videoFile);
      if (uploadResult.error) {
        throw new Error(`Video upload failed: ${uploadResult.error}`);
      }

      // Step 2: Create post
      const postData = {
        video_id: uploadResult.mediaId,
        caption: this.formatTextContent(content),
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000, // Cover image at 1 second
      };

      const response = await this.makeRequest(
        `${this.apiBaseUrl}/v2/post/publish/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(postData),
        },
        accessToken
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(`TikTok API error: ${data.error.message}`);
      }

      return {
        postId: data.data.publish_id,
        url: data.data.share_url,
        platformData: data.data,
        success: true,
      };
    } catch (error) {
      this.handleApiError(error, 'post to TikTok');
    }
  }

  /**
   * Upload video to TikTok
   */
  async uploadMedia(
    accessToken: string,
    mediaFile: MediaFile
  ): Promise<MediaUploadResult> {
    try {
      if (!this.isMediaTypeSupported(mediaFile.mimeType)) {
        throw new Error(`Unsupported media type: ${mediaFile.mimeType}`);
      }

      // Step 1: Initialize upload
      const initResponse = await this.makeRequest(
        `${this.apiBaseUrl}/v2/post/publish/video/init/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source_info: {
              source: 'FILE_UPLOAD',
              video_size: await this.getFileSize(mediaFile.fileUrl),
              chunk_size: 10 * 1024 * 1024, // 10MB chunks
              total_chunk_count: 1, // Simplified for now
            },
          }),
        },
        accessToken
      );

      const initData = await initResponse.json();

      if (initData.error) {
        throw new Error(`Upload initialization failed: ${initData.error.message}`);
      }

      const uploadUrl = initData.data.upload_url;
      const videoId = initData.data.video_id;

      // Step 2: Upload video file
      const videoBuffer = await this.downloadMedia(mediaFile);
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Range': `bytes 0-${videoBuffer.length - 1}/${videoBuffer.length}`,
          'Content-Length': videoBuffer.length.toString(),
        },
        body: videoBuffer,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Video upload failed: ${uploadResponse.statusText}`);
      }

      return {
        mediaId: videoId,
        url: uploadUrl,
      };
    } catch (error) {
      return {
        mediaId: '',
        error: error.message,
      };
    }
  }

  /**
   * Get post metrics
   */
  async getPostMetrics(accessToken: string, postId: string): Promise<PostMetrics> {
    try {
      const response = await this.makeRequest(
        `${this.apiBaseUrl}/v2/video/query/?video_id=${postId}&fields=like_count,comment_count,share_count,view_count`,
        { method: 'GET' },
        accessToken
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(`Failed to get TikTok metrics: ${data.error.message}`);
      }

      const video = data.data.videos[0] || {};

      return {
        likes: video.like_count || 0,
        shares: video.share_count || 0,
        comments: video.comment_count || 0,
        reach: video.view_count || 0,
        views: video.view_count || 0,
      };
    } catch (error) {
      this.handleApiError(error, 'get TikTok metrics');
    }
  }

  /**
   * Delete a TikTok post
   */
  async deletePost(accessToken: string, postId: string): Promise<boolean> {
    try {
      const response = await this.makeRequest(
        `${this.apiBaseUrl}/v2/post/publish/video/delete/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ video_id: postId }),
        },
        accessToken
      );

      const data = await response.json();
      return !data.error;
    } catch (error) {
      console.error('Failed to delete TikTok post:', error);
      return false;
    }
  }

  /**
   * Get rate limit information
   */
  async getRateLimitInfo(accessToken: string, endpoint = 'publish'): Promise<RateLimitInfo> {
    // TikTok doesn't provide real-time rate limit info
    // Return conservative estimates
    return {
      remaining: 10, // Conservative estimate
      resetTime: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      limitType: endpoint,
    };
  }

  /**
   * Platform-specific content validation
   */
  protected validatePlatformSpecificContent(content: GeneratedContent, mediaFiles: MediaFile[]): void {
    const limits = this.getPostingLimits();
    const formattedText = this.formatTextContent(content);

    if (formattedText.length > limits.maxTextLength) {
      throw new Error(`TikTok caption exceeds ${limits.maxTextLength} characters`);
    }

    if (mediaFiles.length === 0) {
      throw new Error('TikTok posts require a video file');
    }

    if (mediaFiles.length > limits.maxMediaFiles) {
      throw new Error(`TikTok supports only ${limits.maxMediaFiles} video per post`);
    }

    const videoFile = mediaFiles[0];
    if (!videoFile.mimeType.startsWith('video/')) {
      throw new Error('TikTok posts require a video file');
    }

    if (!this.isMediaTypeSupported(videoFile.mimeType)) {
      throw new Error(`Unsupported video format: ${videoFile.mimeType}`);
    }
  }

  /**
   * Get supported media types
   */
  protected getSupportedMediaTypes(): string[] {
    return [
      'video/mp4',
      'video/mov',
      'video/mpeg',
      'video/3gpp',
      'video/webm',
    ];
  }

  /**
   * Get posting limits
   */
  protected getPostingLimits() {
    return {
      maxTextLength: 2200,
      maxMediaFiles: 1, // Only one video per post
      maxMediaSizeMB: 500, // 500MB for videos
    };
  }

  /**
   * Get file size from URL
   */
  private async getFileSize(url: string): Promise<number> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = response.headers.get('content-length');
      return contentLength ? parseInt(contentLength) : 0;
    } catch (error) {
      console.warn('Could not determine file size:', error);
      return 0;
    }
  }
}

export default TikTokPostingService;