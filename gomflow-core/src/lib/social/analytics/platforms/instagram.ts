// GOMFLOW Instagram Analytics Service
// Analytics collection for Instagram platform

import { BasePlatformAnalytics, PlatformConfig, AnalyticsMetrics, PostAnalytics, AudienceInsights, EngagementData } from './base';

export class InstagramAnalytics extends BasePlatformAnalytics {
  constructor(config: PlatformConfig) {
    super('instagram', {
      ...config,
      baseUrl: config.baseUrl || 'https://graph.instagram.com',
      apiVersion: config.apiVersion || 'v18.0',
      rateLimits: {
        requests: 200,
        windowMs: 60 * 60 * 1000 // 1 hour
      }
    });
  }

  protected getAuthHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.accessToken}`
    };
  }

  async fetchAccountAnalytics(accountId: string): Promise<AnalyticsMetrics> {
    try {
      // Fetch account insights
      const accountData = await this.apiRequest(
        `/me?fields=account_type,media_count,followers_count,follows_count&access_token=${this.config.accessToken}`
      );

      // Fetch account insights for business/creator accounts
      let insights: any = {};
      try {
        insights = await this.apiRequest(
          `/me/insights?metric=impressions,reach,profile_views,website_clicks&period=day&access_token=${this.config.accessToken}`
        );
      } catch (error) {
        console.warn('Account insights not available (may not be business account)');
      }

      const impressions = insights.data?.find((i: any) => i.name === 'impressions')?.values?.[0]?.value || 0;
      const reach = insights.data?.find((i: any) => i.name === 'reach')?.values?.[0]?.value || 0;
      const profileViews = insights.data?.find((i: any) => i.name === 'profile_views')?.values?.[0]?.value || 0;
      const websiteClicks = insights.data?.find((i: any) => i.name === 'website_clicks')?.values?.[0]?.value || 0;

      return {
        followers: accountData.followers_count,
        following: accountData.follows_count,
        posts: accountData.media_count,
        engagement_rate: await this.calculateEngagementRate(accountId),
        reach: reach,
        impressions: impressions,
        profile_views: profileViews,
        website_clicks: websiteClicks
      };
    } catch (error) {
      console.error('Error fetching Instagram analytics:', error);
      throw error;
    }
  }

  async fetchPostsAnalytics(
    accountId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<PostAnalytics[]> {
    try {
      // Fetch media posts
      const mediaData = await this.apiRequest(
        `/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=100&access_token=${this.config.accessToken}`
      );

      const posts = mediaData.data || [];
      const postsAnalytics: PostAnalytics[] = [];

      for (const post of posts) {
        const postDate = new Date(post.timestamp);
        
        // Filter by date range
        if (postDate < dateRange.start || postDate > dateRange.end) {
          continue;
        }

        // Fetch post insights for business accounts
        let postInsights: any = {};
        try {
          if (post.media_type !== 'CAROUSEL_ALBUM') {
            postInsights = await this.apiRequest(
              `/${post.id}/insights?metric=impressions,reach,saves&access_token=${this.config.accessToken}`
            );
          }
        } catch (error) {
          console.warn(`Post insights not available for post ${post.id}`);
        }

        const impressions = postInsights.data?.find((i: any) => i.name === 'impressions')?.values?.[0]?.value || 0;
        const reach = postInsights.data?.find((i: any) => i.name === 'reach')?.values?.[0]?.value || 0;
        const saves = postInsights.data?.find((i: any) => i.name === 'saves')?.values?.[0]?.value || 0;

        // Extract hashtags and mentions from caption
        const hashtags = this.extractHashtags(post.caption || '');
        const mentions = this.extractMentions(post.caption || '');

        postsAnalytics.push({
          id: post.id,
          platform_post_id: post.id,
          content: post.caption || '',
          media_urls: [post.media_url, post.thumbnail_url].filter(Boolean),
          hashtags,
          mentions,
          post_type: this.convertMediaType(post.media_type),
          posted_at: post.timestamp,
          likes: post.like_count || 0,
          comments: post.comments_count || 0,
          shares: 0, // Instagram doesn't provide share count
          saves: saves,
          reach: reach,
          impressions: impressions,
          engagement_rate: this.calculatePostEngagementRate(post, impressions),
          sentiment_score: await this.analyzeSentiment(post.caption || '')
        });
      }

      return postsAnalytics;
    } catch (error) {
      console.error('Error fetching Instagram posts analytics:', error);
      return [];
    }
  }

  async fetchAudienceInsights(accountId: string): Promise<AudienceInsights> {
    try {
      // Fetch audience insights for business/creator accounts
      const audienceData = await this.apiRequest(
        `/me/insights?metric=audience_gender_age,audience_city,audience_country&period=lifetime&access_token=${this.config.accessToken}`
      );

      const insights = audienceData.data || [];
      const genderAge = insights.find((i: any) => i.name === 'audience_gender_age')?.values?.[0]?.value || {};
      const cities = insights.find((i: any) => i.name === 'audience_city')?.values?.[0]?.value || {};
      const countries = insights.find((i: any) => i.name === 'audience_country')?.values?.[0]?.value || {};

      // Parse gender and age data
      const demographics = {
        age_groups: {},
        gender: { M: 0, F: 0 },
        locations: { ...cities, ...countries }
      };

      Object.entries(genderAge).forEach(([key, value]: [string, any]) => {
        const [gender, ageRange] = key.split('.');
        if (gender === 'M' || gender === 'F') {
          demographics.gender[gender] += value;
          if (ageRange) {
            demographics.age_groups[ageRange] = (demographics.age_groups[ageRange] || 0) + value;
          }
        }
      });

      return {
        demographics,
        interests: [], // Not available in basic API
        active_hours: {}, // Would need more detailed insights
        growth_metrics: {
          new_followers: 0, // Would need historical data
          unfollowers: 0,
          net_growth: 0
        }
      };
    } catch (error) {
      console.error('Error fetching Instagram audience insights:', error);
      return {
        demographics: {
          age_groups: {},
          gender: {},
          locations: {}
        },
        interests: [],
        active_hours: {},
        growth_metrics: {
          new_followers: 0,
          unfollowers: 0,
          net_growth: 0
        }
      };
    }
  }

  async fetchEngagementData(
    postIds: string[],
    dateRange?: { start: Date; end: Date }
  ): Promise<EngagementData[]> {
    const engagementData: EngagementData[] = [];

    try {
      for (const postId of postIds) {
        // Fetch comments for this post
        const commentsData = await this.apiRequest(
          `/${postId}/comments?fields=id,text,username,timestamp&access_token=${this.config.accessToken}`
        );

        const comments = commentsData.data || [];

        comments.forEach((comment: any) => {
          const commentDate = new Date(comment.timestamp);
          
          // Filter by date range if provided
          if (dateRange && (commentDate < dateRange.start || commentDate > dateRange.end)) {
            return;
          }

          engagementData.push({
            metric_type: 'comment',
            user_id: comment.id,
            username: comment.username,
            content: comment.text,
            occurred_at: comment.timestamp,
            sentiment_score: this.analyzeSentimentSync(comment.text)
          });
        });

        // For likes, we can only get count, not individual users
        // This would require Instagram Basic Display API for personal accounts
      }
    } catch (error) {
      console.error('Error fetching Instagram engagement data:', error);
    }

    return engagementData;
  }

  async fetchTrendingHashtags(location?: string): Promise<string[]> {
    try {
      // Instagram doesn't provide trending hashtags through API
      // Return popular K-pop related hashtags as fallback
      return [
        'kpop',
        'grouporder',
        'preorder',
        'album',
        'photocard',
        'merch',
        'comeback',
        'bias',
        'fandom',
        'concert'
      ];
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
      return [];
    }
  }

  async searchCompetitors(query: string, limit = 10): Promise<any[]> {
    try {
      // Instagram API doesn't provide user search functionality
      // This would need to be implemented using Instagram Basic Display API
      // or through web scraping (not recommended)
      return [];
    } catch (error) {
      console.error('Error searching Instagram competitors:', error);
      return [];
    }
  }

  private async calculateEngagementRate(accountId: string): Promise<number> {
    try {
      // Get recent posts engagement
      const mediaData = await this.apiRequest(
        `/me/media?fields=like_count,comments_count&limit=12&access_token=${this.config.accessToken}`
      );

      const posts = mediaData.data || [];
      if (posts.length === 0) return 0;

      const totalEngagement = posts.reduce((sum: number, post: any) => {
        return sum + (post.like_count || 0) + (post.comments_count || 0);
      }, 0);

      // Get follower count
      const accountData = await this.apiRequest(
        `/me?fields=followers_count&access_token=${this.config.accessToken}`
      );
      const followerCount = accountData.followers_count;

      if (followerCount === 0) return 0;

      return ((totalEngagement / posts.length) / followerCount) * 100;
    } catch (error) {
      console.error('Error calculating engagement rate:', error);
      return 0;
    }
  }

  private calculatePostEngagementRate(post: any, impressions: number): number {
    const totalEngagement = (post.like_count || 0) + (post.comments_count || 0);
    if (impressions > 0) {
      return (totalEngagement / impressions) * 100;
    }
    return totalEngagement > 0 ? Math.min(totalEngagement / 100, 10) : 0;
  }

  private convertMediaType(instagramType: string): PostAnalytics['post_type'] {
    switch (instagramType) {
      case 'IMAGE':
        return 'image';
      case 'VIDEO':
        return 'video';
      case 'CAROUSEL_ALBUM':
        return 'carousel';
      default:
        return 'image';
    }
  }

  private extractHashtags(text: string): string[] {
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.slice(1)) : [];
  }

  private extractMentions(text: string): string[] {
    const mentionRegex = /@[a-zA-Z0-9_.]+/g;
    const matches = text.match(mentionRegex);
    return matches ? matches.map(mention => mention.slice(1)) : [];
  }

  private async analyzeSentiment(text: string): Promise<number> {
    // Simple sentiment analysis - in production, use proper NLP service
    const positiveWords = ['love', 'amazing', 'beautiful', 'perfect', 'best', 'awesome', 'great', 'fantastic'];
    const negativeWords = ['hate', 'terrible', 'awful', 'worst', 'horrible', 'bad', 'disappointing'];
    
    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    });
    
    return Math.max(-1, Math.min(1, score));
  }

  private analyzeSentimentSync(text: string): number {
    // Synchronous version for immediate use
    const positiveWords = ['love', 'amazing', 'beautiful', 'perfect', 'best', 'awesome', 'great', 'fantastic'];
    const negativeWords = ['hate', 'terrible', 'awful', 'worst', 'horrible', 'bad', 'disappointing'];
    
    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    });
    
    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Get Instagram-specific insights
   */
  getPlatformInsights(metrics: AnalyticsMetrics): string[] {
    const insights = super.getPlatformInsights(metrics);

    // Instagram-specific insights
    if (metrics.saves && metrics.likes > 0) {
      const saveRate = (metrics.saves / metrics.likes) * 100;
      if (saveRate > 10) {
        insights.push('High save rate - your content provides value that users want to reference later');
      }
    }

    if (metrics.profile_views && metrics.followers > 0) {
      const profileViewRate = (metrics.profile_views / metrics.followers) * 100;
      if (profileViewRate > 20) {
        insights.push('Good profile engagement - optimize your bio and highlights');
      }
    }

    if (metrics.website_clicks && metrics.website_clicks > 0) {
      insights.push('Getting website traffic from Instagram - consider more call-to-action posts');
    }

    return insights;
  }
}

export default InstagramAnalytics;