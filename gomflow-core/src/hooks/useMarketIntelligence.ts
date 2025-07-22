import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  MarketTrend, 
  CompetitorAnalysis, 
  MarketSentiment, 
  BuyerBehavior, 
  MarketOpportunity, 
  PriceOptimization, 
  LiveMarketData,
  GeographicTrend,
  marketAnalytics 
} from '../lib/market/marketAnalytics';

interface MarketIntelligenceState {
  liveData: LiveMarketData | null;
  trendingProducts: MarketTrend[];
  competitors: CompetitorAnalysis[];
  sentiment: MarketSentiment[];
  buyerBehavior: BuyerBehavior[];
  opportunities: MarketOpportunity[];
  priceOptimization: PriceOptimization[];
  geographicTrends: GeographicTrend[];
  loading: boolean;
  error: string | null;
}

interface MarketIntelligenceHook extends MarketIntelligenceState {
  refreshData: () => Promise<void>;
  subscribeToUpdates: () => void;
  unsubscribeFromUpdates: () => void;
  getPriceOptimization: (product: string) => Promise<PriceOptimization | null>;
  getMarketOpportunities: (gomId?: string) => Promise<MarketOpportunity[]>;
  getCompetitorPriceHistory: (product: string, days?: number) => Promise<any[]>;
  getMarketVolatility: () => Promise<any>;
  getCategoryPerformance: () => Promise<any[]>;
  isConnected: boolean;
}

export const useMarketIntelligence = (
  autoRefresh: boolean = true,
  refreshInterval: number = 30000
): MarketIntelligenceHook => {
  const [state, setState] = useState<MarketIntelligenceState>({
    liveData: null,
    trendingProducts: [],
    competitors: [],
    sentiment: [],
    buyerBehavior: [],
    opportunities: [],
    priceOptimization: [],
    geographicTrends: [],
    loading: true,
    error: null
  });

  const [isConnected, setIsConnected] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const subscribedRef = useRef(false);

  const refreshData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const [
        liveData,
        trendingProducts,
        competitors,
        sentiment,
        buyerBehavior,
        opportunities,
        geographicTrends
      ] = await Promise.all([
        marketAnalytics.getLiveMarketData(),
        marketAnalytics.getTrendingProducts(10),
        marketAnalytics.getCompetitorAnalysis(),
        marketAnalytics.getMarketSentiment(),
        marketAnalytics.getBuyerBehaviorAnalysis(),
        marketAnalytics.getMarketOpportunities(),
        marketAnalytics.getGeographicTrends()
      ]);

      setState(prev => ({
        ...prev,
        liveData,
        trendingProducts,
        competitors,
        sentiment,
        buyerBehavior,
        opportunities,
        geographicTrends,
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch market data',
        loading: false
      }));
    }
  }, []);

  const subscribeToUpdates = useCallback(() => {
    if (subscribedRef.current) return;

    subscribedRef.current = true;
    setIsConnected(true);

    // Subscribe to real-time updates
    marketAnalytics.subscribe('live_data', (data: LiveMarketData) => {
      setState(prev => ({ ...prev, liveData: data }));
    });

    marketAnalytics.subscribe('trending_products', (data: MarketTrend[]) => {
      setState(prev => ({ ...prev, trendingProducts: data }));
    });

    marketAnalytics.subscribe('sentiment_update', (data: MarketSentiment[]) => {
      setState(prev => ({ ...prev, sentiment: data }));
    });

    marketAnalytics.subscribe('competitor_update', (data: CompetitorAnalysis[]) => {
      setState(prev => ({ ...prev, competitors: data }));
    });

    marketAnalytics.subscribe('opportunities_update', (data: MarketOpportunity[]) => {
      setState(prev => ({ ...prev, opportunities: data }));
    });

    marketAnalytics.subscribe('geographic_update', (data: GeographicTrend[]) => {
      setState(prev => ({ ...prev, geographicTrends: data }));
    });

    // Connection status updates
    marketAnalytics.subscribe('connection_status', (connected: boolean) => {
      setIsConnected(connected);
    });
  }, []);

  const unsubscribeFromUpdates = useCallback(() => {
    if (!subscribedRef.current) return;

    subscribedRef.current = false;
    setIsConnected(false);

    // Unsubscribe from all events
    const events = [
      'live_data',
      'trending_products',
      'sentiment_update',
      'competitor_update',
      'opportunities_update',
      'geographic_update',
      'connection_status'
    ];

    events.forEach(event => {
      marketAnalytics.unsubscribe(event, () => {});
    });
  }, []);

  const getPriceOptimization = useCallback(async (product: string) => {
    return await marketAnalytics.getPriceOptimization(product);
  }, []);

  const getMarketOpportunities = useCallback(async (gomId?: string) => {
    return await marketAnalytics.getMarketOpportunities(gomId);
  }, []);

  const getCompetitorPriceHistory = useCallback(async (product: string, days: number = 30) => {
    return await marketAnalytics.getCompetitorPriceHistory(product, days);
  }, []);

  const getMarketVolatility = useCallback(async () => {
    return await marketAnalytics.getMarketVolatility();
  }, []);

  const getCategoryPerformance = useCallback(async () => {
    return await marketAnalytics.getCategoryPerformance();
  }, []);

  // Initialize data on mount
  useEffect(() => {
    refreshData();
    
    if (autoRefresh) {
      subscribeToUpdates();
    }
    
    return () => {
      unsubscribeFromUpdates();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshData, autoRefresh, subscribeToUpdates, unsubscribeFromUpdates]);

  // Set up auto-refresh interval
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(refreshData, refreshInterval);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [autoRefresh, refreshInterval, refreshData]);

  return {
    ...state,
    refreshData,
    subscribeToUpdates,
    unsubscribeFromUpdates,
    getPriceOptimization,
    getMarketOpportunities,
    getCompetitorPriceHistory,
    getMarketVolatility,
    getCategoryPerformance,
    isConnected
  };
};

