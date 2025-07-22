/**
 * Facebook OAuth Provider
 * Implements OAuth 2.0 for Facebook Graph API
 */

import { BaseOAuthProvider, OAuthConfig, UserProfile } from '../base';

export class FacebookOAuthProvider extends BaseOAuthProvider {
  constructor(config: Omit<OAuthConfig, 'baseUrl' | 'authUrl' | 'tokenUrl'>) {
    super('facebook', {
      ...config,
      baseUrl: 'https://graph.facebook.com',
      authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
      apiVersion: 'v18.0',
    });
  }

  /**
   * Get Facebook user profile
   */
  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const fields = [
      'id',
      'name',
      'email',
      'picture.width(200).height(200)',
      'verified',
      'link'
    ];

    const url = `${this.config.baseUrl}/v18.0/me?fields=${fields.join(',')}&access_token=${accessToken}`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Facebook API error: ${data.error.message}`);
    }

    return {
      id: data.id,
      username: data.id, // Facebook doesn't provide username in v18.0+
      displayName: data.name,
      email: data.email,
      avatarUrl: data.picture?.data?.url,
      verified: data.verified || false,
      accountType: 'personal', // Default for personal profiles
      additionalData: {
        link: data.link,
        locale: data.locale,
      },
    };
  }

  /**
   * Get platform-specific authorization parameters
   */
  protected getPlatformSpecificAuthParams(): Record<string, string> {
    return {
      response_type: 'code',
      display: 'popup',
    };
  }

  /**
   * Get user's pages (for business accounts)
   */
  async getUserPages(accessToken: string): Promise<Array<{
    id: string;
    name: string;
    category: string;
    accessToken: string;
    perms: string[];
    fanCount?: number;
    link?: string;
    picture?: string;
  }>> {
    const url = `${this.config.baseUrl}/v18.0/me/accounts?fields=id,name,category,access_token,perms,fan_count,link,picture&access_token=${accessToken}`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Failed to get pages: ${data.error.message}`);
    }

    return (data.data || []).map((page: any) => ({
      id: page.id,
      name: page.name,
      category: page.category,
      accessToken: page.access_token,
      perms: page.perms || [],
      fanCount: page.fan_count,
      link: page.link,
      picture: page.picture?.data?.url,
    }));
  }

  /**
   * Post to Facebook page or profile
   */
  async createPost(accessToken: string, content: {
    message?: string;
    link?: string;
    pictureUrl?: string;
    name?: string;
    caption?: string;
    description?: string;
    pageId?: string; // If posting to a page
    scheduledPublishTime?: number; // Unix timestamp for scheduling
    published?: boolean;
  }): Promise<{
    id: string;
    postId?: string;
  }> {
    const endpoint = content.pageId ? `/${content.pageId}/feed` : '/me/feed';
    const url = `${this.config.baseUrl}/v18.0${endpoint}`;
    
    const postData: any = {};
    
    if (content.message) postData.message = content.message;
    if (content.link) postData.link = content.link;
    if (content.pictureUrl) postData.picture = content.pictureUrl;
    if (content.name) postData.name = content.name;
    if (content.caption) postData.caption = content.caption;
    if (content.description) postData.description = content.description;
    if (content.scheduledPublishTime) {
      postData.scheduled_publish_time = content.scheduledPublishTime;
      postData.published = false;
    } else {
      postData.published = content.published !== false;
    }

    const response = await this.makeAuthenticatedRequest(url, accessToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(postData).toString(),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Failed to create post: ${data.error.message}`);
    }

    return {
      id: data.id,
      postId: data.post_id,
    };
  }

  /**
   * Upload photo to Facebook
   */
  async uploadPhoto(accessToken: string, photo: {
    source: string; // URL or base64
    message?: string;
    pageId?: string;
    published?: boolean;
    scheduledPublishTime?: number;
  }): Promise<{
    id: string;
    postId?: string;
  }> {
    const endpoint = photo.pageId ? `/${photo.pageId}/photos` : '/me/photos';
    const url = `${this.config.baseUrl}/v18.0${endpoint}`;
    
    const photoData: any = {
      source: photo.source,
    };
    
    if (photo.message) photoData.message = photo.message;
    if (photo.scheduledPublishTime) {
      photoData.scheduled_publish_time = photo.scheduledPublishTime;
      photoData.published = false;
    } else {
      photoData.published = photo.published !== false;
    }

    const response = await this.makeAuthenticatedRequest(url, accessToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(photoData).toString(),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Failed to upload photo: ${data.error.message}`);
    }

    return {
      id: data.id,
      postId: data.post_id,
    };
  }

  /**
   * Get page insights (for business pages)
   */
  async getPageInsights(accessToken: string, pageId: string, metrics: string[], period: 'day' | 'week' | 'days_28' = 'day'): Promise<Array<{
    name: string;
    period: string;
    values: Array<{ value: number; endTime: string; }>;
  }>> {
    const url = `${this.config.baseUrl}/v18.0/${pageId}/insights?metric=${metrics.join(',')}&period=${period}&access_token=${accessToken}`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Failed to get page insights: ${data.error.message}`);
    }

    return (data.data || []).map((insight: any) => ({
      name: insight.name,
      period: insight.period,
      values: insight.values.map((value: any) => ({
        value: value.value,
        endTime: value.end_time,
      })),
    }));
  }

  /**
   * Get post insights
   */
  async getPostInsights(accessToken: string, postId: string): Promise<{
    reach: number;
    impressions: number;
    engagement: number;
    clicks: number;
    reactions: number;
    comments: number;
    shares: number;
  }> {
    const metrics = [
      'post_impressions',
      'post_reach',
      'post_engaged_users',
      'post_clicks',
      'post_reactions_by_type_total',
      'post_comments',
      'post_shares'
    ];

    const url = `${this.config.baseUrl}/v18.0/${postId}/insights?metric=${metrics.join(',')}&access_token=${accessToken}`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Failed to get post insights: ${data.error.message}`);
    }

    const insights: any = {};
    (data.data || []).forEach((metric: any) => {
      const value = metric.values?.[0]?.value || 0;
      insights[metric.name] = value;
    });

    // Calculate total reactions
    const reactions = insights.post_reactions_by_type_total || {};
    const totalReactions = Object.values(reactions).reduce((sum: number, count: any) => sum + (count || 0), 0);

    return {
      reach: insights.post_reach || 0,
      impressions: insights.post_impressions || 0,
      engagement: insights.post_engaged_users || 0,
      clicks: insights.post_clicks || 0,
      reactions: totalReactions,
      comments: insights.post_comments || 0,
      shares: insights.post_shares || 0,
    };
  }

  /**
   * Get user's posts
   */
  async getUserPosts(accessToken: string, options: {
    limit?: number;
    since?: string;
    until?: string;
    pageId?: string;
  } = {}): Promise<Array<{
    id: string;
    message?: string;
    story?: string;
    createdTime: string;
    type: string;
    link?: string;
    picture?: string;
    engagement?: {
      reactionCount: number;
      commentCount: number;
      shareCount: number;
    };
  }>> {
    const endpoint = options.pageId ? `/${options.pageId}/posts` : '/me/posts';
    const params = new URLSearchParams({
      fields: 'id,message,story,created_time,type,link,picture,reactions.summary(total_count),comments.summary(total_count),shares',
      access_token: accessToken,
    });

    if (options.limit) {
      params.append('limit', options.limit.toString());
    }

    if (options.since) {
      params.append('since', options.since);
    }

    if (options.until) {
      params.append('until', options.until);
    }

    const url = `${this.config.baseUrl}/v18.0${endpoint}?${params.toString()}`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Failed to get posts: ${data.error.message}`);
    }

    return (data.data || []).map((post: any) => ({
      id: post.id,
      message: post.message,
      story: post.story,
      createdTime: post.created_time,
      type: post.type,
      link: post.link,
      picture: post.picture,
      engagement: {
        reactionCount: post.reactions?.summary?.total_count || 0,
        commentCount: post.comments?.summary?.total_count || 0,
        shareCount: post.shares?.count || 0,
      },
    }));
  }

  /**
   * Delete a post
   */
  async deletePost(accessToken: string, postId: string): Promise<boolean> {
    const url = `${this.config.baseUrl}/v18.0/${postId}`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken, {
      method: 'DELETE',
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Failed to delete post: ${data.error.message}`);
    }

    return data.success === true;
  }

  /**
   * Exchange short-lived token for long-lived token
   */
  async exchangeForLongLivedToken(shortLivedToken: string): Promise<{
    access_token: string;
    expires_in: number;
  }> {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      fb_exchange_token: shortLivedToken,
    });

    const url = `${this.config.tokenUrl}?${params.toString()}`;
    
    const response = await fetch(url, {
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
      throw new Error(`Facebook token exchange error: ${data.error.message}`);
    }

    return {
      access_token: data.access_token,
      expires_in: data.expires_in,
    };
  }

  /**
   * Debug access token to get information about it
   */
  async debugToken(accessToken: string): Promise<{
    appId: string;
    isValid: boolean;
    expiresAt: number;
    scopes: string[];
    userId: string;
  }> {
    const params = new URLSearchParams({
      input_token: accessToken,
      access_token: `${this.config.clientId}|${this.config.clientSecret}`,
    });

    const url = `${this.config.baseUrl}/debug_token?${params.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to debug token: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Facebook debug token error: ${data.error.message}`);
    }

    const tokenData = data.data;
    
    return {
      appId: tokenData.app_id,
      isValid: tokenData.is_valid,
      expiresAt: tokenData.expires_at,
      scopes: tokenData.scopes || [],
      userId: tokenData.user_id,
    };
  }

  /**
   * Facebook doesn't support PKCE
   */
  protected supportsPKCE(): boolean {
    return false;
  }

  /**
   * Platform-specific token revocation
   */
  protected async platformSpecificRevoke(token: string, tokenType: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/v18.0/me/permissions`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Facebook token revocation failed:', error);
      return false;
    }
  }
}