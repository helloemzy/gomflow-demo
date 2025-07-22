// GOMFLOW Social Analytics React Hook
// Custom hook for social media analytics data management with real-time updates

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { analyticsCollector } from '@/lib/social/analytics/collector';
import { performanceScorer } from '@/lib/social/analytics/scoring';
import { sentimentAnalyzer } from '@/lib/social/analytics/sentiment';

interface SocialAnalyticsData {
  overview: AnalyticsOverview | null;
  platformMetrics: PlatformMetric[] | null;
  engagementData: EngagementDataPoint[] | null;
  performanceData: PerformanceData | null;
  sentimentData: SentimentData | null;
  competitorData: CompetitorData[] | null;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  updateDateRange: (range: { start: Date; end: Date }) => void;
  updatePlatforms: (platforms: string[]) => void;
}

interface AnalyticsOverview {
  total_followers: number;
  total_reach: number;
  total_impressions: number;
  total_posts: number;
  total_engagement: number;
  total_shares: number;
  avg_engagement_rate: number;
  conversion_rate: number;
  follower_growth: number;
  reach_growth: number;
  engagement_growth: number;
  posts_growth: number;
  shares_growth: number;
  conversion_growth: number;
  insights: OverviewInsight[];
}

interface PlatformMetric {
  platform_id: string;
  name: string;
  display_name: string;
  followers: number;
  posts: number;
  engagement_rate: number;
  reach: number;
  performance_score: number;
  platform_average: number;
  growth_rate: number;
}

interface EngagementDataPoint {
  date: string;
  likes: number;
  comments: number;
  shares: number;
  reaches: number;
  impressions: number;
  engagement_rate: number;
  platform?: string;
  post_count?: number;
}

interface PerformanceData {
  posts: any[];
  insights: any[];
  recommendations: any[];
  benchmarks: any;
  trends: any[];
  hashtag_performance: any[];
}

interface SentimentData {
  overall_sentiment: number;
  positive_percentage: number;
  negative_percentage: number;
  neutral_percentage: number;
  trending_topics: string[];
  sentiment_trends: any[];
}

interface CompetitorData {
  id: string;
  name: string;
  platform: string;
  followers: number;
  engagement_rate: number;
  posts_per_month: number;
  trend: 'improving' | 'declining' | 'stable';
}

interface OverviewInsight {
  type: 'positive' | 'negative' | 'opportunity' | 'warning';
  category: 'engagement' | 'reach' | 'growth' | 'content' | 'timing' | 'conversion';
  title: string;
  description: string;
  actionable: boolean;
  metric_change?: number;
}

