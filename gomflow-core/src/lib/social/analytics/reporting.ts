// GOMFLOW Social Media Analytics Reporting System
// Automated report generation with insights and recommendations

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { performanceScorer } from './scoring';
import { analyticsCollector } from './collector';
import { PlatformAnalyticsFactory, SupportedPlatform } from './platforms';

interface ReportMetrics {
  total_posts: number;
  total_engagement: number;
  total_reach: number;
  total_impressions: number;
  avg_engagement_rate: number;
  avg_performance_score: number;
  top_performing_post: any;
  follower_growth: number;
  conversion_rate: number;
  platform_breakdown: Record<string, any>;
}

interface ReportInsight {
  type: 'positive' | 'negative' | 'neutral' | 'opportunity';
  category: 'engagement' | 'reach' | 'growth' | 'content' | 'timing' | 'conversion';
  title: string;
  description: string;
  metric_change?: number;
  actionable?: boolean;
}

interface ReportRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'content' | 'timing' | 'engagement' | 'growth' | 'conversion';
  title: string;
  description: string;
  expected_impact: string;
  implementation_steps: string[];
  effort_level: 'low' | 'medium' | 'high';
}

interface AnalyticsReport {
  id: string;
  report_type: 'daily' | 'weekly' | 'monthly' | 'campaign' | 'competitor' | 'custom';
  gom_id: string;
  date_range: { start: Date; end: Date };
  platforms: SupportedPlatform[];
  metrics: ReportMetrics;
  insights: ReportInsight[];
  recommendations: ReportRecommendation[];
  charts_data: Record<string, any>;
  executive_summary: string;
  generated_at: Date;
}

export class SocialAnalyticsReporter {
  private supabase;

