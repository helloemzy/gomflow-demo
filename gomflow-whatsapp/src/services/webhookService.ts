import { Request } from 'express';
import axios from 'axios';
import { config } from '../config';
import { createServiceHeaders } from '@gomflow/shared';

export class WebhookService {
  /**
   * Process incoming WhatsApp message
   */
  async processIncomingMessage(body: any): Promise<void> {
    const { From, Body: messageBody, MessageSid } = body;
    const phoneNumber = From.replace('whatsapp:', '');
    
    console.log(`Incoming message from ${phoneNumber}: ${messageBody}`);
    
    // Auto-reply logic
    const reply = await this.generateAutoReply(phoneNumber, messageBody);
    if (reply) {
      // Send auto-reply through the API
      await this.sendAutoReply(phoneNumber, reply);
    }
    
    // Forward message to core API for logging
    await this.forwardToCoreAPI({
      phone: phoneNumber,
      message: messageBody,
      messageId: MessageSid,
      timestamp: new Date(),
    });
  }
  
  /**
   * Generate auto-reply based on message content
   */
  private async generateAutoReply(phoneNumber: string, message: string): Promise<string | null> {
    const lowerMessage = message.toLowerCase();
    
    // Check for common queries
    if (lowerMessage.includes('status') || lowerMessage.includes('track')) {
      // Query core API for order status
      const submissions = await this.getSubmissionsByPhone(phoneNumber);
      
      if (submissions.length > 0) {
        const latest = submissions[0];
        return `📦 Your latest order status:

Order: ${latest.order.title}
Amount: ${latest.currency}${latest.total_amount}
Status: ${latest.status === 'paid' ? '✅ Paid' : '⏰ Pending Payment'}
Reference: ${latest.payment_reference}

${latest.status === 'pending' && latest.payment_url ? `Pay here: ${latest.payment_url}` : ''}`;
      } else {
        return "I couldn't find any orders linked to this number. Please check with your GOM.";
      }
    }
    
    if (lowerMessage.includes('payment') || lowerMessage.includes('pay') || lowerMessage.includes('reference')) {
      const submissions = await this.getSubmissionsByPhone(phoneNumber);
      
      if (submissions.length > 0 && submissions[0].status === 'pending') {
        const latest = submissions[0];
        return `💳 Payment details for your order:

Reference: ${latest.payment_reference}
Amount: ${latest.currency}${latest.total_amount}

${latest.payment_url ? `Pay securely here: ${latest.payment_url}` : 'Please follow the payment instructions provided by your GOM.'}`;
      }
    }
    
    if (lowerMessage.includes('help') || lowerMessage === 'hi' || lowerMessage === 'hello') {
      return `👋 Welcome to GOMFLOW!

I can help you with:
• Type "status" to check your order status
• Type "payment" for payment details
• Type "track [reference]" to track a specific order

How can I assist you today?`;
    }
    
    return null;
  }
  
  /**
   * Get submissions by phone number from core API
   */
  private async getSubmissionsByPhone(phone: string): Promise<any[]> {
    try {
      const response = await axios.get(
        `${config.coreApi.url}/api/submissions/by-phone/${encodeURIComponent(phone)}`,
        {
          headers: createServiceHeaders(config.coreApi.secret),
        }
      );
      
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching submissions:', error);
      return [];
    }
  }
  
  /**
   * Send auto-reply through the messaging endpoint
   */
  private async sendAutoReply(phone: string, message: string): Promise<void> {
    try {
      await axios.post(
        `${config.coreApi.url}/api/whatsapp/send`,
        {
          to: phone,
          message,
          type: 'auto_reply',
        },
        {
          headers: createServiceHeaders(config.coreApi.secret),
        }
      );
    } catch (error) {
      console.error('Error sending auto-reply:', error);
    }
  }
  
  /**
   * Forward message data to core API for logging
   */
  private async forwardToCoreAPI(data: any): Promise<void> {
    try {
      await axios.post(
        `${config.coreApi.url}/api/messages/incoming`,
        {
          platform: 'whatsapp',
          ...data,
        },
        {
          headers: createServiceHeaders(config.coreApi.secret),
        }
      );
    } catch (error) {
      console.error('Error forwarding to core API:', error);
    }
  }
  
  /**
   * Validate webhook signature (Twilio security)
   */
  validateWebhookSignature(req: Request): boolean {
    const signature = req.headers['x-twilio-signature'] as string;
    const url = `https://${req.headers.host}${req.originalUrl}`;
    
    // For development/testing, skip validation
    if (config.env === 'development') {
      return true;
    }
    
    // TODO: Implement proper Twilio signature validation
    // const isValid = twilio.validateRequest(
    //   config.twilio.authToken,
    //   signature,
    //   url,
    //   req.body
    // );
    
    return true;
  }
}