import * as tf from '@tensorflow/tfjs';
import * as ss from 'simple-statistics';
import { 
  PreprocessingConfig, 
  PreprocessedData, 
  OrderHistoryData, 
  ScalingParams, 
  DataMetadata,
  FeatureEngineeringConfig,
  RollingWindowFeature 
} from './types';

/**
 * Comprehensive data preprocessing utilities for K-pop merchandise demand forecasting
 */
export class DataPreprocessor {
  private config: PreprocessingConfig;

  constructor(config: PreprocessingConfig) {
    this.config = config;
  }

  /**
   * Main preprocessing pipeline
   */
  async preprocessData(rawData: OrderHistoryData[]): Promise<PreprocessedData> {
    try {
      // 1. Data cleaning and validation
      const cleanedData = this.cleanData(rawData);
      
      // 2. Handle missing values
      const imputedData = this.handleMissingValues(cleanedData);
      
      // 3. Detect and handle outliers
      const outlierFreeData = this.handleOutliers(imputedData);
      
      // 4. Feature engineering
      const engineeredData = this.engineerFeatures(outlierFreeData);
      
      // 5. Create sequences for time series prediction
      const sequences = this.createSequences(engineeredData);
      
      // 6. Normalize features
      const normalizedData = this.normalizeFeatures(sequences);
      
      // 7. Split into features and targets
      const { features, targets } = this.splitFeaturesTargets(normalizedData);
      
      // 8. Generate metadata
      const metadata = this.generateMetadata(rawData, features);
      
      return {
        features,
        targets,
        featureNames: this.getFeatureNames(),
        scalingParams: normalizedData.scalingParams,
        metadata
      };
    } catch (error) {
      throw new Error(`Data preprocessing failed: ${error.message}`);
    }
  }

