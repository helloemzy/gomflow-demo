import { GET } from '@/app/api/dashboard/route';
import { 
  createAuthenticatedRequest,
  mockSupabaseResponse,
  expectSuccessResponse,
  expectErrorResponse,
  createTestSupabaseClient,
} from '../utils/testHelpers';
import { createClient } from '@supabase/supabase-js';

jest.mock('@supabase/supabase-js');

describe('/api/dashboard', () => {
  let mockSupabase: any;
  let mockRpc: jest.Mock;

  beforeEach(() => {
    const testClient = createTestSupabaseClient();
    mockSupabase = testClient.client;
    mockRpc = jest.fn();
    mockSupabase.rpc = mockRpc;
    
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('GET /api/dashboard', () => {
    it('should return dashboard statistics for authenticated GOM', async () => {
      const mockStats = {
        total_orders: 10,
        active_orders: 5,
        completed_orders: 3,
        cancelled_orders: 2,
        total_submissions: 150,
        pending_payments: 20,
        verified_payments: 120,
        completed_submissions: 10,
        total_revenue: 15000,
        average_order_value: 1500,
        total_quantity_sold: 300,
        conversion_rate: 0.75,
      };

      mockRpc.mockResolvedValue(mockSupabaseResponse(mockStats));

      const request = createAuthenticatedRequest('GET', '/api/dashboard', 'gom-user-id');
      const response = await GET(request);

      expectSuccessResponse(response);
      const data = await response.json();
      
      expect(data.stats).toEqual(mockStats);
      expect(mockRpc).toHaveBeenCalledWith('get_dashboard_stats', {
        gom_id_param: 'gom-user-id',
      });
    });

    it('should handle date range filters', async () => {
      const mockStats = {
        total_orders: 5,
        active_orders: 2,
        completed_orders: 3,
        cancelled_orders: 0,
        total_submissions: 50,
        pending_payments: 5,
        verified_payments: 45,
        completed_submissions: 0,
        total_revenue: 5000,
        average_order_value: 1000,
        total_quantity_sold: 100,
        conversion_rate: 0.9,
      };

      mockRpc.mockResolvedValue(mockSupabaseResponse(mockStats));

      const request = createAuthenticatedRequest('GET', '/api/dashboard', 'gom-user-id', {
        searchParams: {
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        },
      });
      const response = await GET(request);

      expectSuccessResponse(response);
      expect(mockRpc).toHaveBeenCalledWith('get_dashboard_stats', {
        gom_id_param: 'gom-user-id',
        start_date: '2024-01-01',
        end_date: '2024-01-31',
      });
    });

    it('should require authentication', async () => {
      const request = createAuthenticatedRequest('GET', '/api/dashboard', '');
      const response = await GET(request);

      expectErrorResponse(response, 401, 'Authentication required');
    });

    it('should handle database errors gracefully', async () => {
      mockRpc.mockResolvedValue(
        mockSupabaseResponse(null, { message: 'Database connection failed' })
      );

      const request = createAuthenticatedRequest('GET', '/api/dashboard', 'gom-user-id');
      const response = await GET(request);

      expectErrorResponse(response, 500, 'Failed to fetch dashboard stats');
    });

    it('should return zero stats for new GOMs', async () => {
      const mockStats = {
        total_orders: 0,
        active_orders: 0,
        completed_orders: 0,
        cancelled_orders: 0,
        total_submissions: 0,
        pending_payments: 0,
        verified_payments: 0,
        completed_submissions: 0,
        total_revenue: 0,
        average_order_value: 0,
        total_quantity_sold: 0,
        conversion_rate: 0,
      };

      mockRpc.mockResolvedValue(mockSupabaseResponse(mockStats));

      const request = createAuthenticatedRequest('GET', '/api/dashboard', 'new-gom-id');
      const response = await GET(request);

      expectSuccessResponse(response);
      const data = await response.json();
      expect(data.stats.total_orders).toBe(0);
      expect(data.stats.conversion_rate).toBe(0);
    });

    it('should validate date format', async () => {
      const request = createAuthenticatedRequest('GET', '/api/dashboard', 'gom-user-id', {
        searchParams: {
          startDate: 'invalid-date',
          endDate: '2024-01-31',
        },
      });
      const response = await GET(request);

      expectErrorResponse(response, 400, 'Invalid date format');
    });

    it('should ensure end date is after start date', async () => {
      const request = createAuthenticatedRequest('GET', '/api/dashboard', 'gom-user-id', {
        searchParams: {
          startDate: '2024-01-31',
          endDate: '2024-01-01',
        },
      });
      const response = await GET(request);

      expectErrorResponse(response, 400, 'End date must be after start date');
    });
  });
});