"use client";

import { Bar, Line } from 'react-chartjs-2';
import { ChartData } from 'chart.js';
import { BAR_CHART_OPTIONS, TIME_SERIES_OPTIONS, COLORS, formatCurrency } from '@/lib/chartConfig';
import BaseChart from './BaseChart';
import { useEffect, useState } from 'react';

interface RevenueData {
  date: string;
  dailyRevenue: number;
  cumulativeRevenue: number;
  orderCount: number;
  averageOrderValue: number;
}

interface RevenueAnalyticsChartProps {
  data: RevenueData[];
  currency: string;
  chartType: 'bar' | 'line';
  onRefresh?: () => void;
  loading?: boolean;
}

export default function RevenueAnalyticsChart({ 
  data, 
  currency,
  chartType = 'bar',
  onRefresh, 
  loading = false 
}: RevenueAnalyticsChartProps) {
  const [chartData, setChartData] = useState<ChartData<'bar' | 'line'>>({
    labels: [],
    datasets: []
  });

  useEffect(() => {
    if (!data || data.length === 0) return;

    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const chartData: ChartData<'bar' | 'line'> = {
      labels: sortedData.map(item => new Date(item.date)),
      datasets: [
        {
          label: 'Daily Revenue',
          data: sortedData.map(item => item.dailyRevenue),
          backgroundColor: chartType === 'bar' ? 'rgba(139, 92, 246, 0.8)' : 'rgba(139, 92, 246, 0.1)',
          borderColor: COLORS.primary,
          borderWidth: 2,
          yAxisID: 'y',
          ...(chartType === 'line' && {
            tension: 0.4,
            fill: true
          }),
          ...(chartType === 'bar' && {
            borderRadius: 8,
            borderSkipped: false
          })
        },
        {
          label: 'Cumulative Revenue',
          data: sortedData.map(item => item.cumulativeRevenue),
          backgroundColor: chartType === 'bar' ? 'rgba(16, 185, 129, 0.8)' : 'rgba(16, 185, 129, 0.1)',
          borderColor: COLORS.success,
          borderWidth: 2,
          yAxisID: 'y1',
          ...(chartType === 'line' && {
            tension: 0.4,
            fill: false
          }),
          ...(chartType === 'bar' && {
            borderRadius: 8,
            borderSkipped: false
          })
        }
      ]
    };

    setChartData(chartData);
  }, [data, chartType]);

  const baseOptions = chartType === 'bar' ? BAR_CHART_OPTIONS : TIME_SERIES_OPTIONS;

  const options = {
    ...baseOptions,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      x: {
        type: chartType === 'line' ? 'time' : 'category',
        ...(chartType === 'line' && {
          time: {
            displayFormats: {
              day: 'MMM dd',
              week: 'MMM dd',
              month: 'MMM yyyy'
            }
          }
        }),
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
        type: 'linear',
        display: true,
        position: 'left',
        beginAtZero: true,
        title: {
          display: true,
          text: `Daily Revenue (${currency})`
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          font: {
            size: 11
          },
          callback: function(value: any) {
            return formatCurrency(value, currency);
          }
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        beginAtZero: true,
        title: {
          display: true,
          text: `Cumulative Revenue (${currency})`
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          font: {
            size: 11
          },
          callback: function(value: any) {
            return formatCurrency(value, currency);
          }
        }
      }
    },
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        ...baseOptions.plugins?.tooltip,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            label += formatCurrency(context.parsed.y, currency);
            return label;
          }
        }
      }
    }
  };

  if (!data || data.length === 0) {
    return (
      <BaseChart
        title="Revenue Analytics"
        description="Track daily and cumulative revenue performance"
        onRefresh={onRefresh}
        loading={loading}
        exportFilename="revenue-analytics"
      >
        <div className="flex items-center justify-center h-full text-gray-500">
          No revenue data available
        </div>
      </BaseChart>
    );
  }

  const ChartComponent = chartType === 'bar' ? Bar : Line;

  return (
    <BaseChart
      title="Revenue Analytics"
      description="Track daily and cumulative revenue performance"
      onRefresh={onRefresh}
      loading={loading}
      exportFilename="revenue-analytics"
    >
      <ChartComponent data={chartData} options={options} />
    </BaseChart>
  );
}