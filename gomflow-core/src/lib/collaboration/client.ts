// GOMFLOW Collaboration Client
// Client-side WebSocket integration for real-time collaboration

import { io, Socket } from 'socket.io-client';
import { createClient } from '@supabase/supabase-js';
import {
  CollaborationConfig,
  WebSocketMessage,
  PresenceUpdate,
  OrderEdit,
  LockRequest,
  LockResponse,
  RealtimeEvent,
  RealtimeEventData,
  ChatMessage,
  ActivityFeed,
  PresenceTracking,
  CursorPosition,
  PresenceStatus
} from './types';

interface CollaborationClientOptions {
  websocket_url?: string;
  auth_token: string;
  user_id: string;
  reconnect_attempts?: number;
  heartbeat_interval?: number;
  presence_update_interval?: number;
  cursor_update_throttle?: number;
}

type EventCallback = (data: any) => void;

class CollaborationClient {
  private socket: Socket | null = null;
  private supabase: ReturnType<typeof createClient>;
  private config: CollaborationConfig;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private presenceUpdateTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private cursorUpdateThrottle: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private isConnected: boolean = false;
  private currentWorkspaceId: string | null = null;

  constructor(options: CollaborationClientOptions) {
    this.config = {
      websocket_url: options.websocket_url || 'ws://localhost:3001',
      auth_token: options.auth_token,
      user_id: options.user_id,
      reconnect_attempts: options.reconnect_attempts || 5,
      heartbeat_interval: options.heartbeat_interval || 30000,
      presence_update_interval: options.presence_update_interval || 60000,
      cursor_update_throttle: options.cursor_update_throttle || 100
    };

    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    this.connect();
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  private connect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(this.config.websocket_url, {
      auth: {
        token: this.config.auth_token
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.config.reconnect_attempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Connected to collaboration server');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.emit('connected', { timestamp: new Date().toISOString() });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from collaboration server:', reason);
      this.isConnected = false;
      this.stopHeartbeat();
      this.stopPresenceUpdates();
      this.emit('disconnected', { reason, timestamp: new Date().toISOString() });
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.emit('connection_error', { error: error.message, timestamp: new Date().toISOString() });
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      this.emit('reconnected', { attempts: attemptNumber, timestamp: new Date().toISOString() });
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error);
      this.emit('reconnection_error', { error: error.message, timestamp: new Date().toISOString() });
    });

    // Real-time event handlers
    this.socket.on('presence_update', (data: PresenceUpdate) => {
      this.emit('presence_update', data);
    });

    this.socket.on('order_lock', (data: any) => {
      this.emit('order_lock', data);
    });

    this.socket.on('order_unlock', (data: any) => {
      this.emit('order_unlock', data);
    });

    this.socket.on('order_edit', (data: OrderEdit) => {
      this.emit('order_edit', data);
    });

    this.socket.on('chat_message', (data: ChatMessage) => {
      this.emit('chat_message', data);
    });

    this.socket.on('member_joined', (data: any) => {
      this.emit('member_joined', data);
    });

    this.socket.on('member_left', (data: any) => {
      this.emit('member_left', data);
    });

    this.socket.on('activity_created', (data: ActivityFeed) => {
      this.emit('activity_created', data);
    });

    this.socket.on('typing_indicator', (data: any) => {
      this.emit('typing_indicator', data);
    });

    this.socket.on('workspace_state', (data: any) => {
      this.emit('workspace_state', data);
    });

    this.socket.on('collaboration_error', (error: any) => {
      console.error('Collaboration error:', error);
      this.emit('error', error);
    });

    this.socket.on('heartbeat', (data: any) => {
      // Server heartbeat received
      this.emit('heartbeat', data);
    });

