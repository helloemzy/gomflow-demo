// GOMFLOW Presence Tracking
// Real-time presence tracking and live cursor positions

import { createClient } from '@supabase/supabase-js';
import {
  PresenceTracking,
  PresenceStatus,
  CursorPosition,
  PresenceUpdate,
  ApiResponse
} from './types';

class PresenceManager {
  private supabase: ReturnType<typeof createClient>;
  private presenceUpdateInterval: NodeJS.Timeout | null = null;
  private cursorUpdateThrottle: Map<string, NodeJS.Timeout> = new Map();
  private localPresence: Map<string, PresenceTracking> = new Map();

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.startPresenceHeartbeat();
  }

  // ============================================================================
  // PRESENCE MANAGEMENT
  // ============================================================================

  async updatePresence(
    userId: string,
    workspaceId: string,
    status: PresenceStatus,
    currentPage?: string,
    cursorPosition?: CursorPosition,
    socketId?: string
  ): Promise<ApiResponse<PresenceTracking>> {
    try {
      const { data: presence, error } = await this.supabase
        .rpc('update_user_presence', {
          user_uuid: userId,
          workspace_uuid: workspaceId,
          status,
          current_page: currentPage,
          cursor_position: cursorPosition,
          socket_id: socketId
        });

      if (error) {
        return {
          success: false,
          error: 'UPDATE_PRESENCE_ERROR',
          message: error.message
        };
      }

      // Update local cache
      const presenceKey = `${userId}:${workspaceId}`;
      this.localPresence.set(presenceKey, {
        id: presence.id,
        user_id: userId,
        workspace_id: workspaceId,
        status,
        current_page: currentPage,
        cursor_position: cursorPosition,
        last_activity: new Date().toISOString(),
        socket_id: socketId,
        created_at: presence.created_at,
        updated_at: new Date().toISOString()
      });

      return {
        success: true,
        data: presence
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async getWorkspacePresence(
    workspaceId: string,
    userId: string
  ): Promise<ApiResponse<PresenceTracking[]>> {
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

      const { data: presence, error } = await this.supabase
        .from('member_presence')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('member_status', 'active')
        .order('last_activity', { ascending: false });

      if (error) {
        return {
          success: false,
          error: 'GET_PRESENCE_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        data: presence || []
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async getUserPresence(
    userId: string,
    workspaceId: string
  ): Promise<ApiResponse<PresenceTracking | null>> {
    try {
      const { data: presence, error } = await this.supabase
        .from('presence_tracking')
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        return {
          success: false,
          error: 'GET_USER_PRESENCE_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        data: presence || null
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async setUserAway(userId: string, workspaceId: string): Promise<ApiResponse<void>> {
    try {
      await this.updatePresence(userId, workspaceId, 'away');
      return {
        success: true,
        message: 'User set to away'
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async setUserOnline(userId: string, workspaceId: string): Promise<ApiResponse<void>> {
    try {
      await this.updatePresence(userId, workspaceId, 'online');
      return {
        success: true,
        message: 'User set to online'
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async setUserOffline(userId: string, workspaceId: string): Promise<ApiResponse<void>> {
    try {
      await this.updatePresence(userId, workspaceId, 'offline');
      
      // Remove from local cache
      const presenceKey = `${userId}:${workspaceId}`;
      this.localPresence.delete(presenceKey);

      return {
        success: true,
        message: 'User set to offline'
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
  // CURSOR TRACKING
  // ============================================================================

  updateCursorPosition(
    userId: string,
    workspaceId: string,
    cursorPosition: CursorPosition,
    throttleMs: number = 100
  ): void {
    const key = `${userId}:${workspaceId}`;
    
    // Clear existing throttle
    const existingThrottle = this.cursorUpdateThrottle.get(key);
    if (existingThrottle) {
      clearTimeout(existingThrottle);
    }

    // Throttle cursor updates
    const throttleTimeout = setTimeout(async () => {
      try {
        await this.updatePresence(userId, workspaceId, 'online', undefined, cursorPosition);
      } catch (error) {
        console.error('Failed to update cursor position:', error);
      }
      
      this.cursorUpdateThrottle.delete(key);
    }, throttleMs);

    this.cursorUpdateThrottle.set(key, throttleTimeout);
  }

  getCursorPosition(userId: string, workspaceId: string): CursorPosition | null {
    const presenceKey = `${userId}:${workspaceId}`;
    const presence = this.localPresence.get(presenceKey);
    return presence?.cursor_position || null;
  }

  // ============================================================================
  // ACTIVITY TRACKING
  // ============================================================================

  async recordActivity(
    userId: string,
    workspaceId: string,
    activity: string,
    page?: string
  ): Promise<ApiResponse<void>> {
    try {
      await this.updatePresence(userId, workspaceId, 'online', page);
      
      // Update last activity time
      const presenceKey = `${userId}:${workspaceId}`;
      const presence = this.localPresence.get(presenceKey);
      if (presence) {
        presence.last_activity = new Date().toISOString();
        this.localPresence.set(presenceKey, presence);
      }

      return {
        success: true,
        message: 'Activity recorded'
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async getActiveUsers(
    workspaceId: string,
    withinMinutes: number = 5
  ): Promise<ApiResponse<PresenceTracking[]>> {
    try {
      const cutoffTime = new Date(Date.now() - withinMinutes * 60000).toISOString();

      const { data: activeUsers, error } = await this.supabase
        .from('member_presence')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('member_status', 'active')
        .gte('last_activity', cutoffTime)
        .order('last_activity', { ascending: false });

      if (error) {
        return {
          success: false,
          error: 'GET_ACTIVE_USERS_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        data: activeUsers || []
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async getOnlineUsers(workspaceId: string): Promise<ApiResponse<PresenceTracking[]>> {
    try {
      const { data: onlineUsers, error } = await this.supabase
        .from('member_presence')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('member_status', 'active')
        .eq('presence_status', 'online')
        .order('last_activity', { ascending: false });

      if (error) {
        return {
          success: false,
          error: 'GET_ONLINE_USERS_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        data: onlineUsers || []
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
  // PRESENCE ANALYTICS
  // ============================================================================

  async getPresenceAnalytics(
    workspaceId: string,
    userId: string,
    days: number = 7
  ): Promise<ApiResponse<any>> {
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

      // Get presence analytics
      const { data: analytics, error } = await this.supabase
        .from('presence_tracking')
        .select(`
          user_id,
          status,
          current_page,
          last_activity,
          created_at,
          updated_at,
          user:users(id, name, username)
        `)
        .eq('workspace_id', workspaceId)
        .gte('last_activity', startDate)
        .order('last_activity', { ascending: false });

      if (error) {
        return {
          success: false,
          error: 'GET_PRESENCE_ANALYTICS_ERROR',
          message: error.message
        };
      }

      // Process analytics data
      const processedAnalytics = this.processPresenceAnalytics(analytics || []);

      return {
        success: true,
        data: processedAnalytics
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
  // CLEANUP AND MAINTENANCE
  // ============================================================================

  async cleanupInactivePresence(inactiveHours: number = 24): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - inactiveHours * 60 * 60 * 1000).toISOString();

      // Update inactive presence to offline
      await this.supabase
        .from('presence_tracking')
        .update({ status: 'offline' })
        .lt('last_activity', cutoffTime)
        .neq('status', 'offline');

      // Clear local cache for inactive users
      for (const [key, presence] of this.localPresence.entries()) {
        if (new Date(presence.last_activity) < new Date(cutoffTime)) {
          this.localPresence.delete(key);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup inactive presence:', error);
    }
  }

  // ============================================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================================

  subscribeToWorkspacePresence(
    workspaceId: string,
    onPresenceUpdate: (presence: PresenceTracking) => void
  ): () => void {
    const subscription = this.supabase
      .channel(`presence:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'presence_tracking',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          onPresenceUpdate(payload.new as PresenceTracking);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  subscribeToUserPresence(
    userId: string,
    workspaceId: string,
    onPresenceUpdate: (presence: PresenceTracking) => void
  ): () => void {
    const subscription = this.supabase
      .channel(`user-presence:${userId}:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'presence_tracking',
          filter: `user_id=eq.${userId}&workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          onPresenceUpdate(payload.new as PresenceTracking);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private startPresenceHeartbeat(): void {
    this.presenceUpdateInterval = setInterval(async () => {
      // Update all active local presence
      for (const [key, presence] of this.localPresence.entries()) {
        if (presence.status === 'online') {
          try {
            await this.updatePresence(
              presence.user_id,
              presence.workspace_id,
              'online',
              presence.current_page,
              presence.cursor_position
            );
          } catch (error) {
            console.error('Failed to update presence heartbeat:', error);
          }
        }
      }

      // Cleanup inactive presence
      await this.cleanupInactivePresence();
    }, 30000); // 30 seconds
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

  private processPresenceAnalytics(data: any[]): any {
    const userStats = new Map();
    const pageStats = new Map();
    const timeStats = new Map();

    data.forEach(record => {
      const userId = record.user_id;
      const page = record.current_page;
      const hour = new Date(record.last_activity).getHours();

      // User stats
      if (!userStats.has(userId)) {
        userStats.set(userId, {
          user: record.user,
          total_time: 0,
          pages_visited: new Set(),
          last_seen: record.last_activity
        });
      }

      const userStat = userStats.get(userId);
      userStat.total_time += 1; // Simplified time calculation
      if (page) userStat.pages_visited.add(page);
      if (new Date(record.last_activity) > new Date(userStat.last_seen)) {
        userStat.last_seen = record.last_activity;
      }

      // Page stats
      if (page) {
        pageStats.set(page, (pageStats.get(page) || 0) + 1);
      }

      // Time stats
      timeStats.set(hour, (timeStats.get(hour) || 0) + 1);
    });

    return {
      user_stats: Array.from(userStats.values()).map(stat => ({
        ...stat,
        pages_visited: Array.from(stat.pages_visited)
      })),
      page_stats: Object.fromEntries(pageStats),
      time_stats: Object.fromEntries(timeStats)
    };
  }

  public destroy(): void {
    if (this.presenceUpdateInterval) {
      clearInterval(this.presenceUpdateInterval);
    }

    // Clear all throttles
    for (const timeout of this.cursorUpdateThrottle.values()) {
      clearTimeout(timeout);
    }
    this.cursorUpdateThrottle.clear();
    
    // Clear local cache
    this.localPresence.clear();
  }
}

export default PresenceManager;