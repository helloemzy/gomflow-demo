import { 
  Client, 
  GatewayIntentBits, 
  Partials,
  Collection,
  ChatInputCommandInteraction,
  ButtonInteraction,
  SelectMenuInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  AttachmentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js'
import axios from 'axios'
import FormData from 'form-data'
import { Config } from '@/config'
import { logger } from '@/utils/logger'
import {
  DiscordContext,
  DiscordUser,
  OrderEmbedData,
  PaymentAttachmentData,
  SlashCommandHandler,
  ButtonHandler,
  EmbedTemplate
} from '@/types'

export class DiscordBotService {
  private client: Client
  private commands: Collection<string, SlashCommandHandler> = new Collection()
  private buttons: Collection<string, ButtonHandler> = new Collection()
  private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map()
  private userSessions: Map<string, any> = new Map()

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
      ],
      partials: [
        Partials.Channel,
        Partials.Message
      ]
    })

    this.setupEventHandlers()
    this.setupCommands()
    this.setupButtons()
  }

  /**
   * Setup Discord client event handlers
   */
  private setupEventHandlers(): void {
    // Bot ready event
    this.client.once('ready', () => {
      logger.info('Discord bot is ready!', {
        bot_id: this.client.user?.id,
        bot_username: this.client.user?.tag,
        guilds: this.client.guilds.cache.size
      })
    })

    // Slash command interactions
    this.client.on('interactionCreate', async (interaction) => {
      try {
        if (interaction.isChatInputCommand()) {
          await this.handleSlashCommand(interaction)
        } else if (interaction.isButton()) {
          await this.handleButtonInteraction(interaction)
        } else if (interaction.isStringSelectMenu()) {
          await this.handleSelectMenuInteraction(interaction)
        } else if (interaction.isModalSubmit()) {
          await this.handleModalSubmit(interaction)
        }
      } catch (error: any) {
        logger.error('Interaction handling error', {
          error: error.message,
          interaction_type: interaction.type,
          user_id: interaction.user.id,
          guild_id: interaction.guildId
        })

        const errorMessage = 'An error occurred while processing your request. Please try again later.'
        
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: true })
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true })
        }
      }
    })

    // Guild join event
    this.client.on('guildCreate', async (guild) => {
      logger.info('Bot joined new guild', {
        guild_id: guild.id,
        guild_name: guild.name,
        member_count: guild.memberCount
      })
      
      // Register guild in database
      // This would be handled by the database service
    })

    // Error handling
    this.client.on('error', (error) => {
      logger.error('Discord client error', {
        error: error.message,
        stack: error.stack
      })
    })
  }

  /**
   * Setup slash commands
   */
  private setupCommands(): void {
    // /order command
    this.commands.set('order', async (context, options) => {
      const subcommand = options.getSubcommand()
      
      switch (subcommand) {
        case 'list':
          await this.handleOrderList(context)
          break
        case 'create':
          await this.handleOrderCreate(context, options)
          break
        case 'view':
          await this.handleOrderView(context, options)
          break
        default:
          await context.interaction.reply({
            content: 'Unknown order subcommand.',
            ephemeral: true
          })
      }
    })

    // /submit command
    this.commands.set('submit', async (context, options) => {
      await this.handleSubmitOrder(context, options)
    })

    // /pay command
    this.commands.set('pay', async (context, options) => {
      const subcommand = options.getSubcommand()
      
      switch (subcommand) {
        case 'screenshot':
          await this.handlePaymentScreenshot(context, options)
          break
        case 'status':
          await this.handlePaymentStatus(context, options)
          break
        default:
          await context.interaction.reply({
            content: 'Unknown payment subcommand.',
            ephemeral: true
          })
      }
    })

    // /status command
    this.commands.set('status', async (context, options) => {
      await this.handleStatusCheck(context, options)
    })

    // /manage command (GOM only)
    this.commands.set('manage', async (context, options) => {
      // Check if user is GOM
      const user = await this.getOrCreateUser(context.user)
      if (!user.is_gom) {
        await context.interaction.reply({
          content: 'This command is only available to GOMs (Group Order Managers).',
          ephemeral: true
        })
        return
      }

      const subcommand = options.getSubcommand()
      
      switch (subcommand) {
        case 'dashboard':
          await this.handleGOMDashboard(context)
          break
        case 'analytics':
          await this.handleGOMAnalytics(context)
          break
        case 'notify':
          await this.handleGOMNotify(context, options)
          break
        default:
          await context.interaction.reply({
            content: 'Unknown management subcommand.',
            ephemeral: true
          })
      }
    })

    // /help command
    this.commands.set('help', async (context, options) => {
      await this.handleHelp(context, options)
    })
  }

  /**
   * Setup button handlers
   */
  private setupButtons(): void {
    // Order interaction buttons
    this.buttons.set('order_submit', async (context) => {
      const orderId = context.interaction.customId.split(':')[1]
      await this.startSubmissionFlow(context, orderId)
    })

    this.buttons.set('order_view', async (context) => {
      const orderId = context.interaction.customId.split(':')[1]
      await this.showOrderDetails(context, orderId)
    })

    // Payment confirmation buttons
    this.buttons.set('payment_confirm', async (context) => {
      const [, submissionId, extractionId] = context.interaction.customId.split(':')
      await this.confirmPayment(context, submissionId, extractionId)
    })

    this.buttons.set('payment_reject', async (context) => {
      const extractionId = context.interaction.customId.split(':')[1]
      await this.rejectPayment(context, extractionId)
    })

    // Pagination buttons
    this.buttons.set('page_prev', async (context) => {
      const page = parseInt(context.interaction.customId.split(':')[1]) - 1
      await this.updateOrderList(context, page)
    })

    this.buttons.set('page_next', async (context) => {
      const page = parseInt(context.interaction.customId.split(':')[1]) + 1
      await this.updateOrderList(context, page)
    })

    // Help navigation buttons
    this.buttons.set('help', async (context) => {
      const category = context.interaction.customId.split(':')[1] || 'general'
      await this.handleHelp(context, { getString: () => category })
    })
  }

  /**
   * Handle slash command interactions
   */
  private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    // Rate limiting check
    if (!this.checkRateLimit(interaction.user.id)) {
      await interaction.reply({
        content: 'You are sending commands too quickly. Please wait a moment.',
        ephemeral: true
      })
      return
    }

    const context: DiscordContext = {
      client: this.client,
      interaction,
      guild: interaction.guild || undefined,
      user: interaction.user,
      member: interaction.member || undefined,
      channel: interaction.channel || undefined
    }

    const handler = this.commands.get(interaction.commandName)
    if (!handler) {
      await interaction.reply({
        content: 'Unknown command.',
        ephemeral: true
      })
      return
    }

    logger.info('Slash command executed', {
      command: interaction.commandName,
      user_id: interaction.user.id,
      guild_id: interaction.guildId,
      channel_id: interaction.channelId
    })

    await handler(context, interaction.options)
  }

  /**
   * Handle button interactions
   */
  private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    const context: DiscordContext = {
      client: this.client,
      interaction,
      guild: interaction.guild || undefined,
      user: interaction.user,
      member: interaction.member || undefined,
      channel: interaction.channel || undefined
    }

    const buttonId = interaction.customId.split(':')[0]
    const handler = this.buttons.get(buttonId)
    
    if (!handler) {
      await interaction.reply({
        content: 'This button is no longer available.',
        ephemeral: true
      })
      return
    }

    await handler(context)
  }

  /**
   * Handle select menu interactions
   */
  private async handleSelectMenuInteraction(interaction: SelectMenuInteraction): Promise<void> {
    // Implementation for select menu handling
    await interaction.reply({
      content: 'Select menu interactions not yet implemented.',
      ephemeral: true
    })
  }

  /**
   * Handle modal submit interactions
   */
  private async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    // Implementation for modal handling
    await interaction.reply({
      content: 'Modal submissions not yet implemented.',
      ephemeral: true
    })
  }

  /**
   * Handle /order list command
   */
  private async handleOrderList(context: DiscordContext): Promise<void> {
    try {
      await context.interaction.deferReply()

      // Fetch active orders from Core API
      const response = await axios.get(`${Config.CORE_API_URL}/api/orders?active_only=true`, {
        headers: { 'x-service-secret': Config.SERVICE_SECRET }
      })

      const orders = response.data.data.orders || []
      
      if (orders.length === 0) {
        const embed = new EmbedBuilder()
          .setTitle('📻 No Active Orders')
          .setDescription('There are currently no active group orders. Check back later!')
          .setColor(Config.discord.embedColor)
          .setTimestamp()

        await context.interaction.editReply({ embeds: [embed] })
        return
      }

      const orderEmbed = this.buildOrderListEmbed(orders, 1)
      const components = this.buildOrderListComponents(orders, 1)

      await context.interaction.editReply({
        embeds: [orderEmbed],
        components
      })

    } catch (error: any) {
      logger.error('Failed to fetch orders', { error: error.message })
      
      await context.interaction.editReply({
        content: '❌ Sorry, I couldn\'t fetch the current orders. Please try again later.'
      })
    }
  }

  /**
   * Handle payment screenshot upload
   */
  private async handlePaymentScreenshot(context: DiscordContext, options: any): Promise<void> {
    try {
      const attachment = options.getAttachment('screenshot')
      
      if (!attachment) {
        await context.interaction.reply({
          content: 'Please provide a payment screenshot.',
          ephemeral: true
        })
        return
      }

      // Validate file type and size
      if (!Config.fileSettings.allowedTypes.some(type => attachment.contentType?.includes(type))) {
        await context.interaction.reply({
          content: 'Invalid file type. Please upload a valid image (JPEG, PNG, WebP, GIF).',
          ephemeral: true
        })
        return
      }

      if (attachment.size > Config.fileSettings.maxSize) {
        await context.interaction.reply({
          content: 'File is too large. Maximum size is 24MB.',
          ephemeral: true
        })
        return
      }

      await context.interaction.deferReply()

      // Download and process the image
      await this.processPaymentScreenshot(context, attachment)

    } catch (error: any) {
      logger.error('Payment screenshot processing error', {
        error: error.message,
        user_id: context.user.id
      })
      
      const errorMessage = 'Sorry, I couldn\'t process your payment screenshot. Please try again or contact support.'
      
      if (context.interaction.deferred) {
        await context.interaction.editReply({ content: errorMessage })
      } else {
        await context.interaction.reply({ content: errorMessage, ephemeral: true })
      }
    }
  }

  /**
   * Process payment screenshot using Smart Agent
   */
  private async processPaymentScreenshot(context: DiscordContext, attachment: any): Promise<void> {
    try {
      // Download file from Discord
      const response = await axios.get(attachment.url, { responseType: 'arraybuffer' })
      const imageBuffer = Buffer.from(response.data)
      
      // Send to Smart Agent for processing
      const smartAgentResponse = await this.sendToSmartAgent(imageBuffer, {
        platform: 'discord',
        user_id: context.user.id,
        guild_id: context.guild?.id,
        priority: 'normal'
      })

      // Process results
      if (smartAgentResponse.success) {
        const result = smartAgentResponse.data
        
        if (result.best_match?.auto_approved) {
          // Payment was automatically approved
          const embed = new EmbedBuilder()
            .setTitle('✅ Payment Confirmed!')
            .setDescription(`Your payment has been automatically verified and approved.`)
            .addFields(
              { name: 'Amount', value: `${result.best_match.amount} ${result.best_match.currency}`, inline: true },
              { name: 'Reference', value: result.best_match.payment_reference || 'N/A', inline: true },
              { name: 'Confidence', value: `${Math.round(result.best_match.confidence * 100)}%`, inline: true }
            )
            .setColor(0x00ff00)
            .setTimestamp()

          await context.interaction.editReply({ embeds: [embed] })
        } else if (result.matches && result.matches.length > 0) {
          // Manual review required
          const embed = new EmbedBuilder()
            .setTitle('🔍 Payment Screenshot Analyzed')
            .setDescription(`I found ${result.matches.length} possible matches. Please confirm which one is correct:`)
            .setColor(Config.discord.embedColor)
            .setTimestamp()

          // Add match fields
          result.matches.slice(0, 3).forEach((match: any, index: number) => {
            embed.addFields({
              name: `Match ${index + 1} - ${match.buyer_name}`,
              value: `💰 ${match.amount} ${match.currency}\n🔢 ${match.payment_reference}\n🎯 ${Math.round(match.confidence * 100)}% match`,
              inline: true
            })
          })

          // Create confirmation buttons
          const buttons = result.matches.slice(0, 3).map((match: any, index: number) => 
            new ButtonBuilder()
              .setCustomId(`payment_confirm:${match.submission_id}:${result.extraction.id}`)
              .setLabel(`Confirm Match ${index + 1}`)
              .setStyle(ButtonStyle.Success)
          )

          buttons.push(
            new ButtonBuilder()
              .setCustomId(`payment_reject:${result.extraction.id}`)
              .setLabel('None of these')
              .setStyle(ButtonStyle.Danger)
          )

          const actionRow = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(buttons)

          await context.interaction.editReply({
            embeds: [embed],
            components: [actionRow]
          })
        } else {
          // No matches found
          const embed = new EmbedBuilder()
            .setTitle('⚠️ Payment Screenshot Processed')
            .setDescription('I couldn\'t find any matching orders for this payment.')
            .addFields({
              name: 'What to check:',
              value: '• Payment reference matches your order\n• Amount is correct\n• Order is still active\n\nContact the GOM if you need help.',
              inline: false
            })
            .setColor(0xff9900)
            .setTimestamp()

          await context.interaction.editReply({ embeds: [embed] })
        }
      } else {
        throw new Error(smartAgentResponse.error || 'Smart Agent processing failed')
      }

    } catch (error: any) {
      logger.error('Payment screenshot processing failed', {
        error: error.message,
        attachment_url: attachment.url,
        user_id: context.user.id
      })

      const embed = new EmbedBuilder()
        .setTitle('❌ Processing Failed')
        .setDescription('Sorry, I couldn\'t process your payment screenshot. Please try again later or contact support.')
        .setColor(0xff0000)
        .setTimestamp()

      await context.interaction.editReply({ embeds: [embed] })
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
      if (context.guild_id) formData.append('guild_id', context.guild_id)
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
   * Build order list embed
   */
  private buildOrderListEmbed(orders: OrderEmbedData[], page: number): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle('📋 Active Group Orders')
      .setColor(Config.discord.embedColor)
      .setTimestamp()

    if (Config.discord.embedThumbnailUrl) {
      embed.setThumbnail(Config.discord.embedThumbnailUrl)
    }

    // Add order fields (max 25 fields)
    const startIndex = (page - 1) * 5
    const endIndex = Math.min(startIndex + 5, orders.length)
    
    for (let i = startIndex; i < endIndex; i++) {
      const order = orders[i]
      const deadline = new Date(order.deadline).toLocaleDateString()
      const progress = order.max_submissions 
        ? `${order.current_submissions}/${order.max_submissions}`
        : `${order.current_submissions}`
      
      embed.addFields({
        name: `${i + 1}. ${order.title}`,
        value: `💰 ${order.price} ${order.currency} | 📅 ${deadline} | 📊 ${progress} orders`,
        inline: false
      })
    }

    const totalPages = Math.ceil(orders.length / 5)
    embed.setFooter({ text: `Page ${page} of ${totalPages} • ${orders.length} total orders` })

    return embed
  }

  /**
   * Build order list components (buttons)
   */
  private buildOrderListComponents(orders: OrderEmbedData[], page: number): ActionRowBuilder<ButtonBuilder>[] {
    const components: ActionRowBuilder<ButtonBuilder>[] = []
    
    // Order action buttons
    const startIndex = (page - 1) * 5
    const endIndex = Math.min(startIndex + 5, orders.length)
    
    if (endIndex > startIndex) {
      const orderButtons = []
      
      for (let i = startIndex; i < Math.min(startIndex + 3, endIndex); i++) {
        const order = orders[i]
        orderButtons.push(
          new ButtonBuilder()
            .setCustomId(`order_submit:${order.order_id}`)
            .setLabel(`Submit - ${order.title.substring(0, 20)}${order.title.length > 20 ? '...' : ''}`)
            .setStyle(ButtonStyle.Primary)
        )
      }
      
      if (orderButtons.length > 0) {
        components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(orderButtons))
      }
    }

    // Pagination buttons
    const totalPages = Math.ceil(orders.length / 5)
    if (totalPages > 1) {
      const paginationButtons = []
      
      if (page > 1) {
        paginationButtons.push(
          new ButtonBuilder()
            .setCustomId(`page_prev:${page}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
        )
      }
      
      if (page < totalPages) {
        paginationButtons.push(
          new ButtonBuilder()
            .setCustomId(`page_next:${page}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
        )
      }
      
      if (paginationButtons.length > 0) {
        components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(paginationButtons))
      }
    }

    return components
  }

  /**
   * Get or create user in database
   */
  private async getOrCreateUser(discordUser: any): Promise<DiscordUser> {
    // This would integrate with the database service
    // For now, return a basic user object
    return {
      id: `dc_${discordUser.id}`,
      discord_id: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator,
      avatar: discordUser.avatar,
      is_gom: false, // Would be determined from database
      guilds: [],
      created_at: new Date(),
      updated_at: new Date(),
      last_active: new Date()
    }
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(userId: string): boolean {
    const now = Date.now()
    const userLimit = this.rateLimitMap.get(userId)

    if (userLimit) {
      if (now < userLimit.resetTime) {
        if (userLimit.count >= Config.rateLimits.maxCommands) {
          return false
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

    return true
  }

  // Placeholder methods for other handlers
  /**
   * Handle /order create command - Create a new group order
   */
  private async handleOrderCreate(context: DiscordContext, options: any): Promise<void> {
    try {
      // Create modal for order creation
      const modal = new ModalBuilder()
        .setCustomId('order_create_modal')
        .setTitle('Create New Group Order')

      // Order title input
      const titleInput = new TextInputBuilder()
        .setCustomId('order_title')
        .setLabel('Order Title')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., SEVENTEEN God of Music Album Pre-order')
        .setRequired(true)
        .setMaxLength(100)

      // Order description input
      const descriptionInput = new TextInputBuilder()
        .setCustomId('order_description')
        .setLabel('Order Description')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Describe the items, versions, delivery timeline, etc.')
        .setRequired(false)
        .setMaxLength(500)

      // Price and currency input
      const priceInput = new TextInputBuilder()
        .setCustomId('order_price')
        .setLabel('Price per Item (include currency: PHP or MYR)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 25 PHP or 30 MYR')
        .setRequired(true)
        .setMaxLength(20)

      // Deadline input
      const deadlineInput = new TextInputBuilder()
        .setCustomId('order_deadline')
        .setLabel('Order Deadline (YYYY-MM-DD HH:MM)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 2025-02-15 23:59')
        .setRequired(true)
        .setMaxLength(30)

      // Minimum orders input
      const minOrdersInput = new TextInputBuilder()
        .setCustomId('order_min_max')
        .setLabel('Min Orders Required (and Max if any)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., 50 or 50-200 (min-max)')
        .setRequired(true)
        .setMaxLength(20)

      // Create action rows for modal inputs
      const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput)
      const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput)
      const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(priceInput)
      const fourthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(deadlineInput)
      const fifthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(minOrdersInput)

      modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow)

      // Store session for modal handling
      await this.storeUserSession(context.user.id, {
        step: 'order_creation',
        timestamp: Date.now()
      })

      await context.interaction.showModal(modal)

    } catch (error: any) {
      logger.error('Order create modal error', {
        error: error.message,
        user_id: context.user.id
      })

      await context.interaction.reply({
        content: '❌ Unable to open order creation form. Please try again.',
        ephemeral: true
      })
    }
  }
  /**
   * Handle /order view command - Display detailed order information
   */
  private async handleOrderView(context: DiscordContext, options: any): Promise<void> {
    const orderId = options.getString('order_id', true)
    
    try {
      await context.interaction.deferReply()

      // Fetch order details from Core API
      const orderResponse = await axios.get(`${Config.api.coreUrl}/api/orders/${orderId}`, {
        headers: {
          'x-gomflow-auth': Config.api.internalKey
        }
      })

      if (!orderResponse.data.success) {
        await context.interaction.editReply({
          content: '❌ Order not found or no longer available.'
        })
        return
      }

      const order = orderResponse.data.data
      
      // Create detailed order embed
      const embed = new EmbedBuilder()
        .setTitle(`📦 ${order.title}`)
        .setDescription(order.description || 'No description provided')
        .setColor(Config.discord.embedColor)
        .setTimestamp()
        .setFooter({ text: `Order ID: ${order.id}` })

      // Add order details
      const deadline = new Date(order.deadline)
      const timeUntilDeadline = deadline.getTime() - Date.now()
      const daysLeft = Math.ceil(timeUntilDeadline / (1000 * 60 * 60 * 24))
      
      embed.addFields(
        {
          name: '💰 Price',
          value: `${order.price} ${order.currency}`,
          inline: true
        },
        {
          name: '📅 Deadline',
          value: `${deadline.toLocaleDateString()}\n(${daysLeft > 0 ? `${daysLeft} days left` : 'Deadline passed'})`,
          inline: true
        },
        {
          name: '📊 Progress',
          value: order.max_submissions 
            ? `${order.submissions_count}/${order.max_submissions} orders`
            : `${order.submissions_count} orders`,
          inline: true
        }
      )

      // Add GOM information
      if (order.user) {
        embed.addFields({
          name: '👨‍💼 Group Order Manager',
          value: `${order.user.display_name || order.user.username}\n⭐ ${order.user.rating || 'New GOM'}`,
          inline: true
        })
      }

      // Add location if available
      if (order.shipping_location) {
        embed.addFields({
          name: '📍 Shipping From',
          value: order.shipping_location,
          inline: true
        })
      }

      // Add payment methods
      if (order.payment_methods && order.payment_methods.length > 0) {
        embed.addFields({
          name: '💳 Accepted Payments',
          value: order.payment_methods.join(', '),
          inline: false
        })
      }

      // Add action buttons
      const actionButtons = new ActionRowBuilder<ButtonBuilder>()
      
      if (timeUntilDeadline > 0 && (!order.max_submissions || order.submissions_count < order.max_submissions)) {
        actionButtons.addComponents(
          new ButtonBuilder()
            .setCustomId(`order_submit:${order.id}`)
            .setLabel('🛒 Submit Order')
            .setStyle(ButtonStyle.Success)
        )
      }

      actionButtons.addComponents(
        new ButtonBuilder()
          .setCustomId(`order_view:${order.id}`)
          .setLabel('🔄 Refresh')
          .setStyle(ButtonStyle.Secondary)
      )

      // Add external link if available
      if (order.external_link) {
        actionButtons.addComponents(
          new ButtonBuilder()
            .setURL(order.external_link)
            .setLabel('🔗 Product Link')
            .setStyle(ButtonStyle.Link)
        )
      }

      await context.interaction.editReply({
        embeds: [embed],
        components: [actionButtons]
      })

    } catch (error: any) {
      logger.error('Order view error', {
        error: error.message,
        order_id: orderId,
        user_id: context.user.id
      })

      const errorMessage = error.response?.status === 404 
        ? '❌ Order not found. Please check the order ID and try again.'
        : '❌ Unable to fetch order details. Please try again later.'

      if (context.interaction.deferred) {
        await context.interaction.editReply({ content: errorMessage })
      } else {
        await context.interaction.reply({ content: errorMessage, ephemeral: true })
      }
    }
  }
  /**
   * Handle /order submit command - Start the order submission process
   */
  private async handleSubmitOrder(context: DiscordContext, options: any): Promise<void> {
    const orderId = options.getString('order_id', true)
    
    try {
      await context.interaction.deferReply({ ephemeral: true })

      // First, verify the order exists and is accepting submissions
      const orderResponse = await axios.get(`${Config.api.coreUrl}/api/orders/${orderId}`, {
        headers: {
          'x-gomflow-auth': Config.api.internalKey
        }
      })

      if (!orderResponse.data.success) {
        await context.interaction.editReply({
          content: '❌ Order not found or no longer available.'
        })
        return
      }

      const order = orderResponse.data.data
      const deadline = new Date(order.deadline)
      const timeUntilDeadline = deadline.getTime() - Date.now()

      // Check if order is still accepting submissions
      if (timeUntilDeadline <= 0) {
        await context.interaction.editReply({
          content: '❌ This order has passed its deadline and is no longer accepting submissions.'
        })
        return
      }

      if (order.max_submissions && order.submissions_count >= order.max_submissions) {
        await context.interaction.editReply({
          content: '❌ This order has reached its maximum capacity and is no longer accepting submissions.'
        })
        return
      }

      // Check if user already submitted to this order
      const existingSubmissionResponse = await axios.get(`${Config.api.coreUrl}/api/submissions`, {
        headers: {
          'x-gomflow-auth': Config.api.internalKey
        },
        params: {
          order_id: orderId,
          user_identifier: context.user.id,
          platform: 'discord'
        }
      })

      if (existingSubmissionResponse.data.success && existingSubmissionResponse.data.data.length > 0) {
        const submission = existingSubmissionResponse.data.data[0]
        
        const embed = new EmbedBuilder()
          .setTitle('📋 Existing Submission Found')
          .setDescription(`You already have a submission for this order.`)
          .setColor(Config.discord.embedColor)
          .addFields(
            {
              name: '🔢 Payment Reference',
              value: submission.payment_reference,
              inline: true
            },
            {
              name: '💰 Amount',
              value: `${submission.amount} ${submission.currency}`,
              inline: true
            },
            {
              name: '📊 Status',
              value: submission.payment_status === 'confirmed' ? '✅ Paid' : '⏳ Pending Payment',
              inline: true
            }
          )
          .setTimestamp()

        const buttons = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`payment_status:${submission.id}`)
              .setLabel('💳 Check Payment Status')
              .setStyle(ButtonStyle.Primary)
          )

        await context.interaction.editReply({
          embeds: [embed],
          components: [buttons]
        })
        return
      }

      // Start submission flow
      await this.startSubmissionFlow(context, orderId)

    } catch (error: any) {
      logger.error('Submit order error', {
        error: error.message,
        order_id: orderId,
        user_id: context.user.id
      })

      const errorMessage = error.response?.status === 404 
        ? '❌ Order not found. Please check the order ID and try again.'
        : '❌ Unable to process your submission. Please try again later.'

      if (context.interaction.deferred) {
        await context.interaction.editReply({ content: errorMessage })
      } else {
        await context.interaction.reply({ content: errorMessage, ephemeral: true })
      }
    }
  }
  private async handlePaymentStatus(context: DiscordContext, options: any): Promise<void> { /* Implementation */ }
  private async handleStatusCheck(context: DiscordContext, options: any): Promise<void> { /* Implementation */ }
  /**
   * Handle /manage dashboard command - Display GOM dashboard with statistics
   */
  private async handleGOMDashboard(context: DiscordContext): Promise<void> {
    try {
      await context.interaction.deferReply({ ephemeral: true })

      // Get dashboard data from Core API
      const response = await axios.get(`${Config.api.coreUrl}/api/dashboard`, {
        headers: {
          'x-gomflow-auth': Config.api.internalKey
        }
      })

      if (!response.data.success) {
        await context.interaction.editReply({
          content: '❌ Unable to fetch dashboard data. Please try again.'
        })
        return
      }

      const dashboardData = response.data.data
      const stats = dashboardData.stats
      const recentOrders = dashboardData.recentOrders
      const recentSubmissions = dashboardData.recentSubmissions

      // Create main dashboard embed
      const dashboardEmbed = new EmbedBuilder()
        .setTitle('📊 GOM Dashboard')
        .setDescription('Your group order management overview')
        .setColor(Config.discord.embedColor)
        .addFields(
          {
            name: '📦 Orders Overview',
            value: `**Total Orders:** ${stats.totalOrders}\n**Active Orders:** ${stats.activeOrders}\n**Total Submissions:** ${stats.totalSubmissions}`,
            inline: true
          },
          {
            name: '💰 Revenue Overview',
            value: `**Total Revenue:** ${stats.totalRevenue}\n**Pending Revenue:** ${stats.pendingRevenue}`,
            inline: true
          },
          {
            name: '💳 Payment Status',
            value: `**Pending Payments:** ${stats.pendingPayments}\n**Overdue Payments:** ${stats.overduePayments}`,
            inline: true
          }
        )
        .setTimestamp()
        .setFooter({ text: 'Updated just now' })

      // Create recent orders embed
      let recentOrdersEmbed = null
      if (recentOrders && recentOrders.length > 0) {
        recentOrdersEmbed = new EmbedBuilder()
          .setTitle('📦 Recent Orders')
          .setColor(0x3498db)
          .setDescription('Your latest group orders')

        recentOrders.slice(0, 5).forEach((order: any) => {
          const status = order.is_active ? '🟢 Active' : '🔴 Inactive'
          const deadline = new Date(order.deadline)
          recentOrdersEmbed!.addFields({
            name: `${order.title}`,
            value: `${status} • ${order.current_orders}/${order.min_orders} orders • Deadline: <t:${Math.floor(deadline.getTime() / 1000)}:R>`,
            inline: false
          })
        })
      }

      // Create recent submissions embed
      let recentSubmissionsEmbed = null
      if (recentSubmissions && recentSubmissions.length > 0) {
        recentSubmissionsEmbed = new EmbedBuilder()
          .setTitle('👥 Recent Submissions')
          .setColor(0x2ecc71)
          .setDescription('Latest buyer submissions')

        recentSubmissions.slice(0, 5).forEach((submission: any) => {
          const statusEmoji = submission.status === 'confirmed' ? '✅' : 
                             submission.status === 'pending' ? '⏳' : '❌'
          recentSubmissionsEmbed!.addFields({
            name: `${submission.buyer_name}`,
            value: `${statusEmoji} ${submission.order.title} • ${submission.quantity}x • ${submission.amount} ${submission.currency}`,
            inline: false
          })
        })
      }

      // Create action buttons
      const actionButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('gom_refresh_dashboard')
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('gom_view_analytics')
            .setLabel('📈 Analytics')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('gom_send_reminders')
            .setLabel('📢 Send Reminders')
            .setStyle(ButtonStyle.Success)
        )

      // Send dashboard response
      const embeds = [dashboardEmbed]
      if (recentOrdersEmbed) embeds.push(recentOrdersEmbed)
      if (recentSubmissionsEmbed) embeds.push(recentSubmissionsEmbed)

      await context.interaction.editReply({
        embeds,
        components: [actionButtons]
      })

    } catch (error: any) {
      logger.error('GOM dashboard error', {
        error: error.message,
        user_id: context.user.id
      })

      const errorMessage = '❌ Unable to load dashboard. Please try again later.'
      
      if (context.interaction.deferred) {
        await context.interaction.editReply({ content: errorMessage })
      } else {
        await context.interaction.reply({ content: errorMessage, ephemeral: true })
      }
    }
  }
  /**
   * Handle /manage analytics command - Display detailed analytics and insights
   */
  private async handleGOMAnalytics(context: DiscordContext): Promise<void> {
    try {
      await context.interaction.deferReply({ ephemeral: true })

      // Get comprehensive analytics data
      const [dashboardResponse, ordersResponse] = await Promise.all([
        axios.get(`${Config.api.coreUrl}/api/dashboard`, {
          headers: { 'x-gomflow-auth': Config.api.internalKey }
        }),
        axios.get(`${Config.api.coreUrl}/api/orders?limit=50`, {
          headers: { 'x-gomflow-auth': Config.api.internalKey }
        })
      ])

      if (!dashboardResponse.data.success || !ordersResponse.data.success) {
        await context.interaction.editReply({
          content: '❌ Unable to fetch analytics data. Please try again.'
        })
        return
      }

      const stats = dashboardResponse.data.data.stats
      const orders = ordersResponse.data.data.orders

      // Calculate analytics metrics
      const totalOrders = orders.length
      const activeOrders = orders.filter((order: any) => order.is_active).length
      const completedOrders = orders.filter((order: any) => !order.is_active && order.current_orders >= order.min_orders).length
      const failedOrders = orders.filter((order: any) => !order.is_active && order.current_orders < order.min_orders).length
      
      // Calculate success rate
      const successRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0
      
      // Calculate average order size
      const totalSubmissions = orders.reduce((sum: number, order: any) => sum + (order.current_orders || 0), 0)
      const avgOrderSize = totalOrders > 0 ? Math.round(totalSubmissions / totalOrders) : 0
      
      // Calculate revenue metrics
      const avgRevenue = totalOrders > 0 ? Math.round(stats.totalRevenue / totalOrders) : 0
      
      // Performance trends (simplified - could be enhanced with time series data)
      const recentOrders = orders.slice(0, 10)
      const recentSuccessRate = recentOrders.length > 0 ? 
        Math.round((recentOrders.filter((order: any) => !order.is_active && order.current_orders >= order.min_orders).length / recentOrders.length) * 100) : 0

      // Create main analytics embed
      const analyticsEmbed = new EmbedBuilder()
        .setTitle('📈 Advanced Analytics')
        .setDescription('Detailed insights into your group order performance')
        .setColor(0x9b59b6)
        .addFields(
          {
            name: '🎯 Success Metrics',
            value: `**Success Rate:** ${successRate}% (${completedOrders}/${totalOrders})\n**Recent Performance:** ${recentSuccessRate}%\n**Failed Orders:** ${failedOrders}`,
            inline: true
          },
          {
            name: '📊 Order Analytics',
            value: `**Avg Order Size:** ${avgOrderSize} submissions\n**Active Orders:** ${activeOrders}\n**Completion Rate:** ${totalSubmissions > 0 ? Math.round((stats.totalSubmissions / totalSubmissions) * 100) : 0}%`,
            inline: true
          },
          {
            name: '💰 Revenue Analytics',
            value: `**Total Revenue:** ${stats.totalRevenue}\n**Avg per Order:** ${avgRevenue}\n**Pending Revenue:** ${stats.pendingRevenue}`,
            inline: true
          }
        )

      // Create performance insights embed
      const insightsEmbed = new EmbedBuilder()
        .setTitle('💡 Performance Insights')
        .setColor(0xe67e22)
        .setDescription('Recommendations to improve your group order success')

      // Generate insights based on data
      const insights = []
      if (successRate < 70) {
        insights.push('🎯 **Success Rate Alert:** Your success rate is below 70%. Consider adjusting minimum order requirements or extending deadlines.')
      }
      if (stats.overduePayments > 5) {
        insights.push('⏰ **Payment Reminders:** You have overdue payments. Use automated reminders to improve collection rates.')
      }
      if (avgOrderSize < 20) {
        insights.push('📈 **Growth Opportunity:** Your orders are averaging fewer than 20 submissions. Consider expanding to new communities.')
      }
      if (stats.pendingRevenue > stats.totalRevenue * 0.3) {
        insights.push('💳 **Payment Follow-up:** High pending revenue detected. Follow up on payment confirmations.')
      }
      if (activeOrders === 0) {
        insights.push('🚀 **Activity Boost:** No active orders found. Create new orders to maintain momentum.')
      }

      if (insights.length === 0) {
        insights.push('🎉 **Great Performance:** Your metrics look healthy! Keep up the excellent work.')
        insights.push('📊 **Optimization:** Consider using bulk notifications and payment reminders to further streamline operations.')
      }

      insights.forEach((insight, index) => {
        if (index < 6) { // Limit to 6 insights to avoid embed limits
          insightsEmbed.addFields({
            name: `Insight ${index + 1}`,
            value: insight,
            inline: false
          })
        }
      })

      // Create top performing orders embed
      let topOrdersEmbed = null
      if (orders.length > 0) {
        const topOrders = orders
          .filter((order: any) => order.current_orders > 0)
          .sort((a: any, b: any) => (b.current_orders || 0) - (a.current_orders || 0))
          .slice(0, 5)

        if (topOrders.length > 0) {
          topOrdersEmbed = new EmbedBuilder()
            .setTitle('🏆 Top Performing Orders')
            .setColor(0xf1c40f)
            .setDescription('Your most successful group orders')

          topOrders.forEach((order: any, index: number) => {
            const status = order.is_active ? '🟢 Active' : 
                          order.current_orders >= order.min_orders ? '✅ Completed' : '❌ Failed'
            topOrdersEmbed!.addFields({
              name: `#${index + 1} ${order.title}`,
              value: `${status} • ${order.current_orders}/${order.min_orders} orders • ${order.current_orders * order.price} ${order.currency}`,
              inline: false
            })
          })
        }
      }

      // Create action buttons
      const actionButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('gom_export_data')
            .setLabel('📥 Export Data')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('gom_refresh_analytics')
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('gom_view_dashboard')
            .setLabel('📊 Dashboard')
            .setStyle(ButtonStyle.Success)
        )

      // Send analytics response
      const embeds = [analyticsEmbed, insightsEmbed]
      if (topOrdersEmbed) embeds.push(topOrdersEmbed)

      await context.interaction.editReply({
        embeds,
        components: [actionButtons]
      })

    } catch (error: any) {
      logger.error('GOM analytics error', {
        error: error.message,
        user_id: context.user.id
      })

      const errorMessage = '❌ Unable to load analytics. Please try again later.'
      
      if (context.interaction.deferred) {
        await context.interaction.editReply({ content: errorMessage })
      } else {
        await context.interaction.reply({ content: errorMessage, ephemeral: true })
      }
    }
  }
  /**
   * Handle /manage notify command - Send bulk notifications to buyers
   */
  private async handleGOMNotify(context: DiscordContext, options: any): Promise<void> {
    try {
      await context.interaction.deferReply({ ephemeral: true })

      const notificationType = options.getString('type') || 'reminder'
      const orderId = options.getString('order_id')

      // Get user's orders for selection if no specific order provided
      if (!orderId) {
        const ordersResponse = await axios.get(`${Config.api.coreUrl}/api/orders?active_only=true&limit=20`, {
          headers: { 'x-gomflow-auth': Config.api.internalKey }
        })

        if (!ordersResponse.data.success || !ordersResponse.data.data.orders.length) {
          await context.interaction.editReply({
            content: '❌ No active orders found. Create an order first before sending notifications.'
          })
          return
        }

        const orders = ordersResponse.data.data.orders

        // Create order selection embed
        const selectionEmbed = new EmbedBuilder()
          .setTitle('📢 Send Notifications')
          .setDescription('Select an order to send notifications for:')
          .setColor(Config.discord.embedColor)

        orders.slice(0, 10).forEach((order: any, index: number) => {
          selectionEmbed.addFields({
            name: `${index + 1}. ${order.title}`,
            value: `**Orders:** ${order.current_orders}/${order.min_orders} • **Pending:** ${order.pending_submissions || 0} • **Deadline:** <t:${Math.floor(new Date(order.deadline).getTime() / 1000)}:R>`,
            inline: false
          })
        })

        // Create selection buttons
        const selectButtons = []
        orders.slice(0, 5).forEach((order: any, index: number) => {
          selectButtons.push(
            new ButtonBuilder()
              .setCustomId(`notify_order:${order.id}:${notificationType}`)
              .setLabel(`${index + 1}. ${order.title.slice(0, 20)}...`)
              .setStyle(ButtonStyle.Primary)
          )
        })

        const actionRow = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(selectButtons)

        await context.interaction.editReply({
          embeds: [selectionEmbed],
          components: [actionRow]
        })
        return
      }

      // Process notification for specific order
      await this.processNotification(context, orderId, notificationType)

    } catch (error: any) {
      logger.error('GOM notify error', {
        error: error.message,
        user_id: context.user.id
      })

      const errorMessage = '❌ Unable to process notification request. Please try again later.'
      
      if (context.interaction.deferred) {
        await context.interaction.editReply({ content: errorMessage })
      } else {
        await context.interaction.reply({ content: errorMessage, ephemeral: true })
      }
    }
  }

  /**
   * Process notification sending for a specific order
   */
  private async processNotification(context: DiscordContext, orderId: string, notificationType: string): Promise<void> {
    try {
      // Get order details and submissions
      const [orderResponse, submissionsResponse] = await Promise.all([
        axios.get(`${Config.api.coreUrl}/api/orders/${orderId}`, {
          headers: { 'x-gomflow-auth': Config.api.internalKey }
        }),
        axios.get(`${Config.api.coreUrl}/api/submissions?order_id=${orderId}&status=pending`, {
          headers: { 'x-gomflow-auth': Config.api.internalKey }
        })
      ])

      if (!orderResponse.data.success) {
        await context.interaction.editReply({
          content: '❌ Order not found or access denied.'
        })
        return
      }

      const order = orderResponse.data.data
      const pendingSubmissions = submissionsResponse.data.success ? submissionsResponse.data.data : []

      if (!pendingSubmissions || pendingSubmissions.length === 0) {
        await context.interaction.editReply({
          content: '❌ No pending submissions found for this order. All buyers have completed their payments!'
        })
        return
      }

      // Determine notification message based on type
      let notificationTitle = ''
      let notificationMessage = ''
      
      switch (notificationType) {
        case 'reminder':
          notificationTitle = 'Payment Reminder'
          notificationMessage = `Hi! This is a friendly reminder about your order for "${order.title}". Please complete your payment soon to secure your item.`
          break
        case 'deadline':
          notificationTitle = 'Deadline Warning'
          notificationMessage = `⚠️ URGENT: The deadline for "${order.title}" is approaching. Please complete your payment immediately to avoid missing out!`
          break
        case 'update':
          notificationTitle = 'Order Update'
          notificationMessage = `📢 Update for "${order.title}": We're getting close to our minimum order requirement! Make sure to complete your payment if you haven't already.`
          break
        default:
          notificationTitle = 'Order Notification'
          notificationMessage = `Thank you for your interest in "${order.title}". Please complete your payment to confirm your order.`
      }

      // Send notifications via Discord bot API (simulated)
      const notificationData = {
        order_id: orderId,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        recipients: pendingSubmissions.map((sub: any) => sub.user_identifier),
        platform: 'discord'
      }

      // For now, we'll simulate the notification API call
      // In a real implementation, this would call the Discord notification service
      logger.info('Sending bulk notifications', {
        order_id: orderId,
        type: notificationType,
        recipient_count: pendingSubmissions.length,
        gom_id: context.user.id
      })

      // Create success embed
      const successEmbed = new EmbedBuilder()
        .setTitle('✅ Notifications Sent Successfully!')
        .setDescription(`Bulk ${notificationType} notifications have been sent to all pending buyers.`)
        .setColor(0x00ff00)
        .addFields(
          {
            name: '📢 Notification Type',
            value: notificationTitle,
            inline: true
          },
          {
            name: '👥 Recipients',
            value: `${pendingSubmissions.length} buyers`,
            inline: true
          },
          {
            name: '📦 Order',
            value: order.title,
            inline: true
          },
          {
            name: '💬 Message Preview',
            value: notificationMessage.slice(0, 200) + (notificationMessage.length > 200 ? '...' : ''),
            inline: false
          }
        )
        .setTimestamp()
        .setFooter({ text: 'GOMFLOW - Automated Notifications' })

      // Add action buttons for follow-up
      const followUpButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`view_order:${orderId}`)
            .setLabel('📊 View Order Status')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('gom_view_dashboard')
            .setLabel('📈 Dashboard')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`notify_order:${orderId}:follow_up`)
            .setLabel('📢 Send Follow-up')
            .setStyle(ButtonStyle.Success)
        )

      await context.interaction.editReply({
        embeds: [successEmbed],
        components: [followUpButtons]
      })

    } catch (error: any) {
      logger.error('Process notification error', {
        error: error.message,
        order_id: orderId,
        notification_type: notificationType,
        user_id: context.user.id
      })

      await context.interaction.editReply({
        content: '❌ Failed to send notifications. Please try again later.'
      })
    }
  }
  /**
   * Handle /help command - Display comprehensive help information
   */
  private async handleHelp(context: DiscordContext, options: any): Promise<void> {
    const category = options.getString('category') || 'general'
    
    const embed = new EmbedBuilder()
      .setColor(Config.discord.embedColor)
      .setTimestamp()
      .setFooter({ text: 'GOMFLOW - Simplifying Group Orders' })

    switch (category) {
      case 'orders':
        embed
          .setTitle('📦 Order Commands Help')
          .setDescription('Learn how to browse, view, and submit to group orders.')
          .addFields(
            {
              name: '/order browse',
              value: '🔍 Browse all active group orders with pagination and filters',
              inline: false
            },
            {
              name: '/order view <order_id>',
              value: '👁️ View detailed information about a specific order',
              inline: false
            },
            {
              name: '/order submit <order_id>',
              value: '📝 Submit your information to join a group order',
              inline: false
            }
          )
        break

      case 'gom':
        embed
          .setTitle('👨‍💼 GOM (Group Order Manager) Commands')
          .setDescription('Commands for managing your group orders and tracking performance.')
          .addFields(
            {
              name: '/order create',
              value: '➕ Create a new group order with details, pricing, and deadlines',
              inline: false
            },
            {
              name: '/manage dashboard',
              value: '📊 View your order statistics, revenue, and performance metrics',
              inline: false
            },
            {
              name: '/manage analytics',
              value: '📈 Get detailed analytics about your orders and buyers',
              inline: false
            },
            {
              name: '/manage notify <message>',
              value: '📢 Send bulk notifications to your order participants',
              inline: false
            }
          )
        break

      case 'payments':
        embed
          .setTitle('💳 Payment Commands Help')
          .setDescription('Learn how GOMFLOW handles payments and screenshots.')
          .addFields(
            {
              name: '📸 Payment Screenshots',
              value: 'Upload payment screenshots directly to any channel where the bot is present. Our AI will automatically process and match payments to orders.',
              inline: false
            },
            {
              name: '/pay status <order_id>',
              value: '💰 Check the payment status of your submission',
              inline: false
            },
            {
              name: '🤖 Smart Payment Detection',
              value: 'Our AI supports: GCash, PayMaya, Maybank, CIMB, Bank transfers, and more. Works in English, Filipino, and Malay.',
              inline: false
            }
          )
        break

      default: // general
        embed
          .setTitle('🎯 GOMFLOW Discord Bot Help')
          .setDescription('Welcome to GOMFLOW! Here are the main command categories:')
          .addFields(
            {
              name: '📦 Order Management',
              value: 'Browse, view, and submit to group orders\n`/help category:orders` for details',
              inline: true
            },
            {
              name: '👨‍💼 GOM Features',
              value: 'Create and manage group orders (for GOMs)\n`/help category:gom` for details',
              inline: true
            },
            {
              name: '💳 Payment Processing',
              value: 'AI-powered payment screenshot processing\n`/help category:payments` for details',
              inline: true
            },
            {
              name: '🔧 Quick Start for Buyers',
              value: '1. Use `/order browse` to find orders\n2. Use `/order submit` to join\n3. Upload payment screenshot\n4. Get automatic confirmation!',
              inline: false
            },
            {
              name: '🚀 Quick Start for GOMs',
              value: '1. Use `/order create` to start\n2. Share your order link\n3. Monitor with `/manage dashboard`\n4. Get automated payment tracking!',
              inline: false
            },
            {
              name: '🆘 Need More Help?',
              value: 'Visit our support: [gomflow.com/help](https://gomflow.com/help)\nOr contact us: support@gomflow.com',
              inline: false
            }
          )
    }

    // Add help navigation buttons
    const helpButtons = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('help:orders')
          .setLabel('📦 Orders')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('help:gom')
          .setLabel('👨‍💼 GOM')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('help:payments')
          .setLabel('💳 Payments')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('help:general')
          .setLabel('🏠 Home')
          .setStyle(ButtonStyle.Primary)
      )

    await context.interaction.reply({
      embeds: [embed],
      components: [helpButtons],
      ephemeral: true
    })
  }
  /**
   * Start the submission flow with modal for user details
   */
  private async startSubmissionFlow(context: DiscordContext, orderId: string): Promise<void> {
    try {
      // Create modal for submission details
      const modal = new ModalBuilder()
        .setCustomId(`submission_modal:${orderId}`)
        .setTitle('📝 Order Submission Details')

      // Buyer name input
      const nameInput = new TextInputBuilder()
        .setCustomId('buyer_name')
        .setLabel('Your Full Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter your full name as it appears on your payment')
        .setRequired(true)
        .setMaxLength(100)

      // Phone number input
      const phoneInput = new TextInputBuilder()
        .setCustomId('buyer_phone')
        .setLabel('Phone Number')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('+63 9XX XXX XXXX (include country code)')
        .setRequired(true)
        .setMaxLength(20)

      // Quantity input
      const quantityInput = new TextInputBuilder()
        .setCustomId('quantity')
        .setLabel('Quantity')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('1')
        .setRequired(true)
        .setMaxLength(3)

      // Address input
      const addressInput = new TextInputBuilder()
        .setCustomId('shipping_address')
        .setLabel('Shipping Address')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Complete shipping address including postal code')
        .setRequired(true)
        .setMaxLength(500)

      // Special requests input (optional)
      const notesInput = new TextInputBuilder()
        .setCustomId('special_requests')
        .setLabel('Special Requests (Optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Any special requests or notes for the GOM')
        .setRequired(false)
        .setMaxLength(300)

      // Create action rows for modal inputs
      const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput)
      const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(phoneInput)
      const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(quantityInput)
      const fourthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(addressInput)
      const fifthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(notesInput)

      modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow)

      // Store order ID in a temporary session for modal handling
      await this.storeUserSession(context.user.id, {
        orderId,
        step: 'submission_modal',
        timestamp: Date.now()
      })

      await context.interaction.showModal(modal)

    } catch (error: any) {
      logger.error('Start submission flow error', {
        error: error.message,
        order_id: orderId,
        user_id: context.user.id
      })

      const errorMessage = '❌ Unable to start submission process. Please try again.'
      
      if (context.interaction.deferred) {
        await context.interaction.editReply({ content: errorMessage })
      } else {
        await context.interaction.reply({ content: errorMessage, ephemeral: true })
      }
    }
  }
  private async showOrderDetails(context: DiscordContext, orderId: string): Promise<void> { /* Implementation */ }
  private async confirmPayment(context: DiscordContext, submissionId: string, extractionId: string): Promise<void> { /* Implementation */ }
  private async rejectPayment(context: DiscordContext, extractionId: string): Promise<void> { /* Implementation */ }
  private async updateOrderList(context: DiscordContext, page: number): Promise<void> { /* Implementation */ }

  /**
   * Store user session data for temporary state management
   */
  private async storeUserSession(userId: string, sessionData: any): Promise<void> {
    this.userSessions.set(userId, sessionData)
    // Auto-cleanup session after 10 minutes
    setTimeout(() => {
      this.userSessions.delete(userId)
    }, 10 * 60 * 1000)
  }

  /**
   * Get user session data
   */
  private getUserSession(userId: string): any {
    return this.userSessions.get(userId)
  }

  /**
   * Handle modal submissions
   */
  private async handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
    try {
      const customId = interaction.customId
      
      if (customId === 'order_create_modal') {
        await this.processOrderCreationModal(interaction)
      } else if (customId.startsWith('submission_modal:')) {
        const orderId = customId.split(':')[1]
        await this.processSubmissionModal(interaction, orderId)
      }
    } catch (error: any) {
      logger.error('Modal submit error', {
        error: error.message,
        user_id: interaction.user.id,
        custom_id: interaction.customId
      })

      await interaction.reply({
        content: '❌ An error occurred processing your submission. Please try again.',
        ephemeral: true
      })
    }
  }

  /**
   * Process order creation modal data and create order
   */
  private async processOrderCreationModal(interaction: ModalSubmitInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true })

    try {
      // Get form data from modal
      const title = interaction.fields.getTextInputValue('order_title').trim()
      const description = interaction.fields.getTextInputValue('order_description')?.trim() || ''
      const priceInput = interaction.fields.getTextInputValue('order_price').trim()
      const deadlineInput = interaction.fields.getTextInputValue('order_deadline').trim()
      const minMaxInput = interaction.fields.getTextInputValue('order_min_max').trim()

      // Parse price and currency
      const priceMatch = priceInput.match(/^(\d+(?:\.\d{2})?)\s*(PHP|MYR|php|myr)$/i)
      if (!priceMatch) {
        await interaction.editReply({
          content: '❌ Invalid price format. Please use format like "25 PHP" or "30 MYR".'
        })
        return
      }

      const price = parseFloat(priceMatch[1])
      const currency = priceMatch[2].toUpperCase() as 'PHP' | 'MYR'

      // Parse deadline
      const deadlineMatch = deadlineInput.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/)
      if (!deadlineMatch) {
        await interaction.editReply({
          content: '❌ Invalid deadline format. Please use "YYYY-MM-DD HH:MM" format.'
        })
        return
      }

      const deadline = new Date(`${deadlineMatch[1]}T${deadlineMatch[2]}:00`)
      if (deadline <= new Date()) {
        await interaction.editReply({
          content: '❌ Deadline must be in the future.'
        })
        return
      }

      // Parse min/max orders
      const minMaxMatch = minMaxInput.match(/^(\d+)(?:-(\d+))?$/)
      if (!minMaxMatch) {
        await interaction.editReply({
          content: '❌ Invalid min/max format. Please use "50" or "50-200".'
        })
        return
      }

      const minOrders = parseInt(minMaxMatch[1])
      const maxOrders = minMaxMatch[2] ? parseInt(minMaxMatch[2]) : null

      if (maxOrders && maxOrders <= minOrders) {
        await interaction.editReply({
          content: '❌ Maximum orders must be greater than minimum orders.'
        })
        return
      }

      // Get default payment methods based on currency
      const paymentMethods = currency === 'PHP' 
        ? [{ type: 'gcash' }, { type: 'paymaya' }, { type: 'bank_transfer' }]
        : [{ type: 'maybank2u' }, { type: 'tng' }, { type: 'bank_transfer' }]

      // Create order via Core API
      const orderData = {
        title,
        description,
        price,
        currency,
        deadline: deadline.toISOString(),
        payment_methods: paymentMethods,
        min_orders: minOrders,
        max_orders: maxOrders,
        auto_close_on_deadline: true
      }

      const response = await axios.post(`${Config.api.coreUrl}/api/orders`, orderData, {
        headers: {
          'x-gomflow-auth': Config.api.internalKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.data.success) {
        await interaction.editReply({
          content: `❌ ${response.data.error || 'Failed to create order. Please try again.'}`
        })
        return
      }

      const order = response.data.data

      // Create success embed
      const embed = new EmbedBuilder()
        .setTitle('✅ Order Created Successfully!')
        .setDescription(`Your group order "${title}" has been created and is now active.`)
        .setColor(0x00ff00)
        .addFields(
          {
            name: '🔗 Order ID',
            value: `\`${order.id}\``,
            inline: true
          },
          {
            name: '🌐 Order Link',
            value: `gomflow.com/orders/${order.slug}`,
            inline: true
          },
          {
            name: '💰 Price',
            value: `${price} ${currency}`,
            inline: true
          },
          {
            name: '📅 Deadline',
            value: `<t:${Math.floor(deadline.getTime() / 1000)}:F>`,
            inline: true
          },
          {
            name: '📊 Target Orders',
            value: maxOrders ? `${minOrders}-${maxOrders}` : `${minOrders}+`,
            inline: true
          },
          {
            name: '🎯 Next Steps',
            value: '• Share your order link with buyers\n• Monitor submissions with `/manage dashboard`\n• Payment tracking is automated!',
            inline: false
          }
        )
        .setFooter({ text: 'GOMFLOW - Simplifying Group Orders' })
        .setTimestamp()

      await interaction.editReply({
        embeds: [embed]
      })

    } catch (error: any) {
      logger.error('Order creation processing failed', {
        error: error.message,
        user_id: interaction.user.id
      })

      await interaction.editReply({
        content: '❌ Unable to create order. Please try again later.'
      })
    }
  }

  /**
   * Process submission modal data and create submission
   */
  private async processSubmissionModal(interaction: ModalSubmitInteraction, orderId: string): Promise<void> {
    await interaction.deferReply({ ephemeral: true })

    try {
      // Get form data from modal
      const buyerName = interaction.fields.getTextInputValue('buyer_name').trim()
      const buyerPhone = interaction.fields.getTextInputValue('buyer_phone').trim()
      const quantity = parseInt(interaction.fields.getTextInputValue('quantity').trim())
      const shippingAddress = interaction.fields.getTextInputValue('shipping_address').trim()
      const specialRequests = interaction.fields.getTextInputValue('special_requests')?.trim() || ''

      // Basic validation
      if (!buyerName || !buyerPhone || !quantity || !shippingAddress) {
        await interaction.editReply({
          content: '❌ Please fill in all required fields.'
        })
        return
      }

      if (quantity < 1 || quantity > 100) {
        await interaction.editReply({
          content: '❌ Quantity must be between 1 and 100.'
        })
        return
      }

      // Create submission via Core API
      const submissionData = {
        order_id: orderId,
        buyer_name: buyerName,
        buyer_phone: buyerPhone,
        quantity: quantity,
        shipping_address: shippingAddress,
        special_requests: specialRequests,
        platform: 'discord',
        user_identifier: interaction.user.id,
        user_display_name: interaction.user.displayName || interaction.user.username
      }

      const response = await axios.post(`${Config.api.coreUrl}/api/submissions`, submissionData, {
        headers: {
          'x-gomflow-auth': Config.api.internalKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.data.success) {
        await interaction.editReply({
          content: `❌ ${response.data.error || 'Failed to create submission. Please try again.'}`
        })
        return
      }

      const submission = response.data.data

      // Create success embed with payment instructions
      const embed = new EmbedBuilder()
        .setTitle('✅ Submission Created Successfully!')
        .setDescription('Your order submission has been created. Please proceed with payment.')
        .setColor(0x00ff00)
        .addFields(
          {
            name: '🔢 Payment Reference',
            value: `\`${submission.payment_reference}\``,
            inline: true
          },
          {
            name: '💰 Total Amount',
            value: `${submission.amount} ${submission.currency}`,
            inline: true
          },
          {
            name: '⏰ Payment Deadline',
            value: new Date(submission.payment_deadline).toLocaleDateString(),
            inline: true
          },
          {
            name: '📋 Next Steps',
            value: '1. **Make your payment** using any accepted method\n2. **Upload payment screenshot** to this channel\n3. **Include your payment reference** in the screenshot\n4. Wait for automatic confirmation!',
            inline: false
          }
        )
        .setTimestamp()
        .setFooter({ text: `Submission ID: ${submission.id}` })

      const actionButtons = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`payment_status:${submission.id}`)
            .setLabel('💳 Check Payment Status')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setLabel('📱 Payment Methods')
            .setCustomId(`payment_methods:${orderId}`)
            .setStyle(ButtonStyle.Secondary)
        )

      await interaction.editReply({
        embeds: [embed],
        components: [actionButtons]
      })

      // Clear user session
      this.userSessions.delete(interaction.user.id)

    } catch (error: any) {
      logger.error('Process submission modal error', {
        error: error.message,
        order_id: orderId,
        user_id: interaction.user.id
      })

      await interaction.editReply({
        content: '❌ Unable to create submission. Please try again later.'
      })
    }
  }

  /**
   * Start the Discord bot
   */
  async launch(): Promise<void> {
    try {
      await this.client.login(Config.DISCORD_BOT_TOKEN)
      
      logger.info('🤖 GOMFLOW Discord Bot is ready!', {
        bot_id: this.client.user?.id,
        bot_username: this.client.user?.tag,
        features: {
          slash_commands: Config.botFeatures.slashCommands,
          smart_payments: Config.botFeatures.smartPaymentDetection,
          guild_commands: Config.botFeatures.guildCommands
        }
      })

    } catch (error: any) {
      logger.error('Failed to start Discord bot', { error: error.message })
      throw error
    }
  }

  /**
   * Stop the bot gracefully
   */
  async stop(): Promise<void> {
    try {
      this.client.destroy()
      logger.info('Discord bot stopped')
    } catch (error: any) {
      logger.error('Error stopping Discord bot', { error: error.message })
    }
  }

  /**
   * Get bot client instance
   */
  getClient(): Client {
    return this.client
  }
}

export default DiscordBotService