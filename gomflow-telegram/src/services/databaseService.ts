import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Config } from '@/config'
import { logger } from '@/utils/logger'
import { 
  TelegramUser, 
  TelegramSession, 
  TelegramNotification,
  PaymentScreenshotData,
  BotAnalytics,
  TelegramServiceResponse
} from '@/types'

export class DatabaseService {
  private supabase: SupabaseClient

  constructor() {
    this.supabase = createClient(
      Config.SUPABASE_URL,
      Config.SUPABASE_SERVICE_ROLE_KEY
    )
  }

  /**
   * User Management
   */
  async getUser(telegramId: number): Promise<TelegramUser | null> {
    try {
      const { data, error } = await this.supabase
        .from('telegram_users')
        .select('*')
        .eq('telegram_id', telegramId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // No rows found
        throw error
      }

      return data as TelegramUser
    } catch (error: any) {
      logger.error('Failed to get user', {
        telegram_id: telegramId,
        error: error.message
      })
      throw error
    }
  }

  async createUser(userData: Partial<TelegramUser>): Promise<TelegramUser> {
    try {
      const now = new Date()
      const userToCreate = {
        ...userData,
        created_at: now,
        updated_at: now,
        last_active: now
      }

      const { data, error } = await this.supabase
        .from('telegram_users')
        .insert(userToCreate)
        .select()
        .single()

      if (error) throw error

      logger.info('Telegram user created', {
        user_id: data.id,
        telegram_id: data.telegram_id,
        username: data.username
      })

      return data as TelegramUser
    } catch (error: any) {
      logger.error('Failed to create user', {
        telegram_id: userData.telegram_id,
        error: error.message
      })
      throw error
    }
  }

  async updateUser(telegramId: number, updates: Partial<TelegramUser>): Promise<TelegramUser> {
    try {
      const { data, error } = await this.supabase
        .from('telegram_users')
        .update({
          ...updates,
          updated_at: new Date()
        })
        .eq('telegram_id', telegramId)
        .select()
        .single()

      if (error) throw error

      return data as TelegramUser
    } catch (error: any) {
      logger.error('Failed to update user', {
        telegram_id: telegramId,
        error: error.message
      })
      throw error
    }
  }

  async updateUserActivity(telegramId: number): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('telegram_users')
        .update({ last_active: new Date() })
        .eq('telegram_id', telegramId)

