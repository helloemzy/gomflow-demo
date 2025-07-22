"use client";

import { Bar } from 'react-chartjs-2';
import { ChartData } from 'chart.js';
import { BAR_CHART_OPTIONS, CHART_COLORS } from '@/lib/chartConfig';
import BaseChart from './BaseChart';
import { useEffect, useState } from 'react';

interface GeographicData {
  country: string;
  region?: string;
  city?: string;
  orderCount: number;
  revenue: number;
  buyers: number;
}

interface GeographicChartProps {
  data: GeographicData[];
  currency: string;
  groupBy: 'country' | 'region' | 'city';
  onRefresh?: () => void;
  loading?: boolean;
}

export default function GeographicChart({ 
  data, 
  currency,
  groupBy = 'country',
  onRefresh, 
  loading = false 
}: GeographicChartProps) {
  const [chartData, setChartData] = useState<ChartData<'bar'>>({
    labels: [],
    datasets: []
  });

  const getLocationName = (item: GeographicData) => {
    switch (groupBy) {
      case 'country':
        return item.country;
      case 'region':
        return item.region || item.country;
      case 'city':
        return item.city || item.region || item.country;
      default:
        return item.country;
    }
  };

  const getCountryFlag = (country: string) => {
    const flags: Record<string, string> = {
      'Philippines': '🇵🇭',
      'Malaysia': '🇲🇾',
      'Singapore': '🇸🇬',
      'Thailand': '🇹🇭',
      'Indonesia': '🇮🇩',
      'Vietnam': '🇻🇳',
      'South Korea': '🇰🇷',
      'Japan': '🇯🇵',
      'United States': '🇺🇸',
      'Canada': '🇨🇦',
      'Australia': '🇦🇺',
      'United Kingdom': '🇬🇧'
    };
    return flags[country] || '🌍';
  };

  useEffect(() => {
    if (!data || data.length === 0) return;

    // Group data by the selected groupBy field
    const groupedData = data.reduce((acc, item) => {
      const key = getLocationName(item);
      if (!acc[key]) {
        acc[key] = {
          location: key,
          country: item.country,
          orderCount: 0,
          revenue: 0,
          buyers: 0
        };
      }
      acc[key].orderCount += item.orderCount;
      acc[key].revenue += item.revenue;
      acc[key].buyers += item.buyers;
      return acc;
    }, {} as Record<string, any>);

    const processedData = Object.values(groupedData).sort((a: any, b: any) => b.orderCount - a.orderCount);

    const chartData: ChartData<'bar'> = {
      labels: processedData.map((item: any) => 
        `${getCountryFlag(item.country)} ${item.location}`
      ),
      datasets: [
        {
          label: 'Order Count',
          data: processedData.map((item: any) => item.orderCount),
          backgroundColor: CHART_COLORS.primary[0],
          borderColor: CHART_COLORS.primary[0],
          borderWidth: 1,
          yAxisID: 'y',
          borderRadius: 8,
          borderSkipped: false
        },
        {
          label: 'Unique Buyers',
          data: processedData.map((item: any) => item.buyers),
          backgroundColor: CHART_COLORS.primary[1],
          borderColor: CHART_COLORS.primary[1],
          borderWidth: 1,
          yAxisID: 'y',
          borderRadius: 8,
          borderSkipped: false
        },
        {
          label: `Revenue (${currency})`,
          data: processedData.map((item: any) => item.revenue),
          backgroundColor: CHART_COLORS.primary[2],
          borderColor: CHART_COLORS.primary[2],
          borderWidth: 1,
          yAxisID: 'y1',
          borderRadius: 8,
          borderSkipped: false
        }
      ]
    };

    setChartData(chartData);
  }, [data, groupBy, currency]);

  const options = {
    ...BAR_CHART_OPTIONS,
    indexAxis: 'y' as const,
    scales: {
      x: {
        type: 'linear' as const,
        display: true,
        position: 'bottom' as const,
        beginAtZero: true,
        title: {
          display: true,
          text: 'Count / Revenue'
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
      y: {
        type: 'category' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Location'
        },
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 11
          }
        }
      }
    },
    plugins: {
      ...BAR_CHART_OPTIONS.plugins,
      tooltip: {
        ...BAR_CHART_OPTIONS.plugins?.tooltip,
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            
            if (context.dataset.label?.includes('Revenue')) {
              const symbol = currency === 'PHP' ? '₱' : 'RM';
              label += `${symbol}${context.parsed.x.toLocaleString()}`;
            } else {
              label += context.parsed.x.toLocaleString();
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
        title="Geographic Distribution"
        description={`Orders and revenue by ${groupBy}`}
        onRefresh={onRefresh}
        loading={loading}
        exportFilename="geographic-distribution"
      >
        <div className="flex items-center justify-center h-full text-gray-500">
          No geographic data available
        </div>
      </BaseChart>
    );
  }

  return (
    <BaseChart
      title="Geographic Distribution"
      description={`Orders and revenue by ${groupBy}`}
      onRefresh={onRefresh}
      loading={loading}
      exportFilename="geographic-distribution"
    >
      <Bar data={chartData} options={options} />
    </BaseChart>
  );
}