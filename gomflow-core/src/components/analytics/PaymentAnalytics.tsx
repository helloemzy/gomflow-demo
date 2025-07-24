"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CreditCard, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Timer,
  Star,
  MapPin,
  RefreshCw,
  Download,
  Filter
} from 'lucide-react';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { ChartData } from 'chart.js';
import { PIE_CHART_OPTIONS, BAR_CHART_OPTIONS, LINE_CHART_OPTIONS, CHART_COLORS } from '@/lib/chartConfig';
import BaseChart from './BaseChart';
import { usePaymentAnalytics } from '@/hooks/usePaymentAnalytics';

interface PaymentMethodStats {
  method: string;
  count: number;
  revenue: number;
  successRate: number;
  avgProcessingTime: number; // in minutes
  popularCountries: string[];
}

interface PaymentAnalyticsData {
  overview: {
    totalPayments: number;
    totalRevenue: number;
    averageVerificationTime: number;
    successRate: number;
    pendingVerifications: number;
    disputedPayments: number;
  };
  methodStats: PaymentMethodStats[];
  verificationMetrics: {
    autoVerified: number;
    manualVerified: number;
    aiAccuracy: number;
    averageReviewTime: number;
  };
  geographicData: {
    country: string;
    payments: number;
    revenue: number;
    topMethods: string[];
  }[];
  timeSeriesData: {
    date: string;
    payments: number;
    revenue: number;
    successRate: number;
  }[];
  qualityMetrics: {
    excellentProofs: number;
    goodProofs: number;
    poorProofs: number;
    avgConfidenceScore: number;
  };
}

interface PaymentAnalyticsProps {
  timeRange?: '7d' | '30d' | '90d' | '1y';
  country?: 'PH' | 'MY' | 'all';
  onExport?: (data: PaymentAnalyticsData) => void;
}

