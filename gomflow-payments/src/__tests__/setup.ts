import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3003';
process.env.SERVICE_AUTH_SECRET = 'test-service-secret';
process.env.CORE_API_URL = 'http://localhost:3001';

// PayMongo test configuration
process.env.PAYMONGO_SECRET_KEY = 'sk_test_123456789';
process.env.PAYMONGO_PUBLIC_KEY = 'pk_test_123456789';
process.env.PAYMONGO_WEBHOOK_SECRET = 'whsec_test_123456789';

// Billplz test configuration
process.env.BILLPLZ_API_KEY = 'test_billplz_key';
process.env.BILLPLZ_COLLECTION_ID = 'test_collection_123';
process.env.BILLPLZ_X_SIGNATURE_KEY = 'test_signature_key';

// Mock fetch for HTTP requests
global.fetch = jest.fn();

// Mock axios for API calls
jest.mock('axios', () => ({
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    }))
  }
}));

// Mock crypto for webhook signature verification
jest.mock('crypto', () => ({
  createHmac: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mocked-signature')
  })),
  timingSafeEqual: jest.fn(() => true)
}));

// Helper to create mock PayMongo payment data
export const createMockPayMongoPayment = (overrides: any = {}) => ({
  id: 'pi_test_123456789',
  type: 'payment_intent',
  attributes: {
    amount: 2500, // 25.00 PHP
    currency: 'PHP',
    description: 'Group Order Payment - GOMFLOW',
    statement_descriptor: 'GOMFLOW',
    status: 'succeeded',
    livemode: false,
    client_key: 'pi_test_123456789_client_key',
    created_at: Math.floor(Date.now() / 1000),
    updated_at: Math.floor(Date.now() / 1000),
    last_payment_error: null,
    payment_method: {
      id: 'pm_test_123456789',
      type: 'payment_method',
      attributes: {
        type: 'gcash',
        details: {
          brand: 'gcash'
        }
      }
    },
    payments: [
      {
        id: 'pay_test_123456789',
        type: 'payment',
        attributes: {
          access_url: null,
          amount: 2500,
          balance_transaction_id: 'bal_test_123456789',
          billing: null,
          currency: 'PHP',
          description: 'Group Order Payment - GOMFLOW',
          disputed: false,
          external_reference_number: null,
          fee: 75,
          livemode: false,
          net_amount: 2425,
          origin: 'api',
          payment_intent_id: 'pi_test_123456789',
          payout: null,
          source: {
            id: 'src_test_123456789',
            type: 'source'
          },
          statement_descriptor: 'GOMFLOW',
          status: 'paid',
          tax_amount: null,
          refunds: [],
          taxes: [],
          available_at: Math.floor(Date.now() / 1000),
          created_at: Math.floor(Date.now() / 1000),
          paid_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000)
        }
      }
    ],
    next_action: null,
    payment_method_allowed: ['gcash', 'paymaya', 'card'],
    payment_method_options: {},
    metadata: {
      submission_id: 'sub_123456789',
      order_id: 'order_123456789',
      user_id: 'user_123456789'
    }
  },
  ...overrides
});

// Helper to create mock Billplz bill data
export const createMockBillplzBill = (overrides: any = {}) => ({
  id: 'bill_test_123456789',
  collection_id: 'test_collection_123',
  paid: false,
  state: 'due',
  amount: '2500', // 25.00 MYR in cents
  paid_amount: '0',
  due_at: new Date(Date.now() + 86400000).toISOString(),
  email: 'buyer@example.com',
  mobile: '+60123456789',
  name: 'Test Buyer',
  url: 'https://www.billplz.com/bills/bill_test_123456789',
  reference_1_label: 'Order ID',
  reference_1: 'order_123456789',
  reference_2_label: 'Submission ID',
  reference_2: 'sub_123456789',
  redirect_url: 'https://gomflow.com/payment/success',
  callback_url: 'https://gomflow.com/api/webhooks/billplz',
  description: 'Group Order Payment - GOMFLOW',
  paid_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

// Helper to create mock webhook payload
export const createMockWebhookPayload = (type: 'paymongo' | 'billplz', data: any = {}) => {
  if (type === 'paymongo') {
    return {
      data: {
        id: 'evt_test_123456789',
        type: 'event',
        attributes: {
          type: 'payment_intent.payment.succeeded',
          livemode: false,
          data: createMockPayMongoPayment(data),
          previous_data: {},
          pending_webhooks: 1,
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000)
        }
      }
    };
  } else {
    return {
      id: 'bill_test_123456789',
      collection_id: 'test_collection_123',
      paid: 'true',
      state: 'paid',
      amount: '2500',
      paid_amount: '2500',
      paid_at: new Date().toISOString(),
      transaction_id: 'txn_test_123456789',
      transaction_status: 'completed',
      ...data
    };
  }
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Suppress console logs during tests unless debugging
const originalConsole = { ...console };
beforeAll(() => {
  if (process.env.TEST_VERBOSE !== 'true') {
    console.log = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.debug = jest.fn();
  }
});

afterAll(() => {
  Object.assign(console, originalConsole);
});