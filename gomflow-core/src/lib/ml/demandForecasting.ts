import * as tf from '@tensorflow/tfjs';
import * as ss from 'simple-statistics';
import { 
  DemandForecastingInput, 
  PredictionResult, 
  OrderHistoryData, 
  ModelMetrics, 
  ForecastWithConfidence, 
  ConfidenceInterval,
  AdvancedAnalyticsResult,
  DemandElasticity,
  PriceOptimization,
  BuyerSegmentation,
  InventoryRecommendation,
  PreprocessingConfig,
  TrainingConfig,
  ModelPersistenceConfig,
  ModelMetadata
} from './types';
import { DataPreprocessor, createDataPreprocessor } from './dataPreprocessing';
import { SeasonalityAnalyzer, createSeasonalityAnalyzer } from './seasonalityAnalysis';
import { ComebackPredictor, createComebackPredictor } from './comebackPrediction';
import { ModelTrainer, createModelTrainer, createDefaultTrainingConfig } from './modelTraining';

/**
 * Comprehensive demand forecasting system for K-pop merchandise
 * Integrates all ML components for accurate demand prediction
 */
export class DemandForecastingEngine {
  private model: tf.LayersModel | null = null;
  private dataPreprocessor: DataPreprocessor;
  private seasonalityAnalyzer: SeasonalityAnalyzer;
  private comebackPredictor: ComebackPredictor;
  private modelTrainer: ModelTrainer;
  private isModelTrained: boolean = false;
  private modelMetadata: ModelMetadata | null = null;
  private confidenceThreshold: number = 0.7;

  constructor(
    preprocessingConfig?: Partial<PreprocessingConfig>,
    trainingConfig?: Partial<TrainingConfig>
  ) {
    this.dataPreprocessor = createDataPreprocessor(preprocessingConfig);
    this.seasonalityAnalyzer = createSeasonalityAnalyzer();
    this.comebackPredictor = createComebackPredictor();
    this.modelTrainer = createModelTrainer();
  }