  /**
   * Clean and validate raw data
   */
  private cleanData(data: OrderHistoryData[]): OrderHistoryData[] {
    return data.filter(item => {
      // Remove invalid entries
      if (!item.date || !item.orderCount || item.orderCount < 0) {
        return false;
      }
      
      // Validate date format
      if (isNaN(Date.parse(item.date))) {
        return false;
      }
      
      // Validate numeric fields
      if (isNaN(item.revenue) || isNaN(item.avgPrice) || isNaN(item.submissionCount)) {
        return false;
      }
      
      return true;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Handle missing values using various strategies
   */
  private handleMissingValues(data: OrderHistoryData[]): OrderHistoryData[] {
    const result = [...data];
    
    for (let i = 0; i < result.length; i++) {
      const item = result[i];
      
      // Handle missing revenue
      if (isNaN(item.revenue) || item.revenue === null || item.revenue === undefined) {
        item.revenue = this.imputeValue(result, i, 'revenue');
      }
      
      // Handle missing avgPrice
      if (isNaN(item.avgPrice) || item.avgPrice === null || item.avgPrice === undefined) {
        item.avgPrice = this.imputeValue(result, i, 'avgPrice');
      }
      
      // Handle missing submissionCount
      if (isNaN(item.submissionCount) || item.submissionCount === null || item.submissionCount === undefined) {
        item.submissionCount = this.imputeValue(result, i, 'submissionCount');
      }
    }
    
    return result;
  }

  /**
   * Impute missing values based on strategy
   */
  private imputeValue(data: OrderHistoryData[], index: number, field: keyof OrderHistoryData): number {
    const { missingValueStrategy } = this.config;
    
    switch (missingValueStrategy) {
      case 'forward_fill':
        return this.forwardFill(data, index, field);
      case 'backward_fill':
        return this.backwardFill(data, index, field);
      case 'interpolate':
        return this.interpolate(data, index, field);
      case 'mean':
        return this.meanImputation(data, field);
      default:
        return 0;
    }
  }

  /**
   * Forward fill missing values
   */
  private forwardFill(data: OrderHistoryData[], index: number, field: keyof OrderHistoryData): number {
    for (let i = index - 1; i >= 0; i--) {
      const value = data[i][field] as number;
      if (!isNaN(value) && value !== null && value !== undefined) {
        return value;
      }
    }
    return 0;
  }

  /**
   * Backward fill missing values
   */
  private backwardFill(data: OrderHistoryData[], index: number, field: keyof OrderHistoryData): number {
    for (let i = index + 1; i < data.length; i++) {
      const value = data[i][field] as number;
      if (!isNaN(value) && value !== null && value !== undefined) {
        return value;
      }
    }
    return 0;
  }

  /**
   * Linear interpolation for missing values
   */
  private interpolate(data: OrderHistoryData[], index: number, field: keyof OrderHistoryData): number {
    let leftValue = 0;
    let rightValue = 0;
    let leftIndex = -1;
    let rightIndex = -1;
    
    // Find valid values on both sides
    for (let i = index - 1; i >= 0; i--) {
      const value = data[i][field] as number;
      if (!isNaN(value) && value !== null && value !== undefined) {
        leftValue = value;
        leftIndex = i;
        break;
      }
    }
    
    for (let i = index + 1; i < data.length; i++) {
      const value = data[i][field] as number;
      if (!isNaN(value) && value !== null && value !== undefined) {
        rightValue = value;
        rightIndex = i;
        break;
      }
    }
    
    if (leftIndex === -1 && rightIndex === -1) {
      return 0;
    }
    
    if (leftIndex === -1) {
      return rightValue;
    }
    
    if (rightIndex === -1) {
      return leftValue;
    }
    
    // Linear interpolation
    const ratio = (index - leftIndex) / (rightIndex - leftIndex);
    return leftValue + ratio * (rightValue - leftValue);
  }

  /**
   * Mean imputation for missing values
   */
  private meanImputation(data: OrderHistoryData[], field: keyof OrderHistoryData): number {
    const validValues = data
      .map(item => item[field] as number)
      .filter(value => !isNaN(value) && value !== null && value !== undefined);
    
    return validValues.length > 0 ? ss.mean(validValues) : 0;
  }

  /**
   * Detect and handle outliers using IQR method
   */
  private handleOutliers(data: OrderHistoryData[]): OrderHistoryData[] {
    const result = [...data];
    const numericFields: (keyof OrderHistoryData)[] = ['orderCount', 'submissionCount', 'revenue', 'avgPrice'];
    
    for (const field of numericFields) {
      const values = result.map(item => item[field] as number);
      const q1 = ss.quantile(values, 0.25);
      const q3 = ss.quantile(values, 0.75);
      const iqr = q3 - q1;
      const lowerBound = q1 - this.config.outlierThreshold * iqr;
      const upperBound = q3 + this.config.outlierThreshold * iqr;
      
      for (let i = 0; i < result.length; i++) {
        const value = result[i][field] as number;
        if (value < lowerBound || value > upperBound) {
          // Cap outliers to bounds
          if (value < lowerBound) {
            (result[i][field] as number) = lowerBound;
          } else {
            (result[i][field] as number) = upperBound;
          }
        }
      }
    }
    
    return result;
  }

  /**
   * Engineer features for better prediction
   */
  private engineerFeatures(data: OrderHistoryData[]): any[] {
    const engineeredData = data.map(item => {
      const date = new Date(item.date);
      const features: any = { ...item };
      
      // Temporal features
      features.dayOfWeek = date.getDay();
      features.dayOfMonth = date.getDate();
      features.dayOfYear = this.getDayOfYear(date);
      features.weekOfYear = this.getWeekOfYear(date);
      features.month = date.getMonth();
      features.quarter = Math.floor(date.getMonth() / 3);
      features.year = date.getFullYear();
      
      // Cyclical encoding for temporal features
      features.dayOfWeek_sin = Math.sin(2 * Math.PI * features.dayOfWeek / 7);
      features.dayOfWeek_cos = Math.cos(2 * Math.PI * features.dayOfWeek / 7);
      features.month_sin = Math.sin(2 * Math.PI * features.month / 12);
      features.month_cos = Math.cos(2 * Math.PI * features.month / 12);
      features.dayOfYear_sin = Math.sin(2 * Math.PI * features.dayOfYear / 365);
      features.dayOfYear_cos = Math.cos(2 * Math.PI * features.dayOfYear / 365);
      
      // Business metrics
      features.conversionRate = item.submissionCount > 0 ? item.orderCount / item.submissionCount : 0;
      features.revenuePerOrder = item.orderCount > 0 ? item.revenue / item.orderCount : 0;
      features.avgOrderValue = item.orderCount > 0 ? item.revenue / item.orderCount : 0;
      
      return features;
    });

    // Add lag features
    if (this.config.featureEngineering.lagFeatures) {
      this.addLagFeatures(engineeredData, this.config.featureEngineering.lagFeatures);
    }

    // Add rolling window features
    if (this.config.featureEngineering.rollingWindowFeatures) {
      this.addRollingWindowFeatures(engineeredData, this.config.featureEngineering.rollingWindowFeatures);
    }

    return engineeredData;
  }

  /**
   * Add lag features for time series analysis
   */
  private addLagFeatures(data: any[], lags: number[]): void {
    const targetFields = ['orderCount', 'submissionCount', 'revenue', 'avgPrice'];
    
    for (const lag of lags) {
      for (const field of targetFields) {
        for (let i = 0; i < data.length; i++) {
          const lagIndex = i - lag;
          if (lagIndex >= 0) {
            data[i][`${field}_lag${lag}`] = data[lagIndex][field];
          } else {
            data[i][`${field}_lag${lag}`] = 0;
          }
        }
      }
    }
  }

  /**
   * Add rolling window features for trend analysis
   */
  private addRollingWindowFeatures(data: any[], features: RollingWindowFeature[]): void {
    const targetFields = ['orderCount', 'submissionCount', 'revenue', 'avgPrice'];
    
    for (const feature of features) {
      for (const field of targetFields) {
        for (let i = 0; i < data.length; i++) {
          const windowData = [];
          for (let j = Math.max(0, i - feature.window + 1); j <= i; j++) {
            windowData.push(data[j][field]);
          }
          
          const featureName = `${field}_${feature.name}_${feature.window}`;
          switch (feature.aggregation) {
            case 'mean':
              data[i][featureName] = ss.mean(windowData);
              break;
            case 'sum':
              data[i][featureName] = ss.sum(windowData);
              break;
            case 'min':
              data[i][featureName] = ss.min(windowData);
              break;
            case 'max':
              data[i][featureName] = ss.max(windowData);
              break;
            case 'std':
              data[i][featureName] = ss.standardDeviation(windowData);
              break;
            default:
              data[i][featureName] = ss.mean(windowData);
          }
        }
      }
    }
  }

  /**
   * Create sequences for time series prediction
   */
  private createSequences(data: any[]): any[] {
    const sequenceLength = 30; // Use 30 days of history
    const sequences = [];
    
    for (let i = sequenceLength; i < data.length; i++) {
      const sequence = {
        ...data[i],
        history: data.slice(i - sequenceLength, i)
      };
      sequences.push(sequence);
    }
    
    return sequences;
  }

  /**
   * Normalize features using specified method
   */
  private normalizeFeatures(data: any[]): { normalizedData: any[], scalingParams: ScalingParams } {
    const numericFields = this.getNumericFields(data[0]);
    const scalingParams: ScalingParams = {
      featureMeans: [],
      featureStds: [],
      featureMins: [],
      featureMaxs: [],
      targetMean: 0,
      targetStd: 1
    };
    
    const normalizedData = data.map(item => ({ ...item }));
    
    for (const field of numericFields) {
      const values = data.map(item => item[field]).filter(v => !isNaN(v) && v !== null && v !== undefined);
      
      if (values.length === 0) continue;
      
      const mean = ss.mean(values);
      const std = ss.standardDeviation(values);
      const min = ss.min(values);
      const max = ss.max(values);
      
      scalingParams.featureMeans.push(mean);
      scalingParams.featureStds.push(std);
      scalingParams.featureMins.push(min);
      scalingParams.featureMaxs.push(max);
      
      for (let i = 0; i < normalizedData.length; i++) {
        const value = normalizedData[i][field];
        if (!isNaN(value) && value !== null && value !== undefined) {
          switch (this.config.normalizationMethod) {
            case 'zscore':
              normalizedData[i][field] = std > 0 ? (value - mean) / std : 0;
              break;
            case 'minmax':
              normalizedData[i][field] = max > min ? (value - min) / (max - min) : 0;
              break;
            case 'robust':
              const q1 = ss.quantile(values, 0.25);
              const q3 = ss.quantile(values, 0.75);
              const iqr = q3 - q1;
              normalizedData[i][field] = iqr > 0 ? (value - ss.median(values)) / iqr : 0;
              break;
            default:
              normalizedData[i][field] = value;
          }
        }
      }
    }
    
    return { normalizedData, scalingParams };
  }

  /**
   * Split data into features and targets
   */
  private splitFeaturesTargets(data: { normalizedData: any[], scalingParams: ScalingParams }): { features: number[][], targets: number[][] } {
    const features: number[][] = [];
    const targets: number[][] = [];
    const featureFields = this.getFeatureFields();
    
    for (const item of data.normalizedData) {
      const featureVector = featureFields.map(field => {
        const value = item[field];
        return isNaN(value) ? 0 : value;
      });
      
      features.push(featureVector);
      targets.push([item.orderCount || 0]); // Predict order count
    }
    
    return { features, targets };
  }

  /**
   * Get numeric fields from data
   */
  private getNumericFields(sample: any): string[] {
    const fields = [];
    for (const [key, value] of Object.entries(sample)) {
      if (typeof value === 'number' && !isNaN(value)) {
        fields.push(key);
      }
    }
    return fields;
  }

  /**
   * Get feature fields for model input
   */
  private getFeatureFields(): string[] {
    return [
      'submissionCount', 'revenue', 'avgPrice', 'weekday', 'month',
      'dayOfWeek_sin', 'dayOfWeek_cos', 'month_sin', 'month_cos',
      'dayOfYear_sin', 'dayOfYear_cos', 'conversionRate', 'revenuePerOrder',
      'avgOrderValue', 'quarter', 'dayOfMonth', 'weekOfYear'
    ];
  }

  /**
   * Get feature names for model interpretation
   */
  private getFeatureNames(): string[] {
    return this.getFeatureFields();
  }

  /**
   * Generate metadata about the preprocessing
   */
  private generateMetadata(originalData: OrderHistoryData[], processedFeatures: number[][]): DataMetadata {
    const dates = originalData.map(item => new Date(item.date));
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    return {
      originalSize: originalData.length,
      processedSize: processedFeatures.length,
      featureCount: processedFeatures[0]?.length || 0,
      outlierCount: 0, // Would be calculated during outlier detection
      missingValueCount: 0, // Would be calculated during missing value handling
      dateRange: {
        start: minDate.toISOString().split('T')[0],
        end: maxDate.toISOString().split('T')[0]
      }
    };
  }

  /**
   * Utility function to get day of year
   */
  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Utility function to get week of year
   */
  private getWeekOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 7));
  }

