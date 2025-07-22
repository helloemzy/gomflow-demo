// GOMFLOW Twitter/X Analytics Service
// Analytics collection for Twitter/X platform

import { BasePlatformAnalytics, PlatformConfig, AnalyticsMetrics, PostAnalytics, AudienceInsights, EngagementData } from './base';

export class TwitterAnalytics extends BasePlatformAnalytics {
  constructor(config: PlatformConfig) {
    super('twitter', {
      ...config,
      baseUrl: config.baseUrl || 'https://api.twitter.com/2',
      rateLimits: {
        requests: 75,
        windowMs: 15 * 60 * 1000 // 15 minutes
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
      // Fetch user data
      const userData = await this.apiRequest(`/users/by/username/${accountId}?user.fields=public_metrics,verified`);
      const user = userData.data;

      if (!user) {
        throw new Error('User not found');
      }

      return {
        followers: user.public_metrics.followers_count,
        following: user.public_metrics.following_count,
        posts: user.public_metrics.tweet_count,
        engagement_rate: await this.calculateEngagementRate(user.id),
        reach: 0, // Twitter doesn't provide reach in basic API
        impressions: 0 // Requires Twitter API v2 with special access
      };
    } catch (error) {
      console.error('Error fetching Twitter analytics:', error);
      throw error;
    }
  }

  async fetchPostsAnalytics(
    accountId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<PostAnalytics[]> {
    try {
      // Get user ID first
      const userData = await this.apiRequest(`/users/by/username/${accountId}`);
      const userId = userData.data.id;

      // Fetch tweets with metrics
      const tweetsData = await this.apiRequest(
        `/users/${userId}/tweets?` +
        `tweet.fields=created_at,public_metrics,context_annotations,entities,possibly_sensitive&` +
        `expansions=attachments.media_keys&` +
        `media.fields=type,url,preview_image_url&` +
        `max_results=100&` +
        `start_time=${dateRange.start.toISOString()}&` +
        `end_time=${dateRange.end.toISOString()}`
      );

      const tweets = tweetsData.data || [];
      const media = tweetsData.includes?.media || [];

      return tweets.map((tweet: any): PostAnalytics => {
        // Get media URLs for this tweet
        const tweetMedia = media.filter((m: any) => 
          tweet.attachments?.media_keys?.includes(m.media_key)
        );

        return {
          id: tweet.id,
          platform_post_id: tweet.id,
          content: tweet.text,
          media_urls: tweetMedia.map((m: any) => m.url || m.preview_image_url).filter(Boolean),
          hashtags: tweet.entities?.hashtags?.map((h: any) => h.tag) || [],
          mentions: tweet.entities?.mentions?.map((m: any) => m.username) || [],
          post_type: this.determinePostType(tweet, tweetMedia),
          posted_at: tweet.created_at,
          likes: tweet.public_metrics.like_count,
          comments: tweet.public_metrics.reply_count,
          shares: tweet.public_metrics.retweet_count,
          clicks: 0, // Not available in basic API
          reach: 0, // Not available in basic API
          impressions: 0, // Not available in basic API
          engagement_rate: this.calculateTweetEngagementRate(tweet.public_metrics),
          sentiment_score: await this.analyzeSentiment(tweet.text)
        };
      });
    } catch (error) {
      console.error('Error fetching Twitter posts analytics:', error);
      return [];
    }
  }

  async fetchAudienceInsights(accountId: string): Promise<AudienceInsights> {
    // Twitter API v2 doesn't provide detailed audience insights in free tier
    // This would require Twitter API v1.1 Premium or Enterprise
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

  async fetchEngagementData(
    postIds: string[],
    dateRange?: { start: Date; end: Date }
  ): Promise<EngagementData[]> {
    const engagementData: EngagementData[] = [];

    try {
      for (const postId of postIds) {
        // Fetch replies/mentions for this tweet
        const repliesData = await this.apiRequest(
          `/tweets/search/recent?` +
          `query=conversation_id:${postId}&` +
          `tweet.fields=created_at,author_id,public_metrics&` +
          `user.fields=username&` +
          `expansions=author_id&` +
          `max_results=100`
        );

        const replies = repliesData.data || [];
        const users = repliesData.includes?.users || [];

        replies.forEach((reply: any) => {
          const user = users.find((u: any) => u.id === reply.author_id);
          engagementData.push({
            metric_type: 'comment',
            user_id: reply.author_id,
            username: user?.username,
            content: reply.text,
            occurred_at: reply.created_at,
            sentiment_score: this.analyzeSentimentSync(reply.text)
          });
        });

        // For likes and retweets, we can only get counts, not individual users
        // This would require Twitter API v1.1 or special access
      }
    } catch (error) {
      console.error('Error fetching Twitter engagement data:', error);
    }

    return engagementData;
  }

  async fetchTrendingHashtags(location?: string): Promise<string[]> {
    try {
      // This would require Twitter API v1.1 for trending topics
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
      return [];
    }
  }

  async searchCompetitors(query: string, limit = 10): Promise<any[]> {
    try {
      const searchData = await this.apiRequest(
        `/users/search?` +
        `query=${encodeURIComponent(query)}&` +
        `user.fields=public_metrics,verified,description&` +
        `max_results=${Math.min(limit, 100)}`
      );

      return (searchData.data || []).map((user: any) => ({
        id: user.id,
        username: user.username,
        display_name: user.name,
        bio: user.description,
        followers: user.public_metrics.followers_count,
        following: user.public_metrics.following_count,
        posts: user.public_metrics.tweet_count,
        verified: user.verified,
        profile_url: `https://twitter.com/${user.username}`
      }));
    } catch (error) {
      console.error('Error searching Twitter competitors:', error);
      return [];
    }
  }

  private async calculateEngagementRate(userId: string): Promise<number> {
    try {
      // Get recent tweets to calculate average engagement
      const tweetsData = await this.apiRequest(
        `/users/${userId}/tweets?` +
        `tweet.fields=public_metrics&` +
        `max_results=100`
      );

      const tweets = tweetsData.data || [];
      if (tweets.length === 0) return 0;

      const totalEngagement = tweets.reduce((sum: number, tweet: any) => {
        return sum + tweet.public_metrics.like_count + 
               tweet.public_metrics.retweet_count + 
               tweet.public_metrics.reply_count;
      }, 0);

      // Get follower count
      const userData = await this.apiRequest(`/users/${userId}?user.fields=public_metrics`);
      const followerCount = userData.data.public_metrics.followers_count;

      if (followerCount === 0) return 0;

      return ((totalEngagement / tweets.length) / followerCount) * 100;
    } catch (error) {
      console.error('Error calculating engagement rate:', error);
      return 0;
    }
  }

  private calculateTweetEngagementRate(metrics: any): number {
    const totalEngagement = metrics.like_count + metrics.retweet_count + metrics.reply_count;
    // Since we don't have impression data, use a placeholder calculation
    return totalEngagement > 0 ? Math.min(totalEngagement / 100, 10) : 0;
  }

  private determinePostType(tweet: any, media: any[]): PostAnalytics['post_type'] {
    if (media.length > 0) {
      const hasVideo = media.some((m: any) => m.type === 'video');
      const hasMultiple = media.length > 1;
      
      if (hasVideo) return 'video';
      if (hasMultiple) return 'carousel';
      return 'image';
    }
    return 'text';
  }

  private async analyzeSentiment(text: string): Promise<number> {
    // Simple sentiment analysis - in production, use proper NLP service
    const positiveWords = ['good', 'great', 'awesome', 'love', 'amazing', 'excellent', 'perfect', 'best'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disappointing'];
    
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
    const positiveWords = ['good', 'great', 'awesome', 'love', 'amazing', 'excellent', 'perfect', 'best'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disappointing'];
    
    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    });
    
    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Get Twitter-specific insights
   */
  getPlatformInsights(metrics: AnalyticsMetrics): string[] {
    const insights = super.getPlatformInsights(metrics);

    // Twitter-specific insights
    if (metrics.posts > 0) {
      const tweetsPerDay = metrics.posts / 30; // Assuming 30-day window
      if (tweetsPerDay > 10) {
        insights.push('High posting frequency - consider quality over quantity');
      } else if (tweetsPerDay < 1) {
        insights.push('Low posting frequency - try to post more consistently');
      }
    }

    if (metrics.followers > 1000) {
      insights.push('Good follower base - consider leveraging Twitter Spaces or threads');
    }

    return insights;
  }
}

export default TwitterAnalytics;