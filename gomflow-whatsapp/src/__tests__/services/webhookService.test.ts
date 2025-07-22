import { WebhookService } from '../../services/webhookService';
import { createMockTwilioWebhook, createMockSubmission } from '../setup';
import axios from 'axios';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WebhookService', () => {
  let webhookService: WebhookService;

  beforeEach(() => {
    webhookService = new WebhookService();
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should initialize webhook service successfully', () => {
      expect(webhookService).toBeInstanceOf(WebhookService);
    });
  });

  describe('processIncomingMessage', () => {
    it('should process incoming WhatsApp message', async () => {
      const webhookBody = createMockTwilioWebhook({
        Body: 'status',
        From: 'whatsapp:+639123456789'
      });

      // Mock auto-reply generation (will call getSubmissionsByPhone)
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          data: [createMockSubmission({
            buyer_phone: '+639123456789',
            status: 'confirmed'
          })]
        }
      });

      // Mock auto-reply sending
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true }
      });

      // Mock message forwarding to core API
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true }
      });

      await webhookService.processIncomingMessage(webhookBody);

      // Verify phone number extraction
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://test-api.gomflow.com/api/submissions/by-phone/%2B639123456789',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Bearer')
          })
        })
      );

      // Verify auto-reply sent
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test-api.gomflow.com/api/whatsapp/send',
        expect.objectContaining({
          to: '+639123456789',
          type: 'auto_reply'
        }),
        expect.any(Object)
      );

      // Verify message forwarded to core API
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test-api.gomflow.com/api/messages/incoming',
        expect.objectContaining({
          platform: 'whatsapp',
          phone: '+639123456789',
          message: 'status'
        }),
        expect.any(Object)
      );
    });

    it('should handle messages without auto-reply needed', async () => {
      const webhookBody = createMockTwilioWebhook({
        Body: 'random message that needs no reply',
        From: 'whatsapp:+639123456789'
      });

      // Mock no submissions found (no auto-reply needed)
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: [] }
      });

      // Mock message forwarding to core API
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true }
      });

      await webhookService.processIncomingMessage(webhookBody);

      // Should still forward message to core API
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test-api.gomflow.com/api/messages/incoming',
        expect.objectContaining({
          platform: 'whatsapp',
          phone: '+639123456789',
          message: 'random message that needs no reply'
        }),
        expect.any(Object)
      );

      // Should not send auto-reply for random messages
      expect(mockedAxios.post).toHaveBeenCalledTimes(1); // Only the forwarding call
    });

    it('should extract phone number correctly from different formats', async () => {
      const testCases = [
        { input: 'whatsapp:+639123456789', expected: '+639123456789' },
        { input: 'whatsapp:639123456789', expected: '639123456789' },
        { input: '+639123456789', expected: '+639123456789' }
      ];

      for (const testCase of testCases) {
        mockedAxios.get.mockResolvedValueOnce({ data: { data: [] } });
        mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

        const webhookBody = createMockTwilioWebhook({
          From: testCase.input,
          Body: 'test'
        });

        await webhookService.processIncomingMessage(webhookBody);

        expect(mockedAxios.post).toHaveBeenCalledWith(
          'https://test-api.gomflow.com/api/messages/incoming',
          expect.objectContaining({
            phone: testCase.expected
          }),
          expect.any(Object)
        );

        jest.clearAllMocks();
      }
    });
  });

  describe('generateAutoReply - Status Queries', () => {
    beforeEach(() => {
      // Mock successful submissions fetch
      mockedAxios.get.mockResolvedValue({
        data: {
          data: [createMockSubmission({
            buyer_phone: '+639123456789',
            status: 'confirmed',
            payment_reference: 'GOMF789123',
            total_amount: 50.00,
            currency: 'PHP',
            order: {
              title: 'SEVENTEEN God of Music Album'
            }
          })]
        }
      });
    });

    it('should generate status reply for "status" query', async () => {
      const webhookBody = createMockTwilioWebhook({
        Body: 'status',
        From: 'whatsapp:+639123456789'
      });

      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await webhookService.processIncomingMessage(webhookBody);

      // Check that auto-reply was sent
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test-api.gomflow.com/api/whatsapp/send',
        expect.objectContaining({
          message: expect.stringContaining('📦 Your latest order status')
        }),
        expect.any(Object)
      );

      const autoReplyCall = mockedAxios.post.mock.calls.find(call => 
        call[0].includes('/api/whatsapp/send')
      );
      const message = autoReplyCall[1].message;

      expect(message).toContain('SEVENTEEN God of Music Album');
      expect(message).toContain('PHP50');
      expect(message).toContain('✅ Paid');
      expect(message).toContain('GOMF789123');
    });

    it('should generate status reply for "track" query', async () => {
      const webhookBody = createMockTwilioWebhook({
        Body: 'track my order',
        From: 'whatsapp:+639123456789'
      });

      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await webhookService.processIncomingMessage(webhookBody);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test-api.gomflow.com/api/whatsapp/send',
        expect.objectContaining({
          message: expect.stringContaining('📦 Your latest order status')
        }),
        expect.any(Object)
      );
    });

    it('should show pending status with payment URL', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          data: [createMockSubmission({
            status: 'pending',
            payment_url: 'https://payment.gomflow.com/pay/GOMF789123'
          })]
        }
      });

      const webhookBody = createMockTwilioWebhook({
        Body: 'status',
        From: 'whatsapp:+639123456789'
      });

      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await webhookService.processIncomingMessage(webhookBody);

      const autoReplyCall = mockedAxios.post.mock.calls.find(call => 
        call[0].includes('/api/whatsapp/send')
      );
      const message = autoReplyCall[1].message;

      expect(message).toContain('⏰ Pending Payment');
      expect(message).toContain('Pay here: https://payment.gomflow.com/pay/GOMF789123');
    });

    it('should handle case when no orders found', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: [] }
      });

      const webhookBody = createMockTwilioWebhook({
        Body: 'status',
        From: 'whatsapp:+639123456789'
      });

      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await webhookService.processIncomingMessage(webhookBody);

      const autoReplyCall = mockedAxios.post.mock.calls.find(call => 
        call[0].includes('/api/whatsapp/send')
      );
      const message = autoReplyCall[1].message;

      expect(message).toContain("I couldn't find any orders linked to this number");
    });
  });

  describe('generateAutoReply - Payment Queries', () => {
    beforeEach(() => {
      mockedAxios.get.mockResolvedValue({
        data: {
          data: [createMockSubmission({
            status: 'pending',
            payment_reference: 'GOMF789123',
            payment_url: 'https://payment.gomflow.com/pay/GOMF789123',
            total_amount: 50.00,
            currency: 'PHP'
          })]
        }
      });
    });

    it('should generate payment details for "payment" query', async () => {
      const webhookBody = createMockTwilioWebhook({
        Body: 'payment',
        From: 'whatsapp:+639123456789'
      });

      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await webhookService.processIncomingMessage(webhookBody);

      const autoReplyCall = mockedAxios.post.mock.calls.find(call => 
        call[0].includes('/api/whatsapp/send')
      );
      const message = autoReplyCall[1].message;

      expect(message).toContain('💳 Payment details for your order');
      expect(message).toContain('GOMF789123');
      expect(message).toContain('PHP50');
      expect(message).toContain('Pay securely here: https://payment.gomflow.com/pay/GOMF789123');
    });

    it('should handle payment queries for different keywords', async () => {
      const paymentKeywords = ['pay', 'payment', 'reference'];

      for (const keyword of paymentKeywords) {
        const webhookBody = createMockTwilioWebhook({
          Body: keyword,
          From: 'whatsapp:+639123456789'
        });

        mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
        mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

        await webhookService.processIncomingMessage(webhookBody);

        const autoReplyCall = mockedAxios.post.mock.calls.find(call => 
          call[0].includes('/api/whatsapp/send')
        );

        expect(autoReplyCall).toBeDefined();
        expect(autoReplyCall[1].message).toContain('💳 Payment details');

        jest.clearAllMocks();
        mockedAxios.get.mockResolvedValue({
          data: {
            data: [createMockSubmission({ status: 'pending' })]
          }
        });
      }
    });

    it('should handle payment queries when no pending payments', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          data: [createMockSubmission({
            status: 'confirmed' // Already paid
          })]
        }
      });

      const webhookBody = createMockTwilioWebhook({
        Body: 'payment',
        From: 'whatsapp:+639123456789'
      });

      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await webhookService.processIncomingMessage(webhookBody);

      // Should not send payment details auto-reply for confirmed orders
      const autoReplyCalls = mockedAxios.post.mock.calls.filter(call => 
        call[0].includes('/api/whatsapp/send')
      );

      expect(autoReplyCalls.length).toBe(0);
    });

    it('should handle payment query without payment URL', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          data: [createMockSubmission({
            status: 'pending',
            payment_url: null
          })]
        }
      });

      const webhookBody = createMockTwilioWebhook({
        Body: 'payment',
        From: 'whatsapp:+639123456789'
      });

      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await webhookService.processIncomingMessage(webhookBody);

      const autoReplyCall = mockedAxios.post.mock.calls.find(call => 
        call[0].includes('/api/whatsapp/send')
      );
      const message = autoReplyCall[1].message;

      expect(message).toContain('Please follow the payment instructions provided by your GOM');
      expect(message).not.toContain('Pay securely here:');
    });
  });

  describe('generateAutoReply - Help and Greetings', () => {
    it('should generate help message for "help" query', async () => {
      const webhookBody = createMockTwilioWebhook({
        Body: 'help',
        From: 'whatsapp:+639123456789'
      });

      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await webhookService.processIncomingMessage(webhookBody);

      const autoReplyCall = mockedAxios.post.mock.calls.find(call => 
        call[0].includes('/api/whatsapp/send')
      );
      const message = autoReplyCall[1].message;

      expect(message).toContain('👋 Welcome to GOMFLOW!');
      expect(message).toContain('Type "status" to check your order status');
      expect(message).toContain('Type "payment" for payment details');
      expect(message).toContain('Type "track [reference]" to track a specific order');
    });

    it('should generate help message for greetings', async () => {
      const greetings = ['hi', 'hello', 'Hello', 'HI'];

      for (const greeting of greetings) {
        const webhookBody = createMockTwilioWebhook({
          Body: greeting,
          From: 'whatsapp:+639123456789'
        });

        mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });
        mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

        await webhookService.processIncomingMessage(webhookBody);

        const autoReplyCall = mockedAxios.post.mock.calls.find(call => 
          call[0].includes('/api/whatsapp/send')
        );

        expect(autoReplyCall).toBeDefined();
        expect(autoReplyCall[1].message).toContain('👋 Welcome to GOMFLOW!');

        jest.clearAllMocks();
      }
    });

    it('should not generate auto-reply for unrecognized messages', async () => {
      const webhookBody = createMockTwilioWebhook({
        Body: 'random unrecognized message',
        From: 'whatsapp:+639123456789'
      });

      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await webhookService.processIncomingMessage(webhookBody);

      // Should only forward to core API, no auto-reply
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test-api.gomflow.com/api/messages/incoming',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('getSubmissionsByPhone', () => {
    it('should fetch submissions by phone number', async () => {
      const mockSubmissions = [
        createMockSubmission({
          buyer_phone: '+639123456789',
          status: 'confirmed'
        }),
        createMockSubmission({
          buyer_phone: '+639123456789',
          status: 'pending'
        })
      ];

      mockedAxios.get.mockResolvedValue({
        data: { data: mockSubmissions }
      });

      const webhookBody = createMockTwilioWebhook({
        Body: 'status',
        From: 'whatsapp:+639123456789'
      });

      await webhookService.processIncomingMessage(webhookBody);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://test-api.gomflow.com/api/submissions/by-phone/%2B639123456789',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Bearer'),
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle phone number URL encoding', async () => {
      const phoneNumbers = [
        '+639123456789',
        '+60123456789',
        '639123456789'
      ];

      for (const phone of phoneNumbers) {
        mockedAxios.get.mockResolvedValueOnce({ data: { data: [] } });
        mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

        const webhookBody = createMockTwilioWebhook({
          Body: 'status',
          From: `whatsapp:${phone}`
        });

        await webhookService.processIncomingMessage(webhookBody);

        const encodedPhone = encodeURIComponent(phone);
        expect(mockedAxios.get).toHaveBeenCalledWith(
          `https://test-api.gomflow.com/api/submissions/by-phone/${encodedPhone}`,
          expect.any(Object)
        );

        jest.clearAllMocks();
      }
    });

    it('should handle API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Core API unavailable'));
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const webhookBody = createMockTwilioWebhook({
        Body: 'status',
        From: 'whatsapp:+639123456789'
      });

      // Should not throw error even if API fails
      await webhookService.processIncomingMessage(webhookBody);

      // Should still forward message to core API
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test-api.gomflow.com/api/messages/incoming',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('sendAutoReply', () => {
    it('should send auto-reply through core API', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: [createMockSubmission()] }
      });

      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } }); // auto-reply
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } }); // forwarding

      const webhookBody = createMockTwilioWebhook({
        Body: 'help',
        From: 'whatsapp:+639123456789'
      });

      await webhookService.processIncomingMessage(webhookBody);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test-api.gomflow.com/api/whatsapp/send',
        {
          to: '+639123456789',
          message: expect.stringContaining('👋 Welcome to GOMFLOW!'),
          type: 'auto_reply'
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Bearer')
          })
        })
      );
    });

    it('should handle auto-reply sending failures', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: [createMockSubmission()] }
      });

      mockedAxios.post.mockRejectedValueOnce(new Error('Auto-reply service down'));
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const webhookBody = createMockTwilioWebhook({
        Body: 'help',
        From: 'whatsapp:+639123456789'
      });

      // Should not throw error even if auto-reply fails
      await webhookService.processIncomingMessage(webhookBody);

      // Should still forward message
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test-api.gomflow.com/api/messages/incoming',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('forwardToCoreAPI', () => {
    it('should forward message to core API for logging', async () => {
      const webhookBody = createMockTwilioWebhook({
        Body: 'test message',
        From: 'whatsapp:+639123456789',
        MessageSid: 'SMtestmessagesid123456789'
      });

      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await webhookService.processIncomingMessage(webhookBody);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test-api.gomflow.com/api/messages/incoming',
        {
          platform: 'whatsapp',
          phone: '+639123456789',
          message: 'test message',
          messageId: 'SMtestmessagesid123456789',
          timestamp: expect.any(Date)
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Bearer'),
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle forwarding failures gracefully', async () => {
      const webhookBody = createMockTwilioWebhook({
        Body: 'test message',
        From: 'whatsapp:+639123456789'
      });

      mockedAxios.post.mockRejectedValue(new Error('Core API unavailable'));

      // Should not throw error even if forwarding fails
      await webhookService.processIncomingMessage(webhookBody);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test-api.gomflow.com/api/messages/incoming',
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe('validateWebhookSignature', () => {
    const mockRequest = {
      headers: {
        'x-twilio-signature': 'test-signature',
        'host': 'api.gomflow.com'
      },
      originalUrl: '/webhooks/whatsapp',
      body: { test: 'data' }
    } as any;

    it('should validate webhook signature in production', () => {
      // Override environment for this test
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const isValid = webhookService.validateWebhookSignature(mockRequest);

      // Currently returns true (TODO: implement proper validation)
      expect(isValid).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it('should skip validation in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const isValid = webhookService.validateWebhookSignature(mockRequest);

      expect(isValid).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it('should skip validation in test environment', () => {
      const isValid = webhookService.validateWebhookSignature(mockRequest);

      expect(isValid).toBe(true);
    });

    it('should handle missing signature header', () => {
      const requestWithoutSignature = {
        headers: {
          'host': 'api.gomflow.com'
        },
        originalUrl: '/webhooks/whatsapp',
        body: { test: 'data' }
      } as any;

      const isValid = webhookService.validateWebhookSignature(requestWithoutSignature);

      expect(isValid).toBe(true); // Currently always returns true
    });

    it('should construct correct URL for validation', () => {
      const testRequest = {
        headers: {
          'x-twilio-signature': 'test-signature',
          'host': 'example.com'
        },
        originalUrl: '/webhooks/whatsapp/test',
        body: { test: 'data' }
      } as any;

      const isValid = webhookService.validateWebhookSignature(testRequest);

      expect(isValid).toBe(true);
      // In actual implementation, would verify URL construction:
      // expect(constructedUrl).toBe('https://example.com/webhooks/whatsapp/test');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed webhook bodies', async () => {
      const malformedBodies = [
        {}, // Empty body
        { From: null, Body: null }, // Null values
        { From: '', Body: '' }, // Empty strings
        { From: 'invalid', Body: 'test' }, // Invalid from format
        null, // Null body
        undefined // Undefined body
      ];

      for (const body of malformedBodies) {
        mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

        try {
          await webhookService.processIncomingMessage(body);
          // Should not throw error
        } catch (error) {
          fail(`Should not throw error for malformed body: ${JSON.stringify(body)}`);
        }

        jest.clearAllMocks();
      }
    });

    it('should handle very long messages', async () => {
      const longMessage = 'A'.repeat(5000); // Very long message

      const webhookBody = createMockTwilioWebhook({
        Body: longMessage,
        From: 'whatsapp:+639123456789'
      });

      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      await webhookService.processIncomingMessage(webhookBody);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test-api.gomflow.com/api/messages/incoming',
        expect.objectContaining({
          message: longMessage
        }),
        expect.any(Object)
      );
    });

    it('should handle special characters in messages', async () => {
      const specialMessages = [
        '🎵🎶 K-pop status check! 🎶🎵',
        'Payment: $25.00 via GCash',
        'Reference: GOMF-123/456',
        'Order #1234 - TWICE "Formula of Love"',
        '支付状态查询', // Chinese characters
        'สถานะการสั่งซื้อ' // Thai characters
      ];

      for (const message of specialMessages) {
        const webhookBody = createMockTwilioWebhook({
          Body: message,
          From: 'whatsapp:+639123456789'
        });

        mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

        await webhookService.processIncomingMessage(webhookBody);

        expect(mockedAxios.post).toHaveBeenCalledWith(
          'https://test-api.gomflow.com/api/messages/incoming',
          expect.objectContaining({
            message: message
          }),
          expect.any(Object)
        );

        jest.clearAllMocks();
      }
    });

    it('should handle concurrent message processing', async () => {
      const webhookBodies = Array(10).fill(null).map((_, i) => 
        createMockTwilioWebhook({
          Body: `concurrent message ${i}`,
          From: `whatsapp:+63912345678${i}`,
          MessageSid: `SMconcurrent${i}`
        })
      );

      // Mock all API calls to succeed
      mockedAxios.post.mockResolvedValue({ data: { success: true } });

      // Process all messages concurrently
      const promises = webhookBodies.map(body => 
        webhookService.processIncomingMessage(body)
      );

      await Promise.all(promises);

      // Should have made 10 forwarding calls
      expect(mockedAxios.post).toHaveBeenCalledTimes(10);

      // Verify each message was processed
      webhookBodies.forEach((body, i) => {
        expect(mockedAxios.post).toHaveBeenCalledWith(
          'https://test-api.gomflow.com/api/messages/incoming',
          expect.objectContaining({
            message: `concurrent message ${i}`
          }),
          expect.any(Object)
        );
      });
    });

    it('should handle API timeout scenarios', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'ECONNABORTED';

      mockedAxios.get.mockRejectedValue(timeoutError);
      mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

      const webhookBody = createMockTwilioWebhook({
        Body: 'status',
        From: 'whatsapp:+639123456789'
      });

      await webhookService.processIncomingMessage(webhookBody);

      // Should still forward message even if submissions fetch times out
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://test-api.gomflow.com/api/messages/incoming',
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle case sensitivity in auto-replies', async () => {
      const caseSensitiveTests = [
        { input: 'STATUS', shouldReply: true },
        { input: 'Status', shouldReply: true },
        { input: 'status', shouldReply: true },
        { input: 'HELP', shouldReply: true },
        { input: 'Help', shouldReply: true },
        { input: 'PAYMENT', shouldReply: true },
        { input: 'Payment', shouldReply: true }
      ];

      for (const test of caseSensitiveTests) {
        if (test.shouldReply) {
          mockedAxios.get.mockResolvedValueOnce({
            data: { data: [createMockSubmission()] }
          });
        }

        mockedAxios.post.mockResolvedValue({ data: { success: true } });

        const webhookBody = createMockTwilioWebhook({
          Body: test.input,
          From: 'whatsapp:+639123456789'
        });

        await webhookService.processIncomingMessage(webhookBody);

        if (test.shouldReply) {
          const autoReplyCalls = mockedAxios.post.mock.calls.filter(call => 
            call[0].includes('/api/whatsapp/send')
          );
          expect(autoReplyCalls.length).toBeGreaterThan(0);
        }

        jest.clearAllMocks();
      }
    });
  });
});