// GOMFLOW Collaboration Hook
// React hook for real-time collaboration features

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import CollaborationClient from '@/lib/collaboration/client';
import {
  Workspace,
  WorkspaceMember,
  CollaborativeOrder,
  PresenceTracking,
  ActivityFeed,
  ChatMessage,
  PresenceStatus,
  CursorPosition,
  OrderEdit,
  LockResponse,
  WorkspaceRole,
  ApiResponse,
  PaginatedResponse
} from '@/lib/collaboration/types';

export interface UseCollaborationOptions {
  workspaceId?: string;
  userId: string;
  authToken: string;
  autoConnect?: boolean;
  websocketUrl?: string;
}

export interface CollaborationState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  
  // Workspace state
  currentWorkspace: Workspace | null;
  workspaceMembers: WorkspaceMember[];
  userRole: WorkspaceRole | null;
  
  // Presence state
  presenceData: PresenceTracking[];
  onlineMembers: WorkspaceMember[];
  currentUserPresence: PresenceTracking | null;
  
  // Orders state
  collaborativeOrders: CollaborativeOrder[];
  lockedOrders: Map<string, { userId: string; expiresAt: string }>;
  
  // Chat state
  chatMessages: ChatMessage[];
  unreadCount: number;
  typingUsers: Set<string>;
  
  // Activity state
  activityFeed: ActivityFeed[];
  unreadActivity: number;
  
  // UI state
  isLoading: boolean;
  error: string | null;
}

export interface CollaborationActions {
  // Connection management
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;
  
  // Workspace management
  joinWorkspace: (workspaceId: string) => Promise<void>;
  leaveWorkspace: () => Promise<void>;
  loadWorkspaceData: (workspaceId: string) => Promise<void>;
  
  // Presence management
  updatePresence: (status: PresenceStatus, currentPage?: string, cursorPosition?: CursorPosition) => void;
  updateCursorPosition: (cursorPosition: CursorPosition) => void;
  
  // Order collaboration
  requestOrderLock: (orderId: string, lockDuration?: number) => Promise<boolean>;
  releaseOrderLock: (orderId: string) => void;
  sendOrderEdit: (edit: OrderEdit) => void;
  
  // Chat features
  sendMessage: (content: string, messageType?: string, threadId?: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
  markMessagesAsRead: (messageIds: string[]) => void;
  
  // Activity management
  markActivityAsRead: (activityIds: string[]) => void;
  
  // Utility functions
  getMemberByUserId: (userId: string) => WorkspaceMember | null;
  getOrderLockStatus: (orderId: string) => { isLocked: boolean; lockedBy?: string; expiresAt?: string };
  canEditOrder: (orderId: string) => boolean;
  hasPermission: (permission: string) => boolean;
}

export interface UseCollaborationReturn {
  state: CollaborationState;
  actions: CollaborationActions;
  client: CollaborationClient | null;
}

export const useCollaboration = (options: UseCollaborationOptions): UseCollaborationReturn => {
  const router = useRouter();
  const clientRef = useRef<CollaborationClient | null>(null);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // State management
  const [state, setState] = useState<CollaborationState>({
    isConnected: false,
    isConnecting: false,
    connectionError: null,
    currentWorkspace: null,
    workspaceMembers: [],
    userRole: null,
    presenceData: [],
    onlineMembers: [],
    currentUserPresence: null,
    collaborativeOrders: [],
    lockedOrders: new Map(),
    chatMessages: [],
    unreadCount: 0,
    typingUsers: new Set(),
    activityFeed: [],
    unreadActivity: 0,
    isLoading: false,
    error: null
  });

  // Update state helper
  const updateState = useCallback((updates: Partial<CollaborationState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Initialize collaboration client
  const initializeClient = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.destroy();
    }

    clientRef.current = new CollaborationClient({
      auth_token: options.authToken,
      user_id: options.userId,
      websocket_url: options.websocketUrl,
      reconnect_attempts: 5,
      heartbeat_interval: 30000,
      presence_update_interval: 60000,
      cursor_update_throttle: 100
    });

    setupEventListeners();
    return clientRef.current;
  }, [options.authToken, options.userId, options.websocketUrl]);

