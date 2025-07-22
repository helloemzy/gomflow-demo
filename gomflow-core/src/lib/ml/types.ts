import * as tf from '@tensorflow/tfjs';

// Core ML Types
export interface MLModelConfig {
  inputShape: number[];
  outputShape: number[];
  hiddenLayers: number[];
  dropout: number;
  learningRate: number;
  epochs: number;
  batchSize: number;
  validationSplit: number;
}

export interface TrainingData {
  features: tf.Tensor2D;
  targets: tf.Tensor2D;
  metadata?: Record<string, any>;
}

export interface PredictionResult {
  predictions: number[];
  confidence: number[];
  accuracy?: number;
  metadata?: Record<string, any>;
}

export interface ModelMetrics {
  loss: number;
  mae: number;
  mse: number;
  r2Score: number;
  accuracy: number;
}

// Demand Forecasting Types
export interface DemandForecastingInput {
  orderHistory: OrderHistoryData[];
  seasonalFactors: SeasonalFactors;
  externalFactors: ExternalFactors;
  forecastPeriod: number;
}

export interface OrderHistoryData {
  date: string;
  orderCount: number;
  submissionCount: number;
  revenue: number;
  avgPrice: number;
  category: string;
  geoLocation: string;
  weekday: number;
  month: number;
  isHoliday: boolean;
}

export interface SeasonalFactors {
  weeklyPattern: WeeklyPattern[];
  monthlyPattern: MonthlyPattern[];
  holidayMultipliers: HolidayMultiplier[];
  seasonalTrend: 'increasing' | 'decreasing' | 'stable';
}

export interface WeeklyPattern {
  dayOfWeek: number;
  dayName: string;
  averageOrders: number;
  multiplier: number;
}

export interface MonthlyPattern {
  month: number;
  monthName: string;
  averageOrders: number;
  multiplier: number;
}

export interface HolidayMultiplier {
  holidayType: string;
  multiplier: number;
  duration: number;
}

export interface ExternalFactors {
  comebackEvents: ComebackEvent[];
  priceChanges: PriceChange[];
  competitorActivity: CompetitorActivity[];
  marketTrends: MarketTrend[];
}

export interface ComebackEvent {
  artist: string;
  comebackDate: string;
  impactLevel: 'high' | 'medium' | 'low';
  expectedDuration: number;
  categories: string[];
}

export interface PriceChange {
  date: string;
  oldPrice: number;
  newPrice: number;
  category: string;
  elasticity: number;
}

export interface CompetitorActivity {
  date: string;
  activityType: 'new_product' | 'price_change' | 'promotion';
  impact: number;
  category: string;
}

export interface MarketTrend {
  date: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  category: string;
}

// Seasonality Analysis Types
export interface SeasonalityAnalysisResult {
  seasonalComponents: SeasonalComponent[];
  trendComponent: TrendComponent;
  residualComponent: ResidualComponent;
  seasonalityStrength: number;
  trendStrength: number;
  irregularityScore: number;
}

export interface SeasonalComponent {
  period: 'weekly' | 'monthly' | 'yearly';
  amplitude: number;
  phase: number;
  significance: number;
}

export interface TrendComponent {
  slope: number;
  intercept: number;
  direction: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
}

export interface ResidualComponent {
  variance: number;
  autocorrelation: number;
  whitenessTest: number;
}

// Comeback Prediction Types
export interface ComebackPredictionInput {
  artist: string;
  previousComebacks: PreviousComeback[];
  marketIndicators: MarketIndicator[];
  socialMediaSignals: SocialMediaSignal[];
}

export interface PreviousComeback {
  date: string;
  announcementDate: string;
  impactMetrics: ImpactMetrics;
  albumType: 'full' | 'mini' | 'single' | 'repackage';
}

export interface ImpactMetrics {
  peakOrderIncrease: number;
  impactDuration: number;
  totalVolumeIncrease: number;
  categoryBreakdown: Record<string, number>;
}

export interface MarketIndicator {
  indicator: string;
  value: number;
  timestamp: string;
  confidence: number;
}

export interface SocialMediaSignal {
  platform: string;
  signal: string;
  strength: number;
  timestamp: string;
}

export interface ComebackPredictionResult {
  predictedDate: string;
  confidence: number;
  impactForecast: ImpactForecast;
  preparationRecommendations: string[];
}

export interface ImpactForecast {
  expectedPeakIncrease: number;
  expectedDuration: number;
  categoryImpact: Record<string, number>;
  timelineForecast: TimelineForecast[];
}

export interface TimelineForecast {
  date: string;
  expectedMultiplier: number;
  confidence: number;
}

// Data Preprocessing Types
export interface PreprocessingConfig {
  normalizationMethod: 'minmax' | 'zscore' | 'robust';
  smoothingWindow: number;
  outlierThreshold: number;
  missingValueStrategy: 'interpolate' | 'forward_fill' | 'backward_fill' | 'mean';
  featureEngineering: FeatureEngineeringConfig;
}

