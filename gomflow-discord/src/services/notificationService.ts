import { 
  Client, 
  TextChannel, 
  DMChannel, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  User,
  MessageCreateOptions,
  Guild,
} from 'discord.js';
import { logger } from '../utils/logger';
import { DatabaseService } from './databaseService';
import { QueueService } from './queueService';
import type { NotificationJob } from '../types';
import { Job } from 'bull';

export class NotificationService {
  private client: Client;
  private databaseService: DatabaseService;
  private queueService: QueueService;

  constructor(
    client: Client,
    databaseService: DatabaseService,
    queueService: QueueService
  ) {
    this.client = client;
    this.databaseService = databaseService;
    this.queueService = queueService;
    
    // Set up notification processor
    this.setupNotificationProcessor();
  }

  private setupNotificationProcessor(): void {
    this.queueService.processNotifications(async (job: Job<NotificationJob>) => {
      try {
        await this.processNotification(job.data);
        await job.progress(100);
      } catch (error) {
        logger.error('Error processing notification:', error);
        throw error;
      }
    });
  }

  private async processNotification(notification: NotificationJob): Promise<void> {
    const { type, userId, guildId, channelId, message } = notification;

    try {
      // Determine where to send the notification
      if (channelId && guildId) {
        await this.sendToChannel(guildId, channelId, message);
      } else if (userId) {
        await this.sendToUser(userId, message);
      } else if (guildId) {
        await this.sendToGuildDefaultChannel(guildId, message);
      } else {
        throw new Error('No valid recipient specified');
      }

      // Log the notification
      await this.databaseService.logMessage({
        platform: 'discord',
        platform_message_id: `notification_${Date.now()}`,
        platform_user_id: userId || 'system',
        content: message.content || 'Embedded message',
        direction: 'outgoing',
        metadata: {
          type: notification.type,
          guildId,
          channelId,
        },
      });
    } catch (error) {
      logger.error('Failed to send notification:', error);
      throw error;
    }
  }

