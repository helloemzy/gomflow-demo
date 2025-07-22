# GOMFLOW ML: Advanced Demand Forecasting System

A comprehensive TensorFlow.js-based machine learning system for predicting K-pop merchandise demand with advanced analytics and seasonal pattern recognition.

## 🚀 Features

- **Neural Network Models**: LSTM, GRU, Transformer, and MLP architectures
- **Time Series Analysis**: Advanced seasonality detection and trend analysis
- **K-pop Comeback Prediction**: AI-powered comeback impact forecasting
- **Data Preprocessing**: Robust data cleaning, normalization, and feature engineering
- **Real-time Predictions**: Sub-second prediction capabilities
- **Advanced Analytics**: Price elasticity, buyer segmentation, and inventory optimization
- **Confidence Intervals**: Uncertainty quantification for all predictions
- **Model Persistence**: Save and load trained models
- **Hyperparameter Optimization**: Automated model tuning
- **Production Ready**: Comprehensive error handling and monitoring

## 📊 System Architecture

```
GOMFLOW ML System
├── demandForecasting.ts     # Main forecasting engine
├── dataPreprocessing.ts     # Data cleaning and feature engineering
├── seasonalityAnalysis.ts   # Seasonal pattern detection
├── comebackPrediction.ts    # K-pop comeback forecasting
├── modelTraining.ts         # Neural network training
├── types.ts                 # TypeScript type definitions
├── demo.ts                  # Usage examples and demos
├── test.ts                  # Test suite
└── index.ts                 # Main exports
```

## 🛠️ Installation

The ML system is already integrated into the GOMFLOW core project with all necessary dependencies:

```bash
# Dependencies are already installed in the main project
npm install @tensorflow/tfjs ml-regression simple-statistics
```

## 📚 Quick Start

### Basic Usage

```typescript
import { createDemandForecastingEngine, generateSampleOrderHistory } from './lib/ml';

// Create the forecasting engine
const engine = createDemandForecastingEngine();

// Generate or load your order history data
const orderHistory = generateSampleOrderHistory(90); // 90 days of sample data

// Train the model
const trainingResult = await engine.trainModel(orderHistory);

if (trainingResult.success) {
  console.log(`Model trained successfully! Accuracy: ${(trainingResult.metrics.accuracy * 100).toFixed(1)}%`);
  
  // Make real-time predictions
  const currentData = orderHistory[orderHistory.length - 1];
  const recentHistory = orderHistory.slice(-30);
  
  const prediction = await engine.predictRealTime(currentData, recentHistory);
  console.log(`Predicted demand: ${prediction.prediction} orders`);
  console.log(`Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
}

// Clean up resources
engine.dispose();
```

### Advanced Forecasting

```typescript
import { 
  createDemandForecastingEngine,
  createSeasonalityAnalyzer,
  DemandForecastingInput
} from './lib/ml';

const engine = createDemandForecastingEngine();
const analyzer = createSeasonalityAnalyzer();

// Train the model
await engine.trainModel(orderHistory);

// Generate seasonal factors
const seasonalFactors = analyzer.generateSeasonalFactors(orderHistory);

// Create forecast input with external factors
const forecastInput: DemandForecastingInput = {
  orderHistory,
  seasonalFactors,
  externalFactors: {
    comebackEvents: [
      {
        artist: 'BTS',
        comebackDate: '2024-03-15',
        impactLevel: 'high',
        expectedDuration: 21,
        categories: ['albums', 'photocards']
      }
    ],
    priceChanges: [],
    competitorActivity: [],
    marketTrends: []
  },
  forecastPeriod: 30
};

// Generate comprehensive forecast
const forecast = await engine.generateForecast(forecastInput);

console.log(`30-day forecast generated with ${forecast.predictions.length} predictions`);
console.log(`Average confidence: ${(forecast.confidence.reduce((a, b) => a + b, 0) / forecast.confidence.length * 100).toFixed(1)}%`);
```

### K-pop Comeback Prediction

```typescript
import { 
  createComebackPredictor,
  generateMockSocialSignals,
  generateMockMarketIndicators
} from './lib/ml';

const predictor = createComebackPredictor();

const comebackInput = {
  artist: 'BLACKPINK',
  previousComebacks: [
    {
      date: '2022-08-19',
      announcementDate: '2022-07-31',
      albumType: 'mini',
      impactMetrics: {
        peakOrderIncrease: 2.5,
        impactDuration: 21,
        totalVolumeIncrease: 1500,
        categoryBreakdown: { 'albums': 0.7, 'photocards': 0.3 }
      }
    }
  ],
  marketIndicators: generateMockMarketIndicators(0.8),
  socialMediaSignals: generateMockSocialSignals(0.9)
};

const prediction = predictor.predictComeback(comebackInput);

