// GOMFLOW Social Media Analytics Collection Engine
// Centralized system for collecting and processing social media analytics

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

type AnalyticsEvent = {
  platform: string;
  account_id: string;
  event_type: 'post' | 'engagement' | 'audience' | 'conversion';
  data: Record<string, any>;
  timestamp?: Date;
};

type PlatformAnalytics = {
  platform_name: string;
  account_data: any;
  posts: any[];
  engagement_metrics: any[];
  audience_data: any;
  performance_scores: any[];
};

export class SocialAnalyticsCollector {
  private supabase;
  private cache = new Map<string, any>();
  private batchQueue: AnalyticsEvent[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 50;
  private readonly BATCH_DELAY = 5000; // 5 seconds

  constructor() {
    this.supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Collect analytics from a specific platform
   */
  async collectPlatformAnalytics(
    platformName: string,
    accountId: string,
    options: {
      includePosts?: boolean;
      includeEngagement?: boolean;
      includeAudience?: boolean;
      dateRange?: { start: Date; end: Date };
    } = {}
  ): Promise<PlatformAnalytics | null> {
    try {
      const {
        includePosts = true,
        includeEngagement = true,
        includeAudience = true,
        dateRange
      } = options;

      // Get account information
      const { data: account } = await this.supabase
        .from('social_accounts')
        .select(`
          *,
          social_platforms(name, display_name, api_version)
        `)
        .eq('id', accountId)
        .single();

      if (!account) {
        throw new Error(`Social account not found: ${accountId}`);
      }

      const analytics: PlatformAnalytics = {
        platform_name: platformName,
        account_data: account,
        posts: [],
        engagement_metrics: [],
        audience_data: null,
        performance_scores: []
      };

      // Collect posts data
      if (includePosts) {
        let postsQuery = this.supabase
          .from('social_posts')
          .select(`
            *,
            content_performance(*)
          `)
          .eq('account_id', accountId)
          .order('posted_at', { ascending: false });

        if (dateRange) {
          postsQuery = postsQuery
            .gte('posted_at', dateRange.start.toISOString())
            .lte('posted_at', dateRange.end.toISOString());
        }

        const { data: posts } = await postsQuery;
        analytics.posts = posts || [];
      }

      // Collect engagement metrics
      if (includeEngagement && analytics.posts.length > 0) {
        const postIds = analytics.posts.map(post => post.id);
        const { data: engagement } = await this.supabase
          .from('engagement_metrics')
          .select('*')
          .in('post_id', postIds)
          .order('occurred_at', { ascending: false });

        analytics.engagement_metrics = engagement || [];
      }

      // Collect audience data
      if (includeAudience) {
        let audienceQuery = this.supabase
          .from('audience_analytics')
          .select('*')
          .eq('account_id', accountId)
          .order('date', { ascending: false })
          .limit(30); // Last 30 days

        if (dateRange) {
          audienceQuery = audienceQuery
            .gte('date', dateRange.start.toISOString().split('T')[0])
            .lte('date', dateRange.end.toISOString().split('T')[0]);
        }

        const { data: audience } = await audienceQuery;
        analytics.audience_data = audience || [];
      }

      // Cache the results
      const cacheKey = `analytics_${platformName}_${accountId}_${JSON.stringify(options)}`;
      this.cache.set(cacheKey, analytics);

      return analytics;
    } catch (error) {
      console.error('Error collecting platform analytics:', error);
      return null;
    }
  }

  /**
   * Process analytics event in real-time
   */
  async processAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
    try {
      // Add to batch queue
      this.batchQueue.push({
        ...event,
        timestamp: event.timestamp || new Date()
      });

      // Process batch if size limit reached
      if (this.batchQueue.length >= this.BATCH_SIZE) {
        await this.processBatch();
      } else {
        // Set timeout for batch processing
        if (this.batchTimeout) {
          clearTimeout(this.batchTimeout);
        }
        this.batchTimeout = setTimeout(() => {
          this.processBatch();
        }, this.BATCH_DELAY);
      }
    } catch (error) {
      console.error('Error processing analytics event:', error);
    }
  }

  /**
   * Process batch of analytics events
   */
  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    try {
      const events = [...this.batchQueue];
      this.batchQueue = [];

      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }

      // Group events by type
      const postEvents = events.filter(e => e.event_type === 'post');
      const engagementEvents = events.filter(e => e.event_type === 'engagement');
      const audienceEvents = events.filter(e => e.event_type === 'audience');
      const conversionEvents = events.filter(e => e.event_type === 'conversion');

      // Process each type of event
      await Promise.all([
        this.processPostEvents(postEvents),
        this.processEngagementEvents(engagementEvents),
        this.processAudienceEvents(audienceEvents),
        this.processConversionEvents(conversionEvents)
      ]);

      console.log(`Processed batch of ${events.length} analytics events`);
    } catch (error) {
      console.error('Error processing analytics batch:', error);
      // Re-queue failed events
      this.batchQueue.unshift(...this.batchQueue);
    }
  }

  /**
   * Process post analytics events
   */
  private async processPostEvents(events: AnalyticsEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
      const postsToUpsert = events.map(event => ({
        account_id: event.account_id,
        platform_post_id: event.data.platform_post_id,
        post_type: event.data.post_type || 'text',
        content: event.data.content,
        media_urls: event.data.media_urls || [],
        hashtags: event.data.hashtags || [],
        mentions: event.data.mentions || [],
        reach: event.data.reach || 0,
        impressions: event.data.impressions || 0,
        likes_count: event.data.likes_count || 0,
        comments_count: event.data.comments_count || 0,
        shares_count: event.data.shares_count || 0,
        saves_count: event.data.saves_count || 0,
        clicks_count: event.data.clicks_count || 0,
        video_views: event.data.video_views || 0,
        posted_at: event.data.posted_at || event.timestamp?.toISOString(),
        analyzed_at: new Date().toISOString()
      }));

      await this.supabase
        .from('social_posts')
        .upsert(postsToUpsert, {
          onConflict: 'account_id,platform_post_id'
        });
    } catch (error) {
      console.error('Error processing post events:', error);
    }
  }

  /**
   * Process engagement analytics events
   */
  private async processEngagementEvents(events: AnalyticsEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
      const engagementToInsert = events.map(event => ({
        post_id: event.data.post_id,
        metric_type: event.data.metric_type,
        user_id: event.data.user_id,
        username: event.data.username,
        engagement_value: event.data.engagement_value || 1,
        sentiment_score: event.data.sentiment_score,
        content: event.data.content,
        metadata: event.data.metadata || {},
        occurred_at: event.data.occurred_at || event.timestamp?.toISOString()
      }));

      await this.supabase
        .from('engagement_metrics')
        .insert(engagementToInsert);
    } catch (error) {
      console.error('Error processing engagement events:', error);
    }
  }

  /**
   * Process audience analytics events
   */
  private async processAudienceEvents(events: AnalyticsEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
      const audienceToUpsert = events.map(event => ({
        account_id: event.account_id,
        date: event.data.date || new Date().toISOString().split('T')[0],
        total_followers: event.data.total_followers || 0,
        new_followers: event.data.new_followers || 0,
        unfollowers: event.data.unfollowers || 0,
        net_follower_change: event.data.net_follower_change || 0,
        demographics: event.data.demographics || {},
        interests: event.data.interests || {},
        active_hours: event.data.active_hours || {},
        engagement_rate: event.data.engagement_rate || 0,
        reach_rate: event.data.reach_rate || 0
      }));

      await this.supabase
        .from('audience_analytics')
        .upsert(audienceToUpsert, {
          onConflict: 'account_id,date'
        });
    } catch (error) {
      console.error('Error processing audience events:', error);
    }
  }

  /**
   * Process conversion analytics events
   */
  private async processConversionEvents(events: AnalyticsEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
      const conversionsToInsert = events.map(event => ({
        post_id: event.data.post_id,
        campaign_id: event.data.campaign_id,
        order_id: event.data.order_id,
        submission_id: event.data.submission_id,
        conversion_type: event.data.conversion_type,
        user_id: event.data.user_id,
        session_id: event.data.session_id,
        referrer_url: event.data.referrer_url,
        utm_source: event.data.utm_source,
        utm_medium: event.data.utm_medium,
        utm_campaign: event.data.utm_campaign,
        utm_content: event.data.utm_content,
        conversion_value: event.data.conversion_value,
        metadata: event.data.metadata || {},
        occurred_at: event.data.occurred_at || event.timestamp?.toISOString()
      }));

      await this.supabase
        .from('social_conversions')
        .insert(conversionsToInsert);
    } catch (error) {
      console.error('Error processing conversion events:', error);
    }
  }

  /**
   * Get cached analytics data
   */
  getCachedAnalytics(cacheKey: string): any | null {
    return this.cache.get(cacheKey) || null;
  }

  /**
   * Clear analytics cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get analytics summary for an account
   */
  async getAnalyticsSummary(
    accountId: string,
    dateRange: { start: Date; end: Date }
  ): Promise<any> {
    try {
      const { data } = await this.supabase
        .rpc('get_platform_analytics_summary', {
          account_id_param: accountId,
          start_date: dateRange.start.toISOString().split('T')[0],
          end_date: dateRange.end.toISOString().split('T')[0]
        });

      return data;
    } catch (error) {
      console.error('Error getting analytics summary:', error);
      return null;
    }
  }

  /**
   * Track conversion from social media to order
   */
  async trackConversion(data: {
    postId?: string;
    campaignId?: string;
    orderId?: string;
    submissionId?: string;
    conversionType: 'view' | 'click' | 'sign_up' | 'order' | 'payment';
    userId?: string;
    sessionId?: string;
    referrerUrl?: string;
    utmParams?: {
      source?: string;
      medium?: string;
      campaign?: string;
      content?: string;
    };
    conversionValue?: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.processAnalyticsEvent({
      platform: 'conversion',
      account_id: '',
      event_type: 'conversion',
      data: {
        post_id: data.postId,
        campaign_id: data.campaignId,
        order_id: data.orderId,
        submission_id: data.submissionId,
        conversion_type: data.conversionType,
        user_id: data.userId,
        session_id: data.sessionId,
        referrer_url: data.referrerUrl,
        utm_source: data.utmParams?.source,
        utm_medium: data.utmParams?.medium,
        utm_campaign: data.utmParams?.campaign,
        utm_content: data.utmParams?.content,
        conversion_value: data.conversionValue,
        metadata: data.metadata || {}
      }
    });
  }

  /**
   * Get real-time analytics metrics
   */
  async getRealTimeMetrics(accountId: string): Promise<any> {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get recent posts and their performance
      const { data: recentPosts } = await this.supabase
        .from('social_posts')
        .select(`
          *,
          engagement_metrics(
            metric_type,
            engagement_value,
            occurred_at
          )
        `)
        .eq('account_id', accountId)
        .gte('posted_at', oneDayAgo.toISOString())
        .order('posted_at', { ascending: false });

      // Calculate real-time metrics
      const metrics = {
        posts_today: recentPosts?.length || 0,
        total_engagement_today: 0,
        trending_posts: [],
        engagement_velocity: 0,
        active_conversations: 0
      };

      if (recentPosts) {
        // Calculate total engagement
        metrics.total_engagement_today = recentPosts.reduce((total, post) => {
          return total + (post.likes_count || 0) + (post.comments_count || 0) + 
                 (post.shares_count || 0) + (post.saves_count || 0);
        }, 0);

        // Find trending posts (high engagement in short time)
        metrics.trending_posts = recentPosts
          .filter(post => {
            const hoursSincePost = (now.getTime() - new Date(post.posted_at).getTime()) / (1000 * 60 * 60);
            const engagementRate = post.engagement_score || 0;
            return hoursSincePost <= 6 && engagementRate > 5; // Posted within 6 hours and high engagement
          })
          .slice(0, 5);

        // Calculate engagement velocity (engagements per hour)
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const recentEngagements = recentPosts.reduce((total, post) => {
          if (post.engagement_metrics) {
            return total + post.engagement_metrics.filter((e: any) => 
              new Date(e.occurred_at) >= oneHourAgo
            ).length;
          }
          return total;
        }, 0);
        metrics.engagement_velocity = recentEngagements;

        // Count active conversations (posts with recent comments)
        metrics.active_conversations = recentPosts.filter(post => {
          if (post.engagement_metrics) {
            return post.engagement_metrics.some((e: any) => 
              e.metric_type === 'comment' && new Date(e.occurred_at) >= oneHourAgo
            );
          }
          return false;
        }).length;
      }

      return metrics;
    } catch (error) {
      console.error('Error getting real-time metrics:', error);
      return null;
    }
  }

  /**
   * Cleanup old analytics data
   */
  async cleanup(retentionDays: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Clean up old engagement metrics
      await this.supabase
        .from('engagement_metrics')
        .delete()
        .lt('occurred_at', cutoffDate.toISOString());

      // Clean up expired cache
      await this.supabase
        .rpc('cleanup_expired_cache');

      console.log(`Cleaned up analytics data older than ${retentionDays} days`);
    } catch (error) {
      console.error('Error cleaning up analytics data:', error);
    }
  }
}

// Singleton instance
export const analyticsCollector = new SocialAnalyticsCollector();