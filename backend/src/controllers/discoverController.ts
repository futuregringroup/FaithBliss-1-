import { Request, Response } from 'express';
import { admin, usersCollection } from '../config/firebase-admin';
import type { DocumentData } from 'firebase-admin/firestore';
import {
  canViewerSeeCandidate,
  getPassportFeatureSettings,
  normalizeCountryCode,
} from '../utils/passportMode';
import { isProfileBoosterActive } from '../utils/profileBooster';

interface IUserProfile extends DocumentData {
  id: string;
  name?: string;
  email?: string;
  gender?: string;
  preferredGender?: string;
  profileFits?: string[];
  interests?: string[];
  hobbies?: string[];
  age?: number;
  denomination?: string;
  location?: string;
  profilePhoto1?: string;
  profilePhoto2?: string;
  profilePhoto3?: string;
  bio?: string;
  personalPromptQuestion?: string;
  personalPromptAnswer?: string;
  faithJourney?: string;
  churchAttendance?: string;
  sundayActivity?: string;
  relationshipGoals?: string[];
  values?: string[];
  favoriteVerse?: string;
  profession?: string;
  fieldOfStudy?: string;
  lookingFor?: string[];
  latitude?: number;
  longitude?: number;
  likes?: string[];
  passes?: string[];
  matches?: string[];
  subscriptionStatus?: string;
  subscriptionTier?: string;
  countryCode?: string;
  passportCountry?: string | null;
  profileBoosterActiveUntil?: unknown;
  distance?: number;
}

interface IMatchDoc extends DocumentData {
  users?: string[];
}

type DiscoveryFilterInput = {
  preferredGender?: unknown;
  preferredDenominations?: unknown;
  preferredDenomination?: unknown;
  minAge?: unknown;
  maxAge?: unknown;
  maxDistance?: unknown;
  preferredFaithJourney?: unknown;
  preferredChurchAttendance?: unknown;
  preferredRelationshipGoals?: unknown;
  passportCountry?: unknown;
};

const matchesCollection = admin.firestore().collection('matches');

const toUpperTrimmed = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
};

const toLowerTrimmed = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const normalizeGender = (value: unknown): 'MALE' | 'FEMALE' | null => {
  const normalized = toUpperTrimmed(value);
  if (!normalized) return null;
  if (normalized === 'MALE' || normalized === 'MAN') return 'MALE';
  if (normalized === 'FEMALE' || normalized === 'WOMAN') return 'FEMALE';
  return null;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => toUpperTrimmed(item))
      .filter((item): item is string => Boolean(item));
  }

  const single = toUpperTrimmed(value);
  return single ? [single] : [];
};

const normalizeLowerStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  value.forEach((item) => {
    const normalized = toLowerTrimmed(item);
    if (normalized) unique.add(normalized);
  });
  return Array.from(unique);
};

const parseBoundedInt = (value: unknown, min: number, max: number): number | undefined => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(max, Math.max(min, Math.round(parsed)));
};

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const normalizeGenderPreference = (
  preferredGender?: unknown,
  lookingFor?: unknown
): 'MALE' | 'FEMALE' | null => {
  const preferred = normalizeGender(preferredGender);
  if (preferred) return preferred;

  const choices = Array.isArray(lookingFor)
    ? lookingFor
    : typeof lookingFor === 'string'
      ? [lookingFor]
      : [];

  for (const choice of choices) {
    const normalized = normalizeGender(choice);
    if (normalized) return normalized;
  }

  return null;
};

const parseInterestQuery = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    const normalized = value
      .flatMap((item) =>
        typeof item === 'string'
          ? item.split(',')
          : []
      )
      .map((item) => toLowerTrimmed(item))
      .filter((item): item is string => Boolean(item));
    return Array.from(new Set(normalized));
  }

  if (typeof value === 'string') {
    const normalized = value
      .split(',')
      .map((item) => toLowerTrimmed(item))
      .filter((item): item is string => Boolean(item));
    return Array.from(new Set(normalized));
  }

  return [];
};

const parseProfileFitQuery = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string');
    return first ? toLowerTrimmed(first) : null;
  }

  return toLowerTrimmed(value);
};

