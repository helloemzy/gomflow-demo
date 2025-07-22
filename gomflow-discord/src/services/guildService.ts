import { 
  Client, 
  Guild, 
  GuildMember, 
  Role,
  PermissionsBitField,
  ChannelType,
  TextChannel,
} from 'discord.js';
import { logger } from '../utils/logger';
import { DatabaseService } from './databaseService';
import type { GuildSettings, GuildPermissions } from '../types';

export class GuildService {
  private client: Client;
  private databaseService: DatabaseService;
  private guildSettingsCache: Map<string, GuildSettings> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(client: Client, databaseService: DatabaseService) {
    this.client = client;
    this.databaseService = databaseService;

    // Set up guild event handlers
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle when bot joins a new guild
    this.client.on('guildCreate', async (guild: Guild) => {
      logger.info(`Joined new guild: ${guild.name} (${guild.id})`);
      await this.initializeGuild(guild);
    });

    // Handle when bot is removed from a guild
    this.client.on('guildDelete', async (guild: Guild) => {
      logger.info(`Left guild: ${guild.name} (${guild.id})`);
      this.guildSettingsCache.delete(guild.id);
    });

    // Handle role updates
    this.client.on('roleUpdate', async (oldRole: Role, newRole: Role) => {
      if (this.isGOMRole(oldRole) || this.isGOMRole(newRole)) {
        await this.refreshGuildSettings(newRole.guild.id);
      }
    });
  }

  async initializeGuild(guild: Guild): Promise<void> {
    try {
      // Create default settings
      const settings: GuildSettings = {
        guildId: guild.id,
        name: guild.name,
        enabled: true,
        gomRoleId: null,
        notificationChannelId: null,
        orderChannelId: null,
        locale: 'en',
        features: {
          autoThreads: false,
          paymentReminders: true,
          orderNotifications: true,
        },
        permissions: {
          createOrders: 'gom_only',
          viewOrders: 'everyone',
          submitOrders: 'everyone',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to database
      await this.databaseService.updateGuildSettings(guild.id, settings);
      this.guildSettingsCache.set(guild.id, settings);

      // Try to find and set up default channels
      await this.setupDefaultChannels(guild);

      logger.info(`Initialized settings for guild ${guild.id}`);
    } catch (error) {
      logger.error(`Error initializing guild ${guild.id}:`, error);
    }
  }

  async setupDefaultChannels(guild: Guild): Promise<void> {
    try {
      // Find or create order channel
      let orderChannel = guild.channels.cache.find(
        ch => ch.name === 'gomflow-orders' && ch.type === ChannelType.GuildText
      ) as TextChannel;

      if (!orderChannel) {
        orderChannel = await guild.channels.create({
          name: 'gomflow-orders',
          type: ChannelType.GuildText,
          topic: '📦 GOMFLOW Group Orders - View and submit orders here!',
          permissionOverwrites: [
            {
              id: guild.id, // @everyone
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
              deny: [PermissionsBitField.Flags.SendMessages],
            },
            {
              id: guild.members.me!.id, // Bot
              allow: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageMessages],
            },
          ],
        });
      }

      // Find or create notification channel
      let notificationChannel = guild.channels.cache.find(
        ch => ch.name === 'gomflow-notifications' && ch.type === ChannelType.GuildText
      ) as TextChannel;

      if (!notificationChannel) {
        notificationChannel = await guild.channels.create({
          name: 'gomflow-notifications',
          type: ChannelType.GuildText,
          topic: '🔔 GOMFLOW Notifications - Order updates and announcements',
          permissionOverwrites: [
            {
              id: guild.id, // @everyone
              allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
              deny: [PermissionsBitField.Flags.SendMessages],
            },
            {
              id: guild.members.me!.id, // Bot
              allow: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageMessages],
            },
          ],
        });
      }

      // Update settings with channel IDs
      const settings = await this.getGuildSettings(guild.id);
      if (settings) {
        settings.orderChannelId = orderChannel.id;
        settings.notificationChannelId = notificationChannel.id;
        await this.updateGuildSettings(guild.id, settings);
      }

      logger.info(`Set up default channels for guild ${guild.id}`);
    } catch (error) {
      logger.error(`Error setting up channels for guild ${guild.id}:`, error);
    }
  }

