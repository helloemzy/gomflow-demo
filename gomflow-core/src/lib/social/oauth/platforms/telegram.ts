/**
 * Telegram OAuth Provider
 * Implements Telegram Login Widget authentication
 */

import crypto from 'crypto';
import { BaseOAuthProvider, OAuthConfig, UserProfile } from '../base';

export class TelegramOAuthProvider extends BaseOAuthProvider {
  constructor(config: Omit<OAuthConfig, 'baseUrl' | 'authUrl' | 'tokenUrl'>) {
    super('telegram', {
      ...config,
      baseUrl: 'https://api.telegram.org',
      authUrl: 'https://oauth.telegram.org/auth',
      tokenUrl: 'https://api.telegram.org/bot',
      apiVersion: 'bot',
    });
  }

  /**
   * Telegram uses a different OAuth flow - Login Widget
   * This generates the widget parameters
   */
  async getTelegramLoginWidget(options: {
    botUsername: string;
    authUrl: string;
    requestAccess?: 'write';
    size?: 'large' | 'medium' | 'small';
    cornerRadius?: number;
    usePic?: boolean;
  }): Promise<{
    widgetUrl: string;
    widgetScript: string;
    widgetData: Record<string, any>;
  }> {
    const widgetData: Record<string, any> = {
      bot_id: this.config.clientId,
      origin: new URL(options.authUrl).origin,
      request_access: options.requestAccess || undefined,
      size: options.size || 'large',
      userpic: options.usePic !== false,
      radius: options.cornerRadius,
    };

    // Remove undefined values
    Object.keys(widgetData).forEach(key => {
      if (widgetData[key] === undefined) {
        delete widgetData[key];
      }
    });

    const params = new URLSearchParams(widgetData).toString();
    const widgetUrl = `https://oauth.telegram.org/embed/${options.botUsername}?${params}`;

    const widgetScript = `
      <script async src="https://telegram.org/js/telegram-widget.js?22" 
              data-telegram-login="${options.botUsername}"
              data-size="${options.size || 'large'}"
              data-auth-url="${options.authUrl}"
              ${options.requestAccess ? `data-request-access="${options.requestAccess}"` : ''}
              ${options.usePic !== false ? 'data-userpic="true"' : ''}
              ${options.cornerRadius ? `data-radius="${options.cornerRadius}"` : ''}></script>
    `;

    return {
      widgetUrl,
      widgetScript,
      widgetData,
    };
  }

  /**
   * Verify Telegram Login Widget data
   */
  verifyTelegramAuth(authData: {
    id: string;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: string;
    hash: string;
  }): boolean {
    const { hash, ...data } = authData;
    
    // Create data-check-string
    const dataCheckString = Object.keys(data)
      .sort()
      .map(key => `${key}=${data[key as keyof typeof data]}`)
      .join('\n');

    // Create secret key from bot token
    const secretKey = crypto
      .createHash('sha256')
      .update(this.config.clientSecret) // Bot token
      .digest();

    // Calculate hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Verify hash matches
    if (calculatedHash !== hash) {
      return false;
    }

    // Check if auth_date is not too old (within 24 hours)
    const authDate = parseInt(authData.auth_date);
    const now = Math.floor(Date.now() / 1000);
    const maxAge = 24 * 60 * 60; // 24 hours

    return (now - authDate) <= maxAge;
  }

  /**
   * Get user profile from Telegram auth data
   */
  async getUserProfile(accessToken: string, authData?: any): Promise<UserProfile> {
    if (authData) {
      // Use auth data from login widget
      return {
        id: authData.id,
        username: authData.username,
        displayName: `${authData.first_name}${authData.last_name ? ` ${authData.last_name}` : ''}`,
        avatarUrl: authData.photo_url,
        accountType: 'personal',
        additionalData: {
          firstName: authData.first_name,
          lastName: authData.last_name,
          authDate: authData.auth_date,
        },
      };
    }

    // Fallback: get user info using bot API (requires user to have interacted with bot)
    throw new Error('Telegram getUserProfile requires authData from login widget');
  }

  /**
   * Send message via Telegram bot
   */
  async sendMessage(botToken: string, chatId: string | number, message: {
    text: string;
    parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
    disableWebPagePreview?: boolean;
    disableNotification?: boolean;
    replyToMessageId?: number;
    allowSendingWithoutReply?: boolean;
    replyMarkup?: {
      inline_keyboard?: Array<Array<{
        text: string;
        url?: string;
        callback_data?: string;
        web_app?: { url: string; };
        login_url?: { url: string; };
      }>>;
      keyboard?: Array<Array<{
        text: string;
        request_contact?: boolean;
        request_location?: boolean;
        web_app?: { url: string; };
      }>>;
      remove_keyboard?: boolean;
      force_reply?: boolean;
    };
  }): Promise<{
    messageId: number;
    date: number;
    text: string;
  }> {
    const url = `${this.config.baseUrl}/bot${botToken}/sendMessage`;
    
    const requestBody: any = {
      chat_id: chatId,
      text: message.text,
    };

    if (message.parseMode) requestBody.parse_mode = message.parseMode;
    if (message.disableWebPagePreview) requestBody.disable_web_page_preview = message.disableWebPagePreview;
    if (message.disableNotification) requestBody.disable_notification = message.disableNotification;
    if (message.replyToMessageId) requestBody.reply_to_message_id = message.replyToMessageId;
    if (message.allowSendingWithoutReply) requestBody.allow_sending_without_reply = message.allowSendingWithoutReply;
    if (message.replyMarkup) requestBody.reply_markup = JSON.stringify(message.replyMarkup);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Failed to send Telegram message: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    return {
      messageId: data.result.message_id,
      date: data.result.date,
      text: data.result.text,
    };
  }

