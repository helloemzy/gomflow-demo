import * as tf from '@tensorflow/tfjs';
import * as ss from 'simple-statistics';
import { SLR } from 'ml-regression';
import { 
  createDemandForecastingEngine,
  generateSampleOrderHistory,
  evaluateModelPerformance,
  DemandForecastingEngine as NewDemandForecastingEngine,
  OrderHistoryData,
  DemandForecastingInput,
  SeasonalFactors,
  ExternalFactors
} from './ml';

// Legacy AI-powered demand forecasting system
// This is kept for backward compatibility
export class DemandForecastingEngine {
  private model: tf.LayersModel | null = null;
  private isModelLoaded = false;
  private trainingData: any[] = [];
  private newEngine: NewDemandForecastingEngine;

  constructor() {
    this.initializeModel();
    this.newEngine = createDemandForecastingEngine();
  }

  private async initializeModel() {
    try {
      // Create a simple neural network for demand prediction
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [7], units: 32, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 16, activation: 'relu' }),
          tf.layers.dense({ units: 8, activation: 'relu' }),
          tf.layers.dense({ units: 1, activation: 'linear' })
        ]
      });

      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      this.isModelLoaded = true;
      console.log('✅ AI Forecasting Model initialized');
    } catch (error) {
      console.error('❌ Failed to initialize AI model:', error);
    }
  }

  // Prepare training data from historical orders
  prepareTrainingData(orders: any[], submissions: any[]) {
    const trainingData = [];
    
    // Group data by date
    const dailyData = this.groupByDate(orders, submissions);
    
    // Create feature vectors
    for (let i = 7; i < dailyData.length; i++) {
      const features = [
        dailyData[i - 7].orderCount,    // 7 days ago
        dailyData[i - 6].orderCount,    // 6 days ago
        dailyData[i - 5].orderCount,    // 5 days ago
        dailyData[i - 4].orderCount,    // 4 days ago
        dailyData[i - 3].orderCount,    // 3 days ago
        dailyData[i - 2].orderCount,    // 2 days ago
        dailyData[i - 1].orderCount,    // 1 day ago
      ];
      
      const target = dailyData[i].orderCount; // Current day
      
      trainingData.push({ features, target });
    }
    
    this.trainingData = trainingData;
    return trainingData;
  }

  // Train the model with historical data
  async trainModel(orders: any[], submissions: any[]) {
    if (!this.model || !this.isModelLoaded) {
      throw new Error('Model not initialized');
    }

    const trainingData = this.prepareTrainingData(orders, submissions);
    
    if (trainingData.length < 10) {
      throw new Error('Insufficient training data (minimum 10 data points required)');
    }

    // Prepare tensors
    const features = tf.tensor2d(trainingData.map(d => d.features));
    const targets = tf.tensor2d(trainingData.map(d => [d.target]));

    try {
      // Train the model
      const history = await this.model.fit(features, targets, {
        epochs: 100,
        batchSize: 32,
        validationSplit: 0.2,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 20 === 0) {
              console.log(`Epoch ${epoch}: loss = ${logs?.loss?.toFixed(4)}`);
            }
          }
        }
      });

      console.log('✅ Model training completed');
      return history;
    } finally {
      features.dispose();
      targets.dispose();
    }
  }

  // Predict future demand
  async predictDemand(recentData: number[], daysAhead: number = 7): Promise<number[]> {
    if (!this.model || !this.isModelLoaded) {
      throw new Error('Model not initialized');
    }

    const predictions = [];
    let currentWindow = [...recentData];

    for (let i = 0; i < daysAhead; i++) {
      const input = tf.tensor2d([currentWindow]);
      const prediction = this.model.predict(input) as tf.Tensor;
      const value = await prediction.data();
      
      predictions.push(Math.max(0, Math.round(value[0])));
      
      // Update window for next prediction
      currentWindow = [...currentWindow.slice(1), value[0]];
      
      input.dispose();
      prediction.dispose();
    }

    return predictions;
  }

  // Analyze seasonality patterns
  analyzeSeasonality(orders: any[]): any {
    const dailyData = this.groupByDate(orders, []);
    const weeklyPattern = this.calculateWeeklyPattern(dailyData);
    const monthlyPattern = this.calculateMonthlyPattern(dailyData);
    
    return {
      weeklyPattern,
      monthlyPattern,
      peakDays: this.findPeakDays(weeklyPattern),
      trendDirection: this.calculateTrend(dailyData)
    };
  }

  // Predict comeback impact
  predictComebackImpact(baselineDemand: number[], comebackDate: Date): any {
    const daysSinceComeback = this.getDaysSinceComeback(comebackDate);
    
    // Comeback impact model (empirical data from K-pop industry)
    const impactCurve = this.generateComebackImpactCurve(daysSinceComeback);
    
    return {
      predictedIncrease: impactCurve.peakIncrease,
      impactDuration: impactCurve.duration,
      dailyMultipliers: impactCurve.multipliers,
      expectedPeakDay: impactCurve.peakDay
    };
  }

  // Market intelligence insights
  generateMarketInsights(orders: any[], submissions: any[]): any {
    const insights = {
      demandTrend: this.calculateDemandTrend(orders),
      priceElasticity: this.calculatePriceElasticity(orders, submissions),
      buyerBehavior: this.analyzeBuyerBehavior(submissions),
      competitiveAnalysis: this.analyzeCompetitivePosition(orders),
      recommendations: this.generateRecommendations(orders, submissions)
    };

    return insights;
  }

  // Advanced forecasting using new ML engine
  async generateAdvancedForecast(orders: any[], submissions: any[], forecastDays: number = 30): Promise<any> {
    try {
      // Convert legacy data to new format
      const orderHistory = this.convertToOrderHistory(orders, submissions);
      
      // Train the new model if needed
      const trainingResult = await this.newEngine.trainModel(orderHistory);
      
      if (!trainingResult.success) {
        console.warn('Advanced model training failed, falling back to legacy system');
        return this.predictDemand(orderHistory.slice(-7).map(item => item.orderCount), forecastDays);
      }
      
      // Generate forecast input
      const forecastInput: DemandForecastingInput = {
        orderHistory,
        seasonalFactors: this.generateSeasonalFactors(orderHistory),
        externalFactors: this.generateExternalFactors(),
        forecastPeriod: forecastDays
      };
      
      // Generate advanced forecast
      const forecast = await this.newEngine.generateForecast(forecastInput);
      
      return {
        predictions: forecast.predictions,
        confidence: forecast.confidence,
        accuracy: forecast.accuracy,
        metadata: forecast.metadata,
        advancedAnalytics: await this.newEngine.generateAdvancedAnalytics(orderHistory)
      };
      
    } catch (error) {
      console.error('Advanced forecast failed:', error);
      // Fallback to legacy system
      const recentData = orders.slice(-7).map(order => order.orderCount || 0);
      return this.predictDemand(recentData, forecastDays);
    }
  }

  // Convert legacy data to new format
  private convertToOrderHistory(orders: any[], submissions: any[]): OrderHistoryData[] {
    const orderHistory: OrderHistoryData[] = [];
    
    // Group submissions by date
    const submissionsByDate = new Map<string, any[]>();
    submissions.forEach(submission => {
      const date = new Date(submission.created_at).toISOString().split('T')[0];
      if (!submissionsByDate.has(date)) {
        submissionsByDate.set(date, []);
      }
      submissionsByDate.get(date)!.push(submission);
    });
    
    // Process orders
    orders.forEach(order => {
      const date = new Date(order.created_at).toISOString().split('T')[0];
      const orderDate = new Date(order.created_at);
      const daySubmissions = submissionsByDate.get(date) || [];
      
      const orderData: OrderHistoryData = {
        date,
        orderCount: 1, // Each order is one entry
        submissionCount: daySubmissions.length,
        revenue: daySubmissions.reduce((sum, sub) => sum + (sub.quantity * (sub.price || 0)), 0),
        avgPrice: order.price || 0,
        category: order.category || 'general',
        geoLocation: order.country || 'Unknown',
        weekday: orderDate.getDay(),
        month: orderDate.getMonth(),
        isHoliday: this.isHoliday(orderDate)
      };
      
      orderHistory.push(orderData);
    });
    
    // Aggregate by date
    const aggregatedData = new Map<string, OrderHistoryData>();
    orderHistory.forEach(item => {
      if (aggregatedData.has(item.date)) {
        const existing = aggregatedData.get(item.date)!;
        existing.orderCount += item.orderCount;
        existing.submissionCount += item.submissionCount;
        existing.revenue += item.revenue;
        existing.avgPrice = (existing.avgPrice + item.avgPrice) / 2;
      } else {
        aggregatedData.set(item.date, { ...item });
      }
    });
    
    return Array.from(aggregatedData.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  // Generate seasonal factors from data
  private generateSeasonalFactors(orderHistory: OrderHistoryData[]): SeasonalFactors {
    const weeklyPattern = this.calculateWeeklyPattern(orderHistory);
    const monthlyPattern = this.calculateMonthlyPattern(orderHistory);
    
    return {
      weeklyPattern,
      monthlyPattern,
      holidayMultipliers: [
        { holidayType: 'Christmas', multiplier: 2.0, duration: 3 },
        { holidayType: 'New Year', multiplier: 1.5, duration: 2 },
        { holidayType: 'Valentine\'s Day', multiplier: 1.3, duration: 1 }
      ],
      seasonalTrend: this.calculateSeasonalTrend(orderHistory)
    };
  }

  // Generate external factors
  private generateExternalFactors(): ExternalFactors {
    return {
      comebackEvents: [],
      priceChanges: [],
      competitorActivity: [],
      marketTrends: []
    };
  }

  // Calculate weekly pattern for new format
  private calculateWeeklyPattern(orderHistory: OrderHistoryData[]): any[] {
    const weeklyTotals = new Array(7).fill(0);
    const weeklyCounts = new Array(7).fill(0);

    orderHistory.forEach(item => {
      const dayOfWeek = new Date(item.date).getDay();
      weeklyTotals[dayOfWeek] += item.orderCount;
      weeklyCounts[dayOfWeek] += 1;
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const overallAverage = ss.mean(orderHistory.map(item => item.orderCount));
    
    return weeklyTotals.map((total, index) => ({
      dayOfWeek: index,
      dayName: dayNames[index],
      averageOrders: weeklyCounts[index] > 0 ? total / weeklyCounts[index] : 0,
      multiplier: weeklyCounts[index] > 0 ? (total / weeklyCounts[index]) / overallAverage : 1
    }));
  }

  // Calculate monthly pattern for new format
  private calculateMonthlyPattern(orderHistory: OrderHistoryData[]): any[] {
    const monthlyTotals = new Array(12).fill(0);
    const monthlyCounts = new Array(12).fill(0);

    orderHistory.forEach(item => {
      const month = new Date(item.date).getMonth();
      monthlyTotals[month] += item.orderCount;
      monthlyCounts[month] += 1;
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const overallAverage = ss.mean(orderHistory.map(item => item.orderCount));
    
    return monthlyTotals.map((total, index) => ({
      month: index,
      monthName: monthNames[index],
      averageOrders: monthlyCounts[index] > 0 ? total / monthlyCounts[index] : 0,
      multiplier: monthlyCounts[index] > 0 ? (total / monthlyCounts[index]) / overallAverage : 1
    }));
  }

  // Calculate seasonal trend
  private calculateSeasonalTrend(orderHistory: OrderHistoryData[]): 'increasing' | 'decreasing' | 'stable' {
    if (orderHistory.length < 30) return 'stable';
    
    const recentData = orderHistory.slice(-30);
    const olderData = orderHistory.slice(-60, -30);
    
    if (olderData.length === 0) return 'stable';
    
    const recentAvg = ss.mean(recentData.map(item => item.orderCount));
    const olderAvg = ss.mean(olderData.map(item => item.orderCount));
    
    const change = (recentAvg - olderAvg) / olderAvg;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  // Check if date is a holiday
  private isHoliday(date: Date): boolean {
    const month = date.getMonth();
    const day = date.getDate();
    
    // Common holidays
    const holidays = [
      { month: 0, day: 1 },   // New Year
      { month: 1, day: 14 },  // Valentine's Day
      { month: 11, day: 25 }, // Christmas
    ];
    
    return holidays.some(holiday => holiday.month === month && holiday.day === day);
  }

  // Get the new ML engine for advanced features
  getAdvancedEngine(): NewDemandForecastingEngine {
    return this.newEngine;
  }

  private groupByDate(orders: any[], submissions: any[]) {
    const dailyData = new Map();
    
    orders.forEach(order => {
      const date = new Date(order.created_at).toISOString().split('T')[0];
      if (!dailyData.has(date)) {
        dailyData.set(date, { orderCount: 0, submissionCount: 0, revenue: 0 });
      }
      dailyData.get(date).orderCount += 1;
    });

    submissions.forEach(submission => {
      const date = new Date(submission.created_at).toISOString().split('T')[0];
      if (!dailyData.has(date)) {
        dailyData.set(date, { orderCount: 0, submissionCount: 0, revenue: 0 });
      }
      dailyData.get(date).submissionCount += 1;
      if (submission.payment_status === 'confirmed') {
        dailyData.get(date).revenue += submission.quantity * (submission.price || 0);
      }
    });

    return Array.from(dailyData.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateWeeklyPattern(dailyData: any[]) {
    const weeklyTotals = new Array(7).fill(0);
    const weeklyCounts = new Array(7).fill(0);

    dailyData.forEach(day => {
      const dayOfWeek = new Date(day.date).getDay();
      weeklyTotals[dayOfWeek] += day.orderCount;
      weeklyCounts[dayOfWeek] += 1;
    });

    return weeklyTotals.map((total, index) => ({
      dayOfWeek: index,
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index],
      averageOrders: weeklyCounts[index] > 0 ? total / weeklyCounts[index] : 0
    }));
  }

  private calculateMonthlyPattern(dailyData: any[]) {
    const monthlyTotals = new Array(12).fill(0);
    const monthlyCounts = new Array(12).fill(0);

    dailyData.forEach(day => {
      const month = new Date(day.date).getMonth();
      monthlyTotals[month] += day.orderCount;
      monthlyCounts[month] += 1;
    });

    return monthlyTotals.map((total, index) => ({
      month: index,
      monthName: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][index],
      averageOrders: monthlyCounts[index] > 0 ? total / monthlyCounts[index] : 0
    }));
  }

  private findPeakDays(weeklyPattern: any[]) {
    const sorted = [...weeklyPattern].sort((a, b) => b.averageOrders - a.averageOrders);
    return sorted.slice(0, 2).map(day => day.dayName);
  }

  private calculateTrend(dailyData: any[]) {
    if (dailyData.length < 2) return 'stable';
    
    const values = dailyData.map(d => d.orderCount);
    const regression = new SLR(
      Array.from({ length: values.length }, (_, i) => i),
      values
    );
    
    const slope = regression.slope;
    
    if (slope > 0.1) return 'increasing';
    if (slope < -0.1) return 'decreasing';
    return 'stable';
  }

  private getDaysSinceComeback(comebackDate: Date): number {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - comebackDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private generateComebackImpactCurve(daysSinceComeback: number) {
    // Empirical K-pop comeback impact curve
    const peakDay = 3; // Peak impact usually 3 days after comeback
    const duration = 14; // Impact lasts about 2 weeks
    
    const multipliers = [];
    for (let day = 0; day < duration; day++) {
      const normalizedDay = day / peakDay;
      const multiplier = Math.max(1, 1 + 2 * Math.exp(-0.5 * Math.pow(normalizedDay - 1, 2)));
      multipliers.push(multiplier);
    }
    
    return {
      peakIncrease: Math.max(...multipliers),
      duration,
      multipliers,
      peakDay
    };
  }

  private calculateDemandTrend(orders: any[]) {
    const recentOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return orderDate >= thirtyDaysAgo;
    });

    const trend = recentOrders.length > 0 ? 'increasing' : 'stable';
    return {
      trend,
      recentOrderCount: recentOrders.length,
      changePercentage: this.calculateChangePercentage(orders)
    };
  }

  private calculatePriceElasticity(orders: any[], submissions: any[]) {
    // Simplified price elasticity calculation
    const pricePoints = orders.map(order => ({ price: order.price, quantity: order.min_orders }));
    
    if (pricePoints.length < 2) {
      return { elasticity: 0, interpretation: 'Insufficient data' };
    }

    const avgPrice = ss.mean(pricePoints.map(p => p.price));
    const avgQuantity = ss.mean(pricePoints.map(p => p.quantity));
    
    return {
      elasticity: avgQuantity / avgPrice,
      interpretation: 'Normal elasticity',
      avgPrice,
      avgQuantity
    };
  }

  private analyzeBuyerBehavior(submissions: any[]) {
    const totalSubmissions = submissions.length;
    const confirmedSubmissions = submissions.filter(s => s.payment_status === 'confirmed');
    
    return {
      conversionRate: totalSubmissions > 0 ? (confirmedSubmissions.length / totalSubmissions) * 100 : 0,
      avgPaymentTime: this.calculateAvgPaymentTime(submissions),
      peakSubmissionHours: this.findPeakSubmissionHours(submissions)
    };
  }

  private analyzeCompetitivePosition(orders: any[]) {
    // Mock competitive analysis - in production, this would use market data
    return {
      marketShare: 15.2,
      competitorCount: 23,
      pricePosition: 'competitive',
      recommendations: ['Maintain current pricing', 'Focus on unique items']
    };
  }

  private generateRecommendations(orders: any[], submissions: any[]) {
    const recommendations = [];
    
    // Analyze performance and generate recommendations
    const conversionRate = submissions.length > 0 ? 
      (submissions.filter(s => s.payment_status === 'confirmed').length / submissions.length) * 100 : 0;
    
    if (conversionRate < 70) {
      recommendations.push({
        type: 'conversion',
        priority: 'high',
        message: 'Consider simplifying the payment process to improve conversion rates'
      });
    }

    if (orders.length > 0) {
      const avgOrderValue = ss.mean(orders.map(o => o.price));
      if (avgOrderValue < 20) {
        recommendations.push({
          type: 'pricing',
          priority: 'medium',
          message: 'Consider bundling items to increase average order value'
        });
      }
    }

    return recommendations;
  }

  private calculateChangePercentage(orders: any[]): number {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const recent = orders.filter(order => new Date(order.created_at) >= thirtyDaysAgo);
    const previous = orders.filter(order => {
      const date = new Date(order.created_at);
      return date >= sixtyDaysAgo && date < thirtyDaysAgo;
    });

    if (previous.length === 0) return 0;
    
    return ((recent.length - previous.length) / previous.length) * 100;
  }

  private calculateAvgPaymentTime(submissions: any[]): number {
    const confirmedSubmissions = submissions.filter(s => 
      s.payment_status === 'confirmed' && s.updated_at !== s.created_at
    );

    if (confirmedSubmissions.length === 0) return 0;

    const paymentTimes = confirmedSubmissions.map(s => {
      const created = new Date(s.created_at);
      const confirmed = new Date(s.updated_at);
      return (confirmed.getTime() - created.getTime()) / (1000 * 60 * 60); // hours
    });

    return ss.mean(paymentTimes);
  }

  private findPeakSubmissionHours(submissions: any[]): number[] {
    const hourCounts = new Array(24).fill(0);
    
    submissions.forEach(s => {
      const hour = new Date(s.created_at).getHours();
      hourCounts[hour]++;
    });

    const maxCount = Math.max(...hourCounts);
    return hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(h => h.count === maxCount)
      .map(h => h.hour);
  }
}

// Singleton instance
let forecastingEngine: DemandForecastingEngine | null = null;

export function getForecastingEngine(): DemandForecastingEngine {
  if (!forecastingEngine) {
    forecastingEngine = new DemandForecastingEngine();
  }
  return forecastingEngine;
}

export default DemandForecastingEngine;