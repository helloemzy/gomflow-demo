import * as ss from 'simple-statistics';
// @ts-ignore - ml-regression types may not be available
import { SLR } from 'ml-regression';
import { 
  SeasonalityAnalysisResult, 
  SeasonalComponent, 
  TrendComponent, 
  ResidualComponent,
  OrderHistoryData,
  WeeklyPattern,
  MonthlyPattern,
  SeasonalFactors
} from './types';

/**
 * Advanced seasonality analysis for K-pop merchandise demand
 * Implements STL decomposition, Fourier analysis, and seasonal pattern detection
 */
export class SeasonalityAnalyzer {
  private smoothingWindow: number;
  private trendWindow: number;
  private seasonalWindow: number;

  constructor(
    smoothingWindow: number = 7,
    trendWindow: number = 30,
    seasonalWindow: number = 365
  ) {
    this.smoothingWindow = smoothingWindow;
    this.trendWindow = trendWindow;
    this.seasonalWindow = seasonalWindow;
  }

  /**
   * Perform comprehensive seasonality analysis
   */
  public analyzeSeasonality(data: OrderHistoryData[]): SeasonalityAnalysisResult {
    if (data.length < 30) {
      throw new Error('Insufficient data for seasonality analysis (minimum 30 data points required)');
    }

    const timeSeries = this.prepareTimeSeries(data);
    
    // STL Decomposition (Seasonal and Trend decomposition using Loess)
    const decomposition = this.performSTLDecomposition(timeSeries);
    
    // Fourier analysis for frequency detection
    const frequencyAnalysis = this.performFourierAnalysis(timeSeries);
    
    // Seasonal strength calculation
    const seasonalStrength = this.calculateSeasonalStrength(decomposition);
    
    // Trend strength calculation
    const trendStrength = this.calculateTrendStrength(decomposition);
    
    // Irregularity score
    const irregularityScore = this.calculateIrregularityScore(decomposition);
    
    return {
      seasonalComponents: frequencyAnalysis,
      trendComponent: decomposition.trend,
      residualComponent: decomposition.residual,
      seasonalityStrength: seasonalStrength,
      trendStrength: trendStrength,
      irregularityScore: irregularityScore
    };
  }

  /**
   * Detect weekly patterns in K-pop merchandise demand
   */
  public detectWeeklyPatterns(data: OrderHistoryData[]): WeeklyPattern[] {
    const weeklyData = new Map<number, number[]>();
    
    // Group data by day of week
    data.forEach(item => {
      const dayOfWeek = new Date(item.date).getDay();
      if (!weeklyData.has(dayOfWeek)) {
        weeklyData.set(dayOfWeek, []);
      }
      weeklyData.get(dayOfWeek)!.push(item.orderCount);
    });

    // Calculate patterns for each day
    const patterns: WeeklyPattern[] = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let day = 0; day < 7; day++) {
      const dayData = weeklyData.get(day) || [];
      const averageOrders = dayData.length > 0 ? ss.mean(dayData) : 0;
      
      patterns.push({
        dayOfWeek: day,
        dayName: dayNames[day],
        averageOrders,
        multiplier: this.calculateDayMultiplier(averageOrders, data)
      });
    }

