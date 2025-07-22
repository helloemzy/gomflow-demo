'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { BaseChart } from '../analytics/BaseChart';
import { MarketSentiment as MarketSentimentType } from '../../lib/market/marketAnalytics';
import { formatPercentageChange } from '../../lib/market/marketAnalytics';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Heart,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  BarChart3,
  Clock,
  Filter,
  RefreshCw
} from 'lucide-react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { CHART_COLORS, LINE_CHART_OPTIONS, BAR_CHART_OPTIONS, PIE_CHART_OPTIONS } from '../../lib/chartConfig';

interface MarketSentimentProps {
  sentiment: MarketSentimentType[];
  className?: string;
}

export const MarketSentiment: React.FC<MarketSentimentProps> = ({ sentiment, className }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [sortBy, setSortBy] = useState<'sentiment_score' | 'confidence' | 'timestamp'>('sentiment_score');

  const categories = ['all', ...Array.from(new Set(sentiment.map(s => s.category)))];
  
  const filteredSentiment = sentiment.filter(s => 
    selectedCategory === 'all' || s.category === selectedCategory
  ).sort((a, b) => {
    if (sortBy === 'timestamp') {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }
    return b[sortBy] - a[sortBy];
  });

  const getSentimentIcon = (trend: string) => {
    switch (trend) {
      case 'bullish':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'bearish':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'neutral':
        return <Activity className="w-4 h-4 text-gray-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSentimentBadge = (trend: string, score: number) => {
    if (trend === 'bullish') {
      return <Badge variant="secondary">Bullish</Badge>;
    } else if (trend === 'bearish') {
      return <Badge variant="destructive">Bearish</Badge>;
    } else {
      return <Badge variant="outline">Neutral</Badge>;
    }
  };

  const getSentimentColor = (score: number) => {
    if (score > 0.6) return 'text-green-600';
    if (score < -0.6) return 'text-red-600';
    return 'text-gray-600';
  };

  const getProgressColor = (score: number) => {
    if (score > 0.6) return 'bg-green-500';
    if (score < -0.6) return 'bg-red-500';
    return 'bg-gray-500';
  };

  // Overall sentiment distribution
  const sentimentDistribution = {
    labels: ['Bullish', 'Neutral', 'Bearish'],
    datasets: [
      {
        data: [
          filteredSentiment.filter(s => s.trend === 'bullish').length,
          filteredSentiment.filter(s => s.trend === 'neutral').length,
          filteredSentiment.filter(s => s.trend === 'bearish').length
        ],
        backgroundColor: [CHART_COLORS.primary[2], CHART_COLORS.primary[1], CHART_COLORS.primary[3]],
        borderColor: [CHART_COLORS.primary[2], CHART_COLORS.primary[1], CHART_COLORS.primary[3]],
        borderWidth: 1
      }
    ]
  };

  // Sentiment scores by category
  const categoryData = {
    labels: categories.filter(c => c !== 'all'),
    datasets: [
      {
        label: 'Sentiment Score',
        data: categories.filter(c => c !== 'all').map(category => {
          const categorySentiment = sentiment.filter(s => s.category === category);
          return categorySentiment.reduce((sum, s) => sum + s.sentiment_score, 0) / categorySentiment.length;
        }),
        backgroundColor: CHART_COLORS.gradient,
        borderColor: CHART_COLORS.primary,
        borderWidth: 1
      }
    ]
  };

  // Sentiment timeline
  const timelineData = {
    labels: filteredSentiment.map(s => new Date(s.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Sentiment Score',
        data: filteredSentiment.map(s => s.sentiment_score),
        borderColor: CHART_COLORS.primary[0],
        backgroundColor: CHART_COLORS.gradient[0],
        fill: true,
        tension: 0.4
      }
    ]
  };

  const calculateOverallSentiment = () => {
    if (filteredSentiment.length === 0) return 0;
    return filteredSentiment.reduce((sum, s) => sum + s.sentiment_score, 0) / filteredSentiment.length;
  };

  const calculateConfidenceLevel = () => {
    if (filteredSentiment.length === 0) return 0;
    return filteredSentiment.reduce((sum, s) => sum + s.confidence, 0) / filteredSentiment.length;
  };

  const renderSentimentCard = (sentimentData: MarketSentimentType) => (
    <Card key={`${sentimentData.category}-${sentimentData.timestamp}`} className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
            {getSentimentIcon(sentimentData.trend)}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{sentimentData.category}</h3>
            <p className="text-sm text-muted-foreground">
              {new Date(sentimentData.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getSentimentBadge(sentimentData.trend, sentimentData.sentiment_score)}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Sentiment Score</span>
          <div className="flex items-center space-x-2">
            <Progress 
              value={((sentimentData.sentiment_score + 1) / 2) * 100} 
              className="w-20"
            />
            <span className={`text-sm font-medium ${getSentimentColor(sentimentData.sentiment_score)}`}>
              {sentimentData.sentiment_score.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Confidence</span>
          <div className="flex items-center space-x-2">
            <Progress value={sentimentData.confidence * 100} className="w-20" />
            <span className="text-sm font-medium">{(sentimentData.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>

        {sentimentData.factors && sentimentData.factors.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Key Factors</p>
            <div className="space-y-1">
              {sentimentData.factors.slice(0, 3).map((factor, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{factor.factor}</span>
                  <div className="flex items-center space-x-1">
                    <span className={`font-medium ${
                      factor.value > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {factor.value > 0 ? '+' : ''}{factor.value.toFixed(2)}
                    </span>
                    <span className="text-gray-400">({(factor.weight * 100).toFixed(0)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );

  const overallSentiment = calculateOverallSentiment();
  const confidenceLevel = calculateConfidenceLevel();

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Market Sentiment</h2>
          <p className="text-muted-foreground">
            Real-time sentiment analysis and market mood tracking
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 bg-muted p-1 rounded-lg">
            {(['1h', '6h', '24h', '7d'] as const).map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overall Sentiment Dashboard */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Overall Market Sentiment</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Activity className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">Overall Score</p>
            <p className={`text-2xl font-bold ${getSentimentColor(overallSentiment)}`}>
              {overallSentiment.toFixed(2)}
            </p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 text-blue-500" />
            <p className="text-sm text-muted-foreground">Confidence</p>
            <p className="text-2xl font-bold">{(confidenceLevel * 100).toFixed(0)}%</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm text-muted-foreground">Bullish</p>
            <p className="text-2xl font-bold">
              {sentiment.filter(s => s.trend === 'bullish').length}
            </p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <TrendingDown className="w-8 h-8 mx-auto mb-2 text-red-500" />
            <p className="text-sm text-muted-foreground">Bearish</p>
            <p className="text-2xl font-bold">
              {sentiment.filter(s => s.trend === 'bearish').length}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium mb-3">Sentiment Distribution</h4>
            <div className="h-48">
              <BaseChart
                type="doughnut"
                data={sentimentDistribution}
                options={PIE_CHART_OPTIONS}
              />
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Category Sentiment</h4>
            <div className="h-48">
              <BaseChart
                type="bar"
                data={categoryData}
                options={BAR_CHART_OPTIONS}
              />
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Sentiment Timeline</h4>
            <div className="h-48">
              <BaseChart
                type="line"
                data={timelineData}
                options={LINE_CHART_OPTIONS}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="sentiment_score">Sentiment Score</option>
            <option value="confidence">Confidence</option>
            <option value="timestamp">Time</option>
          </select>
        </div>

        <Badge variant="secondary" className="animate-pulse">
          <Activity className="w-3 h-3 mr-1" />
          {filteredSentiment.length} signals
        </Badge>
      </div>

      {/* Sentiment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSentiment.map(sentimentData => renderSentimentCard(sentimentData))}
      </div>

      {/* Sentiment Insights */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Sentiment Insights</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-3">Positive Signals</h4>
            <div className="space-y-2">
              {sentiment.filter(s => s.sentiment_score > 0.5).slice(0, 3).map((item, index) => (
                <div key={index} className="flex items-center space-x-2 p-2 bg-green-50 rounded">
                  <ThumbsUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm">{item.category} showing strong positive sentiment</span>
                  <Badge variant="outline" className="ml-auto">
                    {item.sentiment_score.toFixed(2)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Negative Signals</h4>
            <div className="space-y-2">
              {sentiment.filter(s => s.sentiment_score < -0.5).slice(0, 3).map((item, index) => (
                <div key={index} className="flex items-center space-x-2 p-2 bg-red-50 rounded">
                  <ThumbsDown className="w-4 h-4 text-red-500" />
                  <span className="text-sm">{item.category} showing negative sentiment</span>
                  <Badge variant="outline" className="ml-auto">
                    {item.sentiment_score.toFixed(2)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Sentiment Factors */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Key Sentiment Factors</h3>
        
        <div className="space-y-4">
          {sentiment.flatMap(s => s.factors || [])
            .filter(f => Math.abs(f.weight) > 0.3)
            .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
            .slice(0, 5)
            .map((factor, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    factor.value > 0 ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="font-medium">{factor.factor}</p>
                    <p className="text-sm text-muted-foreground">{factor.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${
                    factor.value > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {factor.value > 0 ? '+' : ''}{factor.value.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Weight: {(factor.weight * 100).toFixed(0)}%
                  </p>
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
};