// src/hooks/useAuth.tsx (FINAL FIX - Using Firestore)

/* eslint-disable no-irregular-whitespace */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useCallback, useRef } from "react";
import { useToast } from "@/contexts/ToastContext";
import { useAuthContext } from "../contexts/AuthContext";
import type { User } from "@/types/User";
import { API } from "@/services/api";

//  FIREBASE IMPORTS
import {
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "firebase/auth";
import type { User as FirebaseAuthUser } from "firebase/auth";
//  NEW FIREBASE IMPORTS FOR FIRESTORE
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, serverTimestamp } from "@/firebase/config"; // Assuming db and serverTimestamp are exported
import { useClearApiCache } from "./useAPI";

// --------------------
//  CORRECTED Interface for Onboarding Data (accepts all fields, including the resulting photo URLs)
// The OnboardingPage must ensure photos are uploaded to Storage *before* calling this function
// and pass the resulting URLs here.
interface OnboardingData {
  age?: number;
  bio?: string;
  location?: string;
  denomination?: string;
  latitude?: number; // Added
  longitude?: number; // Added
  phoneNumber?: string; // Added
  countryCode?: string; // Added
  birthday?: Date | string; // Added
  education?: string; // Legacy onboarding key
  occupation?: string; // Legacy onboarding key
  fieldOfStudy?: string; // Added
  profession?: string; // Added
  faithJourney?: string; // Added
  sundayActivity?: string; // Added
  churchAttendance?: string; // Added
  baptismStatus?: string; // Added
  lookingFor?: string[]; // Added
  relationshipGoals?: string[]; // Added
  hobbies?: string[]; // Added
  interests?: string[]; // Added
  values?: string[]; // Added
  profileFits?: string[]; // Added
  spiritualGifts?: string[]; // Added
  personality?: string[]; // Added
  favoriteVerse?: string; // Added
  lifestyle?: string; // Added
  drinkingHabit?: string; // Added
  smokingHabit?: string; // Added
  workoutHabit?: string; // Added
  petPreference?: string; // Added
  height?: string; // Added
  language?: string; // Added
  languageSpoken?: string[]; // Added
  personalPromptQuestion?: string; // Added
  personalPromptAnswer?: string; // Added
  communicationStyle?: string[]; // Added
  loveStyle?: string[]; // Added
  educationLevel?: string; // Added
  zodiacSign?: string; // Added
  preferredFaithJourney?: string[] | null; // Added
  preferredChurchAttendance?: string[] | null; // Added
  preferredRelationshipGoals?: string[] | null; // Added
  preferredDenomination?: string | null; // Added
  preferredGender?: string | null; // Added
  minAge?: number; // Added
  maxAge?: number; // Added
  maxDistance?: number; // Added
  preferredMinHeight?: number; // Added
  profilePhoto1?: string; // Expecting the final Cloud Storage URL
  profilePhoto2?: string;
  profilePhoto3?: string;
  profilePhoto4?: string;
  profilePhoto5?: string;
  profilePhoto6?: string;
  profilePhotoCount?: number;
  [key: string]: any; // Allow for dynamic fields to be passed
}

const GOOGLE_REDIRECT_PENDING_KEY = "faithbliss_google_redirect_pending";
const GOOGLE_REDIRECT_PENDING_PERSIST_KEY = "faithbliss_google_redirect_pending_persist";
const PRIMARY_ADMIN_EMAIL = import.meta.env.VITE_PRIMARY_ADMIN_EMAIL ?? '';
const FEATURE_SETTINGS_CACHE_KEY = "faithbliss:feature-settings-cache";
const FEATURE_SETTINGS_SYNC_KEY = "faithbliss:feature-settings-updated-at";

const resolveUserRole = (email: unknown, role: unknown): User["role"] => {
  if (
    typeof email === "string" &&
    email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL
  ) {
    return "admin";
  }

  if (typeof role === "string" && role.trim()) {
    return role;
  }

  return "user";
};

const normalizeUserRoles = (email: unknown, roles: unknown): string[] => {
  const normalizedRoles = Array.isArray(roles)
    ? roles
        .filter((role): role is string => typeof role === "string")
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean)
    : [];

  if (
    typeof email === "string" &&
    email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL
  ) {
    return Array.from(new Set([...normalizedRoles, "developer"]));
  }

  return Array.from(new Set(normalizedRoles));
};

const isFirebaseNetworkError = (error: unknown): boolean => {
  const candidates = [
    error,
    (error as { reason?: unknown })?.reason,
    (error as { error?: unknown })?.error,
  ];

  return candidates.some((candidate) => {
    const code = (candidate as { code?: unknown })?.code;
    const message = (candidate as { message?: unknown })?.message;
    return (
      (typeof code === "string" && code === "auth/network-request-failed") ||
      (typeof message === "string" &&
        (message.includes("auth/network-request-failed") ||
          message.toLowerCase().includes("network request failed")))
    );
  });
};

const getAuthErrorMessage = (error: unknown, fallback: string): string => {
  const message = (error as { message?: unknown })?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
};

const getStoredUserSnapshot = (): User | null => {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem("user");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as User;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const getStoredAccessToken = (): string | null => {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("accessToken");
  return typeof token === "string" && token.trim() ? token : null;
};

const hasPendingGoogleRedirect = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    sessionStorage.getItem(GOOGLE_REDIRECT_PENDING_KEY) === "1" ||
    localStorage.getItem(GOOGLE_REDIRECT_PENDING_PERSIST_KEY) === "1"
  );
};

