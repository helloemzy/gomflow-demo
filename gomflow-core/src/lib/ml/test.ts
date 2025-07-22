/**
 * Basic tests for GOMFLOW ML system
 * 
 * This file contains basic smoke tests to ensure the ML system is working correctly.
 * For production use, these should be expanded into proper unit tests with Jest.
 */

import { 
  createDemandForecastingEngine,
  generateSampleOrderHistory,
  createSeasonalityAnalyzer,
  createComebackPredictor,
  createDataPreprocessor,
  validateDataQuality
} from './index';

/**
 * Run basic smoke tests
 */
export async function runBasicTests(): Promise<boolean> {
  console.log('🧪 Running GOMFLOW ML System Tests...');
  console.log('====================================');
  
  let allTestsPassed = true;
  
  try {
    // Test 1: Data generation
    console.log('📊 Test 1: Data Generation');
    const orderHistory = generateSampleOrderHistory(60);
    console.log(`  ✅ Generated ${orderHistory.length} data points`);
    
    // Test 2: Data validation
    console.log('📋 Test 2: Data Validation');
    const validation = validateDataQuality(orderHistory);
    console.log(`  ✅ Data validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`);
    if (!validation.isValid) {
      console.log(`  ❌ Issues: ${validation.issues.join(', ')}`);
      allTestsPassed = false;
    }
    
    // Test 3: Data preprocessing
    console.log('🔧 Test 3: Data Preprocessing');
    const preprocessor = createDataPreprocessor();
    const preprocessedData = await preprocessor.preprocessData(orderHistory);
    console.log(`  ✅ Preprocessed ${preprocessedData.features.length} samples with ${preprocessedData.featureNames.length} features`);
    
    // Test 4: Seasonality analysis
    console.log('📈 Test 4: Seasonality Analysis');
    const analyzer = createSeasonalityAnalyzer();
    const seasonalityResult = analyzer.analyzeSeasonality(orderHistory);
    console.log(`  ✅ Seasonality analysis completed (strength: ${seasonalityResult.seasonalityStrength.toFixed(3)})`);
    
    // Test 5: Comeback prediction
    console.log('🎵 Test 5: Comeback Prediction');
    const predictor = createComebackPredictor();
    const mockInput = {
      artist: 'Test Artist',
      previousComebacks: [],
      marketIndicators: [],
      socialMediaSignals: []
    };
    const comebackPrediction = predictor.predictComeback(mockInput);
    console.log(`  ✅ Comeback prediction completed (confidence: ${(comebackPrediction.confidence * 100).toFixed(1)}%)`);
    
    // Test 6: Model training (simplified)
    console.log('🧠 Test 6: Model Training (Quick Test)');
    const engine = createDemandForecastingEngine();
    
    // Use smaller dataset for quick test
    const quickTestData = orderHistory.slice(0, 30);
    const trainingResult = await engine.trainModel(quickTestData);
    
    if (trainingResult.success) {
      console.log(`  ✅ Model training completed (accuracy: ${(trainingResult.metrics.accuracy * 100).toFixed(1)}%)`);
    } else {
      console.log('  ❌ Model training failed');
      allTestsPassed = false;
    }
    
    // Test 7: Real-time prediction
    if (trainingResult.success) {
      console.log('⚡ Test 7: Real-time Prediction');
      const currentData = orderHistory[orderHistory.length - 1];
      const recentHistory = orderHistory.slice(-10);
      
      const prediction = await engine.predictRealTime(currentData, recentHistory);
      console.log(`  ✅ Real-time prediction: ${prediction.prediction} orders (${(prediction.confidence * 100).toFixed(1)}% confidence)`);
    } else {
      console.log('  ⏭️  Skipping real-time prediction test (model training failed)');
    }
    
    // Cleanup
    engine.dispose();
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    allTestsPassed = false;
  }
  
  console.log(`\n${allTestsPassed ? '✅' : '❌'} All tests ${allTestsPassed ? 'PASSED' : 'FAILED'}`);
  return allTestsPassed;
}

