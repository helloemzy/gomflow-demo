'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { 
  BillingHistory, 
  PaymentMethodData 
} from 'gomflow-shared/types';

interface UseBillingReturn {
  // Data
  billingHistory: BillingHistory[];
  paymentMethods: PaymentMethodData[];
  
  // Loading states
  isLoading: boolean;
  isProcessing: boolean;
  isError: boolean;
  error: string | null;
  
  // Actions
  addPaymentMethod: (paymentData: any) => Promise<void>;
  removePaymentMethod: (methodId: string) => Promise<void>;
  setDefaultPaymentMethod: (methodId: string) => Promise<void>;
  updatePaymentMethod: (methodId: string, updates: any) => Promise<void>;
  downloadInvoice: (invoiceId: string) => Promise<void>;
  updateBillingAddress: (address: any) => Promise<void>;
  updateTaxInfo: (taxInfo: any) => Promise<void>;
  downloadData: () => Promise<void>;
  refreshBilling: () => Promise<void>;
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

export function useBilling(): UseBillingReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch billing history
  const { 
    data: billingHistory = [], 
    error: historyError,
    mutate: mutateHistory,
    isLoading: historyLoading 
  } = useSWR<BillingHistory[]>('/api/billing/history', fetcher, {
    refreshInterval: 300000, // Refresh every 5 minutes
  });

  // Fetch payment methods
  const { 
    data: paymentMethods = [], 
    error: methodsError,
    mutate: mutateMethods,
    isLoading: methodsLoading 
  } = useSWR<PaymentMethodData[]>('/api/billing/payment-methods', fetcher, {
    refreshInterval: 60000, // Refresh every minute
    revalidateOnFocus: true,
  });

  const isLoading = historyLoading || methodsLoading;
  const isError = !!(historyError || methodsError);

  // Add payment method
  const addPaymentMethod = useCallback(async (paymentData: any) => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/billing/payment-methods', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to add payment method');
      }

      await mutateMethods();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add payment method';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [mutateMethods]);

  // Remove payment method
  const removePaymentMethod = useCallback(async (methodId: string) => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/billing/payment-methods/${methodId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to remove payment method');
      }

      await mutateMethods();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove payment method';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [mutateMethods]);

  // Set default payment method
  const setDefaultPaymentMethod = useCallback(async (methodId: string) => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/billing/payment-methods/${methodId}/default`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to set default payment method');
      }

      await mutateMethods();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set default payment method';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [mutateMethods]);

  // Update payment method
  const updatePaymentMethod = useCallback(async (methodId: string, updates: any) => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/billing/payment-methods/${methodId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update payment method');
      }

      await mutateMethods();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update payment method';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [mutateMethods]);

  // Download invoice
  const downloadInvoice = useCallback(async (invoiceId: string) => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`/api/billing/invoices/${invoiceId}/download`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download invoice');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to download invoice';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Update billing address
  const updateBillingAddress = useCallback(async (address: any) => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/billing/address', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(address),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update billing address');
      }

      // No need to mutate data as this doesn't affect displayed data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update billing address';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Update tax info
  const updateTaxInfo = useCallback(async (taxInfo: any) => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/billing/tax-info', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taxInfo),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to update tax information');
      }

      // No need to mutate data as this doesn't affect displayed data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update tax information';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Download user data
  const downloadData = useCallback(async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch('/api/billing/download-data', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to download data');
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gomflow-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to download data';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Refresh billing data
  const refreshBilling = useCallback(async () => {
    setError(null);
    await Promise.all([
      mutateHistory(),
      mutateMethods(),
    ]);
  }, [mutateHistory, mutateMethods]);

  return {
    // Data
    billingHistory,
    paymentMethods,
    
    // Loading states
    isLoading,
    isProcessing,
    isError,
    error: error || historyError?.message || methodsError?.message || null,
    
    // Actions
    addPaymentMethod,
    removePaymentMethod,
    setDefaultPaymentMethod,
    updatePaymentMethod,
    downloadInvoice,
    updateBillingAddress,
    updateTaxInfo,
    downloadData,
    refreshBilling,
  };
}