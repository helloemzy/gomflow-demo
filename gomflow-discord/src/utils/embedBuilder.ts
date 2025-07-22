import { EmbedBuilder } from 'discord.js';
import type { Order, Submission } from '@gomflow/shared';
import { CURRENCY_SYMBOLS } from '@gomflow/shared';

export class EmbedBuilders {
  static readonly COLORS = {
    PRIMARY: 0x7c3aed, // Purple
    SUCCESS: 0x10b981, // Green
    WARNING: 0xf59e0b, // Amber
    ERROR: 0xef4444, // Red
    INFO: 0x3b82f6, // Blue
  };

  static orderList(orders: Order[], page: number, totalPages: number): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('📦 Active Group Orders')
      .setColor(this.COLORS.PRIMARY)
      .setFooter({ text: `Page ${page} of ${totalPages}` })
      .setTimestamp();

    if (orders.length === 0) {
      embed.setDescription('No active orders found. Create one with `/order create`!');
      return embed;
    }

    orders.forEach((order, index) => {
      const quotaPercentage = order.max_quantity 
        ? Math.round((order.current_quantity / order.max_quantity) * 100)
        : 0;
      
      const progressBar = this.createProgressBar(quotaPercentage);
      const currency = CURRENCY_SYMBOLS[order.currency] || order.currency;

      embed.addFields({
        name: `${index + 1}. ${order.title}`,
        value: [
          `💰 ${currency}${order.price_per_item}`,
          `📊 ${progressBar} ${quotaPercentage}%`,
          `⏰ Closes: ${new Date(order.deadline).toLocaleDateString()}`,
          `🔗 Slug: \`${order.slug}\``,
        ].join('\n'),
        inline: false,
      });
    });

