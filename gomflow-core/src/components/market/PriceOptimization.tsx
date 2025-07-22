'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { BaseChart } from '../analytics/BaseChart';
import { useMarketIntelligence } from '../../hooks/useMarketIntelligence';
import { formatMarketValue, formatPercentageChange } from '../../lib/market/marketAnalytics';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Target, 
  AlertTriangle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Calculator,
  BarChart3,
  Search,
  RefreshCw
} from 'lucide-react';
import { Line, Bar, Scatter } from 'react-chartjs-2';
import { CHART_COLORS, LINE_CHART_OPTIONS, BAR_CHART_OPTIONS } from '../../lib/chartConfig';

interface PriceOptimizationProps {
  className?: string;
}

interface PriceAnalysis {
  product: string;
  current_price: number;
  optimal_price: number;
  competitor_avg: number;
  demand_elasticity: number;
  revenue_impact: number;
  confidence: number;
  recommendation: 'increase' | 'decrease' | 'maintain';
}

export const PriceOptimization: React.FC<PriceOptimizationProps> = ({ className }) => {
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [priceAnalysis, setPriceAnalysis] = useState<PriceAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const { 
    getPriceOptimization, 
    getCompetitorPriceHistory,
    trendingProducts 
  } = useMarketIntelligence();

  const products = trendingProducts.map(t => t.product);
  const filteredProducts = products.filter(p => 
    p.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const loadPriceAnalysis = async (product: string) => {
    setLoading(true);
    try {
      const optimization = await getPriceOptimization(product);
      const priceHistory = await getCompetitorPriceHistory(product, 30);
      
      if (optimization) {
        const analysis: PriceAnalysis = {
          product: product,
          current_price: optimization.current_price,
          optimal_price: optimization.optimal_price,
          competitor_avg: optimization.competitor_prices.reduce((sum, p) => sum + p.price, 0) / optimization.competitor_prices.length,
          demand_elasticity: optimization.price_elasticity,
          revenue_impact: optimization.expected_revenue_change,
          confidence: optimization.confidence,
          recommendation: optimization.optimal_price > optimization.current_price ? 'increase' : 
                         optimization.optimal_price < optimization.current_price ? 'decrease' : 'maintain'
        };
        
        setPriceAnalysis(prev => [analysis, ...prev.filter(p => p.product !== product)]);
      }
    } catch (error) {
      console.error('Failed to load price analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (product: string) => {
    setSelectedProduct(product);
    loadPriceAnalysis(product);
  };

  const generateDemandCurve = (analysis: PriceAnalysis) => {
    const pricePoints = [];
    const demandPoints = [];
    
    for (let i = 0.5; i <= 2; i += 0.1) {
      const price = analysis.current_price * i;
      const demand = 100 * Math.pow(i, analysis.demand_elasticity);
      pricePoints.push(price);
      demandPoints.push(demand);
    }
    
    return {
      labels: pricePoints.map(p => formatMarketValue(p)),
      datasets: [
        {
          label: 'Demand Curve',
          data: demandPoints,
          borderColor: CHART_COLORS.primary[0],
          backgroundColor: CHART_COLORS.gradient[0],
          fill: true,
          tension: 0.4
        }
      ]
    };
  };

  const generateRevenueOptimization = (analysis: PriceAnalysis) => {
    const pricePoints = [];
    const revenuePoints = [];
    
    for (let i = 0.5; i <= 2; i += 0.1) {
      const price = analysis.current_price * i;
      const demand = 100 * Math.pow(i, analysis.demand_elasticity);
      const revenue = price * demand;
      pricePoints.push(price);
      revenuePoints.push(revenue);
    }
    
    return {
      labels: pricePoints.map(p => formatMarketValue(p)),
      datasets: [
        {
          label: 'Revenue',
          data: revenuePoints,
          borderColor: CHART_COLORS.primary[1],
          backgroundColor: CHART_COLORS.gradient[1],
          fill: true,
          tension: 0.4
        }
      ]
    };
  };

  const generateCompetitorComparison = (analysis: PriceAnalysis) => {
    return {
      labels: ['Your Price', 'Optimal Price', 'Competitor Avg'],
      datasets: [
        {
          label: 'Price Comparison',
          data: [analysis.current_price, analysis.optimal_price, analysis.competitor_avg],
          backgroundColor: [
            CHART_COLORS.primary[0],
            CHART_COLORS.primary[1],
            CHART_COLORS.primary[2]
          ],
          borderColor: [
            CHART_COLORS.primary[0],
            CHART_COLORS.primary[1],
            CHART_COLORS.primary[2]
          ],
          borderWidth: 1
        }
      ]
    };
  };

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'increase':
        return <ArrowUp className="w-4 h-4 text-green-500" />;
      case 'decrease':
        return <ArrowDown className="w-4 h-4 text-red-500" />;
      case 'maintain':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <Target className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRecommendationBadge = (recommendation: string) => {
    switch (recommendation) {
      case 'increase':
        return <Badge variant="secondary">Increase Price</Badge>;
      case 'decrease':
        return <Badge variant="destructive">Decrease Price</Badge>;
      case 'maintain':
        return <Badge variant="outline">Maintain Price</Badge>;
      default:
        return <Badge variant="outline">No Recommendation</Badge>;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const renderPriceAnalysisCard = (analysis: PriceAnalysis) => (
    <Card key={analysis.product} className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{analysis.product}</h3>
          <p className="text-sm text-muted-foreground">Price Optimization Analysis</p>
        </div>
        <div className="flex items-center space-x-2">
          {getRecommendationIcon(analysis.recommendation)}
          {getRecommendationBadge(analysis.recommendation)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <DollarSign className="w-6 h-6 mx-auto mb-2 text-blue-500" />
          <p className="text-sm text-muted-foreground">Current Price</p>
          <p className="text-xl font-bold">{formatMarketValue(analysis.current_price)}</p>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <Target className="w-6 h-6 mx-auto mb-2 text-green-500" />
          <p className="text-sm text-muted-foreground">Optimal Price</p>
          <p className="text-xl font-bold">{formatMarketValue(analysis.optimal_price)}</p>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <BarChart3 className="w-6 h-6 mx-auto mb-2 text-purple-500" />
          <p className="text-sm text-muted-foreground">Competitor Avg</p>
          <p className="text-xl font-bold">{formatMarketValue(analysis.competitor_avg)}</p>
        </div>
        <div className="text-center p-3 bg-muted/50 rounded-lg">
          <TrendingUp className="w-6 h-6 mx-auto mb-2 text-orange-500" />
          <p className="text-sm text-muted-foreground">Revenue Impact</p>
          <p className={`text-xl font-bold ${analysis.revenue_impact > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatPercentageChange(analysis.revenue_impact)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <h4 className="font-medium mb-3">Demand Curve</h4>
          <div className="h-48">
            <BaseChart
              type="line"
              data={generateDemandCurve(analysis)}
              options={LINE_CHART_OPTIONS}
            />
          </div>
        </div>
        <div>
          <h4 className="font-medium mb-3">Revenue Optimization</h4>
          <div className="h-48">
            <BaseChart
              type="line"
              data={generateRevenueOptimization(analysis)}
              options={LINE_CHART_OPTIONS}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium mb-3">Price Comparison</h4>
          <div className="h-48">
            <BaseChart
              type="bar"
              data={generateCompetitorComparison(analysis)}
              options={BAR_CHART_OPTIONS}
            />
          </div>
        </div>
        <div>
          <h4 className="font-medium mb-3">Analysis Summary</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Price Elasticity</span>
              <span className="font-medium">{analysis.demand_elasticity.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Confidence Level</span>
              <div className="flex items-center space-x-2">
                <Progress value={analysis.confidence} className="w-20" />
                <span className={`font-medium ${getConfidenceColor(analysis.confidence)}`}>
                  {analysis.confidence.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Price Change</span>
              <span className={`font-medium ${
                analysis.optimal_price > analysis.current_price ? 'text-green-600' : 
                analysis.optimal_price < analysis.current_price ? 'text-red-600' : 'text-blue-600'
              }`}>
                {formatPercentageChange(((analysis.optimal_price - analysis.current_price) / analysis.current_price) * 100)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <div className={`space-y-6 ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Price Optimization</h2>
          <p className="text-muted-foreground">
            AI-powered pricing recommendations and competitor analysis
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Calculator className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Dynamic Pricing Engine</span>
        </div>
      </div>

      {/* Product Selection */}
      <Card className="p-6">
        <h3 className="font-semibold mb-4">Select Product for Analysis</h3>
        
        <div className="flex space-x-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <Button
            onClick={() => selectedProduct && loadPriceAnalysis(selectedProduct)}
            disabled={loading || !selectedProduct}
            className="whitespace-nowrap"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Calculator className="w-4 h-4 mr-2" />
            )}
            Analyze Price
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {filteredProducts.map(product => (
            <button
              key={product}
              onClick={() => setSelectedProduct(product)}
              className={`p-3 text-left rounded-lg border transition-colors ${
                selectedProduct === product
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <p className="font-medium text-sm">{product}</p>
              <p className="text-xs text-muted-foreground">Click to analyze</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Price Analysis Results */}
      {priceAnalysis.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Price Analysis Results</h3>
            <Badge variant="secondary">{priceAnalysis.length} products analyzed</Badge>
          </div>
          
          {priceAnalysis.map(analysis => renderPriceAnalysisCard(analysis))}
        </div>
      )}

      {/* Pricing Strategies */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Pricing Strategies</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              <h4 className="font-medium">Premium Pricing</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Position above competitors for exclusive or high-demand products
            </p>
            <div className="mt-2">
              <Badge variant="outline">+15-30% markup</Badge>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Target className="w-5 h-5 text-blue-500" />
              <h4 className="font-medium">Competitive Pricing</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Match competitor prices while maintaining healthy margins
            </p>
            <div className="mt-2">
              <Badge variant="outline">±5% of average</Badge>
            </div>
          </div>

          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <h4 className="font-medium">Penetration Pricing</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Price below competitors to gain market share quickly
            </p>
            <div className="mt-2">
              <Badge variant="outline">-10-20% discount</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Pricing Insights */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Pricing Insights</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-3">Market Dynamics</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 p-2 bg-muted/50 rounded">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm">High demand categories show 15-25% price premiums</span>
              </div>
              <div className="flex items-center space-x-2 p-2 bg-muted/50 rounded">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="text-sm">Oversupplied markets require competitive pricing</span>
              </div>
              <div className="flex items-center space-x-2 p-2 bg-muted/50 rounded">
                <Target className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Seasonal products benefit from dynamic pricing</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Optimization Tips</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 p-2 bg-muted/50 rounded">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">Test price changes gradually (5-10% increments)</span>
              </div>
              <div className="flex items-center space-x-2 p-2 bg-muted/50 rounded">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">Monitor competitor response within 24-48 hours</span>
              </div>
              <div className="flex items-center space-x-2 p-2 bg-muted/50 rounded">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">Consider bundle pricing for related products</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};