import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
process.env.TELEGRAM_WEBHOOK_URL = 'https://test.com/webhook';
process.env.CORE_API_URL = 'http://localhost:3001';
process.env.SMART_AGENT_SERVICE_URL = 'http://localhost:3002';
process.env.SERVICE_SECRET = 'test-service-secret';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.PORT = '3005';

// Mock fetch for HTTP requests
global.fetch = jest.fn();

// Mock Telegraf bot
jest.mock('telegraf', () => {
  const mockBot = {
    start: jest.fn(),
    help: jest.fn(),
    command: jest.fn(),
    on: jest.fn(),
    use: jest.fn(),
    catch: jest.fn(),
    launch: jest.fn(),
    stop: jest.fn(),
    botInfo: { username: 'test_bot' },
    telegram: {
      getFile: jest.fn(),
      setMyCommands: jest.fn()
    }
  };

  return {
    Telegraf: jest.fn(() => mockBot),
    session: jest.fn(() => (ctx: any, next: any) => next()),
    message: jest.fn(() => (type: string) => type)
  };
});

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
  },
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn()
}));

// Mock FormData for file uploads
jest.mock('form-data', () => {
  return jest.fn().mockImplementation(() => ({
    append: jest.fn(),
    getHeaders: jest.fn(() => ({ 'content-type': 'multipart/form-data' }))
  }));
});

// Mock fs/promises for file operations
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn()
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((...args) => '/' + args.join('/')),
  basename: jest.fn((path) => path.split('/').pop()),
  extname: jest.fn((path) => {
    const parts = path.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  })
}));

// Create mock context helper
export const createMockTelegramContext = (overrides: any = {}) => ({
  from: {
    id: 12345,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    language_code: 'en'
  },
  chat: {
    id: 12345,
    type: 'private'
  },
  message: {
    text: '/test',
    message_id: 1
  },
  session: {
    language: 'en',
    state: {},
    data: {},
    flow: undefined
  },
  user: {
    id: 'tg_12345',
    telegram_id: 12345,
    username: 'testuser',
    first_name: 'Test',
    last_name: 'User',
    is_gom: false,
    created_at: new Date(),
    updated_at: new Date(),
    last_active: new Date()
  },
  reply: jest.fn(),
  editMessageText: jest.fn(),
  answerCbQuery: jest.fn(),
  callbackQuery: undefined,
  updateType: 'message',
  ...overrides
});

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