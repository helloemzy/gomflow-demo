import { supabase } from '../supabase';

// Market Intelligence Types
export interface MarketTrend {
  id: string;
  product: string;
  category: string;
  trending_score: number;
  velocity: number;
  price_change: number;
  volume_change: number;
  timestamp: string;
  geographic_data: GeographicTrend[];
}

export interface GeographicTrend {
  country: string;
  region: string;
  demand_score: number;
  price_index: number;
  volume: number;
}

export interface CompetitorAnalysis {
  competitor_id: string;
  competitor_name: string;
  market_share: number;
  price_positioning: 'premium' | 'mid' | 'budget';
  success_rate: number;
  avg_order_value: number;
  total_orders: number;
  categories: string[];
  recent_activity: CompetitorActivity[];
}

export interface CompetitorActivity {
  type: 'new_product' | 'price_change' | 'promotion' | 'expansion';
  description: string;
  impact_score: number;
  timestamp: string;
}

export interface MarketSentiment {
  category: string;
  sentiment_score: number;
  confidence: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  factors: SentimentFactor[];
  timestamp: string;
}

export interface SentimentFactor {
  factor: string;
  weight: number;
  value: number;
  description: string;
}

export interface BuyerBehavior {
  segment: string;
  size: number;
  avg_order_value: number;
  order_frequency: number;
  price_sensitivity: number;
  preferred_categories: string[];
  geographic_distribution: Record<string, number>;
  seasonal_patterns: SeasonalPattern[];
}

export interface SeasonalPattern {
  period: 'weekly' | 'monthly' | 'yearly';
  pattern: number[];
  strength: number;
}

export interface MarketOpportunity {
  id: string;
  type: 'product_gap' | 'price_gap' | 'geographic_gap' | 'timing_gap';
  title: string;
  description: string;
  opportunity_score: number;
  revenue_potential: number;
  difficulty: 'low' | 'medium' | 'high';
  timeframe: string;
  actions: string[];
  created_at: string;
}

export interface PriceOptimization {
  product: string;
  current_price: number;
  optimal_price: number;
  expected_demand_change: number;
  expected_revenue_change: number;
  confidence: number;
  price_elasticity: number;
  competitor_prices: CompetitorPrice[];
}

export interface CompetitorPrice {
  competitor: string;
  price: number;
  last_updated: string;
}

export interface LiveMarketData {
  timestamp: string;
  active_orders: number;
  total_submissions: number;
  revenue_velocity: number;
  trending_products: MarketTrend[];
  sentiment_index: number;
  geographic_activity: GeographicActivity[];
}

export interface GeographicActivity {
  country: string;
  active_orders: number;
  submission_rate: number;
  avg_order_value: number;
  growth_rate: number;
}

// Market Analytics Service
export class MarketAnalyticsService {
  private websocket: WebSocket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  constructor() {
    this.initWebSocket();
  }

