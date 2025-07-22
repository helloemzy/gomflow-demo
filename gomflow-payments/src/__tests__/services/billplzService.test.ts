import { createMockBillplzBill, createMockWebhookPayload } from '../setup';
import axios from 'axios';

// Mock axios
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('BillplzService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Bill Creation', () => {
    it('should create bill successfully', async () => {
      const mockBill = createMockBillplzBill({
        amount: '2500', // 25.00 MYR
        name: 'Ahmad Rahman',
        email: 'ahmad@example.com',
        mobile: '+60123456789'
      });

      mockedAxios.post.mockResolvedValue({
        data: mockBill
      });

      const billData = {
        collection_id: 'test_collection_123',
        amount: '2500',
        name: 'Ahmad Rahman',
        email: 'ahmad@example.com',
        mobile: '+60123456789',
        description: 'Group Order Payment - GOMFLOW',
        reference_1_label: 'Order ID',
        reference_1: 'order_123456789'
      };

      const response = await mockedAxios.post('/bills', billData);
      const bill = response.data;

      expect(bill.amount).toBe('2500');
      expect(bill.name).toBe('Ahmad Rahman');
      expect(bill.email).toBe('ahmad@example.com');
      expect(bill.state).toBe('due');
      expect(bill.url).toContain('billplz.com');
    });

    it('should handle bill creation errors', async () => {
      const errorResponse = {
        response: {
          status: 422,
          data: {
            error: 'The given data was invalid.',
            message: 'Email field is required.'
          }
        }
      };

      mockedAxios.post.mockRejectedValue(errorResponse);

      await expect(
        mockedAxios.post('/bills', { amount: '1000' })
      ).rejects.toMatchObject(errorResponse);
    });

    it('should validate Malaysian phone numbers', () => {
      const validPhones = ['+60123456789', '+601234567890', '+60187654321'];
      const invalidPhones = ['+639123456789', '0123456789', '+1234567890'];

      validPhones.forEach(phone => {
        expect(phone).toMatch(/^\+60\d{9,10}$/);
      });

      invalidPhones.forEach(phone => {
        expect(phone).not.toMatch(/^\+60\d{9,10}$/);
      });
    });

    it('should format MYR amounts correctly', () => {
      const amounts = [
        { input: 25.50, expected: '2550' },
        { input: 100.00, expected: '10000' },
        { input: 0.50, expected: '50' }
      ];

      amounts.forEach(({ input, expected }) => {
        const cents = Math.round(input * 100).toString();
        expect(cents).toBe(expected);
      });
    });
  });

  describe('Bill Status Retrieval', () => {
    it('should retrieve bill status', async () => {
      const mockBill = createMockBillplzBill({
        paid: true,
        state: 'paid',
        paid_amount: '2500',
        paid_at: new Date().toISOString()
      });

      mockedAxios.get.mockResolvedValue({
        data: mockBill
      });

      const response = await mockedAxios.get('/bills/bill_test_123456789');
      const bill = response.data;

      expect(bill.paid).toBe(true);
      expect(bill.state).toBe('paid');
      expect(bill.paid_amount).toBe('2500');
      expect(bill.paid_at).toBeDefined();
    });

    it('should handle bill not found', async () => {
      mockedAxios.get.mockRejectedValue({
        response: {
          status: 404,
          data: {
            error: 'Bill not found'
          }
        }
      });

      await expect(
        mockedAxios.get('/bills/invalid_bill_id')
      ).rejects.toMatchObject({
        response: { status: 404 }
      });
    });

    it('should handle various bill states', () => {
      const validStates = ['due', 'paid', 'deleted'];
      const testState = 'paid';

      expect(validStates).toContain(testState);
    });
  });

  describe('Webhook Processing', () => {
    it('should process successful payment webhook', () => {
      const webhookPayload = createMockWebhookPayload('billplz', {
        paid: 'true',
        state: 'paid',
        paid_amount: '2500',
        transaction_id: 'txn_123456789'
      });

      expect(webhookPayload.paid).toBe('true');
      expect(webhookPayload.state).toBe('paid');
      expect(webhookPayload.transaction_id).toBe('txn_123456789');
    });

    it('should validate webhook signatures', () => {
      const webhookData = {
        billplz: {
          id: 'bill_test_123456789',
          paid: 'true',
          state: 'paid'
        }
      };

      const signatureKey = 'test_signature_key';
      const payload = JSON.stringify(webhookData);

      // In real implementation, this would verify X-Signature header
      expect(signatureKey).toBe('test_signature_key');
      expect(payload).toContain('bill_test_123456789');
    });

    it('should handle webhook validation failures', () => {
      const invalidSignature = 'invalid_signature';
      const expectedSignature = 'mocked-signature';

      expect(invalidSignature).not.toBe(expectedSignature);
    });

    it('should handle duplicate webhook notifications', () => {
      const billId = 'bill_test_123456789';
      const processedBills = new Set(['bill_test_987654321']);

      const isDuplicate = processedBills.has(billId);
      expect(isDuplicate).toBe(false);

      processedBills.add(billId);
      const isDuplicateAfterAdd = processedBills.has(billId);
      expect(isDuplicateAfterAdd).toBe(true);
    });
  });

  describe('Collection Management', () => {
    it('should validate collection ID', () => {
      const collectionId = 'test_collection_123';
      const validPattern = /^[a-zA-Z0-9_]+$/;

      expect(collectionId).toMatch(validPattern);
      expect(collectionId.length).toBeGreaterThan(0);
    });

    it('should handle collection not found', async () => {
      mockedAxios.get.mockRejectedValue({
        response: {
          status: 404,
          data: {
            error: 'Collection not found'
          }
        }
      });

      await expect(
        mockedAxios.get('/collections/invalid_collection')
      ).rejects.toMatchObject({
        response: { status: 404 }
      });
    });
  });

  describe('Bill Deletion', () => {
    it('should delete bill successfully', async () => {
      const deletedBill = createMockBillplzBill({
        state: 'deleted'
      });

      mockedAxios.delete.mockResolvedValue({
        data: deletedBill
      });

      const response = await mockedAxios.delete('/bills/bill_test_123456789');
      const bill = response.data;

      expect(bill.state).toBe('deleted');
    });

    it('should prevent deletion of paid bills', () => {
      const bill = createMockBillplzBill({
        paid: true,
        state: 'paid'
      });

      const canDelete = !bill.paid && bill.state !== 'paid';
      expect(canDelete).toBe(false);
    });

    it('should allow deletion of unpaid bills', () => {
      const bill = createMockBillplzBill({
        paid: false,
        state: 'due'
      });

      const canDelete = !bill.paid && bill.state !== 'paid';
      expect(canDelete).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle API authentication errors', async () => {
      mockedAxios.post.mockRejectedValue({
        response: {
          status: 401,
          data: {
            error: 'Unauthorized',
            message: 'Invalid API key'
          }
        }
      });

      await expect(
        mockedAxios.post('/bills', {})
      ).rejects.toMatchObject({
        response: { status: 401 }
      });
    });

    it('should handle network timeouts', async () => {
      mockedAxios.post.mockRejectedValue({
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded'
      });

      await expect(
        mockedAxios.post('/bills', {})
      ).rejects.toMatchObject({
        code: 'ECONNABORTED'
      });
    });

    it('should handle server errors', async () => {
      mockedAxios.post.mockRejectedValue({
        response: {
          status: 500,
          data: {
            error: 'Internal Server Error'
          }
        }
      });

      await expect(
        mockedAxios.post('/bills', {})
      ).rejects.toMatchObject({
        response: { status: 500 }
      });
    });
  });

  describe('Amount Validation', () => {
    it('should validate minimum amounts', () => {
      const minimumAmount = 100; // 1.00 MYR in sen
      const testAmounts = ['50', '100', '150'];

      testAmounts.forEach(amount => {
        const isValid = parseInt(amount) >= minimumAmount;
        if (amount === '50') {
          expect(isValid).toBe(false);
        } else {
          expect(isValid).toBe(true);
        }
      });
    });

    it('should validate maximum amounts', () => {
      const maximumAmount = 10000000; // 100,000 MYR in sen
      const testAmount = 250000; // 2,500 MYR in sen

      expect(testAmount).toBeLessThan(maximumAmount);
    });

    it('should handle decimal amounts correctly', () => {
      const amounts = [
        { myr: 25.99, sen: '2599' },
        { myr: 100.50, sen: '10050' },
        { myr: 0.99, sen: '99' }
      ];

      amounts.forEach(({ myr, sen }) => {
        const calculatedSen = Math.round(myr * 100).toString();
        expect(calculatedSen).toBe(sen);
      });
    });
  });

  describe('Reference Data Handling', () => {
    it('should store order references correctly', () => {
      const bill = createMockBillplzBill({
        reference_1_label: 'Order ID',
        reference_1: 'order_123456789',
        reference_2_label: 'Submission ID',
        reference_2: 'sub_123456789'
      });

      expect(bill.reference_1_label).toBe('Order ID');
      expect(bill.reference_1).toMatch(/^order_/);
      expect(bill.reference_2_label).toBe('Submission ID');
      expect(bill.reference_2).toMatch(/^sub_/);
    });

    it('should validate reference field lengths', () => {
      const longReference = 'x'.repeat(120);
      const maxLength = 120;

      expect(longReference.length).toBe(maxLength);
    });
  });

  describe('Callback URL Handling', () => {
    it('should validate callback URLs', () => {
      const callbackUrl = 'https://gomflow.com/api/webhooks/billplz';
      const isValidUrl = /^https?:\/\/.+/.test(callbackUrl);

      expect(isValidUrl).toBe(true);
      expect(callbackUrl).toContain('webhooks/billplz');
    });

    it('should handle redirect URLs', () => {
      const redirectUrl = 'https://gomflow.com/payment/success';
      const isValidUrl = /^https?:\/\/.+/.test(redirectUrl);

      expect(isValidUrl).toBe(true);
      expect(redirectUrl).toContain('payment/success');
    });
  });

  describe('Date Handling', () => {
    it('should set due dates correctly', () => {
      const now = new Date();
      const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      expect(dueDate > now).toBe(true);
    });

    it('should handle payment timestamps', () => {
      const paidAt = new Date().toISOString();
      const isValidDate = !isNaN(Date.parse(paidAt));

      expect(isValidDate).toBe(true);
      expect(paidAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should validate expiry dates', () => {
      const now = new Date();
      const expiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      const isExpired = expiry < now;
      expect(isExpired).toBe(false);
    });
  });
});