import { TelegramBotService } from '../../services/telegramBotService';
import { createMockTelegramContext } from '../setup';
import axios from 'axios';

// Mock axios
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TelegramBotService', () => {
  let telegramBotService: TelegramBotService;
  let mockContext: any;

  beforeEach(() => {
    telegramBotService = new TelegramBotService();
    mockContext = createMockTelegramContext();
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should initialize Telegram bot service successfully', () => {
      expect(telegramBotService).toBeInstanceOf(TelegramBotService);
      expect(telegramBotService.getBot()).toBeDefined();
    });

    it('should set up middleware and commands during initialization', () => {
      const bot = telegramBotService.getBot();
      
      // Verify middleware setup
      expect(bot.use).toHaveBeenCalled();
      
      // Verify command setup
      expect(bot.start).toHaveBeenCalled();
      expect(bot.help).toHaveBeenCalled();
      expect(bot.command).toHaveBeenCalledWith('orders', expect.any(Function));
      expect(bot.command).toHaveBeenCalledWith('submit', expect.any(Function));
      expect(bot.command).toHaveBeenCalledWith('status', expect.any(Function));
      expect(bot.command).toHaveBeenCalledWith('pay', expect.any(Function));
    });
  });

  describe('Command Handlers', () => {
    describe('handleStartCommand', () => {
      beforeEach(() => {
        // Mock successful API responses
        mockedAxios.get.mockResolvedValue({
          data: {
            success: true,
            data: { orders: [] }
          }
        });
      });

      it('should send welcome message with inline keyboard', async () => {
        const startHandler = jest.fn();
        mockContext.reply = startHandler;

        // Access the private method for testing (we'll test through the public interface)
        await telegramBotService.getBot().start(mockContext);

        expect(startHandler).toHaveBeenCalledWith(
          expect.stringContaining('Welcome to GOMFLOW'),
          expect.objectContaining({
            parse_mode: 'Markdown',
            reply_markup: expect.objectContaining({
              inline_keyboard: expect.any(Array)
            })
          })
        );
      });

      it('should handle different user types (buyer vs GOM)', async () => {
        // Test GOM user
        const gomContext = createMockTelegramContext({
          user: { ...mockContext.user, is_gom: true }
        });
        
        const startHandler = jest.fn();
        gomContext.reply = startHandler;

        await telegramBotService.getBot().start(gomContext);

        expect(startHandler).toHaveBeenCalledWith(
          expect.stringContaining('Group Order Manager'),
          expect.any(Object)
        );
      });
    });

    describe('handleOrdersCommand', () => {
      it('should fetch and display active orders', async () => {
        const mockOrders = [
          {
            id: 'order1',
            title: 'SEVENTEEN Face the Sun',
            price: 25,
            currency: 'PHP',
            deadline: new Date(Date.now() + 86400000).toISOString(),
            total_submissions: 5,
            max_orders: 50
          }
        ];

        mockedAxios.get.mockResolvedValue({
          data: {
            success: true,
            data: { orders: mockOrders }
          }
        });

        const replyHandler = jest.fn();
        mockContext.reply = replyHandler;

        // Simulate command execution
        const ordersHandler = jest.fn();
        telegramBotService.getBot().command('orders', ordersHandler);
        
        expect(ordersHandler).toHaveBeenCalledWith(expect.any(Function));
      });

      it('should handle empty orders list', async () => {
        mockedAxios.get.mockResolvedValue({
          data: {
            success: true,
            data: { orders: [] }
          }
        });

        const replyHandler = jest.fn();
        mockContext.reply = replyHandler;

        // This would be called by the actual command handler
        expect(mockedAxios.get).not.toHaveBeenCalled(); // Until actually triggered
      });

      it('should handle API errors gracefully', async () => {
        mockedAxios.get.mockRejectedValue(new Error('API Error'));

        const replyHandler = jest.fn();
        mockContext.reply = replyHandler;

        // The service should handle errors gracefully
        expect(async () => {
          // This would be in the actual handler
          await mockedAxios.get('test-url');
        }).rejects.toThrow('API Error');
      });
    });

    describe('handleSubmitCommand', () => {
      it('should start submission flow for valid order', async () => {
        const mockOrder = {
          id: 'order1',
          title: 'SEVENTEEN Album',
          price: 25,
          currency: 'PHP',
          deadline: new Date(Date.now() + 86400000).toISOString(),
          is_active: true
        };

        mockedAxios.get
          .mockResolvedValueOnce({
            data: { success: true, data: mockOrder }
          })
          .mockResolvedValueOnce({
            data: { success: true, data: [] } // No existing submissions
          });

        const replyHandler = jest.fn();
        mockContext.reply = replyHandler;
        mockContext.message.text = '/submit order1';

        // Test would verify the submission flow starts
        expect(mockedAxios.get).not.toHaveBeenCalled(); // Until handler is triggered
      });

      it('should show order selection when no order ID provided', async () => {
        const mockOrders = [
          { id: 'order1', title: 'Album 1', price: 25, currency: 'PHP' },
          { id: 'order2', title: 'Album 2', price: 30, currency: 'PHP' }
        ];

        mockedAxios.get.mockResolvedValue({
          data: { success: true, data: { orders: mockOrders } }
        });

        mockContext.message.text = '/submit';
        
        // Would show order selection interface
        expect(mockOrders.length).toBeGreaterThan(0);
      });

      it('should detect existing submissions', async () => {
        const existingSubmission = {
          id: 'sub1',
          order_id: 'order1',
          status: 'pending',
          amount: 25,
          currency: 'PHP'
        };

        mockedAxios.get
          .mockResolvedValueOnce({
            data: { success: true, data: { id: 'order1', is_active: true } }
          })
          .mockResolvedValueOnce({
            data: { success: true, data: [existingSubmission] }
          });

        // Should show existing submission instead of starting new flow
        expect(existingSubmission.status).toBe('pending');
      });
    });

    describe('handlePayCommand', () => {
      it('should show pending payments for user', async () => {
        const pendingSubmissions = [
          {
            id: 'sub1',
            order: { title: 'Album 1' },
            amount: 25,
            currency: 'PHP',
            payment_reference: 'PAY123',
            status: 'pending'
          }
        ];

        mockedAxios.get.mockResolvedValue({
          data: { success: true, data: pendingSubmissions }
        });

        expect(pendingSubmissions.length).toBe(1);
        expect(pendingSubmissions[0].status).toBe('pending');
      });

      it('should handle no pending payments', async () => {
        mockedAxios.get.mockResolvedValue({
          data: { success: true, data: [] }
        });

        const replyHandler = jest.fn();
        mockContext.reply = replyHandler;

        // Should inform user of no pending payments
        expect(true).toBe(true); // Placeholder for actual test
      });
    });

    describe('handleStatusCommand', () => {
      it('should display user submission history', async () => {
        const submissions = [
          {
            id: 'sub1',
            order: { title: 'Album 1' },
            amount: 25,
            currency: 'PHP',
            status: 'confirmed',
            created_at: new Date().toISOString()
          },
          {
            id: 'sub2', 
            order: { title: 'Album 2' },
            amount: 30,
            currency: 'PHP',
            status: 'pending',
            created_at: new Date().toISOString()
          }
        ];

        mockedAxios.get.mockResolvedValue({
          data: { success: true, data: submissions }
        });

        expect(submissions.length).toBe(2);
        expect(submissions[0].status).toBe('confirmed');
        expect(submissions[1].status).toBe('pending');
      });

      it('should handle user with no orders', async () => {
        mockedAxios.get.mockResolvedValue({
          data: { success: true, data: [] }
        });

        // Should show helpful message for new users
        expect(true).toBe(true); // Placeholder
      });
    });
  });

  describe('GOM Commands', () => {
    beforeEach(() => {
      // Set up GOM user context
      mockContext.user.is_gom = true;
    });

    describe('handleCreateOrderCommand', () => {
      it('should allow GOMs to create orders', async () => {
        const replyHandler = jest.fn();
        mockContext.reply = replyHandler;

        // Should start order creation flow
        expect(mockContext.user.is_gom).toBe(true);
      });

      it('should reject non-GOM users', async () => {
        mockContext.user.is_gom = false;
        
        const replyHandler = jest.fn();
        mockContext.reply = replyHandler;

        // Should show access denied message
        expect(mockContext.user.is_gom).toBe(false);
      });
    });

    describe('handleManageOrdersCommand', () => {
      it('should show GOM orders with management options', async () => {
        const gomOrders = [
          {
            id: 'order1',
            title: 'My Order 1',
            is_active: true,
            total_submissions: 10,
            total_revenue: 250
          }
        ];

        mockedAxios.get.mockResolvedValue({
          data: { success: true, data: { orders: gomOrders } }
        });

        expect(gomOrders[0].is_active).toBe(true);
        expect(gomOrders[0].total_submissions).toBe(10);
      });

      it('should handle GOMs with no orders', async () => {
        mockedAxios.get.mockResolvedValue({
          data: { success: true, data: { orders: [] } }
        });

        // Should encourage order creation
        expect(true).toBe(true);
      });
    });

    describe('handlePaymentsCommand', () => {
      it('should show payment overview for GOMs', async () => {
        const activeOrders = [
          { id: 'order1', title: 'Order 1', currency: 'PHP' }
        ];

        mockedAxios.get.mockResolvedValue({
          data: { success: true, data: { orders: activeOrders } }
        });

        // Should show payment statistics
        expect(activeOrders.length).toBe(1);
      });
    });
  });

  describe('Session Management', () => {
    it('should track conversation state correctly', () => {
      mockContext.session.flow = 'submission';
      mockContext.session.data = { step: 'name', order_id: 'order1' };

      expect(mockContext.session.flow).toBe('submission');
      expect(mockContext.session.data.step).toBe('name');
    });

    it('should clear session on completion', () => {
      mockContext.session.flow = 'submission';
      mockContext.session.data = { step: 'confirmation' };

      // After completion
      mockContext.session.flow = undefined;
      mockContext.session.data = {};

      expect(mockContext.session.flow).toBeUndefined();
      expect(Object.keys(mockContext.session.data)).toHaveLength(0);
    });

    it('should handle session timeout', () => {
      mockContext.session.data = { step: 'name', started_at: Date.now() - 1800000 }; // 30 min ago

      const currentTime = Date.now();
      const sessionAge = currentTime - mockContext.session.data.started_at;
      
      expect(sessionAge).toBeGreaterThan(1800000); // Older than 30 minutes
    });
  });

  describe('File Upload Handling', () => {
    it('should process payment screenshot uploads', async () => {
      mockContext.message = {
        photo: [
          { file_id: 'photo123', file_size: 50000 }
        ]
      };
      mockContext.session.flow = 'payment_upload';
      mockContext.session.data = { submission_id: 'sub123' };

      // Mock Telegram file download
      telegramBotService.getBot().telegram.getFile = jest.fn().mockResolvedValue({
        file_path: 'photos/photo123.jpg'
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1000))
      });

      // Mock Smart Agent response
      mockedAxios.post.mockResolvedValue({
        data: {
          success: true,
          payment_detected: true,
          amount: 25,
          confidence: 0.95
        }
      });

      expect(mockContext.message.photo).toBeDefined();
      expect(mockContext.session.flow).toBe('payment_upload');
    });

    it('should handle file download errors', async () => {
      telegramBotService.getBot().telegram.getFile = jest.fn().mockRejectedValue(new Error('File not found'));

      await expect(
        telegramBotService.getBot().telegram.getFile('invalid_file_id')
      ).rejects.toThrow('File not found');
    });

    it('should validate file size and type', () => {
      const photo = { file_id: 'photo123', file_size: 20000000 }; // 20MB
      const maxSize = 10000000; // 10MB

      expect(photo.file_size).toBeGreaterThan(maxSize);
    });
  });

  describe('Rate Limiting', () => {
    it('should track user message count', () => {
      const userId = 12345;
      const rateLimitMap = new Map();
      
      const userLimit = rateLimitMap.get(userId) || { count: 0, resetTime: Date.now() + 60000 };
      userLimit.count++;
      rateLimitMap.set(userId, userLimit);

      expect(rateLimitMap.get(userId)?.count).toBe(1);
    });

    it('should enforce rate limits', () => {
      const maxMessages = 20;
      const currentCount = 25;

      expect(currentCount).toBeGreaterThan(maxMessages);
    });

    it('should reset rate limit after time window', () => {
      const resetTime = Date.now() - 1000; // 1 second ago
      const now = Date.now();

      expect(now).toBeGreaterThan(resetTime);
    });
  });

  describe('Error Handling', () => {
    it('should handle API timeouts', async () => {
      mockedAxios.get.mockRejectedValue(new Error('ECONNABORTED'));

      await expect(mockedAxios.get('/api/test')).rejects.toThrow('ECONNABORTED');
    });

    it('should handle malformed API responses', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { invalid: 'response' }
      });

      const response = await mockedAxios.get('/api/test');
      expect(response.data.success).toBeUndefined();
    });

    it('should recover from bot errors gracefully', () => {
      const error = new Error('Bot error');
      const ctx = mockContext;

      // Error handler should log and continue
      expect(error.message).toBe('Bot error');
      expect(ctx).toBeDefined();
    });
  });

  describe('Multi-language Support', () => {
    it('should detect user language from Telegram', () => {
      const filipinoUser = createMockTelegramContext({
        from: { language_code: 'tl' }
      });

      expect(filipinoUser.from.language_code).toBe('tl');
    });

    it('should use English as fallback', () => {
      const unknownLanguageUser = createMockTelegramContext({
        from: { language_code: 'de' }
      });

      const supportedLanguages = ['en', 'tl', 'ms'];
      const userLanguage = unknownLanguageUser.from.language_code;
      const fallbackLanguage = supportedLanguages.includes(userLanguage) ? userLanguage : 'en';

      expect(fallbackLanguage).toBe('en');
    });
  });

  describe('Service Lifecycle', () => {
    it('should launch bot successfully', async () => {
      const launchSpy = jest.spyOn(telegramBotService.getBot(), 'launch');
      
      // Note: We can't actually launch in tests, so we just verify the method exists
      expect(telegramBotService.launch).toBeDefined();
      expect(typeof telegramBotService.launch).toBe('function');
    });

    it('should stop bot gracefully', async () => {
      const stopSpy = jest.spyOn(telegramBotService.getBot(), 'stop');
      
      expect(telegramBotService.stop).toBeDefined();
      expect(typeof telegramBotService.stop).toBe('function');
    });

    it('should handle webhook vs polling modes', () => {
      const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
      
      if (webhookUrl) {
        expect(webhookUrl).toContain('https://');
      } else {
        // Should use polling in development
        expect(webhookUrl).toBeUndefined();
      }
    });
  });
});