  /**
   * Smooth data using moving average
   */
  public smoothData(data: number[], window: number = 7): number[] {
    const smoothed = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(data.length, i + Math.ceil(window / 2));
      const slice = data.slice(start, end);
      smoothed.push(ss.mean(slice));
    }
    return smoothed;
  }

  /**
   * Inverse transform normalized data
   */
  public inverseTransform(normalizedValue: number, fieldIndex: number): number {
    const { featureMeans, featureStds, featureMins, featureMaxs } = this.scalingParams;
    
    switch (this.config.normalizationMethod) {
      case 'zscore':
        return normalizedValue * featureStds[fieldIndex] + featureMeans[fieldIndex];
      case 'minmax':
        return normalizedValue * (featureMaxs[fieldIndex] - featureMins[fieldIndex]) + featureMins[fieldIndex];
      case 'robust':
        // Simplified inverse for robust scaling
        return normalizedValue * featureStds[fieldIndex] + featureMeans[fieldIndex];
      default:
        return normalizedValue;
    }
  }

  private scalingParams: ScalingParams = {
    featureMeans: [],
    featureStds: [],
    featureMins: [],
    featureMaxs: [],
    targetMean: 0,
    targetStd: 1
  };
}

/**
 * Factory function to create preprocessor with default config
 */
