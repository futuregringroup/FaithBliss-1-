import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { db, usersCollection } from '../config/firebase-admin';
import { countProfilePhotos } from '../utils/profilePhotos';
import {
  getPassportFeatureSettings,
  normalizeCountryCode,
  setPassportFeatureSettings,
} from '../utils/passportMode';
import {
  activateProfileBoosterForUser,
  ProfileBoosterError,
} from '../utils/profileBooster';

interface IFirestoreUser {
  name: string;
  email: string;
  role?: string;
  roles?: string[];
  profilePhoto1: string;
  profilePhoto2?: string;
  profilePhoto3?: string;
  profilePhoto4?: string;
  profilePhoto5?: string;
  profilePhoto6?: string;
  profilePhotoCount?: number;
  onboardingCompleted: boolean;
  age: number;
  gender: string;
  location: string;
  bio: string;
  denomination: string;
  isActive?: boolean;
  isOnline?: boolean;
  lastSeenAt?: unknown;
  likes?: string[];
  matches?: string[];
  profileFits?: string[];
  // Faith profile
  faithJourney?: string;
  churchAttendance?: string;
  sundayActivity?: string;
  baptismStatus?: string;
  spiritualGifts?: string[];
  favoriteVerse?: string;
  // Personality & interests
  interests?: string[];
  hobbies?: string[];
  values?: string[];
  personality?: string[];
  relationshipGoals?: string[];
  lookingFor?: string[];
  communicationStyle?: string[];
  loveStyle?: string[];
  languageSpoken?: string[];
  // Lifestyle
  lifestyle?: string;
  drinkingHabit?: string;
  smokingHabit?: string;
  workoutHabit?: string;
  petPreference?: string;
  height?: string;
  language?: string;
  // Profession / education
  fieldOfStudy?: string;
  profession?: string;
  educationLevel?: string;
  zodiacSign?: string;
  // Personal prompt
  personalPromptQuestion?: string;
  personalPromptAnswer?: string;
  // Dating preferences
  preferredDenomination?: string;
  preferredGender?: string;
  preferredFaithJourney?: string[];
  preferredChurchAttendance?: string[];
  preferredRelationshipGoals?: string[];
  minAge?: number;
  maxAge?: number;
  // Subscription
  subscriptionStatus?: string;
  subscriptionTier?: string;
  subscriptionCurrency?: string;
  subscription?: {
    status?: string;
    tier?: string;
    billingCycle?: string;
    currency?: string;
  };
  profileBoosterCredits?: number;
  profileBoosterActiveUntil?: unknown;
  profileBoosterLastGrantedReference?: string;
  profileBoosterLastUsedAt?: unknown;
  countryCode?: string;
  passportCountry?: string | null;
  postPaymentSurvey?: {
    contacted: boolean;
    marketerId?: string;
    marketerName?: string;
    submittedAt?: unknown;
  };
}

interface CustomRequest extends Request {
  userId?: string;
}

const PRIMARY_ADMIN_EMAIL = process.env.PRIMARY_ADMIN_EMAIL ?? '';

function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

const getEffectiveRole = (user: IFirestoreUser | null | undefined): string => {
  const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (email === PRIMARY_ADMIN_EMAIL) return 'admin';

  const role = typeof user?.role === 'string' ? user.role.trim().toLowerCase() : '';
  return role || 'user';
};

const getNormalizedRoles = (user: IFirestoreUser | null | undefined): string[] => {
  const normalizedRoles = Array.isArray(user?.roles)
    ? user.roles
        .filter((role): role is string => typeof role === 'string')
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean)
    : [];

  const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (email === PRIMARY_ADMIN_EMAIL) {
    return Array.from(new Set([...normalizedRoles, 'developer']));
  }

  return Array.from(new Set(normalizedRoles));
};

const hasRole = (user: IFirestoreUser | null | undefined, role: string): boolean => {
  const normalizedRole = role.trim().toLowerCase();
  return getEffectiveRole(user) === normalizedRole || getNormalizedRoles(user).includes(normalizedRole);
};

const isAdminUser = (user: IFirestoreUser | null | undefined): boolean =>
  hasRole(user, 'admin');

const isDeveloperUser = (user: IFirestoreUser | null | undefined): boolean => {
  return hasRole(user, 'developer');
};

const matchesCollection = db.collection('matches');

const normalizeFirestoreTimestamp = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return undefined;
};

const fetchUserProfile = async (
  firebaseUid: string,
  res: Response
): Promise<(IFirestoreUser & { firebaseUid: string }) | null> => {
  try {
    const userDoc = await usersCollection.doc(firebaseUid).get();

    if (!userDoc.exists) {
      res.status(404).json({
        message: 'User profile not found in Firestore. Please complete profile creation.',
      });
      return null;
    }

    return { ...(userDoc.data() as IFirestoreUser), firebaseUid: userDoc.id };
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Firestore fetch error:', error);
    res.status(500).json({ message: `Server Error fetching user profile: ${errorMessage}` });
    return null;
  }
};

const requireAdmin = async (
  firebaseUid: string | undefined,
  res: Response
): Promise<(IFirestoreUser & { firebaseUid: string }) | null> => {
  if (!firebaseUid) {
    res.status(401).json({ message: 'Unauthorized: Missing user context.' });
    return null;
  }

  const currentUser = await fetchUserProfile(firebaseUid, res);
  if (!currentUser) return null;

  if (!isAdminUser(currentUser)) {
    res.status(403).json({ message: 'Admin access required.' });
    return null;
  }

  return currentUser;
};

const requireDeveloper = async (
  firebaseUid: string | undefined,
  res: Response
): Promise<(IFirestoreUser & { firebaseUid: string }) | null> => {
  if (!firebaseUid) {
    res.status(401).json({ message: 'Unauthorized: Missing user context.' });
    return null;
  }

  const currentUser = await fetchUserProfile(firebaseUid, res);
  if (!currentUser) return null;

  if (!isDeveloperUser(currentUser)) {
    res.status(403).json({ message: 'Developer access required.' });
    return null;
  }

  return currentUser;
};

