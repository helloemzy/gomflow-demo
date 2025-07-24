'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  UsageMetrics, 
  UsageLimitAlert, 
  SubscriptionPlan 
} from '@gomflow/shared';
import { usageEnforcement } from '@/lib/subscriptions/usageEnforcement';
import { useUser } from '@supabase/auth-helpers-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// =============================================================================
// USAGE LIMITS HOOK
// =============================================================================

export interface UseUsageLimitsReturn {
  usage: UsageMetrics | null;
  alerts: UsageLimitAlert[];
  loading: boolean;
  error: string | null;
  incrementUsage: (featureName: string, amount?: number) => Promise<boolean>;
  checkUsage: (featureName: string, amount?: number) => Promise<UsageValidationResult>;
  getUsagePercentage: (featureName: string) => number;
  getRemainingUsage: (featureName: string) => number | null;
  isNearLimit: (featureName: string, threshold?: number) => boolean;
  refreshUsage: () => Promise<void>;
  dismissAlert: (alertId: string) => Promise<void>;
  usageHealth: 'good' | 'warning' | 'critical';
}

export interface UsageValidationResult {
  allowed: boolean;
  reason?: string;
  currentUsage: number;
  limit: number;
  percentage: number;
  resetDate?: Date;
  recommendations?: string[];
}

export function useUsageLimits(): UseUsageLimitsReturn {
  const user = useUser();
  const supabase = createClientComponentClient();
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [alerts, setAlerts] = useState<UsageLimitAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastRefresh = useRef<Date>(new Date());

  // Load usage data
  const loadUsageData = useCallback(async () => {
    if (!user?.id) {
      setUsage(null);
      setAlerts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get current usage metrics
      const usageData = await usageEnforcement.getUserUsageMetrics(user.id);
      setUsage(usageData.currentPeriod);

      // Get active alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('usage_limit_alerts')
        .select('*')
        .eq('user_id', user.id)
        .eq('resolved', false)
        .order('created_at', { ascending: false });

      if (alertsError) {
        throw new Error(`Failed to load alerts: ${alertsError.message}`);
      }

      setAlerts(alertsData || []);
      lastRefresh.current = new Date();

    } catch (err) {
      console.error('Failed to load usage data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  }, [user?.id, supabase]);

  // Initial load and periodic refresh
  useEffect(() => {
    loadUsageData();

    // Set up periodic refresh (every 5 minutes)
    const interval = setInterval(() => {
      const timeSinceRefresh = Date.now() - lastRefresh.current.getTime();
      if (timeSinceRefresh > 5 * 60 * 1000) { // 5 minutes
        loadUsageData();
      }
    }, 60 * 1000); // Check every minute

    return () => clearInterval(interval);
  }, [loadUsageData]);

  // Increment usage for a feature
  const incrementUsage = useCallback(async (
    featureName: string, 
    amount: number = 1
  ): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const result = await usageEnforcement.incrementUsage(
        user.id,
        featureName,
        amount
      );

      if (result.success) {
        // Update local state optimistically
        setUsage(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            [`${featureName}_used`]: (prev[`${featureName}_used` as keyof UsageMetrics] as number || 0) + amount,
            last_updated: new Date(),
          };
        });

        // If an alert was triggered, refresh alerts
        if (result.alertTriggered) {
          setTimeout(loadUsageData, 1000); // Refresh after 1 second
        }
      }

      return result.success;
    } catch (error) {
      console.error('Failed to increment usage:', error);
      return false;
    }
  }, [user?.id, loadUsageData]);

  // Check if usage increment is allowed
  const checkUsage = useCallback(async (
    featureName: string,
    amount: number = 1
  ): Promise<UsageValidationResult> => {
    if (!user?.id) {
      return {
        allowed: false,
        reason: 'User not authenticated',
        currentUsage: 0,
        limit: 0,
        percentage: 0,
      };
    }

    try {
      return await usageEnforcement.validateUsage(user.id, featureName, amount);
    } catch (error) {
      console.error('Usage validation failed:', error);
      return {
        allowed: false,
        reason: 'Validation failed',
        currentUsage: 0,
        limit: 0,
        percentage: 0,
      };
    }
  }, [user?.id]);

  // Get usage percentage for a feature
  const getUsagePercentage = useCallback((featureName: string): number => {
    if (!usage) return 0;

    const used = usage[`${featureName}_used` as keyof UsageMetrics] as number || 0;
    const limit = usage[`${featureName}_limit` as keyof UsageMetrics] as number;

    if (!limit) return 0; // Unlimited
    return (used / limit) * 100;
  }, [usage]);

  // Get remaining usage for a feature
  const getRemainingUsage = useCallback((featureName: string): number | null => {
    if (!usage) return null;

    const used = usage[`${featureName}_used` as keyof UsageMetrics] as number || 0;
    const limit = usage[`${featureName}_limit` as keyof UsageMetrics] as number;

    if (!limit) return null; // Unlimited
    return Math.max(0, limit - used);
  }, [usage]);

  // Check if usage is near a limit
  const isNearLimit = useCallback((featureName: string, threshold: number = 80): boolean => {
    const percentage = getUsagePercentage(featureName);
    return percentage >= threshold;
  }, [getUsagePercentage]);

  // Refresh usage data
  const refreshUsage = useCallback(async () => {
    await loadUsageData();
  }, [loadUsageData]);

  // Dismiss an alert
  const dismissAlert = useCallback(async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('usage_limit_alerts')
        .update({ resolved: true })
        .eq('id', alertId);

      if (error) {
        throw new Error(`Failed to dismiss alert: ${error.message}`);
      }

      // Remove from local state
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    }
  }, [supabase]);

  // Calculate overall usage health
  const usageHealth = useCallback((): 'good' | 'warning' | 'critical' => {
    const criticalAlerts = alerts.filter(alert => alert.alert_threshold === 100);
    const warningAlerts = alerts.filter(alert => alert.alert_threshold >= 90);

    if (criticalAlerts.length > 0) return 'critical';
    if (warningAlerts.length > 2) return 'critical';
    if (warningAlerts.length > 0) return 'warning';
    return 'good';
  }, [alerts]);

  return {
    usage,
    alerts,
    loading,
    error,
    incrementUsage,
    checkUsage,
    getUsagePercentage,
    getRemainingUsage,
    isNearLimit,
    refreshUsage,
    dismissAlert,
    usageHealth: usageHealth(),
  };
}

