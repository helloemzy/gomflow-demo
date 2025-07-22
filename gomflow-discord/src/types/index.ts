import { z } from 'zod'
import { 
  Client, 
  ChatInputCommandInteraction, 
  ButtonInteraction, 
  SelectMenuInteraction,
  ModalSubmitInteraction,
  Guild,
  User,
  GuildMember,
  Channel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  SelectMenuBuilder
} from 'discord.js'

// Re-export shared types
export * from '@gomflow/shared'

// Discord-specific interaction types
export interface DiscordContext {
  client: Client
  interaction: ChatInputCommandInteraction | ButtonInteraction | SelectMenuInteraction | ModalSubmitInteraction
  guild?: Guild
  user: User
  member?: GuildMember
  channel?: Channel
  session?: DiscordSession
}

// User session data for Discord
export interface DiscordSession {
  id: string
  user_id: string
  guild_id?: string
  channel_id: string
  language: 'en' | 'fil' | 'ms'
  state: string
  data: Record<string, any>
  created_at: Date
  updated_at: Date
  expires_at: Date
}

// Discord user data
export interface DiscordUser {
  id: string
  discord_id: string
  username: string
  discriminator: string
  avatar?: string
  is_gom: boolean
  gom_user_id?: string
  guilds: string[] // Guild IDs where user is active
  created_at: Date
  updated_at: Date
  last_active: Date
}

// Discord guild (server) data
export interface DiscordGuild {
  id: string
  guild_id: string
  name: string
  icon?: string
  owner_id: string
  settings: DiscordGuildSettings
  gom_users: string[] // Discord user IDs with GOM permissions
  created_at: Date
  updated_at: Date
}

// Guild-specific settings
export interface DiscordGuildSettings {
  default_channel?: string
  gom_role?: string
  order_category?: string
  notifications_channel?: string
  language: 'en' | 'fil' | 'ms'
  timezone: string
  features: {
    auto_threading: boolean
    payment_notifications: boolean
    order_reminders: boolean
    analytics_sharing: boolean
  }
}

// Command handler types
export type SlashCommandHandler = (context: DiscordContext, options: any) => Promise<void>
export type ButtonHandler = (context: DiscordContext) => Promise<void>
export type SelectMenuHandler = (context: DiscordContext, values: string[]) => Promise<void>
export type ModalHandler = (context: DiscordContext, fields: Map<string, string>) => Promise<void>

// Embed templates
export interface EmbedTemplate {
  title?: string
  description?: string
  color?: number
  thumbnail?: { url: string }
  image?: { url: string }
  fields?: Array<{
    name: string
    value: string
    inline?: boolean
  }>
  footer?: {
    text: string
    iconURL?: string
  }
  timestamp?: Date
}

// Order display embed data
export interface OrderEmbedData {
  order_id: string
  title: string
  description?: string
  price: number
  currency: 'PHP' | 'MYR'
  deadline: Date
  current_submissions: number
  max_submissions?: number
  gom_name: string
  status: 'draft' | 'active' | 'closed' | 'fulfilled'
  payment_methods: Array<{
    type: string
    details: Record<string, any>
  }>
  image_url?: string
}

// Submission flow data
export interface SubmissionFlow {
  step: 'order_selection' | 'buyer_info' | 'quantity' | 'payment_method' | 'confirm'
  data: {
    order_id?: string
    buyer_name?: string
    buyer_phone?: string
    buyer_email?: string
    quantity?: number
    payment_method?: string
  }
}

// Payment screenshot processing
export interface PaymentAttachmentData {
  attachment_id: string
  discord_message_id: string
  file_url: string
  file_name: string
  file_size: number
  submission_id?: string
  order_id?: string
  expected_amount?: number
  currency?: 'PHP' | 'MYR'
  processing_status: 'uploaded' | 'processing' | 'completed' | 'failed'
  smart_agent_result?: {
    extraction_id: string
    confidence: number
    matches: number
    auto_approved: boolean
  }
}

// Discord notification types
export interface DiscordNotification {
  id: string
  type: 'order_created' | 'payment_received' | 'payment_confirmed' | 'order_deadline' | 'payment_reminder' | 'announcement'
  guild_id?: string
  channel_id: string
  user_id?: string
  embed: EmbedTemplate
  components?: any[] // Discord action rows
  priority: 'high' | 'normal' | 'low'
  scheduled_at?: Date
  sent_at?: Date
  status: 'pending' | 'sent' | 'failed'
  created_at: Date
}

// Bot analytics
export interface BotAnalytics {
  total_guilds: number
  active_guilds_today: number
  total_users: number
  active_users_today: number
  commands_used: Record<string, number>
  interactions_by_type: Record<string, number>
  orders_created: number
  submissions_processed: number
  payments_processed: number
}

