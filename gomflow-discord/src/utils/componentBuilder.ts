import { 
  ActionRowBuilder, 
  ButtonBuilder, 
  StringSelectMenuBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import type { Order, Submission } from '@gomflow/shared';

export class ComponentBuilders {
  // Order list pagination buttons
  static orderListPagination(currentPage: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`order_list_page:${currentPage - 1}`)
          .setLabel('Previous')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('◀️')
          .setDisabled(currentPage <= 1),
        new ButtonBuilder()
          .setCustomId('order_list_refresh')
          .setLabel('Refresh')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId(`order_list_page:${currentPage + 1}`)
          .setLabel('Next')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('▶️')
          .setDisabled(currentPage >= totalPages),
      );
  }

  // Order detail action buttons
  static orderDetailActions(order: Order, isGOM: boolean): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();

    // Submit order button (for buyers)
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`submit_order:${order.id}`)
        .setLabel('Submit Order')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🛒')
        .setDisabled(order.status !== 'active')
    );

    // View submissions button
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`view_submissions:${order.id}`)
        .setLabel('View Submissions')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋')
    );

    // GOM-only buttons
    if (isGOM) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`manage_order:${order.id}`)
          .setLabel('Manage')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚙️'),
        new ButtonBuilder()
          .setCustomId(`export_order:${order.id}`)
          .setLabel('Export')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📥')
      );
    }

    return row;
  }

  // Payment confirmation buttons
  static paymentConfirmation(submissionId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm_payment:${submissionId}`)
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`reject_payment:${submissionId}`)
          .setLabel('Reject')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌'),
        new ButtonBuilder()
          .setCustomId(`request_info:${submissionId}`)
          .setLabel('Request Info')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❓')
      );
  }

  // Submission actions
  static submissionActions(submission: Submission): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`upload_payment:${submission.id}`)
          .setLabel('Upload Payment')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('💳')
          .setDisabled(submission.status !== 'pending_payment'),
        new ButtonBuilder()
          .setCustomId(`view_submission:${submission.id}`)
          .setLabel('View Details')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('👁️'),
        new ButtonBuilder()
          .setCustomId(`cancel_submission:${submission.id}`)
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️')
          .setDisabled(submission.status !== 'pending_payment')
      );
  }

  // Payment method selector
  static paymentMethodSelector(country: string, methods: string[]): ActionRowBuilder<StringSelectMenuBuilder> {
    const options = methods.map(method => ({
      label: this.getPaymentMethodLabel(method),
      value: method,
      description: this.getPaymentMethodDescription(method),
      emoji: this.getPaymentMethodEmoji(method),
    }));

    return new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_payment_method')
          .setPlaceholder('Select a payment method')
          .addOptions(options)
          .setMinValues(1)
          .setMaxValues(1)
      );
  }

  // Help navigation
  static helpNavigation(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('help_getting_started')
          .setLabel('Getting Started')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🚀'),
        new ButtonBuilder()
          .setCustomId('help_commands')
          .setLabel('Commands')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📜'),
        new ButtonBuilder()
          .setCustomId('help_gom_guide')
          .setLabel('GOM Guide')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('👨‍💼'),
        new ButtonBuilder()
          .setCustomId('help_faq')
          .setLabel('FAQ')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('❓')
      );
  }

  // Notification settings
  static notificationSettings(currentSettings: any): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];

    // Row 1: Order notifications
    rows.push(
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('toggle_order_notifications')
            .setLabel('Order Updates')
            .setStyle(currentSettings.orderNotifications ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji(currentSettings.orderNotifications ? '🔔' : '🔕'),
          new ButtonBuilder()
            .setCustomId('toggle_payment_reminders')
            .setLabel('Payment Reminders')
            .setStyle(currentSettings.paymentReminders ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji(currentSettings.paymentReminders ? '⏰' : '🔕'),
          new ButtonBuilder()
            .setCustomId('toggle_submission_confirmations')
            .setLabel('Submission Confirmations')
            .setStyle(currentSettings.submissionConfirmations ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji(currentSettings.submissionConfirmations ? '✅' : '🔕')
        )
    );

    // Row 2: Notification method
    rows.push(
      new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('notification_method_dm')
            .setLabel('Direct Message')
            .setStyle(currentSettings.method === 'dm' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setEmoji('💬'),
          new ButtonBuilder()
            .setCustomId('notification_method_channel')
            .setLabel('Channel')
            .setStyle(currentSettings.method === 'channel' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setEmoji('📢'),
          new ButtonBuilder()
            .setCustomId('notification_method_both')
            .setLabel('Both')
            .setStyle(currentSettings.method === 'both' ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setEmoji('📣')
        )
    );

    return rows;
  }

  // Utility methods
  private static getPaymentMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      gcash: 'GCash',
      paymaya: 'PayMaya',
      grabpay: 'GrabPay',
      bank_transfer: 'Bank Transfer',
      fpx: 'FPX Online Banking',
      tng: 'Touch \'n Go',
      boost: 'Boost',
      card: 'Credit/Debit Card',
    };
    return labels[method] || method;
  }

  private static getPaymentMethodDescription(method: string): string {
    const descriptions: Record<string, string> = {
      gcash: 'Pay using GCash mobile wallet',
      paymaya: 'Pay using PayMaya/Maya',
      grabpay: 'Pay using GrabPay wallet',
      bank_transfer: 'Direct bank transfer',
      fpx: 'Malaysian online banking',
      tng: 'Touch \'n Go eWallet',
      boost: 'Boost eWallet',
      card: 'Visa/Mastercard payment',
    };
    return descriptions[method] || 'Payment method';
  }

  private static getPaymentMethodEmoji(method: string): string {
    const emojis: Record<string, string> = {
      gcash: '📱',
      paymaya: '📲',
      grabpay: '🚗',
      bank_transfer: '🏦',
      fpx: '💳',
      tng: '👆',
      boost: '🚀',
      card: '💳',
    };
    return emojis[method] || '💰';
  }
}