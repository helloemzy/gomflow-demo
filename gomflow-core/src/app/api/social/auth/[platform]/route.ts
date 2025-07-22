/**
 * Social Media Authentication API Routes
 * Dynamic routes for handling OAuth authentication across multiple platforms
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOAuthProvider } from '@/lib/social/oauth/factory';
import { getTokenManager, storeOAuthToken } from '@/lib/social/tokenManager';
import { headers } from 'next/headers';

interface AuthParams {
  platform: string;
}

interface AuthContext {
  params: AuthParams;
}

/**
 * GET /api/social/auth/[platform] - Initiate OAuth flow
 */
export async function GET(request: NextRequest, context: AuthContext) {
  try {
    const { platform } = context.params;
    const searchParams = request.nextUrl.searchParams;
    
    // Get user from session
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get additional scopes and redirect URI from query params
    const additionalScopes = searchParams.get('scopes')?.split(',') || [];
    const redirectUri = searchParams.get('redirect_uri') || `${process.env.NEXT_PUBLIC_APP_URL}/social/callback`;
    const state = searchParams.get('state');

    try {
      // Get OAuth provider
      const provider = getOAuthProvider(platform);
      
      // Generate authorization URL
      const authData = await provider.getAuthorizationUrl(
        user.id,
        additionalScopes,
        {
          redirect_uri: redirectUri,
          ...(state && { state }),
        }
      );

      // Return authorization URL for frontend redirect
      return NextResponse.json({
        success: true,
        data: {
          authUrl: authData.url,
          state: authData.state,
          sessionId: authData.session.id,
          platform,
        },
      });

    } catch (providerError) {
      console.error(`OAuth provider error for ${platform}:`, providerError);
      return NextResponse.json(
        { 
          error: 'OAuth provider configuration error',
          message: providerError instanceof Error ? providerError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Social auth initiation error:', error);
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
 * POST /api/social/auth/[platform] - Handle OAuth callback
 */
export async function POST(request: NextRequest, context: AuthContext) {
  try {
    const { platform } = context.params;
    const body = await request.json();
    const { code, state, sessionId, error: oauthError, error_description } = body;

    // Handle OAuth errors
    if (oauthError) {
      return NextResponse.json(
        { 
          error: 'OAuth authentication failed',
          details: error_description || oauthError
        },
        { status: 400 }
      );
    }

    if (!code || !state) {
      return NextResponse.json(
        { error: 'Missing required OAuth parameters' },
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

    try {
      // Get OAuth provider
      const provider = getOAuthProvider(platform);
      
      // Exchange code for tokens
      const tokens = await provider.exchangeCodeForTokens(code, state, sessionId);
      
      if (tokens.error) {
        return NextResponse.json(
          { 
            error: 'Token exchange failed',
            details: tokens.error_description || tokens.error
          },
          { status: 400 }
        );
      }

      // Get user profile from platform
      const userProfile = await provider.getUserProfile(tokens.access_token);

      // Check if social account already exists
      const { data: existingAccount } = await supabase
        .from('social_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('platform_id', platform)
        .eq('platform_user_id', userProfile.id)
        .single();

      let socialAccountId: string;

      if (existingAccount) {
        // Update existing account
        socialAccountId = existingAccount.id;
        
        const { error: updateError } = await supabase
          .from('social_accounts')
          .update({
            username: userProfile.username,
            display_name: userProfile.displayName,
            email: userProfile.email,
            avatar_url: userProfile.avatarUrl,
            follower_count: userProfile.followerCount || 0,
            following_count: userProfile.followingCount || 0,
            verified: userProfile.verified || false,
            account_type: userProfile.accountType || 'personal',
            account_status: 'active',
            permissions: tokens.scope?.split(' ') || [],
            metadata: userProfile.additionalData || {},
            last_sync_at: new Date().toISOString(),
            expires_at: tokens.expires_in 
              ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', socialAccountId);

        if (updateError) {
          throw new Error(`Failed to update social account: ${updateError.message}`);
        }
      } else {
        // Create new social account
        const { data: newAccount, error: insertError } = await supabase
          .from('social_accounts')
          .insert({
            user_id: user.id,
            platform_id: platform,
            platform_user_id: userProfile.id,
            username: userProfile.username,
            display_name: userProfile.displayName,
            email: userProfile.email,
            avatar_url: userProfile.avatarUrl,
            follower_count: userProfile.followerCount || 0,
            following_count: userProfile.followingCount || 0,
            verified: userProfile.verified || false,
            account_type: userProfile.accountType || 'personal',
            account_status: 'active',
            permissions: tokens.scope?.split(' ') || [],
            metadata: userProfile.additionalData || {},
            last_sync_at: new Date().toISOString(),
            expires_at: tokens.expires_in 
              ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
              : null,
          })
          .select('id')
          .single();

        if (insertError) {
          throw new Error(`Failed to create social account: ${insertError.message}`);
        }

        socialAccountId = newAccount.id;
      }

      // Store encrypted tokens
      const tokenManager = getTokenManager();
      
      // Store access token
      await tokenManager.storeToken(
        socialAccountId,
        'access_token',
        tokens.access_token,
        {
          scopes: tokens.scope?.split(' ') || [],
          expiresIn: tokens.expires_in,
          replace: true,
        }
      );

      // Store refresh token if available
      if (tokens.refresh_token) {
        await tokenManager.storeToken(
          socialAccountId,
          'refresh_token',
          tokens.refresh_token,
          {
            replace: true,
          }
        );
      }

      // Store ID token if available
      if (tokens.id_token) {
        await tokenManager.storeToken(
          socialAccountId,
          'id_token',
          tokens.id_token,
          {
            replace: true,
          }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          socialAccountId,
          platform,
          userProfile: {
            id: userProfile.id,
            username: userProfile.username,
            displayName: userProfile.displayName,
            avatarUrl: userProfile.avatarUrl,
            verified: userProfile.verified,
            accountType: userProfile.accountType,
          },
          tokenInfo: {
            hasAccessToken: true,
            hasRefreshToken: !!tokens.refresh_token,
            hasIdToken: !!tokens.id_token,
            expiresAt: tokens.expires_in 
              ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
              : null,
            scopes: tokens.scope?.split(' ') || [],
          },
        },
      });

    } catch (providerError) {
      console.error(`OAuth callback error for ${platform}:`, providerError);
      return NextResponse.json(
        { 
          error: 'OAuth authentication failed',
          message: providerError instanceof Error ? providerError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Social auth callback error:', error);
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
 * DELETE /api/social/auth/[platform] - Disconnect social account
 */
export async function DELETE(request: NextRequest, context: AuthContext) {
  try {
    const { platform } = context.params;
    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get('account_id');

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
      .select('id, platform_user_id')
      .eq('user_id', user.id)
      .eq('platform_id', platform);

    if (accountId) {
      query = query.eq('id', accountId);
    }

    const { data: socialAccount, error: accountError } = await query.single();

    if (accountError || !socialAccount) {
      return NextResponse.json(
        { error: 'Social account not found' },
        { status: 404 }
      );
    }

    try {
      // Get OAuth provider and revoke tokens on platform
      const provider = getOAuthProvider(platform);
      const tokenManager = getTokenManager();
      
      // Get tokens for revocation
      const accessToken = await tokenManager.getToken(socialAccount.id, 'access_token');
      const refreshToken = await tokenManager.getToken(socialAccount.id, 'refresh_token');

      // Revoke tokens on platform
      const revocationPromises = [];
      if (accessToken) {
        revocationPromises.push(provider.revokeToken(accessToken, 'access_token'));
      }
      if (refreshToken) {
        revocationPromises.push(provider.revokeToken(refreshToken, 'refresh_token'));
      }

      // Wait for platform revocations (don't fail if they error)
      await Promise.allSettled(revocationPromises);

      // Revoke tokens in our system
      await tokenManager.revokeAllTokens(socialAccount.id);

      // Update account status
      const { error: updateError } = await supabase
        .from('social_accounts')
        .update({
          account_status: 'deactivated',
          updated_at: new Date().toISOString(),
        })
        .eq('id', socialAccount.id);

      if (updateError) {
        throw new Error(`Failed to update account status: ${updateError.message}`);
      }

      return NextResponse.json({
        success: true,
        data: {
          message: 'Social account disconnected successfully',
          platform,
          accountId: socialAccount.id,
        },
      });

    } catch (providerError) {
      console.error(`Token revocation error for ${platform}:`, providerError);
      
      // Still mark as deactivated even if platform revocation fails
      await supabase
        .from('social_accounts')
        .update({
          account_status: 'error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', socialAccount.id);

      return NextResponse.json(
        { 
          error: 'Partial disconnect - platform revocation failed',
          message: providerError instanceof Error ? providerError.message : 'Unknown error'
        },
        { status: 207 } // Multi-status
      );
    }

  } catch (error) {
    console.error('Social account disconnect error:', error);
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
 * PATCH /api/social/auth/[platform] - Refresh tokens
 */
export async function PATCH(request: NextRequest, context: AuthContext) {
  try {
    const { platform } = context.params;
    const body = await request.json();
    const { accountId } = body;

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
    const { data: socialAccount, error: accountError } = await supabase
      .from('social_accounts')
      .select('id, platform_user_id, account_status')
      .eq('user_id', user.id)
      .eq('platform_id', platform)
      .eq('id', accountId)
      .single();

    if (accountError || !socialAccount) {
      return NextResponse.json(
        { error: 'Social account not found' },
        { status: 404 }
      );
    }

    if (socialAccount.account_status !== 'active') {
      return NextResponse.json(
        { error: 'Social account is not active' },
        { status: 400 }
      );
    }

    try {
      // Get OAuth provider and token manager
      const provider = getOAuthProvider(platform);
      const tokenManager = getTokenManager();
      
      // Get refresh token
      const refreshToken = await tokenManager.getToken(socialAccount.id, 'refresh_token');
      
      if (!refreshToken) {
        return NextResponse.json(
          { error: 'No refresh token available' },
          { status: 400 }
        );
      }

      // Refresh tokens
      const newTokens = await provider.refreshToken(refreshToken);
      
      if (newTokens.error) {
        return NextResponse.json(
          { 
            error: 'Token refresh failed',
            details: newTokens.error_description || newTokens.error
          },
          { status: 400 }
        );
      }

      // Store new tokens
      await tokenManager.storeToken(
        socialAccount.id,
        'access_token',
        newTokens.access_token,
        {
          scopes: newTokens.scope?.split(' ') || [],
          expiresIn: newTokens.expires_in,
          replace: true,
        }
      );

      if (newTokens.refresh_token) {
        await tokenManager.storeToken(
          socialAccount.id,
          'refresh_token',
          newTokens.refresh_token,
          {
            replace: true,
          }
        );
      }

      // Update account expiration
      if (newTokens.expires_in) {
        await supabase
          .from('social_accounts')
          .update({
            expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', socialAccount.id);
      }

      return NextResponse.json({
        success: true,
        data: {
          message: 'Tokens refreshed successfully',
          platform,
          accountId: socialAccount.id,
          expiresAt: newTokens.expires_in 
            ? new Date(Date.now() + newTokens.expires_in * 1000).toISOString()
            : null,
          scopes: newTokens.scope?.split(' ') || [],
        },
      });

    } catch (providerError) {
      console.error(`Token refresh error for ${platform}:`, providerError);
      return NextResponse.json(
        { 
          error: 'Token refresh failed',
          message: providerError instanceof Error ? providerError.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}