/**
 * Mock Bot Service for Demo Environment
 * Simulates Telegram, Discord, and WhatsApp bot interactions without real API calls
 */

import { logger } from '@/utils/logger'

export interface MockBotMessage {
  id: string
  platform: 'telegram' | 'discord' | 'whatsapp'
  chat_id: string
  user_id: string
  username: string
  message: string
  timestamp: string
  message_type: 'command' | 'text' | 'photo' | 'document'
  attachments?: string[]
}

export interface MockBotResponse {
  success: boolean
  message_id: string
  delivery_status: 'sent' | 'delivered' | 'failed'
  timestamp: string
}

export class MockBotService {
  private static messageHistory: MockBotMessage[] = []
  private static activeUsers: Set<string> = new Set()

  /**
   * Mock Telegram bot message sending
   */
  static async sendTelegramMessage(
    chatId: string,
    message: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown'
      reply_markup?: any
      disable_notification?: boolean
    }
  ): Promise<MockBotResponse> {
    logger.info('🎭 Mock Telegram: Sending message', {
      chatId,
      messageLength: message.length,
      options
    })

    // Simulate network delay
    await this.delay(500)

    // Simulate delivery success/failure (95% success)
    const success = Math.random() > 0.05

    const response: MockBotResponse = {
      success,
      message_id: `tg_mock_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      delivery_status: success ? 'delivered' : 'failed',
      timestamp: new Date().toISOString()
    }

    if (success) {
      this.activeUsers.add(chatId)
      logger.info('🎭 Mock Telegram: Message delivered successfully', response)
    } else {
      logger.warn('🎭 Mock Telegram: Message delivery failed', response)
    }

    return response
  }

  /**
   * Mock Discord bot interaction
   */
  static async sendDiscordMessage(
    channelId: string,
    content: string,
    options?: {
      embeds?: any[]
      components?: any[]
      ephemeral?: boolean
    }
  ): Promise<MockBotResponse> {
    logger.info('🎭 Mock Discord: Sending message', {
      channelId,
      contentLength: content.length,
      hasEmbeds: !!options?.embeds?.length,
      hasComponents: !!options?.components?.length
    })

    await this.delay(300)

    const success = Math.random() > 0.03 // 97% success rate

    const response: MockBotResponse = {
      success,
      message_id: `dc_mock_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      delivery_status: success ? 'delivered' : 'failed',
      timestamp: new Date().toISOString()
    }

    if (success) {
      this.activeUsers.add(channelId)
      logger.info('🎭 Mock Discord: Message sent successfully', response)
    }

    return response
  }

  /**
   * Mock WhatsApp Business API message
   */
  static async sendWhatsAppMessage(
    phoneNumber: string,
    message: string,
    messageType: 'text' | 'image' | 'document' = 'text'
  ): Promise<MockBotResponse> {
    logger.info('🎭 Mock WhatsApp: Sending message', {
      phoneNumber,
      messageType,
      messageLength: message.length
    })

    await this.delay(800) // WhatsApp typically slower

    const success = Math.random() > 0.02 // 98% success rate

    const response: MockBotResponse = {
      success,
      message_id: `wa_mock_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      delivery_status: success ? 'delivered' : 'failed',
      timestamp: new Date().toISOString()
    }

    if (success) {
      this.activeUsers.add(phoneNumber)
    }

    return response
  }

  /**
   * Simulate incoming message from user (for testing)
   */
  static simulateIncomingMessage(
    platform: 'telegram' | 'discord' | 'whatsapp',
    userId: string,
    message: string,
    messageType: 'command' | 'text' | 'photo' | 'document' = 'text'
  ): MockBotMessage {
    const mockMessage: MockBotMessage = {
      id: `incoming_${platform}_${Date.now()}`,
      platform,
      chat_id: `chat_${userId}`,
      user_id: userId,
      username: `demo_user_${userId.slice(-4)}`,
      message,
      timestamp: new Date().toISOString(),
      message_type: messageType,
      attachments: messageType === 'photo' ? [`https://demo.gomflow.com/mock-images/${Date.now()}.jpg`] : undefined
    }

    this.messageHistory.push(mockMessage)
    logger.info('🎭 Mock Bot: Received incoming message', mockMessage)

    return mockMessage
  }

  /**
   * Mock command processing
   */
  static async processCommand(
    platform: 'telegram' | 'discord' | 'whatsapp',
    command: string,
    userId: string,
    params: string[] = []
  ): Promise<{
    response: string
    success: boolean
    followUpActions?: string[]
  }> {
    logger.info('🎭 Mock Bot: Processing command', { platform, command, userId, params })

    await this.delay(200)

    // Mock command responses
    const responses: Record<string, string> = {
      '/start': `🎉 Welcome to GOMFLOW Demo!\n\nThis is a demo environment where you can test all features without real transactions.\n\nAvailable commands:\n• /help - Show all commands\n• /orders - View demo orders\n• /create - Create demo order\n• /dashboard - View your dashboard\n• /payment - Simulate payment`,
      
      '/help': `🤖 GOMFLOW Bot Commands (Demo Mode)\n\n📋 Order Management:\n• /orders - List your orders\n• /create - Create new order\n• /order [id] - View specific order\n\n💰 Payments:\n• /payment [order_id] - Make payment\n• /status [payment_id] - Check payment status\n\n📊 Analytics:\n• /dashboard - View your stats\n• /analytics - Detailed analytics\n\n⚙️ Settings:\n• /settings - Bot preferences\n• /country [PH|MY] - Set country\n\n❓ Support:\n• /support - Get help\n• /demo - Demo features`,

      '/orders': `📋 Your Demo Orders\n\n1. 🎵 SEVENTEEN "God of Music" Album\n   Status: Active (24/30 filled)\n   Price: $18.00 | Deadline: Jan 30\n   /order_1 for details\n\n2. 🎨 BLACKPINK Limited Photobook\n   Status: Completed (50/50 filled)\n   Price: $35.00 | Shipped\n   /order_2 for details\n\n3. 🎪 STRAY KIDS Concert Goods\n   Status: Pending (8/20 filled)\n   Price: $45.00 | Deadline: Feb 5\n   /order_3 for details`,

      '/create': `✨ Create Demo Order\n\nChoose product type:\n1️⃣ K-pop Album ($15-25)\n2️⃣ Photobook ($30-50)\n3️⃣ Concert Goods ($40-80)\n4️⃣ Limited Edition ($60-150)\n\nReply with number to continue demo...`,

      '/dashboard': `📊 Your GOMFLOW Dashboard (Demo)\n\n📈 This Month:\n• Orders Created: 12\n• Total Revenue: $2,450\n• Success Rate: 94.2%\n• Active Orders: 5\n\n💰 Payment Stats:\n• GCash: 45% (Most popular)\n• FPX: 28%\n• PayMaya: 18%\n• Cards: 9%\n\n🔥 Top Performing:\n• SEVENTEEN albums: 156 orders\n• BLACKPINK photobooks: 89 orders\n• STRAY KIDS goods: 67 orders`,

      '/payment': `💳 Demo Payment Simulation\n\n🇵🇭 Philippines Options:\n• GCash - Instant (Demo)\n• PayMaya - Instant (Demo)\n• Credit Card - Instant (Demo)\n\n🇲🇾 Malaysia Options:\n• FPX - Bank transfer (Demo)\n• Touch 'n Go - eWallet (Demo)\n• Maybank2U - Online banking (Demo)\n\nSelect payment method to simulate transaction...`
    }

    const response = responses[command] || `❓ Unknown command: ${command}\n\nType /help to see available commands.`
    
    return {
      response,
      success: true,
      followUpActions: command === '/create' ? ['show_product_options'] : undefined
    }
  }

  /**
   * Mock bulk messaging
   */
  static async sendBulkMessages(
    platform: 'telegram' | 'discord' | 'whatsapp',
    recipients: string[],
    message: string,
    options?: any
  ): Promise<{
    total: number
    sent: number
    failed: number
    results: MockBotResponse[]
  }> {
    logger.info('🎭 Mock Bulk Messaging', {
      platform,
      recipientCount: recipients.length,
      messageLength: message.length
    })

    const results: MockBotResponse[] = []
    let sent = 0
    let failed = 0

    // Simulate sending to each recipient
    for (const recipient of recipients) {
      await this.delay(100) // Simulate rate limiting

      const success = Math.random() > 0.05 // 95% success rate
      
      const result: MockBotResponse = {
        success,
        message_id: `bulk_${platform}_${Date.now()}_${recipient}`,
        delivery_status: success ? 'delivered' : 'failed',
        timestamp: new Date().toISOString()
      }

      results.push(result)
      
      if (success) {
        sent++
      } else {
        failed++
      }
    }

    return {
      total: recipients.length,
      sent,
      failed,
      results
    }
  }

  /**
   * Get mock bot statistics
   */
  static getStatistics() {
    return {
      telegram: {
        active_chats: 245,
        messages_sent_today: 1834,
        success_rate: 96.8,
        most_used_commands: ['/orders', '/dashboard', '/help', '/payment']
      },
      discord: {
        active_servers: 12,
        active_channels: 45,
        messages_sent_today: 892,
        success_rate: 98.2,
        slash_commands_used: 156
      },
      whatsapp: {
        active_numbers: 189,
        messages_sent_today: 567,
        success_rate: 97.1,
        template_messages: 234
      },
      overall: {
        total_active_users: this.activeUsers.size,
        total_messages_today: 3293,
        average_response_time: '0.8 seconds',
        uptime: '99.9%'
      }
    }
  }

  /**
   * Get message history for testing
   */
  static getMessageHistory(limit: number = 50): MockBotMessage[] {
    return this.messageHistory.slice(-limit)
  }

  /**
   * Clear demo data
   */
  static clearDemoData(): void {
    this.messageHistory = []
    this.activeUsers.clear()
    logger.info('🎭 Mock Bot: Demo data cleared')
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export default MockBotService