const buildExcludedUserIds = async (currentUser: IUserProfile): Promise<Set<string>> => {
  const excluded = new Set<string>(
    [
      currentUser.id,
      ...(currentUser.likes || []),
      ...(currentUser.passes || []),
    ].map(String)
  );

  const matchIds = Array.isArray(currentUser.matches) ? currentUser.matches : [];
  if (matchIds.length === 0) return excluded;

  const matchDocs = await Promise.all(
    matchIds.map((matchId) => matchesCollection.doc(String(matchId)).get())
  );

  matchDocs.forEach((doc) => {
    const data = doc.data() as IMatchDoc | undefined;
    const users = Array.isArray(data?.users) ? data.users : [];
    users.forEach((uid) => {
      if (uid && uid !== currentUser.id) {
        excluded.add(String(uid));
      }
    });
  });

  return excluded;
};

export const filterProfiles = async (req: Request, res: Response) => {
  const uid = req.userId;
  if (!uid) {
    return res.status(401).json({ message: 'Unauthorized: Firebase UID missing.' });
  }

  const userDoc = await usersCollection.doc(uid).get();
  if (!userDoc.exists) {
    return res.status(404).json({ message: 'User profile not found.' });
  }

  const currentUser = { id: userDoc.id, ...userDoc.data() } as IUserProfile;
  const featureSettings = await getPassportFeatureSettings();
  const hasPremiumFilters =
    currentUser.subscriptionStatus === 'active' &&
    ['premium', 'elite'].includes(String(currentUser.subscriptionTier || '').toLowerCase());
  const body = (req.body || {}) as DiscoveryFilterInput;
  const passportCountryProvided = Object.prototype.hasOwnProperty.call(body, 'passportCountry');
  const requestedPassportCountry =
    body.passportCountry === null ? null : normalizeCountryCode(body.passportCountry);

  if (passportCountryProvided) {
    if (!featureSettings.passportModeEnabled && body.passportCountry !== null) {
      return res.status(403).json({ message: 'Passport Mode is currently unavailable.' });
    }

    if (!hasPremiumFilters && body.passportCountry !== null) {
      return res.status(403).json({ message: 'Passport Mode is available for premium users only.' });
    }

    if (body.passportCountry !== null && !requestedPassportCountry) {
      return res.status(400).json({ message: 'A valid passport country code is required.' });
    }

    await usersCollection.doc(uid).set(
      {
        passportCountry: requestedPassportCountry,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    currentUser.passportCountry = requestedPassportCountry;
  }

  const preferredGender = normalizeGender(body.preferredGender);
  const preferredDenominations = hasPremiumFilters
    ? normalizeStringArray(body.preferredDenominations ?? body.preferredDenomination)
    : [];
  const preferredFaithJourney = hasPremiumFilters ? normalizeStringArray(body.preferredFaithJourney) : [];
  const preferredChurchAttendance = hasPremiumFilters ? normalizeStringArray(body.preferredChurchAttendance) : [];
  const preferredRelationshipGoals = hasPremiumFilters ? normalizeStringArray(body.preferredRelationshipGoals) : [];

  const parsedMinAge = hasPremiumFilters ? parseBoundedInt(body.minAge, 18, 55) : undefined;
  const parsedMaxAge = hasPremiumFilters ? parseBoundedInt(body.maxAge, 18, 55) : undefined;
  const minAge = parsedMinAge !== undefined && parsedMaxAge !== undefined
    ? Math.min(parsedMinAge, parsedMaxAge)
    : parsedMinAge;
  const maxAge = parsedMinAge !== undefined && parsedMaxAge !== undefined
    ? Math.max(parsedMinAge, parsedMaxAge)
    : parsedMaxAge;

  const maxDistance = hasPremiumFilters ? parseBoundedInt(body.maxDistance, 1, 500) : undefined;
  const excluded = await buildExcludedUserIds(currentUser);

  const snapshot = await usersCollection
    .where('onboardingCompleted', '==', true)
    .where('isActive', '==', true)
    .get();

  const results: IUserProfile[] = [];

  snapshot.forEach((doc) => {
    if (excluded.has(doc.id)) return;

    const candidate = { id: doc.id, ...doc.data() } as IUserProfile;
    if (!canViewerSeeCandidate(currentUser, candidate, featureSettings.passportModeEnabled)) return;

    const candidateGender = normalizeGender(candidate.gender);
    if (preferredGender && candidateGender !== preferredGender) return;

    if (minAge !== undefined || maxAge !== undefined) {
      if (typeof candidate.age !== 'number') return;
      if (minAge !== undefined && candidate.age < minAge) return;
      if (maxAge !== undefined && candidate.age > maxAge) return;
    }

    if (preferredDenominations.length > 0) {
      const candidateDenomination = toUpperTrimmed(candidate.denomination);
      if (!candidateDenomination || !preferredDenominations.includes(candidateDenomination)) {
        return;
      }
    }

    if (preferredFaithJourney.length > 0) {
      const candidateFaithJourney = toUpperTrimmed(candidate.faithJourney);
      if (!candidateFaithJourney || !preferredFaithJourney.includes(candidateFaithJourney)) {
        return;
      }
    }

    if (preferredChurchAttendance.length > 0) {
      const attendance = toUpperTrimmed(candidate.churchAttendance || candidate.sundayActivity);
      if (!attendance || !preferredChurchAttendance.includes(attendance)) {
        return;
      }
    }

    if (preferredRelationshipGoals.length > 0) {
      const candidateGoals = normalizeStringArray(candidate.relationshipGoals);
      if (candidateGoals.length === 0) return;
      const hasGoalMatch = candidateGoals.some((goal) => preferredRelationshipGoals.includes(goal));
      if (!hasGoalMatch) return;
    }

    if (maxDistance !== undefined) {
      if (
        typeof currentUser.latitude !== 'number' ||
        typeof currentUser.longitude !== 'number' ||
        typeof candidate.latitude !== 'number' ||
        typeof candidate.longitude !== 'number'
      ) {
        return;
      }

      const distance = haversineKm(
        currentUser.latitude,
        currentUser.longitude,
        candidate.latitude,
        candidate.longitude
      );

      if (distance > maxDistance) return;
      candidate.distance = distance;
    }

    results.push(candidate);
  });

  results.sort((a, b) => {
    const aBoostRank = isProfileBoosterActive(a) ? 0 : 1;
    const bBoostRank = isProfileBoosterActive(b) ? 0 : 1;
    if (aBoostRank !== bBoostRank) return aBoostRank - bBoostRank;

    const aDistance = typeof a.distance === 'number' ? a.distance : Number.POSITIVE_INFINITY;
    const bDistance = typeof b.distance === 'number' ? b.distance : Number.POSITIVE_INFINITY;
    if (aDistance !== bDistance) return aDistance - bDistance;

    const aAge = typeof a.age === 'number' ? a.age : Number.POSITIVE_INFINITY;
    const bAge = typeof b.age === 'number' ? b.age : Number.POSITIVE_INFINITY;
    return aAge - bAge;
  });

  return res.status(200).json(
    results.map((u) => ({
      id: u.id,
      name: u.name,
      onboardingCompleted: true,
      age: u.age,
      gender: u.gender,
      denomination: u.denomination,
      location: u.location,
      profilePhoto1: u.profilePhoto1,
      profilePhoto2: u.profilePhoto2,
      profilePhoto3: u.profilePhoto3,
      bio: u.bio,
      personalPromptQuestion: u.personalPromptQuestion,
      personalPromptAnswer: u.personalPromptAnswer,
      faithJourney: u.faithJourney,
      churchAttendance: u.churchAttendance || u.sundayActivity,
      relationshipGoals: u.relationshipGoals,
      hobbies: u.hobbies,
      interests: u.interests,
      values: u.values,
      favoriteVerse: u.favoriteVerse,
      profession: u.profession,
      fieldOfStudy: u.fieldOfStudy,
      lookingFor: u.lookingFor,
      distance: typeof u.distance === 'number' ? Math.round(u.distance) : undefined,
    }))
  );
};

export const discoverByInterests = async (req: Request, res: Response) => {
  const uid = req.userId;
  if (!uid) {
    return res.status(401).json({ message: 'Unauthorized: Firebase UID missing.' });
  }

  const userDoc = await usersCollection.doc(uid).get();
  if (!userDoc.exists) {
    return res.status(404).json({ message: 'User profile not found.' });
  }

  const currentUser = { id: userDoc.id, ...userDoc.data() } as IUserProfile;
  const featureSettings = await getPassportFeatureSettings();
  const selectedInterests = parseInterestQuery(req.query.interests);
  if (selectedInterests.length === 0) {
    return res.status(400).json({ message: 'Provide at least one interest in query parameter: interests' });
  }

  const preferredGender = normalizeGenderPreference(
    currentUser.preferredGender,
    currentUser.lookingFor
  );
  const excluded = await buildExcludedUserIds(currentUser);

  const snapshot = await usersCollection
    .where('onboardingCompleted', '==', true)
    .where('isActive', '==', true)
    .get();

  const selectedSet = new Set(selectedInterests);
  const collectResults = (enforceGender: boolean) => {
    const data: Array<IUserProfile & { matchedInterests: string[]; interestMatchCount: number }> = [];

    snapshot.forEach((doc) => {
      if (excluded.has(doc.id)) return;

      const candidate = { id: doc.id, ...doc.data() } as IUserProfile;
      if (!canViewerSeeCandidate(currentUser, candidate, featureSettings.passportModeEnabled)) return;
      const candidateGender = normalizeGender(candidate.gender);
      if (enforceGender && preferredGender && candidateGender !== preferredGender) return;

      const interestSource = [
        ...(Array.isArray(candidate.interests) ? candidate.interests : []),
        ...(Array.isArray(candidate.hobbies) ? candidate.hobbies : []),
      ];

      const normalizedCandidateInterests = normalizeLowerStringArray(interestSource);
      if (normalizedCandidateInterests.length === 0) return;

      const displayMap = new Map<string, string>();
      interestSource.forEach((raw) => {
        if (typeof raw !== 'string') return;
        const normalized = toLowerTrimmed(raw);
        if (!normalized || displayMap.has(normalized)) return;
        displayMap.set(normalized, raw.trim());
      });

      const matched = normalizedCandidateInterests
        .filter((item) => selectedSet.has(item))
        .map((item) => displayMap.get(item) || item);

      if (matched.length === 0) return;

      data.push({
        ...candidate,
        matchedInterests: matched,
        interestMatchCount: matched.length,
      });
    });

    return data;
  };

  let results = collectResults(true);
  const usedFallbackWithoutPreference = Boolean(preferredGender && results.length === 0);
  if (usedFallbackWithoutPreference) {
    results = collectResults(false);
  }

  results.sort((a, b) => {
    const aBoostRank = isProfileBoosterActive(a) ? 0 : 1;
    const bBoostRank = isProfileBoosterActive(b) ? 0 : 1;
    if (aBoostRank !== bBoostRank) return aBoostRank - bBoostRank;

    if (b.interestMatchCount !== a.interestMatchCount) {
      return b.interestMatchCount - a.interestMatchCount;
    }
    const aAge = typeof a.age === 'number' ? a.age : Number.POSITIVE_INFINITY;
    const bAge = typeof b.age === 'number' ? b.age : Number.POSITIVE_INFINITY;
    return aAge - bAge;
  });

  return res.status(200).json(
    results.map((u) => ({
      id: u.id,
      name: u.name,
      onboardingCompleted: true,
      age: u.age,
      gender: u.gender,
      denomination: u.denomination,
      location: u.location,
      profilePhoto1: u.profilePhoto1,
      profilePhoto2: u.profilePhoto2,
      profilePhoto3: u.profilePhoto3,
      bio: u.bio,
      personalPromptQuestion: u.personalPromptQuestion,
      personalPromptAnswer: u.personalPromptAnswer,
      faithJourney: u.faithJourney,
      churchAttendance: u.churchAttendance || u.sundayActivity,
      relationshipGoals: u.relationshipGoals,
      hobbies: u.hobbies,
      interests: u.interests,
      values: u.values,
      favoriteVerse: u.favoriteVerse,
      profession: u.profession,
      fieldOfStudy: u.fieldOfStudy,
      matchedInterests: u.matchedInterests,
      interestMatchCount: u.interestMatchCount,
      usedFallbackWithoutPreference,
    }))
  );
};

export const getProfileFitCounts = async (req: Request, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const snapshot = await usersCollection
      .where('onboardingCompleted', '==', true)
      .where('isActive', '==', true)
      .get();

    const counts: Record<string, number> = {};

    snapshot.forEach((doc) => {
      const candidate = doc.data() as IUserProfile;
      const profileFits = Array.isArray(candidate.profileFits) ? candidate.profileFits : [];
      const uniqueFits = new Set<string>();

      profileFits.forEach((fit) => {
        const normalized = toLowerTrimmed(fit);
        if (normalized) uniqueFits.add(normalized);
      });

      uniqueFits.forEach((fit) => {
        counts[fit] = (counts[fit] || 0) + 1;
      });
    });

    return res.status(200).json(counts);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ message: `Failed to load profile fit counts: ${message}` });
  }
};

