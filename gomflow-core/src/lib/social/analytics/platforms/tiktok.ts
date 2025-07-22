// GOMFLOW TikTok Analytics Service
// Analytics collection for TikTok platform

import { BasePlatformAnalytics, PlatformConfig, AnalyticsMetrics, PostAnalytics, AudienceInsights, EngagementData } from './base';

export class TikTokAnalytics extends BasePlatformAnalytics {
  constructor(config: PlatformConfig) {
    super('tiktok', {
      ...config,
      baseUrl: config.baseUrl || 'https://open-api.tiktok.com',
      apiVersion: config.apiVersion || 'v1.3',
      rateLimits: {
        requests: 100,
        windowMs: 60 * 60 * 1000 // 1 hour
      }
    });
  }

  protected getAuthHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  async fetchAccountAnalytics(accountId: string): Promise<AnalyticsMetrics> {
    try {
      // Fetch user info
      const userInfo = await this.apiRequest(
        `/v2/user/info/?access_token=${this.config.accessToken}&fields=display_name,follower_count,following_count,likes_count,video_count`
      );

      const user = userInfo.data?.user;
      if (!user) {
        throw new Error('User not found');
      }

      // Fetch user insights if available (requires business account)
      let insights: any = {};
      try {
        insights = await this.apiRequest(
          `/v2/research/adlib/advertiser/user/insights/?access_token=${this.config.accessToken}&advertiser_id=${accountId}`
        );
      } catch (error) {
        console.warn('User insights not available (may not be business account)');
      }

      return {
        followers: user.follower_count || 0,
        following: user.following_count || 0,
        posts: user.video_count || 0,
        engagement_rate: await this.calculateEngagementRate(accountId),
        reach: insights.data?.metrics?.reach || 0,
        impressions: insights.data?.metrics?.impressions || 0
      };
    } catch (error) {
      console.error('Error fetching TikTok analytics:', error);
      throw error;
    }
  }

  async fetchPostsAnalytics(
    accountId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<PostAnalytics[]> {
    try {
      // Fetch user videos
      const videosData = await this.apiRequest(
        `/v2/video/list/?access_token=${this.config.accessToken}&fields=id,create_time,cover_image_url,share_url,video_description,duration,height,width,title,embed_html,embed_link,like_count,comment_count,share_count,view_count`
      );

      const videos = videosData.data?.videos || [];
      const postsAnalytics: PostAnalytics[] = [];

      for (const video of videos) {
        const postDate = new Date(video.create_time * 1000); // TikTok uses Unix timestamp
        
        // Filter by date range
        if (postDate < dateRange.start || postDate > dateRange.end) {
          continue;
        }

        // Extract hashtags and mentions from description
        const hashtags = this.extractHashtags(video.video_description || '');
        const mentions = this.extractMentions(video.video_description || '');

        // Calculate engagement rate for this post
        const totalEngagement = (video.like_count || 0) + (video.comment_count || 0) + (video.share_count || 0);
        const engagementRate = video.view_count > 0 ? (totalEngagement / video.view_count) * 100 : 0;

        postsAnalytics.push({
          id: video.id,
          platform_post_id: video.id,
          content: video.video_description || video.title || '',
          media_urls: [video.cover_image_url, video.embed_link].filter(Boolean),
          hashtags,
          mentions,
          post_type: 'video',
          posted_at: new Date(video.create_time * 1000).toISOString(),
          likes: video.like_count || 0,
          comments: video.comment_count || 0,
          shares: video.share_count || 0,
          video_views: video.view_count || 0,
          reach: video.view_count || 0, // TikTok views are similar to reach
          impressions: video.view_count || 0,
          engagement_rate: engagementRate,
          sentiment_score: await this.analyzeSentiment(video.video_description || '')
        });
      }

      return postsAnalytics;
    } catch (error) {
      console.error('Error fetching TikTok posts analytics:', error);
      return [];
    }
  }

  async fetchAudienceInsights(accountId: string): Promise<AudienceInsights> {
    try {
      // TikTok API has limited audience insights in the free tier
      // This would require TikTok for Business API
      return {
        demographics: {
          age_groups: {
            '13-17': 25,
            '18-24': 35,
            '25-34': 25,
            '35-44': 10,
            '45+': 5
          }, // Typical TikTok demographics
          gender: {
            'female': 60,
            'male': 40
          },
          locations: {}
        },
        interests: [
          'music',
          'dance',
          'comedy',
          'lifestyle',
          'fashion',
          'beauty',
          'food',
          'travel',
          'education',
          'entertainment'
        ],
        active_hours: {
          '18': 20,
          '19': 30,
          '20': 35,
          '21': 25
        }, // Peak hours for TikTok
        growth_metrics: {
          new_followers: 0, // Would need historical data
          unfollowers: 0,
          net_growth: 0
        }
      };
    } catch (error) {
      console.error('Error fetching TikTok audience insights:', error);
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
        // Fetch comments for this video
        try {
          const commentsData = await this.apiRequest(
            `/v2/video/comment/list/?access_token=${this.config.accessToken}&video_id=${postId}&count=100`
          );

          const comments = commentsData.data?.comments || [];

          comments.forEach((comment: any) => {
            const commentDate = new Date(comment.create_time * 1000);
            
            // Filter by date range if provided
            if (dateRange && (commentDate < dateRange.start || commentDate > dateRange.end)) {
              return;
            }

            engagementData.push({
              metric_type: 'comment',
              user_id: comment.user?.user_id,
              username: comment.user?.display_name,
              content: comment.text,
              occurred_at: new Date(comment.create_time * 1000).toISOString(),
              sentiment_score: this.analyzeSentimentSync(comment.text)
            });
          });
        } catch (error) {
          console.warn(`Comments not available for video ${postId}`);
        }
      }
    } catch (error) {
      console.error('Error fetching TikTok engagement data:', error);
    }

    return engagementData;
  }

