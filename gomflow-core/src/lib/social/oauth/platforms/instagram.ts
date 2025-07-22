/**
 * Instagram OAuth Provider
 * Implements OAuth 2.0 for Instagram Basic Display API and Instagram Graph API
 */

import { BaseOAuthProvider, OAuthConfig, UserProfile } from '../base';

export class InstagramOAuthProvider extends BaseOAuthProvider {
  constructor(config: Omit<OAuthConfig, 'baseUrl' | 'authUrl' | 'tokenUrl'>) {
    super('instagram', {
      ...config,
      baseUrl: 'https://graph.instagram.com',
      authUrl: 'https://api.instagram.com/oauth/authorize',
      tokenUrl: 'https://api.instagram.com/oauth/access_token',
      apiVersion: 'v1',
    });
  }

  /**
   * Get Instagram user profile
   */
  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const url = `${this.config.baseUrl}/me?fields=id,username,account_type,media_count,followers_count,follows_count&access_token=${accessToken}`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Instagram API error: ${data.error.message}`);
    }

    return {
      id: data.id,
      username: data.username,
      displayName: data.username, // Instagram doesn't provide display name in basic API
      followerCount: data.followers_count || 0,
      followingCount: data.follows_count || 0,
      accountType: this.normalizeAccountType(data.account_type),
      additionalData: {
        mediaCount: data.media_count || 0,
        accountType: data.account_type,
      },
    };
  }

  /**
   * Get platform-specific authorization parameters
   */
  protected getPlatformSpecificAuthParams(): Record<string, string> {
    return {
      response_type: 'code',
    };
  }

  /**
   * Exchange code for long-lived token
   */
  async exchangeForLongLivedToken(shortLivedToken: string): Promise<{
    access_token: string;
    expires_in: number;
  }> {
    const url = `${this.config.baseUrl}/access_token`;
    
    const params = new URLSearchParams({
      grant_type: 'ig_exchange_token',
      client_secret: this.config.clientSecret,
      access_token: shortLivedToken,
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange for long-lived token: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Instagram token exchange error: ${data.error.message}`);
    }

    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
    };
  }

  /**
   * Refresh long-lived token
   */
  async refreshLongLivedToken(accessToken: string): Promise<{
    access_token: string;
    expires_in: number;
  }> {
    const url = `${this.config.baseUrl}/refresh_access_token`;
    
    const params = new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: accessToken,
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Instagram token refresh error: ${data.error.message}`);
    }

    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
    };
  }

  /**
   * Get user's media
   */
  async getUserMedia(accessToken: string, options: {
    limit?: number;
    after?: string;
    before?: string;
  } = {}): Promise<Array<{
    id: string;
    mediaType: string;
    mediaUrl: string;
    permalink: string;
    caption?: string;
    timestamp: string;
    children?: Array<{ id: string; mediaType: string; mediaUrl: string; }>;
  }>> {
    const params = new URLSearchParams({
      fields: 'id,media_type,media_url,permalink,caption,timestamp,children{id,media_type,media_url}',
      access_token: accessToken,
    });

    if (options.limit) {
      params.append('limit', options.limit.toString());
    }

    if (options.after) {
      params.append('after', options.after);
    }

    if (options.before) {
      params.append('before', options.before);
    }

    const url = `${this.config.baseUrl}/me/media?${params.toString()}`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Failed to get media: ${data.error.message}`);
    }

    return (data.data || []).map((media: any) => ({
      id: media.id,
      mediaType: media.media_type,
      mediaUrl: media.media_url,
      permalink: media.permalink,
      caption: media.caption,
      timestamp: media.timestamp,
      children: media.children?.data || [],
    }));
  }

  /**
   * Get media insights (requires Instagram Business account)
   */
  async getMediaInsights(accessToken: string, mediaId: string): Promise<{
    impressions: number;
    reach: number;
    engagement: number;
    likes: number;
    comments: number;
    saves: number;
    shares: number;
  }> {
    const metrics = [
      'impressions',
      'reach',
      'engagement',
      'likes',
      'comments',
      'saves',
      'shares'
    ];

    const params = new URLSearchParams({
      metric: metrics.join(','),
      access_token: accessToken,
    });

    const url = `${this.config.baseUrl}/${mediaId}/insights?${params.toString()}`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Failed to get media insights: ${data.error.message}`);
    }

    const insights: any = {};
    (data.data || []).forEach((metric: any) => {
      insights[metric.name] = metric.values[0]?.value || 0;
    });

    return {
      impressions: insights.impressions || 0,
      reach: insights.reach || 0,
      engagement: insights.engagement || 0,
      likes: insights.likes || 0,
      comments: insights.comments || 0,
      saves: insights.saves || 0,
      shares: insights.shares || 0,
    };
  }

  /**
   * Create media container for publishing
   */
  async createMediaContainer(accessToken: string, media: {
    imageUrl?: string;
    videoUrl?: string;
    caption?: string;
    locationId?: string;
    userTags?: Array<{ username: string; x: number; y: number; }>;
  }): Promise<string> {
    const params = new URLSearchParams({
      access_token: accessToken,
    });

    if (media.imageUrl) {
      params.append('image_url', media.imageUrl);
    }

    if (media.videoUrl) {
      params.append('video_url', media.videoUrl);
    }

    if (media.caption) {
      params.append('caption', media.caption);
    }

    if (media.locationId) {
      params.append('location_id', media.locationId);
    }

    if (media.userTags && media.userTags.length > 0) {
      params.append('user_tags', JSON.stringify(media.userTags));
    }

    const url = `${this.config.baseUrl}/me/media`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to create media container: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Instagram media container error: ${data.error.message}`);
    }

    return data.id;
  }

  /**
   * Publish media container
   */
  async publishMedia(accessToken: string, creationId: string): Promise<string> {
    const params = new URLSearchParams({
      creation_id: creationId,
      access_token: accessToken,
    });

    const url = `${this.config.baseUrl}/me/media_publish`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to publish media: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Instagram publish error: ${data.error.message}`);
    }

    return data.id;
  }

  /**
   * Get account insights (requires Instagram Business account)
   */
  async getAccountInsights(accessToken: string, period: 'day' | 'week' | 'days_28', since?: string, until?: string): Promise<{
    impressions: number;
    reach: number;
    profileViews: number;
    websiteClicks: number;
    followerCount: number;
  }> {
    const metrics = [
      'impressions',
      'reach',
      'profile_views',
      'website_clicks',
      'follower_count'
    ];

    const params = new URLSearchParams({
      metric: metrics.join(','),
      period,
      access_token: accessToken,
    });

    if (since) {
      params.append('since', since);
    }

    if (until) {
      params.append('until', until);
    }

    const url = `${this.config.baseUrl}/me/insights?${params.toString()}`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Failed to get account insights: ${data.error.message}`);
    }

    const insights: any = {};
    (data.data || []).forEach((metric: any) => {
      insights[metric.name] = metric.values[0]?.value || 0;
    });

    return {
      impressions: insights.impressions || 0,
      reach: insights.reach || 0,
      profileViews: insights.profile_views || 0,
      websiteClicks: insights.website_clicks || 0,
      followerCount: insights.follower_count || 0,
    };
  }

  /**
   * Normalize Instagram account type to our standard format
   */
  private normalizeAccountType(accountType: string): 'personal' | 'business' | 'creator' {
    switch (accountType?.toLowerCase()) {
      case 'business':
        return 'business';
      case 'creator':
        return 'creator';
      case 'personal':
      default:
        return 'personal';
    }
  }

  /**
   * Instagram doesn't support PKCE
   */
  protected supportsPKCE(): boolean {
    return false;
  }

  /**
   * Custom token exchange for Instagram (uses form data instead of URL params)
   */
  async exchangeCodeForTokens(code: string, state: string, sessionId?: string): Promise<any> {
    // Validate OAuth session
    const session = await this.validateOAuthSession(state, sessionId);
    if (!session) {
      throw new Error('Invalid or expired OAuth session');
    }

    await this.checkRateLimit('token_exchange');

    const formData = new FormData();
    formData.append('client_id', this.config.clientId);
    formData.append('client_secret', this.config.clientSecret);
    formData.append('grant_type', 'authorization_code');
    formData.append('redirect_uri', this.config.redirectUri);
    formData.append('code', code);

    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const tokens = await response.json();
      
      if (tokens.error) {
        throw new Error(`Instagram OAuth error: ${tokens.error_description || tokens.error}`);
      }

      await this.incrementRateLimit('token_exchange');
      await this.completeOAuthSession(session.id);

      return this.normalizeTokenResponse(tokens);
    } catch (error) {
      await this.markOAuthSessionError(session.id, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }
}