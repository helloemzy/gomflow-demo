'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { 
  Subscription, 
  UsageMetrics, 
  SubscriptionPlan, 
  BillingInterval,
  UpgradePreview,
  OverageAlert 
} from 'gomflow-shared/types';

interface UseSubscriptionReturn {
  // Data
  subscription: Subscription | null;
  usageMetrics: UsageMetrics | null;
  overageAlerts: OverageAlert[];
  upgradePreview: UpgradePreview | null;
  
  // Loading states
  isLoading: boolean;
  isUpgrading: boolean;
  isError: boolean;
  error: string | null;
  
  // Actions
  changePlan: (plan: SubscriptionPlan, interval: BillingInterval) => Promise<void>;
  getUpgradePreview: (plan: SubscriptionPlan, interval: BillingInterval) => Promise<void>;
  pauseSubscription: () => Promise<void>;
  resumeSubscription: () => Promise<void>;
  cancelSubscription: () => Promise<void>;
  reactivateSubscription: () => Promise<void>;
  changeBillingInterval: (interval: BillingInterval) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const fetcher = async (url: string) => {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Request failed');
  }

  return data.data;
};

export function useSubscription(): UseSubscriptionReturn {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradePreview, setUpgradePreview] = useState<UpgradePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch subscription data
  const { 
    data: subscription, 
    error: subscriptionError, 
    mutate: mutateSubscription,
    isLoading: subscriptionLoading 
  } = useSWR<Subscription>('/api/billing/subscription', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
    revalidateOnFocus: true,
  });

  // Fetch usage metrics
  const { 
    data: usageMetrics, 
    error: usageError,
    mutate: mutateUsage,
    isLoading: usageLoading 
  } = useSWR<UsageMetrics>('/api/billing/usage', fetcher, {
    refreshInterval: 60000, // Refresh every minute
    revalidateOnFocus: true,
  });

  // Fetch overage alerts
  const { 
    data: overageAlerts = [], 
    error: alertsError,
    mutate: mutateAlerts 
  } = useSWR<OverageAlert[]>('/api/billing/alerts', fetcher, {
    refreshInterval: 120000, // Refresh every 2 minutes
  });

  const isLoading = subscriptionLoading || usageLoading;
  const isError = !!(subscriptionError || usageError || alertsError);

  // Set error state
  useEffect(() => {
    if (subscriptionError || usageError || alertsError) {
      setError(subscriptionError?.message || usageError?.message || alertsError?.message || 'Unknown error');
    } else {
      setError(null);
    }
  }, [subscriptionError, usageError, alertsError]);

  // Get upgrade preview
  const getUpgradePreview = useCallback(async (plan: SubscriptionPlan, interval: BillingInterval) => {
    try {
      setError(null);
      const response = await fetch('/api/billing/preview-upgrade', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan, interval }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to get upgrade preview');
      }

      setUpgradePreview(data.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get upgrade preview';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Change plan
  const changePlan = useCallback(async (plan: SubscriptionPlan, interval: BillingInterval) => {
    setIsUpgrading(true);
    setError(null);

    try {
      const response = await fetch('/api/billing/change-plan', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plan, interval }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to change plan');
      }

      // Refresh subscription data
      await mutateSubscription();
      await mutateUsage();
      setUpgradePreview(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to change plan';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUpgrading(false);
    }
  }, [mutateSubscription, mutateUsage]);

  // Change billing interval
  const changeBillingInterval = useCallback(async (interval: BillingInterval) => {
    if (!subscription) return;
    
    setIsUpgrading(true);
    setError(null);

    try {
      const response = await fetch('/api/billing/change-interval', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ interval }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to change billing interval');
      }

      await mutateSubscription();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to change billing interval';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUpgrading(false);
    }
  }, [subscription, mutateSubscription]);

  // Pause subscription
  const pauseSubscription = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch('/api/billing/pause', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to pause subscription');
      }

      await mutateSubscription();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pause subscription';
      setError(errorMessage);
      throw err;
    }
  }, [mutateSubscription]);

  // Resume subscription
  const resumeSubscription = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch('/api/billing/resume', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to resume subscription');
      }

      await mutateSubscription();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resume subscription';
      setError(errorMessage);
      throw err;
    }
  }, [mutateSubscription]);

  // Cancel subscription
  const cancelSubscription = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch('/api/billing/cancel', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      await mutateSubscription();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel subscription';
      setError(errorMessage);
      throw err;
    }
  }, [mutateSubscription]);

  // Reactivate subscription
  const reactivateSubscription = useCallback(async () => {
    setError(null);

    try {
      const response = await fetch('/api/billing/reactivate', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to reactivate subscription');
      }

      await mutateSubscription();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reactivate subscription';
      setError(errorMessage);
      throw err;
    }
  }, [mutateSubscription]);

  // Acknowledge alert
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    setError(null);

    try {
      const response = await fetch(`/api/billing/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to acknowledge alert');
      }

      await mutateAlerts();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to acknowledge alert';
      setError(errorMessage);
      throw err;
    }
  }, [mutateAlerts]);

  // Refresh subscription
  const refreshSubscription = useCallback(async () => {
    setError(null);
    await Promise.all([
      mutateSubscription(),
      mutateUsage(),
      mutateAlerts(),
    ]);
  }, [mutateSubscription, mutateUsage, mutateAlerts]);

  return {
    // Data
    subscription: subscription || null,
    usageMetrics: usageMetrics || null,
    overageAlerts,
    upgradePreview,
    
    // Loading states
    isLoading,
    isUpgrading,
    isError,
    error,
    
    // Actions
    changePlan,
    getUpgradePreview,
    pauseSubscription,
    resumeSubscription,
    cancelSubscription,
    reactivateSubscription,
    changeBillingInterval,
    acknowledgeAlert,
    refreshSubscription,
  };
}