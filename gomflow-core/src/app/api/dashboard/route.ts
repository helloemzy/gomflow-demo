import { createSupabaseServerClient, supabaseUtils } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import type { ApiResponse, DashboardStats } from '@gomflow/shared'
import { demoService } from '@/lib/demo-service'

// GET /api/dashboard - Get dashboard statistics for authenticated user
export async function GET(request: NextRequest) {
  try {
    // Check if in demo mode
    if (demoService.isDemoMode()) {
      const mockData = demoService.getAnalyticsMockData()
      const dashboardData = {
        stats: {
          totalOrders: mockData.totalOrders,
          totalRevenue: mockData.totalRevenue,
          activeOrders: mockData.activeOrders,
          completionRate: mockData.completionRate,
          averageOrderValue: mockData.averageOrderValue
        } as DashboardStats,
        recentOrders: mockData.recentOrders,
        recentSubmissions: await demoService.getDemoSubmissions(),
        pendingRemindersCount: 3,
        quickActions: [
          {
            title: 'Create New Order (Demo)',
            description: 'Create a demo group order',
            href: '/orders/create',
            icon: 'plus'
          },
          {
            title: 'View Demo Orders',
            description: 'Browse existing demo orders',
            href: '/orders',
            icon: 'list'
          },
          {
            title: 'Demo Analytics',
            description: 'View analytics dashboard',
            href: '/dashboard/analytics',
            icon: 'bar-chart'
          }
        ]
      }

      return NextResponse.json<ApiResponse>({
        success: true,
        data: dashboardData
      })
    }

    const supabase = createSupabaseServerClient()
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Unauthorized'
      }, { status: 401 })
    }

    // Get dashboard stats using our database function
    const stats = await supabaseUtils.getDashboardStats(user.id)

    // Get recent orders
    const { data: recentOrders, error: ordersError } = await supabase
      .from('order_summaries')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (ordersError) {
      console.error('Error fetching recent orders:', ordersError)
    }

    // Get recent submissions
    const { data: recentSubmissions, error: submissionsError } = await supabase
      .from('submissions')
      .select(`
        *,
        order:orders!inner(
          title,
          user_id
        )
      `)
      .eq('order.user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (submissionsError) {
      console.error('Error fetching recent submissions:', submissionsError)
    }

    // Get pending reminders count
    const { data: pendingReminders, error: remindersError } = await supabase
      .from('submissions')
      .select(`
        id,
        order:orders!inner(
          user_id,
          deadline
        )
      `)
      .eq('order.user_id', user.id)
      .eq('status', 'pending')
      .lt('last_reminder_sent', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // More than 24h ago
      .limit(100)

    const pendingRemindersCount = remindersError ? 0 : (pendingReminders?.length || 0)

    // Combine all dashboard data
    const dashboardData = {
      stats: stats as DashboardStats,
      recentOrders: recentOrders || [],
      recentSubmissions: recentSubmissions || [],
      pendingRemindersCount,
      quickActions: [
        {
          title: 'Create New Order',
          description: 'Start a new group order',
          href: '/orders/new',
          icon: 'plus'
        },
        {
          title: 'Send Reminders',
          description: `${pendingRemindersCount} pending reminders`,
          href: '/reminders',
          icon: 'bell',
          badge: pendingRemindersCount > 0 ? pendingRemindersCount : undefined
        },
        {
          title: 'Export Data',
          description: 'Download order reports',
          href: '/export',
          icon: 'download'
        }
      ]
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: dashboardData
    })

  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}