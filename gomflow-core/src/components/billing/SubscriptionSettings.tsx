'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Pause, 
  Play, 
  X, 
  RefreshCw,
  AlertTriangle,
  Calendar,
  CreditCard,
  Mail,
  Bell,
  Globe,
  Shield,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Download
} from 'lucide-react';
import { 
  Subscription,
  BillingInterval,
  SubscriptionStatus 
} from 'gomflow-shared/types';

interface SubscriptionSettingsProps {
  subscription: Subscription;
  canPause?: boolean;
  canCancel?: boolean;
  onChangeBilling: (interval: BillingInterval) => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onReactivate: () => void;
  onUpdateBillingAddress: () => void;
  onUpdateTaxInfo: () => void;
  onDownloadData: () => void;
  className?: string;
}

const STATUS_INFO = {
  active: { 
    label: 'Active', 
    color: 'green', 
    icon: CheckCircle,
    description: 'Your subscription is active and billing normally'
  },
  trialing: { 
    label: 'Trial', 
    color: 'blue', 
    icon: Clock,
    description: 'You are currently in your free trial period'
  },
  past_due: { 
    label: 'Past Due', 
    color: 'red', 
    icon: AlertTriangle,
    description: 'Payment failed - please update your payment method'
  },
  cancelled: { 
    label: 'Cancelled', 
    color: 'gray', 
    icon: XCircle,
    description: 'Your subscription has been cancelled'
  },
  incomplete: { 
    label: 'Incomplete', 
    color: 'yellow', 
    icon: AlertTriangle,
    description: 'Payment setup incomplete - action required'
  },
  inactive: { 
    label: 'Inactive', 
    color: 'gray', 
    icon: XCircle,
    description: 'Your subscription is not active'
  },
};

