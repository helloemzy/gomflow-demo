"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft,
  Users,
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  MessageSquare,
  Edit,
  Settings,
  MoreHorizontal,
  Mail,
  Phone
} from "lucide-react";

export default function ManageOrderPage() {
  const [order, setOrder] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSubmissions, setSelectedSubmissions] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);
  
  const router = useRouter();
  const params = useParams();
  const supabase = createClientComponentClient();
  const orderId = params.id;

  useEffect(() => {
    const fetchOrderData = async () => {
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
          
          // Verify user is the order owner
          if (orderData.data.gom_id !== user.id) {
            router.push('/dashboard');
            return;
          }
        }

        // Fetch submissions
        const submissionsResponse = await fetch(`/api/orders/${orderId}/submissions`, {
          headers: {
            'Authorization': `Bearer ${user.access_token}`
          }
        });
        
        if (submissionsResponse.ok) {
          const submissionsData = await submissionsResponse.json();
          setSubmissions(submissionsData.data || []);
          setFilteredSubmissions(submissionsData.data || []);
        }
      } catch (error) {
        console.error('Error fetching order data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrderData();
  }, [supabase, orderId, router]);

  useEffect(() => {
    let filtered = [...submissions];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(submission =>
        submission.buyer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        submission.buyer_phone.includes(searchTerm) ||
        submission.buyer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        submission.payment_reference.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(submission => submission.payment_status === statusFilter);
    }

    setFilteredSubmissions(filtered);
  }, [submissions, searchTerm, statusFilter]);

  const handleStatusUpdate = async (submissionId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/submissions/${submissionId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.access_token}`
        },
        body: JSON.stringify({ payment_status: newStatus })
      });

      if (response.ok) {
        // Update local state
        setSubmissions(prev => 
          prev.map(sub => 
            sub.id === submissionId 
              ? { ...sub, payment_status: newStatus, updated_at: new Date().toISOString() }
              : sub
          )
        );
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedSubmissions.length === 0) return;

    try {
      const promises = selectedSubmissions.map(submissionId => {
        let newStatus = '';
        switch (action) {
          case 'confirm':
            newStatus = 'confirmed';
            break;
          case 'reject':
            newStatus = 'rejected';
            break;
          default:
            return Promise.resolve();
        }

        return fetch(`/api/submissions/${submissionId}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.access_token}`
          },
          body: JSON.stringify({ payment_status: newStatus })
        });
      });

      await Promise.all(promises);
      
      // Refresh submissions
      window.location.reload();
    } catch (error) {
      console.error('Error with bulk action:', error);
    }
  };

  const exportSubmissions = () => {
    const csvContent = [
      ['Name', 'Phone', 'Email', 'Quantity', 'Amount', 'Payment Method', 'Status', 'Reference', 'Date'].join(','),
      ...filteredSubmissions.map(sub => [
        sub.buyer_name,
        sub.buyer_phone,
        sub.buyer_email,
        sub.quantity,
        (sub.quantity * order.price).toFixed(2),
        sub.payment_method,
        sub.payment_status,
        sub.payment_reference,
        new Date(sub.created_at).toLocaleDateString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order-${orderId}-submissions.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Confirmed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'pending_verification':
        return <Badge className="bg-orange-500"><AlertCircle className="h-3 w-3 mr-1" />Needs Review</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <DashboardLayout requiredRole="gom">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout requiredRole="gom">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Order not found</h3>
          <p className="text-gray-500 mb-4">This order may have been deleted or you don't have access to it.</p>
          <Button onClick={() => router.push('/orders')}>Back to Orders</Button>
        </div>
      </DashboardLayout>
    );
  }

  const stats = {
    total: submissions.length,
    confirmed: submissions.filter(s => s.payment_status === 'confirmed').length,
    pending: submissions.filter(s => s.payment_status === 'pending').length,
    needsReview: submissions.filter(s => s.payment_status === 'pending_verification').length,
    totalRevenue: submissions
      .filter(s => s.payment_status === 'confirmed')
      .reduce((sum, s) => sum + (s.quantity * order.price), 0)
  };

  return (
    <DashboardLayout requiredRole="gom">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Manage Order</h1>
            <p className="text-gray-600">{order.title}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push(`/orders/${orderId}`)}>
              <Eye className="h-4 w-4 mr-2" />
              View Order
            </Button>
            <Button variant="outline" onClick={() => router.push(`/orders/${orderId}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-sm text-gray-600">Total Submissions</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
              <div className="text-sm text-gray-600">Confirmed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.needsReview}</div>
              <div className="text-sm text-gray-600">Needs Review</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">{stats.pending}</div>
              <div className="text-sm text-gray-600">Pending Payment</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {order.currency === 'PHP' ? '₱' : 'RM'}{stats.totalRevenue.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Confirmed Revenue</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex gap-4 flex-1">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search buyers, phone, email, or reference..."
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
                  <option value="pending">Pending Payment</option>
                  <option value="pending_verification">Needs Review</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div className="flex gap-2">
                {selectedSubmissions.length > 0 && (
                  <>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleBulkAction('confirm')}
                    >
                      Confirm Selected ({selectedSubmissions.length})
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleBulkAction('reject')}
                    >
                      Reject Selected
                    </Button>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={exportSubmissions}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submissions Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Submissions ({filteredSubmissions.length})
            </CardTitle>
            <CardDescription>
              Manage buyer submissions and payment confirmations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredSubmissions.length > 0 ? (
              <div className="space-y-4">
                {filteredSubmissions.map((submission) => (
                  <div key={submission.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedSubmissions.includes(submission.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSubmissions(prev => [...prev, submission.id]);
                            } else {
                              setSelectedSubmissions(prev => prev.filter(id => id !== submission.id));
                            }
                          }}
                          className="rounded"
                        />
                        <div>
                          <div className="font-medium text-gray-900">{submission.buyer_name}</div>
                          <div className="text-sm text-gray-600 flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {submission.buyer_phone}
                            </span>
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {submission.buyer_email}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Ref: {submission.payment_reference} • 
                            {new Date(submission.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="font-medium">
                            Qty: {submission.quantity}
                          </div>
                          <div className="text-sm font-mono">
                            {order.currency === 'PHP' ? '₱' : 'RM'}{(submission.quantity * order.price).toFixed(2)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {getStatusBadge(submission.payment_status)}
                          
                          {submission.payment_status === 'pending_verification' && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusUpdate(submission.id, 'confirmed')}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusUpdate(submission.id, 'rejected')}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}

                          {submission.payment_proof_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(submission.payment_proof_url, '_blank')}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              View Proof
                            </Button>
                          )}

                          <Button size="sm" variant="ghost">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Contact
                          </Button>
                        </div>
                      </div>
                    </div>

                    {submission.special_instructions && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="text-sm font-medium text-blue-800 mb-1">Special Instructions:</div>
                        <div className="text-sm text-blue-700">{submission.special_instructions}</div>
                      </div>
                    )}

                    {submission.delivery_address && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Delivery:</span> {submission.delivery_address}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {submissions.length === 0 ? 'No submissions yet' : 'No submissions match your filters'}
                </h3>
                <p className="text-gray-500">
                  {submissions.length === 0 
                    ? 'Submissions will appear here once buyers join your order.'
                    : 'Try adjusting your search or filter criteria.'
                  }
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}