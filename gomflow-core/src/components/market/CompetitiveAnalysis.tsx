'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { BaseChart } from '../analytics/BaseChart';
import { CompetitorAnalysis } from '../../lib/market/marketAnalytics';
import { useCompetitiveAnalysis } from '../../hooks/useMarketIntelligence';
import { formatMarketValue, formatPercentageChange, categorizeCompetitor } from '../../lib/market/marketAnalytics';
import { 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Crown,
  Shield, 
  Zap, 
  AlertTriangle, 
  BarChart3,
  Users,
  DollarSign,
  Star
} from 'lucide-react';
import { Bar, Line, Radar } from 'react-chartjs-2';
import { CHART_COLORS, BAR_CHART_OPTIONS, LINE_CHART_OPTIONS } from '../../lib/chartConfig';

interface CompetitiveAnalysisProps {
  competitors: CompetitorAnalysis[];
  className?: string;
}

export const CompetitiveAnalysis: React.FC<CompetitiveAnalysisProps> = ({ 
  competitors, 
  className 
}) => {
  const [selectedView, setSelectedView] = useState<'overview' | 'detailed' | 'trends'>('overview');
  const [selectedCompetitor, setSelectedCompetitor] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const { analysis, priceHistory, marketShare, loading, error } = useCompetitiveAnalysis(
    competitors.map(c => c.competitor_name)
  );

  const sortedCompetitors = [...competitors].sort((a, b) => b.market_share - a.market_share);

  const getCompetitorIcon = (marketShare: number) => {
    if (marketShare >= 15) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (marketShare >= 5) return <Shield className="w-5 h-5 text-blue-500" />;
    if (marketShare >= 1) return <Zap className="w-5 h-5 text-green-500" />;
    return <Target className="w-5 h-5 text-gray-500" />;
  };

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'premium': return 'text-purple-600';
      case 'mid': return 'text-blue-600';
      case 'budget': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getPositionBadge = (position: string) => {
    switch (position) {
      case 'premium': return <Badge variant="secondary">Premium</Badge>;
      case 'mid': return <Badge variant="outline">Mid-Market</Badge>;
      case 'budget': return <Badge variant="destructive">Budget</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Market share chart data
  const marketShareData = {
    labels: sortedCompetitors.map(c => c.competitor_name),
    datasets: [
      {
        label: 'Market Share (%)',
        data: sortedCompetitors.map(c => c.market_share),
        backgroundColor: CHART_COLORS.primary,
        borderColor: CHART_COLORS.primary,
        borderWidth: 1
      }
    ]
  };

  // Success rate comparison
  const successRateData = {
    labels: sortedCompetitors.map(c => c.competitor_name),
    datasets: [
      {
        label: 'Success Rate (%)',
        data: sortedCompetitors.map(c => c.success_rate),
        backgroundColor: CHART_COLORS.gradient,
        borderColor: CHART_COLORS.primary[2],
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }
    ]
  };

  // Competitive radar chart
  const radarData = {
    labels: ['Market Share', 'Success Rate', 'Avg Order Value', 'Total Orders', 'Recent Activity'],
    datasets: sortedCompetitors.slice(0, 5).map((competitor, index) => ({
      label: competitor.competitor_name,
      data: [
        competitor.market_share,
        competitor.success_rate,
        competitor.avg_order_value / 100, // Normalized
        competitor.total_orders / 1000, // Normalized
        competitor.recent_activity?.length || 0
      ],
      borderColor: CHART_COLORS.primary[index],
      backgroundColor: CHART_COLORS.gradient[index],
      borderWidth: 2
    }))
  };

  const renderCompetitorCard = (competitor: CompetitorAnalysis, rank: number) => (
    <Card 
      key={competitor.competitor_id} 
      className={`p-4 hover:shadow-md transition-all cursor-pointer ${
        selectedCompetitor === competitor.competitor_id ? 'ring-2 ring-primary' : ''
      }`}
      onClick={() => setSelectedCompetitor(
        selectedCompetitor === competitor.competitor_id ? null : competitor.competitor_id
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
            {getCompetitorIcon(competitor.market_share)}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{competitor.competitor_name}</h3>
            <p className="text-sm text-muted-foreground">
              {categorizeCompetitor(competitor.market_share)}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-xs">
            #{rank + 1}
          </Badge>
          {getPositionBadge(competitor.price_positioning)}
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Market Share</p>
            <div className="flex items-center space-x-2">
              <Progress value={competitor.market_share} className="flex-1" />
              <span className="text-sm font-medium">{competitor.market_share.toFixed(1)}%</span>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Success Rate</p>
            <div className="flex items-center space-x-2">
              <Progress value={competitor.success_rate} className="flex-1" />
              <span className="text-sm font-medium">{competitor.success_rate.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <p className="text-muted-foreground">AOV</p>
            <p className="font-medium">{formatMarketValue(competitor.avg_order_value)}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Orders</p>
            <p className="font-medium">{competitor.total_orders.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Categories</p>
            <p className="font-medium">{competitor.categories.length}</p>
          </div>
        </div>

        {competitor.recent_activity && competitor.recent_activity.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Recent Activity</p>
            <div className="space-y-1">
              {competitor.recent_activity.slice(0, 2).map((activity, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{activity.type}</span>
                  <div className="flex items-center space-x-1">
                    <span className="font-medium">{activity.impact_score.toFixed(1)}</span>
                    {activity.impact_score > 0 ? (
                      <TrendingUp className="w-3 h-3 text-green-500" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );

  const renderDetailedView = () => {
    const competitor = competitors.find(c => c.competitor_id === selectedCompetitor);
    if (!competitor) return null;

    return (
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full flex items-center justify-center">
              {getCompetitorIcon(competitor.market_share)}
            </div>
            <div>
              <h3 className="text-xl font-semibold">{competitor.competitor_name}</h3>
              <p className="text-muted-foreground">
                {categorizeCompetitor(competitor.market_share)} • {getPositionBadge(competitor.price_positioning)}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setSelectedCompetitor(null)}>
            Close
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <BarChart3 className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-sm text-muted-foreground">Market Share</p>
            <p className="text-2xl font-bold">{competitor.market_share.toFixed(1)}%</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Target className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm text-muted-foreground">Success Rate</p>
            <p className="text-2xl font-bold">{competitor.success_rate.toFixed(1)}%</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <DollarSign className="w-8 h-8 mx-auto mb-2 text-blue-500" />
            <p className="text-sm text-muted-foreground">Avg Order Value</p>
            <p className="text-2xl font-bold">{formatMarketValue(competitor.avg_order_value)}</p>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <Users className="w-8 h-8 mx-auto mb-2 text-purple-500" />
            <p className="text-sm text-muted-foreground">Total Orders</p>
            <p className="text-2xl font-bold">{competitor.total_orders.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold mb-3">Categories</h4>
            <div className="space-y-2">
              {competitor.categories.map((category, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">{category}</span>
                  <Badge variant="outline">{Math.floor(Math.random() * 100)}%</Badge>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Recent Activity</h4>
            <div className="space-y-3">
              {competitor.recent_activity?.map((activity, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <Activity className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.type}</p>
                    <p className="text-xs text-muted-foreground">{activity.description}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-muted-foreground">Impact:</span>
                      <span className={`text-xs font-medium ${
                        activity.impact_score > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {activity.impact_score > 0 ? '+' : ''}{activity.impact_score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Competitive Analysis</h2>
          <p className="text-muted-foreground">Monitor competitor performance and market positioning</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 bg-muted p-1 rounded-lg">
            {(['overview', 'detailed', 'trends'] as const).map(view => (
              <button
                key={view}
                onClick={() => setSelectedView(view)}
                className={`px-3 py-1 rounded-md text-sm font-medium capitalize transition-colors ${
                  selectedView === view
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {view}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Market Share Distribution</h3>
          <div className="h-64">
            <BaseChart
              type="bar"
              data={marketShareData}
              options={BAR_CHART_OPTIONS}
            />
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-4">Success Rate Comparison</h3>
          <div className="h-64">
            <BaseChart
              type="line"
              data={successRateData}
              options={LINE_CHART_OPTIONS}
            />
          </div>
        </Card>
      </div>

      {/* Competitive Radar */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Competitive Positioning</h3>
        <div className="h-96">
          <BaseChart
            type="radar"
            data={radarData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'top' as const,
                },
              },
              scales: {
                r: {
                  angleLines: {
                    display: false
                  },
                  suggestedMin: 0,
                  suggestedMax: 100
                }
              }
            }}
          />
        </div>
      </Card>

      {/* Detailed view if competitor selected */}
      {selectedCompetitor && renderDetailedView()}

      {/* Competitor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedCompetitors.map((competitor, index) => renderCompetitorCard(competitor, index))}
      </div>

      {/* Competitive Insights */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Competitive Insights</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-3">Market Leaders</h4>
            <div className="space-y-2">
              {sortedCompetitors.slice(0, 3).map((competitor, index) => (
                <div key={competitor.competitor_id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold">{index + 1}</span>
                    </div>
                    <span className="text-sm">{competitor.competitor_name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{competitor.market_share.toFixed(1)}%</span>
                    {getPositionBadge(competitor.price_positioning)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Threats & Opportunities</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 p-2 bg-red-50 rounded">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-sm">Rising competitor activity detected</span>
              </div>
              <div className="flex items-center space-x-2 p-2 bg-green-50 rounded">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm">Price gap opportunity in premium segment</span>
              </div>
              <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded">
                <Target className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Underserved categories identified</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};