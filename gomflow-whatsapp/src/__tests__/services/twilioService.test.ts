import { TwilioService } from '../../services/twilioService';
import { createMockSubmission, createMockOrder, createMockBulkRecipients } from '../setup';
import twilio from 'twilio';

// Mock Twilio
const mockTwilioInstance = {
  messages: {
    create: jest.fn()
  }
};

const mockedTwilio = twilio as jest.MockedFunction<typeof twilio>;
mockedTwilio.mockReturnValue(mockTwilioInstance as any);

describe('TwilioService', () => {
  let twilioService: TwilioService;

  beforeEach(() => {
    twilioService = new TwilioService();
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should initialize Twilio service with correct credentials', () => {
      expect(twilioService).toBeInstanceOf(TwilioService);
      expect(mockedTwilio).toHaveBeenCalledWith(
        'test_account_sid',
        'test_auth_token'
      );
    });

    it('should create Twilio client instance', () => {
      expect(mockTwilioInstance.messages.create).toBeDefined();
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      mockTwilioInstance.messages.create.mockResolvedValue({
        sid: 'SM123456789',
        status: 'sent',
        to: 'whatsapp:+639123456789',
        from: 'whatsapp:+14155238886',
        body: 'Test message',
        dateSent: new Date(),
        dateCreated: new Date()
      });
    });

    it('should send WhatsApp message successfully', async () => {
      const result = await twilioService.sendMessage('+639123456789', 'Test message');

      expect(mockTwilioInstance.messages.create).toHaveBeenCalledWith({
        from: 'whatsapp:+14155238886',
        to: 'whatsapp:+639123456789',
        body: 'Test message'
      });

      expect(result).toEqual({
        success: true,
        messageId: 'SM123456789'
      });
    });

    it('should handle phone numbers with whatsapp: prefix', async () => {
      await twilioService.sendMessage('whatsapp:+639123456789', 'Test message');

      expect(mockTwilioInstance.messages.create).toHaveBeenCalledWith({
        from: 'whatsapp:+14155238886',
        to: 'whatsapp:+639123456789',
        body: 'Test message'
      });
    });

    it('should handle phone numbers without whatsapp: prefix', async () => {
      await twilioService.sendMessage('+639123456789', 'Test message');

      expect(mockTwilioInstance.messages.create).toHaveBeenCalledWith({
        from: 'whatsapp:+14155238886',
        to: 'whatsapp:+639123456789',
        body: 'Test message'
      });
    });

    it('should handle message sending failures', async () => {
      const error = new Error('Twilio API error');
      mockTwilioInstance.messages.create.mockRejectedValue(error);

      const result = await twilioService.sendMessage('+639123456789', 'Test message');

      expect(result).toEqual({
        success: false,
        error: 'Twilio API error'
      });
    });

    it('should handle rate limiting errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = 'TwilioError';
      (rateLimitError as any).code = 20429;

      mockTwilioInstance.messages.create.mockRejectedValue(rateLimitError);

      const result = await twilioService.sendMessage('+639123456789', 'Test message');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
    });
  });

  describe('sendOrderConfirmation', () => {
    it('should send order confirmation for Philippines orders', async () => {
      const submission = createMockSubmission({
        currency: 'PHP',
        buyer_phone: '+639123456789',
        quantity: 2,
        total_amount: 50.00,
        payment_reference: 'GOMF789123'
      });

      mockTwilioInstance.messages.create.mockResolvedValue({
        sid: 'SM123456789',
        status: 'sent'
      });

      const result = await twilioService.sendOrderConfirmation(submission);

      expect(mockTwilioInstance.messages.create).toHaveBeenCalledWith({
        from: 'whatsapp:+14155238886',
        to: 'whatsapp:+639123456789',
        body: expect.stringContaining('SEVENTEEN God of Music Album')
      });

      expect(result.success).toBe(true);
    });

    it('should send order confirmation for Malaysia orders', async () => {
      const submission = createMockSubmission({
        currency: 'MYR',
        buyer_phone: '+60123456789',
        quantity: 1,
        total_amount: 25.00,
        payment_reference: 'GOMF555999'
      });

      mockTwilioInstance.messages.create.mockResolvedValue({
        sid: 'SM987654321',
        status: 'sent'
      });

      const result = await twilioService.sendOrderConfirmation(submission);

      expect(mockTwilioInstance.messages.create).toHaveBeenCalledWith({
        from: 'whatsapp:+14155238886',
        to: 'whatsapp:+60123456789',
        body: expect.stringContaining('SEVENTEEN God of Music Album')
      });

      expect(result.success).toBe(true);
    });

    it('should include payment instructions in confirmation', async () => {
      const submission = createMockSubmission({
        order: {
          ...createMockOrder().order,
          payment_methods: [
            {
              type: 'gcash',
              number: '09123456789',
              name: 'Juan GOM',
              instructions: 'Send screenshot after payment',
              is_gateway: false
            },
            {
              type: 'paymaya',
              number: '09987654321',
              name: 'Juan GOM',
              instructions: 'Include reference number',
              is_gateway: false
            }
          ]
        }
      });

      await twilioService.sendOrderConfirmation(submission);

      const callArgs = mockTwilioInstance.messages.create.mock.calls[0][0];
      expect(callArgs.body).toContain('GCASH: 09123456789');
      expect(callArgs.body).toContain('PAYMAYA: 09987654321');
    });

    it('should format currency correctly in confirmation', async () => {
      const phpSubmission = createMockSubmission({
        currency: 'PHP',
        total_amount: 75.50
      });

      await twilioService.sendOrderConfirmation(phpSubmission);

      const phpCallArgs = mockTwilioInstance.messages.create.mock.calls[0][0];
      expect(phpCallArgs.body).toContain('₱75.50');

      mockTwilioInstance.messages.create.mockClear();

      const myrSubmission = createMockSubmission({
        currency: 'MYR',
        total_amount: 35.25
      });

      await twilioService.sendOrderConfirmation(myrSubmission);

      const myrCallArgs = mockTwilioInstance.messages.create.mock.calls[0][0];
      expect(myrCallArgs.body).toContain('RM35.25');
    });
  });

  describe('sendPaymentReminder', () => {
    it('should send payment reminder with time remaining', async () => {
      const submission = createMockSubmission({
        order: {
          ...createMockOrder().order,
          deadline: new Date(Date.now() + 172800000).toISOString() // 2 days from now
        }
      });

      mockTwilioInstance.messages.create.mockResolvedValue({
        sid: 'SM123456789',
        status: 'sent'
      });

      const result = await twilioService.sendPaymentReminder(submission);

      expect(mockTwilioInstance.messages.create).toHaveBeenCalledWith({
        from: 'whatsapp:+14155238886',
        to: 'whatsapp:+639123456789',
        body: expect.stringContaining('Juan Dela Cruz')
      });

      const callArgs = mockTwilioInstance.messages.create.mock.calls[0][0];
      expect(callArgs.body).toContain('GOMF789123'); // payment reference
      expect(callArgs.body).toContain('₱50.00'); // total amount

      expect(result.success).toBe(true);
    });

    it('should handle urgent reminders for soon-to-expire orders', async () => {
      const submission = createMockSubmission({
        order: {
          ...createMockOrder().order,
          deadline: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
        }
      });

      await twilioService.sendPaymentReminder(submission);

      const callArgs = mockTwilioInstance.messages.create.mock.calls[0][0];
      expect(callArgs.body).toContain(submission.buyer_name);
    });

    it('should include payment URL if available', async () => {
      const submission = createMockSubmission({
        payment_url: 'https://payment.gomflow.com/pay/GOMF789123'
      });

      await twilioService.sendPaymentReminder(submission);

      const callArgs = mockTwilioInstance.messages.create.mock.calls[0][0];
      expect(callArgs.body).toContain('https://payment.gomflow.com/pay/GOMF789123');
    });
  });

  describe('sendPaymentConfirmation', () => {
    it('should send payment confirmation message', async () => {
      const submission = createMockSubmission({
        status: 'confirmed',
        payment_confirmed_at: new Date().toISOString()
      });

      mockTwilioInstance.messages.create.mockResolvedValue({
        sid: 'SM123456789',
        status: 'sent'
      });

      const result = await twilioService.sendPaymentConfirmation(submission);

      expect(mockTwilioInstance.messages.create).toHaveBeenCalledWith({
        from: 'whatsapp:+14155238886',
        to: 'whatsapp:+639123456789',
        body: expect.stringContaining('SEVENTEEN God of Music Album')
      });

      const callArgs = mockTwilioInstance.messages.create.mock.calls[0][0];
      expect(callArgs.body).toContain('₱50.00');
      expect(callArgs.body).toContain('2'); // quantity

      expect(result.success).toBe(true);
    });

    it('should handle different currencies in confirmation', async () => {
      const myrSubmission = createMockSubmission({
        currency: 'MYR',
        total_amount: 30.00
      });

      await twilioService.sendPaymentConfirmation(myrSubmission);

      const callArgs = mockTwilioInstance.messages.create.mock.calls[0][0];
      expect(callArgs.body).toContain('RM30.00');
    });
  });

  describe('notifyGOM', () => {
    it('should send notification to GOM', async () => {
      const gomPhone = '+639987654321';
      const notification = 'New order submission received for SEVENTEEN album';

      mockTwilioInstance.messages.create.mockResolvedValue({
        sid: 'SM123456789',
        status: 'sent'
      });

      const result = await twilioService.notifyGOM(gomPhone, notification);

      expect(mockTwilioInstance.messages.create).toHaveBeenCalledWith({
        from: 'whatsapp:+14155238886',
        to: 'whatsapp:+639987654321',
        body: notification
      });

      expect(result.success).toBe(true);
    });

    it('should handle GOM notification failures', async () => {
      const gomPhone = '+639987654321';
      const notification = 'Test notification';

      mockTwilioInstance.messages.create.mockRejectedValue(new Error('GOM unreachable'));

      const result = await twilioService.notifyGOM(gomPhone, notification);

      expect(result.success).toBe(false);
      expect(result.error).toBe('GOM unreachable');
    });
  });

  describe('sendBulkMessages', () => {
    it('should send bulk messages to multiple recipients', async () => {
      const recipients = createMockBulkRecipients(3);

      mockTwilioInstance.messages.create
        .mockResolvedValueOnce({ sid: 'SM1', status: 'sent' })
        .mockResolvedValueOnce({ sid: 'SM2', status: 'sent' })
        .mockResolvedValueOnce({ sid: 'SM3', status: 'sent' });

      const results = await twilioService.sendBulkMessages(recipients);

      expect(mockTwilioInstance.messages.create).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(3);

      results.forEach((result, index) => {
        expect(result.phone).toBe(recipients[index].phone);
        expect(result.status).toBe('fulfilled');
        expect(result.result.success).toBe(true);
      });
    });

    it('should handle partial failures in bulk messaging', async () => {
      const recipients = createMockBulkRecipients(3);

      mockTwilioInstance.messages.create
        .mockResolvedValueOnce({ sid: 'SM1', status: 'sent' })
        .mockRejectedValueOnce(new Error('Invalid phone number'))
        .mockResolvedValueOnce({ sid: 'SM3', status: 'sent' });

      const results = await twilioService.sendBulkMessages(recipients);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');

      expect(results[1].result).toBeInstanceOf(Error);
      expect((results[1].result as Error).message).toBe('Invalid phone number');
    });

    it('should handle empty recipient list', async () => {
      const results = await twilioService.sendBulkMessages([]);

      expect(results).toHaveLength(0);
      expect(mockTwilioInstance.messages.create).not.toHaveBeenCalled();
    });

    it('should handle large bulk message batches', async () => {
      const recipients = createMockBulkRecipients(50);

      // Mock all 50 calls to succeed
      for (let i = 0; i < 50; i++) {
        mockTwilioInstance.messages.create.mockResolvedValueOnce({
          sid: `SM${i}`,
          status: 'sent'
        });
      }

      const results = await twilioService.sendBulkMessages(recipients);

      expect(mockTwilioInstance.messages.create).toHaveBeenCalledTimes(50);
      expect(results).toHaveLength(50);
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    });
  });

  describe('postOrderToGroup', () => {
    it('should post order announcement to WhatsApp group', async () => {
      const order = createMockOrder({
        title: 'NewJeans Get Up Album',
        price: 45.00,
        currency: 'PHP',
        description: 'All versions with exclusive photocards'
      });

      const groupId = 'whatsapp:group_123456789';

      mockTwilioInstance.messages.create.mockResolvedValue({
        sid: 'SM123456789',
        status: 'sent'
      });

      const result = await twilioService.postOrderToGroup(groupId, order);

      expect(mockTwilioInstance.messages.create).toHaveBeenCalledWith({
        from: 'whatsapp:+14155238886',
        to: 'whatsapp:group_123456789',
        body: expect.stringContaining('🛒 NEW GROUP ORDER!')
      });

      const callArgs = mockTwilioInstance.messages.create.mock.calls[0][0];
      expect(callArgs.body).toContain('NewJeans Get Up Album');
      expect(callArgs.body).toContain('₱45');
      expect(callArgs.body).toContain('All versions with exclusive photocards');
      expect(callArgs.body).toContain('React with 👍 if interested!');

      expect(result.success).toBe(true);
    });

    it('should format order announcement for Malaysia orders', async () => {
      const order = createMockOrder({
        currency: 'MYR',
        price: 25.00,
        title: 'BLACKPINK Born Pink Album'
      });

      const groupId = 'whatsapp:group_malaysia_123';

      await twilioService.postOrderToGroup(groupId, order);

      const callArgs = mockTwilioInstance.messages.create.mock.calls[0][0];
      expect(callArgs.body).toContain('RM25');
      expect(callArgs.body).toContain('BLACKPINK Born Pink Album');
    });

    it('should include order link in group announcement', async () => {
      const order = createMockOrder({
        slug: 'seventeen-god-of-music',
        user: {
          id: 'user_123',
          username: 'kpop_gom_ph',
          phone: '+639987654321'
        }
      });

      const groupId = 'whatsapp:group_123456789';

      await twilioService.postOrderToGroup(groupId, order);

      const callArgs = mockTwilioInstance.messages.create.mock.calls[0][0];
      expect(callArgs.body).toContain('https://test-api.gomflow.com/u/kpop_gom_ph/seventeen-god-of-music');
    });

    it('should handle group posting failures', async () => {
      const order = createMockOrder();
      const groupId = 'whatsapp:invalid_group';

      mockTwilioInstance.messages.create.mockRejectedValue(new Error('Group not found'));

      const result = await twilioService.postOrderToGroup(groupId, order);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Group not found');
    });
  });

  describe('Payment Instructions Formatting', () => {
    it('should format multiple payment methods correctly', async () => {
      const submission = createMockSubmission({
        order: {
          ...createMockOrder().order,
          payment_methods: [
            {
              type: 'gcash',
              number: '09123456789',
              name: 'Juan GOM',
              instructions: 'Send screenshot after payment',
              is_gateway: false
            },
            {
              type: 'paymaya',
              number: '09987654321',
              name: 'Maria GOM',
              instructions: 'Include reference number in description',
              is_gateway: false
            },
            {
              type: 'bank_transfer',
              number: 'BPI - 1234567890',
              name: 'Juan Dela Cruz',
              instructions: 'Use payment reference as description',
              is_gateway: false
            }
          ]
        }
      });

      await twilioService.sendOrderConfirmation(submission);

      const callArgs = mockTwilioInstance.messages.create.mock.calls[0][0];
      expect(callArgs.body).toContain('GCASH: 09123456789 (Juan GOM)');
      expect(callArgs.body).toContain('Send screenshot after payment');
      expect(callArgs.body).toContain('PAYMAYA: 09987654321 (Maria GOM)');
      expect(callArgs.body).toContain('Include reference number in description');
      expect(callArgs.body).toContain('BANK_TRANSFER: BPI - 1234567890 (Juan Dela Cruz)');
    });

    it('should exclude gateway payment methods from instructions', async () => {
      const submission = createMockSubmission({
        order: {
          ...createMockOrder().order,
          payment_methods: [
            {
              type: 'gcash',
              number: '09123456789',
              name: 'Juan GOM',
              instructions: 'Manual payment',
              is_gateway: false
            },
            {
              type: 'gcash',
              gateway_id: 'paymongo_gcash',
              instructions: 'Gateway payment',
              is_gateway: true
            }
          ]
        }
      });

      await twilioService.sendOrderConfirmation(submission);

      const callArgs = mockTwilioInstance.messages.create.mock.calls[0][0];
      expect(callArgs.body).toContain('GCASH: 09123456789');
      expect(callArgs.body).toContain('Manual payment');
      expect(callArgs.body).not.toContain('Gateway payment');
    });

    it('should handle payment methods without names or instructions', async () => {
      const submission = createMockSubmission({
        order: {
          ...createMockOrder().order,
          payment_methods: [
            {
              type: 'gcash',
              number: '09123456789',
              is_gateway: false
            }
          ]
        }
      });

      await twilioService.sendOrderConfirmation(submission);

      const callArgs = mockTwilioInstance.messages.create.mock.calls[0][0];
      expect(callArgs.body).toContain('GCASH: 09123456789');
    });
  });

  describe('Order Announcement Formatting', () => {
    it('should format deadline correctly', async () => {
      const order = createMockOrder({
        deadline: new Date('2025-02-28T23:59:00.000Z').toISOString()
      });

      const groupId = 'whatsapp:group_123';

      await twilioService.postOrderToGroup(groupId, order);

      const callArgs = mockTwilioInstance.messages.create.mock.calls[0][0];
      expect(callArgs.body).toContain('📅 Deadline:');
      expect(callArgs.body).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // Date format
    });

    it('should handle orders without descriptions', async () => {
      const order = createMockOrder({
        description: null
      });

      const groupId = 'whatsapp:group_123';

      await twilioService.postOrderToGroup(groupId, order);

      const callArgs = mockTwilioInstance.messages.create.mock.calls[0][0];
      expect(callArgs.body).toContain('🛒 NEW GROUP ORDER!');
      expect(callArgs.body).toContain(order.title);
      expect(callArgs.body).not.toContain('null');
    });

    it('should include order submission progress if available', async () => {
      const order = createMockOrder({
        total_submissions: 45,
        min_orders: 50,
        max_orders: 200
      });

      const groupId = 'whatsapp:group_123';

      await twilioService.postOrderToGroup(groupId, order);

      const callArgs = mockTwilioInstance.messages.create.mock.calls[0][0];
      expect(callArgs.body).toContain('45/50'); // Progress indicator
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed phone numbers gracefully', async () => {
      const invalidPhones = ['invalid', '123', '+1234', ''];

      for (const phone of invalidPhones) {
        mockTwilioInstance.messages.create.mockRejectedValue(new Error('Invalid phone number'));
        
        const result = await twilioService.sendMessage(phone, 'Test message');
        
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid phone number');
      }
    });

    it('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(2000); // Very long message

      mockTwilioInstance.messages.create.mockResolvedValue({
        sid: 'SM123456789',
        status: 'sent'
      });

      const result = await twilioService.sendMessage('+639123456789', longMessage);

      expect(result.success).toBe(true);
      expect(mockTwilioInstance.messages.create).toHaveBeenCalledWith({
        from: 'whatsapp:+14155238886',
        to: 'whatsapp:+639123456789',
        body: longMessage
      });
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TimeoutError';

      mockTwilioInstance.messages.create.mockRejectedValue(timeoutError);

      const result = await twilioService.sendMessage('+639123456789', 'Test message');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });

    it('should handle Twilio service unavailability', async () => {
      const serviceError = new Error('Service unavailable');
      (serviceError as any).code = 20003;

      mockTwilioInstance.messages.create.mockRejectedValue(serviceError);

      const result = await twilioService.sendMessage('+639123456789', 'Test message');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Service unavailable');
    });

    it('should handle missing submission data gracefully', async () => {
      const incompleteSubmission = {
        id: 'sub_incomplete',
        buyer_phone: '+639123456789'
      } as any;

      // Should not throw error even with incomplete data
      const result = await twilioService.sendOrderConfirmation(incompleteSubmission);

      expect(mockTwilioInstance.messages.create).toHaveBeenCalled();
    });
  });
});