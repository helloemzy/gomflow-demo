"use client";

import { useMemo, useState } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, 
  Star, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Music,
  Users,
  Target
} from "lucide-react";
import BaseChart from './BaseChart';
import { TIME_SERIES_OPTIONS, BAR_CHART_OPTIONS, COLORS, formatCurrency } from '@/lib/chartConfig';

interface ComebackPredictionData {
  predictions: Array<{
    artist: string;
    predictedDate: string;
    confidence: number;
    impactForecast: {
      expectedPeakIncrease: number;
      expectedDuration: number;
      categoryImpact: Record<string, number>;
    };
    preparationRecommendations: string[];
  }>;
  upcomingEvents: Array<{
    artist: string;
    date: string;
    type: string;
    confidence: number;
  }>;
}

interface ComebackPredictionTimelineProps {
  data: ComebackPredictionData | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export default function ComebackPredictionTimeline({
  data,
  isLoading,
  onRefresh
}: ComebackPredictionTimelineProps) {
  const [selectedArtist, setSelectedArtist] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'30' | '60' | '90' | '180'>('90');

  const timelineData = useMemo(() => {
    if (!data) return null;

    const filteredPredictions = data.predictions.filter(p => {
      const predictionDate = new Date(p.predictedDate);
      const now = new Date();
      const cutoff = new Date(now.getTime() + parseInt(timeRange) * 24 * 60 * 60 * 1000);
      
      const withinRange = predictionDate >= now && predictionDate <= cutoff;
      const artistMatch = selectedArtist === 'all' || p.artist === selectedArtist;
      
      return withinRange && artistMatch;
    });

    // Generate timeline points
    const timelinePoints = [];
    const now = new Date();
    const endDate = new Date(now.getTime() + parseInt(timeRange) * 24 * 60 * 60 * 1000);
    
    // Create daily timeline
    for (let d = new Date(now); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const prediction = filteredPredictions.find(p => p.predictedDate === dateStr);
      
      timelinePoints.push({
        date: dateStr,
        value: prediction ? prediction.impactForecast.expectedPeakIncrease : 0,
        artist: prediction?.artist || null,
        confidence: prediction?.confidence || 0
      });
    }

    return {
      labels: timelinePoints.map(p => new Date(p.date).toLocaleDateString()),
      datasets: [{
        label: 'Predicted Impact',
        data: timelinePoints.map(p => p.value),
        borderColor: COLORS.primary,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        pointRadius: timelinePoints.map(p => p.value > 0 ? 6 : 2),
        pointHoverRadius: timelinePoints.map(p => p.value > 0 ? 8 : 4),
        pointBackgroundColor: timelinePoints.map(p => 
          p.value > 0 ? COLORS.accent : COLORS.neutral
        ),
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        tension: 0.4
      }]
    };
  }, [data, selectedArtist, timeRange]);

  const impactByArtistData = useMemo(() => {
    if (!data) return null;

    const artistImpacts = data.predictions.reduce((acc, p) => {
      acc[p.artist] = (acc[p.artist] || 0) + p.impactForecast.expectedPeakIncrease;
      return acc;
    }, {} as Record<string, number>);

    return {
      labels: Object.keys(artistImpacts),
      datasets: [{
        label: 'Total Expected Impact',
        data: Object.values(artistImpacts),
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false,
      }]
    };
  }, [data]);

  const timelineOptions = useMemo(() => ({
    ...TIME_SERIES_OPTIONS,
    scales: {
      ...TIME_SERIES_OPTIONS.scales,
      y: {
        ...TIME_SERIES_OPTIONS.scales?.y,
        title: {
          display: true,
          text: 'Impact Multiplier'
        },
        min: 0
      }
    },
    plugins: {
      ...TIME_SERIES_OPTIONS.plugins,
      tooltip: {
        ...TIME_SERIES_OPTIONS.plugins?.tooltip,
        callbacks: {
          label: function(context: any) {
            if (context.parsed.y === 0) return 'No predicted comebacks';
            return `Impact: ${context.parsed.y.toFixed(1)}x increase`;
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
          text: 'Impact Multiplier'
        }
      }
    }
  }), []);

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge variant="default" className="bg-green-500">High</Badge>;
    if (confidence >= 0.6) return <Badge variant="default" className="bg-yellow-500">Medium</Badge>;
    return <Badge variant="secondary">Low</Badge>;
  };

  const getUpcomingEvents = () => {
    if (!data) return [];
    
    return data.upcomingEvents
      .filter(e => new Date(e.date) > new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  };

  const getHighestImpactPrediction = () => {
    if (!data) return null;
    
    return data.predictions.reduce((max, current) => 
      current.impactForecast.expectedPeakIncrease > max.impactForecast.expectedPeakIncrease ? current : max
    );
  };

  const upcomingEvents = getUpcomingEvents();
  const highestImpact = getHighestImpactPrediction();

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Time Range:</span>
          <div className="flex gap-1">
            {[
              { value: '30', label: '30 days' },
              { value: '60', label: '60 days' },
              { value: '90', label: '90 days' },
              { value: '180', label: '180 days' }
            ].map((range) => (
              <Button
                key={range.value}
                variant={timeRange === range.value ? "default" : "ghost"}
                size="sm"
                onClick={() => setTimeRange(range.value as any)}
              >
                {range.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Artist:</span>
          <select 
            value={selectedArtist} 
            onChange={(e) => setSelectedArtist(e.target.value)}
            className="px-3 py-1 border rounded-md text-sm"
          >
            <option value="all">All Artists</option>
            {data?.predictions.map(p => p.artist).filter((artist, index, self) => 
              self.indexOf(artist) === index
            ).map(artist => (
              <option key={artist} value={artist}>{artist}</option>
            ))}
          </select>
        </div>

        <Button onClick={onRefresh} disabled={isLoading} size="sm">
          <Clock className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Next Comeback
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">
                {upcomingEvents[0]?.artist || '--'}
              </div>
              <p className="text-xs text-muted-foreground">
                {upcomingEvents[0]?.date ? 
                  new Date(upcomingEvents[0].date).toLocaleDateString() : 
                  'No predictions'
                }
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Highest Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">
                {highestImpact?.impactForecast.expectedPeakIncrease.toFixed(1)}x
              </div>
              <p className="text-xs text-muted-foreground">
                {highestImpact?.artist || '--'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Tracked Artists
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">
                {data?.predictions.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Active predictions
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Avg Confidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="text-2xl font-bold">
                {data?.predictions.length ? 
                  Math.round(data.predictions.reduce((sum, p) => sum + p.confidence, 0) / data.predictions.length * 100) : 0
                }%
              </div>
              <p className="text-xs text-muted-foreground">
                Prediction accuracy
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <BaseChart
            title="Comeback Impact Timeline"
            description={`Predicted demand spikes over the next ${timeRange} days`}
            exportFilename="comeback-timeline"
            onRefresh={onRefresh}
            loading={isLoading}
          >
            {timelineData && !isLoading ? (
              <Line data={timelineData} options={timelineOptions} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Music className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {isLoading ? 'Analyzing comeback patterns...' : 'No comeback predictions available'}
                  </p>
                </div>
              </div>
            )}
          </BaseChart>
        </div>

        <div>
          <BaseChart
            title="Impact by Artist"
            description="Total expected impact per artist"
            exportFilename="artist-impact"
            loading={isLoading}
          >
            {impactByArtistData && !isLoading ? (
              <Bar data={impactByArtistData} options={barOptions} />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {isLoading ? 'Loading...' : 'No artist data'}
                  </p>
                </div>
              </div>
            )}
          </BaseChart>
        </div>
      </div>

      {/* Upcoming Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Comeback Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <Music className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">{event.artist}</h4>
                      <p className="text-sm text-muted-foreground">{event.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.date).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getConfidenceBadge(event.confidence)}
                    <span className="text-sm text-muted-foreground">
                      {Math.round(event.confidence * 100)}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No upcoming comebacks predicted</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Predictions */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detailed Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {data.predictions.map((prediction, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Star className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">{prediction.artist}</h4>
                        <p className="text-sm text-muted-foreground">
                          Predicted: {new Date(prediction.predictedDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getConfidenceBadge(prediction.confidence)}
                      <span className="text-sm text-muted-foreground">
                        {Math.round(prediction.confidence * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                    <div>
                      <h5 className="font-medium text-sm mb-2">Expected Impact</h5>
                      <p className="text-2xl font-bold text-green-600">
                        {prediction.impactForecast.expectedPeakIncrease.toFixed(1)}x
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Peak increase
                      </p>
                    </div>
                    <div>
                      <h5 className="font-medium text-sm mb-2">Duration</h5>
                      <p className="text-2xl font-bold text-blue-600">
                        {prediction.impactForecast.expectedDuration}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Days
                      </p>
                    </div>
                    <div>
                      <h5 className="font-medium text-sm mb-2">Top Category</h5>
                      <p className="text-lg font-bold text-purple-600">
                        {Object.entries(prediction.impactForecast.categoryImpact)
                          .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Most affected
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <h5 className="font-medium text-sm mb-2">Preparation Recommendations</h5>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {prediction.preparationRecommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}