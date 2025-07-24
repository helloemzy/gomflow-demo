import { Router } from 'express'
import SmartAgentController, { uploadMiddleware } from '@/controllers/smartAgentController'

const router = Router()
const smartAgentController = new SmartAgentController()

// Smart Agent routes
router.post('/process', uploadMiddleware, smartAgentController.processScreenshot.bind(smartAgentController))
router.post('/review', smartAgentController.reviewDetection.bind(smartAgentController))
router.get('/stats', smartAgentController.getStats.bind(smartAgentController))
router.get('/status', smartAgentController.getStatus.bind(smartAgentController))

// Manual Payment Verification routes
router.post('/analyze', smartAgentController.analyzePaymentProof.bind(smartAgentController))
router.post('/batch-analyze', smartAgentController.batchAnalyzePaymentProofs.bind(smartAgentController))
router.get('/analysis-stats', smartAgentController.getAnalysisStats.bind(smartAgentController))
router.post('/reprocess', smartAgentController.reprocessFailedAnalyses.bind(smartAgentController))

// Health check
router.get('/health', smartAgentController.healthCheck.bind(smartAgentController))

export default router