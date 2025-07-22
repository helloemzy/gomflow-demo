"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { OrderCard } from "@/components/dashboard/order-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  Filter,
  Package,
  SortAsc,
  SortDesc,
  Calendar,
  DollarSign,
  UserPlus,
  MessageSquare,
  Lock,
  Users
} from "lucide-react";
import CollaborationToolbar from "@/components/collaboration/CollaborationToolbar";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [user, setUser] = useState<any>(null);
  
  const router = useRouter();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (!user) return;

        const response = await fetch('/api/orders', {
          headers: {
            'Authorization': `Bearer ${user.access_token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setOrders(data.data);
          setFilteredOrders(data.data);
        }
      } catch (error) {
        console.error('Error fetching orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [supabase]);

  useEffect(() => {
    let filtered = [...orders];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(order => {
        switch (statusFilter) {
          case "active":
            return order.is_active && new Date(order.deadline) > new Date();
          case "closed":
            return !order.is_active;
          case "expired":
            return order.is_active && new Date(order.deadline) <= new Date();
          case "completed":
            return order.status === "completed";
          default:
            return true;
        }
      });
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(order => order.category === categoryFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case "title":
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case "price":
          aValue = a.price;
          bValue = b.price;
          break;
        case "deadline":
          aValue = new Date(a.deadline);
          bValue = new Date(b.deadline);
          break;
        case "submissions":
          aValue = a.submission_count || 0;
          bValue = b.submission_count || 0;
          break;
        default: // created_at
          aValue = new Date(a.created_at);
          bValue = new Date(b.created_at);
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredOrders(filtered);
  }, [orders, searchTerm, statusFilter, categoryFilter, sortBy, sortOrder]);

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

  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const getStatusBadge = (order: any) => {
    const now = new Date();
    const deadline = new Date(order.deadline);
    
    if (!order.is_active) {
      return <Badge variant="secondary">Closed</Badge>;
    }
    
    if (deadline <= now) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    
    if (order.status === "completed") {
      return <Badge className="bg-green-500">Completed</Badge>;
    }
    
    return <Badge className="bg-blue-500">Active</Badge>;
  };

  const userType = user?.user_metadata?.user_type || 'buyer';

  if (loading) {
    return (
      <DashboardLayout requiredRole={userType === 'gom' ? 'gom' : undefined}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requiredRole={userType === 'gom' ? 'gom' : undefined}>
      {/* Collaboration Toolbar for GOMs */}
      {userType === 'gom' && (
        <CollaborationToolbar 
          position="top" 
          compact={true}
          className="mb-4"
        />
      )}
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {userType === 'gom' ? 'My Orders' : 'Available Orders'}
            </h1>
            <p className="text-gray-600">
              {userType === 'gom' 
                ? 'Manage all your group orders in one place'
                : 'Browse and join group orders from trusted GOMs'
              }
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {userType === 'gom' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => router.push('/collaboration')}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Team Workspace
                </Button>
                <Button onClick={() => router.push('/orders/create')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Order
                </Button>
              </>
            )}
            {userType === 'buyer' && (
              <Button
                variant="outline"
                onClick={() => router.push('/collaboration')}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Join Workspace
              </Button>
            )}
          </div>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="expired">Expired</option>
                <option value="completed">Completed</option>
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="all">All Categories</option>
                <option value="album">Album</option>
                <option value="merchandise">Merchandise</option>
                <option value="photocard">Photocard</option>
                <option value="fashion">Fashion</option>
                <option value="collectible">Collectible</option>
                <option value="other">Other</option>
              </select>

              {/* Sort */}
              <div className="flex gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="flex-1 px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="created_at">Date Created</option>
                  <option value="title">Title</option>
                  <option value="price">Price</option>
                  <option value="deadline">Deadline</option>
                  <option value="submissions">Submissions</option>
                </select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                >
                  {sortOrder === "asc" ? (
                    <SortAsc className="h-4 w-4" />
                  ) : (
                    <SortDesc className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Active filters display */}
            <div className="flex flex-wrap gap-2 mt-4">
              {searchTerm && (
                <Badge variant="outline" className="cursor-pointer" onClick={() => setSearchTerm("")}>
                  Search: {searchTerm} ×
                </Badge>
              )}
              {statusFilter !== "all" && (
                <Badge variant="outline" className="cursor-pointer" onClick={() => setStatusFilter("all")}>
                  Status: {statusFilter} ×
                </Badge>
              )}
              {categoryFilter !== "all" && (
                <Badge variant="outline" className="cursor-pointer" onClick={() => setCategoryFilter("all")}>
                  Category: {categoryFilter} ×
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {filteredOrders.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-primary">{filteredOrders.length}</div>
                <div className="text-sm text-gray-600">Total Orders</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {filteredOrders.filter(o => o.is_active && new Date(o.deadline) > new Date()).length}
                </div>
                <div className="text-sm text-gray-600">Active</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {filteredOrders.reduce((sum, o) => sum + (o.submission_count || 0), 0)}
                </div>
                <div className="text-sm text-gray-600">Total Submissions</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  ₱{filteredOrders.reduce((sum, o) => sum + (o.price * (o.submission_count || 0)), 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Total Value</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Orders Grid */}
        {filteredOrders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOrders.map((order) => (
              <div key={order.id} className="relative">
                <OrderCard
                  order={order}
                  variant={userType === 'gom' ? 'gom' : 'buyer'}
                  onAction={handleOrderAction}
                />
                <div className="absolute top-4 right-4">
                  {getStatusBadge(order)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {orders.length === 0 
                  ? (userType === 'gom' ? 'No orders created yet' : 'No orders available')
                  : 'No orders match your filters'
                }
              </h3>
              <p className="text-gray-500 mb-4">
                {orders.length === 0
                  ? (userType === 'gom' 
                      ? 'Create your first group order to get started.'
                      : 'Check back later for new group orders from GOMs.'
                    )
                  : 'Try adjusting your search criteria or filters.'
                }
              </p>
              {orders.length === 0 && userType === 'gom' && (
                <Button onClick={() => router.push('/orders/create')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Order
                </Button>
              )}
              {orders.length === 0 && userType === 'buyer' && (
                <Button onClick={() => router.push('/browse')}>
                  Browse All Orders
                </Button>
              )}
              {orders.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                    setCategoryFilter("all");
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pagination could be added here for large datasets */}
        {filteredOrders.length > 12 && (
          <div className="flex justify-center">
            <p className="text-sm text-gray-500">
              Showing {filteredOrders.length} of {orders.length} orders
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}