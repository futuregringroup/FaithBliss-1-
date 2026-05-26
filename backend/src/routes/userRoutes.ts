// src/routes/userRoutes.ts
import express from 'express';
import {
  getMe,
  getAllUsers,
  getAdminPlatformStats,
  getDeveloperOverview,
  getUserById,
  getOnboardingDebug,
  getMarketers,
  getMarketerCustomers,
  updateUserProfile,
  updateUserSettings,
  updatePassportSettings,
  activateProfileBooster,
  getFeatureSettings,
  getPublicFeatureSettings,
  updateFeatureSettings,
  updateDeveloperFeatureSettings,
  updateUserRole,
  updateUserByAdmin,
  resetUserPasswordByAdmin,
  deleteUserByAdmin,
  deleteMe,
  deactivateAccount,
  reactivateAccount,
  submitPostPaymentSurvey,
} from '../controllers/userController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

// Get current logged-in user
router.get('/me', protect, getMe);
router.get('/me/onboarding-debug', protect, getOnboardingDebug);

// Update profile info
router.put('/me', protect, updateUserProfile);

// Update settings
router.patch('/me/settings', protect, updateUserSettings);
router.patch('/me/passport', protect, updatePassportSettings);
router.post('/me/profile-booster/activate', protect, activateProfileBooster);
router.get('/public-feature-settings', getPublicFeatureSettings);
router.get('/feature-settings', protect, getFeatureSettings);
router.get('/admin/platform-stats', protect, getAdminPlatformStats);
router.get('/developer/overview', protect, getDeveloperOverview);
router.patch('/feature-settings', protect, updateFeatureSettings);
router.patch('/developer/feature-settings', protect, updateDeveloperFeatureSettings);
// Self-service hard account deletion (must be before /:id routes)
router.delete('/me', protect, deleteMe);

// Deactivate/reactivate account
router.post('/me/deactivate', protect, deactivateAccount);
router.post('/me/reactivate', protect, reactivateAccount);

router.patch('/:id/role', protect, updateUserRole);
router.patch('/:id', protect, updateUserByAdmin);
router.post('/:id/reset-password', protect, resetUserPasswordByAdmin);
router.delete('/:id', protect, deleteUserByAdmin);

// Submit post-payment survey (asks who reached out)
router.post('/me/post-payment-survey', protect, submitPostPaymentSurvey);

// Get all users
router.get('/', protect, getAllUsers);

// Get marketers list (for sales follow-up)
router.get('/marketers', protect, getMarketers);
router.get('/marketers/:id/customers', protect, getMarketerCustomers);

// Debug onboarding document
router.get('/:id/onboarding-debug', protect, getOnboardingDebug);

// Get single user by ID
router.get('/:id', protect, getUserById);

export default router;
