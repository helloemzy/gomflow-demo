import * as ss from 'simple-statistics';
import { SLR } from 'ml-regression';
import { 
  ComebackPredictionInput, 
  ComebackPredictionResult, 
  PreviousComeback, 
  ImpactMetrics, 
  ImpactForecast, 
  TimelineForecast,
  MarketIndicator,
  SocialMediaSignal,
  OrderHistoryData,
  ComebackEvent
} from './types';

/**
 * AI-powered K-pop comeback prediction and impact forecasting
 * Analyzes historical patterns, social media signals, and market indicators
 */
export class ComebackPredictor {
  private readonly IMPACT_DECAY_RATE = 0.15;
  private readonly PEAK_IMPACT_DAY = 3;
  private readonly IMPACT_DURATION = 21;
  private readonly SOCIAL_SIGNAL_WEIGHTS = {
    twitter: 0.3,
    instagram: 0.25,
    tiktok: 0.2,
    youtube: 0.15,
    weibo: 0.1
  };

  constructor() {}

  /**
   * Predict upcoming comeback based on historical patterns and signals
   */
  public predictComeback(input: ComebackPredictionInput): ComebackPredictionResult {
    const { artist, previousComebacks, marketIndicators, socialMediaSignals } = input;
    
    // Analyze historical comeback patterns
    const historicalPattern = this.analyzeHistoricalPattern(previousComebacks);
    
    // Calculate social media signal strength
    const socialSignalStrength = this.calculateSocialSignalStrength(socialMediaSignals);
    
    // Analyze market indicators
    const marketReadiness = this.analyzeMarketReadiness(marketIndicators);
    
    // Predict comeback date
    const predictedDate = this.predictComebackDate(historicalPattern, socialSignalStrength, marketReadiness);
    
    // Calculate confidence score
    const confidence = this.calculateConfidenceScore(historicalPattern, socialSignalStrength, marketReadiness);
    
    // Generate impact forecast
    const impactForecast = this.generateImpactForecast(previousComebacks, predictedDate);
    
    // Generate preparation recommendations
    const preparationRecommendations = this.generatePreparationRecommendations(
      impactForecast,
      socialSignalStrength,
      marketReadiness
    );
    
    return {
      predictedDate,
      confidence,
      impactForecast,
      preparationRecommendations
    };
  }