const getMe = async (req: CustomRequest, res: Response) => {
  const firebaseUid = req.userId;

  if (!firebaseUid) {
    return res.status(401).json({ message: 'Authentication required: Firebase UID missing.' });
  }

  const user = await fetchUserProfile(firebaseUid, res);
  if (!user) return;

  const { firebaseUid: uid, ...userData } = user as IFirestoreUser & { firebaseUid: string };

  // Auto-heal Firestore roles for the PRIMARY_ADMIN_EMAIL account.
  // The backend applies email-based elevation at runtime (getEffectiveRole /
  // getNormalizedRoles) but never persists it. The frontend reads Firestore
  // directly and therefore sees the un-elevated values, blocking access to
  // /admin and /developer. Writing the correct values here on the first
  // authenticated API call ensures subsequent Firestore reads are accurate.
  const effectiveRole = getEffectiveRole(userData);
  const effectiveRoles = getNormalizedRoles(userData);
  const rawRole = typeof userData.role === 'string' ? userData.role.trim().toLowerCase() : 'user';
  const rawRoles: string[] = Array.isArray(userData.roles)
    ? (userData.roles as unknown[])
        .filter((r): r is string => typeof r === 'string')
        .map((r) => r.trim().toLowerCase())
    : [];

  const needsRoleHeal = effectiveRole === 'admin' && rawRole !== 'admin';
  const needsRolesHeal = effectiveRoles.includes('developer') && !rawRoles.includes('developer');

  if (needsRoleHeal || needsRolesHeal) {
    const updates: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (needsRoleHeal) {
      updates.role = 'admin';
    }
    if (needsRolesHeal) {
      updates.roles = Array.from(new Set([...rawRoles, 'developer']));
    }
    usersCollection.doc(firebaseUid).update(updates).catch((err: unknown) => {
      console.error('Failed to bootstrap admin/developer roles in Firestore:', err);
    });
  }

  return res.status(200).json({
    id: uid,
    firebaseUid: uid,
    ...userData,
    role: effectiveRole,
    roles: effectiveRoles,
    passportCountry: normalizeCountryCode(userData.passportCountry) || null,
    profilePhotoCount: countProfilePhotos(userData),
  });
};

const getUserById = async (req: CustomRequest, res: Response) => {
  const userId = req.params.id;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ message: 'Invalid user ID format (must be Firebase UID).' });
  }

  try {
    const userDoc = await usersCollection.doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = userDoc.data() as IFirestoreUser;

    // Deactivated or deleted accounts are not visible to other users
    if (user.isActive !== true && user.isActive !== undefined) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const raw = userDoc.data() as Record<string, unknown>;
    if (raw['isDeleted'] === true) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const arr = (field: unknown): unknown[] =>
      Array.isArray(field) ? field : [];

    // Return all public profile fields. Excluded (PII): email, phoneNumber,
    // countryCode, latitude, longitude, birthday, passportCountry, payment
    // authorization codes, raw subscription details.
    return res.status(200).json({
      id: userDoc.id,
      name: user.name,
      role: getEffectiveRole(user),
      roles: getNormalizedRoles(user),
      onboardingCompleted: user.onboardingCompleted,
      isActive: user.isActive !== undefined ? user.isActive : true,
      // Photos
      profilePhoto1: user.profilePhoto1,
      profilePhoto2: user.profilePhoto2,
      profilePhoto3: user.profilePhoto3,
      profilePhoto4: user.profilePhoto4,
      profilePhoto5: user.profilePhoto5,
      profilePhoto6: user.profilePhoto6,
      profilePhotoCount: countProfilePhotos(user),
      // Core demographics
      age: user.age,
      gender: user.gender,
      location: user.location,
      bio: user.bio,
      // Faith profile
      denomination: user.denomination,
      faithJourney: user.faithJourney,
      churchAttendance: user.churchAttendance,
      sundayActivity: user.sundayActivity,
      baptismStatus: user.baptismStatus,
      spiritualGifts: arr(user.spiritualGifts),
      favoriteVerse: user.favoriteVerse,
      // Personality & interests
      profileFits: arr(user.profileFits),
      interests: arr(user.interests),
      hobbies: arr(user.hobbies),
      values: arr(user.values),
      personality: arr(user.personality),
      relationshipGoals: arr(user.relationshipGoals),
      lookingFor: arr(user.lookingFor),
      communicationStyle: arr(user.communicationStyle),
      loveStyle: arr(user.loveStyle),
      languageSpoken: arr(user.languageSpoken),
      // Lifestyle
      lifestyle: user.lifestyle,
      drinkingHabit: user.drinkingHabit,
      smokingHabit: user.smokingHabit,
      workoutHabit: user.workoutHabit,
      petPreference: user.petPreference,
      height: user.height,
      language: user.language,
      // Profession / education
      fieldOfStudy: user.fieldOfStudy,
      profession: user.profession,
      educationLevel: user.educationLevel,
      zodiacSign: user.zodiacSign,
      // Personal prompt
      personalPromptQuestion: user.personalPromptQuestion,
      personalPromptAnswer: user.personalPromptAnswer,
      // Dating preferences (public)
      preferredDenomination: user.preferredDenomination,
      preferredGender: user.preferredGender,
      preferredFaithJourney: arr(user.preferredFaithJourney),
      preferredChurchAttendance: arr(user.preferredChurchAttendance),
      preferredRelationshipGoals: arr(user.preferredRelationshipGoals),
      minAge: user.minAge,
      maxAge: user.maxAge,
      // Subscription display (tier/status only — no payment codes)
      subscriptionStatus: user.subscriptionStatus,
      subscriptionTier: user.subscriptionTier,
      profileBoosterActiveUntil: user.profileBoosterActiveUntil,
    });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error fetching user by ID:', error);
    return res.status(500).json({ message: `Failed to retrieve user profile: ${errorMessage}` });
  }
};

