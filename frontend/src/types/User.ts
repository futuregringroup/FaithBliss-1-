/* eslint-disable no-irregular-whitespace */
// src/types/User.ts
export interface User {
  id: string;
  email: string;
  name: string;
  role?: "user" | "admin" | "developer" | string;
  roles?: string[];
  onboardingCompleted: boolean;

  age: number;
  gender: "MALE" | "FEMALE";

  denomination?:
    | "BAPTIST"
    | "METHODIST"
    | "PRESBYTERIAN"
    | "PENTECOSTAL"
    | "CATHOLIC"
    | "ORTHODOX"
    | "ANGLICAN"
    | "LUTHERAN"
    | "ASSEMBLIES_OF_GOD"
    | "SEVENTH_DAY_ADVENTIST"
    | "OTHER"
    | string; // 👈 allow flexible input

  bio: string;
  location: string;

  latitude?: number;
  longitude?: number;
  phoneNumber?: string;
  countryCode?: string;
  passportCountry?: string | null;

  birthday?: string | Date; // 👈 fix for Firestore timestamp conversion

  fieldOfStudy?: string;
  profession?: string;
  faithJourney?: string;
  sundayActivity?: string;
  churchAttendance?: string;
  baptismStatus?: string;
  spiritualGifts?: string[];
  relationshipGoals?: string[];
  lifestyle?: string;
  lookingFor?: string[];
  personality?: string[];
  hobbies?: string[];
  interests?: string[];
  values?: string[];
  profileFits?: string[];
  favoriteVerse?: string;
  drinkingHabit?: string;
  smokingHabit?: string;
  workoutHabit?: string;
  petPreference?: string;
  communicationStyle?: string[] | string;
  loveStyle?: string[] | string;
  educationLevel?: string;
  zodiacSign?: string;
  height?: string;
  language?: string;
  languageSpoken?: string[];
  preferredFaithJourney?: string[] | null;
  preferredChurchAttendance?: string[] | null;
  preferredRelationshipGoals?: string[] | null;
  preferredDenomination?: string | null;
  preferredGender?: "MALE" | "FEMALE" | string | null;
  minAge?: number | null;
  maxAge?: number | null;
  maxDistance?: number | null;
  preferredMinHeight?: number;
  personalPromptQuestion?: string;
  personalPromptAnswer?: string;
  isVerified?: boolean;
  emailVerified?: boolean;
  profilePhoto1?: string;
  profilePhoto2?: string;
  profilePhoto3?: string;
  profilePhoto4?: string;
  profilePhoto5?: string;
  profilePhoto6?: string;
  profilePhotoCount?: number;
  isActive?: boolean;
  isOnline?: boolean;
  lastSeenAt?: string;

  subscriptionStatus?: "active" | "pending" | "inactive" | string;
  subscriptionTier?: "premium" | "elite" | "free" | string;
  subscriptionCurrency?: "NGN" | "USD" | string;
  profileBoosterCredits?: number;
  profileBoosterActiveUntil?: string | null;
  profileBoosterLastGrantedReference?: string | null;
  profileBoosterLastUsedAt?: string | null;
  subscription?: {
    status?: string;
    tier?: string;
    currency?: string;
    billingCycle?: "monthly" | "quarterly" | string;
    pricingRegion?: "nigeria" | "africa" | "global" | string;
    displayCurrency?: string;
    displayAmountMajor?: number;
    chargeAmountMajor?: number;
    chargeAmountSubunits?: number;
    exchangeRate?: number;
    planCode?: string;
    reference?: string;
    customerCode?: string;
    subscriptionCode?: string;
    authorizationCode?: string;
    renewalProvider?: "plan" | "authorization" | string;
    autoRenewEnabled?: boolean;
    autoRenewDisabledAt?: string;
    nextPaymentDate?: string;
    updatedAt?: string;
  };
  postPaymentSurvey?: {
    contacted: boolean;
    marketerId?: string;
    marketerName?: string;
    submittedAt?: string;
  };
  settings?: Record<string, any>;
  createdAt?: string;
}

export interface UserPreferences {
  preferredGender?: "MALE" | "FEMALE" | null;
  preferredDenomination?:
    | (
        | "BAPTIST"
        | "METHODIST"
        | "PRESBYTERIAN"
        | "PENTECOSTAL"
        | "CATHOLIC"
        | "ORTHODOX"
        | "ANGLICAN"
        | "LUTHERAN"
        | "ASSEMBLIES_OF_GOD"
        | "SEVENTH_DAY_ADVENTIST"
        | "OTHER"
      )[]
    | null;
  minAge?: number | null;
  maxAge?: number | null;
  maxDistance?: number | null;
  preferredFaithJourney?: string[] | null;
  preferredChurchAttendance?: string[] | null;
  preferredRelationshipGoals?: string[] | null;
}
