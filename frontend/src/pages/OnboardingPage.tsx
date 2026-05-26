/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import { useAuthContext } from "../contexts/AuthContext";
import {
  OnboardingHeader,
  OnboardingNavigation,
  type OnboardingData,
} from "../components/onboarding/index";

import ImageUploadSlide from "../components/onboarding/ImageUploadSlide";
import ProfileBuilderSlide from "../components/onboarding/ProfileBuilderSlide";
import LocationPermissionSlide from "../components/onboarding/LocationPermissionSlide";
import PartnerPreferencesSlide from "../components/onboarding/PartnerPreferencesSlide";
import RelationshipGoalsSlide from "../components/onboarding/RelationshipGoalsSlide";

import { uploadPhotosToCloudinary } from "../api/cloudinaryUpload";
import { MIN_PROFILE_FITS } from "../constants/profileFitOptions";
import { MIN_ONBOARDING_PHOTOS } from "../constants/onboarding";

// --- TYPE ---
type OnboardingUpdateData = Partial<
  Omit<OnboardingData, "photos" | "customDenomination">
> & {
  profilePhoto1?: string;
  profilePhoto2?: string;
  profilePhoto3?: string;
  profilePhoto4?: string;
  profilePhoto5?: string;
  profilePhoto6?: string;
  profilePhotoCount?: number;
};

const waitForNextPaint = () =>
  new Promise<void>((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }

    window.requestAnimationFrame(() => resolve());
  });

const getSubmissionErrorMessage = (error: unknown): string => {
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Something went wrong.";
  const normalizedMessage = rawMessage.toLowerCase();

  if (normalizedMessage.includes("user not authenticated")) {
    return "Your session has expired. Please sign in again and continue onboarding.";
  }

  if (
    normalizedMessage.includes("upload failed") ||
    normalizedMessage.includes("upload-photos") ||
    normalizedMessage.includes("cloudinary")
  ) {
    return "We could not upload your photos just now. Please check your connection and try again.";
  }

  if (
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("fetch")
  ) {
    return "We could not reach the server. Please check your internet connection and try again.";
  }

  // Pass backend validation messages directly to the user so they know what to fix.
  return rawMessage;
};

const getStepValidationError = (
  step: number,
  data: OnboardingData,
): string | null => {
  const hasText = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0;
  const hasSelections = (value: unknown, minimum = 1): boolean =>
    Array.isArray(value) && value.length >= minimum;
  const hasPhoneNumber = (value: unknown): boolean =>
    typeof value === "string" && value.replace(/\D/g, "").length >= 6;
  const hasValidBirthday = (): boolean =>
    hasText(data.birthday) &&
    typeof data.age === "number" &&
    data.age >= 18 &&
    data.age <= 99;

  if (step === 0 && data.photos.length < MIN_ONBOARDING_PHOTOS) {
    return `Please upload at least ${MIN_ONBOARDING_PHOTOS} photos.`;
  }

  if (step === 1 && !hasText(data.location)) {
    return "Please allow location or enter your location manually.";
  }

  if (step === 2) {
    // Identify the first missing field so the user sees exactly what to fix
    // instead of a generic "complete every field" message that forces them
    // to scan the entire form. Order roughly matches form layout.
    const missingField: string | null = !hasValidBirthday()
      ? "your birthday (you must be 18+)"
      : !data.gender
        ? "your gender"
        : !hasText(data.location)
          ? "your location"
          : !hasText(data.countryCode)
            ? "your country code"
            : !hasPhoneNumber(data.phoneNumber)
              ? "a valid phone number"
              : !hasText(data.height)
                ? "your height"
                : !hasSelections(data.languageSpoken)
                  ? "at least one language you speak"
                  : !hasText(data.occupation)
                    ? "your occupation"
                    : !hasText(data.education)
                      ? "your education"
                      : !data.faithJourney
                        ? "your faith journey"
                        : !data.churchAttendance
                          ? "your church attendance"
                          : !hasText(data.denomination)
                            ? "your denomination"
                            : !hasText(data.baptismStatus)
                              ? "your baptism status"
                              : !hasText(data.favoriteVerse)
                                ? "your favourite verse"
                                : !hasSelections(data.profileFits, MIN_PROFILE_FITS)
                                  ? `at least ${MIN_PROFILE_FITS} "profile fit" options`
                                  : !hasSelections(data.personality)
                                    ? "at least one personality trait"
                                    : !hasSelections(data.hobbies)
                                      ? "at least one hobby"
                                      : !hasSelections(data.values)
                                        ? "at least one value"
                                        : !hasSelections(data.spiritualGifts)
                                          ? "at least one spiritual gift"
                                          : null;
    if (missingField) {
      return `Please add ${missingField} to continue.`;
    }
  }

  if (step === 3 && !hasSelections(data.relationshipGoals)) {
    return "Please select your relationship goal.";
  }

  if (
    step === 4 &&
    (!hasSelections(data.preferredFaithJourney) ||
      !data.preferredGender ||
      !hasSelections(data.preferredChurchAttendance) ||
      !hasSelections(data.preferredRelationshipGoals) ||
      data.minAge === null ||
      data.minAge === undefined ||
      data.maxAge === null ||
      data.maxAge === undefined ||
      data.minAge > data.maxAge ||
      data.maxDistance === null ||
      data.maxDistance === undefined ||
      data.preferredMinHeight === null ||
      data.preferredMinHeight === undefined)
  ) {
    return "Please complete every partner preference on this step.";
  }

  return null;
};

