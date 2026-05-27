// src/routes/paymentRoutes.ts

import express from 'express';
import { protect } from '../middleware/authMiddleware';
import {
  deleteAdminPaymentRecord,
  getAdminPaymentAnalytics,
  getLocalizedProfileBoosterQuote,
  handlePaystackWebhook,
  getLocalizedPricingQuote,
  initializeProfileBoosterPurchase,
  initializeLocalizedSubscription,
  updateSubscriptionAutoRenew,
  verifySubscription,
} from '../controllers/paymentController';

const router = express.Router();

// Webhook (no auth)
router.post('/webhook', handlePaystackWebhook);

// Authenticated endpoints
router.get('/admin/analytics', protect, getAdminPaymentAnalytics);
router.delete('/admin/records/:userId', protect, deleteAdminPaymentRecord);
router.get('/quote', protect, getLocalizedPricingQuote);
router.get('/profile-booster/quote', protect, getLocalizedProfileBoosterQuote);
router.post('/pay', protect, initializeLocalizedSubscription);
router.patch('/subscription/auto-renew', protect, updateSubscriptionAutoRenew);
router.post('/profile-booster/pay', protect, initializeProfileBoosterPurchase);
router.post('/verify', protect, verifySubscription);

export default router;
