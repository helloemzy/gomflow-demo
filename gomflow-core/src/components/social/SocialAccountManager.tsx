'use client';

/**
 * Social Account Manager Component
 * Main component for managing social media account connections
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Settings, 
  MoreVertical, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  ExternalLink,
  Users,
  UserCheck,
  Calendar,
  Activity
} from 'lucide-react';
import { useSocialAuth } from '@/hooks/useSocialAuth';
import { SocialPlatformSelector } from './SocialPlatformSelector';
import { SocialAccountCard } from './SocialAccountCard';
import { SocialConnectionDialog } from './SocialConnectionDialog';

interface SocialAccount {
  id: string;
  platform_id: string;
  platform_user_id: string;
  username?: string;
  display_name?: string;
  email?: string;
  avatar_url?: string;
  follower_count?: number;
  following_count?: number;
  verified: boolean;
  account_type: 'personal' | 'business' | 'creator';
  account_status: 'active' | 'suspended' | 'deactivated' | 'error';
  permissions: string[];
  last_sync_at?: string;
  expires_at?: string;
  created_at: string;
  platform_info?: {
    id: string;
    name: string;
    displayName: string;
    color: string;
    icon: string;
    description: string;
    features: string[];
    configured: boolean;
  };
  token_info?: {
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    hasIdToken: boolean;
    accessTokenMetadata?: any;
  };
  usage_stats?: {
    total: number;
    usageStats: {
      totalUsage: number;
      averageUsage: number;
      mostUsedToken: number;
    };
  };
}

interface SocialAccountManagerProps {
  showHeader?: boolean;
  compact?: boolean;
  platforms?: string[];
  onAccountConnected?: (account: SocialAccount) => void;
  onAccountDisconnected?: (account: SocialAccount) => void;
}

export function SocialAccountManager({
  showHeader = true,
  compact = false,
  platforms,
  onAccountConnected,
  onAccountDisconnected,
}: SocialAccountManagerProps) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const {
    initiateConnection,
    disconnectAccount,
    refreshTokens,
    testConnection,
    loading: authLoading,
    error: authError,
  } = useSocialAuth();

  // Fetch user's social accounts
  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        include_tokens: 'true',
        include_stats: 'true',
      });

      if (platforms && platforms.length > 0) {
        // Fetch accounts for specific platforms only
        const accountPromises = platforms.map(platform =>
          fetch(`/api/social/accounts?platform=${platform}&include_tokens=true&include_stats=true`)
            .then(res => res.json())
        );

        const results = await Promise.all(accountPromises);
        const allAccounts = results.flatMap(result => 
          result.success ? result.data.accounts : []
        );
        
        setAccounts(allAccounts);
      } else {
        const response = await fetch(`/api/social/accounts?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
          setAccounts(data.data.accounts);
        } else {
          throw new Error(data.error || 'Failed to fetch accounts');
        }
      }
    } catch (err) {
      console.error('Failed to fetch social accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  };

  // Handle platform connection
  const handleConnect = async (platform: string) => {
    try {
      const result = await initiateConnection(platform);
      
      if (result.success && result.authUrl) {
        // Open OAuth popup
        const popup = window.open(
          result.authUrl,
          'social-auth',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );

        // Listen for popup completion
        const checkPopup = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkPopup);
            // Refresh accounts after connection
            setTimeout(fetchAccounts, 1000);
          }
        }, 1000);
      }
    } catch (err) {
      console.error('Connection failed:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  // Handle account disconnection
  const handleDisconnect = async (account: SocialAccount) => {
    try {
      const result = await disconnectAccount(account.platform_id, account.id);
      
      if (result.success) {
        setAccounts(prev => prev.filter(acc => acc.id !== account.id));
        onAccountDisconnected?.(account);
      } else {
        throw new Error(result.error || 'Disconnection failed');
      }
    } catch (err) {
      console.error('Disconnection failed:', err);
      setError(err instanceof Error ? err.message : 'Disconnection failed');
    }
  };

  // Handle token refresh
  const handleRefresh = async (account: SocialAccount) => {
    try {
      setRefreshing(account.id);
      const result = await refreshTokens(account.platform_id, account.id);
      
      if (result.success) {
        // Refresh the accounts list to get updated token info
        await fetchAccounts();
      } else {
        throw new Error(result.error || 'Token refresh failed');
      }
    } catch (err) {
      console.error('Token refresh failed:', err);
      setError(err instanceof Error ? err.message : 'Token refresh failed');
    } finally {
      setRefreshing(null);
    }
  };

  // Handle connection test
  const handleTestConnection = async (account: SocialAccount) => {
    try {
      const result = await testConnection(account.platform_id, account.id);
      
      if (result.success && result.data.connection_status === 'connected') {
        // Update account with fresh data
        await fetchAccounts();
      } else {
        throw new Error(result.data?.error_message || 'Connection test failed');
      }
    } catch (err) {
      console.error('Connection test failed:', err);
      setError(err instanceof Error ? err.message : 'Connection test failed');
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  // Group accounts by platform
  const accountsByPlatform = accounts.reduce((acc, account) => {
    if (!acc[account.platform_id]) {
      acc[account.platform_id] = [];
    }
    acc[account.platform_id].push(account);
    return acc;
  }, {} as Record<string, SocialAccount[]>);

  // Filter platforms if specified
  const filteredPlatforms = platforms 
    ? Object.keys(accountsByPlatform).filter(platform => platforms.includes(platform))
    : Object.keys(accountsByPlatform);

  if (loading) {
    return (
      <div className="space-y-4">
        {showHeader && (
          <div className="space-y-2">
            <div className="h-6 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-100 rounded animate-pulse" />
          </div>
        )}
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showHeader && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Social Media Accounts</h2>
              <p className="text-gray-600">
                Connect your social media accounts to enable cross-platform posting and analytics.
              </p>
            </div>
            <Dialog open={connectionDialogOpen} onOpenChange={setConnectionDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Connect Account
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Connect Social Account</DialogTitle>
                  <DialogDescription>
                    Choose a platform to connect your social media account.
                  </DialogDescription>
                </DialogHeader>
                <SocialPlatformSelector
                  onSelect={(platform) => {
                    setSelectedPlatform(platform);
                    setConnectionDialogOpen(false);
                    handleConnect(platform);
                  }}
                  excludePlatforms={Object.keys(accountsByPlatform)}
                  filterConfigured={true}
                />
              </DialogContent>
            </Dialog>
          </div>
          
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                <Users className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium">No Connected Accounts</h3>
                <p className="text-gray-600">
                  Connect your social media accounts to get started with cross-platform management.
                </p>
              </div>
              <Button 
                onClick={() => setConnectionDialogOpen(true)}
                className="mt-4"
              >
                <Plus className="w-4 h-4 mr-2" />
                Connect Your First Account
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPlatforms.map(platformId => {
            const platformAccounts = accountsByPlatform[platformId];
            const platformInfo = platformAccounts[0]?.platform_info;

            return (
              <Card key={platformId}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                        style={{ backgroundColor: platformInfo?.color || '#666' }}
                      >
                        {platformInfo?.icon || platformInfo?.displayName?.[0] || '?'}
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {platformInfo?.displayName || platformId}
                        </CardTitle>
                        <CardDescription>
                          {platformAccounts.length} account{platformAccounts.length !== 1 ? 's' : ''} connected
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConnect(platformId)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Account
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {platformAccounts.map((account, index) => (
                    <React.Fragment key={account.id}>
                      {index > 0 && <Separator />}
                      <SocialAccountCard
                        account={account}
                        onDisconnect={() => handleDisconnect(account)}
                        onRefresh={() => handleRefresh(account)}
                        onTest={() => handleTestConnection(account)}
                        refreshing={refreshing === account.id}
                        compact={compact}
                      />
                    </React.Fragment>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Connection Dialog */}
      <SocialConnectionDialog
        open={!!selectedPlatform}
        platform={selectedPlatform}
        onClose={() => setSelectedPlatform(null)}
        onSuccess={(account) => {
          setAccounts(prev => [...prev, account]);
          onAccountConnected?.(account);
          setSelectedPlatform(null);
        }}
      />
    </div>
  );
}