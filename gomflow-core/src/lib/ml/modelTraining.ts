import * as tf from '@tensorflow/tfjs';
import { 
  TrainingConfig, 
  TrainingResult, 
  ValidationResult, 
  ModelMetrics, 
  HyperParameters, 
  ValidationConfig, 
  CallbackConfig,
  PreprocessedData,
  TrainingData
} from './types';

/**
 * Comprehensive model training system for demand forecasting
 * Supports multiple architectures with advanced training techniques
 */
export class ModelTrainer {
  private model: tf.LayersModel | null = null;
  private trainingHistory: tf.History | null = null;
  private bestModel: tf.LayersModel | null = null;
  private bestMetrics: ModelMetrics | null = null;

  constructor() {}

  /**
   * Train a demand forecasting model with specified configuration
   */
  public async trainModel(
    preprocessedData: PreprocessedData,
    config: TrainingConfig
  ): Promise<TrainingResult> {
    console.log('🚀 Starting model training...');
    const startTime = Date.now();

    try {
      // Create model architecture
      this.model = this.createModelArchitecture(config);
      
      // Prepare training data
      const { trainData, validationData } = this.prepareTrainingData(preprocessedData, config.validation);
      
      // Setup callbacks
      const callbacks = this.setupCallbacks(config.callbacks);
      
      // Configure training
      this.configureTraining(config.hyperparameters);
      
      // Train the model
      console.log('📊 Training model...');
      this.trainingHistory = await this.model.fit(
        trainData.features,
        trainData.targets,
        {
          epochs: config.hyperparameters.epochs,
          batchSize: config.hyperparameters.batchSize,
          validationData: validationData ? [validationData.features, validationData.targets] : undefined,
          callbacks: callbacks,
          shuffle: true,
          verbose: 1
        }
      );
      
      // Evaluate model
      console.log('🔍 Evaluating model...');
      const metrics = await this.evaluateModel(validationData || trainData);
      
      // Perform validation
      const validationResults = await this.performValidation(preprocessedData, config);
      
      // Find best epoch
      const bestEpoch = this.findBestEpoch(this.trainingHistory);
      
      const trainingTime = Date.now() - startTime;
      console.log(`✅ Training completed in ${trainingTime}ms`);
      
      return {
        model: this.model,
        history: this.trainingHistory,
        metrics,
        bestEpoch,
        trainingTime,
        validationResults
      };
      
    } catch (error) {
      console.error('❌ Training failed:', error);
      throw new Error(`Model training failed: ${error.message}`);
    }
  }

  /**
   * Create model architecture based on configuration
   */
  private createModelArchitecture(config: TrainingConfig): tf.LayersModel {
    const { modelType, hyperparameters } = config;
    
    switch (modelType) {
      case 'lstm':
        return this.createLSTMModel(hyperparameters);
      case 'gru':
        return this.createGRUModel(hyperparameters);
      case 'transformer':
        return this.createTransformerModel(hyperparameters);
      case 'mlp':
        return this.createMLPModel(hyperparameters);
      default:
        throw new Error(`Unsupported model type: ${modelType}`);
    }
  }

  /**
   * Create LSTM model architecture
   */
  private createLSTMModel(hyperparameters: HyperParameters): tf.LayersModel {
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.inputLayer({ 
      inputShape: [30, hyperparameters.units[0]] // 30 time steps, feature count
    }));
    
    // LSTM layers
    for (let i = 0; i < hyperparameters.units.length; i++) {
      const isLast = i === hyperparameters.units.length - 1;
      
      model.add(tf.layers.lstm({
        units: hyperparameters.units[i],
        returnSequences: !isLast,
        dropout: hyperparameters.dropout,
        recurrentDropout: hyperparameters.recurrentDropout || 0.0,
        activation: hyperparameters.activation as any
      }));
      
      if (!isLast) {
        model.add(tf.layers.dropout({ rate: hyperparameters.dropout }));
      }
    }
    
    // Dense output layer
    model.add(tf.layers.dense({ units: 1, activation: 'linear' }));
    
