'use client';

import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { BaseChart } from '../analytics/BaseChart';
import { BuyerBehavior as BuyerBehaviorType } from '../../lib/market/marketAnalytics';
import { formatMarketValue, formatPercentageChange } from '../../lib/market/marketAnalytics';
import { useBuyerBehavior } from '../../hooks/useMarketIntelligence';
import { 
  Users, 
  ShoppingCart, 
  DollarSign, 
  Clock, 
  TrendingUp,
  TrendingDown,
  Eye,
  Target,
  Calendar,
  MapPin,
  Star,
  Heart,
  Filter
} from 'lucide-react';
import { Line, Bar, Doughnut, Scatter } from 'react-chartjs-2';
import { CHART_COLORS, LINE_CHART_OPTIONS, BAR_CHART_OPTIONS, PIE_CHART_OPTIONS } from '../../lib/chartConfig';

interface BuyerBehaviorProps {
  behavior: BuyerBehaviorType[];
  className?: string;
}

export const BuyerBehavior: React.FC<BuyerBehaviorProps> = ({ behavior, className }) => {
  const [selectedSegment, setSelectedSegment] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'overview' | 'segments' | 'patterns'>('overview');
  
  const { clv, loading, error } = useBuyerBehavior();

  const segments = ['all', ...behavior.map(b => b.segment)];
  const filteredBehavior = selectedSegment === 'all' 
    ? behavior 
    : behavior.filter(b => b.segment === selectedSegment);

  const getSegmentIcon = (segment: string) => {
    switch (segment.toLowerCase()) {
      case 'premium':
        return <Star className="w-5 h-5 text-yellow-500" />;
      case 'frequent':
        return <Target className="w-5 h-5 text-blue-500" />;
      case 'casual':
        return <Users className="w-5 h-5 text-green-500" />;
      case 'bargain':
        return <DollarSign className="w-5 h-5 text-purple-500" />;
      default:
        return <Users className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSegmentColor = (segment: string) => {
    switch (segment.toLowerCase()) {
      case 'premium':
        return 'border-yellow-200 bg-yellow-50';
      case 'frequent':
        return 'border-blue-200 bg-blue-50';
      case 'casual':
        return 'border-green-200 bg-green-50';
      case 'bargain':
        return 'border-purple-200 bg-purple-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const getLoyaltyBadge = (score: number) => {
    if (score >= 80) return <Badge variant="secondary">Highly Loyal</Badge>;
    if (score >= 60) return <Badge variant="outline">Loyal</Badge>;
    if (score >= 40) return <Badge variant="outline">Moderate</Badge>;
    return <Badge variant="destructive">Low Loyalty</Badge>;
  };

  // Segment size distribution
  const segmentDistribution = {
    labels: behavior.map(b => b.segment),
    datasets: [
      {
        label: 'Segment Size',
        data: behavior.map(b => b.size),
        backgroundColor: CHART_COLORS.primary,
        borderColor: CHART_COLORS.primary,
        borderWidth: 1
      }
    ]
  };

  // Order frequency by segment
  const orderFrequencyData = {
    labels: behavior.map(b => b.segment),
    datasets: [
      {
        label: 'Order Frequency (per month)',
        data: behavior.map(b => b.order_frequency),
        backgroundColor: CHART_COLORS.gradient,
        borderColor: CHART_COLORS.primary[1],
        borderWidth: 2,
        fill: false,
        tension: 0.4
      }
    ]
  };

  // Price sensitivity scatter plot
  const priceSensitivityData = {
    datasets: [
      {
        label: 'Price Sensitivity vs AOV',
        data: behavior.map(b => ({
          x: b.pricesensitivity,
          y: b.avg_order_value
        })),
        backgroundColor: CHART_COLORS.primary[0],
        borderColor: CHART_COLORS.primary[0],
        pointRadius: 8,
        pointHoverRadius: 10
      }
    ]
  };

  const renderSegmentCard = (segment: BuyerBehaviorType) => (
    <Card 
      key={segment.segment} 
      className={`p-4 border-2 transition-all cursor-pointer hover:shadow-md ${
        selectedSegment === segment.segment 
          ? `ring-2 ring-primary ${getSegmentColor(segment.segment)}` 
          : getSegmentColor(segment.segment)
      }`}
      onClick={() => setSelectedSegment(segment.segment)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
            {getSegmentIcon(segment.segment)}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{segment.segment}</h3>
            <p className="text-sm text-muted-foreground">
              {segment.size.toLocaleString()} buyers
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getLoyaltyBadge(segment.behaviorProfile.loyaltyScore)}
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Avg Order Value</p>
            <p className="text-xl font-bold">{formatMarketValue(segment.behaviorProfile.avgOrderValue)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Order Frequency</p>
            <p className="text-xl font-bold">{segment.behaviorProfile.orderFrequency.toFixed(1)}/mo</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Price Sensitivity</span>
            <div className="flex items-center space-x-2">
              <Progress value={segment.behaviorProfile.pricesensitivity} className="w-20" />
              <span className="text-sm font-medium">{segment.behaviorProfile.pricesensitivity.toFixed(0)}%</span>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Loyalty Score</span>
            <div className="flex items-center space-x-2">
              <Progress value={segment.behaviorProfile.loyaltyScore} className="w-20" />
              <span className="text-sm font-medium">{segment.behaviorProfile.loyaltyScore.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">Top Categories</p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(segment.behaviorProfile.categoryPreferences)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 3)
              .map(([category, preference]) => (
                <Badge key={category} variant="outline" className="text-xs">
                  {category} {(preference * 100).toFixed(0)}%
                </Badge>
              ))}
          </div>
        </div>
      </div>
    </Card>
  );

  const renderSeasonalPatterns = (patterns: BuyerBehaviorType['seasonal_patterns']) => (
    <Card className="p-4">
      <h4 className="font-medium mb-3">Seasonal Patterns</h4>
      <div className="space-y-4">
        {patterns.map((pattern, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium capitalize">{pattern.period}</span>
              <Badge variant="outline">Strength: {(pattern.strength * 100).toFixed(0)}%</Badge>
            </div>
            <div className="h-20">
              <BaseChart
                type="line"
                data={{
                  labels: pattern.pattern.map((_, i) => i + 1),
                  datasets: [
                    {
                      label: pattern.period,
                      data: pattern.pattern,
                      borderColor: CHART_COLORS.primary[index % CHART_COLORS.primary.length],
                      backgroundColor: CHART_COLORS.gradient[index % CHART_COLORS.gradient.length],
                      fill: true,
                      tension: 0.4
                    }
                  ]
                }}
                options={{
                  ...LINE_CHART_OPTIONS,
                  plugins: {
                    legend: {
                      display: false
                    }
                  }
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  const renderGeographicDistribution = (distribution: Record<string, number>) => (
    <Card className="p-4">
      <h4 className="font-medium mb-3">Geographic Distribution</h4>
      <div className="space-y-2">
        {Object.entries(distribution)
          .sort(([,a], [,b]) => b - a)
          .map(([country, percentage]) => (
            <div key={country} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{country}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Progress value={percentage} className="w-16" />
                <span className="text-sm font-medium">{percentage.toFixed(1)}%</span>
              </div>
            </div>
          ))}
      </div>
    </Card>
  );

  const calculateTotalSegmentValue = () => {
    return behavior.reduce((sum, b) => sum + (b.size * b.behaviorProfile.avgOrderValue), 0);
  };

  const calculateAverageOrderValue = () => {
    const totalValue = calculateTotalSegmentValue();
    const totalBuyers = behavior.reduce((sum, b) => sum + b.size, 0);
    return totalValue / totalBuyers;
  };

  const calculateWeightedLoyalty = () => {
    const totalWeight = behavior.reduce((sum, b) => sum + b.size, 0);
    const weightedLoyalty = behavior.reduce((sum, b) => sum + (b.behaviorProfile.loyaltyScore * b.size), 0);
    return weightedLoyalty / totalWeight;
  };

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Buyer Behavior Analytics</h2>
          <p className="text-muted-foreground">
            Understand customer segments and purchasing patterns
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 bg-muted p-1 rounded-lg">
            {(['overview', 'segments', 'patterns'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-md text-sm font-medium capitalize transition-colors ${
                  viewMode === mode
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Key Metrics</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Users className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">Total Buyers</p>
            <p className="text-2xl font-bold">
              {behavior.reduce((sum, b) => sum + b.size, 0).toLocaleString()}
            </p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm text-muted-foreground">Avg Order Value</p>
            <p className="text-2xl font-bold">{formatMarketValue(calculateAverageOrderValue())}</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Heart className="w-8 h-8 mx-auto mb-2 text-red-500" />
            <p className="text-sm text-muted-foreground">Avg Loyalty</p>
            <p className="text-2xl font-bold">{calculateWeightedLoyalty().toFixed(1)}%</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Target className="w-8 h-8 mx-auto mb-2 text-blue-500" />
            <p className="text-sm text-muted-foreground">Segments</p>
            <p className="text-2xl font-bold">{behavior.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <h4 className="font-medium mb-3">Segment Distribution</h4>
            <div className="h-48">
              <BaseChart
                type="doughnut"
                data={segmentDistribution}
                options={PIE_CHART_OPTIONS}
              />
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Order Frequency</h4>
            <div className="h-48">
              <BaseChart
                type="line"
                data={orderFrequencyData}
                options={LINE_CHART_OPTIONS}
              />
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Price Sensitivity vs AOV</h4>
            <div className="h-48">
              <BaseChart
                type="scatter"
                data={priceSensitivityData}
                options={{
                  ...LINE_CHART_OPTIONS,
                  scales: {
                    x: {
                      title: {
                        display: true,
                        text: 'Price Sensitivity'
                      }
                    },
                    y: {
                      title: {
                        display: true,
                        text: 'Average Order Value'
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Segment Filter */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={selectedSegment}
            onChange={(e) => setSelectedSegment(e.target.value)}
            className="px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            {segments.map(segment => (
              <option key={segment} value={segment}>
                {segment === 'all' ? 'All Segments' : segment}
              </option>
            ))}
          </select>
        </div>
        <Badge variant="secondary">
          {filteredBehavior.length} segments
        </Badge>
      </div>

      {/* Segment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBehavior.map(segment => renderSegmentCard(segment))}
      </div>

      {/* Detailed Analysis */}
      {selectedSegment !== 'all' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredBehavior.map(segment => (
            <React.Fragment key={segment.segment}>
              {renderSeasonalPatterns(segment.seasonal_patterns)}
              {renderGeographicDistribution(segment.geographic_distribution)}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Customer Lifetime Value */}
      {clv && clv.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Customer Lifetime Value</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {clv.slice(0, 4).map((item, index) => (
              <div key={index} className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-primary font-bold">{index + 1}</span>
                </div>
                <p className="text-sm text-muted-foreground">{item.segment || 'Segment'}</p>
                <p className="text-xl font-bold">{formatMarketValue(item.clv || 0)}</p>
                <p className="text-xs text-muted-foreground">
                  {item.orders || 0} orders • {item.retention || 0}% retention
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Behavioral Insights */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Behavioral Insights</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-3">High-Value Segments</h4>
            <div className="space-y-2">
              {behavior
                .sort((a, b) => b.behaviorProfile.avgOrderValue - a.behaviorProfile.avgOrderValue)
                .slice(0, 3)
                .map((segment, index) => (
                  <div key={index} className="flex items-center space-x-2 p-2 bg-green-50 rounded">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-sm">{segment.segment}</span>
                    <Badge variant="outline" className="ml-auto">
                      {formatMarketValue(segment.behaviorProfile.avgOrderValue)}
                    </Badge>
                  </div>
                ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Loyal Customers</h4>
            <div className="space-y-2">
              {behavior
                .sort((a, b) => b.behaviorProfile.loyaltyScore - a.behaviorProfile.loyaltyScore)
                .slice(0, 3)
                .map((segment, index) => (
                  <div key={index} className="flex items-center space-x-2 p-2 bg-blue-50 rounded">
                    <Heart className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">{segment.segment}</span>
                    <Badge variant="outline" className="ml-auto">
                      {segment.behaviorProfile.loyaltyScore.toFixed(0)}%
                    </Badge>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};