'use client';

// GOMFLOW Social Media Analytics Dashboard
// Main analytics dashboard with comprehensive visualizations

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { CalendarIcon, RefreshCw, Download, TrendingUp, TrendingDown, Users, Eye, Heart, MessageCircle, Share, Target } from 'lucide-react';
import { format, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import EngagementChart from './EngagementChart';
import PerformanceReport from './PerformanceReport';
import { useSocialAnalytics } from '@/hooks/useSocialAnalytics';

interface AnalyticsDashboardProps {
  gomId?: string;
  className?: string;
}

interface MetricCard {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  color?: 'default' | 'success' | 'warning' | 'destructive';
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ 
  gomId,
  className = '' 
}) => {
  // State management
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['all']);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: subDays(new Date(), 30),
    end: new Date()
  });
  const [selectedMetric, setSelectedMetric] = useState('engagement');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Custom hook for analytics data
  const {
    overview,
    platformMetrics,
    engagementData,
    performanceData,
    sentimentData,
    competitorData,
    isLoading,
    error,
    refreshData
  } = useSocialAnalytics(gomId, dateRange, selectedPlatforms);

  // Predefined date ranges
  const dateRangePresets = [
    { label: 'Last 7 days', start: subDays(new Date(), 7), end: new Date() },
    { label: 'Last 30 days', start: subDays(new Date(), 30), end: new Date() },
    { label: 'This week', start: startOfWeek(new Date()), end: endOfWeek(new Date()) },
    { label: 'This month', start: startOfMonth(new Date()), end: endOfMonth(new Date()) },
    { label: 'Last month', start: startOfMonth(subDays(new Date(), 30)), end: endOfMonth(subDays(new Date(), 30)) }
  ];

  // Platform options
  const platformOptions = [
    { value: 'all', label: 'All Platforms' },
    { value: 'twitter', label: 'Twitter/X' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'discord', label: 'Discord' },
    { value: 'telegram', label: 'Telegram' }
  ];

  // Metric cards data
  const metricCards: MetricCard[] = useMemo(() => {
    if (!overview) return [];

    return [
      {
        title: 'Total Followers',
        value: overview.total_followers?.toLocaleString() || '0',
        change: overview.follower_growth,
        changeLabel: 'vs last period',
        icon: Users,
        color: overview.follower_growth > 0 ? 'success' : overview.follower_growth < 0 ? 'destructive' : 'default'
      },
      {
        title: 'Total Reach',
        value: overview.total_reach?.toLocaleString() || '0',
        change: overview.reach_growth,
        changeLabel: 'vs last period',
        icon: Eye,
        color: overview.reach_growth > 0 ? 'success' : overview.reach_growth < 0 ? 'destructive' : 'default'
      },
      {
        title: 'Engagement Rate',
        value: `${overview.avg_engagement_rate?.toFixed(1)}%` || '0%',
        change: overview.engagement_growth,
        changeLabel: 'vs last period',
        icon: Heart,
        color: overview.engagement_growth > 0 ? 'success' : overview.engagement_growth < 0 ? 'destructive' : 'default'
      },
      {
        title: 'Total Posts',
        value: overview.total_posts?.toLocaleString() || '0',
        change: overview.posts_growth,
        changeLabel: 'vs last period',
        icon: MessageCircle,
        color: 'default'
      },
      {
        title: 'Total Shares',
        value: overview.total_shares?.toLocaleString() || '0',
        change: overview.shares_growth,
        changeLabel: 'vs last period',
        icon: Share,
        color: overview.shares_growth > 0 ? 'success' : overview.shares_growth < 0 ? 'destructive' : 'default'
      },
      {
        title: 'Conversion Rate',
        value: `${overview.conversion_rate?.toFixed(1)}%` || '0%',
        change: overview.conversion_growth,
        changeLabel: 'vs last period',
        icon: Target,
        color: overview.conversion_growth > 0 ? 'success' : overview.conversion_growth < 0 ? 'destructive' : 'default'
      }
    ];
  }, [overview]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshData();
    setIsRefreshing(false);
  };

  // Handle export
  const handleExport = () => {
    // Implementation for exporting analytics data
    console.log('Exporting analytics data...');
  };

  // Render metric card
  const renderMetricCard = (metric: MetricCard, index: number) => (
    <Card key={index} className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {metric.title}
        </CardTitle>
        <metric.icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{metric.value}</div>
        {metric.change !== undefined && (
          <div className="flex items-center text-xs text-muted-foreground mt-1">
            {metric.change > 0 ? (
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
            ) : metric.change < 0 ? (
              <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
            ) : null}
            <span className={metric.change > 0 ? 'text-green-500' : metric.change < 0 ? 'text-red-500' : ''}>
              {metric.change > 0 ? '+' : ''}{metric.change?.toFixed(1)}%
            </span>
            <span className="ml-1">{metric.changeLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Render platform performance
  const renderPlatformPerformance = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {platformMetrics?.map((platform, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {platform.name}
            </CardTitle>
            <Badge variant={platform.performance_score > 80 ? 'default' : platform.performance_score > 60 ? 'secondary' : 'destructive'}>
              {platform.performance_score}/100
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Followers</span>
                <span className="font-medium">{platform.followers?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Engagement Rate</span>
                <span className="font-medium">{platform.engagement_rate?.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Posts</span>
                <span className="font-medium">{platform.posts}</span>
              </div>
              <Progress value={platform.performance_score} className="mt-2" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // Render top insights
  const renderTopInsights = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Key Insights</CardTitle>
        <CardDescription>
          AI-powered insights from your social media performance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {overview?.insights?.slice(0, 5).map((insight, index) => (
            <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50">
              <div className={`w-2 h-2 rounded-full mt-2 ${
                insight.type === 'positive' ? 'bg-green-500' :
                insight.type === 'negative' ? 'bg-red-500' :
                insight.type === 'opportunity' ? 'bg-blue-500' :
                'bg-gray-500'
              }`} />
              <div className="flex-1">
                <p className="text-sm font-medium">{insight.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
                {insight.actionable && (
                  <Badge variant="outline" className="mt-2 text-xs">
                    Action Required
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  // Render sentiment analysis
  const renderSentimentAnalysis = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sentiment Analysis</CardTitle>
        <CardDescription>
          Overall sentiment of your social media mentions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall Sentiment</span>
            <Badge variant={
              sentimentData?.overall_sentiment > 0.2 ? 'default' :
              sentimentData?.overall_sentiment < -0.2 ? 'destructive' :
              'secondary'
            }>
              {sentimentData?.overall_sentiment > 0.2 ? 'Positive' :
               sentimentData?.overall_sentiment < -0.2 ? 'Negative' :
               'Neutral'}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-green-600">Positive</span>
              <span>{sentimentData?.positive_percentage?.toFixed(1)}%</span>
            </div>
            <Progress value={sentimentData?.positive_percentage} className="h-2" />
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Neutral</span>
              <span>{sentimentData?.neutral_percentage?.toFixed(1)}%</span>
            </div>
            <Progress value={sentimentData?.neutral_percentage} className="h-2" />
            
            <div className="flex justify-between text-sm">
              <span className="text-red-600">Negative</span>
              <span>{sentimentData?.negative_percentage?.toFixed(1)}%</span>
            </div>
            <Progress value={sentimentData?.negative_percentage} className="h-2" />
          </div>

          {sentimentData?.trending_topics && sentimentData.trending_topics.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Trending Topics</p>
              <div className="flex flex-wrap gap-1">
                {sentimentData.trending_topics.slice(0, 6).map((topic, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-red-600 mb-2">Error loading analytics data</p>
              <Button onClick={handleRefresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Social Media Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive analytics and insights for your social media performance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:space-y-0 md:space-x-4">
            {/* Platform Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Platform:</label>
              <Select
                value={selectedPlatforms[0] || 'all'}
                onValueChange={(value) => setSelectedPlatforms(value === 'all' ? ['all'] : [value])}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {platformOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Period:</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(dateRange.start, 'MMM dd')} - {format(dateRange.end, 'MMM dd')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3 border-b">
                    <div className="grid gap-2">
                      {dateRangePresets.map((preset, index) => (
                        <Button
                          key={index}
                          variant="ghost"
                          size="sm"
                          className="justify-start"
                          onClick={() => setDateRange({ start: preset.start, end: preset.end })}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="p-3">
                    <Calendar
                      mode="range"
                      selected={{ from: dateRange.start, to: dateRange.end }}
                      onSelect={(range) => {
                        if (range?.from && range?.to) {
                          setDateRange({ start: range.from, end: range.to });
                        }
                      }}
                      numberOfMonths={2}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metricCards.map((metric, index) => renderMetricCard(metric, index))}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Platform Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Platform Performance</CardTitle>
                <CardDescription>
                  Performance breakdown by social media platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderPlatformPerformance()}
              </CardContent>
            </Card>

            {/* Top Insights */}
            {renderTopInsights()}
          </div>

          {/* Engagement Chart */}
          <EngagementChart
            data={engagementData}
            dateRange={dateRange}
            selectedMetric={selectedMetric}
            onMetricChange={setSelectedMetric}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <EngagementChart
            data={engagementData}
            dateRange={dateRange}
            selectedMetric={selectedMetric}
            onMetricChange={setSelectedMetric}
            isLoading={isLoading}
            showDetailed={true}
          />
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <PerformanceReport
            data={performanceData}
            dateRange={dateRange}
            platforms={selectedPlatforms}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="sentiment" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {renderSentimentAnalysis()}
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sentiment Trends</CardTitle>
                <CardDescription>
                  Sentiment analysis over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Sentiment trend chart would go here */}
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Sentiment trend visualization
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="competitors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Competitor Analysis</CardTitle>
              <CardDescription>
                Compare your performance with competitors
              </CardDescription>
            </CardHeader>
            <CardContent>
              {competitorData && competitorData.length > 0 ? (
                <div className="space-y-4">
                  {competitorData.map((competitor, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{competitor.name}</h4>
                        <Badge variant={competitor.trend === 'improving' ? 'default' : competitor.trend === 'declining' ? 'destructive' : 'secondary'}>
                          {competitor.trend}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Followers</p>
                          <p className="font-medium">{competitor.followers?.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Engagement</p>
                          <p className="font-medium">{competitor.engagement_rate?.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Posts/Month</p>
                          <p className="font-medium">{competitor.posts_per_month}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No competitor data available. Add competitors to start tracking.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsDashboard;