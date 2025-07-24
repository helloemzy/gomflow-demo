"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { StatCard } from "@/components/dashboard/stat-card";
import { OrderCard } from "@/components/dashboard/order-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  Users, 
  CreditCard, 
  TrendingUp,
  Plus,
  Clock,
  CheckCircle,
  AlertCircle,
  MessageSquare,
  UserPlus,
  Activity
} from "lucide-react";
import { useRouter } from "next/navigation";
import CollaborationToolbar from "@/components/collaboration/CollaborationToolbar";
import NotificationCenter from "@/components/collaboration/NotificationCenter";
import PresenceIndicator from "@/components/collaboration/PresenceIndicator";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Check if in demo mode
        const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
        
        if (isDemoMode) {
          // Set demo user
          setUser({ 
            id: 'demo-user-gom-1', 
            email: 'demo@gomflow.com', 
            name: 'Demo GOM',
            isDemoMode: true 
          });
          
          // Fetch dashboard data without authentication
          const response = await fetch('/api/dashboard');
          if (response.ok) {
            const data = await response.json();
            setDashboardData(data.data);
          }

          // Fetch recent orders without authentication
          const ordersResponse = await fetch('/api/orders?limit=6');
          if (ordersResponse.ok) {
            const ordersData = await ordersResponse.json();
            setRecentOrders(ordersData.data?.orders || []);
          }
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          setUser(user);

          if (!user) return;

          // Fetch dashboard statistics
          const response = await fetch('/api/dashboard', {
            headers: {
              'Authorization': `Bearer ${user.access_token}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            setDashboardData(data.data);
          }

          // Fetch recent orders
          const ordersResponse = await fetch('/api/orders?limit=6', {
            headers: {
              'Authorization': `Bearer ${user.access_token}`
            }
          });
          
          if (ordersResponse.ok) {
            const ordersData = await ordersResponse.json();
            setRecentOrders(ordersData.data);
          }
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [supabase]);

  const handleOrderAction = (action: string, orderId: string) => {
    switch (action) {
      case 'view':
        router.push(`/orders/${orderId}`);
        break;
      case 'manage':
        router.push(`/orders/${orderId}/manage`);
        break;
      case 'analytics':
        router.push(`/orders/${orderId}/analytics`);
        break;
      case 'submit':
        router.push(`/orders/${orderId}/submit`);
        break;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const userType = user?.user_metadata?.user_type || 'buyer';
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0];

  // Mock collaboration data
  const mockNotifications = [
    {
      id: 'notif-1',
      type: 'collaboration' as const,
      title: 'Team member joined',
      message: 'Sarah Kim joined your workspace',
      timestamp: '2024-01-18T10:30:00Z',
      isRead: false,
      isImportant: false,
      userName: 'Sarah Kim',
      actionUrl: '/collaboration'
    },
    {
      id: 'notif-2',
      type: 'activity' as const,
      title: 'Order edited',
      message: 'Mike Chen updated "BTS Album" order',
      timestamp: '2024-01-18T09:45:00Z',
      isRead: false,
      isImportant: true,
      userName: 'Mike Chen',
      actionUrl: '/orders/123'
    }
  ];

  const handleNotificationClick = (notification: any) => {
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  // GOM Dashboard
  if (userType === 'gom') {
    const stats = dashboardData || {};
    
    return (
      <DashboardLayout>
        {/* Collaboration Toolbar */}
        <CollaborationToolbar 
          position="top" 
          compact={false}
          className="mb-6"
        />
        
        <div className="space-y-6">
          {/* Welcome header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {displayName}!
              </h1>
              <p className="text-gray-600">
                Here's what's happening with your group orders today.
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <NotificationCenter
                notifications={mockNotifications}
                unreadCount={2}
                onMarkAsRead={(ids) => console.log('Mark as read:', ids)}
                onMarkAllAsRead={() => console.log('Mark all as read')}
                onClearAll={() => console.log('Clear all')}
                onNotificationClick={handleNotificationClick}
                showAsDropdown={true}
                position="right"
              />
              <Button onClick={() => router.push('/orders/create')}>
                <Plus className="h-4 w-4 mr-2" />
                Create Order
              </Button>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Orders"
              value={stats.totalOrders || 0}
              icon={Package}
              description="All-time orders created"
              color="primary"
            />
            <StatCard
              title="Active Orders"
              value={stats.activeOrders || 0}
              icon={Clock}
              description="Currently accepting submissions"
              color="success"
            />
            <StatCard
              title="Total Submissions"
              value={stats.totalSubmissions || 0}
              icon={Users}
              description="Across all orders"
              color="secondary"
            />
            <StatCard
              title="Total Revenue"
              value={`₱${(stats.totalRevenue || 0).toLocaleString()}`}
              icon={TrendingUp}
              description="Confirmed payments"
              color="success"
            />
          </div>

          {/* Payment Management Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Payment Management
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/gom/payment-analytics')}
                >
                  View Analytics
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 mb-1">
                    94.7%
                  </div>
                  <div className="text-sm text-gray-600">Success Rate</div>
                  <div className="text-xs text-gray-500 mt-1">+2.3% this month</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    18.5m
                  </div>
                  <div className="text-sm text-gray-600">Avg Processing</div>
                  <div className="text-xs text-gray-500 mt-1">-5.2m faster</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 mb-1">
                    5
                  </div>
                  <div className="text-sm text-gray-600">Active Methods</div>
                  <div className="text-xs text-gray-500 mt-1">GCash, PayMaya, etc.</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/gom/verify-payments')}
                >
                  Verify Payments
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/gom/payment-setup')}
                >
                  Payment Settings
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/orders?filter=pending_payment')}
                >
                  Pending Payments
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pending Payments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-orange-600">
                  {stats.pendingPayments || 0}
                </div>
                <p className="text-sm text-gray-500">
                  ₱{(stats.pendingRevenue || 0).toLocaleString()} pending
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Overdue Payments</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">
                  {stats.overduePayments || 0}
                </div>
                <p className="text-sm text-gray-500">
                  Need follow-up
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {stats.totalSubmissions > 0 ? 
                    Math.round(((stats.totalSubmissions - (stats.pendingPayments || 0)) / stats.totalSubmissions) * 100) : 0}%
                </div>
                <p className="text-sm text-gray-500">
                  Payment confirmation rate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Collaboration Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <UserPlus className="h-5 w-5 mr-2" />
                  Team Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Activity className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Sarah Kim joined workspace</p>
                      <p className="text-xs text-gray-500">2 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <MessageSquare className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">New message in team chat</p>
                      <p className="text-xs text-gray-500">15 minutes ago</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <Package className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Order locked for editing</p>
                      <p className="text-xs text-gray-500">1 hour ago</p>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-4"
                  onClick={() => router.push('/collaboration')}
                >
                  View Collaboration Hub
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Active Team Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        S
                      </div>
                      <div>
                        <p className="text-sm font-medium">Sarah Kim</p>
                        <p className="text-xs text-gray-500">Admin</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-gray-500">online</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        M
                      </div>
                      <div>
                        <p className="text-sm font-medium">Mike Chen</p>
                        <p className="text-xs text-gray-500">Editor</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-gray-500">online</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-red-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        L
                      </div>
                      <div>
                        <p className="text-sm font-medium">Lisa Wong</p>
                        <p className="text-xs text-gray-500">Viewer</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-xs text-gray-500">away</span>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-4"
                  onClick={() => router.push('/collaboration')}
                >
                  Manage Team
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent orders */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Recent Orders</h2>
              <Button variant="outline" onClick={() => router.push('/orders')}>
                View All
              </Button>
            </div>
            
            {recentOrders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recentOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    variant="gom"
                    onAction={handleOrderAction}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No orders yet
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Create your first group order to get started.
                  </p>
                  <Button onClick={() => router.push('/orders/create')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Order
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Buyer Dashboard
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {displayName}!
            </h1>
            <p className="text-gray-600">
              Discover new group orders and track your submissions.
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <NotificationCenter
              notifications={mockNotifications}
              unreadCount={2}
              onMarkAsRead={(ids) => console.log('Mark as read:', ids)}
              onMarkAllAsRead={() => console.log('Mark all as read')}
              onClearAll={() => console.log('Clear all')}
              onNotificationClick={handleNotificationClick}
              showAsDropdown={true}
              position="right"
            />
            <Button onClick={() => router.push('/browse')}>
              Browse Orders
            </Button>
          </div>
        </div>

        {/* Quick stats for buyers */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Active Orders"
            value={dashboardData?.activeSubmissions || 0}
            icon={Clock}
            description="Orders awaiting delivery"
            color="primary"
          />
          <StatCard
            title="Pending Payments"
            value={dashboardData?.pendingPayments || 0}
            icon={AlertCircle}
            description="Need payment confirmation"
            color="warning"
          />
          <StatCard
            title="Completed Orders"
            value={dashboardData?.completedOrders || 0}
            icon={CheckCircle}
            description="Successfully delivered"
            color="success"
          />
          <StatCard
            title="Workspaces"
            value={2}
            icon={UserPlus}
            description="Collaborative workspaces"
            color="secondary"
          />
        </div>

        {/* Collaboration Section for Buyers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              Collaboration Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Recent Activity</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-sm">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>You joined "KPOP Orders Team" workspace</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>New message in team chat</span>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span>Order status updated</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-3">Available Workspaces</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-primary-600 rounded text-white text-xs flex items-center justify-center">K</div>
                      <span className="text-sm">KPOP Orders Team</span>
                    </div>
                    <span className="text-xs text-gray-500">Member</span>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-purple-600 rounded text-white text-xs flex items-center justify-center">B</div>
                      <span className="text-sm">BTS Collection Hub</span>
                    </div>
                    <span className="text-xs text-gray-500">Viewer</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => router.push('/collaboration')}
              >
                View All Workspaces
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent/Available orders */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Available Orders</h2>
            <Button variant="outline" onClick={() => router.push('/browse')}>
              Browse All
            </Button>
          </div>
          
          {recentOrders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentOrders.filter(order => order.is_active).slice(0, 6).map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  variant="buyer"
                  onAction={handleOrderAction}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No active orders available
                </h3>
                <p className="text-gray-500 mb-4">
                  Check back later for new group orders from your favorite GOMs.
                </p>
                <Button onClick={() => router.push('/browse')}>
                  Browse All Orders
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}