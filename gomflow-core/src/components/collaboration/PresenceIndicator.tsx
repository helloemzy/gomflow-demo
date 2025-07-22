// GOMFLOW Presence Indicator Component
// Live presence display for collaborative sessions

"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Eye, 
  MousePointer, 
  MessageSquare, 
  Settings,
  Crown,
  Shield,
  Edit,
  Clock,
  Zap
} from 'lucide-react';
import {
  WorkspaceMember,
  PresenceTracking,
  PresenceStatus,
  CursorPosition,
  WorkspaceRole
} from '@/lib/collaboration/types';

interface PresenceIndicatorProps {
  workspaceId: string;
  currentPage?: string;
  members: WorkspaceMember[];
  presenceData: PresenceTracking[];
  showCursors?: boolean;
  showDetails?: boolean;
  maxVisible?: number;
  compact?: boolean;
}

interface UserPresence {
  member: WorkspaceMember;
  presence: PresenceTracking;
  isOnCurrentPage: boolean;
  timeAgo: string;
}

const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  workspaceId,
  currentPage,
  members,
  presenceData,
  showCursors = true,
  showDetails = false,
  maxVisible = 5,
  compact = false
}) => {
  const [userPresences, setUserPresences] = useState<UserPresence[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const presences = members.map(member => {
      const presence = presenceData.find(p => p.user_id === member.user_id);
      const isOnCurrentPage = presence?.current_page === currentPage;
      
      return {
        member,
        presence: presence || {
          id: '',
          user_id: member.user_id,
          workspace_id: workspaceId,
          status: 'offline' as PresenceStatus,
          last_activity: member.last_active_at,
          created_at: member.created_at,
          updated_at: member.updated_at
        },
        isOnCurrentPage,
        timeAgo: presence ? getTimeAgo(presence.last_activity) : getTimeAgo(member.last_active_at)
      };
    });

    // Sort by presence status and activity
    presences.sort((a, b) => {
      const statusOrder = { online: 0, away: 1, busy: 2, offline: 3 };
      const aOrder = statusOrder[a.presence.status];
      const bOrder = statusOrder[b.presence.status];
      
      if (aOrder !== bOrder) {
        return aOrder - bOrder;
      }
      
      // If same status, sort by current page presence
      if (a.isOnCurrentPage && !b.isOnCurrentPage) return -1;
      if (!a.isOnCurrentPage && b.isOnCurrentPage) return 1;
      
      // Then by last activity
      return new Date(b.presence.last_activity).getTime() - new Date(a.presence.last_activity).getTime();
    });

    setUserPresences(presences);
  }, [members, presenceData, currentPage, workspaceId]);

  const getTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now.getTime() - time.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getPresenceColor = (status: PresenceStatus): string => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      case 'offline': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getPresenceIcon = (status: PresenceStatus) => {
    switch (status) {
      case 'online': return <Zap className="w-3 h-3 text-green-500" />;
      case 'away': return <Clock className="w-3 h-3 text-yellow-500" />;
      case 'busy': return <MessageSquare className="w-3 h-3 text-red-500" />;
      case 'offline': return <Eye className="w-3 h-3 text-gray-500" />;
      default: return null;
    }
  };

  const getRoleIcon = (role: WorkspaceRole) => {
    switch (role) {
      case 'owner': return <Crown className="w-3 h-3 text-yellow-500" />;
      case 'admin': return <Shield className="w-3 h-3 text-blue-500" />;
      case 'editor': return <Edit className="w-3 h-3 text-green-500" />;
      case 'viewer': return <Eye className="w-3 h-3 text-gray-500" />;
      default: return null;
    }
  };

  const getActivityDescription = (presence: PresenceTracking): string => {
    if (presence.current_page) {
      if (presence.current_page.startsWith('order-')) {
        return 'Editing order';
      } else if (presence.current_page === 'dashboard') {
        return 'Viewing dashboard';
      } else if (presence.current_page === 'chat') {
        return 'In chat';
      }
      return `On ${presence.current_page}`;
    }
    return 'Idle';
  };

  const onlineCount = userPresences.filter(up => up.presence.status === 'online').length;
  const visiblePresences = showAll ? userPresences : userPresences.slice(0, maxVisible);
  const hiddenCount = userPresences.length - maxVisible;

  // Compact view
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Users className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">{onlineCount} online</span>
        </div>
        <div className="flex -space-x-2">
          {visiblePresences.map((userPresence) => (
            <div
              key={userPresence.member.user_id}
              className="relative"
              title={`${userPresence.member.user?.name} - ${userPresence.presence.status}`}
            >
              <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-white text-xs font-semibold">
                {userPresence.member.user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getPresenceColor(userPresence.presence.status)}`}></div>
            </div>
          ))}
          {hiddenCount > 0 && (
            <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-600 text-xs font-semibold">
              +{hiddenCount}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Detailed view
  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-500" />
            <h3 className="font-semibold">Team Presence</h3>
            <Badge variant="secondary" className="text-xs">
              {onlineCount} online
            </Badge>
          </div>
          {userPresences.length > maxVisible && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showAll ? 'Show less' : `Show all (${userPresences.length})`}
            </button>
          )}
        </div>

        <div className="space-y-3">
          {visiblePresences.map((userPresence) => (
            <div
              key={userPresence.member.user_id}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                userPresence.isOnCurrentPage && currentPage 
                  ? 'bg-blue-50 border border-blue-200' 
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                  {userPresence.member.user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${getPresenceColor(userPresence.presence.status)}`}></div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">
                    {userPresence.member.user?.name || userPresence.member.user?.email}
                  </span>
                  {getRoleIcon(userPresence.member.role)}
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {getPresenceIcon(userPresence.presence.status)}
                  <span className="capitalize">{userPresence.presence.status}</span>
                  {userPresence.presence.status !== 'offline' && (
                    <>
                      <span>•</span>
                      <span>{getActivityDescription(userPresence.presence)}</span>
                    </>
                  )}
                </div>

                {showDetails && (
                  <div className="mt-1 text-xs text-gray-500">
                    Last active: {userPresence.timeAgo}
                    {userPresence.presence.user_agent && (
                      <span> • {userPresence.presence.user_agent.split(' ')[0]}</span>
                    )}
                  </div>
                )}
              </div>

              {userPresence.isOnCurrentPage && currentPage && (
                <div className="flex items-center gap-1">
                  <MousePointer className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-blue-600">Here</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {userPresences.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            <Users className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">No team members found</p>
          </div>
        )}

        {/* Current Page Activity */}
        {currentPage && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium">Current Page Activity</span>
            </div>
            <div className="text-sm text-gray-600">
              {userPresences.filter(up => up.isOnCurrentPage).length} member
              {userPresences.filter(up => up.isOnCurrentPage).length !== 1 ? 's' : ''} viewing this page
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Live cursor component for showing real-time cursor positions
export const LiveCursors: React.FC<{
  cursors: Map<string, CursorPosition & { user: WorkspaceMember }>;
  containerRef: React.RefObject<HTMLElement>;
}> = ({ cursors, containerRef }) => {
  const [visibleCursors, setVisibleCursors] = useState<Array<{
    id: string;
    x: number;
    y: number;
    user: WorkspaceMember;
    color: string;
  }>>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
    
    const newVisibleCursors = Array.from(cursors.entries()).map(([userId, cursor], index) => ({
      id: userId,
      x: Math.max(0, Math.min(cursor.x - rect.left, rect.width - 20)),
      y: Math.max(0, Math.min(cursor.y - rect.top, rect.height - 20)),
      user: cursor.user,
      color: colors[index % colors.length]
    }));

    setVisibleCursors(newVisibleCursors);
  }, [cursors, containerRef]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {visibleCursors.map((cursor) => (
        <div
          key={cursor.id}
          className="absolute transform transition-all duration-100 ease-out"
          style={{
            left: cursor.x,
            top: cursor.y,
            color: cursor.color
          }}
        >
          <div className="flex items-center gap-1">
            <MousePointer className="w-4 h-4" style={{ color: cursor.color }} />
            <div 
              className="px-2 py-1 rounded text-xs text-white font-medium"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.user.user?.name?.split(' ')[0] || 'User'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PresenceIndicator;