// GOMFLOW Facebook Analytics Service
// Analytics collection for Facebook platform

import { BasePlatformAnalytics, PlatformConfig, AnalyticsMetrics, PostAnalytics, AudienceInsights, EngagementData } from './base';

export class FacebookAnalytics extends BasePlatformAnalytics {
  constructor(config: PlatformConfig) {
    super('facebook', {
      ...config,
      baseUrl: config.baseUrl || 'https://graph.facebook.com',
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
      // Fetch page data
      const pageData = await this.apiRequest(
        `/${accountId}?fields=fan_count,talking_about_count,posts&access_token=${this.config.accessToken}`
      );

      // Fetch page insights
      const insights = await this.apiRequest(
        `/${accountId}/insights?metric=page_impressions,page_reach,page_views_total,page_engaged_users&period=day&access_token=${this.config.accessToken}`
      );

      const impressions = insights.data?.find((i: any) => i.name === 'page_impressions')?.values?.[0]?.value || 0;
      const reach = insights.data?.find((i: any) => i.name === 'page_reach')?.values?.[0]?.value || 0;
      const pageViews = insights.data?.find((i: any) => i.name === 'page_views_total')?.values?.[0]?.value || 0;
      const engagedUsers = insights.data?.find((i: any) => i.name === 'page_engaged_users')?.values?.[0]?.value || 0;

      return {
        followers: pageData.fan_count || 0,
        following: 0, // Not applicable for pages
        posts: 0, // Would need to count posts
        engagement_rate: await this.calculateEngagementRate(accountId),
        reach: reach,
        impressions: impressions,
        profile_views: pageViews
      };
    } catch (error) {
      console.error('Error fetching Facebook analytics:', error);
      throw error;
    }
  }

  async fetchPostsAnalytics(
    accountId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<PostAnalytics[]> {
    try {
      // Fetch page posts
      const postsData = await this.apiRequest(
        `/${accountId}/posts?fields=id,message,story,created_time,type,attachments,shares&access_token=${this.config.accessToken}`
      );

      const posts = postsData.data || [];
      const postsAnalytics: PostAnalytics[] = [];

      for (const post of posts) {
        const postDate = new Date(post.created_time);
        
        // Filter by date range
        if (postDate < dateRange.start || postDate > dateRange.end) {
          continue;
        }

        // Fetch post insights
        let postInsights: any = {};
        try {
          postInsights = await this.apiRequest(
            `/${post.id}/insights?metric=post_impressions,post_reach,post_reactions_like_total,post_reactions_love_total,post_reactions_wow_total,post_reactions_haha_total,post_reactions_sorry_total,post_reactions_anger_total,post_clicks,post_shares&access_token=${this.config.accessToken}`
          );
        } catch (error) {
          console.warn(`Post insights not available for post ${post.id}`);
        }

        const impressions = postInsights.data?.find((i: any) => i.name === 'post_impressions')?.values?.[0]?.value || 0;
        const reach = postInsights.data?.find((i: any) => i.name === 'post_reach')?.values?.[0]?.value || 0;
        const clicks = postInsights.data?.find((i: any) => i.name === 'post_clicks')?.values?.[0]?.value || 0;
        
        // Calculate total reactions
        const reactions = [
          'post_reactions_like_total',
          'post_reactions_love_total',
          'post_reactions_wow_total',
          'post_reactions_haha_total',
          'post_reactions_sorry_total',
          'post_reactions_anger_total'
        ].reduce((total, metric) => {
          const value = postInsights.data?.find((i: any) => i.name === metric)?.values?.[0]?.value || 0;
          return total + value;
        }, 0);

        // Get media URLs from attachments
        const mediaUrls = this.extractMediaUrls(post.attachments);

        // Extract hashtags and mentions
        const content = post.message || post.story || '';
        const hashtags = this.extractHashtags(content);
        const mentions = this.extractMentions(content);

        postsAnalytics.push({
          id: post.id,
          platform_post_id: post.id,
          content: content,
          media_urls: mediaUrls,
          hashtags,
          mentions,
          post_type: this.convertPostType(post.type, post.attachments),
          posted_at: post.created_time,
          likes: reactions,
          comments: 0, // Would need separate API call
          shares: post.shares?.count || 0,
          clicks: clicks,
          reach: reach,
          impressions: impressions,
          engagement_rate: this.calculatePostEngagementRate(reactions, 0, post.shares?.count || 0, impressions),
          sentiment_score: await this.analyzeSentiment(content)
        });
      }

      return postsAnalytics;
    } catch (error) {
      console.error('Error fetching Facebook posts analytics:', error);
      return [];
    }
  }

  async fetchAudienceInsights(accountId: string): Promise<AudienceInsights> {
    try {
      // Fetch audience insights
      const audienceData = await this.apiRequest(
        `/${accountId}/insights?metric=page_fans_gender_age,page_fans_city,page_fans_country,page_fans_locale&period=lifetime&access_token=${this.config.accessToken}`
      );

      const insights = audienceData.data || [];
      const genderAge = insights.find((i: any) => i.name === 'page_fans_gender_age')?.values?.[0]?.value || {};
      const cities = insights.find((i: any) => i.name === 'page_fans_city')?.values?.[0]?.value || {};
      const countries = insights.find((i: any) => i.name === 'page_fans_country')?.values?.[0]?.value || {};
      const locales = insights.find((i: any) => i.name === 'page_fans_locale')?.values?.[0]?.value || {};

      // Parse gender and age data
      const demographics = {
        age_groups: {},
        gender: { M: 0, F: 0, U: 0 },
        locations: { ...cities, ...countries }
      };

      Object.entries(genderAge).forEach(([key, value]: [string, any]) => {
        const [gender, ageRange] = key.split('.');
        if (['M', 'F', 'U'].includes(gender)) {
          demographics.gender[gender] += value;
          if (ageRange) {
            demographics.age_groups[ageRange] = (demographics.age_groups[ageRange] || 0) + value;
          }
        }
      });

      return {
        demographics,
        interests: Object.keys(locales), // Use locales as proxy for interests
        active_hours: {}, // Would need more detailed insights
        growth_metrics: {
          new_followers: 0, // Would need historical data
          unfollowers: 0,
          net_growth: 0
        }
      };
    } catch (error) {
      console.error('Error fetching Facebook audience insights:', error);
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
          `/${postId}/comments?fields=id,message,from,created_time&access_token=${this.config.accessToken}`
        );

        const comments = commentsData.data || [];

        comments.forEach((comment: any) => {
          const commentDate = new Date(comment.created_time);
          
          // Filter by date range if provided
          if (dateRange && (commentDate < dateRange.start || commentDate > dateRange.end)) {
            return;
          }

          engagementData.push({
            metric_type: 'comment',
            user_id: comment.from?.id,
            username: comment.from?.name,
            content: comment.message,
            occurred_at: comment.created_time,
            sentiment_score: this.analyzeSentimentSync(comment.message)
          });
        });

        // Fetch reactions
        try {
          const reactionsData = await this.apiRequest(
            `/${postId}/reactions?fields=id,name,type&access_token=${this.config.accessToken}`
          );

          const reactions = reactionsData.data || [];
          reactions.forEach((reaction: any) => {
            engagementData.push({
              metric_type: 'like',
              user_id: reaction.id,
              username: reaction.name,
              occurred_at: new Date().toISOString() // Facebook doesn't provide reaction timestamp
            });
          });
        } catch (error) {
          console.warn(`Reactions not available for post ${postId}`);
        }
      }
    } catch (error) {
      console.error('Error fetching Facebook engagement data:', error);
    }

    return engagementData;
  }

