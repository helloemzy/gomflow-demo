'use client';

// GOMFLOW Engagement Chart Component
// Advanced engagement visualization with Chart.js

import React, { useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart, MessageCircle, Share, Eye, TrendingUp, BarChart3, LineChart, PieChart } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  TimeScale
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
  TimeScale
);

interface EngagementData {
  date: string;
  likes: number;
  comments: number;
  shares: number;
  reaches: number;
  impressions: number;
  engagement_rate: number;
  platform?: string;
  post_count?: number;
}

interface EngagementChartProps {
  data: EngagementData[];
  dateRange: { start: Date; end: Date };
  selectedMetric: string;
  onMetricChange: (metric: string) => void;
  isLoading?: boolean;
  showDetailed?: boolean;
  className?: string;
}

const EngagementChart: React.FC<EngagementChartProps> = ({
  data = [],
  dateRange,
  selectedMetric,
  onMetricChange,
  isLoading = false,
  showDetailed = false,
  className = ''
}) => {
  const chartRef = useRef<ChartJS<'line' | 'bar' | 'doughnut'>>(null);

  // Metric options
  const metricOptions = [
    { value: 'engagement', label: 'Total Engagement', icon: Heart },
    { value: 'likes', label: 'Likes', icon: Heart },
    { value: 'comments', label: 'Comments', icon: MessageCircle },
    { value: 'shares', label: 'Shares', icon: Share },
    { value: 'reach', label: 'Reach', icon: Eye },
    { value: 'engagement_rate', label: 'Engagement Rate', icon: TrendingUp }
  ];

  // Chart type options
  const [chartType, setChartType] = React.useState<'line' | 'bar' | 'area'>('line');

  // Color palette
  const colors = {
    primary: 'rgb(59, 130, 246)',
    secondary: 'rgb(16, 185, 129)',
    accent: 'rgb(245, 158, 11)',
    danger: 'rgb(239, 68, 68)',
    purple: 'rgb(139, 92, 246)',
    pink: 'rgb(236, 72, 153)'
  };

  // Process data for line/bar charts
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const labels = data.map(item => item.date);
    
    let datasets: any[] = [];

    switch (selectedMetric) {
      case 'engagement':
        datasets = [{
          label: 'Total Engagement',
          data: data.map(item => item.likes + item.comments + item.shares),
          borderColor: colors.primary,
          backgroundColor: chartType === 'area' ? `${colors.primary}20` : colors.primary,
          fill: chartType === 'area',
          tension: 0.4
        }];
        break;

      case 'likes':
        datasets = [{
          label: 'Likes',
          data: data.map(item => item.likes),
          borderColor: colors.danger,
          backgroundColor: chartType === 'area' ? `${colors.danger}20` : colors.danger,
          fill: chartType === 'area',
          tension: 0.4
        }];
        break;

      case 'comments':
        datasets = [{
          label: 'Comments',
          data: data.map(item => item.comments),
          borderColor: colors.secondary,
          backgroundColor: chartType === 'area' ? `${colors.secondary}20` : colors.secondary,
          fill: chartType === 'area',
          tension: 0.4
        }];
        break;

      case 'shares':
        datasets = [{
          label: 'Shares',
          data: data.map(item => item.shares),
          borderColor: colors.accent,
          backgroundColor: chartType === 'area' ? `${colors.accent}20` : colors.accent,
          fill: chartType === 'area',
          tension: 0.4
        }];
        break;

      case 'reach':
        datasets = [{
          label: 'Reach',
          data: data.map(item => item.reaches),
          borderColor: colors.purple,
          backgroundColor: chartType === 'area' ? `${colors.purple}20` : colors.purple,
          fill: chartType === 'area',
          tension: 0.4
        }];
        break;

      case 'engagement_rate':
        datasets = [{
          label: 'Engagement Rate (%)',
          data: data.map(item => item.engagement_rate),
          borderColor: colors.pink,
          backgroundColor: chartType === 'area' ? `${colors.pink}20` : colors.pink,
          fill: chartType === 'area',
          tension: 0.4
        }];
        break;

      default:
        // Multi-metric view
        datasets = [
          {
            label: 'Likes',
            data: data.map(item => item.likes),
            borderColor: colors.danger,
            backgroundColor: colors.danger,
            yAxisID: 'y'
          },
          {
            label: 'Comments',
            data: data.map(item => item.comments),
            borderColor: colors.secondary,
            backgroundColor: colors.secondary,
            yAxisID: 'y'
          },
          {
            label: 'Shares',
            data: data.map(item => item.shares),
            borderColor: colors.accent,
            backgroundColor: colors.accent,
            yAxisID: 'y'
          },
          {
            label: 'Engagement Rate (%)',
            data: data.map(item => item.engagement_rate),
            borderColor: colors.pink,
            backgroundColor: colors.pink,
            yAxisID: 'y1',
            type: 'line' as const
          }
        ];
    }

    return { labels, datasets };
  }, [data, selectedMetric, chartType, colors]);

  // Platform breakdown data for doughnut chart
  const platformBreakdownData = useMemo(() => {
    if (!data || data.length === 0) return null;

    // Group data by platform
    const platformTotals = data.reduce((acc, item) => {
      const platform = item.platform || 'Unknown';
      if (!acc[platform]) {
        acc[platform] = 0;
      }
      acc[platform] += item.likes + item.comments + item.shares;
      return acc;
    }, {} as Record<string, number>);

    const labels = Object.keys(platformTotals);
    const dataValues = Object.values(platformTotals);
    const backgroundColors = [
      colors.primary,
      colors.secondary,
      colors.accent,
      colors.danger,
      colors.purple,
      colors.pink
    ];

    return {
      labels,
      datasets: [{
        data: dataValues,
        backgroundColor: backgroundColors.slice(0, labels.length),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };
  }, [data, colors]);

  // Chart options
  const chartOptions = useMemo(() => {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            usePointStyle: true,
            padding: 20,
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: colors.primary,
          borderWidth: 1,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: function(context: any) {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              
              if (selectedMetric === 'engagement_rate') {
                return `${label}: ${value.toFixed(2)}%`;
              }
              
              return `${label}: ${value.toLocaleString()}`;
            }
          }
        }
      },
      scales: {
        x: {
          type: 'time' as const,
          time: {
            unit: 'day' as const,
            displayFormats: {
              day: 'MMM dd'
            }
          },
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 11
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.1)'
          },
          ticks: {
            font: {
              size: 11
            },
            callback: function(value: any) {
              if (selectedMetric === 'engagement_rate') {
                return `${value}%`;
              }
              return value.toLocaleString();
            }
          }
        }
      }
    };

    // Add second y-axis for multi-metric view
    if (selectedMetric === 'multi') {
      baseOptions.scales.y1 = {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        beginAtZero: true,
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          font: {
            size: 11
          },
          callback: function(value: any) {
            return `${value}%`;
          }
        }
      };
    }

    return baseOptions;
  }, [selectedMetric, colors]);

  // Doughnut chart options
  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: colors.primary,
        borderWidth: 1,
        cornerRadius: 8,
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed;
            const total = context.dataset.data.reduce((sum: number, val: number) => sum + val, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value.toLocaleString()} (${percentage}%)`;
          }
        }
      }
    },
    cutout: '60%'
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!data || data.length === 0) return null;

    const totalLikes = data.reduce((sum, item) => sum + item.likes, 0);
    const totalComments = data.reduce((sum, item) => sum + item.comments, 0);
    const totalShares = data.reduce((sum, item) => sum + item.shares, 0);
    const totalReach = data.reduce((sum, item) => sum + item.reaches, 0);
    const avgEngagementRate = data.reduce((sum, item) => sum + item.engagement_rate, 0) / data.length;

    const totalEngagement = totalLikes + totalComments + totalShares;

    return {
      totalEngagement,
      totalLikes,
      totalComments,
      totalShares,
      totalReach,
      avgEngagementRate
    };
  }, [data]);

  // Render chart component
  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="h-[400px] flex items-center justify-center">
          <div className="space-y-3 w-full">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      );
    }

    if (!processedData) {
      return (
        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No engagement data available for the selected period</p>
          </div>
        </div>
      );
    }

    if (chartType === 'line' || chartType === 'area') {
      return (
        <div className="h-[400px]">
          <Line ref={chartRef} data={processedData} options={chartOptions} />
        </div>
      );
    } else {
      return (
        <div className="h-[400px]">
          <Bar ref={chartRef} data={processedData} options={chartOptions} />
        </div>
      );
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Chart Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
            <div>
              <CardTitle className="text-lg">Engagement Analytics</CardTitle>
              <CardDescription>
                Track your social media engagement performance over time
              </CardDescription>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Metric Selector */}
              <Select value={selectedMetric} onValueChange={onMetricChange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {metricOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center space-x-2">
                        <option.icon className="h-4 w-4" />
                        <span>{option.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                  <SelectItem value="multi">All Metrics</SelectItem>
                </SelectContent>
              </Select>

              {/* Chart Type Selector */}
              <div className="flex items-center border rounded-lg p-1">
                <Button
                  variant={chartType === 'line' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setChartType('line')}
                  className="h-8 px-2"
                >
                  <LineChart className="h-4 w-4" />
                </Button>
                <Button
                  variant={chartType === 'bar' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setChartType('bar')}
                  className="h-8 px-2"
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={chartType === 'area' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setChartType('area')}
                  className="h-8 px-2"
                >
                  <TrendingUp className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Stats */}
          {summaryStats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{summaryStats.totalEngagement.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Engagement</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">{summaryStats.totalLikes.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Likes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">{summaryStats.totalComments.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Comments</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-amber-500">{summaryStats.totalShares.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Shares</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-500">{summaryStats.avgEngagementRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Avg Engagement Rate</p>
              </div>
            </div>
          )}

          {/* Chart */}
          {renderChart()}
        </CardContent>
      </Card>

      {/* Detailed Analysis */}
      {showDetailed && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Platform Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Platform Breakdown</CardTitle>
              <CardDescription>
                Engagement distribution across platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              {platformBreakdownData ? (
                <div className="h-[300px]">
                  <Doughnut data={platformBreakdownData} options={doughnutOptions} />
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <PieChart className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No platform data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Performing Posts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Performing Posts</CardTitle>
              <CardDescription>
                Highest engagement posts in this period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Placeholder for top posts */}
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                      <Heart className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        Sample post content that performed well...
                      </p>
                      <div className="flex items-center space-x-4 mt-1 text-xs text-muted-foreground">
                        <span>1.2K likes</span>
                        <span>89 comments</span>
                        <span>45 shares</span>
                      </div>
                    </div>
                    <Badge variant="secondary">8.5%</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default EngagementChart;