  // Setup event listeners
  const setupEventListeners = useCallback(() => {
    if (!clientRef.current) return;

    const client = clientRef.current;

    // Connection events
    client.on('connected', () => {
      updateState({ isConnected: true, isConnecting: false, connectionError: null });
    });

    client.on('disconnected', () => {
      updateState({ isConnected: false, isConnecting: false });
    });

    client.on('connection_error', (data: { error: string }) => {
      updateState({ 
        isConnected: false, 
        isConnecting: false, 
        connectionError: data.error 
      });
    });

    client.on('reconnected', () => {
      updateState({ isConnected: true, connectionError: null });
    });

    // Presence events
    client.on('presence_update', (data: PresenceTracking) => {
      setState(prev => {
        const newPresenceData = prev.presenceData.filter(p => p.user_id !== data.user_id);
        newPresenceData.push(data);
        
        const onlineMembers = prev.workspaceMembers.filter(member => 
          newPresenceData.some(p => p.user_id === member.user_id && p.status === 'online')
        );

        return {
          ...prev,
          presenceData: newPresenceData,
          onlineMembers,
          currentUserPresence: data.user_id === options.userId ? data : prev.currentUserPresence
        };
      });
    });

    // Order collaboration events
    client.on('order_lock', (data: { orderId: string; userId: string; expiresAt: string }) => {
      setState(prev => {
        const newLockedOrders = new Map(prev.lockedOrders);
        newLockedOrders.set(data.orderId, { userId: data.userId, expiresAt: data.expiresAt });
        return { ...prev, lockedOrders: newLockedOrders };
      });
    });

    client.on('order_unlock', (data: { orderId: string }) => {
      setState(prev => {
        const newLockedOrders = new Map(prev.lockedOrders);
        newLockedOrders.delete(data.orderId);
        return { ...prev, lockedOrders: newLockedOrders };
      });
    });

    client.on('order_edit', (data: OrderEdit) => {
      // Handle real-time order edits
      setState(prev => {
        const updatedOrders = prev.collaborativeOrders.map(order => {
          if (order.order_id === data.order_id) {
            return {
              ...order,
              last_edited_by: data.user_id,
              last_edited_at: data.timestamp,
              version: data.version
            };
          }
          return order;
        });
        return { ...prev, collaborativeOrders: updatedOrders };
      });
    });

    // Chat events
    client.on('chat_message', (data: ChatMessage) => {
      setState(prev => {
        const newMessages = [...prev.chatMessages, data];
        const unreadCount = data.user_id !== options.userId ? prev.unreadCount + 1 : prev.unreadCount;
        return { ...prev, chatMessages: newMessages, unreadCount };
      });
    });

    client.on('typing_indicator', (data: { userId: string; isTyping: boolean }) => {
      setState(prev => {
        const newTypingUsers = new Set(prev.typingUsers);
        if (data.isTyping) {
          newTypingUsers.add(data.userId);
        } else {
          newTypingUsers.delete(data.userId);
        }
        return { ...prev, typingUsers: newTypingUsers };
      });
    });

    // Activity events
    client.on('activity_created', (data: ActivityFeed) => {
      setState(prev => {
        const newActivityFeed = [data, ...prev.activityFeed];
        const unreadActivity = data.user_id !== options.userId ? prev.unreadActivity + 1 : prev.unreadActivity;
        return { ...prev, activityFeed: newActivityFeed, unreadActivity };
      });
    });

    // Member events
    client.on('member_joined', (data: WorkspaceMember) => {
      setState(prev => {
        const newMembers = [...prev.workspaceMembers, data];
        return { ...prev, workspaceMembers: newMembers };
      });
    });

    client.on('member_left', (data: { userId: string }) => {
      setState(prev => {
        const newMembers = prev.workspaceMembers.filter(m => m.user_id !== data.userId);
        return { ...prev, workspaceMembers: newMembers };
      });
    });

    // Error events
    client.on('error', (error: any) => {
      updateState({ error: error.message || 'An error occurred' });
    });
  }, [options.userId, updateState]);