// =============================================================================
// SPECIFIC USAGE HOOKS
// =============================================================================

export function useOrderUsage() {
  const { 
    incrementUsage, 
    checkUsage, 
    getUsagePercentage, 
    getRemainingUsage,
    isNearLimit,
    usage 
  } = useUsageLimits();

  return {
    ordersUsed: usage?.orders_created || 0,
    ordersRemaining: getRemainingUsage('orders_created'),
    ordersPercentage: getUsagePercentage('orders_created'),
    isNearOrderLimit: isNearLimit('orders_created'),
    canCreateOrder: async () => {
      const result = await checkUsage('orders_created');
      return result.allowed;
    },
    createOrder: async () => {
      return await incrementUsage('orders_created', 1);
    },
  };
}

export function useSubmissionUsage() {
  const { 
    incrementUsage, 
    checkUsage, 
    getUsagePercentage, 
    getRemainingUsage,
    usage 
  } = useUsageLimits();

  return {
    submissionsUsed: usage?.submissions_received || 0,
    submissionsRemaining: getRemainingUsage('submissions_received'),
    submissionsPercentage: getUsagePercentage('submissions_received'),
    canReceiveSubmission: async () => {
      const result = await checkUsage('submissions_received');
      return result.allowed;
    },
    receiveSubmission: async () => {
      return await incrementUsage('submissions_received', 1);
    },
  };
}

export function useAPIUsage() {
  const { 
    incrementUsage, 
    checkUsage, 
    getUsagePercentage, 
    getRemainingUsage,
    isNearLimit,
    usage 
  } = useUsageLimits();

  return {
    apiCallsUsed: usage?.api_calls_made || 0,
    apiCallsRemaining: getRemainingUsage('api_calls_made'),
    apiCallsPercentage: getUsagePercentage('api_calls_made'),
    isNearAPILimit: isNearLimit('api_calls_made'),
    canMakeAPICall: async () => {
      const result = await checkUsage('api_calls_made');
      return result.allowed;
    },
    makeAPICall: async () => {
      return await incrementUsage('api_calls_made', 1);
    },
  };
}

export function useSMSUsage() {
  const { 
    incrementUsage, 
    checkUsage, 
    getUsagePercentage, 
    getRemainingUsage,
    isNearLimit,
    usage 
  } = useUsageLimits();

  return {
    smsUsed: usage?.sms_sent || 0,
    smsRemaining: getRemainingUsage('sms_sent'),
    smsPercentage: getUsagePercentage('sms_sent'),
    isNearSMSLimit: isNearLimit('sms_sent'),
    canSendSMS: async () => {
      const result = await checkUsage('sms_sent');
      return result.allowed;
    },
    sendSMS: async (count: number = 1) => {
      return await incrementUsage('sms_sent', count);
    },
  };
}

// =============================================================================
// USAGE MONITORING HOOK
// =============================================================================

export interface UseUsageMonitoringReturn {
  alerts: UsageLimitAlert[];
  criticalAlerts: UsageLimitAlert[];
  warningAlerts: UsageLimitAlert[];
  hasActiveAlerts: boolean;
  mostCriticalAlert: UsageLimitAlert | null;
  usageHealth: 'good' | 'warning' | 'critical';
  dismissAlert: (alertId: string) => Promise<void>;
  dismissAllAlerts: () => Promise<void>;
  getAlertsByFeature: (featureName: string) => UsageLimitAlert[];
}

