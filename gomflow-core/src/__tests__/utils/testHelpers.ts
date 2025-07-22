import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { User, Order, Submission } from '@gomflow/shared';

// Test data factories
export const createMockUser = (overrides?: Partial<User>): User => ({
  id: 'test-user-id',
  email: 'test@example.com',
  phone: '+639123456789',
  country: 'PH',
  is_gom: false,
  plan: 'free',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createMockOrder = (overrides?: Partial<Order>): Order => ({
  id: 'test-order-id',
  gom_id: 'test-gom-id',
  title: 'Test Order',
  description: 'Test order description',
  slug: 'test-order',
  category: 'merchandise',
  image_url: 'https://example.com/image.jpg',
  price_per_item: 100,
  currency: 'PHP',
  min_quantity: 10,
  max_quantity: 100,
  current_quantity: 50,
  deadline: '2024-12-31T23:59:59Z',
  status: 'active',
  country: 'PH',
  payment_methods: ['gcash', 'paymaya', 'bank_transfer'],
  metadata: {},
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createMockSubmission = (overrides?: Partial<Submission>): Submission => ({
  id: 'test-submission-id',
  order_id: 'test-order-id',
  buyer_id: 'test-buyer-id',
  buyer_name: 'Test Buyer',
  buyer_email: 'buyer@example.com',
  buyer_phone: '+639123456789',
  quantity: 2,
  total_amount: 200,
  payment_method: 'gcash',
  payment_reference: 'SUB-TEST-123',
  payment_screenshot_url: null,
  status: 'pending_payment',
  notes: null,
  metadata: {},
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

// Mock Supabase responses
export const mockSupabaseResponse = <T>(data: T | null, error: any = null) => ({
  data,
  error,
  count: null,
  status: error ? 400 : 200,
  statusText: error ? 'Bad Request' : 'OK',
});

// Create mock NextRequest
export const createMockRequest = (
  method: string,
  url: string,
  options?: {
    body?: any;
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
  }
): NextRequest => {
  const fullUrl = new URL(url, 'http://localhost:3000');
  
  if (options?.searchParams) {
    Object.entries(options.searchParams).forEach(([key, value]) => {
      fullUrl.searchParams.append(key, value);
    });
  }

  const headers = new Headers(options?.headers || {});
  headers.set('content-type', 'application/json');

  return new NextRequest(fullUrl, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
};

// Create authenticated mock request
export const createAuthenticatedRequest = (
  method: string,
  url: string,
  userId: string,
  options?: {
    body?: any;
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
  }
): NextRequest => {
  const headers = {
    ...options?.headers,
    'x-user-id': userId,
    'x-service-auth': 'test-service:test-signature',
  };

  return createMockRequest(method, url, { ...options, headers });
};

// Mock service responses
export const mockServiceResponse = (data: any, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers(),
  });
};

// Test database client
export const createTestSupabaseClient = () => {
  const client = createClient('https://test.supabase.co', 'test-key');
  
  // Override methods with mocks
  const mockFrom = jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
  }));

  (client as any).from = mockFrom;
  
  return { client, mockFrom };
};

// Assertion helpers
export const expectSuccessResponse = (response: NextResponse, expectedData?: any) => {
  expect(response.status).toBe(200);
  
  if (expectedData) {
    const data = JSON.parse(response.body as any);
    expect(data).toMatchObject(expectedData);
  }
};

export const expectErrorResponse = (response: NextResponse, status: number, errorMessage?: string) => {
  expect(response.status).toBe(status);
  
  if (errorMessage) {
    const data = JSON.parse(response.body as any);
    expect(data.error).toContain(errorMessage);
  }
};

// Wait for async operations
export const waitForAsync = () => new Promise(resolve => setImmediate(resolve));