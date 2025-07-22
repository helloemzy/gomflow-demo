// GOMFLOW WebSocket Server
// Real-time collaboration server for workspace communication

import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import {
  WebSocketMessage,
  PresenceUpdate,
  OrderEdit,
  LockRequest,
  LockResponse,
  RealtimeEvent,
  RealtimeEventData,
  CollaborationError,
  WorkspaceRole,
  PresenceStatus
} from './types';

interface AuthenticatedSocket extends Socket {
  userId: string;
  workspaceId?: string;
  userRole?: WorkspaceRole;
}

interface Socket {
  id: string;
  userId: string;
  emit: (event: string, data: any) => void;
  join: (room: string) => void;
  leave: (room: string) => void;
  disconnect: () => void;
  on: (event: string, callback: (data: any) => void) => void;
  handshake: {
    auth: {
      token?: string;
    };
  };
}

class CollaborationWebSocketServer {
  private io: SocketServer;
  private redis: Redis;
  private supabase: ReturnType<typeof createClient>;
  private connectedUsers: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds
  private userWorkspaces: Map<string, Set<string>> = new Map(); // userId -> Set of workspaceIds
  private workspaceMembers: Map<string, Set<string>> = new Map(); // workspaceId -> Set of userIds
  private orderLocks: Map<string, { userId: string; expiresAt: Date }> = new Map(); // orderId -> lock info
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: HttpServer) {
    this.io = new SocketServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryDelayOnFailover: 100,
      lazyConnect: true
    });

    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.setupAuthentication();
    this.setupEventHandlers();
    this.startHeartbeat();
  }

  private setupAuthentication() {
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          throw new Error('Authentication token required');
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
        
        // Verify user exists in database
        const { data: user, error } = await this.supabase
          .from('users')
          .select('id, email, name, username')
          .eq('id', decoded.userId)
          .single();

        if (error || !user) {
          throw new Error('Invalid user');
        }

        // Add user info to socket
        socket.userId = user.id;
        socket.user = user;
        
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.userId} connected with socket ${socket.id}`);

      // Track connection
      this.trackConnection(socket.userId, socket.id);

      // Handle workspace joining
      socket.on('join_workspace', async (data: { workspaceId: string }) => {
        try {
          await this.handleJoinWorkspace(socket, data.workspaceId);
        } catch (error) {
          this.emitError(socket, 'JOIN_WORKSPACE_ERROR', error.message);
        }
      });

      // Handle workspace leaving
      socket.on('leave_workspace', async (data: { workspaceId: string }) => {
        try {
          await this.handleLeaveWorkspace(socket, data.workspaceId);
        } catch (error) {
          this.emitError(socket, 'LEAVE_WORKSPACE_ERROR', error.message);
        }
      });

      // Handle presence updates
      socket.on('presence_update', async (data: PresenceUpdate) => {
        try {
          await this.handlePresenceUpdate(socket, data);
        } catch (error) {
          this.emitError(socket, 'PRESENCE_UPDATE_ERROR', error.message);
        }
      });

      // Handle order locking
      socket.on('request_order_lock', async (data: LockRequest) => {
        try {
          const response = await this.handleOrderLock(socket, data);
          socket.emit('order_lock_response', response);
        } catch (error) {
          this.emitError(socket, 'ORDER_LOCK_ERROR', error.message);
        }
      });

      // Handle order unlocking
      socket.on('release_order_lock', async (data: { orderId: string; workspaceId: string }) => {
        try {
          await this.handleOrderUnlock(socket, data);
        } catch (error) {
          this.emitError(socket, 'ORDER_UNLOCK_ERROR', error.message);
        }
      });

      // Handle order edits
      socket.on('order_edit', async (data: OrderEdit) => {
        try {
          await this.handleOrderEdit(socket, data);
        } catch (error) {
          this.emitError(socket, 'ORDER_EDIT_ERROR', error.message);
        }
      });

      // Handle chat messages
      socket.on('chat_message', async (data: {
        workspaceId: string;
        content: string;
        messageType?: string;
        threadId?: string;
        parentMessageId?: string;
      }) => {
        try {
          await this.handleChatMessage(socket, data);
        } catch (error) {
          this.emitError(socket, 'CHAT_MESSAGE_ERROR', error.message);
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data: { workspaceId: string; channelId?: string }) => {
        this.handleTypingIndicator(socket, data, true);
      });

      socket.on('typing_stop', (data: { workspaceId: string; channelId?: string }) => {
        this.handleTypingIndicator(socket, data, false);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });

      // Handle errors
      socket.on('error', (error: Error) => {
        console.error(`Socket error for user ${socket.userId}:`, error);
        this.emitError(socket, 'SOCKET_ERROR', error.message);
      });
    });
  }

  private async handleJoinWorkspace(socket: AuthenticatedSocket, workspaceId: string) {
    // Verify user is member of workspace
    const { data: membership, error } = await this.supabase
      .from('workspace_members')
      .select('role, status, permissions')
      .eq('user_id', socket.userId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .single();

    if (error || !membership) {
      throw new Error('Access denied: Not a member of this workspace');
    }

    // Join workspace room
    socket.join(`workspace:${workspaceId}`);
    socket.workspaceId = workspaceId;
    socket.userRole = membership.role;

    // Track workspace membership
    this.trackWorkspaceMembership(socket.userId, workspaceId);

    // Update presence
    await this.updatePresence(socket.userId, workspaceId, 'online');

    // Broadcast user joined
    this.broadcastToWorkspace(workspaceId, 'member_joined', {
      userId: socket.userId,
      workspaceId: workspaceId,
      timestamp: new Date().toISOString()
    }, socket.userId);

    // Send current workspace state
    await this.sendWorkspaceState(socket, workspaceId);
  }

  private async handleLeaveWorkspace(socket: AuthenticatedSocket, workspaceId: string) {
    // Leave workspace room
    socket.leave(`workspace:${workspaceId}`);
    
    // Update tracking
    this.removeWorkspaceMembership(socket.userId, workspaceId);

    // Update presence
    await this.updatePresence(socket.userId, workspaceId, 'offline');

    // Broadcast user left
    this.broadcastToWorkspace(workspaceId, 'member_left', {
      userId: socket.userId,
      workspaceId: workspaceId,
      timestamp: new Date().toISOString()
    }, socket.userId);

    // Release any order locks
    await this.releaseUserOrderLocks(socket.userId, workspaceId);
  }

  private async handlePresenceUpdate(socket: AuthenticatedSocket, data: PresenceUpdate) {
    const { workspace_id, status, current_page, cursor_position } = data;

    // Update presence in database
    await this.updatePresence(socket.userId, workspace_id, status, current_page, cursor_position);

    // Broadcast presence update
    this.broadcastToWorkspace(workspace_id, 'presence_update', {
      userId: socket.userId,
      workspaceId: workspace_id,
      status,
      current_page,
      cursor_position,
      timestamp: new Date().toISOString()
    }, socket.userId);
  }

  private async handleOrderLock(socket: AuthenticatedSocket, data: LockRequest): Promise<LockResponse> {
    const { order_id, workspace_id, lock_duration = 5 } = data;

    // Check if order is already locked
    const existingLock = this.orderLocks.get(order_id);
    if (existingLock && existingLock.expiresAt > new Date()) {
      if (existingLock.userId === socket.userId) {
        // Extend lock
        const newExpiry = new Date(Date.now() + lock_duration * 60000);
        this.orderLocks.set(order_id, { userId: socket.userId, expiresAt: newExpiry });
        return {
          success: true,
          locked_by: socket.userId,
          locked_until: newExpiry.toISOString(),
          message: 'Lock extended'
        };
      } else {
        return {
          success: false,
          locked_by: existingLock.userId,
          locked_until: existingLock.expiresAt.toISOString(),
          message: 'Order is already locked by another user'
        };
      }
    }

    // Create new lock
    const expiresAt = new Date(Date.now() + lock_duration * 60000);
    this.orderLocks.set(order_id, { userId: socket.userId, expiresAt });

    // Update database
    await this.supabase
      .from('collaborative_orders')
      .update({
        edit_lock_user_id: socket.userId,
        edit_lock_expires_at: expiresAt.toISOString()
      })
      .eq('order_id', order_id)
      .eq('workspace_id', workspace_id);

    // Broadcast lock event
    this.broadcastToWorkspace(workspace_id, 'order_lock', {
      orderId: order_id,
      userId: socket.userId,
      expiresAt: expiresAt.toISOString(),
      timestamp: new Date().toISOString()
    }, socket.userId);

    return {
      success: true,
      locked_by: socket.userId,
      locked_until: expiresAt.toISOString(),
      message: 'Order locked successfully'
    };
  }

  private async handleOrderUnlock(socket: AuthenticatedSocket, data: { orderId: string; workspaceId: string }) {
    const { orderId, workspaceId } = data;

    // Remove lock
    this.orderLocks.delete(orderId);

    // Update database
    await this.supabase
      .from('collaborative_orders')
      .update({
        edit_lock_user_id: null,
        edit_lock_expires_at: null
      })
      .eq('order_id', orderId)
      .eq('workspace_id', workspaceId);

    // Broadcast unlock event
    this.broadcastToWorkspace(workspaceId, 'order_unlock', {
      orderId,
      userId: socket.userId,
      timestamp: new Date().toISOString()
    }, socket.userId);
  }

  private async handleOrderEdit(socket: AuthenticatedSocket, data: OrderEdit) {
    const { order_id, workspace_id, field_path, old_value, new_value, version } = data;

    // Create operational transform
    const { data: transform, error } = await this.supabase
      .from('operational_transforms')
      .insert({
        order_id,
        user_id: socket.userId,
        workspace_id,
        operation_type: 'replace',
        field_path,
        old_value,
        new_value,
        version,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error('Failed to create operational transform');
    }

    // Apply transform
    const applied = await this.supabase.rpc('apply_operational_transform', {
      transform_id: transform.id
    });

    if (applied) {
      // Broadcast edit to workspace
      this.broadcastToWorkspace(workspace_id, 'order_edit', {
        orderId: order_id,
        userId: socket.userId,
        fieldPath: field_path,
        oldValue: old_value,
        newValue: new_value,
        version: version + 1,
        timestamp: new Date().toISOString()
      }, socket.userId);
    }
  }

  private async handleChatMessage(socket: AuthenticatedSocket, data: {
    workspaceId: string;
    content: string;
    messageType?: string;
    threadId?: string;
    parentMessageId?: string;
  }) {
    const { workspaceId, content, messageType = 'text', threadId, parentMessageId } = data;

    // Create message in database
    const { data: message, error } = await this.supabase
      .from('chat_messages')
      .insert({
        workspace_id: workspaceId,
        user_id: socket.userId,
        thread_id: threadId,
        parent_message_id: parentMessageId,
        message_type: messageType,
        content
      })
      .select(`
        *,
        user:users(id, name, username, email)
      `)
      .single();

    if (error) {
      throw new Error('Failed to create chat message');
    }

    // Broadcast message to workspace
    this.broadcastToWorkspace(workspaceId, 'chat_message', {
      ...message,
      timestamp: new Date().toISOString()
    });
  }

  private handleTypingIndicator(socket: AuthenticatedSocket, data: { workspaceId: string; channelId?: string }, isTyping: boolean) {
    const { workspaceId, channelId } = data;
    
    this.broadcastToWorkspace(workspaceId, 'typing_indicator', {
      userId: socket.userId,
      workspaceId,
      channelId,
      isTyping,
      timestamp: new Date().toISOString()
    }, socket.userId);
  }

  private async handleDisconnection(socket: AuthenticatedSocket) {
    console.log(`User ${socket.userId} disconnected`);

    // Remove from tracking
    this.removeConnection(socket.userId, socket.id);

    // Update presence to offline for all workspaces
    const userWorkspaces = this.userWorkspaces.get(socket.userId) || new Set();
    for (const workspaceId of userWorkspaces) {
      await this.updatePresence(socket.userId, workspaceId, 'offline');
      
      // Broadcast user left
      this.broadcastToWorkspace(workspaceId, 'member_left', {
        userId: socket.userId,
        workspaceId: workspaceId,
        timestamp: new Date().toISOString()
      }, socket.userId);
    }

    // Release all user's order locks
    await this.releaseAllUserOrderLocks(socket.userId);
  }

  private trackConnection(userId: string, socketId: string) {
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId)!.add(socketId);
  }

  private removeConnection(userId: string, socketId: string) {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
        this.userWorkspaces.delete(userId);
      }
    }
  }

  private trackWorkspaceMembership(userId: string, workspaceId: string) {
    if (!this.userWorkspaces.has(userId)) {
      this.userWorkspaces.set(userId, new Set());
    }
    this.userWorkspaces.get(userId)!.add(workspaceId);

    if (!this.workspaceMembers.has(workspaceId)) {
      this.workspaceMembers.set(workspaceId, new Set());
    }
    this.workspaceMembers.get(workspaceId)!.add(userId);
  }

  private removeWorkspaceMembership(userId: string, workspaceId: string) {
    const userWorkspaces = this.userWorkspaces.get(userId);
    if (userWorkspaces) {
      userWorkspaces.delete(workspaceId);
    }

    const workspaceMembers = this.workspaceMembers.get(workspaceId);
    if (workspaceMembers) {
      workspaceMembers.delete(userId);
    }
  }

  private async updatePresence(
    userId: string,
    workspaceId: string,
    status: PresenceStatus,
    currentPage?: string,
    cursorPosition?: any
  ) {
    await this.supabase.rpc('update_user_presence', {
      user_uuid: userId,
      workspace_uuid: workspaceId,
      status,
      current_page: currentPage,
      cursor_position: cursorPosition
    });
  }

  private async sendWorkspaceState(socket: AuthenticatedSocket, workspaceId: string) {
    // Get workspace members with presence
    const { data: members } = await this.supabase
      .from('member_presence')
      .select('*')
      .eq('workspace_id', workspaceId);

    // Get recent activity
    const { data: activities } = await this.supabase
      .from('activity_feed')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get order locks
    const { data: orderLocks } = await this.supabase
      .from('collaborative_orders')
      .select('order_id, edit_lock_user_id, edit_lock_expires_at')
      .eq('workspace_id', workspaceId)
      .not('edit_lock_user_id', 'is', null);

    socket.emit('workspace_state', {
      workspaceId,
      members,
      activities,
      orderLocks,
      timestamp: new Date().toISOString()
    });
  }

  private broadcastToWorkspace(workspaceId: string, event: string, data: any, excludeUserId?: string) {
    const room = `workspace:${workspaceId}`;
    
    if (excludeUserId) {
      // Get sockets for the excluded user
      const userSockets = this.connectedUsers.get(excludeUserId) || new Set();
      
      // Broadcast to all sockets in the room except the excluded user's sockets
      this.io.to(room).except(Array.from(userSockets)).emit(event, data);
    } else {
      this.io.to(room).emit(event, data);
    }
  }

  private async releaseUserOrderLocks(userId: string, workspaceId: string) {
    // Remove locks from memory
    for (const [orderId, lockInfo] of this.orderLocks.entries()) {
      if (lockInfo.userId === userId) {
        this.orderLocks.delete(orderId);
      }
    }

    // Remove locks from database
    await this.supabase
      .from('collaborative_orders')
      .update({
        edit_lock_user_id: null,
        edit_lock_expires_at: null
      })
      .eq('edit_lock_user_id', userId)
      .eq('workspace_id', workspaceId);
  }

  private async releaseAllUserOrderLocks(userId: string) {
    // Remove locks from memory
    for (const [orderId, lockInfo] of this.orderLocks.entries()) {
      if (lockInfo.userId === userId) {
        this.orderLocks.delete(orderId);
      }
    }

    // Remove locks from database
    await this.supabase
      .from('collaborative_orders')
      .update({
        edit_lock_user_id: null,
        edit_lock_expires_at: null
      })
      .eq('edit_lock_user_id', userId);
  }

  private emitError(socket: AuthenticatedSocket, code: string, message: string) {
    const error: CollaborationError = {
      code,
      message,
      timestamp: new Date().toISOString()
    };

    socket.emit('collaboration_error', error);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      // Clean up expired locks
      const now = new Date();
      for (const [orderId, lockInfo] of this.orderLocks.entries()) {
        if (lockInfo.expiresAt <= now) {
          this.orderLocks.delete(orderId);
          
          // Update database
          await this.supabase
            .from('collaborative_orders')
            .update({
              edit_lock_user_id: null,
              edit_lock_expires_at: null
            })
            .eq('order_id', orderId);
        }
      }

      // Send heartbeat to all connected clients
      this.io.emit('heartbeat', { timestamp: now.toISOString() });
    }, 30000); // 30 seconds
  }

  public getConnectedUsers(): Map<string, Set<string>> {
    return this.connectedUsers;
  }

  public getWorkspaceMembers(workspaceId: string): Set<string> {
    return this.workspaceMembers.get(workspaceId) || new Set();
  }

  public async shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    await this.redis.quit();
    this.io.close();
  }
}

export default CollaborationWebSocketServer;