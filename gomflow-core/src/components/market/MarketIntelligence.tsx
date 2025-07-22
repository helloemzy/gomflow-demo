'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { LiveTrends } from './LiveTrends';
import { CompetitiveAnalysis } from './CompetitiveAnalysis';
import { PriceOptimization } from './PriceOptimization';
import { MarketSentiment } from './MarketSentiment';
import { BuyerBehavior } from './BuyerBehavior';
import { OpportunityAlerts } from './OpportunityAlerts';
import { useMarketIntelligence } from '../../hooks/useMarketIntelligence';
import { formatMarketValue, formatPercentageChange } from '../../lib/market/marketAnalytics';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Users, 
  DollarSign, 
  Globe, 
  Target, 
  BarChart3,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';

interface MarketIntelligenceProps {
  className?: string;
}

export const MarketIntelligence: React.FC<MarketIntelligenceProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const {
    liveData,
    trendingProducts,
    competitors,
    sentiment,
    buyerBehavior,
    opportunities,
    geographicTrends,
    loading,
    error,
    refreshData,
    isConnected
  } = useMarketIntelligence(true, 30000);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'trends', label: 'Live Trends', icon: TrendingUp },
    { id: 'competitors', label: 'Competitors', icon: Target },
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'sentiment', label: 'Sentiment', icon: Activity },
    { id: 'buyers', label: 'Buyers', icon: Users },
    { id: 'opportunities', label: 'Opportunities', icon: Globe }
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Live Market Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Orders</p>
              <p className="text-2xl font-bold">{liveData?.active_orders || 0}</p>
            </div>
            <Activity className="w-8 h-8 text-blue-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Submissions</p>
              <p className="text-2xl font-bold">{liveData?.total_submissions || 0}</p>
            </div>
            <Users className="w-8 h-8 text-green-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Revenue Velocity</p>
              <p className="text-2xl font-bold">{formatMarketValue(liveData?.revenue_velocity || 0)}/hr</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Sentiment Index</p>
              <p className="text-2xl font-bold">{liveData?.sentiment_index?.toFixed(1) || '0.0'}</p>
            </div>
            <Activity className="w-8 h-8 text-orange-500" />
          </div>
        </Card>
      </div>

      {/* Top Trending Products */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Top Trending Products</h3>
          <Badge variant="secondary">Live</Badge>
        </div>
        
        <div className="space-y-3">
          {trendingProducts.slice(0, 5).map((product, index) => (
            <div key={product.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">#{index + 1}</span>
                </div>
                <div>
                  <p className="font-medium">{product.product}</p>
                  <p className="text-sm text-muted-foreground">{product.category}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm font-medium">Score: {product.trending_score.toFixed(1)}</p>
                  <div className="flex items-center space-x-1">
                    {product.velocity > 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {formatPercentageChange(product.velocity)}
                    </span>
                  </div>
                </div>
                
                <Badge variant={product.price_change > 0 ? 'destructive' : 'secondary'}>
                  {formatPercentageChange(product.price_change)}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Geographic Activity */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Geographic Activity</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {liveData?.geographic_activity?.map((geo, index) => (
            <div key={index} className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">{geo.country}</h4>
                <Badge variant="outline">{geo.active_orders} orders</Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Submission Rate</span>
                  <span>{formatPercentageChange(geo.submission_rate)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Avg Order Value</span>
                  <span>{formatMarketValue(geo.avg_order_value)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Growth Rate</span>
                  <span className={geo.growth_rate > 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatPercentageChange(geo.growth_rate)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Quick Insights */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Insights</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">TOP PERFORMERS</h4>
            {competitors.slice(0, 3).map((competitor, index) => (
              <div key={competitor.competitor_id} className="flex items-center justify-between">
                <span className="text-sm">{competitor.competitor_name}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{competitor.market_share.toFixed(1)}%</span>
                  <Badge variant="outline" className="text-xs">
                    {competitor.success_rate.toFixed(0)}% success
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">OPPORTUNITIES</h4>
            {opportunities.slice(0, 3).map((opportunity, index) => (
              <div key={opportunity.id} className="flex items-center justify-between">
                <span className="text-sm">{opportunity.title}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{opportunity.opportunity_score.toFixed(0)}</span>
                  <Badge variant="secondary" className="text-xs">
                    {opportunity.difficulty}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'trends':
        return <LiveTrends trends={trendingProducts} />;
      case 'competitors':
        return <CompetitiveAnalysis competitors={competitors} />;
      case 'pricing':
        return <PriceOptimization />;
      case 'sentiment':
        return <MarketSentiment sentiment={sentiment} />;
      case 'buyers':
        return <BuyerBehavior behavior={buyerBehavior} />;
      case 'opportunities':
        return <OpportunityAlerts opportunities={opportunities} />;
      default:
        return renderOverview();
    }
  };

  if (loading && !liveData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading market intelligence...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <div className="text-red-500 mb-4">
          <Activity className="w-12 h-12 mx-auto mb-2" />
          <p className="font-medium">Failed to load market data</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
          Retry
        </Button>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Market Intelligence</h1>
          <p className="text-muted-foreground">
            Real-time insights and competitive analysis
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-500" />
            )}
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9"
          >
            {refreshing ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {renderTabContent()}
      </div>
    </div>
  );
};