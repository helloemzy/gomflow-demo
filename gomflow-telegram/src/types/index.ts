import { z } from 'zod'
import { Context as TelegrafContext } from 'telegraf'

// Re-export shared types
export * from '@gomflow/shared'

// Telegram-specific context interface
export interface TelegramContext extends TelegrafContext {
  session?: TelegramSession
  user?: TelegramUser
  state?: TelegramState
}

// User session data
export interface TelegramSession {
  id: string
  user_id: number
  chat_id: number
  language: 'en' | 'fil' | 'ms'
  state: string
  data: Record<string, any>
  created_at: Date
  updated_at: Date
  expires_at: Date
}

// Telegram user data
export interface TelegramUser {
  id: string
  telegram_id: number
  username?: string
  first_name: string
  last_name?: string
  language_code?: string
  is_gom: boolean
  gom_user_id?: string
  phone?: string
  email?: string
  created_at: Date
  updated_at: Date
  last_active: Date
}

// Bot conversation state
export interface TelegramState {
  command?: string
  step?: number
  data?: Record<string, any>
  timeout?: NodeJS.Timeout
}

// Bot command handler types
export type CommandHandler = (ctx: TelegramContext) => Promise<void>
export type MessageHandler = (ctx: TelegramContext) => Promise<void>
export type CallbackHandler = (ctx: TelegramContext) => Promise<void>

// Inline keyboard types
export interface InlineKeyboard {
  text: string
  callback_data?: string
  url?: string
  pay?: boolean
}

// Order creation flow data
export interface OrderCreationFlow {
  step: 'title' | 'description' | 'price' | 'currency' | 'deadline' | 'payment_methods' | 'confirm'
  data: {
    title?: string
    description?: string
    price?: number
    currency?: 'PHP' | 'MYR'
    deadline?: string
    payment_methods?: Array<{
      type: string
      details: Record<string, any>
    }>
  }
}

// Submission flow data
export interface SubmissionFlow {
  step: 'order_selection' | 'buyer_info' | 'quantity' | 'confirm'
  data: {
    order_id?: string
    buyer_name?: string
    buyer_phone?: string
    buyer_email?: string
    quantity?: number
  }
}

// Payment screenshot processing
export interface PaymentScreenshotData {
  file_id: string
  file_unique_id: string
  file_path?: string
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

// Notification types
export interface TelegramNotification {
  id: string
  type: 'order_created' | 'payment_received' | 'payment_confirmed' | 'order_deadline' | 'payment_reminder'
  chat_id: number
  message: string
  keyboard?: InlineKeyboard[][]
  priority: 'high' | 'normal' | 'low'
  scheduled_at?: Date
  sent_at?: Date
  status: 'pending' | 'sent' | 'failed'
  created_at: Date
}

// Bot analytics
export interface BotAnalytics {
  total_users: number
  active_users_today: number
  total_orders_created: number
  total_submissions: number
  payments_processed: number
  commands_used: Record<string, number>
  message_volume_by_hour: Record<string, number>
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
  })).min(1)
})

export const SubmitOrderSchema = z.object({
  order_id: z.string().uuid(),
  buyer_name: z.string().min(1).max(100),
  buyer_phone: z.string().min(1),
  buyer_email: z.string().email().optional(),
  quantity: z.number().int().positive()
})

export const ProcessPaymentSchema = z.object({
  file_id: z.string(),
  submission_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  expected_amount: z.number().positive().optional(),
  currency: z.enum(['PHP', 'MYR']).optional()
})

export type CreateOrderRequest = z.infer<typeof CreateOrderSchema>
export type SubmitOrderRequest = z.infer<typeof SubmitOrderSchema>
export type ProcessPaymentRequest = z.infer<typeof ProcessPaymentSchema>

// Service response types
export interface TelegramServiceResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Queue job types
export interface MessageJob {
  id: string
  chat_id: number
  message: string
  keyboard?: InlineKeyboard[][]
  options?: {
    parse_mode?: 'Markdown' | 'HTML'
    disable_web_page_preview?: boolean
    reply_to_message_id?: number
  }
  priority: 'high' | 'normal' | 'low'
  retry_count: number
  created_at: string
}

export interface NotificationJob {
  id: string
  type: 'order_update' | 'payment_update' | 'reminder' | 'announcement'
  recipients: number[]
  message: string
  keyboard?: InlineKeyboard[][]
  schedule_at?: string
  created_at: string
}

export interface PaymentProcessingJob {
  id: string
  chat_id: number
  message_id: number
  file_id: string
  user_id: number
  submission_context?: {
    submission_id: string
    order_id: string
    expected_amount: number
    currency: 'PHP' | 'MYR'
  }
  created_at: string
}

// Error types
export class TelegramBotError extends Error {
  constructor(
    message: string,
    public code: string,
    public chatId?: number,
    public userId?: number
  ) {
    super(message)
    this.name = 'TelegramBotError'
  }
}

export class RateLimitError extends TelegramBotError {
  constructor(chatId: number, retryAfter: number) {
    super(`Rate limit exceeded. Retry after ${retryAfter}s`, 'RATE_LIMIT', chatId)
  }
}

export class ValidationError extends TelegramBotError {
  constructor(message: string, chatId?: number) {
    super(message, 'VALIDATION_ERROR', chatId)
  }
}

// Bot menu templates
export interface BotMenus {
  main: InlineKeyboard[][]
  orders: InlineKeyboard[][]
  payments: InlineKeyboard[][]
  settings: InlineKeyboard[][]
  gom: InlineKeyboard[][]
}

// Language templates
export interface LanguageTemplates {
  commands: Record<string, string>
  messages: Record<string, string>
  errors: Record<string, string>
  keyboards: Record<string, string>
}