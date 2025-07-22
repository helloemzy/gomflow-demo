// Client-side WebSocket service for real-time notifications
// This file can be imported into the main frontend dashboard

import { io, Socket } from 'socket.io-client';

export interface NotificationEvent {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  timestamp: string;
}

export interface WebSocketClientConfig {
  url: string;
  token: string;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export type NotificationCallback = (notification: NotificationEvent) => void;
export type ConnectionCallback = (connected: boolean) => void;
export type ErrorCallback = (error: string) => void;

export class WebSocketClient {
  private socket: Socket | null = null;
  private config: WebSocketClientConfig;
  private notificationCallbacks: NotificationCallback[] = [];
  private connectionCallbacks: ConnectionCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private isConnected = false;

  constructor(config: WebSocketClientConfig) {
    this.config = {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      ...config
    };
  }

  public connect(): void {
    if (this.socket?.connected) {
      console.warn('WebSocket already connected');
      return;
    }

    try {
      this.socket = io(this.config.url, {
        auth: {
          token: this.config.token
        },
        transports: ['websocket', 'polling'],
        reconnection: this.config.reconnection,
        reconnectionAttempts: this.config.reconnectionAttempts,
        reconnectionDelay: this.config.reconnectionDelay
      });

      this.setupEventHandlers();
      
      console.log('WebSocket connection initiated to:', this.config.url);
    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error);
      this.notifyError('Failed to initialize WebSocket connection');
    }
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.notifyConnectionChange(false);
      console.log('WebSocket disconnected');
    }
  }

  public reconnect(): void {
    this.disconnect();
    setTimeout(() => this.connect(), 1000);
  }

  public updateToken(newToken: string): void {
    this.config.token = newToken;
    if (this.socket?.connected) {
      this.socket.auth = { token: newToken };
      this.socket.disconnect().connect();
    }
  }

  // Event listeners
  public onNotification(callback: NotificationCallback): () => void {
    this.notificationCallbacks.push(callback);
    return () => {
      const index = this.notificationCallbacks.indexOf(callback);
      if (index > -1) {
        this.notificationCallbacks.splice(index, 1);
      }
    };
  }

  public onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.push(callback);
    // Immediately call with current status
    callback(this.isConnected);
    return () => {
      const index = this.connectionCallbacks.indexOf(callback);
      if (index > -1) {
        this.connectionCallbacks.splice(index, 1);
      }
    };
  }

  public onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      const index = this.errorCallbacks.indexOf(callback);
      if (index > -1) {
        this.errorCallbacks.splice(index, 1);
      }
    };
  }

  // Send test notification (development only)
  public sendTestNotification(data: Partial<NotificationEvent>): void {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected');
      return;
    }

    this.socket.emit('test-notification', {
      type: 'test',
      title: 'Test Notification',
      message: 'This is a test notification',
      priority: 'normal',
      ...data
    });
  }

  // Join specific rooms for targeted notifications
  public joinRoom(roomId: string): void {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected');
      return;
    }

    this.socket.emit('join-room', roomId);
    console.log('Joined room:', roomId);
  }

  public leaveRoom(roomId: string): void {
    if (!this.socket?.connected) {
      console.warn('WebSocket not connected');
      return;
    }

    this.socket.emit('leave-room', roomId);
    console.log('Left room:', roomId);
  }

  // Getters
  public get connected(): boolean {
    return this.isConnected;
  }

  public get socketId(): string | undefined {
    return this.socket?.id;
  }

  // Private methods
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected, ID:', this.socket?.id);
      this.isConnected = true;
      this.notifyConnectionChange(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnected = false;
      this.notifyConnectionChange(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.notifyError(`Connection error: ${error.message}`);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('WebSocket reconnected after', attemptNumber, 'attempts');
      this.isConnected = true;
      this.notifyConnectionChange(true);
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('WebSocket reconnection error:', error);
      this.notifyError(`Reconnection error: ${error.message}`);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed');
      this.notifyError('Failed to reconnect after maximum attempts');
    });

    // Notification events
    this.socket.on('notification', (data: NotificationEvent) => {
      console.log('Received notification:', data);
      this.notifyNotification(data);
    });

    // System events
    this.socket.on('system-message', (data: { type: string; message: string }) => {
      console.log('System message:', data);
      if (data.type === 'error') {
        this.notifyError(data.message);
      }
    });

    // Authentication events
    this.socket.on('auth-error', (error) => {
      console.error('Authentication error:', error);
      this.notifyError(`Authentication failed: ${error}`);
    });

    // Room events
    this.socket.on('room-joined', (roomId: string) => {
      console.log('Successfully joined room:', roomId);
    });

    this.socket.on('room-left', (roomId: string) => {
      console.log('Successfully left room:', roomId);
    });

    this.socket.on('room-error', (error: { room: string; message: string }) => {
      console.error('Room error:', error);
      this.notifyError(`Room error: ${error.message}`);
    });
  }

  private notifyNotification(notification: NotificationEvent): void {
    this.notificationCallbacks.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        console.error('Error in notification callback:', error);
      }
    });
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionCallbacks.forEach(callback => {
      try {
        callback(connected);
      } catch (error) {
        console.error('Error in connection callback:', error);
      }
    });
  }

  private notifyError(error: string): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (error) {
        console.error('Error in error callback:', error);
      }
    });
  }
}

// Singleton instance for application-wide use
let webSocketClient: WebSocketClient | null = null;

export function createWebSocketClient(config: WebSocketClientConfig): WebSocketClient {
  if (webSocketClient) {
    webSocketClient.disconnect();
  }
  
  webSocketClient = new WebSocketClient(config);
  return webSocketClient;
}

export function getWebSocketClient(): WebSocketClient | null {
  return webSocketClient;
}

export function destroyWebSocketClient(): void {
  if (webSocketClient) {
    webSocketClient.disconnect();
    webSocketClient = null;
  }
}

// React hook for easy integration (if using React)
export function useWebSocket(config?: WebSocketClientConfig) {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!webSocketClient && config) {
      createWebSocketClient(config);
    }

    if (!webSocketClient) {
      console.warn('WebSocket client not initialized');
      return;
    }

    const unsubscribeConnection = webSocketClient.onConnectionChange(setIsConnected);
    
    const unsubscribeNotification = webSocketClient.onNotification((notification) => {
      setNotifications(prev => [notification, ...prev.slice(0, 99)]); // Keep last 100
    });

    const unsubscribeError = webSocketClient.onError((error) => {
      setErrors(prev => [error, ...prev.slice(0, 9)]); // Keep last 10
    });

    // Connect if not already connected
    if (!webSocketClient.connected) {
      webSocketClient.connect();
    }

    return () => {
      unsubscribeConnection();
      unsubscribeNotification();
      unsubscribeError();
    };
  }, [config]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  return {
    isConnected,
    notifications,
    errors,
    client: webSocketClient,
    clearNotifications,
    clearErrors
  };
}

// Add React imports for the hook
import { useState, useEffect, useCallback } from 'react';