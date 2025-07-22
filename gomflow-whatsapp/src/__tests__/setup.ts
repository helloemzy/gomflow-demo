import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.TWILIO_ACCOUNT_SID = 'test_account_sid';
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
process.env.TWILIO_WHATSAPP_NUMBER = 'whatsapp:+14155238886';
process.env.CORE_API_URL = 'https://test-api.gomflow.com';
process.env.SERVICE_AUTH_SECRET = 'test-service-secret';
process.env.REDIS_URL = 'redis://localhost:6379';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock Twilio
jest.mock('twilio', () => {
  return jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'mock_message_sid',
        status: 'sent',
        to: 'whatsapp:+639123456789',
        from: 'whatsapp:+14155238886',
        body: 'Mock message body',
        dateSent: new Date(),
        dateCreated: new Date(),
        dateUpdated: new Date(),
        direction: 'outbound-api',
        errorCode: null,
        errorMessage: null,
        numMedia: '0',
        numSegments: '1',
        price: '0.0000',
        priceUnit: 'USD',
        accountSid: 'test_account_sid'
      })
    },
    validateRequest: jest.fn().mockReturnValue(true)
  }));
});

// Mock Bull queue
jest.mock('bull', () => {
  return jest.fn(() => ({
    add: jest.fn().mockResolvedValue({ id: 'job-123' }),
    addBulk: jest.fn().mockResolvedValue([
      { id: 'job-1' },
      { id: 'job-2' },
    ]),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
    getDelayedCount: jest.fn().mockResolvedValue(0),
    clean: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    getJob: jest.fn(),
  }));
});

// Mock axios
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  put: jest.fn(),
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    put: jest.fn(),
  })),
}));

// Helper function to create mock submission data
export const createMockSubmission = (overrides: any = {}) => ({
  id: 'sub_test_123',
  order_id: 'order_test_123',
  buyer_name: 'Juan Dela Cruz',
  buyer_phone: '+639123456789',
  buyer_email: 'juan@example.com',
  quantity: 2,
  total_amount: 50.00,
  currency: 'PHP',
  status: 'pending',
  payment_reference: 'GOMF789123',
  payment_url: 'https://payment.gomflow.com/pay/GOMF789123',
  shipping_address: '123 Main St, Quezon City, Metro Manila',
  special_notes: 'Handle with care',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  order: {
    id: 'order_test_123',
    title: 'SEVENTEEN God of Music Album',
    description: 'Limited edition with exclusive photocards',
    price: 25.00,
    currency: 'PHP',
    deadline: new Date(Date.now() + 604800000).toISOString(), // 1 week
    min_orders: 50,
    max_orders: 200,
    is_active: true,
    slug: 'seventeen-god-of-music-album',
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
        instructions: 'Reference: Order ID',
        is_gateway: false
      }
    ],
    user: {
      id: 'user_gom_123',
      username: 'kpop_gom_ph',
      phone: '+639987654321'
    }
  },
  ...overrides
});

// Helper function to create mock order data
export const createMockOrder = (overrides: any = {}) => ({
  id: 'order_test_123',
  title: 'SEVENTEEN God of Music Album',
  description: 'Limited edition with exclusive photocards',
  price: 25.00,
  currency: 'PHP',
  deadline: new Date(Date.now() + 604800000).toISOString(), // 1 week
  min_orders: 50,
  max_orders: 200,
  total_submissions: 45,
  is_active: true,
  slug: 'seventeen-god-of-music-album',
  category: 'album',
  shipping_from: 'Philippines',
  payment_methods: [
    {
      type: 'gcash',
      number: '09123456789',
      name: 'Juan GOM',
      instructions: 'Send screenshot after payment',
      is_gateway: false
    }
  ],
  user: {
    id: 'user_gom_123',
    username: 'kpop_gom_ph',
    phone: '+639987654321'
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides
});

// Helper function to create mock Twilio webhook data
export const createMockTwilioWebhook = (overrides: any = {}) => ({
  MessageSid: 'SMtestmessagesid123456789',
  AccountSid: 'test_account_sid',
  From: 'whatsapp:+639123456789',
  To: 'whatsapp:+14155238886',
  Body: 'status',
  NumMedia: '0',
  NumSegments: '1',
  MessageStatus: 'received',
  SmsMessageSid: 'SMtestmessagesid123456789',
  SmsSid: 'SMtestmessagesid123456789',
  SmsStatus: 'received',
  ProfileName: 'Juan Dela Cruz',
  WaId: '639123456789',
  ...overrides
});

// Helper function to create mock bulk message recipients
export const createMockBulkRecipients = (count: number = 3) => {
  return Array(count).fill(null).map((_, i) => ({
    phone: `+63912345678${i}`,
    message: `Test message ${i + 1} for bulk sending`
  }));
};

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    keys: jest.fn(),
    hGet: jest.fn(),
    hSet: jest.fn(),
    hGetAll: jest.fn(),
    hDel: jest.fn(),
    lPush: jest.fn(),
    lPop: jest.fn(),
    lLen: jest.fn(),
    lRange: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  }))
}));

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global test timeout
jest.setTimeout(10000);