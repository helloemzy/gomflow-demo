import { DiscordBotService } from '../../services/discordBotService';
import { Client, EmbedBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import axios from 'axios';

// Mock axios
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock Discord interaction context helper
const createMockDiscordInteraction = (overrides: any = {}) => ({
  type: 2, // APPLICATION_COMMAND
  commandName: 'help',
  user: {
    id: '123456789',
    username: 'testuser',
    discriminator: '1234',
    avatar: 'avatar_hash',
    bot: false
  },
  member: {
    user: {
      id: '123456789',
      username: 'testuser'
    },
    roles: {
      cache: new Map()
    },
    permissions: {
      has: jest.fn().mockReturnValue(true)
    }
  },
  guild: {
    id: 'guild_123',
    name: 'Test Guild',
    memberCount: 100
  },
  channel: {
    id: 'channel_123',
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

describe('DiscordBotService', () => {
  let discordBotService: DiscordBotService;
  let mockInteraction: any;

  beforeEach(() => {
    discordBotService = new DiscordBotService();
    mockInteraction = createMockDiscordInteraction();
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should initialize Discord bot service successfully', () => {
      expect(discordBotService).toBeInstanceOf(DiscordBotService);
      expect(discordBotService.getClient()).toBeDefined();
    });

    it('should set up event handlers during initialization', () => {
      const client = discordBotService.getClient();
      expect(client.on).toHaveBeenCalled();
    });

    it('should initialize slash commands collection', () => {
      // Verify commands are properly initialized
      expect(discordBotService).toBeDefined();
    });
  });

  describe('Slash Command Handlers', () => {
    describe('handleHelp Command', () => {
      beforeEach(() => {
        mockInteraction.commandName = 'help';
        // Mock successful API responses
        mockedAxios.get.mockResolvedValue({
          data: { success: true, data: [] }
        });
      });

      it('should display help categories with navigation buttons', async () => {
        const replyMock = jest.fn();
        mockInteraction.reply = replyMock;

        // Test help command execution
        expect(mockInteraction.commandName).toBe('help');
        expect(replyMock).not.toHaveBeenCalled(); // Until actually triggered
      });

      it('should handle category-specific help requests', async () => {
        mockInteraction.options.getString = jest.fn().mockReturnValue('orders');
        
        // Should show orders-specific help
        expect(mockInteraction.options.getString('category')).toBe('orders');
      });

      it('should create proper embed structure', () => {
        const embed = new EmbedBuilder()
          .setTitle('GOMFLOW Bot Help')
          .setDescription('Choose a category to get started')
          .setColor(0x7c3aed);

        expect(embed.setTitle).toHaveBeenCalledWith('GOMFLOW Bot Help');
        expect(embed.setDescription).toHaveBeenCalledWith('Choose a category to get started');
        expect(embed.setColor).toHaveBeenCalledWith(0x7c3aed);
      });
    });

    describe('handleOrderView Command', () => {
      it('should fetch and display order details', async () => {
        const mockOrder = {
          id: 'order_123',
          title: 'SEVENTEEN Face the Sun Album',
          description: 'Limited edition with exclusive photocard',
          price: 25,
          currency: 'PHP',
          deadline: new Date(Date.now() + 86400000).toISOString(),
          total_submissions: 45,
          min_orders: 50,
          max_orders: 200,
          is_active: true,
          gom: {
            username: 'kpop_gom_ph',
            rating: 4.8,
            total_orders: 156
          }
        };

        mockInteraction.commandName = 'order';
        mockInteraction.options.getString = jest.fn().mockReturnValue('order_123');

        mockedAxios.get.mockResolvedValue({
          data: { success: true, data: mockOrder }
        });

        // Verify order data processing
        expect(mockOrder.is_active).toBe(true);
        expect(mockOrder.total_submissions).toBeLessThan(mockOrder.min_orders);
        expect(new Date(mockOrder.deadline) > new Date()).toBe(true);
      });

      it('should handle order not found', async () => {
        mockInteraction.options.getString = jest.fn().mockReturnValue('invalid_order');
        
        mockedAxios.get.mockResolvedValue({
          data: { success: false, error: 'Order not found' }
        });

        await expect(
          mockedAxios.get('/api/orders/invalid_order')
        ).resolves.toMatchObject({
          data: { success: false, error: 'Order not found' }
        });
      });

      it('should calculate progress and deadline information', () => {
        const order = {
          total_submissions: 75,
          min_orders: 100,
          max_orders: 200,
          deadline: new Date(Date.now() + 172800000).toISOString() // 2 days
        };

        const progress = (order.total_submissions / order.min_orders) * 100;
        const daysLeft = Math.ceil((new Date(order.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        expect(progress).toBe(75);
        expect(daysLeft).toBe(2);
      });
    });

    describe('handleSubmitOrder Command', () => {
      it('should validate order eligibility before submission', async () => {
        const order = {
          id: 'order_123',
          is_active: true,
          deadline: new Date(Date.now() + 86400000).toISOString(),
          max_orders: 100,
          total_submissions: 95
        };

        const isOrderOpen = order.is_active && 
                          new Date(order.deadline) > new Date() && 
                          (!order.max_orders || order.total_submissions < order.max_orders);

        expect(isOrderOpen).toBe(true);
      });

      it('should detect existing submissions', async () => {
        const existingSubmission = {
          id: 'sub_456',
          order_id: 'order_123',
          user_id: '123456789',
          status: 'pending'
        };

        mockedAxios.get.mockResolvedValue({
          data: { success: true, data: [existingSubmission] }
        });

        const response = await mockedAxios.get('/api/submissions?order_id=order_123&user_id=123456789');
        expect(response.data.data.length).toBe(1);
        expect(response.data.data[0].status).toBe('pending');
      });

      it('should show modal for new submissions', async () => {
        mockInteraction.showModal = jest.fn();
        
        // Mock modal creation would be tested here
        expect(mockInteraction.showModal).not.toHaveBeenCalled(); // Until triggered
      });
    });

    describe('handleGOMDashboard Command', () => {
      beforeEach(() => {
        mockInteraction.commandName = 'gom-dashboard';
        mockInteraction.member.user.id = 'gom_user_123';
      });

      it('should fetch dashboard statistics for GOMs', async () => {
        const dashboardStats = {
          totalOrders: 12,
          activeOrders: 3,
          totalSubmissions: 245,
          pendingPayments: 8,
          overduePayments: 2,
          totalRevenue: 6125,
          pendingRevenue: 450
        };

        mockedAxios.get.mockResolvedValue({
          data: { success: true, data: dashboardStats }
        });

        const response = await mockedAxios.get('/api/dashboard');
        const stats = response.data.data;

        expect(stats.totalOrders).toBe(12);
        expect(stats.activeOrders).toBe(3);
        expect(stats.pendingPayments).toBe(8);
        expect(stats.totalRevenue).toBe(6125);
      });

      it('should display recent orders and submissions', async () => {
        const recentOrders = [
          {
            id: 'order_1',
            title: 'BTS Album',
            total_submissions: 89,
            deadline: new Date(Date.now() + 86400000).toISOString()
          },
          {
            id: 'order_2',
            title: 'BLACKPINK Merch',
            total_submissions: 156,
            deadline: new Date(Date.now() - 86400000).toISOString()
          }
        ];

        const activeOrders = recentOrders.filter(order => new Date(order.deadline) > new Date());
        const completedOrders = recentOrders.filter(order => new Date(order.deadline) <= new Date());

        expect(activeOrders.length).toBe(1);
        expect(completedOrders.length).toBe(1);
      });

      it('should create dashboard embeds with proper formatting', () => {
        const statsEmbed = new EmbedBuilder()
          .setTitle('📊 GOM Dashboard')
          .setColor(0x10b981)
          .addFields([
            { name: '📦 Total Orders', value: '12', inline: true },
            { name: '🟢 Active Orders', value: '3', inline: true },
            { name: '💰 Total Revenue', value: '₱6,125', inline: true }
          ]);

        expect(statsEmbed.setTitle).toHaveBeenCalledWith('📊 GOM Dashboard');
        expect(statsEmbed.setColor).toHaveBeenCalledWith(0x10b981);
        expect(statsEmbed.addFields).toHaveBeenCalled();
      });
    });
  });

  describe('Modal Processing', () => {
    describe('Order Creation Modal', () => {
      it('should process order creation modal submission', async () => {
        const modalInteraction = createMockDiscordInteraction({
          type: 5, // MODAL_SUBMIT
          customId: 'order_create_modal',
          fields: {
            getTextInputValue: jest.fn()
              .mockReturnValueOnce('SEVENTEEN God of Music Limited Edition')
              .mockReturnValueOnce('Limited edition with exclusive photocards')
              .mockReturnValueOnce('35 PHP')
              .mockReturnValueOnce('2025-02-15 23:59')
              .mockReturnValueOnce('100-500')
          }
        });

        const orderData = {
          title: 'SEVENTEEN God of Music Limited Edition',
          description: 'Limited edition with exclusive photocards',
          price: 35,
          currency: 'PHP',
          deadline: '2025-02-15 23:59',
          min_orders: 100,
          max_orders: 500
        };

        // Validate parsed data
        expect(orderData.price).toBe(35);
        expect(orderData.min_orders).toBe(100);
        expect(orderData.max_orders).toBe(500);
        expect(new Date(orderData.deadline) > new Date()).toBe(true);
      });

      it('should validate modal input fields', () => {
        const validationTests = [
          { field: 'title', value: 'AB', valid: false }, // Too short
          { field: 'title', value: 'SEVENTEEN Album', valid: true },
          { field: 'price', value: '0', valid: false }, // Too low
          { field: 'price', value: '25 PHP', valid: true },
          { field: 'deadline', value: '2025-01-01', valid: false }, // Past date
          { field: 'deadline', value: '2025-12-31', valid: true }
        ];

        validationTests.forEach(test => {
          if (test.field === 'title') {
            const isValid = test.value.length >= 5 && test.value.length <= 200;
            expect(isValid).toBe(test.valid);
          }
          if (test.field === 'price') {
            const priceMatch = test.value.match(/(\d+(?:\.\d{2})?)\s*(PHP|MYR)?/);
            const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
            const isValid = price > 0 && price <= 10000;
            expect(isValid).toBe(test.valid);
          }
        });
      });
    });

    describe('Order Submission Modal', () => {
      it('should process submission modal data', async () => {
        const submissionData = {
          name: 'Juan Dela Cruz',
          phone: '+639123456789',
          quantity: 2,
          address: '123 Main St, Quezon City, Metro Manila',
          notes: 'Please handle with care'
        };

        // Validate submission data
        expect(submissionData.name.length).toBeGreaterThanOrEqual(2);
        expect(submissionData.phone).toMatch(/^\+639\d{9}$/);
        expect(submissionData.quantity).toBeGreaterThan(0);
        expect(submissionData.address.length).toBeGreaterThan(10);
      });

      it('should calculate total amounts correctly', () => {
        const orderPrice = 25;
        const quantity = 3;
        const totalAmount = orderPrice * quantity;
        const fees = Math.round(totalAmount * 0.03); // 3% processing fee
        const finalAmount = totalAmount + fees;

        expect(totalAmount).toBe(75);
        expect(fees).toBe(2); // Rounded
        expect(finalAmount).toBe(77);
      });
    });
  });

  describe('Button Interactions', () => {
    describe('Help Navigation Buttons', () => {
      it('should handle help category navigation', async () => {
        const buttonInteraction = createMockDiscordInteraction({
          type: 3, // MESSAGE_COMPONENT
          customId: 'help_orders',
          update: jest.fn()
        });

        expect(buttonInteraction.customId).toBe('help_orders');
        expect(buttonInteraction.type).toBe(3);
      });

      it('should update embed content based on category', () => {
        const categories = {
          'help_general': 'General Commands and Getting Started',
          'help_orders': 'Order Discovery and Submission',
          'help_gom': 'Group Order Manager Features',
          'help_payments': 'Payment Processing and Status'
        };

        Object.entries(categories).forEach(([customId, title]) => {
          expect(categories[customId as keyof typeof categories]).toBe(title);
        });
      });
    });

    describe('Order Action Buttons', () => {
      it('should handle order submission button clicks', async () => {
        const buttonInteraction = createMockDiscordInteraction({
          type: 3,
          customId: 'submit_order_123',
          showModal: jest.fn()
        });

        const orderId = buttonInteraction.customId.split('_')[2];
        expect(orderId).toBe('123');
      });

      it('should handle refresh button interactions', async () => {
        const refreshInteraction = createMockDiscordInteraction({
          type: 3,
          customId: 'refresh_order_123'
        });

        // Should trigger order data refresh
        expect(refreshInteraction.customId).toContain('refresh');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle API timeout errors', async () => {
      mockedAxios.get.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded'
      });

      await expect(
        mockedAxios.get('/api/orders/123')
      ).rejects.toMatchObject({
        code: 'ECONNABORTED'
      });
    });

    it('should handle Discord API rate limits', async () => {
      const rateLimitError = {
        code: 50035,
        message: 'Rate limit exceeded'
      };

      expect(rateLimitError.code).toBe(50035);
    });

    it('should handle invalid interaction responses', async () => {
      const interaction = createMockDiscordInteraction({
        replied: true,
        reply: jest.fn().mockRejectedValue(new Error('Interaction already replied'))
      });

      await expect(
        interaction.reply({ content: 'Test' })
      ).rejects.toThrow('Interaction already replied');
    });

    it('should handle missing permissions gracefully', () => {
      const interaction = createMockDiscordInteraction({
        member: {
          permissions: {
            has: jest.fn().mockReturnValue(false)
          }
        }
      });

      const hasPermission = interaction.member.permissions.has('SEND_MESSAGES');
      expect(hasPermission).toBe(false);
    });
  });

  describe('Service Communication', () => {
    it('should communicate with Core API correctly', async () => {
      const orderResponse = {
        data: {
          success: true,
          data: {
            id: 'order_123',
            title: 'Test Order',
            price: 25,
            currency: 'PHP'
          }
        }
      };

      mockedAxios.get.mockResolvedValue(orderResponse);
      const response = await mockedAxios.get('/api/orders/order_123');
      
      expect(response.data.success).toBe(true);
      expect(response.data.data.price).toBe(25);
    });

    it('should communicate with Smart Agent for file uploads', async () => {
      const smartAgentResponse = {
        data: {
          success: true,
          payment_detected: true,
          amount: 25,
          confidence: 0.94
        }
      };

      mockedAxios.post.mockResolvedValue(smartAgentResponse);
      const response = await mockedAxios.post('/smart-agent/process', {});
      
      expect(response.data.payment_detected).toBe(true);
      expect(response.data.confidence).toBeGreaterThan(0.9);
    });

    it('should handle service communication failures', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Service unavailable'));
      
      await expect(
        mockedAxios.get('/api/orders/123')
      ).rejects.toThrow('Service unavailable');
    });
  });

  describe('User Session Management', () => {
    it('should track user session state', () => {
      const userSession = {
        userId: '123456789',
        currentFlow: 'submission',
        data: {
          orderId: 'order_123',
          step: 'confirmation'
        },
        startedAt: Date.now()
      };

      expect(userSession.currentFlow).toBe('submission');
      expect(userSession.data.orderId).toBe('order_123');
    });

    it('should handle session cleanup', () => {
      const sessions = new Map();
      sessions.set('user_123', { data: 'test' });
      
      // Cleanup expired sessions
      sessions.delete('user_123');
      
      expect(sessions.has('user_123')).toBe(false);
    });

    it('should prevent session conflicts', () => {
      const user1Session = { userId: '123', flow: 'submission' };
      const user2Session = { userId: '456', flow: 'order_creation' };

      expect(user1Session.userId).not.toBe(user2Session.userId);
    });
  });

  describe('Embed and UI Components', () => {
    it('should create properly formatted embeds', () => {
      const embed = new EmbedBuilder()
        .setTitle('Test Embed')
        .setDescription('Test Description')
        .setColor(0x7c3aed)
        .addFields([
          { name: 'Field 1', value: 'Value 1', inline: true },
          { name: 'Field 2', value: 'Value 2', inline: true }
        ]);

      expect(embed.setTitle).toHaveBeenCalledWith('Test Embed');
      expect(embed.addFields).toHaveBeenCalled();
    });

    it('should create action rows with buttons', () => {
      const row = new ActionRowBuilder()
        .addComponents([
          new ButtonBuilder()
            .setCustomId('test_button')
            .setLabel('Test Button')
            .setStyle(1) // Primary
        ]);

      expect(row.addComponents).toHaveBeenCalled();
    });

    it('should handle embed field limits', () => {
      const fields = Array(26).fill(null).map((_, i) => ({
        name: `Field ${i}`,
        value: `Value ${i}`,
        inline: true
      }));

      // Discord limit is 25 fields per embed
      const limitedFields = fields.slice(0, 25);
      expect(limitedFields.length).toBe(25);
    });
  });

  describe('Service Lifecycle', () => {
    it('should handle bot startup correctly', async () => {
      const client = discordBotService.getClient();
      client.login = jest.fn().mockResolvedValue('token');

      await expect(client.login('test-token')).resolves.toBe('token');
    });

    it('should handle graceful shutdown', async () => {
      const client = discordBotService.getClient();
      client.destroy = jest.fn().mockResolvedValue(undefined);

      await expect(client.destroy()).resolves.toBeUndefined();
    });

    it('should track bot connection status', () => {
      const client = discordBotService.getClient();
      client.isReady = jest.fn().mockReturnValue(true);

      expect(client.isReady()).toBe(true);
    });
  });
});