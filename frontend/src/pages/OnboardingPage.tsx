/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
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

  if (
    step === 2 &&
    (!hasText(data.location) ||
      !hasValidBirthday() ||
      !data.faithJourney ||
      !data.churchAttendance ||
      !hasText(data.denomination) ||
      !hasText(data.baptismStatus) ||
      !hasText(data.occupation) ||
      !hasText(data.education) ||
      !hasText(data.favoriteVerse) ||
      !hasText(data.height) ||
      !hasSelections(data.languageSpoken) ||
      !hasPhoneNumber(data.phoneNumber) ||
      !hasText(data.countryCode) ||
      !hasSelections(data.profileFits, MIN_PROFILE_FITS) ||
      !hasSelections(data.personality) ||
      !hasSelections(data.hobbies) ||
      !hasSelections(data.values) ||
      !hasSelections(data.spiritualGifts) ||
      !data.gender)
  ) {
    return `Please complete every profile field on this step and pick at least ${MIN_PROFILE_FITS} profile fit options.`;
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
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <OnboardingHeader
        currentSlide={currentStep}
        totalSlides={totalSteps}
        onPrevious={prevStep}
        canGoBack={currentStep > 0}
      />

      <main className="container mx-auto px-4 sm:px-6 py-8 pb-48 max-w-2xl">
        <div className="bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-2xl">
          <ImageUploadSlide
            isVisible={currentStep === 0}
            onboardingData={onboardingData}
            setOnboardingData={setOnboardingData}
          />
          <ProfileBuilderSlide
            isVisible={currentStep === 2}
            onboardingData={onboardingData}
            setOnboardingData={setOnboardingData}
            showValidationErrors={Boolean(validationError) && currentStep === 2}
          />
          <LocationPermissionSlide
            isVisible={currentStep === 1}
            onboardingData={onboardingData}
            setOnboardingData={setOnboardingData}
            showValidationErrors={Boolean(validationError) && currentStep === 1}
            onLocationResolved={() => {
              void nextStep();
            }}
          />
          <RelationshipGoalsSlide
            isVisible={currentStep === 3}
            onboardingData={onboardingData}
            setOnboardingData={setOnboardingData}
            showValidationErrors={Boolean(validationError) && currentStep === 3}
          />
          <PartnerPreferencesSlide
            isVisible={currentStep === 4}
            onboardingData={onboardingData}
            setOnboardingData={setOnboardingData}
            showValidationErrors={Boolean(validationError) && currentStep === 4}
          />
        </div>
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