  constructor() {
    this.supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateReport(
    gomId: string,
    reportType: AnalyticsReport['report_type'],
    dateRange: { start: Date; end: Date },
    platforms: SupportedPlatform[] = [],
    customOptions?: Record<string, any>
  ): Promise<AnalyticsReport | null> {
    try {
      console.log(`Generating ${reportType} report for GOM ${gomId}`);

      // Get user's social accounts
      const { data: accounts } = await this.supabase
        .from('social_accounts')
        .select(`
          *,
          social_platforms(name, display_name)
        `)
        .eq('gom_id', gomId)
        .eq('is_active', true);

      if (!accounts || accounts.length === 0) {
        throw new Error('No active social accounts found');
      }

      // Filter by requested platforms
      const filteredAccounts = platforms.length > 0 
        ? accounts.filter(acc => platforms.includes(acc.social_platforms.name as SupportedPlatform))
        : accounts;

      const accountIds = filteredAccounts.map(acc => acc.id);

      // Collect metrics
      const metrics = await this.collectReportMetrics(accountIds, dateRange);
      
      // Generate insights
      const insights = await this.generateInsights(accountIds, dateRange, metrics);
      
      // Generate recommendations
      const recommendations = await this.generateRecommendations(accountIds, dateRange, insights);
      
      // Generate charts data
      const chartsData = await this.generateChartsData(accountIds, dateRange);
      
      // Generate executive summary
      const executiveSummary = this.generateExecutiveSummary(metrics, insights, recommendations);

      const report: AnalyticsReport = {
        id: crypto.randomUUID(),
        report_type: reportType,
        gom_id: gomId,
        date_range: dateRange,
        platforms: filteredAccounts.map(acc => acc.social_platforms.name as SupportedPlatform),
        metrics,
        insights,
        recommendations,
        charts_data: chartsData,
        executive_summary: executiveSummary,
        generated_at: new Date()
      };

      // Store report in database
      await this.storeReport(report);

      console.log(`Report generated successfully: ${report.id}`);
      return report;
    } catch (error) {
      console.error('Error generating report:', error);
      return null;
    }
  }

  /**
   * Generate scheduled reports
   */
  async generateScheduledReports(): Promise<void> {
    try {
      const now = new Date();
      
      // Get all users with active social accounts
      const { data: users } = await this.supabase
        .from('social_accounts')
        .select('gom_id')
        .eq('is_active', true)
        .group('gom_id');

      if (!users) return;

      for (const user of users) {
        // Generate daily report
        if (now.getHours() === 9) { // 9 AM daily
          const dateRange = {
            start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
            end: now
          };
          await this.generateReport(user.gom_id, 'daily', dateRange);
        }

        // Generate weekly report
        if (now.getDay() === 1 && now.getHours() === 10) { // Monday 10 AM
          const dateRange = {
            start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            end: now
          };
          await this.generateReport(user.gom_id, 'weekly', dateRange);
        }

        // Generate monthly report
        if (now.getDate() === 1 && now.getHours() === 11) { // 1st of month 11 AM
          const dateRange = {
            start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            end: new Date(now.getFullYear(), now.getMonth(), 0)
          };
          await this.generateReport(user.gom_id, 'monthly', dateRange);
        }
      }
    } catch (error) {
      console.error('Error generating scheduled reports:', error);
    }
  }

  /**
   * Collect comprehensive metrics for the report
   */
  private async collectReportMetrics(
    accountIds: string[],
    dateRange: { start: Date; end: Date }
  ): Promise<ReportMetrics> {
    try {
      // Get posts data
      const { data: posts } = await this.supabase
        .from('social_posts')
        .select(`
          *,
          content_performance(performance_score),
          social_accounts(follower_count, social_platforms(name))
        `)
        .in('account_id', accountIds)
        .gte('posted_at', dateRange.start.toISOString())
        .lte('posted_at', dateRange.end.toISOString());

      if (!posts || posts.length === 0) {
        return this.getEmptyMetrics();
      }

      // Calculate totals
      const totalPosts = posts.length;
      const totalEngagement = posts.reduce((sum, post) => 
        sum + (post.likes_count || 0) + (post.comments_count || 0) + 
        (post.shares_count || 0) + (post.saves_count || 0), 0);
      const totalReach = posts.reduce((sum, post) => sum + (post.reach || 0), 0);
      const totalImpressions = posts.reduce((sum, post) => sum + (post.impressions || 0), 0);

      // Calculate averages
      const avgEngagementRate = posts.reduce((sum, post) => sum + (post.engagement_score || 0), 0) / totalPosts;
      const avgPerformanceScore = posts.reduce((sum, post) => 
        sum + (post.content_performance?.[0]?.performance_score || 0), 0) / totalPosts;

      // Find top performing post
      const topPerformingPost = posts.reduce((best, current) => {
        const currentScore = current.content_performance?.[0]?.performance_score || 0;
        const bestScore = best?.content_performance?.[0]?.performance_score || 0;
        return currentScore > bestScore ? current : best;
      }, posts[0]);

      // Calculate follower growth
      const followerGrowth = await this.calculateFollowerGrowth(accountIds, dateRange);

      // Calculate conversion rate
      const conversionRate = await this.calculateConversionRate(accountIds, dateRange);

      // Platform breakdown
      const platformBreakdown = this.calculatePlatformBreakdown(posts);

      return {
        total_posts: totalPosts,
        total_engagement: totalEngagement,
        total_reach: totalReach,
        total_impressions: totalImpressions,
        avg_engagement_rate: Math.round(avgEngagementRate * 100) / 100,
        avg_performance_score: Math.round(avgPerformanceScore),
        top_performing_post: topPerformingPost,
        follower_growth: followerGrowth,
        conversion_rate: conversionRate,
        platform_breakdown: platformBreakdown
      };
    } catch (error) {
      console.error('Error collecting report metrics:', error);
      return this.getEmptyMetrics();
    }
  }

  /**
   * Generate actionable insights from the data
   */
  private async generateInsights(
    accountIds: string[],
    dateRange: { start: Date; end: Date },
    metrics: ReportMetrics
  ): Promise<ReportInsight[]> {
    const insights: ReportInsight[] = [];

    try {
      // Compare with previous period
      const previousPeriod = {
        start: new Date(dateRange.start.getTime() - (dateRange.end.getTime() - dateRange.start.getTime())),
        end: dateRange.start
      };

      const previousMetrics = await this.collectReportMetrics(accountIds, previousPeriod);

      // Engagement insights
      const engagementChange = ((metrics.avg_engagement_rate - previousMetrics.avg_engagement_rate) / 
                               previousMetrics.avg_engagement_rate) * 100;

      if (engagementChange > 10) {
        insights.push({
          type: 'positive',
          category: 'engagement',
          title: 'Engagement Rate Improved',
          description: `Your average engagement rate increased by ${engagementChange.toFixed(1)}% compared to the previous period.`,
          metric_change: engagementChange,
          actionable: false
        });
      } else if (engagementChange < -10) {
        insights.push({
          type: 'negative',
          category: 'engagement',
          title: 'Engagement Rate Declined',
          description: `Your average engagement rate decreased by ${Math.abs(engagementChange).toFixed(1)}% compared to the previous period.`,
          metric_change: engagementChange,
          actionable: true
        });
      }

      // Reach insights
      const reachChange = ((metrics.total_reach - previousMetrics.total_reach) / 
                          previousMetrics.total_reach) * 100;

      if (reachChange > 20) {
        insights.push({
          type: 'positive',
          category: 'reach',
          title: 'Significant Reach Growth',
          description: `Your content reached ${reachChange.toFixed(1)}% more people than the previous period.`,
          metric_change: reachChange,
          actionable: false
        });
      }

      // Content performance insights
      if (metrics.avg_performance_score > 80) {
        insights.push({
          type: 'positive',
          category: 'content',
          title: 'High Content Quality',
          description: 'Your content is performing exceptionally well with an average performance score above 80.',
          actionable: false
        });
      } else if (metrics.avg_performance_score < 50) {
        insights.push({
          type: 'opportunity',
          category: 'content',
          title: 'Content Optimization Opportunity',
          description: 'There\'s significant room for improvement in your content performance.',
          actionable: true
        });
      }

      // Platform-specific insights
      Object.entries(metrics.platform_breakdown).forEach(([platform, data]: [string, any]) => {
        if (data.engagement_rate > data.platform_average * 1.5) {
          insights.push({
            type: 'positive',
            category: 'engagement',
            title: `${platform} Outperforming`,
            description: `Your ${platform} content is performing 50% better than platform average.`,
            actionable: false
          });
        }
      });

      // Conversion insights
      if (metrics.conversion_rate > 5) {
        insights.push({
          type: 'positive',
          category: 'conversion',
          title: 'Strong Conversion Performance',
          description: `Your social media is driving a ${metrics.conversion_rate.toFixed(1)}% conversion rate to orders.`,
          actionable: false
        });
      } else if (metrics.conversion_rate < 1) {
        insights.push({
          type: 'opportunity',
          category: 'conversion',
          title: 'Low Conversion Rate',
          description: 'Your social media conversion rate is below industry benchmarks.',
          actionable: true
        });
      }

      // Follower growth insights
      if (metrics.follower_growth > 10) {
        insights.push({
          type: 'positive',
          category: 'growth',
          title: 'Rapid Follower Growth',
          description: `You gained ${metrics.follower_growth} new followers during this period.`,
          metric_change: metrics.follower_growth,
          actionable: false
        });
      } else if (metrics.follower_growth < 0) {
        insights.push({
          type: 'negative',
          category: 'growth',
          title: 'Follower Decline',
          description: `You lost ${Math.abs(metrics.follower_growth)} followers during this period.`,
          metric_change: metrics.follower_growth,
          actionable: true
        });
      }

      return insights;
    } catch (error) {
      console.error('Error generating insights:', error);
      return insights;
    }
  }

  /**
   * Generate actionable recommendations
   */
  private async generateRecommendations(
    accountIds: string[],
    dateRange: { start: Date; end: Date },
    insights: ReportInsight[]
  ): Promise<ReportRecommendation[]> {
    const recommendations: ReportRecommendation[] = [];

    try {
      // Base recommendations based on insights
      const actionableInsights = insights.filter(insight => insight.actionable);

      for (const insight of actionableInsights) {
        switch (insight.category) {
          case 'engagement':
            if (insight.type === 'negative') {
              recommendations.push({
                priority: 'high',
                category: 'engagement',
                title: 'Improve Engagement Strategy',
                description: 'Your engagement rate has declined. Focus on creating more interactive content.',
                expected_impact: '20-30% increase in engagement rate',
                implementation_steps: [
                  'Ask questions in your posts to encourage comments',
                  'Use polls and interactive stickers on Stories',
                  'Respond to comments within 2 hours',
                  'Share user-generated content',
                  'Host live Q&A sessions'
                ],
                effort_level: 'medium'
              });
            }
            break;

          case 'content':
            recommendations.push({
              priority: 'high',
              category: 'content',
              title: 'Optimize Content Quality',
              description: 'Your content performance scores suggest room for improvement.',
              expected_impact: '15-25% improvement in performance scores',
              implementation_steps: [
                'Use high-quality images and videos',
                'Write compelling captions with clear value propositions',
                'Include trending hashtags relevant to your niche',
                'Post at optimal times for your audience',
                'Test different content formats (carousels, videos, etc.)'
              ],
              effort_level: 'high'
            });
            break;

          case 'conversion':
            recommendations.push({
              priority: 'medium',
              category: 'conversion',
              title: 'Enhance Conversion Funnel',
              description: 'Improve your social media to order conversion rate.',
              expected_impact: '10-20% increase in conversion rate',
              implementation_steps: [
                'Include clear call-to-action buttons in posts',
                'Add order links in your bio and Stories',
                'Create compelling order announcements',
                'Use exclusive social media offers',
                'Track UTM parameters for better attribution'
              ],
              effort_level: 'medium'
            });
            break;
        }
      }

      // General best practice recommendations
      recommendations.push({
        priority: 'low',
        category: 'timing',
        title: 'Optimize Posting Schedule',
        description: 'Post when your audience is most active for better reach.',
        expected_impact: '10-15% increase in reach',
        implementation_steps: [
          'Analyze your audience insights for peak activity times',
          'Schedule posts for optimal times',
          'Test different posting frequencies',
          'Use social media scheduling tools'
        ],
        effort_level: 'low'
      });

      // Sort by priority
      return recommendations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
    } catch (error) {
      console.error('Error generating recommendations:', error);
      return recommendations;
    }
  }

  /**
   * Generate charts data for visualization
   */
  private async generateChartsData(
    accountIds: string[],
    dateRange: { start: Date; end: Date }
  ): Promise<Record<string, any>> {
    try {
      // Engagement over time
      const engagementData = await this.getEngagementOverTime(accountIds, dateRange);
      
      // Platform performance comparison
      const platformData = await this.getPlatformComparison(accountIds, dateRange);
      
      // Top performing content
      const topContentData = await this.getTopPerformingContent(accountIds, dateRange);
      
      // Audience growth
      const audienceGrowthData = await this.getAudienceGrowthData(accountIds, dateRange);

      // Hashtag performance
      const hashtagData = await this.getHashtagPerformance(accountIds, dateRange);

      return {
        engagement_over_time: engagementData,
        platform_comparison: platformData,
        top_content: topContentData,
        audience_growth: audienceGrowthData,
        hashtag_performance: hashtagData
      };
    } catch (error) {
      console.error('Error generating charts data:', error);
      return {};
    }
  }

  /**
   * Generate executive summary
   */
  private generateExecutiveSummary(
    metrics: ReportMetrics,
    insights: ReportInsight[],
    recommendations: ReportRecommendation[]
  ): string {
    const positiveInsights = insights.filter(i => i.type === 'positive').length;
    const negativeInsights = insights.filter(i => i.type === 'negative').length;
    const highPriorityRecs = recommendations.filter(r => r.priority === 'high').length;

    let summary = `During this period, you published ${metrics.total_posts} posts across your social media platforms, `;
    summary += `generating ${metrics.total_engagement.toLocaleString()} total engagements `;
    summary += `and reaching ${metrics.total_reach.toLocaleString()} people.\n\n`;

    summary += `Your average engagement rate was ${metrics.avg_engagement_rate}% with an overall performance score of ${metrics.avg_performance_score}/100. `;

    if (positiveInsights > negativeInsights) {
      summary += `Your social media performance is trending positively with ${positiveInsights} areas of improvement identified. `;
    } else if (negativeInsights > positiveInsights) {
      summary += `There are ${negativeInsights} areas that need attention to improve your social media performance. `;
    } else {
      summary += `Your social media performance is stable with balanced areas of strength and improvement. `;
    }

    if (highPriorityRecs > 0) {
      summary += `We've identified ${highPriorityRecs} high-priority recommendations that could significantly impact your results. `;
    }

    summary += `Your conversion rate from social media to orders is ${metrics.conversion_rate.toFixed(1)}%, `;
    
    if (metrics.conversion_rate > 3) {
      summary += `which is above industry average.`;
    } else if (metrics.conversion_rate > 1) {
      summary += `which is at industry average.`;
    } else {
      summary += `which has room for improvement.`;
    }

    return summary;
  }

  /**
   * Store report in database
   */
  private async storeReport(report: AnalyticsReport): Promise<void> {
    try {
      await this.supabase
        .from('analytics_reports')
        .insert({
          id: report.id,
          gom_id: report.gom_id,
          report_type: report.report_type,
          report_name: `${report.report_type} Report - ${report.generated_at.toLocaleDateString()}`,
          date_range_start: report.date_range.start.toISOString().split('T')[0],
          date_range_end: report.date_range.end.toISOString().split('T')[0],
          platforms: report.platforms,
          metrics: report.metrics,
          insights: report.insights,
          recommendations: report.recommendations,
          charts_data: report.charts_data,
          status: 'completed',
          generated_at: report.generated_at.toISOString()
        });
    } catch (error) {
      console.error('Error storing report:', error);
    }
  }

  // Helper methods for data collection
  private getEmptyMetrics(): ReportMetrics {
    return {
      total_posts: 0,
      total_engagement: 0,
      total_reach: 0,
      total_impressions: 0,
      avg_engagement_rate: 0,
      avg_performance_score: 0,
      top_performing_post: null,
      follower_growth: 0,
      conversion_rate: 0,
      platform_breakdown: {}
    };
  }

  private async calculateFollowerGrowth(accountIds: string[], dateRange: { start: Date; end: Date }): Promise<number> {
    // Implementation would compare follower counts at start and end of period
    return 0; // Placeholder
  }

  private async calculateConversionRate(accountIds: string[], dateRange: { start: Date; end: Date }): Promise<number> {
    // Implementation would calculate conversions from social media to orders
    return 0; // Placeholder
  }

  private calculatePlatformBreakdown(posts: any[]): Record<string, any> {
    const breakdown: Record<string, any> = {};
    
    posts.forEach(post => {
      const platform = post.social_accounts.social_platforms.name;
      if (!breakdown[platform]) {
        breakdown[platform] = {
          posts: 0,
          engagement: 0,
          reach: 0,
          engagement_rate: 0
        };
      }
      
      breakdown[platform].posts++;
      breakdown[platform].engagement += (post.likes_count || 0) + (post.comments_count || 0) + (post.shares_count || 0);
      breakdown[platform].reach += post.reach || 0;
    });

    // Calculate engagement rates
    Object.keys(breakdown).forEach(platform => {
      const data = breakdown[platform];
      data.engagement_rate = data.posts > 0 ? data.engagement / data.posts : 0;
    });

    return breakdown;
  }

  private async getEngagementOverTime(accountIds: string[], dateRange: { start: Date; end: Date }): Promise<any[]> {
    // Implementation would return daily engagement data
    return [];
  }

  private async getPlatformComparison(accountIds: string[], dateRange: { start: Date; end: Date }): Promise<any[]> {
    // Implementation would return platform comparison data
    return [];
  }

  private async getTopPerformingContent(accountIds: string[], dateRange: { start: Date; end: Date }): Promise<any[]> {
    // Implementation would return top posts
    return [];
  }

  private async getAudienceGrowthData(accountIds: string[], dateRange: { start: Date; end: Date }): Promise<any[]> {
    // Implementation would return follower growth data
    return [];
  }

  private async getHashtagPerformance(accountIds: string[], dateRange: { start: Date; end: Date }): Promise<any[]> {
    // Implementation would return hashtag performance data
    return [];
  }
}

// Export singleton instance
export const analyticsReporter = new SocialAnalyticsReporter();