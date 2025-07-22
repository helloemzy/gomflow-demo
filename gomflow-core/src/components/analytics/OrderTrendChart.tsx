"use client";

import { Line } from 'react-chartjs-2';
import { ChartData, ChartOptions } from 'chart.js';
import { TIME_SERIES_OPTIONS, COLORS, formatCurrency } from '@/lib/chartConfig';
import BaseChart from './BaseChart';
import { useEffect, useState } from 'react';

interface OrderTrendData {
  date: string;
  submissions: number;
  confirmedOrders: number;
  revenue: number;
  cumulativeRevenue: number;
}

interface OrderTrendChartProps {
  data: OrderTrendData[];
  currency: string;
  onRefresh?: () => void;
  loading?: boolean;
}

export default function OrderTrendChart({ 
  data, 
  currency, 
  onRefresh, 
  loading = false 
}: OrderTrendChartProps) {
  const [chartData, setChartData] = useState<ChartData<'line'>>({
    labels: [],
    datasets: []
  });

  useEffect(() => {
    if (!data || data.length === 0) return;

    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const chartData: ChartData<'line'> = {
      labels: sortedData.map(item => new Date(item.date)),
      datasets: [
        {
          label: 'Daily Submissions',
          data: sortedData.map(item => item.submissions),
          borderColor: COLORS.primary,
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: 'Confirmed Orders',
          data: sortedData.map(item => item.confirmedOrders),
          borderColor: COLORS.success,
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: 'Daily Revenue',
          data: sortedData.map(item => item.revenue),
          borderColor: COLORS.secondary,
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.4,
          fill: false,
          yAxisID: 'y1'
        }
      ]
    };

    setChartData(chartData);
  }, [data]);

  const options: ChartOptions<'line'> = {
    ...TIME_SERIES_OPTIONS,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      x: {
        type: 'time',
        time: {
          displayFormats: {
            day: 'MMM dd',
            week: 'MMM dd',
            month: 'MMM yyyy'
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
        type: 'linear',
        display: true,
        position: 'left',
        beginAtZero: true,
        title: {
          display: true,
          text: 'Orders Count'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          font: {
            size: 11
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
          text: `Revenue (${currency})`
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
      ...TIME_SERIES_OPTIONS.plugins,
      tooltip: {
        ...TIME_SERIES_OPTIONS.plugins?.tooltip,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            
            if (context.dataset.yAxisID === 'y1') {
              label += formatCurrency(context.parsed.y, currency);
            } else {
              label += context.parsed.y;
            }
            
            return label;
          }
        }
      }
    }
  };

  if (!data || data.length === 0) {
    return (
      <BaseChart
        title="Order Performance Trend"
        description="Track daily submissions, confirmations, and revenue over time"
        onRefresh={onRefresh}
        loading={loading}
        exportFilename="order-trend"
      >
        <div className="flex items-center justify-center h-full text-gray-500">
          No data available
        </div>
      </BaseChart>
    );
  }

  return (
    <BaseChart
      title="Order Performance Trend"
      description="Track daily submissions, confirmations, and revenue over time"
      onRefresh={onRefresh}
      loading={loading}
      exportFilename="order-trend"
    >
      <Line data={chartData} options={options} />
    </BaseChart>
  );
}