'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CreditCard, 
  Download, 
  Calendar, 
  AlertTriangle, 
  TrendingUp,
  Users,
  MessageSquare,
  BarChart3,
  Crown,
  ExternalLink,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Zap
} from 'lucide-react';
import { 
  Subscription,
  UsageMetrics, 
  BillingHistory,
  OverageAlert,
  SubscriptionPlan 
} from 'gomflow-shared/types';

interface BillingDashboardProps {
  subscription: Subscription;
  usageMetrics: UsageMetrics;
  billingHistory: BillingHistory[];
  overageAlerts: OverageAlert[];
  onUpgrade: () => void;
  onManagePayment: () => void;
  onDownloadInvoice: (invoiceId: string) => void;
  onAcknowledgeAlert: (alertId: string) => void;
  className?: string;
}

const PLAN_INFO = {
  free: { name: 'Free', color: 'gray', icon: Zap },
  starter: { name: 'Starter', color: 'blue', icon: TrendingUp },
  professional: { name: 'Professional', color: 'purple', icon: Crown },
  enterprise: { name: 'Enterprise', color: 'orange', icon: Crown },
};

const STATUS_INFO = {
  active: { label: 'Active', color: 'green', icon: CheckCircle },
  trialing: { label: 'Trial', color: 'blue', icon: Clock },
  past_due: { label: 'Past Due', color: 'red', icon: AlertTriangle },
  cancelled: { label: 'Cancelled', color: 'gray', icon: XCircle },
  incomplete: { label: 'Incomplete', color: 'yellow', icon: AlertTriangle },
  inactive: { label: 'Inactive', color: 'gray', icon: XCircle },
};

