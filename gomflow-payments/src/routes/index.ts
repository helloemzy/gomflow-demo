import { Router } from 'express'
import PaymentController from '@/controllers/paymentController'
import WebhookController from '@/controllers/webhookController'

const router = Router()
const paymentController = new PaymentController()
const webhookController = new WebhookController()

// Payment routes
router.post('/payment/create', paymentController.createPaymentSession.bind(paymentController))
router.get('/payment/:submission_id/status', paymentController.getPaymentStatus.bind(paymentController))
router.post('/payment/:submission_id/cancel', paymentController.cancelPaymentSession.bind(paymentController))

// Webhook routes
router.post('/webhooks/paymongo', webhookController.handlePayMongoWebhook.bind(webhookController))
router.post('/webhooks/billplz', webhookController.handleBillplzWebhook.bind(webhookController))

// Health check
router.get('/health', paymentController.healthCheck.bind(paymentController))

export default router