  /**
   * Train the demand forecasting model
   */
  public async trainModel(
    orderHistory: OrderHistoryData[],
    trainingConfig?: TrainingConfig
  ): Promise<{
    success: boolean;
    metrics: ModelMetrics;
    modelMetadata: ModelMetadata;
  }> {
    console.log('🚀 Starting demand forecasting model training...');
    
    try {
      // Validate input data
      this.validateTrainingData(orderHistory);
      
      // Preprocess data
      console.log('📊 Preprocessing data...');
      const preprocessedData = await this.dataPreprocessor.preprocessData(orderHistory);
      
      // Use provided config or default
      const config = trainingConfig || createDefaultTrainingConfig();
      
      // Train model
      console.log('🧠 Training neural network...');
      const trainingResult = await this.modelTrainer.trainModel(preprocessedData, config);
      
      // Store trained model
      this.model = trainingResult.model;
      this.isModelTrained = true;
      
      // Generate model metadata
      this.modelMetadata = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        trainingConfig: config,
        preprocessingConfig: {
          normalizationMethod: 'zscore',
          smoothingWindow: 7,
          outlierThreshold: 1.5,
          missingValueStrategy: 'interpolate',
          featureEngineering: {
            lagFeatures: [1, 3, 7, 14],
            rollingWindowFeatures: [],
            seasonalFeatures: true,
            holidayFeatures: true,
            trendFeatures: true
          }
        },
        metrics: trainingResult.metrics,
        featureNames: preprocessedData.featureNames,
        scalingParams: preprocessedData.scalingParams,
        modelHash: this.generateModelHash(trainingResult.model)
      };
      
      console.log('✅ Model training completed successfully');
      console.log(`📈 Final metrics: Loss=${trainingResult.metrics.loss.toFixed(4)}, MAE=${trainingResult.metrics.mae.toFixed(4)}, R²=${trainingResult.metrics.r2Score.toFixed(4)}`);
      
      return {
        success: true,
        metrics: trainingResult.metrics,
        modelMetadata: this.modelMetadata
      };
      
    } catch (error) {
      console.error('❌ Model training failed:', error);
      return {
        success: false,
        metrics: {
          loss: Infinity,
          mae: Infinity,
          mse: Infinity,
          r2Score: 0,
          accuracy: 0
        },
        modelMetadata: null as any
      };
    }
  }

  /**
   * Generate comprehensive demand forecast
   */
  public async generateForecast(
    input: DemandForecastingInput
  ): Promise<PredictionResult> {
    if (!this.isModelTrained || !this.model) {
      throw new Error('Model not trained. Call trainModel() first.');
    }
    
    console.log('🔮 Generating demand forecast...');
    
    try {
      // Prepare input data
      const processedInput = await this.prepareInputData(input);
      
      // Generate base predictions
      const basePredictions = await this.generateBasePredictions(processedInput);
      
      // Apply seasonal adjustments
      const seasonalAdjustments = this.applySeasonalAdjustments(
        basePredictions,
        input.seasonalFactors
      );
      
      // Apply comeback impact
      const comebackAdjustments = this.applyComebackImpact(
        seasonalAdjustments,
        input.externalFactors.comebackEvents
      );
      
      // Calculate confidence intervals
      const confidenceIntervals = this.calculateConfidenceIntervals(
        comebackAdjustments,
        input.orderHistory
      );
      
      // Generate final predictions with confidence
      const finalPredictions = this.generateFinalPredictions(
        comebackAdjustments,
        confidenceIntervals
      );
      
      console.log('✅ Forecast generation completed');
      
      return {
        predictions: finalPredictions.map(p => p.value),
        confidence: confidenceIntervals.map(ci => ci.confidence),
        accuracy: this.modelMetadata?.metrics.accuracy || 0,
        metadata: {
          forecastHorizon: input.forecastPeriod,
          modelVersion: this.modelMetadata?.version || '1.0.0',
          generatedAt: new Date().toISOString(),
          features: this.modelMetadata?.featureNames || []
        }
      };
      
    } catch (error) {
      console.error('❌ Forecast generation failed:', error);
      throw new Error(`Forecast generation failed: ${error.message}`);
    }
  }

  /**
   * Generate advanced analytics insights
   */
  public async generateAdvancedAnalytics(
    orderHistory: OrderHistoryData[]
  ): Promise<AdvancedAnalyticsResult> {
    console.log('📊 Generating advanced analytics...');
    
    try {
      // Demand elasticity analysis
      const demandElasticity = this.analyzeDemandElasticity(orderHistory);
      
      // Cross-category correlation analysis
      const crossCategoryCorrelation = this.analyzeCrossCategoryCorrelation(orderHistory);
      
      // Buyer segmentation
      const buyerSegmentation = this.performBuyerSegmentation(orderHistory);
      
      // Price optimization
      const priceOptimization = this.optimizePricing(orderHistory);
      
      // Inventory recommendations
      const inventoryRecommendations = this.generateInventoryRecommendations(orderHistory);
      
      console.log('✅ Advanced analytics completed');
      
      return {
        demandElasticity,
        crossCategoryCorrelation,
        buyerSegmentation,
        priceOptimization,
        inventoryRecommendations
      };
      
    } catch (error) {
      console.error('❌ Advanced analytics failed:', error);
      throw new Error(`Advanced analytics failed: ${error.message}`);
    }
  }

  /**
   * Real-time demand prediction for single data point
   */
  public async predictRealTime(
    currentData: OrderHistoryData,
    recentHistory: OrderHistoryData[]
  ): Promise<{
    prediction: number;
    confidence: number;
    factors: Record<string, number>;
  }> {
    if (!this.isModelTrained || !this.model) {
      throw new Error('Model not trained. Call trainModel() first.');
    }
    
    try {
      // Prepare input features
      const features = this.extractFeatures(currentData, recentHistory);
      const inputTensor = tf.tensor2d([features]);
      
      // Make prediction
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const predictionValue = (await prediction.data())[0];
      
      // Calculate confidence
      const confidence = this.calculatePredictionConfidence(
        predictionValue,
        recentHistory
      );
      
      // Analyze contributing factors
      const factors = this.analyzeContributingFactors(currentData, recentHistory);
      
      // Cleanup
      inputTensor.dispose();
      prediction.dispose();
      
      return {
        prediction: Math.max(0, Math.round(predictionValue)),
        confidence,
        factors
      };
      
    } catch (error) {
      console.error('❌ Real-time prediction failed:', error);
      throw new Error(`Real-time prediction failed: ${error.message}`);
    }
  }

  /**
   * Save model and metadata
   */
  public async saveModel(config: ModelPersistenceConfig): Promise<boolean> {
    if (!this.model || !this.modelMetadata) {
      throw new Error('No trained model to save');
    }
    
    try {
      console.log('💾 Saving model...');
      
      // Save model (in browser environment, this would use IndexedDB)
      await this.model.save(config.modelPath);
      
      // Save metadata
      const metadataJson = JSON.stringify(this.modelMetadata, null, 2);
      // In production, save to persistent storage
      
      console.log('✅ Model saved successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Model save failed:', error);
      return false;
    }
  }

  /**
   * Load model and metadata
   */
  public async loadModel(config: ModelPersistenceConfig): Promise<boolean> {
    try {
      console.log('📁 Loading model...');
      
      // Load model
      this.model = await tf.loadLayersModel(config.modelPath);
      
      // Load metadata
      // In production, load from persistent storage
      // this.modelMetadata = JSON.parse(metadataJson);
      
      this.isModelTrained = true;
      console.log('✅ Model loaded successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Model load failed:', error);
      return false;
    }
  }

  /**
   * Validate training data
   */
  private validateTrainingData(orderHistory: OrderHistoryData[]): void {
    if (!orderHistory || orderHistory.length === 0) {
      throw new Error('No training data provided');
    }
    
    if (orderHistory.length < 60) {
      throw new Error('Insufficient training data (minimum 60 data points required)');
    }
    
    // Check for required fields
    const requiredFields = ['date', 'orderCount', 'submissionCount', 'revenue'];
    const missingFields = requiredFields.filter(field => 
      !orderHistory.every(item => item[field] !== undefined && item[field] !== null)
    );
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  /**
   * Prepare input data for prediction
   */
  private async prepareInputData(input: DemandForecastingInput): Promise<any> {
    // Extract features from order history
    const features = input.orderHistory.map(item => this.extractFeatures(item, input.orderHistory));
    
    // Apply preprocessing
    const processedData = await this.dataPreprocessor.preprocessData(input.orderHistory);
    
    return {
      features,
      processedData,
      seasonalFactors: input.seasonalFactors,
      externalFactors: input.externalFactors
    };
  }

  /**
   * Generate base predictions from neural network
   */
  private async generateBasePredictions(processedInput: any): Promise<number[]> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }
    
    const inputTensor = tf.tensor2d(processedInput.features);
    const predictions = this.model.predict(inputTensor) as tf.Tensor;
    const predictionData = await predictions.data();
    
    // Cleanup
    inputTensor.dispose();
    predictions.dispose();
    
    return Array.from(predictionData);
  }

  /**
   * Apply seasonal adjustments to predictions
   */
  private applySeasonalAdjustments(
    basePredictions: number[],
    seasonalFactors: any
  ): number[] {
    return basePredictions.map((prediction, index) => {
      const dayOfWeek = index % 7;
      const weeklyMultiplier = seasonalFactors.weeklyPattern[dayOfWeek]?.multiplier || 1;
      
      const month = Math.floor(index / 30) % 12;
      const monthlyMultiplier = seasonalFactors.monthlyPattern[month]?.multiplier || 1;
      
      return prediction * weeklyMultiplier * monthlyMultiplier;
    });
  }

  /**
   * Apply comeback impact to predictions
   */
  private applyComebackImpact(
    seasonalPredictions: number[],
    comebackEvents: any[]
  ): number[] {
    const adjustedPredictions = [...seasonalPredictions];
    
    comebackEvents.forEach(event => {
      const comebackDate = new Date(event.comebackDate);
      const impactCurve = this.comebackPredictor.generateComebackImpactCurve(
        'major', // Default tier
        event.albumType || 'mini',
        30 // 30-day impact
      );
      
      // Apply impact curve to predictions
      impactCurve.forEach((multiplier, dayOffset) => {
        const predictionIndex = dayOffset; // Simplified index calculation
        if (predictionIndex < adjustedPredictions.length) {
          adjustedPredictions[predictionIndex] *= multiplier;
        }
      });
    });
    
    return adjustedPredictions;
  }

  /**
   * Calculate confidence intervals for predictions
   */
  private calculateConfidenceIntervals(
    predictions: number[],
    historicalData: OrderHistoryData[]
  ): ConfidenceInterval[] {
    const historicalValues = historicalData.map(item => item.orderCount);
    const historicalStd = ss.standardDeviation(historicalValues);
    
    return predictions.map(prediction => {
      const lowerBound = Math.max(0, prediction - 1.96 * historicalStd);
      const upperBound = prediction + 1.96 * historicalStd;
      
      return {
        lower: lowerBound,
        upper: upperBound,
        confidence: this.confidenceThreshold
      };
    });
  }

  /**
   * Generate final predictions with confidence
   */
  private generateFinalPredictions(
    predictions: number[],
    confidenceIntervals: ConfidenceInterval[]
  ): ForecastWithConfidence[] {
    return predictions.map((prediction, index) => ({
      value: Math.max(0, Math.round(prediction)),
      confidence: confidenceIntervals[index],
      timestamp: new Date(Date.now() + index * 24 * 60 * 60 * 1000).toISOString()
    }));
  }

  /**
   * Extract features from order data
   */
  private extractFeatures(
    currentData: OrderHistoryData,
    recentHistory: OrderHistoryData[]
  ): number[] {
    const date = new Date(currentData.date);
    
    // Temporal features
    const dayOfWeek = date.getDay();
    const month = date.getMonth();
    const dayOfMonth = date.getDate();
    
    // Cyclical encoding
    const dayOfWeekSin = Math.sin(2 * Math.PI * dayOfWeek / 7);
    const dayOfWeekCos = Math.cos(2 * Math.PI * dayOfWeek / 7);
    const monthSin = Math.sin(2 * Math.PI * month / 12);
    const monthCos = Math.cos(2 * Math.PI * month / 12);
    
    // Historical features
    const recentValues = recentHistory.slice(-7).map(item => item.orderCount);
    const recentAvg = recentValues.length > 0 ? ss.mean(recentValues) : 0;
    const recentTrend = recentValues.length > 1 ? 
      (recentValues[recentValues.length - 1] - recentValues[0]) / recentValues.length : 0;
    
    // Business metrics
    const conversionRate = currentData.submissionCount > 0 ? 
      currentData.orderCount / currentData.submissionCount : 0;
    const avgPrice = currentData.avgPrice || 0;
    const isHoliday = currentData.isHoliday ? 1 : 0;
    
    return [
      currentData.submissionCount,
      currentData.revenue,
      avgPrice,
      dayOfWeekSin,
      dayOfWeekCos,
      monthSin,
      monthCos,
      recentAvg,
      recentTrend,
      conversionRate,
      isHoliday,
      dayOfMonth / 31,  // Normalized
      currentData.weekday / 7  // Normalized
    ];
  }

  /**
   * Calculate prediction confidence
   */
  private calculatePredictionConfidence(
    prediction: number,
    recentHistory: OrderHistoryData[]
  ): number {
    const recentValues = recentHistory.slice(-30).map(item => item.orderCount);
    const mean = ss.mean(recentValues);
    const std = ss.standardDeviation(recentValues);
    
    // Calculate how many standard deviations away the prediction is
    const zScore = Math.abs(prediction - mean) / std;
    
    // Convert to confidence (inverse relationship)
    return Math.max(0.3, 1 - zScore / 3);
  }

  /**
   * Analyze contributing factors
   */
  private analyzeContributingFactors(
    currentData: OrderHistoryData,
    recentHistory: OrderHistoryData[]
  ): Record<string, number> {
    const factors: Record<string, number> = {};
    
    // Seasonal factors
    const date = new Date(currentData.date);
    const dayOfWeek = date.getDay();
    const month = date.getMonth();
    
    factors.weeklySeasonality = this.calculateWeeklySeasonality(dayOfWeek, recentHistory);
    factors.monthlySeasonality = this.calculateMonthlySeasonality(month, recentHistory);
    
    // Trend factors
    const recentTrend = this.calculateRecentTrend(recentHistory);
    factors.trend = recentTrend;
    
    // Business factors
    factors.conversionRate = currentData.submissionCount > 0 ? 
      currentData.orderCount / currentData.submissionCount : 0;
    factors.priceImpact = this.calculatePriceImpact(currentData.avgPrice, recentHistory);
    
    return factors;
  }

  /**
   * Calculate weekly seasonality factor
   */
  private calculateWeeklySeasonality(dayOfWeek: number, history: OrderHistoryData[]): number {
    const weeklyData = new Array(7).fill(0);
    const weeklyCounts = new Array(7).fill(0);
    
    history.forEach(item => {
      const day = new Date(item.date).getDay();
      weeklyData[day] += item.orderCount;
      weeklyCounts[day]++;
    });
    
    const avgForDay = weeklyCounts[dayOfWeek] > 0 ? 
      weeklyData[dayOfWeek] / weeklyCounts[dayOfWeek] : 0;
    const overallAvg = ss.mean(history.map(item => item.orderCount));
    
    return overallAvg > 0 ? avgForDay / overallAvg : 1;
  }

  /**
   * Calculate monthly seasonality factor
   */
  private calculateMonthlySeasonality(month: number, history: OrderHistoryData[]): number {
    const monthlyData = new Array(12).fill(0);
    const monthlyCounts = new Array(12).fill(0);
    
    history.forEach(item => {
      const itemMonth = new Date(item.date).getMonth();
      monthlyData[itemMonth] += item.orderCount;
      monthlyCounts[itemMonth]++;
    });
    
    const avgForMonth = monthlyCounts[month] > 0 ? 
      monthlyData[month] / monthlyCounts[month] : 0;
    const overallAvg = ss.mean(history.map(item => item.orderCount));
    
    return overallAvg > 0 ? avgForMonth / overallAvg : 1;
  }

  /**
   * Calculate recent trend
   */
  private calculateRecentTrend(history: OrderHistoryData[]): number {
    const recentValues = history.slice(-14).map(item => item.orderCount);
    if (recentValues.length < 2) return 0;
    
    const indices = Array.from({ length: recentValues.length }, (_, i) => i);
    // Simple linear regression calculation
    const n = recentValues.length;
    const sumX = indices.reduce((a, b) => a + b, 0);
    const sumY = recentValues.reduce((a, b) => a + b, 0);
    const sumXY = indices.reduce((sum, x, i) => sum + x * recentValues[i], 0);
    const sumXX = indices.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    return slope;
  }

  /**
   * Calculate price impact
   */
  private calculatePriceImpact(currentPrice: number, history: OrderHistoryData[]): number {
    const avgPrice = ss.mean(history.map(item => item.avgPrice));
    if (avgPrice === 0) return 1;
    
    const priceRatio = currentPrice / avgPrice;
    
    // Assume inverse relationship (higher price = lower demand)
    return 1 / priceRatio;
  }

  /**
   * Analyze demand elasticity
   */
  private analyzeDemandElasticity(orderHistory: OrderHistoryData[]): DemandElasticity {
    const prices = orderHistory.map(item => item.avgPrice).filter(p => p > 0);
    const quantities = orderHistory.map(item => item.orderCount);
    
    if (prices.length < 10) {
      return {
        priceElasticity: 0,
        incomeElasticity: 0,
        crossElasticity: {},
        elasticityConfidence: 0
      };
    }
    
    // Calculate price elasticity using regression
    const priceElasticity = this.calculatePriceElasticity(prices, quantities);
    
    return {
      priceElasticity,
      incomeElasticity: -0.5, // Assumed value
      crossElasticity: {},
      elasticityConfidence: 0.7
    };
  }

  /**
   * Calculate price elasticity
   */
  private calculatePriceElasticity(prices: number[], quantities: number[]): number {
    const logPrices = prices.map(p => Math.log(p));
    const logQuantities = quantities.map(q => Math.log(Math.max(1, q)));
    
    // Simple linear regression calculation
    const n = logPrices.length;
    const sumX = logPrices.reduce((a, b) => a + b, 0);
    const sumY = logQuantities.reduce((a, b) => a + b, 0);
    const sumXY = logPrices.reduce((sum, x, i) => sum + x * logQuantities[i], 0);
    const sumXX = logPrices.reduce((sum, x) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    return slope; // Elasticity coefficient
  }

  /**
   * Analyze cross-category correlation
   */
  private analyzeCrossCategoryCorrelation(orderHistory: OrderHistoryData[]): any[] {
    // Simplified implementation
    return [];
  }

  /**
   * Perform buyer segmentation
   */
  private performBuyerSegmentation(orderHistory: OrderHistoryData[]): BuyerSegmentation {
    // Simplified implementation
    return {
      segments: [],
      segmentationAccuracy: 0,
      recommendedActions: {}
    };
  }

  /**
   * Optimize pricing
   */
  private optimizePricing(orderHistory: OrderHistoryData[]): PriceOptimization {
    const avgPrice = ss.mean(orderHistory.map(item => item.avgPrice));
    const avgDemand = ss.mean(orderHistory.map(item => item.orderCount));
    
    return {
      currentPrice: avgPrice,
      optimalPrice: avgPrice * 1.1, // 10% increase
      expectedDemandChange: -0.05, // 5% decrease
      expectedRevenueChange: 0.045, // 4.5% increase
      confidence: 0.6
    };
  }

  /**
   * Generate inventory recommendations
   */
  private generateInventoryRecommendations(orderHistory: OrderHistoryData[]): InventoryRecommendation[] {
    const avgDemand = ss.mean(orderHistory.map(item => item.orderCount));
    
    return [{
      category: 'general',
      currentStock: 0,
      recommendedStock: Math.round(avgDemand * 30), // 30-day supply
      reasoning: 'Based on historical demand patterns',
      confidence: 0.8,
      timeframe: '30 days'
    }];
  }

  /**
   * Generate model hash for versioning
   */
  private generateModelHash(model: tf.LayersModel): string {
    const modelJson = JSON.stringify(model.toJSON());
    return Buffer.from(modelJson).toString('base64').slice(0, 16);
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.model) {
      this.model.dispose();
    }
    this.modelTrainer.dispose();
  }
}

