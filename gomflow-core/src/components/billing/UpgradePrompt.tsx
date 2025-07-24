'use client';

import React, { useState } from 'react';
import { 
  SubscriptionPlan, 
  SubscriptionPlanConfig, 
  UserFeatureAccess,
  FeatureAccess 
} from '@gomflow/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowUpIcon, 
  CheckIcon, 
  XIcon, 
  StarIcon,
  TrendingUpIcon,
  ShieldCheckIcon,
  ZapIcon,
  CrownIcon,
  AlertTriangleIcon
} from 'lucide-react';

// =============================================================================
// UPGRADE PROMPT COMPONENT
// =============================================================================

interface UpgradePromptProps {
  userAccess: UserFeatureAccess;
  triggerFeature?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  customMessage?: string;
  showComparison?: boolean;
  onUpgrade?: (plan: SubscriptionPlan) => void;
  onDismiss?: () => void;
  className?: string;
}

export function UpgradePrompt({
  userAccess,
  triggerFeature,
  urgency = 'medium',
  customMessage,
  showComparison = true,
  onUpgrade,
  onDismiss,
  className = '',
}: UpgradePromptProps) {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('starter');

  const urgencyConfig = {
    low: {
      color: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-600',
      icon: TrendingUpIcon,
      title: 'Unlock More Features',
    },
    medium: {
      color: 'bg-yellow-50 border-yellow-200',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-600',
      icon: StarIcon,
      title: 'Upgrade Recommended',
    },
    high: {
      color: 'bg-orange-50 border-orange-200',
      textColor: 'text-orange-800',
      iconColor: 'text-orange-600',
      icon: ZapIcon,
      title: 'Upgrade to Continue',
    },
    critical: {
      color: 'bg-red-50 border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600',
      icon: AlertTriangleIcon,
      title: 'Immediate Upgrade Required',
    },
  };

  const config = urgencyConfig[urgency];
  const IconComponent = config.icon;

  // Get suggested upgrade plan
  const suggestedPlan = getSuggestedPlan(userAccess, triggerFeature);
  
  // Get feature that triggered the prompt
  const feature = triggerFeature ? userAccess.features[triggerFeature] : null;

  return (
    <Card className={`${config.color} border-2 ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full bg-white shadow-sm`}>
              <IconComponent className={`w-5 h-5 ${config.iconColor}`} />
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${config.textColor}`}>
                {config.title}
              </h3>
              <p className={`text-sm ${config.textColor} opacity-80`}>
                {customMessage || getDefaultMessage(triggerFeature, userAccess.plan)}
              </p>
            </div>
          </div>
          {onDismiss && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600"
            >
              <XIcon className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Feature Usage Display */}
        {feature && feature.limit && feature.used !== undefined && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                {formatFeatureName(triggerFeature!)} Usage
              </span>
              <span className="text-sm text-gray-600">
                {feature.used} / {feature.limit}
              </span>
            </div>
            <Progress 
              value={(feature.used / feature.limit) * 100} 
              className="h-2"
            />
            <p className="text-xs text-gray-600 mt-1">
              {feature.limit - feature.used} remaining
            </p>
          </div>
        )}

        {/* Plan Comparison */}
        {showComparison && (
          <div className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['starter', 'professional', 'enterprise'] as SubscriptionPlan[])
                .filter(plan => getPlanOrder(plan) > getPlanOrder(userAccess.plan))
                .map(plan => (
                  <PlanCard
                    key={plan}
                    plan={plan}
                    isSelected={selectedPlan === plan}
                    isRecommended={plan === suggestedPlan}
                    onSelect={() => setSelectedPlan(plan)}
                    triggerFeature={triggerFeature}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Value Propositions */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">
            What you'll get with {selectedPlan}:
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {getValuePropositions(selectedPlan, userAccess.plan).map((proposition, index) => (
              <div key={index} className="flex items-center space-x-2">
                <CheckIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
                <span className="text-sm text-gray-700">{proposition}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => onUpgrade?.(selectedPlan)}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          >
            <ArrowUpIcon className="w-4 h-4 mr-2" />
            Upgrade to {formatPlanName(selectedPlan)}
          </Button>
          
          {urgency !== 'critical' && (
            <Button
              variant="outline"
              onClick={onDismiss}
              className="flex-1 sm:flex-none"
            >
              Maybe Later
            </Button>
          )}
        </div>

        {/* Urgency-specific footer */}
        {urgency === 'critical' && (
          <div className="mt-4 p-3 bg-red-100 rounded-lg">
            <p className="text-sm text-red-800 font-medium">
              ⚠️ Your account will be restricted until you upgrade
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

// =============================================================================
// PLAN CARD COMPONENT
// =============================================================================

interface PlanCardProps {
  plan: SubscriptionPlan;
  isSelected: boolean;
  isRecommended: boolean;
  onSelect: () => void;
  triggerFeature?: string;
}

function PlanCard({ 
  plan, 
  isSelected, 
  isRecommended, 
  onSelect, 
  triggerFeature 
}: PlanCardProps) {
  const planConfig = getPlanConfig(plan);
  
  return (
    <div
      onClick={onSelect}
      className={`
        relative cursor-pointer rounded-lg border-2 p-4 transition-all
        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
        ${isRecommended ? 'ring-2 ring-purple-500 ring-opacity-50' : ''}
      `}
    >
      {/* Recommended Badge */}
      {isRecommended && (
        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
          <Badge className="bg-purple-600 text-white">
            <CrownIcon className="w-3 h-3 mr-1" />
            Recommended
          </Badge>
        </div>
      )}

      {/* Plan Header */}
      <div className="text-center mb-4">
        <h3 className="font-semibold text-lg text-gray-900">
          {formatPlanName(plan)}
        </h3>
        <div className="text-2xl font-bold text-gray-900 mt-1">
          ${planConfig.price_monthly}
          <span className="text-sm font-normal text-gray-600">/month</span>
        </div>
        {planConfig.price_yearly && (
          <p className="text-xs text-gray-600">
            or ${Math.round(planConfig.price_yearly / 12)}/month billed yearly
          </p>
        )}
      </div>

      {/* Key Features */}
      <div className="space-y-2">
        {getKeyFeatures(plan, triggerFeature).map((feature, index) => (
          <div key={index} className="flex items-center space-x-2">
            <CheckIcon className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span className="text-sm text-gray-700">{feature}</span>
          </div>
        ))}
      </div>

      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2">
          <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
            <CheckIcon className="w-4 h-4 text-white" />
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// USAGE WARNING COMPONENT
// =============================================================================

interface UsageWarningProps {
  feature: FeatureAccess;
  featureName: string;
  threshold: number; // 80, 90, 95
  userPlan: SubscriptionPlan;
  onUpgrade?: () => void;
  onDismiss?: () => void;
}

export function UsageWarning({
  feature,
  featureName,
  threshold,
  userPlan,
  onUpgrade,
  onDismiss,
}: UsageWarningProps) {
  if (!feature.limit || !feature.used) return null;

  const percentage = (feature.used / feature.limit) * 100;
  if (percentage < threshold) return null;

  const isNearLimit = percentage >= 95;
  const daysUntilReset = feature.reset_date ? 
    Math.ceil((feature.reset_date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <Card className={`border-l-4 ${isNearLimit ? 'border-l-red-500 bg-red-50' : 'border-l-yellow-500 bg-yellow-50'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${isNearLimit ? 'bg-red-100' : 'bg-yellow-100'}`}>
              <AlertTriangleIcon className={`w-5 h-5 ${isNearLimit ? 'text-red-600' : 'text-yellow-600'}`} />
            </div>
            <div>
              <h4 className={`font-medium ${isNearLimit ? 'text-red-900' : 'text-yellow-900'}`}>
                {isNearLimit ? 'Usage Limit Nearly Reached' : 'Approaching Usage Limit'}
              </h4>
              <p className={`text-sm ${isNearLimit ? 'text-red-700' : 'text-yellow-700'}`}>
                You've used {feature.used} of {feature.limit} {formatFeatureName(featureName).toLowerCase()}
                {daysUntilReset && ` (resets in ${daysUntilReset} days)`}
              </p>
            </div>
          </div>
          {onDismiss && (
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              <XIcon className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="mt-4 mb-4">
          <Progress value={percentage} className="h-2" />
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>{feature.used} used</span>
            <span>{feature.limit - feature.used} remaining</span>
          </div>
        </div>

        <div className="flex space-x-3">
          <Button
            onClick={onUpgrade}
            size="sm"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          >
            <ArrowUpIcon className="w-4 h-4 mr-1" />
            Upgrade Plan
          </Button>
          <Button variant="outline" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </Card>
  );
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getSuggestedPlan(userAccess: UserFeatureAccess, triggerFeature?: string): SubscriptionPlan {
  const currentPlan = userAccess.plan;
  
  // If a specific feature triggered this, suggest the minimum plan that supports it
  if (triggerFeature) {
    const feature = userAccess.features[triggerFeature];
    if (feature?.upgrade_plan) {
      return feature.upgrade_plan;
    }
  }

  // Default upgrade path
  const planOrder: SubscriptionPlan[] = ['freemium', 'starter', 'professional', 'enterprise'];
  const currentIndex = planOrder.indexOf(currentPlan);
  return planOrder[currentIndex + 1] || 'enterprise';
}

function getPlanOrder(plan: SubscriptionPlan): number {
  const order = { freemium: 0, starter: 1, professional: 2, enterprise: 3 };
  return order[plan] || 0;
}

function getPlanConfig(plan: SubscriptionPlan): SubscriptionPlanConfig {
  // This would normally come from your subscription configuration
  const configs: Record<SubscriptionPlan, SubscriptionPlanConfig> = {
    freemium: {
      id: 'freemium',
      name: 'Freemium',
      description: 'Basic features for trying GOMFLOW',
      price_monthly: 0,
      price_yearly: 0,
      currency: 'USD',
      limits: { max_orders_per_month: 50, max_submissions_per_order: 100, max_api_calls_per_day: 100, max_sms_per_month: 0, max_storage_mb: 100, max_webhook_calls_per_day: 50, max_team_members: 1, custom_branding: false, priority_support: false, api_access: false, advanced_analytics: false, white_label: false, custom_integrations: false, sla_guarantee: false },
      features: { order_creation: true, payment_tracking: true, whatsapp_integration: true, telegram_integration: true, discord_integration: true, smart_payment_agent: false, bulk_messaging: false, analytics_dashboard: true, export_functionality: false, custom_domains: false, team_collaboration: false, api_access: false, webhook_notifications: false, priority_processing: false, custom_branding: false, advanced_reporting: false, fraud_protection: false, dedicated_support: false },
      popular: false,
      trial_days: 14,
      setup_fee: 0,
    },
    starter: {
      id: 'starter',
      name: 'Starter',
      description: 'Perfect for growing GOMs',
      price_monthly: 12,
      price_yearly: 120,
      currency: 'USD',
      limits: { max_orders_per_month: 200, max_submissions_per_order: 500, max_api_calls_per_day: 1000, max_sms_per_month: 100, max_storage_mb: 1000, max_webhook_calls_per_day: 500, max_team_members: 3, custom_branding: true, priority_support: true, api_access: false, advanced_analytics: true, white_label: false, custom_integrations: false, sla_guarantee: false },
      features: { order_creation: true, payment_tracking: true, whatsapp_integration: true, telegram_integration: true, discord_integration: true, smart_payment_agent: true, bulk_messaging: true, analytics_dashboard: true, export_functionality: true, custom_domains: false, team_collaboration: true, api_access: false, webhook_notifications: true, priority_processing: false, custom_branding: true, advanced_reporting: true, fraud_protection: true, dedicated_support: false },
      popular: true,
      trial_days: 14,
      setup_fee: 0,
    },
    professional: {
      id: 'professional',
      name: 'Professional',
      description: 'Unlimited scale for professionals',
      price_monthly: 25,
      price_yearly: 250,
      currency: 'USD',
      limits: { max_orders_per_month: null, max_submissions_per_order: null, max_api_calls_per_day: 10000, max_sms_per_month: 1000, max_storage_mb: 10000, max_webhook_calls_per_day: 5000, max_team_members: 10, custom_branding: true, priority_support: true, api_access: true, advanced_analytics: true, white_label: false, custom_integrations: true, sla_guarantee: true },
      features: { order_creation: true, payment_tracking: true, whatsapp_integration: true, telegram_integration: true, discord_integration: true, smart_payment_agent: true, bulk_messaging: true, analytics_dashboard: true, export_functionality: true, custom_domains: true, team_collaboration: true, api_access: true, webhook_notifications: true, priority_processing: true, custom_branding: true, advanced_reporting: true, fraud_protection: true, dedicated_support: false },
      popular: false,
      trial_days: 14,
      setup_fee: 0,
    },
    enterprise: {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Custom solutions for organizations',
      price_monthly: 100,
      price_yearly: 1000,
      currency: 'USD',
      limits: { max_orders_per_month: null, max_submissions_per_order: null, max_api_calls_per_day: 100000, max_sms_per_month: 10000, max_storage_mb: 100000, max_webhook_calls_per_day: 50000, max_team_members: null, custom_branding: true, priority_support: true, api_access: true, advanced_analytics: true, white_label: true, custom_integrations: true, sla_guarantee: true },
      features: { order_creation: true, payment_tracking: true, whatsapp_integration: true, telegram_integration: true, discord_integration: true, smart_payment_agent: true, bulk_messaging: true, analytics_dashboard: true, export_functionality: true, custom_domains: true, team_collaboration: true, api_access: true, webhook_notifications: true, priority_processing: true, custom_branding: true, advanced_reporting: true, fraud_protection: true, dedicated_support: true },
      popular: false,
      trial_days: 30,
      setup_fee: 0,
    },
  };

  return configs[plan];
}

function getDefaultMessage(triggerFeature?: string, currentPlan?: SubscriptionPlan): string {
  if (triggerFeature) {
    return `${formatFeatureName(triggerFeature)} is not available on your current plan. Upgrade to unlock this feature and grow your business.`;
  }
  
  return `Unlock more features and grow your GOM business with an upgraded plan.`;
}

function formatFeatureName(featureName: string): string {
  return featureName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function formatPlanName(plan: SubscriptionPlan): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

function getValuePropositions(targetPlan: SubscriptionPlan, currentPlan: SubscriptionPlan): string[] {
  const planConfig = getPlanConfig(targetPlan);
  const propositions: string[] = [];

  // Add limit improvements
  if (planConfig.limits.max_orders_per_month === null) {
    propositions.push('Unlimited orders per month');
  } else if (planConfig.limits.max_orders_per_month) {
    propositions.push(`Up to ${planConfig.limits.max_orders_per_month} orders per month`);
  }

  // Add key features
  if (planConfig.features.smart_payment_agent) {
    propositions.push('AI-powered payment processing');
  }
  if (planConfig.features.bulk_messaging) {
    propositions.push('Bulk messaging to buyers');
  }
  if (planConfig.features.advanced_reporting) {
    propositions.push('Advanced analytics & reporting');
  }
  if (planConfig.features.api_access) {
    propositions.push('Full API access');
  }
  if (planConfig.features.custom_branding) {
    propositions.push('Remove GOMFLOW branding');
  }
  if (planConfig.features.priority_processing) {
    propositions.push('Priority processing & support');
  }

  return propositions.slice(0, 6); // Show top 6 benefits
}

function getKeyFeatures(plan: SubscriptionPlan, triggerFeature?: string): string[] {
  const planConfig = getPlanConfig(plan);
  const features: string[] = [];

  // Highlight the trigger feature if it's enabled in this plan
  if (triggerFeature && planConfig.features[triggerFeature as keyof typeof planConfig.features]) {
    features.push(formatFeatureName(triggerFeature));
  }

  // Add other key features
  if (planConfig.limits.max_orders_per_month === null) {
    features.push('Unlimited orders');
  } else if (planConfig.limits.max_orders_per_month) {
    features.push(`${planConfig.limits.max_orders_per_month} orders/month`);
  }

  if (planConfig.features.smart_payment_agent) {
    features.push('AI Payment Agent');
  }
  if (planConfig.features.bulk_messaging) {
    features.push('Bulk messaging');
  }
  if (planConfig.features.api_access) {
    features.push('API access');
  }

  return features.slice(0, 4); // Show top 4 features
}