import { Request, Response, NextFunction } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  service?: string;
  user?: {
    id: string;
    role: string;
  };
}

// Service-to-service authentication
export function serviceAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['x-service-auth'] as string;

  if (!authHeader) {
    logger.warn('Missing service auth header', { ip: req.ip });
    return res.status(401).json({ error: 'Missing authentication' });
  }

  try {
    // Parse auth header: "ServiceName:Signature"
    const [service, signature] = authHeader.split(':');
    
    if (!service || !signature) {
      throw new Error('Invalid auth header format');
    }

    // Verify signature
    const payload = `${req.method}:${req.path}:${Date.now()}`;
    const expectedSignature = createHmac('sha256', config.serviceAuthSecret)
      .update(payload)
      .digest('hex');

    // Check if signature is valid (with some time tolerance)
    const providedBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
      throw new Error('Invalid signature');
    }

    // Attach service info to request
    req.service = service;
    next();
  } catch (error) {
    logger.warn('Service auth failed', { error: error.message, ip: req.ip });
    res.status(401).json({ error: 'Invalid authentication' });
  }
}

// Discord interaction signature verification
export function verifyDiscordSignature(
  publicKey: string
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction) => {
    const signature = req.get('X-Signature-Ed25519');
    const timestamp = req.get('X-Signature-Timestamp');
    const body = req.body;

    if (!signature || !timestamp) {
      logger.warn('Missing Discord signature headers');
      return res.status(401).json({ error: 'Missing signature' });
    }

    try {
      // Discord signature verification would go here
      // For now, we'll implement a placeholder
      // In production, use discord-interactions or tweetnacl

      if (config.nodeEnv === 'development') {
        // Skip verification in development
        next();
      } else {
        // TODO: Implement proper Discord signature verification
        // const isValid = verifyKey(body, signature, timestamp, publicKey);
        // if (!isValid) {
        //   throw new Error('Invalid signature');
        // }
        next();
      }
    } catch (error) {
      logger.warn('Discord signature verification failed', { error: error.message });
      res.status(401).json({ error: 'Invalid signature' });
    }
  };
}

// Optional auth for public endpoints that can work with or without auth
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['x-service-auth'] as string;

  if (!authHeader) {
    // No auth provided, continue without it
    return next();
  }

  // If auth is provided, verify it
  serviceAuth(req, res, next);
}