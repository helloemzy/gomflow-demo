/**
 * Base OAuth Provider Class
 * Provides common OAuth 2.0 functionality for all social media platforms
 */

import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  baseUrl: string;
  authUrl: string;
  tokenUrl: string;
  apiVersion?: string;
  additionalParams?: Record<string, string>;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface UserProfile {
  id: string;
  username?: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  followerCount?: number;
  followingCount?: number;
  verified?: boolean;
  accountType?: 'personal' | 'business' | 'creator';
  additionalData?: Record<string, any>;
}

export interface OAuthSession {
  id: string;
  state: string;
  codeVerifier?: string;
  codeChallenge?: string;
  redirectUri: string;
  scopes: string[];
  nonce?: string;
  expiresAt: Date;
}

export interface RateLimitInfo {
  allowed: boolean;
  remaining: number;
  resetAt: Date | null;
}

export abstract class BaseOAuthProvider {
  protected config: OAuthConfig;
  protected platformId: string;
  protected supabase;

  constructor(platformId: string, config: OAuthConfig) {
    this.platformId = platformId;
    this.config = config;
    this.supabase = createClient();
  }

  /**
   * Generate OAuth authorization URL
   */
  async getAuthorizationUrl(
    userId: string,
    additionalScopes: string[] = [],
    customParams: Record<string, string> = {}
  ): Promise<{ url: string; state: string; session: OAuthSession }> {
    const state = this.generateSecureState();
    const scopes = [...this.config.scopes, ...additionalScopes];
    const nonce = this.generateNonce();
    
    // PKCE for security
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    // Create OAuth session
    const session = await this.createOAuthSession({
      userId,
      state,
      codeVerifier,
      codeChallenge,
      redirectUri: this.config.redirectUri,
      scopes,
      nonce,
    });

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: scopes.join(' '),
      state,
      response_type: 'code',
      ...this.getPlatformSpecificAuthParams(),
      ...customParams,
    });

    // Add PKCE if supported
    if (this.supportsPKCE()) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    const url = `${this.config.authUrl}?${params.toString()}`;
    
    return { url, state, session };
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    state: string,
    sessionId?: string
  ): Promise<TokenResponse> {
    // Validate OAuth session
    const session = await this.validateOAuthSession(state, sessionId);
    if (!session) {
      throw new Error('Invalid or expired OAuth session');
    }

    // Check rate limits
    await this.checkRateLimit('token_exchange');

    const tokenData = {
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      redirect_uri: this.config.redirectUri,
      ...this.getPlatformSpecificTokenParams(session),
    };

    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: new URLSearchParams(tokenData).toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Token exchange failed: ${errorData.error_description || response.statusText}`);
      }

      const tokens = await response.json();
      
      // Increment rate limit
      await this.incrementRateLimit('token_exchange');
      
      // Mark session as completed
      await this.completeOAuthSession(session.id);

      return this.normalizeTokenResponse(tokens);
    } catch (error) {
      await this.markOAuthSessionError(session.id, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    await this.checkRateLimit('token_refresh');

    const tokenData = {
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: refreshToken,
    };

    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          ...this.getAuthHeaders(),
        },
        body: new URLSearchParams(tokenData).toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Token refresh failed: ${errorData.error_description || response.statusText}`);
      }

      const tokens = await response.json();
      await this.incrementRateLimit('token_refresh');

      return this.normalizeTokenResponse(tokens);
    } catch (error) {
      throw new Error(`Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Revoke access token
   */
  async revokeToken(token: string, tokenType: 'access_token' | 'refresh_token' = 'access_token'): Promise<boolean> {
    try {
      await this.checkRateLimit('token_revoke');
      const success = await this.platformSpecificRevoke(token, tokenType);
      await this.incrementRateLimit('token_revoke');
      return success;
    } catch (error) {
      console.error(`Failed to revoke ${tokenType}:`, error);
      return false;
    }
  }

  /**
   * Get user profile from the platform
   */
  abstract getUserProfile(accessToken: string): Promise<UserProfile>;

  /**
   * Platform-specific authorization parameters
   */
  protected getPlatformSpecificAuthParams(): Record<string, string> {
    return {};
  }

  /**
   * Platform-specific token exchange parameters
   */
  protected getPlatformSpecificTokenParams(session: OAuthSession): Record<string, string> {
    if (this.supportsPKCE() && session.codeVerifier) {
      return { code_verifier: session.codeVerifier };
    }
    return {};
  }

  /**
   * Platform-specific token revocation
   */
  protected async platformSpecificRevoke(token: string, tokenType: string): Promise<boolean> {
    // Default implementation - override in platform-specific classes
    return true;
  }

  /**
   * Check if platform supports PKCE
   */
  protected supportsPKCE(): boolean {
    return true; // Most modern platforms support PKCE
  }

  /**
   * Get platform-specific auth headers
   */
  protected getAuthHeaders(): Record<string, string> {
    return {};
  }

  /**
   * Normalize token response across platforms
   */
  protected normalizeTokenResponse(tokens: any): TokenResponse {
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      id_token: tokens.id_token,
      token_type: tokens.token_type || 'Bearer',
      expires_in: tokens.expires_in,
      scope: tokens.scope,
      error: tokens.error,
      error_description: tokens.error_description,
    };
  }

  /**
   * Utility methods for OAuth security
   */
  protected generateSecureState(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  protected generateNonce(): string {
    return crypto.randomBytes(16).toString('base64url');
  }

  protected generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  protected generateCodeChallenge(verifier: string): string {
    return crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url');
  }

  /**
   * Database operations for OAuth sessions
   */
  protected async createOAuthSession(sessionData: {
    userId: string;
    state: string;
    codeVerifier?: string;
    codeChallenge?: string;
    redirectUri: string;
    scopes: string[];
    nonce?: string;
  }): Promise<OAuthSession> {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const { data, error } = await this.supabase
      .from('social_oauth_sessions')
      .insert({
        user_id: sessionData.userId,
        platform_id: this.platformId,
        state: sessionData.state,
        code_verifier: sessionData.codeVerifier,
        code_challenge: sessionData.codeChallenge,
        redirect_uri: sessionData.redirectUri,
        scopes: sessionData.scopes,
        nonce: sessionData.nonce,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create OAuth session: ${error.message}`);
    }

    return {
      id: data.id,
      state: data.state,
      codeVerifier: data.code_verifier,
      codeChallenge: data.code_challenge,
      redirectUri: data.redirect_uri,
      scopes: data.scopes,
      nonce: data.nonce,
      expiresAt: new Date(data.expires_at),
    };
  }

  protected async validateOAuthSession(state: string, sessionId?: string): Promise<OAuthSession | null> {
    let query = this.supabase
      .from('social_oauth_sessions')
      .select('*')
      .eq('state', state)
      .eq('platform_id', this.platformId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    if (sessionId) {
      query = query.eq('id', sessionId);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      state: data.state,
      codeVerifier: data.code_verifier,
      codeChallenge: data.code_challenge,
      redirectUri: data.redirect_uri,
      scopes: data.scopes,
      nonce: data.nonce,
      expiresAt: new Date(data.expires_at),
    };
  }

  protected async completeOAuthSession(sessionId: string): Promise<void> {
    await this.supabase
      .from('social_oauth_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  protected async markOAuthSessionError(sessionId: string, errorMessage: string): Promise<void> {
    await this.supabase
      .from('social_oauth_sessions')
      .update({
        status: 'error',
        error_message: errorMessage,
      })
      .eq('id', sessionId);
  }

  /**
   * Rate limiting
   */
  protected async checkRateLimit(endpoint: string): Promise<void> {
    const { data } = await this.supabase.rpc('check_rate_limit', {
      p_platform_id: this.platformId,
      p_endpoint: endpoint,
    });

    if (data && !data.allowed) {
      const resetAt = data.reset_at ? new Date(data.reset_at) : null;
      const waitTime = resetAt ? Math.ceil((resetAt.getTime() - Date.now()) / 1000) : 60;
      throw new Error(`Rate limit exceeded. Try again in ${waitTime} seconds.`);
    }
  }

  protected async incrementRateLimit(endpoint: string): Promise<void> {
    await this.supabase.rpc('increment_rate_limit', {
      p_platform_id: this.platformId,
      p_endpoint: endpoint,
    });
  }

  /**
   * Helper methods for API calls
   */
  protected async makeAuthenticatedRequest(
    url: string,
    accessToken: string,
    options: RequestInit = {}
  ): Promise<Response> {
    await this.checkRateLimit('api_call');

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    await this.incrementRateLimit('api_call');

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API request failed: ${errorData.error_description || response.statusText}`);
    }

    return response;
  }

  /**
   * Get platform configuration
   */
  public getConfig(): OAuthConfig {
    return { ...this.config };
  }

  /**
   * Get platform ID
   */
  public getPlatformId(): string {
    return this.platformId;
  }
}