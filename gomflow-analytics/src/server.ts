import http from 'http';
import app from './app';
import config from './config';
import logger from './utils/logger';
import { AnalyticsService } from './services/analyticsService';
import { DataPipelineService } from './services/dataPipelineService';

// Initialize services
const analyticsService = new AnalyticsService();
const dataPipelineService = new DataPipelineService();

// Create HTTP server
const server = http.createServer(app);

// Server startup
const startServer = async (): Promise<void> => {
  try {
    logger.info('Starting GOMFLOW Analytics Service...');
    
    // Wait for services to initialize
    logger.info('Waiting for services to initialize...');
    
    // Wait for analytics service to be ready
    let retries = 0;
    const maxRetries = 30; // 30 seconds
    
    while (!analyticsService.isInitialized() && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries++;
    }
    
    if (!analyticsService.isInitialized()) {
      throw new Error('Analytics service failed to initialize within timeout');
    }
    
    // Wait for data pipeline service to be ready
    retries = 0;
    while (!dataPipelineService.isInitialized() && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      retries++;
    }
    
    if (!dataPipelineService.isInitialized()) {
      throw new Error('Data pipeline service failed to initialize within timeout');
    }
    
    logger.info('All services initialized successfully');
    
    // Start HTTP server
    server.listen(config.PORT, config.HOST, () => {
      logger.info(`🚀 GOMFLOW Analytics Service started successfully`, {
        port: config.PORT,
        host: config.HOST,
        environment: config.NODE_ENV,
        processId: process.pid
      });
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Server shutdown
const shutdownServer = async (): Promise<void> => {
  logger.info('Shutting down GOMFLOW Analytics Service...');
  
  try {
    // Close HTTP server
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
    
    // Shutdown data pipeline service
    await dataPipelineService.shutdown();
    
    logger.info('Server shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during server shutdown:', error);
    process.exit(1);
  }
};

// Handle server errors
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${config.PORT} is already in use`);
  } else {
    logger.error('Server error:', error);
  }
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', shutdownServer);
process.on('SIGINT', shutdownServer);

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception:', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled promise rejection:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString()
  });
  process.exit(1);
});

// Start the server
startServer();