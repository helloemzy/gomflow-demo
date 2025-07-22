// GOMFLOW Activity Logging & Feed System
// Activity tracking and feed management for workspaces

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import {
  ActivityFeed,
  ActivityType,
  ApiResponse,
  PaginatedResponse,
  User
} from './types';

interface ActivityLogData {
  workspace_id: string;
  user_id: string;
  activity_type: ActivityType;
  entity_type: string;
  entity_id: string;
  metadata?: Record<string, any>;
  description?: string;
}

interface ActivityFilter {
  activity_types?: ActivityType[];
  entity_types?: string[];
  user_ids?: string[];
  start_date?: string;
  end_date?: string;
  is_read?: boolean;
}

interface ActivityStats {
  total_activities: number;
  activity_by_type: Record<ActivityType, number>;
  activity_by_user: Record<string, number>;
  recent_activity_trend: { date: string; count: number }[];
  top_contributors: { user: User; activity_count: number }[];
}

class ActivityManager {
  private supabase: ReturnType<typeof createClient>;
  private activityBuffer: Map<string, ActivityLogData[]> = new Map(); // workspaceId -> activities
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.startPeriodicFlush();
  }

  // ============================================================================
  // ACTIVITY LOGGING
  // ============================================================================

  async logActivity(data: ActivityLogData): Promise<ApiResponse<ActivityFeed>> {
    try {
      // Validate required fields
      if (!data.workspace_id || !data.user_id || !data.activity_type) {
        return {
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'workspace_id, user_id, and activity_type are required'
        };
      }

      // Check if user has access to workspace
      const hasAccess = await this.checkWorkspaceAccess(data.workspace_id, data.user_id);
      if (!hasAccess) {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          message: 'User does not have access to this workspace'
        };
      }

      // Add to buffer for batch processing
      await this.addToBuffer(data);

      // For immediate return, create a temporary activity record
      const activityId = uuidv4();
      const activity: ActivityFeed = {
        id: activityId,
        workspace_id: data.workspace_id,
        user_id: data.user_id,
        activity_type: data.activity_type,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        metadata: data.metadata || {},
        description: data.description,
        is_read: false,
        created_at: new Date().toISOString()
      };

      return {
        success: true,
        data: activity
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async bulkLogActivities(activities: ActivityLogData[]): Promise<ApiResponse<ActivityFeed[]>> {
    try {
      const results: ActivityFeed[] = [];
      
      for (const activity of activities) {
        const result = await this.logActivity(activity);
        if (result.success) {
          results.push(result.data!);
        }
      }

      return {
        success: true,
        data: results
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
  // ACTIVITY FEED RETRIEVAL
  // ============================================================================

  async getActivityFeed(
    workspaceId: string,
    userId: string,
    page: number = 1,
    limit: number = 50,
    filter?: ActivityFilter
  ): Promise<ApiResponse<PaginatedResponse<ActivityFeed>>> {
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
        .from('activity_feed')
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .eq('workspace_id', workspaceId);

      // Apply filters
      if (filter) {
        if (filter.activity_types && filter.activity_types.length > 0) {
          query = query.in('activity_type', filter.activity_types);
        }
        
        if (filter.entity_types && filter.entity_types.length > 0) {
          query = query.in('entity_type', filter.entity_types);
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
        
        if (filter.is_read !== undefined) {
          query = query.eq('is_read', filter.is_read);
        }
      }

      // Execute query with pagination
      const { data: activities, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return {
          success: false,
          error: 'GET_ACTIVITY_FEED_ERROR',
          message: error.message
        };
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        data: {
          data: activities || [],
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

  async getUserActivity(
    workspaceId: string,
    targetUserId: string,
    requestingUserId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<ApiResponse<PaginatedResponse<ActivityFeed>>> {
    try {
      // Check if requesting user has access to workspace
      const hasAccess = await this.checkWorkspaceAccess(workspaceId, requestingUserId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          message: 'You do not have access to this workspace'
        };
      }

      const offset = (page - 1) * limit;

      const { data: activities, error, count } = await this.supabase
        .from('activity_feed')
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .eq('workspace_id', workspaceId)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return {
          success: false,
          error: 'GET_USER_ACTIVITY_ERROR',
          message: error.message
        };
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        data: {
          data: activities || [],
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

  async getEntityActivity(
    workspaceId: string,
    entityType: string,
    entityId: string,
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<ApiResponse<PaginatedResponse<ActivityFeed>>> {
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

      const { data: activities, error, count } = await this.supabase
        .from('activity_feed')
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .eq('workspace_id', workspaceId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        return {
          success: false,
          error: 'GET_ENTITY_ACTIVITY_ERROR',
          message: error.message
        };
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        data: {
          data: activities || [],
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
  // ACTIVITY MANAGEMENT
  // ============================================================================

  async markActivityAsRead(
    activityId: string,
    userId: string
  ): Promise<ApiResponse<ActivityFeed>> {
    try {
      // Verify user has access to the activity
      const { data: activity, error: fetchError } = await this.supabase
        .from('activity_feed')
        .select('workspace_id')
        .eq('id', activityId)
        .single();

      if (fetchError || !activity) {
        return {
          success: false,
          error: 'ACTIVITY_NOT_FOUND',
          message: 'Activity not found'
        };
      }

      const hasAccess = await this.checkWorkspaceAccess(activity.workspace_id, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          message: 'You do not have access to this activity'
        };
      }

      // Mark as read
      const { data: updatedActivity, error } = await this.supabase
        .from('activity_feed')
        .update({ is_read: true })
        .eq('id', activityId)
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .single();

      if (error) {
        return {
          success: false,
          error: 'MARK_READ_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        data: updatedActivity
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async markAllActivitiesAsRead(
    workspaceId: string,
    userId: string
  ): Promise<ApiResponse<void>> {
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

      const { error } = await this.supabase
        .from('activity_feed')
        .update({ is_read: true })
        .eq('workspace_id', workspaceId)
        .eq('is_read', false);

      if (error) {
        return {
          success: false,
          error: 'MARK_ALL_READ_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        message: 'All activities marked as read'
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  async deleteActivity(
    activityId: string,
    userId: string
  ): Promise<ApiResponse<void>> {
    try {
      // Verify user has access and permission to delete
      const { data: activity, error: fetchError } = await this.supabase
        .from('activity_feed')
        .select('workspace_id, user_id')
        .eq('id', activityId)
        .single();

      if (fetchError || !activity) {
        return {
          success: false,
          error: 'ACTIVITY_NOT_FOUND',
          message: 'Activity not found'
        };
      }

      // Check if user is the activity creator or has admin permission
      const isCreator = activity.user_id === userId;
      const hasAccess = await this.checkWorkspaceAccess(activity.workspace_id, userId);
      
      if (!hasAccess) {
        return {
          success: false,
          error: 'ACCESS_DENIED',
          message: 'You do not have access to this activity'
        };
      }

      // Only allow deletion by creator or admin
      if (!isCreator) {
        // Check if user has admin privileges
        const { data: member } = await this.supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', activity.workspace_id)
          .eq('user_id', userId)
          .single();

        if (!member || (member.role !== 'admin' && member.role !== 'owner')) {
          return {
            success: false,
            error: 'PERMISSION_DENIED',
            message: 'You can only delete your own activities or you need admin privileges'
          };
        }
      }

      // Delete activity
      const { error } = await this.supabase
        .from('activity_feed')
        .delete()
        .eq('id', activityId);

      if (error) {
        return {
          success: false,
          error: 'DELETE_ACTIVITY_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        message: 'Activity deleted successfully'
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
  // ACTIVITY ANALYTICS
  // ============================================================================

  async getActivityStats(
    workspaceId: string,
    userId: string,
    days: number = 30
  ): Promise<ApiResponse<ActivityStats>> {
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

      // Get activities for the period
      const { data: activities, error } = await this.supabase
        .from('activity_feed')
        .select(`
          *,
          user:users(id, name, username, email)
        `)
        .eq('workspace_id', workspaceId)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      if (error) {
        return {
          success: false,
          error: 'GET_ACTIVITY_STATS_ERROR',
          message: error.message
        };
      }

      const stats = this.calculateActivityStats(activities || []);

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

  async getUnreadCount(
    workspaceId: string,
    userId: string
  ): Promise<ApiResponse<number>> {
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

      const { count, error } = await this.supabase
        .from('activity_feed')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('is_read', false);

      if (error) {
        return {
          success: false,
          error: 'GET_UNREAD_COUNT_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        data: count || 0
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

  subscribeToWorkspaceActivity(
    workspaceId: string,
    onActivityUpdate: (activity: ActivityFeed) => void
  ): () => void {
    const subscription = this.supabase
      .channel(`activity:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_feed',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          onActivityUpdate(payload.new as ActivityFeed);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }

  subscribeToUserActivity(
    userId: string,
    onActivityUpdate: (activity: ActivityFeed) => void
  ): () => void {
    const subscription = this.supabase
      .channel(`user-activity:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_feed',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          onActivityUpdate(payload.new as ActivityFeed);
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

  private async addToBuffer(activity: ActivityLogData): Promise<void> {
    const workspaceId = activity.workspace_id;
    
    if (!this.activityBuffer.has(workspaceId)) {
      this.activityBuffer.set(workspaceId, []);
    }
    
    const buffer = this.activityBuffer.get(workspaceId)!;
    buffer.push(activity);
    
    // If buffer is full, flush immediately
    if (buffer.length >= this.BUFFER_SIZE) {
      await this.flushBuffer(workspaceId);
    }
  }

  private async flushBuffer(workspaceId: string): Promise<void> {
    const buffer = this.activityBuffer.get(workspaceId);
    if (!buffer || buffer.length === 0) {
      return;
    }

    try {
      // Insert all activities in buffer
      const { error } = await this.supabase
        .from('activity_feed')
        .insert(buffer);

      if (error) {
        console.error('Failed to flush activity buffer:', error);
      } else {
        // Clear buffer after successful flush
        this.activityBuffer.set(workspaceId, []);
      }
    } catch (error) {
      console.error('Error flushing activity buffer:', error);
    }
  }

  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(async () => {
      // Flush all buffers
      for (const workspaceId of this.activityBuffer.keys()) {
        await this.flushBuffer(workspaceId);
      }
    }, this.FLUSH_INTERVAL);
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

  private calculateActivityStats(activities: ActivityFeed[]): ActivityStats {
    const stats: ActivityStats = {
      total_activities: activities.length,
      activity_by_type: {} as Record<ActivityType, number>,
      activity_by_user: {},
      recent_activity_trend: [],
      top_contributors: []
    };

    // Initialize activity type counts
    const activityTypes: ActivityType[] = [
      'order_created', 'order_updated', 'order_deleted',
      'submission_paid', 'submission_updated',
      'member_added', 'member_removed', 'member_role_changed',
      'workspace_created', 'workspace_updated',
      'chat_message', 'presence_update'
    ];

    activityTypes.forEach(type => {
      stats.activity_by_type[type] = 0;
    });

    // Count activities by type and user
    activities.forEach(activity => {
      stats.activity_by_type[activity.activity_type]++;
      stats.activity_by_user[activity.user_id] = (stats.activity_by_user[activity.user_id] || 0) + 1;
    });

    // Calculate trend (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      return date.toISOString().split('T')[0];
    }).reverse();

    stats.recent_activity_trend = last7Days.map(date => ({
      date,
      count: activities.filter(a => a.created_at.startsWith(date)).length
    }));

    // Top contributors
    const userActivityCounts = Object.entries(stats.activity_by_user)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    stats.top_contributors = userActivityCounts.map(([userId, count]) => {
      const userActivity = activities.find(a => a.user_id === userId);
      return {
        user: userActivity?.user || { id: userId, name: 'Unknown User', username: '', email: '' },
        activity_count: count
      };
    });

    return stats;
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async cleanupOldActivities(days: number = 90): Promise<ApiResponse<void>> {
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await this.supabase
        .from('activity_feed')
        .delete()
        .lt('created_at', cutoffDate);

      if (error) {
        return {
          success: false,
          error: 'CLEANUP_ERROR',
          message: error.message
        };
      }

      return {
        success: true,
        message: 'Old activities cleaned up successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      };
    }
  }

  public async destroy(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Flush all remaining buffers
    for (const workspaceId of this.activityBuffer.keys()) {
      await this.flushBuffer(workspaceId);
    }

    this.activityBuffer.clear();
  }
}

export default ActivityManager;