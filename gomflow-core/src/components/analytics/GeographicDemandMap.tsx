"use client";

import { useMemo, useState } from 'react';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MapPin, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Package,
  Truck,
  DollarSign,
  Globe
} from "lucide-react";
import BaseChart from './BaseChart';
import { PIE_CHART_OPTIONS, BAR_CHART_OPTIONS, TIME_SERIES_OPTIONS, COLORS, formatCurrency } from '@/lib/chartConfig';

interface GeographicAnalysisData {
  demandByRegion: Array<{
    region: string;
    coordinates: [number, number];
    currentDemand: number;
    forecastedDemand: number;
    growthRate: number;
    confidence: number;
  }>;
  hotspots: Array<{
    region: string;
    coordinates: [number, number];
    intensity: number;
    trend: 'growing' | 'declining' | 'stable';
  }>;
  shippingOptimization: {
    recommendedHubs: Array<{
      location: string;
      coordinates: [number, number];
      coverage: string[];
      costSavings: number;
    }>;
  };
}

interface GeographicDemandMapProps {
  data: GeographicAnalysisData | null;
  isLoading: boolean;
  regions: string[];
}

export default function GeographicDemandMap({
  data,
  isLoading,
  regions
}: GeographicDemandMapProps) {
  const [selectedView, setSelectedView] = useState<'current' | 'forecast' | 'growth' | 'shipping'>('current');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');

  const demandDistributionData = useMemo(() => {
    if (!data) return null;

    const filteredData = selectedRegion === 'all' ? 
      data.demandByRegion : 
      data.demandByRegion.filter(d => d.region === selectedRegion);

    const values = selectedView === 'current' ? 
      filteredData.map(d => d.currentDemand) :
      selectedView === 'forecast' ?
      filteredData.map(d => d.forecastedDemand) :
      filteredData.map(d => d.growthRate * 100);

    return {
      labels: filteredData.map(d => d.region),
      datasets: [{
        label: selectedView === 'current' ? 'Current Demand' : 
               selectedView === 'forecast' ? 'Forecasted Demand' : 
               'Growth Rate',
        data: values,
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }]
    };
  }, [data, selectedView, selectedRegion]);

  const regionComparisonData = useMemo(() => {
    if (!data) return null;

    return {
      labels: data.demandByRegion.map(d => d.region),
      datasets: [
        {
          label: 'Current Demand',
          data: data.demandByRegion.map(d => d.currentDemand),
          backgroundColor: COLORS.primary,
          borderColor: COLORS.primary,
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Forecasted Demand',
          data: data.demandByRegion.map(d => d.forecastedDemand),
          backgroundColor: COLORS.accent,
          borderColor: COLORS.accent,
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
        }
      ]
    };
  }, [data]);

  const growthTrendData = useMemo(() => {
    if (!data) return null;

    // Generate trend data for each region
    const datasets = data.demandByRegion.map((region, index) => ({
      label: region.region,
      data: Array.from({ length: 30 }, (_, i) => ({
        x: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        y: region.currentDemand * (1 + region.growthRate * i / 30)
      })),
      borderColor: COLORS.primary.replace('246', (140 + index * 30).toString()),
      backgroundColor: `rgba(${139 + index * 30}, 92, 246, 0.1)`,
      borderWidth: 2,
      fill: false,
      tension: 0.4
    }));

    return {
      datasets
    };
  }, [data]);

  const shippingOptimizationData = useMemo(() => {
    if (!data) return null;

    const hubData = data.shippingOptimization.recommendedHubs;
    
    return {
      labels: hubData.map(h => h.location),
      datasets: [{
        label: 'Cost Savings',
        data: hubData.map(h => h.costSavings * 100),
        backgroundColor: COLORS.success,
        borderColor: COLORS.success,
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }]
    };
  }, [data]);

  const chartOptions = useMemo(() => {
    const baseOptions = selectedView === 'growth' ? TIME_SERIES_OPTIONS : BAR_CHART_OPTIONS;
    
    return {
      ...baseOptions,
      scales: {
        ...baseOptions.scales,
        y: {
          ...baseOptions.scales?.y,
          title: {
            display: true,
            text: selectedView === 'current' ? 'Current Demand' :
                 selectedView === 'forecast' ? 'Forecasted Demand' :
                 selectedView === 'growth' ? 'Growth Rate (%)' :
                 'Cost Savings (%)'
          }
        }
      }
    };
  }, [selectedView]);

  const getTrendIcon = (trend: 'growing' | 'declining' | 'stable') => {
    switch (trend) {
      case 'growing':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendBadge = (trend: 'growing' | 'declining' | 'stable') => {
    switch (trend) {
      case 'growing':
        return <Badge variant="default" className="bg-green-500">Growing</Badge>;
      case 'declining':
        return <Badge variant="destructive">Declining</Badge>;
      default:
        return <Badge variant="secondary">Stable</Badge>;
    }
  };

  const getTopRegions = () => {
    if (!data) return [];
    
    return [...data.demandByRegion]
      .sort((a, b) => b.currentDemand - a.currentDemand)
      .slice(0, 3);
  };

  const getFastestGrowingRegions = () => {
    if (!data) return [];
    
    return [...data.demandByRegion]
      .sort((a, b) => b.growthRate - a.growthRate)
      .slice(0, 3);
  };

  const topRegions = getTopRegions();
  const fastestGrowing = getFastestGrowingRegions();

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">View:</span>
          <div className="flex gap-1">
            {[
              { id: 'current', label: 'Current', icon: <Activity className="h-4 w-4" /> },
              { id: 'forecast', label: 'Forecast', icon: <TrendingUp className="h-4 w-4" /> },
              { id: 'growth', label: 'Growth', icon: <TrendingUp className="h-4 w-4" /> },
              { id: 'shipping', label: 'Shipping', icon: <Truck className="h-4 w-4" /> }
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

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Region:</span>
          <select 
            value={selectedRegion} 
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="px-3 py-1 border rounded-md text-sm"
          >
            <option value="all">All Regions</option>
            {data?.demandByRegion.map(d => (
              <option key={d.region} value={d.region}>{d.region}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Total Regions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.demandByRegion.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Active markets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Top Region
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {topRegions[0]?.region || '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {topRegions[0]?.currentDemand.toLocaleString() || 0} orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Fastest Growing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fastestGrowing[0]?.region || '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {fastestGrowing[0]?.growthRate ? `${(fastestGrowing[0].growthRate * 100).toFixed(1)}%` : '0%'} growth
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Shipping Savings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.shippingOptimization.recommendedHubs.length ? 
                `${Math.round(data.shippingOptimization.recommendedHubs.reduce((sum, h) => sum + h.costSavings, 0) / data.shippingOptimization.recommendedHubs.length * 100)}%` : 
                '--'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Avg cost reduction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BaseChart
          title={`${selectedView.charAt(0).toUpperCase() + selectedView.slice(1)} Demand by Region`}
          description="Geographic distribution of demand"
          exportFilename={`geographic-${selectedView}`}
          loading={isLoading}
        >
          {(() => {
            const currentData = selectedView === 'shipping' ? shippingOptimizationData : demandDistributionData;
            
            if (!currentData || isLoading) {
              return (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      {isLoading ? 'Loading geographic data...' : 'No geographic data available'}
                    </p>
                  </div>
                </div>
              );
            }

            return <Bar data={currentData} options={chartOptions} />;
          })()}
        </BaseChart>

        <BaseChart
          title="Current vs Forecasted Demand"
          description="Comparison of current and predicted demand"
          exportFilename="demand-comparison"
          loading={isLoading}
        >
          {regionComparisonData && !isLoading ? (
            <Bar data={regionComparisonData} options={chartOptions} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {isLoading ? 'Loading...' : 'No comparison data'}
                </p>
              </div>
            </div>
          )}
        </BaseChart>
      </div>

      {/* Hotspots */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Demand Hotspots
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data?.hotspots.map((hotspot, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{hotspot.region}</h4>
                  {getTrendBadge(hotspot.trend)}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="text-sm text-muted-foreground">Intensity</div>
                    <div className="text-2xl font-bold">
                      {Math.round(hotspot.intensity * 100)}%
                    </div>
                  </div>
                  <div className="p-2 bg-muted rounded-lg">
                    {getTrendIcon(hotspot.trend)}
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full"
                    style={{ width: `${hotspot.intensity * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Regional Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Regional Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium mb-4">Top Performing Regions</h4>
                <div className="space-y-3">
                  {topRegions.map((region, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                        </div>
                        <div>
                          <div className="font-medium">{region.region}</div>
                          <div className="text-sm text-muted-foreground">
                            {region.currentDemand.toLocaleString()} orders
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {(region.growthRate * 100).toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">growth</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-4">Fastest Growing Regions</h4>
                <div className="space-y-3">
                  {fastestGrowing.map((region, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-green-600">{index + 1}</span>
                        </div>
                        <div>
                          <div className="font-medium">{region.region}</div>
                          <div className="text-sm text-muted-foreground">
                            {region.currentDemand.toLocaleString()} orders
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-green-600">
                          +{(region.growthRate * 100).toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">growth</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Optimization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Shipping Optimization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data?.shippingOptimization.recommendedHubs.map((hub, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-50 rounded-lg">
                      <Package className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">{hub.location}</h4>
                      <p className="text-sm text-muted-foreground">
                        Covers {hub.coverage.length} regions
                      </p>
                    </div>
                  </div>
                  <Badge variant="default" className="bg-orange-500">
                    {Math.round(hub.costSavings * 100)}% savings
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Coverage Areas</div>
                    <div className="flex flex-wrap gap-1">
                      {hub.coverage.map((area, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {area}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Cost Savings</div>
                    <div className="text-lg font-bold text-green-600">
                      {Math.round(hub.costSavings * 100)}% reduction
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}