// --- MAIN COMPONENT ---
const OnboardingPage = () => {
  const navigate = useNavigate();
  const { completeOnboarding, isCompletingOnboarding, user } =
    useAuthContext() as {
      completeOnboarding: (data: any) => Promise<boolean>;
      isCompletingOnboarding: boolean;
      user: { uid?: string | null; id?: string | null } | null;
    };

  const [currentStep, setCurrentStep] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmittingFinalStep, setIsSubmittingFinalStep] = useState(false);
  const [submissionStage, setSubmissionStage] = useState<
    "idle" | "uploading" | "saving"
  >("idle");
  const totalSteps = 5;
  const [direction, setDirection] = useState<1 | -1>(1);

  const SLIDE_VARIANTS = {
    enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 60 : -60 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -60 : 60 }),
  };

  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    age: undefined,
    gender: undefined,
    photos: [],
    birthday: "",
    location: "",
    latitude: undefined,
    longitude: undefined,
    faithJourney: null as any,
    churchAttendance: null as any,
    denomination: "",
    customDenomination: "",
    occupation: "",
    bio: "",
    personality: [],
    hobbies: [],
    values: [],
    profileFits: [],
    favoriteVerse: "",
    height: "",
    language: "",
    languageSpoken: [],
    personalPromptQuestion: "",
    personalPromptAnswer: "",
    communicationStyle: [],
    loveStyle: [],
    educationLevel: "",
    zodiacSign: "",
    drinkingHabit: "",
    smokingHabit: "",
    workoutHabit: "",
    petPreference: "",
    relationshipGoals: [],
    preferredGender: null,
    minAge: 18,
    maxAge: 35,
    maxDistance: 50,
    preferredMinHeight: 160,
    phoneNumber: "",
    countryCode: "+1",
    education: "",
    baptismStatus: "",
    spiritualGifts: [],
    interests: [],
    lifestyle: "",
    preferredFaithJourney: null,
    preferredChurchAttendance: null,
    preferredRelationshipGoals: null,
    preferredDenomination: null,
  });

  useEffect(() => {
    if (!validationError) return;
    const stepError = getStepValidationError(currentStep, onboardingData);
    if (!stepError) {
      setValidationError(null);
    }
  }, [currentStep, onboardingData, validationError]);

  const canProceedToNext = !getStepValidationError(currentStep, onboardingData);

  // --- STEP CONTROLS ---
  const nextStep = async () => {
    setValidationError(null);

    // --- Validation per step ---
    const stepError = getStepValidationError(currentStep, onboardingData);
    if (stepError) {
      return setValidationError(stepError);
    }

    // --- Continue or Submit ---
    if (currentStep < totalSteps - 1) {
      setDirection(1);
      setCurrentStep(currentStep + 1);
      return;
    }

    // --- Final Submission ---
    setIsSubmittingFinalStep(true);
    setSubmissionStage("uploading");

    try {
      await waitForNextPaint();

      const userId = user?.uid || user?.id;
      if (!userId) throw new Error("User not authenticated.");
      if (onboardingData.photos.length < MIN_ONBOARDING_PHOTOS) {
        throw new Error(
          `Please upload at least ${MIN_ONBOARDING_PHOTOS} photos before completing onboarding.`,
        );
      }

      // --- UPLOAD PHOTOS TO CLOUDINARY ---
      const photoUrls = await uploadPhotosToCloudinary(
        onboardingData.photos as File[],
      );

      // Merge photo URLs with other data
      const { photos: _, customDenomination: __, ...baseData } = onboardingData;
      const rawData = {
        ...baseData,
        // Keep legacy keys and persist canonical profile keys used across the app.
        profession: onboardingData.occupation,
        fieldOfStudy: onboardingData.education,
        language:
          onboardingData.languageSpoken?.[0] || onboardingData.language || "",
      } as Record<string, any>;

      // 'all' denomination preference means no filter — send null so backend skips the denomination filter
      if (rawData.preferredDenomination === 'all') {
        rawData.preferredDenomination = null;
      }

      // Assign Cloudinary URLs to profilePhoto1,2,3,4
      photoUrls.forEach((url, index) => {
        (rawData as any)[`profilePhoto${index + 1}`] = url;
      });
      rawData.profilePhotoCount = photoUrls.length;

      // Remove null/undefined/empty strings
      const dataToSubmit: OnboardingUpdateData = {};
      Object.entries(rawData).forEach(([key, value]) => {
        if (
          value !== null &&
          value !== undefined &&
          !(typeof value === "string" && value.trim() === "")
        ) {
          (dataToSubmit as any)[key] = value;
        }
      });

      setSubmissionStage("saving");

      const success = await completeOnboarding({
        ...dataToSubmit,
        birthday: dataToSubmit.birthday
          ? new Date(dataToSubmit.birthday)
          : undefined,
      });

      if (success) {
        try {
          localStorage.setItem("faithbliss_show_post_onboarding_offer", "1");
          // Write onboardingCompleted synchronously so AuthGate's localStorage
          // fallback sees it before React state commits, preventing a redirect
          // loop back to /onboarding on iOS and slow devices.
          const raw = localStorage.getItem("user");
          if (raw) {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            parsed.onboardingCompleted = true;
            localStorage.setItem("user", JSON.stringify(parsed));
          }
        } catch {
          // Ignore localStorage access errors.
        }
        navigate("/dashboard", { replace: true });
      } else {
        throw new Error("Onboarding failed. Please try again.");
      }
    } catch (err: any) {
      setValidationError(getSubmissionErrorMessage(err));
      console.error("❌ Onboarding error:", err);
    } finally {
      setIsSubmittingFinalStep(false);
      setSubmissionStage("idle");
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep(currentStep - 1);
    }
  };

  // Scroll the focused element into view when the on-screen keyboard opens,
  // so dropdowns and inputs are never hidden behind it.
  useEffect(() => {
    const handleViewportResize = () => {
      const focused = document.activeElement as HTMLElement | null;
      if (focused && focused !== document.body) {
        setTimeout(() => focused.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 100);
      }
    };
    window.visualViewport?.addEventListener('resize', handleViewportResize);
    return () => window.visualViewport?.removeEventListener('resize', handleViewportResize);
  }, []);

  return (
    <div className="h-dvh overflow-y-auto overflow-x-hidden overscroll-none bg-gray-950 text-white">
      <OnboardingHeader
        currentSlide={currentStep}
        totalSlides={totalSteps}
        onPrevious={prevStep}
        canGoBack={currentStep > 0}
      />

      <main className="container mx-auto max-w-full px-4 sm:px-6 py-6 pb-[calc(env(safe-area-inset-bottom,0px)+160px)] sm:max-w-2xl">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={SLIDE_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
          >
            {currentStep === 0 && (
              <ImageUploadSlide
                isVisible={true}
                onboardingData={onboardingData}
                setOnboardingData={setOnboardingData}
              />
            )}
            {currentStep === 1 && (
              <LocationPermissionSlide
                isVisible={true}
                onboardingData={onboardingData}
                setOnboardingData={setOnboardingData}
                showValidationErrors={Boolean(validationError) && currentStep === 1}
                onLocationResolved={() => {
                  void nextStep();
                }}
              />
            )}
            {currentStep === 2 && (
              <ProfileBuilderSlide
                isVisible={true}
                onboardingData={onboardingData}
                setOnboardingData={setOnboardingData}
                showValidationErrors={Boolean(validationError) && currentStep === 2}
              />
            )}
            {currentStep === 3 && (
              <RelationshipGoalsSlide
                isVisible={true}
                onboardingData={onboardingData}
                setOnboardingData={setOnboardingData}
                showValidationErrors={Boolean(validationError) && currentStep === 3}
              />
            )}
            {currentStep === 4 && (
              <PartnerPreferencesSlide
                isVisible={true}
                onboardingData={onboardingData}
                setOnboardingData={setOnboardingData}
                showValidationErrors={Boolean(validationError) && currentStep === 4}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <OnboardingNavigation
        currentSlide={currentStep}
        totalSlides={totalSteps}
        canGoBack={currentStep > 0}
        canProceed={canProceedToNext}
        submitting={isCompletingOnboarding || isSubmittingFinalStep}
        submittingLabel={
          submissionStage === "uploading"
            ? "Uploading photos..."
            : "Saving profile..."
        }
        validationError={validationError}
        onPrevious={prevStep}
        onNext={nextStep}
      />
    </div>
  );
};

export default function OnboardingRouteWrapper() {
  return (
    <ProtectedRoute requireOnboarding={true}>
      <OnboardingPage />
    </ProtectedRoute>
  );
}