  async fetchTrendingHashtags(location?: string): Promise<string[]> {
    try {
      // Facebook doesn't provide trending hashtags through API
      // Return popular general hashtags as fallback
      return [
        'facebook',
        'community',
        'share',
        'like',
        'follow',
        'connect',
        'social',
        'trending',
        'viral',
        'engagement'
      ];
    } catch (error) {
      console.error('Error fetching trending hashtags:', error);
      return [];
    }
  }

  async searchCompetitors(query: string, limit = 10): Promise<any[]> {
    try {
      // Facebook API has limited search capabilities
      // This would typically require Facebook Marketing API
      return [];
    } catch (error) {
      console.error('Error searching Facebook competitors:', error);
      return [];
    }
  }

  private async calculateEngagementRate(pageId: string): Promise<number> {
    try {
      // Get recent posts engagement
      const postsData = await this.apiRequest(
        `/${pageId}/posts?fields=id&limit=10&access_token=${this.config.accessToken}`
      );

      const posts = postsData.data || [];
      if (posts.length === 0) return 0;

      let totalEngagement = 0;
      
      for (const post of posts) {
        try {
          const postInsights = await this.apiRequest(
            `/${post.id}/insights?metric=post_engaged_users&access_token=${this.config.accessToken}`
          );
          const engaged = postInsights.data?.[0]?.values?.[0]?.value || 0;
          totalEngagement += engaged;
        } catch (error) {
          // Skip if insights not available
        }
      }

      // Get follower count
      const pageData = await this.apiRequest(
        `/${pageId}?fields=fan_count&access_token=${this.config.accessToken}`
      );
      const followerCount = pageData.fan_count;

      if (followerCount === 0) return 0;

      return ((totalEngagement / posts.length) / followerCount) * 100;
    } catch (error) {
      console.error('Error calculating engagement rate:', error);
      return 0;
    }
  }