    return patterns;
  }

  /**
   * Detect monthly patterns for seasonal merchandise
   */
  public detectMonthlyPatterns(data: OrderHistoryData[]): MonthlyPattern[] {
    const monthlyData = new Map<number, number[]>();
    
    // Group data by month
    data.forEach(item => {
      const month = new Date(item.date).getMonth();
      if (!monthlyData.has(month)) {
        monthlyData.set(month, []);
      }
      monthlyData.get(month)!.push(item.orderCount);
    });

    // Calculate patterns for each month
    const patterns: MonthlyPattern[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let month = 0; month < 12; month++) {
      const monthData = monthlyData.get(month) || [];
      const averageOrders = monthData.length > 0 ? ss.mean(monthData) : 0;
      
      patterns.push({
        month,
        monthName: monthNames[month],
        averageOrders,
        multiplier: this.calculateMonthMultiplier(averageOrders, data)
      });
    }

    return patterns;
  }

  /**
   * Analyze comeback season patterns
   */
  public analyzeComebackSeasons(data: OrderHistoryData[]): {
    peakSeasons: string[];
    seasonalMultipliers: Record<string, number>;
    comebackFrequency: Record<string, number>;
  } {
    const monthlyPatterns = this.detectMonthlyPatterns(data);
    
    // Identify peak seasons (months with above-average activity)
    const avgMonthlyOrders = ss.mean(monthlyPatterns.map(p => p.averageOrders));
    const peakSeasons = monthlyPatterns
      .filter(p => p.averageOrders > avgMonthlyOrders * 1.2)
      .map(p => p.monthName);

    // Calculate seasonal multipliers
    const seasonalMultipliers: Record<string, number> = {};
    monthlyPatterns.forEach(pattern => {
      seasonalMultipliers[pattern.monthName] = pattern.multiplier;
    });

    // Analyze comeback frequency patterns
    const comebackFrequency = this.analyzeComebackFrequency(data);

    return {
      peakSeasons,
      seasonalMultipliers,
      comebackFrequency
    };
  }

  /**
   * Detect holiday and special event patterns
   */
  public detectHolidayPatterns(data: OrderHistoryData[]): {
    holidayMultipliers: Record<string, number>;
    specialEventDays: string[];
  } {
    const holidayMultipliers: Record<string, number> = {};
    const specialEventDays: string[] = [];
    
    // Analyze specific dates for anomalies
    const dailyOrders = data.map(item => ({ date: item.date, orders: item.orderCount }));
    const avgDailyOrders = ss.mean(dailyOrders.map(d => d.orders));
    
    // Detect significant spikes (potential holidays/events)
    const spikes = dailyOrders.filter(d => d.orders > avgDailyOrders * 2);
    
    spikes.forEach(spike => {
      const date = new Date(spike.date);
      const holidayKey = this.getHolidayKey(date);
      
      if (holidayKey) {
        holidayMultipliers[holidayKey] = spike.orders / avgDailyOrders;
      } else {
        specialEventDays.push(spike.date);
      }
    });

    return {
      holidayMultipliers,
      specialEventDays
    };
  }

  /**
   * Generate seasonal factors for forecasting
   */
  public generateSeasonalFactors(data: OrderHistoryData[]): SeasonalFactors {
    const weeklyPattern = this.detectWeeklyPatterns(data);
    const monthlyPattern = this.detectMonthlyPatterns(data);
    const holidayPatterns = this.detectHolidayPatterns(data);
    
    return {
      weeklyPattern,
      monthlyPattern,
      holidayMultipliers: Object.entries(holidayPatterns.holidayMultipliers).map(([type, multiplier]) => ({
        holidayType: type,
        multiplier,
        duration: this.getHolidayDuration(type)
      })),
      seasonalTrend: this.calculateSeasonalTrend(data)
    };
  }

  /**
   * Prepare time series data for analysis
   */
  private prepareTimeSeries(data: OrderHistoryData[]): { dates: Date[], values: number[] } {
    const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return {
      dates: sortedData.map(item => new Date(item.date)),
      values: sortedData.map(item => item.orderCount)
    };
  }

  /**
   * Perform STL decomposition
   */
  private performSTLDecomposition(timeSeries: { dates: Date[], values: number[] }): {
    trend: TrendComponent;
    seasonal: number[];
    residual: ResidualComponent;
  } {
    const { values } = timeSeries;
    
    // Extract trend using moving average
    const trend = this.extractTrend(values);
    
    // Extract seasonal component
    const detrended = values.map((val, i) => val - trend[i]);
    const seasonal = this.extractSeasonal(detrended);
    
    // Calculate residuals
    const residuals = values.map((val, i) => val - trend[i] - seasonal[i]);
    
    // Calculate trend component statistics
    const trendStats = this.calculateTrendStats(trend);
    
    // Calculate residual component statistics
    const residualStats = this.calculateResidualStats(residuals);
    
    return {
      trend: trendStats,
      seasonal,
      residual: residualStats
    };
  }

  /**
   * Extract trend component using moving average
   */
  private extractTrend(values: number[]): number[] {
    const trend = [];
    const halfWindow = Math.floor(this.trendWindow / 2);
    
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(values.length, i + halfWindow + 1);
      const window = values.slice(start, end);
      trend.push(ss.mean(window));
    }
    
    return trend;
  }

  /**
   * Extract seasonal component
   */
  private extractSeasonal(detrended: number[]): number[] {
    const seasonal = new Array(detrended.length).fill(0);
    
    // Weekly seasonality
    for (let i = 0; i < detrended.length; i++) {
      const dayOfWeek = i % 7;
      const dayValues = [];
      
      for (let j = dayOfWeek; j < detrended.length; j += 7) {
        dayValues.push(detrended[j]);
      }
      
      seasonal[i] = dayValues.length > 0 ? ss.mean(dayValues) : 0;
    }
    
    return seasonal;
  }

  /**
   * Perform Fourier analysis to detect frequency components
   */
  private performFourierAnalysis(timeSeries: { dates: Date[], values: number[] }): SeasonalComponent[] {
    const { values } = timeSeries;
    const components: SeasonalComponent[] = [];
    
    // Detect weekly periodicity
    const weeklyAmplitude = this.detectPeriodicity(values, 7);
    if (weeklyAmplitude > 0.1) {
      components.push({
        period: 'weekly',
        amplitude: weeklyAmplitude,
        phase: 0,
        significance: this.calculateSignificance(weeklyAmplitude, values)
      });
    }
    
    // Detect monthly periodicity
    const monthlyAmplitude = this.detectPeriodicity(values, 30);
    if (monthlyAmplitude > 0.1) {
      components.push({
        period: 'monthly',
        amplitude: monthlyAmplitude,
        phase: 0,
        significance: this.calculateSignificance(monthlyAmplitude, values)
      });
    }
    
    // Detect yearly periodicity
    const yearlyAmplitude = this.detectPeriodicity(values, 365);
    if (yearlyAmplitude > 0.1) {
      components.push({
        period: 'yearly',
        amplitude: yearlyAmplitude,
        phase: 0,
        significance: this.calculateSignificance(yearlyAmplitude, values)
      });
    }
    
    return components;
  }

  /**
   * Detect periodicity in time series
   */
  private detectPeriodicity(values: number[], period: number): number {
    if (values.length < period * 2) return 0;
    
    const correlations = [];
    for (let lag = 1; lag <= period; lag++) {
      const correlation = this.calculateLagCorrelation(values, lag);
      correlations.push(correlation);
    }
    
    return Math.max(...correlations.map(Math.abs));
  }

  /**
   * Calculate lag correlation
   */
  private calculateLagCorrelation(values: number[], lag: number): number {
    const n = values.length - lag;
    const x = values.slice(0, n);
    const y = values.slice(lag);
    
    const meanX = ss.mean(x);
    const meanY = ss.mean(y);
    
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;
    
    for (let i = 0; i < n; i++) {
      const devX = x[i] - meanX;
      const devY = y[i] - meanY;
      
      numerator += devX * devY;
      denomX += devX * devX;
      denomY += devY * devY;
    }
    
    const denom = Math.sqrt(denomX * denomY);
    return denom === 0 ? 0 : numerator / denom;
  }

  /**
   * Calculate significance of seasonal component
   */
  private calculateSignificance(amplitude: number, values: number[]): number {
    const variance = ss.variance(values);
    return amplitude / Math.sqrt(variance);
  }

  /**
   * Calculate seasonal strength
   */
  private calculateSeasonalStrength(decomposition: any): number {
    const { seasonal, residual } = decomposition;
    const seasonalVariance = ss.variance(seasonal);
    const residualVariance = ss.variance(residual.variance ? [residual.variance] : [0]);
    
    return seasonalVariance / (seasonalVariance + residualVariance);
  }

  /**
   * Calculate trend strength
   */
  private calculateTrendStrength(decomposition: any): number {
    const { trend } = decomposition;
    const trendValues = Array.isArray(trend) ? trend : [trend.slope || 0];
    const trendVariance = ss.variance(trendValues);
    
    return Math.abs(trendVariance) > 0.01 ? 1 : 0;
  }

  /**
   * Calculate irregularity score
   */
  private calculateIrregularityScore(decomposition: any): number {
    const { residual } = decomposition;
    return residual.variance || 0;
  }

  /**
   * Calculate trend statistics
   */
  private calculateTrendStats(trend: number[]): TrendComponent {
    const indices = Array.from({ length: trend.length }, (_, i) => i);
    const regression = new SLR(indices, trend);
    
    return {
      slope: regression.slope,
      intercept: regression.intercept,
      direction: regression.slope > 0.1 ? 'increasing' : 
                regression.slope < -0.1 ? 'decreasing' : 'stable',
      confidence: regression.r2
    };
  }

  /**
   * Calculate residual statistics
   */
  private calculateResidualStats(residuals: number[]): ResidualComponent {
    const variance = ss.variance(residuals);
    const autocorrelation = this.calculateLagCorrelation(residuals, 1);
    
    // Simplified whiteness test
    const whitenessTest = Math.abs(autocorrelation) < 0.1 ? 0.95 : 0.5;
    
    return {
      variance,
      autocorrelation,
      whitenessTest
    };
  }

  /**
   * Calculate day multiplier for weekly patterns
   */
  private calculateDayMultiplier(dayAverage: number, data: OrderHistoryData[]): number {
    const overallAverage = ss.mean(data.map(item => item.orderCount));
    return overallAverage === 0 ? 1 : dayAverage / overallAverage;
  }

  /**
   * Calculate month multiplier for monthly patterns
   */
  private calculateMonthMultiplier(monthAverage: number, data: OrderHistoryData[]): number {
    const overallAverage = ss.mean(data.map(item => item.orderCount));
    return overallAverage === 0 ? 1 : monthAverage / overallAverage;
  }

  /**
   * Analyze comeback frequency patterns
   */
  private analyzeComebackFrequency(data: OrderHistoryData[]): Record<string, number> {
    const monthlyPatterns = this.detectMonthlyPatterns(data);
    const frequency: Record<string, number> = {};
    
    // Common K-pop comeback seasons
    const comebackSeasons = {
      'Spring': ['Mar', 'Apr', 'May'],
      'Summer': ['Jun', 'Jul', 'Aug'],
      'Fall': ['Sep', 'Oct', 'Nov'],
      'Winter': ['Dec', 'Jan', 'Feb']
    };
    
    for (const [season, months] of Object.entries(comebackSeasons)) {
      const seasonalAverage = ss.mean(
        monthlyPatterns
          .filter(p => months.includes(p.monthName))
          .map(p => p.averageOrders)
      );
      
      frequency[season] = seasonalAverage;
    }
    
    return frequency;
  }

  /**
   * Get holiday key for date
   */
  private getHolidayKey(date: Date): string | null {
    const month = date.getMonth();
    const day = date.getDate();
    
    // Common holidays that affect K-pop merchandise
    const holidays = {
      'New Year': { month: 0, day: 1 },
      'Valentine\'s Day': { month: 1, day: 14 },
      'White Day': { month: 2, day: 14 },
      'Children\'s Day': { month: 4, day: 5 },
      'Christmas': { month: 11, day: 25 },
      'Black Friday': { month: 10, day: 24 } // Approximate
    };
    
    for (const [holiday, { month: hMonth, day: hDay }] of Object.entries(holidays)) {
      if (month === hMonth && day === hDay) {
        return holiday;
      }
    }
    
    return null;
  }

  /**
   * Get holiday duration
   */
  private getHolidayDuration(holidayType: string): number {
    const durations: Record<string, number> = {
      'New Year': 3,
      'Valentine\'s Day': 1,
      'White Day': 1,
      'Children\'s Day': 1,
      'Christmas': 2,
      'Black Friday': 4
    };
    
    return durations[holidayType] || 1;
  }

  /**
   * Calculate seasonal trend
   */
  private calculateSeasonalTrend(data: OrderHistoryData[]): 'increasing' | 'decreasing' | 'stable' {
    const recentData = data.slice(-90); // Last 90 days
    const olderData = data.slice(0, -90);
    
    if (recentData.length === 0 || olderData.length === 0) {
      return 'stable';
    }
    
    const recentAverage = ss.mean(recentData.map(item => item.orderCount));
    const olderAverage = ss.mean(olderData.map(item => item.orderCount));
    
    const changePercent = (recentAverage - olderAverage) / olderAverage;
    
    if (changePercent > 0.1) return 'increasing';
    if (changePercent < -0.1) return 'decreasing';
    return 'stable';
  }
}

