// GOMFLOW Collaboration Demo Component
// Example showcasing all collaboration features working together

"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  MessageSquare, 
  FileText, 
  Settings,
  Play,
  Pause,
  RotateCcw,
  Eye,
  Edit,
  Crown,
  Activity,
  Zap,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';

// Import all collaboration components
import WorkspaceManager from './WorkspaceManager';
import CollaborativeEditor from './CollaborativeEditor';
import PresenceIndicator from './PresenceIndicator';
import TeamChat from './TeamChat';
import ActivityFeed from './ActivityFeed';
import { useCollaboration } from '@/hooks/useCollaboration';

// Types
import { 
  Workspace, 
  WorkspaceMember, 
  PresenceStatus,
  ActivityFeed as ActivityFeedType 
} from '@/lib/collaboration/types';

interface CollaborationDemoProps {
  userId?: string;
  authToken?: string;
  workspaceId?: string;
}

interface DemoState {
  activeUsers: number;
  messagesCount: number;
  activitiesCount: number;
  ordersCount: number;
  isRealTimeActive: boolean;
}

const CollaborationDemo: React.FC<CollaborationDemoProps> = ({
  userId = 'demo-user-123',
  authToken = 'demo-token-456',
  workspaceId = 'demo-workspace-789'
}) => {
  const [selectedComponent, setSelectedComponent] = useState<'workspace' | 'editor' | 'chat' | 'activity'>('workspace');
  const [isFullDemo, setIsFullDemo] = useState(false);
  const [demoState, setDemoState] = useState<DemoState>({
    activeUsers: 3,
    messagesCount: 12,
    activitiesCount: 8,
    ordersCount: 5,
    isRealTimeActive: true
  });

  // Mock collaboration data
  const mockWorkspace: Workspace = {
    id: workspaceId,
    name: 'K-pop Merchandise Hub',
    description: 'Collaborative workspace for managing K-pop merchandise group orders',
    owner_id: userId,
    settings: {
      auto_invite: false,
      public_orders: true,
      require_approval: false,
      default_role: 'editor'
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const mockMembers: WorkspaceMember[] = [
    {
      id: '1',
      user_id: userId,
      workspace_id: workspaceId,
      role: 'owner',
      status: 'active',
      permissions: {
        can_create_orders: true,
        can_edit_orders: true,
        can_delete_orders: true,
        can_view_analytics: true,
        can_manage_payments: true,
        can_invite_members: true,
        can_chat: true
      },
      presence_status: 'online',
      last_active_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: {
        id: userId,
        email: 'demo@gomflow.com',
        name: 'Demo User',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    },
    {
      id: '2',
      user_id: 'user-222',
      workspace_id: workspaceId,
      role: 'editor',
      status: 'active',
      permissions: {
        can_create_orders: true,
        can_edit_orders: true,
        can_delete_orders: false,
        can_view_analytics: true,
        can_manage_payments: false,
        can_invite_members: false,
        can_chat: true
      },
      presence_status: 'online',
      last_active_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: {
        id: 'user-222',
        email: 'sarah@example.com',
        name: 'Sarah Kim',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    },
    {
      id: '3',
      user_id: 'user-333',
      workspace_id: workspaceId,
      role: 'viewer',
      status: 'active',
      permissions: {
        can_create_orders: false,
        can_edit_orders: false,
        can_delete_orders: false,
        can_view_analytics: false,
        can_manage_payments: false,
        can_invite_members: false,
        can_chat: true
      },
      presence_status: 'away',
      last_active_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user: {
        id: 'user-333',
        email: 'buyer@example.com',
        name: 'Alex Chen',
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    }
  ];

  // Mock presence data
  const mockPresenceData = mockMembers.map(member => ({
    id: `presence-${member.id}`,
    user_id: member.user_id,
    workspace_id: workspaceId,
    status: member.presence_status as PresenceStatus,
    current_page: selectedComponent === 'editor' ? 'order-demo-123' : 'workspace',
    last_activity: member.last_active_at,
    user_agent: 'Chrome/91.0.4472.124',
    created_at: member.created_at,
    updated_at: member.updated_at
  }));

  // Mock activities
  const mockActivities: ActivityFeedType[] = [
    {
      id: '1',
      workspace_id: workspaceId,
      user_id: 'user-222',
      activity_type: 'order_created',
      description: 'Created new order "SEVENTEEN God of Music Album"',
      metadata: {
        order_id: 'order-123',
        order_title: 'SEVENTEEN God of Music Album'
      },
      is_read: false,
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      user: mockMembers[1].user
    },
    {
      id: '2',
      workspace_id: workspaceId,
      user_id: userId,
      activity_type: 'submission_paid',
      description: 'Payment confirmed for order',
      metadata: {
        order_id: 'order-123',
        amount: 25.50,
        currency: 'USD'
      },
      is_read: true,
      created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      user: mockMembers[0].user
    }
  ];

  // Simulate real-time updates
  useEffect(() => {
    if (!demoState.isRealTimeActive) return;

    const interval = setInterval(() => {
      setDemoState(prev => ({
        ...prev,
        messagesCount: prev.messagesCount + Math.floor(Math.random() * 3),
        activitiesCount: prev.activitiesCount + Math.floor(Math.random() * 2),
        activeUsers: 3 + Math.floor(Math.random() * 2)
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [demoState.isRealTimeActive]);

  const toggleRealTime = () => {
    setDemoState(prev => ({
      ...prev,
      isRealTimeActive: !prev.isRealTimeActive
    }));
  };

  const resetDemo = () => {
    setDemoState({
      activeUsers: 3,
      messagesCount: 12,
      activitiesCount: 8,
      ordersCount: 5,
      isRealTimeActive: true
    });
  };

  const renderComponent = () => {
    const commonProps = {
      userId,
      authToken,
      workspaceId
    };

    switch (selectedComponent) {
      case 'workspace':
        return (
          <WorkspaceManager
            {...commonProps}
            onWorkspaceSelect={(id) => console.log('Selected workspace:', id)}
          />
        );
      case 'editor':
        return (
          <CollaborativeEditor
            {...commonProps}
            orderId="demo-order-123"
            onClose={() => setSelectedComponent('workspace')}
          />
        );
      case 'chat':
        return (
          <TeamChat
            {...commonProps}
            height="h-96"
          />
        );
      case 'activity':
        return (
          <ActivityFeed
            {...commonProps}
            activities={mockActivities}
            maxItems={20}
            showFilters={true}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Demo Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">GOMFLOW Collaboration Demo</h1>
        <p className="text-gray-600">
          Experience real-time collaboration features in action
        </p>
      </div>

      {/* Demo Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Demo Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Button
                variant={demoState.isRealTimeActive ? 'default' : 'outline'}
                onClick={toggleRealTime}
                className="flex items-center gap-2"
              >
                {demoState.isRealTimeActive ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {demoState.isRealTimeActive ? 'Pause' : 'Start'} Real-time
              </Button>
              <Button
                variant="outline"
                onClick={resetDemo}
                className="flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Demo
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsFullDemo(!isFullDemo)}
                className="flex items-center gap-2"
              >
                {isFullDemo ? 'Simple' : 'Full'} Demo
              </Button>
            </div>
          </div>

          {/* Demo Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Users className="w-4 h-4 text-blue-500" />
                <span className="text-2xl font-bold">{demoState.activeUsers}</span>
              </div>
              <p className="text-sm text-gray-600">Active Users</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-green-500" />
                <span className="text-2xl font-bold">{demoState.messagesCount}</span>
              </div>
              <p className="text-sm text-gray-600">Messages</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Activity className="w-4 h-4 text-purple-500" />
                <span className="text-2xl font-bold">{demoState.activitiesCount}</span>
              </div>
              <p className="text-sm text-gray-600">Activities</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <FileText className="w-4 h-4 text-orange-500" />
                <span className="text-2xl font-bold">{demoState.ordersCount}</span>
              </div>
              <p className="text-sm text-gray-600">Orders</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Component Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Component Showcase</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
            <Button
              variant={selectedComponent === 'workspace' ? 'default' : 'outline'}
              onClick={() => setSelectedComponent('workspace')}
              className="flex items-center gap-2"
            >
              <Users className="w-4 h-4" />
              Workspace
            </Button>
            <Button
              variant={selectedComponent === 'editor' ? 'default' : 'outline'}
              onClick={() => setSelectedComponent('editor')}
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Editor
            </Button>
            <Button
              variant={selectedComponent === 'chat' ? 'default' : 'outline'}
              onClick={() => setSelectedComponent('chat')}
              className="flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </Button>
            <Button
              variant={selectedComponent === 'activity' ? 'default' : 'outline'}
              onClick={() => setSelectedComponent('activity')}
              className="flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Activity
            </Button>
          </div>

          {/* Component Demo Area */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-white">
            {renderComponent()}
          </div>
        </CardContent>
      </Card>

      {/* Full Demo Layout */}
      {isFullDemo && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Presence Indicator */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Team Presence</CardTitle>
            </CardHeader>
            <CardContent>
              <PresenceIndicator
                workspaceId={workspaceId}
                currentPage="demo"
                members={mockMembers}
                presenceData={mockPresenceData}
                compact={true}
              />
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityFeed
                workspaceId={workspaceId}
                userId={userId}
                authToken={authToken}
                activities={mockActivities}
                compact={true}
                maxItems={5}
              />
            </CardContent>
          </Card>

          {/* Mini Chat */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Team Chat</CardTitle>
            </CardHeader>
            <CardContent>
              <TeamChat
                workspaceId={workspaceId}
                userId={userId}
                authToken={authToken}
                compact={true}
                height="h-64"
              />
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${demoState.isRealTimeActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-sm">Real-time Updates</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">WebSocket Connected</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm">Auto-sync Enabled</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Response: 45ms</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Feature Highlights */}
      <Card>
        <CardHeader>
          <CardTitle>Key Features Demonstrated</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-blue-500 mt-1" />
              <div>
                <h3 className="font-semibold">Real-time Presence</h3>
                <p className="text-sm text-gray-600">
                  See who's online and what they're working on
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Edit className="w-5 h-5 text-green-500 mt-1" />
              <div>
                <h3 className="font-semibold">Collaborative Editing</h3>
                <p className="text-sm text-gray-600">
                  Edit orders together with conflict resolution
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MessageSquare className="w-5 h-5 text-purple-500 mt-1" />
              <div>
                <h3 className="font-semibold">Team Communication</h3>
                <p className="text-sm text-gray-600">
                  Chat with typing indicators and reactions
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Activity className="w-5 h-5 text-orange-500 mt-1" />
              <div>
                <h3 className="font-semibold">Activity Tracking</h3>
                <p className="text-sm text-gray-600">
                  Monitor workspace activity in real-time
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Crown className="w-5 h-5 text-yellow-500 mt-1" />
              <div>
                <h3 className="font-semibold">Role-based Access</h3>
                <p className="text-sm text-gray-600">
                  Granular permissions for different user types
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-1" />
              <div>
                <h3 className="font-semibold">Conflict Resolution</h3>
                <p className="text-sm text-gray-600">
                  Smart handling of concurrent editing conflicts
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CollaborationDemo;