  /**
   * Analyze impact of announced comeback on demand
   */
  public analyzeComebackImpact(
    orderHistory: OrderHistoryData[],
    comebackEvent: ComebackEvent
  ): ImpactMetrics {
    const comebackDate = new Date(comebackEvent.comebackDate);
    const impactStartDate = new Date(comebackDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days before
    const impactEndDate = new Date(comebackDate.getTime() + 21 * 24 * 60 * 60 * 1000); // 21 days after
    
    // Get baseline data (30 days before impact period)
    const baselineStartDate = new Date(impactStartDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const baselineData = orderHistory.filter(item => {
      const date = new Date(item.date);
      return date >= baselineStartDate && date < impactStartDate;
    });
    
    // Get impact period data
    const impactData = orderHistory.filter(item => {
      const date = new Date(item.date);
      return date >= impactStartDate && date <= impactEndDate;
    });
    
    // Calculate metrics
    const baselineAverage = ss.mean(baselineData.map(item => item.orderCount));
    const impactAverage = ss.mean(impactData.map(item => item.orderCount));
    const peakOrder = Math.max(...impactData.map(item => item.orderCount));
    
    const peakOrderIncrease = (peakOrder - baselineAverage) / baselineAverage;
    const totalVolumeIncrease = impactData.reduce((sum, item) => sum + item.orderCount, 0) - 
                               (baselineAverage * impactData.length);
    
    // Calculate category breakdown
    const categoryBreakdown = this.calculateCategoryBreakdown(impactData, comebackEvent.categories);
    
    return {
      peakOrderIncrease,
      impactDuration: this.calculateActualImpactDuration(impactData, baselineAverage),
      totalVolumeIncrease,
      categoryBreakdown
    };
  }

  /**
   * Generate comeback impact curve for different artist tiers
   */
  public generateComebackImpactCurve(
    artistTier: 'mega' | 'major' | 'rising' | 'rookie',
    albumType: 'full' | 'mini' | 'single' | 'repackage',
    days: number = 30
  ): number[] {
    const baseCurve = this.generateBaseComebackCurve(days);
    
    // Artist tier multipliers
    const tierMultipliers = {
      mega: 3.0,
      major: 2.0,
      rising: 1.5,
      rookie: 1.0
    };
    
    // Album type multipliers
    const typeMultipliers = {
      full: 1.5,
      mini: 1.2,
      single: 1.0,
      repackage: 0.8
    };
    
    const tierMultiplier = tierMultipliers[artistTier];
    const typeMultiplier = typeMultipliers[albumType];
    
    return baseCurve.map(value => value * tierMultiplier * typeMultiplier);
  }

  /**
   * Predict optimal comeback timing
   */
  public predictOptimalComebackTiming(
    orderHistory: OrderHistoryData[],
    competitorEvents: ComebackEvent[]
  ): { optimalDate: string; reasons: string[]; avoidDates: string[] } {
    // Analyze seasonal patterns
    const seasonalMultipliers = this.calculateSeasonalMultipliers(orderHistory);
    
    // Identify high-demand periods
    const highDemandPeriods = this.identifyHighDemandPeriods(seasonalMultipliers);
    
    // Avoid competitor comebacks
    const avoidDates = this.identifyCompetitorConflicts(competitorEvents);
    
    // Find optimal date
    const optimalDate = this.findOptimalDate(highDemandPeriods, avoidDates);
    
    // Generate reasons
    const reasons = this.generateOptimalTimingReasons(seasonalMultipliers, competitorEvents);
    
    return {
      optimalDate,
      reasons,
      avoidDates
    };
  }

  /**
   * Calculate probability of comeback within timeframe
   */
  public calculateComebackProbability(
    artist: string,
    previousComebacks: PreviousComeback[],
    timeframeDays: number
  ): number {
    if (previousComebacks.length < 2) {
      return 0.1; // Low probability for new artists
    }
    
    // Calculate average gap between comebacks
    const gaps = [];
    for (let i = 1; i < previousComebacks.length; i++) {
      const prevDate = new Date(previousComebacks[i - 1].date);
      const currDate = new Date(previousComebacks[i].date);
      gaps.push((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    const avgGap = ss.mean(gaps);
    const gapStd = ss.standardDeviation(gaps);
    
    // Calculate days since last comeback
    const lastComeback = new Date(previousComebacks[previousComebacks.length - 1].date);
    const daysSinceLastComeback = (Date.now() - lastComeback.getTime()) / (1000 * 60 * 60 * 24);
    
    // Calculate probability using normal distribution
    const probability = this.calculateNormalProbability(daysSinceLastComeback, avgGap, gapStd, timeframeDays);
    
    return Math.max(0, Math.min(1, probability));
  }

  /**
   * Analyze historical comeback patterns
   */
  private analyzeHistoricalPattern(previousComebacks: PreviousComeback[]): {
    avgGapDays: number;
    preferredMonths: number[];
    seasonalityScore: number;
    consistency: number;
  } {
    if (previousComebacks.length < 2) {
      return {
        avgGapDays: 365,
        preferredMonths: [],
        seasonalityScore: 0,
        consistency: 0
      };
    }
    
    // Calculate gaps between comebacks
    const gaps = [];
    for (let i = 1; i < previousComebacks.length; i++) {
      const prevDate = new Date(previousComebacks[i - 1].date);
      const currDate = new Date(previousComebacks[i].date);
      gaps.push((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    const avgGapDays = ss.mean(gaps);
    const gapStd = ss.standardDeviation(gaps);
    
    // Analyze month preferences
    const months = previousComebacks.map(cb => new Date(cb.date).getMonth());
    const monthCounts = new Array(12).fill(0);
    months.forEach(month => monthCounts[month]++);
    
    const maxCount = Math.max(...monthCounts);
    const preferredMonths = monthCounts
      .map((count, month) => ({ month, count }))
      .filter(item => item.count === maxCount)
      .map(item => item.month);
    
    // Calculate seasonality score
    const seasonalityScore = (maxCount / previousComebacks.length) * 2 - 1;
    
    // Calculate consistency (inverse of coefficient of variation)
    const consistency = avgGapDays > 0 ? 1 / (gapStd / avgGapDays) : 0;
    
    return {
      avgGapDays,
      preferredMonths,
      seasonalityScore,
      consistency
    };
  }

  /**
   * Calculate social media signal strength
   */
  private calculateSocialSignalStrength(signals: SocialMediaSignal[]): number {
    let totalStrength = 0;
    let totalWeight = 0;
    
    signals.forEach(signal => {
      const weight = this.SOCIAL_SIGNAL_WEIGHTS[signal.platform] || 0.1;
      totalStrength += signal.strength * weight;
      totalWeight += weight;
    });
    
    return totalWeight > 0 ? totalStrength / totalWeight : 0;
  }

  /**
   * Analyze market readiness indicators
   */
  private analyzeMarketReadiness(indicators: MarketIndicator[]): number {
    if (indicators.length === 0) return 0.5;
    
    const weightedSum = indicators.reduce((sum, indicator) => {
      return sum + (indicator.value * indicator.confidence);
    }, 0);
    
    const totalWeight = indicators.reduce((sum, indicator) => sum + indicator.confidence, 0);
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }

  /**
   * Predict comeback date based on patterns and signals
   */
  private predictComebackDate(
    historicalPattern: any,
    socialSignalStrength: number,
    marketReadiness: number
  ): string {
    const { avgGapDays, preferredMonths } = historicalPattern;
    
    // Base prediction on average gap
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + avgGapDays);
    
    // Adjust based on preferred months
    if (preferredMonths.length > 0) {
      const targetMonth = preferredMonths[0];
      const currentMonth = baseDate.getMonth();
      
      if (currentMonth !== targetMonth) {
        // Adjust to preferred month
        const monthDiff = targetMonth - currentMonth;
        baseDate.setMonth(baseDate.getMonth() + monthDiff);
      }
    }
    
    // Adjust based on signal strength (earlier if strong signals)
    const signalAdjustment = -30 * socialSignalStrength; // Up to 30 days earlier
    baseDate.setDate(baseDate.getDate() + signalAdjustment);
    
    // Adjust based on market readiness
    const marketAdjustment = -15 * (marketReadiness - 0.5); // ±15 days based on market
    baseDate.setDate(baseDate.getDate() + marketAdjustment);
    
    return baseDate.toISOString().split('T')[0];
  }

  /**
   * Calculate confidence score for prediction
   */
  private calculateConfidenceScore(
    historicalPattern: any,
    socialSignalStrength: number,
    marketReadiness: number
  ): number {
    const { consistency, seasonalityScore } = historicalPattern;
    
    // Weight different factors
    const weights = {
      consistency: 0.4,
      seasonality: 0.3,
      socialSignals: 0.2,
      marketReadiness: 0.1
    };
    
    const score = (
      consistency * weights.consistency +
      Math.abs(seasonalityScore) * weights.seasonality +
      socialSignalStrength * weights.socialSignals +
      marketReadiness * weights.marketReadiness
    );
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Generate impact forecast for predicted comeback
   */
  private generateImpactForecast(
    previousComebacks: PreviousComeback[],
    predictedDate: string
  ): ImpactForecast {
    if (previousComebacks.length === 0) {
      return this.generateDefaultImpactForecast(predictedDate);
    }
    
    // Calculate average impact metrics
    const avgPeakIncrease = ss.mean(previousComebacks.map(cb => cb.impactMetrics.peakOrderIncrease));
    const avgDuration = ss.mean(previousComebacks.map(cb => cb.impactMetrics.impactDuration));
    
    // Calculate category impact
    const categoryImpact: Record<string, number> = {};
    previousComebacks.forEach(cb => {
      Object.entries(cb.impactMetrics.categoryBreakdown).forEach(([category, impact]) => {
        categoryImpact[category] = (categoryImpact[category] || 0) + impact;
      });
    });
    
    // Average category impacts
    Object.keys(categoryImpact).forEach(category => {
      categoryImpact[category] /= previousComebacks.length;
    });
    
    // Generate timeline forecast
    const timelineForecast = this.generateTimelineForecast(predictedDate, avgPeakIncrease, avgDuration);
    
    return {
      expectedPeakIncrease: avgPeakIncrease,
      expectedDuration: avgDuration,
      categoryImpact,
      timelineForecast
    };
  }

  /**
   * Generate timeline forecast for comeback impact
   */
  private generateTimelineForecast(
    comebackDate: string,
    peakIncrease: number,
    duration: number
  ): TimelineForecast[] {
    const timeline: TimelineForecast[] = [];
    const startDate = new Date(comebackDate);
    
    for (let day = 0; day < duration; day++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + day);
      
      const multiplier = this.calculateDayMultiplier(day, peakIncrease);
      const confidence = this.calculateDayConfidence(day, duration);
      
      timeline.push({
        date: date.toISOString().split('T')[0],
        expectedMultiplier: multiplier,
        confidence
      });
    }
    
    return timeline;
  }

  /**
   * Calculate day-specific multiplier for comeback impact
   */
  private calculateDayMultiplier(day: number, peakIncrease: number): number {
    // Gaussian curve with peak at day 3
    const peakDay = this.PEAK_IMPACT_DAY;
    const sigma = 5; // Standard deviation
    
    const exponent = -Math.pow(day - peakDay, 2) / (2 * Math.pow(sigma, 2));
    const multiplier = 1 + peakIncrease * Math.exp(exponent);
    
    return Math.max(1, multiplier);
  }

  /**
   * Calculate confidence for day-specific prediction
   */
  private calculateDayConfidence(day: number, totalDuration: number): number {
    // Higher confidence for earlier days, lower for later
    const confidenceDecay = 0.02;
    return Math.max(0.3, 0.9 - day * confidenceDecay);
  }

  /**
   * Generate preparation recommendations
   */
  private generatePreparationRecommendations(
    impactForecast: ImpactForecast,
    socialSignalStrength: number,
    marketReadiness: number
  ): string[] {
    const recommendations: string[] = [];
    
    // Inventory recommendations
    if (impactForecast.expectedPeakIncrease > 2) {
      recommendations.push(`Increase inventory by ${Math.round(impactForecast.expectedPeakIncrease * 100)}% to handle expected surge`);
    }
    
    // Social media recommendations
    if (socialSignalStrength > 0.7) {
      recommendations.push('High social media activity detected - prepare for early demand spike');
    }
    
    // Market timing recommendations
    if (marketReadiness < 0.3) {
      recommendations.push('Market conditions suggest delaying comeback by 2-3 weeks');
    } else if (marketReadiness > 0.7) {
      recommendations.push('Favorable market conditions - consider accelerating timeline');
    }
    
    // Category-specific recommendations
    Object.entries(impactForecast.categoryImpact).forEach(([category, impact]) => {
      if (impact > 1.5) {
        recommendations.push(`Focus on ${category} category - expecting ${Math.round(impact * 100)}% increase`);
      }
    });
    
    return recommendations;
  }

  /**
   * Generate base comeback impact curve
   */
  private generateBaseComebackCurve(days: number): number[] {
    const curve = [];
    
    for (let day = 0; day < days; day++) {
      const multiplier = this.calculateDayMultiplier(day, 1.5); // Base 150% increase
      curve.push(multiplier);
    }
    
    return curve;
  }

  /**
   * Calculate seasonal multipliers from order history
   */
  private calculateSeasonalMultipliers(orderHistory: OrderHistoryData[]): Record<string, number> {
    const monthlyData = new Map<number, number[]>();
    
    orderHistory.forEach(item => {
      const month = new Date(item.date).getMonth();
      if (!monthlyData.has(month)) {
        monthlyData.set(month, []);
      }
      monthlyData.get(month)!.push(item.orderCount);
    });
    
    const overallAverage = ss.mean(orderHistory.map(item => item.orderCount));
    const multipliers: Record<string, number> = {};
    
    for (let month = 0; month < 12; month++) {
      const monthData = monthlyData.get(month) || [];
      const monthAverage = monthData.length > 0 ? ss.mean(monthData) : overallAverage;
      multipliers[month.toString()] = monthAverage / overallAverage;
    }
    
    return multipliers;
  }

  /**
   * Identify high-demand periods
   */
  private identifyHighDemandPeriods(seasonalMultipliers: Record<string, number>): string[] {
    const highDemandMonths = [];
    
    for (const [month, multiplier] of Object.entries(seasonalMultipliers)) {
      if (multiplier > 1.2) {
        highDemandMonths.push(month);
      }
    }
    
    return highDemandMonths;
  }

  /**
   * Identify competitor conflicts
   */
  private identifyCompetitorConflicts(competitorEvents: ComebackEvent[]): string[] {
    const avoidDates = [];
    
    competitorEvents.forEach(event => {
      const eventDate = new Date(event.comebackDate);
      
      // Avoid 2 weeks before and after major competitor comebacks
      if (event.impactLevel === 'high') {
        for (let i = -14; i <= 14; i++) {
          const avoidDate = new Date(eventDate);
          avoidDate.setDate(avoidDate.getDate() + i);
          avoidDates.push(avoidDate.toISOString().split('T')[0]);
        }
      }
    });
    
    return avoidDates;
  }

  /**
   * Find optimal comeback date
   */
  private findOptimalDate(highDemandPeriods: string[], avoidDates: string[]): string {
    const today = new Date();
    
    // Look for optimal date in the next 180 days
    for (let days = 30; days <= 180; days += 7) {
      const candidateDate = new Date(today);
      candidateDate.setDate(candidateDate.getDate() + days);
      
      const dateStr = candidateDate.toISOString().split('T')[0];
      const month = candidateDate.getMonth().toString();
      
      // Check if it's a high-demand period and not a conflict date
      if (highDemandPeriods.includes(month) && !avoidDates.includes(dateStr)) {
        return dateStr;
      }
    }
    
    // Fallback to 90 days from now
    const fallbackDate = new Date(today);
    fallbackDate.setDate(fallbackDate.getDate() + 90);
    return fallbackDate.toISOString().split('T')[0];
  }

  /**
   * Generate reasons for optimal timing
   */
  private generateOptimalTimingReasons(
    seasonalMultipliers: Record<string, number>,
    competitorEvents: ComebackEvent[]
  ): string[] {
    const reasons = [];
    
    // Seasonal reasons
    const bestMonth = Object.entries(seasonalMultipliers)
      .sort(([, a], [, b]) => b - a)[0];
    
    if (bestMonth && bestMonth[1] > 1.2) {
      const monthName = new Date(2024, parseInt(bestMonth[0]), 1).toLocaleDateString('en', { month: 'long' });
      reasons.push(`${monthName} shows ${Math.round((bestMonth[1] - 1) * 100)}% higher than average demand`);
    }
    
    // Competitor reasons
    const majorCompetitorComebacks = competitorEvents.filter(event => event.impactLevel === 'high');
    if (majorCompetitorComebacks.length > 0) {
      reasons.push(`Avoiding ${majorCompetitorComebacks.length} major competitor comebacks`);
    }
    
    return reasons;
  }

  /**
   * Calculate actual impact duration from data
   */
  private calculateActualImpactDuration(impactData: OrderHistoryData[], baseline: number): number {
    let duration = 0;
    
    for (const item of impactData) {
      if (item.orderCount > baseline * 1.1) { // 10% above baseline
        duration++;
      } else if (duration > 0) {
        break; // Impact has ended
      }
    }
    
    return duration;
  }

  /**
   * Calculate category breakdown for impact
   */
  private calculateCategoryBreakdown(
    impactData: OrderHistoryData[],
    categories: string[]
  ): Record<string, number> {
    const breakdown: Record<string, number> = {};
    
    categories.forEach(category => {
      const categoryData = impactData.filter(item => item.category === category);
      const categoryTotal = categoryData.reduce((sum, item) => sum + item.orderCount, 0);
      const allDataTotal = impactData.reduce((sum, item) => sum + item.orderCount, 0);
      
      breakdown[category] = allDataTotal > 0 ? categoryTotal / allDataTotal : 0;
    });
    
    return breakdown;
  }

  /**
   * Generate default impact forecast for new artists
   */
  private generateDefaultImpactForecast(predictedDate: string): ImpactForecast {
    const timelineForecast = this.generateTimelineForecast(predictedDate, 1.5, 14);
    
    return {
      expectedPeakIncrease: 1.5,
      expectedDuration: 14,
      categoryImpact: {
        'albums': 0.6,
        'photocards': 0.3,
        'merchandise': 0.1
      },
      timelineForecast
    };
  }

  /**
   * Calculate normal distribution probability
   */
  private calculateNormalProbability(
    currentValue: number,
    mean: number,
    standardDeviation: number,
    targetValue: number
  ): number {
    const z = (targetValue - mean) / standardDeviation;
    const probability = 0.5 * (1 + this.erf(z / Math.sqrt(2)));
    return Math.max(0, Math.min(1, probability));
  }

  /**
   * Error function approximation
   */
  private erf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
  }
}

/**
 * Factory function to create comeback predictor
 */
export function createComebackPredictor(): ComebackPredictor {
  return new ComebackPredictor();
}

/**
 * Utility function to estimate comeback tier from previous performance
 */
export function estimateArtistTier(previousComebacks: PreviousComeback[]): 'mega' | 'major' | 'rising' | 'rookie' {
  if (previousComebacks.length === 0) return 'rookie';
  
  const avgPeakIncrease = ss.mean(previousComebacks.map(cb => cb.impactMetrics.peakOrderIncrease));
  const avgTotalIncrease = ss.mean(previousComebacks.map(cb => cb.impactMetrics.totalVolumeIncrease));
  
  if (avgPeakIncrease > 3.0 && avgTotalIncrease > 10000) return 'mega';
  if (avgPeakIncrease > 2.0 && avgTotalIncrease > 5000) return 'major';
  if (avgPeakIncrease > 1.5 && avgTotalIncrease > 1000) return 'rising';
  return 'rookie';
}

/**
 * Utility function to generate mock social media signals for testing
 */
export function generateMockSocialSignals(strength: number = 0.5): SocialMediaSignal[] {
  const platforms = ['twitter', 'instagram', 'tiktok', 'youtube', 'weibo'];
  const signals = ['teaser_posts', 'hashtag_trending', 'fan_speculation', 'industry_hints'];
  
  return platforms.map(platform => ({
    platform,
    signal: signals[Math.floor(Math.random() * signals.length)],
    strength: strength + (Math.random() - 0.5) * 0.3,
    timestamp: new Date().toISOString()
  }));
}

/**
 * Utility function to generate mock market indicators
 */
export function generateMockMarketIndicators(readiness: number = 0.5): MarketIndicator[] {
  const indicators = [
    'market_sentiment',
    'competitor_activity',
    'seasonal_demand',
    'economic_indicators',
    'fan_engagement'
  ];
  
  return indicators.map(indicator => ({
    indicator,
    value: readiness + (Math.random() - 0.5) * 0.4,
    timestamp: new Date().toISOString(),
    confidence: 0.7 + Math.random() * 0.3
  }));
}