export const discoverByProfileFit = async (req: Request, res: Response) => {
  const uid = req.userId;
  if (!uid) {
    return res.status(401).json({ message: 'Unauthorized: Firebase UID missing.' });
  }

  const userDoc = await usersCollection.doc(uid).get();
  if (!userDoc.exists) {
    return res.status(404).json({ message: 'User profile not found.' });
  }

  const currentUser = { id: userDoc.id, ...userDoc.data() } as IUserProfile;
  const featureSettings = await getPassportFeatureSettings();
  const hasPremiumExploreAccess =
    currentUser.subscriptionStatus === 'active' &&
    ['premium', 'elite'].includes(String(currentUser.subscriptionTier || '').toLowerCase());
  const selectedFit = parseProfileFitQuery(req.query.fit);

  if (!selectedFit) {
    return res.status(400).json({ message: 'Provide a profile fit using the fit query parameter.' });
  }
  if (!hasPremiumExploreAccess) {
    return res.status(403).json({ message: 'Explore categories are available for premium users only.' });
  }

  const preferredGender = normalizeGenderPreference(
    currentUser.preferredGender,
    currentUser.lookingFor
  );
  const excluded = await buildExcludedUserIds(currentUser);

  const snapshot = await usersCollection
    .where('onboardingCompleted', '==', true)
    .where('isActive', '==', true)
    .get();

  const collectResults = (enforceGender: boolean) => {
    const data: IUserProfile[] = [];

    snapshot.forEach((doc) => {
      if (excluded.has(doc.id)) return;

      const candidate = { id: doc.id, ...doc.data() } as IUserProfile;
      if (!canViewerSeeCandidate(currentUser, candidate, featureSettings.passportModeEnabled)) return;
      const candidateGender = normalizeGender(candidate.gender);
      if (enforceGender && preferredGender && candidateGender !== preferredGender) return;

      const candidateFits = Array.isArray(candidate.profileFits)
        ? candidate.profileFits
        : [];
      const normalizedFits = new Set(
        candidateFits
          .map((fit) => toLowerTrimmed(fit))
          .filter((fit): fit is string => Boolean(fit))
      );

      if (!normalizedFits.has(selectedFit)) return;

      if (
        typeof currentUser.latitude === 'number' &&
        typeof currentUser.longitude === 'number' &&
        typeof candidate.latitude === 'number' &&
        typeof candidate.longitude === 'number'
      ) {
        candidate.distance = haversineKm(
          currentUser.latitude,
          currentUser.longitude,
          candidate.latitude,
          candidate.longitude
        );
      }

      data.push(candidate);
    });

    return data;
  };

  let results = collectResults(true);
  const usedFallbackWithoutPreference = Boolean(preferredGender && results.length === 0);
  if (usedFallbackWithoutPreference) {
    results = collectResults(false);
  }

  results.sort((a, b) => {
    const aBoostRank = isProfileBoosterActive(a) ? 0 : 1;
    const bBoostRank = isProfileBoosterActive(b) ? 0 : 1;
    if (aBoostRank !== bBoostRank) return aBoostRank - bBoostRank;

    const aDistance = typeof a.distance === 'number' ? a.distance : Number.POSITIVE_INFINITY;
    const bDistance = typeof b.distance === 'number' ? b.distance : Number.POSITIVE_INFINITY;
    if (aDistance !== bDistance) return aDistance - bDistance;

    const aAge = typeof a.age === 'number' ? a.age : Number.POSITIVE_INFINITY;
    const bAge = typeof b.age === 'number' ? b.age : Number.POSITIVE_INFINITY;
    return aAge - bAge;
  });

  return res.status(200).json(
    results.map((u) => ({
      id: u.id,
      name: u.name,
      onboardingCompleted: true,
      age: u.age,
      gender: u.gender,
      denomination: u.denomination,
      location: u.location,
      latitude: u.latitude,
      longitude: u.longitude,
      profilePhoto1: u.profilePhoto1,
      profilePhoto2: u.profilePhoto2,
      profilePhoto3: u.profilePhoto3,
      bio: u.bio,
      personalPromptQuestion: u.personalPromptQuestion,
      personalPromptAnswer: u.personalPromptAnswer,
      faithJourney: u.faithJourney,
      churchAttendance: u.churchAttendance || u.sundayActivity,
      relationshipGoals: u.relationshipGoals,
      hobbies: u.hobbies,
      interests: u.interests,
      values: u.values,
      favoriteVerse: u.favoriteVerse,
      profession: u.profession,
      fieldOfStudy: u.fieldOfStudy,
      lookingFor: u.lookingFor,
      profileFits: Array.isArray(u.profileFits) ? u.profileFits : [],
      distance: typeof u.distance === 'number' ? Math.round(u.distance) : undefined,
      usedFallbackWithoutPreference,
    }))
  );
};
