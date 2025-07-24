"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import PaymentAnalytics from '@/components/analytics/PaymentAnalytics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft,
  CreditCard,
  TrendingUp,
  Users,
  Clock,
  Download,
  Calendar,
  Filter,
  Settings
} from 'lucide-react';

export default function PaymentAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [country, setCountry] = useState<'PH' | 'MY' | 'all'>('all');
  const router = useRouter();

  const handleExportData = (data: any) => {
    // Create and download CSV export
    const headers = ['Method', 'Volume', 'Revenue', 'Success Rate', 'Avg Processing Time'];
    const csvContent = [
      headers.join(','),
      ...data.methodStats.map((method: any) => [
        method.method,
        method.count,
        method.revenue,
        method.successRate + '%',
        method.avgProcessingTime + 'm'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `payment-analytics-${timeRange}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getTimeRangeLabel = (range: string) => {
    const labels = {
      '7d': 'Last 7 Days',
      '30d': 'Last 30 Days',
      '90d': 'Last 3 Months',
      '1y': 'Last Year'
    };
    return labels[range as keyof typeof labels] || range;
  };

  const getCountryLabel = (countryCode: string) => {
    const labels = {
      'all': 'All Countries',
      'PH': 'Philippines',
      'MY': 'Malaysia'
    };
    return labels[countryCode as keyof typeof labels] || countryCode;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payment Analytics</h1>
              <p className="text-gray-600">
                Deep insights into your payment performance and buyer behavior
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Filters */}
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 3 Months</option>
                <option value="1y">Last Year</option>
              </select>
              
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All Countries</option>
                <option value="PH">Philippines</option>
                <option value="MY">Malaysia</option>
              </select>
            </div>
            
            {/* Actions */}
            <Button
              variant="outline"
              onClick={() => router.push('/gom/payment-setup')}
            >
              <Settings className="h-4 w-4 mr-2" />
              Payment Settings
            </Button>
          </div>
        </div>

        {/* Active Filters */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Showing data for:</span>
          <Badge variant="outline">
            <Calendar className="h-3 w-3 mr-1" />
            {getTimeRangeLabel(timeRange)}
          </Badge>
          <Badge variant="outline">
            {getCountryLabel(country)}
          </Badge>
        </div>

        {/* Key Insights Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Payment Success Rate</p>
                  <p className="text-2xl font-bold text-green-600">94.7%</p>
                  <p className="text-xs text-gray-500 mt-1">+2.3% from last period</p>
                </div>
                <div className="p-3 bg-green-100 rounded-full">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Processing Time</p>
                  <p className="text-2xl font-bold text-blue-600">18.5m</p>
                  <p className="text-xs text-gray-500 mt-1">-5.2m faster</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Methods</p>
                  <p className="text-2xl font-bold text-purple-600">5</p>
                  <p className="text-xs text-gray-500 mt-1">GCash, PayMaya, etc.</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-full">
                  <CreditCard className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Unique Buyers</p>
                  <p className="text-2xl font-bold text-orange-600">342</p>
                  <p className="text-xs text-gray-500 mt-1">+15% new buyers</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <Users className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics Component */}
        <PaymentAnalytics
          timeRange={timeRange}
          country={country}
          onExport={handleExportData}
        />

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                onClick={() => router.push('/gom/verify-payments')}
                className="h-20 flex flex-col items-center justify-center space-y-2"
              >
                <CreditCard className="h-6 w-6" />
                <span>Verify Payments</span>
              </Button>
              
              <Button
                variant="outline"
                onClick={() => router.push('/gom/payment-setup')}
                className="h-20 flex flex-col items-center justify-center space-y-2"
              >
                <Settings className="h-6 w-6" />
                <span>Payment Settings</span>
              </Button>
              
              <Button
                variant="outline"
                onClick={() => router.push('/orders?filter=pending_payment')}
                className="h-20 flex flex-col items-center justify-center space-y-2"
              >
                <Clock className="h-6 w-6" />
                <span>Pending Payments</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tips Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Optimization Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Improve Success Rates</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Add payment method variety for different buyer preferences</li>
                  <li>• Provide clear payment instructions with examples</li>
                  <li>• Send timely payment reminders to reduce drop-offs</li>
                  <li>• Use payment deadlines to create urgency</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Reduce Processing Time</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Enable Smart Agent AI for faster verification</li>
                  <li>• Set up auto-approval for trusted buyers</li>
                  <li>• Use QR codes for easier payment reference</li>
                  <li>• Standardize payment proof requirements</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}