import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// Types import - simplified version
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          created_at: string
          name: string
          email: string
          role: string
          country: 'PH' | 'MY'
        }
        Insert: {
          name: string
          email: string
          role: string
          country: 'PH' | 'MY'
        }
        Update: {
          name?: string
          email?: string
          role?: string
          country?: 'PH' | 'MY'
        }
      }
      orders: {
        Row: {
          id: string
          created_at: string
          user_id: string
          title: string
          description: string
          country: 'PH' | 'MY'
          currency: 'PHP' | 'MYR'
          status: string
        }
        Insert: {
          user_id: string
          title: string
          description: string
          country: 'PH' | 'MY'
          currency: 'PHP' | 'MYR'
          status: string
        }
        Update: {
          title?: string
          description?: string
          status?: string
        }
      }
      submissions: {
        Row: {
          id: string
          created_at: string
          order_id: string
          buyer_name: string
          buyer_contact: string
          quantity: number
          payment_proof: string
          status: string
        }
        Insert: {
          order_id: string
          buyer_name: string
          buyer_contact: string
          quantity: number
          payment_proof?: string
          status: string
        }
        Update: {
          quantity?: number
          payment_proof?: string
          status?: string
        }
      }
    }
    Views: {
      order_summaries: {
        Row: {
          id: string
          title: string
          total_submissions: number
          total_revenue: number
        }
      }
    }
    Functions: {
      get_dashboard_stats: {
        Args: { user_uuid: string }
        Returns: {
          total_orders: number
          total_submissions: number
          total_revenue: number
        }
      }
    }
    Enums: {
      user_plan: 'free' | 'pro' | 'gateway' | 'business'
      country_code: 'PH' | 'MY'
      currency_code: 'PHP' | 'MYR'
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

// Admin client (for server-side operations - simplified)
export const createSupabaseAdminClient = () => {
  return createClient<Database>(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

export default createSupabaseClient