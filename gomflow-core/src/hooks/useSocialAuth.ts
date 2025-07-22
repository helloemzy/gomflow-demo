'use client';

/**
 * Social Authentication Hook
 * Custom React hook for managing social media authentication
 */

import { useState, useCallback } from 'react';

interface AuthResult {
  success: boolean;
  data?: any;
  error?: string;
  authUrl?: string;
  state?: string;
  sessionId?: string;
}

interface ConnectionResult {
  success: boolean;
  data?: {
    socialAccountId: string;
    platform: string;
    userProfile: {
      id: string;
      username?: string;
      displayName?: string;
      avatarUrl?: string;
      verified: boolean;
      accountType: string;
    };
    tokenInfo: {
      hasAccessToken: boolean;
      hasRefreshToken: boolean;
      hasIdToken: boolean;
      expiresAt?: string;
      scopes: string[];
    };
  };
  error?: string;
  details?: string;
}

interface DisconnectResult {
  success: boolean;
  data?: {
    message: string;
    platform: string;
    accountId: string;
  };
  error?: string;
  message?: string;
}

interface RefreshResult {
  success: boolean;
  data?: {
    message: string;
    platform: string;
    accountId: string;
    expiresAt?: string;
    scopes: string[];
  };
  error?: string;
  message?: string;
}

interface TestResult {
  success: boolean;
  data?: {
    platform: string;
    account_id: string;
    connection_status: string;
    response_time_ms?: number;
    profile_data?: any;
    error_message?: string;
    can_refresh?: boolean;
    suggested_action?: string;
  };
  error?: string;
}

export function useSocialAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initiate OAuth connection
  const initiateConnection = useCallback(async (
    platform: string,
    options: {
      additionalScopes?: string[];
      redirectUri?: string;
      state?: string;
    } = {}
  ): Promise<AuthResult> => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      
      if (options.additionalScopes && options.additionalScopes.length > 0) {
        params.append('scopes', options.additionalScopes.join(','));
      }
      
      if (options.redirectUri) {
        params.append('redirect_uri', options.redirectUri);
      }
      
      if (options.state) {
        params.append('state', options.state);
      }

      const url = `/api/social/auth/${platform}${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to initiate OAuth flow');
      }

      return {
        success: true,
        authUrl: data.data.authUrl,
        state: data.data.state,
        sessionId: data.data.sessionId,
        data: data.data,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initiate connection';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Complete OAuth connection (callback handler)
  const completeConnection = useCallback(async (
    platform: string,
    authData: {
      code: string;
      state: string;
      sessionId?: string;
      error?: string;
      error_description?: string;
    }
  ): Promise<ConnectionResult> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/social/auth/${platform}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(authData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || data.details || 'Failed to complete OAuth flow');
      }

      return {
        success: true,
        data: data.data,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete connection';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Disconnect social account
  const disconnectAccount = useCallback(async (
    platform: string,
    accountId?: string
  ): Promise<DisconnectResult> => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (accountId) {
        params.append('account_id', accountId);
      }

      const url = `/api/social/auth/${platform}${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok && response.status !== 207) { // 207 = Multi-status (partial success)
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!data.success) {
        // For partial disconnects (207 status), still return success but with warning
        if (response.status === 207) {
          return {
            success: true,
            data: {
              message: 'Account disconnected with warnings',
              platform,
              accountId: accountId || '',
            },
            error: data.error,
          };
        }
        throw new Error(data.error || 'Failed to disconnect account');
      }

      return {
        success: true,
        data: data.data,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect account';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh OAuth tokens
  const refreshTokens = useCallback(async (
    platform: string,
    accountId: string
  ): Promise<RefreshResult> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/social/auth/${platform}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || data.details || 'Failed to refresh tokens');
      }

      return {
        success: true,
        data: data.data,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh tokens';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Test connection
  const testConnection = useCallback(async (
    platform: string,
    accountId?: string
  ): Promise<TestResult> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/social/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ platform, account_id: accountId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return {
        success: data.success,
        data: data.data,
        error: data.error,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to test connection';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Get user's social accounts
  const getAccounts = useCallback(async (options: {
    platform?: string;
    includeTokens?: boolean;
    includeStats?: boolean;
  } = {}) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      
      if (options.platform) {
        params.append('platform', options.platform);
      }
      
      if (options.includeTokens) {
        params.append('include_tokens', 'true');
      }
      
      if (options.includeStats) {
        params.append('include_stats', 'true');
      }

      const response = await fetch(`/api/social/accounts?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch accounts');
      }

      return {
        success: true,
        data: data.data,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch accounts';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
        data: { accounts: [], total: 0, platforms: [] },
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Get platform status and health
  const getPlatformStatus = useCallback(async (options: {
    checkConnections?: boolean;
    includeStats?: boolean;
  } = {}) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      
      if (options.checkConnections) {
        params.append('check_connections', 'true');
      }
      
      if (options.includeStats) {
        params.append('include_stats', 'true');
      }

      const response = await fetch(`/api/social/status?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return {
        success: data.success,
        data: data.data,
        error: data.error,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch platform status';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
        data: null,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Validate platform configuration
  const validatePlatform = useCallback(async (
    platform: string,
    config?: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      scopes?: string[];
    }
  ) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/social/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ platform, config }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return {
        success: data.success,
        data: data.data,
        error: data.error,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate platform';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
        data: null,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Bulk operations for accounts
  const bulkUpdateAccounts = useCallback(async (
    action: 'activate' | 'deactivate' | 'update',
    accountIds: string[],
    updateData?: any
  ) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/social/accounts', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          account_ids: accountIds,
          data: updateData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to update accounts');
      }

      return {
        success: true,
        data: data.data,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update accounts';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  const bulkDeleteAccounts = useCallback(async (
    accountIds?: string[],
    platform?: string
  ) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      
      if (accountIds && accountIds.length > 0) {
        params.append('account_ids', accountIds.join(','));
      }
      
      if (platform) {
        params.append('platform', platform);
      }

      const response = await fetch(`/api/social/accounts?${params.toString()}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete accounts');
      }

      return {
        success: true,
        data: data.data,
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete accounts';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // State
    loading,
    error,
    
    // Actions
    clearError,
    initiateConnection,
    completeConnection,
    disconnectAccount,
    refreshTokens,
    testConnection,
    getAccounts,
    getPlatformStatus,
    validatePlatform,
    bulkUpdateAccounts,
    bulkDeleteAccounts,
  };
}