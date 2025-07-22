"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import AnalyticsDashboard from "@/components/analytics/AnalyticsDashboard";
import { 
  ArrowLeft,
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  Calendar,
  MapPin,
  CreditCard,
  BarChart3,
  PieChart,
  Activity
} from "lucide-react";

export default function OrderAnalyticsPage() {
  const [order, setOrder] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  const router = useRouter();
  const params = useParams();
  const supabase = createClientComponentClient();
  const orderId = params.id;

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
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

      // Fetch submissions for analytics
      const submissionsResponse = await fetch(`/api/orders/${orderId}/submissions`, {
        headers: {
          'Authorization': `Bearer ${user.access_token}`
        }
      });
      
      if (submissionsResponse.ok) {
        const submissionsData = await submissionsResponse.json();
        setSubmissions(submissionsData.data || []);
        
        // Calculate analytics
        const subs = submissionsData.data || [];
        const analytics = calculateAnalytics(subs, orderData.data);
        setAnalytics(analytics);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [supabase, orderId, router]);

  const calculateAnalytics = (submissions: any[], order: any) => {
    const now = new Date();
    const orderStart = new Date(order.created_at);
    const orderEnd = new Date(order.deadline);
    
    // Time-based analytics
    const daysActive = Math.ceil((Math.min(now.getTime(), orderEnd.getTime()) - orderStart.getTime()) / (1000 * 60 * 60 * 24));
    const submissionsPerDay = daysActive > 0 ? submissions.length / daysActive : 0;
    
    // Payment method breakdown
    const paymentMethods = submissions.reduce((acc, sub) => {
      acc[sub.payment_method] = (acc[sub.payment_method] || 0) + 1;
      return acc;
    }, {});

    // Status breakdown
    const statusBreakdown = submissions.reduce((acc, sub) => {
      acc[sub.payment_status] = (acc[sub.payment_status] || 0) + 1;
      return acc;
    }, {});

    // Revenue calculations
    const confirmedSubmissions = submissions.filter(s => s.payment_status === 'confirmed');
    const totalRevenue = confirmedSubmissions.reduce((sum, s) => sum + (s.quantity * order.price), 0);
    const averageOrderValue = confirmedSubmissions.length > 0 ? totalRevenue / confirmedSubmissions.length : 0;

    // Time to payment analysis
    const paymentTimes = submissions
      .filter(s => s.payment_status === 'confirmed' && s.updated_at !== s.created_at)
      .map(s => {
        const created = new Date(s.created_at);
        const confirmed = new Date(s.updated_at);
        return (confirmed.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
      });
    
    const averagePaymentTime = paymentTimes.length > 0 
      ? paymentTimes.reduce((sum, time) => sum + time, 0) / paymentTimes.length 
      : 0;

    // Progress metrics
    const progressPercentage = (submissions.length / order.min_orders) * 100;
    const conversionRate = submissions.length > 0 ? (confirmedSubmissions.length / submissions.length) * 100 : 0;

    return {
      daysActive,
      submissionsPerDay,
      paymentMethods,
      statusBreakdown,
      totalRevenue,
      averageOrderValue,
      averagePaymentTime,
      progressPercentage,
      conversionRate,
      totalQuantity: submissions.reduce((sum, s) => sum + s.quantity, 0)
    };
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

  if (!order || !analytics) {
    return (
      <DashboardLayout requiredRole="gom">
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics not available</h3>
          <p className="text-gray-500 mb-4">Unable to load analytics for this order.</p>
          <Button onClick={() => router.push('/orders')}>Back to Orders</Button>
        </div>
      </DashboardLayout>
    );
  }

  const getPaymentMethodName = (method: string) => {
    const names: Record<string, string> = {
      'gcash': 'GCash',
      'paymaya': 'PayMaya',
      'bank_transfer': 'Bank Transfer',
      'maybank': 'Maybank2u',
      'touch_n_go': "Touch 'n Go",
      'cimb': 'CIMB Bank'
    };
    return names[method] || method;
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
            <h1 className="text-2xl font-bold text-gray-900">Order Analytics</h1>
            <p className="text-gray-600">{order.title}</p>
          </div>
          <Button variant="outline" onClick={() => router.push(`/orders/${orderId}/manage`)}>
            Manage Order
          </Button>
        </div>

        {/* Advanced Analytics Dashboard */}
        <AnalyticsDashboard
          orderId={orderId as string}
          orderData={order}
          submissions={submissions}
          onRefresh={fetchAnalytics}
          loading={loading}
        />
      </div>
    </DashboardLayout>
  );
}