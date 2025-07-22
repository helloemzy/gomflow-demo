// GOMFLOW Workspace Page
// Main collaboration workspace interface

"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  MessageSquare, 
  FileText, 
  BarChart3,
  Settings,
  Plus,
  ArrowLeft,
  Eye,
  Edit,
  Trash2,
  Crown,
  Shield,
  Clock,
  Activity,
  AlertCircle,
  CheckCircle,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Bell,
  BellOff,
  Star,
  Archive,
  Filter,
  Search
} from 'lucide-react';

// Components
import WorkspaceManager from '@/components/collaboration/WorkspaceManager';
import CollaborativeEditor from '@/components/collaboration/CollaborativeEditor';
import PresenceIndicator from '@/components/collaboration/PresenceIndicator';
import TeamChat from '@/components/collaboration/TeamChat';
import { useCollaboration } from '@/hooks/useCollaboration';

// Types
import { 
  Workspace, 
  WorkspaceMember, 
  CollaborativeOrder,
  WorkspaceRole,
  ActivityFeed,
  PresenceStatus
} from '@/lib/collaboration/types';

interface WorkspacePageProps {
  params: { id: string };
}

interface WorkspaceStats {
  totalOrders: number;
  activeOrders: number;
  totalMembers: number;
  onlineMembers: number;
  totalRevenue: number;
  recentActivity: number;
}

// Define page as default export function
export default function WorkspacePage({ params }: WorkspacePageProps) {
  return <WorkspacePageComponent params={params} />;
}

