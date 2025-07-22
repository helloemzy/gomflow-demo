"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  MapPin,
  Package,
  Users,
  AlertCircle,
  CheckCircle,
  XCircle,
  Edit,
  Share2,
  BarChart3,
  MessageSquare
} from "lucide-react";

export default function OrderDetailPage() {
  const [order, setOrder] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  const router = useRouter();
  const params = useParams();
  const supabase = createClientComponentClient();
  const orderId = params.id;

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);

        if (!user || !orderId) return;

        // Fetch order details
        const orderResponse = await fetch(`/api/orders/${orderId}`, {
          headers: {
            'Authorization': `Bearer ${user.access_token}`
          }
        });
        
        if (orderResponse.ok) {
          const orderData = await orderResponse.json();
          setOrder(orderData.data);
        }

        // Fetch submissions if user is the order owner
        const submissionsResponse = await fetch(`/api/orders/${orderId}/submissions`, {
          headers: {
            'Authorization': `Bearer ${user.access_token}`
          }
        });
        
        if (submissionsResponse.ok) {
          const submissionsData = await submissionsResponse.json();
          setSubmissions(submissionsData.data || []);
        }
      } catch (error) {
        console.error('Error fetching order details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderDetails();
  }, [supabase, orderId]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Order not found</h3>
          <p className="text-gray-500 mb-4">This order may have been deleted or you don't have access to it.</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </DashboardLayout>
    );
  }

  const userType = user?.user_metadata?.user_type || 'buyer';
  const isOwner = order.gom_id === user?.id;
  const now = new Date();
  const deadline = new Date(order.deadline);
  const isExpired = deadline <= now;
  const isActive = order.is_active && !isExpired;

  const getStatusInfo = () => {
    if (!order.is_active) {
      return { text: 'Closed', color: 'bg-gray-500', icon: XCircle };
    }
    if (isExpired) {
      return { text: 'Expired', color: 'bg-red-500', icon: AlertCircle };
    }
    if (order.status === 'completed') {
      return { text: 'Completed', color: 'bg-green-500', icon: CheckCircle };
    }
    return { text: 'Active', color: 'bg-blue-500', icon: Clock };
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  const progressPercentage = order.max_orders 
    ? Math.min((order.submission_count / order.max_orders) * 100, 100)
    : Math.min((order.submission_count / order.min_orders) * 100, 100);

  const canSubmit = isActive && (!order.max_orders || order.submission_count < order.max_orders);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{order.title}</h1>
              <Badge className={statusInfo.color}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {statusInfo.text}
              </Badge>
            </div>
            <p className="text-gray-600">Order #{order.id.slice(0, 8)}</p>
          </div>
          <div className="flex gap-2">
            {isOwner && (
              <>
                <Button variant="outline" onClick={() => router.push(`/orders/${orderId}/manage`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Manage
                </Button>
                <Button variant="outline" onClick={() => router.push(`/orders/${orderId}/analytics`)}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics
                </Button>
              </>
            )}
            <Button variant="outline">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            {canSubmit && userType === 'buyer' && (
              <Button onClick={() => router.push(`/orders/${orderId}/submit`)}>
                Join Order
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Order Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {order.description && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                    <p className="text-gray-600 whitespace-pre-wrap">{order.description}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Category</h4>
                    <p className="text-gray-600 capitalize">{order.category}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Price</h4>
                    <p className="text-gray-600 font-mono">
                      {order.currency === 'PHP' ? '₱' : 'RM'}{order.price.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Shipping From</h4>
                    <p className="text-gray-600">{order.shipping_from}</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Created</h4>
                    <p className="text-gray-600">
                      {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Progress and Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Order Progress
                </CardTitle>
                <CardDescription>
                  {order.submission_count} of {order.min_orders} minimum orders 
                  {order.max_orders && ` (max ${order.max_orders})`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Progress</span>
                    <span>{progressPercentage.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0</span>
                    <span>{order.min_orders} min</span>
                    {order.max_orders && <span>{order.max_orders} max</span>}
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{order.submission_count}</div>
                    <div className="text-sm text-gray-600">Submissions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {submissions.filter(s => s.payment_status === 'confirmed').length}
                    </div>
                    <div className="text-sm text-gray-600">Confirmed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {submissions.filter(s => s.payment_status === 'pending').length}
                    </div>
                    <div className="text-sm text-gray-600">Pending</div>
                  </div>
                </div>

                {/* Goal Status */}
                {order.submission_count >= order.min_orders ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-green-800 font-medium">
                      Minimum order quantity reached! Order is guaranteed to proceed.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-blue-600" />
                    <span className="text-blue-800">
                      Need {order.min_orders - order.submission_count} more orders to reach minimum quantity.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Submissions (for order owner) */}
            {isOwner && submissions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Recent Submissions
                  </CardTitle>
                  <CardDescription>
                    Latest submissions for this order
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {submissions.slice(0, 5).map((submission) => (
                      <div key={submission.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{submission.buyer_name}</div>
                          <div className="text-sm text-gray-600">{submission.buyer_phone}</div>
                          <div className="text-xs text-gray-500">
                            {new Date(submission.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm">
                            {order.currency === 'PHP' ? '₱' : 'RM'}{submission.quantity * order.price}
                          </div>
                          <Badge 
                            variant={submission.payment_status === 'confirmed' ? 'default' : 'secondary'}
                            className={
                              submission.payment_status === 'confirmed' 
                                ? 'bg-green-500' 
                                : submission.payment_status === 'pending'
                                ? 'bg-orange-500'
                                : 'bg-gray-500'
                            }
                          >
                            {submission.payment_status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {submissions.length > 5 && (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => router.push(`/orders/${orderId}/manage`)}
                      >
                        View All {submissions.length} Submissions
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="font-medium">Deadline</div>
                    <div className="text-sm text-gray-600">
                      {deadline.toLocaleDateString()} at {deadline.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                    {!isExpired && (
                      <div className="text-xs text-orange-600">
                        {Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days remaining
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="font-medium">Total Value</div>
                    <div className="text-sm text-gray-600 font-mono">
                      {order.currency === 'PHP' ? '₱' : 'RM'}{(order.submission_count * order.price).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="font-medium">Shipping</div>
                    <div className="text-sm text-gray-600">{order.shipping_from}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="font-medium">Order Range</div>
                    <div className="text-sm text-gray-600">
                      {order.min_orders} - {order.max_orders || '∞'} items
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {canSubmit && userType === 'buyer' && (
                  <Button className="w-full" onClick={() => router.push(`/orders/${orderId}/submit`)}>
                    Join This Order
                  </Button>
                )}
                
                {isOwner && (
                  <>
                    <Button variant="outline" className="w-full" onClick={() => router.push(`/orders/${orderId}/manage`)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Manage Order
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => router.push(`/orders/${orderId}/analytics`)}>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      View Analytics
                    </Button>
                  </>
                )}
                
                <Button variant="outline" className="w-full">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Order
                </Button>
              </CardContent>
            </Card>

            {/* GOM Info */}
            {!isOwner && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Order Manager</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Users className="h-6 w-6 text-primary-600" />
                    </div>
                    <div className="font-medium">{order.gom_name || 'Group Order Manager'}</div>
                    <div className="text-sm text-gray-600 mb-3">{order.gom_country}</div>
                    <Button variant="outline" size="sm" className="w-full">
                      View Profile
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}