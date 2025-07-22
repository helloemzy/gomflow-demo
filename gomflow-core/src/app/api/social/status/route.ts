/**
 * Social Media Integration Status API
 * Health checks, platform status, and validation endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { 
  getSupportedPlatforms, 
  getConfiguredPlatforms, 
  getAllPlatformInfo,
  healthCheckPlatforms,
  validatePlatformConfig,
  getOAuthProvider
} from '@/lib/social/oauth/factory';
import { getTokenManager } from '@/lib/social/tokenManager';

/**
 * GET /api/social/status - Get overall social media integration status
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const checkConnections = searchParams.get('check_connections') === 'true';
    const includeStats = searchParams.get('include_stats') === 'true';

    // Get user from session (optional for general status)
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Get platform status
    const supportedPlatforms = getSupportedPlatforms();
    const configuredPlatforms = getConfiguredPlatforms();
    const platformHealth = await healthCheckPlatforms();
    const allPlatformInfo = getAllPlatformInfo();

    // Base status data
    const statusData: any = {
      platforms: {
        supported: supportedPlatforms,
        configured: configuredPlatforms,
        total_supported: supportedPlatforms.length,
        total_configured: configuredPlatforms.length,
        health: platformHealth,
        info: allPlatformInfo,
      },
      service_status: {
        oauth_factory: 'operational',
        token_manager: 'operational',
        database: 'operational',
      },
      timestamp: new Date().toISOString(),
    };

    // Add user-specific data if authenticated
    if (user) {
      try {
        // Get user's connected accounts
        const { data: accounts, error: accountsError } = await supabase
          .from('social_accounts')
          .select('platform_id, account_status, expires_at, last_sync_at')
          .eq('user_id', user.id);

        if (!accountsError && accounts) {
          const accountsByPlatform = accounts.reduce((acc, account) => {
            if (!acc[account.platform_id]) {
              acc[account.platform_id] = [];
            }
            acc[account.platform_id].push(account);
            return acc;
          }, {} as Record<string, any[]>);

          statusData.user_accounts = {
            total: accounts.length,
            by_platform: accountsByPlatform,
            active: accounts.filter(acc => acc.account_status === 'active').length,
            expired: accounts.filter(acc => 
              acc.expires_at && new Date(acc.expires_at) <= new Date()
            ).length,
          };

          // Check token health if requested
          if (checkConnections) {
            const tokenManager = getTokenManager();
            const connectionStatus = await Promise.all(
              accounts.map(async (account) => {
                const hasValidAccessToken = await tokenManager.isTokenValid(account.platform_id, 'access_token');
                const hasValidRefreshToken = await tokenManager.isTokenValid(account.platform_id, 'refresh_token');
                
                return {
                  platform_id: account.platform_id,
                  account_status: account.account_status,
                  has_valid_access_token: hasValidAccessToken,
                  has_valid_refresh_token: hasValidRefreshToken,
                  expires_at: account.expires_at,
                  last_sync_at: account.last_sync_at,
                };
              })
            );

            statusData.connection_status = connectionStatus;
          }

          // Include usage statistics if requested
          if (includeStats) {
            const tokenManager = getTokenManager();
            const stats = await tokenManager.getTokenStats();
            statusData.token_stats = stats;
          }
        }
      } catch (userError) {
        console.warn('Failed to get user account status:', userError);
        statusData.user_accounts = { error: 'Failed to fetch user accounts' };
      }
    }

    return NextResponse.json({
      success: true,
      data: statusData,
    });

  } catch (error) {
    console.error('Social status check error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/social/status - Validate platform configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, config } = body;

    if (!platform) {
      return NextResponse.json(
        { error: 'Platform is required' },
        { status: 400 }
      );
    }

    if (!getSupportedPlatforms().includes(platform)) {
      return NextResponse.json(
        { error: 'Unsupported platform' },
        { status: 400 }
      );
    }

    // Validate platform configuration
    const validation = validatePlatformConfig(platform);

    // If custom config provided, validate that too
    let customValidation = null;
    if (config) {
      try {
        // Basic validation of custom config
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!config.clientId) errors.push('Client ID is required');
        if (!config.clientSecret) errors.push('Client Secret is required');
        if (!config.redirectUri) {
          warnings.push('Redirect URI not provided');
        } else {
          try {
            new URL(config.redirectUri);
          } catch {
            errors.push('Invalid redirect URI format');
          }
        }

        customValidation = {
          valid: errors.length === 0,
          errors,
          warnings,
        };
      } catch (configError) {
        customValidation = {
          valid: false,
          errors: ['Invalid configuration format'],
          warnings: [],
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        platform,
        current_config: validation,
        custom_config: customValidation,
        platform_info: getAllPlatformInfo().find(p => p.id === platform),
      },
    });

  } catch (error) {
    console.error('Platform validation error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/social/status - Test platform connection
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, account_id } = body;

    if (!platform) {
      return NextResponse.json(
        { error: 'Platform is required' },
        { status: 400 }
      );
    }

    // Get user from session
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get social account
    let query = supabase
      .from('social_accounts')
      .select('id, platform_id, platform_user_id, account_status')
      .eq('user_id', user.id)
      .eq('platform_id', platform);

    if (account_id) {
      query = query.eq('id', account_id);
    }

    const { data: account, error: accountError } = await query.single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Social account not found' },
        { status: 404 }
      );
    }

    if (account.account_status !== 'active') {
      return NextResponse.json(
        { error: 'Account is not active' },
        { status: 400 }
      );
    }

    try {
      // Test connection by getting user profile
      const provider = getOAuthProvider(platform);
      const tokenManager = getTokenManager();
      
      const accessToken = await tokenManager.getToken(account.id, 'access_token');
      
      if (!accessToken) {
        return NextResponse.json({
          success: true,
          data: {
            platform,
            account_id: account.id,
            connection_status: 'no_token',
            message: 'No valid access token found',
            can_refresh: await tokenManager.isTokenValid(account.id, 'refresh_token'),
          },
        });
      }

      // Test API call
      const startTime = Date.now();
      const userProfile = await provider.getUserProfile(accessToken);
      const responseTime = Date.now() - startTime;

      // Update last sync time
      await supabase
        .from('social_accounts')
        .update({
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id);

      return NextResponse.json({
        success: true,
        data: {
          platform,
          account_id: account.id,
          connection_status: 'connected',
          response_time_ms: responseTime,
          profile_data: {
            id: userProfile.id,
            username: userProfile.username,
            display_name: userProfile.displayName,
            verified: userProfile.verified,
            account_type: userProfile.accountType,
          },
          test_timestamp: new Date().toISOString(),
        },
      });

    } catch (connectionError) {
      console.error(`Connection test failed for ${platform}:`, connectionError);
      
      // Try to refresh token if connection failed
      const tokenManager = getTokenManager();
      const hasRefreshToken = await tokenManager.isTokenValid(account.id, 'refresh_token');
      
      return NextResponse.json({
        success: true,
        data: {
          platform,
          account_id: account.id,
          connection_status: 'error',
          error_message: connectionError instanceof Error ? connectionError.message : 'Unknown error',
          can_refresh: hasRefreshToken,
          suggested_action: hasRefreshToken ? 'refresh_token' : 'reconnect_account',
        },
      });
    }

  } catch (error) {
    console.error('Connection test error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}