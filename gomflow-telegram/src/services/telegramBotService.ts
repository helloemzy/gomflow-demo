import { Telegraf, session, Context } from 'telegraf'
import { message } from 'telegraf/filters'
import axios from 'axios'
import fs from 'fs/promises'
import path from 'path'
import FormData from 'form-data'
import { Config } from '@/config'
import { logger } from '@/utils/logger'
import { 
  TelegramContext, 
  TelegramSession, 
  TelegramUser,
  InlineKeyboard,
  PaymentScreenshotData,
  MessageJob
} from '@/types'

export class TelegramBotService {
  private bot: Telegraf<TelegramContext>
  private sessions: Map<string, TelegramSession> = new Map()
  private rateLimitMap: Map<number, { count: number; resetTime: number }> = new Map()

  constructor() {
    this.bot = new Telegraf<TelegramContext>(Config.TELEGRAM_BOT_TOKEN)
    this.setupMiddleware()
    this.setupCommands()
    this.setupHandlers()
  }

  /**
   * Setup bot middleware
   */
  private setupMiddleware(): void {
    // Session middleware
    this.bot.use(session({
      defaultSession: () => ({
        language: Config.bot.defaultLanguage,
        state: {},
        data: {}
      })
    }))

    // Rate limiting middleware
    this.bot.use(async (ctx, next) => {
      const userId = ctx.from?.id
      if (!userId) return next()

      const now = Date.now()
      const userLimit = this.rateLimitMap.get(userId)

      if (userLimit) {
        if (now < userLimit.resetTime) {
          if (userLimit.count >= Config.rateLimits.maxMessages) {
            logger.warn('Rate limit exceeded', {
              user_id: userId,
              chat_id: ctx.chat?.id,
              count: userLimit.count
            })
            await ctx.reply('⚠️ Too many messages. Please wait a moment before trying again.')
            return
          }
          userLimit.count++
        } else {
          userLimit.count = 1
          userLimit.resetTime = now + Config.rateLimits.windowMs
        }
      } else {
        this.rateLimitMap.set(userId, {
          count: 1,
          resetTime: now + Config.rateLimits.windowMs
        })
      }

      return next()
    })

    // User context middleware
    this.bot.use(async (ctx, next) => {
      if (ctx.from) {
        ctx.user = await this.getOrCreateUser(ctx.from)
      }
      return next()
    })

    // Logging middleware
    this.bot.use(async (ctx, next) => {
      const start = Date.now()
      
      logger.info('Telegram update received', {
        update_type: ctx.updateType,
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        username: ctx.from?.username,
        text: ctx.message && 'text' in ctx.message ? ctx.message.text?.substring(0, 100) : undefined
      })

      await next()

      const responseTime = Date.now() - start
      logger.debug('Telegram update processed', {
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        response_time_ms: responseTime
      })
    })
  }

  /**
   * Setup bot commands
   */
  private setupCommands(): void {
    // Start command
    this.bot.start(async (ctx) => {
      await this.handleStartCommand(ctx)
    })

    // Help command
    this.bot.help(async (ctx) => {
      await this.handleHelpCommand(ctx)
    })

    // Orders commands
    this.bot.command('orders', async (ctx) => {
      await this.handleOrdersCommand(ctx)
    })

    this.bot.command('create', async (ctx) => {
      await this.handleCreateOrderCommand(ctx)
    })

    this.bot.command('manage', async (ctx) => {
      await this.handleManageOrdersCommand(ctx)
    })

    // Submission commands
    this.bot.command('submit', async (ctx) => {
      await this.handleSubmitCommand(ctx)
    })

    this.bot.command('status', async (ctx) => {
      await this.handleStatusCommand(ctx)
    })

    // Payment commands
    this.bot.command('pay', async (ctx) => {
      await this.handlePayCommand(ctx)
    })

    this.bot.command('payments', async (ctx) => {
      await this.handlePaymentsCommand(ctx)
    })

    // Settings commands
    this.bot.command('settings', async (ctx) => {
      await this.handleSettingsCommand(ctx)
    })

    this.bot.command('language', async (ctx) => {
      await this.handleLanguageCommand(ctx)
    })

    // Cancel command
    this.bot.command('cancel', async (ctx) => {
      await this.handleCancelCommand(ctx)
    })
  }

  /**
   * Setup message and callback handlers
   */
  private setupHandlers(): void {
    // Handle photo uploads (payment screenshots)
    this.bot.on(message('photo'), async (ctx) => {
      await this.handlePhotoMessage(ctx)
    })

    // Handle document uploads
    this.bot.on(message('document'), async (ctx) => {
      await this.handleDocumentMessage(ctx)
    })

    // Handle callback queries (inline keyboard responses)
    this.bot.on('callback_query', async (ctx) => {
      await this.handleCallbackQuery(ctx)
    })

    // Handle text messages
    this.bot.on(message('text'), async (ctx) => {
      await this.handleTextMessage(ctx)
    })

    // Error handling
    this.bot.catch((err, ctx) => {
      logger.error('Telegram bot error', {
        error: err.message,
        stack: err.stack,
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        update_type: ctx.updateType
      })
    })
  }