  // Load workspace data from API
  const loadWorkspaceData = useCallback(async (workspaceId: string) => {
    try {
      updateState({ isLoading: true, error: null });

      // Load workspace details
      const workspaceRes = await fetch(`/api/collaboration/workspaces/${workspaceId}`, {
        headers: { 'Authorization': `Bearer ${options.authToken}` }
      });
      const workspace: ApiResponse<Workspace> = await workspaceRes.json();

      // Load workspace members
      const membersRes = await fetch(`/api/collaboration/workspaces/${workspaceId}/members`, {
        headers: { 'Authorization': `Bearer ${options.authToken}` }
      });
      const members: ApiResponse<WorkspaceMember[]> = await membersRes.json();

      // Load collaborative orders
      const ordersRes = await fetch(`/api/collaboration/workspaces/${workspaceId}/orders`, {
        headers: { 'Authorization': `Bearer ${options.authToken}` }
      });
      const orders: ApiResponse<CollaborativeOrder[]> = await ordersRes.json();

      // Load recent chat messages
      const chatRes = await fetch(`/api/collaboration/workspaces/${workspaceId}/chat?limit=50`, {
        headers: { 'Authorization': `Bearer ${options.authToken}` }
      });
      const chat: ApiResponse<ChatMessage[]> = await chatRes.json();

      // Load activity feed
      const activityRes = await fetch(`/api/collaboration/workspaces/${workspaceId}/activity?limit=100`, {
        headers: { 'Authorization': `Bearer ${options.authToken}` }
      });
      const activity: ApiResponse<ActivityFeed[]> = await activityRes.json();

      // Find user's role
      const userMember = members.data?.find(m => m.user_id === options.userId);
      const userRole = userMember?.role || null;

      updateState({
        currentWorkspace: workspace.data || null,
        workspaceMembers: members.data || [],
        userRole,
        collaborativeOrders: orders.data || [],
        chatMessages: chat.data || [],
        activityFeed: activity.data || [],
        isLoading: false
      });
    } catch (error) {
      console.error('Error loading workspace data:', error);
      updateState({ 
        error: 'Failed to load workspace data', 
        isLoading: false 
      });
    }
  }, [options.authToken, options.userId, updateState]);

  // Actions
  const actions: CollaborationActions = {
    connect: () => {
      if (!clientRef.current) {
        initializeClient();
      }
      updateState({ isConnecting: true });
    },

    disconnect: () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
      updateState({ isConnected: false, isConnecting: false });
    },

