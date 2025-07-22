"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Users,
  Plus,
  Search,
  Settings,
  MessageSquare,
  Bell,
  Clock,
  TrendingUp,
  Crown,
  Shield,
  Edit,
  Eye,
  Globe,
  Lock,
  Unlock,
  Activity,
  Calendar,
  Filter,
  MoreVertical,
  ExternalLink,
  Archive,
  Star,
  Zap,
  UserPlus,
  Share2,
  LayoutDashboard
} from "lucide-react";

// Import collaboration components
import WorkspaceManager from "@/components/collaboration/WorkspaceManager";
import CollaborationToolbar from "@/components/collaboration/CollaborationToolbar";
import NotificationCenter from "@/components/collaboration/NotificationCenter";
import TeamChat from "@/components/collaboration/TeamChat";
import ActivityFeed from "@/components/collaboration/ActivityFeed";
import PresenceIndicator from "@/components/collaboration/PresenceIndicator";
import RoleManager from "@/components/collaboration/RoleManager";
import WorkspaceSettings from "@/components/collaboration/WorkspaceSettings";

interface WorkspaceData {
  id: string;
  name: string;
  description: string;
  avatar?: string;
  isPublic: boolean;
  memberCount: number;
  onlineCount: number;
  lastActivity: string;
  userRole: 'owner' | 'admin' | 'editor' | 'viewer';
  isStarred: boolean;
  stats: {
    totalOrders: number;
    activeOrders: number;
    totalRevenue: number;
    lastWeekActivity: number;
  };
}

interface NotificationData {
  id: string;
  type: 'chat' | 'activity' | 'order' | 'payment' | 'system' | 'collaboration';
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  isImportant: boolean;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  actionUrl?: string;
  actionText?: string;
  metadata?: Record<string, any>;
}

const mockWorkspaces: WorkspaceData[] = [
  {
    id: 'workspace-1',
    name: 'KPOP Orders Team',
    description: 'Main workspace for K-pop merchandise group orders',
    isPublic: false,
    memberCount: 12,
    onlineCount: 8,
    lastActivity: '2 minutes ago',
    userRole: 'admin',
    isStarred: true,
    stats: {
      totalOrders: 156,
      activeOrders: 23,
      totalRevenue: 45200,
      lastWeekActivity: 89
    }
  },
  {
    id: 'workspace-2',
    name: 'BTS Collection Hub',
    description: 'Specialized workspace for BTS merchandise and albums',
    isPublic: true,
    memberCount: 45,
    onlineCount: 15,
    lastActivity: '15 minutes ago',
    userRole: 'editor',
    isStarred: false,
    stats: {
      totalOrders: 234,
      activeOrders: 12,
      totalRevenue: 67800,
      lastWeekActivity: 156
    }
  },
  {
    id: 'workspace-3',
    name: 'Southeast Asia GOMs',
    description: 'Regional collaboration workspace for SEA GOMs',
    isPublic: false,
    memberCount: 78,
    onlineCount: 32,
    lastActivity: '1 hour ago',
    userRole: 'viewer',
    isStarred: true,
    stats: {
      totalOrders: 445,
      activeOrders: 67,
      totalRevenue: 123400,
      lastWeekActivity: 267
    }
  }
];

const mockNotifications: NotificationData[] = [
  {
    id: 'notif-1',
    type: 'collaboration',
    title: 'New member joined',
    message: 'Sarah Kim joined the KPOP Orders Team workspace',
    timestamp: '2024-01-18T10:30:00Z',
    isRead: false,
    isImportant: false,
    userId: 'user-1',
    userName: 'Sarah Kim',
    actionUrl: '/collaboration/workspace-1/members',
    actionText: 'View Members'
  },
  {
    id: 'notif-2',
    type: 'activity',
    title: 'Order locked for editing',
    message: 'Mike Chen locked "SEVENTEEN God of Music" order for editing',
    timestamp: '2024-01-18T09:45:00Z',
    isRead: false,
    isImportant: true,
    userId: 'user-2',
    userName: 'Mike Chen',
    actionUrl: '/orders/order-123',
    actionText: 'View Order'
  },
  {
    id: 'notif-3',
    type: 'chat',
    title: 'New message',
    message: 'Lisa Wong: "Payment deadline reminder for BTS album orders"',
    timestamp: '2024-01-18T09:20:00Z',
    isRead: true,
    isImportant: false,
    userId: 'user-3',
    userName: 'Lisa Wong',
    actionUrl: '/collaboration/workspace-1/chat',
    actionText: 'Open Chat'
  }
];

