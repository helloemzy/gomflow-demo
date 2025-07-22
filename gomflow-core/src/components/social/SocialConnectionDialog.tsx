'use client';

/**
 * Social Connection Dialog Component
 * Handles the OAuth connection flow in a modal dialog
 */

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  AlertTriangle, 
  Loader2, 
  ExternalLink,
  Shield,
  Key,
  UserCheck
} from 'lucide-react';

interface SocialAccount {
  id: string;
  platform_id: string;
  platform_user_id: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  verified: boolean;
  account_type: 'personal' | 'business' | 'creator';
}

interface SocialConnectionDialogProps {
  open: boolean;
  platform: string | null;
  onClose: () => void;
  onSuccess: (account: SocialAccount) => void;
  onError?: (error: string) => void;
}

type ConnectionStep = 'starting' | 'redirecting' | 'waiting' | 'processing' | 'success' | 'error';

export function SocialConnectionDialog({
  open,
  platform,
  onClose,
  onSuccess,
  onError,
}: SocialConnectionDialogProps) {
  const [step, setStep] = useState<ConnectionStep>('starting');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [platformInfo, setPlatformInfo] = useState<any>(null);
  const [popup, setPopup] = useState<Window | null>(null);
  const [account, setAccount] = useState<SocialAccount | null>(null);

  // Fetch platform information
  useEffect(() => {
    if (platform && open) {
      fetchPlatformInfo();
    }
  }, [platform, open]);

  // Monitor popup window
  useEffect(() => {
    if (popup && step === 'waiting') {
      const interval = setInterval(() => {
        if (popup.closed) {
          clearInterval(interval);
          handlePopupClosed();
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [popup, step]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setStep('starting');
      setProgress(0);
      setError(null);
      setAccount(null);
      if (popup) {
        popup.close();
        setPopup(null);
      }
    }
  }, [open]);

  const fetchPlatformInfo = async () => {
    try {
      const response = await fetch('/api/social/status');
      const data = await response.json();
      
      if (data.success) {
        const info = data.data.platforms.info.find((p: any) => p.id === platform);
        setPlatformInfo(info);
      }
    } catch (err) {
      console.error('Failed to fetch platform info:', err);
    }
  };

  const startConnection = async () => {
    if (!platform) return;

    try {
      setStep('starting');
      setProgress(10);
      setError(null);

      // Initiate OAuth flow
      const response = await fetch(`/api/social/auth/${platform}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to initiate OAuth flow');
      }

      setStep('redirecting');
      setProgress(25);

      // Open OAuth popup
      const authPopup = window.open(
        data.data.authUrl,
        'social-auth',
        'width=600,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes'
      );

      if (!authPopup) {
        throw new Error('Popup blocked. Please allow popups and try again.');
      }

      setPopup(authPopup);
      setStep('waiting');
      setProgress(50);

      // Focus on the popup
      authPopup.focus();

    } catch (err) {
      console.error('Connection start failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to start connection');
      setStep('error');
      onError?.(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const handlePopupClosed = async () => {
    setStep('processing');
    setProgress(75);

    // Wait a moment for any callbacks to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // Check if connection was successful by fetching accounts
      const response = await fetch(`/api/social/accounts?platform=${platform}`);
      const data = await response.json();

      if (data.success && data.data.accounts.length > 0) {
        // Find the newest account for this platform
        const newAccount = data.data.accounts
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        setAccount(newAccount);
        setStep('success');
        setProgress(100);
        
        // Call success callback after a short delay
        setTimeout(() => {
          onSuccess(newAccount);
        }, 1500);
      } else {
        throw new Error('Connection was cancelled or failed');
      }
    } catch (err) {
      console.error('Connection verification failed:', err);
      setError(err instanceof Error ? err.message : 'Connection verification failed');
      setStep('error');
      onError?.(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const getStepIcon = () => {
    switch (step) {
      case 'starting':
      case 'redirecting':
      case 'waiting':
      case 'processing':
        return <Loader2 className="w-6 h-6 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-6 h-6 text-green-600" />;
      case 'error':
        return <AlertTriangle className="w-6 h-6 text-red-600" />;
      default:
        return <ExternalLink className="w-6 h-6" />;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case 'starting':
        return 'Initializing Connection';
      case 'redirecting':
        return 'Opening Authorization';
      case 'waiting':
        return 'Waiting for Authorization';
      case 'processing':
        return 'Processing Connection';
      case 'success':
        return 'Successfully Connected!';
      case 'error':
        return 'Connection Failed';
      default:
        return 'Connect Account';
    }
  };

  const getStepDescription = () => {
    switch (step) {
      case 'starting':
        return 'Setting up OAuth flow...';
      case 'redirecting':
        return 'Opening authorization window...';
      case 'waiting':
        return `Please complete the authorization in the ${platformInfo?.displayName || platform} popup window.`;
      case 'processing':
        return 'Verifying connection and storing credentials...';
      case 'success':
        return `Your ${platformInfo?.displayName || platform} account has been connected successfully!`;
      case 'error':
        return 'There was an error connecting your account. Please try again.';
      default:
        return `Connect your ${platformInfo?.displayName || platform} account to enable cross-platform posting.`;
    }
  };

  const canClose = step === 'success' || step === 'error' || step === 'starting';

  return (
    <Dialog open={open} onOpenChange={canClose ? onClose : undefined}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            {platformInfo && (
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ backgroundColor: platformInfo.color }}
              >
                {platformInfo.icon}
              </div>
            )}
            <div>
              <DialogTitle>{getStepTitle()}</DialogTitle>
              <DialogDescription>
                {platformInfo?.displayName || platform}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-center">
              {getStepIcon()}
            </div>
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-center text-gray-600">
              {getStepDescription()}
            </p>
          </div>

          {/* Success Account Info */}
          {step === 'success' && account && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-3">
                {account.avatar_url && (
                  <img 
                    src={account.avatar_url} 
                    alt={account.display_name || account.username}
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="font-medium text-green-900">
                      {account.display_name || account.username || 'Account'}
                    </p>
                    {account.verified && (
                      <UserCheck className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  <p className="text-sm text-green-700">
                    @{account.username || account.platform_user_id}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {step === 'error' && error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Security Notice */}
          {step === 'starting' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 mb-1">Secure Connection</p>
                  <p className="text-blue-700">
                    Your credentials are encrypted and stored securely. We only request the minimum permissions needed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Platform Features */}
          {step === 'starting' && platformInfo?.features && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">What you can do:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                {platformInfo.features.slice(0, 3).map((feature: string) => (
                  <li key={feature} className="flex items-center space-x-2">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            {step === 'starting' && (
              <>
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={startConnection} className="flex-1">
                  <Key className="w-4 h-4 mr-2" />
                  Connect
                </Button>
              </>
            )}

            {step === 'waiting' && (
              <Button 
                variant="outline" 
                onClick={() => {
                  if (popup) popup.close();
                  onClose();
                }} 
                className="flex-1"
              >
                Cancel
              </Button>
            )}

            {(step === 'success' || step === 'error') && (
              <Button 
                onClick={onClose} 
                className="flex-1"
                variant={step === 'error' ? 'outline' : 'default'}
              >
                {step === 'error' ? 'Close' : 'Done'}
              </Button>
            )}

            {step === 'error' && (
              <Button onClick={startConnection} className="flex-1">
                Try Again
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}