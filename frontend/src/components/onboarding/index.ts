/* eslint-disable no-irregular-whitespace */
// src/components/onboarding/index.ts (Vite/React - FIXED)

// Main Slides/Views
export { default as ProfileBuilderSlide } from "./ProfileBuilderSlide";
export { default as PreferenceSlide } from "./PreferenceSlide";

// Core UI Components
export { OnboardingHeader } from "./OnboardingHeader";
export { OnboardingNavigation } from "./OnboardingNavigation";
export { OnboardingSuccessModal } from "./OnboardingSuccessModal";

// Validation and Types
export { validateOnboardingStep } from "./validation";

// ✅ FIX: Export all items that are purely type aliases using 'export type'
export type {
  OnboardingData,
  FaithJourney,
  ChurchAttendance,
  RelationshipGoals,
  Gender,
} from "./types.ts";

// The old syntax that caused the error (removed):
/*
export type { OnboardingData } from './types';
export { 
 FaithJourney, 
 ChurchAttendance, 
 RelationshipGoals, 
 Gender 
} from './types';
*/
