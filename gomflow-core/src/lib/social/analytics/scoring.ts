// GOMFLOW Social Media Performance Scoring Engine
// Advanced scoring and optimization insights for social media content

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { PlatformAnalyticsFactory, SupportedPlatform } from './platforms';

interface PerformanceScore {
  overall_score: number;
  engagement_score: number;
  reach_score: number;
  conversion_score: number;
  viral_score: number;
  quality_score: number;
  timing_score: number;
  benchmark_score: number;
}

interface OptimizationInsight {
  category: 'engagement' | 'reach' | 'timing' | 'content' | 'hashtags' | 'conversion';
  priority: 'high' | 'medium' | 'low';
  insight: string;
  recommendation: string;
  potential_impact: number; // 1-100
  implementation_effort: 'low' | 'medium' | 'high';
}

interface BenchmarkData {
  industry_average: number;
  platform_average: number;
  account_tier_average: number;
  top_performers_average: number;
}

export class SocialPerformanceScorer {
  private supabase;

  constructor() {
    this.supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Calculate comprehensive performance score for a post
   */
  async calculatePostScore(postId: string): Promise<PerformanceScore | null> {
    try {
      // Get post data with metrics
      const { data: post } = await this.supabase
        .from('social_posts')
        .select(`
          *,
          social_accounts!inner(
            id,
            platform_id,
            follower_count,
            social_platforms(name)
          )
        `)
        .eq('id', postId)
        .single();

      if (!post) {
        throw new Error('Post not found');
      }

      const platform = post.social_accounts.social_platforms.name as SupportedPlatform;
      const followerCount = post.social_accounts.follower_count || 1;

      // Calculate individual scores
      const engagementScore = this.calculateEngagementScore(post, followerCount);
      const reachScore = this.calculateReachScore(post, followerCount);
      const conversionScore = await this.calculateConversionScore(postId);
      const viralScore = this.calculateViralScore(post, platform);
      const qualityScore = this.calculateQualityScore(post);
      const timingScore = await this.calculateTimingScore(post);
      const benchmarkScore = await this.calculateBenchmarkScore(post, platform);

      // Calculate overall score with weighted average
      const overallScore = this.calculateWeightedScore({
        engagement: engagementScore,
        reach: reachScore,
        conversion: conversionScore,
        viral: viralScore,
        quality: qualityScore,
        timing: timingScore,
        benchmark: benchmarkScore
      }, platform);

      const score: PerformanceScore = {
        overall_score: Math.round(overallScore),
        engagement_score: Math.round(engagementScore),
        reach_score: Math.round(reachScore),
        conversion_score: Math.round(conversionScore),
        viral_score: Math.round(viralScore),
        quality_score: Math.round(qualityScore),
        timing_score: Math.round(timingScore),
        benchmark_score: Math.round(benchmarkScore)
      };

      // Store the performance score
      await this.storePerformanceScore(postId, score);

      return score;
    } catch (error) {
      console.error('Error calculating post score:', error);
      return null;
    }
  }

  /**
   * Generate optimization insights for a post
   */
  async generateOptimizationInsights(postId: string): Promise<OptimizationInsight[]> {
    try {
      const score = await this.calculatePostScore(postId);
      if (!score) return [];

      const insights: OptimizationInsight[] = [];

      // Engagement insights
      if (score.engagement_score < 60) {
        insights.push({
          category: 'engagement',
          priority: 'high',
          insight: 'Low engagement rate compared to your audience size',
          recommendation: 'Try asking questions, using polls, or encouraging comments with call-to-action phrases',
          potential_impact: 85,
          implementation_effort: 'low'
        });
      }

      // Reach insights
      if (score.reach_score < 50) {
        insights.push({
          category: 'reach',
          priority: 'high',
          insight: 'Limited organic reach affecting content visibility',
          recommendation: 'Use trending hashtags, post at optimal times, or consider boosting high-performing content',
          potential_impact: 75,
          implementation_effort: 'medium'
        });
      }

      // Timing insights
      if (score.timing_score < 70) {
        insights.push({
          category: 'timing',
          priority: 'medium',
          insight: 'Posting time may not align with audience activity',
          recommendation: 'Analyze your audience insights to find peak activity hours and schedule posts accordingly',
          potential_impact: 60,
          implementation_effort: 'low'
        });
      }

      // Content quality insights
      if (score.quality_score < 65) {
        insights.push({
          category: 'content',
          priority: 'medium',
          insight: 'Content quality could be improved for better performance',
          recommendation: 'Focus on high-quality visuals, clear messaging, and valuable content for your audience',
          potential_impact: 70,
          implementation_effort: 'high'
        });
      }

      // Viral potential insights
      if (score.viral_score < 40) {
        insights.push({
          category: 'content',
          priority: 'low',
          insight: 'Content has low viral potential',
          recommendation: 'Experiment with trending formats, challenges, or shareable content types',
          potential_impact: 50,
          implementation_effort: 'medium'
        });
      }

      // Conversion insights
      if (score.conversion_score < 30) {
        insights.push({
          category: 'conversion',
          priority: 'medium',
          insight: 'Low conversion rate from social media to orders',
          recommendation: 'Include clear call-to-actions, product links, and compelling offers in your posts',
          potential_impact: 80,
          implementation_effort: 'medium'
        });
      }

      // Sort by priority and potential impact
      return insights.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return b.potential_impact - a.potential_impact;
      });
    } catch (error) {
      console.error('Error generating optimization insights:', error);
      return [];
    }
  }

  /**
   * Get performance benchmarks for comparison
   */
  async getBenchmarkData(platform: SupportedPlatform, followerRange: string): Promise<BenchmarkData> {
    try {
      // Query recent performance data for benchmarking
      const { data: benchmarkPosts } = await this.supabase
        .from('social_posts')
        .select(`
          engagement_score,
          reach,
          impressions,
          social_accounts!inner(
            follower_count,
            social_platforms!inner(name)
          )
        `)
        .eq('social_accounts.social_platforms.name', platform)
        .gte('posted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1000);

      if (!benchmarkPosts || benchmarkPosts.length === 0) {
        return {
          industry_average: 2.5,
          platform_average: 3.0,
          account_tier_average: 2.8,
          top_performers_average: 8.5
        };
      }

      // Calculate averages
      const allScores = benchmarkPosts.map(p => p.engagement_score || 0);
      const platformAverage = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;

      // Filter by follower range
      const tierPosts = benchmarkPosts.filter(p => {
        const followers = p.social_accounts.follower_count || 0;
        return this.getFollowerTier(followers) === followerRange;
      });
      const tierScores = tierPosts.map(p => p.engagement_score || 0);
      const tierAverage = tierScores.length > 0 
        ? tierScores.reduce((sum, score) => sum + score, 0) / tierScores.length 
        : platformAverage;

      // Top performers (top 10%)
      const sortedScores = [...allScores].sort((a, b) => b - a);
      const topPerformersCount = Math.ceil(sortedScores.length * 0.1);
      const topPerformersAverage = sortedScores.slice(0, topPerformersCount)
        .reduce((sum, score) => sum + score, 0) / topPerformersCount;

      return {
        industry_average: 2.5, // K-pop/merchandise industry baseline
        platform_average: platformAverage,
        account_tier_average: tierAverage,
        top_performers_average: topPerformersAverage
      };
    } catch (error) {
      console.error('Error getting benchmark data:', error);
      return {
        industry_average: 2.5,
        platform_average: 3.0,
        account_tier_average: 2.8,
        top_performers_average: 8.5
      };
    }
  }

  /**
   * Analyze hashtag performance
   */
  async analyzeHashtagPerformance(accountId: string, dateRange: { start: Date; end: Date }) {
    try {
      const { data: posts } = await this.supabase
        .from('social_posts')
        .select('id, hashtags, engagement_score, reach, likes_count, comments_count, shares_count')
        .eq('account_id', accountId)
        .gte('posted_at', dateRange.start.toISOString())
        .lte('posted_at', dateRange.end.toISOString());

      if (!posts) return {};

      const hashtagPerformance: Record<string, {
        usage_count: number;
        avg_engagement: number;
        avg_reach: number;
        total_likes: number;
        total_comments: number;
        total_shares: number;
      }> = {};

      posts.forEach(post => {
        const hashtags = post.hashtags || [];
        hashtags.forEach(hashtag => {
          if (!hashtagPerformance[hashtag]) {
            hashtagPerformance[hashtag] = {
              usage_count: 0,
              avg_engagement: 0,
              avg_reach: 0,
              total_likes: 0,
              total_comments: 0,
              total_shares: 0
            };
          }

          const perf = hashtagPerformance[hashtag];
          perf.usage_count++;
          perf.avg_engagement += post.engagement_score || 0;
          perf.avg_reach += post.reach || 0;
          perf.total_likes += post.likes_count || 0;
          perf.total_comments += post.comments_count || 0;
          perf.total_shares += post.shares_count || 0;
        });
      });

      // Calculate averages
      Object.keys(hashtagPerformance).forEach(hashtag => {
        const perf = hashtagPerformance[hashtag];
        perf.avg_engagement = perf.avg_engagement / perf.usage_count;
        perf.avg_reach = perf.avg_reach / perf.usage_count;
      });

      return hashtagPerformance;
    } catch (error) {
      console.error('Error analyzing hashtag performance:', error);
      return {};
    }
  }

  /**
   * Calculate engagement score (0-100)
   */
  private calculateEngagementScore(post: any, followerCount: number): number {
    const totalEngagement = (post.likes_count || 0) + (post.comments_count || 0) + 
                           (post.shares_count || 0) + (post.saves_count || 0);
    
    if (followerCount === 0) return 0;
    
    const engagementRate = (totalEngagement / followerCount) * 100;
    
    // Scale to 0-100 based on platform standards
    return Math.min(engagementRate * 10, 100);
  }

  /**
   * Calculate reach score (0-100)
   */
  private calculateReachScore(post: any, followerCount: number): number {
    const reach = post.reach || 0;
    
    if (followerCount === 0) return 0;
    
    const reachRate = (reach / followerCount) * 100;
    
    // Scale based on typical reach rates
    return Math.min(reachRate * 2, 100);
  }

  /**
   * Calculate conversion score (0-100)
   */
  private async calculateConversionScore(postId: string): Promise<number> {
    try {
      const { data: conversions } = await this.supabase
        .from('social_conversions')
        .select('conversion_type, conversion_value')
        .eq('post_id', postId);

      if (!conversions || conversions.length === 0) return 0;

      // Weight different conversion types
      const weights = {
        view: 1,
        click: 5,
        sign_up: 20,
        order: 50,
        payment: 100
      };

      const totalScore = conversions.reduce((sum, conv) => {
        const weight = weights[conv.conversion_type as keyof typeof weights] || 1;
        return sum + weight;
      }, 0);

      return Math.min(totalScore, 100);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate viral score (0-100)
   */
  private calculateViralScore(post: any, platform: SupportedPlatform): number {
    const shares = post.shares_count || 0;
    const likes = post.likes_count || 0;
    const comments = post.comments_count || 0;
    
    // Platform-specific viral indicators
    let viralMetric = 0;
    
    switch (platform) {
      case 'twitter':
        viralMetric = shares * 3 + comments * 2 + likes;
        break;
      case 'tiktok':
        viralMetric = shares * 5 + (post.video_views || 0) * 0.01;
        break;
      case 'instagram':
        viralMetric = (post.saves_count || 0) * 4 + shares * 3 + comments * 2;
        break;
      default:
        viralMetric = shares * 2 + comments + likes * 0.5;
    }
    
    // Scale based on follower count
    const followerCount = post.social_accounts?.follower_count || 1;
    const viralRate = (viralMetric / followerCount) * 100;
    
    return Math.min(viralRate * 5, 100);
  }

  /**
   * Calculate content quality score (0-100)
   */
  private calculateQualityScore(post: any): number {
    let score = 50; // Base score
    
    // Content length optimization
    const contentLength = (post.content || '').length;
    if (contentLength > 50 && contentLength < 200) {
      score += 15; // Optimal length
    } else if (contentLength < 20) {
      score -= 10; // Too short
    }
    
    // Media presence
    if (post.media_urls && post.media_urls.length > 0) {
      score += 20; // Visual content performs better
    }
    
    // Hashtag usage
    const hashtagCount = (post.hashtags || []).length;
    if (hashtagCount >= 3 && hashtagCount <= 10) {
      score += 10; // Optimal hashtag usage
    } else if (hashtagCount > 15) {
      score -= 5; // Too many hashtags
    }
    
    // Mention engagement
    if (post.mentions && post.mentions.length > 0) {
      score += 5; // Mentions can increase reach
    }
    
    // Sentiment score
    if (post.sentiment_score > 0.2) {
      score += 10; // Positive sentiment
    } else if (post.sentiment_score < -0.2) {
      score -= 10; // Negative sentiment
    }
    
    return Math.max(0, Math.min(score, 100));
  }

  /**
   * Calculate timing score (0-100)
   */
  private async calculateTimingScore(post: any): Promise<number> {
    try {
      const postDate = new Date(post.posted_at);
      const hour = postDate.getHours();
      const dayOfWeek = postDate.getDay();
      
      // Get audience active hours for comparison
      const { data: audienceData } = await this.supabase
        .from('audience_analytics')
        .select('active_hours')
        .eq('account_id', post.account_id)
        .order('date', { ascending: false })
        .limit(1)
        .single();

      const activeHours = audienceData?.active_hours || {};
      const activityLevel = activeHours[hour.toString()] || 0;
      
      let score = activityLevel * 2; // Base score from audience activity
      
      // Platform-specific optimal times
      if (hour >= 18 && hour <= 21) {
        score += 20; // Prime time across most platforms
      }
      
      // Weekday vs weekend
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        score += 10; // Weekdays generally perform better for business content
      }
      
      return Math.min(score, 100);
    } catch (error) {
      return 50; // Default score if data unavailable
    }
  }

  /**
   * Calculate benchmark score (0-100)
   */
  private async calculateBenchmarkScore(post: any, platform: SupportedPlatform): Promise<number> {
    const followerCount = post.social_accounts?.follower_count || 0;
    const followerTier = this.getFollowerTier(followerCount);
    
    const benchmarks = await this.getBenchmarkData(platform, followerTier);
    const postEngagement = post.engagement_score || 0;
    
    // Compare against tier average
    if (postEngagement >= benchmarks.top_performers_average) {
      return 100;
    } else if (postEngagement >= benchmarks.account_tier_average) {
      return 70 + ((postEngagement - benchmarks.account_tier_average) / 
                  (benchmarks.top_performers_average - benchmarks.account_tier_average)) * 30;
    } else if (postEngagement >= benchmarks.platform_average) {
      return 40 + ((postEngagement - benchmarks.platform_average) / 
                  (benchmarks.account_tier_average - benchmarks.platform_average)) * 30;
    } else {
      return Math.max(0, (postEngagement / benchmarks.platform_average) * 40);
    }
  }

  /**
   * Calculate weighted overall score
   */
  private calculateWeightedScore(scores: Record<string, number>, platform: SupportedPlatform): number {
    // Platform-specific weights
    const weights = {
      twitter: { engagement: 0.3, reach: 0.2, conversion: 0.2, viral: 0.15, quality: 0.1, timing: 0.05 },
      instagram: { engagement: 0.35, reach: 0.2, conversion: 0.15, viral: 0.1, quality: 0.15, timing: 0.05 },
      facebook: { engagement: 0.25, reach: 0.25, conversion: 0.2, viral: 0.1, quality: 0.15, timing: 0.05 },
      tiktok: { engagement: 0.4, reach: 0.15, conversion: 0.1, viral: 0.2, quality: 0.1, timing: 0.05 },
      discord: { engagement: 0.5, reach: 0.1, conversion: 0.15, viral: 0.05, quality: 0.15, timing: 0.05 },
      telegram: { engagement: 0.4, reach: 0.2, conversion: 0.2, viral: 0.05, quality: 0.1, timing: 0.05 }
    };

    const platformWeights = weights[platform] || weights.instagram;

    return Object.entries(platformWeights).reduce((total, [key, weight]) => {
      return total + (scores[key] || 0) * weight;
    }, 0);
  }

  /**
   * Store performance score in database
   */
  private async storePerformanceScore(postId: string, score: PerformanceScore): Promise<void> {
    try {
      await this.supabase
        .from('content_performance')
        .upsert({
          post_id: postId,
          performance_score: score.overall_score,
          engagement_score: score.engagement_score,
          reach_score: score.reach_score,
          conversion_score: score.conversion_score,
          viral_score: score.viral_score,
          quality_score: score.quality_score,
          timing_score: score.timing_score,
          calculated_at: new Date().toISOString()
        }, { onConflict: 'post_id' });
    } catch (error) {
      console.error('Error storing performance score:', error);
    }
  }

  /**
   * Get follower tier for benchmarking
   */
  private getFollowerTier(followerCount: number): string {
    if (followerCount < 1000) return 'micro';
    if (followerCount < 10000) return 'small';
    if (followerCount < 100000) return 'medium';
    if (followerCount < 1000000) return 'large';
    return 'mega';
  }
}

// Export singleton instance
export const performanceScorer = new SocialPerformanceScorer();