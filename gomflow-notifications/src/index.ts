import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import config from './config';
import logger from './utils/logger';
import WebSocketService from './services/websocketService';
import NotificationService from './services/notificationService';
import PushNotificationService from './services/pushNotificationService';
import EmailService from './services/emailService';
import notificationRoutes from './routes/notifications';
import healthRoutes from './routes/health';
import webhookRoutes from './routes/webhooks';

class NotificationServer {
  private app: express.Application;
  private server: any;
  private websocketService: WebSocketService;
  private notificationService: NotificationService;
  private pushService: PushNotificationService;
  private emailService: EmailService;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    
    // Initialize services
    this.pushService = new PushNotificationService();
    this.emailService = new EmailService();
    this.websocketService = new WebSocketService(this.server);
    this.notificationService = new NotificationService(
      this.websocketService,
      this.pushService,
      this.emailService
    );

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX_REQUESTS,
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(config.RATE_LIMIT_WINDOW_MS / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    this.app.use('/api/', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Make services available to routes
    this.app.locals.notificationService = this.notificationService;
    this.app.locals.websocketService = this.websocketService;
    this.app.locals.pushService = this.pushService;
    this.app.locals.emailService = this.emailService;

    // API routes
    this.app.use('/health', healthRoutes);
    this.app.use('/api/notifications', notificationRoutes);
    this.app.use('/api/webhooks', webhookRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'GOMFLOW Notifications Service',
        version: '1.0.0',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        features: {
          websocket: true,
          pushNotifications: this.pushService.isInitialized(),
          email: this.emailService.isInitialized()
        }
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
      });
    });
  }

  private setupErrorHandling(): void {
    // Error handling middleware
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error in request', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
      });

      res.status(err.status || 500).json({
        error: config.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : err.message,
        ...(config.NODE_ENV !== 'production' && { stack: err.stack })
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      this.server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      this.server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }

  public start(): void {
    this.server.listen(config.PORT, config.HOST, () => {
      logger.info('GOMFLOW Notifications Service started', {
        port: config.PORT,
        host: config.HOST,
        environment: config.NODE_ENV,
        websocket: true,
        pushNotifications: this.pushService.isInitialized(),
        email: this.emailService.isInitialized()
      });
    });
  }

  public getApp(): express.Application {
    return this.app;
  }

  public getServer(): any {
    return this.server;
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new NotificationServer();
  server.start();
}

export default NotificationServer;