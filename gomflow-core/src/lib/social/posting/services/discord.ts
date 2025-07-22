/**
 * Discord Posting Service
 * Handles posting to Discord using Webhooks and Bot API
 */

import { BasePostingService, MediaFile, PostingResult, MediaUploadResult, PostMetrics, RateLimitInfo } from './base';
import { GeneratedContent } from '../../content/generator';

export class DiscordPostingService extends BasePostingService {
  private readonly apiBaseUrl = 'https://discord.com/api/v10';

  constructor() {
    super('discord');
  }

  /**
   * Publish to Discord
   */
  async publishPost(
    accessToken: string,
    content: GeneratedContent,
    mediaFiles: MediaFile[]
  ): Promise<PostingResult> {
    try {
      this.validateContent(content, mediaFiles);

      // For Discord, we need channel ID from platform-specific data
      const platformData = content.platformSpecific?.discordData;
      const channelId = platformData?.channelId;
      
      if (!channelId) {
        throw new Error('Discord channel ID is required');
      }

      // Prepare message data
      const messageData: any = {
        content: this.formatTextContent(content),
      };

      // Handle embeds if specified
      if (platformData?.embeds) {
        messageData.embeds = platformData.embeds;
      }

      // Handle attachments
      if (mediaFiles.length > 0) {
        const attachments = await this.uploadMultipleMedia(accessToken, mediaFiles);
        messageData.attachments = attachments.map((attachment, index) => ({
          id: index.toString(),
          filename: mediaFiles[index].fileName,
          description: mediaFiles[index].altText,
        }));
      }

      // Send message
      const response = await this.makeRequest(
        `${this.apiBaseUrl}/channels/${channelId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messageData),
        },
        accessToken
      );

      const data = await response.json();

      const messageUrl = `https://discord.com/channels/${data.guild_id || '@me'}/${channelId}/${data.id}`;

      return {
        postId: data.id,
        url: messageUrl,
        platformData: data,
        success: true,
      };
    } catch (error) {
      this.handleApiError(error, 'post to Discord');
    }
  }

  /**
   * Upload media to Discord
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
      
      // Check file size (Discord has 8MB limit for normal users, 50MB for Nitro)
      const maxSizeMB = this.getPostingLimits().maxMediaSizeMB;
      const fileSizeMB = mediaBuffer.length / (1024 * 1024);
      
      if (fileSizeMB > maxSizeMB) {
        throw new Error(`File size ${fileSizeMB.toFixed(2)}MB exceeds Discord limit of ${maxSizeMB}MB`);
      }

      // For Discord, we return the file data to be sent with the message
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
   * Upload multiple media files
   */
  private async uploadMultipleMedia(
    accessToken: string,
    mediaFiles: MediaFile[]
  ): Promise<Array<{ id: string; filename: string; data: Buffer }>> {
    const attachments: Array<{ id: string; filename: string; data: Buffer }> = [];

    for (let i = 0; i < mediaFiles.length; i++) {
      const mediaFile = mediaFiles[i];
      
      if (!this.isMediaTypeSupported(mediaFile.mimeType)) {
        console.warn(`Skipping unsupported media type: ${mediaFile.mimeType}`);
        continue;
      }

      try {
        const mediaBuffer = await this.downloadMedia(mediaFile);
        
        attachments.push({
          id: i.toString(),
          filename: mediaFile.fileName,
          data: mediaBuffer,
        });
      } catch (error) {
        console.warn(`Failed to download media ${mediaFile.fileName}:`, error);
      }
    }

    return attachments;
  }

  /**
   * Get message metrics (Discord doesn't have traditional engagement metrics)
   */
  async getPostMetrics(accessToken: string, postId: string): Promise<PostMetrics> {
    try {
      // Discord doesn't provide engagement metrics like other platforms
      // We can get reaction counts if available
      
      // This would require knowing the channel ID, which we'd need to store
      // For now, return zero metrics
      return {
        likes: 0,
        shares: 0,
        comments: 0,
        reach: 0,
      };
    } catch (error) {
      this.handleApiError(error, 'get Discord metrics');
    }
  }

  /**
   * Delete a Discord message
   */
  async deletePost(accessToken: string, postId: string): Promise<boolean> {
    try {
      // Would need channel ID to delete message
      // This is a limitation of Discord's API structure
      console.warn('Discord message deletion requires channel ID');
      return false;
    } catch (error) {
      console.error('Failed to delete Discord message:', error);
      return false;
    }
  }

  /**
   * Get rate limit information
   */
  async getRateLimitInfo(accessToken: string, endpoint = 'messages'): Promise<RateLimitInfo> {
    // Discord has different rate limits for different endpoints
    const rateLimits: Record<string, { limit: number; window: number }> = {
      messages: { limit: 5, window: 5 }, // 5 messages per 5 seconds
      channels: { limit: 10, window: 10 }, // 10 requests per 10 seconds
      guilds: { limit: 5, window: 5 }, // 5 requests per 5 seconds
    };

    const limit = rateLimits[endpoint] || rateLimits.messages;

    return {
      remaining: limit.limit, // Conservative estimate
      resetTime: new Date(Date.now() + limit.window * 1000),
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
      throw new Error(`Discord message exceeds ${limits.maxTextLength} characters`);
    }

    if (mediaFiles.length > limits.maxMediaFiles) {
      throw new Error(`Too many attachments. Maximum ${limits.maxMediaFiles} allowed`);
    }

    // Check media types and sizes
    for (const mediaFile of mediaFiles) {
      if (!this.isMediaTypeSupported(mediaFile.mimeType)) {
        throw new Error(`Unsupported media type: ${mediaFile.mimeType}`);
      }
    }

    // Validate Discord-specific data
    const platformData = content.platformSpecific?.discordData;
    if (!platformData?.channelId) {
      throw new Error('Discord channel ID is required');
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
      'video/webm',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'text/plain',
      'application/pdf',
    ];
  }

  /**
   * Get posting limits
   */
  protected getPostingLimits() {
    return {
      maxTextLength: 2000,
      maxMediaFiles: 10,
      maxMediaSizeMB: 8, // 8MB for normal users (could be 50MB for Nitro)
    };
  }

  /**
   * Create an embed for rich content
   */
  createEmbed(options: {
    title?: string;
    description?: string;
    color?: number;
    thumbnail?: string;
    image?: string;
    author?: { name: string; icon_url?: string; url?: string };
    footer?: { text: string; icon_url?: string };
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
  }): any {
    const embed: any = {};

    if (options.title) embed.title = options.title;
    if (options.description) embed.description = options.description;
    if (options.color) embed.color = options.color;
    if (options.thumbnail) embed.thumbnail = { url: options.thumbnail };
    if (options.image) embed.image = { url: options.image };
    if (options.author) embed.author = options.author;
    if (options.footer) embed.footer = options.footer;
    if (options.fields) embed.fields = options.fields;

    embed.timestamp = new Date().toISOString();

    return embed;
  }

  /**
   * Send message using webhook (alternative method)
   */
  async sendWebhookMessage(
    webhookUrl: string,
    content: GeneratedContent,
    mediaFiles: MediaFile[] = []
  ): Promise<PostingResult> {
    try {
      const messageData: any = {
        content: this.formatTextContent(content),
      };

      // Handle embeds if specified
      const platformData = content.platformSpecific?.discordData;
      if (platformData?.embeds) {
        messageData.embeds = platformData.embeds;
      }

      // For webhooks, we can include a username and avatar
      if (platformData?.username) {
        messageData.username = platformData.username;
      }
      if (platformData?.avatar_url) {
        messageData.avatar_url = platformData.avatar_url;
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Webhook failed: ${errorData.message || response.statusText}`);
      }

      // Webhooks don't return message data, so we create a mock response
      return {
        postId: `webhook_${Date.now()}`,
        url: webhookUrl,
        platformData: { webhook: true },
        success: true,
      };
    } catch (error) {
      throw new Error(`Discord webhook error: ${error.message}`);
    }
  }
}

export default DiscordPostingService;