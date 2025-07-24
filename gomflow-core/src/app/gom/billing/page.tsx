'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { BillingDashboard } from '@/components/billing/BillingDashboard';
import { PaymentMethodManager } from '@/components/billing/PaymentMethodManager';
import { SubscriptionSettings } from '@/components/billing/SubscriptionSettings';
import { useSubscription } from '@/hooks/useSubscription';
import { useBilling } from '@/hooks/useBilling';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Note: You'll need to install @radix-ui/react-tabs first
// npm install @radix-ui/react-tabs
import { 
  Tabs, 
  TabsList, 
  TabsTrigger, 
  TabsContent 
} from '@/components/ui/tabs';
import { 
  CreditCard, 
  BarChart3, 
  Settings, 
  CheckCircle,
  AlertTriangle,
  Crown,
  Loader2,
  ArrowRight
} from 'lucide-react';

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);

  const {
    subscription,
    usageMetrics,
    overageAlerts,
    isLoading: subscriptionLoading,
    changePlan,
    pauseSubscription,
    resumeSubscription,
    cancelSubscription,
    reactivateSubscription,
    changeBillingInterval,
    acknowledgeAlert,
    error: subscriptionError,
  } = useSubscription();

  const {
    billingHistory,
    paymentMethods,
    isLoading: billingLoading,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
    updatePaymentMethod,
    downloadInvoice,
    updateBillingAddress,
    updateTaxInfo,
    downloadData,
    error: billingError,
  } = useBilling();

  // Check for upgrade success
  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      setShowUpgradeSuccess(true);
      // Remove the query parameter
      const url = new URL(window.location.href);
      url.searchParams.delete('upgraded');
      window.history.replaceState({}, '', url.toString());
    }
  }, [searchParams]);

  // Auto-dismiss upgrade success message
  useEffect(() => {
    if (showUpgradeSuccess) {
      const timer = setTimeout(() => {
        setShowUpgradeSuccess(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showUpgradeSuccess]);

  const handleUpgrade = () => {
    window.location.href = '/pricing';
  };

  const handleManagePayment = () => {
    setActiveTab('payment-methods');
  };

  const handleAddPaymentMethod = () => {
    // In a real app, this would open Stripe Elements or similar
    console.log('Opening payment method form...');
    // Mock adding a payment method
    addPaymentMethod({
      type: 'card',
      token: 'mock_token',
    });
  };

  const handleUpdatePaymentMethod = (methodId: string) => {
    // In a real app, this would open update form
    console.log('Updating payment method:', methodId);
  };

  const isLoading = subscriptionLoading || billingLoading;
  const hasError = subscriptionError || billingError;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto" />
          <p className="text-gray-600">Loading your billing information...</p>
        </div>
      </div>
    );
  }

  if (hasError || !subscription || !usageMetrics) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Unable to Load Billing
          </h2>
          <p className="text-gray-600 mb-6">
            {subscriptionError || billingError || 'Unable to load your billing information. Please try again.'}
          </p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Upgrade Success Banner */}
      {showUpgradeSuccess && (
        <div className="bg-green-50 border-b border-green-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-green-800 font-medium">
                🎉 Plan upgraded successfully! Your new features are now active.
              </p>
              <Button
                onClick={() => setShowUpgradeSuccess(false)}
                size="sm"
                variant="ghost"
                className="ml-auto text-green-600 hover:text-green-700"
              >
                ×
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Billing & Subscription</h1>
                <p className="text-gray-600">Manage your plan, usage, and payment methods</p>
              </div>
              
              {subscription.plan === 'free' && (
                <Button onClick={handleUpgrade} className="bg-orange-500 hover:bg-orange-600">
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade Plan
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-fit lg:grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="payment-methods" className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4" />
              <span>Payment Methods</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <BillingDashboard
              subscription={subscription}
              usageMetrics={usageMetrics}
              billingHistory={billingHistory}
              overageAlerts={overageAlerts}
              onUpgrade={handleUpgrade}
              onManagePayment={handleManagePayment}
              onDownloadInvoice={downloadInvoice}
              onAcknowledgeAlert={acknowledgeAlert}
            />
          </TabsContent>

          <TabsContent value="payment-methods" className="space-y-6">
            <PaymentMethodManager
              paymentMethods={paymentMethods}
              onAddPaymentMethod={handleAddPaymentMethod}
              onRemovePaymentMethod={removePaymentMethod}
              onSetDefault={setDefaultPaymentMethod}
              onUpdatePaymentMethod={handleUpdatePaymentMethod}
            />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <SubscriptionSettings
              subscription={subscription}
              onChangeBilling={changeBillingInterval}
              onPause={pauseSubscription}
              onResume={resumeSubscription}
              onCancel={cancelSubscription}
              onReactivate={reactivateSubscription}
              onUpdateBillingAddress={updateBillingAddress}
              onUpdateTaxInfo={updateTaxInfo}
              onDownloadData={downloadData}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Quick Actions Sidebar (Hidden on mobile) */}
      <div className="hidden xl:block fixed right-8 top-1/2 transform -translate-y-1/2 space-y-4">
        <Card className="p-4 w-64">
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 text-sm">Quick Actions</h3>
            
            <Button
              onClick={handleUpgrade}
              size="sm"
              variant="outline"
              className="w-full justify-start"
            >
              <Crown className="h-3 w-3 mr-2" />
              Upgrade Plan
            </Button>
            
            <Button
              onClick={() => setActiveTab('payment-methods')}
              size="sm"
              variant="outline"
              className="w-full justify-start"
            >
              <CreditCard className="h-3 w-3 mr-2" />
              Manage Payments
            </Button>
            
            <Button
              onClick={() => downloadData()}
              size="sm"
              variant="outline"
              className="w-full justify-start"
            >
              <BarChart3 className="h-3 w-3 mr-2" />
              Download Data
            </Button>
          </div>
        </Card>

        {/* Help Card */}
        <Card className="p-4 w-64 bg-blue-50 border-blue-200">
          <div className="space-y-2">
            <h4 className="font-medium text-blue-900 text-sm">Need Help?</h4>
            <p className="text-xs text-blue-700">
              Our support team is here to help with billing questions.
            </p>
            <Button
              size="sm"
              className="w-full bg-blue-600 hover:bg-blue-700 text-xs"
              onClick={() => window.open('mailto:support@gomflow.com?subject=Billing Support', '_blank')}
            >
              Contact Support
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}