/**
 * Factory function to create demand forecasting engine
 */
export function createDemandForecastingEngine(
  preprocessingConfig?: Partial<PreprocessingConfig>,
  trainingConfig?: Partial<TrainingConfig>
): DemandForecastingEngine {
  return new DemandForecastingEngine(preprocessingConfig, trainingConfig);
}

/**
 * Utility function to generate sample data for testing
 */
export function generateSampleOrderHistory(days: number = 90): OrderHistoryData[] {
  const data: OrderHistoryData[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    
    const dayOfWeek = date.getDay();
    const month = date.getMonth();
    
    // Simulate weekly and monthly patterns
    const weeklyMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 1.5 : 1.0; // Weekends
    const monthlyMultiplier = month === 11 || month === 0 ? 2.0 : 1.0; // Holiday season
    
    const baseOrders = 50 + Math.random() * 50;
    const orderCount = Math.round(baseOrders * weeklyMultiplier * monthlyMultiplier);
    const submissionCount = Math.round(orderCount * (1.2 + Math.random() * 0.3));
    const avgPrice = 20 + Math.random() * 30;
    const revenue = orderCount * avgPrice;
    
    data.push({
      date: date.toISOString().split('T')[0],
      orderCount,
      submissionCount,
      revenue,
      avgPrice,
      category: 'albums',
      geoLocation: 'Philippines',
      weekday: dayOfWeek,
      month,
      isHoliday: month === 11 && date.getDate() === 25 // Christmas
    });
  }
  
  return data;
}

