/**
 * TikTok OAuth Provider
 * Implements OAuth 2.0 for TikTok for Developers API
 */

import { BaseOAuthProvider, OAuthConfig, UserProfile } from '../base';

export class TikTokOAuthProvider extends BaseOAuthProvider {
  constructor(config: Omit<OAuthConfig, 'baseUrl' | 'authUrl' | 'tokenUrl'>) {
    super('tiktok', {
      ...config,
      baseUrl: 'https://open-api.tiktok.com',
      authUrl: 'https://www.tiktok.com/auth/authorize',
      tokenUrl: 'https://open-api.tiktok.com/oauth/access_token',
      apiVersion: 'v1',
    });
  }

  /**
   * Get TikTok user profile
   */
  async getUserProfile(accessToken: string): Promise<UserProfile> {
    const url = `${this.config.baseUrl}/v2/user/info/`;
    
    const response = await this.makeAuthenticatedRequest(url, accessToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: [
          'open_id',
          'union_id',
          'avatar_url',
          'display_name',
          'bio_description',
          'profile_deep_link',
          'is_verified',
          'follower_count',
          'following_count',
          'likes_count',
          'video_count'
        ],
      }),
    });

    const data = await response.json();

    if (data.error?.code !== 'ok') {
      throw new Error(`TikTok API error: ${data.error?.message || 'Unknown error'}`);
    }

    const user = data.data?.user;
    if (!user) {
      throw new Error('No user data returned from TikTok API');
    }

    return {
      id: user.union_id || user.open_id,
      username: user.display_name,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      verified: user.is_verified || false,
      followerCount: user.follower_count || 0,
      followingCount: user.following_count || 0,
      accountType: this.determineAccountType(user),
      additionalData: {
        openId: user.open_id,
        unionId: user.union_id,
        bioDescription: user.bio_description,
        profileDeepLink: user.profile_deep_link,
        likesCount: user.likes_count || 0,
        videoCount: user.video_count || 0,
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
   * Custom token exchange for TikTok
   */
  async exchangeCodeForTokens(code: string, state: string, sessionId?: string): Promise<any> {
    const session = await this.validateOAuthSession(state, sessionId);
    if (!session) {
      throw new Error('Invalid or expired OAuth session');
    }

    await this.checkRateLimit('token_exchange');

    const tokenData = {
      client_key: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.config.redirectUri,
    };

    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache',
        },
        body: new URLSearchParams(tokenData).toString(),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error?.code !== 'ok') {
        throw new Error(`TikTok OAuth error: ${data.error?.message || 'Unknown error'}`);
      }

      await this.incrementRateLimit('token_exchange');
      await this.completeOAuthSession(session.id);

      return {
        access_token: data.data.access_token,
        refresh_token: data.data.refresh_token,
        token_type: 'Bearer',
        expires_in: data.data.expires_in,
        scope: data.data.scope,
      };
    } catch (error) {
      await this.markOAuthSessionError(session.id, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Refresh TikTok access token
   */
  async refreshToken(refreshToken: string): Promise<any> {
    await this.checkRateLimit('token_refresh');

    const tokenData = {
      client_key: this.config.clientId,
      client_secret: this.config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    };

    try {
      const response = await fetch(this.config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(tokenData).toString(),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.error?.code !== 'ok') {
        throw new Error(`TikTok token refresh error: ${data.error?.message || 'Unknown error'}`);
      }

      await this.incrementRateLimit('token_refresh');

      return {
        access_token: data.data.access_token,
        refresh_token: data.data.refresh_token,
        token_type: 'Bearer',
        expires_in: data.data.expires_in,
        scope: data.data.scope,
      };
    } catch (error) {
      throw new Error(`Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user's videos
   */
  async getUserVideos(accessToken: string, options: {
    cursor?: number;
    maxCount?: number;
  } = {}): Promise<{
    videos: Array<{
      id: string;
      title: string;
      coverImageUrl: string;
      videoUrl: string;
      duration: number;
      createTime: number;
      shareUrl: string;
      viewCount: number;
      likeCount: number;
      commentCount: number;
      shareCount: number;
    }>;
    cursor: number;
    hasMore: boolean;
  }> {
    const url = `${this.config.baseUrl}/v2/video/list/`;
    
    const requestBody = {
      cursor: options.cursor || 0,
      max_count: options.maxCount || 20,
      fields: [
        'id',
        'title',
        'cover_image_url',
        'video_description',
        'duration',
        'create_time',
        'share_url',
        'view_count',
        'like_count',
        'comment_count',
        'share_count'
      ],
    };

    const response = await this.makeAuthenticatedRequest(url, accessToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (data.error?.code !== 'ok') {
      throw new Error(`Failed to get videos: ${data.error?.message || 'Unknown error'}`);
    }

    const result = data.data || {};
    
    return {
      videos: (result.videos || []).map((video: any) => ({
        id: video.id,
        title: video.title,
        coverImageUrl: video.cover_image_url,
        videoUrl: video.video_description, // TikTok doesn't provide direct video URLs
        duration: video.duration,
        createTime: video.create_time,
        shareUrl: video.share_url,
        viewCount: video.view_count || 0,
        likeCount: video.like_count || 0,
        commentCount: video.comment_count || 0,
        shareCount: video.share_count || 0,
      })),
      cursor: result.cursor || 0,
      hasMore: result.has_more || false,
    };
  }

  /**
   * Upload video to TikTok
   */
  async uploadVideo(accessToken: string, video: {
    videoUrl: string;
    title?: string;
    description?: string;
    privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIEND' | 'SELF_ONLY';
    disableComment?: boolean;
    disableDuet?: boolean;
    disableStitch?: boolean;
    brandContentToggle?: boolean;
    brandOrganicToggle?: boolean;
  }): Promise<{
    publishId: string;
    status: string;
  }> {
    const url = `${this.config.baseUrl}/v2/post/publish/video/init/`;
    
    const requestBody = {
      post_info: {
        title: video.title || '',
        description: video.description || '',
        privacy_level: video.privacyLevel || 'PUBLIC_TO_EVERYONE',
        disable_comment: video.disableComment || false,
        disable_duet: video.disableDuet || false,
        disable_stitch: video.disableStitch || false,
        brand_content_toggle: video.brandContentToggle || false,
        brand_organic_toggle: video.brandOrganicToggle || false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: video.videoUrl,
      },
    };

    const response = await this.makeAuthenticatedRequest(url, accessToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (data.error?.code !== 'ok') {
      throw new Error(`Failed to upload video: ${data.error?.message || 'Unknown error'}`);
    }

    return {
      publishId: data.data?.publish_id,
      status: data.data?.status || 'PROCESSING_UPLOAD',
    };
  }

  /**
   * Check video upload status
   */
  async getUploadStatus(accessToken: string, publishId: string): Promise<{
    status: string;
    failReason?: string;
    publiclyAvailablePostId?: string;
  }> {
    const url = `${this.config.baseUrl}/v2/post/publish/status/fetch/`;
    
    const requestBody = {
      publish_id: publishId,
    };

    const response = await this.makeAuthenticatedRequest(url, accessToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (data.error?.code !== 'ok') {
      throw new Error(`Failed to get upload status: ${data.error?.message || 'Unknown error'}`);
    }

    const result = data.data || {};
    
    return {
      status: result.status,
      failReason: result.fail_reason,
      publiclyAvailablePostId: result.publicly_available_post_id,
    };
  }

  /**
   * Get video comments
   */
  async getVideoComments(accessToken: string, videoId: string, options: {
    cursor?: number;
    count?: number;
  } = {}): Promise<{
    comments: Array<{
      id: string;
      text: string;
      createTime: number;
      likeCount: number;
      replyCount: number;
      status: string;
    }>;
    cursor: number;
    hasMore: boolean;
  }> {
    const url = `${this.config.baseUrl}/v2/video/comment/list/`;
    
    const requestBody = {
      video_id: videoId,
      cursor: options.cursor || 0,
      count: options.count || 50,
    };

    const response = await this.makeAuthenticatedRequest(url, accessToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (data.error?.code !== 'ok') {
      throw new Error(`Failed to get comments: ${data.error?.message || 'Unknown error'}`);
    }

    const result = data.data || {};
    
    return {
      comments: (result.comments || []).map((comment: any) => ({
        id: comment.id,
        text: comment.text,
        createTime: comment.create_time,
        likeCount: comment.like_count || 0,
        replyCount: comment.reply_count || 0,
        status: comment.status,
      })),
      cursor: result.cursor || 0,
      hasMore: result.has_more || false,
    };
  }

  /**
   * Determine account type based on follower count and verification
   */
  private determineAccountType(user: any): 'personal' | 'business' | 'creator' {
    const followerCount = user.follower_count || 0;
    
    if (followerCount > 10000 || user.is_verified) {
      return 'creator';
    }
    
    return 'personal';
  }

  /**
   * Platform-specific token revocation
   */
  protected async platformSpecificRevoke(token: string, tokenType: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/v2/oauth/revoke/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_key: this.config.clientId,
          client_secret: this.config.clientSecret,
          token,
        }).toString(),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.error?.code === 'ok';
    } catch (error) {
      console.error('TikTok token revocation failed:', error);
      return false;
    }
  }
}