const getAllUsers = async (req: CustomRequest, res: Response) => {
  const firebaseUid = req.userId;
  const currentUser = await requireAdmin(firebaseUid, res);
  if (!currentUser) return;

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const skip = (page - 1) * limit;
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

  try {
    const snapshot = await usersCollection.get();
    const filteredUsers = snapshot.docs
      .map((doc) => ({ ...(doc.data() as IFirestoreUser), id: doc.id }))
      .filter((user) => !(isAdminUser(user) && isDeveloperUser(user)))
      .filter((user) => {
        if (!search) return true;
        const name = typeof user.name === 'string' ? user.name.toLowerCase() : '';
        const email = typeof user.email === 'string' ? user.email.toLowerCase() : '';
        const location = typeof user.location === 'string' ? user.location.toLowerCase() : '';
        return name.includes(search) || email.includes(search) || location.includes(search);
      });

    const total = filteredUsers.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const users = filteredUsers.slice(skip, skip + limit);

    // Build a lookup map for marketer names (if survey includes marketerId)
    const marketerIds = Array.from(
      new Set(
        users
          .map((u) => u.postPaymentSurvey?.marketerId)
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      )
    );

    const marketerNames: Record<string, string> = {};
    if (marketerIds.length > 0) {
      const marketerDocs = await usersCollection.where(admin.firestore.FieldPath.documentId(), 'in', marketerIds).get();
      marketerDocs.forEach((doc) => {
        const data = doc.data() as IFirestoreUser;
        if (data?.name) marketerNames[doc.id] = data.name;
      });
    }

    return res.status(200).json({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: getEffectiveRole(user),
        roles: getNormalizedRoles(user),
        profilePhoto1: user.profilePhoto1,
        profilePhotoCount: countProfilePhotos(user),
        onboardingCompleted: user.onboardingCompleted,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionTier: user.subscriptionTier,
        isActive: user.isActive !== false,
        age: user.age,
        gender: user.gender,
        preferredGender: user.preferredGender ?? null,
        location: user.location,
        bio: user.bio,
        denomination: user.denomination,
        postPaymentSurvey: user.postPaymentSurvey
          ? {
              ...user.postPaymentSurvey,
              marketerName: user.postPaymentSurvey.marketerId
                ? marketerNames[user.postPaymentSurvey.marketerId] || undefined
                : undefined,
            }
          : undefined,
        subscriptionBillingCycle:
          typeof user.subscription?.billingCycle === 'string' ? user.subscription.billingCycle : undefined,
        createdAt: normalizeFirestoreTimestamp((user as Record<string, unknown>).createdAt),
        isOnline: Boolean(user.isOnline),
        lastSeenAt: normalizeFirestoreTimestamp(user.lastSeenAt),
      })),
      total,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error fetching users:', error);
    return res.status(500).json({ message: `Failed to retrieve user list: ${errorMessage}` });
  }
};

const getMarketers = async (req: CustomRequest, res: Response) => {
  const firebaseUid = req.userId;
  const currentUser = await requireAdmin(firebaseUid, res);
  if (!currentUser) return;

  try {
    const [roleSnapshot, rolesSnapshot] = await Promise.all([
      usersCollection.where('role', '==', 'marketer').get(),
      usersCollection.where('roles', 'array-contains', 'marketer').get(),
    ]);

    const marketersMap = new Map<string, IFirestoreUser & { id: string }>();

    roleSnapshot.forEach((doc) => {
      const data = doc.data() as IFirestoreUser;
      marketersMap.set(doc.id, { ...data, id: doc.id });
    });

    rolesSnapshot.forEach((doc) => {
      const data = doc.data() as IFirestoreUser;
      marketersMap.set(doc.id, { ...data, id: doc.id });
    });

    const allUsersSnapshot = await usersCollection.get();
    const marketerCounts = new Map<string, number>();

    allUsersSnapshot.forEach((doc) => {
      const user = doc.data() as IFirestoreUser;
      const survey = user.postPaymentSurvey;
      if (survey?.contacted === true && typeof survey.marketerId === 'string' && survey.marketerId.trim().length > 0) {
        const id = survey.marketerId.trim();
        marketerCounts.set(id, (marketerCounts.get(id) ?? 0) + 1);
      }
    });

    const marketers = Array.from(marketersMap.values()).map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      profilePhoto1: user.profilePhoto1,
      marketedCount: marketerCounts.get(user.id) ?? 0,
    }));

    return res.status(200).json({ marketers });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error fetching marketers:', error);
    return res.status(500).json({ message: `Failed to retrieve marketers: ${errorMessage}` });
  }
};

const getMarketerCustomers = async (req: CustomRequest, res: Response) => {
  const firebaseUid = req.userId;
  const currentUser = await requireAdmin(firebaseUid, res);
  if (!currentUser) return;

  const marketerId = req.params.id;
  if (!marketerId || typeof marketerId !== 'string') {
    return res.status(400).json({ message: 'Invalid marketer ID.' });
  }

  try {
    const marketerDoc = await usersCollection.doc(marketerId).get();
    if (!marketerDoc.exists) {
      return res.status(404).json({ message: 'Marketer not found.' });
    }

    const customersSnapshot = await usersCollection
      .where('postPaymentSurvey.marketerId', '==', marketerId)
      .where('postPaymentSurvey.contacted', '==', true)
      .get();

    const customers = customersSnapshot.docs.map((doc) => {
      const user = doc.data() as IFirestoreUser;
      return {
        id: doc.id,
        name: user.name,
        email: user.email,
        subscriptionStatus: user.subscriptionStatus,
        location: user.location,
        postPaymentSurvey: user.postPaymentSurvey,
      };
    });

    return res.status(200).json({ users: customers });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error fetching marketer customers:', error);
    return res.status(500).json({ message: `Failed to retrieve marketer customers: ${errorMessage}` });
  }
};