const clearPendingGoogleRedirect = (): void => {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(GOOGLE_REDIRECT_PENDING_KEY);
  localStorage.removeItem(GOOGLE_REDIRECT_PENDING_PERSIST_KEY);
};


// Returns true when the current environment must use signInWithRedirect instead
// of signInWithPopup.
//
// iOS Safari (non-standalone and standalone) now uses signInWithPopup. Firebase
// v10+ popup flow works on iOS Safari because the popup window itself is a
// first-party context for firebaseapp.com — ITP does not clear its storage.
// signInWithRedirect was the previous fix, but ITP partitions/clears the
// IndexedDB state token stored by firebaseapp.com when the main page navigates
// away, so getRedirectResult returns null on return and the user lands back on
// the login page.
//
// Only true in-app browsers that block popups entirely still need the redirect.
const shouldUseRedirectForGoogleAuth = (): boolean => {
  if (typeof navigator === "undefined" || typeof window === "undefined")
    return false;
  const ua = navigator.userAgent;

  // In-app browsers that intercept window.open and block cross-origin popups
  return /FBAN|FBAV|Instagram|Twitter|Line|WeChat|MicroMessenger/.test(ua);
};

const getAppBaseUrl = (): string => {
  if (typeof window !== "undefined" && window.location.origin) {
    return window.location.origin;
  }

  const configuredBaseUrl = String(import.meta.env.VITE_APP_URL || "").trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  return "http://localhost:5173";
};

const sanitizeText = (value: unknown, maxLen: number): string | undefined => {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, maxLen);
};

const sanitizeArray = (
  value: unknown,
  maxItems: number | null = 20,
  maxLen = 60,
): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value
    .filter((item) => typeof item === "string")
    .map((item) => (item as string).trim())
    .filter(Boolean)
    .map((item) => item.slice(0, maxLen));

  return maxItems === null ? cleaned : cleaned.slice(0, maxItems);
};

const sanitizeOnboardingPayload = (
  payload: OnboardingData,
): Record<string, any> => {
  const result: Record<string, any> = {};

  const textFields: Array<[keyof OnboardingData, number]> = [
    ["name", 120],
    ["bio", 500],
    ["location", 160],
    ["denomination", 80],
    ["gender", 20],
    ["phoneNumber", 30],
    ["countryCode", 8],
    ["education", 120],
    ["occupation", 120],
    ["fieldOfStudy", 120],
    ["profession", 120],
    ["favoriteVerse", 120],
    ["lifestyle", 80],
    ["drinkingHabit", 80],
    ["smokingHabit", 80],
    ["workoutHabit", 80],
    ["petPreference", 80],
    ["height", 20],
    ["language", 60],
    ["personalPromptQuestion", 120],
    ["personalPromptAnswer", 280],
    ["educationLevel", 80],
    ["zodiacSign", 40],
    ["faithJourney", 40],
    ["churchAttendance", 40],
    ["sundayActivity", 40],
    ["baptismStatus", 40],
    ["preferredDenomination", 80],
    ["preferredGender", 20],
  ];

  textFields.forEach(([field, maxLen]) => {
    const value = sanitizeText(payload[field], maxLen);
    if (value !== undefined) result[field] = value;
  });

  const arrayFields: Array<[keyof OnboardingData, number | null]> = [
    ["relationshipGoals", 20],
    ["lookingFor", 20],
    ["hobbies", 20],
    ["values", 20],
    ["interests", null],
    ["profileFits", 20],
    ["languageSpoken", 20],
    ["communicationStyle", 20],
    ["loveStyle", 20],
    ["spiritualGifts", 20],
    ["preferredFaithJourney", 20],
    ["preferredChurchAttendance", 20],
    ["preferredRelationshipGoals", 20],
    ["personality", 20],
  ];

  arrayFields.forEach(([field, maxItems]) => {
    const value = sanitizeArray(payload[field], maxItems);
    if (value !== undefined) result[field] = value;
  });

  if (payload.birthday instanceof Date) {
    result.birthday = payload.birthday;
  } else if (typeof payload.birthday === "string" && payload.birthday.trim()) {
    const parsed = new Date(payload.birthday);
    if (!Number.isNaN(parsed.getTime())) result.birthday = parsed;
  }

  const numericBounds: Array<[keyof OnboardingData, number, number, boolean]> =
    [
      ["age", 18, 99, true],
      ["latitude", -90, 90, false],
      ["longitude", -180, 180, false],
      ["minAge", 18, 99, true],
      ["maxAge", 18, 99, true],
      ["maxDistance", 1, 500, true],
      ["preferredMinHeight", 120, 220, true],
      ["profilePhotoCount", 0, 6, true],
    ];

  numericBounds.forEach(([field, min, max, integer]) => {
    const value = payload[field];
    if (typeof value !== "number" || Number.isNaN(value)) return;
    const bounded = Math.min(max, Math.max(min, value));
    result[field] = integer ? Math.round(bounded) : bounded;
  });

  for (let i = 1; i <= 6; i++) {
    const key = `profilePhoto${i}`;
    const url = sanitizeText((payload as Record<string, any>)[key], 500);
    if (url !== undefined) result[key] = url;
  }

  if (
    typeof result.occupation === "string" &&
    typeof result.profession !== "string"
  ) {
    result.profession = result.occupation;
  }

  if (
    typeof result.education === "string" &&
    typeof result.fieldOfStudy !== "string"
  ) {
    result.fieldOfStudy = result.education;
  }

  if (
    typeof result.churchAttendance === "string" &&
    typeof result.sundayActivity !== "string"
  ) {
    result.sundayActivity = result.churchAttendance;
  }

  return result;
};

