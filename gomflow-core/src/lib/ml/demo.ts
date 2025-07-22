/**
 * GOMFLOW Demand Forecasting ML Demo
 * 
 * This file demonstrates how to use the comprehensive TensorFlow.js demand forecasting
 * system for K-pop merchandise prediction.
 */

import { 
  createDemandForecastingEngine,
  generateSampleOrderHistory,
  evaluateModelPerformance,
  createSeasonalityAnalyzer,
  createComebackPredictor,
  createDataPreprocessor,
  createModelTrainer,
  createDefaultTrainingConfig,
  OrderHistoryData,
  DemandForecastingInput,
  ComebackPredictionInput,
  generateMockSocialSignals,
  generateMockMarketIndicators,
  estimateArtistTier,
  HyperparameterOptimizer
} from './index';

/**
 * Main demo function showcasing all ML capabilities
 */
export async function runDemandForecastingDemo(): Promise<void> {
  console.log('🚀 Starting GOMFLOW Demand Forecasting ML Demo');
  console.log('================================================');

  try {
    // 1. Generate sample data
    console.log('\n📊 1. Generating sample order history data...');
    const orderHistory = generateSampleOrderHistory(120); // 120 days of data
    console.log(`✅ Generated ${orderHistory.length} days of sample data`);

    // 2. Data preprocessing demo
    console.log('\n🔧 2. Data preprocessing demonstration...');
    await runDataPreprocessingDemo(orderHistory);

    // 3. Seasonality analysis demo
    console.log('\n📈 3. Seasonality analysis demonstration...');
    await runSeasonalityAnalysisDemo(orderHistory);

    // 4. Comeback prediction demo
    console.log('\n🎵 4. K-pop comeback prediction demonstration...');
    await runComebackPredictionDemo();

    // 5. Model training demo
    console.log('\n🧠 5. Model training demonstration...');
    await runModelTrainingDemo(orderHistory);

    // 6. Comprehensive forecasting demo
    console.log('\n🔮 6. Comprehensive demand forecasting...');
    await runComprehensiveForecastingDemo(orderHistory);

    // 7. Advanced analytics demo
    console.log('\n📊 7. Advanced analytics demonstration...');
    await runAdvancedAnalyticsDemo(orderHistory);

    // 8. Real-time prediction demo
    console.log('\n⚡ 8. Real-time prediction demonstration...');
    await runRealTimePredictionDemo(orderHistory);

    // 9. Model evaluation demo
    console.log('\n📏 9. Model evaluation demonstration...');
    await runModelEvaluationDemo(orderHistory);

    // 10. Hyperparameter optimization demo
    console.log('\n🔍 10. Hyperparameter optimization demonstration...');
    await runHyperparameterOptimizationDemo(orderHistory);

    console.log('\n✅ Demo completed successfully!');
    console.log('=====================================');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

/**
 * Data preprocessing demonstration
 */
async function runDataPreprocessingDemo(orderHistory: OrderHistoryData[]): Promise<void> {
  const preprocessor = createDataPreprocessor({
    normalizationMethod: 'zscore',
    smoothingWindow: 7,
    outlierThreshold: 2.0,
    missingValueStrategy: 'interpolate'
  });

  const preprocessedData = await preprocessor.preprocessData(orderHistory);
  
  console.log('  📋 Preprocessing Results:');
  console.log(`    - Original data points: ${preprocessedData.metadata.originalSize}`);
  console.log(`    - Processed data points: ${preprocessedData.metadata.processedSize}`);
  console.log(`    - Features per data point: ${preprocessedData.metadata.featureCount}`);
  console.log(`    - Date range: ${preprocessedData.metadata.dateRange.start} to ${preprocessedData.metadata.dateRange.end}`);
  console.log(`    - Feature names: ${preprocessedData.featureNames.join(', ')}`);
}

/**
 * Seasonality analysis demonstration
 */
async function runSeasonalityAnalysisDemo(orderHistory: OrderHistoryData[]): Promise<void> {
  const analyzer = createSeasonalityAnalyzer();
  
  // Analyze seasonality patterns
  const seasonalityResult = analyzer.analyzeSeasonality(orderHistory);
  
  console.log('  🌊 Seasonality Analysis Results:');
  console.log(`    - Seasonality strength: ${seasonalityResult.seasonalityStrength.toFixed(3)}`);
  console.log(`    - Trend strength: ${seasonalityResult.trendStrength.toFixed(3)}`);
  console.log(`    - Irregularity score: ${seasonalityResult.irregularityScore.toFixed(3)}`);
  console.log(`    - Trend direction: ${seasonalityResult.trendComponent.direction}`);
  
  // Detect weekly patterns
  const weeklyPatterns = analyzer.detectWeeklyPatterns(orderHistory);
  const peakDay = weeklyPatterns.reduce((max, day) => 
    day.averageOrders > max.averageOrders ? day : max
  );
  console.log(`    - Peak day: ${peakDay.dayName} (${peakDay.averageOrders.toFixed(1)} avg orders)`);
  
  // Analyze comeback seasons
  const comebackSeasons = analyzer.analyzeComebackSeasons(orderHistory);
  console.log(`    - Peak seasons: ${comebackSeasons.peakSeasons.join(', ')}`);
}

/**
 * Comeback prediction demonstration
 */
async function runComebackPredictionDemo(): Promise<void> {
  const predictor = createComebackPredictor();
  
  // Generate mock data for demonstration
  const mockInput: ComebackPredictionInput = {
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
      },
      {
        date: '2020-10-02',
        announcementDate: '2020-09-15',
        albumType: 'full',
        impactMetrics: {
          peakOrderIncrease: 3.2,
          impactDuration: 28,
          totalVolumeIncrease: 2800,
          categoryBreakdown: { 'albums': 0.8, 'photocards': 0.2 }
        }
      }
    ],
    marketIndicators: generateMockMarketIndicators(0.7),
    socialMediaSignals: generateMockSocialSignals(0.8)
  };
  
  const comebackPrediction = predictor.predictComeback(mockInput);
  
  console.log('  🎵 Comeback Prediction Results:');
  console.log(`    - Predicted date: ${comebackPrediction.predictedDate}`);
  console.log(`    - Confidence: ${(comebackPrediction.confidence * 100).toFixed(1)}%`);
  console.log(`    - Expected peak increase: ${(comebackPrediction.impactForecast.expectedPeakIncrease * 100).toFixed(1)}%`);
  console.log(`    - Expected duration: ${comebackPrediction.impactForecast.expectedDuration} days`);
  console.log(`    - Recommendations: ${comebackPrediction.preparationRecommendations.length} items`);
  
  // Estimate artist tier
  const artistTier = estimateArtistTier(mockInput.previousComebacks);
  console.log(`    - Estimated artist tier: ${artistTier}`);
}