console.log(`Predicted comeback date: ${prediction.predictedDate}`);
console.log(`Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
console.log(`Expected peak increase: ${(prediction.impactForecast.expectedPeakIncrease * 100).toFixed(1)}%`);
```

## 🔧 Configuration

### Data Preprocessing Configuration

```typescript
import { createDataPreprocessor } from './lib/ml';

const preprocessor = createDataPreprocessor({
  normalizationMethod: 'zscore',        // 'zscore', 'minmax', 'robust'
  smoothingWindow: 7,                   // Moving average window
  outlierThreshold: 2.0,                // IQR multiplier for outliers
  missingValueStrategy: 'interpolate',   // 'interpolate', 'forward_fill', 'backward_fill', 'mean'
  featureEngineering: {
    lagFeatures: [1, 3, 7, 14],         // Lag features to create
    rollingWindowFeatures: [
      { window: 7, aggregation: 'mean', name: 'rolling_mean' },
      { window: 14, aggregation: 'std', name: 'rolling_std' }
    ],
    seasonalFeatures: true,             // Create seasonal features
    holidayFeatures: true,              // Create holiday features
    trendFeatures: true                 // Create trend features
  }
});
```

### Model Training Configuration

```typescript
import { createDefaultTrainingConfig } from './lib/ml';

const config = createDefaultTrainingConfig();

// Customize training parameters
config.modelType = 'lstm';              // 'lstm', 'gru', 'transformer', 'mlp'
config.hyperparameters = {
  learningRate: 0.001,
  batchSize: 32,
  epochs: 100,
  dropout: 0.2,
  recurrentDropout: 0.2,
  units: [64, 32, 16],                  // Hidden layer sizes
  activation: 'relu',
  optimizer: 'adam',                    // 'adam', 'sgd', 'rmsprop'
  lossFunction: 'meanSquaredError'
};

config.validation = {
  method: 'holdout',                    // 'holdout', 'k_fold', 'time_series_split'
  splitRatio: 0.2,
  kFolds: 5,
  timeSeriesSplits: 3
};

config.callbacks = {
  earlyStoppingPatience: 10,
  reduceLrPatience: 5,
  reduceLrFactor: 0.5,
  modelCheckpoint: true,
  tensorboard: false
};
```

## 📈 Performance Metrics

The system provides comprehensive performance metrics:

- **Mean Absolute Error (MAE)**: Average absolute difference between predicted and actual values
- **Mean Squared Error (MSE)**: Average squared difference between predicted and actual values
- **R² Score**: Coefficient of determination (goodness of fit)
- **Accuracy**: Percentage of predictions within 20% of actual values
- **Confidence Intervals**: Upper and lower bounds for predictions

## 🎯 Use Cases

### 1. Daily Demand Forecasting
Predict next-day order volumes with high accuracy for inventory planning.

### 2. Seasonal Planning
Identify peak seasons and prepare for increased demand during comeback periods.

### 3. Price Optimization
Analyze price elasticity to find optimal pricing strategies.

### 4. Inventory Management
Generate data-driven inventory recommendations based on forecasted demand.

### 5. Comeback Impact Analysis
Quantify the impact of artist comebacks on merchandise demand.

### 6. Market Intelligence
Understand buyer behavior patterns and market trends.

## 🔍 Advanced Analytics

### Price Elasticity Analysis
```typescript
const analytics = await engine.generateAdvancedAnalytics(orderHistory);
console.log(`Price elasticity: ${analytics.demandElasticity.priceElasticity.toFixed(3)}`);
```

### Buyer Segmentation
```typescript
const segmentation = analytics.buyerSegmentation;
segmentation.segments.forEach(segment => {
  console.log(`Segment: ${segment.name}, Size: ${segment.size}, Loyalty: ${segment.behaviorProfile.loyaltyScore}`);
});
```

### Inventory Optimization
```typescript
analytics.inventoryRecommendations.forEach(rec => {
  console.log(`${rec.category}: Stock ${rec.recommendedStock} units (${rec.confidence * 100}% confidence)`);
});
```

## 🧪 Testing

The system includes comprehensive tests:

```typescript
import { runAllTests } from './lib/ml/test';

// Run all tests
await runAllTests();

// Or run specific test suites
import { 
  runBasicTests,
  testDataPreprocessing,
  testSeasonalityAnalysis,
  testPerformanceScaling,
  testErrorHandling
} from './lib/ml/test';

await runBasicTests();
await testDataPreprocessing();
await testSeasonalityAnalysis();
await testPerformanceScaling();
await testErrorHandling();
```

## 🎮 Demo

Run the comprehensive demo to see all features in action:

```typescript
import { runDemandForecastingDemo } from './lib/ml/demo';

await runDemandForecastingDemo();
```

## 📊 Data Format

The system expects data in the following format:

```typescript
interface OrderHistoryData {
  date: string;                // ISO date string (YYYY-MM-DD)
  orderCount: number;          // Number of orders
  submissionCount: number;     // Number of order submissions
  revenue: number;             // Total revenue
  avgPrice: number;            // Average price per order
  category: string;            // Product category
  geoLocation: string;         // Geographic location
  weekday: number;             // Day of week (0-6)
  month: number;               // Month (0-11)
  isHoliday: boolean;          // Whether it's a holiday
}
```

## 🔄 Integration with GOMFLOW API

The ML system is designed to integrate seamlessly with the existing GOMFLOW API:

```typescript
// In your API route handler
import { getForecastingEngine } from '../lib/ai-forecasting';

export async function GET(request: Request) {
  const engine = getForecastingEngine();
  
  // Fetch data from database
  const { orders, submissions } = await fetchOrderData();
  
  // Generate advanced forecast
  const forecast = await engine.generateAdvancedForecast(orders, submissions, 30);
  
  return Response.json({
    success: true,
    forecast,
    metadata: {
      generatedAt: new Date().toISOString(),
      forecastHorizon: 30
    }
  });
}
```

## 🚀 Production Deployment

### Model Persistence
```typescript
// Save trained model
await engine.saveModel({
  modelPath: 'indexeddb://gomflow-demand-model',
  metadataPath: 'gomflow-model-metadata.json',
  compressionLevel: 1,
  includeOptimizer: false
});

// Load model in production
await engine.loadModel({
  modelPath: 'indexeddb://gomflow-demand-model',
  metadataPath: 'gomflow-model-metadata.json'
});
```

### Performance Monitoring
```typescript
// Monitor prediction performance
const startTime = performance.now();
const prediction = await engine.predictRealTime(currentData, recentHistory);
const predictionTime = performance.now() - startTime;

console.log(`Prediction completed in ${predictionTime.toFixed(2)}ms`);
```

## 📚 API Reference

### Core Classes

- `DemandForecastingEngine`: Main forecasting engine
- `DataPreprocessor`: Data cleaning and feature engineering
- `SeasonalityAnalyzer`: Seasonal pattern detection
- `ComebackPredictor`: K-pop comeback prediction
- `ModelTrainer`: Neural network training
- `HyperparameterOptimizer`: Automated model tuning
- `ModelEnsemble`: Multiple model ensemble

### Factory Functions

- `createDemandForecastingEngine()`: Create main engine
- `createDataPreprocessor()`: Create data preprocessor
- `createSeasonalityAnalyzer()`: Create seasonality analyzer
- `createComebackPredictor()`: Create comeback predictor
- `createModelTrainer()`: Create model trainer
- `createDefaultTrainingConfig()`: Create default training config

### Utility Functions

- `generateSampleOrderHistory()`: Generate test data
- `evaluateModelPerformance()`: Evaluate model on test data
- `validateDataQuality()`: Validate input data quality
- `detectSeasonalAnomalies()`: Detect seasonal anomalies
- `predictSeasonalMultipliers()`: Predict seasonal factors

## 🛡️ Error Handling

The system includes comprehensive error handling:

- **Data validation**: Automatic detection of invalid or insufficient data
- **Training failures**: Graceful handling of training errors with fallback options
- **Memory management**: Automatic cleanup of TensorFlow tensors
- **Prediction errors**: Robust error handling for prediction failures
- **Resource cleanup**: Proper disposal of models and resources

## 🔧 Troubleshooting

### Common Issues

1. **Insufficient Data**: Ensure at least 60 data points for training
2. **Memory Issues**: Use smaller batch sizes or dispose of models properly
3. **Training Failures**: Check data quality and reduce model complexity
4. **Slow Performance**: Use GPU acceleration if available
5. **Prediction Errors**: Ensure model is trained before making predictions

### Performance Optimization

1. **Use GPU acceleration**: Enable WebGL backend for faster training
2. **Batch predictions**: Process multiple predictions together
3. **Model compression**: Use quantization for smaller models
4. **Caching**: Cache frequently used preprocessed data
5. **Parallel processing**: Use web workers for heavy computations

## 📝 Contributing

To contribute to the ML system:

1. Add new features to appropriate modules
2. Include comprehensive tests
3. Update type definitions
4. Add documentation and examples
5. Ensure backward compatibility

## 📄 License

This ML system is part of the GOMFLOW platform and follows the same licensing terms.

## 🙏 Acknowledgments

- TensorFlow.js team for the excellent ML framework
- Simple Statistics library for statistical functions
- ML-Regression library for regression utilities
- K-pop community for market insights and domain knowledge

---

For more information, see the individual module documentation and demo files.