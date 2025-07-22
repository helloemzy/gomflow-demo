/**
 * Social Accounts Management API
 * Handle CRUD operations for user's social media accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getOAuthProvider, getSupportedPlatforms, getAllPlatformInfo } from '@/lib/social/oauth/factory';
import { getTokenManager } from '@/lib/social/tokenManager';

/**
 * GET /api/social/accounts - Get user's connected social accounts
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const platform = searchParams.get('platform');
    const includeTokens = searchParams.get('include_tokens') === 'true';
    const includeStats = searchParams.get('include_stats') === 'true';

    // Get user from session
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Build query
    let query = supabase
      .from('social_accounts')
      .select(`
        id,
        platform_id,
        platform_user_id,
        username,
        display_name,
        email,
        avatar_url,
        follower_count,
        following_count,
        verified,
        account_type,
        account_status,
        permissions,
        metadata,
        last_sync_at,
        expires_at,
        created_at,
        updated_at
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (platform) {
      query = query.eq('platform_id', platform);
    }

    const { data: accounts, error: accountsError } = await query;

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    // Enhance accounts with additional data
    const enhancedAccounts = await Promise.all(
      (accounts || []).map(async (account) => {
        const enhanced: any = {
          ...account,
          platform_info: getAllPlatformInfo().find(p => p.id === account.platform_id),
        };

        // Add token information if requested
        if (includeTokens) {
          const tokenManager = getTokenManager();
          
          const tokenInfo = {
            hasAccessToken: await tokenManager.isTokenValid(account.id, 'access_token'),
            hasRefreshToken: await tokenManager.isTokenValid(account.id, 'refresh_token'),
            hasIdToken: await tokenManager.isTokenValid(account.id, 'id_token'),
            accessTokenMetadata: await tokenManager.getTokenMetadata(account.id, 'access_token'),
            refreshTokenMetadata: await tokenManager.getTokenMetadata(account.id, 'refresh_token'),
          };

          enhanced.token_info = tokenInfo;
        }

        // Add usage statistics if requested
        if (includeStats) {
          const tokenManager = getTokenManager();
          const stats = await tokenManager.getTokenStats(account.id);
          enhanced.usage_stats = stats;
        }

        return enhanced;
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        accounts: enhancedAccounts,
        total: enhancedAccounts.length,
        platforms: getAllPlatformInfo(),
      },
    });

  } catch (error) {
    console.error('Social accounts fetch error:', error);
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
 * POST /api/social/accounts - Manually create a social account (for testing)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      platform_id,
      platform_user_id,
      username,
      display_name,
      email,
      avatar_url,
      account_type = 'personal',
    } = body;

    // Validate required fields
    if (!platform_id || !platform_user_id) {
      return NextResponse.json(
        { error: 'Platform ID and Platform User ID are required' },
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

    // Check if platform is supported
    if (!getSupportedPlatforms().includes(platform_id as any)) {
      return NextResponse.json(
        { error: 'Unsupported platform' },
        { status: 400 }
      );
    }

    // Check if account already exists
    const { data: existingAccount } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('platform_id', platform_id)
      .eq('platform_user_id', platform_user_id)
      .single();

    if (existingAccount) {
      return NextResponse.json(
        { error: 'Social account already exists' },
        { status: 409 }
      );
    }

    // Create new social account
    const { data: newAccount, error: insertError } = await supabase
      .from('social_accounts')
      .insert({
        user_id: user.id,
        platform_id,
        platform_user_id,
        username,
        display_name,
        email,
        avatar_url,
        account_type,
        account_status: 'active',
        permissions: [],
        metadata: {},
        last_sync_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create social account: ${insertError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        account: {
          ...newAccount,
          platform_info: getAllPlatformInfo().find(p => p.id === platform_id),
        },
      },
    });

  } catch (error) {
    console.error('Social account creation error:', error);
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
 * PATCH /api/social/accounts - Bulk update social accounts
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, account_ids, data: updateData } = body;

    if (!action || !account_ids || !Array.isArray(account_ids)) {
      return NextResponse.json(
        { error: 'Action and account_ids array are required' },
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

    let updateFields: any = {
      updated_at: new Date().toISOString(),
    };

    switch (action) {
      case 'deactivate':
        updateFields.account_status = 'deactivated';
        break;
      
      case 'activate':
        updateFields.account_status = 'active';
        break;
      
      case 'update':
        if (updateData) {
          updateFields = { ...updateFields, ...updateData };
        }
        break;
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    // Update accounts
    const { data: updatedAccounts, error: updateError } = await supabase
      .from('social_accounts')
      .update(updateFields)
      .eq('user_id', user.id)
      .in('id', account_ids)
      .select();

    if (updateError) {
      throw new Error(`Failed to update accounts: ${updateError.message}`);
    }

    // If deactivating, also revoke tokens
    if (action === 'deactivate') {
      const tokenManager = getTokenManager();
      await Promise.all(
        account_ids.map(accountId => tokenManager.revokeAllTokens(accountId))
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        updated_accounts: updatedAccounts,
        affected_count: updatedAccounts?.length || 0,
        action,
      },
    });

  } catch (error) {
    console.error('Bulk account update error:', error);
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
 * DELETE /api/social/accounts - Bulk delete social accounts
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const accountIds = searchParams.get('account_ids')?.split(',') || [];
    const platform = searchParams.get('platform');

    if (accountIds.length === 0 && !platform) {
      return NextResponse.json(
        { error: 'Account IDs or platform filter required' },
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

    // Build delete query
    let query = supabase
      .from('social_accounts')
      .delete()
      .eq('user_id', user.id);

    if (accountIds.length > 0) {
      query = query.in('id', accountIds);
    }

    if (platform) {
      query = query.eq('platform_id', platform);
    }

    // Get accounts before deletion (for token cleanup)
    let selectQuery = supabase
      .from('social_accounts')
      .select('id, platform_id')
      .eq('user_id', user.id);

    if (accountIds.length > 0) {
      selectQuery = selectQuery.in('id', accountIds);
    }

    if (platform) {
      selectQuery = selectQuery.eq('platform_id', platform);
    }

    const { data: accountsToDelete, error: selectError } = await selectQuery;

    if (selectError) {
      throw new Error(`Failed to fetch accounts for deletion: ${selectError.message}`);
    }

    if (!accountsToDelete || accountsToDelete.length === 0) {
      return NextResponse.json(
        { error: 'No accounts found to delete' },
        { status: 404 }
      );
    }

    // Revoke tokens for accounts being deleted
    const tokenManager = getTokenManager();
    await Promise.all(
      accountsToDelete.map(account => tokenManager.revokeAllTokens(account.id))
    );

    // Delete accounts
    const { error: deleteError } = await query;

    if (deleteError) {
      throw new Error(`Failed to delete accounts: ${deleteError.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        deleted_count: accountsToDelete.length,
        deleted_accounts: accountsToDelete.map(acc => ({
          id: acc.id,
          platform_id: acc.platform_id,
        })),
      },
    });

  } catch (error) {
    console.error('Bulk account deletion error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}