// GOMFLOW Team Communication & Chat
// Real-time chat and communication features for workspaces

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import {
  ChatMessage,
  ChatMessageType,
  ChatAttachment,
  ChatMention,
  User,
  ApiResponse,
  PaginatedResponse
} from './types';

interface ChatMessageData {
  workspace_id: string;
  user_id: string;
  content: string;
  message_type?: ChatMessageType;
  thread_id?: string;
  parent_message_id?: string;
  formatted_content?: Record<string, any>;
  attachments?: ChatAttachment[];
  mentions?: ChatMention[];
}

interface ChatFilter {
  message_types?: ChatMessageType[];
  thread_id?: string;
  user_ids?: string[];
  start_date?: string;
  end_date?: string;
  has_attachments?: boolean;
  search_query?: string;
}

interface ChatStats {
  total_messages: number;
  messages_by_type: Record<ChatMessageType, number>;
  messages_by_user: Record<string, number>;
  active_threads: number;
  attachment_count: number;
  mention_count: number;
}

interface TypingIndicator {
  user_id: string;
  workspace_id: string;
  thread_id?: string;
  is_typing: boolean;
  last_activity: string;
}

class ChatManager {
  private supabase: ReturnType<typeof createClient>;
  private typingIndicators: Map<string, TypingIndicator> = new Map();
  private typingTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly TYPING_TIMEOUT = 3000; // 3 seconds

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  // ============================================================================
  // MESSAGE MANAGEMENT
  // ============================================================================

  async sendMessage(data: ChatMessageData): Promise<ApiResponse<ChatMessage>> {
    try {
      // Validate required fields
      if (!data.workspace_id || !data.user_id || !data.content) {
        return {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'workspace_id, user_id, and content are required'
        };
      }

      // Check if user has permission to chat
      const canChat = await this.checkChatPermission(data.workspace_id, data.user_id);
      if (!canChat) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'You do not have permission to chat in this workspace'
        };
      }

      // Process mentions and formatting
      const processedContent = await this.processMessageContent(data.content, data.workspace_id);
      
      // Create message
      const { data: message, error } = await this.supabase
        .from('chat_messages')
        .insert({
          workspace_id: data.workspace_id,
          user_id: data.user_id,
          content: data.content,
          message_type: data.message_type || 'text',
          thread_id: data.thread_id,
          parent_message_id: data.parent_message_id,
          formatted_content: data.formatted_content || processedContent.formatted_content,
          attachments: data.attachments || [],
          mentions: data.mentions || processedContent.mentions
        })
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .single();

      if (error) {
        return {
          success: false,
          error: 'SEND_MESSAGE_ERROR',
          message: error.message
        };
      }

      // Update thread reply count if this is a reply
      if (data.parent_message_id) {
        await this.updateThreadReplyCount(data.parent_message_id);
      }

      // Send notifications for mentions
      if (processedContent.mentions.length > 0) {
        await this.sendMentionNotifications(message, processedContent.mentions);
      }