export default function CollaborationPage() {
  const [activeView, setActiveView] = useState<'overview' | 'workspaces' | 'members' | 'settings'>('overview');
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState<'all' | 'starred' | 'recent'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const filteredWorkspaces = mockWorkspaces.filter(workspace => {
    const matchesSearch = workspace.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         workspace.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterBy === 'all' || 
                         (filterBy === 'starred' && workspace.isStarred) ||
                         (filterBy === 'recent' && new Date(workspace.lastActivity).getTime() > Date.now() - 24 * 60 * 60 * 1000);
    return matchesSearch && matchesFilter;
  });

  const totalUnreadNotifications = mockNotifications.filter(n => !n.isRead).length;

  const handleWorkspaceSelect = (workspace: WorkspaceData) => {
    setSelectedWorkspace(workspace);
    setActiveView('workspaces');
  };

  const handleNotificationClick = (notification: NotificationData) => {
    console.log('Notification clicked:', notification);
    // Navigate to notification target
    if (notification.actionUrl) {
      window.open(notification.actionUrl, '_blank');
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Workspaces</p>
              <p className="text-2xl font-bold text-gray-900">{mockWorkspaces.length}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Members</p>
              <p className="text-2xl font-bold text-gray-900">
                {mockWorkspaces.reduce((sum, w) => sum + w.onlineCount, 0)}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">
                {mockWorkspaces.reduce((sum, w) => sum + w.stats.totalOrders, 0)}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Unread Messages</p>
              <p className="text-2xl font-bold text-gray-900">{totalUnreadNotifications}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          <ActivityFeed
            workspaceId="workspace-1"
            userId="current-user"
            authToken="mock-token"
            limit={5}
            compact={true}
            showUnreadOnly={false}
            className="max-h-80"
          />
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Active Workspaces</h3>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-3">
            {mockWorkspaces.slice(0, 3).map((workspace) => (
              <div
                key={workspace.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                onClick={() => handleWorkspaceSelect(workspace)}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">
                      {workspace.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{workspace.name}</p>
                    <p className="text-sm text-gray-600">{workspace.onlineCount} online</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {workspace.isStarred && (
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {workspace.userRole}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Button
          onClick={() => setShowCreateModal(true)}
          className="h-16 bg-primary-600 hover:bg-primary-700 flex items-center justify-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Create Workspace</span>
        </Button>
        
        <Button
          variant="outline"
          onClick={() => setActiveView('workspaces')}
          className="h-16 flex items-center justify-center space-x-2"
        >
          <Users className="h-5 w-5" />
          <span>Browse Workspaces</span>
        </Button>
        
        <Button
          variant="outline"
          onClick={() => setActiveView('settings')}
          className="h-16 flex items-center justify-center space-x-2"
        >
          <Settings className="h-5 w-5" />
          <span>Collaboration Settings</span>
        </Button>
      </div>
    </div>
  );

  const renderWorkspaces = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Workspaces</h2>
          <p className="text-gray-600">Manage your collaborative workspaces</p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary-600 hover:bg-primary-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Workspace
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search workspaces..."
            className="pl-10"
          />
        </div>
        
        <select
          value={filterBy}
          onChange={(e) => setFilterBy(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="all">All Workspaces</option>
          <option value="starred">Starred</option>
          <option value="recent">Recent</option>
        </select>
      </div>

      {/* Workspaces Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWorkspaces.map((workspace) => (
          <Card
            key={workspace.id}
            className="p-6 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => handleWorkspaceSelect(workspace)}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-primary-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">
                    {workspace.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{workspace.name}</h3>
                  <p className="text-sm text-gray-600">
                    {workspace.memberCount} members
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {workspace.isStarred && (
                  <Star className="h-4 w-4 text-yellow-500 fill-current" />
                )}
                {workspace.isPublic ? (
                  <Globe className="h-4 w-4 text-green-600" />
                ) : (
                  <Lock className="h-4 w-4 text-gray-400" />
                )}
              </div>
            </div>
            
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
              {workspace.description}
            </p>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <PresenceIndicator
                  workspaceId={workspace.id}
                  userId="current-user"
                  authToken="mock-token"
                  maxVisible={3}
                  compact={true}
                />
                <span className="text-sm text-gray-600">
                  {workspace.onlineCount} online
                </span>
              </div>
              
              <Badge variant="secondary" className="text-xs">
                {workspace.userRole}
              </Badge>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {workspace.stats.totalOrders}
                  </p>
                  <p className="text-xs text-gray-600">Orders</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {workspace.stats.activeOrders}
                  </p>
                  <p className="text-xs text-gray-600">Active</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    ${workspace.stats.totalRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-600">Revenue</p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderMembers = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Team Members</h2>
          <p className="text-gray-600">Manage workspace members and roles</p>
        </div>
      </div>

      <RoleManager
        workspaceId="workspace-1"
        members={[
          {
            user_id: 'user-1',
            name: 'Sarah Kim',
            email: 'sarah@example.com',
            role: 'owner',
            joined_at: '2024-01-01T00:00:00Z',
            last_active: '2024-01-18T10:00:00Z',
            permissions: {
              can_create_orders: true,
              can_edit_orders: true,
              can_delete_orders: true,
              can_view_analytics: true,
              can_manage_payments: true,
              can_invite_members: true,
              can_chat: true
            }
          },
          {
            user_id: 'user-2',
            name: 'Mike Chen',
            email: 'mike@example.com',
            role: 'admin',
            joined_at: '2024-01-02T00:00:00Z',
            last_active: '2024-01-18T09:30:00Z',
            permissions: {
              can_create_orders: true,
              can_edit_orders: true,
              can_delete_orders: true,
              can_view_analytics: true,
              can_manage_payments: true,
              can_invite_members: true,
              can_chat: true
            }
          },
          {
            user_id: 'user-3',
            name: 'Lisa Wong',
            email: 'lisa@example.com',
            role: 'editor',
            joined_at: '2024-01-03T00:00:00Z',
            last_active: '2024-01-18T08:00:00Z',
            permissions: {
              can_create_orders: true,
              can_edit_orders: true,
              can_delete_orders: false,
              can_view_analytics: true,
              can_manage_payments: false,
              can_invite_members: false,
              can_chat: true
            }
          }
        ]}
        currentUserRole="admin"
        onMemberUpdate={(memberId, updates) => console.log('Update member:', memberId, updates)}
        onMemberRemove={(memberId) => console.log('Remove member:', memberId)}
        onMemberInvite={(email, role) => console.log('Invite member:', email, role)}
      />
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Collaboration Settings</h2>
          <p className="text-gray-600">Configure workspace settings and preferences</p>
        </div>
      </div>

      <WorkspaceSettings
        workspace={{
          id: 'workspace-1',
          name: 'KPOP Orders Team',
          description: 'Main workspace for K-pop merchandise group orders',
          isPublic: false,
          allowInvites: true,
          allowGuestAccess: false,
          defaultRole: 'editor',
          autoArchive: true,
          autoArchiveDays: 30,
          timezone: 'Asia/Seoul',
          language: 'en',
          theme: 'light',
          notifications: {
            email: true,
            push: true,
            sound: true,
            desktop: true,
            digest: true,
            digestFrequency: 'daily'
          },
          collaboration: {
            allowRealtimeEditing: true,
            showCursors: true,
            lockTimeout: 15,
            maxConcurrentEditors: 5,
            versionHistory: true,
            autosave: true,
            autosaveInterval: 30
          },
          security: {
            twoFactorRequired: false,
            passwordStrength: 'medium',
            sessionTimeout: 24,
            allowedDomains: [],
            ipWhitelist: []
          }
        }}
        userRole="admin"
        onUpdate={(settings) => console.log('Update settings:', settings)}
        onDelete={() => console.log('Delete workspace')}
        onExport={() => console.log('Export data')}
        onArchive={() => console.log('Archive workspace')}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Collaboration Toolbar */}
      <CollaborationToolbar
        position="top"
        compact={false}
        className="bg-white border-b border-gray-200"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Collaboration Hub</h1>
            <p className="text-gray-600 mt-1">
              Manage your team workspaces and collaborative projects
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <NotificationCenter
              notifications={mockNotifications}
              unreadCount={totalUnreadNotifications}
              onMarkAsRead={(ids) => console.log('Mark as read:', ids)}
              onMarkAllAsRead={() => console.log('Mark all as read')}
              onClearAll={() => console.log('Clear all')}
              onNotificationClick={handleNotificationClick}
              showAsDropdown={true}
              position="right"
            />
            
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary-600 hover:bg-primary-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Workspace
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 mb-8 border-b border-gray-200">
          {[
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'workspaces', label: 'Workspaces', icon: Users },
            { id: 'members', label: 'Members', icon: UserPlus },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
                className={cn(
                  "flex items-center space-x-2 px-4 py-2 rounded-t-lg transition-colors",
                  activeView === tab.id
                    ? "bg-primary-50 text-primary-700 border-b-2 border-primary-600"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeView === 'overview' && renderOverview()}
          {activeView === 'workspaces' && renderWorkspaces()}
          {activeView === 'members' && renderMembers()}
          {activeView === 'settings' && renderSettings()}
        </div>
      </div>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Workspace</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workspace Name
                </label>
                <Input placeholder="Enter workspace name" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                  placeholder="Describe your workspace..."
                />
              </div>
              
              <div className="flex items-center space-x-3">
                <input type="checkbox" id="public-workspace" className="rounded" />
                <label htmlFor="public-workspace" className="text-sm text-gray-700">
                  Make workspace public
                </label>
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-3 mt-6">
              <Button
                variant="ghost"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              
              <Button
                onClick={() => {
                  console.log('Creating workspace...');
                  setShowCreateModal(false);
                }}
                className="bg-primary-600 hover:bg-primary-700"
              >
                Create Workspace
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}