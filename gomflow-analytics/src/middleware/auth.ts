import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import logger from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: 'No authorization header',
        message: 'Authorization header is required'
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'No token provided',
        message: 'Bearer token is required'
      });
      return;
    }

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as any;
      
      req.user = {
        id: decoded.sub || decoded.user_id,
        email: decoded.email,
        role: decoded.role || 'user'
      };

      next();
    } catch (jwtError) {
      logger.error('JWT verification failed:', jwtError);
      res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'Token verification failed'
      });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Service-to-service authentication
export const serviceAuthMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const serviceSecret = req.headers['x-service-secret'];
    
    if (!serviceSecret) {
      res.status(401).json({
        success: false,
        error: 'No service secret',
        message: 'Service secret header is required'
      });
      return;
    }

    if (serviceSecret !== config.CORE_API_SECRET) {
      res.status(401).json({
        success: false,
        error: 'Invalid service secret',
        message: 'Service authentication failed'
      });
      return;
    }

    // Set service user context
    req.user = {
      id: 'system',
      email: 'system@gomflow.com',
      role: 'service'
    };

    next();
  } catch (error) {
    logger.error('Service auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Service authentication error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Optional auth - allows both authenticated and unauthenticated requests
export const optionalAuthMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      next();
      return;
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      next();
      return;
    }

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as any;
      
      req.user = {
        id: decoded.sub || decoded.user_id,
        email: decoded.email,
        role: decoded.role || 'user'
      };
    } catch (jwtError) {
      logger.debug('Optional auth failed, proceeding without user:', jwtError);
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next();
  }
};

// Admin role check
export const adminMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated',
        message: 'Authentication required'
      });
      return;
    }

    if (req.user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: 'Admin role required'
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Admin middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authorization error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export default authMiddleware;