export function BillingDashboard({
  subscription,
  usageMetrics,
  billingHistory,
  overageAlerts,
  onUpgrade,
  onManagePayment,
  onDownloadInvoice,
  onAcknowledgeAlert,
  className = '',
}: BillingDashboardProps) {
  const [refreshing, setRefreshing] = useState(false);

  const planInfo = PLAN_INFO[subscription.plan];
  const statusInfo = STATUS_INFO[subscription.status];
  const PlanIcon = planInfo.icon;
  const StatusIcon = statusInfo.icon;

  const formatPrice = (amount: number, currency: string) => {
    const formatters = {
      PHP: (amt: number) => `₱${amt.toLocaleString()}`,
      MYR: (amt: number) => `RM${amt}`,
      THB: (amt: number) => `฿${amt.toLocaleString()}`,
      IDR: (amt: number) => `Rp${amt.toLocaleString()}`,
      USD: (amt: number) => `$${amt}`,
    };
    
    return formatters[currency as keyof typeof formatters]?.(amount) || `${currency} ${amount}`;
  };

  const getUsagePercentage = (used: number, limit: number | null) => {
    if (limit === null) return 0; // unlimited
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getDaysUntilRenewal = () => {
    const now = new Date();
    const renewalDate = new Date(subscription.current_period_end);
    const diffTime = renewalDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing Dashboard</h1>
          <p className="text-gray-600">Manage your subscription and usage</p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          disabled={refreshing}
          className="self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overage Alerts */}
      {overageAlerts.length > 0 && (
        <div className="space-y-3">
          {overageAlerts.map((alert) => (
            <Card key={alert.id} className="p-4 border-yellow-200 bg-yellow-50">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-yellow-800">
                        Usage Alert: {alert.metric.charAt(0).toUpperCase() + alert.metric.slice(1)}
                      </p>
                      <p className="text-sm text-yellow-700">
                        You're at {alert.threshold_percentage}% of your limit ({alert.current_usage.toLocaleString()} / {alert.limit.toLocaleString()})
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAcknowledgeAlert(alert.id)}
                      className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Current Plan */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <PlanIcon className={`h-8 w-8 text-${planInfo.color}-500`} />
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{planInfo.name} Plan</h2>
                <div className="flex items-center space-x-2">
                  <StatusIcon className={`h-4 w-4 text-${statusInfo.color}-500`} />
                  <Badge className={`bg-${statusInfo.color}-100 text-${statusInfo.color}-800`}>
                    {statusInfo.label}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    • {subscription.billing_interval}ly billing
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Current Period</p>
                <p className="font-medium text-gray-900">
                  {new Date(subscription.current_period_start).toLocaleDateString()} - {' '}
                  {new Date(subscription.current_period_end).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Next Billing</p>
                <p className="font-medium text-gray-900">
                  {getDaysUntilRenewal()} days
                </p>
              </div>
            </div>

            {subscription.status === 'trialing' && subscription.trial_end && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <p className="text-blue-800 font-medium">
                    Trial ends on {new Date(subscription.trial_end).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col space-y-3">
            {subscription.plan === 'free' ? (
              <Button onClick={onUpgrade} className="bg-orange-500 hover:bg-orange-600">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade Plan
              </Button>
            ) : (
              <Button onClick={onUpgrade} variant="outline">
                <TrendingUp className="h-4 w-4 mr-2" />
                Change Plan
              </Button>
            )}
            <Button onClick={onManagePayment} variant="outline">
              <CreditCard className="h-4 w-4 mr-2" />
              Manage Payment
            </Button>
          </div>
        </div>
      </Card>

      {/* Usage Metrics */}
      <Card className="p-6">
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Usage This Period</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Orders */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Orders</span>
                <span className="text-sm text-gray-500">
                  {usageMetrics.orders_used.toLocaleString()} / {' '}
                  {usageMetrics.orders_limit ? usageMetrics.orders_limit.toLocaleString() : '∞'}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(usageMetrics.orders_used, usageMetrics.orders_limit)} 
                className="h-2"
                style={{
                  backgroundColor: '#f3f4f6',
                }}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Used</span>
                <span>
                  {usageMetrics.orders_limit 
                    ? `${Math.round(getUsagePercentage(usageMetrics.orders_used, usageMetrics.orders_limit))}%`
                    : 'Unlimited'
                  }
                </span>
              </div>
            </div>

            {/* Submissions */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Submissions</span>
                <span className="text-sm text-gray-500">
                  {usageMetrics.submissions_used.toLocaleString()} / {' '}
                  {usageMetrics.submissions_limit ? usageMetrics.submissions_limit.toLocaleString() : '∞'}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(usageMetrics.submissions_used, usageMetrics.submissions_limit)} 
                className="h-2"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Used</span>
                <span>
                  {usageMetrics.submissions_limit 
                    ? `${Math.round(getUsagePercentage(usageMetrics.submissions_used, usageMetrics.submissions_limit))}%`
                    : 'Unlimited'
                  }
                </span>
              </div>
            </div>

            {/* Team Members */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Team Members</span>
                <span className="text-sm text-gray-500">
                  {usageMetrics.team_members_used} / {usageMetrics.team_members_limit}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(usageMetrics.team_members_used, usageMetrics.team_members_limit)} 
                className="h-2"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Used</span>
                <span>
                  {Math.round(getUsagePercentage(usageMetrics.team_members_used, usageMetrics.team_members_limit))}%
                </span>
              </div>
            </div>

            {/* WhatsApp Credits */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">WhatsApp Credits</span>
                <span className="text-sm text-gray-500">
                  {usageMetrics.whatsapp_credits_used} / {usageMetrics.whatsapp_credits_limit}
                </span>
              </div>
              <Progress 
                value={getUsagePercentage(usageMetrics.whatsapp_credits_used, usageMetrics.whatsapp_credits_limit)} 
                className="h-2"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Used</span>
                <span>
                  {Math.round(getUsagePercentage(usageMetrics.whatsapp_credits_used, usageMetrics.whatsapp_credits_limit))}%
                </span>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            Usage period: {new Date(usageMetrics.current_period_start).toLocaleDateString()} - {new Date(usageMetrics.current_period_end).toLocaleDateString()}
          </div>
        </div>
      </Card>

      {/* Billing History */}
      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Billing History</span>
          </h3>

          {billingHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No billing history available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {billingHistory.slice(0, 5).map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full ${
                      invoice.status === 'paid' 
                        ? 'bg-green-100' 
                        : invoice.status === 'pending'
                        ? 'bg-yellow-100'
                        : 'bg-red-100'
                    }`}>
                      {invoice.status === 'paid' ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : invoice.status === 'pending' ? (
                        <Clock className="h-4 w-4 text-yellow-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatPrice(invoice.amount, invoice.currency)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {invoice.description} • {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={
                      invoice.status === 'paid' 
                        ? 'bg-green-100 text-green-800' 
                        : invoice.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }>
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </Badge>
                    {invoice.invoice_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onDownloadInvoice(invoice.id)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Invoice
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              
              {billingHistory.length > 5 && (
                <Button variant="outline" className="w-full">
                  View All History ({billingHistory.length} invoices)
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}