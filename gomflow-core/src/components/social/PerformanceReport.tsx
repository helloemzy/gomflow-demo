'use client';

// GOMFLOW Performance Report Component
// Comprehensive performance analysis and reporting

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Zap, 
  Star, 
  Clock, 
  Users, 
  Heart,
  MessageCircle,
  Share,
  Eye,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  Download,
  Filter
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PerformanceData {
  posts: PostPerformance[];
  insights: PerformanceInsight[];
  recommendations: PerformanceRecommendation[];
  benchmarks: BenchmarkData;
  trends: PerformanceTrend[];
  hashtag_performance: HashtagPerformance[];
}

interface PostPerformance {
  id: string;
  content: string;
  platform: string;
  posted_at: string;
  performance_score: number;
  engagement_score: number;
  reach_score: number;
  viral_score: number;
  quality_score: number;
  timing_score: number;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  engagement_rate: number;
  media_type: 'text' | 'image' | 'video' | 'carousel';
}

interface PerformanceInsight {
  type: 'positive' | 'negative' | 'opportunity' | 'warning';
  category: 'engagement' | 'reach' | 'content' | 'timing' | 'conversion';
  title: string;
  description: string;
  impact_level: 'high' | 'medium' | 'low';
  metric_change?: number;
}

interface PerformanceRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'content' | 'timing' | 'engagement' | 'optimization';
  title: string;
  description: string;
  expected_impact: string;
  effort_level: 'low' | 'medium' | 'high';
  implementation_steps: string[];
}

interface BenchmarkData {
  your_performance: number;
  industry_average: number;
  platform_average: number;
  top_performers: number;
  percentile_rank: number;
}

interface PerformanceTrend {
  date: string;
  performance_score: number;
  engagement_rate: number;
  reach_rate: number;
}

interface HashtagPerformance {
  hashtag: string;
  usage_count: number;
  avg_engagement: number;
  avg_reach: number;
  performance_score: number;
}

interface PerformanceReportProps {
  data: PerformanceData | null;
  dateRange: { start: Date; end: Date };
  platforms: string[];
  isLoading?: boolean;
  className?: string;
}