const submitPostPaymentSurvey = async (req: CustomRequest, res: Response) => {
  const firebaseUid = req.userId;
  if (!firebaseUid) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const body = req.body as {
    contacted?: unknown;
    marketerId?: unknown;
  };

  const contacted = body.contacted === true;
  const marketerId = typeof body.marketerId === 'string' && body.marketerId.trim() ? body.marketerId.trim() : undefined;

  try {
    const surveyUpdate: Record<string, unknown> = {
      contacted,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (marketerId) {
      const marketerDoc = await usersCollection.doc(marketerId).get();
      if (marketerDoc.exists) {
        const marketerData = marketerDoc.data() as IFirestoreUser;
        surveyUpdate.marketerId = marketerId;
        surveyUpdate.marketerName = marketerData.name;
      } else {
        surveyUpdate.marketerId = marketerId;
      }
    }

    const update: Record<string, unknown> = {
      postPaymentSurvey: surveyUpdate,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await usersCollection.doc(firebaseUid).set(update, { merge: true });

    return res.status(200).json({
      message: 'Survey saved successfully.',
    });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error saving post-payment survey:', error);
    return res.status(500).json({ message: `Failed to save survey: ${errorMessage}` });
  }
};

const getAdminPlatformStats = async (req: CustomRequest, res: Response) => {
  const firebaseUid = req.userId;
  const currentUser = await requireAdmin(firebaseUid, res);
  if (!currentUser) return;

  try {
    const [usersSnapshot, matchesSnapshot] = await Promise.all([
      usersCollection.get(),
      matchesCollection.get(),
    ]);

    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    let activeToday = 0;
    let completedOnboarding = 0;
    let activeBoosts = 0;

    usersSnapshot.forEach((doc) => {
      const user = doc.data() as IFirestoreUser;
      if (user.onboardingCompleted) {
        completedOnboarding += 1;
      }

      const lastSeenAt = normalizeFirestoreTimestamp(user.lastSeenAt);
      if (!lastSeenAt) return;

      const seenAt = new Date(lastSeenAt).getTime();
      if (!Number.isNaN(seenAt) && seenAt >= dayAgo) {
        activeToday += 1;
      }

      const boosterActiveUntil = normalizeFirestoreTimestamp(user.profileBoosterActiveUntil);
      if (boosterActiveUntil) {
        const activeUntil = new Date(boosterActiveUntil).getTime();
        if (!Number.isNaN(activeUntil) && activeUntil > now) {
          activeBoosts += 1;
        }
      }
    });

    return res.status(200).json({
      totalUsers: usersSnapshot.size,
      completedOnboarding,
      activeToday,
      totalMatches: matchesSnapshot.size,
      activeBoosts,
    });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error fetching admin platform stats:', error);
    return res.status(500).json({ message: `Failed to retrieve platform stats: ${errorMessage}` });
  }
};

const getDeveloperOverview = async (req: CustomRequest, res: Response) => {
  const firebaseUid = req.userId;
  const currentUser = await requireDeveloper(firebaseUid, res);
  if (!currentUser) return;

  try {
    const [usersSnapshot, matchesSnapshot, supportSnapshot, featureSettings] = await Promise.all([
      usersCollection.get(),
      matchesCollection.get(),
      db.collection('supportTickets').get(),
      getPassportFeatureSettings(),
    ]);

    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    let activeToday = 0;
    let completedOnboarding = 0;
    let activeBoosts = 0;
    let activePremium = 0;
    let admins = 0;
    let developers = 0;

    usersSnapshot.forEach((doc) => {
      const user = doc.data() as IFirestoreUser;
      if (isAdminUser(user)) admins += 1;
      if (isDeveloperUser(user)) developers += 1;
      if (user.onboardingCompleted) completedOnboarding += 1;
      if (
        typeof user.subscriptionStatus === 'string' &&
        user.subscriptionStatus.toLowerCase() === 'active' &&
        typeof user.subscriptionTier === 'string' &&
        ['premium', 'elite'].includes(user.subscriptionTier.toLowerCase())
      ) {
        activePremium += 1;
      }

      const lastSeenAt = normalizeFirestoreTimestamp(user.lastSeenAt);
      if (lastSeenAt) {
        const seenAt = new Date(lastSeenAt).getTime();
        if (!Number.isNaN(seenAt) && seenAt >= dayAgo) {
          activeToday += 1;
        }
      }

      const boosterActiveUntil = normalizeFirestoreTimestamp(user.profileBoosterActiveUntil);
      if (boosterActiveUntil) {
        const activeUntil = new Date(boosterActiveUntil).getTime();
        if (!Number.isNaN(activeUntil) && activeUntil > now) {
          activeBoosts += 1;
        }
      }
    });

    const supportTickets = supportSnapshot.docs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        return {
          id: doc.id,
          type: typeof data.type === 'string' ? data.type : 'HELP',
          subject: typeof data.subject === 'string' ? data.subject : 'Support ticket',
          status: typeof data.status === 'string' ? data.status : 'OPEN',
          reporterEmail: typeof data.reporterEmail === 'string' ? data.reporterEmail : '',
          createdAt: normalizeFirestoreTimestamp(data.createdAt),
        };
      })
      .sort((left, right) => {
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        return rightTime - leftTime;
      });

    const openTickets = supportTickets.filter((ticket) => ticket.status.toLowerCase() !== 'responded').length;
    const respondedTickets = supportTickets.length - openTickets;

    return res.status(200).json({
      summary: {
        totalUsers: usersSnapshot.size,
        admins,
        developers,
        completedOnboarding,
        activePremium,
        activeToday,
        activeBoosts,
        totalMatches: matchesSnapshot.size,
        totalTickets: supportTickets.length,
        openTickets,
        respondedTickets,
      },
      featureSettings,
      recentTickets: supportTickets.slice(0, 6),
    });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error fetching developer overview:', error);
    return res.status(500).json({ message: `Failed to retrieve developer overview: ${errorMessage}` });
  }
};