      return {
        success: true,
        data: message
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async editMessage(
    messageId: string,
    newContent: string,
    userId: string
  ): Promise<ApiResponse<ChatMessage>> {
    try {
      // Check if user owns the message
      const { data: message, error: fetchError } = await this.supabase
        .from('chat_messages')
        .select('user_id, workspace_id, content')
        .eq('id', messageId)
        .single();

      if (fetchError || !message) {
        return {
          success: false,
          error: 'MESSAGE_NOT_FOUND',
          message: 'Message not found'
        };
      }

      if (message.user_id !== userId) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'You can only edit your own messages'
        };
      }

      // Process new content
      const processedContent = await this.processMessageContent(newContent, message.workspace_id);

      // Update message
      const { data: updatedMessage, error } = await this.supabase
        .from('chat_messages')
        .update({
          content: newContent,
          formatted_content: processedContent.formatted_content,
          mentions: processedContent.mentions,
          is_edited: true,
          edited_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .single();

      if (error) {
        return {
          success: false,
          error: 'EDIT_MESSAGE_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        data: updatedMessage
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async deleteMessage(messageId: string, userId: string): Promise<ApiResponse<void>> {
    try {
      // Check if user owns the message or has admin permission
      const { data: message, error: fetchError } = await this.supabase
        .from('chat_messages')
        .select('user_id, workspace_id')
        .eq('id', messageId)
        .single();

      if (fetchError || !message) {
        return {
          success: false,
          error: 'MESSAGE_NOT_FOUND',
          message: 'Message not found'
        };
      }

      const isOwner = message.user_id === userId;
      const isAdmin = await this.checkAdminPermission(message.workspace_id, userId);

      if (!isOwner && !isAdmin) {
        return {
          success: false,
          error: 'PERMISSION_DENIED',
          message: 'You can only delete your own messages or you need admin privileges'
        };
      }

      // Soft delete message
      const { error } = await this.supabase
        .from('chat_messages')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) {
        return {
          success: false,
          error: 'DELETE_MESSAGE_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        message: 'Message deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  // ============================================================================
  // MESSAGE RETRIEVAL
  // ============================================================================

  async getMessages(
    workspaceId: string,
    userId: string,
    page: number = 1,
    limit: number = 50,
    filter?: ChatFilter
  ): Promise<ApiResponse<PaginatedResponse<ChatMessage>>> {
    try {
      // Check if user has access to workspace
      const hasAccess = await this.checkWorkspaceAccess(workspaceId, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          message: 'You do not have access to this workspace'
        };
      }

      const offset = (page - 1) * limit;
      
      // Build query
      let query = this.supabase
        .from('chat_messages')
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .eq('workspace_id', workspaceId)
        .eq('is_deleted', false);

      // Apply filters
      if (filter) {
        if (filter.message_types && filter.message_types.length > 0) {
          query = query.in('message_type', filter.message_types);
        }
        
        if (filter.thread_id) {
          query = query.eq('thread_id', filter.thread_id);
        }
        
        if (filter.user_ids && filter.user_ids.length > 0) {
          query = query.in('user_id', filter.user_ids);
        }
        
        if (filter.start_date) {
          query = query.gte('created_at', filter.start_date);
        }
        
        if (filter.end_date) {
          query = query.lte('created_at', filter.end_date);
        }
        
        if (filter.has_attachments !== undefined) {
          if (filter.has_attachments) {
            query = query.neq('attachments', '[]');
          } else {
            query = query.eq('attachments', '[]');
          }
        }
        
        if (filter.search_query) {
          query = query.textSearch('content', filter.search_query);
        }
      }

      // Execute query with pagination
      const { data: messages, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return {
          success: false,
          error: 'GET_MESSAGES_ERROR',
          message: error.message
        };
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        data: {
          data: messages || [],
          pagination: {
            page,
            limit,
            total,
            total_pages: totalPages,
            has_next: page < totalPages,
            has_prev: page > 1
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async getThreadMessages(
    threadId: string,
    workspaceId: string,
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<ApiResponse<PaginatedResponse<ChatMessage>>> {
    try {
      // Check if user has access to workspace
      const hasAccess = await this.checkWorkspaceAccess(workspaceId, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          message: 'You do not have access to this workspace'
        };
      }

      const offset = (page - 1) * limit;

      const { data: messages, error, count } = await this.supabase
        .from('chat_messages')
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .eq('workspace_id', workspaceId)
        .eq('thread_id', threadId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        return {
          success: false,
          error: 'GET_THREAD_MESSAGES_ERROR',
          message: error.message
        };
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        data: {
          data: messages || [],
          pagination: {
            page,
            limit,
            total,
            total_pages: totalPages,
            has_next: page < totalPages,
            has_prev: page > 1
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  // ============================================================================
  // REACTIONS
  // ============================================================================

  async addReaction(
    messageId: string,
    emoji: string,
    userId: string
  ): Promise<ApiResponse<ChatMessage>> {
    try {
      // Get current message
      const { data: message, error: fetchError } = await this.supabase
        .from('chat_messages')
        .select('reactions, workspace_id')
        .eq('id', messageId)
        .single();

      if (fetchError || !message) {
        return {
          success: false,
          error: 'MESSAGE_NOT_FOUND',
          message: 'Message not found'
        };
      }

      // Check if user has access to workspace
      const hasAccess = await this.checkWorkspaceAccess(message.workspace_id, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          message: 'You do not have access to this workspace'
        };
      }

      // Update reactions
      const reactions = message.reactions || {};
      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }
      
      // Add user to reaction if not already present
      if (!reactions[emoji].includes(userId)) {
        reactions[emoji].push(userId);
      }

      // Update message
      const { data: updatedMessage, error } = await this.supabase
        .from('chat_messages')
        .update({ reactions })
        .eq('id', messageId)
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .single();

      if (error) {
        return {
          success: false,
          error: 'ADD_REACTION_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        data: updatedMessage
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async removeReaction(
    messageId: string,
    emoji: string,
    userId: string
  ): Promise<ApiResponse<ChatMessage>> {
    try {
      // Get current message
      const { data: message, error: fetchError } = await this.supabase
        .from('chat_messages')
        .select('reactions, workspace_id')
        .eq('id', messageId)
        .single();

      if (fetchError || !message) {
        return {
          success: false,
          error: 'MESSAGE_NOT_FOUND',
          message: 'Message not found'
        };
      }

      // Check if user has access to workspace
      const hasAccess = await this.checkWorkspaceAccess(message.workspace_id, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          message: 'You do not have access to this workspace'
        };
      }

      // Update reactions
      const reactions = message.reactions || {};
      if (reactions[emoji]) {
        reactions[emoji] = reactions[emoji].filter((id: string) => id !== userId);
        
        // Remove emoji if no users left
        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }
      }

      // Update message
      const { data: updatedMessage, error } = await this.supabase
        .from('chat_messages')
        .update({ reactions })
        .eq('id', messageId)
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .single();

      if (error) {
        return {
          success: false,
          error: 'REMOVE_REACTION_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        data: updatedMessage
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  // ============================================================================
  // TYPING INDICATORS
  // ============================================================================

  setTypingIndicator(
    userId: string,
    workspaceId: string,
    isTyping: boolean,
    threadId?: string
  ): void {
    const key = `${userId}:${workspaceId}:${threadId || 'main'}`;
    
    if (isTyping) {
      // Set typing indicator
      this.typingIndicators.set(key, {
        user_id: userId,
        workspace_id: workspaceId,
        thread_id: threadId,
        is_typing: true,
        last_activity: new Date().toISOString()
      });

      // Clear any existing timeout
      const existingTimeout = this.typingTimeouts.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set timeout to automatically clear typing indicator
      const timeout = setTimeout(() => {
        this.typingIndicators.delete(key);
        this.typingTimeouts.delete(key);
      }, this.TYPING_TIMEOUT);

      this.typingTimeouts.set(key, timeout);
    } else {
      // Clear typing indicator
      this.typingIndicators.delete(key);
      const timeout = this.typingTimeouts.get(key);
      if (timeout) {
        clearTimeout(timeout);
        this.typingTimeouts.delete(key);
      }
    }
  }

  getTypingIndicators(workspaceId: string, threadId?: string): TypingIndicator[] {
    const indicators: TypingIndicator[] = [];
    
    for (const [key, indicator] of this.typingIndicators.entries()) {
      if (indicator.workspace_id === workspaceId && indicator.thread_id === threadId) {
        indicators.push(indicator);
      }
    }
    
    return indicators;
  }

  // ============================================================================
  // CHAT ANALYTICS
  // ============================================================================

  async getChatStats(
    workspaceId: string,
    userId: string,
    days: number = 30
  ): Promise<ApiResponse<ChatStats>> {
    try {
      // Check if user has access to workspace
      const hasAccess = await this.checkWorkspaceAccess(workspaceId, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          message: 'You do not have access to this workspace'
        };
      }

      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      // Get messages for the period
      const { data: messages, error } = await this.supabase
        .from('chat_messages')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_deleted', false)
        .gte('created_at', startDate);

      if (error) {
        return {
          success: false,
          error: 'GET_CHAT_STATS_ERROR',
          message: error.message
        };
      }

      const stats = this.calculateChatStats(messages || []);

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  // ============================================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================================

  subscribeToWorkspaceChat(
    workspaceId: string,
    onMessageUpdate: (message: ChatMessage) => void
  ): () => void {
    const subscription = this.supabase
      .channel(`chat:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          onMessageUpdate(payload.new as ChatMessage);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  subscribeToThreadChat(
    threadId: string,
    onMessageUpdate: (message: ChatMessage) => void
  ): () => void {
    const subscription = this.supabase
      .channel(`thread:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`
        },
        (payload) => {
          onMessageUpdate(payload.new as ChatMessage);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private async processMessageContent(
    content: string,
    workspaceId: string
  ): Promise<{ formatted_content: any; mentions: ChatMention[] }> {
    const mentions: ChatMention[] = [];
    let formatted_content = { text: content };

    // Process @mentions
    const mentionRegex = /@(\w+)/g;
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      const username = match[1];
      
      // Find user in workspace
      const { data: user } = await this.supabase
        .from('workspace_members')
        .select('user:users(id, name, username)')
        .eq('workspace_id', workspaceId)
        .eq('users.username', username)
        .eq('status', 'active')
        .single();

      if (user?.user) {
        mentions.push({
          id: user.user.id,
          type: 'user',
          name: user.user.name,
          position: match.index,
          length: match[0].length
        });
      }
    }

    // Process order mentions like #ORDER-123
    const orderMentionRegex = /#ORDER-(\w+)/g;
    while ((match = orderMentionRegex.exec(content)) !== null) {
      const orderSlug = match[1];
      
      // Find order in workspace
      const { data: order } = await this.supabase
        .from('collaborative_orders')
        .select('order:orders(id, title, slug)')
        .eq('workspace_id', workspaceId)
        .eq('orders.slug', orderSlug)
        .single();

      if (order?.order) {
        mentions.push({
          id: order.order.id,
          type: 'order',
          name: order.order.title,
          position: match.index,
          length: match[0].length
        });
      }
    }

    return { formatted_content, mentions };
  }

  private async updateThreadReplyCount(parentMessageId: string): Promise<void> {
    const { data: replies, error } = await this.supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('parent_message_id', parentMessageId)
      .eq('is_deleted', false);

    if (!error && replies) {
      await this.supabase
        .from('chat_messages')
        .update({ 
          reply_count: replies.length,
          latest_reply: new Date().toISOString()
        })
        .eq('id', parentMessageId);
    }
  }

  private async sendMentionNotifications(
    message: ChatMessage,
    mentions: ChatMention[]
  ): Promise<void> {
    // TODO: Implement notification sending
    // This would integrate with the notification system
  }

  private async checkWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
    const { data: member } = await this.supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    return !!member;
  }

  private async checkChatPermission(workspaceId: string, userId: string): Promise<boolean> {
    const { data: member } = await this.supabase
      .from('workspace_members')
      .select('permissions')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    return member?.permissions?.can_chat || false;
  }

  private async checkAdminPermission(workspaceId: string, userId: string): Promise<boolean> {
    const { data: member } = await this.supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    return member?.role === 'admin' || member?.role === 'owner';
  }

  private calculateChatStats(messages: ChatMessage[]): ChatStats {
    const stats: ChatStats = {
      total_messages: messages.length,
      messages_by_type: {} as Record<ChatMessageType, number>,
      messages_by_user: {},
      active_threads: 0,
      attachment_count: 0,
      mention_count: 0
    };

    // Initialize message type counts
    const messageTypes: ChatMessageType[] = ['text', 'system', 'file', 'order_mention', 'member_mention'];
    messageTypes.forEach(type => {
      stats.messages_by_type[type] = 0;
    });

    const uniqueThreads = new Set<string>();

    messages.forEach(message => {
      // Count by type
      stats.messages_by_type[message.message_type]++;
      
      // Count by user
      stats.messages_by_user[message.user_id] = (stats.messages_by_user[message.user_id] || 0) + 1;
      
      // Count threads
      if (message.thread_id) {
        uniqueThreads.add(message.thread_id);
      }
      
      // Count attachments
      if (message.attachments && message.attachments.length > 0) {
        stats.attachment_count += message.attachments.length;
      }
      
      // Count mentions
      if (message.mentions && message.mentions.length > 0) {
        stats.mention_count += message.mentions.length;
      }
    });

    stats.active_threads = uniqueThreads.size;

    return stats;
  }

  public clearTypingIndicators(): void {
    // Clear all typing indicators
    this.typingIndicators.clear();
    
    // Clear all timeouts
    for (const timeout of this.typingTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.typingTimeouts.clear();
  }
}

export default ChatManager;