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
  ArcElement,
  TimeScale,
  ChartOptions,
  TooltipItem,
  ChartData,
  ScaleOptions,
  ChartType
} from 'chart.js';
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
  ArcElement,
  TimeScale
);

// GOMFLOW brand colors
export const COLORS = {
  primary: '#8B5CF6',
  secondary: '#F59E0B',
  accent: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  info: '#3B82F6',
  neutral: '#6B7280'
};

// Chart color palettes
export const CHART_COLORS = {
  primary: [
    '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#3B82F6',
    '#EC4899', '#F97316', '#84CC16', '#06B6D4', '#8B5CF6'
  ],
  gradient: [
    'rgba(139, 92, 246, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(239, 68, 68, 0.8)',
    'rgba(59, 130, 246, 0.8)'
  ]
};

// Base chart options
export const BASE_CHART_OPTIONS: ChartOptions<any> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        usePointStyle: true,
        padding: 20,
        font: {
          size: 12,
          family: 'Inter, sans-serif'
        }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: COLORS.primary,
      borderWidth: 1,
      cornerRadius: 8,
      padding: 12
    }
  },
  scales: {
    x: {
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
      grid: {
        color: 'rgba(0, 0, 0, 0.1)'
      },
      ticks: {
        font: {
          size: 11
        }
      }
    }
  }
};

// Time series chart options
export const TIME_SERIES_OPTIONS: ChartOptions<'line'> = {
  ...BASE_CHART_OPTIONS,
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
      beginAtZero: true,
      grid: {
        color: 'rgba(0, 0, 0, 0.1)'
      },
      ticks: {
        font: {
          size: 11
        }
      }
    }
  }
};

// Pie chart options
export const PIE_CHART_OPTIONS: ChartOptions<'pie'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right' as const,
      labels: {
        usePointStyle: true,
        padding: 20,
        font: {
          size: 12,
          family: 'Inter, sans-serif'
        }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: '#fff',
      bodyColor: '#fff',
      borderColor: COLORS.primary,
      borderWidth: 1,
      cornerRadius: 8,
      padding: 12,
      callbacks: {
        label: function(context: TooltipItem<'pie'>) {
          const label = context.label || '';
          const value = context.parsed;
          const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
          const percentage = ((value / total) * 100).toFixed(1);
          return `${label}: ${percentage}%`;
        }
      }
    }
  }
};

// Bar chart options
export const BAR_CHART_OPTIONS: ChartOptions<'bar'> = {
  ...BASE_CHART_OPTIONS,
  scales: {
    x: {
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
        }
      }
    }
  }
};

// Line chart options
export const LINE_CHART_OPTIONS: ChartOptions<'line'> = {
  ...BASE_CHART_OPTIONS,
  scales: {
    x: {
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
        }
      }
    }
  }
};

// Utility functions
export const formatCurrency = (amount: number, currency: string = 'PHP') => {
  const symbol = currency === 'PHP' ? '₱' : 'RM';
  return `${symbol}${amount.toLocaleString()}`;
};

export const formatPercentage = (value: number) => {
  return `${value.toFixed(1)}%`;
};

export const generateTimeSeriesData = (data: any[], dateField: string, valueField: string) => {
  const sortedData = data.sort((a, b) => new Date(a[dateField]).getTime() - new Date(b[dateField]).getTime());
  
  return sortedData.map(item => ({
    x: new Date(item[dateField]),
    y: item[valueField]
  }));
};

export const exportChartAsPNG = async (chartRef: any, filename: string) => {
  if (!chartRef.current) return;
  
  const canvas = chartRef.current;
  const url = canvas.toDataURL('image/png');
  
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = url;
  link.click();
};

export const exportChartAsPDF = async (chartRef: any, filename: string) => {
  if (typeof window === 'undefined') return;
  
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;
  
  if (!chartRef.current) return;
  
  const canvas = await html2canvas(chartRef.current);
  const imgData = canvas.toDataURL('image/png');
  
  const pdf = new jsPDF();
  const imgWidth = 210;
  const pageHeight = 295;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  
  let position = 0;
  
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;
  
  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
  
  pdf.save(`${filename}.pdf`);
};