/**
 * Model training demonstration
 */
async function runModelTrainingDemo(orderHistory: OrderHistoryData[]): Promise<void> {
  const trainer = createModelTrainer();
  const config = createDefaultTrainingConfig();
  
  // Modify config for demo (faster training)
  config.hyperparameters.epochs = 20;
  config.hyperparameters.batchSize = 16;
  config.callbacks.earlyStoppingPatience = 5;
  
  const preprocessor = createDataPreprocessor();
  const preprocessedData = await preprocessor.preprocessData(orderHistory);
  
  console.log('  🧠 Training neural network...');
  const trainingResult = await trainer.trainModel(preprocessedData, config);
  
  console.log('  📊 Training Results:');
  console.log(`    - Final loss: ${trainingResult.metrics.loss.toFixed(4)}`);
  console.log(`    - Mean Absolute Error: ${trainingResult.metrics.mae.toFixed(4)}`);
  console.log(`    - R² Score: ${trainingResult.metrics.r2Score.toFixed(4)}`);
  console.log(`    - Accuracy: ${(trainingResult.metrics.accuracy * 100).toFixed(1)}%`);
  console.log(`    - Best epoch: ${trainingResult.bestEpoch}`);
  console.log(`    - Training time: ${trainingResult.trainingTime}ms`);
  
  // Cleanup
  trainer.dispose();
}

/**
 * Comprehensive forecasting demonstration
 */