// API request/response schemas
export const CreateOrderSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  price: z.number().positive(),
  currency: z.enum(['PHP', 'MYR']),
  deadline: z.string().datetime(),
  payment_methods: z.array(z.object({
    type: z.string(),
    details: z.record(z.any())
  })).min(1),
  max_submissions: z.number().int().positive().optional(),
  image_url: z.string().url().optional()
})

export const SubmitOrderSchema = z.object({
  order_id: z.string().uuid(),
  buyer_name: z.string().min(1).max(100),
  buyer_phone: z.string().min(1),
  buyer_email: z.string().email().optional(),
  quantity: z.number().int().positive()
})

export const ProcessPaymentSchema = z.object({
  attachment_id: z.string(),
  submission_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  expected_amount: z.number().positive().optional(),
  currency: z.enum(['PHP', 'MYR']).optional()
})

export const GuildSettingsSchema = z.object({
  default_channel: z.string().optional(),
  gom_role: z.string().optional(),
  order_category: z.string().optional(),
  notifications_channel: z.string().optional(),
  language: z.enum(['en', 'fil', 'ms']).default('en'),
  timezone: z.string().default('Asia/Manila'),
  features: z.object({
    auto_threading: z.boolean().default(true),
    payment_notifications: z.boolean().default(true),
    order_reminders: z.boolean().default(true),
    analytics_sharing: z.boolean().default(false)
  }).default({})
})

export type CreateOrderRequest = z.infer<typeof CreateOrderSchema>
export type SubmitOrderRequest = z.infer<typeof SubmitOrderSchema>
export type ProcessPaymentRequest = z.infer<typeof ProcessPaymentSchema>
export type GuildSettingsRequest = z.infer<typeof GuildSettingsSchema>

// Service response types
export interface DiscordServiceResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Queue job types
export interface MessageJob {
  id: string
  guild_id?: string
  channel_id: string
  user_id?: string
  embed: EmbedTemplate
  components?: any[]
  priority: 'high' | 'normal' | 'low'
  retry_count: number
  created_at: string
}

export interface NotificationJob {
  id: string
  type: 'order_update' | 'payment_update' | 'reminder' | 'announcement'
  recipients: Array<{
    guild_id?: string
    channel_id?: string
    user_id?: string
  }>
  embed: EmbedTemplate
  components?: any[]
  schedule_at?: string
  created_at: string
}

export interface InteractionJob {
  id: string
  interaction_type: 'command' | 'button' | 'select_menu' | 'modal'
  user_id: string
  guild_id?: string
  channel_id: string
  interaction_data: any
  context: Record<string, any>
  created_at: string
}

export interface PaymentProcessingJob {
  id: string
  guild_id?: string
  channel_id: string
  message_id: string
  attachment_id: string
  user_id: string
  submission_context?: {
    submission_id: string
    order_id: string
    expected_amount: number
    currency: 'PHP' | 'MYR'
  }
  created_at: string
}

// Error types
export class DiscordBotError extends Error {
  constructor(
    message: string,
    public code: string,
    public guildId?: string,
    public userId?: string,
    public channelId?: string
  ) {
    super(message)
    this.name = 'DiscordBotError'
  }
}

export class InteractionError extends DiscordBotError {
  constructor(message: string, interactionId: string, userId?: string) {
    super(message, 'INTERACTION_ERROR', undefined, userId)
  }
}

export class CommandError extends DiscordBotError {
  constructor(message: string, commandName: string, userId?: string) {
    super(message, 'COMMAND_ERROR', undefined, userId)
  }
}

export class PermissionError extends DiscordBotError {
  constructor(message: string, guildId?: string, userId?: string) {
    super(message, 'PERMISSION_ERROR', guildId, userId)
  }
}

// Embed utility types
export interface OrderListEmbed {
  orders: OrderEmbedData[]
  page: number
  totalPages: number
  totalOrders: number
}

export interface GOMDashboardEmbed {
  totalOrders: number
  activeOrders: number
  totalSubmissions: number
  pendingPayments: number
  revenue: {
    amount: number
    currency: 'PHP' | 'MYR'
  }
  recentActivity: Array<{
    type: string
    description: string
    timestamp: Date
  }>
}

// Language templates for Discord
export interface DiscordLanguageTemplates {
  commands: Record<string, string>
  embeds: Record<string, string>
  buttons: Record<string, string>
  messages: Record<string, string>
  errors: Record<string, string>
}

// Component builders
export type EmbedBuilderFunction = (data: any) => EmbedBuilder
export type ActionRowBuilderFunction = (data: any) => ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>