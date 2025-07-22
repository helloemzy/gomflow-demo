import { GET, POST, PATCH } from '@/app/api/submissions/route';
import { 
  createMockRequest, 
  createAuthenticatedRequest,
  createMockOrder,
  createMockSubmission,
  mockSupabaseResponse,
  expectSuccessResponse,
  expectErrorResponse,
  createTestSupabaseClient,
} from '../utils/testHelpers';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js');

describe('/api/submissions', () => {
  let mockSupabase: any;
  let mockFrom: jest.Mock;
  let mockRpc: jest.Mock;

  beforeEach(() => {
    const testClient = createTestSupabaseClient();
    mockSupabase = testClient.client;
    mockFrom = testClient.mockFrom;
    mockRpc = jest.fn();
    mockSupabase.rpc = mockRpc;
    
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('GET /api/submissions', () => {
    it('should return user submissions when authenticated', async () => {
      const mockSubmissions = [
        createMockSubmission({ id: 'sub-1', buyer_id: 'user-123' }),
        createMockSubmission({ id: 'sub-2', buyer_id: 'user-123' }),
      ];

      const selectMock = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue(mockSupabaseResponse(mockSubmissions)),
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue(selectMock),
      });

      const request = createAuthenticatedRequest('GET', '/api/submissions', 'user-123');
      const response = await GET(request);

      expectSuccessResponse(response);
      const data = await response.json();
      expect(data.submissions).toHaveLength(2);
      expect(selectMock.eq).toHaveBeenCalledWith('buyer_id', 'user-123');
    });

    it('should filter submissions by order ID', async () => {
      const mockSubmissions = [
        createMockSubmission({ order_id: 'order-123' }),
      ];

      const selectMock = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue(mockSupabaseResponse(mockSubmissions)),
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue(selectMock),
      });

      const request = createAuthenticatedRequest('GET', '/api/submissions', 'user-123', {
        searchParams: { orderId: 'order-123' },
      });
      const response = await GET(request);

      expectSuccessResponse(response);
      expect(selectMock.eq).toHaveBeenCalledWith('order_id', 'order-123');
    });

    it('should filter submissions by status', async () => {
      const mockSubmissions = [
        createMockSubmission({ status: 'payment_verified' }),
      ];

      const selectMock = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue(mockSupabaseResponse(mockSubmissions)),
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue(selectMock),
      });

      const request = createAuthenticatedRequest('GET', '/api/submissions', 'user-123', {
        searchParams: { status: 'payment_verified' },
      });
      const response = await GET(request);

      expectSuccessResponse(response);
      expect(selectMock.eq).toHaveBeenCalledWith('status', 'payment_verified');
    });
  });

  describe('POST /api/submissions', () => {
    it('should create a new submission', async () => {
      const mockOrder = createMockOrder({
        id: 'order-123',
        status: 'active',
        price_per_item: 100,
        country: 'PH',
      });

      const newSubmission = {
        order_id: 'order-123',
        buyer_name: 'John Doe',
        buyer_email: 'john@example.com',
        buyer_phone: '+639123456789',
        quantity: 2,
        payment_method: 'gcash',
      };

      const createdSubmission = createMockSubmission({
        ...newSubmission,
        id: 'new-sub-id',
        payment_reference: 'SUB-2024-ABC123',
        total_amount: 200,
      });

      // Mock order lookup
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(mockSupabaseResponse(mockOrder)),
        }),
      });

      // Mock generate_payment_reference RPC
      mockRpc.mockResolvedValueOnce(mockSupabaseResponse({ reference: 'SUB-2024-ABC123' }));

      // Mock submission creation
      mockFrom.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(mockSupabaseResponse(createdSubmission)),
        }),
      });

      // Mock order update
      mockFrom.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
        }),
      });

      const request = createMockRequest('POST', '/api/submissions', {
        body: newSubmission,
      });
      const response = await POST(request);

      expectSuccessResponse(response);
      const data = await response.json();
      expect(data.submission.payment_reference).toBe('SUB-2024-ABC123');
      expect(data.submission.total_amount).toBe(200);
    });

    it('should reject submission for inactive order', async () => {
      const mockOrder = createMockOrder({
        id: 'order-123',
        status: 'completed',
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(mockSupabaseResponse(mockOrder)),
        }),
      });

      const request = createMockRequest('POST', '/api/submissions', {
        body: {
          order_id: 'order-123',
          buyer_name: 'John Doe',
          quantity: 1,
        },
      });
      const response = await POST(request);

      expectErrorResponse(response, 400, 'Order is not active');
    });

    it('should validate phone format for country', async () => {
      const mockOrder = createMockOrder({
        id: 'order-123',
        status: 'active',
        country: 'PH',
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(mockSupabaseResponse(mockOrder)),
        }),
      });

      const request = createMockRequest('POST', '/api/submissions', {
        body: {
          order_id: 'order-123',
          buyer_name: 'John Doe',
          buyer_phone: '123456', // Invalid phone format
          quantity: 1,
          payment_method: 'gcash',
        },
      });
      const response = await POST(request);

      expectErrorResponse(response, 400, 'Invalid phone number');
    });

    it('should enforce maximum quantity limit', async () => {
      const mockOrder = createMockOrder({
        id: 'order-123',
        status: 'active',
        max_quantity: 100,
        current_quantity: 95,
      });

      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(mockSupabaseResponse(mockOrder)),
        }),
      });

      const request = createMockRequest('POST', '/api/submissions', {
        body: {
          order_id: 'order-123',
          buyer_name: 'John Doe',
          buyer_phone: '+639123456789',
          quantity: 10, // Would exceed max
          payment_method: 'gcash',
        },
      });
      const response = await POST(request);

      expectErrorResponse(response, 400, 'exceeds maximum');
    });
  });

  describe('PATCH /api/submissions', () => {
    it('should update submission status for authenticated GOM', async () => {
      const mockSubmission = createMockSubmission({
        id: 'sub-123',
        order_id: 'order-123',
        status: 'pending_payment',
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

      // Mock submission lookup
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(mockSupabaseResponse(mockSubmission)),
        }),
      });

      // Mock order ownership check
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(
            mockSupabaseResponse({ gom_id: 'gom-user-id' })
          ),
        }),
      });

      // Mock submission update
      mockFrom.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(
            mockSupabaseResponse({ ...mockSubmission, status: 'payment_verified' })
          ),
        }),
      });

      const request = createAuthenticatedRequest('PATCH', '/api/submissions', 'gom-user-id', {
        body: {
          submissionId: 'sub-123',
          status: 'payment_verified',
        },
      });
      const response = await PATCH(request);

      expectSuccessResponse(response);
      const data = await response.json();
      expect(data.submission.status).toBe('payment_verified');
    });

    it('should reject updates from non-GOM users', async () => {
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(
            mockSupabaseResponse({ id: 'regular-user', is_gom: false })
          ),
        }),
      });

      const request = createAuthenticatedRequest('PATCH', '/api/submissions', 'regular-user', {
        body: {
          submissionId: 'sub-123',
          status: 'payment_verified',
        },
      });
      const response = await PATCH(request);

      expectErrorResponse(response, 403, 'Only GOMs can update submissions');
    });

    it('should prevent invalid status transitions', async () => {
      const mockSubmission = createMockSubmission({
        id: 'sub-123',
        status: 'completed',
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

      // Mock submission lookup
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(mockSupabaseResponse(mockSubmission)),
        }),
      });

      const request = createAuthenticatedRequest('PATCH', '/api/submissions', 'gom-user-id', {
        body: {
          submissionId: 'sub-123',
          status: 'pending_payment', // Can't go back to pending from completed
        },
      });
      const response = await PATCH(request);

      expectErrorResponse(response, 400, 'Invalid status transition');
    });

    it('should allow buyers to add payment screenshots', async () => {
      const mockSubmission = createMockSubmission({
        id: 'sub-123',
        buyer_id: 'buyer-123',
        status: 'pending_payment',
      });

      // Mock submission lookup
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(mockSupabaseResponse(mockSubmission)),
        }),
      });

      // Mock submission update
      mockFrom.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(
            mockSupabaseResponse({
              ...mockSubmission,
              payment_screenshot_url: 'https://example.com/screenshot.jpg',
            })
          ),
        }),
      });

      const request = createAuthenticatedRequest('PATCH', '/api/submissions', 'buyer-123', {
        body: {
          submissionId: 'sub-123',
          payment_screenshot_url: 'https://example.com/screenshot.jpg',
        },
      });
      const response = await PATCH(request);

      expectSuccessResponse(response);
      const data = await response.json();
      expect(data.submission.payment_screenshot_url).toBe('https://example.com/screenshot.jpg');
    });
  });
});