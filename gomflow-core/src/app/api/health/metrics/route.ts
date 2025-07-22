import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const startTime = Date.now();
    
    // Collect platform metrics
    const [
      ordersMetrics,
      submissionsMetrics,
      performanceMetrics
    ] = await Promise.all([
      getOrdersMetrics(),
      getSubmissionsMetrics(),
      getPerformanceMetrics()
    ]);
    
    const responseTime = Date.now() - startTime;
    
    const metrics = {
      timestamp: new Date().toISOString(),
      platform: {
        orders: ordersMetrics,
        submissions: submissionsMetrics,
        performance: performanceMetrics
      },
      system: {
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external,
          rss: process.memoryUsage().rss
        },
        uptime: process.uptime(),
        responseTime: `${responseTime}ms`
      }
    };
    
    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Metrics collection failed:', error);
    
    return NextResponse.json({
      error: 'Failed to collect metrics',
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function getOrdersMetrics() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const [
    { count: totalOrders },
    { count: todayOrders },
    { count: activeOrders }
  ] = await Promise.all([
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString().split('T')[0]),
    supabase.from('orders').select('*', { count: 'exact', head: true })
      .gt('deadline', new Date().toISOString())
  ]);
  
  return {
    total: totalOrders || 0,
    today: todayOrders || 0,
    active: activeOrders || 0
  };
}

async function getSubmissionsMetrics() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const [
    { count: totalSubmissions },
    { count: todaySubmissions },
    { count: confirmedSubmissions }
  ] = await Promise.all([
    supabase.from('submissions').select('*', { count: 'exact', head: true }),
    supabase.from('submissions').select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString()),
    supabase.from('submissions').select('*', { count: 'exact', head: true })
      .eq('payment_status', 'confirmed')
  ]);
  
  return {
    total: totalSubmissions || 0,
    today: todaySubmissions || 0,
    confirmed: confirmedSubmissions || 0,
    conversionRate: totalSubmissions ? ((confirmedSubmissions || 0) / totalSubmissions * 100).toFixed(2) : '0.00'
  };
}

async function getPerformanceMetrics() {
  // Get database performance stats
  const { data: dbStats } = await supabase
    .rpc('get_database_stats')
    .single();
  
  // Calculate average response times (mock data - in production would be from monitoring)
  const avgResponseTimes = {
    orders: '150ms',
    submissions: '120ms',
    dashboard: '80ms',
    payments: '200ms'
  };
  
  return {
    database: {
      connections: dbStats?.connections || 'N/A',
      slowQueries: dbStats?.slow_queries || 0,
      avgQueryTime: dbStats?.avg_query_time || 'N/A'
    },
    api: {
      averageResponseTimes: avgResponseTimes,
      errorRate: '0.1%', // Mock data
      throughput: '1200 req/min' // Mock data
    }
  };
}

export async function POST() {
  // Trigger metrics collection and cleanup
  try {
    await cleanupOldMetrics();
    return NextResponse.json({ success: true, message: 'Metrics cleanup completed' });
  } catch (error) {
    return NextResponse.json({
      error: 'Cleanup failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function cleanupOldMetrics() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // Clean up old logs and metrics (if we had a metrics table)
  console.log('Cleaning up metrics older than', thirtyDaysAgo.toISOString());
  
  // In a real implementation, this would clean up metrics tables
  // await supabase
  //   .from('metrics_logs')
  //   .delete()
  //   .lt('created_at', thirtyDaysAgo.toISOString());
}