  /**
   * Send photo via Telegram bot
   */
  async sendPhoto(botToken: string, chatId: string | number, photo: {
    photoUrl: string;
    caption?: string;
    parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
    disableNotification?: boolean;
    replyToMessageId?: number;
    replyMarkup?: any;
  }): Promise<{
    messageId: number;
    date: number;
    photo: Array<{ fileId: string; width: number; height: number; fileSize?: number; }>;
  }> {
    const url = `${this.config.baseUrl}/bot${botToken}/sendPhoto`;
    
    const requestBody: any = {
      chat_id: chatId,
      photo: photo.photoUrl,
    };

    if (photo.caption) requestBody.caption = photo.caption;
    if (photo.parseMode) requestBody.parse_mode = photo.parseMode;
    if (photo.disableNotification) requestBody.disable_notification = photo.disableNotification;
    if (photo.replyToMessageId) requestBody.reply_to_message_id = photo.replyToMessageId;
    if (photo.replyMarkup) requestBody.reply_markup = JSON.stringify(photo.replyMarkup);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Failed to send Telegram photo: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    return {
      messageId: data.result.message_id,
      date: data.result.date,
      photo: data.result.photo.map((p: any) => ({
        fileId: p.file_id,
        width: p.width,
        height: p.height,
        fileSize: p.file_size,
      })),
    };
  }

  /**
   * Get bot information
   */
  async getBotInfo(botToken: string): Promise<{
    id: number;
    isBot: boolean;
    firstName: string;
    username: string;
    canJoinGroups: boolean;
    canReadAllGroupMessages: boolean;
    supportsInlineQueries: boolean;
  }> {
    const url = `${this.config.baseUrl}/bot${botToken}/getMe`;
    
    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to get bot info: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    const bot = data.result;
    
    return {
      id: bot.id,
      isBot: bot.is_bot,
      firstName: bot.first_name,
      username: bot.username,
      canJoinGroups: bot.can_join_groups,
      canReadAllGroupMessages: bot.can_read_all_group_messages,
      supportsInlineQueries: bot.supports_inline_queries,
    };
  }

  /**
   * Set webhook for bot
   */
  async setWebhook(botToken: string, webhookUrl: string, options?: {
    certificate?: string;
    ipAddress?: string;
    maxConnections?: number;
    allowedUpdates?: string[];
    dropPendingUpdates?: boolean;
    secretToken?: string;
  }): Promise<boolean> {
    const url = `${this.config.baseUrl}/bot${botToken}/setWebhook`;
    
    const requestBody: any = {
      url: webhookUrl,
    };

    if (options?.certificate) requestBody.certificate = options.certificate;
    if (options?.ipAddress) requestBody.ip_address = options.ipAddress;
    if (options?.maxConnections) requestBody.max_connections = options.maxConnections;
    if (options?.allowedUpdates) requestBody.allowed_updates = JSON.stringify(options.allowedUpdates);
    if (options?.dropPendingUpdates) requestBody.drop_pending_updates = options.dropPendingUpdates;
    if (options?.secretToken) requestBody.secret_token = options.secretToken;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Failed to set webhook: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    return data.result;
  }

  /**
   * Get webhook info
   */
  async getWebhookInfo(botToken: string): Promise<{
    url: string;
    hasCustomCertificate: boolean;
    pendingUpdateCount: number;
    ipAddress?: string;
    lastErrorDate?: number;
    lastErrorMessage?: string;
    lastSynchronizationErrorDate?: number;
    maxConnections?: number;
    allowedUpdates?: string[];
  }> {
    const url = `${this.config.baseUrl}/bot${botToken}/getWebhookInfo`;
    
    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to get webhook info: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    const info = data.result;
    
    return {
      url: info.url,
      hasCustomCertificate: info.has_custom_certificate,
      pendingUpdateCount: info.pending_update_count,
      ipAddress: info.ip_address,
      lastErrorDate: info.last_error_date,
      lastErrorMessage: info.last_error_message,
      lastSynchronizationErrorDate: info.last_synchronization_error_date,
      maxConnections: info.max_connections,
      allowedUpdates: info.allowed_updates,
    };
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(botToken: string, dropPendingUpdates: boolean = false): Promise<boolean> {
    const url = `${this.config.baseUrl}/bot${botToken}/deleteWebhook`;
    
    const requestBody = {
      drop_pending_updates: dropPendingUpdates,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete webhook: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    return data.result;
  }

  /**
   * Telegram doesn't use traditional OAuth flow
   */
  async getAuthorizationUrl(): Promise<{ url: string; state: string; session: any }> {
    throw new Error('Telegram uses Login Widget instead of OAuth authorization URL');
  }

  /**
   * Telegram doesn't use traditional token exchange
   */
  async exchangeCodeForTokens(): Promise<any> {
    throw new Error('Telegram uses Login Widget verification instead of token exchange');
  }

  /**
   * Telegram doesn't use refresh tokens
   */
  async refreshToken(): Promise<any> {
    throw new Error('Telegram bot tokens do not expire and cannot be refreshed');
  }

  /**
   * Telegram doesn't support PKCE
   */
  protected supportsPKCE(): boolean {
    return false;
  }

  /**
   * Platform-specific token revocation (not applicable for Telegram)
   */
  protected async platformSpecificRevoke(): Promise<boolean> {
    // Telegram bot tokens cannot be revoked via API
    return true;
  }
}