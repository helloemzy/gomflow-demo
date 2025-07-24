'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  UserFeatureAccess, 
  FeatureAccess, 
  SubscriptionPlan, 
  SubscriptionStatus 
} from '@gomflow/shared';
import { featureGating } from '@/lib/subscriptions/featureGating';
import { useUser } from '@supabase/auth-helpers-react';

// =============================================================================
// FEATURE ACCESS HOOK
// =============================================================================

export interface UseFeatureAccessReturn {
  userAccess: UserFeatureAccess | null;
  loading: boolean;
  error: string | null;
  checkFeature: (featureName: string) => FeatureGateResult;
  hasFeature: (featureName: string) => boolean;
  canUseFeature: (featureName: string) => Promise<boolean>;
  getFeatureUsage: (featureName: string) => FeatureUsageInfo;
  refreshAccess: () => Promise<void>;
  degradationLevel: 'none' | 'warning' | 'limited' | 'readonly' | 'locked';
  isTrialActive: boolean;
  gracePeriodEnd: Date | null;
}

export interface FeatureGateResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: SubscriptionPlan;
  usageInfo?: {
    used: number;
    limit: number;
    percentage: number;
  };
}

export interface FeatureUsageInfo {
  used: number;
  limit: number | null;
  percentage: number;
  remaining: number | null;
  resetDate: Date | null;
  isUnlimited: boolean;
  nearLimit: boolean;
  atLimit: boolean;
}

export function useFeatureAccess(): UseFeatureAccessReturn {
  const user = useUser();
  const [userAccess, setUserAccess] = useState<UserFeatureAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [degradationLevel, setDegradationLevel] = useState<'none' | 'warning' | 'limited' | 'readonly' | 'locked'>('none');

  // Load user feature access
  const loadUserAccess = useCallback(async () => {
    if (!user?.id) {
      setUserAccess(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const access = await featureGating.getUserFeatureAccess(user.id);
      setUserAccess(access);

      // Get degradation level
      const degraded = await featureGating.getDegradedFeatureSet(user.id);
      setDegradationLevel(degraded.degradationLevel);

    } catch (err) {
      console.error('Failed to load feature access:', err);
      setError(err instanceof Error ? err.message : 'Failed to load feature access');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Initial load and user change effect
  useEffect(() => {
    loadUserAccess();
  }, [loadUserAccess]);

  // Check if user has a specific feature
  const checkFeature = useCallback((featureName: string): FeatureGateResult => {
    if (!userAccess) {
      return { allowed: false, reason: 'User access not loaded' };
    }

    const feature = userAccess.features[featureName];
    if (!feature) {
      return { allowed: false, reason: 'Feature not found' };
    }

    if (!feature.enabled) {
      return {
        allowed: false,
        reason: 'Feature not available on current plan',
        upgradeRequired: feature.upgrade_plan,
      };
    }

    // Check usage limits
    if (feature.limit && feature.used !== undefined) {
      const percentage = (feature.used / feature.limit) * 100;
      
      if (feature.used >= feature.limit) {
        return {
          allowed: false,
          reason: 'Usage limit exceeded',
          upgradeRequired: getNextPlan(userAccess.plan),
          usageInfo: {
            used: feature.used,
            limit: feature.limit,
            percentage,
          },
        };
      }

      return {
        allowed: true,
        usageInfo: {
          used: feature.used,
          limit: feature.limit,
          percentage,
        },
      };
    }

    return { allowed: true };
  }, [userAccess]);

  // Simple boolean check for feature availability
  const hasFeature = useCallback((featureName: string): boolean => {
    return checkFeature(featureName).allowed;
  }, [checkFeature]);

  // Async check that also validates usage with server
  const canUseFeature = useCallback(async (featureName: string): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const result = await featureGating.checkFeatureAccess(user.id, featureName, {
        allowTrial: true,
        allowGracePeriod: true,
      });
      return result.allowed;
    } catch (error) {
      console.error('Feature access check failed:', error);
      return false;
    }
  }, [user?.id]);

  // Get detailed usage information for a feature
  const getFeatureUsage = useCallback((featureName: string): FeatureUsageInfo => {
    const defaultUsage: FeatureUsageInfo = {
      used: 0,
      limit: null,
      percentage: 0,
      remaining: null,
      resetDate: null,
      isUnlimited: true,
      nearLimit: false,
      atLimit: false,
    };

    if (!userAccess) return defaultUsage;

    const feature = userAccess.features[featureName];
    if (!feature) return defaultUsage;

    const used = feature.used || 0;
    const limit = feature.limit;
    
    if (!limit) {
      return {
        ...defaultUsage,
        used,
        isUnlimited: true,
      };
    }

    const percentage = (used / limit) * 100;
    const remaining = Math.max(0, limit - used);

    return {
      used,
      limit,
      percentage,
      remaining,
      resetDate: feature.reset_date || null,
      isUnlimited: false,
      nearLimit: percentage >= 80,
      atLimit: percentage >= 100,
    };
  }, [userAccess]);

  // Refresh user access data
  const refreshAccess = useCallback(async () => {
    await loadUserAccess();
  }, [loadUserAccess]);

  return {
    userAccess,
    loading,
    error,
    checkFeature,
    hasFeature,
    canUseFeature,
    getFeatureUsage,
    refreshAccess,
    degradationLevel,
    isTrialActive: userAccess?.trial_features_enabled || false,
    gracePeriodEnd: userAccess?.grace_period_until || null,
  };
}

// =============================================================================
// SPECIFIC FEATURE HOOKS
// =============================================================================

export function useOrderCreation() {
  const { checkFeature, getFeatureUsage, canUseFeature } = useFeatureAccess();
  
  return {
    canCreateOrder: checkFeature('order_creation').allowed,
    orderUsage: getFeatureUsage('order_creation'),
    checkOrderCreation: () => checkFeature('order_creation'),
    validateOrderCreation: () => canUseFeature('order_creation'),
  };
}

export function useBulkMessaging() {
  const { checkFeature, hasFeature, canUseFeature } = useFeatureAccess();
  
  return {
    canUseBulkMessaging: hasFeature('bulk_messaging'),
    checkBulkMessaging: () => checkFeature('bulk_messaging'),
    validateBulkMessaging: () => canUseFeature('bulk_messaging'),
  };
}

export function useAdvancedAnalytics() {
  const { checkFeature, hasFeature, canUseFeature } = useFeatureAccess();
  
  return {
    canUseAdvancedAnalytics: hasFeature('advanced_reporting'),
    checkAdvancedAnalytics: () => checkFeature('advanced_reporting'),
    validateAdvancedAnalytics: () => canUseFeature('advanced_reporting'),
  };
}

export function useAPIAccess() {
  const { checkFeature, hasFeature, canUseFeature, getFeatureUsage } = useFeatureAccess();
  
  return {
    canUseAPI: hasFeature('api_access'),
    apiUsage: getFeatureUsage('api_calls_made'),
    checkAPIAccess: () => checkFeature('api_access'),
    validateAPIAccess: () => canUseFeature('api_access'),
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getNextPlan(currentPlan: SubscriptionPlan): SubscriptionPlan {
  const planOrder: SubscriptionPlan[] = ['freemium', 'starter', 'professional', 'enterprise'];
  const currentIndex = planOrder.indexOf(currentPlan);
  return planOrder[currentIndex + 1] || 'enterprise';
}