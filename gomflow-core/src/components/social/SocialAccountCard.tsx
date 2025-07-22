'use client';

/**
 * Social Account Card Component
 * Displays individual social media account information and actions
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  MoreVertical, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  ExternalLink,
  UserCheck,
  Calendar,
  Activity,
  Eye,
  Users,
  TrendingUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

interface SocialAccountCardProps {
  account: SocialAccount;
  onDisconnect: () => void;
  onRefresh: () => void;
  onTest: () => void;
  refreshing?: boolean;
  compact?: boolean;
}

export function SocialAccountCard({
  account,
  onDisconnect,
  onRefresh,
  onTest,
  refreshing = false,
  compact = false,
}: SocialAccountCardProps) {
  const getStatusBadge = () => {
    switch (account.account_status) {
      case 'active':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      case 'suspended':
        return (
          <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Suspended
          </Badge>
        );
      case 'deactivated':
        return (
          <Badge variant="secondary">
            <XCircle className="w-3 h-3 mr-1" />
            Deactivated
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            Unknown
          </Badge>
        );
    }
  };

  const getTokenStatus = () => {
    if (!account.token_info) return null;

    const { hasAccessToken, hasRefreshToken } = account.token_info;
    
    if (hasAccessToken) {
      return (
        <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200">
          <Activity className="w-3 h-3 mr-1" />
          Connected
        </Badge>
      );
    } else if (hasRefreshToken) {
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
          <RefreshCw className="w-3 h-3 mr-1" />
          Needs Refresh
        </Badge>
      );
    } else {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          No Token
        </Badge>
      );
    }
  };

  const isTokenExpired = () => {
    if (!account.expires_at) return false;
    return new Date(account.expires_at) <= new Date();
  };

  const formatNumber = (num?: number) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getAccountTypeIcon = () => {
    switch (account.account_type) {
      case 'business':
        return <TrendingUp className="w-3 h-3" />;
      case 'creator':
        return <Users className="w-3 h-3" />;
      default:
        return <UserCheck className="w-3 h-3" />;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center space-x-3 p-3 border rounded-lg">
        <Avatar className="w-8 h-8">
          <AvatarImage src={account.avatar_url} alt={account.display_name || account.username} />
          <AvatarFallback>
            {(account.display_name || account.username || account.platform_id)?.[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium truncate">
              {account.display_name || account.username || 'Unknown'}
            </p>
            {account.verified && (
              <UserCheck className="w-3 h-3 text-blue-500" />
            )}
          </div>
          <p className="text-xs text-gray-500">
            @{account.username || account.platform_user_id}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {getStatusBadge()}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onTest}>
                <Eye className="mr-2 h-4 w-4" />
                Test Connection
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRefresh} disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh Tokens
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDisconnect} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Disconnect
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Account Info */}
      <div className="flex items-start space-x-4">
        <Avatar className="w-12 h-12">
          <AvatarImage src={account.avatar_url} alt={account.display_name || account.username} />
          <AvatarFallback>
            {(account.display_name || account.username || account.platform_id)?.[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h4 className="text-lg font-medium truncate">
              {account.display_name || account.username || 'Unknown Account'}
            </h4>
            {account.verified && (
              <UserCheck className="w-4 h-4 text-blue-500" />
            )}
            <Badge variant="outline" className="text-xs">
              {getAccountTypeIcon()}
              <span className="ml-1 capitalize">{account.account_type}</span>
            </Badge>
          </div>
          
          <p className="text-sm text-gray-600">
            @{account.username || account.platform_user_id}
          </p>
          
          {account.email && (
            <p className="text-sm text-gray-500">
              {account.email}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {getStatusBadge()}
          {getTokenStatus()}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Account Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onTest}>
                <Eye className="mr-2 h-4 w-4" />
                Test Connection
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRefresh} disabled={refreshing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh Tokens'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDisconnect} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Disconnect Account
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Account Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {account.follower_count !== undefined && (
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">
              {formatNumber(account.follower_count)}
            </div>
            <div className="text-xs text-gray-600">Followers</div>
          </div>
        )}
        
        {account.following_count !== undefined && (
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">
              {formatNumber(account.following_count)}
            </div>
            <div className="text-xs text-gray-600">Following</div>
          </div>
        )}
        
        {account.usage_stats && (
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-semibold text-gray-900">
              {account.usage_stats.usageStats.totalUsage}
            </div>
            <div className="text-xs text-gray-600">API Calls</div>
          </div>
        )}
        
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-lg font-semibold text-gray-900">
            {account.permissions.length}
          </div>
          <div className="text-xs text-gray-600">Permissions</div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center justify-between">
          <span>Connected:</span>
          <span>{formatDistanceToNow(new Date(account.created_at), { addSuffix: true })}</span>
        </div>
        
        {account.last_sync_at && (
          <div className="flex items-center justify-between">
            <span>Last sync:</span>
            <span>{formatDistanceToNow(new Date(account.last_sync_at), { addSuffix: true })}</span>
          </div>
        )}
        
        {account.expires_at && (
          <div className="flex items-center justify-between">
            <span>Token expires:</span>
            <span className={isTokenExpired() ? 'text-red-600' : ''}>
              {isTokenExpired() ? 'Expired' : formatDistanceToNow(new Date(account.expires_at), { addSuffix: true })}
            </span>
          </div>
        )}
        
        {account.permissions.length > 0 && (
          <div>
            <span className="block mb-2">Permissions:</span>
            <div className="flex flex-wrap gap-1">
              {account.permissions.slice(0, 5).map(permission => (
                <Badge key={permission} variant="outline" className="text-xs">
                  {permission}
                </Badge>
              ))}
              {account.permissions.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{account.permissions.length - 5} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Warning for expired tokens */}
      {isTokenExpired() && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center space-x-2 text-yellow-800">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Token Expired</span>
          </div>
          <p className="text-sm text-yellow-700 mt-1">
            This account's access token has expired. Refresh the token to continue using this connection.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 border-yellow-300 text-yellow-800 hover:bg-yellow-100"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Now'}
          </Button>
        </div>
      )}
    </div>
  );
}