async function runComprehensiveForecastingDemo(orderHistory: OrderHistoryData[]): Promise<void> {
  const engine = createDemandForecastingEngine();
  
  // Train the model
  const trainingResult = await engine.trainModel(orderHistory);
  
  if (!trainingResult.success) {
    console.log('  ❌ Training failed, skipping forecast demo');
    return;
  }
  
  // Generate seasonal factors
  const analyzer = createSeasonalityAnalyzer();
  const seasonalFactors = analyzer.generateSeasonalFactors(orderHistory);
  
  // Create forecast input
  const forecastInput: DemandForecastingInput = {
    orderHistory,
    seasonalFactors,
    externalFactors: {
      comebackEvents: [
        {
          artist: 'BTS',
          comebackDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
  
  // Generate forecast
  const forecast = await engine.generateForecast(forecastInput);
  
  console.log('  🔮 Forecast Results:');
  console.log(`    - Forecast period: ${forecast.predictions.length} days`);
  console.log(`    - Average daily prediction: ${Math.round(forecast.predictions.reduce((a, b) => a + b, 0) / forecast.predictions.length)}`);
  console.log(`    - Max predicted demand: ${Math.max(...forecast.predictions)}`);
  console.log(`    - Min predicted demand: ${Math.min(...forecast.predictions)}`);
  console.log(`    - Average confidence: ${(forecast.confidence.reduce((a, b) => a + b, 0) / forecast.confidence.length * 100).toFixed(1)}%`);
  console.log(`    - Model accuracy: ${(forecast.accuracy * 100).toFixed(1)}%`);
  
  // Show first 7 days of predictions
  console.log('  📅 First 7 days forecast:');
  forecast.predictions.slice(0, 7).forEach((pred, i) => {
    console.log(`    Day ${i + 1}: ${pred} orders (${(forecast.confidence[i] * 100).toFixed(1)}% confidence)`);
  });
  
  // Cleanup
  engine.dispose();
}

/**
 * Advanced analytics demonstration
 */
async function runAdvancedAnalyticsDemo(orderHistory: OrderHistoryData[]): Promise<void> {
  const engine = createDemandForecastingEngine();
  
  // Train model first
  await engine.trainModel(orderHistory);
  
  // Generate advanced analytics
  const analytics = await engine.generateAdvancedAnalytics(orderHistory);
  
  console.log('  📊 Advanced Analytics Results:');
  console.log(`    - Price elasticity: ${analytics.demandElasticity.priceElasticity.toFixed(3)}`);
  console.log(`    - Elasticity confidence: ${(analytics.demandElasticity.elasticityConfidence * 100).toFixed(1)}%`);
  console.log(`    - Current optimal price: $${analytics.priceOptimization.optimalPrice.toFixed(2)}`);
  console.log(`    - Expected revenue change: ${(analytics.priceOptimization.expectedRevenueChange * 100).toFixed(1)}%`);
  console.log(`    - Inventory recommendations: ${analytics.inventoryRecommendations.length} items`);
  
  analytics.inventoryRecommendations.forEach(rec => {
    console.log(`      - ${rec.category}: ${rec.recommendedStock} units (${(rec.confidence * 100).toFixed(1)}% confidence)`);
  });
  
  // Cleanup
  engine.dispose();
}

/**
 * Real-time prediction demonstration
 */
async function runRealTimePredictionDemo(orderHistory: OrderHistoryData[]): Promise<void> {
  const engine = createDemandForecastingEngine();
  
  // Train model
  await engine.trainModel(orderHistory);
  
  // Simulate real-time prediction
  const currentData = orderHistory[orderHistory.length - 1];
  const recentHistory = orderHistory.slice(-30);
  
  const prediction = await engine.predictRealTime(currentData, recentHistory);
  
  console.log('  ⚡ Real-time Prediction Results:');
  console.log(`    - Predicted orders: ${prediction.prediction}`);
  console.log(`    - Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
  console.log('    - Contributing factors:');
  
  Object.entries(prediction.factors).forEach(([factor, value]) => {
    console.log(`      - ${factor}: ${typeof value === 'number' ? value.toFixed(3) : value}`);
  });
  
  // Cleanup
  engine.dispose();
}

/**
 * Model evaluation demonstration
 */
async function runModelEvaluationDemo(orderHistory: OrderHistoryData[]): Promise<void> {
  const engine = createDemandForecastingEngine();
  
  // Split data for evaluation
  const trainData = orderHistory.slice(0, Math.floor(orderHistory.length * 0.8));
  const testData = orderHistory.slice(Math.floor(orderHistory.length * 0.8));
  
  // Train on training data
  await engine.trainModel(trainData);
  
  // Evaluate on test data
  const evaluation = await evaluateModelPerformance(engine, testData);
  
  console.log('  📏 Model Evaluation Results:');
  console.log(`    - Mean Absolute Error: ${evaluation.mae.toFixed(4)}`);
  console.log(`    - Mean Squared Error: ${evaluation.mse.toFixed(4)}`);
  console.log(`    - R² Score: ${evaluation.r2Score.toFixed(4)}`);
  console.log(`    - Accuracy: ${(evaluation.accuracy * 100).toFixed(1)}%`);
  
  // Cleanup
  engine.dispose();
}

/**
 * Hyperparameter optimization demonstration
 */
async function runHyperparameterOptimizationDemo(orderHistory: OrderHistoryData[]): Promise<void> {
  console.log('  🔍 Running hyperparameter optimization (this may take a while)...');
  
  const optimizer = new HyperparameterOptimizer();
  const preprocessor = createDataPreprocessor();
  const preprocessedData = await preprocessor.preprocessData(orderHistory);
  
  // Define smaller parameter grid for demo
  const parameterGrid = {
    learningRate: [0.001, 0.01],
    batchSize: [16, 32],
    units: [[32, 16], [64, 32, 16]],
    dropout: [0.2, 0.3]
  };
  
  try {
    const optimizationResult = await optimizer.optimizeHyperparameters(
      preprocessedData,
      parameterGrid
    );
    
    console.log('  🎯 Optimization Results:');
    console.log(`    - Best score: ${optimizationResult.bestScore.toFixed(4)}`);
    console.log(`    - Best learning rate: ${optimizationResult.bestConfig.hyperparameters.learningRate}`);
    console.log(`    - Best batch size: ${optimizationResult.bestConfig.hyperparameters.batchSize}`);
    console.log(`    - Best units: [${optimizationResult.bestConfig.hyperparameters.units.join(', ')}]`);
    console.log(`    - Best dropout: ${optimizationResult.bestConfig.hyperparameters.dropout}`);
    console.log(`    - Total combinations tested: ${optimizationResult.allResults.length}`);
    
  } catch (error) {
    console.log('  ⚠️ Optimization failed:', error.message);
  }
}

/**
 * Performance benchmarking
 */
export async function benchmarkMLPerformance(): Promise<void> {
  console.log('⚡ GOMFLOW ML Performance Benchmark');
  console.log('===================================');
  
  const dataSizes = [30, 60, 120, 240]; // Different data sizes
  
  for (const size of dataSizes) {
    console.log(`\n📊 Testing with ${size} days of data...`);
    
    const orderHistory = generateSampleOrderHistory(size);
    const engine = createDemandForecastingEngine();
    
    // Measure training time
    const trainStart = performance.now();
    const trainingResult = await engine.trainModel(orderHistory);
    const trainTime = performance.now() - trainStart;
    
    if (trainingResult.success) {
      // Measure prediction time
      const predStart = performance.now();
      const currentData = orderHistory[orderHistory.length - 1];
      const recentHistory = orderHistory.slice(-30);
      await engine.predictRealTime(currentData, recentHistory);
      const predTime = performance.now() - predStart;
      
      console.log(`  ⏱️  Training time: ${trainTime.toFixed(2)}ms`);
      console.log(`  ⚡ Prediction time: ${predTime.toFixed(2)}ms`);
      console.log(`  📈 Model accuracy: ${(trainingResult.metrics.accuracy * 100).toFixed(1)}%`);
    } else {
      console.log(`  ❌ Training failed for ${size} days`);
    }
    
    engine.dispose();
  }
}

/**
 * Integration example with existing GOMFLOW API
 */
export async function integrateWithGOMFLOWAPI(): Promise<void> {
  console.log('🔗 GOMFLOW API Integration Example');
  console.log('==================================');
  
  try {
    // This would typically fetch real data from the API
    const mockAPIResponse = {
      orders: [
        { id: 1, created_at: '2024-01-15', price: 25, country: 'Philippines' },
        { id: 2, created_at: '2024-01-16', price: 30, country: 'Malaysia' },
        // ... more orders
      ],
      submissions: [
        { id: 1, created_at: '2024-01-15', quantity: 2, price: 25, payment_status: 'confirmed' },
        { id: 2, created_at: '2024-01-16', quantity: 1, price: 30, payment_status: 'pending' },
        // ... more submissions
      ]
    };
    
    // Convert API data to ML format
    const orderHistory = convertAPIDataToMLFormat(mockAPIResponse);
    
    // Create and train ML engine
    const engine = createDemandForecastingEngine();
    const result = await engine.trainModel(orderHistory);
    
    if (result.success) {
      // Generate business insights
      const analytics = await engine.generateAdvancedAnalytics(orderHistory);
      
      console.log('🎯 Business Insights Generated:');
      console.log(`  - Optimal pricing strategy: $${analytics.priceOptimization.optimalPrice.toFixed(2)}`);
      console.log(`  - Inventory recommendations: ${analytics.inventoryRecommendations.length} items`);
      console.log(`  - Price elasticity: ${analytics.demandElasticity.priceElasticity.toFixed(3)}`);
      
      // This would typically be sent back to the API
      const businessInsights = {
        optimalPrice: analytics.priceOptimization.optimalPrice,
        inventoryRecommendations: analytics.inventoryRecommendations,
        priceElasticity: analytics.demandElasticity.priceElasticity,
        modelAccuracy: result.metrics.accuracy
      };
      
      console.log('📤 Insights ready for API integration');
    }
    
    engine.dispose();
    
  } catch (error) {
    console.error('❌ Integration failed:', error);
  }
}

/**
 * Helper function to convert API data to ML format
 */
function convertAPIDataToMLFormat(apiData: any): OrderHistoryData[] {
  // This is a simplified conversion - in production, this would be more comprehensive
  const orderHistory: OrderHistoryData[] = [];
  
  // Group by date and aggregate
  const dateGroups = new Map<string, any>();
  
  apiData.orders.forEach((order: any) => {
    const date = order.created_at.split('T')[0];
    if (!dateGroups.has(date)) {
      dateGroups.set(date, { orders: [], submissions: [] });
    }
    dateGroups.get(date)!.orders.push(order);
  });
  
  apiData.submissions.forEach((submission: any) => {
    const date = submission.created_at.split('T')[0];
    if (!dateGroups.has(date)) {
      dateGroups.set(date, { orders: [], submissions: [] });
    }
    dateGroups.get(date)!.submissions.push(submission);
  });
  
  // Convert to ML format
  dateGroups.forEach((data, date) => {
    const orderDate = new Date(date);
    const revenue = data.submissions
      .filter((s: any) => s.payment_status === 'confirmed')
      .reduce((sum: number, s: any) => sum + (s.quantity * s.price), 0);
    
    const avgPrice = data.orders.length > 0 ? 
      data.orders.reduce((sum: number, o: any) => sum + o.price, 0) / data.orders.length : 0;
    
    orderHistory.push({
      date,
      orderCount: data.orders.length,
      submissionCount: data.submissions.length,
      revenue,
      avgPrice,
      category: 'general',
      geoLocation: data.orders[0]?.country || 'Unknown',
      weekday: orderDate.getDay(),
      month: orderDate.getMonth(),
      isHoliday: false
    });
  });
  
  return orderHistory.sort((a, b) => a.date.localeCompare(b.date));
}

// Export demo functions
export {
  runDataPreprocessingDemo,
  runSeasonalityAnalysisDemo,
  runComebackPredictionDemo,
  runModelTrainingDemo,
  runComprehensiveForecastingDemo,
  runAdvancedAnalyticsDemo,
  runRealTimePredictionDemo,
  runModelEvaluationDemo,
  runHyperparameterOptimizationDemo
};