    return embed;
  }

  static orderDetails(order: Order, submissions: Submission[]): EmbedBuilder {
    const currency = CURRENCY_SYMBOLS[order.currency] || order.currency;
    const quotaPercentage = order.max_quantity 
      ? Math.round((order.current_quantity / order.max_quantity) * 100)
      : 0;
    
    const progressBar = this.createProgressBar(quotaPercentage);

    const embed = new EmbedBuilder()
      .setTitle(`📦 ${order.title}`)
      .setColor(this.COLORS.PRIMARY)
      .setDescription(order.description || 'No description provided')
      .addFields([
        { 
          name: '💰 Price', 
          value: `${currency}${order.price_per_item}`, 
          inline: true 
        },
        { 
          name: '📊 Progress', 
          value: `${progressBar}\n${order.current_quantity}/${order.max_quantity || '∞'} (${quotaPercentage}%)`, 
          inline: true 
        },
        { 
          name: '⏰ Deadline', 
          value: new Date(order.deadline).toLocaleString(), 
          inline: true 
        },
        { 
          name: '📍 Country', 
          value: order.country.toUpperCase(), 
          inline: true 
        },
        { 
          name: '🏷️ Category', 
          value: order.category || 'General', 
          inline: true 
        },
        { 
          name: '👥 Submissions', 
          value: `${submissions.length} total`, 
          inline: true 
        },
      ])
      .setFooter({ text: `Order ID: ${order.id} | Slug: ${order.slug}` })
      .setTimestamp();

    if (order.image_url) {
      embed.setThumbnail(order.image_url);
    }

    return embed;
  }

  static submissionConfirmation(submission: Submission, order: Order): EmbedBuilder {
    const currency = CURRENCY_SYMBOLS[order.currency] || order.currency;
    const totalAmount = submission.quantity * order.price_per_item;

    return new EmbedBuilder()
      .setTitle('✅ Order Submitted Successfully!')
      .setColor(this.COLORS.SUCCESS)
      .setDescription(`Your submission for **${order.title}** has been recorded.`)
      .addFields([
        { 
          name: '📦 Order', 
          value: order.title, 
          inline: true 
        },
        { 
          name: '🔢 Quantity', 
          value: submission.quantity.toString(), 
          inline: true 
        },
        { 
          name: '💰 Total Amount', 
          value: `${currency}${totalAmount.toFixed(2)}`, 
          inline: true 
        },
        { 
          name: '📞 Contact', 
          value: submission.buyer_phone || submission.buyer_email || 'Not provided', 
          inline: true 
        },
        { 
          name: '💳 Payment Method', 
          value: submission.payment_method || 'To be selected', 
          inline: true 
        },
        { 
          name: '🆔 Reference', 
          value: `\`${submission.payment_reference}\``, 
          inline: false 
        },
      ])
      .setFooter({ text: `Submission ID: ${submission.id}` })
      .setTimestamp();
  }

  static paymentProcessing(attachmentName: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('🔄 Processing Payment Screenshot')
      .setColor(this.COLORS.INFO)
      .setDescription(
        `Your payment screenshot **${attachmentName}** is being processed.\n\n` +
        `This usually takes 10-30 seconds. You'll be notified once complete.`
      )
      .addFields([
        { 
          name: '🤖 AI Processing', 
          value: 'Extracting payment details...', 
          inline: true 
        },
        { 
          name: '🔍 Verification', 
          value: 'Matching with submissions...', 
          inline: true 
        },
      ])
      .setTimestamp();
  }

  static paymentResult(
    result: any,
    confidence: number,
    matched: boolean,
    submission?: Submission
  ): EmbedBuilder {
    const color = matched ? this.COLORS.SUCCESS : this.COLORS.WARNING;
    const title = matched ? '✅ Payment Verified!' : '⚠️ Payment Needs Review';

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .setTimestamp();

    if (matched && submission) {
      embed.setDescription(
        `Your payment has been automatically verified and matched to your submission.`
      );
      embed.addFields([
        { 
          name: '💰 Amount', 
          value: `${result.currency}${result.amount}`, 
          inline: true 
        },
        { 
          name: '📱 Sender', 
          value: result.senderName || result.senderPhone || 'Unknown', 
          inline: true 
        },
        { 
          name: '🎯 Confidence', 
          value: `${Math.round(confidence * 100)}%`, 
          inline: true 
        },
        { 
          name: '🆔 Submission', 
          value: `\`${submission.payment_reference}\``, 
          inline: false 
        },
      ]);
    } else {
      embed.setDescription(
        `We detected a payment but couldn't automatically match it to a submission. ` +
        `A GOM will review and confirm your payment soon.`
      );
      embed.addFields([
        { 
          name: '💰 Detected Amount', 
          value: result.amount ? `${result.currency}${result.amount}` : 'Not detected', 
          inline: true 
        },
        { 
          name: '📱 Detected Info', 
          value: result.senderName || result.senderPhone || 'Not detected', 
          inline: true 
        },
        { 
          name: '🎯 Confidence', 
          value: `${Math.round(confidence * 100)}%`, 
          inline: true 
        },
      ]);
    }

    return embed;
  }

  static error(message: string, details?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setColor(this.COLORS.ERROR)
      .setDescription(message)
      .setTimestamp();

    if (details) {
      embed.addFields({ name: 'Details', value: details, inline: false });
    }

    return embed;
  }

  static help(commandName?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('📚 GOMFLOW Help')
      .setColor(this.COLORS.INFO)
      .setTimestamp();

    if (!commandName) {
      embed.setDescription(
        'GOMFLOW helps you manage group orders efficiently. Here are the available commands:'
      );
      embed.addFields([
        { 
          name: '/order', 
          value: 'View, create, and manage group orders', 
          inline: false 
        },
        { 
          name: '/submit', 
          value: 'Submit your order for an active group order', 
          inline: false 
        },
        { 
          name: '/pay', 
          value: 'Upload payment screenshot for automatic processing', 
          inline: false 
        },
        { 
          name: '/status', 
          value: 'Check your submission and payment status', 
          inline: false 
        },
        { 
          name: '/manage', 
          value: 'GOM-only commands for order management', 
          inline: false 
        },
        { 
          name: '/notifications', 
          value: 'Configure your notification preferences', 
          inline: false 
        },
      ]);
      embed.setFooter({ text: 'Use /help <command> for detailed information' });
    } else {
      // Add command-specific help
      embed.setTitle(`📚 Help: /${commandName}`);
      // Command-specific help would be added here
    }

    return embed;
  }

  // Utility function to create progress bars
  private static createProgressBar(percentage: number, length: number = 10): string {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    
    const filledChar = '█';
    const emptyChar = '░';
    
    return filledChar.repeat(filled) + emptyChar.repeat(empty);
  }
}