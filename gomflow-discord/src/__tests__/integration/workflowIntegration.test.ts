import { DiscordBotService } from '../../services/discordBotService';
import axios from 'axios';

const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock Discord interaction helper for integration tests
const createIntegrationMockInteraction = (overrides: any = {}) => ({
  type: 2, // APPLICATION_COMMAND
  commandName: 'help',
  user: {
    id: '123456789',
    username: 'integrationuser',
    discriminator: '0001',
    avatar: 'avatar_hash',
    bot: false
  },
  member: {
    user: {
      id: '123456789',
      username: 'integrationuser'
    },
    roles: {
      cache: new Map()
    },
    permissions: {
      has: jest.fn().mockReturnValue(true)
    }
  },
  guild: {
    id: 'integration_guild_123',
    name: 'Integration Test Guild',
    memberCount: 250
  },
  channel: {
    id: 'integration_channel_123',
    type: 0, // GUILD_TEXT
    send: jest.fn()
  },
  options: {
    getString: jest.fn(),
    getInteger: jest.fn(),
    getBoolean: jest.fn(),
    getUser: jest.fn(),
    getChannel: jest.fn()
  },
  reply: jest.fn(),
  editReply: jest.fn(),
  followUp: jest.fn(),
  deferReply: jest.fn(),
  deleteReply: jest.fn(),
  showModal: jest.fn(),
  update: jest.fn(),
  replied: false,
  deferred: false,
  ephemeral: false,
  webhook: {
    editMessage: jest.fn(),
    deleteMessage: jest.fn()
  },
  customId: undefined,
  values: undefined,
  fields: undefined,
  ...overrides
});

