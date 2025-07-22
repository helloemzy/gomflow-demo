// Main ML module exports for GOMFLOW demand forecasting system

// Core demand forecasting engine
export { 
  DemandForecastingEngine,
  createDemandForecastingEngine,
  generateSampleOrderHistory,
  evaluateModelPerformance
} from './demandForecasting';

// Data preprocessing utilities
export { 
  DataPreprocessor,
  createDataPreprocessor,
  validateDataQuality
} from './dataPreprocessing';

// Seasonality analysis
export { 
  SeasonalityAnalyzer,
  createSeasonalityAnalyzer,
  detectSeasonalAnomalies,
  predictSeasonalMultipliers
} from './seasonalityAnalysis';

// Comeback prediction
export { 
  ComebackPredictor,
  createComebackPredictor,
  estimateArtistTier,
  generateMockSocialSignals,
  generateMockMarketIndicators
} from './comebackPrediction';

// Model training
export { 
  ModelTrainer,
  createModelTrainer,
  createDefaultTrainingConfig,
  HyperparameterOptimizer,
  ModelEnsemble
} from './modelTraining';

// TypeScript types
export * from './types';

// Export default as main engine
export { default } from './demandForecasting';