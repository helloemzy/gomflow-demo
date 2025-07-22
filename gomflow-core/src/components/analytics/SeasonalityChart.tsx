"use client";

import { useMemo, useState } from 'react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Clock, 
  TrendingUp,
  Sun,
  Moon,
  Activity
} from "lucide-react";
import BaseChart from './BaseChart';
import { BAR_CHART_OPTIONS, PIE_CHART_OPTIONS, COLORS, formatPercentage } from '@/lib/chartConfig';

interface SeasonalityData {
  weeklyPattern: Array<{
    day: string;
    averageMultiplier: number;
    confidence: number;
  }>;
  monthlyPattern: Array<{
    month: string;
    averageMultiplier: number;
    confidence: number;
  }>;
  seasonalStrength: number;
  trendStrength: number;
  peakPeriods: Array<{
    period: string;
    multiplier: number;
    duration: number;
  }>;
}

interface SeasonalityChartProps {
  data: SeasonalityData | null;
  isLoading: boolean;
  dateRange: {
    start: string;
    end: string;
  };
}

export default function SeasonalityChart({
  data,
  isLoading,
  dateRange
}: SeasonalityChartProps) {
  const [selectedView, setSelectedView] = useState<'weekly' | 'monthly' | 'peaks'>('weekly');

  const weeklyChartData = useMemo(() => {
    if (!data) return null;

    return {
      labels: data.weeklyPattern.map(p => p.day),
      datasets: [{
        label: 'Weekly Multiplier',
        data: data.weeklyPattern.map(p => p.averageMultiplier),
        backgroundColor: data.weeklyPattern.map(p => 
          p.averageMultiplier > 1.0 ? COLORS.success : 
          p.averageMultiplier < 0.8 ? COLORS.error : 
          COLORS.primary
        ),
        borderColor: data.weeklyPattern.map(p => 
          p.averageMultiplier > 1.0 ? COLORS.success : 
          p.averageMultiplier < 0.8 ? COLORS.error : 
          COLORS.primary
        ),
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }]
    };
  }, [data]);

  const monthlyChartData = useMemo(() => {
    if (!data) return null;

    return {
      labels: data.monthlyPattern.map(p => p.month.slice(0, 3)),
      datasets: [{
        label: 'Monthly Multiplier',
        data: data.monthlyPattern.map(p => p.averageMultiplier),
        backgroundColor: data.monthlyPattern.map(p => 
          p.averageMultiplier > 1.2 ? COLORS.success : 
          p.averageMultiplier < 0.9 ? COLORS.error : 
          COLORS.primary
        ),
        borderColor: data.monthlyPattern.map(p => 
          p.averageMultiplier > 1.2 ? COLORS.success : 
          p.averageMultiplier < 0.9 ? COLORS.error : 
          COLORS.primary
        ),
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }]
    };
  }, [data]);

  const peakPeriodsData = useMemo(() => {
    if (!data) return null;

    return {
      labels: data.peakPeriods.map(p => p.period),
      datasets: [{
        label: 'Peak Multiplier',
        data: data.peakPeriods.map(p => p.multiplier),
        backgroundColor: [
          COLORS.primary,
          COLORS.secondary,
          COLORS.accent
        ],
        borderColor: [
          COLORS.primary,
          COLORS.secondary,
          COLORS.accent
        ],
        borderWidth: 2,
      }]
    };
  }, [data]);

  const chartOptions = useMemo(() => ({
    ...BAR_CHART_OPTIONS,
    scales: {
      ...BAR_CHART_OPTIONS.scales,
      y: {
        ...BAR_CHART_OPTIONS.scales?.y,
        title: {
          display: true,
          text: 'Demand Multiplier'
        },
        min: 0,
        max: selectedView === 'peaks' ? 2.5 : 
             selectedView === 'monthly' ? 1.8 : 1.6
      }
    },
    plugins: {
      ...BAR_CHART_OPTIONS.plugins,
      tooltip: {
        ...BAR_CHART_OPTIONS.plugins?.tooltip,
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y;
            const percentage = ((value - 1) * 100).toFixed(1);
            return `${context.dataset.label}: ${value.toFixed(2)}x (${percentage > 0 ? '+' : ''}${percentage}%)`;
          }
        }
      }
    }
  }), [selectedView]);

  const doughnutOptions = useMemo(() => ({
    ...PIE_CHART_OPTIONS,
    plugins: {
      ...PIE_CHART_OPTIONS.plugins,
      tooltip: {
        ...PIE_CHART_OPTIONS.plugins?.tooltip,
        callbacks: {
          label: function(context: any) {
            const value = context.parsed;
            return `${context.label}: ${value.toFixed(2)}x multiplier`;
          }
        }
      }
    }
  }), []);

  const getSeasonalityStrengthBadge = () => {
    if (!data) return null;
    
    const strength = data.seasonalStrength;
    if (strength > 0.7) return <Badge variant="default" className="bg-green-500">Strong</Badge>;
    if (strength > 0.4) return <Badge variant="default" className="bg-yellow-500">Moderate</Badge>;
    return <Badge variant="secondary">Weak</Badge>;
  };

  const getBestPerformingPeriods = () => {
    if (!data) return [];
    
    const allPeriods = [
      ...data.weeklyPattern.map(p => ({ ...p, type: 'weekly' })),
      ...data.monthlyPattern.map(p => ({ ...p, type: 'monthly' })),
      ...data.peakPeriods.map(p => ({ ...p, type: 'peak', day: p.period, month: p.period, averageMultiplier: p.multiplier, confidence: 0.9 }))
    ];
    
    return allPeriods
      .filter(p => p.averageMultiplier > 1.2)
      .sort((a, b) => b.averageMultiplier - a.averageMultiplier)
      .slice(0, 3);
  };

  const getWorstPerformingPeriods = () => {
    if (!data) return [];
    
    const allPeriods = [
      ...data.weeklyPattern.map(p => ({ ...p, type: 'weekly' })),
      ...data.monthlyPattern.map(p => ({ ...p, type: 'monthly' }))
    ];
    
    return allPeriods
      .filter(p => p.averageMultiplier < 0.9)
      .sort((a, b) => a.averageMultiplier - b.averageMultiplier)
      .slice(0, 3);
  };

  const bestPeriods = getBestPerformingPeriods();
  const worstPeriods = getWorstPerformingPeriods();

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">View:</span>
          <div className="flex gap-1">
            {[
              { id: 'weekly', label: 'Weekly', icon: <Clock className="h-4 w-4" /> },
              { id: 'monthly', label: 'Monthly', icon: <Calendar className="h-4 w-4" /> },
              { id: 'peaks', label: 'Peak Periods', icon: <TrendingUp className="h-4 w-4" /> }
            ].map((view) => (
              <Button
                key={view.id}
                variant={selectedView === view.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedView(view.id as any)}
              >
                {view.icon}
                {view.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Seasonality Strength
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {data?.seasonalStrength ? formatPercentage(data.seasonalStrength * 100) : '--'}
              </span>
              {getSeasonalityStrengthBadge()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sun className="h-4 w-4" />
              Best Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.weeklyPattern.reduce((best, current) => 
                current.averageMultiplier > best.averageMultiplier ? current : best
              ).day || '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.weeklyPattern.reduce((best, current) => 
                current.averageMultiplier > best.averageMultiplier ? current : best
              ).averageMultiplier.toFixed(2)}x multiplier
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Moon className="h-4 w-4" />
              Worst Day
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.weeklyPattern.reduce((worst, current) => 
                current.averageMultiplier < worst.averageMultiplier ? current : worst
              ).day || '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.weeklyPattern.reduce((worst, current) => 
                current.averageMultiplier < worst.averageMultiplier ? current : worst
              ).averageMultiplier.toFixed(2)}x multiplier
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Peak Season
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.peakPeriods.reduce((best, current) => 
                current.multiplier > best.multiplier ? current : best
              ).period || '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {data?.peakPeriods.reduce((best, current) => 
                current.multiplier > best.multiplier ? current : best
              ).multiplier.toFixed(2)}x multiplier
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <BaseChart
            title={`${selectedView.charAt(0).toUpperCase() + selectedView.slice(1)} Seasonality Pattern`}
            description={`Demand multipliers showing ${selectedView} patterns`}
            exportFilename={`seasonality-${selectedView}`}
            loading={isLoading}
          >
            {(() => {
              const currentData = selectedView === 'weekly' ? weeklyChartData :
                                selectedView === 'monthly' ? monthlyChartData :
                                peakPeriodsData;
              
              if (!currentData || isLoading) {
                return (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">
                        {isLoading ? 'Analyzing seasonality...' : 'No seasonality data available'}
                      </p>
                    </div>
                  </div>
                );
              }

              return selectedView === 'peaks' ? (
                <Doughnut data={currentData} options={doughnutOptions} />
              ) : (
                <Bar data={currentData} options={chartOptions} />
              );
            })()}
          </BaseChart>
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Best Performing Periods */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Sun className="h-4 w-4 text-green-500" />
                Best Performing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {bestPeriods.map((period, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {period.day || period.month || period.period}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {period.type}
                      </p>
                    </div>
                    <Badge variant="default" className="bg-green-500">
                      {period.averageMultiplier.toFixed(2)}x
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Worst Performing Periods */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Moon className="h-4 w-4 text-red-500" />
                Worst Performing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {worstPeriods.map((period, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {period.day || period.month}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {period.type}
                      </p>
                    </div>
                    <Badge variant="destructive">
                      {period.averageMultiplier.toFixed(2)}x
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Insights */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Seasonality Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Weekly Patterns</h4>
                  <div className="space-y-2">
                    {data.weeklyPattern.map((day, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span>{day.day}</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${
                            day.averageMultiplier > 1.0 ? 'text-green-600' : 
                            day.averageMultiplier < 0.8 ? 'text-red-600' : 
                            'text-gray-600'
                          }`}>
                            {day.averageMultiplier.toFixed(2)}x
                          </span>
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                day.averageMultiplier > 1.0 ? 'bg-green-500' : 
                                day.averageMultiplier < 0.8 ? 'bg-red-500' : 
                                'bg-gray-400'
                              }`}
                              style={{ width: `${Math.min(day.averageMultiplier * 60, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Monthly Patterns</h4>
                  <div className="space-y-2">
                    {data.monthlyPattern.slice(0, 6).map((month, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span>{month.month}</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${
                            month.averageMultiplier > 1.2 ? 'text-green-600' : 
                            month.averageMultiplier < 0.9 ? 'text-red-600' : 
                            'text-gray-600'
                          }`}>
                            {month.averageMultiplier.toFixed(2)}x
                          </span>
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                month.averageMultiplier > 1.2 ? 'bg-green-500' : 
                                month.averageMultiplier < 0.9 ? 'bg-red-500' : 
                                'bg-gray-400'
                              }`}
                              style={{ width: `${Math.min(month.averageMultiplier * 50, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Key Recommendations</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Plan inventory increases during peak periods ({data.peakPeriods.map(p => p.period).join(', ')})</li>
                  <li>• Consider promotional campaigns during low-demand periods</li>
                  <li>• Adjust staffing levels based on weekly patterns</li>
                  <li>• Optimize marketing spend during high-multiplier periods</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}