const PerformanceReport: React.FC<PerformanceReportProps> = ({
  data,
  dateRange,
  platforms,
  isLoading = false,
  className = ''
}) => {
  const [sortBy, setSortBy] = useState('performance_score');
  const [filterBy, setFilterBy] = useState('all');
  const [showOnlyActionable, setShowOnlyActionable] = useState(false);

  // Sort and filter posts
  const sortedPosts = useMemo(() => {
    if (!data?.posts) return [];

    let filtered = data.posts;

    // Apply platform filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(post => post.platform === filterBy);
    }

    // Sort posts
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'performance_score':
          return b.performance_score - a.performance_score;
        case 'engagement_rate':
          return b.engagement_rate - a.engagement_rate;
        case 'reach':
          return b.reach - a.reach;
        case 'posted_at':
          return new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime();
        default:
          return b.performance_score - a.performance_score;
      }
    });
  }, [data?.posts, sortBy, filterBy]);

  // Filter insights and recommendations
  const filteredInsights = useMemo(() => {
    if (!data?.insights) return [];
    if (!showOnlyActionable) return data.insights;
    return data.insights.filter(insight => 
      insight.type === 'opportunity' || insight.type === 'warning'
    );
  }, [data?.insights, showOnlyActionable]);

  // Get performance score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get performance score badge variant
  const getScoreBadgeVariant = (score: number): 'default' | 'secondary' | 'destructive' => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  // Get insight icon
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'positive':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'negative':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'opportunity':
        return <Lightbulb className="h-4 w-4 text-blue-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render empty state
  if (!data) {
    return (
      <div className={`${className}`}>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Performance Data</h3>
              <p className="text-muted-foreground">
                Performance analysis will appear here once you have social media posts to analyze.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Performance Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.benchmarks?.your_performance || 0}/100</div>
            <Progress value={data.benchmarks?.your_performance || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {data.benchmarks?.percentile_rank || 0}th percentile
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">vs Industry</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.benchmarks ? 
                ((data.benchmarks.your_performance - data.benchmarks.industry_average) > 0 ? '+' : '') +
                (data.benchmarks.your_performance - data.benchmarks.industry_average).toFixed(1)
                : '0'
              }
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Industry avg: {data.benchmarks?.industry_average || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Posts</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sortedPosts.filter(post => post.performance_score >= 80).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              High performers (80+)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opportunities</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.recommendations?.filter(rec => rec.priority === 'high').length || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              High priority actions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="posts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="posts">Post Analysis</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="hashtags">Hashtag Performance</TabsTrigger>
        </TabsList>

        {/* Post Analysis Tab */}
        <TabsContent value="posts">
          <Card>
            <CardHeader>
              <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
                <div>
                  <CardTitle>Post Performance Analysis</CardTitle>
                  <CardDescription>
                    Detailed analysis of individual post performance
                  </CardDescription>
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* Sort Selector */}
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="performance_score">Performance Score</SelectItem>
                      <SelectItem value="engagement_rate">Engagement Rate</SelectItem>
                      <SelectItem value="reach">Reach</SelectItem>
                      <SelectItem value="posted_at">Date Posted</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Platform Filter */}
                  <Select value={filterBy} onValueChange={setFilterBy}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Platforms</SelectItem>
                      <SelectItem value="twitter">Twitter</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="discord">Discord</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {sortedPosts.map((post) => (
                    <div key={post.id} className="border rounded-lg p-4 space-y-3">
                      {/* Post Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge variant="outline" className="capitalize">
                              {post.platform}
                            </Badge>
                            <Badge variant={getScoreBadgeVariant(post.performance_score)}>
                              {post.performance_score}/100
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(post.posted_at).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 line-clamp-2">
                            {post.content}
                          </p>
                        </div>
                      </div>

                      {/* Performance Breakdown */}
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Engagement</p>
                          <div className="flex items-center space-x-1">
                            <Progress value={post.engagement_score} className="h-2 flex-1" />
                            <span className="text-xs font-medium">{post.engagement_score}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Reach</p>
                          <div className="flex items-center space-x-1">
                            <Progress value={post.reach_score} className="h-2 flex-1" />
                            <span className="text-xs font-medium">{post.reach_score}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Viral</p>
                          <div className="flex items-center space-x-1">
                            <Progress value={post.viral_score} className="h-2 flex-1" />
                            <span className="text-xs font-medium">{post.viral_score}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Quality</p>
                          <div className="flex items-center space-x-1">
                            <Progress value={post.quality_score} className="h-2 flex-1" />
                            <span className="text-xs font-medium">{post.quality_score}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Timing</p>
                          <div className="flex items-center space-x-1">
                            <Progress value={post.timing_score} className="h-2 flex-1" />
                            <span className="text-xs font-medium">{post.timing_score}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Eng. Rate</p>
                          <p className="font-medium">{post.engagement_rate.toFixed(1)}%</p>
                        </div>
                      </div>

                      {/* Engagement Metrics */}
                      <div className="flex items-center space-x-6 text-sm text-muted-foreground border-t pt-3">
                        <div className="flex items-center space-x-1">
                          <Heart className="h-4 w-4" />
                          <span>{post.likes.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <MessageCircle className="h-4 w-4" />
                          <span>{post.comments.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Share className="h-4 w-4" />
                          <span>{post.shares.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Eye className="h-4 w-4" />
                          <span>{post.reach.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Performance Insights</CardTitle>
                  <CardDescription>
                    AI-powered analysis of your social media performance
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOnlyActionable(!showOnlyActionable)}
                >
                  <Filter className="h-4 w-4 mr-2" />
                  {showOnlyActionable ? 'Show All' : 'Actionable Only'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredInsights.map((insight, index) => (
                  <div key={index} className="flex items-start space-x-3 p-4 border rounded-lg">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium">{insight.title}</h4>
                        <Badge variant="outline" className="capitalize">
                          {insight.category}
                        </Badge>
                        <Badge variant={insight.impact_level === 'high' ? 'destructive' : insight.impact_level === 'medium' ? 'secondary' : 'outline'}>
                          {insight.impact_level} impact
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                      {insight.metric_change && (
                        <div className="flex items-center mt-2 text-xs">
                          {insight.metric_change > 0 ? (
                            <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                          ) : (
                            <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
                          )}
                          <span className={insight.metric_change > 0 ? 'text-green-500' : 'text-red-500'}>
                            {insight.metric_change > 0 ? '+' : ''}{insight.metric_change.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle>Action Recommendations</CardTitle>
              <CardDescription>
                Prioritized recommendations to improve your social media performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.recommendations?.map((rec, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium">{rec.title}</h4>
                          <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'secondary' : 'outline'}>
                            {rec.priority} priority
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {rec.category}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                        <p className="text-sm font-medium text-green-600">
                          Expected Impact: {rec.expected_impact}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {rec.effort_level} effort
                      </Badge>
                    </div>
                    
                    {rec.implementation_steps && rec.implementation_steps.length > 0 && (
                      <div className="border-t pt-3">
                        <p className="text-sm font-medium mb-2">Implementation Steps:</p>
                        <ol className="text-sm space-y-1">
                          {rec.implementation_steps.map((step, stepIndex) => (
                            <li key={stepIndex} className="flex items-start space-x-2">
                              <span className="text-muted-foreground min-w-[20px]">{stepIndex + 1}.</span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hashtag Performance Tab */}
        <TabsContent value="hashtags">
          <Card>
            <CardHeader>
              <CardTitle>Hashtag Performance</CardTitle>
              <CardDescription>
                Analysis of your most effective hashtags
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {data.hashtag_performance?.map((hashtag, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">#{hashtag.hashtag}</h4>
                      <Badge variant={getScoreBadgeVariant(hashtag.performance_score)}>
                        {hashtag.performance_score}/100
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Used</span>
                        <span className="font-medium">{hashtag.usage_count} times</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Engagement</span>
                        <span className="font-medium">{hashtag.avg_engagement.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Avg Reach</span>
                        <span className="font-medium">{hashtag.avg_reach.toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <Progress value={hashtag.performance_score} className="mt-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PerformanceReport;