// Main component logic
const WorkspacePageComponent: React.FC<WorkspacePageProps> = ({ params }) => {
  const router = useRouter();
  const workspaceId = params.id;
  
  // Get user data (in real app, this would come from auth context)
  const [userId, setUserId] = useState<string>('');
  const [authToken, setAuthToken] = useState<string>('');
  const [userRole, setUserRole] = useState<WorkspaceRole | null>(null);
  
  // UI state
  const [selectedView, setSelectedView] = useState<'overview' | 'orders' | 'chat' | 'settings'>('overview');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [orderFilter, setOrderFilter] = useState<'all' | 'active' | 'completed' | 'draft'>('all');
  
  // Data state
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceStats, setWorkspaceStats] = useState<WorkspaceStats | null>(null);
  const [orders, setOrders] = useState<CollaborativeOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Collaboration hook
  const { state, actions } = useCollaboration({
    workspaceId,
    userId,
    authToken,
    autoConnect: true
  });

  // Load initial data
  useEffect(() => {
    loadWorkspaceData();
    loadUserSession();
  }, [workspaceId]);

  // Update presence
  useEffect(() => {
    if (state.isConnected) {
      actions.updatePresence('online', 'workspace');
    }
  }, [state.isConnected, actions]);

  const loadUserSession = async () => {
    try {
      // In a real app, this would check authentication
      const response = await fetch('/api/auth/session', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (response.ok) {
        const session = await response.json();
        setUserId(session.user.id);
        setAuthToken(session.access_token);
        setUserRole(session.user.role);
      }
    } catch (error) {
      console.error('Error loading user session:', error);
      router.push('/auth/login');
    }
  };

  const loadWorkspaceData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load workspace details
      const workspaceRes = await fetch(`/api/collaboration/workspaces/${workspaceId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (!workspaceRes.ok) {
        throw new Error('Failed to load workspace');
      }
      
      const workspaceData = await workspaceRes.json();
      setWorkspace(workspaceData.data);

      // Load workspace stats
      const statsRes = await fetch(`/api/collaboration/workspaces/${workspaceId}/stats`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setWorkspaceStats(stats.data);
      }

      // Load orders
      const ordersRes = await fetch(`/api/collaboration/workspaces/${workspaceId}/orders`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.data || []);
      }

    } catch (err) {
      console.error('Error loading workspace data:', err);
      setError('Failed to load workspace data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    router.push(`/orders/create?workspace=${workspaceId}`);
  };

  const handleEditOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setShowEditor(true);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setSelectedOrderId(null);
  };

  const handleLeaveWorkspace = async () => {
    try {
      await actions.leaveWorkspace();
      router.push('/dashboard');
    } catch (error) {
      console.error('Error leaving workspace:', error);
    }
  };

  const getRoleIcon = (role: WorkspaceRole) => {
    switch (role) {
      case 'owner': return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin': return <Shield className="w-4 h-4 text-blue-500" />;
      case 'editor': return <Edit className="w-4 h-4 text-green-500" />;
      case 'viewer': return <Eye className="w-4 h-4 text-gray-500" />;
      default: return null;
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = orderFilter === 'all' || order.status === orderFilter;
    return matchesSearch && matchesFilter;
  });

  const canManageWorkspace = userRole === 'owner' || userRole === 'admin';
  const canEditOrders = actions.hasPermission('edit_orders');
  const canCreateOrders = actions.hasPermission('create_orders');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold">
                  {workspace?.name || 'Workspace'}
                </h1>
                {userRole && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    {getRoleIcon(userRole)}
                    {userRole}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Presence Indicator */}
              <PresenceIndicator
                workspaceId={workspaceId}
                currentPage="workspace"
                members={state.workspaceMembers}
                presenceData={state.presenceData}
                compact={true}
              />
              
              {/* Notifications */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNotifications(!notifications)}
              >
                {notifications ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </Button>
              
              {/* Chat Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowChat(!showChat)}
                className="relative"
              >
                <MessageSquare className="w-4 h-4" />
                {state.unreadCount > 0 && (
                  <Badge variant="destructive" className="absolute -top-2 -right-2 w-5 h-5 text-xs">
                    {state.unreadCount}
                  </Badge>
                )}
              </Button>
              
              {/* Fullscreen Toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
              
              {/* Settings */}
              {canManageWorkspace && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedView('settings')}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1">
            {/* Navigation Tabs */}
            <div className="flex gap-2 mb-6">
              <Button
                variant={selectedView === 'overview' ? 'default' : 'outline'}
                onClick={() => setSelectedView('overview')}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Overview
              </Button>
              <Button
                variant={selectedView === 'orders' ? 'default' : 'outline'}
                onClick={() => setSelectedView('orders')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Orders ({orders.length})
              </Button>
              <Button
                variant={selectedView === 'chat' ? 'default' : 'outline'}
                onClick={() => setSelectedView('chat')}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Chat
                {state.unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {state.unreadCount}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Content Area */}
            {selectedView === 'overview' && (
              <div className="space-y-6">
                {/* Stats Cards */}
                {workspaceStats && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Total Orders</p>
                            <p className="text-2xl font-bold">{workspaceStats.totalOrders}</p>
                          </div>
                          <FileText className="w-8 h-8 text-blue-500" />
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Active Orders</p>
                            <p className="text-2xl font-bold">{workspaceStats.activeOrders}</p>
                          </div>
                          <Activity className="w-8 h-8 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Team Members</p>
                            <p className="text-2xl font-bold">{workspaceStats.totalMembers}</p>
                          </div>
                          <Users className="w-8 h-8 text-purple-500" />
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Online Now</p>
                            <p className="text-2xl font-bold">{workspaceStats.onlineMembers}</p>
                          </div>
                          <CheckCircle className="w-8 h-8 text-green-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {state.activityFeed.slice(0, 5).map((activity) => (
                        <div key={activity.id} className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <div className="flex-1">
                            <p className="text-sm">{activity.activity_type}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(activity.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                      {state.activityFeed.length === 0 && (
                        <p className="text-sm text-gray-500">No recent activity</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {selectedView === 'orders' && (
              <div className="space-y-6">
                {/* Orders Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Orders</h2>
                  {canCreateOrders && (
                    <Button onClick={handleCreateOrder}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Order
                    </Button>
                  )}
                </div>

                {/* Search and Filter */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search orders..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={orderFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setOrderFilter('all')}
                    >
                      All
                    </Button>
                    <Button
                      variant={orderFilter === 'active' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setOrderFilter('active')}
                    >
                      Active
                    </Button>
                    <Button
                      variant={orderFilter === 'completed' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setOrderFilter('completed')}
                    >
                      Completed
                    </Button>
                    <Button
                      variant={orderFilter === 'draft' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setOrderFilter('draft')}
                    >
                      Draft
                    </Button>
                  </div>
                </div>

                {/* Orders List */}
                <div className="grid gap-4">
                  {filteredOrders.map((order) => (
                    <Card key={order.order_id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold">{order.title}</h3>
                              <Badge className={getOrderStatusColor(order.status)}>
                                {order.status}
                              </Badge>
                              {actions.getOrderLockStatus(order.order_id).isLocked && (
                                <Badge variant="outline" className="text-yellow-600">
                                  Locked
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{order.description}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>Last edited: {new Date(order.last_edited_at).toLocaleString()}</span>
                              <span>Version: {order.version}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/orders/${order.order_id}`)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {canEditOrders && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditOrder(order.order_id)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {filteredOrders.length === 0 && (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No orders found</h3>
                        <p className="text-gray-600 mb-4">
                          {searchTerm ? 'No orders match your search criteria.' : 'Get started by creating your first order.'}
                        </p>
                        {canCreateOrders && (
                          <Button onClick={handleCreateOrder}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create Order
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {selectedView === 'chat' && (
              <div className="h-96">
                <TeamChat
                  workspaceId={workspaceId}
                  userId={userId}
                  authToken={authToken}
                  height="h-full"
                />
              </div>
            )}
          </div>

          {/* Sidebar */}
          {showChat && (
            <div className="w-80 flex-shrink-0">
              <TeamChat
                workspaceId={workspaceId}
                userId={userId}
                authToken={authToken}
                compact={true}
                onClose={() => setShowChat(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Collaborative Editor Modal */}
      {showEditor && selectedOrderId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="w-full max-w-6xl h-full max-h-[90vh] m-4">
            <CollaborativeEditor
              workspaceId={workspaceId}
              orderId={selectedOrderId}
              userId={userId}
              authToken={authToken}
              onClose={handleCloseEditor}
            />
          </div>
        </div>
      )}
    </div>
  );
};