    return model;
  }

  /**
   * Create GRU model architecture
   */
  private createGRUModel(hyperparameters: HyperParameters): tf.LayersModel {
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.inputLayer({ 
      inputShape: [30, hyperparameters.units[0]]
    }));
    
    // GRU layers
    for (let i = 0; i < hyperparameters.units.length; i++) {
      const isLast = i === hyperparameters.units.length - 1;
      
      model.add(tf.layers.gru({
        units: hyperparameters.units[i],
        returnSequences: !isLast,
        dropout: hyperparameters.dropout,
        recurrentDropout: hyperparameters.recurrentDropout || 0.0,
        activation: hyperparameters.activation as any
      }));
      
      if (!isLast) {
        model.add(tf.layers.dropout({ rate: hyperparameters.dropout }));
      }
    }
    
    // Dense output layer
    model.add(tf.layers.dense({ units: 1, activation: 'linear' }));
    
    return model;
  }

  /**
   * Create Transformer model architecture (simplified)
   */
  private createTransformerModel(hyperparameters: HyperParameters): tf.LayersModel {
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.inputLayer({ 
      inputShape: [30, hyperparameters.units[0]]
    }));
    
    // Multi-head attention (simplified with dense layers)
    model.add(tf.layers.dense({ 
      units: hyperparameters.units[0], 
      activation: 'relu' 
    }));
    model.add(tf.layers.dropout({ rate: hyperparameters.dropout }));
    
    // Feed-forward network
    for (const units of hyperparameters.units) {
      model.add(tf.layers.dense({ 
        units, 
        activation: hyperparameters.activation as any 
      }));
      model.add(tf.layers.dropout({ rate: hyperparameters.dropout }));
    }
    
    // Global average pooling
    model.add(tf.layers.globalAveragePooling1d());
    
    // Output layer
    model.add(tf.layers.dense({ units: 1, activation: 'linear' }));
    
    return model;
  }

  /**
   * Create MLP model architecture
   */
  private createMLPModel(hyperparameters: HyperParameters): tf.LayersModel {
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.inputLayer({ 
      inputShape: [hyperparameters.units[0]]
    }));
    
    // Hidden layers
    for (let i = 1; i < hyperparameters.units.length; i++) {
      model.add(tf.layers.dense({ 
        units: hyperparameters.units[i], 
        activation: hyperparameters.activation as any 
      }));
      model.add(tf.layers.dropout({ rate: hyperparameters.dropout }));
    }
    
    // Output layer
    model.add(tf.layers.dense({ units: 1, activation: 'linear' }));
    
    return model;
  }

  /**
   * Prepare training data with validation split
   */
  private prepareTrainingData(
    preprocessedData: PreprocessedData,
    validationConfig: ValidationConfig
  ): {
    trainData: TrainingData;
    validationData: TrainingData | null;
  } {
    const { features, targets } = preprocessedData;
    
    if (validationConfig.method === 'holdout') {
      const splitIndex = Math.floor(features.length * (1 - validationConfig.splitRatio));
      
      const trainFeatures = tf.tensor2d(features.slice(0, splitIndex));
      const trainTargets = tf.tensor2d(targets.slice(0, splitIndex));
      const validFeatures = tf.tensor2d(features.slice(splitIndex));
      const validTargets = tf.tensor2d(targets.slice(splitIndex));
      
      return {
        trainData: {
          features: trainFeatures,
          targets: trainTargets
        },
        validationData: {
          features: validFeatures,
          targets: validTargets
        }
      };
    } else {
      // Use all data for training (validation will be done separately)
      return {
        trainData: {
          features: tf.tensor2d(features),
          targets: tf.tensor2d(targets)
        },
        validationData: null
      };
    }
  }

  /**
   * Configure training optimization
   */
  private configureTraining(hyperparameters: HyperParameters): void {
    if (!this.model) {
      throw new Error('Model not initialized');
    }
    
    // Create optimizer
    let optimizer: tf.Optimizer;
    switch (hyperparameters.optimizer) {
      case 'adam':
        optimizer = tf.train.adam(hyperparameters.learningRate);
        break;
      case 'sgd':
        optimizer = tf.train.sgd(hyperparameters.learningRate);
        break;
      case 'rmsprop':
        optimizer = tf.train.rmsprop(hyperparameters.learningRate);
        break;
      default:
        optimizer = tf.train.adam(hyperparameters.learningRate);
    }
    
    // Compile model
    this.model.compile({
      optimizer,
      loss: hyperparameters.lossFunction,
      metrics: ['mae', 'mse']
    });
  }

  /**
   * Setup training callbacks
   */
  private setupCallbacks(callbackConfig: CallbackConfig): tf.CustomCallback[] {
    const callbacks: tf.CustomCallback[] = [];
    
    // Early stopping
    if (callbackConfig.earlyStoppingPatience > 0) {
      callbacks.push(this.createEarlyStoppingCallback(callbackConfig.earlyStoppingPatience));
    }
    
    // Reduce learning rate on plateau
    if (callbackConfig.reduceLrPatience > 0) {
      callbacks.push(this.createReduceLrCallback(
        callbackConfig.reduceLrPatience,
        callbackConfig.reduceLrFactor
      ));
    }
    
    // Model checkpointing
    if (callbackConfig.modelCheckpoint) {
      callbacks.push(this.createModelCheckpointCallback());
    }
    
    // Progress logging
    callbacks.push(this.createProgressCallback());
    
    return callbacks;
  }

  /**
   * Create early stopping callback
   */
  private createEarlyStoppingCallback(patience: number): tf.CustomCallback {
    let bestLoss = Infinity;
    let waitCount = 0;
    
    return {
      onEpochEnd: async (epoch, logs) => {
        const currentLoss = typeof logs?.val_loss === 'number' ? logs.val_loss : 
                           typeof logs?.loss === 'number' ? logs.loss : Infinity;
        
        if (currentLoss < bestLoss) {
          bestLoss = currentLoss;
          waitCount = 0;
          
          // Save best model
          if (this.model) {
            this.bestModel = await this.cloneModel(this.model);
            this.bestMetrics = await this.calculateMetrics(logs);
          }
        } else {
          waitCount++;
          
          if (waitCount >= patience) {
            console.log(`⏰ Early stopping triggered after ${patience} epochs without improvement`);
            if (this.model) {
              (this.model as any).stopTraining = true;
            }
          }
        }
      }
    } as tf.CustomCallback;
  }

  /**
   * Create reduce learning rate callback
   */
  private createReduceLrCallback(patience: number, factor: number): tf.CustomCallback {
    let bestLoss = Infinity;
    let waitCount = 0;
    
    return {
      onEpochEnd: async (epoch, logs) => {
        const currentLoss = typeof logs?.val_loss === 'number' ? logs.val_loss : 
                           typeof logs?.loss === 'number' ? logs.loss : Infinity;
        
        if (currentLoss < bestLoss) {
          bestLoss = currentLoss;
          waitCount = 0;
        } else {
          waitCount++;
          
          if (waitCount >= patience) {
            console.log(`📉 Learning rate plateau detected after ${patience} epochs`);
            // Note: TensorFlow.js doesn't support dynamic LR changes during training
            // This would need to be implemented differently in production
            waitCount = 0;
          }
        }
      }
    } as tf.CustomCallback;
  }

  /**
   * Create model checkpoint callback
   */
  private createModelCheckpointCallback(): tf.CustomCallback {
    return {
      onEpochEnd: async (epoch, logs) => {
        if (epoch % 10 === 0) { // Save every 10 epochs
          const modelPath = `model_checkpoint_epoch_${epoch}`;
          console.log(`💾 Saving model checkpoint at epoch ${epoch}`);
          // In production, this would save to storage
        }
      }
    } as tf.CustomCallback;
  }

  /**
   * Create progress callback
   */
  private createProgressCallback(): tf.CustomCallback {
    return {
      onEpochEnd: async (epoch, logs) => {
        if (epoch % 5 === 0) {
          const loss = typeof logs?.loss === 'number' ? logs.loss.toFixed(4) : 'N/A';
          const valLoss = typeof logs?.val_loss === 'number' ? logs.val_loss.toFixed(4) : 'N/A';
          const mae = typeof logs?.mae === 'number' ? logs.mae.toFixed(4) : 'N/A';
          console.log(`📊 Epoch ${epoch}: loss=${loss}, val_loss=${valLoss}, mae=${mae}`);
        }
      }
    } as tf.CustomCallback;
  }

  /**
   * Evaluate model performance
   */
  private async evaluateModel(data: TrainingData): Promise<ModelMetrics> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }
    
    const evaluation = await this.model.evaluate(data.features, data.targets) as tf.Scalar[];
    const lossData = await evaluation[0].data();
    const maeData = await evaluation[1].data();
    const mseData = await evaluation[2].data();
    
    // Calculate R² score
    const predictions = this.model.predict(data.features) as tf.Tensor;
    const r2Score = await this.calculateR2Score(data.targets, predictions);
    
    // Calculate accuracy (for regression, we use percentage within threshold)
    const accuracy = await this.calculateAccuracy(data.targets, predictions);
    
    predictions.dispose();
    evaluation.forEach(tensor => tensor.dispose());
    
    return {
      loss: Array.isArray(lossData) ? lossData[0] : (lossData as any),
      mae: Array.isArray(maeData) ? maeData[0] : (maeData as any),
      mse: Array.isArray(mseData) ? mseData[0] : (mseData as any),
      r2Score,
      accuracy
    };
  }

  /**
   * Calculate R² score
   */
  private async calculateR2Score(actual: tf.Tensor, predicted: tf.Tensor): Promise<number> {
    const actualData = await actual.data();
    const predictedData = await predicted.data();
    
    const actualMean = actualData.reduce((sum, val) => sum + val, 0) / actualData.length;
    
    let ssRes = 0;
    let ssTot = 0;
    
    for (let i = 0; i < actualData.length; i++) {
      ssRes += Math.pow(actualData[i] - predictedData[i], 2);
      ssTot += Math.pow(actualData[i] - actualMean, 2);
    }
    
    return ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
  }

  /**
   * Calculate accuracy (percentage within 20% threshold)
   */
  private async calculateAccuracy(actual: tf.Tensor, predicted: tf.Tensor): Promise<number> {
    const actualData = await actual.data();
    const predictedData = await predicted.data();
    
    let correctPredictions = 0;
    const threshold = 0.2; // 20% threshold
    
    for (let i = 0; i < actualData.length; i++) {
      const error = Math.abs(actualData[i] - predictedData[i]);
      const relativeError = actualData[i] === 0 ? error : error / Math.abs(actualData[i]);
      
      if (relativeError <= threshold) {
        correctPredictions++;
      }
    }
    
    return correctPredictions / actualData.length;
  }

  /**
   * Perform cross-validation
   */
  private async performValidation(
    preprocessedData: PreprocessedData,
    config: TrainingConfig
  ): Promise<ValidationResult[]> {
    const { validation } = config;
    const results: ValidationResult[] = [];
    
    if (validation.method === 'k_fold') {
      const kFolds = validation.kFolds || 5;
      const foldSize = Math.floor(preprocessedData.features.length / kFolds);
      
      for (let fold = 0; fold < kFolds; fold++) {
        console.log(`🔄 Training fold ${fold + 1}/${kFolds}`);
        
        // Create fold data
        const validationStart = fold * foldSize;
        const validationEnd = Math.min((fold + 1) * foldSize, preprocessedData.features.length);
        
        const trainFeatures = [
          ...preprocessedData.features.slice(0, validationStart),
          ...preprocessedData.features.slice(validationEnd)
        ];
        const trainTargets = [
          ...preprocessedData.targets.slice(0, validationStart),
          ...preprocessedData.targets.slice(validationEnd)
        ];
        const validFeatures = preprocessedData.features.slice(validationStart, validationEnd);
        const validTargets = preprocessedData.targets.slice(validationStart, validationEnd);
        
        // Train fold model
        const foldModel = this.createModelArchitecture(config);
        this.configureTraining(config.hyperparameters);
        
        const trainTensor = tf.tensor2d(trainFeatures);
        const trainTargetTensor = tf.tensor2d(trainTargets);
        const validTensor = tf.tensor2d(validFeatures);
        const validTargetTensor = tf.tensor2d(validTargets);
        
        await foldModel.fit(trainTensor, trainTargetTensor, {
          epochs: config.hyperparameters.epochs,
          batchSize: config.hyperparameters.batchSize,
          verbose: 0
        });
        
        // Evaluate fold
        const predictions = foldModel.predict(validTensor) as tf.Tensor;
        const metrics = await this.evaluateModel({
          features: validTensor,
          targets: validTargetTensor
        });
        
        const predictionData = await predictions.data();
        const actualData = await validTargetTensor.data();
        
        results.push({
          fold,
          metrics,
          predictions: Array.from(predictionData),
          actual: Array.from(actualData)
        });
        
        // Cleanup
        foldModel.dispose();
        trainTensor.dispose();
        trainTargetTensor.dispose();
        validTensor.dispose();
        validTargetTensor.dispose();
        predictions.dispose();
      }
    } else if (validation.method === 'time_series_split') {
      // Time series specific validation
      const splits = validation.timeSeriesSplits || 3;
      const splitSize = Math.floor(preprocessedData.features.length / (splits + 1));
      
      for (let split = 0; split < splits; split++) {
        const trainEnd = (split + 1) * splitSize;
        const validStart = trainEnd;
        const validEnd = Math.min(validStart + splitSize, preprocessedData.features.length);
        
        const trainFeatures = preprocessedData.features.slice(0, trainEnd);
        const trainTargets = preprocessedData.targets.slice(0, trainEnd);
        const validFeatures = preprocessedData.features.slice(validStart, validEnd);
        const validTargets = preprocessedData.targets.slice(validStart, validEnd);
        
        // Similar training logic as k-fold
        // ... implementation details
      }
    }
    
    return results;
  }

  /**
   * Find best epoch from training history
   */
  private findBestEpoch(history: tf.History): number {
    const valLoss = history.history.val_loss as number[];
    if (!valLoss || valLoss.length === 0) {
      return history.history.loss.length - 1;
    }
    
    let bestEpoch = 0;
    let bestLoss = valLoss[0];
    
    for (let i = 1; i < valLoss.length; i++) {
      if (valLoss[i] < bestLoss) {
        bestLoss = valLoss[i];
        bestEpoch = i;
      }
    }
    
    return bestEpoch;
  }

  /**
   * Clone model for checkpointing
   */
  private async cloneModel(model: tf.LayersModel): Promise<tf.LayersModel> {
    const modelJson = model.toJSON();
    const clonedModel = await tf.models.modelFromJSON(modelJson) as tf.LayersModel;
    clonedModel.setWeights(model.getWeights());
    return clonedModel;
  }

  /**
   * Calculate metrics from logs
   */
  private async calculateMetrics(logs: any): Promise<ModelMetrics> {
    return {
      loss: logs?.loss || 0,
      mae: logs?.mae || 0,
      mse: logs?.mse || 0,
      r2Score: logs?.r2Score || 0,
      accuracy: logs?.accuracy || 0
    };
  }

  /**
   * Get best model from training
   */
  public getBestModel(): tf.LayersModel | null {
    return this.bestModel;
  }

  /**
   * Get best metrics
   */
  public getBestMetrics(): ModelMetrics | null {
    return this.bestMetrics;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.model) {
      this.model.dispose();
    }
    if (this.bestModel) {
      this.bestModel.dispose();
    }
  }
}

