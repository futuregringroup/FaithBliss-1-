// src/routes/authRoutes.ts

import express from 'express';
import {
    completeOnboarding,
    createProfileAfterFirebaseRegister,
} from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// ----------------------------------------
// 1. Firebase Profile Creation Route
// ----------------------------------------
router.post('/register-profile', protect, createProfileAfterFirebaseRegister);

// ----------------------------------------
// 2. Onboarding Route
// ----------------------------------------
router.put('/complete-onboarding', protect, completeOnboarding);

export default router;