    this.socket.on('order_lock_response', (response: LockResponse) => {
      this.emit('order_lock_response', response);
    });
  }

  // ============================================================================
  // WORKSPACE MANAGEMENT
  // ============================================================================

  async joinWorkspace(workspaceId: string): Promise<void> {
    if (!this.isConnected || !this.socket) {
      throw new Error('Not connected to collaboration server');
    }

    this.currentWorkspaceId = workspaceId;
    this.socket.emit('join_workspace', { workspaceId });
    this.startPresenceUpdates();
  }

  async leaveWorkspace(workspaceId: string): Promise<void> {
    if (!this.isConnected || !this.socket) {
      throw new Error('Not connected to collaboration server');
    }

    this.socket.emit('leave_workspace', { workspaceId });
    this.stopPresenceUpdates();
    this.currentWorkspaceId = null;
  }

  // ============================================================================
  // PRESENCE MANAGEMENT
  // ============================================================================

  updatePresence(
    workspaceId: string,
    status: PresenceStatus,
    currentPage?: string,
    cursorPosition?: CursorPosition
  ): void {
    if (!this.isConnected || !this.socket) {
      return;
    }

    const presenceUpdate: PresenceUpdate = {
      user_id: this.config.user_id,
      workspace_id: workspaceId,
      status,
      current_page: currentPage,
      cursor_position: cursorPosition
    };

    this.socket.emit('presence_update', presenceUpdate);
  }

  updateCursorPosition(workspaceId: string, cursorPosition: CursorPosition): void {
    if (!this.isConnected || !this.socket) {
      return;
    }

    // Throttle cursor updates
    if (this.cursorUpdateThrottle) {
      clearTimeout(this.cursorUpdateThrottle);
    }

    this.cursorUpdateThrottle = setTimeout(() => {
      this.updatePresence(workspaceId, 'online', undefined, cursorPosition);
    }, this.config.cursor_update_throttle);
  }

  private startPresenceUpdates(): void {
    if (this.presenceUpdateTimer) {
      clearInterval(this.presenceUpdateTimer);
    }

    this.presenceUpdateTimer = setInterval(() => {
      if (this.currentWorkspaceId) {
        this.updatePresence(this.currentWorkspaceId, 'online');
      }
    }, this.config.presence_update_interval);
  }

  private stopPresenceUpdates(): void {
    if (this.presenceUpdateTimer) {
      clearInterval(this.presenceUpdateTimer);
      this.presenceUpdateTimer = null;
    }
  }

  // ============================================================================
  // ORDER COLLABORATION
  // ============================================================================

  requestOrderLock(orderId: string, workspaceId: string, lockDuration?: number): void {
    if (!this.isConnected || !this.socket) {
      throw new Error('Not connected to collaboration server');
    }

    const lockRequest: LockRequest = {
      order_id: orderId,
      workspace_id: workspaceId,
      user_id: this.config.user_id,
      lock_duration: lockDuration
    };

    this.socket.emit('request_order_lock', lockRequest);
  }

  releaseOrderLock(orderId: string, workspaceId: string): void {
    if (!this.isConnected || !this.socket) {
      throw new Error('Not connected to collaboration server');
    }

    this.socket.emit('release_order_lock', { orderId, workspaceId });
  }

  sendOrderEdit(edit: OrderEdit): void {
    if (!this.isConnected || !this.socket) {
      throw new Error('Not connected to collaboration server');
    }

    this.socket.emit('order_edit', edit);
  }

  // ============================================================================
  // CHAT FEATURES
  // ============================================================================

  sendChatMessage(
    workspaceId: string,
    content: string,
    messageType?: string,
    threadId?: string,
    parentMessageId?: string
  ): void {
    if (!this.isConnected || !this.socket) {
      throw new Error('Not connected to collaboration server');
    }

    this.socket.emit('chat_message', {
      workspaceId,
      content,
      messageType,
      threadId,
      parentMessageId
    });
  }

  startTyping(workspaceId: string, channelId?: string): void {
    if (!this.isConnected || !this.socket) {
      return;
    }

    this.socket.emit('typing_start', { workspaceId, channelId });
  }

  stopTyping(workspaceId: string, channelId?: string): void {
    if (!this.isConnected || !this.socket) {
      return;
    }

    this.socket.emit('typing_stop', { workspaceId, channelId });
  }

  // ============================================================================
  // EVENT MANAGEMENT
  // ============================================================================

  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback?: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      return;
    }

    if (callback) {
      const callbacks = this.eventListeners.get(event)!;
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    } else {
      this.eventListeners.delete(event);
    }
  }

  private emit(event: string, data: any): void {
    const callbacks = this.eventListeners.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in event callback:', error);
      }
    });
  }

  // ============================================================================
  // SUPABASE INTEGRATION
  // ============================================================================

  subscribeToWorkspaceChanges(
    workspaceId: string,
    onOrderUpdate: (order: any) => void,
    onSubmissionUpdate: (submission: any) => void
  ): () => void {
    const orderSubscription = this.supabase
      .channel(`workspace-orders:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `id=in.(select order_id from collaborative_orders where workspace_id = '${workspaceId}')`
        },
        (payload) => {
          onOrderUpdate(payload.new);
        }
      )
      .subscribe();

    const submissionSubscription = this.supabase
      .channel(`workspace-submissions:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submissions',
          filter: `order_id=in.(select order_id from collaborative_orders where workspace_id = '${workspaceId}')`
        },
        (payload) => {
          onSubmissionUpdate(payload.new);
        }
      )
      .subscribe();

    return () => {
      orderSubscription.unsubscribe();
      submissionSubscription.unsubscribe();
    };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected && this.socket) {
        // Send heartbeat ping
        this.socket.emit('ping', { timestamp: new Date().toISOString() });
      }
    }, this.config.heartbeat_interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  isConnectedToServer(): boolean {
    return this.isConnected && this.socket?.connected === true;
  }

  getCurrentWorkspaceId(): string | null {
    return this.currentWorkspaceId;
  }

  getConnectionStatus(): {
    connected: boolean;
    workspace_id: string | null;
    reconnect_attempts: number;
  } {
    return {
      connected: this.isConnected,
      workspace_id: this.currentWorkspaceId,
      reconnect_attempts: this.reconnectAttempts
    };
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.stopHeartbeat();
    this.stopPresenceUpdates();
    
    if (this.cursorUpdateThrottle) {
      clearTimeout(this.cursorUpdateThrottle);
    }

    this.eventListeners.clear();
    this.isConnected = false;
    this.currentWorkspaceId = null;
  }

  destroy(): void {
    this.disconnect();
  }
}

export default CollaborationClient;

// Export a factory function for easier usage
export const createCollaborationClient = (options: CollaborationClientOptions) => {
  return new CollaborationClient(options);
};

// Export React hook for easier integration
export const useCollaborationClient = (options: CollaborationClientOptions) => {
  const client = new CollaborationClient(options);
  
  // Cleanup on unmount
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      client.destroy();
    });
  }

  return client;
};