const getProfilePhotoCount = (payload: Record<string, any>): number => {
  if (
    typeof payload.profilePhotoCount === "number" &&
    Number.isFinite(payload.profilePhotoCount)
  ) {
    return Math.max(0, Math.min(6, Math.round(payload.profilePhotoCount)));
  }

  let count = 0;
  for (let i = 1; i <= 6; i++) {
    const value = payload[`profilePhoto${i}`];
    if (typeof value === "string" && value.trim()) {
      count += 1;
    }
  }
  return count;
};

const timestampToIsoString = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string" && value.trim()) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString();
  if (
    typeof value === "object" &&
    value &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const converted = (value as { toDate: () => Date }).toDate();
    if (!Number.isNaN(converted.getTime())) {
      return converted.toISOString();
    }
  }
  return undefined;
};

const normalizeSubscription = (
  subscription: Record<string, any> | undefined,
) => {
  if (!subscription || typeof subscription !== "object") {
    return undefined;
  }

  const nextPaymentDate = timestampToIsoString(subscription.nextPaymentDate);
  const updatedAt = timestampToIsoString(subscription.updatedAt);

  return {
    status:
      typeof subscription.status === "string" ? subscription.status : undefined,
    tier: typeof subscription.tier === "string" ? subscription.tier : undefined,
    currency:
      typeof subscription.currency === "string"
        ? subscription.currency
        : undefined,
    billingCycle:
      typeof subscription.billingCycle === "string"
        ? subscription.billingCycle
        : undefined,
    pricingRegion:
      typeof subscription.pricingRegion === "string"
        ? subscription.pricingRegion
        : undefined,
    displayCurrency:
      typeof subscription.displayCurrency === "string"
        ? subscription.displayCurrency
        : undefined,
    displayAmountMajor:
      typeof subscription.displayAmountMajor === "number"
        ? subscription.displayAmountMajor
        : undefined,
    chargeAmountMajor:
      typeof subscription.chargeAmountMajor === "number"
        ? subscription.chargeAmountMajor
        : undefined,
    chargeAmountSubunits:
      typeof subscription.chargeAmountSubunits === "number"
        ? subscription.chargeAmountSubunits
        : undefined,
    exchangeRate:
      typeof subscription.exchangeRate === "number"
        ? subscription.exchangeRate
        : undefined,
    planCode:
      typeof subscription.planCode === "string"
        ? subscription.planCode
        : undefined,
    reference:
      typeof subscription.reference === "string"
        ? subscription.reference
        : undefined,
    customerCode:
      typeof subscription.customerCode === "string"
        ? subscription.customerCode
        : undefined,
    subscriptionCode:
      typeof subscription.subscriptionCode === "string"
        ? subscription.subscriptionCode
        : undefined,
    authorizationCode:
      typeof subscription.authorizationCode === "string"
        ? subscription.authorizationCode
        : undefined,
    renewalProvider:
      typeof subscription.renewalProvider === "string"
        ? subscription.renewalProvider
        : undefined,
    autoRenewEnabled:
      typeof subscription.autoRenewEnabled === "boolean"
        ? subscription.autoRenewEnabled
        : undefined,
    autoRenewDisabledAt: timestampToIsoString(subscription.autoRenewDisabledAt),
    nextPaymentDate,
    updatedAt,
  };
};

//  FIX 1: Update User interface to include all fields from the Mongoose model

export type AuthHookReturn = ReturnType<typeof useAuth>;

