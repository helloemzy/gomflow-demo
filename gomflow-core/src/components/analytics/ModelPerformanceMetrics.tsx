"use client";

import { useMemo, useState } from 'react';
import { Line, Bar, Radar } from 'react-chartjs-2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp,
  TrendingDown,
  Activity,
  Brain,
  Target,
  BarChart3,
  Zap,
  Settings
} from "lucide-react";
import BaseChart from './BaseChart';
import { LINE_CHART_OPTIONS, BAR_CHART_OPTIONS, COLORS, formatPercentage } from '@/lib/chartConfig';

interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  mae: number;
  mse: number;
  rmse: number;
  mape: number;
  r2Score: number;
  loss: number;
}

interface ModelPerformanceMetricsProps {
  data: ModelMetrics | null;
  isLoading: boolean;
  onTrain: () => void;
  isTraining: boolean;
}

export default function ModelPerformanceMetrics({
  data,
  isLoading,
  onTrain,
  isTraining
}: ModelPerformanceMetricsProps) {
  const [selectedMetricGroup, setSelectedMetricGroup] = useState<'classification' | 'regression' | 'overall'>('overall');

  const performanceRadarData = useMemo(() => {
    if (!data) return null;

    return {
      labels: ['Accuracy', 'Precision', 'Recall', 'F1 Score', 'R² Score'],
      datasets: [{
        label: 'Model Performance',
        data: [
          data.accuracy * 100,
          data.precision * 100,
          data.recall * 100,
          data.f1Score * 100,
          data.r2Score * 100
        ],
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        borderColor: COLORS.primary,
        pointBackgroundColor: COLORS.primary,
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: COLORS.primary,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      }]
    };
  }, [data]);

  const errorMetricsData = useMemo(() => {
    if (!data) return null;

    return {
      labels: ['MAE', 'MSE', 'RMSE', 'MAPE', 'Loss'],
      datasets: [{
        label: 'Error Metrics',
        data: [data.mae, data.mse, data.rmse, data.mape, data.loss],
        backgroundColor: [
          COLORS.error,
          COLORS.warning,
          COLORS.info,
          COLORS.secondary,
          COLORS.accent
        ],
        borderColor: [
          COLORS.error,
          COLORS.warning,
          COLORS.info,
          COLORS.secondary,
          COLORS.accent
        ],
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }]
    };
  }, [data]);

  const performanceHistoryData = useMemo(() => {
    if (!data) return null;

    // Mock historical data for performance over time
    const dates = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    const accuracyHistory = dates.map((_, i) => 
      data.accuracy + (Math.random() - 0.5) * 0.1
    );

    const lossHistory = dates.map((_, i) => 
      data.loss + (Math.random() - 0.5) * 0.05
    );

    return {
      labels: dates.map(date => new Date(date).toLocaleDateString()),
      datasets: [
        {
          label: 'Accuracy',
          data: accuracyHistory,
          borderColor: COLORS.primary,
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          label: 'Loss',
          data: lossHistory,
          borderColor: COLORS.error,
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
          yAxisID: 'y1'
        }
      ]
    };
  }, [data]);

  const radarOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        beginAtZero: true,
        max: 100,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        pointLabels: {
          font: {
            size: 11
          }
        }
      }
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${context.parsed.r.toFixed(1)}%`;
          }
        }
      }
    }
  }), []);

  const barOptions = useMemo(() => ({
    ...BAR_CHART_OPTIONS,
    scales: {
      ...BAR_CHART_OPTIONS.scales,
      y: {
        ...BAR_CHART_OPTIONS.scales?.y,
        title: {
          display: true,
          text: 'Error Value'
        }
      }
    }
  }), []);

  const lineOptions = useMemo(() => ({
    ...LINE_CHART_OPTIONS,
    scales: {
      ...LINE_CHART_OPTIONS.scales,
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Accuracy'
        },
        min: 0,
        max: 1
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Loss'
        },
        grid: {
          drawOnChartArea: false,
        },
        min: 0
      }
    }
  }), []);

  const getPerformanceGrade = (score: number) => {
    if (score >= 0.95) return { grade: 'A+', color: 'bg-green-500', text: 'Excellent' };
    if (score >= 0.90) return { grade: 'A', color: 'bg-green-500', text: 'Excellent' };
    if (score >= 0.85) return { grade: 'B+', color: 'bg-blue-500', text: 'Good' };
    if (score >= 0.80) return { grade: 'B', color: 'bg-blue-500', text: 'Good' };
    if (score >= 0.75) return { grade: 'C+', color: 'bg-yellow-500', text: 'Fair' };
    if (score >= 0.70) return { grade: 'C', color: 'bg-yellow-500', text: 'Fair' };
    return { grade: 'D', color: 'bg-red-500', text: 'Poor' };
  };

  const getMetricStatus = (metric: string, value: number) => {
    const thresholds = {
      accuracy: { excellent: 0.9, good: 0.8, fair: 0.7 },
      precision: { excellent: 0.9, good: 0.8, fair: 0.7 },
      recall: { excellent: 0.9, good: 0.8, fair: 0.7 },
      f1Score: { excellent: 0.9, good: 0.8, fair: 0.7 },
      r2Score: { excellent: 0.9, good: 0.8, fair: 0.7 },
      mae: { excellent: 5, good: 10, fair: 20 },
      mse: { excellent: 50, good: 100, fair: 200 },
      rmse: { excellent: 10, good: 20, fair: 40 },
      mape: { excellent: 5, good: 10, fair: 20 },
      loss: { excellent: 0.1, good: 0.2, fair: 0.3 }
    };

    const threshold = thresholds[metric as keyof typeof thresholds];
    if (!threshold) return { status: 'unknown', icon: <Activity className="h-4 w-4" /> };

    // For error metrics (mae, mse, rmse, mape, loss), lower is better
    const isErrorMetric = ['mae', 'mse', 'rmse', 'mape', 'loss'].includes(metric);
    
    if (isErrorMetric) {
      if (value <= threshold.excellent) return { status: 'excellent', icon: <CheckCircle className="h-4 w-4 text-green-500" /> };
      if (value <= threshold.good) return { status: 'good', icon: <CheckCircle className="h-4 w-4 text-blue-500" /> };
      if (value <= threshold.fair) return { status: 'fair', icon: <AlertTriangle className="h-4 w-4 text-yellow-500" /> };
      return { status: 'poor', icon: <AlertTriangle className="h-4 w-4 text-red-500" /> };
    } else {
      if (value >= threshold.excellent) return { status: 'excellent', icon: <CheckCircle className="h-4 w-4 text-green-500" /> };
      if (value >= threshold.good) return { status: 'good', icon: <CheckCircle className="h-4 w-4 text-blue-500" /> };
      if (value >= threshold.fair) return { status: 'fair', icon: <AlertTriangle className="h-4 w-4 text-yellow-500" /> };
      return { status: 'poor', icon: <AlertTriangle className="h-4 w-4 text-red-500" /> };
    }
  };

  const overallGrade = data ? getPerformanceGrade(data.accuracy) : null;

  const classificationMetrics = [
    { name: 'Accuracy', value: data?.accuracy, format: 'percentage' },
    { name: 'Precision', value: data?.precision, format: 'percentage' },
    { name: 'Recall', value: data?.recall, format: 'percentage' },
    { name: 'F1 Score', value: data?.f1Score, format: 'percentage' }
  ];

  const regressionMetrics = [
    { name: 'MAE', value: data?.mae, format: 'decimal' },
    { name: 'MSE', value: data?.mse, format: 'decimal' },
    { name: 'RMSE', value: data?.rmse, format: 'decimal' },
    { name: 'MAPE', value: data?.mape, format: 'percentage' },
    { name: 'R² Score', value: data?.r2Score, format: 'percentage' }
  ];

  const overallMetrics = [
    { name: 'Overall Loss', value: data?.loss, format: 'decimal' },
    { name: 'Model Accuracy', value: data?.accuracy, format: 'percentage' }
  ];

  const getCurrentMetrics = () => {
    switch (selectedMetricGroup) {
      case 'classification':
        return classificationMetrics;
      case 'regression':
        return regressionMetrics;
      default:
        return overallMetrics;
    }
  };

  const formatMetricValue = (value: number | undefined, format: string) => {
    if (value === undefined) return '--';
    
    switch (format) {
      case 'percentage':
        return `${(value * 100).toFixed(1)}%`;
      case 'decimal':
        return value.toFixed(3);
      default:
        return value.toFixed(2);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Model Performance</h2>
          <p className="text-muted-foreground">
            Detailed metrics and analysis of ML model performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          {overallGrade && (
            <Badge variant="default" className={`${overallGrade.color} text-white`}>
              Grade: {overallGrade.grade}
            </Badge>
          )}
          <Button
            onClick={onTrain}
            disabled={isTraining}
            variant="outline"
            size="sm"
          >
            {isTraining ? (
              <>
                <Zap className="h-4 w-4 mr-2 animate-spin" />
                Training...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4 mr-2" />
                Retrain Model
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Metric Group Selector */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Metric Group:</span>
          <div className="flex gap-1">
            {[
              { id: 'overall', label: 'Overall', icon: <Activity className="h-4 w-4" /> },
              { id: 'classification', label: 'Classification', icon: <Target className="h-4 w-4" /> },
              { id: 'regression', label: 'Regression', icon: <BarChart3 className="h-4 w-4" /> }
            ].map((group) => (
              <Button
                key={group.id}
                variant={selectedMetricGroup === group.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedMetricGroup(group.id as any)}
              >
                {group.icon}
                {group.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {getCurrentMetrics().map((metric, index) => {
          const status = getMetricStatus(metric.name.toLowerCase().replace(' ', ''), metric.value || 0);
          return (
            <Card key={index}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {status.icon}
                  {metric.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">
                    {formatMetricValue(metric.value, metric.format)}
                  </div>
                  <Progress 
                    value={metric.format === 'percentage' ? (metric.value || 0) * 100 : 
                           metric.format === 'decimal' ? Math.min((metric.value || 0) * 10, 100) : 
                           (metric.value || 0) * 100} 
                    className="h-2" 
                  />
                  <p className="text-xs text-muted-foreground capitalize">
                    {status.status} performance
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BaseChart
          title="Performance Radar"
          description="Multi-dimensional performance analysis"
          exportFilename="performance-radar"
          loading={isLoading}
        >
          {performanceRadarData && !isLoading ? (
            <Radar data={performanceRadarData} options={radarOptions} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {isLoading ? 'Loading performance data...' : 'No performance data available'}
                </p>
              </div>
            </div>
          )}
        </BaseChart>

        <BaseChart
          title="Error Metrics"
          description="Model error analysis"
          exportFilename="error-metrics"
          loading={isLoading}
        >
          {errorMetricsData && !isLoading ? (
            <Bar data={errorMetricsData} options={barOptions} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {isLoading ? 'Loading error metrics...' : 'No error data available'}
                </p>
              </div>
            </div>
          )}
        </BaseChart>
      </div>

      {/* Performance History */}
      <BaseChart
        title="Performance History"
        description="Model performance over time"
        exportFilename="performance-history"
        loading={isLoading}
        className="col-span-full"
      >
        {performanceHistoryData && !isLoading ? (
          <Line data={performanceHistoryData} options={lineOptions} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {isLoading ? 'Loading performance history...' : 'No historical data available'}
              </p>
            </div>
          </div>
        )}
      </BaseChart>

      {/* Detailed Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detailed Performance Metrics</CardTitle>
          <CardDescription>
            Comprehensive analysis of model performance across all metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Classification Metrics */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Classification Metrics
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classificationMetrics.map((metric, index) => {
                  const status = getMetricStatus(metric.name.toLowerCase(), metric.value || 0);
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        {status.icon}
                        <div>
                          <div className="font-medium">{metric.name}</div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {status.status}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          {formatMetricValue(metric.value, metric.format)}
                        </div>
                        <Progress 
                          value={(metric.value || 0) * 100} 
                          className="h-1 w-16" 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Regression Metrics */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Regression Metrics
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {regressionMetrics.map((metric, index) => {
                  const status = getMetricStatus(metric.name.toLowerCase(), metric.value || 0);
                  return (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        {status.icon}
                        <div>
                          <div className="font-medium">{metric.name}</div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {status.status}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">
                          {formatMetricValue(metric.value, metric.format)}
                        </div>
                        <Progress 
                          value={metric.format === 'percentage' ? (metric.value || 0) * 100 : 
                                 Math.min((metric.value || 0) * 10, 100)} 
                          className="h-1 w-16" 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Recommendations */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Performance Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.accuracy < 0.8 && (
                <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-yellow-800">Low Accuracy Detected</div>
                    <div className="text-sm text-yellow-700">
                      Consider collecting more training data or adjusting model parameters. 
                      Current accuracy ({(data.accuracy * 100).toFixed(1)}%) is below recommended threshold.
                    </div>
                  </div>
                </div>
              )}
              
              {data.loss > 0.3 && (
                <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-red-800">High Loss Value</div>
                    <div className="text-sm text-red-700">
                      Model shows signs of poor convergence. Consider reducing learning rate or 
                      increasing training epochs. Current loss: {data.loss.toFixed(3)}.
                    </div>
                  </div>
                </div>
              )}

              {data.r2Score < 0.7 && (
                <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-orange-800">Low R² Score</div>
                    <div className="text-sm text-orange-700">
                      Model explains less than 70% of variance in data. Consider feature engineering 
                      or using a more complex model architecture.
                    </div>
                  </div>
                </div>
              )}

              {data.accuracy >= 0.9 && data.loss <= 0.1 && (
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-green-800">Excellent Performance</div>
                    <div className="text-sm text-green-700">
                      Model is performing exceptionally well with high accuracy and low loss. 
                      Consider deploying to production or using for business decisions.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}