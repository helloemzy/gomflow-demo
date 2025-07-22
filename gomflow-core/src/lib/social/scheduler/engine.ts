/**
 * Social Media Scheduling Engine
 * Handles queue-based scheduling, optimal timing, and automatic posting
 */

import { createClient } from '@/lib/supabase/server';
import { ContentGenerator, GeneratedContent } from '../content/generator';

export interface ScheduledPost {
  id: string;
  userId: string;
  templateId?: string;
  socialAccountId: string;
  contentData: GeneratedContent;
  mediaFiles: MediaFile[];
  scheduledFor: Date;
  optimalTime?: Date;
  priority: number;
  status: 'scheduled' | 'processing' | 'posted' | 'failed' | 'cancelled';
  retryCount: number;
  maxRetries: number;
  postedAt?: Date;
  platformPostId?: string;
  errorMessage?: string;
  engagementPrediction?: EngagementMetrics;
  actualEngagement?: EngagementMetrics;
  crossPostGroupId?: string;
}

export interface MediaFile {
  id: string;
  fileName: string;
  fileUrl: string;
  thumbnailUrl?: string;
  mimeType: string;
  altText?: string;
  platformVersions?: Record<string, string>;
}

export interface EngagementMetrics {
  likes: number;
  shares: number;
  comments: number;
  reach: number;
  impressions?: number;
  saves?: number;
  clicks?: number;
}

export interface SchedulingOptions {
  useOptimalTiming: boolean;
  allowWeekends: boolean;
  timeZone: string;
  minHoursBetweenPosts: number;
  maxPostsPerDay: number;
  quietHours: { start: number; end: number }; // 24-hour format
}

export interface BulkScheduleRequest {
  posts: Array<{
    templateId?: string;
    customContent?: string;
    variables: Record<string, any>;
    socialAccountIds: string[];
    mediaFiles?: MediaFile[];
    scheduledFor?: Date;
    campaignId?: string;
  }>;
  options: SchedulingOptions;
  crossPost: boolean;
}

export interface OptimalTimeRecommendation {
  suggestedTime: Date;
  confidenceScore: number;
  reasoning: string;
  alternativeTimes: Date[];
  expectedEngagement: EngagementMetrics;
}

export class SchedulingEngine {
  private supabase;
  private contentGenerator;

  constructor() {
    this.supabase = createClient();
    this.contentGenerator = new ContentGenerator();
  }