// ---------------------------------------------------------------------
//  REPLACEMENT: Helper to fetch custom user data directly from Firestore
// ---------------------------------------------------------------------
const fetchUserDataFromFirestore = async (
  fbUser: FirebaseAuthUser,
): Promise<User | null> => {
  //  DEBUG LOG 1: Check if the user is present
  if (!fbUser || !fbUser.uid) {
    throw new Error(
      "Cannot fetch Firestore data: Firebase user is null or missing UID.",
    );
  }

  const docRef = doc(db, "users", fbUser.uid);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const backendData = docSnap.data();
  const normalizedSubscription = normalizeSubscription(
    backendData.subscription,
  );

  //  FIX 2: Map ALL fields from backendData to the complete User interface
  return {
    id: fbUser.uid,
    email: fbUser.email!,
    name: backendData.name || "User",
    role: resolveUserRole(backendData.email || fbUser.email, backendData.role),
    roles: normalizeUserRoles(
      backendData.email || fbUser.email,
      backendData.roles,
    ),
    onboardingCompleted: backendData.onboardingCompleted || false,
    emailVerified: fbUser.emailVerified === true || backendData.emailVerified === true,

    // Core fields (must exist if registration completed)
    age: backendData.age || 0,
    gender: backendData.gender || "MALE",
    denomination: backendData.denomination || "",
    bio: backendData.bio || "",
    location: backendData.location || "",

    // Optional/Onboarding fields
    latitude: backendData.latitude,
    longitude: backendData.longitude,
    phoneNumber: backendData.phoneNumber,
    countryCode: backendData.countryCode,
    passportCountry: backendData.passportCountry || null,
    birthday: backendData.birthday
      ? new Date(backendData.birthday.seconds * 1000)
      : undefined, // Handle Firestore Timestamp
    fieldOfStudy: backendData.fieldOfStudy || backendData.education,
    profession: backendData.profession || backendData.occupation,
    faithJourney: backendData.faithJourney,
    sundayActivity: backendData.sundayActivity || backendData.churchAttendance,
    churchAttendance:
      backendData.churchAttendance || backendData.sundayActivity,
    baptismStatus: backendData.baptismStatus,
    spiritualGifts: backendData.spiritualGifts,
    relationshipGoals: backendData.relationshipGoals,
    lifestyle: backendData.lifestyle,
    lookingFor: backendData.lookingFor,
    personality: backendData.personality,
    hobbies: backendData.hobbies,
    interests: backendData.interests,
    values: backendData.values,
    profileFits: backendData.profileFits,
    favoriteVerse: backendData.favoriteVerse,
    drinkingHabit: backendData.drinkingHabit,
    smokingHabit: backendData.smokingHabit,
    workoutHabit: backendData.workoutHabit,
    petPreference: backendData.petPreference,
    height: backendData.height,
    language: backendData.language,
    languageSpoken: backendData.languageSpoken,
    personalPromptQuestion: backendData.personalPromptQuestion,
    personalPromptAnswer: backendData.personalPromptAnswer,
    communicationStyle: backendData.communicationStyle,
    loveStyle: backendData.loveStyle,
    educationLevel: backendData.educationLevel,
    zodiacSign: backendData.zodiacSign,
    preferredFaithJourney: backendData.preferredFaithJourney,
    preferredChurchAttendance: backendData.preferredChurchAttendance,
    preferredRelationshipGoals: backendData.preferredRelationshipGoals,
    preferredDenomination: backendData.preferredDenomination,
    preferredGender: backendData.preferredGender,
    minAge: backendData.minAge,
    maxAge: backendData.maxAge,
    maxDistance: backendData.maxDistance,
    preferredMinHeight: backendData.preferredMinHeight,

    // Photo URLs
    profilePhoto1: backendData.profilePhoto1,
    profilePhoto2: backendData.profilePhoto2,
    profilePhoto3: backendData.profilePhoto3,
    profilePhoto4: backendData.profilePhoto4,
    profilePhoto5: backendData.profilePhoto5,
    profilePhoto6: backendData.profilePhoto6,
    profilePhotoCount: getProfilePhotoCount(backendData),
    subscriptionStatus:
      backendData.subscriptionStatus || normalizedSubscription?.status,
    subscriptionTier:
      backendData.subscriptionTier || normalizedSubscription?.tier,
    subscriptionCurrency:
      backendData.subscriptionCurrency || normalizedSubscription?.currency,
    profileBoosterCredits:
      typeof backendData.profileBoosterCredits === "number"
        ? backendData.profileBoosterCredits
        : 0,
    profileBoosterActiveUntil:
      typeof backendData.profileBoosterActiveUntil === "string"
        ? backendData.profileBoosterActiveUntil
        : null,
    profileBoosterLastGrantedReference:
      typeof backendData.profileBoosterLastGrantedReference === "string"
        ? backendData.profileBoosterLastGrantedReference
        : null,
    profileBoosterLastUsedAt:
      typeof backendData.profileBoosterLastUsedAt === "string"
        ? backendData.profileBoosterLastUsedAt
        : null,
    subscription: normalizedSubscription,
    settings: backendData.settings,
    isActive: backendData.isActive !== false,
  };
};

