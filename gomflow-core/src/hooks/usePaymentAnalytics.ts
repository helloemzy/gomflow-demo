"use client";

import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface PaymentMethodStats {
  method: string;
  count: number;
  revenue: number;
  successRate: number;
  avgProcessingTime: number;
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

interface UsePaymentAnalyticsOptions {
  timeRange?: '7d' | '30d' | '90d' | '1y';
  country?: 'PH' | 'MY' | 'all';
  refreshInterval?: number;
}

interface UsePaymentAnalyticsReturn {
  data: PaymentAnalyticsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePaymentAnalytics({
  timeRange = '30d',
  country = 'all',
  refreshInterval
}: UsePaymentAnalyticsOptions = {}): UsePaymentAnalyticsReturn {
  const [data, setData] = useState<PaymentAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  const fetchPaymentAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if in demo mode
      const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
      
      if (isDemoMode) {
        // Return demo data
        const demoData: PaymentAnalyticsData = {
          overview: {
            totalPayments: 847,
            totalRevenue: 284650,
            averageVerificationTime: 18.5,
            successRate: 94.7,
            pendingVerifications: 12,
            disputedPayments: 8
          },
          methodStats: [
            {
              method: 'gcash',
              count: 324,
              revenue: 145200,
              successRate: 96.2,
              avgProcessingTime: 15.3,
              popularCountries: ['PH', 'MY']
            },
            {
              method: 'paymaya',
              count: 198,
              revenue: 67890,
              successRate: 94.1,
              avgProcessingTime: 18.7,
              popularCountries: ['PH']
            },
            {
              method: 'maybank2u',
              count: 156,
              revenue: 42340,
              successRate: 97.4,
              avgProcessingTime: 12.1,
              popularCountries: ['MY']
            },
            {
              method: 'bank_transfer',
              count: 89,
              revenue: 18750,
              successRate: 89.9,
              avgProcessingTime: 35.2,
              popularCountries: ['PH', 'MY']
            },
            {
              method: 'touch_n_go',
              count: 80,
              revenue: 10470,
              successRate: 95.0,
              avgProcessingTime: 16.8,
              popularCountries: ['MY']
            }
          ],
          verificationMetrics: {
            autoVerified: 756,
            manualVerified: 91,
            aiAccuracy: 91.3,
            averageReviewTime: 24.6
          },
          geographicData: [
            {
              country: 'Philippines',
              payments: 542,
              revenue: 231840,
              topMethods: ['gcash', 'paymaya', 'bank_transfer']
            },
            {
              country: 'Malaysia',
              payments: 305,
              revenue: 52810,
              topMethods: ['maybank2u', 'touch_n_go', 'gcash']
            }
          ],
          timeSeriesData: Array.from({ length: 30 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (29 - i));
            return {
              date: date.toISOString().split('T')[0],
              payments: Math.floor(Math.random() * 50) + 15,
              revenue: Math.floor(Math.random() * 15000) + 5000,
              successRate: Math.random() * 10 + 90
            };
          }),
          qualityMetrics: {
            excellentProofs: 643,
            goodProofs: 113,
            poorProofs: 91,
            avgConfidenceScore: 88.4
          }
        };

        setData(demoData);
        return;
      }

      // Real implementation for production
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      switch (timeRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      // Fetch overview statistics
      const { data: overviewData, error: overviewError } = await supabase.rpc(
        'get_payment_overview_stats',
        {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          country_filter: country === 'all' ? null : country,
          user_id_filter: user.id
        }
      );

      if (overviewError) throw overviewError;

      // Fetch payment method statistics
      const { data: methodData, error: methodError } = await supabase.rpc(
        'get_payment_method_stats',
        {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          country_filter: country === 'all' ? null : country,
          user_id_filter: user.id
        }
      );

      if (methodError) throw methodError;

      // Fetch verification metrics
      const { data: verificationData, error: verificationError } = await supabase.rpc(
        'get_verification_metrics',
        {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          user_id_filter: user.id
        }
      );

      if (verificationError) throw verificationError;

      // Fetch geographic data
      const { data: geoData, error: geoError } = await supabase.rpc(
        'get_geographic_payment_stats',
        {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          user_id_filter: user.id
        }
      );

      if (geoError) throw geoError;

      // Fetch time series data
      const { data: timeSeriesData, error: timeSeriesError } = await supabase.rpc(
        'get_payment_time_series',
        {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          user_id_filter: user.id
        }
      );

      if (timeSeriesError) throw timeSeriesError;

      // Fetch payment quality metrics
      const { data: qualityData, error: qualityError } = await supabase.rpc(
        'get_payment_quality_metrics',
        {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          user_id_filter: user.id
        }
      );

      if (qualityError) throw qualityError;

      // Combine all data
      const analyticsData: PaymentAnalyticsData = {
        overview: overviewData[0] || {
          totalPayments: 0,
          totalRevenue: 0,
          averageVerificationTime: 0,
          successRate: 0,
          pendingVerifications: 0,
          disputedPayments: 0
        },
        methodStats: methodData || [],
        verificationMetrics: verificationData[0] || {
          autoVerified: 0,
          manualVerified: 0,
          aiAccuracy: 0,
          averageReviewTime: 0
        },
        geographicData: geoData || [],
        timeSeriesData: timeSeriesData || [],
        qualityMetrics: qualityData[0] || {
          excellentProofs: 0,
          goodProofs: 0,
          poorProofs: 0,
          avgConfidenceScore: 0
        }
      };

      setData(analyticsData);
    } catch (err) {
      console.error('Error fetching payment analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  }, [timeRange, country, supabase]);

  const refetch = useCallback(async () => {
    await fetchPaymentAnalytics();
  }, [fetchPaymentAnalytics]);

  useEffect(() => {
    fetchPaymentAnalytics();
  }, [fetchPaymentAnalytics]);

  // Set up refresh interval if specified
  useEffect(() => {
    if (!refreshInterval) return;

    const interval = setInterval(() => {
      fetchPaymentAnalytics();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, fetchPaymentAnalytics]);

  return {
    data,
    loading,
    error,
    refetch
  };
}

// Helper functions for payment analytics
export const getPaymentMethodColor = (method: string): string => {
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
    'fpx': '#0066CC',
    'bank_transfer': '#6B7280',
    'cash_deposit': '#8B5CF6',
    'custom': '#F59E0B'
  };
  return colors[method] || '#6B7280';
};

export const getPaymentMethodName = (method: string): string => {
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

export const formatPaymentCurrency = (amount: number, currencyCode: string = 'PHP'): string => {
  const symbol = currencyCode === 'PHP' ? '₱' : 'RM';
  return `${symbol}${amount.toLocaleString()}`;
};

export const getSuccessRateStatus = (rate: number): 'excellent' | 'good' | 'needs_improvement' => {
  if (rate >= 95) return 'excellent';
  if (rate >= 85) return 'good';
  return 'needs_improvement';
};