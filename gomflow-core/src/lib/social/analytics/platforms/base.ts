// GOMFLOW Base Analytics Platform Service
// Abstract base class for all social media platform analytics

export interface PlatformConfig {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  baseUrl?: string;
  apiVersion?: string;
  rateLimits?: {
    requests: number;
    windowMs: number;
  };
}

export interface AnalyticsMetrics {
  followers: number;
  following: number;
  posts: number;
  engagement_rate: number;
  reach: number;
  impressions: number;
  profile_views?: number;
  website_clicks?: number;
}

export interface PostAnalytics {
  id: string;
  platform_post_id: string;
  content: string;
  media_urls: string[];
  hashtags: string[];
  mentions: string[];
  post_type: 'text' | 'image' | 'video' | 'carousel' | 'story' | 'reel' | 'live';
  posted_at: string;
  likes: number;
  comments: number;
  shares: number;
  saves?: number;
  clicks?: number;
  video_views?: number;
  reach: number;
  impressions: number;
  engagement_rate: number;
  sentiment_score?: number;
}

export interface AudienceInsights {
  demographics: {
    age_groups: Record<string, number>;
    gender: Record<string, number>;
    locations: Record<string, number>;
  };
  interests: string[];
  active_hours: Record<string, number>;
  growth_metrics: {
    new_followers: number;
    unfollowers: number;
    net_growth: number;
  };
}

export interface EngagementData {
  metric_type: 'like' | 'comment' | 'share' | 'save' | 'click' | 'view' | 'mention' | 'dm';
  user_id?: string;
  username?: string;
  content?: string;
  sentiment_score?: number;
  occurred_at: string;
}

export abstract class BasePlatformAnalytics {
  protected config: PlatformConfig;
  protected platformName: string;
  private rateLimitTracker = new Map<string, { count: number; resetTime: number }>();

  constructor(platformName: string, config: PlatformConfig) {
    this.platformName = platformName;
    this.config = config;
  }

  /**
   * Check rate limit for API calls
   */
  protected async checkRateLimit(endpoint: string): Promise<boolean> {
    if (!this.config.rateLimits) return true;

    const key = `${this.platformName}_${endpoint}`;
    const now = Date.now();
    const tracker = this.rateLimitTracker.get(key);

    if (!tracker || now > tracker.resetTime) {
      // Reset rate limit window
      this.rateLimitTracker.set(key, {
        count: 1,
        resetTime: now + this.config.rateLimits.windowMs
      });
      return true;
    }

    if (tracker.count >= this.config.rateLimits.requests) {
      const waitTime = tracker.resetTime - now;
      console.warn(`Rate limit reached for ${key}. Waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.checkRateLimit(endpoint);
    }

    tracker.count++;
    return true;
  }

  /**
   * Make authenticated API request
   */
  protected async apiRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    await this.checkRateLimit(endpoint);

    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request error for ${this.platformName}:`, error);
      throw error;
    }
  }

  /**
   * Get authentication headers for API requests
   */
  protected abstract getAuthHeaders(): Record<string, string>;

  /**
   * Fetch account analytics data
   */
  abstract fetchAccountAnalytics(accountId: string): Promise<AnalyticsMetrics>;

  /**
   * Fetch posts analytics for date range
   */
  abstract fetchPostsAnalytics(
    accountId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<PostAnalytics[]>;

  /**
   * Fetch audience insights
   */
  abstract fetchAudienceInsights(accountId: string): Promise<AudienceInsights>;

  /**
   * Fetch engagement data for specific posts
   */
  abstract fetchEngagementData(
    postIds: string[],
    dateRange?: { start: Date; end: Date }
  ): Promise<EngagementData[]>;

  /**
   * Fetch trending hashtags for the platform
   */
  abstract fetchTrendingHashtags(location?: string): Promise<string[]>;

  /**
   * Search for competitor accounts
   */
  abstract searchCompetitors(query: string, limit?: number): Promise<any[]>;

  /**
   * Validate API credentials
   */
  async validateCredentials(): Promise<boolean> {
    try {
      await this.fetchAccountAnalytics('test');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Refresh access token if needed
   */
  protected async refreshAccessToken(): Promise<void> {
    if (!this.config.refreshToken) {
      throw new Error('No refresh token available');
    }
    // Implementation depends on platform-specific OAuth flow
  }

  /**
   * Handle API errors and retry logic
   */
  protected async handleApiError(error: any, retries = 3): Promise<any> {
    if (retries <= 0) {
      throw error;
    }

    // Handle rate limiting
    if (error.status === 429) {
      const retryAfter = error.headers?.['retry-after'] || 60;
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return this.handleApiError(error, retries - 1);
    }

    // Handle token expiration
    if (error.status === 401) {
      await this.refreshAccessToken();
      return this.handleApiError(error, retries - 1);
    }

    throw error;
  }

  /**
   * Get platform-specific insights
   */
  getPlatformInsights(metrics: AnalyticsMetrics): string[] {
    const insights: string[] = [];

    if (metrics.engagement_rate > 3) {
      insights.push('High engagement rate - content is resonating well with audience');
    } else if (metrics.engagement_rate < 1) {
      insights.push('Low engagement rate - consider improving content quality or posting times');
    }

    if (metrics.followers > 0 && metrics.reach > 0) {
      const reachRate = (metrics.reach / metrics.followers) * 100;
      if (reachRate > 50) {
        insights.push('Good organic reach - algorithm is favoring your content');
      } else if (reachRate < 20) {
        insights.push('Low organic reach - consider using trending hashtags or posting at optimal times');
      }
    }

    return insights;
  }

  /**
   * Calculate performance score
   */
  calculatePerformanceScore(metrics: AnalyticsMetrics): number {
    let score = 0;
    let factors = 0;

    // Engagement rate (0-40 points)
    if (metrics.engagement_rate > 0) {
      score += Math.min(metrics.engagement_rate * 10, 40);
      factors++;
    }

    // Reach rate (0-30 points)
    if (metrics.followers > 0 && metrics.reach > 0) {
      const reachRate = (metrics.reach / metrics.followers) * 100;
      score += Math.min(reachRate * 0.6, 30);
      factors++;
    }

    // Growth indicators (0-30 points)
    if (metrics.followers > 0) {
      // Assume baseline scoring for now
      score += 15;
      factors++;
    }

    return factors > 0 ? Math.round(score / factors * (100 / 40)) : 0;
  }
}

export default BasePlatformAnalytics;