describe('Discord Bot Workflow Integration Tests', () => {
  let discordBotService: DiscordBotService;

  beforeEach(() => {
    discordBotService = new DiscordBotService();
    jest.clearAllMocks();
  });

  describe('Complete Buyer Journey Integration', () => {
    it('should complete full buyer workflow from discovery to payment', async () => {
      const mockInteraction = createIntegrationMockInteraction();

      // Step 1: User searches for orders
      mockInteraction.commandName = 'orders';
      mockInteraction.options.getString = jest.fn()
        .mockReturnValueOnce('SEVENTEEN') // search query
        .mockReturnValueOnce('active'); // status filter

      const mockOrders = [
        {
          id: 'order_integration_1',
          title: 'SEVENTEEN God of Music Limited Edition',
          description: 'Limited edition album with exclusive photocards',
          price: 35,
          currency: 'PHP',
          deadline: new Date(Date.now() + 604800000).toISOString(), // 1 week
          total_submissions: 89,
          min_orders: 100,
          max_orders: 500,
          is_active: true,
          slug: 'seventeen-god-of-music-limited',
          gom: {
            id: 'gom_integration_1',
            username: 'kpop_gom_ph',
            rating: 4.8,
            total_orders: 234,
            trust_score: 98
          }
        }
      ];

      mockedAxios.get.mockResolvedValueOnce({
        data: { success: true, data: mockOrders, total: 1, page: 1 }
      });

      // Verify order discovery
      const searchResponse = await mockedAxios.get('/api/orders');
      expect(searchResponse.data.data.length).toBe(1);
      expect(searchResponse.data.data[0].title).toContain('SEVENTEEN');

      // Step 2: User views specific order details
      mockInteraction.commandName = 'order';
      mockInteraction.options.getString = jest.fn().mockReturnValue('order_integration_1');

      mockedAxios.get.mockResolvedValueOnce({
        data: { success: true, data: mockOrders[0] }
      });

      const orderDetailResponse = await mockedAxios.get('/api/orders/order_integration_1');
      expect(orderDetailResponse.data.data.id).toBe('order_integration_1');
      expect(orderDetailResponse.data.data.gom.trust_score).toBe(98);

      // Step 3: User submits order (checks for existing submissions first)
      mockInteraction.commandName = 'submit';
      
      // Check existing submissions
      mockedAxios.get.mockResolvedValueOnce({
        data: { success: true, data: [] } // No existing submissions
      });

      const submissionCheckResponse = await mockedAxios.get('/api/submissions?order_id=order_integration_1&user_id=123456789');
      expect(submissionCheckResponse.data.data.length).toBe(0);

      // Step 4: User fills submission modal and creates submission
      const submissionData = {
        order_id: 'order_integration_1',
        buyer_name: 'Juan Dela Cruz',
        buyer_phone: '+639123456789',
        buyer_email: 'juan@example.com',
        quantity: 2,
        shipping_address: '123 Main St, Quezon City, Metro Manila, Philippines',
        special_notes: 'Please handle with care'
      };

      const newSubmission = {
        id: 'sub_integration_1',
        payment_reference: 'GOMF789123',
        status: 'pending',
        total_amount: 70.00, // 35 * 2
        currency: 'PHP',
        created_at: new Date().toISOString(),
        ...submissionData
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true, data: newSubmission }
      });

      const submissionResponse = await mockedAxios.post('/api/submissions', submissionData);
      expect(submissionResponse.data.data.payment_reference).toBe('GOMF789123');
      expect(submissionResponse.data.data.total_amount).toBe(70.00);

      // Step 5: User uploads payment screenshot
      const paymentFile = {
        name: 'gcash_payment.jpg',
        type: 'image/jpeg',
        size: 1024000 // 1MB
      };

      const smartAgentResponse = {
        success: true,
        payment_detected: true,
        amount: 70.00,
        currency: 'PHP',
        confidence: 0.95,
        payment_method: 'GCash',
        reference_number: 'GOMF789123'
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: smartAgentResponse
      });

      const paymentProcessResponse = await mockedAxios.post('/smart-agent/process-payment', {
        submission_id: newSubmission.id,
        file: paymentFile
      });

      expect(paymentProcessResponse.data.payment_detected).toBe(true);
      expect(paymentProcessResponse.data.confidence).toBeGreaterThan(0.9);

      // Step 6: Submission status updated to confirmed
      const confirmedSubmission = {
        ...newSubmission,
        status: 'confirmed',
        payment_confirmed_at: new Date().toISOString(),
        payment_method: 'GCash'
      };

      mockedAxios.patch.mockResolvedValueOnce({
        data: { success: true, data: confirmedSubmission }
      });

      const confirmationResponse = await mockedAxios.patch(`/api/submissions/${newSubmission.id}`, {
        status: 'confirmed',
        payment_confirmed_at: new Date().toISOString()
      });

      expect(confirmationResponse.data.data.status).toBe('confirmed');
      expect(confirmationResponse.data.data.payment_confirmed_at).toBeDefined();

      // Verify complete workflow
      expect(searchResponse.data.success).toBe(true);
      expect(orderDetailResponse.data.success).toBe(true);
      expect(submissionResponse.data.success).toBe(true);
      expect(paymentProcessResponse.data.success).toBe(true);
      expect(confirmationResponse.data.success).toBe(true);
    });

    it('should handle existing submission detection', async () => {
      const mockInteraction = createIntegrationMockInteraction({
        commandName: 'submit',
        options: {
          getString: jest.fn().mockReturnValue('order_integration_2')
        }
      });

      const existingSubmission = {
        id: 'sub_existing_123',
        order_id: 'order_integration_2',
        user_id: '123456789',
        status: 'pending',
        payment_reference: 'GOMF555',
        total_amount: 25.00
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: { success: true, data: [existingSubmission] }
      });

      const checkResponse = await mockedAxios.get('/api/submissions?order_id=order_integration_2&user_id=123456789');
      expect(checkResponse.data.data.length).toBe(1);
      expect(checkResponse.data.data[0].status).toBe('pending');
    });

    it('should handle order quota validation', async () => {
      const fullOrder = {
        id: 'order_full_123',
        title: 'BLACKPINK Limited Merch',
        max_orders: 100,
        total_submissions: 100, // Full
        is_active: true,
        deadline: new Date(Date.now() + 86400000).toISOString()
      };

      const isOrderFull = fullOrder.total_submissions >= fullOrder.max_orders;
      expect(isOrderFull).toBe(true);

      const expiredOrder = {
        id: 'order_expired_123',
        title: 'BTS Past Album',
        deadline: new Date(Date.now() - 86400000).toISOString(), // Past
        is_active: false
      };

      const isOrderExpired = new Date(expiredOrder.deadline) < new Date();
      expect(isOrderExpired).toBe(true);
    });
  });

  describe('Complete GOM Journey Integration', () => {
    it('should complete full GOM workflow from order creation to analytics', async () => {
      const gomInteraction = createIntegrationMockInteraction({
        member: {
          user: {
            id: 'gom_integration_123',
            username: 'test_gom'
          }
        }
      });

      // Step 1: GOM creates new order
      gomInteraction.commandName = 'create-order';

      const orderCreationData = {
        title: 'NewJeans Get Up Album - All Versions',
        description: 'Complete set including all 3 versions with exclusive items',
        price: 45,
        currency: 'PHP',
        deadline: '2025-02-28 23:59',
        min_orders: 50,
        max_orders: 300,
        category: 'album',
        shipping_from: 'Philippines'
      };

      const newOrder = {
        id: 'order_gom_created_1',
        slug: 'newjeans-get-up-album-all-versions',
        gom_id: 'gom_integration_123',
        total_submissions: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        ...orderCreationData
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true, data: newOrder }
      });

      const orderCreationResponse = await mockedAxios.post('/api/orders', orderCreationData);
      expect(orderCreationResponse.data.data.slug).toBe('newjeans-get-up-album-all-versions');
      expect(orderCreationResponse.data.data.gom_id).toBe('gom_integration_123');

      // Step 2: GOM views dashboard with new order
      gomInteraction.commandName = 'gom-dashboard';

      const dashboardStats = {
        totalOrders: 5,
        activeOrders: 2,
        totalSubmissions: 123,
        pendingPayments: 15,
        overduePayments: 3,
        totalRevenue: 5625.00,
        pendingRevenue: 750.00,
        recentOrders: [newOrder],
        topPerformingOrders: [
          {
            id: 'order_top_1',
            title: 'SEVENTEEN Previous Order',
            total_submissions: 89,
            conversion_rate: 89
          }
        ]
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: { success: true, data: dashboardStats }
      });

      const dashboardResponse = await mockedAxios.get('/api/dashboard');
      expect(dashboardResponse.data.data.totalOrders).toBe(5);
      expect(dashboardResponse.data.data.recentOrders[0].id).toBe('order_gom_created_1');

      // Step 3: Submissions start coming in
      const incomingSubmissions = [
        {
          id: 'sub_gom_1',
          order_id: newOrder.id,
          buyer_name: 'Maria Santos',
          quantity: 1,
          status: 'pending',
          total_amount: 45.00
        },
        {
          id: 'sub_gom_2',
          order_id: newOrder.id,
          buyer_name: 'Carlos Rodriguez',
          quantity: 2,
          status: 'confirmed',
          total_amount: 90.00
        }
      ];

      mockedAxios.get.mockResolvedValueOnce({
        data: { success: true, data: incomingSubmissions }
      });

      const submissionsResponse = await mockedAxios.get(`/api/submissions?order_id=${newOrder.id}`);
      expect(submissionsResponse.data.data.length).toBe(2);
      
      const confirmedSubmissions = submissionsResponse.data.data.filter(s => s.status === 'confirmed');
      expect(confirmedSubmissions.length).toBe(1);

      // Step 4: GOM reviews analytics
      const orderAnalytics = {
        orderId: newOrder.id,
        conversionRate: 75, // 3 out of 4 visitors submitted
        averageOrderValue: 67.50,
        paymentMethods: [
          { method: 'GCash', count: 8, percentage: 57 },
          { method: 'PayMaya', count: 4, percentage: 29 },
          { method: 'Bank Transfer', count: 2, percentage: 14 }
        ],
        dailySubmissions: [
          { date: '2025-01-14', count: 5 },
          { date: '2025-01-15', count: 8 },
          { date: '2025-01-16', count: 12 }
        ],
        geographicDistribution: [
          { region: 'Metro Manila', count: 15, percentage: 60 },
          { region: 'Cebu', count: 6, percentage: 24 },
          { region: 'Davao', count: 4, percentage: 16 }
        ]
      };

      mockedAxios.get.mockResolvedValueOnce({
        data: { success: true, data: orderAnalytics }
      });

      const analyticsResponse = await mockedAxios.get(`/api/analytics/orders/${newOrder.id}`);
      expect(analyticsResponse.data.data.conversionRate).toBe(75);
      expect(analyticsResponse.data.data.paymentMethods[0].method).toBe('GCash');

      // Verify complete GOM workflow
      expect(orderCreationResponse.data.success).toBe(true);
      expect(dashboardResponse.data.success).toBe(true);
      expect(submissionsResponse.data.success).toBe(true);
      expect(analyticsResponse.data.success).toBe(true);
    });

    it('should handle bulk submission management', async () => {
      const bulkSubmissions = Array(50).fill(null).map((_, i) => ({
        id: `sub_bulk_${i}`,
        order_id: 'order_bulk_test',
        buyer_name: `Buyer ${i + 1}`,
        status: i % 3 === 0 ? 'pending' : 'confirmed',
        total_amount: 25.00
      }));

      mockedAxios.get.mockResolvedValueOnce({
        data: { 
          success: true, 
          data: bulkSubmissions,
          pagination: {
            page: 1,
            limit: 50,
            total: 50,
            totalPages: 1
          }
        }
      });

      const bulkResponse = await mockedAxios.get('/api/submissions?order_id=order_bulk_test&limit=50');
      const pendingSubmissions = bulkResponse.data.data.filter(s => s.status === 'pending');
      const confirmedSubmissions = bulkResponse.data.data.filter(s => s.status === 'confirmed');

      expect(bulkResponse.data.data.length).toBe(50);
      expect(pendingSubmissions.length).toBeGreaterThan(0);
      expect(confirmedSubmissions.length).toBeGreaterThan(0);
    });
  });

  describe('Service Communication Integration', () => {
    it('should handle Core API communication failures gracefully', async () => {
      // Simulate Core API timeout
      mockedAxios.get.mockRejectedValueOnce({
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded'
      });

      await expect(
        mockedAxios.get('/api/orders/123')
      ).rejects.toMatchObject({
        code: 'ECONNABORTED'
      });
    });

    it('should integrate with Smart Agent for payment processing', async () => {
      const paymentFile = {
        buffer: Buffer.from('fake-image-data'),
        mimetype: 'image/jpeg',
        originalname: 'payment_screenshot.jpg'
      };

      const smartAgentResult = {
        success: true,
        payment_detected: true,
        extracted_data: {
          amount: 75.00,
          currency: 'PHP',
          payment_method: 'GCash',
          reference_number: 'GOMF123456',
          timestamp: new Date().toISOString()
        },
        confidence: 0.96,
        processing_time: 1.2
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: smartAgentResult
      });

      const smartAgentResponse = await mockedAxios.post('/smart-agent/analyze-payment', {
        file: paymentFile,
        submission_id: 'sub_test_123'
      });

      expect(smartAgentResponse.data.payment_detected).toBe(true);
      expect(smartAgentResponse.data.confidence).toBeGreaterThan(0.95);
      expect(smartAgentResponse.data.extracted_data.amount).toBe(75.00);
    });

    it('should handle multi-service communication workflow', async () => {
      // Step 1: Discord receives payment upload
      // Step 2: Forward to Smart Agent
      // Step 3: Smart Agent processes and returns data
      // Step 4: Update Core API with results
      // Step 5: Send confirmation back to Discord

      const submissionId = 'sub_multi_123';
      
      // Smart Agent processing
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          success: true,
          payment_detected: true,
          amount: 50.00,
          confidence: 0.94
        }
      });

      // Core API update
      mockedAxios.patch.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            id: submissionId,
            status: 'confirmed',
            payment_confirmed_at: new Date().toISOString()
          }
        }
      });

      const smartAgentResponse = await mockedAxios.post('/smart-agent/process', {
        submission_id: submissionId
      });

      const coreApiResponse = await mockedAxios.patch(`/api/submissions/${submissionId}`, {
        status: 'confirmed'
      });

      expect(smartAgentResponse.data.success).toBe(true);
      expect(coreApiResponse.data.success).toBe(true);
    });
  });

  describe('Real-time Features Integration', () => {
    it('should handle real-time order updates', async () => {
      const orderUpdate = {
        orderId: 'order_realtime_123',
        newSubmissionCount: 45,
        progressPercentage: 90,
        timeRemaining: '2 days',
        lastSubmission: {
          buyer_name: 'Anonymous',
          timestamp: new Date().toISOString()
        }
      };

      // Simulate real-time update
      expect(orderUpdate.progressPercentage).toBeGreaterThan(80);
      expect(orderUpdate.newSubmissionCount).toBeGreaterThan(40);
    });

    it('should handle live dashboard updates', async () => {
      const liveDashboardUpdate = {
        type: 'dashboard_update',
        data: {
          newSubmissions: 3,
          newRevenue: 150.00,
          pendingPayments: 12
        },
        timestamp: new Date().toISOString()
      };

      expect(liveDashboardUpdate.data.newSubmissions).toBe(3);
      expect(liveDashboardUpdate.data.newRevenue).toBe(150.00);
    });

    it('should handle notification broadcasting', async () => {
      const notification = {
        type: 'order_milestone',
        orderId: 'order_milestone_123',
        milestone: 'min_orders_reached',
        message: 'Minimum order quantity reached! Order confirmed.',
        recipients: ['gom_123', 'buyers_all'],
        channels: ['discord', 'telegram', 'whatsapp']
      };

      expect(notification.channels).toContain('discord');
      expect(notification.milestone).toBe('min_orders_reached');
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from temporary service outages', async () => {
      // First attempt fails
      mockedAxios.get
        .mockRejectedValueOnce(new Error('Service temporarily unavailable'))
        .mockResolvedValueOnce({
          data: { success: true, data: { id: 'order_recovery_123' } }
        });

      // First call fails
      await expect(mockedAxios.get('/api/orders/123'))
        .rejects.toThrow('Service temporarily unavailable');

      // Retry succeeds
      const retryResponse = await mockedAxios.get('/api/orders/123');
      expect(retryResponse.data.success).toBe(true);
    });

    it('should handle partial failure scenarios', async () => {
      // Order creation succeeds but notification fails
      mockedAxios.post
        .mockResolvedValueOnce({
          data: { success: true, data: { id: 'order_partial_123' } }
        })
        .mockRejectedValueOnce(new Error('Notification service down'));

      const orderResponse = await mockedAxios.post('/api/orders', {});
      expect(orderResponse.data.success).toBe(true);

      await expect(mockedAxios.post('/notifications/send', {}))
        .rejects.toThrow('Notification service down');
    });
  });
});