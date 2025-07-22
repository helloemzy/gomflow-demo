"use client";

import { Pie } from 'react-chartjs-2';
import { ChartData } from 'chart.js';
import { PIE_CHART_OPTIONS, CHART_COLORS } from '@/lib/chartConfig';
import BaseChart from './BaseChart';
import { useEffect, useState } from 'react';

interface PaymentMethodData {
  method: string;
  count: number;
  percentage: number;
}

interface PaymentMethodChartProps {
  data: Record<string, number>;
  onRefresh?: () => void;
  loading?: boolean;
}

export default function PaymentMethodChart({ 
  data, 
  onRefresh, 
  loading = false 
}: PaymentMethodChartProps) {
  const [chartData, setChartData] = useState<ChartData<'pie'>>({
    labels: [],
    datasets: []
  });

  const getPaymentMethodName = (method: string) => {
    const names: Record<string, string> = {
      'gcash': 'GCash',
      'paymaya': 'PayMaya',
      'bank_transfer': 'Bank Transfer',
      'maybank': 'Maybank2u',
      'touch_n_go': "Touch 'n Go",
      'cimb': 'CIMB Bank',
      'grabpay': 'GrabPay',
      'boost': 'Boost',
      'fpx': 'FPX Online Banking'
    };
    return names[method] || method.replace('_', ' ').toUpperCase();
  };

  useEffect(() => {
    if (!data || Object.keys(data).length === 0) return;

    const total = Object.values(data).reduce((sum, count) => sum + count, 0);
    const processedData: PaymentMethodData[] = Object.entries(data).map(([method, count]) => ({
      method,
      count,
      percentage: (count / total) * 100
    }));

    // Sort by count descending
    processedData.sort((a, b) => b.count - a.count);

    const chartData: ChartData<'pie'> = {
      labels: processedData.map(item => getPaymentMethodName(item.method)),
      datasets: [
        {
          data: processedData.map(item => item.count),
          backgroundColor: CHART_COLORS.primary,
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverBackgroundColor: CHART_COLORS.gradient,
          hoverBorderWidth: 3
        }
      ]
    };

    setChartData(chartData);
  }, [data]);

  if (!data || Object.keys(data).length === 0) {
    return (
      <BaseChart
        title="Payment Methods Distribution"
        description="Breakdown of payment methods used by buyers"
        onRefresh={onRefresh}
        loading={loading}
        exportFilename="payment-methods"
      >
        <div className="flex items-center justify-center h-full text-gray-500">
          No payment data available
        </div>
      </BaseChart>
    );
  }

  return (
    <BaseChart
      title="Payment Methods Distribution"
      description="Breakdown of payment methods used by buyers"
      onRefresh={onRefresh}
      loading={loading}
      exportFilename="payment-methods"
    >
      <Pie data={chartData} options={PIE_CHART_OPTIONS} />
    </BaseChart>
  );
}