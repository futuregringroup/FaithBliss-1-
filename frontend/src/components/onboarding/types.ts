export type FaithJourney = 'GROWING' | 'ROOTED' | 'EXPLORING' | 'PASSIONATE';
export type ChurchAttendance = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'OCCASIONALLY' | 'RARELY';
export type RelationshipGoals = 'FRIENDSHIP' | 'RELATIONSHIP' | 'MARRIAGE_MINDED';
export type Gender = 'MAN' | 'WOMAN' | 'OTHER';

export interface OnboardingData {
  age?: number;
  gender?: 'MALE' | 'FEMALE';
  faithJourney: FaithJourney;
  churchAttendance: ChurchAttendance;
  relationshipGoals: RelationshipGoals[];
  location: string;
  latitude?: number;  // ✅ changed from number | null
  longitude?: number; // ✅ changed from number | null
  denomination: string;
  customDenomination?: string;
  phoneNumber: string;
  countryCode: string;
  birthday: string;
  education: string;
  occupation: string;
  baptismStatus: string;
  spiritualGifts: string[];
  interests: string[];
  lifestyle: string;
  bio: string;
  personality: string[];
  hobbies: string[];
  values: string[];
  profileFits: string[];
  favoriteVerse: string;
  height?: string;
  language?: string;
  languageSpoken?: string[];
  personalPromptQuestion?: string;
  personalPromptAnswer?: string;
  communicationStyle?: string[];
  loveStyle?: string[];
  educationLevel?: string;
  zodiacSign?: string;
  drinkingHabit?: string;
  smokingHabit?: string;
  workoutHabit?: string;
  petPreference?: string;

  preferredFaithJourney?: FaithJourney[] | null;
  preferredChurchAttendance?: ChurchAttendance[] | null;
  preferredRelationshipGoals?: RelationshipGoals[] | null;
  preferredDenomination?: string[] | null;
  preferredGender?: 'MALE' | 'FEMALE' | null;
  minAge?: number | null;
  maxAge?: number | null;
  maxDistance?: number | null;
  preferredMinHeight?: number | null;

  photos: File[];
}