  /**
   * Handle /start command
   */
  private async handleStartCommand(ctx: TelegramContext): Promise<void> {
    const isReturningUser = !!ctx.user
    
    const welcomeMessage = isReturningUser
      ? `Welcome back, ${ctx.from?.first_name}! 👋\n\nWhat would you like to do today?`
      : `Welcome to GOMFLOW! 🎉\n\nI'm your personal assistant for managing group orders. I can help you:\n\n🛒 Find and join group orders\n💰 Process payments with screenshots\n📱 Get order updates\n⚙️ Manage your orders (for GOMs)\n\nLet's get started!`

    const keyboard: InlineKeyboard[][] = [
      [
        { text: '🛒 Browse Orders', callback_data: 'browse_orders' },
        { text: '📝 Submit Order', callback_data: 'submit_order' }
      ],
      [
        { text: '💰 Check Payment', callback_data: 'check_payment' },
        { text: '📊 Order Status', callback_data: 'order_status' }
      ]
    ]

    if (ctx.user?.is_gom) {
      keyboard.push([
        { text: '⚙️ GOM Dashboard', callback_data: 'gom_dashboard' },
        { text: '➕ Create Order', callback_data: 'create_order' }
      ])
    }

    keyboard.push([
      { text: '❓ Help', callback_data: 'help' },
      { text: '⚙️ Settings', callback_data: 'settings' }
    ])

    await ctx.reply(welcomeMessage, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    })
  }

  /**
   * Handle photo messages (payment screenshots)
   */
  private async handlePhotoMessage(ctx: TelegramContext): Promise<void> {
    if (!Config.botFeatures.smartPaymentDetection) {
      await ctx.reply('Payment screenshot processing is currently disabled.')
      return
    }

    try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1] // Get highest resolution
      
      logger.info('Payment screenshot received', {
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id,
        file_id: photo.file_id,
        file_size: photo.file_size
      })

      // Check file size
      if (photo.file_size && photo.file_size > Config.fileSettings.maxSize) {
        await ctx.reply('❌ Image is too large. Please send a smaller image (max 20MB).')
        return
      }

      // Check if user is in payment upload flow
      let submissionId = null
      if (ctx.session.flow === 'payment_upload' && ctx.session.data?.submission_id) {
        submissionId = ctx.session.data.submission_id
        // Clear the flow
        ctx.session.flow = undefined
        ctx.session.data = {}
      }

      // Send processing message
      const processingMsg = await ctx.reply('🔍 Processing your payment screenshot...\n\nI\'m using AI to:\n• Extract payment details\n• Match with pending orders\n• Verify payment information\n\nThis may take a few seconds.')

      // Download and process the image
      await this.processPaymentScreenshot(ctx, photo.file_id, processingMsg.message_id, submissionId)

    } catch (error: any) {
      logger.error('Error processing payment screenshot', {
        error: error.message,
        user_id: ctx.from?.id,
        chat_id: ctx.chat?.id
      })
      
      await ctx.reply('❌ Sorry, I couldn\'t process your payment screenshot. Please try again or contact support.')
    }
  }

  /**
   * Process payment screenshot using Smart Agent
   */
  private async processPaymentScreenshot(
    ctx: TelegramContext, 
    fileId: string, 
    processingMessageId: number,
    targetSubmissionId?: string | null
  ): Promise<void> {
    try {
      // Download file from Telegram
      const fileData = await this.downloadTelegramFile(fileId)
      
      // Send to Smart Agent for processing
      const smartAgentResponse = await this.sendToSmartAgent(fileData, {
        platform: 'telegram',
        user_id: ctx.user?.gom_user_id,
        priority: 'normal',
        submission_id: targetSubmissionId
      })

      // Update processing message with results
      if (smartAgentResponse.success) {
        const result = smartAgentResponse.data
        
        if (result.best_match?.auto_approved) {
          // Payment was automatically approved
          await ctx.telegram.editMessageText(
            ctx.chat?.id,
            processingMessageId,
            undefined,
            `✅ *Payment Confirmed!*\n\n💰 Amount: ${result.best_match.amount} ${result.best_match.currency}\n🔢 Reference: ${result.best_match.payment_reference}\n👤 Buyer: ${result.best_match.buyer_name}\n\n🤖 Automatically verified with ${Math.round(result.best_match.confidence * 100)}% confidence.\n\nThe GOM has been notified!`,
            { parse_mode: 'Markdown' }
          )
        } else if (result.matches && result.matches.length > 0) {
          // Manual review required
          const keyboard: InlineKeyboard[][] = result.matches.slice(0, 3).map(match => [
            { 
              text: `✅ ${match.buyer_name} - ${match.amount} ${match.currency}`, 
              callback_data: `confirm_payment:${match.submission_id}:${result.extraction.id}` 
            }
          ])
          
          keyboard.push([{ text: '❌ None of these', callback_data: `reject_payment:${result.extraction.id}` }])

          await ctx.telegram.editMessageText(
            ctx.chat?.id,
            processingMessageId,
            undefined,
            `🔍 *Payment Screenshot Analyzed*\n\nI found ${result.matches.length} possible matches. Please confirm which one is correct:\n\n${result.matches.slice(0, 3).map((match, i) => 
              `${i + 1}. **${match.buyer_name}**\n   💰 ${match.amount} ${match.currency}\n   🔢 ${match.payment_reference}\n   🎯 ${Math.round(match.confidence * 100)}% match\n`
            ).join('\n')}`,
            {
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: keyboard }
            }
          )
        } else {
          // No matches found
          await ctx.telegram.editMessageText(
            ctx.chat?.id,
            processingMessageId,
            undefined,
            `⚠️ *Payment Screenshot Processed*\n\nI couldn't find any matching orders for this payment.\n\n🔍 Detected:\n${result.extraction.payments_found > 0 ? 
              `• Amount: ${result.extraction.extractedPayments?.[0]?.amount || 'Unknown'}\n• Method: ${result.extraction.extractedPayments?.[0]?.method || 'Unknown'}` : 
              '• No clear payment information found'}\n\nPlease check:\n• Payment reference matches your order\n• Amount is correct\n• Order is still active\n\nContact the GOM if you need help.`,
            { parse_mode: 'Markdown' }
          )
        }
      } else {
        throw new Error(smartAgentResponse.error || 'Smart Agent processing failed')
      }

    } catch (error: any) {
      logger.error('Payment screenshot processing failed', {
        error: error.message,
        file_id: fileId,
        user_id: ctx.from?.id
      })

      await ctx.telegram.editMessageText(
        ctx.chat?.id,
        processingMessageId,
        undefined,
        '❌ Sorry, I couldn\'t process your payment screenshot. Please try again later or contact support.'
      )
    }
  }

  /**
   * Download file from Telegram servers
   */
  private async downloadTelegramFile(fileId: string): Promise<Buffer> {
    try {
      const fileInfo = await this.bot.telegram.getFile(fileId)
      const fileUrl = `https://api.telegram.org/file/bot${Config.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`
      
      const response = await axios.get(fileUrl, { responseType: 'arraybuffer' })
      return Buffer.from(response.data)

    } catch (error: any) {
      logger.error('Failed to download Telegram file', {
        file_id: fileId,
        error: error.message
      })
      throw new Error('Failed to download file from Telegram')
    }
  }

  /**
   * Send image to Smart Agent for processing
   */
  private async sendToSmartAgent(imageBuffer: Buffer, context: any): Promise<any> {
    try {
      const formData = new FormData()
      formData.append('image', imageBuffer, {
        filename: 'payment_screenshot.jpg',
        contentType: 'image/jpeg'
      })
      formData.append('platform', context.platform)
      if (context.user_id) formData.append('user_id', context.user_id)
      if (context.priority) formData.append('priority', context.priority)

      const response = await axios.post(
        `${Config.SMART_AGENT_SERVICE_URL}/api/process`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'x-service-secret': Config.SERVICE_SECRET
          },
          timeout: 60000 // 60 seconds for AI processing
        }
      )

      return response.data

    } catch (error: any) {
      logger.error('Smart Agent request failed', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      })
      throw error
    }
  }

  /**
   * Handle callback queries (inline keyboard interactions)
   */
  private async handleCallbackQuery(ctx: TelegramContext): Promise<void> {
    const data = ctx.callbackQuery?.data
    if (!data) return

    try {
      await ctx.answerCbQuery()

      const [action, ...params] = data.split(':')

      switch (action) {
        case 'browse_orders':
          await this.handleBrowseOrders(ctx)
          break
        case 'submit_order':
          await this.handleSubmitOrderFlow(ctx, params[0])
          break
        case 'check_payment':
          await this.handleCheckPayment(ctx)
          break
        case 'confirm_payment':
          await this.handleConfirmPayment(ctx, params[0], params[1])
          break
        case 'reject_payment':
          await this.handleRejectPayment(ctx, params[0])
          break
        case 'gom_dashboard':
          await this.handleGOMDashboard(ctx)
          break
        case 'confirm_submission':
          await this.confirmSubmission(ctx)
          break
        case 'cancel_submission':
          await this.cancelSubmission(ctx)
          break
        case 'upload_payment':
          await this.initiatePaymentUpload(ctx, params[0])
          break
        case 'check_status':
          await this.checkSubmissionStatus(ctx, params[0])
          break
        case 'confirm_order_creation':
          await this.confirmOrderCreation(ctx)
          break
        case 'cancel_order_creation':
          await this.cancelOrderCreation(ctx)
          break
        case 'create_new_order':
          await this.handleCreateOrderCommand(ctx)
          break
        case 'view_order':
          await this.viewOrderDetails(ctx, params[0])
          break
        case 'share_order':
          await this.shareOrder(ctx, params[0])
          break
        case 'close_order':
          await this.closeOrder(ctx, params[0])
          break
        case 'set_language':
          await this.setLanguage(ctx, params[0])
          break
        default:
          await ctx.reply('Sorry, I don\'t understand that action.')
      }

    } catch (error: any) {
      logger.error('Callback query error', {
        error: error.message,
        callback_data: data,
        user_id: ctx.from?.id
      })
      await ctx.reply('❌ Something went wrong. Please try again.')
    }
  }

  /**
   * Additional handler methods would continue here...
   * For brevity, I'm including key methods but the full implementation 
   * would include all the handlers referenced above
   */
  
  private async handleHelpCommand(ctx: TelegramContext): Promise<void> {
    const helpText = `🤖 *GOMFLOW Bot Help*\n\n*For Buyers:*\n/orders - Browse available group orders\n/submit - Submit an order\n/status - Check your order status\n/pay - Make a payment\n\n*For GOMs:*\n/create - Create a new group order\n/manage - Manage your orders\n/payments - Check payment status\n\n*General:*\n/settings - Change bot settings\n/language - Change language\n/cancel - Cancel current operation\n\n💡 *Pro tip:* Send me a payment screenshot and I'll automatically process it using AI!`
    
    await ctx.reply(helpText, { parse_mode: 'Markdown' })
  }

  private async handleOrdersCommand(ctx: TelegramContext): Promise<void> {
    // Fetch active orders from Core API
    try {
      const response = await axios.get(`${Config.CORE_API_URL}/api/orders?active_only=true`, {
        headers: { 'x-service-secret': Config.SERVICE_SECRET }
      })

      const orders = response.data.data.orders || []
      
      if (orders.length === 0) {
        await ctx.reply('📭 No active orders found at the moment. Check back later!')
        return
      }

      let message = '🛒 *Active Group Orders*\n\n'
      const keyboard: InlineKeyboard[][] = []

      orders.slice(0, 10).forEach((order: any, index: number) => {
        message += `${index + 1}. **${order.title}**\n`
        message += `   💰 ${order.price} ${order.currency}\n`
        message += `   ⏰ Ends: ${new Date(order.deadline).toLocaleDateString()}\n`
        message += `   📊 ${order.total_submissions || 0}/${order.max_orders || '∞'} orders\n\n`

        keyboard.push([
          { 
            text: `📝 Submit - ${order.title.substring(0, 20)}${order.title.length > 20 ? '...' : ''}`, 
            callback_data: `submit_order:${order.id}` 
          }
        ])
      })

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      })

    } catch (error: any) {
      logger.error('Failed to fetch orders', { error: error.message })
      await ctx.reply('❌ Sorry, I couldn\'t fetch the current orders. Please try again later.')
    }
  }

  /**
   * Get or create user in database
   */
  private async getOrCreateUser(telegramUser: any): Promise<TelegramUser> {
    // This would integrate with the database service
    // For now, return a basic user object
    return {
      id: `tg_${telegramUser.id}`,
      telegram_id: telegramUser.id,
      username: telegramUser.username,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      language_code: telegramUser.language_code,
      is_gom: false, // Would be determined from database
      created_at: new Date(),
      updated_at: new Date(),
      last_active: new Date()
    }
  }

  // Placeholder methods for other handlers
  /**
   * Handle /create command - Create new group order (GOM only)
   */
  private async handleCreateOrderCommand(ctx: TelegramContext): Promise<void> {
    try {
      // Check if user is a GOM
      if (!ctx.user?.is_gom) {
        await ctx.reply(
          '⚠️ This command is only available for Group Order Managers.\n\n' +
          'To become a GOM and start managing group orders, please visit our website.'
        )
        return
      }

      // Start order creation flow
      ctx.session.flow = 'order_creation'
      ctx.session.data = {
        step: 'title',
        currency: 'PHP' // Default currency based on user's country
      }

      let message = '📦 **Create New Group Order**\n\n'
      message += 'Let\'s set up your new group order. You can cancel anytime with /cancel.\n\n'
      message += '**Step 1/6: Order Title**\n'
      message += 'What are you selling? (e.g., "SEVENTEEN Face the Sun Album")'

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Cancel', callback_data: 'cancel_order_creation' }
          ]]
        }
      })

    } catch (error: any) {
      logger.error('Create order command error', {
        error: error.message,
        user_id: ctx.from?.id
      })
      await ctx.reply('❌ Unable to start order creation. Please try again.')
    }
  }

  /**
   * Handle /manage command - Manage existing orders (GOM only)
   */
  private async handleManageOrdersCommand(ctx: TelegramContext): Promise<void> {
    try {
      // Check if user is a GOM
      if (!ctx.user?.is_gom) {
        await ctx.reply(
          '⚠️ This command is only available for Group Order Managers.\n\n' +
          'To become a GOM and start managing group orders, please visit our website.'
        )
        return
      }

      // Fetch GOM's orders
      const response = await axios.get(
        `${Config.CORE_API_URL}/api/orders?user_id=${ctx.user.id}`,
        { headers: { 'x-service-secret': Config.SERVICE_SECRET } }
      )

      if (!response.data.success || !response.data.data.orders.length === 0) {
        await ctx.reply(
          '📭 You don\'t have any orders yet.\n\n' +
          'Use /create to start your first group order!'
        )
        return
      }

      const orders = response.data.data.orders
      let message = '📋 **Your Group Orders**\n\n'
      const keyboard: InlineKeyboard[][] = []

      orders.forEach((order: any, index: number) => {
        const statusEmoji = order.is_active ? '🟢' : '🔴'
        const deadline = new Date(order.deadline)
        const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        
        message += `${index + 1}. ${statusEmoji} **${order.title}**\n`
        message += `   📊 ${order.total_submissions || 0}/${order.max_orders || '∞'} orders\n`
        message += `   💰 ${order.total_revenue || 0} ${order.currency} collected\n`
        message += `   ⏰ ${daysLeft > 0 ? `${daysLeft} days left` : 'Ended'}\n\n`

        // Add management buttons
        keyboard.push([
          {
            text: `📊 View ${order.title.substring(0, 15)}...`,
            callback_data: `view_order:${order.id}`
          }
        ])
        
        if (order.is_active) {
          keyboard.push([
            {
              text: `📤 Share ${order.title.substring(0, 15)}...`,
              callback_data: `share_order:${order.id}`
            },
            {
              text: `🔴 Close ${order.title.substring(0, 15)}...`,
              callback_data: `close_order:${order.id}`
            }
          ])
        }
      })

      keyboard.push([
        { text: '➕ Create New Order', callback_data: 'create_new_order' },
        { text: '📊 Analytics', callback_data: 'gom_analytics' }
      ])

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      })

    } catch (error: any) {
      logger.error('Manage orders command error', {
        error: error.message,
        user_id: ctx.from?.id
      })
      await ctx.reply('❌ Unable to fetch your orders. Please try again.')
    }
  }
  /**
   * Handle /submit command - Start order submission process
   */
  private async handleSubmitCommand(ctx: TelegramContext): Promise<void> {
    try {
      // Check if an order ID was provided
      const commandText = ctx.message && 'text' in ctx.message ? ctx.message.text : ''
      const parts = commandText.split(' ')
      const orderId = parts[1]

      if (!orderId) {
        // Show active orders for selection
        await this.showOrderSelectionForSubmission(ctx)
        return
      }

      // Verify order exists and is active
      try {
        const response = await axios.get(`${Config.CORE_API_URL}/api/orders/${orderId}`, {
          headers: { 'x-service-secret': Config.SERVICE_SECRET }
        })

        if (!response.data.success) {
          await ctx.reply('❌ Order not found. Please check the order ID and try again.')
          return
        }

        const order = response.data.data
        
        // Check if order is still accepting submissions
        if (!order.is_active) {
          await ctx.reply('❌ This order is no longer accepting submissions.')
          return
        }

        const deadline = new Date(order.deadline)
        if (deadline < new Date()) {
          await ctx.reply('❌ This order has passed its deadline.')
          return
        }

        // Check for existing submission
        const submissionsResponse = await axios.get(
          `${Config.CORE_API_URL}/api/submissions?order_id=${orderId}&user_identifier=tg_${ctx.from?.id}`,
          { headers: { 'x-service-secret': Config.SERVICE_SECRET } }
        )

        if (submissionsResponse.data.success && submissionsResponse.data.data.length > 0) {
          const existingSubmission = submissionsResponse.data.data[0]
          await this.showExistingSubmission(ctx, existingSubmission, order)
          return
        }

        // Start submission flow
        await this.startSubmissionFlow(ctx, order)

      } catch (error: any) {
        logger.error('Failed to fetch order for submission', { 
          error: error.message,
          order_id: orderId,
          user_id: ctx.from?.id 
        })
        await ctx.reply('❌ Unable to process submission. Please try again later.')
      }

    } catch (error: any) {
      logger.error('Submit command error', {
        error: error.message,
        user_id: ctx.from?.id
      })
      await ctx.reply('❌ An error occurred. Please try again.')
    }
  }

  /**
   * Show order selection for submission
   */
  private async showOrderSelectionForSubmission(ctx: TelegramContext): Promise<void> {
    try {
      const response = await axios.get(`${Config.CORE_API_URL}/api/orders?active_only=true`, {
        headers: { 'x-service-secret': Config.SERVICE_SECRET }
      })

      const orders = response.data.data.orders || []
      
      if (orders.length === 0) {
        await ctx.reply('📭 No active orders available for submission at the moment.')
        return
      }

      let message = '📝 **Select an Order to Submit**\n\n'
      const keyboard: InlineKeyboard[][] = []

      orders.slice(0, 10).forEach((order: any, index: number) => {
        const deadline = new Date(order.deadline)
        message += `${index + 1}. **${order.title}**\n`
        message += `   💰 ${order.price} ${order.currency}\n`
        message += `   ⏰ Deadline: ${deadline.toLocaleDateString()}\n`
        message += `   📊 ${order.current_orders || 0}/${order.min_orders} orders\n\n`

        keyboard.push([{
          text: `📝 ${order.title.substring(0, 30)}${order.title.length > 30 ? '...' : ''}`,
          callback_data: `submit_order:${order.id}`
        }])
      })

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      })

    } catch (error: any) {
      logger.error('Failed to show order selection', { error: error.message })
      await ctx.reply('❌ Unable to fetch available orders. Please try again later.')
    }
  }

  /**
   * Show existing submission details
   */
  private async showExistingSubmission(ctx: TelegramContext, submission: any, order: any): Promise<void> {
    const statusEmoji = {
      pending: '⏳',
      confirmed: '✅',
      rejected: '❌',
      cancelled: '🚫'
    }[submission.status] || '❓'

    let message = `${statusEmoji} **Existing Submission Found**\n\n`
    message += `📦 **Order**: ${order.title}\n`
    message += `👤 **Name**: ${submission.buyer_name}\n`
    message += `📱 **Phone**: ${submission.buyer_phone}\n`
    message += `🔢 **Quantity**: ${submission.quantity}\n`
    message += `💰 **Amount**: ${submission.amount} ${submission.currency}\n`
    message += `🏷️ **Payment Ref**: \`${submission.payment_reference}\`\n`
    message += `📅 **Submitted**: ${new Date(submission.created_at).toLocaleDateString()}\n`
    message += `📊 **Status**: ${submission.status.toUpperCase()}\n`

    const keyboard: InlineKeyboard[][] = []

    if (submission.status === 'pending') {
      keyboard.push([
        { text: '💳 Upload Payment', callback_data: `upload_payment:${submission.id}` },
        { text: '📊 Check Status', callback_data: `check_status:${submission.id}` }
      ])
    }

    keyboard.push([
      { text: '🔙 Back to Orders', callback_data: 'browse_orders' }
    ])

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    })
  }

  /**
   * Start submission flow for an order
   */
  private async startSubmissionFlow(ctx: TelegramContext, order: any): Promise<void> {
    // Store order in session
    ctx.session.flow = 'submission'
    ctx.session.data = {
      order_id: order.id,
      order_title: order.title,
      order_price: order.price,
      order_currency: order.currency,
      step: 'name'
    }

    let message = `📝 **Submit Order: ${order.title}**\n\n`
    message += `💰 Price: ${order.price} ${order.currency}\n`
    message += `⏰ Deadline: ${new Date(order.deadline).toLocaleDateString()}\n\n`
    message += `Let's collect your information. You can type /cancel at any time to stop.\n\n`
    message += `**Step 1/5: Your Name**\n`
    message += `Please enter your full name:`

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '❌ Cancel', callback_data: 'cancel_submission' }
        ]]
      }
    })
  }
  /**
   * Handle /status command - Check order status
   */
  private async handleStatusCommand(ctx: TelegramContext): Promise<void> {
    try {
      // Get user's submissions
      const response = await axios.get(
        `${Config.CORE_API_URL}/api/submissions?user_identifier=tg_${ctx.from?.id}&limit=10`,
        { headers: { 'x-service-secret': Config.SERVICE_SECRET } }
      )

      if (!response.data.success || !response.data.data || response.data.data.length === 0) {
        await ctx.reply(
          '📭 You don\'t have any orders yet.\n\n' +
          'Use /orders to browse available group orders\n' +
          'Use /submit to create your first order!'
        )
        return
      }

      const submissions = response.data.data
      
      let message = '📋 **Your Order Status**\n\n'
      const keyboard: InlineKeyboard[][] = []

      submissions.forEach((submission: any, index: number) => {
        const statusEmoji = {
          pending: '⏳',
          confirmed: '✅',
          rejected: '❌',
          cancelled: '🚫'
        }[submission.status] || '❓'

        message += `${index + 1}. ${statusEmoji} **${submission.order?.title || 'Order'}**\n`
        message += `   💰 ${submission.amount} ${submission.currency}\n`
        message += `   📊 Status: ${submission.status.toUpperCase()}\n`
        message += `   📅 ${new Date(submission.created_at).toLocaleDateString()}\n\n`

        // Add action buttons based on status
        if (submission.status === 'pending') {
          keyboard.push([
            { 
              text: `💳 Pay - ${submission.order?.title?.substring(0, 20)}...`, 
              callback_data: `upload_payment:${submission.id}` 
            }
          ])
        }
        
        keyboard.push([
          { 
            text: `📊 Details - ${submission.order?.title?.substring(0, 20)}...`, 
            callback_data: `check_status:${submission.id}` 
          }
        ])
      })

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      })

    } catch (error: any) {
      logger.error('Status command error', {
        error: error.message,
        user_id: ctx.from?.id
      })
      await ctx.reply('❌ Unable to fetch your order status. Please try again.')
    }
  }
  /**
   * Handle /pay command - Payment upload flow
   */
  private async handlePayCommand(ctx: TelegramContext): Promise<void> {
    try {
      // Get user's pending submissions
      const response = await axios.get(
        `${Config.CORE_API_URL}/api/submissions?user_identifier=tg_${ctx.from?.id}&status=pending`,
        { headers: { 'x-service-secret': Config.SERVICE_SECRET } }
      )

      if (!response.data.success || !response.data.data || response.data.data.length === 0) {
        await ctx.reply(
          '📭 You don\'t have any pending payments.\n\n' +
          'Use /submit to create a new order first!'
        )
        return
      }

      const pendingSubmissions = response.data.data

      if (pendingSubmissions.length === 1) {
        // Single submission - directly initiate upload
        const submission = pendingSubmissions[0]
        ctx.session.flow = 'payment_upload'
        ctx.session.data = { submission_id: submission.id }

        let message = `📸 **Upload Payment for:**\n`
        message += `📦 ${submission.order?.title || 'Order'}\n`
        message += `💰 Amount: ${submission.amount} ${submission.currency}\n`
        message += `🏷️ Reference: \`${submission.payment_reference}\`\n\n`
        message += `Please send a clear screenshot of your payment. I'll process it automatically!`

        await ctx.reply(message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '❌ Cancel', callback_data: 'cancel_payment_upload' }
            ]]
          }
        })
      } else {
        // Multiple submissions - show selection
        let message = '💳 **Select Order to Pay**\n\n'
        const keyboard: InlineKeyboard[][] = []

        pendingSubmissions.slice(0, 10).forEach((submission: any, index: number) => {
          message += `${index + 1}. **${submission.order?.title || 'Order'}**\n`
          message += `   💰 ${submission.amount} ${submission.currency}\n`
          message += `   🏷️ Ref: \`${submission.payment_reference}\`\n\n`

          keyboard.push([{
            text: `💳 Pay ${submission.amount} ${submission.currency}`,
            callback_data: `upload_payment:${submission.id}`
          }])
        })

        await ctx.reply(message, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard }
        })
      }

    } catch (error: any) {
      logger.error('Pay command error', {
        error: error.message,
        user_id: ctx.from?.id
      })
      await ctx.reply('❌ Unable to fetch your pending payments. Please try again.')
    }
  }
  /**
   * Handle /payments command - View payment status for orders (GOM only)
   */
  private async handlePaymentsCommand(ctx: TelegramContext): Promise<void> {
    try {
      // Check if user is a GOM
      if (!ctx.user?.is_gom) {
        await ctx.reply(
          '⚠️ This command is only available for Group Order Managers.\n\n' +
          'To become a GOM and start managing group orders, please visit our website.'
        )
        return
      }

      // Fetch GOM's active orders with payment stats
      const response = await axios.get(
        `${Config.CORE_API_URL}/api/orders?user_id=${ctx.user.id}&active_only=true`,
        { headers: { 'x-service-secret': Config.SERVICE_SECRET } }
      )

      if (!response.data.success || response.data.data.orders.length === 0) {
        await ctx.reply('📭 No active orders with pending payments.')
        return
      }

      const orders = response.data.data.orders
      let message = '💳 **Payment Overview**\n\n'
      const keyboard: InlineKeyboard[][] = []

      for (const order of orders) {
        // Get payment stats for each order
        const statsResponse = await axios.get(
          `${Config.CORE_API_URL}/api/orders/${order.id}/payments`,
          { headers: { 'x-service-secret': Config.SERVICE_SECRET } }
        )

        if (statsResponse.data.success) {
          const stats = statsResponse.data.data
          const pendingCount = stats.pending || 0
          const confirmedCount = stats.confirmed || 0
          const totalCount = stats.total || 0

          if (totalCount > 0) {
            message += `📦 **${order.title}**\n`
            message += `   ✅ Confirmed: ${confirmedCount}/${totalCount}\n`
            message += `   ⏳ Pending: ${pendingCount}\n`
            message += `   💰 Collected: ${stats.collected_amount || 0} ${order.currency}\n\n`

            if (pendingCount > 0) {
              keyboard.push([{
                text: `🔍 Review ${order.title.substring(0, 20)}...`,
                callback_data: `review_payments:${order.id}`
              }])
            }
          }
        }
      }

      if (keyboard.length === 0) {
        message += '✅ All payments are up to date!'
      } else {
        keyboard.push([
          { text: '📊 Full Analytics', callback_data: 'gom_analytics' },
          { text: '📤 Export Data', callback_data: 'export_payments' }
        ])
      }

      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      })

    } catch (error: any) {
      logger.error('Payments command error', {
        error: error.message,
        user_id: ctx.from?.id
      })
      await ctx.reply('❌ Unable to fetch payment information. Please try again.')
    }
  }
  /**
   * Show order creation confirmation
   */
  private async showOrderCreationConfirmation(ctx: TelegramContext, sessionData: any): Promise<void> {
    let confirmMessage = `📋 **Order Creation Summary**\n\n`
    confirmMessage += `📦 **Title**: ${sessionData.title}\n`
    if (sessionData.description) {
      confirmMessage += `📝 **Description**: ${sessionData.description}\n`
    }
    confirmMessage += `💰 **Price**: ${sessionData.price} ${sessionData.currency}\n`
    confirmMessage += `⏰ **Deadline**: ${new Date(sessionData.deadline).toLocaleDateString()}\n`
    confirmMessage += `📊 **Min Orders**: ${sessionData.min_orders}\n`
    confirmMessage += `📊 **Max Orders**: ${sessionData.max_orders || 'Unlimited'}\n\n`
    confirmMessage += `Create this order?`

    await ctx.reply(confirmMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Create Order', callback_data: 'confirm_order_creation' },
          { text: '❌ Cancel', callback_data: 'cancel_order_creation' }
        ]]
      }
    })
  }

  /**
   * Handle /settings command - Bot settings
   */
  private async handleSettingsCommand(ctx: TelegramContext): Promise<void> {
    const settings = {
      language: ctx.session.language || 'en',
      notifications: true, // Would be fetched from user preferences
      timezone: ctx.user?.timezone || 'UTC'
    }

    let message = '⚙️ **Bot Settings**\n\n'
    message += `🌐 **Language**: ${settings.language.toUpperCase()}\n`
    message += `🔔 **Notifications**: ${settings.notifications ? 'Enabled' : 'Disabled'}\n`
    message += `🕐 **Timezone**: ${settings.timezone}\n`

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 Change Language', callback_data: 'change_language' }],
          [{ text: '🔔 Toggle Notifications', callback_data: 'toggle_notifications' }],
          [{ text: '🕐 Change Timezone', callback_data: 'change_timezone' }]
        ]
      }
    })
  }

  /**
   * Handle /language command - Language selection
   */
  private async handleLanguageCommand(ctx: TelegramContext): Promise<void> {
    const message = '🌐 **Select Your Language**\n\nChoose your preferred language for bot interactions:'

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🇺🇸 English', callback_data: 'set_language:en' }],
          [{ text: '🇵🇭 Filipino', callback_data: 'set_language:tl' }],
          [{ text: '🇲🇾 Malay', callback_data: 'set_language:ms' }],
          [{ text: '❌ Cancel', callback_data: 'cancel_language_change' }]
        ]
      }
    })
  }

  /**
   * Handle /cancel command - Cancel current operation
   */
  private async handleCancelCommand(ctx: TelegramContext): Promise<void> {
    if (ctx.session.flow) {
      const flowType = ctx.session.flow
      ctx.session.flow = undefined
      ctx.session.data = {}
      
      const flowNames = {
        submission: 'order submission',
        order_creation: 'order creation',
        payment_upload: 'payment upload'
      }
      
      await ctx.reply(
        `❌ ${flowNames[flowType as keyof typeof flowNames] || 'Current operation'} cancelled.\n\n` +
        'You can start a new operation anytime using the available commands.'
      )
    } else {
      await ctx.reply(
        'ℹ️ No operation to cancel.\n\n' +
        'Use /help to see available commands.'
      )
    }
  }
  private async handleDocumentMessage(ctx: TelegramContext): Promise<void> { /* Implementation */ }
  /**
   * Handle text messages - Process conversational flows
   */
  private async handleTextMessage(ctx: TelegramContext): Promise<void> {
    try {
      const text = ctx.message && 'text' in ctx.message ? ctx.message.text : ''
      
      // Check if user is in a flow
      if (ctx.session.flow === 'submission') {
        await this.processSubmissionFlow(ctx, text)
      } else if (ctx.session.flow === 'order_creation') {
        await this.processOrderCreationFlow(ctx, text)
      } else {
        // Default response for unrecognized text
        await ctx.reply(
          'I didn\'t understand that. Try using one of these commands:\n\n' +
          '/start - Main menu\n' +
          '/orders - Browse active orders\n' +
          '/submit - Submit an order\n' +
          '/status - Check your order status\n' +
          '/help - Get help'
        )
      }
    } catch (error: any) {
      logger.error('Text message handling error', {
        error: error.message,
        user_id: ctx.from?.id
      })
      await ctx.reply('❌ An error occurred processing your message. Please try again.')
    }
  }

  /**
   * Process submission flow based on current step
   */
  private async processSubmissionFlow(ctx: TelegramContext, text: string): Promise<void> {
    const sessionData = ctx.session.data
    
    if (!sessionData || !sessionData.step) {
      ctx.session.flow = undefined
      ctx.session.data = {}
      await ctx.reply('❌ Session expired. Please start again with /submit')
      return
    }

    try {
      switch (sessionData.step) {
        case 'name':
          // Validate name
          if (text.length < 2 || text.length > 100) {
            await ctx.reply('❌ Please enter a valid name (2-100 characters).')
            return
          }
          sessionData.buyer_name = text.trim()
          sessionData.step = 'phone'
          
          await ctx.reply(
            `✅ Got it! Your name is **${sessionData.buyer_name}**\n\n` +
            `**Step 2/5: Phone Number**\n` +
            `Please enter your phone number (with country code):`,
            { parse_mode: 'Markdown' }
          )
          break

        case 'phone':
          // Basic phone validation
          const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/
          if (!phoneRegex.test(text)) {
            await ctx.reply('❌ Please enter a valid phone number.')
            return
          }
          sessionData.buyer_phone = text.trim()
          sessionData.step = 'quantity'
          
          await ctx.reply(
            `✅ Phone number saved: **${sessionData.buyer_phone}**\n\n` +
            `**Step 3/5: Quantity**\n` +
            `How many items would you like to order?`,
            { parse_mode: 'Markdown' }
          )
          break

        case 'quantity':
          const quantity = parseInt(text)
          if (isNaN(quantity) || quantity < 1 || quantity > 100) {
            await ctx.reply('❌ Please enter a valid quantity (1-100).')
            return
          }
          sessionData.quantity = quantity
          sessionData.step = 'address'
          
          const totalAmount = sessionData.order_price * quantity
          await ctx.reply(
            `✅ Quantity: **${quantity}**\n` +
            `💰 Total amount: **${totalAmount} ${sessionData.order_currency}**\n\n` +
            `**Step 4/5: Shipping Address**\n` +
            `Please enter your complete shipping address:`,
            { parse_mode: 'Markdown' }
          )
          break

        case 'address':
          if (text.length < 10 || text.length > 500) {
            await ctx.reply('❌ Please enter a valid address (10-500 characters).')
            return
          }
          sessionData.shipping_address = text.trim()
          sessionData.step = 'special_requests'
          
          await ctx.reply(
            `✅ Address saved!\n\n` +
            `**Step 5/5: Special Requests (Optional)**\n` +
            `Any special requests or notes? Type "none" if you don't have any:`,
            { parse_mode: 'Markdown' }
          )
          break

        case 'special_requests':
          sessionData.special_requests = text.toLowerCase() === 'none' ? '' : text.trim()
          
          // Show confirmation
          const totalAmount = sessionData.order_price * sessionData.quantity
          let confirmMessage = `📋 **Order Summary**\n\n`
          confirmMessage += `📦 **Order**: ${sessionData.order_title}\n`
          confirmMessage += `👤 **Name**: ${sessionData.buyer_name}\n`
          confirmMessage += `📱 **Phone**: ${sessionData.buyer_phone}\n`
          confirmMessage += `🔢 **Quantity**: ${sessionData.quantity}\n`
          confirmMessage += `💰 **Total**: ${totalAmount} ${sessionData.order_currency}\n`
          confirmMessage += `📍 **Address**: ${sessionData.shipping_address}\n`
          if (sessionData.special_requests) {
            confirmMessage += `📝 **Notes**: ${sessionData.special_requests}\n`
          }
          confirmMessage += `\nIs this information correct?`

          await ctx.reply(confirmMessage, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ Confirm', callback_data: 'confirm_submission' },
                { text: '❌ Cancel', callback_data: 'cancel_submission' }
              ]]
            }
          })
          
          // Update session to confirmation step
          sessionData.step = 'confirmation'
          break

        default:
          await ctx.reply('❌ Invalid session state. Please start again with /submit')
          ctx.session.flow = undefined
          ctx.session.data = {}
      }
    } catch (error: any) {
      logger.error('Submission flow error', {
        error: error.message,
        step: sessionData.step,
        user_id: ctx.from?.id
      })
      await ctx.reply('❌ An error occurred. Please try again or use /cancel to stop.')
    }
  }

  /**
   * Process order creation flow for GOMs
   */
  private async processOrderCreationFlow(ctx: TelegramContext, text: string): Promise<void> {
    const sessionData = ctx.session.data
    
    if (!sessionData || !sessionData.step) {
      ctx.session.flow = undefined
      ctx.session.data = {}
      await ctx.reply('❌ Session expired. Please start again with /create')
      return
    }

    try {
      switch (sessionData.step) {
        case 'title':
          // Validate title
          if (text.length < 5 || text.length > 200) {
            await ctx.reply('❌ Please enter a valid title (5-200 characters).')
            return
          }
          sessionData.title = text.trim()
          sessionData.step = 'description'
          
          await ctx.reply(
            `✅ Title: **${sessionData.title}**\n\n` +
            `**Step 2/6: Description**\n` +
            `Provide details about the product (optional, type "skip" to skip):`,
            { parse_mode: 'Markdown' }
          )
          break

        case 'description':
          sessionData.description = text.toLowerCase() === 'skip' ? '' : text.trim()
          sessionData.step = 'price'
          
          await ctx.reply(
            `✅ Description saved!\n\n` +
            `**Step 3/6: Price**\n` +
            `Enter the price per item (in ${sessionData.currency}):`,
            { parse_mode: 'Markdown' }
          )
          break

        case 'price':
          const price = parseFloat(text)
          if (isNaN(price) || price <= 0 || price > 10000) {
            await ctx.reply('❌ Please enter a valid price (0.01 - 10,000).')
            return
          }
          sessionData.price = price
          sessionData.step = 'deadline'
          
          await ctx.reply(
            `✅ Price: **${price} ${sessionData.currency}**\n\n` +
            `**Step 4/6: Deadline**\n` +
            `When should the order close? (format: DD/MM/YYYY or "3 days")`,
            { parse_mode: 'Markdown' }
          )
          break

        case 'deadline':
          let deadline: Date
          
          // Try to parse relative date first
          const daysMatch = text.match(/(\d+)\s*days?/i)
          if (daysMatch) {
            const days = parseInt(daysMatch[1])
            deadline = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
          } else {
            // Try to parse DD/MM/YYYY format
            const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
            if (dateMatch) {
              const [, day, month, year] = dateMatch
              deadline = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
            } else {
              await ctx.reply('❌ Invalid date format. Use DD/MM/YYYY or "3 days".')
              return
            }
          }
          
          // Validate deadline is in the future
          if (deadline <= new Date()) {
            await ctx.reply('❌ Deadline must be in the future.')
            return
          }
          
          sessionData.deadline = deadline.toISOString()
          sessionData.step = 'min_orders'
          
          await ctx.reply(
            `✅ Deadline: **${deadline.toLocaleDateString()}**\n\n` +
            `**Step 5/6: Minimum Orders**\n` +
            `What's the minimum number of orders needed?`,
            { parse_mode: 'Markdown' }
          )
          break

        case 'min_orders':
          const minOrders = parseInt(text)
          if (isNaN(minOrders) || minOrders < 1 || minOrders > 1000) {
            await ctx.reply('❌ Please enter a valid minimum (1-1000).')
            return
          }
          sessionData.min_orders = minOrders
          sessionData.step = 'max_orders'
          
          await ctx.reply(
            `✅ Minimum orders: **${minOrders}**\n\n` +
            `**Step 6/6: Maximum Orders (Optional)**\n` +
            `Maximum orders accepted? Type "unlimited" for no limit:`,
            { parse_mode: 'Markdown' }
          )
          break

        case 'max_orders':
          let maxOrders = null
          if (text.toLowerCase() !== 'unlimited') {
            const max = parseInt(text)
            if (isNaN(max) || max < sessionData.min_orders || max > 10000) {
              await ctx.reply(`❌ Maximum must be >= ${sessionData.min_orders} and <= 10,000, or "unlimited".`)
              return
            }
            maxOrders = max
          }
          sessionData.max_orders = maxOrders
          
          // Show order confirmation
          await this.showOrderCreationConfirmation(ctx, sessionData)
          sessionData.step = 'confirmation'
          break

        default:
          await ctx.reply('❌ Invalid session state. Please start again with /create')
          ctx.session.flow = undefined
          ctx.session.data = {}
      }
    } catch (error: any) {
      logger.error('Order creation flow error', {
        error: error.message,
        step: sessionData.step,
        user_id: ctx.from?.id
      })
      await ctx.reply('❌ An error occurred. Please try again or use /cancel to stop.')
    }
  }
  private async handleBrowseOrders(ctx: TelegramContext): Promise<void> { /* Implementation */ }
  /**
   * Handle submit order flow from callback
   */
  private async handleSubmitOrderFlow(ctx: TelegramContext, orderId?: string): Promise<void> {
    if (!orderId) {
      await ctx.editMessageText('❌ Invalid order selection. Please try again.')
      return
    }

    try {
      // Fetch order details
      const response = await axios.get(`${Config.CORE_API_URL}/api/orders/${orderId}`, {
        headers: { 'x-service-secret': Config.SERVICE_SECRET }
      })

      if (!response.data.success) {
        await ctx.editMessageText('❌ Order not found or no longer available.')
        return
      }

      const order = response.data.data

      // Check for existing submission
      const submissionsResponse = await axios.get(
        `${Config.CORE_API_URL}/api/submissions?order_id=${orderId}&user_identifier=tg_${ctx.from?.id}`,
        { headers: { 'x-service-secret': Config.SERVICE_SECRET } }
      )

      if (submissionsResponse.data.success && submissionsResponse.data.data.length > 0) {
        const existingSubmission = submissionsResponse.data.data[0]
        await this.showExistingSubmission(ctx, existingSubmission, order)
        return
      }

      // Start submission flow
      await this.startSubmissionFlow(ctx, order)

    } catch (error: any) {
      logger.error('Submit order flow error', {
        error: error.message,
        order_id: orderId,
        user_id: ctx.from?.id
      })
      await ctx.editMessageText('❌ Unable to process order submission. Please try again.')
    }
  }
  private async handleCheckPayment(ctx: TelegramContext): Promise<void> { /* Implementation */ }
  private async handleConfirmPayment(ctx: TelegramContext, submissionId: string, extractionId: string): Promise<void> { /* Implementation */ }
  private async handleRejectPayment(ctx: TelegramContext, extractionId: string): Promise<void> { /* Implementation */ }
  private async handleGOMDashboard(ctx: TelegramContext): Promise<void> { /* Implementation */ }

  /**
   * Confirm and submit the order
   */
  private async confirmSubmission(ctx: TelegramContext): Promise<void> {
    try {
      const sessionData = ctx.session.data
      
      if (!sessionData || sessionData.step !== 'confirmation') {
        await ctx.reply('❌ Session expired. Please start again with /submit')
        return
      }

      // Create submission via Core API
      const submissionData = {
        order_id: sessionData.order_id,
        buyer_name: sessionData.buyer_name,
        buyer_phone: sessionData.buyer_phone,
        quantity: sessionData.quantity,
        shipping_address: sessionData.shipping_address,
        special_requests: sessionData.special_requests || '',
        platform: 'telegram',
        user_identifier: `tg_${ctx.from?.id}`,
        user_display_name: ctx.from?.first_name + (ctx.from?.last_name ? ` ${ctx.from.last_name}` : '')
      }

      const response = await axios.post(`${Config.CORE_API_URL}/api/submissions`, submissionData, {
        headers: {
          'x-service-secret': Config.SERVICE_SECRET,
          'Content-Type': 'application/json'
        }
      })

      if (!response.data.success) {
        await ctx.editMessageText(`❌ ${response.data.error || 'Failed to create submission. Please try again.'}`)
        return
      }

      const submission = response.data.data

      // Clear session
      ctx.session.flow = undefined
      ctx.session.data = {}

      // Send success message with payment instructions
      let successMessage = `✅ **Order Submitted Successfully!**\n\n`
      successMessage += `🔢 **Payment Reference**: \`${submission.payment_reference}\`\n`
      successMessage += `💰 **Total Amount**: ${submission.amount} ${submission.currency}\n\n`
      successMessage += `**Next Steps:**\n`
      successMessage += `1. Make payment to the GOM's account\n`
      successMessage += `2. Take a screenshot of your payment\n`
      successMessage += `3. Send me the screenshot or use /pay command\n\n`
      successMessage += `⚡ **Pro tip**: Just send me your payment screenshot and I'll process it automatically!`

      await ctx.editMessageText(successMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '💳 Upload Payment Now', callback_data: `upload_payment:${submission.id}` },
            { text: '📊 Check Status', callback_data: `check_status:${submission.id}` }
          ]]
        }
      })

    } catch (error: any) {
      logger.error('Submission confirmation error', {
        error: error.message,
        user_id: ctx.from?.id
      })
      await ctx.editMessageText('❌ Unable to submit order. Please try again.')
    }
  }

  /**
   * Cancel submission flow
   */
  private async cancelSubmission(ctx: TelegramContext): Promise<void> {
    ctx.session.flow = undefined
    ctx.session.data = {}
    
    await ctx.editMessageText(
      '❌ Order submission cancelled.\n\nYou can start a new submission anytime with /submit',
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '🛒 Browse Orders', callback_data: 'browse_orders' },
            { text: '🏠 Main Menu', callback_data: 'start' }
          ]]
        }
      }
    )
  }

  /**
   * Initiate payment upload process
   */
  private async initiatePaymentUpload(ctx: TelegramContext, submissionId: string): Promise<void> {
    ctx.session.flow = 'payment_upload'
    ctx.session.data = { submission_id: submissionId }
    
    await ctx.editMessageText(
      '📸 **Upload Payment Screenshot**\n\n' +
      'Please send me a clear screenshot of your payment. Make sure it shows:\n' +
      '• Transaction amount\n' +
      '• Reference number\n' +
      '• Date and time\n' +
      '• Recipient details\n\n' +
      'I\'ll use AI to process it automatically! 🤖',
      { parse_mode: 'Markdown' }
    )
  }

  /**
   * Check submission status
   */
  private async checkSubmissionStatus(ctx: TelegramContext, submissionId: string): Promise<void> {
    try {
      const response = await axios.get(`${Config.CORE_API_URL}/api/submissions/${submissionId}`, {
        headers: { 'x-service-secret': Config.SERVICE_SECRET }
      })

      if (!response.data.success) {
        await ctx.editMessageText('❌ Unable to fetch submission status.')
        return
      }

      const submission = response.data.data
      const statusEmoji = {
        pending: '⏳',
        confirmed: '✅',
        rejected: '❌',
        cancelled: '🚫'
      }[submission.status] || '❓'

      let statusMessage = `${statusEmoji} **Order Status**\n\n`
      statusMessage += `📦 **Order**: ${submission.order?.title || 'Unknown'}\n`
      statusMessage += `👤 **Name**: ${submission.buyer_name}\n`
      statusMessage += `🔢 **Quantity**: ${submission.quantity}\n`
      statusMessage += `💰 **Amount**: ${submission.amount} ${submission.currency}\n`
      statusMessage += `🏷️ **Payment Ref**: \`${submission.payment_reference}\`\n`
      statusMessage += `📊 **Status**: ${submission.status.toUpperCase()}\n`
      statusMessage += `📅 **Submitted**: ${new Date(submission.created_at).toLocaleDateString()}\n`

      if (submission.payment_confirmed_at) {
        statusMessage += `✅ **Payment Confirmed**: ${new Date(submission.payment_confirmed_at).toLocaleDateString()}\n`
      }

      const keyboard: InlineKeyboard[][] = []
      
      if (submission.status === 'pending') {
        keyboard.push([
          { text: '💳 Upload Payment', callback_data: `upload_payment:${submission.id}` }
        ])
      }
      
      keyboard.push([
        { text: '🔙 Back', callback_data: 'browse_orders' }
      ])

      await ctx.editMessageText(statusMessage, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      })

    } catch (error: any) {
      logger.error('Check status error', {
        error: error.message,
        submission_id: submissionId,
        user_id: ctx.from?.id
      })
      await ctx.editMessageText('❌ Unable to check status. Please try again.')
    }
  }

  /**
   * Confirm order creation
   */
  private async confirmOrderCreation(ctx: TelegramContext): Promise<void> {
    try {
      const sessionData = ctx.session.data
      
      if (!sessionData || sessionData.step !== 'confirmation') {
        await ctx.editMessageText('❌ Session expired. Please start again with /create')
        return
      }

      // Create order via Core API
      const orderData = {
        title: sessionData.title,
        description: sessionData.description || '',
        price: sessionData.price,
        currency: sessionData.currency,
        deadline: sessionData.deadline,
        min_orders: sessionData.min_orders,
        max_orders: sessionData.max_orders,
        user_id: ctx.user?.id
      }

      const response = await axios.post(`${Config.CORE_API_URL}/api/orders`, orderData, {
        headers: {
          'x-service-secret': Config.SERVICE_SECRET,
          'Content-Type': 'application/json'
        }
      })

      if (!response.data.success) {
        await ctx.editMessageText(`❌ ${response.data.error || 'Failed to create order. Please try again.'}`)
        return
      }

      const order = response.data.data
      
      // Clear session
      ctx.session.flow = undefined
      ctx.session.data = {}

      // Send success message
      let successMessage = `✅ **Order Created Successfully!**\n\n`
      successMessage += `📦 **${order.title}**\n`
      successMessage += `🔗 **Order Link**: ${Config.CORE_API_URL}/order/${order.slug}\n`
      successMessage += `💰 **Price**: ${order.price} ${order.currency}\n`
      successMessage += `⏰ **Deadline**: ${new Date(order.deadline).toLocaleDateString()}\n\n`
      successMessage += `Your order is now live and accepting submissions!`

      await ctx.editMessageText(successMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '📤 Share Order', callback_data: `share_order:${order.id}` },
            { text: '📊 View Details', callback_data: `view_order:${order.id}` }
          ]]
        }
      })

    } catch (error: any) {
      logger.error('Order creation confirmation error', {
        error: error.message,
        user_id: ctx.from?.id
      })
      await ctx.editMessageText('❌ Unable to create order. Please try again.')
    }
  }

  /**
   * Cancel order creation
   */
  private async cancelOrderCreation(ctx: TelegramContext): Promise<void> {
    ctx.session.flow = undefined
    ctx.session.data = {}
    
    await ctx.editMessageText(
      '❌ Order creation cancelled.\n\nYou can start a new order anytime with /create'
    )
  }

  /**
   * View order details
   */
  private async viewOrderDetails(ctx: TelegramContext, orderId: string): Promise<void> {
    try {
      const response = await axios.get(`${Config.CORE_API_URL}/api/orders/${orderId}`, {
        headers: { 'x-service-secret': Config.SERVICE_SECRET }
      })

      if (!response.data.success) {
        await ctx.editMessageText('❌ Order not found.')
        return
      }

      const order = response.data.data
      const deadline = new Date(order.deadline)
      const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

      let message = `📦 **${order.title}**\n\n`
      if (order.description) {
        message += `📝 **Description**: ${order.description}\n`
      }
      message += `💰 **Price**: ${order.price} ${order.currency}\n`
      message += `📊 **Orders**: ${order.total_submissions || 0}/${order.max_orders || '∞'}\n`
      message += `💵 **Revenue**: ${order.total_revenue || 0} ${order.currency}\n`
      message += `⏰ **Deadline**: ${deadline.toLocaleDateString()} (${daysLeft > 0 ? `${daysLeft} days left` : 'Ended'})\n`
      message += `📈 **Status**: ${order.is_active ? 'Active' : 'Closed'}\n`
      message += `🔗 **Link**: ${Config.CORE_API_URL}/order/${order.slug}`

      const keyboard: InlineKeyboard[][] = []
      
      if (order.is_active) {
        keyboard.push([
          { text: '📤 Share', callback_data: `share_order:${orderId}` },
          { text: '🔴 Close', callback_data: `close_order:${orderId}` }
        ])
      }
      
      keyboard.push([
        { text: '🔙 Back to Orders', callback_data: 'manage_orders' }
      ])

      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      })

    } catch (error: any) {
      logger.error('View order details error', { error: error.message, order_id: orderId })
      await ctx.editMessageText('❌ Unable to fetch order details.')
    }
  }

  /**
   * Share order
   */
  private async shareOrder(ctx: TelegramContext, orderId: string): Promise<void> {
    try {
      const response = await axios.get(`${Config.CORE_API_URL}/api/orders/${orderId}`, {
        headers: { 'x-service-secret': Config.SERVICE_SECRET }
      })

      if (!response.data.success) {
        await ctx.editMessageText('❌ Order not found.')
        return
      }

      const order = response.data.data
      const deadline = new Date(order.deadline)

      let shareMessage = `🛒 **NEW GROUP ORDER!**\n\n`
      shareMessage += `📦 **${order.title}**\n`
      if (order.description) {
        shareMessage += `📝 ${order.description}\n\n`
      }
      shareMessage += `💰 **Price**: ${order.price} ${order.currency}\n`
      shareMessage += `📊 **Progress**: ${order.total_submissions || 0}/${order.min_orders} minimum orders\n`
      shareMessage += `⏰ **Deadline**: ${deadline.toLocaleDateString()}\n\n`
      shareMessage += `📱 Submit: ${Config.CORE_API_URL}/order/${order.slug}\n`
      shareMessage += `💬 Or reply /submit ${orderId} to this bot`

      await ctx.editMessageText(
        `📤 **Share Text Created!**\n\nCopy and paste this message to share your order:\n\n` +
        `\`\`\`\n${shareMessage}\n\`\`\``,
        { parse_mode: 'Markdown' }
      )

    } catch (error: any) {
      logger.error('Share order error', { error: error.message, order_id: orderId })
      await ctx.editMessageText('❌ Unable to generate share text.')
    }
  }

  /**
   * Close order
   */
  private async closeOrder(ctx: TelegramContext, orderId: string): Promise<void> {
    try {
      const response = await axios.patch(
        `${Config.CORE_API_URL}/api/orders/${orderId}`,
        { is_active: false },
        { headers: { 'x-service-secret': Config.SERVICE_SECRET } }
      )

      if (!response.data.success) {
        await ctx.editMessageText(`❌ ${response.data.error || 'Unable to close order.'}`)
        return
      }

      await ctx.editMessageText(
        '✅ **Order Closed Successfully!**\n\n' +
        'The order is no longer accepting new submissions. You can still manage existing submissions.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '📊 View Final Stats', callback_data: `view_order:${orderId}` },
              { text: '🔙 Back to Orders', callback_data: 'manage_orders' }
            ]]
          }
        }
      )

    } catch (error: any) {
      logger.error('Close order error', { error: error.message, order_id: orderId })
      await ctx.editMessageText('❌ Unable to close order.')
    }
  }

  /**
   * Set language
   */
  private async setLanguage(ctx: TelegramContext, languageCode: string): Promise<void> {
    ctx.session.language = languageCode
    
    const languageNames = {
      en: 'English',
      tl: 'Filipino', 
      ms: 'Malay'
    }
    
    await ctx.editMessageText(
      `✅ Language set to ${languageNames[languageCode as keyof typeof languageNames] || languageCode}!\n\n` +
      'Bot messages will now appear in your selected language.'
    )
  }

  /**
   * Start the bot
   */
  async launch(): Promise<void> {
    try {
      if (Config.TELEGRAM_WEBHOOK_URL) {
        // Use webhook in production
        await this.bot.launch({
          webhook: {
            domain: Config.TELEGRAM_WEBHOOK_URL,
            port: Config.PORT
          }
        })
        logger.info('Telegram bot started with webhook', { 
          webhook_url: Config.TELEGRAM_WEBHOOK_URL 
        })
      } else {
        // Use polling in development
        await this.bot.launch()
        logger.info('Telegram bot started with polling')
      }

      logger.info('🤖 GOMFLOW Telegram Bot is ready!', {
        bot_username: this.bot.botInfo?.username,
        features: {
          smart_payments: Config.botFeatures.smartPaymentDetection,
          inline_payments: Config.botFeatures.inlinePayments
        }
      })

    } catch (error: any) {
      logger.error('Failed to start Telegram bot', { error: error.message })
      throw error
    }
  }

  /**
   * Stop the bot gracefully
   */
  async stop(): Promise<void> {
    try {
      await this.bot.stop()
      logger.info('Telegram bot stopped')
    } catch (error: any) {
      logger.error('Error stopping Telegram bot', { error: error.message })
    }
  }

  /**
   * Get bot instance for external use
   */
  getBot(): Telegraf<TelegramContext> {
    return this.bot
  }
}

export default TelegramBotService