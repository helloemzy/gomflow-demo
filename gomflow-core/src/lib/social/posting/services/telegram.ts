/**
 * Telegram Posting Service
 * Handles posting to Telegram using Bot API
 */

import { BasePostingService, MediaFile, PostingResult, MediaUploadResult, PostMetrics, RateLimitInfo } from './base';
import { GeneratedContent } from '../../content/generator';

export class TelegramPostingService extends BasePostingService {
  private readonly apiBaseUrl = 'https://api.telegram.org';

  constructor() {
    super('telegram');
  }

  /**
   * Publish to Telegram
   */
  async publishPost(
    accessToken: string, // This is the bot token for Telegram
    content: GeneratedContent,
    mediaFiles: MediaFile[]
  ): Promise<PostingResult> {
    try {
      this.validateContent(content, mediaFiles);

      // For Telegram, we need chat ID from platform-specific data
      const platformData = content.platformSpecific?.telegramData;
      const chatId = platformData?.chatId;
      
      if (!chatId) {
        throw new Error('Telegram chat ID is required');
      }

      if (mediaFiles.length === 0) {
        // Text-only message
        return await this.sendTextMessage(accessToken, chatId, content);
      } else if (mediaFiles.length === 1) {
        // Single media message
        return await this.sendSingleMedia(accessToken, chatId, content, mediaFiles[0]);
      } else {
        // Media group (album)
        return await this.sendMediaGroup(accessToken, chatId, content, mediaFiles);
      }
    } catch (error) {
      this.handleApiError(error, 'post to Telegram');
    }
  }

  /**
   * Send text-only message
   */
  private async sendTextMessage(
    botToken: string,
    chatId: string,
    content: GeneratedContent
  ): Promise<PostingResult> {
    const messageData = {
      chat_id: chatId,
      text: this.formatTextContent(content),
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
    };

    const response = await fetch(`${this.apiBaseUrl}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Telegram API error: ${errorData.description || response.statusText}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    const messageId = data.result.message_id;
    const messageUrl = this.generateMessageUrl(chatId, messageId);

    return {
      postId: messageId.toString(),
      url: messageUrl,
      platformData: data.result,
      success: true,
    };
  }

  /**
   * Send single media message
   */
  private async sendSingleMedia(
    botToken: string,
    chatId: string,
    content: GeneratedContent,
    mediaFile: MediaFile
  ): Promise<PostingResult> {
    const isVideo = mediaFile.mimeType.startsWith('video/');
    const isAudio = mediaFile.mimeType.startsWith('audio/');
    const isDocument = !mediaFile.mimeType.startsWith('image/') && !isVideo && !isAudio;
    
    let endpoint: string;
    let mediaParam: string;

    if (isVideo) {
      endpoint = 'sendVideo';
      mediaParam = 'video';
    } else if (isAudio) {
      endpoint = 'sendAudio';
      mediaParam = 'audio';
    } else if (isDocument) {
      endpoint = 'sendDocument';
      mediaParam = 'document';
    } else {
      endpoint = 'sendPhoto';
      mediaParam = 'photo';
    }

    const messageData = {
      chat_id: chatId,
      [mediaParam]: mediaFile.fileUrl,
      caption: this.formatTextContent(content),
      parse_mode: 'Markdown',
    };

    const response = await fetch(`${this.apiBaseUrl}/bot${botToken}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Telegram API error: ${errorData.description || response.statusText}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    const messageId = data.result.message_id;
    const messageUrl = this.generateMessageUrl(chatId, messageId);

    return {
      postId: messageId.toString(),
      url: messageUrl,
      platformData: data.result,
      success: true,
    };
  }

  /**
   * Send media group (album)
   */
  private async sendMediaGroup(
    botToken: string,
    chatId: string,
    content: GeneratedContent,
    mediaFiles: MediaFile[]
  ): Promise<PostingResult> {
    const media = mediaFiles.map((mediaFile, index) => {
      const isVideo = mediaFile.mimeType.startsWith('video/');
      const mediaType = isVideo ? 'video' : 'photo';
      
      const mediaItem: any = {
        type: mediaType,
        media: mediaFile.fileUrl,
      };

      // Add caption to the first item only
      if (index === 0) {
        mediaItem.caption = this.formatTextContent(content);
        mediaItem.parse_mode = 'Markdown';
      }

      return mediaItem;
    });

    const messageData = {
      chat_id: chatId,
      media: JSON.stringify(media),
    };

    const response = await fetch(`${this.apiBaseUrl}/bot${botToken}/sendMediaGroup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Telegram API error: ${errorData.description || response.statusText}`);
    }

    const data = await response.json();

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    // Media group returns an array of messages
    const firstMessage = data.result[0];
    const messageId = firstMessage.message_id;
    const messageUrl = this.generateMessageUrl(chatId, messageId);

    return {
      postId: messageId.toString(),
      url: messageUrl,
      platformData: data.result,
      success: true,
    };
  }

