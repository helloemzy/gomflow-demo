/**
 * Twitter/X OAuth Provider
 * Implements OAuth 2.0 for Twitter API v2 with PKCE
 */

import { BaseOAuthProvider, OAuthConfig, UserProfile } from '../base';

export class TwitterOAuthProvider extends BaseOAuthProvider {
  constructor(config: Omit<OAuthConfig, 'baseUrl' | 'authUrl' | 'tokenUrl'>) {
    super('twitter', {
      ...config,
      baseUrl: 'https://api.twitter.com',
      authUrl: 'https://twitter.com/i/oauth2/authorize',
      tokenUrl: 'https://api.twitter.com/2/oauth2/token',
      apiVersion: 'v2',
    });
  }

  /**
   * Get Twitter user profile
   */
  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const url = `${this.config.baseUrl}/2/users/me?user.fields=id,username,name,profile_image_url,verified,public_metrics,description`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken);
    const data = await response.json();

    if (data.errors) {
      throw new Error(`Twitter API error: ${data.errors[0].detail}`);
    }

    const user = data.data;
    const metrics = user.public_metrics || {};

    return {
      id: user.id,
      username: user.username,
      displayName: user.name,
      avatarUrl: user.profile_image_url,
      verified: user.verified || false,
      followerCount: metrics.followers_count || 0,
      followingCount: metrics.following_count || 0,
      accountType: this.determineAccountType(user),
      additionalData: {
        description: user.description,
        tweetCount: metrics.tweet_count || 0,
        listedCount: metrics.listed_count || 0,
      },
    };
  }

  /**
   * Get platform-specific authorization parameters
   */
  protected getPlatformSpecificAuthParams(): Record<string, string> {
    return {
      // Twitter requires PKCE
      response_type: 'code',
    };
  }

  /**
   * Platform-specific token revocation
   */
  protected async platformSpecificRevoke(token: string, tokenType: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/2/oauth2/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          token,
          token_type_hint: tokenType,
        }).toString(),
      });

      return response.ok;
    } catch (error) {
      console.error('Twitter token revocation failed:', error);
      return false;
    }
  }

  /**
   * Post a tweet
   */
  async postTweet(accessToken: string, content: {
    text: string;
    mediaIds?: string[];
    replyToTweetId?: string;
    quoteTweetId?: string;
  }): Promise<{ id: string; text: string }> {
    const url = `${this.config.baseUrl}/2/tweets`;
    
    const tweetData: any = {
      text: content.text,
    };

    if (content.mediaIds && content.mediaIds.length > 0) {
      tweetData.media = {
        media_ids: content.mediaIds,
      };
    }

    if (content.replyToTweetId) {
      tweetData.reply = {
        in_reply_to_tweet_id: content.replyToTweetId,
      };
    }

    if (content.quoteTweetId) {
      tweetData.quote_tweet_id = content.quoteTweetId;
    }

    const response = await this.makeAuthenticatedRequest(url, accessToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetData),
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(`Failed to post tweet: ${data.errors[0].detail}`);
    }

    return {
      id: data.data.id,
      text: data.data.text,
    };
  }

  /**
   * Upload media to Twitter
   */
  async uploadMedia(accessToken: string, media: {
    data: Buffer;
    mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'video/mp4';
    altText?: string;
  }): Promise<string> {
    // Twitter uses a different endpoint for media upload
    const uploadUrl = 'https://upload.twitter.com/1.1/media/upload.json';
    
    const formData = new FormData();
    formData.append('media', new Blob([media.data], { type: media.mediaType }));
    
    if (media.altText) {
      formData.append('alt_text', media.altText);
    }

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Media upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.media_id_string;
  }

  /**
   * Get user's tweets
   */
  async getUserTweets(accessToken: string, options: {
    maxResults?: number;
    sinceId?: string;
    untilId?: string;
  } = {}): Promise<Array<{
    id: string;
    text: string;
    createdAt: string;
    metrics: Record<string, number>;
  }>> {
    const params = new URLSearchParams({
      'tweet.fields': 'created_at,public_metrics,author_id',
      max_results: (options.maxResults || 10).toString(),
    });

    if (options.sinceId) {
      params.append('since_id', options.sinceId);
    }

    if (options.untilId) {
      params.append('until_id', options.untilId);
    }

    const url = `${this.config.baseUrl}/2/users/me/tweets?${params.toString()}`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken);
    const data = await response.json();

    if (data.errors) {
      throw new Error(`Failed to get tweets: ${data.errors[0].detail}`);
    }

    return (data.data || []).map((tweet: any) => ({
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at,
      metrics: tweet.public_metrics || {},
    }));
  }

  /**
   * Get tweet analytics
   */
  async getTweetAnalytics(accessToken: string, tweetIds: string[]): Promise<Array<{
    tweetId: string;
    impressions: number;
    likes: number;
    retweets: number;
    replies: number;
  }>> {
    const params = new URLSearchParams({
      ids: tweetIds.join(','),
      'tweet.fields': 'public_metrics',
    });

    const url = `${this.config.baseUrl}/2/tweets?${params.toString()}`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken);
    const data = await response.json();

    if (data.errors) {
      throw new Error(`Failed to get tweet analytics: ${data.errors[0].detail}`);
    }

    return (data.data || []).map((tweet: any) => ({
      tweetId: tweet.id,
      impressions: tweet.public_metrics?.impression_count || 0,
      likes: tweet.public_metrics?.like_count || 0,
      retweets: tweet.public_metrics?.retweet_count || 0,
      replies: tweet.public_metrics?.reply_count || 0,
    }));
  }

  /**
   * Determine account type based on user data
   */
  private determineAccountType(user: any): 'personal' | 'business' | 'creator' {
    const metrics = user.public_metrics || {};
    const followerCount = metrics.followers_count || 0;
    
    // Simple heuristic - can be improved with more data
    if (followerCount > 10000) {
      return 'creator';
    } else if (user.verified) {
      return 'business';
    }
    
    return 'personal';
  }

  /**
   * Check if user has specific permissions
   */
  async checkPermissions(accessToken: string, permissions: string[]): Promise<Record<string, boolean>> {
    // Twitter doesn't have a specific permissions endpoint
    // We'll determine permissions based on the scopes and successful API calls
    const result: Record<string, boolean> = {};
    
    for (const permission of permissions) {
      switch (permission) {
        case 'read':
          try {
            await this.getUserProfile(accessToken);
            result[permission] = true;
          } catch {
            result[permission] = false;
          }
          break;
        case 'write':
          // We can't test write permission without actually posting
          // Check if write scope is included
          result[permission] = this.config.scopes.includes('tweet.write');
          break;
        default:
          result[permission] = false;
      }
    }
    
    return result;
  }
}