"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Users,
  MessageCircle,
  Settings,
  Lock,
  Unlock,
  Share2,
  Bell,
  BellOff,
  Eye,
  EyeOff,
  UserPlus,
  Zap,
  ChevronDown,
  Clock,
  Shield,
  Activity
} from "lucide-react";
import { useCollaboration } from "@/hooks/useCollaboration";

interface CollaborationToolbarProps {
  orderId?: string;
  className?: string;
  position?: 'top' | 'bottom' | 'floating';
  compact?: boolean;
}

export function CollaborationToolbar({ 
  orderId, 
  className, 
  position = 'top',
  compact = false 
}: CollaborationToolbarProps) {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [showNotifications, setShowNotifications] = useState(true);
  const [isPresenceVisible, setIsPresenceVisible] = useState(true);
  
  // Mock data - in real app, this would come from useCollaboration hook
  const mockCollaboration = {
    state: {
      isConnected: true,
      onlineMembers: [
        { user_id: '1', name: 'Sarah Kim', role: 'owner', avatar: '/avatars/sarah.jpg' },
        { user_id: '2', name: 'Mike Chen', role: 'editor', avatar: '/avatars/mike.jpg' },
        { user_id: '3', name: 'Lisa Wong', role: 'viewer', avatar: '/avatars/lisa.jpg' }
      ],
      unreadCount: 3,
      unreadActivity: 7,
      lockedOrders: new Map(),
      userRole: 'editor',
      currentWorkspace: { id: 'workspace-1', name: 'KPOP Orders Team' }
    },
    actions: {
      requestOrderLock: async (orderId: string) => true,
      releaseOrderLock: (orderId: string) => {},
      hasPermission: (permission: string) => true,
      canEditOrder: (orderId: string) => true,
      getOrderLockStatus: (orderId: string) => ({ isLocked: false, lockedBy: null })
    }
  };

  const { state, actions } = mockCollaboration;

  const handleOrderLock = async () => {
    if (!orderId) return;
    
    const lockStatus = actions.getOrderLockStatus(orderId);
    if (lockStatus.isLocked) {
      actions.releaseOrderLock(orderId);
    } else {
      await actions.requestOrderLock(orderId);
    }
  };

  const handleInviteMember = () => {
    // Open invite modal
    console.log('Opening invite modal...');
  };

  const handleWorkspaceSettings = () => {
    // Open workspace settings
    console.log('Opening workspace settings...');
  };

  const handleShareWorkspace = () => {
    // Open share modal
    console.log('Opening share modal...');
  };

  const getToolbarPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'top-0 left-0 right-0 border-b';
      case 'bottom':
        return 'bottom-0 left-0 right-0 border-t';
      case 'floating':
        return 'top-4 right-4 rounded-lg border shadow-lg';
      default:
        return 'top-0 left-0 right-0 border-b';
    }
  };

  const renderPresenceIndicators = () => {
    if (!isPresenceVisible) return null;

    return (
      <div className="flex items-center space-x-1">
        <div className="flex -space-x-2">
          {state.onlineMembers.slice(0, 4).map((member) => (
            <div
              key={member.user_id}
              className="relative"
              title={`${member.name} (${member.role})`}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium border-2 border-white">
                {member.name.charAt(0)}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
            </div>
          ))}
        </div>
        
        {state.onlineMembers.length > 4 && (
          <Badge variant="secondary" className="text-xs">
            +{state.onlineMembers.length - 4}
          </Badge>
        )}
        
        <div className="flex items-center space-x-1 text-sm text-gray-600">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span>{state.onlineMembers.length} online</span>
        </div>
      </div>
    );
  };

  const renderCompactControls = () => (
    <div className="flex items-center space-x-2">
      {renderPresenceIndicators()}
      
      <div className="flex items-center space-x-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-600 hover:text-gray-900"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-600 hover:text-gray-900 relative"
        >
          <MessageCircle className="h-4 w-4" />
          {state.unreadCount > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs">
              {state.unreadCount}
            </Badge>
          )}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-600 hover:text-gray-900 relative"
        >
          <Bell className="h-4 w-4" />
          {state.unreadActivity > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs">
              {state.unreadActivity}
            </Badge>
          )}
        </Button>
      </div>
    </div>
  );

  const renderFullControls = () => (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center space-x-4">
        {/* Workspace Info */}
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Users className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="font-medium text-sm text-gray-900">
              {state.currentWorkspace?.name}
            </div>
            <div className="text-xs text-gray-500">
              {state.onlineMembers.length} members online
            </div>
          </div>
        </div>

        {/* Connection Status */}
        <div className="flex items-center space-x-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            state.isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
          )} />
          <span className="text-xs text-gray-600">
            {state.isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* Order Lock Status */}
        {orderId && (
          <div className="flex items-center space-x-2">
            {actions.getOrderLockStatus(orderId).isLocked ? (
              <Badge variant="destructive" className="text-xs">
                <Lock className="h-3 w-3 mr-1" />
                Locked
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                <Unlock className="h-3 w-3 mr-1" />
                Unlocked
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        {/* Presence Indicators */}
        {renderPresenceIndicators()}

        {/* Action Buttons */}
        <div className="flex items-center space-x-1">
          {/* Lock/Unlock Order */}
          {orderId && actions.hasPermission('edit_orders') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOrderLock}
              className="text-gray-600 hover:text-gray-900"
              title={actions.getOrderLockStatus(orderId).isLocked ? "Unlock Order" : "Lock Order"}
            >
              {actions.getOrderLockStatus(orderId).isLocked ? (
                <Unlock className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Chat */}
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-600 hover:text-gray-900 relative"
            title="Team Chat"
          >
            <MessageCircle className="h-4 w-4" />
            {state.unreadCount > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs">
                {state.unreadCount}
              </Badge>
            )}
          </Button>

          {/* Activity/Notifications */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotifications(!showNotifications)}
            className="text-gray-600 hover:text-gray-900 relative"
            title="Activity Feed"
          >
            {showNotifications ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            {state.unreadActivity > 0 && (
              <Badge className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs">
                {state.unreadActivity}
              </Badge>
            )}
          </Button>

          {/* Presence Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPresenceVisible(!isPresenceVisible)}
            className="text-gray-600 hover:text-gray-900"
            title={isPresenceVisible ? "Hide Presence" : "Show Presence"}
          >
            {isPresenceVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>

          {/* Invite Member */}
          {actions.hasPermission('invite_members') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleInviteMember}
              className="text-gray-600 hover:text-gray-900"
              title="Invite Member"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          )}

          {/* Share Workspace */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShareWorkspace}
            className="text-gray-600 hover:text-gray-900"
            title="Share Workspace"
          >
            <Share2 className="h-4 w-4" />
          </Button>

          {/* Settings */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleWorkspaceSettings}
            className="text-gray-600 hover:text-gray-900"
            title="Workspace Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn(
      "bg-white z-50 px-4 py-3 transition-all duration-200",
      getToolbarPositionClasses(),
      position === 'floating' && "fixed max-w-lg",
      className
    )}>
      {compact && !isExpanded ? renderCompactControls() : renderFullControls()}
    </div>
  );
}

export default CollaborationToolbar;