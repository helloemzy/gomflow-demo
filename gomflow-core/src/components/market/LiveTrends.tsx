'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { BaseChart } from '../analytics/BaseChart';
import { MarketTrend } from '../../lib/market/marketAnalytics';
import { formatMarketValue, formatPercentageChange } from '../../lib/market/marketAnalytics';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Clock, 
  MapPin, 
  Filter,
  Search,
  Zap,
  Fire,
  Star,
  Eye
} from 'lucide-react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { CHART_COLORS, LINE_CHART_OPTIONS, BAR_CHART_OPTIONS, PIE_CHART_OPTIONS } from '../../lib/chartConfig';

interface LiveTrendsProps {
  trends: MarketTrend[];
  className?: string;
}

export const LiveTrends: React.FC<LiveTrendsProps> = ({ trends, className }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'trending_score' | 'velocity' | 'volume_change'>('trending_score');
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');

  const filteredTrends = trends.filter(trend => {
    const matchesCategory = selectedCategory === 'all' || trend.category === selectedCategory;
    const matchesSearch = trend.product.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  }).sort((a, b) => b[sortBy] - a[sortBy]);

  const categories = ['all', ...Array.from(new Set(trends.map(t => t.category)))];

  const getTrendIcon = (velocity: number) => {
    if (velocity > 20) return <Fire className="w-4 h-4 text-red-500" />;
    if (velocity > 10) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (velocity > 0) return <Star className="w-4 h-4 text-yellow-500" />;
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  };

  const getTrendBadge = (score: number) => {
    if (score > 80) return <Badge variant="destructive">Hot</Badge>;
    if (score > 60) return <Badge variant="secondary">Trending</Badge>;
    if (score > 40) return <Badge variant="outline">Rising</Badge>;
    return <Badge variant="outline">Stable</Badge>;
  };

  const getVelocityColor = (velocity: number) => {
    if (velocity > 20) return 'text-red-500';
    if (velocity > 10) return 'text-green-500';
    if (velocity > 0) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Chart data for trending scores over time
  const trendingScoreData = {
    labels: filteredTrends.slice(0, 10).map(t => t.product),
    datasets: [
      {
        label: 'Trending Score',
        data: filteredTrends.slice(0, 10).map(t => t.trending_score),
        borderColor: CHART_COLORS.primary[0],
        backgroundColor: CHART_COLORS.gradient[0],
        fill: true,
        tension: 0.4
      }
    ]
  };

  // Chart data for velocity comparison
  const velocityData = {
    labels: filteredTrends.slice(0, 8).map(t => t.product),
    datasets: [
      {
        label: 'Velocity (%)',
        data: filteredTrends.slice(0, 8).map(t => t.velocity),
        backgroundColor: filteredTrends.slice(0, 8).map(t => 
          t.velocity > 0 ? CHART_COLORS.primary[2] : CHART_COLORS.primary[3]
        ),
        borderColor: filteredTrends.slice(0, 8).map(t => 
          t.velocity > 0 ? CHART_COLORS.primary[2] : CHART_COLORS.primary[3]
        ),
        borderWidth: 1
      }
    ]
  };

  // Chart data for category distribution
  const categoryData = {
    labels: categories.filter(c => c !== 'all'),
    datasets: [
      {
        data: categories.filter(c => c !== 'all').map(category => 
          trends.filter(t => t.category === category).length
        ),
        backgroundColor: CHART_COLORS.primary,
        borderColor: CHART_COLORS.primary,
        borderWidth: 1
      }
    ]
  };

  const renderTrendCard = (trend: MarketTrend, index: number) => (
    <Card key={trend.id} className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
            {getTrendIcon(trend.velocity)}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{trend.product}</h3>
            <p className="text-sm text-muted-foreground">{trend.category}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getTrendBadge(trend.trending_score)}
          <Badge variant="outline" className="text-xs">
            #{index + 1}
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Trending Score</span>
          <div className="flex items-center space-x-2">
            <Progress value={trend.trending_score} className="w-20" />
            <span className="text-sm font-medium">{trend.trending_score.toFixed(1)}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <p className="text-muted-foreground">Velocity</p>
            <p className={`font-medium ${getVelocityColor(trend.velocity)}`}>
              {formatPercentageChange(trend.velocity)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Price Change</p>
            <p className={`font-medium ${trend.price_change > 0 ? 'text-red-500' : 'text-green-500'}`}>
              {formatPercentageChange(trend.price_change)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Volume</p>
            <p className={`font-medium ${trend.volume_change > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatPercentageChange(trend.volume_change)}
            </p>
          </div>
        </div>

        {trend.geographic_data && trend.geographic_data.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Top Regions</p>
            <div className="flex flex-wrap gap-1">
              {trend.geographic_data.slice(0, 3).map((geo, geoIndex) => (
                <Badge key={geoIndex} variant="outline" className="text-xs">
                  {geo.country} {geo.demand_score.toFixed(0)}%
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Live Market Trends</h2>
          <p className="text-muted-foreground">Real-time product trends and market movements</p>
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

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
            <option value="trending_score">Trending Score</option>
            <option value="velocity">Velocity</option>
            <option value="volume_change">Volume Change</option>
          </select>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Trending Scores</h3>
          <div className="h-64">
            <BaseChart
              type="line"
              data={trendingScoreData}
              options={LINE_CHART_OPTIONS}
            />
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-4">Velocity Comparison</h3>
          <div className="h-64">
            <BaseChart
              type="bar"
              data={velocityData}
              options={BAR_CHART_OPTIONS}
            />
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-4">Category Distribution</h3>
          <div className="h-64">
            <BaseChart
              type="doughnut"
              data={categoryData}
              options={PIE_CHART_OPTIONS}
            />
          </div>
        </Card>
      </div>

      {/* Top Trends Summary */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Top Trending Products</h3>
          <Badge variant="secondary" className="animate-pulse">
            <Activity className="w-3 h-3 mr-1" />
            Live
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTrends.slice(0, 9).map((trend, index) => renderTrendCard(trend, index))}
        </div>

        {filteredTrends.length === 0 && (
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No trends found matching your criteria</p>
          </div>
        )}
      </Card>

      {/* Market Pulse */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Market Pulse</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Fire className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-sm text-muted-foreground">Hot Products</p>
            <p className="text-2xl font-bold">
              {trends.filter(t => t.trending_score > 80).length}
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground">Rising</p>
            <p className="text-2xl font-bold">
              {trends.filter(t => t.velocity > 0).length}
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <Star className="w-8 h-8 text-yellow-500" />
            </div>
            <p className="text-sm text-muted-foreground">Stable</p>
            <p className="text-2xl font-bold">
              {trends.filter(t => t.velocity === 0).length}
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <TrendingDown className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-sm text-muted-foreground">Declining</p>
            <p className="text-2xl font-bold">
              {trends.filter(t => t.velocity < 0).length}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};