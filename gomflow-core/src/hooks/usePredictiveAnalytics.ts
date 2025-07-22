"use client";

import { useState, useEffect, useCallback } from 'react';
import { 
  DemandForecastingInput,
  PredictionResult,
  SeasonalityAnalysisResult,
  ComebackPredictionResult,
  ModelMetrics,
  AdvancedAnalyticsResult
} from '@/lib/ml/types';
import { 
  forecastDemand, 
  analyzeSeasonality, 
  predictComebacks 
} from '@/lib/ml';

interface PredictiveAnalyticsHookProps {
  gomId?: string;
  dateRange: {
    start: string;
    end: string;
  };
  categories?: string[];
  regions?: string[];
  forecastHorizon?: number;
  confidenceLevel?: number;
}

interface DemandForecastData {
  predictions: Array<{
    date: string;
    value: number;
    confidence: {
      lower: number;
      upper: number;
      confidence: number;
    };
  }>;
  totalRevenueForecast: number;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  trendStrength: number;
  seasonalityStrength: number;
  metadata: {
    modelVersion: string;
    lastTraining: string;
    dataPoints: number;
  };
}

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

interface SupplyChainRecommendationData {
  recommendations: Array<{
    category: string;
    currentStock: number;
    recommendedStock: number;
    reasoning: string;
    confidence: number;
    timeframe: 'immediate' | 'short_term' | 'long_term';
    impact: 'high' | 'medium' | 'low';
  }>;
  optimization: {
    totalCostSavings: number;
    stockoutRiskReduction: number;
    recommendedActions: string[];
  };
}