  private initWebSocket() {
    // Initialize WebSocket connection for real-time updates
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    
    try {
      this.websocket = new WebSocket(`${wsUrl}/market-intelligence`);
      
      this.websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.notifyListeners(data.type, data.payload);
      };

      this.websocket.onclose = () => {
        // Reconnect after 5 seconds
        setTimeout(() => this.initWebSocket(), 5000);
      };
    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }
  }

  subscribe(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  unsubscribe(event: string, callback: Function) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private notifyListeners(event: string, data: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data));
    }
  }

  async getLiveMarketData(): Promise<LiveMarketData> {
    const { data, error } = await supabase.rpc('get_live_market_data');
    if (error) throw error;
    return data;
  }

  async getTrendingProducts(limit: number = 10): Promise<MarketTrend[]> {
    const { data, error } = await supabase
      .from('market_trends')
      .select('*')
      .order('trending_score', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  }

  async getCompetitorAnalysis(): Promise<CompetitorAnalysis[]> {
    const { data, error } = await supabase.rpc('get_competitor_analysis');
    if (error) throw error;
    return data || [];
  }

  async getMarketSentiment(category?: string): Promise<MarketSentiment[]> {
    let query = supabase
      .from('market_sentiment')
      .select('*')
      .order('timestamp', { ascending: false });
    
    if (category) {
      query = query.eq('category', category);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getBuyerBehaviorAnalysis(): Promise<BuyerBehavior[]> {
    const { data, error } = await supabase.rpc('get_buyer_behavior_analysis');
    if (error) throw error;
    return data || [];
  }

  async getMarketOpportunities(gom_id?: string): Promise<MarketOpportunity[]> {
    let query = supabase
      .from('market_opportunities')
      .select('*')
      .order('opportunity_score', { ascending: false });
    
    if (gom_id) {
      query = query.eq('gom_id', gom_id);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getPriceOptimization(product: string): Promise<PriceOptimization | null> {
    const { data, error } = await supabase.rpc('get_price_optimization', {
      product_name: product
    });
    
    if (error) throw error;
    return data;
  }

  async getGeographicTrends(): Promise<GeographicTrend[]> {
    const { data, error } = await supabase.rpc('get_geographic_trends');
    if (error) throw error;
    return data || [];
  }

  async getCompetitorPriceHistory(product: string, days: number = 30): Promise<any[]> {
    const { data, error } = await supabase.rpc('get_competitor_price_history', {
      product_name: product,
      days_back: days
    });
    
    if (error) throw error;
    return data || [];
  }

  async getMarketShareTrends(period: string = '30d'): Promise<any[]> {
    const { data, error } = await supabase.rpc('get_market_share_trends', {
      time_period: period
    });
    
    if (error) throw error;
    return data || [];
  }

  async getCategoryPerformance(): Promise<any[]> {
    const { data, error } = await supabase.rpc('get_category_performance');
    if (error) throw error;
    return data || [];
  }

  async getSupplyChainInsights(): Promise<any[]> {
    const { data, error } = await supabase.rpc('get_supply_chain_insights');
    if (error) throw error;
    return data || [];
  }

  async getCustomerLifetimeValue(): Promise<any[]> {
    const { data, error } = await supabase.rpc('get_customer_lifetime_value');
    if (error) throw error;
    return data || [];
  }

  async getMarketVolatility(): Promise<any> {
    const { data, error } = await supabase.rpc('get_market_volatility');
    if (error) throw error;
    return data;
  }

  async getSeasonalityIndex(): Promise<any[]> {
    const { data, error } = await supabase.rpc('get_seasonality_index');
    if (error) throw error;
    return data || [];
  }

  disconnect() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    this.listeners.clear();
  }
}

// Utility functions for market analysis
export const calculateTrendingScore = (
  volume: number,
  velocity: number,
  priceChange: number,
  sentiment: number
): number => {
  const volumeWeight = 0.3;
  const velocityWeight = 0.4;
  const priceWeight = 0.2;
  const sentimentWeight = 0.1;
  
  const normalizedVolume = Math.min(volume / 1000, 1);
  const normalizedVelocity = Math.min(velocity / 10, 1);
  const normalizedPrice = Math.min(Math.abs(priceChange) / 100, 1);
  const normalizedSentiment = (sentiment + 1) / 2; // Convert from -1,1 to 0,1
  
  return (
    normalizedVolume * volumeWeight +
    normalizedVelocity * velocityWeight +
    normalizedPrice * priceWeight +
    normalizedSentiment * sentimentWeight
  ) * 100;
};

export const calculateMarketShare = (
  gomOrders: number,
  totalMarketOrders: number
): number => {
  return (gomOrders / totalMarketOrders) * 100;
};

export const calculatePriceElasticity = (
  priceChange: number,
  demandChange: number
): number => {
  if (priceChange === 0) return 0;
  return (demandChange / priceChange) * -1;
};

export const calculateOpportunityScore = (
  marketGap: number,
  difficulty: number,
  revenueEpotential: number
): number => {
  const gapWeight = 0.4;
  const difficultyWeight = 0.3;
  const revenueWeight = 0.3;
  
  const normalizedGap = Math.min(marketGap / 100, 1);
  const normalizedDifficulty = 1 - (difficulty / 10); // Invert difficulty
  const normalizedRevenue = Math.min(revenueEpotential / 10000, 1);
  
  return (
    normalizedGap * gapWeight +
    normalizedDifficulty * difficultyWeight +
    normalizedRevenue * revenueWeight
  ) * 100;
};

export const formatMarketValue = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  } else {
    return `$${value.toFixed(0)}`;
  }
};

export const formatPercentageChange = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

export const categorizeCompetitor = (marketShare: number): string => {
  if (marketShare >= 15) return 'Major Player';
  if (marketShare >= 5) return 'Significant';
  if (marketShare >= 1) return 'Emerging';
  return 'Niche';
};

export const getMarketHealthScore = (
  volatility: number,
  growth: number,
  competition: number
): number => {
  const volatilityWeight = 0.3;
  const growthWeight = 0.5;
  const competitionWeight = 0.2;
  
  const normalizedVolatility = Math.max(0, 1 - (volatility / 100));
  const normalizedGrowth = Math.min(growth / 50, 1);
  const normalizedCompetition = Math.min(competition / 100, 1);
  
  return (
    normalizedVolatility * volatilityWeight +
    normalizedGrowth * growthWeight +
    normalizedCompetition * competitionWeight
  ) * 100;
};

// Create singleton instance
export const marketAnalytics = new MarketAnalyticsService();