  /**
   * Upload media to Telegram (not needed, Telegram accepts URLs)
   */
  async uploadMedia(
    accessToken: string,
    mediaFile: MediaFile
  ): Promise<MediaUploadResult> {
    try {
      if (!this.isMediaTypeSupported(mediaFile.mimeType)) {
        throw new Error(`Unsupported media type: ${mediaFile.mimeType}`);
      }

      // Telegram can use file URLs directly, no need to upload
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
   * Get message metrics (Telegram doesn't provide engagement metrics)
   */
  async getPostMetrics(accessToken: string, postId: string): Promise<PostMetrics> {
    try {
      // Telegram doesn't provide engagement metrics for regular messages
      // Only channels and bots with special permissions can get view counts
      return {
        likes: 0,
        shares: 0,
        comments: 0,
        reach: 0,
        views: 0,
      };
    } catch (error) {
      this.handleApiError(error, 'get Telegram metrics');
    }
  }

  /**
   * Delete a Telegram message
   */
  async deletePost(accessToken: string, postId: string): Promise<boolean> {
    try {
      // Would need chat ID to delete message
      // This is a limitation without storing chat ID separately
      console.warn('Telegram message deletion requires chat ID');
      return false;
    } catch (error) {
      console.error('Failed to delete Telegram message:', error);
      return false;
    }
  }

  /**
   * Delete message with chat ID
   */
  async deleteMessage(botToken: string, chatId: string, messageId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/bot${botToken}/deleteMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: parseInt(messageId),
        }),
      });

      const data = await response.json();
      return data.ok;
    } catch (error) {
      console.error('Failed to delete Telegram message:', error);
      return false;
    }
  }

  /**
   * Get rate limit information
   */
  async getRateLimitInfo(accessToken: string, endpoint = 'sendMessage'): Promise<RateLimitInfo> {
    // Telegram has a global rate limit of 30 messages per second
    // For groups: 20 messages per minute
    // For channels: 1 message per minute
    
    const rateLimits: Record<string, { limit: number; window: number }> = {
      sendMessage: { limit: 30, window: 1 }, // 30 per second
      sendPhoto: { limit: 30, window: 1 },
      sendVideo: { limit: 30, window: 1 },
      sendMediaGroup: { limit: 10, window: 1 }, // More conservative for media groups
    };

    const limit = rateLimits[endpoint] || rateLimits.sendMessage;

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
      throw new Error(`Telegram message exceeds ${limits.maxTextLength} characters`);
    }

    if (mediaFiles.length > limits.maxMediaFiles) {
      throw new Error(`Too many media files. Maximum ${limits.maxMediaFiles} allowed in media group`);
    }

    // Check media types
    for (const mediaFile of mediaFiles) {
      if (!this.isMediaTypeSupported(mediaFile.mimeType)) {
        throw new Error(`Unsupported media type: ${mediaFile.mimeType}`);
      }
    }

    // Validate Telegram-specific data
    const platformData = content.platformSpecific?.telegramData;
    if (!platformData?.chatId) {
      throw new Error('Telegram chat ID is required');
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
      'video/avi',
      'video/webm',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/m4a',
      'application/pdf',
      'text/plain',
      'application/zip',
    ];
  }

  /**
   * Get posting limits
   */
  protected getPostingLimits() {
    return {
      maxTextLength: 4096,
      maxMediaFiles: 10, // Media group limit
      maxMediaSizeMB: 50, // 50MB for files, 20MB for photos
    };
  }

  /**
   * Generate message URL (for public channels/groups)
   */
  private generateMessageUrl(chatId: string, messageId: number): string {
    // For private chats, we can't generate a public URL
    // For public channels/groups, the format would be different
    // This is a placeholder implementation
    if (chatId.startsWith('@')) {
      // Public channel/group
      const username = chatId.substring(1);
      return `https://t.me/${username}/${messageId}`;
    } else {
      // Private chat - no public URL available
      return `tg://openmessage?chat_id=${chatId}&message_id=${messageId}`;
    }
  }

  /**
   * Get bot info
   */
  async getBotInfo(botToken: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/bot${botToken}/getMe`);
      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(`Telegram API error: ${data.description}`);
      }
      
      return data.result;
    } catch (error) {
      throw new Error(`Failed to get bot info: ${error.message}`);
    }
  }

  /**
   * Get chat info
   */
  async getChatInfo(botToken: string, chatId: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/bot${botToken}/getChat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chat_id: chatId }),
      });

      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(`Telegram API error: ${data.description}`);
      }
      
      return data.result;
    } catch (error) {
      throw new Error(`Failed to get chat info: ${error.message}`);
    }
  }

  /**
   * Send typing action
   */
  async sendTypingAction(botToken: string, chatId: string): Promise<void> {
    try {
      await fetch(`${this.apiBaseUrl}/bot${botToken}/sendChatAction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          action: 'typing',
        }),
      });
    } catch (error) {
      console.warn('Failed to send typing action:', error);
    }
  }
}

export default TelegramPostingService;