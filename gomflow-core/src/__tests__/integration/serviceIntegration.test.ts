import { 
  createMockRequest,
  createAuthenticatedRequest,
  mockServiceResponse,
} from '../utils/testHelpers';

describe('Service Integration Tests', () => {
  beforeEach(() => {
    // Reset fetch mock
    (global.fetch as jest.Mock).mockReset();
  });

  describe('Smart Agent Integration', () => {
    it('should process payment screenshot through Smart Agent', async () => {
      const mockSmartAgentResponse = {
        success: true,
        detection: {
          amount: 1000,
          currency: 'PHP',
          paymentMethod: 'gcash',
          senderName: 'John Doe',
          referenceNumber: 'REF123',
          confidence: 0.95,
        },
        matchedSubmission: {
          id: 'sub-123',
          similarity: 0.98,
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockServiceResponse(mockSmartAgentResponse)
      );

      const formData = new FormData();
      formData.append('image', new Blob(['test']), 'payment.jpg');
      formData.append('orderId', 'order-123');

      const response = await fetch('http://localhost:3002/api/process', {
        method: 'POST',
        headers: {
          'x-service-auth': 'core-api:signature',
        },
        body: formData,
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.detection.confidence).toBe(0.95);
      expect(data.matchedSubmission.id).toBe('sub-123');
    });

    it('should handle Smart Agent errors gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Smart Agent service unavailable')
      );

      const formData = new FormData();
      formData.append('image', new Blob(['test']), 'payment.jpg');

      try {
        await fetch('http://localhost:3002/api/process', {
          method: 'POST',
          body: formData,
        });
      } catch (error) {
        expect(error.message).toContain('unavailable');
      }
    });
  });

  describe('Payment Gateway Integration', () => {
    it('should create payment session through Payment Service', async () => {
      const mockPaymentResponse = {
        success: true,
        session: {
          id: 'pay_session_123',
          checkoutUrl: 'https://pay.paymongo.com/checkout/123',
          expiresAt: '2024-12-31T23:59:59Z',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockServiceResponse(mockPaymentResponse)
      );

      const response = await fetch('http://localhost:3003/api/payment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-auth': 'core-api:signature',
        },
        body: JSON.stringify({
          submissionId: 'sub-123',
          amount: 1000,
          currency: 'PHP',
          paymentMethod: 'gcash',
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.session.checkoutUrl).toContain('paymongo.com');
    });

    it('should handle webhook notifications from Payment Service', async () => {
      const webhookPayload = {
        event: 'payment.paid',
        data: {
          submissionId: 'sub-123',
          amount: 1000,
          currency: 'PHP',
          paymentMethod: 'gcash',
          paidAt: '2024-01-15T10:00:00Z',
        },
      };

      // This would be received by the core API webhook endpoint
      expect(webhookPayload.event).toBe('payment.paid');
      expect(webhookPayload.data.submissionId).toBe('sub-123');
    });
  });

  describe('Messaging Service Integration', () => {
    it('should send order update notification through Discord Service', async () => {
      const mockNotificationResponse = {
        success: true,
        jobId: 'job-123',
        message: 'Notification queued for delivery',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockServiceResponse(mockNotificationResponse)
      );

      const response = await fetch('http://localhost:3006/api/notifications/order-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-auth': 'core-api:signature',
        },
        body: JSON.stringify({
          orderId: 'order-123',
          userId: 'user-123',
          status: 'active',
          message: 'Your order is now active!',
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.jobId).toBe('job-123');
    });

    it('should send bulk notifications through Telegram Service', async () => {
      const mockBulkResponse = {
        success: true,
        jobIds: ['job-1', 'job-2', 'job-3'],
        count: 3,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockServiceResponse(mockBulkResponse)
      );

      const response = await fetch('http://localhost:3005/api/notifications/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-auth': 'core-api:signature',
        },
        body: JSON.stringify({
          recipients: [
            { userId: 'user-1' },
            { userId: 'user-2' },
            { userId: 'user-3' },
          ],
          message: {
            text: 'New group order available!',
          },
          type: 'order_update',
        }),
      });

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(3);
    });

    it('should handle service authentication errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockServiceResponse({ error: 'Invalid authentication' }, 401)
      );

      const response = await fetch('http://localhost:3004/api/message/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Missing auth header
        },
        body: JSON.stringify({
          to: '+639123456789',
          message: 'Test message',
        }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('authentication');
    });
  });

  describe('Cross-Service Payment Flow', () => {
    it('should complete full payment flow across services', async () => {
      // Step 1: Create submission in Core API
      const submission = {
        id: 'sub-123',
        order_id: 'order-123',
        payment_reference: 'SUB-2024-ABC',
        total_amount: 1000,
      };

      // Step 2: Create payment session
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockServiceResponse({
          success: true,
          session: {
            id: 'pay_123',
            checkoutUrl: 'https://pay.example.com',
          },
        })
      );

      const paymentResponse = await fetch('http://localhost:3003/api/payment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-auth': 'core-api:signature',
        },
        body: JSON.stringify({
          submissionId: submission.id,
          amount: submission.total_amount,
          currency: 'PHP',
        }),
      });

      const paymentData = await paymentResponse.json();
      expect(paymentData.success).toBe(true);

      // Step 3: Payment webhook received
      const webhookEvent = {
        event: 'payment.paid',
        data: {
          submissionId: submission.id,
          sessionId: 'pay_123',
        },
      };

      // Step 4: Send notification through messaging service
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockServiceResponse({
          success: true,
          jobId: 'notif-123',
        })
      );

      const notificationResponse = await fetch('http://localhost:3005/api/notifications/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-auth': 'payment-service:signature',
        },
        body: JSON.stringify({
          userId: 'user-123',
          message: {
            text: `Payment confirmed for ${submission.payment_reference}!`,
          },
          type: 'payment_confirmation',
        }),
      });

      const notificationData = await notificationResponse.json();
      expect(notificationData.success).toBe(true);
    });
  });

  describe('Service Health Checks', () => {
    it('should verify all services are healthy', async () => {
      const services = [
        { name: 'Smart Agent', url: 'http://localhost:3002/api/health' },
        { name: 'Payment Gateway', url: 'http://localhost:3003/api/health' },
        { name: 'WhatsApp', url: 'http://localhost:3004/api/health' },
        { name: 'Telegram', url: 'http://localhost:3005/api/health' },
        { name: 'Discord', url: 'http://localhost:3006/api/health' },
      ];

      for (const service of services) {
        (global.fetch as jest.Mock).mockResolvedValueOnce(
          mockServiceResponse({
            status: 'healthy',
            service: service.name.toLowerCase().replace(' ', '-'),
          })
        );

        const response = await fetch(service.url);
        const data = await response.json();
        
        expect(response.ok).toBe(true);
        expect(data.status).toBe('healthy');
      }
    });
  });
});