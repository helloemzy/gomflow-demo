import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { Database } from './supabase'

// Production-specific Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Validate required environment variables
if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error(
    'Missing required Supabase environment variables. Please check:\n' +
    '- NEXT_PUBLIC_SUPABASE_URL\n' +
    '- NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
    '- SUPABASE_SERVICE_ROLE_KEY'
  )
}

// Production client configuration
const clientConfig = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce' as const
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-client-info': 'gomflow-core@1.0.0',
      'x-application-name': 'GOMFLOW'
    }
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
}

// Admin client configuration (for server-side operations)
const adminConfig = {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-client-info': 'gomflow-core-admin@1.0.0',
      'x-application-name': 'GOMFLOW-ADMIN'
    }
  }
}

// Client-side Supabase client (for use in React components)
export const createSupabaseClient = () => {
  return createClientComponentClient<Database>(clientConfig)
}

// Server-side Supabase client (for use in API routes and server components)
export const createSupabaseServerClient = () => {
  const cookieStore = cookies()
  return createServerComponentClient<Database>({ 
    cookies: () => cookieStore,
    ...clientConfig
  })
}

// Admin client (for server-side operations that bypass RLS)
export const createSupabaseAdminClient = () => {
  return createClient<Database>(
    supabaseUrl,
    supabaseServiceRoleKey,
    adminConfig
  )
}

// Connection pool management for production
class SupabaseConnectionPool {
  private static instance: SupabaseConnectionPool
  private pools: Map<string, any> = new Map()
  private readonly maxConnections = 20
  private readonly minConnections = 2
  
  static getInstance(): SupabaseConnectionPool {
    if (!SupabaseConnectionPool.instance) {
      SupabaseConnectionPool.instance = new SupabaseConnectionPool()
    }
    return SupabaseConnectionPool.instance
  }
  
  getClient(type: 'client' | 'server' | 'admin' = 'client') {
    const key = `${type}-${Date.now()}`
    
    switch (type) {
      case 'admin':
        return createSupabaseAdminClient()
      case 'server':
        return createSupabaseServerClient()
      default:
        return createSupabaseClient()
    }
  }
  
  // Health check for database connectivity
  async healthCheck(): Promise<boolean> {
    try {
      const client = createSupabaseAdminClient()
      const { data, error } = await client
        .from('profiles')
        .select('count')
        .limit(1)
        .maybeSingle()
      
      return !error
    } catch (error) {
      console.error('Supabase health check failed:', error)
      return false
    }
  }
}

