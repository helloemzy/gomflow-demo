// Jest setup file for notification service tests

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.PORT = '0'; // Use random available port
process.env.HOST = 'localhost';
process.env.CORS_ORIGIN = '*';
process.env.RATE_LIMIT_WINDOW_MS = '900000';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
process.env.CORE_API_SECRET = 'test-core-api-secret';

// Mock external services for testing
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn()
  },
  messaging: jest.fn(() => ({
    send: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    sendMulticast: jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true, messageId: 'test-message-id' }]
    })
  }))
}));

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({
        id: 'test-email-id',
        from: 'test@gomflow.com',
        to: ['test@example.com'],
        created_at: new Date().toISOString()
      })
    }
  }))
}));

// Increase timeout for integration tests
jest.setTimeout(30000);

// Global test utilities
global.createMockNotification = (overrides = {}) => ({
  id: 'test-notification-123',
  type: 'order_created',
  userId: 'test-user-123',
  title: 'Test Notification',
  message: 'This is a test notification',
  data: {},
  channels: [],
  priority: 'normal',
  createdAt: new Date(),
  ...overrides
});

global.createMockUser = (overrides = {}) => ({
  id: 'test-user-123',
  email: 'test@example.com',
  role: 'user',
  ...overrides
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global error handler for unhandled promise rejections during tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit during tests, just log
});

console.log('Test environment setup complete');