    reconnect: () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
        initializeClient();
      }
      updateState({ isConnecting: true });
    },

    joinWorkspace: async (workspaceId: string) => {
      if (!clientRef.current) {
        throw new Error('Client not initialized');
      }
      
      await loadWorkspaceData(workspaceId);
      await clientRef.current.joinWorkspace(workspaceId);
    },

    leaveWorkspace: async () => {
      if (!clientRef.current || !state.currentWorkspace) {
        return;
      }
      
      await clientRef.current.leaveWorkspace(state.currentWorkspace.id);
      updateState({
        currentWorkspace: null,
        workspaceMembers: [],
        userRole: null,
        presenceData: [],
        onlineMembers: [],
        collaborativeOrders: [],
        chatMessages: [],
        activityFeed: []
      });
    },

    loadWorkspaceData,

    updatePresence: (status: PresenceStatus, currentPage?: string, cursorPosition?: CursorPosition) => {
      if (!clientRef.current || !state.currentWorkspace) {
        return;
      }
      clientRef.current.updatePresence(state.currentWorkspace.id, status, currentPage, cursorPosition);
    },

    updateCursorPosition: (cursorPosition: CursorPosition) => {
      if (!clientRef.current || !state.currentWorkspace) {
        return;
      }
      clientRef.current.updateCursorPosition(state.currentWorkspace.id, cursorPosition);
    },

    requestOrderLock: async (orderId: string, lockDuration?: number): Promise<boolean> => {
      if (!clientRef.current || !state.currentWorkspace) {
        return false;
      }

      return new Promise((resolve) => {
        const handleLockResponse = (response: LockResponse) => {
          clientRef.current?.off('order_lock_response', handleLockResponse);
          resolve(response.success);
        };

        clientRef.current.on('order_lock_response', handleLockResponse);
        clientRef.current.requestOrderLock(orderId, state.currentWorkspace.id, lockDuration);
      });
    },

    releaseOrderLock: (orderId: string) => {
      if (!clientRef.current || !state.currentWorkspace) {
        return;
      }
      clientRef.current.releaseOrderLock(orderId, state.currentWorkspace.id);
    },

    sendOrderEdit: (edit: OrderEdit) => {
      if (!clientRef.current) {
        return;
      }
      clientRef.current.sendOrderEdit(edit);
    },

    sendMessage: (content: string, messageType?: string, threadId?: string) => {
      if (!clientRef.current || !state.currentWorkspace) {
        return;
      }
      clientRef.current.sendChatMessage(state.currentWorkspace.id, content, messageType, threadId);
    },

    startTyping: () => {
      if (!clientRef.current || !state.currentWorkspace) {
        return;
      }
      clientRef.current.startTyping(state.currentWorkspace.id);
    },

    stopTyping: () => {
      if (!clientRef.current || !state.currentWorkspace) {
        return;
      }
      clientRef.current.stopTyping(state.currentWorkspace.id);
    },

    markMessagesAsRead: async (messageIds: string[]) => {
      try {
        await fetch(`/api/collaboration/chat/mark-read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.authToken}`
          },
          body: JSON.stringify({ messageIds })
        });
        
        updateState({ unreadCount: Math.max(0, state.unreadCount - messageIds.length) });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    },

    markActivityAsRead: async (activityIds: string[]) => {
      try {
        await fetch(`/api/collaboration/activity/mark-read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.authToken}`
          },
          body: JSON.stringify({ activityIds })
        });
        
        updateState({ unreadActivity: Math.max(0, state.unreadActivity - activityIds.length) });
      } catch (error) {
        console.error('Error marking activity as read:', error);
      }
    },

    getMemberByUserId: (userId: string) => {
      return state.workspaceMembers.find(m => m.user_id === userId) || null;
    },

    getOrderLockStatus: (orderId: string) => {
      const lockInfo = state.lockedOrders.get(orderId);
      return {
        isLocked: !!lockInfo,
        lockedBy: lockInfo?.userId,
        expiresAt: lockInfo?.expiresAt
      };
    },

    canEditOrder: (orderId: string) => {
      const lockStatus = actions.getOrderLockStatus(orderId);
      return !lockStatus.isLocked || lockStatus.lockedBy === options.userId;
    },

    hasPermission: (permission: string) => {
      const userMember = state.workspaceMembers.find(m => m.user_id === options.userId);
      if (!userMember) return false;

      const permissions = userMember.permissions;
      switch (permission) {
        case 'create_orders': return permissions.can_create_orders;
        case 'edit_orders': return permissions.can_edit_orders;
        case 'delete_orders': return permissions.can_delete_orders;
        case 'view_analytics': return permissions.can_view_analytics;
        case 'manage_payments': return permissions.can_manage_payments;
        case 'invite_members': return permissions.can_invite_members;
        case 'chat': return permissions.can_chat;
        default: return false;
      }
    }
  };

  // Initialize client on mount
  useEffect(() => {
    if (options.autoConnect !== false) {
      initializeClient();
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.destroy();
      }
    };
  }, [initializeClient, options.autoConnect]);

  // Auto-join workspace if provided
  useEffect(() => {
    if (options.workspaceId && state.isConnected && !state.currentWorkspace) {
      actions.joinWorkspace(options.workspaceId);
    }
  }, [options.workspaceId, state.isConnected, state.currentWorkspace, actions]);

  return {
    state,
    actions,
    client: clientRef.current
  };
};

export default useCollaboration;