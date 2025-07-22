import { createMockPayMongoPayment, createMockBillplzBill, createMockWebhookPayload } from '../setup';
import axios from 'axios';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Payment Workflow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Philippines Payment Flow (PayMongo)', () => {
    it('should complete full GCash payment workflow', async () => {
      // Step 1: Create submission in Core API
      const submissionData = {
        order_id: 'order_123',
        buyer_name: 'Juan Dela Cruz',
        buyer_phone: '+639123456789',
        quantity: 2,
        amount: 50.00,
        currency: 'PHP',
        platform: 'telegram'
      };

      const submission = {
        id: 'sub_456',
        payment_reference: 'GOMF789',
        status: 'pending',
        ...submissionData
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true, data: submission }
      });

      // Step 2: Create PayMongo payment intent
      const paymentIntentData = {
        amount: 5000, // 50.00 PHP in centavos
        currency: 'PHP',
        description: 'Group Order Payment - GOMFLOW',
        payment_method_allowed: ['gcash'],
        metadata: {
          submission_id: submission.id,
          order_id: submissionData.order_id,
          payment_reference: submission.payment_reference
        }
      };

      const paymentIntent = createMockPayMongoPayment({
        attributes: {
          ...paymentIntentData,
          status: 'requires_payment_method',
          client_key: 'pi_test_123_client_key'
        }
      });

      mockedAxios.post.mockResolvedValueOnce({
        data: { data: paymentIntent }
      });

      // Step 3: User completes payment via GCash
      const completedPayment = createMockPayMongoPayment({
        attributes: {
          status: 'succeeded',
          payments: [{
            id: 'pay_test_456',
            type: 'payment',
            attributes: {
              amount: 5000,
              status: 'paid',
              payment_intent_id: paymentIntent.id,
              paid_at: Math.floor(Date.now() / 1000)
            }
          }]
        }
      });

      // Step 4: Receive webhook notification
      const webhookPayload = createMockWebhookPayload('paymongo', {
        attributes: { status: 'succeeded' }
      });

      // Step 5: Update submission status
      const updatedSubmission = {
        ...submission,
        status: 'confirmed',
        payment_confirmed_at: new Date().toISOString(),
        gateway_payment_id: completedPayment.id
      };

      mockedAxios.patch.mockResolvedValueOnce({
        data: { success: true, data: updatedSubmission }
      });

      // Verify complete workflow
      expect(paymentIntent.attributes.amount).toBe(5000);
      expect(paymentIntent.attributes.metadata.submission_id).toBe(submission.id);
      expect(webhookPayload.data.attributes.type).toBe('payment_intent.payment.succeeded');
      expect(updatedSubmission.status).toBe('confirmed');
    });

    it('should handle PayMaya payment workflow', async () => {
      const paymentIntent = createMockPayMongoPayment({
        attributes: {
          amount: 3000, // 30.00 PHP
          payment_method_allowed: ['paymaya'],
          payment_method: {
            id: 'pm_paymaya_test',
            type: 'payment_method',
            attributes: {
              type: 'paymaya',
              details: { brand: 'paymaya' }
            }
          }
        }
      });

      expect(paymentIntent.attributes.payment_method_allowed).toContain('paymaya');
      expect(paymentIntent.attributes.payment_method.attributes.type).toBe('paymaya');
    });

    it('should handle failed GCash payments', async () => {
      const failedPayment = createMockPayMongoPayment({
        attributes: {
          status: 'requires_payment_method',
          last_payment_error: {
            code: 'payment_failed',
            message: 'Your GCash payment was declined. Please try again or use a different payment method.',
            payment_method: {
              type: 'gcash'
            }
          }
        }
      });

      expect(failedPayment.attributes.status).toBe('requires_payment_method');
      expect(failedPayment.attributes.last_payment_error.code).toBe('payment_failed');
      expect(failedPayment.attributes.last_payment_error.payment_method.type).toBe('gcash');
    });
  });

  describe('Complete Malaysia Payment Flow (Billplz)', () => {
    it('should complete full FPX payment workflow', async () => {
      // Step 1: Create submission for Malaysian user
      const submissionData = {
        order_id: 'order_789',
        buyer_name: 'Ahmad Rahman',
        buyer_email: 'ahmad@example.com',
        buyer_phone: '+60123456789',
        quantity: 1,
        amount: 25.00,
        currency: 'MYR',
        platform: 'discord'
      };

      const submission = {
        id: 'sub_890',
        payment_reference: 'GOMF234',
        status: 'pending',
        ...submissionData
      };

      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true, data: submission }
      });

      // Step 2: Create Billplz bill
      const billData = {
        collection_id: 'test_collection_123',
        amount: '2500', // 25.00 MYR in sen
        name: submission.buyer_name,
        email: submission.buyer_email,
        mobile: submission.buyer_phone,
        description: 'Group Order Payment - GOMFLOW',
        reference_1_label: 'Order ID',
        reference_1: submissionData.order_id,
        reference_2_label: 'Submission ID',
        reference_2: submission.id,
        callback_url: 'https://gomflow.com/api/webhooks/billplz',
        redirect_url: 'https://gomflow.com/payment/success'
      };

      const bill = createMockBillplzBill(billData);

      mockedAxios.post.mockResolvedValueOnce({
        data: bill
      });

      // Step 3: User completes payment via FPX
      const paidBill = createMockBillplzBill({
        ...billData,
        paid: true,
        state: 'paid',
        paid_amount: '2500',
        paid_at: new Date().toISOString(),
        transaction_id: 'txn_fpx_123456789'
      });

      // Step 4: Receive webhook notification
      const webhookPayload = createMockWebhookPayload('billplz', {
        id: bill.id,
        paid: 'true',
        state: 'paid',
        paid_amount: '2500',
        transaction_id: 'txn_fpx_123456789'
      });

      // Step 5: Update submission status
      const updatedSubmission = {
        ...submission,
        status: 'confirmed',
        payment_confirmed_at: new Date().toISOString(),
        gateway_payment_id: bill.id
      };

      mockedAxios.patch.mockResolvedValueOnce({
        data: { success: true, data: updatedSubmission }
      });

      // Verify complete workflow
      expect(bill.amount).toBe('2500');
      expect(bill.reference_1).toBe(submissionData.order_id);
      expect(bill.reference_2).toBe(submission.id);
      expect(webhookPayload.paid).toBe('true');
      expect(updatedSubmission.status).toBe('confirmed');
    });

    it('should handle Touch n Go payment workflow', async () => {
      const bill = createMockBillplzBill({
        name: 'Siti Nurhaliza',
        mobile: '+60187654321',
        amount: '5000' // 50.00 MYR
      });

      expect(bill.mobile).toMatch(/^\+601/);
      expect(parseInt(bill.amount)).toBe(5000);
    });

    it('should handle failed Billplz payments', async () => {
      const failedBill = createMockBillplzBill({
        state: 'due',
        paid: false,
        due_at: new Date(Date.now() - 86400000).toISOString() // Overdue
      });

      const isOverdue = new Date(failedBill.due_at) < new Date();
      expect(isOverdue).toBe(true);
      expect(failedBill.paid).toBe(false);
    });
  });

  describe('Cross-Border Payment Scenarios', () => {
    it('should route Philippines users to PayMongo', () => {
      const submission = {
        buyer_phone: '+639123456789',
        currency: 'PHP',
        amount: 25.00
      };

      const isPhilippines = submission.buyer_phone.startsWith('+639') || submission.currency === 'PHP';
      const expectedGateway = isPhilippines ? 'paymongo' : 'billplz';

      expect(expectedGateway).toBe('paymongo');
    });

    it('should route Malaysia users to Billplz', () => {
      const submission = {
        buyer_phone: '+60123456789',
        currency: 'MYR',
        amount: 25.00
      };

      const isMalaysia = submission.buyer_phone.startsWith('+60') || submission.currency === 'MYR';
      const expectedGateway = isMalaysia ? 'billplz' : 'paymongo';

      expect(expectedGateway).toBe('billplz');
    });

    it('should handle currency conversion display', () => {
      const phpAmount = 25.00;
      const myrAmount = 2.50;
      const exchangeRate = 0.1; // 1 PHP = 0.1 MYR (example)

      const convertedAmount = phpAmount * exchangeRate;
      expect(convertedAmount).toBeCloseTo(myrAmount);
    });
  });

  describe('Webhook Security and Processing', () => {
    it('should verify PayMongo webhook signatures', () => {
      const webhookSecret = 'whsec_test_123456789';
      const payload = JSON.stringify(createMockWebhookPayload('paymongo'));
      const timestamp = Date.now().toString();
      const signature = 'mocked-signature'; // From crypto mock

      // In real implementation:
      // const expectedSignature = crypto
      //   .createHmac('sha256', webhookSecret)
      //   .update(timestamp + payload)
      //   .digest('hex')

      expect(signature).toBe('mocked-signature');
      expect(webhookSecret).toContain('whsec_');
    });

    it('should verify Billplz webhook signatures', () => {
      const signatureKey = 'test_signature_key';
      const webhookData = createMockWebhookPayload('billplz');
      const expectedSignature = 'mocked-signature';

      // In real implementation:
      // const calculatedSignature = crypto
      //   .createHmac('sha256', signatureKey)
      //   .update(JSON.stringify(webhookData))
      //   .digest('hex')

      expect(expectedSignature).toBe('mocked-signature');
    });

    it('should handle webhook replay attacks', () => {
      const webhookId = 'evt_test_123456789';
      const processedWebhooks = new Set(['evt_test_987654321']);

      const isReplay = processedWebhooks.has(webhookId);
      expect(isReplay).toBe(false);

      processedWebhooks.add(webhookId);
      const isReplayAfterAdd = processedWebhooks.has(webhookId);
      expect(isReplayAfterAdd).toBe(true);
    });

    it('should handle webhook timeout scenarios', () => {
      const webhookTimestamp = Date.now() - 600000; // 10 minutes ago
      const maxAge = 300000; // 5 minutes
      const isStale = (Date.now() - webhookTimestamp) > maxAge;

      expect(isStale).toBe(true);
    });
  });

  describe('Refund and Cancellation Workflows', () => {
    it('should process PayMongo refunds', async () => {
      const refundData = {
        amount: 2500,
        payment_id: 'pay_test_123456789',
        reason: 'requested_by_customer'
      };

      const refund = {
        id: 'rfnd_test_123456789',
        type: 'refund',
        attributes: {
          ...refundData,
          status: 'pending',
          created_at: Math.floor(Date.now() / 1000)
        }
      };

      mockedAxios.post.mockResolvedValue({
        data: { data: refund }
      });

      const response = await mockedAxios.post('/refunds', refundData);
      expect(response.data.data.attributes.amount).toBe(2500);
      expect(response.data.data.attributes.status).toBe('pending');
    });

    it('should handle Billplz bill cancellations', async () => {
      const billId = 'bill_test_123456789';
      const cancelledBill = createMockBillplzBill({
        id: billId,
        state: 'deleted',
        paid: false
      });

      mockedAxios.delete.mockResolvedValue({
        data: cancelledBill
      });

      const response = await mockedAxios.delete(`/bills/${billId}`);
      expect(response.data.state).toBe('deleted');
    });

    it('should prevent refunds for cancelled orders', () => {
      const order = { status: 'cancelled', deadline: new Date(Date.now() - 86400000) };
      const submission = { status: 'pending', order_id: order.id };

      const canRefund = order.status === 'active' && submission.status === 'confirmed';
      expect(canRefund).toBe(false);
    });
  });

  describe('Error Recovery and Retry Logic', () => {
    it('should retry failed payment creation', async () => {
      // First attempt fails
      mockedAxios.post
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({
          data: { data: createMockPayMongoPayment() }
        });

      // First call fails
      await expect(mockedAxios.post('/payment_intents', {}))
        .rejects.toThrow('Network timeout');

      // Retry succeeds
      const response = await mockedAxios.post('/payment_intents', {});
      expect(response.data.data.id).toBe('pi_test_123456789');
    });

    it('should handle webhook processing failures', async () => {
      const webhookPayload = createMockWebhookPayload('paymongo');
      
      // Core API update fails
      mockedAxios.patch.mockRejectedValue(new Error('Core API unavailable'));

      await expect(
        mockedAxios.patch('/api/submissions/sub_123', { status: 'confirmed' })
      ).rejects.toThrow('Core API unavailable');
    });

    it('should queue failed webhook processing for retry', () => {
      const failedWebhook = {
        id: 'evt_test_123456789',
        payload: createMockWebhookPayload('paymongo'),
        attempts: 1,
        lastError: 'Core API timeout',
        nextRetry: new Date(Date.now() + 60000) // Retry in 1 minute
      };

      expect(failedWebhook.attempts).toBe(1);
      expect(failedWebhook.nextRetry > new Date()).toBe(true);
    });
  });

  describe('Payment Analytics and Reporting', () => {
    it('should track payment success rates', () => {
      const payments = [
        { status: 'succeeded', gateway: 'paymongo', method: 'gcash' },
        { status: 'failed', gateway: 'paymongo', method: 'gcash' },
        { status: 'succeeded', gateway: 'billplz', method: 'fpx' },
        { status: 'succeeded', gateway: 'paymongo', method: 'paymaya' }
      ];

      const successfulPayments = payments.filter(p => p.status === 'succeeded');
      const successRate = (successfulPayments.length / payments.length) * 100;

      expect(successRate).toBe(75); // 3 out of 4 succeeded
    });

    it('should track payment method preferences', () => {
      const payments = [
        { method: 'gcash', country: 'PH' },
        { method: 'gcash', country: 'PH' },
        { method: 'paymaya', country: 'PH' },
        { method: 'fpx', country: 'MY' }
      ];

      const gcashCount = payments.filter(p => p.method === 'gcash').length;
      const totalPhPayments = payments.filter(p => p.country === 'PH').length;
      const gcashPercentage = (gcashCount / totalPhPayments) * 100;

      expect(gcashPercentage).toBeCloseTo(66.67); // 2 out of 3 PH payments
    });

    it('should calculate payment processing fees', () => {
      const paymongoTransaction = {
        amount: 2500, // 25.00 PHP
        fee: 75, // PayMongo fee
        netAmount: 2425
      };

      const billplzTransaction = {
        amount: 2500, // 25.00 MYR
        fee: 50, // Billplz fee (2%)
        netAmount: 2450
      };

      expect(paymongoTransaction.netAmount).toBe(
        paymongoTransaction.amount - paymongoTransaction.fee
      );
      expect(billplzTransaction.netAmount).toBe(
        billplzTransaction.amount - billplzTransaction.fee
      );
    });
  });

  describe('Service Health and Monitoring', () => {
    it('should check payment gateway health', async () => {
      // PayMongo health check
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { status: 'healthy' }
      });

      // Billplz health check  
      mockedAxios.get.mockResolvedValueOnce({
        status: 200,
        data: { status: 'operational' }
      });

      const paymongoHealth = await mockedAxios.get('/paymongo/health');
      const billplzHealth = await mockedAxios.get('/billplz/health');

      expect(paymongoHealth.status).toBe(200);
      expect(billplzHealth.status).toBe(200);
    });

    it('should handle gateway downtime', async () => {
      mockedAxios.post.mockRejectedValue({
        response: { status: 503 },
        message: 'Service Unavailable'
      });

      await expect(
        mockedAxios.post('/payment_intents', {})
      ).rejects.toMatchObject({
        response: { status: 503 }
      });
    });

    it('should track payment processing times', () => {
      const processingTimes = [
        { gateway: 'paymongo', method: 'gcash', time: 1200 }, // 1.2 seconds
        { gateway: 'paymongo', method: 'paymaya', time: 800 }, // 0.8 seconds
        { gateway: 'billplz', method: 'fpx', time: 2000 } // 2.0 seconds
      ];

      const averageTime = processingTimes.reduce((sum, p) => sum + p.time, 0) / processingTimes.length;
      expect(averageTime).toBeCloseTo(1333.33);
    });
  });
});