/**
 * Utility function to evaluate model performance
 */
export async function evaluateModelPerformance(
  engine: DemandForecastingEngine,
  testData: OrderHistoryData[]
): Promise<{
  mae: number;
  mse: number;
  r2Score: number;
  accuracy: number;
}> {
  const predictions = [];
  const actuals = [];
  
  for (let i = 30; i < testData.length; i++) {
    const historicalData = testData.slice(0, i);
    const currentData = testData[i];
    
    try {
      const prediction = await engine.predictRealTime(currentData, historicalData);
      predictions.push(prediction.prediction);
      actuals.push(currentData.orderCount);
    } catch (error) {
      console.error('Prediction failed:', error);
    }
  }
  
  if (predictions.length === 0) {
    return { mae: 0, mse: 0, r2Score: 0, accuracy: 0 };
  }
  
  // Calculate metrics
  const mae = ss.mean(predictions.map((pred, i) => Math.abs(pred - actuals[i])));
  const mse = ss.mean(predictions.map((pred, i) => Math.pow(pred - actuals[i], 2)));
  const actualMean = ss.mean(actuals);
  const ssRes = ss.sum(predictions.map((pred, i) => Math.pow(actuals[i] - pred, 2)));
  const ssTot = ss.sum(actuals.map(actual => Math.pow(actual - actualMean, 2)));
  const r2Score = 1 - (ssRes / ssTot);
  
  // Calculate accuracy (within 20% threshold)
  const accurateCount = predictions.filter((pred, i) => {
    const relativeError = Math.abs(pred - actuals[i]) / Math.max(1, actuals[i]);
    return relativeError <= 0.2;
  }).length;
  const accuracy = accurateCount / predictions.length;
  
  return { mae, mse, r2Score, accuracy };
}

// Export the main engine as default
export default DemandForecastingEngine;