  private calculatePostEngagementRate(likes: number, comments: number, shares: number, impressions: number): number {
    const totalEngagement = likes + comments + shares;
    if (impressions > 0) {
      return (totalEngagement / impressions) * 100;
    }
    return totalEngagement > 0 ? Math.min(totalEngagement / 100, 10) : 0;
  }

  private convertPostType(fbType: string, attachments: any): PostAnalytics['post_type'] {
    if (attachments?.data?.[0]) {
      const attachment = attachments.data[0];
      if (attachment.type === 'video_inline') return 'video';
      if (attachment.type === 'photo') return 'image';
      if (attachments.data.length > 1) return 'carousel';
    }
    
    switch (fbType) {
      case 'video':
        return 'video';
      case 'photo':
        return 'image';
      default:
        return 'text';
    }
  }

  private extractMediaUrls(attachments: any): string[] {
    if (!attachments?.data) return [];
    
    return attachments.data.map((attachment: any) => {
      if (attachment.media?.image?.src) return attachment.media.image.src;
      if (attachment.media?.source) return attachment.media.source;
      return null;
    }).filter(Boolean);
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
    const positiveWords = ['love', 'amazing', 'great', 'awesome', 'fantastic', 'excellent', 'wonderful', 'perfect'];
    const negativeWords = ['hate', 'terrible', 'awful', 'worst', 'horrible', 'bad', 'disappointing', 'angry'];
    
    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    });
    
    return Math.max(-1, Math.min(1, score));
  }

  private analyzeSentimentSync(text: string): number {
    const positiveWords = ['love', 'amazing', 'great', 'awesome', 'fantastic', 'excellent', 'wonderful', 'perfect'];
    const negativeWords = ['hate', 'terrible', 'awful', 'worst', 'horrible', 'bad', 'disappointing', 'angry'];
    
    const words = text.toLowerCase().split(/\s+/);
    let score = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) score += 0.1;
      if (negativeWords.includes(word)) score -= 0.1;
    });
    
    return Math.max(-1, Math.min(1, score));
  }

  /**
   * Get Facebook-specific insights
   */
  getPlatformInsights(metrics: AnalyticsMetrics): string[] {
    const insights = super.getPlatformInsights(metrics);

    // Facebook-specific insights
    if (metrics.reach > 0 && metrics.followers > 0) {
      const organicReach = (metrics.reach / metrics.followers) * 100;
      if (organicReach > 30) {
        insights.push('Excellent organic reach - Facebook algorithm is favoring your content');
      } else if (organicReach < 5) {
        insights.push('Low organic reach - consider boosting posts or improving engagement');
      }
    }

    if (metrics.profile_views && metrics.profile_views > 0) {
      insights.push('Getting profile views - optimize your page info and call-to-action button');
    }

    return insights;
  }
}

export default FacebookAnalytics;