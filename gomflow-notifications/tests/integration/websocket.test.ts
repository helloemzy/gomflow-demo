import { Server } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import NotificationServer from '../../src/index';
import { NotificationEventType, NotificationPriority } from '../../src/types';

describe('WebSocket Integration Tests', () => {
  let server: NotificationServer;
  let clientSocket: ClientSocket;
  let validToken: string;
  let port: number;

  beforeAll((done) => {
    // Create test JWT token
    validToken = jwt.sign(
      { sub: 'test-user-123', email: 'test@example.com', role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Start notification server
    server = new NotificationServer();
    const httpServer = server.getServer();
    
    httpServer.listen(() => {
      port = httpServer.address()?.port || 3000;
      done();
    });
  });

  afterAll((done) => {
    if (server) {
      server.getServer().close(done);
    } else {
      done();
    }
  });

  beforeEach((done) => {
    // Create client socket connection
    clientSocket = ioc(`http://localhost:${port}`, {
      auth: {
        token: validToken
      },
      transports: ['websocket'],
      forceNew: true
    });

    clientSocket.on('connect', () => {
      done();
    });

    clientSocket.on('connect_error', (error) => {
      done(error);
    });
  });

  afterEach(() => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
  });

  describe('Connection and Authentication', () => {
    test('should connect successfully with valid token', (done) => {
      expect(clientSocket.connected).toBe(true);
      done();
    });

    test('should reject connection with invalid token', (done) => {
      const invalidClient = ioc(`http://localhost:${port}`, {
        auth: {
          token: 'invalid-token'
        },
        transports: ['websocket'],
        forceNew: true
      });

      invalidClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        invalidClient.disconnect();
        done();
      });

      invalidClient.on('connect', () => {
        invalidClient.disconnect();
        done(new Error('Should not connect with invalid token'));
      });
    });

    test('should reject connection without token', (done) => {
      const noTokenClient = ioc(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true
      });

      noTokenClient.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        noTokenClient.disconnect();
        done();
      });

      noTokenClient.on('connect', () => {
        noTokenClient.disconnect();
        done(new Error('Should not connect without token'));
      });
    });
  });

  describe('Real-time Notifications', () => {
    test('should receive notification sent to user', (done) => {
      const testNotification = {
        id: 'test-notif-123',
        type: NotificationEventType.ORDER_CREATED,
        title: 'Test Order Created',
        message: 'Your test order has been created',
        data: { orderId: 'order-123' },
        priority: NotificationPriority.NORMAL,
        timestamp: new Date().toISOString()
      };

      clientSocket.on('notification', (notification) => {
        expect(notification.id).toBe(testNotification.id);
        expect(notification.type).toBe(testNotification.type);
        expect(notification.title).toBe(testNotification.title);
        expect(notification.message).toBe(testNotification.message);
        expect(notification.data.orderId).toBe('order-123');
        expect(notification.priority).toBe(testNotification.priority);
        done();
      });

      // Simulate sending notification via the service
      setTimeout(() => {
        const notificationService = server.getApp().locals.notificationService;
        notificationService.sendNotification({
          ...testNotification,
          userId: 'test-user-123',
          channels: [],
          createdAt: new Date()
        });
      }, 100);
    });

    test('should not receive notifications for other users', (done) => {
      let notificationReceived = false;

      clientSocket.on('notification', () => {
        notificationReceived = true;
      });

      // Send notification to different user
      setTimeout(() => {
        const notificationService = server.getApp().locals.notificationService;
        notificationService.sendNotification({
          id: 'test-notif-456',
          type: NotificationEventType.ORDER_CREATED,
          userId: 'different-user-456',
          title: 'Other User Order',
          message: 'This should not be received',
          data: {},
          channels: [],
          priority: NotificationPriority.NORMAL,
          createdAt: new Date()
        });
      }, 100);

      // Check after 500ms that no notification was received
      setTimeout(() => {
        expect(notificationReceived).toBe(false);
        done();
      }, 500);
    });
  });

  describe('Room Management', () => {
    test('should join and leave rooms successfully', (done) => {
      const roomId = 'order-room-123';
      let joinedRoom = false;
      let leftRoom = false;

      clientSocket.on('room-joined', (joinedRoomId) => {
        expect(joinedRoomId).toBe(roomId);
        joinedRoom = true;
        
        // Leave room after joining
        clientSocket.emit('leave-room', roomId);
      });

      clientSocket.on('room-left', (leftRoomId) => {
        expect(leftRoomId).toBe(roomId);
        leftRoom = true;
        
        // Check both events occurred
        expect(joinedRoom).toBe(true);
        expect(leftRoom).toBe(true);
        done();
      });

      // Join room
      clientSocket.emit('join-room', roomId);
    });

    test('should receive room-specific notifications', (done) => {
      const roomId = 'order-room-456';
      let notificationReceived = false;

      // Join room first
      clientSocket.emit('join-room', roomId);

      clientSocket.on('room-joined', () => {
        // Send room-specific notification after joining
        setTimeout(() => {
          const websocketService = server.getApp().locals.websocketService;
          websocketService.sendToRoom(roomId, {
            id: 'room-notif-123',
            type: NotificationEventType.ORDER_DEADLINE_APPROACHING,
            title: 'Room Notification',
            message: 'This is a room-specific notification',
            data: { roomId },
            priority: NotificationPriority.HIGH,
            timestamp: new Date().toISOString()
          });
        }, 100);
      });

      clientSocket.on('notification', (notification) => {
        expect(notification.data.roomId).toBe(roomId);
        expect(notification.title).toBe('Room Notification');
        notificationReceived = true;
        done();
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid room join attempts', (done) => {
      clientSocket.on('room-error', (error) => {
        expect(error.message).toContain('Invalid room');
        done();
      });

      // Try to join invalid room
      clientSocket.emit('join-room', '');
    });

    test('should handle system messages', (done) => {
      clientSocket.on('system-message', (message) => {
        expect(message.type).toBe('info');
        expect(message.message).toContain('System maintenance');
        done();
      });

      // Simulate system message
      setTimeout(() => {
        const websocketService = server.getApp().locals.websocketService;
        websocketService.sendSystemMessage('test-user-123', {
          type: 'info',
          message: 'System maintenance scheduled'
        });
      }, 100);
    });
  });

  describe('Connection Statistics', () => {
    test('should track connection statistics', async () => {
      const websocketService = server.getApp().locals.websocketService;
      const stats = await websocketService.getConnectionStats();

      expect(stats).toHaveProperty('totalConnections');
      expect(stats).toHaveProperty('connectedUsers');
      expect(stats.totalConnections).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    test('should handle multiple rapid notifications', (done) => {
      const notificationCount = 10;
      let receivedCount = 0;

      clientSocket.on('notification', () => {
        receivedCount++;
        if (receivedCount === notificationCount) {
          done();
        }
      });

      // Send multiple notifications rapidly
      const notificationService = server.getApp().locals.notificationService;
      for (let i = 0; i < notificationCount; i++) {
        setTimeout(() => {
          notificationService.sendNotification({
            id: `rapid-notif-${i}`,
            type: NotificationEventType.ORDER_CREATED,
            userId: 'test-user-123',
            title: `Rapid Notification ${i}`,
            message: `Message ${i}`,
            data: { index: i },
            channels: [],
            priority: NotificationPriority.NORMAL,
            createdAt: new Date()
          });
        }, i * 10); // 10ms intervals
      }
    });
  });
});