/**
 * Factory function to create model trainer
 */
export function createModelTrainer(): ModelTrainer {
  return new ModelTrainer();
}

/**
 * Create default training configuration
 */
export function createDefaultTrainingConfig(): TrainingConfig {
  return {
    modelType: 'lstm',
    hyperparameters: {
      learningRate: 0.001,
      batchSize: 32,
      epochs: 100,
      dropout: 0.2,
      recurrentDropout: 0.2,
      units: [64, 32, 16],
      activation: 'relu',
      optimizer: 'adam',
      lossFunction: 'meanSquaredError'
    },
    validation: {
      method: 'holdout',
      splitRatio: 0.2,
      kFolds: 5,
      timeSeriesSplits: 3
    },
    callbacks: {
      earlyStoppingPatience: 10,
      reduceLrPatience: 5,
      reduceLrFactor: 0.5,
      modelCheckpoint: true,
      tensorboard: false
    }
  };
}

/**
 * Hyperparameter optimization using grid search
 */
export class HyperparameterOptimizer {
  private bestConfig: TrainingConfig | null = null;
  private bestScore: number = Infinity;

  /**
   * Perform grid search for hyperparameters
   */
  public async optimizeHyperparameters(
    preprocessedData: PreprocessedData,
    parameterGrid: {
      learningRate: number[];
      batchSize: number[];
      units: number[][];
      dropout: number[];
    }
  ): Promise<{
    bestConfig: TrainingConfig;
    bestScore: number;
    allResults: { config: TrainingConfig; score: number }[];
  }> {
    const allResults: { config: TrainingConfig; score: number }[] = [];
    
    console.log('🔍 Starting hyperparameter optimization...');
    
    // Generate all parameter combinations
    const combinations = this.generateParameterCombinations(parameterGrid);
    
    for (let i = 0; i < combinations.length; i++) {
      const params = combinations[i];
      console.log(`🧪 Testing combination ${i + 1}/${combinations.length}`);
      
      // Create config with current parameters
      const config = this.createConfigFromParams(params);
      
      // Train model with current config
      const trainer = createModelTrainer();
      try {
        const result = await trainer.trainModel(preprocessedData, config);
        const score = result.metrics.loss;
        
        allResults.push({ config, score });
        
        if (score < this.bestScore) {
          this.bestScore = score;
          this.bestConfig = config;
          console.log(`✨ New best score: ${score.toFixed(4)}`);
        }
      } catch (error) {
        console.error(`❌ Training failed for combination ${i + 1}:`, error);
      } finally {
        trainer.dispose();
      }
    }
    
    if (!this.bestConfig) {
      throw new Error('No valid configuration found');
    }
    
    console.log(`🎯 Optimization complete. Best score: ${this.bestScore.toFixed(4)}`);
    
    return {
      bestConfig: this.bestConfig,
      bestScore: this.bestScore,
      allResults
    };
  }