export const useSocialAnalytics = (
  gomId?: string,
  initialDateRange?: { start: Date; end: Date },
  initialPlatforms?: string[]
): SocialAnalyticsData => {
  // State management
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [platformMetrics, setPlatformMetrics] = useState<PlatformMetric[] | null>(null);
  const [engagementData, setEngagementData] = useState<EngagementDataPoint[] | null>(null);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [sentimentData, setSentimentData] = useState<SentimentData | null>(null);
  const [competitorData, setCompetitorData] = useState<CompetitorData[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [dateRange, setDateRange] = useState(
    initialDateRange || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    }
  );
  const [selectedPlatforms, setSelectedPlatforms] = useState(initialPlatforms || ['all']);

  // Supabase client
  const supabase = useMemo(() => createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // Fetch analytics overview
  const fetchOverview = useCallback(async () => {
    if (!gomId) return null;

    try {
      // Get social accounts for the GOM
      const { data: accounts } = await supabase
        .from('social_accounts')
        .select(`
          id,
          follower_count,
          social_platforms(name, display_name)
        `)
        .eq('gom_id', gomId)
        .eq('is_active', true);

      if (!accounts || accounts.length === 0) return null;

      const accountIds = accounts.map(acc => acc.id);

      // Get posts data for the date range
      const { data: posts } = await supabase
        .from('social_posts')
        .select(`
          *,
          content_performance(performance_score)
        `)
        .in('account_id', accountIds)
        .gte('posted_at', dateRange.start.toISOString())
        .lte('posted_at', dateRange.end.toISOString());

      // Calculate overview metrics
      const totalFollowers = accounts.reduce((sum, acc) => sum + (acc.follower_count || 0), 0);
      const totalPosts = posts?.length || 0;
      const totalEngagement = posts?.reduce((sum, post) => 
        sum + (post.likes_count || 0) + (post.comments_count || 0) + (post.shares_count || 0), 0) || 0;
      const totalReach = posts?.reduce((sum, post) => sum + (post.reach || 0), 0) || 0;
      const totalImpressions = posts?.reduce((sum, post) => sum + (post.impressions || 0), 0) || 0;
      const totalShares = posts?.reduce((sum, post) => sum + (post.shares_count || 0), 0) || 0;
      const avgEngagementRate = posts?.length ? 
        posts.reduce((sum, post) => sum + (post.engagement_score || 0), 0) / posts.length : 0;

      // Get previous period data for growth calculations
      const prevStart = new Date(dateRange.start.getTime() - (dateRange.end.getTime() - dateRange.start.getTime()));
      const prevEnd = dateRange.start;

      const { data: prevPosts } = await supabase
        .from('social_posts')
        .select('*')
        .in('account_id', accountIds)
        .gte('posted_at', prevStart.toISOString())
        .lte('posted_at', prevEnd.toISOString());

      // Calculate growth rates
      const prevTotalEngagement = prevPosts?.reduce((sum, post) => 
        sum + (post.likes_count || 0) + (post.comments_count || 0) + (post.shares_count || 0), 0) || 1;
      const prevTotalReach = prevPosts?.reduce((sum, post) => sum + (post.reach || 0), 0) || 1;
      const prevTotalShares = prevPosts?.reduce((sum, post) => sum + (post.shares_count || 0), 0) || 1;
      const prevAvgEngagement = prevPosts?.length ? 
        prevPosts.reduce((sum, post) => sum + (post.engagement_score || 0), 0) / prevPosts.length : 1;

      const engagementGrowth = ((totalEngagement - prevTotalEngagement) / prevTotalEngagement) * 100;
      const reachGrowth = ((totalReach - prevTotalReach) / prevTotalReach) * 100;
      const sharesGrowth = ((totalShares - prevTotalShares) / prevTotalShares) * 100;
      const engagementRateGrowth = ((avgEngagementRate - prevAvgEngagement) / prevAvgEngagement) * 100;

      // Generate insights
      const insights: OverviewInsight[] = [];

      if (engagementGrowth > 10) {
        insights.push({
          type: 'positive',
          category: 'engagement',
          title: 'Strong Engagement Growth',
          description: `Your engagement increased by ${engagementGrowth.toFixed(1)}% compared to the previous period.`,
          actionable: false,
          metric_change: engagementGrowth
        });
      } else if (engagementGrowth < -10) {
        insights.push({
          type: 'opportunity',
          category: 'engagement',
          title: 'Declining Engagement',
          description: `Your engagement decreased by ${Math.abs(engagementGrowth).toFixed(1)}%. Consider reviewing your content strategy.`,
          actionable: true,
          metric_change: engagementGrowth
        });
      }

      if (avgEngagementRate > 5) {
        insights.push({
          type: 'positive',
          category: 'engagement',
          title: 'High Engagement Rate',
          description: 'Your content is resonating well with your audience.',
          actionable: false
        });
      } else if (avgEngagementRate < 2) {
        insights.push({
          type: 'opportunity',
          category: 'content',
          title: 'Low Engagement Rate',
          description: 'Consider improving content quality or posting at optimal times.',
          actionable: true
        });
      }

      const overview: AnalyticsOverview = {
        total_followers: totalFollowers,
        total_reach: totalReach,
        total_impressions: totalImpressions,
        total_posts: totalPosts,
        total_engagement: totalEngagement,
        total_shares: totalShares,
        avg_engagement_rate: avgEngagementRate,
        conversion_rate: 0, // Would need conversion tracking data
        follower_growth: 0, // Would need historical follower data
        reach_growth: reachGrowth,
        engagement_growth: engagementGrowth,
        posts_growth: ((totalPosts - (prevPosts?.length || 0)) / Math.max(prevPosts?.length || 1, 1)) * 100,
        shares_growth: sharesGrowth,
        conversion_growth: 0, // Would need conversion tracking data
        insights
      };

      return overview;
    } catch (error) {
      console.error('Error fetching overview:', error);
      throw error;
    }
  }, [gomId, dateRange, supabase]);

  // Fetch platform metrics
  const fetchPlatformMetrics = useCallback(async () => {
    if (!gomId) return null;

    try {
      const { data: accounts } = await supabase
        .from('social_accounts')
        .select(`
          *,
          social_platforms(name, display_name)
        `)
        .eq('gom_id', gomId)
        .eq('is_active', true);

      if (!accounts || accounts.length === 0) return null;

      const metrics: PlatformMetric[] = [];

      for (const account of accounts) {
        // Get posts for this account
        const { data: posts } = await supabase
          .from('social_posts')
          .select(`
            *,
            content_performance(performance_score)
          `)
          .eq('account_id', account.id)
          .gte('posted_at', dateRange.start.toISOString())
          .lte('posted_at', dateRange.end.toISOString());

        const postsCount = posts?.length || 0;
        const avgEngagementRate = posts?.length ? 
          posts.reduce((sum, post) => sum + (post.engagement_score || 0), 0) / posts.length : 0;
        const totalReach = posts?.reduce((sum, post) => sum + (post.reach || 0), 0) || 0;
        const avgPerformanceScore = posts?.length ?
          posts.reduce((sum, post) => sum + (post.content_performance?.[0]?.performance_score || 0), 0) / posts.length : 0;

        metrics.push({
          platform_id: account.platform_id,
          name: account.social_platforms.name,
          display_name: account.social_platforms.display_name,
          followers: account.follower_count || 0,
          posts: postsCount,
          engagement_rate: avgEngagementRate,
          reach: totalReach,
          performance_score: avgPerformanceScore,
          platform_average: 3.5, // Would need industry benchmarks
          growth_rate: 0 // Would need historical data
        });
      }

      return metrics;
    } catch (error) {
      console.error('Error fetching platform metrics:', error);
      throw error;
    }
  }, [gomId, dateRange, supabase]);

  // Fetch engagement data
  const fetchEngagementData = useCallback(async () => {
    if (!gomId) return null;

    try {
      const { data: accounts } = await supabase
        .from('social_accounts')
        .select('id, social_platforms(name)')
        .eq('gom_id', gomId)
        .eq('is_active', true);

      if (!accounts || accounts.length === 0) return null;

      const accountIds = accounts.map(acc => acc.id);

      // Get daily engagement data
      const { data: posts } = await supabase
        .from('social_posts')
        .select(`
          posted_at,
          likes_count,
          comments_count,
          shares_count,
          reach,
          impressions,
          engagement_score,
          account_id,
          social_accounts!inner(social_platforms(name))
        `)
        .in('account_id', accountIds)
        .gte('posted_at', dateRange.start.toISOString())
        .lte('posted_at', dateRange.end.toISOString())
        .order('posted_at', { ascending: true });

      if (!posts || posts.length === 0) return null;

      // Group by date
      const dailyData = new Map<string, EngagementDataPoint>();

      posts.forEach(post => {
        const date = new Date(post.posted_at).toISOString().split('T')[0];
        
        if (!dailyData.has(date)) {
          dailyData.set(date, {
            date,
            likes: 0,
            comments: 0,
            shares: 0,
            reaches: 0,
            impressions: 0,
            engagement_rate: 0,
            post_count: 0
          });
        }

        const dayData = dailyData.get(date)!;
        dayData.likes += post.likes_count || 0;
        dayData.comments += post.comments_count || 0;
        dayData.shares += post.shares_count || 0;
        dayData.reaches += post.reach || 0;
        dayData.impressions += post.impressions || 0;
        dayData.engagement_rate += post.engagement_score || 0;
        dayData.post_count = (dayData.post_count || 0) + 1;
      });

      // Calculate average engagement rate
      dailyData.forEach(data => {
        if (data.post_count && data.post_count > 0) {
          data.engagement_rate = data.engagement_rate / data.post_count;
        }
      });

      return Array.from(dailyData.values()).sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      console.error('Error fetching engagement data:', error);
      throw error;
    }
  }, [gomId, dateRange, supabase]);

  // Fetch performance data
  const fetchPerformanceData = useCallback(async (): Promise<PerformanceData | null> => {
    if (!gomId) return null;

    try {
      // This would integrate with the performance scoring system
      // For now, return mock data structure
      return {
        posts: [],
        insights: [],
        recommendations: [],
        benchmarks: {},
        trends: [],
        hashtag_performance: []
      };
    } catch (error) {
      console.error('Error fetching performance data:', error);
      throw error;
    }
  }, [gomId, dateRange]);

  // Fetch sentiment data
  const fetchSentimentData = useCallback(async (): Promise<SentimentData | null> => {
    if (!gomId) return null;

    try {
      const { data: accounts } = await supabase
        .from('social_accounts')
        .select('id')
        .eq('gom_id', gomId)
        .eq('is_active', true);

      if (!accounts || accounts.length === 0) return null;

      const accountIds = accounts.map(acc => acc.id);

      // Get sentiment data from posts
      const { data: posts } = await supabase
        .from('social_posts')
        .select('sentiment_label, sentiment_score, hashtags')
        .in('account_id', accountIds)
        .gte('posted_at', dateRange.start.toISOString())
        .lte('posted_at', dateRange.end.toISOString())
        .not('sentiment_label', 'is', null);

      if (!posts || posts.length === 0) {
        return {
          overall_sentiment: 0,
          positive_percentage: 0,
          negative_percentage: 0,
          neutral_percentage: 100,
          trending_topics: [],
          sentiment_trends: []
        };
      }

      // Calculate sentiment distribution
      const positive = posts.filter(p => p.sentiment_label === 'positive').length;
      const negative = posts.filter(p => p.sentiment_label === 'negative').length;
      const neutral = posts.filter(p => p.sentiment_label === 'neutral').length;
      const total = posts.length;

      const overallSentiment = posts.reduce((sum, p) => sum + (p.sentiment_score || 0), 0) / total;

      // Extract trending hashtags
      const hashtags = posts.flatMap(p => p.hashtags || []);
      const hashtagCounts = hashtags.reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const trendingTopics = Object.entries(hashtagCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([tag]) => tag);

      return {
        overall_sentiment: overallSentiment,
        positive_percentage: (positive / total) * 100,
        negative_percentage: (negative / total) * 100,
        neutral_percentage: (neutral / total) * 100,
        trending_topics: trendingTopics,
        sentiment_trends: []
      };
    } catch (error) {
      console.error('Error fetching sentiment data:', error);
      throw error;
    }
  }, [gomId, dateRange, supabase]);

  // Fetch competitor data
  const fetchCompetitorData = useCallback(async (): Promise<CompetitorData[] | null> => {
    if (!gomId) return null;

    try {
      const { data: competitors } = await supabase
        .from('competitor_accounts')
        .select(`
          id,
          competitor_name,
          social_platforms(display_name),
          follower_count,
          engagement_rate
        `)
        .eq('gom_id', gomId)
        .eq('is_monitoring', true);

      if (!competitors || competitors.length === 0) return null;

      return competitors.map(comp => ({
        id: comp.id,
        name: comp.competitor_name,
        platform: comp.social_platforms.display_name,
        followers: comp.follower_count || 0,
        engagement_rate: comp.engagement_rate || 0,
        posts_per_month: 0, // Would need historical data
        trend: 'stable' as const // Would need trend analysis
      }));
    } catch (error) {
      console.error('Error fetching competitor data:', error);
      throw error;
    }
  }, [gomId, supabase]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    if (!gomId) return;

    setIsLoading(true);
    setError(null);

    try {
      const [
        overviewData,
        platformData,
        engagementData,
        performanceData,
        sentimentData,
        competitorData
      ] = await Promise.all([
        fetchOverview(),
        fetchPlatformMetrics(),
        fetchEngagementData(),
        fetchPerformanceData(),
        fetchSentimentData(),
        fetchCompetitorData()
      ]);

      setOverview(overviewData);
      setPlatformMetrics(platformData);
      setEngagementData(engagementData);
      setPerformanceData(performanceData);
      setSentimentData(sentimentData);
      setCompetitorData(competitorData);
    } catch (error) {
      console.error('Error refreshing analytics data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  }, [
    gomId,
    fetchOverview,
    fetchPlatformMetrics,
    fetchEngagementData,
    fetchPerformanceData,
    fetchSentimentData,
    fetchCompetitorData
  ]);

  // Update date range
  const updateDateRange = useCallback((range: { start: Date; end: Date }) => {
    setDateRange(range);
  }, []);

  // Update platforms
  const updatePlatforms = useCallback((platforms: string[]) => {
    setSelectedPlatforms(platforms);
  }, []);

  // Initial data load
  useEffect(() => {
    if (gomId) {
      refreshData();
    }
  }, [gomId, dateRange, selectedPlatforms, refreshData]);

  // Real-time updates via WebSocket (if available)
  useEffect(() => {
    if (!gomId) return;

    // Set up real-time subscription for analytics updates
    const channel = supabase
      .channel('analytics-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_posts',
          filter: `account_id=in.(${selectedPlatforms.join(',')})`
        },
        () => {
          // Refresh data when posts are updated
          refreshData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gomId, selectedPlatforms, refreshData, supabase]);

  return {
    overview,
    platformMetrics,
    engagementData,
    performanceData,
    sentimentData,
    competitorData,
    isLoading,
    error,
    refreshData,
    updateDateRange,
    updatePlatforms
  };
};

export default useSocialAnalytics;