"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  BarChart3,
  MapPin,
  CreditCard,
  Activity,
  Calendar,
  Download,
  Settings
} from "lucide-react";
import OrderTrendChart from './OrderTrendChart';
import PaymentMethodChart from './PaymentMethodChart';
import PaymentStatusChart from './PaymentStatusChart';
import RevenueAnalyticsChart from './RevenueAnalyticsChart';
import GeographicChart from './GeographicChart';

interface AnalyticsDashboardProps {
  orderId: string;
  orderData: any;
  submissions: any[];
  onRefresh?: () => void;
  loading?: boolean;
}

export default function AnalyticsDashboard({
  orderId,
  orderData,
  submissions,
  onRefresh,
  loading = false
}: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState('7d');
  const [chartType, setChartType] = useState<'bar' | 'line'>('line');
  const [geoGroupBy, setGeoGroupBy] = useState<'country' | 'region' | 'city'>('country');

  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    if (submissions && orderData) {
      const calculatedAnalytics = calculateAnalytics(submissions, orderData);
      setAnalytics(calculatedAnalytics);
    }
  }, [submissions, orderData]);

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

    // Time series data for trend charts
    const trendData = generateTrendData(submissions, order);
    const revenueData = generateRevenueData(submissions, order);
    const geographicData = generateGeographicData(submissions, order);

    // Performance metrics
    const progressPercentage = (submissions.length / order.min_orders) * 100;
    const conversionRate = submissions.length > 0 ? (confirmedSubmissions.length / submissions.length) * 100 : 0;

    return {
      daysActive,
      submissionsPerDay,
      paymentMethods,
      statusBreakdown,
      totalRevenue,
      averageOrderValue,
      progressPercentage,
      conversionRate,
      totalQuantity: submissions.reduce((sum, s) => sum + s.quantity, 0),
      trendData,
      revenueData,
      geographicData
    };
  };

  const generateTrendData = (submissions: any[], order: any) => {
    const dailyData = submissions.reduce((acc, sub) => {
      const date = new Date(sub.created_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { submissions: 0, confirmedOrders: 0, revenue: 0, cumulativeRevenue: 0 };
      }
      acc[date].submissions += 1;
      if (sub.payment_status === 'confirmed') {
        acc[date].confirmedOrders += 1;
        acc[date].revenue += sub.quantity * order.price;
      }
      return acc;
    }, {} as Record<string, any>);

    let cumulativeRevenue = 0;
    return Object.entries(dailyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => {
        cumulativeRevenue += data.revenue;
        return {
          date,
          submissions: data.submissions,
          confirmedOrders: data.confirmedOrders,
          revenue: data.revenue,
          cumulativeRevenue
        };
      });
  };

  const generateRevenueData = (submissions: any[], order: any) => {
    const dailyData = submissions.reduce((acc, sub) => {
      const date = new Date(sub.created_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { revenue: 0, orderCount: 0, orders: [] };
      }
      if (sub.payment_status === 'confirmed') {
        const orderValue = sub.quantity * order.price;
        acc[date].revenue += orderValue;
        acc[date].orderCount += 1;
        acc[date].orders.push(orderValue);
      }
      return acc;
    }, {} as Record<string, any>);

    let cumulativeRevenue = 0;
    return Object.entries(dailyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => {
        cumulativeRevenue += data.revenue;
        const averageOrderValue = data.orderCount > 0 ? data.revenue / data.orderCount : 0;
        return {
          date,
          dailyRevenue: data.revenue,
          cumulativeRevenue,
          orderCount: data.orderCount,
          averageOrderValue
        };
      });
  };

  const generateGeographicData = (submissions: any[], order: any) => {
    // Mock geographic data - in real implementation, this would come from user profiles
    const mockLocations = [
      { country: 'Philippines', region: 'Metro Manila', city: 'Manila' },
      { country: 'Philippines', region: 'Cebu', city: 'Cebu City' },
      { country: 'Malaysia', region: 'Kuala Lumpur', city: 'Kuala Lumpur' },
      { country: 'Malaysia', region: 'Selangor', city: 'Petaling Jaya' },
      { country: 'Singapore', region: 'Singapore', city: 'Singapore' },
      { country: 'Thailand', region: 'Bangkok', city: 'Bangkok' }
    ];

    const geoData = submissions.reduce((acc, sub, index) => {
      const location = mockLocations[index % mockLocations.length];
      const key = `${location.country}-${location.region}-${location.city}`;
      
      if (!acc[key]) {
        acc[key] = {
          ...location,
          orderCount: 0,
          revenue: 0,
          buyers: 0
        };
      }
      
      acc[key].orderCount += 1;
      acc[key].buyers += 1;
      
      if (sub.payment_status === 'confirmed') {
        acc[key].revenue += sub.quantity * order.price;
      }
      
      return acc;
    }, {} as Record<string, any>);

    return Object.values(geoData);
  };

  const exportAllCharts = () => {
    // This would trigger export of all charts
    console.log('Exporting all charts...');
  };

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>

          <Select value={chartType} onValueChange={(value: 'bar' | 'line') => setChartType(value)}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Chart Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="line">Line</SelectItem>
              <SelectItem value="bar">Bar</SelectItem>
            </SelectContent>
          </Select>

          <Select value={geoGroupBy} onValueChange={(value: 'country' | 'region' | 'city') => setGeoGroupBy(value)}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Group By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="country">Country</SelectItem>
              <SelectItem value="region">Region</SelectItem>
              <SelectItem value="city">City</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportAllCharts}>
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
          <Button variant="outline" onClick={onRefresh} disabled={loading}>
            <Activity className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Submissions</p>
                <p className="text-2xl font-bold">{submissions.length}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {analytics.submissionsPerDay.toFixed(1)} per day
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Confirmed Revenue</p>
                <p className="text-2xl font-bold">
                  {orderData.currency === 'PHP' ? '₱' : 'RM'}{analytics.totalRevenue.toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {analytics.statusBreakdown.confirmed || 0} confirmed orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Progress</p>
                <p className="text-2xl font-bold">{Math.min(analytics.progressPercentage, 100).toFixed(0)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {submissions.length}/{orderData.min_orders} minimum
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                <p className="text-2xl font-bold">{analytics.conversionRate.toFixed(0)}%</p>
              </div>
              <Activity className="h-8 w-8 text-orange-600" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Submit to payment
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <OrderTrendChart 
            data={analytics.trendData} 
            currency={orderData.currency}
            onRefresh={onRefresh}
            loading={loading}
          />
        </div>

        <RevenueAnalyticsChart 
          data={analytics.revenueData} 
          currency={orderData.currency}
          chartType={chartType}
          onRefresh={onRefresh}
          loading={loading}
        />

        <PaymentStatusChart 
          data={analytics.statusBreakdown} 
          totalSubmissions={submissions.length}
          onRefresh={onRefresh}
          loading={loading}
        />

        <PaymentMethodChart 
          data={analytics.paymentMethods}
          onRefresh={onRefresh}
          loading={loading}
        />

        <GeographicChart 
          data={analytics.geographicData}
          currency={orderData.currency}
          groupBy={geoGroupBy}
          onRefresh={onRefresh}
          loading={loading}
        />
      </div>
    </div>
  );
}