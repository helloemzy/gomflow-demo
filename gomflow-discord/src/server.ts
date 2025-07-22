import 'dotenv/config';
import { createServer } from 'http';
import { config } from './config';
import { logger } from './utils/logger';
import { app } from './app';
import { DiscordBotService } from './services/discordBotService';
import { DatabaseService } from './services/databaseService';
import { QueueService } from './services/queueService';
import { Client, GatewayIntentBits, Partials } from 'discord.js';

// Global services
let discordBot: DiscordBotService;
let databaseService: DatabaseService;
let queueService: QueueService;

// Initialize Discord client
const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, starting graceful shutdown...`);

  // Stop accepting new requests
  server.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    // Cleanup services
    if (discordBot) {
      logger.info('Logging out Discord bot...');
      await discordClient.destroy();
    }

    if (queueService) {
      logger.info('Closing queue connections...');
      await queueService.close();
    }

    if (databaseService) {
      logger.info('Closing database connections...');
      await databaseService.close();
    }

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Initialize services
async function initializeServices() {
  try {
    // Initialize database service
    logger.info('Initializing database service...');
    databaseService = new DatabaseService(config);
    await databaseService.initialize();

    // Initialize queue service
    logger.info('Initializing queue service...');
    queueService = new QueueService(config);
    await queueService.initialize();

    // Initialize Discord bot
    logger.info('Initializing Discord bot...');
    discordBot = new DiscordBotService(discordClient, config, databaseService);
    
    // Make services available to Express app
    app.locals.discordBot = discordBot;
    app.locals.databaseService = databaseService;
    app.locals.queueService = queueService;

    // Login to Discord
    logger.info('Logging in to Discord...');
    await discordClient.login(config.discord.botToken);

    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    throw error;
  }
}

// Create HTTP server
const server = createServer(app);

// Start server
async function startServer() {
  try {
    // Initialize all services
    await initializeServices();

    // Start listening
    server.listen(config.port, () => {
      logger.info(`Discord service listening on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Service URL: ${config.serviceUrl}`);
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.port} is already in use`);
        process.exit(1);
      } else {
        logger.error('Server error:', error);
        throw error;
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the server
startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});

export { discordBot, databaseService, queueService };