export function createDataPreprocessor(customConfig?: Partial<PreprocessingConfig>): DataPreprocessor {
  const defaultConfig: PreprocessingConfig = {
    normalizationMethod: 'zscore',
    smoothingWindow: 7,
    outlierThreshold: 1.5,
    missingValueStrategy: 'interpolate',
    featureEngineering: {
      lagFeatures: [1, 3, 7, 14],
      rollingWindowFeatures: [
        { window: 7, aggregation: 'mean', name: 'rolling_mean' },
        { window: 14, aggregation: 'mean', name: 'rolling_mean' },
        { window: 30, aggregation: 'mean', name: 'rolling_mean' },
        { window: 7, aggregation: 'std', name: 'rolling_std' }
      ],
      seasonalFeatures: true,
      holidayFeatures: true,
      trendFeatures: true
    }
  };

  return new DataPreprocessor({ ...defaultConfig, ...customConfig });
}

/**
 * Utility function to validate data quality
 */
export function validateDataQuality(data: OrderHistoryData[]): {
  isValid: boolean;
  issues: string[];
  statistics: any;
} {
  const issues: string[] = [];
  
  if (data.length < 30) {
    issues.push('Insufficient data points (minimum 30 required)');
  }
  
  const missingDates = data.filter(item => !item.date || isNaN(Date.parse(item.date)));
  if (missingDates.length > 0) {
    issues.push(`${missingDates.length} entries with invalid dates`);
  }
  
  const missingValues = data.filter(item => 
    isNaN(item.orderCount) || isNaN(item.submissionCount) || isNaN(item.revenue)
  );
  if (missingValues.length > data.length * 0.1) {
    issues.push(`High missing value rate: ${(missingValues.length / data.length * 100).toFixed(1)}%`);
  }
  
  const orderCounts = data.map(item => item.orderCount).filter(v => !isNaN(v));
  const revenues = data.map(item => item.revenue).filter(v => !isNaN(v));
  
  const statistics = {
    totalEntries: data.length,
    dateRange: {
      start: Math.min(...data.map(item => new Date(item.date).getTime())),
      end: Math.max(...data.map(item => new Date(item.date).getTime()))
    },
    orderStats: {
      mean: ss.mean(orderCounts),
      median: ss.median(orderCounts),
      std: ss.standardDeviation(orderCounts),
      min: ss.min(orderCounts),
      max: ss.max(orderCounts)
    },
    revenueStats: {
      mean: ss.mean(revenues),
      median: ss.median(revenues),
      std: ss.standardDeviation(revenues),
      min: ss.min(revenues),
      max: ss.max(revenues)
    }
  };
  
  return {
    isValid: issues.length === 0,
    issues,
    statistics
  };
}