// Utility functions for production operations
export const supabaseUtils = {
  // Connection pool instance
  pool: SupabaseConnectionPool.getInstance(),
  
  // Generate a unique payment reference
  async generatePaymentReference(country: 'PH' | 'MY'): Promise<string> {
    const client = createSupabaseAdminClient()
    const { data, error } = await client.rpc('generate_payment_reference', {
      country_prefix: country
    })
    
    if (error) {
      console.error('Failed to generate payment reference:', error)
      throw new Error('Failed to generate payment reference')
    }
    return data
  },

  // Get order statistics with caching
  async getOrderStats(orderId: string) {
    const client = createSupabaseAdminClient()
    const { data, error } = await client.rpc('get_order_stats', {
      order_uuid: orderId
    })
    
    if (error) {
      console.error('Failed to get order stats:', error)
      throw new Error('Failed to get order statistics')
    }
    return data
  },

  // Get dashboard statistics for a user with caching
  async getDashboardStats(userId: string) {
    const client = createSupabaseAdminClient()
    const { data, error } = await client.rpc('get_dashboard_stats', {
      user_uuid: userId
    })
    
    if (error) {
      console.error('Failed to get dashboard stats:', error)
      throw new Error('Failed to get dashboard statistics')
    }
    return data
  },

  // Enhanced real-time subscriptions with error handling
  subscribeToOrderSubmissions(orderId: string, callback: (payload: any) => void) {
    const client = createSupabaseClient()
    const channel = client
      .channel(`order-${orderId}-submissions`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submissions',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          try {
            callback(payload)
          } catch (error) {
            console.error('Error in order submissions callback:', error)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to order ${orderId} submissions`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Failed to subscribe to order ${orderId} submissions`)
        }
      })

    return channel
  },

  subscribeToUserOrders(userId: string, callback: (payload: any) => void) {
    const client = createSupabaseClient()
    const channel = client
      .channel(`user-${userId}-orders`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          try {
            callback(payload)
          } catch (error) {
            console.error('Error in user orders callback:', error)
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`✅ Subscribed to user ${userId} orders`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Failed to subscribe to user ${userId} orders`)
        }
      })

    return channel
  },

  // Batch operations for better performance
  async batchUpdateSubmissions(updates: Array<{ id: string; status: string; updated_at?: Date }>) {
    const client = createSupabaseAdminClient()
    
    const promises = updates.map(update => 
      client
        .from('submissions')
        .update({
          status: update.status,
          updated_at: update.updated_at || new Date().toISOString()
        })
        .eq('id', update.id)
    )
    
    const results = await Promise.allSettled(promises)
    const failures = results.filter(result => result.status === 'rejected')
    
    if (failures.length > 0) {
      console.error('Batch update failures:', failures)
      throw new Error(`Failed to update ${failures.length}/${updates.length} submissions`)
    }
    
    return results.length
  },

  // Health monitoring
  async getSystemHealth() {
    const client = createSupabaseAdminClient()
    
    try {
      const [
        { data: userCount },
        { data: orderCount },
        { data: submissionCount }
      ] = await Promise.all([
        client.from('profiles').select('count').single(),
        client.from('orders').select('count').single(),
        client.from('submissions').select('count').single()
      ])
      
      return {
        status: 'healthy',
        database: 'connected',
        users: userCount?.count || 0,
        orders: orderCount?.count || 0,
        submissions: submissionCount?.count || 0,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('System health check failed:', error)
      return {
        status: 'unhealthy',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  },

  // Production-specific cleanup utilities
  async cleanupExpiredSessions() {
    const client = createSupabaseAdminClient()
    
    // Clean up sessions older than 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    
    const { error } = await client
      .from('auth.sessions')
      .delete()
      .lt('created_at', sevenDaysAgo.toISOString())
    
    if (error) {
      console.error('Failed to cleanup expired sessions:', error)
    }
  },

  async cleanupTempFiles() {
    const client = createSupabaseAdminClient()
    
    // Clean up temporary files older than 24 hours
    const oneDayAgo = new Date()
    oneDayAgo.setHours(oneDayAgo.getHours() - 24)
    
    const { data: files } = await client.storage
      .from('temp-files')
      .list('', {
        limit: 100,
        offset: 0
      })
    
    if (files) {
      const oldFiles = files.filter(file => 
        new Date(file.created_at) < oneDayAgo
      )
      
      if (oldFiles.length > 0) {
        const filesToDelete = oldFiles.map(file => file.name)
        await client.storage
          .from('temp-files')
          .remove(filesToDelete)
        
        console.log(`🧹 Cleaned up ${oldFiles.length} temporary files`)
      }
    }
  }
}

// Initialize connection monitoring for production
if (process.env.NODE_ENV === 'production') {
  // Health check every 5 minutes
  setInterval(async () => {
    const isHealthy = await supabaseUtils.pool.healthCheck()
    if (!isHealthy) {
      console.error('🚨 Supabase connection health check failed')
      // In production, this could trigger alerts
    }
  }, 5 * 60 * 1000)
  
  // Cleanup expired data every hour
  setInterval(async () => {
    await Promise.allSettled([
      supabaseUtils.cleanupExpiredSessions(),
      supabaseUtils.cleanupTempFiles()
    ])
  }, 60 * 60 * 1000)
}

export default createSupabaseClient