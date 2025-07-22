"use client";

import { useMemo, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Package, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Settings,
  Target,
  Truck
} from "lucide-react";
import BaseChart from './BaseChart';
import { BAR_CHART_OPTIONS, PIE_CHART_OPTIONS, TIME_SERIES_OPTIONS, COLORS, formatCurrency } from '@/lib/chartConfig';

interface SupplyChainRecommendationData {
  recommendations: Array<{
    category: string;
    currentStock: number;
    recommendedStock: number;
    reasoning: string;
    confidence: number;
    timeframe: 'immediate' | 'short_term' | 'long_term';
    impact: 'high' | 'medium' | 'low';
  }>;
  optimization: {
    totalCostSavings: number;
    stockoutRiskReduction: number;
    recommendedActions: string[];
  };
}

interface SupplyChainOptimizationProps {
  data: SupplyChainRecommendationData | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export default function SupplyChainOptimization({
  data,
  isLoading,
  onRefresh
}: SupplyChainOptimizationProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'all' | 'immediate' | 'short_term' | 'long_term'>('all');
  const [selectedImpact, setSelectedImpact] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const stockAdjustmentData = useMemo(() => {
    if (!data) return null;

    const filteredRecommendations = data.recommendations.filter(r => 
      (selectedTimeframe === 'all' || r.timeframe === selectedTimeframe) &&
      (selectedImpact === 'all' || r.impact === selectedImpact)
    );

    return {
      labels: filteredRecommendations.map(r => r.category),
      datasets: [
        {
          label: 'Current Stock',
          data: filteredRecommendations.map(r => r.currentStock),
          backgroundColor: COLORS.neutral,
          borderColor: COLORS.neutral,
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Recommended Stock',
          data: filteredRecommendations.map(r => r.recommendedStock),
          backgroundColor: COLORS.primary,
          borderColor: COLORS.primary,
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
        }
      ]
    };
  }, [data, selectedTimeframe, selectedImpact]);

  const stockChangeData = useMemo(() => {
    if (!data) return null;

    const stockChanges = data.recommendations.map(r => ({
      category: r.category,
      change: ((r.recommendedStock - r.currentStock) / r.currentStock) * 100,
      impact: r.impact,
      timeframe: r.timeframe
    }));

    return {
      labels: stockChanges.map(s => s.category),
      datasets: [{
        label: 'Stock Change (%)',
        data: stockChanges.map(s => s.change),
        backgroundColor: stockChanges.map(s => 
          s.change > 0 ? COLORS.success : 
          s.change < 0 ? COLORS.error : 
          COLORS.neutral
        ),
        borderColor: stockChanges.map(s => 
          s.change > 0 ? COLORS.success : 
          s.change < 0 ? COLORS.error : 
          COLORS.neutral
        ),
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }]
    };
  }, [data]);

  const impactDistributionData = useMemo(() => {
    if (!data) return null;

    const impactCounts = data.recommendations.reduce((acc, r) => {
      acc[r.impact] = (acc[r.impact] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      labels: Object.keys(impactCounts).map(key => key.charAt(0).toUpperCase() + key.slice(1)),
      datasets: [{
        label: 'Impact Distribution',
        data: Object.values(impactCounts),
        backgroundColor: [
          COLORS.error,     // high
          COLORS.warning,   // medium
          COLORS.info       // low
        ],
        borderColor: [
          COLORS.error,
          COLORS.warning,
          COLORS.info
        ],
        borderWidth: 2,
      }]
    };
  }, [data]);

  const timeframeDistributionData = useMemo(() => {
    if (!data) return null;

    const timeframeCounts = data.recommendations.reduce((acc, r) => {
      acc[r.timeframe] = (acc[r.timeframe] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      labels: Object.keys(timeframeCounts).map(key => 
        key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
      ),
      datasets: [{
        label: 'Timeframe Distribution',
        data: Object.values(timeframeCounts),
        backgroundColor: [
          COLORS.error,     // immediate
          COLORS.warning,   // short_term
          COLORS.success    // long_term
        ],
        borderColor: [
          COLORS.error,
          COLORS.warning,
          COLORS.success
        ],
        borderWidth: 2,
      }]
    };
  }, [data]);

  const chartOptions = useMemo(() => ({
    ...BAR_CHART_OPTIONS,
    scales: {
      ...BAR_CHART_OPTIONS.scales,
      y: {
        ...BAR_CHART_OPTIONS.scales?.y,
        title: {
          display: true,
          text: 'Stock Units'
        }
      }
    }
  }), []);

  const pieOptions = useMemo(() => ({
    ...PIE_CHART_OPTIONS,
    plugins: {
      ...PIE_CHART_OPTIONS.plugins,
      legend: {
        position: 'bottom' as const,
      }
    }
  }), []);

  const getImpactIcon = (impact: 'high' | 'medium' | 'low') => {
    switch (impact) {
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
  };

  const getImpactBadge = (impact: 'high' | 'medium' | 'low') => {
    switch (impact) {
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="default" className="bg-yellow-500">Medium</Badge>;
      default:
        return <Badge variant="default" className="bg-green-500">Low</Badge>;
    }
  };

  const getTimeframeBadge = (timeframe: 'immediate' | 'short_term' | 'long_term') => {
    switch (timeframe) {
      case 'immediate':
        return <Badge variant="destructive">Immediate</Badge>;
      case 'short_term':
        return <Badge variant="default" className="bg-orange-500">Short Term</Badge>;
      default:
        return <Badge variant="secondary">Long Term</Badge>;
    }
  };

  const getUrgentRecommendations = () => {
    if (!data) return [];
    
    return data.recommendations.filter(r => 
      r.timeframe === 'immediate' && r.impact === 'high'
    );
  };

  const getOptimizationOpportunities = () => {
    if (!data) return [];
    
    return data.recommendations.filter(r => 
      Math.abs(r.recommendedStock - r.currentStock) / r.currentStock > 0.2
    );
  };

  const urgentRecommendations = getUrgentRecommendations();
  const optimizationOpportunities = getOptimizationOpportunities();

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Timeframe:</span>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'All' },
              { value: 'immediate', label: 'Immediate' },
              { value: 'short_term', label: 'Short Term' },
              { value: 'long_term', label: 'Long Term' }
            ].map((timeframe) => (
              <Button
                key={timeframe.value}
                variant={selectedTimeframe === timeframe.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedTimeframe(timeframe.value as any)}
              >
                {timeframe.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Impact:</span>
          <div className="flex gap-1">
            {[
              { value: 'all', label: 'All' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' }
            ].map((impact) => (
              <Button
                key={impact.value}
                variant={selectedImpact === impact.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedImpact(impact.value as any)}
              >
                {impact.label}
              </Button>
            ))}
          </div>
        </div>

        <Button onClick={onRefresh} disabled={isLoading} size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.optimization.totalCostSavings ? formatCurrency(data.optimization.totalCostSavings) : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              Potential savings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Risk Reduction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.optimization.stockoutRiskReduction ? 
                `${Math.round(data.optimization.stockoutRiskReduction * 100)}%` : '--'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Stockout risk reduction
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Urgent Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {urgentRecommendations.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Immediate actions needed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Optimization Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {optimizationOpportunities.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Significant adjustments
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BaseChart
          title="Stock Adjustment Recommendations"
          description="Current vs recommended stock levels"
          exportFilename="stock-adjustments"
          loading={isLoading}
        >
          {stockAdjustmentData && !isLoading ? (
            <Bar data={stockAdjustmentData} options={chartOptions} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {isLoading ? 'Analyzing supply chain...' : 'No supply chain data available'}
                </p>
              </div>
            </div>
          )}
        </BaseChart>

        <BaseChart
          title="Stock Change Percentage"
          description="Recommended stock changes by category"
          exportFilename="stock-changes"
          loading={isLoading}
        >
          {stockChangeData && !isLoading ? (
            <Bar data={stockChangeData} options={chartOptions} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {isLoading ? 'Loading...' : 'No change data'}
                </p>
              </div>
            </div>
          )}
        </BaseChart>
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BaseChart
          title="Impact Distribution"
          description="Distribution of recommendations by impact level"
          exportFilename="impact-distribution"
          loading={isLoading}
        >
          {impactDistributionData && !isLoading ? (
            <Doughnut data={impactDistributionData} options={pieOptions} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {isLoading ? 'Loading...' : 'No distribution data'}
                </p>
              </div>
            </div>
          )}
        </BaseChart>

        <BaseChart
          title="Timeframe Distribution"
          description="Distribution of recommendations by timeframe"
          exportFilename="timeframe-distribution"
          loading={isLoading}
        >
          {timeframeDistributionData && !isLoading ? (
            <Doughnut data={timeframeDistributionData} options={pieOptions} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {isLoading ? 'Loading...' : 'No timeframe data'}
                </p>
              </div>
            </div>
          )}
        </BaseChart>
      </div>

      {/* Urgent Recommendations */}
      {urgentRecommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Urgent Recommendations
            </CardTitle>
            <CardDescription>
              These recommendations require immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {urgentRecommendations.map((rec, index) => (
                <div key={index} className="p-4 border border-red-200 rounded-lg bg-red-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <Package className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">{rec.category}</h4>
                        <p className="text-sm text-muted-foreground">
                          Stock adjustment needed
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getImpactBadge(rec.impact)}
                      {getTimeframeBadge(rec.timeframe)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Current Stock</div>
                      <div className="text-2xl font-bold">{rec.currentStock}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Recommended</div>
                      <div className="text-2xl font-bold text-blue-600">{rec.recommendedStock}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Change</div>
                      <div className={`text-2xl font-bold ${
                        rec.recommendedStock > rec.currentStock ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {rec.recommendedStock > rec.currentStock ? '+' : ''}
                        {rec.recommendedStock - rec.currentStock}
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-red-200">
                    <div className="text-sm font-medium mb-1">Reasoning</div>
                    <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            All Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data?.recommendations.map((rec, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      {getImpactIcon(rec.impact)}
                    </div>
                    <div>
                      <h4 className="font-medium">{rec.category}</h4>
                      <p className="text-sm text-muted-foreground">
                        Confidence: {Math.round(rec.confidence * 100)}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getImpactBadge(rec.impact)}
                    {getTimeframeBadge(rec.timeframe)}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Current Stock</div>
                    <div className="text-xl font-bold">{rec.currentStock}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Recommended</div>
                    <div className="text-xl font-bold text-blue-600">{rec.recommendedStock}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Change</div>
                    <div className={`text-xl font-bold ${
                      rec.recommendedStock > rec.currentStock ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {rec.recommendedStock > rec.currentStock ? '+' : ''}
                      {rec.recommendedStock - rec.currentStock}
                    </div>
                  </div>
                </div>
                
                <div className="pt-3 border-t">
                  <div className="text-sm font-medium mb-1">Reasoning</div>
                  <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Optimization Summary */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Optimization Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-3">Potential Benefits</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Cost Savings</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(data.optimization.totalCostSavings)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Stockout Risk Reduction</span>
                    <span className="font-bold text-blue-600">
                      {Math.round(data.optimization.stockoutRiskReduction * 100)}%
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-3">Recommended Actions</h4>
                <ul className="space-y-2">
                  {data.optimization.recommendedActions.map((action, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}