// Ensure a Firestore profile exists for Google OAuth users.
// Also migrates existing email/password accounts: if Firebase says the email
// is verified (always true for Google), we write that to Firestore so legacy
// users who switch to Google are not stuck in an unverified state.
const ensureUserProfile = async (fbUser: FirebaseAuthUser) => {
  const userDocRef = doc(db, "users", fbUser.uid);
  const docSnap = await getDoc(userDocRef);

  if (!docSnap.exists()) {
    await setDoc(userDocRef, {
      email: fbUser.email || "",
      name: fbUser.displayName || "New User",
      role: resolveUserRole(fbUser.email, undefined),
      roles: [],
      age: 0,
      gender: "MALE",
      denomination: "",
      location: "",
      bio: "",
      onboardingCompleted: false,
      emailVerified: true,
      profilePhotoCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else if (fbUser.emailVerified === true) {
    // Propagate Firebase's verified state to Firestore for migrating
    // existing users whose Firestore record still has emailVerified: false.
    const data = docSnap.data();
    if (data.emailVerified !== true) {
      await updateDoc(userDocRef, {
        emailVerified: true,
        updatedAt: serverTimestamp(),
      });
    }
  }
};

export function useAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showSuccess, showError } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCompletingOnboarding, setIsCompletingOnboarding] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const lastNetworkToastAtRef = useRef(0);

  const clearApiCache = useClearApiCache();

  const clearAppStorage = useCallback(() => {
    localStorage.removeItem("user");
    localStorage.removeItem("faithbliss-auth");
    localStorage.removeItem("authToken");
    localStorage.removeItem("accessToken");
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("faithbliss_google_redirect_pending");
    localStorage.removeItem("faithbliss_onboarding_pause_state");
    localStorage.removeItem("faithbliss_show_post_onboarding_offer");
    localStorage.removeItem(FEATURE_SETTINGS_CACHE_KEY);
    localStorage.removeItem(FEATURE_SETTINGS_SYNC_KEY);
    Object.keys(localStorage)
      .filter(
        (k) =>
          k.startsWith("faithbliss_seen_notifications:") ||
          k.startsWith("faithbliss_notification_prompt_seen:") ||
          k.startsWith("faithbliss_dashboard_passed_profiles:")
      )
      .forEach((k) => localStorage.removeItem(k));
    clearApiCache();
  }, [clearApiCache]);

  const isAuthenticated = !!(accessToken && user);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isFirebaseNetworkError(event.reason)) return;
      event.preventDefault();
      const now = Date.now();
      if (now - lastNetworkToastAtRef.current > 10000) {
        showError(
          "Network issue while contacting Firebase. Please check your internet and retry.",
          "Network Error",
        );
        lastNetworkToastAtRef.current = now;
      }
      console.warn("Suppressed unhandled Firebase network rejection.");
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  }, [showError]);

  const syncUserFromFirebase = useCallback(async (fbUser: FirebaseAuthUser) => {
    // 1. Get the current, secure ID Token (still needed for any future custom backend calls)
    let token: string | null = null;
    try {
      token = await fbUser.getIdToken();
      setAccessToken(token);
      localStorage.setItem("accessToken", token);
    } catch (tokenError) {
      if (!isFirebaseNetworkError(tokenError)) {
        throw tokenError;
      }

      token = getStoredAccessToken();
      if (token) {
        console.warn(
          "Using cached Firebase token due to a temporary network issue.",
        );
        setAccessToken(token);
      } else {
        console.warn(
          "Firebase token refresh failed due to network and no cached token is available.",
        );
        setAccessToken(null);
      }
    }

    const persistUser = (userToPersist: User) => {
      setUser(userToPersist);
      localStorage.setItem("user", JSON.stringify(userToPersist));
    };

    const minimalUser: User = {
      id: fbUser.uid,
      email: fbUser.email!,
      name: fbUser.displayName || "New User",
      onboardingCompleted: false,
      emailVerified: fbUser.emailVerified === true,
      age: 0,
      // Default values for required fields
      gender: "MALE",
      denomination: "",
      bio: "",
      location: "",
    };

    try {
      // 2. Fetch/Sync custom user data from FIRESTORE
      let userToStore = await fetchUserDataFromFirestore(fbUser);

      if (!userToStore) {
        try {
          await ensureUserProfile(fbUser);
          userToStore = await fetchUserDataFromFirestore(fbUser);
        } catch (profileError) {
          console.error(" Failed to create Firestore profile:", profileError);
        }
      }

      if (userToStore) {
        persistUser(userToStore);
        return;
      }

      const cachedUser = getStoredUserSnapshot();
      if (cachedUser?.id === fbUser.uid) {
        console.warn(
          "Using cached user profile because Firestore returned no profile during a network issue.",
        );
        persistUser({
          ...cachedUser,
          email: fbUser.email || cachedUser.email,
          id: fbUser.uid,
        });
        return;
      }

      // Fallback to minimal user if Firestore is unavailable
      persistUser(minimalUser);
    } catch (error) {
      console.error(" Firestore sync failed, using minimal user:", error);
      const cachedUser = getStoredUserSnapshot();
      if (cachedUser?.id === fbUser.uid) {
        console.warn(
          "Using cached user profile due to Firestore sync failure.",
        );
        persistUser({
          ...cachedUser,
          email: fbUser.email || cachedUser.email,
          id: fbUser.uid,
        });
        return;
      }
      persistUser(minimalUser);
    }
  }, []);

  // -----------------------------------------------------------
  //  Firebase Auth State Listener (Now using Firestore Sync)
  // -----------------------------------------------------------

  useEffect(() => {
    setIsLoading(true);
    let resolved = false;

    // Safety net: if onAuthStateChanged never fires (iOS ITP / Firebase redirect
    // session not resolved), unblock the UI after 8 seconds so the user sees
    // the login page instead of a frozen spinner.
    const safetyTimer = setTimeout(() => {
      if (!resolved) {
        console.warn("Auth state listener timed out — clearing loading state.");
        setIsLoading(false);
      }
    }, 8000);

    const unsubscribe = onAuthStateChanged(
      auth,
      async (fbUser: FirebaseAuthUser | null) => {
        resolved = true;
        clearTimeout(safetyTimer);
        if (fbUser) {
          try {
            await syncUserFromFirebase(fbUser);
          } catch (e: any) {
            if (isFirebaseNetworkError(e)) {
              console.warn(
                "Firebase sync skipped due to temporary network issue.",
              );
              const cachedUser = getStoredUserSnapshot();
              const cachedToken = getStoredAccessToken();
              if (cachedUser?.id === fbUser.uid) {
                setUser({
                  ...cachedUser,
                  email: fbUser.email || cachedUser.email,
                  id: fbUser.uid,
                });
              }
              if (cachedToken) {
                setAccessToken(cachedToken);
              }
            } else {
              // Firestore sync failed for a non-network reason (permission error,
              // malformed doc, quota, etc.). Do NOT sign out — the Firebase auth
              // session is valid. Fall back to cached profile or minimal user so
              // the session survives and the user reaches the app.
              console.error("Firebase/Firestore sync failed:", e);
              const cachedUser = getStoredUserSnapshot();
              const cachedToken = getStoredAccessToken();
              if (cachedUser?.id === fbUser.uid) {
                setUser({
                  ...cachedUser,
                  email: fbUser.email || cachedUser.email,
                  id: fbUser.uid,
                });
              } else {
                setUser({
                  id: fbUser.uid,
                  email: fbUser.email!,
                  name: fbUser.displayName || "User",
                  onboardingCompleted: false,
                  emailVerified: fbUser.emailVerified === true,
                  age: 0,
                  gender: "MALE",
                  denomination: "",
                  bio: "",
                  location: "",
                });
              }
              if (cachedToken) setAccessToken(cachedToken);
            }
          }
        } else {
          // Logged out state
          setAccessToken(null);
          setUser(null);
          clearAppStorage();
        }
        setIsLoading(false);
      },
    );

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, [clearAppStorage, syncUserFromFirebase]);

  //  Refetch User (Now uses Firestore)
  const refetchUser = useCallback(async () => {
    try {
      const fbUser = auth.currentUser;
      if (!fbUser)
        throw new Error("No current Firebase user to refresh token.");

      // Use the new Firestore helper for refetching
      const userToStore = await fetchUserDataFromFirestore(fbUser);
      if (!userToStore)
        throw new Error("User profile not found in Firestore during refetch.");

      const freshToken = await fbUser.getIdToken();

      setUser(userToStore);
      setAccessToken(freshToken);
      localStorage.setItem("accessToken", freshToken);
      localStorage.setItem("user", JSON.stringify(userToStore));
    } catch (err) {
      console.error("Refetch user failed:", err);
    }
  }, []);

  // -----------------------------------------------------------
  //  Complete Onboarding (Uses Firestore Profile Update)
  // -----------------------------------------------------------

  //  6. Complete Onboarding (Uses Firestore SDK)
  const completeOnboarding = useCallback(
    // This parameter type is correct, as it contains all optional fields passed from the form
    async (onboardingData: OnboardingData) => {
      setIsCompletingOnboarding(true);
      const fbUser = auth.currentUser;
      if (!fbUser) {
        throw new Error("Authentication required to complete onboarding.");
      }

      try {
        const sanitizedPayload = sanitizeOnboardingPayload(onboardingData);
        await API.Auth.completeOnboarding(sanitizedPayload);

        const refreshedUser = await fetchUserDataFromFirestore(fbUser);

        // After successful update, manually update the local user state
        setUser((prevUser) => {
          const updatedUser: User = {
            ...(refreshedUser || prevUser || {
              id: fbUser.uid,
              email: fbUser.email || "",
              name: "User",
              age: 0,
              gender: "MALE",
              denomination: "",
              bio: "",
              location: "",
            }),
            ...sanitizedPayload,
            onboardingCompleted: true,
          };
          localStorage.setItem("user", JSON.stringify(updatedUser));
          return updatedUser;
        });

        showSuccess("Profile complete!", "Welcome to the App!");
        return true;
      } catch (error: any) {
        console.error("Firestore Onboarding failed:", error);
        showError(
          getAuthErrorMessage(error, "Failed to complete onboarding."),
          "Onboarding Error",
        );
        throw error;
      } finally {
        setIsCompletingOnboarding(false);
      }
    },
    [showSuccess, showError],
  );

  // -----------------------------------------------------------
  //  Logout and Refetch
  // -----------------------------------------------------------

  //  4. Logout (Uses Firebase SDK)
  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);

      clearPendingGoogleRedirect();
      clearAppStorage();
      // Clear cookies in the browser
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/");
      });

      showSuccess("You have been logged out", "Logout Successful");
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  }, [showSuccess, navigate, clearAppStorage]);

  // -----------------------------------------------------------
  // Handle the return from a signInWithRedirect flow.
  // onAuthStateChanged handles the full user sync; this effect only clears
  // pending flags and surfaces any redirect-specific errors (e.g. user
  // cancelled the Google consent screen, network failure mid-redirect).
  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          // Android Chrome sometimes resolves signInWithPopup as a redirect
          // internally — the result surfaces here instead of in the popup
          // callback. Mirror the popup success path so navigation fires.
          clearPendingGoogleRedirect();
          await ensureUserProfile(result.user);
          await syncUserFromFirebase(result.user);
          const freshProfile = await fetchUserDataFromFirestore(result.user);
          const hasOnboarded = freshProfile?.onboardingCompleted === true;
          navigate(hasOnboarded ? "/dashboard" : "/onboarding", { replace: true });
        } else if (hasPendingGoogleRedirect()) {
          // Redirect was initiated but returned no user — user likely cancelled.
          clearPendingGoogleRedirect();
        }
      })
      .catch((error: unknown) => {
        clearPendingGoogleRedirect();
        const code = (error as { code?: string })?.code;
        // Ignore user-cancelled or no-pending-redirect (normal startup path)
        if (
          !code ||
          code === "auth/user-cancelled" ||
          code === "auth/popup-closed-by-user" ||
          code === "auth/cancelled-popup-request" ||
          isFirebaseNetworkError(error)
        ) {
          return;
        }
        console.error("Google redirect sign-in error:", code, error);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------
  //  Google Sign-In (Firebase Auth + Firestore profile creation)
  // -----------------------------------------------------------

  const googleSignIn = useCallback(
    async (mode: "login" | "signup") => {
      if (mode === "signup") {
        setIsRegistering(true);
      } else {
        setIsLoggingIn(true);
      }

      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });

        if (shouldUseRedirectForGoogleAuth()) {
          // In-app browsers (Facebook, Instagram, etc.) intercept window.open and
          // block cross-origin popups. Use a full-page redirect for these only.
          // iOS Safari uses signInWithPopup (Firebase v10+ popup works correctly
          // on iOS; the redirect path is broken because ITP clears the OAuth state
          // token stored by firebaseapp.com when the page navigates away, so
          // getRedirectResult returns null on return and the user ends up back at login).
          sessionStorage.setItem(GOOGLE_REDIRECT_PENDING_KEY, "1");
          localStorage.setItem(GOOGLE_REDIRECT_PENDING_PERSIST_KEY, "1");
          await signInWithRedirect(auth, provider);
          // Browser navigates away; code below does not execute.
          return;
        }

        const result = await signInWithPopup(auth, provider);
        if (result?.user) {
          clearPendingGoogleRedirect();
          await ensureUserProfile(result.user);
          await syncUserFromFirebase(result.user);

          // Navigate immediately after state is fully settled. Reading Firestore
          // directly here so we don't race against the onAuthStateChanged listener
          // which runs concurrently and may not have committed to React state yet.
          const freshProfile = await fetchUserDataFromFirestore(result.user);
          const hasOnboarded = freshProfile?.onboardingCompleted === true;
          const destination = hasOnboarded ? "/dashboard" : "/onboarding";
          navigate(destination, { replace: true });
        }
      } catch (error: any) {
        console.error("Google sign-in failed:", error);
        if (isFirebaseNetworkError(error)) {
          showError(
            "Network error while contacting Google/Firebase. Check your connection and try again.",
            "Authentication Error",
          );
          return;
        }
        // User dismissed the Google consent screen — not an error to surface
        if (
          error?.code === "auth/popup-closed-by-user" ||
          error?.code === "auth/cancelled-popup-request" ||
          error?.code === "auth/user-cancelled"
        ) {
          return;
        }
        // This email is already registered with a different sign-in method
        // (e.g. a legacy email/password account). Guide the user to support.
        if (error?.code === "auth/account-exists-with-different-credential") {
          showError(
            "This email is linked to a different sign-in method. Please contact support to migrate your account to Google sign-in.",
            "Account Conflict",
          );
          return;
        }
        showError(
          getAuthErrorMessage(error, "Google sign-in failed"),
          "Authentication Error",
        );
        throw error;
      } finally {
        if (mode === "signup") {
          setIsRegistering(false);
        } else {
          setIsLoggingIn(false);
        }
      }
    },
    [showError, navigate],
  );

  const requestPasswordReset = useCallback(
    async (email: string) => {
      const normalizedEmail = typeof email === "string" ? email.trim() : "";
      if (!normalizedEmail) {
        throw new Error("Please enter your email address.");
      }

      const actionCodeSettings = {
        url: `${getAppBaseUrl()}/reset-password`,
        handleCodeInApp: true,
      };

      try {
        await sendPasswordResetEmail(auth, normalizedEmail, actionCodeSettings);
        showSuccess(
          "Password reset link sent. Check your email to continue.",
          "Reset Link Sent",
        );
      } catch (error: any) {
        const code = error?.code;
        if (code === "auth/user-not-found") {
          throw new Error("No account was found with that email address.");
        }
        if (code === "auth/invalid-email") {
          throw new Error("Please enter a valid email address.");
        }
        if (isFirebaseNetworkError(error)) {
          throw new Error(
            "Network error while sending reset email. Please try again.",
          );
        }
        throw new Error(
          getAuthErrorMessage(error, "Failed to send password reset email."),
        );
      }
    },
    [showSuccess],
  );

  const validatePasswordResetCode = useCallback(async (oobCode: string) => {
    const normalizedCode = typeof oobCode === "string" ? oobCode.trim() : "";
    if (!normalizedCode) {
      throw new Error("This password reset link is invalid or incomplete.");
    }

    try {
      return await verifyPasswordResetCode(auth, normalizedCode);
    } catch (error: any) {
      const code = error?.code;
      if (
        code === "auth/expired-action-code" ||
        code === "auth/invalid-action-code"
      ) {
        throw new Error(
          "This password reset link has expired or is no longer valid.",
        );
      }
      if (isFirebaseNetworkError(error)) {
        throw new Error(
          "Network error while validating reset link. Please try again.",
        );
      }
      throw new Error(
        getAuthErrorMessage(error, "Unable to validate password reset link."),
      );
    }
  }, []);

  const resetPassword = useCallback(
    async (oobCode: string, newPassword: string) => {
      const normalizedCode = typeof oobCode === "string" ? oobCode.trim() : "";
      const normalizedPassword =
        typeof newPassword === "string" ? newPassword.trim() : "";

      if (!normalizedCode) {
        throw new Error("This password reset link is invalid or incomplete.");
      }

      if (normalizedPassword.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
      }

      try {
        await confirmPasswordReset(auth, normalizedCode, normalizedPassword);
        showSuccess(
          "Your password has been updated. You can sign in now.",
          "Password Reset",
        );
      } catch (error: any) {
        const code = error?.code;
        if (
          code === "auth/expired-action-code" ||
          code === "auth/invalid-action-code"
        ) {
          throw new Error(
            "This password reset link has expired or is no longer valid.",
          );
        }
        if (code === "auth/weak-password") {
          throw new Error("Choose a stronger password before continuing.");
        }
        if (isFirebaseNetworkError(error)) {
          throw new Error(
            "Network error while resetting password. Please try again.",
          );
        }
        throw new Error(
          getAuthErrorMessage(error, "Unable to reset password right now."),
        );
      }
    },
    [showSuccess],
  );

  // -----------------------------------------------------------
  //  Navigation and Return (FIXED NAVIGATION LOGIC)
  // -----------------------------------------------------------

  // Navigate authenticated users away from transient/public routes.
  // Google accounts are always email-verified, so there is no verify-email step.
  useEffect(() => {
    if (!isLoading && user) {
      const target = user.onboardingCompleted ? "/dashboard" : "/onboarding";

      // Only redirect from transient public routes or stale core routes.
      // Avoids race conditions on iOS where setUser hasn't committed yet.
      const isTransientRoute = [
        "/",
        "/login",
        "/register",
        "/signup",
        "/verify-email",
      ].includes(location.pathname);

      const isOnWrongCoreRoute =
        location.pathname === "/onboarding" && user.onboardingCompleted;

      if (isTransientRoute || isOnWrongCoreRoute) {
        if (location.pathname !== target) {
          navigate(target, { replace: true });
        }
      }
    }
  }, [isLoading, user, navigate, location.pathname]);

  // -----------------------------------------------------------
  //  NEW: View Another Users Profile (by UID)
  // -----------------------------------------------------------
  const getUserProfileById = useCallback(
    async (userId: string): Promise<User | null> => {
      if (!userId) {
        console.warn(" getUserProfileById called with empty userId");
        return null;
      }

      try {
        const docRef = doc(db, "users", userId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          console.warn(` No user profile found for UID: ${userId}`);
          return null;
        }

        const data = docSnap.data();

        if (data.isActive === false || data.isDeleted === true) {
          return null;
        }

        const normalizedSubscription = normalizeSubscription(data.subscription);

        const profile: User = {
          id: userId,
          email: data.email || "",
          name: data.name || "Unknown User",
          role: resolveUserRole(data.email, data.role),
          roles: normalizeUserRoles(data.email, data.roles),
          onboardingCompleted: data.onboardingCompleted || false,
          emailVerified: data.emailVerified === false ? false : true,
          age: data.age || 0,
          gender: data.gender || "MALE",
          denomination: data.denomination || "",
          bio: data.bio || "",
          location: data.location || "",

          // Optional fields
          latitude: data.latitude,
          longitude: data.longitude,
          phoneNumber: data.phoneNumber,
          countryCode: data.countryCode,
          passportCountry: data.passportCountry || null,
          birthday: data.birthday
            ? new Date(data.birthday.seconds * 1000)
            : undefined,
          fieldOfStudy: data.fieldOfStudy || data.education,
          profession: data.profession || data.occupation,
          faithJourney: data.faithJourney,
          sundayActivity: data.sundayActivity || data.churchAttendance,
          churchAttendance: data.churchAttendance || data.sundayActivity,
          baptismStatus: data.baptismStatus,
          spiritualGifts: data.spiritualGifts,
          relationshipGoals: data.relationshipGoals,
          lifestyle: data.lifestyle,
          lookingFor: data.lookingFor,
          personality: data.personality,
          hobbies: data.hobbies,
          interests: data.interests,
          values: data.values,
          profileFits: data.profileFits,
          favoriteVerse: data.favoriteVerse,
          drinkingHabit: data.drinkingHabit,
          smokingHabit: data.smokingHabit,
          workoutHabit: data.workoutHabit,
          petPreference: data.petPreference,
          height: data.height,
          language: data.language,
          languageSpoken: data.languageSpoken,
          personalPromptQuestion: data.personalPromptQuestion,
          personalPromptAnswer: data.personalPromptAnswer,
          communicationStyle: data.communicationStyle,
          loveStyle: data.loveStyle,
          educationLevel: data.educationLevel,
          zodiacSign: data.zodiacSign,
          preferredFaithJourney: data.preferredFaithJourney,
          preferredChurchAttendance: data.preferredChurchAttendance,
          preferredRelationshipGoals: data.preferredRelationshipGoals,
          preferredDenomination: data.preferredDenomination,
          preferredGender: data.preferredGender,
          minAge: data.minAge,
          maxAge: data.maxAge,
          maxDistance: data.maxDistance,
          preferredMinHeight: data.preferredMinHeight,

          // Photos
          profilePhoto1: data.profilePhoto1,
          profilePhoto2: data.profilePhoto2,
          profilePhoto3: data.profilePhoto3,
          profilePhoto4: data.profilePhoto4,
          profilePhoto5: data.profilePhoto5,
          profilePhoto6: data.profilePhoto6,
          profilePhotoCount: getProfilePhotoCount(data as Record<string, any>),
          subscriptionStatus:
            data.subscriptionStatus || normalizedSubscription?.status,
          subscriptionTier:
            data.subscriptionTier || normalizedSubscription?.tier,
          subscriptionCurrency:
            data.subscriptionCurrency || normalizedSubscription?.currency,
          profileBoosterCredits:
            typeof data.profileBoosterCredits === "number"
              ? data.profileBoosterCredits
              : 0,
          profileBoosterActiveUntil:
            typeof data.profileBoosterActiveUntil === "string"
              ? data.profileBoosterActiveUntil
              : null,
          profileBoosterLastGrantedReference:
            typeof data.profileBoosterLastGrantedReference === "string"
              ? data.profileBoosterLastGrantedReference
              : null,
          profileBoosterLastUsedAt:
            typeof data.profileBoosterLastUsedAt === "string"
              ? data.profileBoosterLastUsedAt
              : null,
          subscription: normalizedSubscription,
          settings: data.settings,
        };

        return profile;
      } catch (error: any) {
        console.error(
          ` Failed to fetch user profile for UID: ${userId}`,
          error,
        );
        return null;
      }
    },
    [],
  );

  const deleteAccount = useCallback(async () => {
    try {
      await API.User.deleteAccount();
    } catch {
      // best-effort — proceed with local cleanup regardless
    }
    clearAppStorage();
    try {
      await signOut(auth);
    } catch {
      // ignore signOut errors; local state is already cleared
    }
    navigate("/login", { replace: true });
  }, [clearAppStorage, navigate]);

  return {
    isLoading,
    isAuthenticated,
    user,
    accessToken,
    isLoggingIn,
    isRegistering,
    isLoggingOut,
    isCompletingOnboarding,
    logout,
    deleteAccount,
    refetchUser,
    completeOnboarding,
    getUserProfileById,
    googleSignIn,
    requestPasswordReset,
    validatePasswordResetCode,
    resetPassword,
  };
}

export function useRequireAuth() {
  return useAuthContext();
}

export function useOptionalAuth() {
  return useAuthContext();
}
