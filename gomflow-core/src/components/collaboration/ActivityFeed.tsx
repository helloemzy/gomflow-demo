// GOMFLOW Activity Feed Component
// Real-time activity timeline for workspace collaboration

"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  MessageSquare,
  Settings,
  Eye,
  Crown,
  Shield,
  UserPlus,
  UserMinus,
  DollarSign,
  Calendar,
  Package,
  Clock,
  Filter,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  FileText,
  Zap
} from 'lucide-react';
import {
  ActivityFeed as ActivityFeedType,
  ActivityType,
  WorkspaceMember,
  ApiResponse,
  PaginatedResponse
} from '@/lib/collaboration/types';

interface ActivityFeedProps {
  workspaceId: string;
  userId: string;
  authToken: string;
  activities: ActivityFeedType[];
  onActivityRead?: (activityIds: string[]) => void;
  showFilters?: boolean;
  maxItems?: number;
  compact?: boolean;
  realtime?: boolean;
}

interface ActivityFilters {
  types: ActivityType[];
  users: string[];
  timeRange: 'all' | 'today' | 'week' | 'month';
  unreadOnly: boolean;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  workspaceId,
  userId,
  authToken,
  activities: initialActivities = [],
  onActivityRead,
  showFilters = true,
  maxItems = 50,
  compact = false,
  realtime = true
}) => {
  const [activities, setActivities] = useState<ActivityFeedType[]>(initialActivities);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ActivityFilters>({
    types: [],
    users: [],
    timeRange: 'all',
    unreadOnly: false
  });
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load activities on mount
  useEffect(() => {
    loadActivities();
  }, [workspaceId, filters, searchTerm]);

  // Update activities when prop changes
  useEffect(() => {
    setActivities(initialActivities);
    updateUnreadCount(initialActivities);
  }, [initialActivities, userId]);

  const loadActivities = async (loadMore: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: loadMore ? (page + 1).toString() : '1',
        limit: maxItems.toString(),
        ...(filters.types.length > 0 && { types: filters.types.join(',') }),
        ...(filters.users.length > 0 && { users: filters.users.join(',') }),
        ...(filters.timeRange !== 'all' && { timeRange: filters.timeRange }),
        ...(filters.unreadOnly && { unreadOnly: 'true' }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(
        `/api/collaboration/workspaces/${workspaceId}/activity?${params}`,
        {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to load activities');
      }

      const result: ApiResponse<PaginatedResponse<ActivityFeedType>> = await response.json();
      const newActivities = result.data?.data || [];
      
      if (loadMore) {
        setActivities(prev => [...prev, ...newActivities]);
        setPage(prev => prev + 1);
      } else {
        setActivities(newActivities);
        setPage(1);
      }
      
      setHasMore(result.data?.pagination.has_next || false);
      updateUnreadCount(newActivities);
      
    } catch (err) {
      console.error('Error loading activities:', err);
      setError('Failed to load activities');
    } finally {
      setIsLoading(false);
    }
  };

  const updateUnreadCount = (activityList: ActivityFeedType[]) => {
    const unread = activityList.filter(activity => 
      !activity.is_read && activity.user_id !== userId
    ).length;
    setUnreadCount(unread);
  };

  const markAsRead = async (activityIds: string[]) => {
    try {
      await fetch(`/api/collaboration/activity/mark-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ activityIds })
      });

      // Update local state
      setActivities(prev => prev.map(activity => 
        activityIds.includes(activity.id) 
          ? { ...activity, is_read: true }
          : activity
      ));

      onActivityRead?.(activityIds);
    } catch (err) {
      console.error('Error marking activities as read:', err);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = activities
      .filter(a => !a.is_read && a.user_id !== userId)
      .map(a => a.id);
    
    if (unreadIds.length > 0) {
      await markAsRead(unreadIds);
    }
  };

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'order_created': return <Plus className="w-4 h-4 text-green-500" />;
      case 'order_updated': return <Edit className="w-4 h-4 text-blue-500" />;
      case 'order_deleted': return <Trash2 className="w-4 h-4 text-red-500" />;
      case 'submission_paid': return <DollarSign className="w-4 h-4 text-green-500" />;
      case 'submission_updated': return <FileText className="w-4 h-4 text-blue-500" />;
      case 'member_added': return <UserPlus className="w-4 h-4 text-green-500" />;
      case 'member_removed': return <UserMinus className="w-4 h-4 text-red-500" />;
      case 'member_role_changed': return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'workspace_created': return <Plus className="w-4 h-4 text-blue-500" />;
      case 'workspace_updated': return <Settings className="w-4 h-4 text-blue-500" />;
      case 'chat_message': return <MessageSquare className="w-4 h-4 text-purple-500" />;
      case 'presence_update': return <Eye className="w-4 h-4 text-gray-500" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActivityColor = (type: ActivityType) => {
    switch (type) {
      case 'order_created':
      case 'member_added':
      case 'submission_paid':
        return 'border-l-green-500';
      case 'order_updated':
      case 'submission_updated':
      case 'workspace_updated':
        return 'border-l-blue-500';
      case 'order_deleted':
      case 'member_removed':
        return 'border-l-red-500';
      case 'member_role_changed':
        return 'border-l-yellow-500';
      case 'chat_message':
        return 'border-l-purple-500';
      default:
        return 'border-l-gray-300';
    }
  };

  const formatActivityDescription = (activity: ActivityFeedType) => {
    if (activity.description) {
      return activity.description;
    }

    const userName = activity.user?.name || 'Unknown User';
    const metadata = activity.metadata || {};

    switch (activity.activity_type) {
      case 'order_created':
        return `${userName} created a new order "${metadata.order_title || 'Untitled'}"`;
      case 'order_updated':
        return `${userName} updated order "${metadata.order_title || 'Untitled'}"`;
      case 'order_deleted':
        return `${userName} deleted order "${metadata.order_title || 'Untitled'}"`;
      case 'submission_paid':
        return `${userName} paid for order "${metadata.order_title || 'Untitled'}"`;
      case 'submission_updated':
        return `${userName} updated their submission for "${metadata.order_title || 'Untitled'}"`;
      case 'member_added':
        return `${userName} joined the workspace`;
      case 'member_removed':
        return `${userName} left the workspace`;
      case 'member_role_changed':
        return `${userName}'s role was changed to ${metadata.new_role || 'unknown'}`;
      case 'workspace_created':
        return `${userName} created the workspace`;
      case 'workspace_updated':
        return `${userName} updated workspace settings`;
      case 'chat_message':
        return `${userName} sent a message`;
      case 'presence_update':
        return `${userName} is now ${metadata.status || 'active'}`;
      default:
        return `${userName} performed an action`;
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now.getTime() - time.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return time.toLocaleDateString();
  };

  const filteredActivities = activities.filter(activity => {
    if (filters.unreadOnly && (activity.is_read || activity.user_id === userId)) {
      return false;
    }
    
    if (filters.types.length > 0 && !filters.types.includes(activity.activity_type)) {
      return false;
    }
    
    if (filters.users.length > 0 && !filters.users.includes(activity.user_id)) {
      return false;
    }
    
    if (searchTerm) {
      const description = formatActivityDescription(activity).toLowerCase();
      if (!description.includes(searchTerm.toLowerCase())) {
        return false;
      }
    }
    
    return true;
  });

  const groupedActivities = React.useMemo(() => {
    const groups: { [key: string]: ActivityFeedType[] } = {};
    
    filteredActivities.forEach(activity => {
      const date = new Date(activity.created_at).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
    });
    
    return groups;
  }, [filteredActivities]);

  // Compact view for sidebar
  if (compact) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Recent Activity
            </CardTitle>
            {unreadCount > 0 && (
              <Badge variant="default" className="text-xs">
                {unreadCount}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredActivities.slice(0, 10).map((activity) => (
              <div
                key={activity.id}
                className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                  !activity.is_read && activity.user_id !== userId
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => {
                  if (!activity.is_read && activity.user_id !== userId) {
                    markAsRead([activity.id]);
                  }
                }}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getActivityIcon(activity.activity_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate">{formatActivityDescription(activity)}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {getTimeAgo(activity.created_at)}
                  </p>
                </div>
              </div>
            ))}
            {filteredActivities.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                <Activity className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                <p className="text-xs">No recent activity</p>
              </div>
            )}
          </div>
          {unreadCount > 0 && (
            <div className="mt-3 pt-3 border-t">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={markAllAsRead}
                className="w-full text-xs"
              >
                Mark all as read
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Full view
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Activity Feed
          </h2>
          {unreadCount > 0 && (
            <Badge variant="default">
              {unreadCount} unread
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className="flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadActivities()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          {unreadCount > 0 && (
            <Button
              size="sm"
              onClick={markAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      {showFilters && (
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filters.unreadOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilters(prev => ({ ...prev, unreadOnly: !prev.unreadOnly }))}
            >
              Unread only
            </Button>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      {showFilterPanel && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Activity Types</label>
                <div className="space-y-1">
                  {[
                    'order_created',
                    'order_updated',
                    'submission_paid',
                    'member_added',
                    'chat_message'
                  ].map(type => (
                    <label key={type} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.types.includes(type as ActivityType)}
                        onChange={(e) => {
                          setFilters(prev => ({
                            ...prev,
                            types: e.target.checked
                              ? [...prev.types, type as ActivityType]
                              : prev.types.filter(t => t !== type)
                          }));
                        }}
                      />
                      <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Time Range</label>
                <select
                  value={filters.timeRange}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    timeRange: e.target.value as 'all' | 'today' | 'week' | 'month' 
                  }))}
                  className="w-full p-2 border border-gray-300 rounded"
                >
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="week">This week</option>
                  <option value="month">This month</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => setFilters({
                    types: [],
                    users: [],
                    timeRange: 'all',
                    unreadOnly: false
                  })}
                  className="w-full"
                >
                  Clear filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity List */}
      <div className="space-y-4">
        {Object.entries(groupedActivities).map(([date, dayActivities]) => (
          <div key={date}>
            <div className="flex items-center gap-2 mb-3">
              <div className="font-medium text-gray-900">
                {date === new Date().toDateString() ? 'Today' : 
                 date === new Date(Date.now() - 86400000).toDateString() ? 'Yesterday' : 
                 new Date(date).toLocaleDateString()}
              </div>
              <div className="h-px bg-gray-200 flex-1"></div>
            </div>
            
            <div className="space-y-2">
              {dayActivities.map((activity) => (
                <Card 
                  key={activity.id} 
                  className={`border-l-4 ${getActivityColor(activity.activity_type)} ${
                    !activity.is_read && activity.user_id !== userId
                      ? 'bg-blue-50 border-blue-200'
                      : ''
                  }`}
                >
                  <CardContent 
                    className="p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => {
                      if (!activity.is_read && activity.user_id !== userId) {
                        markAsRead([activity.id]);
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        {getActivityIcon(activity.activity_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          {formatActivityDescription(activity)}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{getTimeAgo(activity.created_at)}</span>
                          {activity.metadata?.order_id && (
                            <>
                              <span>•</span>
                              <span>Order #{activity.metadata.order_id.slice(-6)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {!activity.is_read && activity.user_id !== userId && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {filteredActivities.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No activities found</h3>
              <p className="text-gray-600">
                {searchTerm || filters.types.length > 0 || filters.unreadOnly
                  ? "No activities match your current filters."
                  : "No activities yet. Start collaborating to see activity here."}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Load More */}
        {hasMore && filteredActivities.length > 0 && (
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => loadActivities(true)}
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                'Load more'
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ActivityFeed;