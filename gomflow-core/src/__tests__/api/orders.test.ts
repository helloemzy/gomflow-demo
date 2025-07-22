import { GET, POST } from '@/app/api/orders/route';
import { 
  createMockRequest, 
  createAuthenticatedRequest,
  createMockOrder,
  mockSupabaseResponse,
  expectSuccessResponse,
  expectErrorResponse,
  createTestSupabaseClient,
} from '../utils/testHelpers';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js');

describe('/api/orders', () => {
  let mockSupabase: any;
  let mockFrom: jest.Mock;

  beforeEach(() => {
    const testClient = createTestSupabaseClient();
    mockSupabase = testClient.client;
    mockFrom = testClient.mockFrom;
    
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('GET /api/orders', () => {
    it('should return active orders', async () => {
      const mockOrders = [
        createMockOrder({ id: 'order-1', title: 'Order 1' }),
        createMockOrder({ id: 'order-2', title: 'Order 2' }),
      ];

      const selectMock = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue(mockSupabaseResponse(mockOrders)),
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue(selectMock),
      });

      const request = createMockRequest('GET', '/api/orders');
      const response = await GET(request);

      expectSuccessResponse(response);
      const data = await response.json();
      expect(data.orders).toHaveLength(2);
      expect(data.orders[0].title).toBe('Order 1');
      expect(mockFrom).toHaveBeenCalledWith('orders');
      expect(selectMock.eq).toHaveBeenCalledWith('status', 'active');
    });

    it('should filter orders by country', async () => {
      const mockOrders = [createMockOrder({ country: 'PH' })];

      const selectMock = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue(mockSupabaseResponse(mockOrders)),
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue(selectMock),
      });

      const request = createMockRequest('GET', '/api/orders', {
        searchParams: { country: 'PH' },
      });
      const response = await GET(request);

      expectSuccessResponse(response);
      expect(selectMock.eq).toHaveBeenCalledWith('country', 'PH');
    });

    it('should filter orders by category', async () => {
      const mockOrders = [createMockOrder({ category: 'albums' })];

      const selectMock = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue(mockSupabaseResponse(mockOrders)),
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue(selectMock),
      });

      const request = createMockRequest('GET', '/api/orders', {
        searchParams: { category: 'albums' },
      });
      const response = await GET(request);

      expectSuccessResponse(response);
      expect(selectMock.eq).toHaveBeenCalledWith('category', 'albums');
    });

    it('should handle pagination', async () => {
      const mockOrders = Array(10).fill(null).map((_, i) => 
        createMockOrder({ id: `order-${i}` })
      );

      const selectMock = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue(mockSupabaseResponse(mockOrders)),
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue(selectMock),
      });

      const request = createMockRequest('GET', '/api/orders', {
        searchParams: { page: '2', limit: '10' },
      });
      const response = await GET(request);

      expectSuccessResponse(response);
      expect(selectMock.range).toHaveBeenCalledWith(10, 19);
    });

    it('should handle database errors', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn().mockResolvedValue(
            mockSupabaseResponse(null, { message: 'Database error' })
          ),
        }),
      });

      const request = createMockRequest('GET', '/api/orders');
      const response = await GET(request);

      expectErrorResponse(response, 500, 'Failed to fetch orders');
    });
  });

  describe('POST /api/orders', () => {
    it('should create a new order for authenticated GOM', async () => {
      const newOrder = {
        title: 'New Album Group Order',
        description: 'Latest comeback album',
        category: 'albums',
        price_per_item: 25,
        currency: 'USD',
        min_quantity: 20,
        max_quantity: 100,
        deadline: '2024-12-31T23:59:59Z',
        country: 'PH',
        payment_methods: ['gcash', 'paymaya'],
      };

      const createdOrder = createMockOrder({
        ...newOrder,
        id: 'new-order-id',
        slug: 'new-album-group-order',
        gom_id: 'gom-user-id',
      });

      // Mock user check
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(
            mockSupabaseResponse({ id: 'gom-user-id', is_gom: true })
          ),
        }),
      });

      // Mock slug check
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(
            mockSupabaseResponse(null, { code: 'PGRST116' })
          ),
        }),
      });

      // Mock order creation
      mockFrom.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(
            mockSupabaseResponse(createdOrder)
          ),
        }),
      });

      const request = createAuthenticatedRequest('POST', '/api/orders', 'gom-user-id', {
        body: newOrder,
      });
      const response = await POST(request);

      expectSuccessResponse(response);
      const data = await response.json();
      expect(data.order.title).toBe('New Album Group Order');
      expect(data.order.slug).toBe('new-album-group-order');
    });

    it('should reject order creation for non-GOM users', async () => {
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(
            mockSupabaseResponse({ id: 'regular-user-id', is_gom: false })
          ),
        }),
      });

      const request = createAuthenticatedRequest('POST', '/api/orders', 'regular-user-id', {
        body: { title: 'Test Order' },
      });
      const response = await POST(request);

      expectErrorResponse(response, 403, 'Only GOMs can create orders');
    });

    it('should validate required fields', async () => {
      const request = createAuthenticatedRequest('POST', '/api/orders', 'gom-user-id', {
        body: { title: 'Test Order' }, // Missing required fields
      });
      const response = await POST(request);

      expectErrorResponse(response, 400);
    });

    it('should handle slug conflicts', async () => {
      // Mock user check
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(
            mockSupabaseResponse({ id: 'gom-user-id', is_gom: true })
          ),
        }),
      });

      // Mock slug exists
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(
            mockSupabaseResponse({ slug: 'existing-slug' })
          ),
        }),
      });

      const request = createAuthenticatedRequest('POST', '/api/orders', 'gom-user-id', {
        body: {
          title: 'Existing Order',
          description: 'Test',
          category: 'albums',
          price_per_item: 25,
          currency: 'USD',
          min_quantity: 20,
          max_quantity: 100,
          deadline: '2024-12-31T23:59:59Z',
          country: 'PH',
          payment_methods: ['gcash'],
        },
      });
      const response = await POST(request);

      expectErrorResponse(response, 400, 'already exists');
    });

    it('should require authentication', async () => {
      const request = createMockRequest('POST', '/api/orders', {
        body: { title: 'Test Order' },
      });
      const response = await POST(request);

      expectErrorResponse(response, 401, 'Authentication required');
    });
  });
});