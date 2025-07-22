"use client";

import { Bar } from 'react-chartjs-2';
import { ChartData } from 'chart.js';
import { BAR_CHART_OPTIONS, COLORS } from '@/lib/chartConfig';
import BaseChart from './BaseChart';
import { useEffect, useState } from 'react';

interface PaymentStatusData {
  status: string;
  count: number;
  percentage: number;
}

interface PaymentStatusChartProps {
  data: Record<string, number>;
  totalSubmissions: number;
  onRefresh?: () => void;
  loading?: boolean;
}

export default function PaymentStatusChart({ 
  data, 
  totalSubmissions,
  onRefresh, 
  loading = false 
}: PaymentStatusChartProps) {
  const [chartData, setChartData] = useState<ChartData<'bar'>>({
    labels: [],
    datasets: []
  });

  const getStatusName = (status: string) => {
    const names: Record<string, string> = {
      'pending': 'Pending Payment',
      'pending_verification': 'Pending Verification',
      'confirmed': 'Confirmed',
      'rejected': 'Rejected',
      'expired': 'Expired'
    };
    return names[status] || status.replace('_', ' ').toUpperCase();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': COLORS.neutral,
      'pending_verification': COLORS.warning,
      'confirmed': COLORS.success,
      'rejected': COLORS.error,
      'expired': COLORS.neutral
    };
    return colors[status] || COLORS.neutral;
  };

  useEffect(() => {
    if (!data || Object.keys(data).length === 0) return;

    // Define the order of statuses for the funnel
    const statusOrder = ['pending', 'pending_verification', 'confirmed', 'rejected', 'expired'];
    
    const processedData: PaymentStatusData[] = statusOrder
      .filter(status => data[status] > 0)
      .map(status => ({
        status,
        count: data[status],
        percentage: (data[status] / totalSubmissions) * 100
      }));

    const chartData: ChartData<'bar'> = {
      labels: processedData.map(item => getStatusName(item.status)),
      datasets: [
        {
          label: 'Submissions',
          data: processedData.map(item => item.count),
          backgroundColor: processedData.map(item => getStatusColor(item.status)),
          borderColor: processedData.map(item => getStatusColor(item.status)),
          borderWidth: 1,
          borderRadius: 8,
          borderSkipped: false
        }
      ]
    };

    setChartData(chartData);
  }, [data, totalSubmissions]);

  const options = {
    ...BAR_CHART_OPTIONS,
    plugins: {
      ...BAR_CHART_OPTIONS.plugins,
      legend: {
        display: false
      },
      tooltip: {
        ...BAR_CHART_OPTIONS.plugins?.tooltip,
        callbacks: {
          label: function(context: any) {
            const percentage = ((context.parsed.y / totalSubmissions) * 100).toFixed(1);
            return `${context.parsed.y} submissions (${percentage}%)`;
          }
        }
      }
    },
    scales: {
      ...BAR_CHART_OPTIONS.scales,
      y: {
        ...BAR_CHART_OPTIONS.scales?.y,
        title: {
          display: true,
          text: 'Number of Submissions'
        }
      }
    }
  };

  if (!data || Object.keys(data).length === 0) {
    return (
      <BaseChart
        title="Payment Status Funnel"
        description="Track payment progress through different stages"
        onRefresh={onRefresh}
        loading={loading}
        exportFilename="payment-status"
      >
        <div className="flex items-center justify-center h-full text-gray-500">
          No status data available
        </div>
      </BaseChart>
    );
  }

  return (
    <BaseChart
      title="Payment Status Funnel"
      description="Track payment progress through different stages"
      onRefresh={onRefresh}
      loading={loading}
      exportFilename="payment-status"
    >
      <Bar data={chartData} options={options} />
    </BaseChart>
  );
}