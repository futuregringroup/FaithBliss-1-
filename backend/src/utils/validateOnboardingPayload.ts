import { MIN_REQUIRED_PROFILE_PHOTOS } from './profilePhotos';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const getStringArrayCount = (value: unknown): number => {
  if (!Array.isArray(value)) return 0;
  return value.filter((item) => typeof item === 'string' && item.trim().length > 0).length;
};

const isValidDateValue = (value: unknown): boolean => {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  if (!isNonEmptyString(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const validateOnboardingPayload = (payload: Record<string, unknown>): string | null => {
  if (!isValidDateValue(payload.birthday)) {
    return 'Birthday is required and must be valid.';
  }

  const requiredTextFields: Array<[string, unknown]> = [
    ['location', payload.location],
    ['denomination', payload.denomination],
    ['gender', payload.gender],
    ['phoneNumber', payload.phoneNumber],
    ['countryCode', payload.countryCode],
    ['faithJourney', payload.faithJourney],
    ['churchAttendance', payload.churchAttendance ?? payload.sundayActivity],
    ['profession', payload.profession ?? payload.occupation],
    ['fieldOfStudy', payload.fieldOfStudy ?? payload.education],
    ['baptismStatus', payload.baptismStatus],
    ['favoriteVerse', payload.favoriteVerse],
    ['preferredGender', payload.preferredGender],
  ];

  for (const [fieldName, value] of requiredTextFields) {
    if (!isNonEmptyString(value)) {
      return `${fieldName} is required.`;
    }
  }

  const requiredArrayFields: Array<[string, unknown, number]> = [
    ['profileFits', payload.profileFits, 3],
    ['relationshipGoals', payload.relationshipGoals ?? payload.lookingFor, 1],
    ['preferredFaithJourney', payload.preferredFaithJourney, 1],
    ['preferredChurchAttendance', payload.preferredChurchAttendance, 1],
    ['preferredRelationshipGoals', payload.preferredRelationshipGoals, 1],
  ];

  for (const [fieldName, value, minCount] of requiredArrayFields) {
    if (getStringArrayCount(value) < minCount) {
      return minCount === 1
        ? `${fieldName} must include at least one selection.`
        : `${fieldName} must include at least ${minCount} selections.`;
    }
  }

  const numericFields: Array<[string, unknown]> = [
    ['age', payload.age],
    ['minAge', payload.minAge],
    ['maxAge', payload.maxAge],
    ['maxDistance', payload.maxDistance],
    ['preferredMinHeight', payload.preferredMinHeight],
  ];

  for (const [fieldName, value] of numericFields) {
    if (!isFiniteNumber(value)) {
      return `${fieldName} is required and must be a valid number.`;
    }
  }

  const profilePhotoCount = payload.profilePhotoCount;
  if (!isFiniteNumber(profilePhotoCount) || profilePhotoCount < MIN_REQUIRED_PROFILE_PHOTOS) {
    return `Please upload at least ${MIN_REQUIRED_PROFILE_PHOTOS} profile photos before completing onboarding.`;
  }

  return null;
};