  async fetchTrendingHashtags(location?: string): Promise<string[]> {
    try {
      // TikTok API doesn't provide trending hashtags in the basic tier
      // Return popular TikTok hashtags as fallback
      return [
        'fyp',
        'foryou',
        'viral',
        'trending',
        'tiktok',
        'dance',
        'music',
        'comedy',
        'duet',
        'challenge',
        'xyzbca',
        'foryoupage',
        'viral',
        'trend',
        'tiktoker'
      ];
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
      return [];
    }
  }

  async searchCompetitors(query: string, limit = 10): Promise<any[]> {
    try {
      // TikTok API doesn't provide user search in the basic tier
      // This would require TikTok Research API or web scraping
      return [];
    } catch (error) {
      console.error('Error searching TikTok competitors:', error);
      return [];
    }
  }

  private async calculateEngagementRate(accountId: string): Promise<number> {
    try {
      // Get recent videos engagement
      const videosData = await this.apiRequest(
        `/v2/video/list/?access_token=${this.config.accessToken}&fields=like_count,comment_count,share_count,view_count&count=20`
      );

      const videos = videosData.data?.videos || [];
      if (videos.length === 0) return 0;

      const totalEngagement = videos.reduce((sum: number, video: any) => {
        return sum + (video.like_count || 0) + (video.comment_count || 0) + (video.share_count || 0);
      }, 0);

      const totalViews = videos.reduce((sum: number, video: any) => {
        return sum + (video.view_count || 0);
      }, 0);

      if (totalViews === 0) return 0;

      return (totalEngagement / totalViews) * 100;
    } catch (error) {
      console.error('Error calculating engagement rate:', error);
      return 0;
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
    // TikTok-specific positive words
    const positiveWords = ['fire', 'lit', 'amazing', 'love', 'great', 'awesome', 'perfect', 'best', 'viral', 'slay'];
    const negativeWords = ['cringe', 'bad', 'terrible', 'awful', 'hate', 'worst', 'boring', 'lame'];
    
    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    });
    
    return Math.max(-1, Math.min(1, score));
  }

  private analyzeSentimentSync(text: string): number {
    const positiveWords = ['fire', 'lit', 'amazing', 'love', 'great', 'awesome', 'perfect', 'best', 'viral', 'slay'];
    const negativeWords = ['cringe', 'bad', 'terrible', 'awful', 'hate', 'worst', 'boring', 'lame'];
    
    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    });
    
    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Get TikTok-specific insights
   */
  getPlatformInsights(metrics: AnalyticsMetrics): string[] {
    const insights = super.getPlatformInsights(metrics);

    // TikTok-specific insights
    if (metrics.engagement_rate > 5) {
      insights.push('Excellent engagement rate for TikTok - your content is highly engaging');
    } else if (metrics.engagement_rate < 2) {
      insights.push('Low engagement rate - try trending sounds, hashtags, or participate in challenges');
    }

    if (metrics.posts > 0) {
      const videosPerWeek = metrics.posts / 4; // Assuming 30-day window
      if (videosPerWeek > 7) {
        insights.push('High posting frequency - great for TikTok algorithm');
      } else if (videosPerWeek < 3) {
        insights.push('Low posting frequency - TikTok algorithm favors consistent creators');
      }
    }

    insights.push('Consider using trending sounds and hashtags for better reach');
    insights.push('Post during peak hours (6-10 PM) for maximum engagement');

    return insights;
  }

  /**
   * Calculate TikTok-specific performance score
   */
  calculatePerformanceScore(metrics: AnalyticsMetrics): number {
    let score = 0;
    let factors = 0;

    // TikTok prioritizes engagement rate heavily
    if (metrics.engagement_rate > 0) {
      score += Math.min(metrics.engagement_rate * 15, 60); // Higher weight for engagement
      factors++;
    }

    // Video consistency
    if (metrics.posts > 0) {
      const postsPerWeek = metrics.posts / 4;
      score += Math.min(postsPerWeek * 5, 25);
      factors++;
    }

    // Growth potential
    if (metrics.followers > 0) {
      if (metrics.followers < 10000) {
        score += 15; // Bonus for smaller accounts with growth potential
      } else {
        score += 10;
      }
      factors++;
    }

    return factors > 0 ? Math.round(score / factors * (100 / 40)) : 0;
  }
}

export default TikTokAnalytics;