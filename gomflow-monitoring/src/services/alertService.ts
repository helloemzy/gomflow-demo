import { createClient } from '@supabase/supabase-js';
import { createAdapter } from '@redis/client';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

import config from '../config';
import logger from '../utils/logger';
import {
  Alert,
  AlertType,
  AlertSeverity,
  AlertStatus,
  AlertServiceInterface,
  NotificationChannel,
  NotificationTemplate
} from '../types';

export class AlertService implements AlertServiceInterface {
  private supabase: any;
  private redis: any;
  private initialized = false;
  private notificationChannels: Record<string, NotificationChannel> = {};
  private notificationTemplates: Record<string, NotificationTemplate> = {};

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Initialize Supabase client
      this.supabase = createClient(
        config.SUPABASE_URL,
        config.SUPABASE_SERVICE_ROLE_KEY
      );

      // Initialize Redis client
      if (config.REDIS_URL) {
        this.redis = createAdapter({ url: config.REDIS_URL });
      } else {
        this.redis = createAdapter({
          socket: {
            host: config.REDIS_HOST,
            port: config.REDIS_PORT
          },
          password: config.REDIS_PASSWORD
        });
      }

      await this.redis.connect();

      // Initialize notification channels
      this.initializeNotificationChannels();

      // Initialize notification templates
      this.initializeNotificationTemplates();