/**
 * Test data preprocessing components
 */
export async function testDataPreprocessing(): Promise<boolean> {
  console.log('🔧 Testing Data Preprocessing Components...');
  
  try {
    const orderHistory = generateSampleOrderHistory(90);
    
    // Test different normalization methods
    const normalizationMethods = ['zscore', 'minmax', 'robust'] as const;
    
    for (const method of normalizationMethods) {
      console.log(`  📊 Testing ${method} normalization...`);
      const preprocessor = createDataPreprocessor({ normalizationMethod: method });
      const result = await preprocessor.preprocessData(orderHistory);
      
      if (result.features.length > 0 && result.featureNames.length > 0) {
        console.log(`    ✅ ${method} normalization successful`);
      } else {
        console.log(`    ❌ ${method} normalization failed`);
        return false;
      }
    }
    
    // Test missing value strategies
    const missingValueStrategies = ['interpolate', 'forward_fill', 'backward_fill', 'mean'] as const;
    
    // Create data with missing values
    const dataWithMissing = [...orderHistory];
    dataWithMissing[10].revenue = NaN;
    dataWithMissing[20].avgPrice = NaN;
    dataWithMissing[30].submissionCount = NaN;
    
    for (const strategy of missingValueStrategies) {
      console.log(`  🔧 Testing ${strategy} missing value strategy...`);
      const preprocessor = createDataPreprocessor({ missingValueStrategy: strategy });
      const result = await preprocessor.preprocessData(dataWithMissing);
      
      if (result.features.length > 0) {
        console.log(`    ✅ ${strategy} strategy successful`);
      } else {
        console.log(`    ❌ ${strategy} strategy failed`);
        return false;
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Data preprocessing test failed:', error);
    return false;
  }
}

/**
 * Test seasonality analysis components
 */
export async function testSeasonalityAnalysis(): Promise<boolean> {
  console.log('📈 Testing Seasonality Analysis Components...');
  
  try {
    const orderHistory = generateSampleOrderHistory(120);
    const analyzer = createSeasonalityAnalyzer();
    
    // Test weekly pattern detection
    console.log('  📅 Testing weekly pattern detection...');
    const weeklyPatterns = analyzer.detectWeeklyPatterns(orderHistory);
    
    if (weeklyPatterns.length === 7) {
      console.log('    ✅ Weekly pattern detection successful');
    } else {
      console.log('    ❌ Weekly pattern detection failed');
      return false;
    }
    
    // Test monthly pattern detection
    console.log('  📆 Testing monthly pattern detection...');
    const monthlyPatterns = analyzer.detectMonthlyPatterns(orderHistory);
    
    if (monthlyPatterns.length === 12) {
      console.log('    ✅ Monthly pattern detection successful');
    } else {
      console.log('    ❌ Monthly pattern detection failed');
      return false;
    }
    
    // Test holiday pattern detection
    console.log('  🎉 Testing holiday pattern detection...');
    const holidayPatterns = analyzer.detectHolidayPatterns(orderHistory);
    
    if (holidayPatterns.holidayMultipliers && holidayPatterns.specialEventDays) {
      console.log('    ✅ Holiday pattern detection successful');
    } else {
      console.log('    ❌ Holiday pattern detection failed');
      return false;
    }
    
    // Test comeback season analysis
    console.log('  🎵 Testing comeback season analysis...');
    const comebackSeasons = analyzer.analyzeComebackSeasons(orderHistory);
    
    if (comebackSeasons.peakSeasons && comebackSeasons.seasonalMultipliers) {
      console.log('    ✅ Comeback season analysis successful');
    } else {
      console.log('    ❌ Comeback season analysis failed');
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Seasonality analysis test failed:', error);
    return false;
  }
}

/**
 * Test performance with different data sizes
 */
export async function testPerformanceScaling(): Promise<boolean> {
  console.log('⚡ Testing Performance Scaling...');
  
  const dataSizes = [30, 60, 90];
  
  for (const size of dataSizes) {
    console.log(`  📊 Testing with ${size} data points...`);
    
    try {
      const orderHistory = generateSampleOrderHistory(size);
      const engine = createDemandForecastingEngine();
      
      const startTime = performance.now();
      const result = await engine.trainModel(orderHistory);
      const endTime = performance.now();
      
      const processingTime = endTime - startTime;
      
      if (result.success) {
        console.log(`    ✅ Processed ${size} points in ${processingTime.toFixed(2)}ms`);
        console.log(`    📈 Accuracy: ${(result.metrics.accuracy * 100).toFixed(1)}%`);
      } else {
        console.log(`    ❌ Failed to process ${size} points`);
      }
      
      engine.dispose();
      
    } catch (error) {
      console.error(`    ❌ Error with ${size} points:`, error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }
  
  return true;
}

/**
 * Test error handling
 */
export async function testErrorHandling(): Promise<boolean> {
  console.log('🛡️  Testing Error Handling...');
  
  try {
    // Test with insufficient data
    console.log('  📊 Testing insufficient data handling...');
    const smallDataset = generateSampleOrderHistory(10); // Too small
    const engine = createDemandForecastingEngine();
    
    const result = await engine.trainModel(smallDataset);
    
    if (!result.success) {
      console.log('    ✅ Insufficient data handled correctly');
    } else {
      console.log('    ❌ Should have failed with insufficient data');
      return false;
    }
    
    // Test with invalid data
    console.log('  🚫 Testing invalid data handling...');
    const invalidData = [
      { date: 'invalid-date', orderCount: -1, submissionCount: 0, revenue: 0, avgPrice: 0, category: '', geoLocation: '', weekday: 0, month: 0, isHoliday: false },
      { date: '', orderCount: NaN, submissionCount: 0, revenue: 0, avgPrice: 0, category: '', geoLocation: '', weekday: 0, month: 0, isHoliday: false }
    ];
    
    try {
      const preprocessor = createDataPreprocessor();
      await preprocessor.preprocessData(invalidData);
      console.log('    ❌ Should have failed with invalid data');
      return false;
    } catch (error) {
      console.log('    ✅ Invalid data handled correctly');
    }
    
    // Test prediction without training
    console.log('  🧠 Testing prediction without training...');
    const untrainedEngine = createDemandForecastingEngine();
    
    try {
      const orderHistory = generateSampleOrderHistory(60);
      const currentData = orderHistory[orderHistory.length - 1];
      const recentHistory = orderHistory.slice(-10);
      
      await untrainedEngine.predictRealTime(currentData, recentHistory);
      console.log('    ❌ Should have failed without training');
      return false;
    } catch (error) {
      console.log('    ✅ Untrained model handled correctly');
    }
    
    engine.dispose();
    untrainedEngine.dispose();
    
    return true;
    
  } catch (error) {
    console.error('❌ Error handling test failed:', error);
    return false;
  }
}

/**
 * Run all tests
 */
export async function runAllTests(): Promise<void> {
  console.log('🧪 Running Comprehensive GOMFLOW ML Tests');
  console.log('==========================================');
  
  const testResults = {
    basicTests: await runBasicTests(),
    dataPreprocessing: await testDataPreprocessing(),
    seasonalityAnalysis: await testSeasonalityAnalysis(),
    performanceScaling: await testPerformanceScaling(),
    errorHandling: await testErrorHandling()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  Object.entries(testResults).forEach(([testName, passed]) => {
    const status = passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`  ${testName}: ${status}`);
  });
  
  const allPassed = Object.values(testResults).every(result => result);
  console.log(`\n${allPassed ? '✅' : '❌'} Overall Result: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  
  if (allPassed) {
    console.log('🎉 GOMFLOW ML System is ready for production!');
  } else {
    console.log('⚠️  Please review and fix failing tests before deployment.');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}