      if (error) throw error
    } catch (error: any) {
      logger.error('Failed to update user activity', {
        telegram_id: telegramId,
        error: error.message
      })
      // Don't throw - this is non-critical
    }
  }

  /**
   * Session Management
   */
  async getSession(sessionId: string): Promise<TelegramSession | null> {
    try {
      const { data, error } = await this.supabase
        .from('telegram_sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }

      // Check if session is expired
      if (new Date(data.expires_at) < new Date()) {
        await this.deleteSession(sessionId)
        return null
      }

      return data as TelegramSession
    } catch (error: any) {
      logger.error('Failed to get session', {
        session_id: sessionId,
        error: error.message
      })
      throw error
    }
  }

  async createSession(sessionData: Partial<TelegramSession>): Promise<TelegramSession> {
    try {
      const now = new Date()
      const expiresAt = new Date(now.getTime() + Config.bot.sessionTimeout)

      const session = {
        ...sessionData,
        created_at: now,
        updated_at: now,
        expires_at: expiresAt
      }

      const { data, error } = await this.supabase
        .from('telegram_sessions')
        .insert(session)
        .select()
        .single()

      if (error) throw error

      return data as TelegramSession
    } catch (error: any) {
      logger.error('Failed to create session', {
        user_id: sessionData.user_id,
        error: error.message
      })
      throw error
    }
  }

  async updateSession(sessionId: string, updates: Partial<TelegramSession>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('telegram_sessions')
        .update({
          ...updates,
          updated_at: new Date()
        })
        .eq('id', sessionId)

      if (error) throw error
    } catch (error: any) {
      logger.error('Failed to update session', {
        session_id: sessionId,
        error: error.message
      })
      throw error
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('telegram_sessions')
        .delete()
        .eq('id', sessionId)

      if (error) throw error
    } catch (error: any) {
      logger.error('Failed to delete session', {
        session_id: sessionId,
        error: error.message
      })
      throw error
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const { data, error } = await this.supabase
        .from('telegram_sessions')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id')

      if (error) throw error

      const deletedCount = data?.length || 0
      if (deletedCount > 0) {
        logger.info('Cleaned up expired sessions', { count: deletedCount })
      }

      return deletedCount
    } catch (error: any) {
      logger.error('Failed to cleanup expired sessions', {
        error: error.message
      })
      return 0
    }
  }

  /**
   * Payment Screenshot Management
   */
  async savePaymentScreenshot(screenshotData: PaymentScreenshotData): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('telegram_payment_screenshots')
        .insert({
          ...screenshotData,
          created_at: new Date()
        })

      if (error) throw error

      logger.info('Payment screenshot saved', {
        file_id: screenshotData.file_id,
        submission_id: screenshotData.submission_id
      })
    } catch (error: any) {
      logger.error('Failed to save payment screenshot', {
        file_id: screenshotData.file_id,
        error: error.message
      })
      throw error
    }
  }

  async updatePaymentScreenshotStatus(
    fileId: string, 
    status: PaymentScreenshotData['processing_status'],
    smartAgentResult?: PaymentScreenshotData['smart_agent_result']
  ): Promise<void> {
    try {
      const updates: any = {
        processing_status: status,
        updated_at: new Date()
      }

      if (smartAgentResult) {
        updates.smart_agent_result = smartAgentResult
      }

      const { error } = await this.supabase
        .from('telegram_payment_screenshots')
        .update(updates)
        .eq('file_id', fileId)

      if (error) throw error
    } catch (error: any) {
      logger.error('Failed to update payment screenshot status', {
        file_id: fileId,
        status,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Notification Management
   */
  async createNotification(notification: Omit<TelegramNotification, 'id' | 'created_at'>): Promise<string> {
    try {
      const { data, error } = await this.supabase
        .from('telegram_notifications')
        .insert({
          ...notification,
          created_at: new Date()
        })
        .select('id')
        .single()

      if (error) throw error

      return data.id
    } catch (error: any) {
      logger.error('Failed to create notification', {
        type: notification.type,
        chat_id: notification.chat_id,
        error: error.message
      })
      throw error
    }
  }

  async updateNotificationStatus(notificationId: string, status: TelegramNotification['status']): Promise<void> {
    try {
      const updates: any = {
        status,
        updated_at: new Date()
      }

      if (status === 'sent') {
        updates.sent_at = new Date()
      }

      const { error } = await this.supabase
        .from('telegram_notifications')
        .update(updates)
        .eq('id', notificationId)

      if (error) throw error
    } catch (error: any) {
      logger.error('Failed to update notification status', {
        notification_id: notificationId,
        status,
        error: error.message
      })
      throw error
    }
  }

  async getPendingNotifications(limit: number = 100): Promise<TelegramNotification[]> {
    try {
      const { data, error } = await this.supabase
        .from('telegram_notifications')
        .select('*')
        .eq('status', 'pending')
        .or('scheduled_at.is.null,scheduled_at.lte.' + new Date().toISOString())
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(limit)

      if (error) throw error

      return data as TelegramNotification[]
    } catch (error: any) {
      logger.error('Failed to get pending notifications', {
        error: error.message
      })
      throw error
    }
  }

  /**
   * Analytics and Reporting
   */
  async getBotAnalytics(): Promise<BotAnalytics> {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Get user counts
      const [totalUsers, activeUsers] = await Promise.all([
        this.supabase.from('telegram_users').select('id', { count: 'exact', head: true }),
        this.supabase.from('telegram_users').select('id', { count: 'exact', head: true }).gte('last_active', today.toISOString())
      ])

      // Get order and submission counts
      const [orders, submissions, payments] = await Promise.all([
        this.supabase.from('orders').select('id', { count: 'exact', head: true }).eq('created_via', 'telegram'),
        this.supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('platform', 'telegram'),
        this.supabase.from('telegram_payment_screenshots').select('id', { count: 'exact', head: true }).eq('processing_status', 'completed')
      ])

      return {
        total_users: totalUsers.count || 0,
        active_users_today: activeUsers.count || 0,
        total_orders_created: orders.count || 0,
        total_submissions: submissions.count || 0,
        payments_processed: payments.count || 0,
        commands_used: {}, // Would need additional tracking
        message_volume_by_hour: {} // Would need additional tracking
      }
    } catch (error: any) {
      logger.error('Failed to get bot analytics', {
        error: error.message
      })
      throw error
    }
  }

  async getGOMUsers(): Promise<TelegramUser[]> {
    try {
      const { data, error } = await this.supabase
        .from('telegram_users')
        .select('*')
        .eq('is_gom', true)
        .order('created_at', { ascending: false })

      if (error) throw error

      return data as TelegramUser[]
    } catch (error: any) {
      logger.error('Failed to get GOM users', {
        error: error.message
      })
      throw error
    }
  }

  /**
   * Health Check
   */
  async healthCheck(): Promise<TelegramServiceResponse<{ status: string; timestamp: string }>> {
    try {
      // Test database connection
      const { error } = await this.supabase
        .from('telegram_users')
        .select('id')
        .limit(1)
        .single()

      // Error is expected if no users exist, but connection should work
      if (error && error.code !== 'PGRST116') {
        throw error
      }

      return {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString()
        }
      }
    } catch (error: any) {
      logger.error('Database health check failed', {
        error: error.message
      })
      
      return {
        success: false,
        error: 'Database connection failed',
        message: error.message
      }
    }
  }
}

export default DatabaseService