  /**
   * Generate all parameter combinations
   */
  private generateParameterCombinations(parameterGrid: any): any[] {
    const combinations: any[] = [];
    const keys = Object.keys(parameterGrid);
    
    function generateCombinations(index: number, current: any) {
      if (index === keys.length) {
        combinations.push({ ...current });
        return;
      }
      
      const key = keys[index];
      const values = parameterGrid[key];
      
      for (const value of values) {
        current[key] = value;
        generateCombinations(index + 1, current);
      }
    }
    
    generateCombinations(0, {});
    return combinations;
  }

  /**
   * Create training config from parameters
   */
  private createConfigFromParams(params: any): TrainingConfig {
    const defaultConfig = createDefaultTrainingConfig();
    
    return {
      ...defaultConfig,
      hyperparameters: {
        ...defaultConfig.hyperparameters,
        ...params
      }
    };
  }
}

/**
 * Model ensemble for improved predictions
 */
export class ModelEnsemble {
  private models: tf.LayersModel[] = [];
  private weights: number[] = [];

  /**
   * Add model to ensemble
   */
  public addModel(model: tf.LayersModel, weight: number = 1.0): void {
    this.models.push(model);
    this.weights.push(weight);
  }

  /**
   * Make ensemble prediction
   */
  public async predict(input: tf.Tensor): Promise<tf.Tensor> {
    if (this.models.length === 0) {
      throw new Error('No models in ensemble');
    }
    
    const predictions = await Promise.all(
      this.models.map(model => model.predict(input) as tf.Tensor)
    );
    
    // Weighted average of predictions
    let weightedSum = tf.zeros(predictions[0].shape);
    let totalWeight = 0;
    
    for (let i = 0; i < predictions.length; i++) {
      const weightedPrediction = predictions[i].mul(this.weights[i]);
      weightedSum = weightedSum.add(weightedPrediction);
      totalWeight += this.weights[i];
      
      weightedPrediction.dispose();
    }
    
    const result = weightedSum.div(totalWeight);
    
    // Cleanup
    predictions.forEach(pred => pred.dispose());
    weightedSum.dispose();
    
    return result;
  }

  /**
   * Dispose of ensemble models
   */
  public dispose(): void {
    this.models.forEach(model => model.dispose());
    this.models = [];
    this.weights = [];
  }
}