// Hook for specific market insights
export const useMarketInsights = (category?: string) => {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [
        categoryPerformance,
        seasonalityIndex,
        marketVolatility,
        supplyChainInsights
      ] = await Promise.all([
        marketAnalytics.getCategoryPerformance(),
        marketAnalytics.getSeasonalityIndex(),
        marketAnalytics.getMarketVolatility(),
        marketAnalytics.getSupplyChainInsights()
      ]);

      const combinedInsights = [
        ...categoryPerformance,
        { type: 'seasonality', data: seasonalityIndex },
        { type: 'volatility', data: marketVolatility },
        ...supplyChainInsights
      ];

      setInsights(combinedInsights);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch market insights');
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return { insights, loading, error, refetch: fetchInsights };
};

// Hook for competitive analysis
export const useCompetitiveAnalysis = (competitors: string[] = []) => {
  const [analysis, setAnalysis] = useState<CompetitorAnalysis[]>([]);
  const [priceHistory, setPriceHistory] = useState<any[]>([]);
  const [marketShare, setMarketShare] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCompetitiveData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [
        competitorAnalysis,
        marketShareTrends
      ] = await Promise.all([
        marketAnalytics.getCompetitorAnalysis(),
        marketAnalytics.getMarketShareTrends()
      ]);

      setAnalysis(competitorAnalysis);
      setMarketShare(marketShareTrends);

      // Fetch price history for specific competitors
      if (competitors.length > 0) {
        const priceHistoryPromises = competitors.map(competitor =>
          marketAnalytics.getCompetitorPriceHistory(competitor, 30)
        );
        
        const priceHistoryResults = await Promise.all(priceHistoryPromises);
        setPriceHistory(priceHistoryResults.flat());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch competitive data');
    } finally {
      setLoading(false);
    }
  }, [competitors]);

  useEffect(() => {
    fetchCompetitiveData();
  }, [fetchCompetitiveData]);

  return { 
    analysis, 
    priceHistory, 
    marketShare, 
    loading, 
    error, 
    refetch: fetchCompetitiveData 
  };
};

// Hook for buyer behavior analysis
export const useBuyerBehavior = (segment?: string) => {
  const [behavior, setBehavior] = useState<BuyerBehavior[]>([]);
  const [clv, setClv] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBehaviorData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [
        behaviorAnalysis,
        customerLifetimeValue
      ] = await Promise.all([
        marketAnalytics.getBuyerBehaviorAnalysis(),
        marketAnalytics.getCustomerLifetimeValue()
      ]);

      setBehavior(behaviorAnalysis);
      setClv(customerLifetimeValue);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch buyer behavior data');
    } finally {
      setLoading(false);
    }
  }, [segment]);

  useEffect(() => {
    fetchBehaviorData();
  }, [fetchBehaviorData]);

  return { behavior, clv, loading, error, refetch: fetchBehaviorData };
};