export function SubscriptionSettings({
  subscription,
  canPause = true,
  canCancel = true,
  onChangeBilling,
  onPause,
  onResume,
  onCancel,
  onReactivate,
  onUpdateBillingAddress,
  onUpdateTaxInfo,
  onDownloadData,
  className = '',
}: SubscriptionSettingsProps) {
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showReactivateConfirm, setShowReactivateConfirm] = useState(false);

  const statusInfo = STATUS_INFO[subscription.status];
  const StatusIcon = statusInfo.icon;

  const handleAction = async (action: string, callback: () => void) => {
    setIsProcessing(action);
    try {
      await callback();
    } finally {
      setIsProcessing(null);
    }
  };

  const getDaysUntilEnd = () => {
    const now = new Date();
    const endDate = subscription.cancelled_at 
      ? new Date(subscription.current_period_end)
      : subscription.trial_end && subscription.status === 'trialing'
      ? new Date(subscription.trial_end)
      : new Date(subscription.current_period_end);
    
    const diffTime = endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Settings className="h-6 w-6 text-gray-600" />
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Subscription Settings</h2>
          <p className="text-gray-600">Manage your subscription preferences</p>
        </div>
      </div>

      {/* Status Card */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <StatusIcon className={`h-6 w-6 text-${statusInfo.color}-500`} />
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-semibold text-gray-900">Subscription Status</h3>
                  <Badge className={`bg-${statusInfo.color}-100 text-${statusInfo.color}-800`}>
                    {statusInfo.label}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{statusInfo.description}</p>
              </div>
            </div>
          </div>

          {/* Status-specific information */}
          {subscription.status === 'trialing' && subscription.trial_end && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-800">
                    {getDaysUntilEnd()} days left in trial
                  </p>
                  <p className="text-sm text-blue-700">
                    Your trial ends on {formatDate(subscription.trial_end)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {subscription.status === 'cancelled' && subscription.current_period_end && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="font-medium text-orange-800">
                      Access until {formatDate(subscription.current_period_end)}
                    </p>
                    <p className="text-sm text-orange-700">
                      You can still use all features until your current period ends
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowReactivateConfirm(true)}
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Reactivate
                </Button>
              </div>
            </div>
          )}

          {subscription.status === 'past_due' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <div>
                  <p className="font-medium text-red-800">Payment Required</p>
                  <p className="text-sm text-red-700">
                    Please update your payment method to continue your subscription
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Billing Settings */}
      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Billing Settings</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Billing Cycle */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Billing Cycle</label>
                <p className="text-sm text-gray-600">Change how often you're billed</p>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant={subscription.billing_interval === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onChangeBilling('month')}
                  disabled={isProcessing === 'billing' || subscription.status === 'cancelled'}
                >
                  {isProcessing === 'billing' && subscription.billing_interval !== 'month' ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  Monthly
                </Button>
                <Button
                  variant={subscription.billing_interval === 'year' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onChangeBilling('year')}
                  disabled={isProcessing === 'billing' || subscription.status === 'cancelled'}
                >
                  {isProcessing === 'billing' && subscription.billing_interval !== 'year' ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  Yearly (Save 20%)
                </Button>
              </div>
            </div>

            {/* Next Billing Date */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Next Billing Date</label>
                <p className="text-sm text-gray-600">When your next payment is due</p>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-900">
                  {formatDate(subscription.current_period_end)}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => handleAction('billing-address', onUpdateBillingAddress)}
              disabled={isProcessing === 'billing-address'}
            >
              {isProcessing === 'billing-address' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Globe className="h-4 w-4 mr-2" />
              )}
              Update Billing Address
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAction('tax-info', onUpdateTaxInfo)}
              disabled={isProcessing === 'tax-info'}
            >
              {isProcessing === 'tax-info' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              Update Tax Information
            </Button>
          </div>
        </div>
      </Card>

      {/* Subscription Actions */}
      <Card className="p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Subscription Actions</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Pause/Resume */}
            {canPause && subscription.status === 'active' && (
              <Button
                variant="outline"
                onClick={() => handleAction('pause', onPause)}
                disabled={isProcessing === 'pause'}
                className="justify-start"
              >
                {isProcessing === 'pause' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Pause className="h-4 w-4 mr-2" />
                )}
                Pause Subscription
              </Button>
            )}

            {subscription.status === 'inactive' && (
              <Button
                variant="outline"
                onClick={() => handleAction('resume', onResume)}
                disabled={isProcessing === 'resume'}
                className="justify-start text-green-600 border-green-200 hover:bg-green-50"
              >
                {isProcessing === 'resume' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Resume Subscription
              </Button>
            )}

            {/* Data Download */}
            <Button
              variant="outline"
              onClick={() => handleAction('download', onDownloadData)}
              disabled={isProcessing === 'download'}
              className="justify-start"
            >
              {isProcessing === 'download' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download My Data
            </Button>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      {canCancel && subscription.status !== 'cancelled' && (
        <Card className="p-6 border-red-200">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h3 className="text-lg font-semibold text-red-900">Danger Zone</h3>
            </div>
            
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-red-800">Cancel Subscription</p>
                  <p className="text-sm text-red-700">
                    Your subscription will remain active until {formatDate(subscription.current_period_end)}, 
                    then you'll lose access to all premium features.
                  </p>
                </div>
                <Button
                  onClick={() => setShowCancelConfirm(true)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                  size="sm"
                >
                  Cancel Subscription
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <h3 className="text-lg font-semibold text-gray-900">Confirm Cancellation</h3>
              </div>
              
              <p className="text-gray-600">
                Are you sure you want to cancel your subscription? You'll lose access to all premium features 
                when your current billing period ends on {formatDate(subscription.current_period_end)}.
              </p>

              <div className="flex space-x-3">
                <Button
                  onClick={() => setShowCancelConfirm(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Keep Subscription
                </Button>
                <Button
                  onClick={() => {
                    handleAction('cancel', onCancel);
                    setShowCancelConfirm(false);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  disabled={isProcessing === 'cancel'}
                >
                  {isProcessing === 'cancel' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Yes, Cancel
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Reactivate Confirmation Modal */}
      {showReactivateConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md p-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Reactivate Subscription</h3>
              </div>
              
              <p className="text-gray-600">
                Welcome back! Your subscription will be reactivated immediately and you'll regain access 
                to all premium features. Your next billing date will be {formatDate(subscription.current_period_end)}.
              </p>

              <div className="flex space-x-3">
                <Button
                  onClick={() => setShowReactivateConfirm(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    handleAction('reactivate', onReactivate);
                    setShowReactivateConfirm(false);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={isProcessing === 'reactivate'}
                >
                  {isProcessing === 'reactivate' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Reactivate Now
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}