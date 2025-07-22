"use client";

import { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Settings,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import BaseChart from './BaseChart';
import { TIME_SERIES_OPTIONS, COLORS, formatCurrency } from '@/lib/chartConfig';

interface DemandForecastData {
  predictions: Array<{
    date: string;
    value: number;
    confidence: {
      lower: number;
      upper: number;
      confidence: number;
    };
  }>;
  totalRevenueForecast: number;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  trendStrength: number;
  seasonalityStrength: number;
  metadata: {
    modelVersion: string;
    lastTraining: string;
    dataPoints: number;
  };
}

interface DemandForecastChartProps {
  data: DemandForecastData | null;
  isLoading: boolean;
  onUpdateParams: (horizon: number, confidence: number) => void;
  forecastHorizon: number;
  confidenceLevel: number;
}

export default function DemandForecastChart({
  data,
  isLoading,
  onUpdateParams,
  forecastHorizon,
  confidenceLevel
}: DemandForecastChartProps) {
  const [selectedHorizon, setSelectedHorizon] = useState(forecastHorizon);
  const [selectedConfidence, setSelectedConfidence] = useState(confidenceLevel);
  const [viewMode, setViewMode] = useState<'forecast' | 'confidence' | 'trend'>('forecast');

  const chartData = useMemo(() => {
    if (!data) return null;

    const labels = data.predictions.map(p => new Date(p.date).toLocaleDateString());
    
    const datasets = [];

    if (viewMode === 'forecast' || viewMode === 'confidence') {
      // Main forecast line
      datasets.push({
        label: 'Demand Forecast',
        data: data.predictions.map(p => p.value),
        borderColor: COLORS.primary,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 2,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: COLORS.primary,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        tension: 0.4
      });

      // Confidence bands
      if (viewMode === 'confidence') {
        datasets.push({
          label: 'Upper Confidence',
          data: data.predictions.map(p => p.confidence.upper),
          borderColor: 'rgba(139, 92, 246, 0.3)',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderWidth: 1,
          fill: '+1',
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0.4
        });

        datasets.push({
          label: 'Lower Confidence',
          data: data.predictions.map(p => p.confidence.lower),
          borderColor: 'rgba(139, 92, 246, 0.3)',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderWidth: 1,
          fill: false,
          pointRadius: 0,
          pointHoverRadius: 0,
          tension: 0.4
        });
      }
    }

    if (viewMode === 'trend') {
      // Trend line
      const trendData = data.predictions.map((p, index) => {
        const trendValue = data.predictions[0].value + 
          (data.trendDirection === 'increasing' ? 1 : data.trendDirection === 'decreasing' ? -1 : 0) * 
          data.trendStrength * index;
        return trendValue;
      });

      datasets.push({
        label: 'Trend Line',
        data: trendData,
        borderColor: COLORS.secondary,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        fill: false,
        pointRadius: 2,
        pointHoverRadius: 4,
        borderDash: [5, 5],
        tension: 0
      });

      datasets.push({
        label: 'Actual Forecast',
        data: data.predictions.map(p => p.value),
        borderColor: COLORS.primary,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 2,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.4
      });
    }

    return {
      labels,
      datasets
    };
  }, [data, viewMode]);

  const chartOptions = useMemo(() => ({
    ...TIME_SERIES_OPTIONS,
    scales: {
      ...TIME_SERIES_OPTIONS.scales,
      y: {
        ...TIME_SERIES_OPTIONS.scales?.y,
        title: {
          display: true,
          text: 'Demand (Orders)'
        }
      }
    },
    plugins: {
      ...TIME_SERIES_OPTIONS.plugins,
      tooltip: {
        ...TIME_SERIES_OPTIONS.plugins?.tooltip,
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${value.toFixed(0)} orders`;
          }
        }
      }
    }
  }), []);

  const handleUpdateParams = () => {
    if (selectedHorizon !== forecastHorizon || selectedConfidence !== confidenceLevel) {
      onUpdateParams(selectedHorizon, selectedConfidence);
    }
  };

  const getTrendIcon = () => {
    if (!data) return <Activity className="h-4 w-4" />;
    
    switch (data.trendDirection) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendBadge = () => {
    if (!data) return null;
    
    const strength = (data.trendStrength * 100).toFixed(1);
    const direction = data.trendDirection;
    
    let variant: "default" | "secondary" | "destructive" = "secondary";
    if (direction === 'increasing') variant = "default";
    if (direction === 'decreasing') variant = "destructive";
    
    return (
      <Badge variant={variant}>
        {direction === 'increasing' ? '↗' : direction === 'decreasing' ? '↘' : '→'} {strength}%
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Forecast Horizon:</label>
          <Select value={selectedHorizon.toString()} onValueChange={(value) => setSelectedHorizon(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Confidence Level:</label>
          <Select value={selectedConfidence.toString()} onValueChange={(value) => setSelectedConfidence(parseInt(value))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="90">90%</SelectItem>
              <SelectItem value="95">95%</SelectItem>
              <SelectItem value="99">99%</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">View Mode:</label>
          <Select value={viewMode} onValueChange={(value) => setViewMode(value as any)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="forecast">Forecast</SelectItem>
              <SelectItem value="confidence">Confidence Bands</SelectItem>
              <SelectItem value="trend">Trend Analysis</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={handleUpdateParams}
          disabled={isLoading}
          size="sm"
        >
          <Settings className="h-4 w-4 mr-2" />
          Update
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {getTrendIcon()}
              Trend Direction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold capitalize">
                {data?.trendDirection || '--'}
              </span>
              {getTrendBadge()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.totalRevenueForecast ? formatCurrency(data.totalRevenueForecast) : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              Next {forecastHorizon} days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Seasonality Strength</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.seasonalityStrength ? `${(data.seasonalityStrength * 100).toFixed(1)}%` : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              Seasonal impact
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Model Quality</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                {data?.metadata.dataPoints || '--'}
              </div>
              {data?.metadata.dataPoints && data.metadata.dataPoints > 100 ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Data points used
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <BaseChart
        title="Demand Forecast"
        description={`${forecastHorizon}-day forecast with ${confidenceLevel}% confidence interval`}
        exportFilename="demand-forecast"
        onRefresh={() => handleUpdateParams()}
        loading={isLoading}
        className="col-span-2"
      >
        {chartData && !isLoading ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {isLoading ? 'Generating forecast...' : 'No forecast data available'}
              </p>
            </div>
          </div>
        )}
      </BaseChart>

      {/* Insights */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Forecast Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium">Trend Analysis</h4>
                  <p className="text-sm text-muted-foreground">
                    Demand is showing a {data.trendDirection} trend with {(data.trendStrength * 100).toFixed(1)}% strength. 
                    This indicates {data.trendDirection === 'increasing' ? 'growing' : data.trendDirection === 'decreasing' ? 'declining' : 'stable'} market conditions.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <Activity className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium">Seasonality Impact</h4>
                  <p className="text-sm text-muted-foreground">
                    Seasonal patterns account for {(data.seasonalityStrength * 100).toFixed(1)}% of demand variation. 
                    Consider adjusting inventory levels based on seasonal trends.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-medium">Data Quality</h4>
                  <p className="text-sm text-muted-foreground">
                    Model trained on {data.metadata.dataPoints} data points. 
                    Last training: {new Date(data.metadata.lastTraining).toLocaleDateString()}.
                    {data.metadata.dataPoints > 100 ? ' High-quality dataset for reliable predictions.' : ' Consider collecting more data for improved accuracy.'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}