/**
 * Discord OAuth Provider
 * Implements OAuth 2.0 for Discord API
 */

import { BaseOAuthProvider, OAuthConfig, UserProfile } from '../base';

export class DiscordOAuthProvider extends BaseOAuthProvider {
  constructor(config: Omit<OAuthConfig, 'baseUrl' | 'authUrl' | 'tokenUrl'>) {
    super('discord', {
      ...config,
      baseUrl: 'https://discord.com/api',
      authUrl: 'https://discord.com/api/oauth2/authorize',
      tokenUrl: 'https://discord.com/api/oauth2/token',
      apiVersion: 'v10',
    });
  }

  /**
   * Get Discord user profile
   */
  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const url = `${this.config.baseUrl}/v10/users/@me`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken);
    const data = await response.json();

    if (data.message) {
      throw new Error(`Discord API error: ${data.message}`);
    }

    const avatarUrl = data.avatar
      ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.${data.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${data.discriminator % 5}.png`;

    return {
      id: data.id,
      username: data.username,
      displayName: data.global_name || data.username,
      email: data.email,
      avatarUrl,
      verified: data.verified || false,
      accountType: 'personal',
      additionalData: {
        discriminator: data.discriminator,
        publicFlags: data.public_flags,
        flags: data.flags,
        locale: data.locale,
        mfaEnabled: data.mfa_enabled,
        premiumType: data.premium_type,
        bot: data.bot || false,
      },
    };
  }

  /**
   * Get platform-specific authorization parameters
   */
  protected getPlatformSpecificAuthParams(): Record<string, string> {
    return {
      response_type: 'code',
    };
  }

  /**
   * Get user's guilds (servers)
   */
  async getUserGuilds(accessToken: string): Promise<Array<{
    id: string;
    name: string;
    icon?: string;
    owner: boolean;
    permissions: string;
    features: string[];
  }>> {
    const url = `${this.config.baseUrl}/v10/users/@me/guilds`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken);
    const data = await response.json();

    if (data.message) {
      throw new Error(`Failed to get guilds: ${data.message}`);
    }

    return data.map((guild: any) => ({
      id: guild.id,
      name: guild.name,
      icon: guild.icon
        ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=256`
        : undefined,
      owner: guild.owner,
      permissions: guild.permissions,
      features: guild.features || [],
    }));
  }

  /**
   * Get user's connections (linked accounts)
   */
  async getUserConnections(accessToken: string): Promise<Array<{
    type: string;
    id: string;
    name: string;
    verified: boolean;
    friendSync: boolean;
    showActivity: boolean;
    visibility: number;
  }>> {
    const url = `${this.config.baseUrl}/v10/users/@me/connections`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken);
    const data = await response.json();

    if (data.message) {
      throw new Error(`Failed to get connections: ${data.message}`);
    }

    return data.map((connection: any) => ({
      type: connection.type,
      id: connection.id,
      name: connection.name,
      verified: connection.verified,
      friendSync: connection.friend_sync,
      showActivity: connection.show_activity,
      visibility: connection.visibility,
    }));
  }

  /**
   * Get guild member information
   */
  async getGuildMember(accessToken: string, guildId: string): Promise<{
    user: {
      id: string;
      username: string;
      avatar?: string;
    };
    nick?: string;
    roles: string[];
    joinedAt: string;
    premiumSince?: string;
    permissions: string;
  }> {
    const url = `${this.config.baseUrl}/v10/users/@me/guilds/${guildId}/member`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken);
    const data = await response.json();

    if (data.message) {
      throw new Error(`Failed to get guild member: ${data.message}`);
    }

    return {
      user: data.user,
      nick: data.nick,
      roles: data.roles,
      joinedAt: data.joined_at,
      premiumSince: data.premium_since,
      permissions: data.permissions,
    };
  }

  /**
   * Join a guild (if bot has permissions)
   */
  async joinGuild(accessToken: string, guildId: string, userId: string, options?: {
    nick?: string;
    roles?: string[];
    mute?: boolean;
    deaf?: boolean;
  }): Promise<boolean> {
    const url = `${this.config.baseUrl}/v10/guilds/${guildId}/members/${userId}`;
    
    const requestBody: any = {
      access_token: accessToken,
    };

    if (options?.nick) requestBody.nick = options.nick;
    if (options?.roles) requestBody.roles = options.roles;
    if (options?.mute !== undefined) requestBody.mute = options.mute;
    if (options?.deaf !== undefined) requestBody.deaf = options.deaf;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${this.config.clientSecret}`, // Bot token needed for this endpoint
      },
      body: JSON.stringify(requestBody),
    });

    return response.ok;
  }

  /**
   * Send message to a channel (webhook or bot)
   */
  async sendMessage(webhookUrl: string, message: {
    content?: string;
    username?: string;
    avatarUrl?: string;
    embeds?: Array<{
      title?: string;
      description?: string;
      color?: number;
      fields?: Array<{
        name: string;
        value: string;
        inline?: boolean;
      }>;
      image?: { url: string; };
      thumbnail?: { url: string; };
      footer?: { text: string; iconUrl?: string; };
      timestamp?: string;
    }>;
    allowedMentions?: {
      parse?: ('roles' | 'users' | 'everyone')[];
      roles?: string[];
      users?: string[];
      repliedUser?: boolean;
    };
  }): Promise<{
    id: string;
    channelId: string;
    timestamp: string;
  }> {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message.content,
        username: message.username,
        avatar_url: message.avatarUrl,
        embeds: message.embeds,
        allowed_mentions: message.allowedMentions,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send Discord message: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      id: data.id,
      channelId: data.channel_id,
      timestamp: data.timestamp,
    };
  }

  /**
   * Create a webhook for a channel
   */
  async createWebhook(botToken: string, channelId: string, name: string, avatar?: string): Promise<{
    id: string;
    token: string;
    url: string;
    name: string;
    channelId: string;
  }> {
    const url = `${this.config.baseUrl}/v10/channels/${channelId}/webhooks`;
    
    const requestBody: any = {
      name,
    };

    if (avatar) {
      requestBody.avatar = avatar;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${botToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Failed to create webhook: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      id: data.id,
      token: data.token,
      url: `https://discord.com/api/webhooks/${data.id}/${data.token}`,
      name: data.name,
      channelId: data.channel_id,
    };
  }

  /**
   * Get guild channels
   */
  async getGuildChannels(botToken: string, guildId: string): Promise<Array<{
    id: string;
    name: string;
    type: number;
    position: number;
    parentId?: string;
    permissionOverwrites: Array<{
      id: string;
      type: number;
      allow: string;
      deny: string;
    }>;
  }>> {
    const url = `${this.config.baseUrl}/v10/guilds/${guildId}/channels`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bot ${botToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get guild channels: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.map((channel: any) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      position: channel.position,
      parentId: channel.parent_id,
      permissionOverwrites: channel.permission_overwrites || [],
    }));
  }

  /**
   * Get guild roles
   */
  async getGuildRoles(botToken: string, guildId: string): Promise<Array<{
    id: string;
    name: string;
    color: number;
    hoist: boolean;
    position: number;
    permissions: string;
    managed: boolean;
    mentionable: boolean;
  }>> {
    const url = `${this.config.baseUrl}/v10/guilds/${guildId}/roles`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bot ${botToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get guild roles: ${response.statusText}`);
    }

    const data = await response.json();
    
    return data.map((role: any) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      hoist: role.hoist,
      position: role.position,
      permissions: role.permissions,
      managed: role.managed,
      mentionable: role.mentionable,
    }));
  }

  /**
   * Platform-specific token revocation
   */
  protected async platformSpecificRevoke(token: string, tokenType: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/oauth2/token/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          token,
          token_type_hint: tokenType,
        }).toString(),
      });

      return response.ok;
    } catch (error) {
      console.error('Discord token revocation failed:', error);
      return false;
    }
  }

  /**
   * Check if user has specific permissions in a guild
   */
  hasPermission(permissions: string, permission: string): boolean {
    const userPerms = BigInt(permissions);
    const checkPerm = BigInt(permission);
    
    // Administrator permission overrides all others
    if ((userPerms & BigInt('0x8')) === BigInt('0x8')) {
      return true;
    }
    
    return (userPerms & checkPerm) === checkPerm;
  }

  /**
   * Common Discord permissions
   */
  static readonly PERMISSIONS = {
    CREATE_INSTANT_INVITE: '0x1',
    KICK_MEMBERS: '0x2',
    BAN_MEMBERS: '0x4',
    ADMINISTRATOR: '0x8',
    MANAGE_CHANNELS: '0x10',
    MANAGE_GUILD: '0x20',
    ADD_REACTIONS: '0x40',
    VIEW_AUDIT_LOG: '0x80',
    PRIORITY_SPEAKER: '0x100',
    STREAM: '0x200',
    VIEW_CHANNEL: '0x400',
    SEND_MESSAGES: '0x800',
    SEND_TTS_MESSAGES: '0x1000',
    MANAGE_MESSAGES: '0x2000',
    EMBED_LINKS: '0x4000',
    ATTACH_FILES: '0x8000',
    READ_MESSAGE_HISTORY: '0x10000',
    MENTION_EVERYONE: '0x20000',
    USE_EXTERNAL_EMOJIS: '0x40000',
    VIEW_GUILD_INSIGHTS: '0x80000',
    CONNECT: '0x100000',
    SPEAK: '0x200000',
    MUTE_MEMBERS: '0x400000',
    DEAFEN_MEMBERS: '0x800000',
    MOVE_MEMBERS: '0x1000000',
    USE_VAD: '0x2000000',
    CHANGE_NICKNAME: '0x4000000',
    MANAGE_NICKNAMES: '0x8000000',
    MANAGE_ROLES: '0x10000000',
    MANAGE_WEBHOOKS: '0x20000000',
    MANAGE_EMOJIS_AND_STICKERS: '0x40000000',
    USE_APPLICATION_COMMANDS: '0x80000000',
    REQUEST_TO_SPEAK: '0x100000000',
    MANAGE_EVENTS: '0x200000000',
    MANAGE_THREADS: '0x400000000',
    CREATE_PUBLIC_THREADS: '0x800000000',
    CREATE_PRIVATE_THREADS: '0x1000000000',
    USE_EXTERNAL_STICKERS: '0x2000000000',
    SEND_MESSAGES_IN_THREADS: '0x4000000000',
    USE_EMBEDDED_ACTIVITIES: '0x8000000000',
    MODERATE_MEMBERS: '0x10000000000',
  };
}