  async sendToUser(userId: string, message: MessageCreateOptions): Promise<void> {
    try {
      const user = await this.client.users.fetch(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      const dmChannel = await user.createDM();
      await dmChannel.send(message);
      
      logger.info(`Notification sent to user ${userId}`);
    } catch (error) {
      logger.error(`Failed to send DM to user ${userId}:`, error);
      throw error;
    }
  }

  async sendToChannel(
    guildId: string, 
    channelId: string, 
    message: MessageCreateOptions
  ): Promise<void> {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        throw new Error(`Guild ${guildId} not found`);
      }

      const channel = guild.channels.cache.get(channelId) as TextChannel;
      if (!channel || channel.type !== 0) { // 0 = GUILD_TEXT
        throw new Error(`Text channel ${channelId} not found in guild ${guildId}`);
      }

      await channel.send(message);
      
      logger.info(`Notification sent to channel ${channelId} in guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to send to channel ${channelId}:`, error);
      throw error;
    }
  }

  async sendToGuildDefaultChannel(
    guildId: string, 
    message: MessageCreateOptions
  ): Promise<void> {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        throw new Error(`Guild ${guildId} not found`);
      }

      // Try to find a suitable channel
      const channel = 
        guild.systemChannel || 
        guild.channels.cache.find(ch => 
          ch.type === 0 && 
          ch.permissionsFor(guild.members.me!)?.has(['SendMessages', 'ViewChannel'])
        ) as TextChannel;

      if (!channel) {
        throw new Error(`No suitable channel found in guild ${guildId}`);
      }

      await channel.send(message);
      
      logger.info(`Notification sent to default channel in guild ${guildId}`);
    } catch (error) {
      logger.error(`Failed to send to guild ${guildId}:`, error);
      throw error;
    }
  }

  // Helper methods for creating common notification types

  createOrderUpdateEmbed(
    orderId: string,
    status: string,
    message?: string
  ): EmbedBuilder {
    const statusEmojis: Record<string, string> = {
      active: '🟢',
      completed: '✅',
      cancelled: '❌',
      paused: '⏸️',
    };

    return new EmbedBuilder()
      .setTitle(`${statusEmojis[status] || '📋'} Order Update`)
      .setDescription(message || `Your order status has been updated.`)
      .addFields([
        { name: 'Order ID', value: orderId, inline: true },
        { name: 'New Status', value: status.toUpperCase(), inline: true },
      ])
      .setColor(status === 'active' ? 0x00ff00 : status === 'cancelled' ? 0xff0000 : 0x0099ff)
      .setTimestamp();
  }

  createPaymentReminderEmbed(
    submissionId: string,
    orderId: string,
    deadline: string
  ): EmbedBuilder {
    const deadlineDate = new Date(deadline);
    const hoursRemaining = Math.max(0, 
      Math.floor((deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60))
    );

    return new EmbedBuilder()
      .setTitle('💳 Payment Reminder')
      .setDescription(
        `Your payment is pending for this order. ` +
        `Please submit your payment proof before the deadline.`
      )
      .addFields([
        { name: 'Submission ID', value: submissionId, inline: true },
        { name: 'Order ID', value: orderId, inline: true },
        { name: 'Deadline', value: deadlineDate.toLocaleString(), inline: true },
        { name: 'Time Remaining', value: `${hoursRemaining} hours`, inline: true },
      ])
      .setColor(hoursRemaining < 24 ? 0xff9900 : 0x0099ff)
      .setTimestamp();
  }

  createSubmissionConfirmationEmbed(
    submissionId: string,
    orderId: string,
    items: any[]
  ): EmbedBuilder {
    const itemList = items.map((item, i) => 
      `${i + 1}. ${item.name} - Qty: ${item.quantity} - ${item.price}`
    ).join('\n');

    return new EmbedBuilder()
      .setTitle('✅ Submission Confirmed')
      .setDescription('Your order submission has been received successfully!')
      .addFields([
        { name: 'Submission ID', value: submissionId, inline: true },
        { name: 'Order ID', value: orderId, inline: true },
        { name: 'Items', value: itemList || 'No items', inline: false },
      ])
      .setColor(0x00ff00)
      .setTimestamp();
  }

  createPaymentVerifiedEmbed(
    submissionId: string,
    orderId: string,
    amount: string
  ): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('✅ Payment Verified')
      .setDescription('Your payment has been verified successfully!')
      .addFields([
        { name: 'Submission ID', value: submissionId, inline: true },
        { name: 'Order ID', value: orderId, inline: true },
        { name: 'Amount', value: amount, inline: true },
      ])
      .setColor(0x00ff00)
      .setTimestamp();
  }

  // Bulk notification methods

  async sendBulkNotification(
    recipients: Array<{ userId?: string; guildId?: string; channelId?: string }>,
    message: MessageCreateOptions,
    type: NotificationJob['type']
  ): Promise<void> {
    const jobs = recipients.map(recipient => ({
      ...recipient,
      message,
      type,
      metadata: {
        bulk: true,
        timestamp: new Date().toISOString(),
      },
    }));

    await this.queueService.addBulkNotifications(jobs);
    logger.info(`Queued ${jobs.length} bulk notifications of type ${type}`);
  }

  async notifyGuildMembers(
    guildId: string,
    roleId: string | null,
    message: MessageCreateOptions
  ): Promise<void> {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        throw new Error(`Guild ${guildId} not found`);
      }

      // Get members to notify
      await guild.members.fetch();
      const members = roleId 
        ? guild.members.cache.filter(member => member.roles.cache.has(roleId))
        : guild.members.cache;

      // Queue notifications for each member
      const recipients = members.map(member => ({
        userId: member.user.id,
        guildId,
      }));

      await this.sendBulkNotification(recipients, message, 'general');
      
      logger.info(`Notified ${recipients.length} members in guild ${guildId}`);
    } catch (error) {
      logger.error('Error notifying guild members:', error);
      throw error;
    }
  }

  // Schedule notification
  async scheduleNotification(
    notification: NotificationJob,
    scheduledFor: Date
  ): Promise<void> {
    await this.queueService.addNotification({
      ...notification,
      scheduled: true,
      scheduledFor: scheduledFor.toISOString(),
    }, {
      delay: scheduledFor.getTime() - Date.now(),
    });

    logger.info(`Scheduled notification for ${scheduledFor.toISOString()}`);
  }
}