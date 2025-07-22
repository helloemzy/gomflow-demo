import twilio from 'twilio';
import { config } from '../config';
import { Submission, Order, MESSAGE_TEMPLATES, formatCurrency, getTimeUntilDeadline, COUNTRY_CONFIGS } from '@gomflow/shared';

export class TwilioService {
  private client: twilio.Twilio;
  
  constructor() {
    this.client = twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  
  /**
   * Send a WhatsApp message
   */
  async sendMessage(to: string, body: string): Promise<any> {
    try {
      const message = await this.client.messages.create({
        from: config.twilio.whatsappNumber,
        to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
        body,
      });
      
      console.log(`Message sent successfully: ${message.sid}`);
      return { success: true, messageId: message.sid };
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Send order confirmation to buyer
   */
  async sendOrderConfirmation(submission: Submission & { order: Order }): Promise<any> {
    const country = submission.currency === 'PHP' ? 'PH' : 'MY';
    const template = MESSAGE_TEMPLATES[country].orderConfirmation;
    
    const message = template({
      title: submission.order.title,
      quantity: submission.quantity,
      total_amount: formatCurrency(submission.total_amount, submission.currency),
      payment_reference: submission.payment_reference,
      payment_url: submission.payment_url,
      payment_instructions: this.formatPaymentInstructions(submission.order.payment_methods),
      deadline: new Date(submission.order.deadline).toLocaleDateString(),
    });
    
    return await this.sendMessage(submission.buyer_phone, message);
  }
  
  /**
   * Send payment reminder
   */
  async sendPaymentReminder(submission: Submission & { order: Order }): Promise<any> {
    const country = submission.currency === 'PHP' ? 'PH' : 'MY';
    const template = MESSAGE_TEMPLATES[country].paymentReminder;
    
    const message = template({
      buyer_name: submission.buyer_name,
      title: submission.order.title,
      total_amount: formatCurrency(submission.total_amount, submission.currency),
      payment_reference: submission.payment_reference,
      time_left: getTimeUntilDeadline(submission.order.deadline),
      payment_url: submission.payment_url,
      payment_instructions: this.formatPaymentInstructions(submission.order.payment_methods),
    });
    
    return await this.sendMessage(submission.buyer_phone, message);
  }
  
  /**
   * Send payment confirmation
   */
  async sendPaymentConfirmation(submission: Submission & { order: Order }): Promise<any> {
    const country = submission.currency === 'PHP' ? 'PH' : 'MY';
    const template = MESSAGE_TEMPLATES[country].paymentConfirmed;
    
    const message = template({
      title: submission.order.title,
      quantity: submission.quantity,
      total_amount: formatCurrency(submission.total_amount, submission.currency),
    });
    
    return await this.sendMessage(submission.buyer_phone, message);
  }
  
  /**
   * Send notification to GOM
   */
  async notifyGOM(gomPhone: string, notification: string): Promise<any> {
    return await this.sendMessage(gomPhone, notification);
  }
  
  /**
   * Send bulk messages
   */
  async sendBulkMessages(recipients: Array<{ phone: string; message: string }>): Promise<any[]> {
    const results = await Promise.allSettled(
      recipients.map(({ phone, message }) => this.sendMessage(phone, message))
    );
    
    return results.map((result, index) => ({
      phone: recipients[index].phone,
      status: result.status,
      result: result.status === 'fulfilled' ? result.value : result.reason,
    }));
  }
  
  /**
   * Send order announcement to group
   */
  async postOrderToGroup(groupId: string, order: Order): Promise<any> {
    const message = this.formatOrderAnnouncement(order);
    return await this.sendMessage(groupId, message);
  }
  
  /**
   * Format payment instructions
   */
  private formatPaymentInstructions(paymentMethods: any[]): string {
    return paymentMethods
      .filter(pm => !pm.is_gateway)
      .map(pm => {
        let instruction = `${pm.type.toUpperCase()}: ${pm.number || ''}`;
        if (pm.name) instruction += ` (${pm.name})`;
        if (pm.instructions) instruction += `\n${pm.instructions}`;
        return instruction;
      })
      .join('\n\n');
  }
  
  /**
   * Format order announcement for groups
   */
  private formatOrderAnnouncement(order: Order): string {
    const currencyConfig = order.currency === 'PHP' ? COUNTRY_CONFIGS.PH : COUNTRY_CONFIGS.MY;
    
    return `🛒 NEW GROUP ORDER!

${order.title}
💰 ${currencyConfig.currencySymbol}${order.price} per item
📅 Deadline: ${new Date(order.deadline).toLocaleDateString()}

${order.description || ''}

🔗 Order here: ${config.coreApi.url}/u/${order.user?.username}/${order.slug}

React with 👍 if interested!`;
  }
}