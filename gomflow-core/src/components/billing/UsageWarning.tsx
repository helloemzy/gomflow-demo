'use client';

import React, { useState, useEffect } from 'react';
import { 
  FeatureAccess, 
  SubscriptionPlan, 
  UsageLimitAlert 
} from '@gomflow/shared';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangleIcon,
  TrendingUpIcon,
  XIcon,
  ArrowUpIcon,
  CalendarIcon,
  BarChart3Icon,
  ZapIcon,
  InfoIcon
} from 'lucide-react';

// =============================================================================
// USAGE WARNING COMPONENT
// =============================================================================

export interface UsageWarningProps {
  alert: UsageLimitAlert;
  featureName: string;
  currentPlan: SubscriptionPlan;
  onUpgrade?: () => void;
  onDismiss?: (alertId: string) => void;
  onViewUsage?: () => void;
  compact?: boolean;
  className?: string;
}

export function UsageWarning({
  alert,
  featureName,
  currentPlan,
  onUpgrade,
  onDismiss,
  onViewUsage,
  compact = false,
  className = '',
}: UsageWarningProps) {
  const [dismissed, setDismissed] = useState(false);
  
  if (dismissed || alert.resolved) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.(alert.id);
  };

  const severity = getSeverity(alert.alert_threshold);
  const timeUntilReset = getTimeUntilReset(alert);
  
  if (compact) {
    return (
      <CompactUsageWarning
        alert={alert}
        featureName={featureName}
        severity={severity}
        onUpgrade={onUpgrade}
        onDismiss={handleDismiss}
        className={className}
      />
    );
  }

  return (
    <Card className={`${severity.bgColor} border-l-4 ${severity.borderColor} ${className}`}>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${severity.iconBg}`}>
              <severity.icon className={`w-5 h-5 ${severity.iconColor}`} />
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <h3 className={`font-semibold text-lg ${severity.textColor}`}>
                  {severity.title}
                </h3>
                <Badge variant={severity.badgeVariant} className="text-xs">
                  {alert.alert_threshold}% Used
                </Badge>
              </div>
              <p className={`text-sm ${severity.textColor} opacity-80`}>
                You've used {alert.current_value.toLocaleString()} of {alert.limit_value.toLocaleString()} {formatFeatureName(featureName).toLowerCase()}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600"
          >
            <XIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* Usage Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Current Usage
            </span>
            <span className="text-sm text-gray-600">
              {alert.percentage_used.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={alert.percentage_used} 
            className={`h-3 ${severity.progressBg}`}
          />
          <div className="flex justify-between text-xs text-gray-600 mt-2">
            <span>{alert.current_value.toLocaleString()} used</span>
            <span>{(alert.limit_value - alert.current_value).toLocaleString()} remaining</span>
          </div>
        </div>

        {/* Time Until Reset */}
        {timeUntilReset && (
          <div className="mb-6 flex items-center space-x-2 text-sm text-gray-600">
            <CalendarIcon className="w-4 h-4" />
            <span>Usage resets {timeUntilReset}</span>
          </div>
        )}

        {/* Impact Warning */}
        {alert.alert_threshold >= 95 && (
          <div className={`mb-6 p-4 rounded-lg ${severity.warningBg}`}>
            <div className="flex items-center space-x-2">
              <AlertTriangleIcon className={`w-5 h-5 ${severity.warningColor}`} />
              <div>
                <p className={`font-medium ${severity.warningColor}`}>
                  {alert.alert_threshold === 100 ? 'Feature Disabled' : 'Service Interruption Imminent'}
                </p>
                <p className={`text-sm ${severity.warningColor} mt-1`}>
                  {alert.alert_threshold === 100 
                    ? `You cannot use ${formatFeatureName(featureName).toLowerCase()} until you upgrade or wait for reset.`
                    : `You may lose access to ${formatFeatureName(featureName).toLowerCase()} soon.`
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="mb-6">
          <h4 className="font-medium text-gray-900 mb-3">Recommendations:</h4>
          <div className="space-y-2">
            {getRecommendations(alert, currentPlan, featureName).map((recommendation, index) => (
              <div key={index} className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                <span className="text-sm text-gray-700">{recommendation}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={onUpgrade}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          >
            <ArrowUpIcon className="w-4 h-4 mr-2" />
            Upgrade to {getRecommendedPlan(currentPlan)}
          </Button>
          
          <div className="flex gap-2">
            {onViewUsage && (
              <Button
                variant="outline"
                onClick={onViewUsage}
                className="flex-1 sm:flex-none"
              >
                <BarChart3Icon className="w-4 h-4 mr-2" />
                View Usage
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={handleDismiss}
              className="flex-1 sm:flex-none"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// =============================================================================
// COMPACT USAGE WARNING
// =============================================================================

interface CompactUsageWarningProps {
  alert: UsageLimitAlert;
  featureName: string;
  severity: SeverityConfig;
  onUpgrade?: () => void;
  onDismiss?: () => void;
  className?: string;
}

function CompactUsageWarning({
  alert,
  featureName,
  severity,
  onUpgrade,
  onDismiss,
  className,
}: CompactUsageWarningProps) {
  return (
    <Card className={`${severity.bgColor} border-l-4 ${severity.borderColor} ${className}`}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <severity.icon className={`w-5 h-5 ${severity.iconColor}`} />
            <div>
              <p className={`font-medium ${severity.textColor}`}>
                {formatFeatureName(featureName)} at {alert.percentage_used.toFixed(0)}%
              </p>
              <p className={`text-xs ${severity.textColor} opacity-80`}>
                {alert.current_value} / {alert.limit_value} used
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Progress 
              value={alert.percentage_used} 
              className="w-16 h-2"
            />
            <Button
              size="sm"
              onClick={onUpgrade}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs"
            >
              Upgrade
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <XIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// =============================================================================
// USAGE SUMMARY WIDGET
// =============================================================================

export interface UsageSummaryProps {
  alerts: UsageLimitAlert[];
  totalFeatures: number;
  onUpgrade?: () => void;
  onViewDetails?: () => void;
  className?: string;
}

export function UsageSummary({
  alerts,
  totalFeatures,
  onUpgrade,
  onViewDetails,
  className = '',
}: UsageSummaryProps) {
  const criticalAlerts = alerts.filter(a => a.alert_threshold === 100);
  const warningAlerts = alerts.filter(a => a.alert_threshold >= 90 && a.alert_threshold < 100);
  const totalAlerts = alerts.length;

  if (totalAlerts === 0) {
    return (
      <Card className={`bg-green-50 border-green-200 ${className}`}>
        <div className="p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-green-100">
              <ZapIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-green-900">Usage Healthy</h3>
              <p className="text-sm text-green-700">All features within limits</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`border-orange-200 bg-orange-50 ${className}`}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-orange-100">
              <AlertTriangleIcon className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-medium text-orange-900">Usage Alerts</h3>
              <p className="text-sm text-orange-700">
                {totalAlerts} feature{totalAlerts > 1 ? 's' : ''} approaching limits
              </p>
            </div>
          </div>
          <InfoIcon className="w-5 h-5 text-orange-600" />
        </div>

        {/* Alert Summary */}
        <div className="space-y-2 mb-4">
          {criticalAlerts.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-red-700 font-medium">At Limit:</span>
              <Badge variant="destructive" className="text-xs">
                {criticalAlerts.length}
              </Badge>
            </div>
          )}
          {warningAlerts.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-orange-700 font-medium">Near Limit:</span>
              <Badge variant="secondary" className="text-xs bg-orange-200 text-orange-800">
                {warningAlerts.length}
              </Badge>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Button
            size="sm"
            onClick={onUpgrade}
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
          >
            <ArrowUpIcon className="w-4 h-4 mr-1" />
            Upgrade
          </Button>
          {onViewDetails && (
            <Button
              variant="outline"
              size="sm"
              onClick={onViewDetails}
              className="flex-1"
            >
              <BarChart3Icon className="w-4 h-4 mr-1" />
              Details
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// =============================================================================
// UTILITY FUNCTIONS & TYPES
// =============================================================================

interface SeverityConfig {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
  iconBg: string;
  progressBg: string;
  badgeVariant: 'default' | 'destructive' | 'outline' | 'secondary';
  warningBg: string;
  warningColor: string;
}

function getSeverity(threshold: number): SeverityConfig {
  if (threshold === 100) {
    return {
      title: 'Feature Limit Reached',
      icon: AlertTriangleIcon,
      bgColor: 'bg-red-50',
      borderColor: 'border-l-red-500',
      textColor: 'text-red-900',
      iconColor: 'text-red-600',
      iconBg: 'bg-red-100',
      progressBg: 'bg-red-100',
      badgeVariant: 'destructive',
      warningBg: 'bg-red-100',
      warningColor: 'text-red-800',
    };
  } else if (threshold >= 95) {
    return {
      title: 'Critical Usage Level',
      icon: AlertTriangleIcon,
      bgColor: 'bg-orange-50',
      borderColor: 'border-l-orange-500',
      textColor: 'text-orange-900',
      iconColor: 'text-orange-600',
      iconBg: 'bg-orange-100',
      progressBg: 'bg-orange-100',
      badgeVariant: 'destructive',
      warningBg: 'bg-orange-100',
      warningColor: 'text-orange-800',
    };
  } else if (threshold >= 90) {
    return {
      title: 'High Usage Warning',
      icon: TrendingUpIcon,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-l-yellow-500',
      textColor: 'text-yellow-900',
      iconColor: 'text-yellow-600',
      iconBg: 'bg-yellow-100',
      progressBg: 'bg-yellow-100',
      badgeVariant: 'secondary',
      warningBg: 'bg-yellow-100',
      warningColor: 'text-yellow-800',
    };
  } else {
    return {
      title: 'Usage Notification',
      icon: InfoIcon,
      bgColor: 'bg-blue-50',
      borderColor: 'border-l-blue-500',
      textColor: 'text-blue-900',
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-100',
      progressBg: 'bg-blue-100',
      badgeVariant: 'outline',
      warningBg: 'bg-blue-100',
      warningColor: 'text-blue-800',
    };
  }
}

function getTimeUntilReset(alert: UsageLimitAlert): string | null {
  // This would typically come from the alert data or be calculated
  // For now, assuming monthly reset cycle
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysUntilReset = Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntilReset === 1) return 'tomorrow';
  if (daysUntilReset <= 7) return `in ${daysUntilReset} days`;
  if (daysUntilReset <= 14) return 'in about 2 weeks';
  return 'next month';
}

function getRecommendations(
  alert: UsageLimitAlert,
  currentPlan: SubscriptionPlan,
  featureName: string
): string[] {
  const recommendations: string[] = [];
  
  if (alert.alert_threshold === 100) {
    recommendations.push('Upgrade immediately to restore access to this feature');
    recommendations.push('Consider the Professional plan for unlimited usage');
  } else if (alert.alert_threshold >= 95) {
    recommendations.push('Upgrade before reaching the limit to avoid service interruption');
    recommendations.push('Monitor usage closely over the next few days');
  } else if (alert.alert_threshold >= 90) {
    recommendations.push('Consider upgrading to avoid hitting limits');
    recommendations.push('Review your usage patterns to optimize efficiency');
  } else {
    recommendations.push('Monitor usage to plan for potential upgrade');
    recommendations.push('Consider upgrading if usage continues to grow');
  }

  // Plan-specific recommendations
  if (currentPlan === 'freemium') {
    recommendations.push('Starter plan provides 4x more capacity');
  } else if (currentPlan === 'starter') {
    recommendations.push('Professional plan offers unlimited usage');
  }

  return recommendations;
}

function getRecommendedPlan(currentPlan: SubscriptionPlan): string {
  const planOrder: SubscriptionPlan[] = ['freemium', 'starter', 'professional', 'enterprise'];
  const currentIndex = planOrder.indexOf(currentPlan);
  const nextPlan = planOrder[currentIndex + 1] || 'enterprise';
  
  return nextPlan.charAt(0).toUpperCase() + nextPlan.slice(1);
}

function formatFeatureName(featureName: string): string {
  return featureName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}