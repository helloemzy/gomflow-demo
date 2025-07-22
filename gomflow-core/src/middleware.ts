import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Performance monitoring middleware
export function middleware(request: NextRequest) {
  const startTime = Date.now();
  const response = NextResponse.next();
  
  // Add performance headers
  response.headers.set('X-Response-Time', Date.now().toString());
  response.headers.set('X-Region', process.env.VERCEL_REGION || 'unknown');
  response.headers.set('X-Request-ID', generateRequestId());
  
  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  // Add CORS headers for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Access-Control-Allow-Origin', 'https://gomflow.com');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-gomflow-auth');
    response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
  }
  
  // Add cache headers based on route
  if (request.nextUrl.pathname.startsWith('/api/dashboard/')) {
    response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  } else if (request.nextUrl.pathname.startsWith('/api/orders/public/')) {
    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  } else if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
  }
  
  // Add rate limiting headers
  const clientIP = request.ip || 'unknown';
  const rateLimitInfo = getRateLimitInfo(clientIP, request.nextUrl.pathname);
  
  if (rateLimitInfo) {
    response.headers.set('X-RateLimit-Limit', rateLimitInfo.limit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitInfo.reset.toString());
  }
  
  // Log performance metrics
  logPerformanceMetrics(request, startTime);
  
  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getRateLimitInfo(ip: string, path: string): { limit: number; remaining: number; reset: number } | null {
  // Simple in-memory rate limiting (in production, use Redis)
  const rateLimits = new Map<string, { count: number; resetTime: number }>();
  
  const key = `${ip}:${path}`;
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const limit = getPathRateLimit(path);
  
  const existing = rateLimits.get(key);
  
  if (!existing || now > existing.resetTime) {
    rateLimits.set(key, { count: 1, resetTime: now + windowMs });
    return { limit, remaining: limit - 1, reset: now + windowMs };
  }
  
  existing.count++;
  return {
    limit,
    remaining: Math.max(0, limit - existing.count),
    reset: existing.resetTime
  };
}

function getPathRateLimit(path: string): number {
  // Different rate limits for different endpoints
  if (path.startsWith('/api/payments/')) return 10;  // 10 requests per minute
  if (path.startsWith('/api/orders/')) return 60;    // 60 requests per minute
  if (path.startsWith('/api/dashboard/')) return 120; // 120 requests per minute
  if (path.startsWith('/api/health/')) return 300;   // 300 requests per minute
  
  return 100; // Default rate limit
}

function logPerformanceMetrics(request: NextRequest, startTime: number) {
  const duration = Date.now() - startTime;
  const method = request.method;
  const url = request.nextUrl.pathname;
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ip = request.ip || 'unknown';
  
  // Log to console (in production, send to monitoring service)
  if (duration > 1000) { // Log slow requests
    console.warn(`⚠️  Slow request: ${method} ${url} - ${duration}ms`);
  }
  
  // Performance metrics structure for monitoring
  const metrics = {
    timestamp: new Date().toISOString(),
    method,
    url,
    duration,
    ip,
    userAgent,
    region: process.env.VERCEL_REGION || 'unknown'
  };
  
  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Example: send to DataDog, New Relic, or custom monitoring
    // sendToMonitoring(metrics);
  }
}

// Example monitoring service integration
async function sendToMonitoring(metrics: any) {
  try {
    // Send to external monitoring service
    // await fetch(process.env.MONITORING_ENDPOINT!, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(metrics)
    // });
  } catch (error) {
    console.error('Failed to send metrics to monitoring:', error);
  }
}