export default function PaymentAnalytics({ 
  timeRange = '30d', 
  country = 'all',
  onExport 
}: PaymentAnalyticsProps) {
  const { data, loading, error, refetch } = usePaymentAnalytics({ timeRange, country });
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'count' | 'successRate'>('revenue');

  const getPaymentMethodName = (method: string) => {
    const names: Record<string, string> = {
      'gcash': 'GCash',
      'paymaya': 'PayMaya',
      'bpi_transfer': 'BPI Transfer',
      'bdo_transfer': 'BDO Transfer',
      'maybank2u': 'Maybank2u',
      'touch_n_go': "Touch 'n Go",
      'cimb': 'CIMB Bank',
      'grabpay': 'GrabPay',
      'boost': 'Boost',
      'fpx': 'FPX Banking',
      'bank_transfer': 'Bank Transfer',
      'cash_deposit': 'Cash Deposit',
      'custom': 'Custom Method'
    };
    return names[method] || method.replace('_', ' ').toUpperCase();
  };

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      'gcash': '#007DFE',
      'paymaya': '#00D632',
      'bpi_transfer': '#E31837',
      'bdo_transfer': '#005BAC',
      'maybank2u': '#FFD700',
      'touch_n_go': '#1B365D',
      'cimb': '#D71921',
      'grabpay': '#00B14F',
      'boost': '#FF6B35',
      'fpx': '#0066CC'
    };
    return colors[method] || '#6B7280';
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatCurrency = (amount: number, currencyCode: string = 'PHP') => {
    const symbol = currencyCode === 'PHP' ? '₱' : 'RM';
    return `${symbol}${amount.toLocaleString()}`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  // Chart data preparation
  const paymentMethodChartData: ChartData<'pie'> = {
    labels: data?.methodStats.map(stat => getPaymentMethodName(stat.method)) || [],
    datasets: [{
      data: data?.methodStats.map(stat => 
        selectedMetric === 'revenue' ? stat.revenue :
        selectedMetric === 'count' ? stat.count :
        stat.successRate
      ) || [],
      backgroundColor: data?.methodStats.map(stat => getMethodColor(stat.method)) || [],
      borderColor: '#ffffff',
      borderWidth: 2,
    }]
  };

  const verificationTrendsData: ChartData<'line'> = {
    labels: data?.timeSeriesData.map(item => new Date(item.date).toLocaleDateString()) || [],
    datasets: [
      {
        label: 'Success Rate %',
        data: data?.timeSeriesData.map(item => item.successRate) || [],
        borderColor: CHART_COLORS.success[0],
        backgroundColor: CHART_COLORS.success[0] + '20',
        tension: 0.4,
      },
      {
        label: 'Payment Count',
        data: data?.timeSeriesData.map(item => item.payments) || [],
        borderColor: CHART_COLORS.primary[0],
        backgroundColor: CHART_COLORS.primary[0] + '20',
        tension: 0.4,
        yAxisID: 'y1',
      }
    ]
  };

  const verificationMethodsData: ChartData<'bar'> = {
    labels: ['Auto-Verified', 'Manual Review', 'Disputed'],
    datasets: [{
      label: 'Payments',
      data: [
        data?.verificationMetrics.autoVerified || 0,
        data?.verificationMetrics.manualVerified || 0,
        data?.overview.disputedPayments || 0
      ],
      backgroundColor: [CHART_COLORS.success[0], CHART_COLORS.warning[0], CHART_COLORS.danger[0]],
    }]
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Payment Analytics</h2>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse h-20 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load analytics</h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <Button onClick={refetch} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Payment Analytics</h2>
          <p className="text-gray-600">
            Monitor payment performance and verification metrics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => onExport?.(data!)}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Payments</p>
                <p className="text-2xl font-bold">{data?.overview.totalPayments.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <CreditCard className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
              <span className="text-green-600">12% from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(data?.overview.totalRevenue || 0)}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
              <span className="text-green-600">8% from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className={`text-2xl font-bold ${getSuccessRateColor(data?.overview.successRate || 0)}`}>
                  {data?.overview.successRate.toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4">
              <Progress value={data?.overview.successRate || 0} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Processing Time</p>
                <p className="text-2xl font-bold">{formatDuration(data?.overview.averageVerificationTime || 0)}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-full">
                <Timer className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingDown className="h-4 w-4 text-green-600 mr-1" />
              <span className="text-green-600">15% faster than last period</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Payment Methods Performance</CardTitle>
              <div className="flex items-center space-x-2">
                <Button
                  variant={selectedMetric === 'revenue' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedMetric('revenue')}
                >
                  Revenue
                </Button>
                <Button
                  variant={selectedMetric === 'count' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedMetric('count')}
                >
                  Volume
                </Button>
                <Button
                  variant={selectedMetric === 'successRate' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedMetric('successRate')}
                >
                  Success Rate
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <Pie data={paymentMethodChartData} options={PIE_CHART_OPTIONS} />
            </div>
          </CardContent>
        </Card>

        {/* Verification Methods */}
        <Card>
          <CardHeader>
            <CardTitle>Verification Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <Bar data={verificationMethodsData} options={BAR_CHART_OPTIONS} />
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>AI Accuracy</span>
                <Badge variant="outline">{data?.verificationMetrics.aiAccuracy.toFixed(1)}%</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Avg Review Time</span>
                <Badge variant="outline">{formatDuration(data?.verificationMetrics.averageReviewTime || 0)}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Method Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Method Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Method</th>
                  <th className="text-right py-3 px-4">Volume</th>
                  <th className="text-right py-3 px-4">Revenue</th>
                  <th className="text-right py-3 px-4">Success Rate</th>
                  <th className="text-right py-3 px-4">Avg Processing</th>
                  <th className="text-right py-3 px-4">Popular In</th>
                </tr>
              </thead>
              <tbody>
                {data?.methodStats.map((method, index) => (
                  <tr key={method.method} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: getMethodColor(method.method) }}
                        ></div>
                        <span className="font-medium">{getPaymentMethodName(method.method)}</span>
                      </div>
                    </td>
                    <td className="text-right py-3 px-4">{method.count.toLocaleString()}</td>
                    <td className="text-right py-3 px-4">{formatCurrency(method.revenue)}</td>
                    <td className="text-right py-3 px-4">
                      <span className={getSuccessRateColor(method.successRate)}>
                        {method.successRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">{formatDuration(method.avgProcessingTime)}</td>
                    <td className="text-right py-3 px-4">
                      <div className="flex justify-end space-x-1">
                        {method.popularCountries.slice(0, 2).map(country => (
                          <Badge key={country} variant="outline" className="text-xs">
                            {country}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Trends Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <Line 
              data={verificationTrendsData} 
              options={{
                ...LINE_CHART_OPTIONS,
                scales: {
                  y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                  },
                  y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: {
                      drawOnChartArea: false,
                    },
                  },
                }
              }} 
            />
          </div>
        </CardContent>
      </Card>

      {/* Geographic Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Geographic Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.geographicData.map((geo, index) => (
              <div key={geo.country} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">{geo.country}</span>
                  </div>
                  <Badge variant="outline">{geo.payments} payments</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Revenue</span>
                    <span className="font-medium">{formatCurrency(geo.revenue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Top Methods</span>
                    <div className="flex space-x-1">
                      {geo.topMethods.slice(0, 2).map(method => (
                        <Badge key={method} variant="secondary" className="text-xs">
                          {getPaymentMethodName(method)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment Quality Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Proof Quality</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">
                {data?.qualityMetrics.excellentProofs || 0}
              </div>
              <div className="text-sm text-gray-600">Excellent Quality</div>
              <div className="flex justify-center mt-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                ))}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600 mb-2">
                {data?.qualityMetrics.goodProofs || 0}
              </div>
              <div className="text-sm text-gray-600">Good Quality</div>
              <div className="flex justify-center mt-2">
                {[...Array(4)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                ))}
                <Star className="h-4 w-4 text-gray-300" />
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">
                {data?.qualityMetrics.poorProofs || 0}
              </div>
              <div className="text-sm text-gray-600">Needs Review</div>
              <div className="flex justify-center mt-2">
                {[...Array(2)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-400 fill-current" />
                ))}
                {[...Array(3)].map((_, i) => (
                  <Star key={i + 2} className="h-4 w-4 text-gray-300" />
                ))}
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {data?.qualityMetrics.avgConfidenceScore.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">Avg AI Confidence</div>
              <Progress 
                value={data?.qualityMetrics.avgConfidenceScore || 0} 
                className="mt-2 h-2" 
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}