export function useUsageMonitoring(): UseUsageMonitoringReturn {
  const { alerts, dismissAlert } = useUsageLimits();
  const supabase = createClientComponentClient();

  const criticalAlerts = alerts.filter(alert => alert.alert_threshold === 100);
  const warningAlerts = alerts.filter(alert => alert.alert_threshold >= 90 && alert.alert_threshold < 100);
  const hasActiveAlerts = alerts.length > 0;

  const mostCriticalAlert = alerts.reduce((most, current) => {
    if (!most) return current;
    if (current.alert_threshold > most.alert_threshold) return current;
    if (current.alert_threshold === most.alert_threshold && current.percentage_used > most.percentage_used) {
      return current;
    }
    return most;
  }, null as UsageLimitAlert | null);

  const usageHealth: 'good' | 'warning' | 'critical' = 
    criticalAlerts.length > 0 ? 'critical' :
    warningAlerts.length > 2 ? 'critical' :
    warningAlerts.length > 0 ? 'warning' : 'good';

  const dismissAllAlerts = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('usage_limit_alerts')
        .update({ resolved: true })
        .in('id', alerts.map(alert => alert.id));

      if (error) {
        throw new Error(`Failed to dismiss alerts: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to dismiss all alerts:', error);
    }
  }, [supabase, alerts]);

  const getAlertsByFeature = useCallback((featureName: string): UsageLimitAlert[] => {
    return alerts.filter(alert => alert.metric_type === featureName);
  }, [alerts]);

  return {
    alerts,
    criticalAlerts,
    warningAlerts,
    hasActiveAlerts,
    mostCriticalAlert,
    usageHealth,
    dismissAlert,
    dismissAllAlerts,
    getAlertsByFeature,
  };
}

// =============================================================================
// USAGE PROJECTION HOOK
// =============================================================================

export interface UseUsageProjectionReturn {
  projectedUsage: Record<string, number>;
  projectedOverages: Record<string, number>;
  timeToLimit: Record<string, number>; // Days until limit reached
  recommendedPlan: SubscriptionPlan | null;
  projectionAccuracy: number; // 0-100%
}

export function useUsageProjection(): UseUsageProjectionReturn {
  const { usage } = useUsageLimits();
  const [projectedUsage, setProjectedUsage] = useState<Record<string, number>>({});
  const [projectedOverages, setProjectedOverages] = useState<Record<string, number>>({});
  const [timeToLimit, setTimeToLimit] = useState<Record<string, number>>({});

  // Calculate projections when usage data changes
  useEffect(() => {
    if (!usage) return;

    const now = new Date();
    const periodStart = new Date(usage.period_start);
    const periodEnd = new Date(usage.period_end);
    
    const totalDays = Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = totalDays - elapsedDays;

    const metrics = [
      'orders_created',
      'submissions_received',
      'api_calls_made',
      'sms_sent',
      'storage_used_mb',
      'webhook_calls',
    ];

    const newProjectedUsage: Record<string, number> = {};
    const newProjectedOverages: Record<string, number> = {};
    const newTimeToLimit: Record<string, number> = {};

    for (const metric of metrics) {
      const used = usage[metric as keyof UsageMetrics] as number || 0;
      const limit = usage[`${metric}_limit` as keyof UsageMetrics] as number;
      
      if (elapsedDays > 0) {
        const dailyRate = used / elapsedDays;
        const projectedTotal = dailyRate * totalDays;
        
        newProjectedUsage[metric] = Math.round(projectedTotal);
        
        if (limit) {
          newProjectedOverages[metric] = Math.max(0, projectedTotal - limit);
          
          if (dailyRate > 0 && used < limit) {
            const daysToLimit = (limit - used) / dailyRate;
            newTimeToLimit[metric] = Math.ceil(daysToLimit);
          }
        }
      }
    }

    setProjectedUsage(newProjectedUsage);
    setProjectedOverages(newProjectedOverages);
    setTimeToLimit(newTimeToLimit);
  }, [usage]);

  // Determine recommended plan based on projections
  const recommendedPlan = (): SubscriptionPlan | null => {
    const hasOverages = Object.values(projectedOverages).some(overage => overage > 0);
    
    if (!hasOverages) return null;

    // Simple logic - would be more sophisticated in production
    const maxOverage = Math.max(...Object.values(projectedOverages));
    
    if (maxOverage > 1000) return 'enterprise';
    if (maxOverage > 100) return 'professional';
    return 'starter';
  };

  // Calculate projection accuracy based on data consistency
  const projectionAccuracy = (): number => {
    if (!usage) return 0;
    
    const now = new Date();
    const periodStart = new Date(usage.period_start);
    const elapsedDays = Math.ceil((now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
    
    // More data points = higher accuracy, but cap at reasonable levels
    const baseAccuracy = Math.min(90, elapsedDays * 5); // 5% per day, max 90%
    
    // Reduce accuracy if usage is highly variable (simplified calculation)
    return Math.max(30, baseAccuracy); // Minimum 30% accuracy
  };

  return {
    projectedUsage,
    projectedOverages,
    timeToLimit,
    recommendedPlan: recommendedPlan(),
    projectionAccuracy: projectionAccuracy(),
  };
}