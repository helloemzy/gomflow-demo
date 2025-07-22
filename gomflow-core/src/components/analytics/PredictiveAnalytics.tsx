"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Brain, 
  TrendingUp, 
  Calendar, 
  MapPin, 
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react";
import DemandForecastChart from './DemandForecastChart';
import SeasonalityChart from './SeasonalityChart';
import ComebackPredictionTimeline from './ComebackPredictionTimeline';
import GeographicDemandMap from './GeographicDemandMap';
import SupplyChainOptimization from './SupplyChainOptimization';
import ModelPerformanceMetrics from './ModelPerformanceMetrics';
import { usePredictiveAnalytics } from '@/hooks/usePredictiveAnalytics';
import { formatCurrency } from '@/lib/chartConfig';

interface PredictiveAnalyticsProps {
  gomId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  categories?: string[];
  regions?: string[];
}

export default function PredictiveAnalytics({
  gomId,
  dateRange = {
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  },
  categories = [],
  regions = []
}: PredictiveAnalyticsProps) {
  const [selectedTab, setSelectedTab] = useState<'forecast' | 'seasonality' | 'comebacks' | 'geographic' | 'supply' | 'performance'>('forecast');
  const [forecastHorizon, setForecastHorizon] = useState(30);
  const [confidenceLevel, setConfidenceLevel] = useState(95);
  const [isTrainingModel, setIsTrainingModel] = useState(false);

  const {
    demandForecast,
    seasonalityAnalysis,
    comebackPredictions,
    geographicAnalysis,
    supplyChainRecommendations,
    modelMetrics,
    isLoading,
    error,
    lastUpdate,
    refreshData,
    trainModel,
    updateForecastParams
  } = usePredictiveAnalytics({
    gomId,
    dateRange,
    categories,
    regions,
    forecastHorizon,
    confidenceLevel
  });

  const handleTrainModel = async () => {
    setIsTrainingModel(true);
    try {
      await trainModel();
    } finally {
      setIsTrainingModel(false);
    }
  };

  const handleUpdateForecast = async (horizon: number, confidence: number) => {
    setForecastHorizon(horizon);
    setConfidenceLevel(confidence);
    await updateForecastParams(horizon, confidence);
  };

  const getModelStatusBadge = () => {
    if (!modelMetrics) return <Badge variant="secondary">No Model</Badge>;
    
    const accuracy = modelMetrics.accuracy;
    if (accuracy >= 0.9) return <Badge variant="default" className="bg-green-500">Excellent</Badge>;
    if (accuracy >= 0.8) return <Badge variant="default" className="bg-blue-500">Good</Badge>;
    if (accuracy >= 0.7) return <Badge variant="default" className="bg-yellow-500">Fair</Badge>;
    return <Badge variant="destructive">Poor</Badge>;
  };

  const getInsightsSummary = () => {
    const insights = [];
    
    if (demandForecast?.predictions) {
      const trend = demandForecast.predictions.slice(-7).reduce((acc, curr, idx) => {
        if (idx === 0) return 0;
        return acc + (curr.value - demandForecast.predictions[idx - 1].value);
      }, 0);
      
      if (trend > 0) {
        insights.push({
          type: 'positive',
          icon: <TrendingUp className="h-4 w-4" />,
          text: `Demand trending up by ${trend.toFixed(1)}% this week`
        });
      }
    }

    if (comebackPredictions?.predictions) {
      const upcomingComebacks = comebackPredictions.predictions.filter(
        p => new Date(p.predictedDate) > new Date() && 
        new Date(p.predictedDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      );
      
      if (upcomingComebacks.length > 0) {
        insights.push({
          type: 'info',
          icon: <Calendar className="h-4 w-4" />,
          text: `${upcomingComebacks.length} comeback${upcomingComebacks.length > 1 ? 's' : ''} predicted this month`
        });
      }
    }

    if (supplyChainRecommendations?.recommendations) {
      const urgentRecommendations = supplyChainRecommendations.recommendations.filter(
        r => r.confidence > 0.8 && r.timeframe === 'immediate'
      );
      
      if (urgentRecommendations.length > 0) {
        insights.push({
          type: 'warning',
          icon: <AlertTriangle className="h-4 w-4" />,
          text: `${urgentRecommendations.length} urgent inventory action${urgentRecommendations.length > 1 ? 's' : ''} needed`
        });
      }
    }

    return insights;
  };

  const insights = getInsightsSummary();

  const tabs = [
    { id: 'forecast', label: 'Demand Forecast', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'seasonality', label: 'Seasonality', icon: <Calendar className="h-4 w-4" /> },
    { id: 'comebacks', label: 'Comeback Predictions', icon: <Brain className="h-4 w-4" /> },
    { id: 'geographic', label: 'Geographic Analysis', icon: <MapPin className="h-4 w-4" /> },
    { id: 'supply', label: 'Supply Chain', icon: <Settings className="h-4 w-4" /> },
    { id: 'performance', label: 'Model Performance', icon: <CheckCircle className="h-4 w-4" /> }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Predictive Analytics</h1>
          <p className="text-muted-foreground">
            AI-powered demand forecasting and business intelligence
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getModelStatusBadge()}
          <Button
            onClick={handleTrainModel}
            disabled={isTrainingModel}
            variant="outline"
            size="sm"
          >
            {isTrainingModel ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Training...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Train Model
              </>
            )}
          </Button>
          <Button
            onClick={refreshData}
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Insights Summary */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Key Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {insights.map((insight, index) => (
                <div 
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    insight.type === 'positive' ? 'bg-green-50 border-green-200' :
                    insight.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className={`p-2 rounded-full ${
                    insight.type === 'positive' ? 'bg-green-100 text-green-600' :
                    insight.type === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {insight.icon}
                  </div>
                  <p className="text-sm font-medium">{insight.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Forecast Accuracy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {modelMetrics?.accuracy ? `${(modelMetrics.accuracy * 100).toFixed(1)}%` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Predicted Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {demandForecast?.totalRevenueForecast ? 
                formatCurrency(demandForecast.totalRevenueForecast) : '--'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Next {forecastHorizon} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Demand Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {demandForecast?.trendDirection ? 
                demandForecast.trendDirection === 'increasing' ? '+' : 
                demandForecast.trendDirection === 'decreasing' ? '-' : '=' : '--'
              }
              {demandForecast?.trendStrength ? `${(demandForecast.trendStrength * 100).toFixed(1)}%` : ''}
            </div>
            <p className="text-xs text-muted-foreground">
              Trend strength
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Model Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {lastUpdate ? 
                new Date(lastUpdate).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                }) : '--'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Last updated
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex space-x-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id as any)}
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              selectedTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="min-h-[600px]">
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm font-medium">Error loading predictive analytics</p>
              </div>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </CardContent>
          </Card>
        )}

        {selectedTab === 'forecast' && (
          <DemandForecastChart
            data={demandForecast}
            isLoading={isLoading}
            onUpdateParams={handleUpdateForecast}
            forecastHorizon={forecastHorizon}
            confidenceLevel={confidenceLevel}
          />
        )}

        {selectedTab === 'seasonality' && (
          <SeasonalityChart
            data={seasonalityAnalysis}
            isLoading={isLoading}
            dateRange={dateRange}
          />
        )}

        {selectedTab === 'comebacks' && (
          <ComebackPredictionTimeline
            data={comebackPredictions}
            isLoading={isLoading}
            onRefresh={refreshData}
          />
        )}

        {selectedTab === 'geographic' && (
          <GeographicDemandMap
            data={geographicAnalysis}
            isLoading={isLoading}
            regions={regions}
          />
        )}

        {selectedTab === 'supply' && (
          <SupplyChainOptimization
            data={supplyChainRecommendations}
            isLoading={isLoading}
            onRefresh={refreshData}
          />
        )}

        {selectedTab === 'performance' && (
          <ModelPerformanceMetrics
            data={modelMetrics}
            isLoading={isLoading}
            onTrain={handleTrainModel}
            isTraining={isTrainingModel}
          />
        )}
      </div>
    </div>
  );
}