const getOnboardingDebug = async (req: CustomRequest, res: Response) => {
  const requestedId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  const targetUid = requestedId || req.userId;

  if (!targetUid) {
    return res.status(401).json({ message: 'Authentication required: Firebase UID missing.' });
  }

  if (requestedId && requestedId !== req.userId) {
    const callerDoc = await usersCollection.doc(req.userId!).get();
    const callerData = callerDoc.data() as IFirestoreUser | undefined;
    if (!isAdminUser(callerData) && !isDeveloperUser(callerData)) {
      return res.status(403).json({ message: 'Forbidden: you can only access your own debug data.' });
    }
  }

  try {
    const userDoc = await usersCollection.doc(targetUid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const rawData = userDoc.data() || {};

    return res.status(200).json({
      id: userDoc.id,
      fetchedAt: new Date().toISOString(),
      onboardingDocument: rawData,
      profilePhotoCount: countProfilePhotos(rawData),
    });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error fetching onboarding debug data:', error);
    return res
      .status(500)
      .json({ message: `Failed to retrieve onboarding debug data: ${errorMessage}` });
  }
};

const updateUserProfile = async (req: Request, res: Response) => {
  try {
    const uid = (req as CustomRequest).userId;
    if (!uid) return res.status(401).json({ message: 'Unauthorized' });

    const body = (req.body || {}) as Record<string, unknown>;

    const toTrimmedString = (value: unknown, maxLen = 300): string | undefined => {
      if (typeof value !== 'string') return undefined;
      const cleaned = value.trim();
      if (!cleaned) return undefined;
      return cleaned.slice(0, maxLen);
    };

    const toBoundedNumber = (value: unknown, min: number, max: number): number | undefined => {
      if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
      return Math.min(max, Math.max(min, value));
    };

    const toStringArray = (value: unknown, maxItems = 20, maxLen = 60): string[] | undefined => {
      if (!Array.isArray(value)) return undefined;
      return value
        .filter((item) => typeof item === 'string')
        .map((item) => (item as string).trim())
        .filter(Boolean)
        .slice(0, maxItems)
        .map((item) => item.slice(0, maxLen));
    };

    const toProfileFits = (value: unknown): string[] | undefined => {
      const cleaned = toStringArray(value, 8, 80);
      if (cleaned === undefined) return undefined;
      return cleaned;
    };

    const allowedEnum = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined => {
      if (typeof value !== 'string') return undefined;
      return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
    };

    const normalizedUpdates: Record<string, unknown> = {};

    const gender = allowedEnum(body.gender, ['MALE', 'FEMALE'] as const);
    if (gender) normalizedUpdates.gender = gender;

    const age = toBoundedNumber(body.age, 18, 99);
    if (age !== undefined) normalizedUpdates.age = Math.round(age);

    const faithJourney = allowedEnum(
      body.faithJourney,
      ['GROWING', 'ROOTED', 'EXPLORING', 'PASSIONATE'] as const
    );
    if (faithJourney) normalizedUpdates.faithJourney = faithJourney;

    const churchAttendance = allowedEnum(
      body.churchAttendance,
      ['WEEKLY', 'BI_WEEKLY', 'BIWEEKLY', 'MONTHLY', 'OCCASIONALLY', 'RARELY'] as const
    );
    if (churchAttendance) normalizedUpdates.churchAttendance = churchAttendance;

    const sundayActivity = allowedEnum(
      body.sundayActivity,
      ['WEEKLY', 'BI_WEEKLY', 'BIWEEKLY', 'MONTHLY', 'OCCASIONALLY', 'RARELY'] as const
    );
    if (sundayActivity) normalizedUpdates.sundayActivity = sundayActivity;

    const baptismStatus = allowedEnum(
      body.baptismStatus,
      ['BAPTIZED', 'NOT_BAPTIZED', 'PENDING', 'PLANNING_TO', 'PREFER_NOT_TO_SAY'] as const
    );
    if (baptismStatus) normalizedUpdates.baptismStatus = baptismStatus;

    if ('preferredGender' in body) {
      const pg = allowedEnum(body.preferredGender, ['MALE', 'FEMALE'] as const);
      normalizedUpdates.preferredGender = pg ?? null;
    }

    const shortTextFields: Array<[string, number]> = [
      ['name', 120],
      ['denomination', 80],
      ['location', 160],
      ['countryCode', 8],
      ['phoneNumber', 30],
      ['fieldOfStudy', 120],
      ['profession', 120],
      ['preferredDenomination', 80],
      ['lifestyle', 80],
      ['drinkingHabit', 80],
      ['smokingHabit', 80],
      ['workoutHabit', 80],
      ['petPreference', 80],
      ['height', 20],
      ['language', 60],
      ['favoriteVerse', 120],
      ['personalPromptQuestion', 120],
      ['personalPromptAnswer', 280],
      ['communicationStyle', 80],
      ['loveStyle', 80],
      ['educationLevel', 80],
      ['zodiacSign', 40],
    ];

    shortTextFields.forEach(([field, maxLen]) => {
      const value = toTrimmedString(body[field], maxLen);
      if (value !== undefined) normalizedUpdates[field] = value;
    });

    const bio = toTrimmedString(body.bio, 500);
    if (bio !== undefined) normalizedUpdates.bio = bio;

    const birthday = toTrimmedString(body.birthday, 40);
    if (birthday !== undefined) normalizedUpdates.birthday = birthday;

    const latitude = toBoundedNumber(body.latitude, -90, 90);
    if (latitude !== undefined) normalizedUpdates.latitude = latitude;

    const longitude = toBoundedNumber(body.longitude, -180, 180);
    if (longitude !== undefined) normalizedUpdates.longitude = longitude;

    const minAge = toBoundedNumber(body.minAge, 18, 99);
    if (minAge !== undefined) normalizedUpdates.minAge = Math.round(minAge);

    const maxAge = toBoundedNumber(body.maxAge, 18, 99);
    if (maxAge !== undefined) normalizedUpdates.maxAge = Math.round(maxAge);

    const maxDistance = toBoundedNumber(body.maxDistance, 1, 500);
    if (maxDistance !== undefined) normalizedUpdates.maxDistance = Math.round(maxDistance);

    const listFields = [
      'hobbies',
      'values',
      'lookingFor',
      'relationshipGoals',
      'interests',
      'spiritualGifts',
      'preferredFaithJourney',
      'preferredChurchAttendance',
      'preferredRelationshipGoals',
      'personality',
    ];

    listFields.forEach((field) => {
      const value = toStringArray(body[field]);
      if (value !== undefined) normalizedUpdates[field] = value;
    });

    const profileFits = toProfileFits(body.profileFits);
    if (profileFits !== undefined) {
      if (profileFits.length < 3) {
        return res.status(400).json({ message: 'Please select at least 3 profile fit options.' });
      }
      normalizedUpdates.profileFits = profileFits;
    }

    normalizedUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    if (Object.keys(normalizedUpdates).length === 1) {
      return res.status(400).json({ message: 'No valid profile fields provided.' });
    }

    const userRef = db.collection('users').doc(uid);
    await userRef.set(normalizedUpdates, { merge: true });

    const updatedDoc = await userRef.get();
    const updatedData = updatedDoc.data();

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: updatedData,
    });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error updating profile:', error);
    return res.status(500).json({ message: errorMessage });
  }
};