      this.initialized = true;
      logger.info('Alert service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize alert service:', error);
      throw error;
    }
  }

  private initializeNotificationChannels(): void {
    this.notificationChannels = {
      'slack': {
        id: 'slack',
        type: 'slack',
        name: 'Slack Notifications',
        config: {
          webhook_url: config.SLACK_WEBHOOK_URL
        },
        enabled: !!config.SLACK_WEBHOOK_URL
      },
      'discord': {
        id: 'discord',
        type: 'discord',
        name: 'Discord Notifications',
        config: {
          webhook_url: config.DISCORD_WEBHOOK_URL
        },
        enabled: !!config.DISCORD_WEBHOOK_URL
      },
      'webhook': {
        id: 'webhook',
        type: 'webhook',
        name: 'Generic Webhook',
        config: {
          webhook_url: config.ALERT_WEBHOOK_URL
        },
        enabled: !!config.ALERT_WEBHOOK_URL
      }
    };
  }

  private initializeNotificationTemplates(): void {
    this.notificationTemplates = {
      'cpu_high_critical': {
        id: 'cpu_high_critical',
        type: AlertType.CPU_HIGH,
        severity: AlertSeverity.CRITICAL,
        title: '🚨 CRITICAL: High CPU Usage - {{service}}',
        message: `**CRITICAL ALERT**\n\n` +
                 `**Service:** {{service}}\n` +
                 `**Alert:** {{title}}\n` +
                 `**Current Value:** {{currentValue}}%\n` +
                 `**Threshold:** {{threshold}}%\n` +
                 `**Time:** {{timestamp}}\n\n` +
                 `**Description:** {{description}}\n\n` +
                 `⚠️ Immediate action required!`,
        variables: ['service', 'title', 'currentValue', 'threshold', 'timestamp', 'description']
      },
      'memory_high_high': {
        id: 'memory_high_high',
        type: AlertType.MEMORY_HIGH,
        severity: AlertSeverity.HIGH,
        title: '⚠️ HIGH: Memory Usage Alert - {{service}}',
        message: `**HIGH PRIORITY ALERT**\n\n` +
                 `**Service:** {{service}}\n` +
                 `**Alert:** {{title}}\n` +
                 `**Current Value:** {{currentValue}}%\n` +
                 `**Threshold:** {{threshold}}%\n` +
                 `**Time:** {{timestamp}}\n\n` +
                 `**Description:** {{description}}`,
        variables: ['service', 'title', 'currentValue', 'threshold', 'timestamp', 'description']
      },
      'service_down_critical': {
        id: 'service_down_critical',
        type: AlertType.SERVICE_DOWN,
        severity: AlertSeverity.CRITICAL,
        title: '🔴 CRITICAL: Service Down - {{service}}',
        message: `**CRITICAL SERVICE OUTAGE**\n\n` +
                 `**Service:** {{service}}\n` +
                 `**Status:** DOWN\n` +
                 `**Time:** {{timestamp}}\n\n` +
                 `**Description:** {{description}}\n\n` +
                 `🚨 Service is not responding to health checks!`,
        variables: ['service', 'timestamp', 'description']
      },
      'response_time_high_medium': {
        id: 'response_time_high_medium',
        type: AlertType.RESPONSE_TIME_HIGH,
        severity: AlertSeverity.MEDIUM,
        title: '🟡 MEDIUM: High Response Time - {{service}}',
        message: `**Performance Alert**\n\n` +
                 `**Service:** {{service}}\n` +
                 `**Current Response Time:** {{currentValue}}ms\n` +
                 `**Threshold:** {{threshold}}ms\n` +
                 `**Time:** {{timestamp}}\n\n` +
                 `**Description:** {{description}}`,
        variables: ['service', 'currentValue', 'threshold', 'timestamp', 'description']
      },
      'disk_full_critical': {
        id: 'disk_full_critical',
        type: AlertType.DISK_FULL,
        severity: AlertSeverity.CRITICAL,
        title: '💾 CRITICAL: Disk Space Low - {{service}}',
        message: `**CRITICAL STORAGE ALERT**\n\n` +
                 `**Service:** {{service}}\n` +
                 `**Disk Usage:** {{currentValue}}%\n` +
                 `**Threshold:** {{threshold}}%\n` +
                 `**Time:** {{timestamp}}\n\n` +
                 `**Description:** {{description}}\n\n` +
                 `💾 Immediate cleanup or expansion required!`,
        variables: ['service', 'currentValue', 'threshold', 'timestamp', 'description']
      }
    };
  }

  public async evaluateAlerts(): Promise<void> {
    try {
      // This would typically run alert evaluation logic
      // For now, we'll implement basic functionality
      logger.debug('Evaluating alerts...');
      
      // Get active alerts that need to be checked
      const { data: activeAlerts, error } = await this.supabase
        .from('monitoring_alerts')
        .select('*')
        .eq('status', AlertStatus.ACTIVE)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch active alerts: ${error.message}`);
      }

      logger.debug(`Found ${activeAlerts?.length || 0} active alerts`);
      
      // Process each alert for potential notifications
      for (const alertData of activeAlerts || []) {
        await this.processAlert(alertData);
      }
    } catch (error) {
      logger.error('Failed to evaluate alerts:', error);
      throw error;
    }
  }

  public async sendNotification(alert: Alert, channels: string[]): Promise<void> {
    try {
      const template = this.getNotificationTemplate(alert.type, alert.severity);
      if (!template) {
        logger.warn(`No template found for alert type ${alert.type} with severity ${alert.severity}`);
        return;
      }

      const renderedMessage = this.renderTemplate(template, alert);
      const renderedTitle = this.renderTemplate(
        { ...template, message: template.title },
        alert
      ).message;

      // Send to each requested channel
      for (const channelId of channels) {
        const channel = this.notificationChannels[channelId];
        if (!channel || !channel.enabled) {
          logger.warn(`Channel ${channelId} not found or disabled`);
          continue;
        }

        try {
          await this.sendToChannel(channel, renderedTitle, renderedMessage, alert);
          logger.info(`Notification sent to ${channel.name} for alert ${alert.id}`);
        } catch (error) {
          logger.error(`Failed to send notification to ${channel.name}:`, error);
        }
      }

      // Record notification in database
      await this.recordNotification(alert, channels, renderedTitle, renderedMessage);
    } catch (error) {
      logger.error('Failed to send notification:', error);
      throw error;
    }
  }

  public async getActiveAlerts(): Promise<Alert[]> {
    try {
      const { data: alertsData, error } = await this.supabase
        .from('monitoring_alerts')
        .select('*')
        .eq('status', AlertStatus.ACTIVE)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch active alerts: ${error.message}`);
      }

      const alerts: Alert[] = (alertsData || []).map((alertData: any) => ({
        id: alertData.id,
        type: alertData.type,
        severity: alertData.severity,
        service: alertData.service,
        title: alertData.title,
        description: alertData.description,
        threshold: alertData.threshold,
        currentValue: alertData.current_value,
        status: alertData.status,
        createdAt: new Date(alertData.created_at),
        updatedAt: new Date(alertData.updated_at),
        resolvedAt: alertData.resolved_at ? new Date(alertData.resolved_at) : undefined,
        metadata: alertData.metadata || {}
      }));

      return alerts;
    } catch (error) {
      logger.error('Failed to get active alerts:', error);
      throw error;
    }
  }

  public async acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    try {
      const acknowledgedAt = new Date();

      // Update alert status
      const { error } = await this.supabase
        .from('monitoring_alerts')
        .update({
          status: AlertStatus.ACKNOWLEDGED,
          updated_at: acknowledgedAt.toISOString(),
          metadata: {
            acknowledged_by: userId,
            acknowledged_at: acknowledgedAt.toISOString()
          }
        })
        .eq('id', alertId);

      if (error) {
        throw new Error(`Failed to acknowledge alert: ${error.message}`);
      }

      // Update cache
      const cached = await this.redis.get(`alert:${alertId}`);
      if (cached) {
        const alert = JSON.parse(cached);
        alert.status = AlertStatus.ACKNOWLEDGED;
        alert.updatedAt = acknowledgedAt;
        alert.metadata = {
          ...alert.metadata,
          acknowledged_by: userId,
          acknowledged_at: acknowledgedAt.toISOString()
        };
        
        await this.redis.setex(
          `alert:${alertId}`,
          3600,
          JSON.stringify(alert)
        );
      }

      logger.info('Alert acknowledged:', { alertId, userId });
    } catch (error) {
      logger.error('Failed to acknowledge alert:', error);
      throw error;
    }
  }

  // Private Helper Methods
  private async processAlert(alertData: any): Promise<void> {
    try {
      const alert: Alert = {
        id: alertData.id,
        type: alertData.type,
        severity: alertData.severity,
        service: alertData.service,
        title: alertData.title,
        description: alertData.description,
        threshold: alertData.threshold,
        currentValue: alertData.current_value,
        status: alertData.status,
        createdAt: new Date(alertData.created_at),
        updatedAt: new Date(alertData.updated_at),
        resolvedAt: alertData.resolved_at ? new Date(alertData.resolved_at) : undefined,
        metadata: alertData.metadata || {}
      };

      // Check if we should send notification (e.g., not sent recently)
      const shouldNotify = await this.shouldSendNotification(alert);
      if (!shouldNotify) {
        return;
      }

      // Determine notification channels based on severity
      const channels = this.getNotificationChannels(alert.severity);
      
      if (channels.length > 0) {
        await this.sendNotification(alert, channels);
      }
    } catch (error) {
      logger.error('Failed to process alert:', error);
    }
  }

  private async shouldSendNotification(alert: Alert): Promise<boolean> {
    try {
      // Check if notification was sent recently (rate limiting)
      const lastNotificationKey = `notification:${alert.id}:last_sent`;
      const lastSent = await this.redis.get(lastNotificationKey);
      
      if (lastSent) {
        const lastSentTime = new Date(lastSent);
        const timeSinceLastNotification = Date.now() - lastSentTime.getTime();
        
        // Don't send notifications more than once every 5 minutes for the same alert
        if (timeSinceLastNotification < 5 * 60 * 1000) {
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Failed to check notification rate limit:', error);
      return false;
    }
  }

  private getNotificationChannels(severity: AlertSeverity): string[] {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return ['slack', 'discord', 'webhook'];
      case AlertSeverity.HIGH:
        return ['slack', 'discord'];
      case AlertSeverity.MEDIUM:
        return ['slack'];
      case AlertSeverity.LOW:
        return [];
      default:
        return [];
    }
  }

  private getNotificationTemplate(type: AlertType, severity: AlertSeverity): NotificationTemplate | null {
    const templateKey = `${type}_${severity}`;
    return this.notificationTemplates[templateKey] || null;
  }

  private renderTemplate(template: NotificationTemplate, alert: Alert): { title: string; message: string } {
    let renderedTitle = template.title;
    let renderedMessage = template.message;

    const variables = {
      service: alert.service,
      title: alert.title,
      description: alert.description,
      currentValue: alert.currentValue.toString(),
      threshold: alert.threshold.toString(),
      timestamp: alert.createdAt.toISOString(),
      severity: alert.severity,
      type: alert.type
    };

    // Replace template variables
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\{\{${key}\}\}`, 'g');
      renderedTitle = renderedTitle.replace(regex, value);
      renderedMessage = renderedMessage.replace(regex, value);
    }

    return {
      title: renderedTitle,
      message: renderedMessage
    };
  }

  private async sendToChannel(
    channel: NotificationChannel,
    title: string,
    message: string,
    alert: Alert
  ): Promise<void> {
    try {
      switch (channel.type) {
        case 'slack':
          await this.sendSlackNotification(channel, title, message, alert);
          break;
        case 'discord':
          await this.sendDiscordNotification(channel, title, message, alert);
          break;
        case 'webhook':
          await this.sendWebhookNotification(channel, title, message, alert);
          break;
        default:
          logger.warn(`Unsupported notification channel type: ${channel.type}`);
      }
    } catch (error) {
      logger.error(`Failed to send to ${channel.type} channel:`, error);
      throw error;
    }
  }

  private async sendSlackNotification(
    channel: NotificationChannel,
    title: string,
    message: string,
    alert: Alert
  ): Promise<void> {
    if (!channel.config.webhook_url) {
      throw new Error('Slack webhook URL not configured');
    }

    const color = this.getSeverityColor(alert.severity);
    
    const payload = {
      text: title,
      attachments: [
        {
          color,
          fields: [
            {
              title: 'Service',
              value: alert.service,
              short: true
            },
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Current Value',
              value: alert.currentValue.toString(),
              short: true
            },
            {
              title: 'Threshold',
              value: alert.threshold.toString(),
              short: true
            }
          ],
          text: message,
          ts: Math.floor(alert.createdAt.getTime() / 1000)
        }
      ]
    };

    await axios.post(channel.config.webhook_url, payload);
  }

  private async sendDiscordNotification(
    channel: NotificationChannel,
    title: string,
    message: string,
    alert: Alert
  ): Promise<void> {
    if (!channel.config.webhook_url) {
      throw new Error('Discord webhook URL not configured');
    }

    const color = this.getSeverityColorDecimal(alert.severity);
    
    const payload = {
      embeds: [
        {
          title,
          description: message,
          color,
          fields: [
            {
              name: 'Service',
              value: alert.service,
              inline: true
            },
            {
              name: 'Severity',
              value: alert.severity.toUpperCase(),
              inline: true
            },
            {
              name: 'Current Value',
              value: alert.currentValue.toString(),
              inline: true
            },
            {
              name: 'Threshold',
              value: alert.threshold.toString(),
              inline: true
            }
          ],
          timestamp: alert.createdAt.toISOString()
        }
      ]
    };

    await axios.post(channel.config.webhook_url, payload);
  }

  private async sendWebhookNotification(
    channel: NotificationChannel,
    title: string,
    message: string,
    alert: Alert
  ): Promise<void> {
    if (!channel.config.webhook_url) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      alert: {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        service: alert.service,
        title: alert.title,
        description: alert.description,
        threshold: alert.threshold,
        currentValue: alert.currentValue,
        status: alert.status,
        createdAt: alert.createdAt.toISOString()
      },
      notification: {
        title,
        message
      },
      timestamp: new Date().toISOString()
    };

    await axios.post(channel.config.webhook_url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GOMFLOW-Monitoring/1.0'
      }
    });
  }

  private async recordNotification(
    alert: Alert,
    channels: string[],
    title: string,
    message: string
  ): Promise<void> {
    try {
      // Record notification in database
      await this.supabase
        .from('monitoring_notifications')
        .insert({
          id: uuidv4(),
          alert_id: alert.id,
          channels: channels,
          title,
          message,
          sent_at: new Date().toISOString()
        });

      // Update rate limiting cache
      const lastNotificationKey = `notification:${alert.id}:last_sent`;
      await this.redis.setex(lastNotificationKey, 300, new Date().toISOString());

    } catch (error) {
      logger.error('Failed to record notification:', error);
    }
  }

  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return 'danger';
      case AlertSeverity.HIGH:
        return 'warning';
      case AlertSeverity.MEDIUM:
        return '#ffaa00';
      case AlertSeverity.LOW:
        return 'good';
      default:
        return '#cccccc';
    }
  }

  private getSeverityColorDecimal(severity: AlertSeverity): number {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return 0xff0000; // Red
      case AlertSeverity.HIGH:
        return 0xff8800; // Orange
      case AlertSeverity.MEDIUM:
        return 0xffaa00; // Yellow
      case AlertSeverity.LOW:
        return 0x00ff00; // Green
      default:
        return 0xcccccc; // Gray
    }
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public async shutdown(): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.quit();
      }
      logger.info('Alert service shut down successfully');
    } catch (error) {
      logger.error('Failed to shutdown alert service:', error);
    }
  }
}

export default AlertService;