/**
 * Factory function to create seasonality analyzer
 */
export function createSeasonalityAnalyzer(
  smoothingWindow: number = 7,
  trendWindow: number = 30,
  seasonalWindow: number = 365
): SeasonalityAnalyzer {
  return new SeasonalityAnalyzer(smoothingWindow, trendWindow, seasonalWindow);
}

/**
 * Utility function to detect anomalies in seasonal patterns
 */
export function detectSeasonalAnomalies(
  data: OrderHistoryData[],
  threshold: number = 2.5
): { date: string; actualValue: number; expectedValue: number; anomalyScore: number }[] {
  const analyzer = createSeasonalityAnalyzer();
  const weeklyPatterns = analyzer.detectWeeklyPatterns(data);
  const monthlyPatterns = analyzer.detectMonthlyPatterns(data);
  
  const anomalies: { date: string; actualValue: number; expectedValue: number; anomalyScore: number }[] = [];
  
  data.forEach(item => {
    const date = new Date(item.date);
    const dayOfWeek = date.getDay();
    const month = date.getMonth();
    
    const weeklyMultiplier = weeklyPatterns[dayOfWeek].multiplier;
    const monthlyMultiplier = monthlyPatterns[month].multiplier;
    
    const overallAverage = ss.mean(data.map(d => d.orderCount));
    const expectedValue = overallAverage * weeklyMultiplier * monthlyMultiplier;
    
    const anomalyScore = Math.abs(item.orderCount - expectedValue) / expectedValue;
    
    if (anomalyScore > threshold) {
      anomalies.push({
        date: item.date,
        actualValue: item.orderCount,
        expectedValue,
        anomalyScore
      });
    }
  });
  
  return anomalies.sort((a, b) => b.anomalyScore - a.anomalyScore);
}

/**
 * Utility function to predict seasonal multipliers for future dates
 */
export function predictSeasonalMultipliers(
  data: OrderHistoryData[],
  futureDates: string[]
): { date: string; weeklyMultiplier: number; monthlyMultiplier: number; combinedMultiplier: number }[] {
  const analyzer = createSeasonalityAnalyzer();
  const weeklyPatterns = analyzer.detectWeeklyPatterns(data);
  const monthlyPatterns = analyzer.detectMonthlyPatterns(data);
  
  return futureDates.map(dateStr => {
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    const month = date.getMonth();
    
    const weeklyMultiplier = weeklyPatterns[dayOfWeek].multiplier;
    const monthlyMultiplier = monthlyPatterns[month].multiplier;
    const combinedMultiplier = weeklyMultiplier * monthlyMultiplier;
    
    return {
      date: dateStr,
      weeklyMultiplier,
      monthlyMultiplier,
      combinedMultiplier
    };
  });
}