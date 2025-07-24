'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowRight, 
  Check, 
  AlertTriangle, 
  Calendar, 
  CreditCard,
  Loader2,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { 
  SubscriptionPlan, 
  BillingInterval, 
  UpgradePreview,
  PlanDefinition 
} from 'gomflow-shared/types';

interface PlanSelectorProps {
  currentPlan: SubscriptionPlan;
  targetPlan: SubscriptionPlan;
  billingInterval: BillingInterval;
  userCountry: 'PH' | 'MY' | 'TH' | 'ID' | 'US';
  upgradePreview?: UpgradePreview;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

// Simplified plan definitions for the selector
const PLAN_INFO: Record<SubscriptionPlan, { name: string; description: string; color: string }> = {
  free: {
    name: 'Free',
    description: 'Basic features for getting started',
    color: 'gray',
  },
  starter: {
    name: 'Starter',
    description: 'Perfect for growing GOMs',
    color: 'blue',
  },
  professional: {
    name: 'Professional',
    description: 'Advanced features for serious GOMs',
    color: 'purple',
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Full-featured solution for teams',
    color: 'orange',
  },
};

export function PlanSelector({
  currentPlan,
  targetPlan,
  billingInterval,
  userCountry,
  upgradePreview,
  isLoading = false,
  onConfirm,
  onCancel,
  className = '',
}: PlanSelectorProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const isUpgrade = ['free', 'starter', 'professional', 'enterprise'].indexOf(targetPlan) > 
                   ['free', 'starter', 'professional', 'enterprise'].indexOf(currentPlan);
  const isDowngrade = !isUpgrade && currentPlan !== targetPlan;

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

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
    } finally {
      setIsProcessing(false);
    }
  };

  const currentPlanInfo = PLAN_INFO[currentPlan];
  const targetPlanInfo = PLAN_INFO[targetPlan];

  if (isLoading) {
    return (
      <Card className={`p-8 ${className}`}>
        <div className="flex items-center justify-center space-x-3">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          <span className="text-gray-600">Loading plan details...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-8 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2">
            {isUpgrade ? (
              <TrendingUp className="h-6 w-6 text-green-500" />
            ) : (
              <TrendingDown className="h-6 w-6 text-orange-500" />
            )}
            <h2 className="text-2xl font-bold text-gray-900">
              {currentPlan === targetPlan ? 'Change Billing Cycle' : isUpgrade ? 'Upgrade Plan' : 'Downgrade Plan'}
            </h2>
          </div>
          <p className="text-gray-600">
            {currentPlan === targetPlan 
              ? `Switch to ${billingInterval}ly billing`
              : `${isUpgrade ? 'Upgrade' : 'Downgrade'} from ${currentPlanInfo.name} to ${targetPlanInfo.name}`
            }
          </p>
        </div>

        {/* Plan Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Current Plan */}
          <div className="text-center space-y-3">
            <div className="space-y-2">
              <Badge variant="outline" className="text-xs">
                Current Plan
              </Badge>
              <h3 className="text-lg font-semibold text-gray-900">
                {currentPlanInfo.name}
              </h3>
              <p className="text-sm text-gray-600">
                {currentPlanInfo.description}
              </p>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <ArrowRight className="h-8 w-8 text-gray-400" />
          </div>

          {/* Target Plan */}
          <div className="text-center space-y-3">
            <div className="space-y-2">
              <Badge 
                className={`text-xs ${
                  isUpgrade 
                    ? 'bg-green-500 hover:bg-green-600' 
                    : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {isUpgrade ? 'Upgrading to' : 'Downgrading to'}
              </Badge>
              <h3 className="text-lg font-semibold text-gray-900">
                {targetPlanInfo.name}
              </h3>
              <p className="text-sm text-gray-600">
                {targetPlanInfo.description}
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Details */}
        {upgradePreview && (
          <div className="bg-gray-50 rounded-lg p-6 space-y-4">
            <h4 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <CreditCard className="h-5 w-5" />
              <span>Billing Summary</span>
            </h4>
            
            <div className="space-y-3">
              {upgradePreview.prorated_amount !== 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">
                    {isUpgrade ? 'Prorated charge today:' : 'Prorated credit:'}
                  </span>
                  <span className={`font-medium ${
                    upgradePreview.prorated_amount > 0 ? 'text-gray-900' : 'text-green-600'
                  }`}>
                    {upgradePreview.prorated_amount > 0 ? '+' : ''}
                    {formatPrice(upgradePreview.prorated_amount, upgradePreview.currency)}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Next billing amount:</span>
                <span className="font-medium text-gray-900">
                  {formatPrice(upgradePreview.next_payment_amount, upgradePreview.currency)}
                  <span className="text-sm text-gray-500 ml-1">
                    /{billingInterval}
                  </span>
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Next billing date:</span>
                <span className="font-medium text-gray-900">
                  {new Date(upgradePreview.next_billing_date).toLocaleDateString()}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Effective date:</span>
                <span className="font-medium text-gray-900">
                  {new Date(upgradePreview.effective_date).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Important Notes */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h5 className="font-medium text-yellow-800">Important Notes</h5>
              <ul className="text-sm text-yellow-700 space-y-1">
                {isUpgrade ? (
                  <>
                    <li>• Your new features will be available immediately</li>
                    <li>• You'll be charged the prorated amount today</li>
                    <li>• Future billing will be on the new plan rate</li>
                  </>
                ) : (
                  <>
                    <li>• Plan change takes effect at the end of current billing period</li>
                    <li>• You'll keep current features until then</li>
                    <li>• Any credits will be applied to future billing</li>
                  </>
                )}
                <li>• You can change or cancel anytime from your billing settings</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Key Features Comparison */}
        {currentPlan !== targetPlan && (
          <div className="space-y-4">
            <h5 className="font-medium text-gray-900">What's changing:</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isUpgrade ? (
                <>
                  <div className="flex items-center space-x-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span className="text-sm">Higher order limits</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span className="text-sm">More team members</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span className="text-sm">Advanced analytics</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-600">
                    <Check className="h-4 w-4" />
                    <span className="text-sm">Priority support</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-2 text-orange-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">Reduced order limits</span>
                  </div>
                  <div className="flex items-center space-x-2 text-orange-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">Fewer team members</span>
                  </div>
                  <div className="flex items-center space-x-2 text-orange-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">Limited analytics</span>
                  </div>
                  <div className="flex items-center space-x-2 text-orange-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">Standard support</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing}
            className={`flex-1 ${
              isUpgrade 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Calendar className="h-4 w-4 mr-2" />
            )}
            {isProcessing 
              ? 'Processing...' 
              : currentPlan === targetPlan 
              ? 'Change Billing Cycle'
              : isUpgrade 
              ? 'Confirm Upgrade' 
              : 'Confirm Downgrade'
            }
          </Button>
        </div>
      </div>
    </Card>
  );
}