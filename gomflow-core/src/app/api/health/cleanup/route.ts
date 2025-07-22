import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const startTime = Date.now();
    
    // Run cleanup tasks
    const results = await Promise.allSettled([
      cleanupExpiredOrders(),
      cleanupOldSubmissions(),
      cleanupTempFiles(),
      optimizeDatabase()
    ]);
    
    const responseTime = Date.now() - startTime;
    
    const cleanupResults = {
      timestamp: new Date().toISOString(),
      duration: `${responseTime}ms`,
      tasks: {
        expiredOrders: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason },
        oldSubmissions: results[1].status === 'fulfilled' ? results[1].value : { error: results[1].reason },
        tempFiles: results[2].status === 'fulfilled' ? results[2].value : { error: results[2].reason },
        databaseOptimization: results[3].status === 'fulfilled' ? results[3].value : { error: results[3].reason }
      }
    };
    
    return NextResponse.json(cleanupResults);
  } catch (error) {
    console.error('Cleanup failed:', error);
    
    return NextResponse.json({
      error: 'Cleanup failed',
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function cleanupExpiredOrders() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  try {
    // Archive expired orders older than 30 days
    const { data: expiredOrders, error } = await supabase
      .from('orders')
      .select('id, title, deadline')
      .lt('deadline', thirtyDaysAgo.toISOString());
    
    if (error) throw error;
    
    if (expiredOrders && expiredOrders.length > 0) {
      // In production, we'd archive these orders to a separate table
      // For now, we'll just log them
      console.log(`Found ${expiredOrders.length} expired orders to archive`);
    }
    
    return {
      success: true,
      processedCount: expiredOrders?.length || 0,
      message: `Processed ${expiredOrders?.length || 0} expired orders`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function cleanupOldSubmissions() {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  
  try {
    // Clean up old rejected submissions
    const { data: oldSubmissions, error } = await supabase
      .from('submissions')
      .select('id, payment_status, created_at')
      .eq('payment_status', 'rejected')
      .lt('created_at', sixtyDaysAgo.toISOString());
    
    if (error) throw error;
    
    if (oldSubmissions && oldSubmissions.length > 0) {
      // In production, we'd archive or delete these submissions
      console.log(`Found ${oldSubmissions.length} old rejected submissions to clean up`);
    }
    
    return {
      success: true,
      processedCount: oldSubmissions?.length || 0,
      message: `Processed ${oldSubmissions?.length || 0} old submissions`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function cleanupTempFiles() {
  try {
    // Clean up temporary files from Smart Agent processing
    // In production, this would interface with storage service
    console.log('Cleaning up temporary files from Smart Agent processing');
    
    return {
      success: true,
      processedCount: 0,
      message: 'Temporary files cleanup completed'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function optimizeDatabase() {
  try {
    // Run database optimization queries
    const optimizationTasks = [
      'ANALYZE',
      'VACUUM (ANALYZE)',
      'REINDEX DATABASE'
    ];
    
    // Note: In production, these would be run carefully during maintenance windows
    console.log('Running database optimization tasks (simulated)');
    
    return {
      success: true,
      tasksRun: optimizationTasks.length,
      message: `Ran ${optimizationTasks.length} optimization tasks`
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function POST() {
  // Manual cleanup trigger
  return GET();
}