const updateUserSettings = async (req: Request, res: Response) => {
  try {
    const uid = (req as CustomRequest).userId;
    if (!uid) return res.status(401).json({ message: 'Unauthorized' });

    const settings = req.body || {};
    const userRef = db.collection('users').doc(uid);

    await userRef.set(
      {
        settings,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(200).json({ message: 'Settings updated successfully.' });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error updating settings:', error);
    return res.status(500).json({ message: errorMessage });
  }
};

const updatePassportSettings = async (req: CustomRequest, res: Response) => {
  try {
    const uid = req.userId;
    if (!uid) return res.status(401).json({ message: 'Unauthorized' });

    const userDoc = await usersCollection.doc(uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User profile not found.' });
    }

    const currentUser = userDoc.data() as IFirestoreUser;
    const featureSettings = await getPassportFeatureSettings();
    if (!featureSettings.passportModeEnabled) {
      return res.status(403).json({ message: 'Passport Mode is currently unavailable.' });
    }

    const isPremiumUser =
      currentUser.subscriptionStatus === 'active' &&
      ['premium', 'elite'].includes(String(currentUser.subscriptionTier || '').toLowerCase());

    if (!isPremiumUser) {
      return res.status(403).json({ message: 'Passport Mode is available for premium users only.' });
    }

    const passportCountry =
      req.body?.passportCountry === null
        ? null
        : normalizeCountryCode(req.body?.passportCountry);

    if (req.body?.passportCountry !== null && !passportCountry) {
      return res.status(400).json({ message: 'A valid passport country code is required.' });
    }

    await usersCollection.doc(uid).set(
      {
        passportCountry,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(200).json({
      message: passportCountry ? 'Passport country updated successfully.' : 'Passport Mode cleared.',
      passportCountry,
    });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error updating passport settings:', error);
    return res.status(500).json({ message: errorMessage });
  }
};

const getFeatureSettings = async (req: CustomRequest, res: Response) => {
  const uid = req.userId;
  if (!uid) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const settings = await getPassportFeatureSettings();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    return res.status(200).json(settings);
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error fetching feature settings:', error);
    return res.status(500).json({ message: errorMessage });
  }
};

const getPublicFeatureSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await getPassportFeatureSettings();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    return res.status(200).json(settings);
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error fetching public feature settings:', error);
    return res.status(500).json({ message: errorMessage });
  }
};

const updateFeatureSettings = async (req: CustomRequest, res: Response) => {
  const firebaseUid = req.userId;
  const currentUser = await requireAdmin(firebaseUid, res);
  if (!currentUser) return;

  try {
    const currentSettings = await getPassportFeatureSettings();
    const settings = await setPassportFeatureSettings({
      passportModeEnabled:
        typeof req.body?.passportModeEnabled === 'boolean'
          ? req.body.passportModeEnabled
          : currentSettings.passportModeEnabled,
      maintenanceModeEnabled: currentSettings.maintenanceModeEnabled,
      shutdownModeEnabled: currentSettings.shutdownModeEnabled,
      backendOnlyShutdownEnabled: currentSettings.backendOnlyShutdownEnabled,
    });

    return res.status(200).json({
      message: 'Feature settings updated successfully.',
      ...settings,
    });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error updating feature settings:', error);
    return res.status(500).json({ message: errorMessage });
  }
};

const updateDeveloperFeatureSettings = async (req: CustomRequest, res: Response) => {
  const firebaseUid = req.userId;
  const currentUser = await requireDeveloper(firebaseUid, res);
  if (!currentUser) return;

  try {
    const currentSettings = await getPassportFeatureSettings();
    const settings = await setPassportFeatureSettings({
      passportModeEnabled:
        typeof req.body?.passportModeEnabled === 'boolean'
          ? req.body.passportModeEnabled
          : currentSettings.passportModeEnabled,
      maintenanceModeEnabled:
        typeof req.body?.maintenanceModeEnabled === 'boolean'
          ? req.body.maintenanceModeEnabled
          : currentSettings.maintenanceModeEnabled,
      shutdownModeEnabled:
        typeof req.body?.shutdownModeEnabled === 'boolean'
          ? req.body.shutdownModeEnabled
          : currentSettings.shutdownModeEnabled,
      backendOnlyShutdownEnabled:
        typeof req.body?.backendOnlyShutdownEnabled === 'boolean'
          ? req.body.backendOnlyShutdownEnabled
          : currentSettings.backendOnlyShutdownEnabled,
    });

    return res.status(200).json({
      message: 'Developer feature settings updated successfully.',
      ...settings,
    });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error updating developer feature settings:', error);
    return res.status(500).json({ message: errorMessage });
  }
};

const activateProfileBooster = async (req: CustomRequest, res: Response) => {
  try {
    const uid = req.userId;
    if (!uid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await activateProfileBoosterForUser(uid);

    return res.status(200).json({
      message: 'Profile boost activated for 1 hour.',
      ...result,
    });
  } catch (error) {
    if (error instanceof ProfileBoosterError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error activating profile booster:', error);
    return res.status(500).json({ message: errorMessage });
  }
};

const updateUserRole = async (req: CustomRequest, res: Response) => {
  const firebaseUid = req.userId;
  const currentUser = await requireAdmin(firebaseUid, res);
  if (!currentUser) return;

  const targetUserId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  const nextRole = typeof req.body?.role === 'string' ? req.body.role.trim().toLowerCase() : '';

  if (!targetUserId) {
    return res.status(400).json({ message: 'Target user ID is required.' });
  }

  if (!['user', 'admin', 'marketer'].includes(nextRole)) {
    return res.status(400).json({ message: 'Role must be user, marketer, or admin.' });
  }

  try {
    const targetUserRef = usersCollection.doc(targetUserId);
    const targetUserDoc = await targetUserRef.get();
    if (!targetUserDoc.exists) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    const targetUser = targetUserDoc.data() as IFirestoreUser;
    if (isAdminUser(targetUser)) {
      return res.status(403).json({ message: 'Admin roles cannot be changed from the admin console.' });
    }

    await targetUserRef.set(
      {
        role: nextRole,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(200).json({
      message: `User role updated to ${nextRole}.`,
      user: {
        id: targetUserId,
        email: targetUser.email,
        name: targetUser.name,
        role: nextRole,
        roles: getNormalizedRoles(targetUser),
      },
    });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error updating user role:', error);
    return res.status(500).json({ message: `Failed to update user role: ${errorMessage}` });
  }
};

const updateUserByAdmin = async (req: CustomRequest, res: Response) => {
  const firebaseUid = req.userId;
  const currentUser = await requireAdmin(firebaseUid, res);
  if (!currentUser) return;

  const targetUserId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  if (!targetUserId) {
    return res.status(400).json({ message: 'Target user ID is required.' });
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const targetUserRef = usersCollection.doc(targetUserId);

  try {
    const targetDoc = await targetUserRef.get();
    if (!targetDoc.exists) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    const targetUser = targetDoc.data() as IFirestoreUser;
    const updates: Record<string, unknown> = {};
    const currentRoles = getNormalizedRoles(targetUser).filter((role) => role !== 'admin' && role !== 'user');

    const toTrimmedString = (value: unknown, maxLen: number): string | undefined => {
      if (typeof value !== 'string') return undefined;
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      return trimmed.slice(0, maxLen);
    };

    const toBoundedNumber = (value: unknown, min: number, max: number): number | undefined => {
      if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
      return Math.max(min, Math.min(max, Math.round(value)));
    };

    const nextName = toTrimmedString(body.name, 120);
    if (nextName !== undefined) updates.name = nextName;

    const nextEmail = toTrimmedString(body.email, 200)?.toLowerCase();
    if (nextEmail !== undefined && nextEmail !== targetUser.email) {
      updates.email = nextEmail;
      await admin.auth().updateUser(targetUserId, { email: nextEmail });
    }

    const nextLocation = toTrimmedString(body.location, 160);
    if (nextLocation !== undefined) updates.location = nextLocation;

    const nextBio = toTrimmedString(body.bio, 500);
    if (nextBio !== undefined) updates.bio = nextBio;

    const nextDenomination = toTrimmedString(body.denomination, 80);
    if (nextDenomination !== undefined) updates.denomination = nextDenomination;

    const nextGender = toTrimmedString(body.gender, 20);
    if (nextGender !== undefined) updates.gender = nextGender;

    if ('preferredGender' in body) {
      const pg = typeof body.preferredGender === 'string' ? body.preferredGender.trim().toUpperCase() : '';
      updates.preferredGender = pg === 'MALE' || pg === 'FEMALE' ? pg : null;
    }

    const nextAge = toBoundedNumber(body.age, 18, 99);
    if (nextAge !== undefined) updates.age = nextAge;

    if (typeof body.onboardingCompleted === 'boolean') {
      updates.onboardingCompleted = body.onboardingCompleted;
    }

    if (typeof body.isActive === 'boolean') {
      updates.isActive = body.isActive;
    }

    const nextRole = typeof body.role === 'string' ? body.role.trim().toLowerCase() : '';
    if (nextRole) {
      if (!['user', 'admin', 'marketer'].includes(nextRole)) {
        return res.status(400).json({ message: 'Role must be user, marketer, or admin.' });
      }
      if (isAdminUser(targetUser)) {
        return res.status(403).json({ message: 'Admin roles cannot be changed from the admin console.' });
      }
      updates.role = nextRole;
    }

    if ('roles' in body) {
      if (!Array.isArray(body.roles)) {
        return res.status(400).json({ message: 'Roles must be an array when provided.' });
      }

      const nextRoles = body.roles
        .filter((role): role is string => typeof role === 'string')
        .map((role) => role.trim().toLowerCase())
        .filter((role) => role === 'developer');

      updates.roles = Array.from(new Set(nextRoles));
    } else if ('hasDeveloperAccess' in body) {
      if (typeof body.hasDeveloperAccess !== 'boolean') {
        return res.status(400).json({ message: 'Developer access flag must be a boolean.' });
      }

      updates.roles = body.hasDeveloperAccess
        ? Array.from(new Set([...currentRoles, 'developer']))
        : currentRoles.filter((role) => role !== 'developer');
    }

    const nextSubscriptionStatus =
      typeof body.subscriptionStatus === 'string' ? body.subscriptionStatus.trim().toLowerCase() : '';
    const nextSubscriptionTier =
      typeof body.subscriptionTier === 'string' ? body.subscriptionTier.trim().toLowerCase() : '';
    const nextSubscriptionBillingCycle =
      typeof body.subscriptionBillingCycle === 'string'
        ? body.subscriptionBillingCycle.trim().toLowerCase()
        : '';

    const hasSubscriptionUpdate =
      Boolean(nextSubscriptionStatus) || Boolean(nextSubscriptionTier) || Boolean(nextSubscriptionBillingCycle);

    if (hasSubscriptionUpdate) {
      const resolvedStatus = ['active', 'pending', 'inactive'].includes(nextSubscriptionStatus)
        ? nextSubscriptionStatus
        : (typeof targetUser.subscriptionStatus === 'string' ? targetUser.subscriptionStatus : 'inactive');
      const resolvedTier = ['free', 'premium', 'elite'].includes(nextSubscriptionTier)
        ? nextSubscriptionTier
        : (typeof targetUser.subscriptionTier === 'string' ? targetUser.subscriptionTier : 'free');
      const resolvedBillingCycle = ['monthly', 'quarterly'].includes(nextSubscriptionBillingCycle)
        ? nextSubscriptionBillingCycle
        : (typeof targetUser.subscription?.billingCycle === 'string'
          ? targetUser.subscription.billingCycle
          : 'monthly');

      updates.subscriptionStatus = resolvedStatus;
      updates.subscriptionTier = resolvedTier;
      updates.subscriptionCurrency =
        typeof targetUser.subscriptionCurrency === 'string'
          ? targetUser.subscriptionCurrency
          : typeof targetUser.subscription?.currency === 'string'
            ? targetUser.subscription?.currency
            : 'NGN';
      updates.subscription = {
        ...(targetUser.subscription || {}),
        status: resolvedStatus,
        tier: resolvedTier,
        billingCycle: resolvedBillingCycle,
        currency:
          typeof targetUser.subscription?.currency === 'string'
            ? targetUser.subscription.currency
            : typeof targetUser.subscriptionCurrency === 'string'
              ? targetUser.subscriptionCurrency
              : 'NGN',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await targetUserRef.set(updates, { merge: true });

    const updatedDoc = await targetUserRef.get();
    const updatedUser = updatedDoc.data() as IFirestoreUser;

    return res.status(200).json({
      message: 'User updated successfully.',
      user: {
        id: updatedDoc.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: getEffectiveRole(updatedUser),
        roles: getNormalizedRoles(updatedUser),
        age: updatedUser.age,
        gender: updatedUser.gender,
        preferredGender: updatedUser.preferredGender ?? null,
        location: updatedUser.location,
        bio: updatedUser.bio,
        denomination: updatedUser.denomination,
        onboardingCompleted: updatedUser.onboardingCompleted,
        isActive: updatedUser.isActive !== false,
        subscriptionStatus: updatedUser.subscriptionStatus,
        subscriptionTier: updatedUser.subscriptionTier,
        subscriptionBillingCycle:
          typeof updatedUser.subscription?.billingCycle === 'string'
            ? updatedUser.subscription.billingCycle
            : undefined,
      },
    });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error updating user by admin:', error);
    return res.status(500).json({ message: `Failed to update user: ${errorMessage}` });
  }
};

const resetUserPasswordByAdmin = async (req: CustomRequest, res: Response) => {
  const firebaseUid = req.userId;
  const currentUser = await requireAdmin(firebaseUid, res);
  if (!currentUser) return;

  const targetUserId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  if (!targetUserId) {
    return res.status(400).json({ message: 'Target user ID is required.' });
  }

  try {
    const targetUserDoc = await usersCollection.doc(targetUserId).get();
    if (!targetUserDoc.exists) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    const targetUser = targetUserDoc.data() as IFirestoreUser;
    if (!targetUser.email) {
      return res.status(400).json({ message: 'Target user does not have an email address.' });
    }

    const resetLink = await admin.auth().generatePasswordResetLink(targetUser.email);

    return res.status(200).json({
      message: 'Password reset link generated successfully.',
      resetLink,
      user: {
        id: targetUserId,
        email: targetUser.email,
        name: targetUser.name,
      },
    });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error generating password reset link:', error);
    return res
      .status(500)
      .json({ message: `Failed to generate password reset link: ${errorMessage}` });
  }
};

const performUserDeletion = async (uid: string): Promise<void> => {
  // Mark deleted immediately so live queries stop returning this user
  await usersCollection.doc(uid).set(
    { isActive: false, isDeleted: true, deletedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );

  // Remove uid from other users' likes and passes arrays
  const [likersSnap, passersSnap] = await Promise.all([
    usersCollection.where('likes', 'array-contains', uid).get(),
    usersCollection.where('passes', 'array-contains', uid).get(),
  ]);

  if (!likersSnap.empty || !passersSnap.empty) {
    const refsBatch = db.batch();
    likersSnap.forEach((doc) => {
      refsBatch.update(doc.ref, { likes: admin.firestore.FieldValue.arrayRemove(uid) });
    });
    passersSnap.forEach((doc) => {
      refsBatch.update(doc.ref, { passes: admin.firestore.FieldValue.arrayRemove(uid) });
    });
    await refsBatch.commit();
  }

  // Delete match documents where this user is a participant
  const matchesSnap = await db.collection('matches').where('users', 'array-contains', uid).get();
  if (!matchesSnap.empty) {
    const matchBatch = db.batch();
    matchesSnap.forEach((doc) => matchBatch.delete(doc.ref));
    await matchBatch.commit();
  }

  // Delete messages sent or received by this user
  const [sentMsgsSnap, receivedMsgsSnap] = await Promise.all([
    db.collection('messages').where('senderId', '==', uid).get(),
    db.collection('messages').where('receiverId', '==', uid).get(),
  ]);
  const allMessageDocs = [
    ...sentMsgsSnap.docs,
    ...receivedMsgsSnap.docs.filter((d) => !sentMsgsSnap.docs.some((s) => s.id === d.id)),
  ];
  if (allMessageDocs.length > 0) {
    const msgBatch = db.batch();
    allMessageDocs.forEach((doc) => msgBatch.delete(doc.ref));
    await msgBatch.commit();
  }

  // Delete notifications addressed to this user
  const notificationsSnap = await db.collection('notifications').where('userId', '==', uid).get();
  if (!notificationsSnap.empty) {
    const notifBatch = db.batch();
    notificationsSnap.forEach((doc) => notifBatch.delete(doc.ref));
    await notifBatch.commit();
  }

  // Delete stories authored by this user
  const storiesSnap = await db.collection('stories').where('authorId', '==', uid).get();
  if (!storiesSnap.empty) {
    const storyBatch = db.batch();
    storiesSnap.forEach((doc) => storyBatch.delete(doc.ref));
    await storyBatch.commit();
  }

  // Hard-delete Firestore doc then Firebase Auth account
  await usersCollection.doc(uid).delete();
  await admin.auth().deleteUser(uid);
};

const deleteUserByAdmin = async (req: CustomRequest, res: Response) => {
  const firebaseUid = req.userId;
  const currentUser = await requireAdmin(firebaseUid, res);
  if (!currentUser) return;

  const targetUserId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
  if (!targetUserId) {
    return res.status(400).json({ message: 'Target user ID is required.' });
  }

  if (targetUserId === firebaseUid) {
    return res
      .status(400)
      .json({ message: 'You cannot delete your own admin account from the admin console.' });
  }

  try {
    const targetUserDoc = await usersCollection.doc(targetUserId).get();
    if (!targetUserDoc.exists) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    await performUserDeletion(targetUserId);

    return res.status(200).json({ message: 'User deleted successfully.' });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error deleting user by admin:', error);
    return res.status(500).json({ message: `Failed to delete user: ${errorMessage}` });
  }
};

const deleteMe = async (req: Request, res: Response) => {
  try {
    const uid = (req as CustomRequest).userId;
    if (!uid) return res.status(401).json({ message: 'Unauthorized' });

    await performUserDeletion(uid);

    return res.status(200).json({ message: 'Account deleted successfully.' });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error deleting own account:', error);
    return res.status(500).json({ message: `Failed to delete account: ${errorMessage}` });
  }
};

const deactivateAccount = async (req: Request, res: Response) => {
  try {
    const uid = (req as CustomRequest).userId;
    if (!uid) return res.status(401).json({ message: 'Unauthorized' });

    const userRef = db.collection('users').doc(uid);
    await userRef.set(
      {
        isActive: false,
        deactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(200).json({ message: 'Account deactivated successfully.' });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error deactivating account:', error);
    return res.status(500).json({ message: errorMessage });
  }
};

const reactivateAccount = async (req: Request, res: Response) => {
  try {
    const uid = (req as CustomRequest).userId;
    if (!uid) return res.status(401).json({ message: 'Unauthorized' });

    const userRef = db.collection('users').doc(uid);
    await userRef.set(
      {
        isActive: true,
        reactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(200).json({ message: 'Account reactivated successfully.' });
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'An unknown error occurred';
    console.error('Error reactivating account:', error);
    return res.status(500).json({ message: errorMessage });
  }
};

export {
  getMe,
  getUserById,
  getAllUsers,
  getMarketers,
  getMarketerCustomers,
  getAdminPlatformStats,
  getDeveloperOverview,
  getOnboardingDebug,
  submitPostPaymentSurvey,
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
};
