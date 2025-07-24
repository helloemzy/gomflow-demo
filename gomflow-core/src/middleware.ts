import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

// Production middleware with enhanced security and monitoring
export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const response = NextResponse.next();
  
  // Initialize Supabase client for auth
  const supabase = createMiddlewareClient({ req: request, res: response });
  
  // Request ID for tracing
  const requestId = generateRequestId();
  
  // Add performance and tracking headers
  response.headers.set('X-Response-Time', Date.now().toString());
  response.headers.set('X-Region', process.env.VERCEL_REGION || 'unknown');
  response.headers.set('X-Request-ID', requestId);
  response.headers.set('X-Environment', process.env.NODE_ENV || 'unknown');
  response.headers.set('X-Version', process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0');
  
  // Enhanced security headers for production
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  
  // Content Security Policy for production
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://gomflow.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.gomflow.com wss://api.gomflow.com https://*.supabase.co wss://*.supabase.co https://vercel.live",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "upgrade-insecure-requests"
  ].join('; ');
  
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Content-Security-Policy', csp);
  }
  
  // Add CORS headers for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['https://gomflow.com'];
    const origin = request.headers.get('origin');
    
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    } else {
      response.headers.set('Access-Control-Allow-Origin', 'https://gomflow.com');
    }
    
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-gomflow-auth, x-request-id, x-client-version');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
    response.headers.set('Vary', 'Origin');
  }
  
  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: response.headers });
  }
  
  // Authentication for protected routes
  const protectedPaths = ['/dashboard', '/orders/create', '/orders/manage', '/collaboration', '/market-intelligence'];
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path));
  
  if (isProtectedPath) {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    // Add user context to headers for downstream use
    response.headers.set('X-User-ID', session.user.id);
    response.headers.set('X-User-Email', session.user.email || '');
  }
  
  // Add cache headers based on route
  if (request.nextUrl.pathname.startsWith('/api/dashboard/')) {
    response.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  } else if (request.nextUrl.pathname.startsWith('/api/orders/public/')) {
    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  } else if (request.nextUrl.pathname.startsWith('/api/health/')) {
    response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  } else if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
  } else if (request.nextUrl.pathname.startsWith('/_next/static/')) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  
  // Enhanced rate limiting for production
  const clientIP = getClientIP(request);
  const rateLimitInfo = await getRateLimitInfo(clientIP, request.nextUrl.pathname);
  
  if (rateLimitInfo) {
    response.headers.set('X-RateLimit-Limit', rateLimitInfo.limit.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitInfo.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitInfo.reset.toString());
    
    // Block if rate limit exceeded
    if (rateLimitInfo.remaining <= 0) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Rate limit exceeded', 
          message: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((rateLimitInfo.reset - Date.now()) / 1000)
        }), 
        { 
          status: 429, 
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil((rateLimitInfo.reset - Date.now()) / 1000).toString(),
            ...Object.fromEntries(response.headers.entries())
          }
        }
      );
    }
  }
  
  // Security: Block suspicious requests
  if (isSuspiciousRequest(request)) {
    return new NextResponse(
      JSON.stringify({ error: 'Request blocked', message: 'Suspicious activity detected' }), 
      { 
        status: 403, 
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  // Log performance metrics
  await logPerformanceMetrics(request, startTime, requestId);
  
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

function getClientIP(request: NextRequest): string {
  // Try various headers for getting the real client IP
  const forwarded = request.ip ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-client-ip') ||
    'unknown';
  
  return forwarded;
}

// In-memory rate limit store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

async function getRateLimitInfo(ip: string, path: string): Promise<{ limit: number; remaining: number; reset: number } | null> {
  const key = `${ip}:${getPathCategory(path)}`;
  const now = Date.now();
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'); // 1 minute
  const limit = getPathRateLimit(path);
  
  // Clean up expired entries periodically
  if (Math.random() < 0.01) { // 1% chance
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }
  
  const existing = rateLimitStore.get(key);
  
  if (!existing || now > existing.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { limit, remaining: limit - 1, reset: now + windowMs };
  }
  
  existing.count++;
  return {
    limit,
    remaining: Math.max(0, limit - existing.count),
    reset: existing.resetTime
  };
}

function getPathCategory(path: string): string {
  // Group similar paths for rate limiting
  if (path.startsWith('/api/payments/')) return 'payments';
  if (path.startsWith('/api/orders/')) return 'orders';
  if (path.startsWith('/api/dashboard/')) return 'dashboard';
  if (path.startsWith('/api/submissions/')) return 'submissions';
  if (path.startsWith('/api/health/')) return 'health';
  if (path.startsWith('/api/')) return 'api';
  return 'web';
}

function getPathRateLimit(path: string): number {
  // Get rate limits from environment or use defaults
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
  
  // Different rate limits for different endpoints
  if (path.startsWith('/api/payments/')) return Math.floor(maxRequests * 0.1);  // 10% for payments
  if (path.startsWith('/api/orders/')) return Math.floor(maxRequests * 0.6);    // 60% for orders
  if (path.startsWith('/api/dashboard/')) return Math.floor(maxRequests * 1.2); // 120% for dashboard
  if (path.startsWith('/api/health/')) return Math.floor(maxRequests * 3);      // 300% for health checks
  if (path.startsWith('/api/submissions/')) return Math.floor(maxRequests * 0.3); // 30% for submissions
  
  return maxRequests; // Default rate limit
}

function isSuspiciousRequest(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') || '';
  const url = request.nextUrl.pathname;
  
  // Block common attack patterns
  const suspiciousPatterns = [
    // SQL injection attempts
    /(\bunion\b|\bselect\b|\binsert\b|\bdelete\b|\bdrop\b|\bupdate\b).*(\bfrom\b|\bwhere\b|\binto\b)/i,
    // XSS attempts
    /<script|javascript:|onload=|onerror=/i,
    // Path traversal
    /\.\.[\/\\]/,
    // Common attack tools
    /sqlmap|nikto|nmap|burp|acunetix/i
  ];
  
  // Check URL for suspicious patterns
  if (suspiciousPatterns.some(pattern => pattern.test(url))) {
    return true;
  }
  
  // Check for missing or suspicious user agents
  if (!userAgent || userAgent.length < 10 || /bot|crawler|spider/i.test(userAgent)) {
    // Allow legitimate bots
    const legitimateBots = /googlebot|bingbot|slurp|duckduckbot|baiduspider/i;
    if (!legitimateBots.test(userAgent)) {
      return false; // Don't block, but could log
    }
  }
  
  return false;
}

async function logPerformanceMetrics(request: NextRequest, startTime: number, requestId: string) {
  const duration = Date.now() - startTime;
  const method = request.method;
  const url = request.nextUrl.pathname;
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ip = getClientIP(request);
  const referer = request.headers.get('referer') || '';
  
  // Log slow requests
  if (duration > 2000) {
    console.warn(`🐌 Slow request [${requestId}]: ${method} ${url} - ${duration}ms`);
  }
  
  // Log suspicious activity
  if (isSuspiciousRequest(request)) {
    console.warn(`🚨 Suspicious request [${requestId}]: ${method} ${url} from ${ip}`);
  }
  
  // Performance metrics structure for monitoring
  const metrics = {
    timestamp: new Date().toISOString(),
    requestId,
    method,
    url,
    duration,
    ip,
    userAgent,
    referer,
    region: process.env.VERCEL_REGION || 'unknown',
    environment: process.env.NODE_ENV,
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'
  };
  
  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    await sendToMonitoring(metrics);
  } else if (process.env.NODE_ENV === 'development') {
    // Log in development for debugging
    console.log(`📊 Request [${requestId}]: ${method} ${url} - ${duration}ms`);
  }
}

// Monitoring service integration for production
async function sendToMonitoring(metrics: any) {
  try {
    // Send to multiple monitoring services in parallel
    const promises = [];
    
    // Sentry for error tracking and performance
    if (process.env.SENTRY_DSN) {
      // Sentry will be configured separately, this is just metrics
      console.log(`📊 [Sentry] Request metrics: ${metrics.method} ${metrics.url} - ${metrics.duration}ms`);
    }
    
    // Custom monitoring endpoint (if configured)
    if (process.env.MONITORING_ENDPOINT) {
      promises.push(
        fetch(process.env.MONITORING_ENDPOINT, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.MONITORING_API_KEY || ''}`
          },
          body: JSON.stringify(metrics)
        }).catch(error => {
          console.error('Failed to send to custom monitoring:', error);
        })
      );
    }
    
    // DataDog (if configured)
    if (process.env.DATADOG_API_KEY) {
      promises.push(
        fetch('https://api.datadoghq.com/api/v1/series', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'DD-API-KEY': process.env.DATADOG_API_KEY
          },
          body: JSON.stringify({
            series: [{
              metric: 'gomflow.request.duration',
              points: [[Math.floor(Date.now() / 1000), metrics.duration]],
              tags: [
                `method:${metrics.method}`,
                `url:${metrics.url}`,
                `region:${metrics.region}`,
                `environment:${metrics.environment}`
              ]
            }]
          })
        }).catch(error => {
          console.error('Failed to send to DataDog:', error);
        })
      );
    }
    
    // Wait for all monitoring calls to complete (don't block response)
    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
    
  } catch (error) {
    console.error('Failed to send metrics to monitoring services:', error);
  }
}