export function usePredictiveAnalytics({
  gomId,
  dateRange,
  categories = [],
  regions = [],
  forecastHorizon = 30,
  confidenceLevel = 95
}: PredictiveAnalyticsHookProps) {
  const [demandForecast, setDemandForecast] = useState<DemandForecastData | null>(null);
  const [seasonalityAnalysis, setSeasonalityAnalysis] = useState<SeasonalityData | null>(null);
  const [comebackPredictions, setComebackPredictions] = useState<ComebackPredictionData | null>(null);
  const [geographicAnalysis, setGeographicAnalysis] = useState<GeographicAnalysisData | null>(null);
  const [supplyChainRecommendations, setSupplyChainRecommendations] = useState<SupplyChainRecommendationData | null>(null);
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  // Fetch historical data for ML models
  const fetchHistoricalData = useCallback(async () => {
    try {
      const response = await fetch('/api/analytics/historical-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gomId,
          dateRange,
          categories,
          regions
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch historical data');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Error fetching historical data:', err);
      throw err;
    }
  }, [gomId, dateRange, categories, regions]);

  // Generate demand forecast
  const generateDemandForecast = useCallback(async (historicalData: any) => {
    try {
      // Prepare input for ML model
      const forecastInput: DemandForecastingInput = {
        orderHistory: historicalData.orderHistory,
        seasonalFactors: historicalData.seasonalFactors,
        externalFactors: historicalData.externalFactors,
        forecastPeriod: forecastHorizon
      };

      // Use ML model to generate forecast
      const result = await forecastDemand(forecastInput);
      
      // Transform result to component format
      const transformedResult: DemandForecastData = {
        predictions: result.predictions.map((pred, index) => ({
          date: new Date(Date.now() + index * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          value: pred,
          confidence: {
            lower: pred * (1 - (1 - confidenceLevel / 100)),
            upper: pred * (1 + (1 - confidenceLevel / 100)),
            confidence: result.confidence[index]
          }
        })),
        totalRevenueForecast: result.predictions.reduce((sum, pred) => sum + pred * 25, 0), // Assuming avg order value of 25
        trendDirection: result.predictions[result.predictions.length - 1] > result.predictions[0] ? 'increasing' : 'decreasing',
        trendStrength: Math.abs(result.predictions[result.predictions.length - 1] - result.predictions[0]) / result.predictions[0],
        seasonalityStrength: 0.3, // Placeholder
        metadata: {
          modelVersion: '1.0',
          lastTraining: new Date().toISOString(),
          dataPoints: historicalData.orderHistory.length
        }
      };

      setDemandForecast(transformedResult);
    } catch (err) {
      console.error('Error generating demand forecast:', err);
      throw err;
    }
  }, [forecastHorizon, confidenceLevel]);

  // Generate seasonality analysis
  const generateSeasonalityAnalysis = useCallback(async (historicalData: any) => {
    try {
      const result = await analyzeSeasonality(historicalData.orderHistory);
      
      const transformedResult: SeasonalityData = {
        weeklyPattern: [
          { day: 'Monday', averageMultiplier: 0.85, confidence: 0.9 },
          { day: 'Tuesday', averageMultiplier: 0.75, confidence: 0.9 },
          { day: 'Wednesday', averageMultiplier: 0.8, confidence: 0.9 },
          { day: 'Thursday', averageMultiplier: 0.9, confidence: 0.9 },
          { day: 'Friday', averageMultiplier: 1.2, confidence: 0.9 },
          { day: 'Saturday', averageMultiplier: 1.4, confidence: 0.9 },
          { day: 'Sunday', averageMultiplier: 1.3, confidence: 0.9 }
        ],
        monthlyPattern: [
          { month: 'January', averageMultiplier: 0.8, confidence: 0.85 },
          { month: 'February', averageMultiplier: 0.9, confidence: 0.85 },
          { month: 'March', averageMultiplier: 1.1, confidence: 0.85 },
          { month: 'April', averageMultiplier: 1.0, confidence: 0.85 },
          { month: 'May', averageMultiplier: 1.2, confidence: 0.85 },
          { month: 'June', averageMultiplier: 1.3, confidence: 0.85 },
          { month: 'July', averageMultiplier: 1.1, confidence: 0.85 },
          { month: 'August', averageMultiplier: 1.0, confidence: 0.85 },
          { month: 'September', averageMultiplier: 1.4, confidence: 0.85 },
          { month: 'October', averageMultiplier: 1.3, confidence: 0.85 },
          { month: 'November', averageMultiplier: 1.5, confidence: 0.85 },
          { month: 'December', averageMultiplier: 1.6, confidence: 0.85 }
        ],
        seasonalStrength: result.seasonalityStrength,
        trendStrength: result.trendStrength,
        peakPeriods: [
          { period: 'Holiday Season', multiplier: 1.8, duration: 30 },
          { period: 'Summer Break', multiplier: 1.3, duration: 60 },
          { period: 'Comeback Season', multiplier: 2.2, duration: 14 }
        ]
      };

      setSeasonalityAnalysis(transformedResult);
    } catch (err) {
      console.error('Error generating seasonality analysis:', err);
      throw err;
    }
  }, []);

  // Generate comeback predictions
  const generateComebackPredictions = useCallback(async (historicalData: any) => {
    try {
      const artists = ['BTS', 'BLACKPINK', 'TWICE', 'SEVENTEEN', 'ITZY'];
      const predictions = await Promise.all(
        artists.map(async (artist) => {
          const result = await predictComebacks({
            artist,
            previousComebacks: historicalData.comebackHistory?.[artist] || [],
            marketIndicators: historicalData.marketIndicators || [],
            socialMediaSignals: historicalData.socialMediaSignals?.[artist] || []
          });

          return {
            artist,
            predictedDate: result.predictedDate,
            confidence: result.confidence,
            impactForecast: result.impactForecast,
            preparationRecommendations: result.preparationRecommendations
          };
        })
      );

      const transformedResult: ComebackPredictionData = {
        predictions,
        upcomingEvents: predictions
          .filter(p => new Date(p.predictedDate) > new Date())
          .slice(0, 5)
          .map(p => ({
            artist: p.artist,
            date: p.predictedDate,
            type: 'Album Release',
            confidence: p.confidence
          }))
      };

      setComebackPredictions(transformedResult);
    } catch (err) {
      console.error('Error generating comeback predictions:', err);
      throw err;
    }
  }, []);

  // Generate geographic analysis
  const generateGeographicAnalysis = useCallback(async (historicalData: any) => {
    try {
      // Mock geographic analysis data
      const mockData: GeographicAnalysisData = {
        demandByRegion: [
          { region: 'Metro Manila', coordinates: [14.5995, 120.9842], currentDemand: 1200, forecastedDemand: 1380, growthRate: 0.15, confidence: 0.85 },
          { region: 'Cebu', coordinates: [10.3157, 123.8854], currentDemand: 450, forecastedDemand: 520, growthRate: 0.156, confidence: 0.82 },
          { region: 'Davao', coordinates: [7.1907, 125.4553], currentDemand: 280, forecastedDemand: 310, growthRate: 0.11, confidence: 0.78 },
          { region: 'Kuala Lumpur', coordinates: [3.1390, 101.6869], currentDemand: 890, forecastedDemand: 1050, growthRate: 0.18, confidence: 0.88 },
          { region: 'Penang', coordinates: [5.4164, 100.3327], currentDemand: 320, forecastedDemand: 360, growthRate: 0.125, confidence: 0.80 }
        ],
        hotspots: [
          { region: 'Metro Manila', coordinates: [14.5995, 120.9842], intensity: 0.95, trend: 'growing' },
          { region: 'Kuala Lumpur', coordinates: [3.1390, 101.6869], intensity: 0.88, trend: 'growing' },
          { region: 'Cebu', coordinates: [10.3157, 123.8854], intensity: 0.72, trend: 'stable' }
        ],
        shippingOptimization: {
          recommendedHubs: [
            { location: 'Manila', coordinates: [14.5995, 120.9842], coverage: ['Metro Manila', 'Central Luzon', 'Calabarzon'], costSavings: 0.15 },
            { location: 'Kuala Lumpur', coordinates: [3.1390, 101.6869], coverage: ['Selangor', 'Kuala Lumpur', 'Putrajaya'], costSavings: 0.12 }
          ]
        }
      };

      setGeographicAnalysis(mockData);
    } catch (err) {
      console.error('Error generating geographic analysis:', err);
      throw err;
    }
  }, []);

  // Generate supply chain recommendations
  const generateSupplyChainRecommendations = useCallback(async (historicalData: any) => {
    try {
      // Mock supply chain recommendations
      const mockData: SupplyChainRecommendationData = {
        recommendations: [
          {
            category: 'Albums',
            currentStock: 50,
            recommendedStock: 120,
            reasoning: 'Upcoming comeback season expected to increase demand by 140%',
            confidence: 0.92,
            timeframe: 'immediate',
            impact: 'high'
          },
          {
            category: 'Photocards',
            currentStock: 200,
            recommendedStock: 280,
            reasoning: 'Seasonal trend shows 40% increase in Q4',
            confidence: 0.78,
            timeframe: 'short_term',
            impact: 'medium'
          },
          {
            category: 'Merchandise',
            currentStock: 80,
            recommendedStock: 75,
            reasoning: 'Declining trend suggests reducing inventory by 6%',
            confidence: 0.65,
            timeframe: 'long_term',
            impact: 'low'
          }
        ],
        optimization: {
          totalCostSavings: 12500,
          stockoutRiskReduction: 0.35,
          recommendedActions: [
            'Increase album inventory immediately',
            'Set up automated reorder points',
            'Negotiate better terms with suppliers for bulk orders'
          ]
        }
      };

      setSupplyChainRecommendations(mockData);
    } catch (err) {
      console.error('Error generating supply chain recommendations:', err);
      throw err;
    }
  }, []);

  // Load all predictive analytics data
  const loadPredictiveAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch historical data
      const historicalData = await fetchHistoricalData();

      // Generate all predictions in parallel
      await Promise.all([
        generateDemandForecast(historicalData),
        generateSeasonalityAnalysis(historicalData),
        generateComebackPredictions(historicalData),
        generateGeographicAnalysis(historicalData),
        generateSupplyChainRecommendations(historicalData)
      ]);

      // Mock model metrics
      setModelMetrics({
        accuracy: 0.87,
        precision: 0.84,
        recall: 0.89,
        f1Score: 0.86,
        mae: 12.5,
        mse: 245.8,
        rmse: 15.7,
        mape: 8.3,
        r2Score: 0.82,
        loss: 0.15
      });

      setLastUpdate(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load predictive analytics');
    } finally {
      setIsLoading(false);
    }
  }, [
    fetchHistoricalData,
    generateDemandForecast,
    generateSeasonalityAnalysis,
    generateComebackPredictions,
    generateGeographicAnalysis,
    generateSupplyChainRecommendations
  ]);

  // Train ML model
  const trainModel = useCallback(async () => {
    try {
      const response = await fetch('/api/ml/train-model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gomId,
          dateRange,
          categories,
          regions
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to train model');
      }

      const result = await response.json();
      setModelMetrics(result.metrics);
      setLastUpdate(new Date().toISOString());
      
      // Refresh predictions with new model
      await loadPredictiveAnalytics();
    } catch (err) {
      console.error('Error training model:', err);
      throw err;
    }
  }, [gomId, dateRange, categories, regions, loadPredictiveAnalytics]);

  // Update forecast parameters
  const updateForecastParams = useCallback(async (horizon: number, confidence: number) => {
    try {
      const historicalData = await fetchHistoricalData();
      await generateDemandForecast(historicalData);
    } catch (err) {
      console.error('Error updating forecast parameters:', err);
      throw err;
    }
  }, [fetchHistoricalData, generateDemandForecast]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    await loadPredictiveAnalytics();
  }, [loadPredictiveAnalytics]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadPredictiveAnalytics();
  }, [loadPredictiveAnalytics]);

  return {
    demandForecast,
    seasonalityAnalysis,
    comebackPredictions,
    geographicAnalysis,
    supplyChainRecommendations,
    modelMetrics,
    isLoading,
    error,
    lastUpdate,
    refreshData,
    trainModel,
    updateForecastParams
  };
}