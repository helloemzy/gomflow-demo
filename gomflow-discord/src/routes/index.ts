import { Router } from 'express';
import healthRoutes from './health';
import interactionRoutes from './interactions';
import notificationRoutes from './notifications';
import analyticsRoutes from './analytics';
import { serviceAuth } from '../middleware/auth';

const router = Router();

// Public routes (no auth required)
router.use('/health', healthRoutes);

// Discord interaction routes (Discord signature verification)
router.use('/interactions', interactionRoutes);

// Internal service routes (service-to-service auth required)
router.use('/notifications', serviceAuth, notificationRoutes);
router.use('/analytics', serviceAuth, analyticsRoutes);

export default router;