export interface FeatureEngineeringConfig {
  lagFeatures: number[];
  rollingWindowFeatures: RollingWindowFeature[];
  seasonalFeatures: boolean;
  holidayFeatures: boolean;
  trendFeatures: boolean;
}

export interface RollingWindowFeature {
  window: number;
  aggregation: 'mean' | 'sum' | 'min' | 'max' | 'std';
  name: string;
}

export interface PreprocessedData {
  features: number[][];
  targets: number[][];
  featureNames: string[];
  scalingParams: ScalingParams;
  metadata: DataMetadata;
}

export interface ScalingParams {
  featureMeans: number[];
  featureStds: number[];
  featureMins: number[];
  featureMaxs: number[];
  targetMean: number;
  targetStd: number;
}

export interface DataMetadata {
  originalSize: number;
  processedSize: number;
  featureCount: number;
  outlierCount: number;
  missingValueCount: number;
  dateRange: {
    start: string;
    end: string;
  };
}

// Model Training Types
export interface TrainingConfig {
  modelType: 'lstm' | 'gru' | 'transformer' | 'mlp';
  hyperparameters: HyperParameters;
  validation: ValidationConfig;
  callbacks: CallbackConfig;
}

export interface HyperParameters {
  learningRate: number;
  batchSize: number;
  epochs: number;
  dropout: number;
  recurrentDropout?: number;
  units: number[];
  activation: string;
  optimizer: 'adam' | 'sgd' | 'rmsprop';
  lossFunction: string;
}

export interface ValidationConfig {
  method: 'holdout' | 'k_fold' | 'time_series_split';
  splitRatio: number;
  kFolds?: number;
  timeSeriesSplits?: number;
}

export interface CallbackConfig {
  earlyStoppingPatience: number;
  reduceLrPatience: number;
  reduceLrFactor: number;
  modelCheckpoint: boolean;
  tensorboard: boolean;
}

export interface TrainingResult {
  model: tf.LayersModel;
  history: tf.History;
  metrics: ModelMetrics;
  bestEpoch: number;
  trainingTime: number;
  validationResults: ValidationResult[];
}

export interface ValidationResult {
  fold: number;
  metrics: ModelMetrics;
  predictions: number[];
  actual: number[];
}

// Model Persistence Types
export interface ModelPersistenceConfig {
  modelPath: string;
  metadataPath: string;
  compressionLevel: number;
  includeOptimizer: boolean;
}

export interface ModelMetadata {
  version: string;
  createdAt: string;
  trainingConfig: TrainingConfig;
  preprocessingConfig: PreprocessingConfig;
  metrics: ModelMetrics;
  featureNames: string[];
  scalingParams: ScalingParams;
  modelHash: string;
}

// Performance Metrics Types
export interface PerformanceMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  mae: number;
  mse: number;
  rmse: number;
  mape: number;
  r2Score: number;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  confidence: number;
}

export interface ForecastWithConfidence {
  value: number;
  confidence: ConfidenceInterval;
  timestamp: string;
}

// Error Types
export interface MLError {
  type: 'training' | 'prediction' | 'preprocessing' | 'model_loading';
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Utility Types
export interface DateRange {
  start: string;
  end: string;
}

export interface GeographicData {
  country: string;
  region: string;
  city: string;
  coordinates: [number, number];
}

export interface CategoryData {
  category: string;
  subcategory: string;
  tags: string[];
}

// Advanced Analytics Types
export interface AdvancedAnalyticsResult {
  demandElasticity: DemandElasticity;
  crossCategoryCorrelation: CrossCategoryCorrelation[];
  buyerSegmentation: BuyerSegmentation;
  priceOptimization: PriceOptimization;
  inventoryRecommendations: InventoryRecommendation[];
}

export interface DemandElasticity {
  priceElasticity: number;
  incomeElasticity: number;
  crossElasticity: Record<string, number>;
  elasticityConfidence: number;
}

export interface CrossCategoryCorrelation {
  categoryA: string;
  categoryB: string;
  correlation: number;
  significance: number;
}

export interface BuyerSegmentation {
  segments: BuyerSegment[];
  segmentationAccuracy: number;
  recommendedActions: Record<string, string[]>;
}

export interface BuyerSegment {
  segmentId: string;
  name: string;
  size: number;
  characteristics: Record<string, any>;
  behaviorProfile: BehaviorProfile;
}

export interface BehaviorProfile {
  avgOrderValue: number;
  orderFrequency: number;
  categoryPreferences: Record<string, number>;
  pricesensitivity: number;
  loyaltyScore: number;
}

export interface PriceOptimization {
  currentPrice: number;
  optimalPrice: number;
  expectedDemandChange: number;
  expectedRevenueChange: number;
  confidence: number;
}

export interface InventoryRecommendation {
  category: string;
  currentStock: number;
  recommendedStock: number;
  reasoning: string;
  confidence: number;
  timeframe: string;
}

// Export utility type for tensor operations
export type TensorLike = tf.Tensor | number | number[] | number[][] | number[][][] | number[][][][];