  /**
   * Schedule a single post
   */
  async schedulePost(request: {
    userId: string;
    templateId?: string;
    customContent?: string;
    variables: Record<string, any>;
    socialAccountId: string;
    mediaFiles?: MediaFile[];
    scheduledFor?: Date;
    priority?: number;
    campaignId?: string;
    useOptimalTiming?: boolean;
  }): Promise<ScheduledPost> {
    // Get social account details
    const account = await this.getSocialAccount(request.socialAccountId);
    if (!account) {
      throw new Error('Social account not found');
    }

    // Generate content
    const contentData = await this.contentGenerator.generateContent({
      templateId: request.templateId,
      customTemplate: request.customContent,
      variables: request.variables,
      platformId: account.platformId,
      mediaFiles: request.mediaFiles,
      campaignId: request.campaignId,
    });

    // Determine optimal scheduling time
    let scheduledTime = request.scheduledFor || new Date();
    let optimalTime: Date | undefined;

    if (request.useOptimalTiming || !request.scheduledFor) {
      const recommendation = await this.getOptimalTime(
        request.socialAccountId,
        scheduledTime
      );
      optimalTime = recommendation.suggestedTime;
      
      if (!request.scheduledFor) {
        scheduledTime = optimalTime;
      }
    }

    // Create scheduled post
    const { data, error } = await this.supabase
      .from('content_queue')
      .insert({
        user_id: request.userId,
        template_id: request.templateId,
        social_account_id: request.socialAccountId,
        content_data: contentData,
        media_files: request.mediaFiles || [],
        scheduled_for: scheduledTime.toISOString(),
        optimal_time: optimalTime?.toISOString(),
        priority: request.priority || 0,
        status: 'scheduled',
        engagement_prediction: contentData.estimatedEngagement,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to schedule post: ${error.message}`);
    }

    return this.mapToScheduledPost(data);
  }

  /**
   * Schedule multiple posts with bulk operations
   */
  async scheduleBulkPosts(request: BulkScheduleRequest): Promise<ScheduledPost[]> {
    const scheduledPosts: ScheduledPost[] = [];
    const crossPostGroupId = request.crossPost ? crypto.randomUUID() : undefined;

    for (const post of request.posts) {
      const accountPosts: ScheduledPost[] = [];

      for (const accountId of post.socialAccountIds) {
        const account = await this.getSocialAccount(accountId);
        if (!account) continue;

        // Stagger posts if multiple accounts for same platform
        const baseTime = post.scheduledFor || new Date();
        const staggeredTime = await this.calculateStaggeredTime(
          baseTime,
          accountId,
          request.options
        );

        try {
          const scheduledPost = await this.schedulePost({
            userId: account.userId,
            templateId: post.templateId,
            customContent: post.customContent,
            variables: post.variables,
            socialAccountId: accountId,
            mediaFiles: post.mediaFiles,
            scheduledFor: staggeredTime,
            campaignId: post.campaignId,
            useOptimalTiming: request.options.useOptimalTiming,
          });

          // Update with cross-post group ID if needed
          if (crossPostGroupId) {
            await this.updateCrossPostGroup(scheduledPost.id, crossPostGroupId);
            scheduledPost.crossPostGroupId = crossPostGroupId;
          }

          accountPosts.push(scheduledPost);
        } catch (error) {
          console.error(`Failed to schedule post for account ${accountId}:`, error);
        }
      }

      scheduledPosts.push(...accountPosts);
    }

    return scheduledPosts;
  }

  /**
   * Get optimal posting time recommendation
   */
  async getOptimalTime(
    socialAccountId: string,
    targetDate?: Date
  ): Promise<OptimalTimeRecommendation> {
    const baseDate = targetDate || new Date();
    
    // Get account's historical performance data
    const performanceData = await this.getAccountPerformanceData(socialAccountId);
    
    // Get posting schedule for this account
    const { data: schedule } = await this.supabase
      .from('posting_schedules')
      .select('*')
      .eq('social_account_id', socialAccountId)
      .eq('day_of_week', baseDate.getDay())
      .single();

    let optimalHours = [9, 12, 15, 18]; // Default optimal hours
    let timezone = 'UTC';

    if (schedule) {
      optimalHours = schedule.optimal_hours || optimalHours;
      timezone = schedule.audience_timezone || timezone;
    }

    // Calculate optimal time based on performance data and schedule
    const suggestedTime = this.calculateOptimalTime(
      baseDate,
      optimalHours,
      performanceData,
      timezone
    );

    // Generate alternative times
    const alternativeTimes = this.generateAlternativeTimes(
      suggestedTime,
      optimalHours,
      timezone
    );

    // Predict engagement for suggested time
    const expectedEngagement = await this.predictEngagementForTime(
      socialAccountId,
      suggestedTime
    );

    return {
      suggestedTime,
      confidenceScore: this.calculateConfidenceScore(performanceData),
      reasoning: this.generateRecommendationReasoning(suggestedTime, performanceData),
      alternativeTimes,
      expectedEngagement,
    };
  }

  /**
   * Process scheduled posts (called by cron job)
   */
  async processScheduledPosts(): Promise<void> {
    console.log('Processing scheduled posts...');

    // Get posts ready for publishing
    const { data: posts, error } = await this.supabase
      .from('content_queue')
      .select(`
        *,
        social_accounts (
          id,
          platform_id,
          platform_user_id,
          user_id
        )
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_for', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('scheduled_for', { ascending: true })
      .limit(50); // Process in batches

    if (error || !posts?.length) {
      console.log('No posts to process');
      return;
    }

    console.log(`Processing ${posts.length} scheduled posts`);

    for (const post of posts) {
      try {
        await this.publishPost(post);
      } catch (error) {
        console.error(`Failed to publish post ${post.id}:`, error);
        await this.handlePostError(post.id, error as Error);
      }
    }
  }

  /**
   * Publish a post to the social media platform
   */
  private async publishPost(post: any): Promise<void> {
    // Mark as processing
    await this.updatePostStatus(post.id, 'processing');

    const account = post.social_accounts;
    const platformId = account.platform_id;
    
    // Get platform-specific posting service
    const postingService = await this.getPostingService(platformId);
    
    // Get valid access token
    const accessToken = await this.getValidAccessToken(account.id);
    
    try {
      // Publish to platform
      const result = await postingService.publishPost(
        accessToken,
        post.content_data,
        post.media_files
      );

      // Update post status
      await this.supabase
        .from('content_queue')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          platform_post_id: result.postId,
          retry_count: 0,
        })
        .eq('id', post.id);

      // Record in social_posts table
      await this.recordPublishedPost(post, result);

      // Start engagement tracking
      await this.scheduleEngagementTracking(post.id, result.postId, platformId);

      console.log(`Successfully published post ${post.id} to ${platformId}`);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle post publishing errors with retry logic
   */
  private async handlePostError(postId: string, error: Error): Promise<void> {
    const { data: post } = await this.supabase
      .from('content_queue')
      .select('retry_count, max_retries')
      .eq('id', postId)
      .single();

    if (!post) return;

    const newRetryCount = post.retry_count + 1;

    if (newRetryCount <= post.max_retries) {
      // Schedule retry with exponential backoff
      const retryDelay = Math.pow(2, newRetryCount) * 60 * 1000; // Minutes in milliseconds
      const retryTime = new Date(Date.now() + retryDelay);

      await this.supabase
        .from('content_queue')
        .update({
          status: 'scheduled',
          retry_count: newRetryCount,
          scheduled_for: retryTime.toISOString(),
          error_message: error.message,
        })
        .eq('id', postId);

      console.log(`Scheduled retry ${newRetryCount} for post ${postId} at ${retryTime}`);
    } else {
      // Mark as failed
      await this.supabase
        .from('content_queue')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', postId);

      console.error(`Post ${postId} failed after ${post.max_retries} retries: ${error.message}`);
    }
  }

  /**
   * Cancel scheduled post
   */
  async cancelPost(postId: string): Promise<void> {
    await this.updatePostStatus(postId, 'cancelled');
  }

  /**
   * Reschedule post to new time
   */
  async reschedulePost(postId: string, newTime: Date): Promise<void> {
    await this.supabase
      .from('content_queue')
      .update({
        scheduled_for: newTime.toISOString(),
        status: 'scheduled',
        retry_count: 0,
        error_message: null,
      })
      .eq('id', postId)
      .eq('status', 'scheduled'); // Only reschedule if not already processed
  }

  /**
   * Get user's scheduled posts
   */
  async getUserScheduledPosts(
    userId: string,
    filters: {
      status?: string;
      platformId?: string;
      campaignId?: string;
      dateRange?: { start: Date; end: Date };
    } = {}
  ): Promise<ScheduledPost[]> {
    let query = this.supabase
      .from('content_queue')
      .select(`
        *,
        social_accounts (
          id,
          platform_id,
          username,
          display_name
        ),
        content_templates (
          id,
          name
        )
      `)
      .eq('user_id', userId)
      .order('scheduled_for', { ascending: true });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.platformId) {
      query = query.eq('social_accounts.platform_id', filters.platformId);
    }

    if (filters.dateRange) {
      query = query
        .gte('scheduled_for', filters.dateRange.start.toISOString())
        .lte('scheduled_for', filters.dateRange.end.toISOString());
    }

    const { data, error } = await query;

    if (error || !data) {
      return [];
    }

    return data.map(post => this.mapToScheduledPost(post));
  }

  /**
   * Get scheduling analytics
   */
  async getSchedulingAnalytics(userId: string, timeRange: {
    start: Date;
    end: Date;
  }): Promise<{
    totalScheduled: number;
    totalPosted: number;
    totalFailed: number;
    successRate: number;
    avgEngagementRate: number;
    topPerformingTimes: Array<{ hour: number; avgEngagement: number }>;
    platformBreakdown: Record<string, number>;
  }> {
    const { data: posts } = await this.supabase
      .from('content_queue')
      .select(`
        *,
        social_accounts (platform_id),
        content_analytics (metric_type, metric_value)
      `)
      .eq('user_id', userId)
      .gte('scheduled_for', timeRange.start.toISOString())
      .lte('scheduled_for', timeRange.end.toISOString());

    if (!posts) {
      return {
        totalScheduled: 0,
        totalPosted: 0,
        totalFailed: 0,
        successRate: 0,
        avgEngagementRate: 0,
        topPerformingTimes: [],
        platformBreakdown: {},
      };
    }

    const totalScheduled = posts.length;
    const totalPosted = posts.filter(p => p.status === 'posted').length;
    const totalFailed = posts.filter(p => p.status === 'failed').length;
    const successRate = totalScheduled > 0 ? (totalPosted / totalScheduled) * 100 : 0;

    // Calculate engagement metrics
    const engagementData = this.calculateEngagementAnalytics(posts);
    
    // Calculate platform breakdown
    const platformBreakdown: Record<string, number> = {};
    posts.forEach(post => {
      const platform = post.social_accounts.platform_id;
      platformBreakdown[platform] = (platformBreakdown[platform] || 0) + 1;
    });

    return {
      totalScheduled,
      totalPosted,
      totalFailed,
      successRate,
      avgEngagementRate: engagementData.avgEngagementRate,
      topPerformingTimes: engagementData.topPerformingTimes,
      platformBreakdown,
    };
  }

  // Helper methods

  private async getSocialAccount(accountId: string) {
    const { data } = await this.supabase
      .from('social_accounts')
      .select('*')
      .eq('id', accountId)
      .single();
    return data;
  }

  private async updatePostStatus(postId: string, status: string): Promise<void> {
    await this.supabase
      .from('content_queue')
      .update({ status })
      .eq('id', postId);
  }

  private async updateCrossPostGroup(postId: string, groupId: string): Promise<void> {
    await this.supabase
      .from('content_queue')
      .update({ cross_post_group_id: groupId })
      .eq('id', postId);
  }

  private async calculateStaggeredTime(
    baseTime: Date,
    accountId: string,
    options: SchedulingOptions
  ): Promise<Date> {
    // Add random offset to avoid posting at exact same time
    const offsetMinutes = Math.floor(Math.random() * options.minHoursBetweenPosts * 60);
    return new Date(baseTime.getTime() + offsetMinutes * 60 * 1000);
  }

  private async getAccountPerformanceData(accountId: string) {
    const { data } = await this.supabase
      .from('content_analytics')
      .select('*')
      .eq('social_account_id', accountId)
      .gte('metric_timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

    return data || [];
  }

  private calculateOptimalTime(
    baseDate: Date,
    optimalHours: number[],
    performanceData: any[],
    timezone: string
  ): Date {
    // Simple implementation - pick the hour with best historical performance
    const hourPerformance = new Map<number, number>();
    
    performanceData.forEach(metric => {
      const hour = new Date(metric.metric_timestamp).getHours();
      const current = hourPerformance.get(hour) || 0;
      hourPerformance.set(hour, current + metric.metric_value);
    });

    // Find best performing hour from optimal hours
    let bestHour = optimalHours[0];
    let bestPerformance = hourPerformance.get(bestHour) || 0;

    optimalHours.forEach(hour => {
      const performance = hourPerformance.get(hour) || 0;
      if (performance > bestPerformance) {
        bestHour = hour;
        bestPerformance = performance;
      }
    });

    const optimalTime = new Date(baseDate);
    optimalTime.setHours(bestHour, 0, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (optimalTime <= new Date()) {
      optimalTime.setDate(optimalTime.getDate() + 1);
    }

    return optimalTime;
  }

  private generateAlternativeTimes(
    suggestedTime: Date,
    optimalHours: number[],
    timezone: string
  ): Date[] {
    const alternatives: Date[] = [];
    
    optimalHours.forEach(hour => {
      if (hour !== suggestedTime.getHours()) {
        const altTime = new Date(suggestedTime);
        altTime.setHours(hour, 0, 0, 0);
        alternatives.push(altTime);
      }
    });

    return alternatives.slice(0, 3); // Return top 3 alternatives
  }

  private async predictEngagementForTime(
    accountId: string,
    time: Date
  ): Promise<EngagementMetrics> {
    // Simplified prediction based on historical hour performance
    const hour = time.getHours();
    const { data } = await this.supabase
      .from('content_analytics')
      .select('metric_type, metric_value')
      .eq('social_account_id', accountId)
      .gte('metric_timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    // Calculate average metrics for this hour
    const hourlyMetrics = (data || []).filter(metric => 
      new Date(metric.metric_timestamp).getHours() === hour
    );

    const avgMetrics = {
      likes: 0,
      shares: 0,
      comments: 0,
      reach: 0,
    };

    if (hourlyMetrics.length > 0) {
      const grouped = hourlyMetrics.reduce((acc, metric) => {
        acc[metric.metric_type] = (acc[metric.metric_type] || []);
        acc[metric.metric_type].push(metric.metric_value);
        return acc;
      }, {} as Record<string, number[]>);

      Object.keys(avgMetrics).forEach(key => {
        const values = grouped[key] || [];
        avgMetrics[key as keyof typeof avgMetrics] = values.length > 0 
          ? Math.round(values.reduce((sum, val) => sum + val, 0) / values.length)
          : avgMetrics[key as keyof typeof avgMetrics];
      });
    }

    return avgMetrics;
  }

  private calculateConfidenceScore(performanceData: any[]): number {
    // Confidence based on amount of historical data
    const dataPoints = performanceData.length;
    if (dataPoints === 0) return 0.3;
    if (dataPoints < 10) return 0.5;
    if (dataPoints < 50) return 0.7;
    return 0.9;
  }

  private generateRecommendationReasoning(time: Date, performanceData: any[]): string {
    const hour = time.getHours();
    const dayOfWeek = time.toLocaleDateString('en-US', { weekday: 'long' });
    
    if (performanceData.length === 0) {
      return `Scheduled for ${hour}:00 on ${dayOfWeek} based on general best practices.`;
    }

    return `Scheduled for ${hour}:00 on ${dayOfWeek} based on your historical engagement data.`;
  }

  private async getPostingService(platformId: string) {
    // This would return platform-specific posting services
    // Implementation depends on the platform services we create next
    const { PostingServiceFactory } = await import('../posting/services/factory');
    return PostingServiceFactory.getService(platformId);
  }

  private async getValidAccessToken(accountId: string): Promise<string> {
    const { data } = await this.supabase
      .from('social_tokens')
      .select('encrypted_token')
      .eq('social_account_id', accountId)
      .eq('token_type', 'access_token')
      .eq('is_revoked', false)
      .single();

    if (!data) {
      throw new Error('No valid access token found');
    }

    // Decrypt token (implementation depends on your encryption setup)
    return this.decryptToken(data.encrypted_token);
  }

  private async decryptToken(encryptedToken: string): Promise<string> {
    // Implementation depends on your token encryption setup
    // This is a placeholder
    return encryptedToken;
  }

  private async recordPublishedPost(post: any, result: { postId: string; url?: string }): Promise<void> {
    await this.supabase
      .from('social_posts')
      .insert({
        social_account_id: post.social_account_id,
        platform_post_id: result.postId,
        content: post.content_data.text,
        media_urls: post.media_files.map((f: MediaFile) => f.fileUrl),
        hashtags: post.content_data.hashtags,
        mentions: post.content_data.mentions,
        post_type: post.media_files?.length > 0 ? 'image' : 'text',
        post_url: result.url,
        published_at: new Date().toISOString(),
      });
  }

  private async scheduleEngagementTracking(postId: string, platformPostId: string, platformId: string): Promise<void> {
    // Schedule engagement tracking for later
    // This would typically use a job queue or cron job
    console.log(`Scheduled engagement tracking for post ${postId} on ${platformId}`);
  }

  private calculateEngagementAnalytics(posts: any[]) {
    // Simplified engagement calculations
    let totalEngagement = 0;
    let totalReach = 0;
    const hourlyPerformance = new Map<number, number>();

    posts.forEach(post => {
      if (post.actual_engagement) {
        const engagement = Object.values(post.actual_engagement).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
        totalEngagement += engagement;
        totalReach += post.actual_engagement.reach || 0;

        const hour = new Date(post.posted_at || post.scheduled_for).getHours();
        hourlyPerformance.set(hour, (hourlyPerformance.get(hour) || 0) + engagement);
      }
    });

    const avgEngagementRate = totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0;
    
    const topPerformingTimes = Array.from(hourlyPerformance.entries())
      .map(([hour, engagement]) => ({ hour, avgEngagement: engagement }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 5);

    return { avgEngagementRate, topPerformingTimes };
  }

  private mapToScheduledPost(data: any): ScheduledPost {
    return {
      id: data.id,
      userId: data.user_id,
      templateId: data.template_id,
      socialAccountId: data.social_account_id,
      contentData: data.content_data,
      mediaFiles: data.media_files || [],
      scheduledFor: new Date(data.scheduled_for),
      optimalTime: data.optimal_time ? new Date(data.optimal_time) : undefined,
      priority: data.priority,
      status: data.status,
      retryCount: data.retry_count,
      maxRetries: data.max_retries,
      postedAt: data.posted_at ? new Date(data.posted_at) : undefined,
      platformPostId: data.platform_post_id,
      errorMessage: data.error_message,
      engagementPrediction: data.engagement_prediction,
      actualEngagement: data.actual_engagement,
      crossPostGroupId: data.cross_post_group_id,
    };
  }
}

export default SchedulingEngine;