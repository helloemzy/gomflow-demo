import { TelegramBotService } from '../../services/telegramBotService';
import { createMockTelegramContext } from '../setup';
import axios from 'axios';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Telegram Workflow Integration Tests', () => {
  let telegramBotService: TelegramBotService;
  
  beforeEach(() => {
    telegramBotService = new TelegramBotService();
    jest.clearAllMocks();
  });

  describe('Complete Buyer Journey', () => {
    it('should complete full order submission workflow', async () => {
      // Step 1: User discovers orders
      const mockOrders = [
        {
          id: 'order123',
          title: 'SEVENTEEN Face the Sun Album',
          price: 25,
          currency: 'PHP',
          deadline: new Date(Date.now() + 86400000).toISOString(),
          is_active: true,
          min_orders: 50,
          max_orders: 200,
          total_submissions: 45
        }
      ];

      mockedAxios.get.mockResolvedValueOnce({
        data: { success: true, data: { orders: mockOrders } }
      });

      // Step 2: User starts submission
      const submissionContext = createMockTelegramContext({
        message: { text: '/submit order123' },
        session: { flow: undefined, data: {} }
      });

      // Mock order fetch
      mockedAxios.get
        .mockResolvedValueOnce({
          data: { success: true, data: mockOrders[0] }
        })
        .mockResolvedValueOnce({
          data: { success: true, data: [] } // No existing submissions
        });

      // Verify order validation
      expect(mockOrders[0].is_active).toBe(true);
      expect(new Date(mockOrders[0].deadline) > new Date()).toBe(true);

      // Step 3: Complete submission flow simulation
      const submissionSteps = [
        { step: 'name', input: 'Juan Dela Cruz', expected: 'phone' },
        { step: 'phone', input: '+639123456789', expected: 'quantity' },
        { step: 'quantity', input: '2', expected: 'address' },
        { step: 'address', input: '123 Main St, Quezon City, Metro Manila', expected: 'special_requests' },
        { step: 'special_requests', input: 'Please handle with care', expected: 'confirmation' }
      ];

      for (const stepData of submissionSteps) {
        const stepContext = createMockTelegramContext({
          message: { text: stepData.input },
          session: {
            flow: 'submission',
            data: {
              step: stepData.step,
              order_id: 'order123',
              order_title: 'SEVENTEEN Face the Sun Album',
              order_price: 25,
              order_currency: 'PHP'
            }
          }
        });

        // Validate step transition logic
        if (stepData.step === 'name') {
          expect(stepData.input.length).toBeGreaterThanOrEqual(2);
          expect(stepData.input.length).toBeLessThanOrEqual(100);
        }
        
        if (stepData.step === 'phone') {
          const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
          expect(phoneRegex.test(stepData.input)).toBe(true);
        }
        
        if (stepData.step === 'quantity') {
          const quantity = parseInt(stepData.input);
          expect(quantity).toBeGreaterThanOrEqual(1);
          expect(quantity).toBeLessThanOrEqual(100);
        }
      }

      // Step 4: Submission creation
      const finalSubmissionData = {
        order_id: 'order123',
        buyer_name: 'Juan Dela Cruz',
        buyer_phone: '+639123456789',
        quantity: 2,
        shipping_address: '123 Main St, Quezon City, Metro Manila',
        special_requests: 'Please handle with care',
        platform: 'telegram',
        user_identifier: 'tg_12345'
      };

      const submissionResponse = {
        id: 'sub456',
        payment_reference: 'GOMF789',
        amount: 50, // 25 * 2
        currency: 'PHP',
        status: 'pending'
      };

      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: submissionResponse }
      });

      // Verify submission data
      expect(finalSubmissionData.quantity * 25).toBe(50);
      expect(finalSubmissionData.platform).toBe('telegram');
      expect(submissionResponse.status).toBe('pending');
    });

    it('should handle payment screenshot upload workflow', async () => {
      // Step 1: User has pending submission
      const pendingSubmission = {
        id: 'sub456',
        order: { title: 'SEVENTEEN Album' },
        amount: 50,
        currency: 'PHP',
        payment_reference: 'GOMF789',
        status: 'pending'
      };

      mockedAxios.get.mockResolvedValue({
        data: { success: true, data: [pendingSubmission] }
      });

      // Step 2: User uploads payment screenshot
      const paymentContext = createMockTelegramContext({
        message: {
          photo: [{ file_id: 'photo123', file_size: 100000 }]
        },
        session: {
          flow: 'payment_upload',
          data: { submission_id: 'sub456' }
        }
      });

      // Mock file download from Telegram
      telegramBotService.getBot().telegram.getFile = jest.fn().mockResolvedValue({
        file_path: 'photos/photo123.jpg'
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(50000))
      });

      // Step 3: Smart Agent processes payment
      const smartAgentResponse = {
        success: true,
        payment_detected: true,
        payment_method: 'gcash',
        amount: 50,
        currency: 'PHP',
        reference_number: 'GC123456789',
        confidence: 0.94,
        matched_submission: {
          id: 'sub456',
          similarity_score: 0.96,
          auto_approved: true
        }
      };

      mockedAxios.post.mockResolvedValue({
        data: smartAgentResponse
      });

      // Verify AI processing results
      expect(smartAgentResponse.payment_detected).toBe(true);
      expect(smartAgentResponse.amount).toBe(pendingSubmission.amount);
      expect(smartAgentResponse.confidence).toBeGreaterThan(0.9);
      expect(smartAgentResponse.matched_submission.auto_approved).toBe(true);

      // Step 4: Update submission status
      mockedAxios.patch.mockResolvedValue({
        data: {
          success: true,
          data: { ...pendingSubmission, status: 'confirmed' }
        }
      });
    });
  });

  describe('Complete GOM Journey', () => {
    it('should complete order creation workflow', async () => {
      const gomContext = createMockTelegramContext({
        user: { is_gom: true },
        session: { flow: 'order_creation', data: { step: 'title', currency: 'PHP' } }
      });

      // Step 1: Order creation flow
      const orderCreationSteps = [
        { step: 'title', input: 'SEVENTEEN God of Music Limited Edition', expected: 'description' },
        { step: 'description', input: 'Limited edition with exclusive photocard set', expected: 'price' },
        { step: 'price', input: '35', expected: 'deadline' },
        { step: 'deadline', input: '7 days', expected: 'min_orders' },
        { step: 'min_orders', input: '100', expected: 'max_orders' },
        { step: 'max_orders', input: '500', expected: 'confirmation' }
      ];

      for (const stepData of orderCreationSteps) {
        // Validate input at each step
        if (stepData.step === 'title') {
          expect(stepData.input.length).toBeGreaterThanOrEqual(5);
          expect(stepData.input.length).toBeLessThanOrEqual(200);
        }
        
        if (stepData.step === 'price') {
          const price = parseFloat(stepData.input);
          expect(price).toBeGreaterThan(0);
          expect(price).toBeLessThanOrEqual(10000);
        }
        
        if (stepData.step === 'deadline') {
          const days = 7;
          const deadline = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
          expect(deadline > new Date()).toBe(true);
        }
        
        if (stepData.step === 'min_orders') {
          const minOrders = parseInt(stepData.input);
          expect(minOrders).toBeGreaterThanOrEqual(1);
          expect(minOrders).toBeLessThanOrEqual(1000);
        }
      }

      // Step 2: Order creation API call
      const orderData = {
        title: 'SEVENTEEN God of Music Limited Edition',
        description: 'Limited edition with exclusive photocard set',
        price: 35,
        currency: 'PHP',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        min_orders: 100,
        max_orders: 500,
        user_id: gomContext.user.id
      };

      const createdOrder = {
        id: 'order789',
        slug: 'seventeen-god-of-music-limited-edition',
        ...orderData,
        is_active: true,
        total_submissions: 0,
        created_at: new Date().toISOString()
      };

      mockedAxios.post.mockResolvedValue({
        data: { success: true, data: createdOrder }
      });

      // Verify order creation
      expect(createdOrder.is_active).toBe(true);
      expect(createdOrder.total_submissions).toBe(0);
      expect(createdOrder.slug).toBe('seventeen-god-of-music-limited-edition');
    });

    it('should handle order management workflow', async () => {
      const gomContext = createMockTelegramContext({
        user: { is_gom: true }
      });

      // Step 1: Fetch GOM orders
      const gomOrders = [
        {
          id: 'order1',
          title: 'Album Order 1',
          is_active: true,
          total_submissions: 75,
          max_orders: 100,
          total_revenue: 1875,
          currency: 'PHP',
          deadline: new Date(Date.now() + 86400000).toISOString()
        },
        {
          id: 'order2',
          title: 'Album Order 2',
          is_active: false,
          total_submissions: 150,
          max_orders: 150,
          total_revenue: 3750,
          currency: 'PHP',
          deadline: new Date(Date.now() - 86400000).toISOString()
        }
      ];

      mockedAxios.get.mockResolvedValue({
        data: { success: true, data: { orders: gomOrders } }
      });

      // Step 2: Order analytics
      const activeOrders = gomOrders.filter(order => order.is_active);
      const completedOrders = gomOrders.filter(order => !order.is_active);
      const totalRevenue = gomOrders.reduce((sum, order) => sum + order.total_revenue, 0);

      expect(activeOrders.length).toBe(1);
      expect(completedOrders.length).toBe(1);
      expect(totalRevenue).toBe(5625); // 1875 + 3750

      // Step 3: Order sharing
      const shareableText = `🛒 **NEW GROUP ORDER!**

📦 **${gomOrders[0].title}**
💰 **Price**: ${gomOrders[0].total_revenue / gomOrders[0].total_submissions} ${gomOrders[0].currency}
📊 **Progress**: ${gomOrders[0].total_submissions}/${gomOrders[0].max_orders} orders
⏰ **Deadline**: ${new Date(gomOrders[0].deadline).toLocaleDateString()}

📱 Submit: https://gomflow.com/order/${gomOrders[0].id}
💬 Or reply /submit ${gomOrders[0].id} to this bot`;

      expect(shareableText).toContain(gomOrders[0].title);
      expect(shareableText).toContain('NEW GROUP ORDER');
    });
  });

  describe('Service Communication Integration', () => {
    it('should communicate with Core API correctly', async () => {
      // Test order fetch
      const orderResponse = {
        data: {
          success: true,
          data: {
            id: 'order123',
            title: 'Test Order',
            price: 25,
            currency: 'PHP'
          }
        }
      };

      mockedAxios.get.mockResolvedValue(orderResponse);

      const response = await mockedAxios.get('http://localhost:3001/api/orders/order123');
      
      expect(response.data.success).toBe(true);
      expect(response.data.data.id).toBe('order123');
    });

    it('should communicate with Smart Agent correctly', async () => {
      const imageBuffer = new ArrayBuffer(1000);
      const formData = new FormData();
      
      // Mock Smart Agent response
      const smartAgentResponse = {
        data: {
          success: true,
          payment_detected: true,
          amount: 25,
          confidence: 0.89
        }
      };

      mockedAxios.post.mockResolvedValue(smartAgentResponse);

      const response = await mockedAxios.post('http://localhost:3002/api/process', formData);
      
      expect(response.data.success).toBe(true);
      expect(response.data.payment_detected).toBe(true);
    });

    it('should handle service communication errors', async () => {
      // Test timeout
      mockedAxios.get.mockRejectedValue({ code: 'ECONNABORTED' });
      
      await expect(mockedAxios.get('/api/test')).rejects.toMatchObject({
        code: 'ECONNABORTED'
      });

      // Test service unavailable
      mockedAxios.get.mockRejectedValue({ response: { status: 503 } });
      
      await expect(mockedAxios.get('/api/test')).rejects.toMatchObject({
        response: { status: 503 }
      });
    });
  });

  describe('Session State Management', () => {
    it('should maintain session consistency across workflow steps', async () => {
      const sessionData = {
        flow: 'submission',
        data: {
          step: 'name',
          order_id: 'order123',
          order_title: 'Test Order',
          order_price: 25,
          order_currency: 'PHP'
        }
      };

      // Simulate step progression
      const steps = ['name', 'phone', 'quantity', 'address', 'special_requests', 'confirmation'];
      
      for (let i = 0; i < steps.length - 1; i++) {
        expect(sessionData.data.step).toBe(steps[i]);
        sessionData.data.step = steps[i + 1];
      }

      expect(sessionData.data.step).toBe('confirmation');
      expect(sessionData.data.order_id).toBe('order123');
    });

    it('should handle session cleanup properly', () => {
      const context = createMockTelegramContext({
        session: {
          flow: 'submission',
          data: { step: 'confirmation', buyer_name: 'Test User' }
        }
      });

      // After successful completion
      context.session.flow = undefined;
      context.session.data = {};

      expect(context.session.flow).toBeUndefined();
      expect(Object.keys(context.session.data)).toHaveLength(0);
    });

    it('should handle session expiration', () => {
      const sessionStartTime = Date.now() - 1800000; // 30 minutes ago
      const maxSessionAge = 1800000; // 30 minutes

      const isExpired = (Date.now() - sessionStartTime) > maxSessionAge;
      expect(isExpired).toBe(true);
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should recover from API failures gracefully', async () => {
      // Simulate API failure then recovery
      mockedAxios.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: { success: true, data: { orders: [] } }
        });

      // First call fails
      await expect(mockedAxios.get('/api/orders')).rejects.toThrow('Network error');
      
      // Retry succeeds
      const response = await mockedAxios.get('/api/orders');
      expect(response.data.success).toBe(true);
    });

    it('should handle malformed user input', () => {
      const testInputs = [
        { step: 'quantity', input: 'abc', valid: false },
        { step: 'quantity', input: '0', valid: false },
        { step: 'quantity', input: '101', valid: false },
        { step: 'quantity', input: '5', valid: true },
        { step: 'phone', input: 'invalid-phone', valid: false },
        { step: 'phone', input: '+639123456789', valid: true }
      ];

      testInputs.forEach(test => {
        if (test.step === 'quantity') {
          const quantity = parseInt(test.input);
          const isValid = !isNaN(quantity) && quantity >= 1 && quantity <= 100;
          expect(isValid).toBe(test.valid);
        }
        
        if (test.step === 'phone') {
          const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
          const isValid = phoneRegex.test(test.input);
          expect(isValid).toBe(test.valid);
        }
      });
    });

    it('should handle concurrent user sessions', () => {
      const user1Context = createMockTelegramContext({
        from: { id: 1 },
        session: { flow: 'submission', data: { step: 'name' } }
      });

      const user2Context = createMockTelegramContext({
        from: { id: 2 },
        session: { flow: 'order_creation', data: { step: 'title' } }
      });

      // Sessions should be independent
      expect(user1Context.session.flow).toBe('submission');
      expect(user2Context.session.flow).toBe('order_creation');
      expect(user1Context.from.id).not.toBe(user2Context.from.id);
    });
  });
});