  async getGuildSettings(guildId: string): Promise<GuildSettings | null> {
    // Check cache first
    const cached = this.guildSettingsCache.get(guildId);
    if (cached) {
      return cached;
    }

    // Load from database
    const settings = await this.databaseService.getGuildSettings(guildId);
    if (settings) {
      this.guildSettingsCache.set(guildId, settings);
      
      // Set cache expiry
      setTimeout(() => {
        this.guildSettingsCache.delete(guildId);
      }, this.CACHE_TTL);
    }

    return settings;
  }

  async updateGuildSettings(guildId: string, settings: GuildSettings): Promise<void> {
    settings.updatedAt = new Date();
    await this.databaseService.updateGuildSettings(guildId, settings);
    this.guildSettingsCache.set(guildId, settings);
  }

  async refreshGuildSettings(guildId: string): Promise<void> {
    this.guildSettingsCache.delete(guildId);
    await this.getGuildSettings(guildId);
  }

  // Permission checking methods

  async canCreateOrders(guildId: string, member: GuildMember): Promise<boolean> {
    const settings = await this.getGuildSettings(guildId);
    if (!settings || !settings.enabled) return false;

    const permission = settings.permissions.createOrders;

    switch (permission) {
      case 'everyone':
        return true;
      case 'gom_only':
        return this.memberHasGOMRole(member, settings.gomRoleId);
      case 'admin_only':
        return member.permissions.has(PermissionsBitField.Flags.Administrator);
      default:
        return false;
    }
  }

  async canViewOrders(guildId: string, member: GuildMember): Promise<boolean> {
    const settings = await this.getGuildSettings(guildId);
    if (!settings || !settings.enabled) return false;

    const permission = settings.permissions.viewOrders;

    switch (permission) {
      case 'everyone':
        return true;
      case 'gom_only':
        return this.memberHasGOMRole(member, settings.gomRoleId);
      case 'admin_only':
        return member.permissions.has(PermissionsBitField.Flags.Administrator);
      default:
        return false;
    }
  }

  async canSubmitOrders(guildId: string, member: GuildMember): Promise<boolean> {
    const settings = await this.getGuildSettings(guildId);
    if (!settings || !settings.enabled) return false;

    const permission = settings.permissions.submitOrders;

    switch (permission) {
      case 'everyone':
        return true;
      case 'gom_only':
        return this.memberHasGOMRole(member, settings.gomRoleId);
      case 'admin_only':
        return member.permissions.has(PermissionsBitField.Flags.Administrator);
      default:
        return false;
    }
  }

  private memberHasGOMRole(member: GuildMember, gomRoleId: string | null): boolean {
    if (!gomRoleId) return false;
    return member.roles.cache.has(gomRoleId);
  }

  private isGOMRole(role: Role): boolean {
    // Check if this role is set as a GOM role in any guild settings
    const settings = this.guildSettingsCache.get(role.guild.id);
    return settings?.gomRoleId === role.id;
  }

  // Guild statistics methods

  async getGuildStats(guildId: string): Promise<{
    memberCount: number;
    gomCount: number;
    activeOrders: number;
    totalOrders: number;
  }> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) {
      return { memberCount: 0, gomCount: 0, activeOrders: 0, totalOrders: 0 };
    }

    const settings = await this.getGuildSettings(guildId);
    const gomCount = settings?.gomRoleId 
      ? guild.members.cache.filter(m => m.roles.cache.has(settings.gomRoleId)).size
      : 0;

    const analytics = await this.databaseService.getGuildAnalytics(guildId);

    return {
      memberCount: guild.memberCount,
      gomCount,
      activeOrders: analytics?.activeOrders || 0,
      totalOrders: analytics?.totalOrders || 0,
    };
  }

  // Channel management methods

  async getOrderChannel(guildId: string): Promise<TextChannel | null> {
    const settings = await this.getGuildSettings(guildId);
    if (!settings?.orderChannelId) return null;

    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return null;

    return guild.channels.cache.get(settings.orderChannelId) as TextChannel || null;
  }

  async getNotificationChannel(guildId: string): Promise<TextChannel | null> {
    const settings = await this.getGuildSettings(guildId);
    if (!settings?.notificationChannelId) return null;

    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) return null;

    return guild.channels.cache.get(settings.notificationChannelId) as TextChannel || null;
  }

  // Utility methods

  async isGuildEnabled(guildId: string): Promise<boolean> {
    const settings = await this.getGuildSettings(guildId);
    return settings?.enabled || false;
  }

  async getGuildLocale(guildId: string): Promise<string> {
    const settings = await this.getGuildSettings(guildId);
    return settings?.locale || 'en';
  }

  getAllGuilds(): Guild[] {
    return Array.from(this.client.guilds.cache.values());
  }
}