import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const startTime = Date.now();
    
    // Check database connectivity
    const { data: dbCheck, error: dbError } = await supabase
      .from('orders')
      .select('count')
      .limit(1)
      .single();
    
    if (dbError && dbError.code !== 'PGRST116') {
      throw new Error(`Database unhealthy: ${dbError.message}`);
    }
    
    const dbLatency = Date.now() - startTime;
    
    // Check service dependencies
    const servicesHealth = await checkServiceHealth();
    
    const responseTime = Date.now() - startTime;
    
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: {
          status: 'healthy',
          latency: `${dbLatency}ms`,
          message: 'Database connection successful'
        },
        services: servicesHealth,
        memory: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external
        },
        uptime: process.uptime()
      },
      responseTime: `${responseTime}ms`
    };
    
    return NextResponse.json(healthData);
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      checks: {
        database: {
          status: 'unhealthy',
          message: 'Database connection failed'
        }
      }
    }, { status: 503 });
  }
}

async function checkServiceHealth() {
  const services = [
    { name: 'whatsapp', url: process.env.WHATSAPP_SERVICE_URL },
    { name: 'telegram', url: process.env.TELEGRAM_SERVICE_URL },
    { name: 'discord', url: process.env.DISCORD_SERVICE_URL },
    { name: 'payments', url: process.env.PAYMENTS_SERVICE_URL },
    { name: 'smart-agent', url: process.env.SMART_AGENT_SERVICE_URL }
  ];
  
  const healthChecks = await Promise.allSettled(
    services.map(async (service) => {
      if (!service.url) {
        return { name: service.name, status: 'not-configured' };
      }
      
      try {
        const response = await fetch(`${service.url}/health`, {
          method: 'GET',
          timeout: 5000
        });
        
        return {
          name: service.name,
          status: response.ok ? 'healthy' : 'unhealthy',
          responseTime: response.headers.get('x-response-time')
        };
      } catch (error) {
        return {
          name: service.name,
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    })
  );
  
  return healthChecks.reduce((acc, result, index) => {
    const serviceName = services[index].name;
    acc[serviceName] = result.status === 'fulfilled' ? result.value : {
      name: serviceName,
      status: 'error',
      error: result.reason
    };
    return acc;
  }, {} as Record<string, any>);
}

export async function HEAD() {
  // Lightweight health check for load balancers
  try {
    const { error } = await supabase
      .from('orders')
      .select('count')
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      return new Response(null, { status: 503 });
    }
    
    return new Response(null, { status: 200 });
  } catch (error) {
    return new Response(null, { status: 503 });
  }
}