import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Types import - these will match our database schema
import type { 
  User, 
  Order, 
  Submission, 
  PaymentTransaction,
  PlatformConnection,
  Message,
  PlatformPost
} from '@gomflow/shared'

// Database interface - represents the complete schema
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>
      }
      orders: {
        Row: Order & {
          user?: User
        }
        Insert: Omit<Order, 'id' | 'created_at' | 'user'>
        Update: Partial<Omit<Order, 'id' | 'created_at' | 'user'>>
      }
      submissions: {
        Row: Submission & {
          order?: Order
        }
        Insert: Omit<Submission, 'id' | 'created_at' | 'updated_at' | 'order'>
        Update: Partial<Omit<Submission, 'id' | 'created_at' | 'updated_at' | 'order'>>
      }
      payment_transactions: {
        Row: PaymentTransaction
        Insert: Omit<PaymentTransaction, 'id' | 'created_at'>
        Update: Partial<Omit<PaymentTransaction, 'id' | 'created_at'>>
      }
      platform_connections: {
        Row: PlatformConnection
        Insert: Omit<PlatformConnection, 'id' | 'created_at'>
        Update: Partial<Omit<PlatformConnection, 'id' | 'created_at'>>
      }
      messages: {
        Row: Message
        Insert: Omit<Message, 'id' | 'created_at'>
        Update: Partial<Omit<Message, 'id' | 'created_at'>>
      }
      platform_posts: {
        Row: PlatformPost
        Insert: Omit<PlatformPost, 'id' | 'created_at'>
        Update: Partial<Omit<PlatformPost, 'id' | 'created_at'>>
      }
    }
    Views: {
      order_summaries: {
        Row: Order & {
          user_name: string
          username: string
          total_submissions: number
          pending_submissions: number
          paid_submissions: number
          total_quantity: number
          total_revenue: number
          pending_revenue: number
          order_status: 'expired' | 'closed' | 'active' | 'collecting'
        }
      }
    }
    Functions: {
      generate_payment_reference: {
        Args: { country_prefix: string }
        Returns: string
      }
      get_order_stats: {
        Args: { order_uuid: string }
        Returns: {
          total_submissions: number
          pending_submissions: number
          paid_submissions: number
          total_quantity: number
          total_revenue: number
          pending_revenue: number
        }
      }
      get_dashboard_stats: {
        Args: { user_uuid: string }
        Returns: {
          total_orders: number
          active_orders: number
          total_submissions: number
          pending_payments: number
          overdue_payments: number
          total_revenue: number
          pending_revenue: number
        }
      }
    }
    Enums: {
      user_plan: 'free' | 'pro' | 'gateway' | 'business'
      subscription_status: 'active' | 'inactive' | 'cancelled'
      country_code: 'PH' | 'MY'
      currency_code: 'PHP' | 'MYR'
      submission_status: 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled'
      platform_type: 'whatsapp' | 'telegram' | 'discord' | 'web'
      message_type: 'reminder' | 'confirmation' | 'query_response' | 'custom'
      message_status: 'pending' | 'sent' | 'failed' | 'delivered'
      payment_gateway: 'paymongo' | 'billplz'
      connection_type: 'group' | 'channel' | 'webhook'
      post_status: 'posted' | 'failed' | 'deleted'
    }
  }
}

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client-side Supabase client (for use in React components)
export const createSupabaseClient = () => {
  return createClientComponentClient<Database>()
}

// Server-side Supabase client (for use in API routes and server components)
export const createSupabaseServerClient = () => {
  const cookieStore = cookies()
  return createServerComponentClient<Database>({ cookies: () => cookieStore })
}

// Admin client (for server-side operations that bypass RLS)
export const createSupabaseAdminClient = () => {
  return createClient<Database>(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// Utility functions for common operations
export const supabaseUtils = {
  // Generate a unique payment reference
  async generatePaymentReference(country: 'PH' | 'MY'): Promise<string> {
    const client = createSupabaseAdminClient()
    const { data, error } = await client.rpc('generate_payment_reference', {
      country_prefix: country
    })
    
    if (error) throw error
    return data
  },

  // Get order statistics
  async getOrderStats(orderId: string) {
    const client = createSupabaseAdminClient()
    const { data, error } = await client.rpc('get_order_stats', {
      order_uuid: orderId
    })
    
    if (error) throw error
    return data
  },

  // Get dashboard statistics for a user
  async getDashboardStats(userId: string) {
    const client = createSupabaseAdminClient()
    const { data, error } = await client.rpc('get_dashboard_stats', {
      user_uuid: userId
    })
    
    if (error) throw error
    return data
  },

  // Real-time subscriptions helpers
  subscribeToOrderSubmissions(orderId: string, callback: (payload: any) => void) {
    const client = createSupabaseClient()
    return client
      .channel(`order-${orderId}-submissions`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submissions',
          filter: `order_id=eq.${orderId}`
        },
        callback
      )
      .subscribe()
  },

  subscribeToUserOrders(userId: string, callback: (payload: any) => void) {
    const client = createSupabaseClient()
    return client
      .channel(`user-${userId}-orders`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe()
  }
}

export default createSupabaseClient