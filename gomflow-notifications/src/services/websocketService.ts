import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import config from '../config';
import logger from '../utils/logger';
import { 
  WebSocketAuthData, 
  SocketUser, 
  NotificationEvent, 
  ConnectionStats,
  NotificationChannel 
} from '../types';

const authDataSchema = z.object({
  userId: z.string(),
  userType: z.enum(['buyer', 'gom']),
  country: z.enum(['PH', 'MY']),
  sessionId: z.string()
});

export class WebSocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, SocketUser> = new Map();
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  
  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: config.CORS_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupRedisAdapter();
    this.setupEventHandlers();
    this.setupHealthCheck();
  }

  private async setupRedisAdapter(): Promise<void> {
    if (config.SOCKET_IO_ADAPTER === 'redis' && config.REDIS_URL) {
      try {
        const pubClient = createClient({ url: config.REDIS_URL });
        const subClient = pubClient.duplicate();

        await Promise.all([
          pubClient.connect(),
          subClient.connect()
        ]);

        this.io.adapter(createAdapter(pubClient, subClient));
        logger.info('Socket.IO Redis adapter configured successfully');
      } catch (error) {
        logger.error('Failed to setup Redis adapter:', error);
        logger.warn('Falling back to memory adapter');
      }
    }
  }

  private setupEventHandlers(): void {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, config.JWT_SECRET) as any;
        const authData = authDataSchema.parse({
          userId: decoded.sub || decoded.userId,
          userType: decoded.user_metadata?.user_type || 'buyer',
          country: decoded.user_metadata?.country || 'PH',
          sessionId: decoded.sessionId || socket.id
        });

        socket.data = authData;
        next();
      } catch (error) {
        logger.warn('WebSocket authentication failed:', error);
        next(new Error('Invalid authentication token'));
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    // Handle server shutdown gracefully
    process.on('SIGTERM', () => {
      this.io.close();
    });
  }

  private handleConnection(socket: any): void {
    const authData: WebSocketAuthData = socket.data;
    const socketUser: SocketUser = {
      ...authData,
      socketId: socket.id,
      connectedAt: new Date(),
      lastActivity: new Date()
    };

    // Store user connection
    this.connectedUsers.set(socket.id, socketUser);
    
    // Track multiple connections per user
    if (!this.userSockets.has(authData.userId)) {
      this.userSockets.set(authData.userId, new Set());
    }
    this.userSockets.get(authData.userId)!.add(socket.id);

    // Join user-specific room
    socket.join(`user:${authData.userId}`);
    
    // Join type-specific rooms for broadcasts
    socket.join(`type:${authData.userType}`);
    socket.join(`country:${authData.country}`);

    logger.info('User connected to WebSocket', {
      userId: authData.userId,
      userType: authData.userType,
      country: authData.country,
      socketId: socket.id,
      totalConnections: this.connectedUsers.size
    });

    // Send welcome message with connection confirmation
    socket.emit('connected', {
      message: 'Successfully connected to GOMFLOW notifications',
      userId: authData.userId,
      serverTime: new Date().toISOString(),
      features: ['real-time-notifications', 'order-updates', 'payment-confirmations']
    });

    // Handle notification acknowledgments
    socket.on('notification:ack', (notificationId: string) => {
      this.handleNotificationAck(socket, notificationId);
    });

    // Handle notification read status
    socket.on('notification:read', (notificationId: string) => {
      this.handleNotificationRead(socket, notificationId);
    });

    // Handle subscription to specific orders
    socket.on('order:subscribe', (orderId: string) => {
      this.handleOrderSubscribe(socket, orderId);
    });

    socket.on('order:unsubscribe', (orderId: string) => {
      this.handleOrderUnsubscribe(socket, orderId);
    });

    // Handle activity tracking
    socket.on('activity', () => {
      this.updateUserActivity(socket.id);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Handle connection errors
    socket.on('error', (error) => {
      logger.error('WebSocket error:', { 
        socketId: socket.id, 
        userId: authData.userId, 
        error 
      });
    });
  }

  private handleNotificationAck(socket: any, notificationId: string): void {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    logger.debug('Notification acknowledged', {
      userId: user.userId,
      notificationId,
      socketId: socket.id
    });

    // TODO: Update notification delivery status in database
    // This would typically mark the notification as delivered in the database
  }

  private handleNotificationRead(socket: any, notificationId: string): void {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    logger.debug('Notification marked as read', {
      userId: user.userId,
      notificationId,
      socketId: socket.id
    });

    // TODO: Update notification read status in database
  }

  private handleOrderSubscribe(socket: any, orderId: string): void {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    socket.join(`order:${orderId}`);
    
    logger.debug('User subscribed to order updates', {
      userId: user.userId,
      orderId,
      socketId: socket.id
    });

    socket.emit('order:subscribed', { orderId });
  }

  private handleOrderUnsubscribe(socket: any, orderId: string): void {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    socket.leave(`order:${orderId}`);
    
    logger.debug('User unsubscribed from order updates', {
      userId: user.userId,
      orderId,
      socketId: socket.id
    });

    socket.emit('order:unsubscribed', { orderId });
  }

  private updateUserActivity(socketId: string): void {
    const user = this.connectedUsers.get(socketId);
    if (user) {
      user.lastActivity = new Date();
    }
  }

  private handleDisconnection(socket: any, reason: string): void {
    const user = this.connectedUsers.get(socket.id);
    if (!user) return;

    // Remove from connected users
    this.connectedUsers.delete(socket.id);

    // Remove from user sockets tracking
    const userSocketSet = this.userSockets.get(user.userId);
    if (userSocketSet) {
      userSocketSet.delete(socket.id);
      if (userSocketSet.size === 0) {
        this.userSockets.delete(user.userId);
      }
    }

    const connectionDuration = new Date().getTime() - user.connectedAt.getTime();

    logger.info('User disconnected from WebSocket', {
      userId: user.userId,
      userType: user.userType,
      socketId: socket.id,
      reason,
      connectionDuration: Math.round(connectionDuration / 1000),
      totalConnections: this.connectedUsers.size
    });
  }

  // Public methods for sending notifications

  public async sendToUser(userId: string, notification: NotificationEvent): Promise<boolean> {
    const userSocketSet = this.userSockets.get(userId);
    if (!userSocketSet || userSocketSet.size === 0) {
      logger.debug('User not connected via WebSocket', { userId });
      return false;
    }

    const payload = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      priority: notification.priority,
      timestamp: notification.createdAt.toISOString()
    };

    // Send to all user's connected sockets
    for (const socketId of userSocketSet) {
      this.io.to(socketId).emit('notification', payload);
    }

    logger.debug('Notification sent via WebSocket', {
      userId,
      notificationId: notification.id,
      type: notification.type,
      socketCount: userSocketSet.size
    });

    return true;
  }

  public async sendToOrder(orderId: string, notification: NotificationEvent): Promise<number> {
    const room = `order:${orderId}`;
    const sockets = await this.io.in(room).fetchSockets();
    
    if (sockets.length === 0) {
      logger.debug('No users subscribed to order', { orderId });
      return 0;
    }

    const payload = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      priority: notification.priority,
      timestamp: notification.createdAt.toISOString()
    };

    this.io.to(room).emit('notification', payload);

    logger.debug('Order notification sent via WebSocket', {
      orderId,
      notificationId: notification.id,
      type: notification.type,
      recipientCount: sockets.length
    });

    return sockets.length;
  }

  public async broadcastToUserType(userType: 'buyer' | 'gom', notification: NotificationEvent): Promise<number> {
    const room = `type:${userType}`;
    const sockets = await this.io.in(room).fetchSockets();

    if (sockets.length === 0) {
      logger.debug('No users of type connected', { userType });
      return 0;
    }

    const payload = {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      priority: notification.priority,
      timestamp: notification.createdAt.toISOString()
    };

    this.io.to(room).emit('notification', payload);

    logger.info('Broadcast notification sent via WebSocket', {
      userType,
      notificationId: notification.id,
      type: notification.type,
      recipientCount: sockets.length
    });

    return sockets.length;
  }

  public async getConnectionStats(): Promise<ConnectionStats> {
    const totalConnections = this.connectedUsers.size;
    const users = Array.from(this.connectedUsers.values());

    const connectionsByUserType = users.reduce(
      (acc, user) => {
        acc[user.userType]++;
        return acc;
      },
      { buyer: 0, gom: 0 }
    );

    const connectionsByCountry = users.reduce(
      (acc, user) => {
        acc[user.country]++;
        return acc;
      },
      { PH: 0, MY: 0 }
    );

    const now = new Date().getTime();
    const totalConnectionTime = users.reduce(
      (acc, user) => acc + (now - user.connectedAt.getTime()),
      0
    );
    const averageConnectionTime = totalConnections > 0 
      ? Math.round(totalConnectionTime / totalConnections / 1000)
      : 0;

    return {
      totalConnections,
      activeConnections: totalConnections, // All connected users are considered active
      connectionsByUserType,
      connectionsByCountry,
      averageConnectionTime
    };
  }

  private setupHealthCheck(): void {
    // Send ping to all connected clients every 30 seconds
    setInterval(() => {
      this.io.emit('ping', { timestamp: new Date().toISOString() });
    }, 30000);

    // Clean up inactive connections every 5 minutes
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 5 * 60 * 1000);
  }

  private cleanupInactiveConnections(): void {
    const now = new Date().getTime();
    const inactiveThreshold = 10 * 60 * 1000; // 10 minutes

    for (const [socketId, user] of this.connectedUsers.entries()) {
      if (now - user.lastActivity.getTime() > inactiveThreshold) {
        logger.warn('Disconnecting inactive user', {
          userId: user.userId,
          socketId,
          inactiveTime: Math.round((now - user.lastActivity.getTime()) / 1000)
        });
        
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
        }
      }
    }
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}

export default WebSocketService;