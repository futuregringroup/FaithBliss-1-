// src/controllers/matchController.ts (FIRESTORE REWRITE + FIXED)

import { Request, Response } from 'express';
import { admin, usersCollection } from '../config/firebase-admin';
import { DocumentData, CollectionReference, Timestamp } from 'firebase-admin/firestore';
import multer from 'multer';
import { Readable } from 'stream';
import { createNotification } from '../services/notificationService';
import { cloudinaryUploader } from '../config/cloudinaryConfig';
import { canViewerSeeCandidate, getPassportFeatureSettings } from '../utils/passportMode';
import { isProfileBoosterActive } from '../utils/profileBooster';
import {
  FREE_CHAT_LIMIT_MESSAGE,
  getChatAccessStateForUser,
  isChatLockedForMatch,
} from '../utils/chatAccess';

// --- FIRESTORE DATA STRUCTURES ---

interface IUserProfile extends DocumentData {
  id: string;
  name: string;
  email: string;
  gender: string;
  preferredGender?: string;
  lookingFor?: string[] | string;
  age: number;
  denomination: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  maxDistance?: number;
  profilePhoto1?: string;
  profilePhoto2?: string;
  profilePhoto3?: string;
  bio?: string;
  onboardingCompleted: boolean;
  likes?: string[];
  passes?: string[];
  passHistory?: Record<string, Timestamp | string | number>;
  dailySwipeUsage?: {
    dateKey?: string;
    count?: number;
  };
  matches?: string[];
  blockedUsers?: string[];
  distance?: number;
  subscriptionStatus?: string;
  subscriptionTier?: string;
  countryCode?: string;
  passportCountry?: string | null;
  profileBoosterActiveUntil?: unknown;
}

interface IMatch extends DocumentData {
  id: string;
  users: string[];
  createdAt: Timestamp;
}

type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'SYSTEM';

interface IMessageAttachment extends DocumentData {
  url: string;
  publicId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  resourceType?: string;
}

interface IMessageReply extends DocumentData {
  id: string;
  senderId: string;
  content?: string;
  type?: MessageType;
  attachment?: IMessageAttachment | null;
}

interface IMessageReaction extends DocumentData {
  userId: string;
  emoji: string;
  createdAt?: Timestamp;
}

interface IMessage extends DocumentData {
  id: string;
  matchId: string;
  senderId: string;
  receiverId?: string;
  content: string;
  type?: MessageType;
  attachment?: IMessageAttachment | null;
  replyTo?: IMessageReply | null;
  reactions?: IMessageReaction[];
  unreadBy?: string[];
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// Firestore references
const db = admin.firestore();
const matchesCollection: CollectionReference = db.collection('matches');
const messagesCollection: CollectionReference = db.collection('messages');
const PASS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const FREE_DAILY_SWIPE_LIMIT = 10;

const messageAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const getMessageTypeFromMimeType = (mimeType: string): MessageType => {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  return 'FILE';
};

const getAttachmentLabel = (message: Pick<IMessage, 'type' | 'attachment'>): string => {
  if (message.type === 'IMAGE') return 'Image';
  if (message.type === 'VIDEO') return 'Video';
  if (message.type === 'AUDIO') return 'Audio';
  if (message.attachment?.mimeType.startsWith('image/')) return 'Image';
  if (message.attachment?.mimeType.startsWith('video/')) return 'Video';
  if (message.attachment?.mimeType.startsWith('audio/')) return 'Audio';
  return 'File';
};

const getMessagePreviewContent = (message: Pick<IMessage, 'content' | 'attachment' | 'type'>): string => {
  if (message.attachment) return getAttachmentLabel(message);

  const text = typeof message.content === 'string' ? message.content.trim() : '';
  if (text) return text;

  return '';
};

const normalizeReplyPreview = (replyTo: unknown): {
  id: string;
  senderId: string;
  content: string;
  type: MessageType;
  attachment: IMessageAttachment | null;
} | null => {
  if (!replyTo || typeof replyTo !== 'object') return null;
  const candidate = replyTo as Record<string, unknown>;

  const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
  const senderId = typeof candidate.senderId === 'string' ? candidate.senderId.trim() : '';
  if (!id || !senderId) return null;

  const content = typeof candidate.content === 'string' ? candidate.content : '';
  const attachmentCandidate = (candidate.attachment && typeof candidate.attachment === 'object')
    ? candidate.attachment as IMessageAttachment
    : null;

  const attachment = attachmentCandidate && typeof attachmentCandidate.url === 'string'
    ? {
      url: attachmentCandidate.url,
      publicId: attachmentCandidate.publicId,
      fileName: attachmentCandidate.fileName,
      mimeType: attachmentCandidate.mimeType,
      fileSize: attachmentCandidate.fileSize,
      resourceType: attachmentCandidate.resourceType,
    }
    : null;

  const typeCandidate = typeof candidate.type === 'string' ? candidate.type as MessageType : undefined;
  const type = typeCandidate || (attachment?.mimeType ? getMessageTypeFromMimeType(attachment.mimeType) : 'TEXT');

  return {
    id,
    senderId,
    content,
    type,
    attachment,
  };
};

const normalizeMessageReactions = (reactions: unknown): Array<{
  userId: string;
  emoji: string;
  createdAt?: string;
}> => {
  if (!Array.isArray(reactions)) return [];

  const deduped = new Map<string, { userId: string; emoji: string; createdAt?: string }>();
  reactions.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const candidate = entry as Record<string, unknown>;
    const userId = typeof candidate.userId === 'string' ? candidate.userId.trim() : '';
    const emoji = typeof candidate.emoji === 'string' ? candidate.emoji.trim() : '';
    if (!userId || !emoji) return;

    const createdAt = (candidate.createdAt && typeof candidate.createdAt === 'object'
      && 'toDate' in (candidate.createdAt as Record<string, unknown>))
      ? ((candidate.createdAt as Timestamp).toDate().toISOString())
      : undefined;

    deduped.set(userId, { userId, emoji, createdAt });
  });

  return Array.from(deduped.values());
};

const resolveMediaApiKey = (
  provider: 'giphy' | 'tenor',
  fallbackFromClient?: string
): string => {
  if (provider === 'giphy') {
    return process.env.GIPHY_API_KEY
      || process.env.VITE_GIPHY_API_KEY
      || fallbackFromClient
      || '';
  }
  return process.env.TENOR_API_KEY
    || process.env.VITE_TENOR_API_KEY
    || fallbackFromClient
    || '';
};

const uploadMessageAttachmentToCloudinary = (
  file: Express.Multer.File
): Promise<IMessageAttachment> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinaryUploader.uploader.upload_stream(
      {
        folder: 'faithbliss_messages',
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error || !result?.secure_url || !result.public_id) {
          reject(error || new Error('Message attachment upload failed'));
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          resourceType: result.resource_type || 'raw',
        });
      }
    );

    Readable.from(file.buffer).pipe(uploadStream);
  });
};

// Helper: safely extract message from unknown error
function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

const normalizeIdList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).filter(Boolean) : [];

const toEpochMillis = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === 'object' && 'toDate' in (value as Record<string, unknown>)) {
    try {
      return (value as Timestamp).toDate().getTime();
    } catch {
      return null;
    }
  }
  return null;
};

const getRecentPassedProfileIds = (passHistory: unknown, now = Date.now()): string[] => {
  if (!passHistory || typeof passHistory !== 'object' || Array.isArray(passHistory)) {
    return [];
  }

  return Object.entries(passHistory as Record<string, unknown>)
    .filter(([targetUid, passedAt]) => {
      if (!targetUid) return false;
      const passedAtMs = toEpochMillis(passedAt);
      return passedAtMs !== null && now - passedAtMs < PASS_COOLDOWN_MS;
    })
    .map(([targetUid]) => String(targetUid));
};

const getUtcDateKey = (now = new Date()): string => now.toISOString().slice(0, 10);

const isPremiumSubscriber = (user: Pick<IUserProfile, 'subscriptionStatus' | 'subscriptionTier'>): boolean => {
  return user.subscriptionStatus === 'active'
    && ['premium', 'elite'].includes(String(user.subscriptionTier || '').toLowerCase());
};

const getDailySwipeCountForDate = (
  usage: IUserProfile['dailySwipeUsage'],
  dateKey: string
): number => {
  if (!usage || typeof usage !== 'object') return 0;
  if (usage.dateKey !== dateKey) return 0;

  const count = Number(usage.count);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

const createHttpError = (status: number, message: string): Error & { status: number } => {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
};

const isBlockedBetween = (currentUser: IUserProfile, otherUser: IUserProfile): boolean => {
  const currentBlocked = normalizeIdList(currentUser.blockedUsers);
  const otherBlocked = normalizeIdList(otherUser.blockedUsers);
  return currentBlocked.includes(String(otherUser.id)) || otherBlocked.includes(String(currentUser.id));
};

const getSharedMatchIdsBetween = async (currentUid: string, targetUid: string): Promise<string[]> => {
  const snapshot = await matchesCollection.where('users', 'array-contains', currentUid).get();
  return snapshot.docs
    .filter((doc) => {
      const data = doc.data() as IMatch;
      return Array.isArray(data.users) && data.users.includes(targetUid);
    })
    .map((doc) => doc.id);
};

const removeRelationshipArtifacts = async (currentUid: string, targetUid: string): Promise<string[]> => {
  const sharedMatchIds = await getSharedMatchIdsBetween(currentUid, targetUid);
  const batch = db.batch();
  const currentUserRef = usersCollection.doc(currentUid);
  const targetUserRef = usersCollection.doc(targetUid);

  const currentUpdate: Record<string, unknown> = {
    likes: admin.firestore.FieldValue.arrayRemove(targetUid),
    passes: admin.firestore.FieldValue.arrayRemove(targetUid),
    [`passHistory.${targetUid}`]: admin.firestore.FieldValue.delete(),
  };
  const targetUpdate: Record<string, unknown> = {
    likes: admin.firestore.FieldValue.arrayRemove(currentUid),
    passes: admin.firestore.FieldValue.arrayRemove(currentUid),
    [`passHistory.${currentUid}`]: admin.firestore.FieldValue.delete(),
  };

  if (sharedMatchIds.length > 0) {
    currentUpdate.matches = admin.firestore.FieldValue.arrayRemove(...sharedMatchIds);
    targetUpdate.matches = admin.firestore.FieldValue.arrayRemove(...sharedMatchIds);
  }

  batch.update(currentUserRef, currentUpdate);
  batch.update(targetUserRef, targetUpdate);

  sharedMatchIds.forEach((matchId) => {
    batch.delete(matchesCollection.doc(matchId));
  });

  await batch.commit();
  return sharedMatchIds;
};

// Helper to fetch current user profile
const fetchCurrentUser = async (req: Request, res: Response): Promise<IUserProfile | null> => {
  const uid = req.userId;

  if (!uid) {
    console.warn('?? fetchCurrentUser: Missing UID from request context.');
    res.status(401).json({ message: 'Unauthorized: Firebase UID missing from request context.' });
    return null;
  }

  try {
    console.log(`?? Fetching current user profile for UID: ${uid}`);
    const userDoc = await usersCollection.doc(uid).get();

    if (!userDoc.exists) {
      console.warn(`?? No Firestore user profile found for UID: ${uid}`);
      res.status(404).json({ message: 'User profile not found in database.' });
      return null;
    }

    const user = { ...userDoc.data(), id: userDoc.id } as IUserProfile;
    console.log(`? Fetched current user: ${user.name} (${user.id})`);
    return user;
  } catch (error) {
    const errorMessage = isErrorWithMessage(error) ? error.message : 'Unknown error';
    console.error('?? Database fetch error:', errorMessage);
    res.status(500).json({ message: `Server Error fetching user profile: ${errorMessage}` });
    return null;
  }
};

const uploadMessageAttachmentMiddleware = messageAttachmentUpload.single('file');

const normalizeGenderPreference = (
  preferredGender?: unknown,
  lookingFor?: unknown
): 'MALE' | 'FEMALE' | null => {
  const preferred = typeof preferredGender === 'string' ? preferredGender.trim().toUpperCase() : '';
  if (preferred === 'MALE' || preferred === 'FEMALE') return preferred;
  if (preferred === 'MAN') return 'MALE';
  if (preferred === 'WOMAN') return 'FEMALE';

  const choices = Array.isArray(lookingFor)
    ? lookingFor
    : typeof lookingFor === 'string'
      ? [lookingFor]
      : [];

  const normalizedChoices = choices
    .map((value) => (typeof value === 'string' ? value.trim().toUpperCase() : ''))
    .filter(Boolean);

  if (normalizedChoices.includes('MALE') || normalizedChoices.includes('MAN')) return 'MALE';
  if (normalizedChoices.includes('FEMALE') || normalizedChoices.includes('WOMAN')) return 'FEMALE';

  return null;
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineDistanceKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const uploadMessageAttachment = async (req: Request, res: Response) => {
  const currentUser = await fetchCurrentUser(req, res);
  if (!currentUser) return;

  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  try {
    const attachment = await uploadMessageAttachmentToCloudinary(req.file);

    return res.status(201).json({
      attachment,
      type: getMessageTypeFromMimeType(attachment.mimeType),
    });
  } catch (error) {
    const msg = isErrorWithMessage(error) ? error.message : 'Unknown error';
    console.error('Error uploading message attachment:', error);
    return res.status(500).json({ message: `Server Error: ${msg}` });
  }
};


// =======================================================
// 1?? GET /api/matches/potential
// =======================================================
const getPotentialMatches = async (req: Request, res: Response) => {
  const currentUser = await fetchCurrentUser(req, res);
  if (!currentUser) return;

  try {
    console.log(`?? [getPotentialMatches] Fetching potential matches for ${currentUser.id}`);
    const featureSettings = await getPassportFeatureSettings();

    const preferredGender = normalizeGenderPreference(
      (currentUser as IUserProfile).preferredGender,
      (currentUser as IUserProfile).lookingFor
    );

    const recentPassedIds = getRecentPassedProfileIds(currentUser.passHistory);

    const excludedUids = new Set<string>([
      currentUser.id,
      ...(currentUser.likes || []),
      ...recentPassedIds,
      ...(currentUser.blockedUsers || []),
    ].map(String));

    const matchIds = Array.isArray(currentUser.matches) ? currentUser.matches : [];
    if (matchIds.length > 0) {
      const matchDocs = await Promise.all(
        matchIds.map((matchId) => matchesCollection.doc(String(matchId)).get())
      );
      matchDocs.forEach((doc) => {
        const data = doc.data() as IMatch | undefined;
        const users = data?.users || [];
        users.forEach((uid) => {
          if (uid && uid !== currentUser.id) {
            excludedUids.add(String(uid));
          }
        });
      });
    }

    // Serve a Tinder/Hinge-style feed:
    // - include all registered users
    // - scan in pages so exclusions do not empty the initial result accidentally
    const QUERY_PAGE_SIZE = 120;
    const MAX_SCAN_PAGES = 50;

    const preferredGenderMatches: IUserProfile[] = [];
    const fallbackGenderMatches: IUserProfile[] = [];
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let scannedPages = 0;

    while (scannedPages < MAX_SCAN_PAGES) {
      let query = usersCollection
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(QUERY_PAGE_SIZE);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      if (snapshot.empty) {
        break;
      }

      snapshot.forEach((doc) => {
        const candidate = { id: doc.id, ...doc.data() } as IUserProfile;
        const candidateGender = typeof candidate.gender === 'string' ? candidate.gender.trim().toUpperCase() : '';
        if (excludedUids.has(candidate.id)) return;
        if (candidate.onboardingCompleted !== true) return;
        if (candidate.isActive === false) return;
        if (isBlockedBetween(currentUser, candidate)) return;
        if (!canViewerSeeCandidate(currentUser, candidate, featureSettings.passportModeEnabled)) return;

        if (!preferredGender) {
          preferredGenderMatches.push(candidate);
          return;
        }

        if (candidateGender === preferredGender) {
          preferredGenderMatches.push(candidate);
          return;
        }

        // Fallback pool: opposite gender users not already liked/passed/matched.
        if (candidateGender === 'MALE' || candidateGender === 'FEMALE') {
          fallbackGenderMatches.push(candidate);
        }
      });

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      scannedPages += 1;
    }

    const selectedMatches = preferredGender
      ? [...preferredGenderMatches, ...fallbackGenderMatches]
      : preferredGenderMatches;

    const canComputeDistanceForCurrentUser =
      typeof currentUser.latitude === 'number' &&
      typeof currentUser.longitude === 'number';

    const matchesWithDistance = selectedMatches.map((candidate) => {
      if (
        canComputeDistanceForCurrentUser &&
        typeof candidate.latitude === 'number' &&
        typeof candidate.longitude === 'number'
      ) {
        return {
          ...candidate,
          distance: haversineDistanceKm(
            currentUser.latitude as number,
            currentUser.longitude as number,
            candidate.latitude,
            candidate.longitude
          ),
        };
      }

      return candidate;
    });

    matchesWithDistance.sort((a, b) => {
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

    console.log(`? Potential matches returned: ${matchesWithDistance.length}`);
    res.status(200).json(
      matchesWithDistance.map((u) => ({
        id: u.id,
        name: (typeof u.name === 'string' && u.name.trim()) ? u.name.trim() : 'FaithBliss User',
        onboardingCompleted: u.onboardingCompleted === true,
        age: u.age,
        gender: u.gender,
        denomination: u.denomination,
        location: u.location, 
        latitude: u.latitude,
        longitude: u.longitude,
        profilePhoto1: u.profilePhoto1,
        profilePhoto2: u.profilePhoto2,
        profilePhoto3: u.profilePhoto3,
        profilePhoto4: u.profilePhoto4,
        profilePhoto5: u.profilePhoto5,
        profilePhoto6: u.profilePhoto6,
        hobbies: Array.isArray(u.hobbies) ? u.hobbies : [],
        interests: Array.isArray(u.interests) ? u.interests : [],
        bio: (typeof u.bio === 'string' && u.bio.trim())
          ? u.bio.trim()
          : '',
        personalPromptQuestion:
          typeof u.personalPromptQuestion === 'string' && u.personalPromptQuestion.trim()
            ? u.personalPromptQuestion.trim()
            : '',
        personalPromptAnswer:
          typeof u.personalPromptAnswer === 'string' && u.personalPromptAnswer.trim()
            ? u.personalPromptAnswer.trim()
            : '',
        subscriptionStatus:
          typeof u.subscriptionStatus === 'string' ? u.subscriptionStatus : '',
        subscriptionTier:
          typeof u.subscriptionTier === 'string' ? u.subscriptionTier : '',
        distance: typeof u.distance === 'number' ? Math.round(u.distance) : undefined,
      }))
    );
  } catch (error) {
    const msg = isErrorWithMessage(error) ? error.message : 'Unknown error';
    console.error('?? Error fetching potential matches:', msg);
    res.status(500).json({ message: `Server Error: ${msg}` });
  }
};


// =======================================================
// 2?? POST /api/matches/like/:userId
// =======================================================
const likeUser = async (req: Request, res: Response) => {
  const currentUser = await fetchCurrentUser(req, res);
  if (!currentUser) return;

  const { userId: targetUid } = req.params;
  const currentUid = currentUser.id;
  console.log(`?? Like request from ${currentUid} ? ${targetUid}`);

  if (currentUid === targetUid) {
    console.warn('?? User tried to like themselves.');
    return res.status(400).json({ message: 'Cannot like yourself.' });
  }

  try {
    const currentUserRef = usersCollection.doc(currentUid);
    const targetUserRef = usersCollection.doc(targetUid);
    const actionResult = await db.runTransaction(async (transaction) => {
      const [liveCurrentSnap, targetUserDoc] = await Promise.all([
        transaction.get(currentUserRef),
        transaction.get(targetUserRef),
      ]);

      if (!liveCurrentSnap.exists) {
        throw createHttpError(404, 'User profile not found in database.');
      }

      if (!targetUserDoc.exists) {
        console.warn(`?? Target user not found: ${targetUid}`);
        throw createHttpError(404, 'Target user not found.');
      }

      const liveCurrentUser = { id: liveCurrentSnap.id, ...liveCurrentSnap.data() } as IUserProfile;
      const targetUser = { id: targetUserDoc.id, ...targetUserDoc.data() } as IUserProfile;

      if (isBlockedBetween(liveCurrentUser, targetUser)) {
        throw createHttpError(403, 'You cannot interact with this user.');
      }

      const currentLikes = Array.isArray(liveCurrentUser.likes) ? liveCurrentUser.likes.map(String) : [];
      if (currentLikes.includes(String(targetUid))) {
        return {
          alreadyLiked: true,
          isMatch: false,
          targetUserName: targetUser.name,
        };
      }

      if (!isPremiumSubscriber(liveCurrentUser)) {
        const dateKey = getUtcDateKey();
        const dailySwipeCount = getDailySwipeCountForDate(liveCurrentUser.dailySwipeUsage, dateKey);
        if (dailySwipeCount >= FREE_DAILY_SWIPE_LIMIT) {
          throw createHttpError(403, 'Free plan allows 10 likes or swipes per day. Upgrade to premium for unlimited access.');
        }

        transaction.update(currentUserRef, {
          dailySwipeUsage: {
            dateKey,
            count: dailySwipeCount + 1,
          },
        });
      }

      const targetLikes = Array.isArray(targetUser.likes) ? targetUser.likes.map(String) : [];
      const isMatch = targetLikes.includes(currentUid);
      const currentUserUpdate: Record<string, unknown> = {
        likes: admin.firestore.FieldValue.arrayUnion(targetUid),
        passes: admin.firestore.FieldValue.arrayRemove(targetUid),
        [`passHistory.${targetUid}`]: admin.firestore.FieldValue.delete(),
      };

      if (isMatch) {
        const newMatchRef = matchesCollection.doc();
        const matchId = newMatchRef.id;

        console.log(`?? Mutual match detected! Creating match ${matchId}`);

        transaction.set(newMatchRef, {
          users: [currentUid, targetUid],
          createdAt: admin.firestore.Timestamp.now(),
        });

        currentUserUpdate.matches = admin.firestore.FieldValue.arrayUnion(matchId);
        transaction.update(targetUserRef, {
          matches: admin.firestore.FieldValue.arrayUnion(matchId),
        });
      }

      transaction.update(currentUserRef, currentUserUpdate);

      return {
        alreadyLiked: false,
        isMatch,
        targetUserName: targetUser.name,
      };
    });

    if (actionResult.alreadyLiked) {
      return res.status(200).json({
        message: 'Like already recorded',
        isMatch: false,
        alreadyLiked: true,
      });
    }

    console.log(`? Like processed successfully. Match: ${actionResult.isMatch}`);

    if (actionResult.isMatch) {
      await Promise.all([
        createNotification({
          userId: currentUid,
          type: 'NEW_MATCH',
          message: `You matched with ${actionResult.targetUserName || 'a user'}`,
          data: {
            otherUserId: targetUid,
            otherUserName: actionResult.targetUserName || 'New Match',
          },
        }),
        createNotification({
          userId: targetUid,
          type: 'NEW_MATCH',
          message: `You matched with ${currentUser.name || 'a user'}`,
          data: {
            otherUserId: currentUid,
            otherUserName: currentUser.name || 'New Match',
          },
        }),
      ]);
    } else {
      await createNotification({
        userId: targetUid,
        type: 'PROFILE_LIKED',
        message: `${currentUser.name || 'Someone'} liked your profile`,
        data: {
          senderId: currentUid,
          senderName: currentUser.name || 'Someone',
        },
      });
    }

    res.status(200).json({
      message: actionResult.isMatch ? "It's a Match!" : 'Like recorded',
      isMatch: actionResult.isMatch,
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const typedError = error as Error & { status: number };
      return res.status(typedError.status).json({ message: typedError.message });
    }

    const msg = isErrorWithMessage(error) ? error.message : 'Unknown error';
    console.error('?? Error liking user:', msg);
    res.status(500).json({ message: `Server Error: ${msg}` });
  }
};

// =======================================================
// 3?? POST /api/matches/pass/:userId
// =======================================================
const passUser = async (req: Request, res: Response) => {
  const currentUser = await fetchCurrentUser(req, res);
  if (!currentUser) return;

  const { userId: targetUid } = req.params;
  const currentUid = currentUser.id;

  if (currentUid === targetUid) {
    return res.status(400).json({ message: 'Cannot pass yourself.' });
  }

  try {
    const currentUserRef = usersCollection.doc(currentUid);
    const targetUserRef = usersCollection.doc(targetUid);

    await db.runTransaction(async (transaction) => {
      const [liveCurrentSnap, targetUserDoc] = await Promise.all([
        transaction.get(currentUserRef),
        transaction.get(targetUserRef),
      ]);

      if (!liveCurrentSnap.exists) {
        throw createHttpError(404, 'User profile not found in database.');
      }

      if (!targetUserDoc.exists) {
        throw createHttpError(404, 'Target user not found.');
      }

      const liveCurrentUser = { id: liveCurrentSnap.id, ...liveCurrentSnap.data() } as IUserProfile;
      const targetUser = { id: targetUserDoc.id, ...targetUserDoc.data() } as IUserProfile;

      if (isBlockedBetween(liveCurrentUser, targetUser)) {
        throw createHttpError(403, 'You cannot interact with this user.');
      }

      const recentPassedProfileIds = getRecentPassedProfileIds(liveCurrentUser.passHistory);
      if (recentPassedProfileIds.includes(String(targetUid))) {
        return;
      }

      if (!isPremiumSubscriber(liveCurrentUser)) {
        const dateKey = getUtcDateKey();
        const dailySwipeCount = getDailySwipeCountForDate(liveCurrentUser.dailySwipeUsage, dateKey);
        if (dailySwipeCount >= FREE_DAILY_SWIPE_LIMIT) {
          throw createHttpError(403, 'Free plan allows 10 likes or swipes per day. Upgrade to premium for unlimited access.');
        }

        transaction.update(currentUserRef, {
          dailySwipeUsage: {
            dateKey,
            count: dailySwipeCount + 1,
          },
        });
      }

      transaction.update(currentUserRef, {
        passes: admin.firestore.FieldValue.arrayUnion(targetUid),
        [`passHistory.${targetUid}`]: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    console.log(`?? User ${currentUid} passed on ${targetUid}`);
    res.status(204).send();
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const typedError = error as Error & { status: number };
      return res.status(typedError.status).json({ message: typedError.message });
    }

    const msg = isErrorWithMessage(error) ? error.message : 'Unknown error';
    console.error('Error passing user:', error);
    res.status(500).json({ message: `Server Error: ${msg}` });
  }
};

// =======================================================
// 4?? GET /api/messages/conversations
// =======================================================
const getMatchConversations = async (req: Request, res: Response) => {
  const currentUser = await fetchCurrentUser(req, res);
  if (!currentUser) return;

  const currentUid = currentUser.id;
  const requestedLimit = Number(req.query.limit);
  const safeLimit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50)
    : 25;
  const requestedCursor = Number(req.query.cursor);
  const safeCursor = Number.isFinite(requestedCursor)
    ? Math.max(Math.floor(requestedCursor), 0)
    : 0;

  try {
    const matchIds = currentUser.matches || [];
    if (matchIds.length === 0) return res.status(200).json([]);

    const matchDocs = await Promise.all(
      matchIds.map((id) => matchesCollection.doc(id).get())
    );

    const allMatches: IMatch[] = matchDocs
      .filter((doc) => doc.exists)
      .map((doc) => ({ id: doc.id, ...doc.data() } as IMatch));
    const chatAccessState = await getChatAccessStateForUser({
      matches: currentUser.matches,
      subscriptionStatus: currentUser.subscriptionStatus,
      subscriptionTier: currentUser.subscriptionTier,
    });

    // Keep first payload small to improve page load time.
    const sortedMatches = allMatches
      .sort(
        (a, b) =>
          b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()
      );

    const matches = sortedMatches.slice(safeCursor, safeCursor + safeLimit);

    const otherUids = matches
      .map((m) => m.users.find((u) => u !== currentUid))
      .filter(Boolean) as string[];

    const userDocs = await Promise.all(
      otherUids.map((uid) => usersCollection.doc(uid).get())
    );

    const userMap = new Map<string, Pick<IUserProfile, 'id' | 'name' | 'profilePhoto1'>>();
    userDocs.forEach((doc) => {
      if (doc.exists) {
        const d = doc.data() as IUserProfile;
        userMap.set(doc.id, { id: doc.id, name: d.name, profilePhoto1: d.profilePhoto1 });
      }
    });

    // Query unread messages once, then group per match to avoid N+1 unread queries.
    const unreadSnap = await messagesCollection
      .where('unreadBy', 'array-contains', currentUid)
      .get();

    const unreadCountByMatch = new Map<string, number>();
    unreadSnap.forEach((doc) => {
      const data = doc.data() as IMessage;
      const mid = data.matchId;
      if (!mid) return;
      unreadCountByMatch.set(mid, (unreadCountByMatch.get(mid) || 0) + 1);
    });

    const conversations = await Promise.all(
      matches.map(async (match) => {
        const lastMessageSnap = await messagesCollection
          .where('matchId', '==', match.id)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();

        const lastMsgDoc = lastMessageSnap.docs[0];
        const lastMsg = lastMsgDoc
          ? ({ id: lastMsgDoc.id, ...lastMsgDoc.data() } as IMessage)
          : null;

        const otherUid = match.users.find((u) => u !== currentUid);
        const otherUser = userMap.get(otherUid || '');

        const updatedAt =
          lastMsg?.createdAt.toDate().toISOString() ||
          match.createdAt.toDate().toISOString();
        const chatLocked = isChatLockedForMatch(chatAccessState, match.id);

        return {
          id: match.id,
          otherUser: otherUser || null,
          lastMessage: lastMsg
            ? {
                content: getMessagePreviewContent(lastMsg),
                createdAt: lastMsg.createdAt.toDate().toISOString(),
                type: lastMsg.type || 'TEXT',
                attachment: lastMsg.attachment || null,
              }
            : null,
          unreadCount: unreadCountByMatch.get(match.id) || 0,
          updatedAt,
          chatLocked,
          chatAccessMessage: chatLocked ? FREE_CHAT_LIMIT_MESSAGE : null,
          activeChatMatchId: chatAccessState.activeMatchId,
        };
      })
    );

    conversations.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    const nextCursor =
      safeCursor + matches.length < sortedMatches.length
        ? String(safeCursor + matches.length)
        : null;

    res.status(200).json({
      items: conversations,
      nextCursor,
      hasMore: nextCursor !== null,
    });
  } catch (error) {
    const msg = isErrorWithMessage(error) ? error.message : 'Unknown error';
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: `Server Error: ${msg}` });
  }
};

// =======================================================
// 5?? GET /api/messages/:matchId
// =======================================================
const getMatchMessages = async (req: Request, res: Response) => {
  const currentUser = await fetchCurrentUser(req, res);
  if (!currentUser) return;

  const { matchId } = req.params;
  const currentUid = currentUser.id;

  try {
    const matchDoc = await matchesCollection.doc(matchId).get();
    if (!matchDoc.exists) {
      return res.status(404).json({ message: 'Match not found.' });
    }

    const match = { id: matchDoc.id, ...matchDoc.data() } as IMatch;
    if (!match.users.includes(currentUid)) {
      return res.status(403).json({ message: 'You are not part of this match.' });
    }
    const chatAccessState = await getChatAccessStateForUser({
      matches: currentUser.matches,
      subscriptionStatus: currentUser.subscriptionStatus,
      subscriptionTier: currentUser.subscriptionTier,
    });
    const chatLocked = isChatLockedForMatch(chatAccessState, match.id);

    const otherUid = match.users.find((u) => u !== currentUid)!;

    const msgSnap = await messagesCollection
      .where('matchId', '==', matchId)
      .orderBy('createdAt', 'asc')
      .limit(50)
      .get();

    const messages = msgSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as IMessage)
    );

    const otherDoc = await usersCollection.doc(otherUid).get();
    if (!otherDoc.exists) {
      return res.status(404).json({ message: 'Matched user profile not found.' });
    }

    const otherUser = { id: otherDoc.id, ...otherDoc.data() } as IUserProfile;

    const batch = db.batch();
    let hasBatchUpdates = false;
    const responseMessages = messages.map((m) => {
      const unreadBy = Array.isArray(m.unreadBy) ? m.unreadBy : [];
      const isRead = !unreadBy.includes(currentUid);
      if (!isRead && m.senderId !== currentUid) {
        const msgRef = messagesCollection.doc(m.id);
        batch.update(msgRef, {
          unreadBy: admin.firestore.FieldValue.arrayRemove(currentUid),
        });
        hasBatchUpdates = true;
      }
      return {
        id: m.id,
        matchId: m.matchId,
        senderId: m.senderId,
        receiverId: m.receiverId || (m.senderId === currentUid ? otherUser.id : currentUser.id),
        content: typeof m.content === 'string' ? m.content : '',
        type: m.type || (m.attachment?.mimeType ? getMessageTypeFromMimeType(m.attachment.mimeType) : 'TEXT'),
        attachment: m.attachment || null,
        replyTo: normalizeReplyPreview(m.replyTo),
        reactions: normalizeMessageReactions(m.reactions),
        createdAt: m.createdAt.toDate().toISOString(),
        updatedAt: m.updatedAt?.toDate?.().toISOString?.() || m.createdAt.toDate().toISOString(),
        isRead,
      };
    });

    if (hasBatchUpdates) {
      await batch.commit();
    }

    res.status(200).json({
      match: {
        id: matchId,
        users: [
          { id: currentUser.id, name: currentUser.name, profilePhoto1: currentUser.profilePhoto1 },
          { id: otherUser.id, name: otherUser.name, profilePhoto1: otherUser.profilePhoto1 },
        ],
        chatLocked,
        chatAccessMessage: chatLocked ? FREE_CHAT_LIMIT_MESSAGE : null,
        activeChatMatchId: chatAccessState.activeMatchId,
      },
      messages: responseMessages,
    });
  } catch (error) {
    const msg = isErrorWithMessage(error) ? error.message : 'Unknown error';
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: `Server Error: ${msg}` });
  }
};

// =======================================================
// 4?? POST /api/matches/unmatch/:userId
// =======================================================
const unmatchUser = async (req: Request, res: Response) => {
  const currentUser = await fetchCurrentUser(req, res);
  if (!currentUser) return;

  const { userId: targetUid } = req.params;
  const currentUid = currentUser.id;

  if (currentUid === targetUid) {
    return res.status(400).json({ message: 'Cannot unmatch yourself.' });
  }

  try {
    const targetUserDoc = await usersCollection.doc(targetUid).get();
    if (!targetUserDoc.exists) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    const removedMatchIds = await removeRelationshipArtifacts(currentUid, targetUid);
    return res.status(200).json({
      message: 'User unmatched successfully.',
      removedMatchIds,
    });
  } catch (error) {
    const msg = isErrorWithMessage(error) ? error.message : 'Unknown error';
    console.error('Error unmatching user:', msg);
    return res.status(500).json({ message: `Server Error: ${msg}` });
  }
};

// =======================================================
// 5?? POST /api/matches/unmatch-block/:userId
// =======================================================
const unmatchAndBlockUser = async (req: Request, res: Response) => {
  const currentUser = await fetchCurrentUser(req, res);
  if (!currentUser) return;

  const { userId: targetUid } = req.params;
  const currentUid = currentUser.id;

  if (currentUid === targetUid) {
    return res.status(400).json({ message: 'Cannot block yourself.' });
  }

  try {
    const targetUserDoc = await usersCollection.doc(targetUid).get();
    if (!targetUserDoc.exists) {
      return res.status(404).json({ message: 'Target user not found.' });
    }

    const sharedMatchIds = await getSharedMatchIdsBetween(currentUid, targetUid);
    const batch = db.batch();
    const currentUserRef = usersCollection.doc(currentUid);
    const targetUserRef = usersCollection.doc(targetUid);

    const currentUpdate: Record<string, unknown> = {
      likes: admin.firestore.FieldValue.arrayRemove(targetUid),
      passes: admin.firestore.FieldValue.arrayRemove(targetUid),
      blockedUsers: admin.firestore.FieldValue.arrayUnion(targetUid),
      [`passHistory.${targetUid}`]: admin.firestore.FieldValue.delete(),
    };

    const targetUpdate: Record<string, unknown> = {
      likes: admin.firestore.FieldValue.arrayRemove(currentUid),
      passes: admin.firestore.FieldValue.arrayRemove(currentUid),
      [`passHistory.${currentUid}`]: admin.firestore.FieldValue.delete(),
    };

    if (sharedMatchIds.length > 0) {
      currentUpdate.matches = admin.firestore.FieldValue.arrayRemove(...sharedMatchIds);
      targetUpdate.matches = admin.firestore.FieldValue.arrayRemove(...sharedMatchIds);
    }

    batch.update(currentUserRef, currentUpdate);
    batch.update(targetUserRef, targetUpdate);

    sharedMatchIds.forEach((matchId) => {
      batch.delete(matchesCollection.doc(matchId));
    });

    await batch.commit();

    return res.status(200).json({
      message: 'User unmatched and blocked successfully.',
      removedMatchIds: sharedMatchIds,
    });
  } catch (error) {
    const msg = isErrorWithMessage(error) ? error.message : 'Unknown error';
    console.error('Error unmatching and blocking user:', msg);
    return res.status(500).json({ message: `Server Error: ${msg}` });
  }
};

// =======================================================
// 6.5 GET /api/messages/media/library
// =======================================================
const getMediaLibrary = async (req: Request, res: Response) => {
  const currentUser = await fetchCurrentUser(req, res);
  if (!currentUser) return;

  const provider = req.query.provider === 'tenor' ? 'tenor' : 'giphy';
  const tab = req.query.tab === 'gif' ? 'gif' : 'sticker';
  const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const requestedLimit = Number(req.query.limit);
  const safeLimit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50)
    : 28;

  const fallbackApiKey = typeof req.query.apiKey === 'string'
    ? req.query.apiKey.trim()
    : '';
  const apiKey = resolveMediaApiKey(provider, fallbackApiKey);

  if (!apiKey) {
    return res.status(400).json({
      message: provider === 'tenor'
        ? 'TENOR_API_KEY is not configured.'
        : 'GIPHY_API_KEY is not configured.',
    });
  }

  try {
    let upstreamUrl = '';

    if (provider === 'tenor') {
      const clientKey = typeof req.query.clientKey === 'string' && req.query.clientKey.trim()
        ? req.query.clientKey.trim()
        : (process.env.TENOR_CLIENT_KEY || process.env.VITE_TENOR_CLIENT_KEY || 'faithbliss-chat');

      const params = new URLSearchParams({
        key: apiKey,
        client_key: clientKey,
        limit: String(safeLimit),
        media_filter: 'gif,tinygif,webp,tinywebp',
        contentfilter: 'medium',
      });

      if (tab === 'sticker') {
        params.set('searchfilter', 'sticker');
      }

      if (rawQuery) {
        params.set('q', rawQuery);
        upstreamUrl = `https://tenor.googleapis.com/v2/search?${params.toString()}`;
      } else {
        upstreamUrl = `https://tenor.googleapis.com/v2/featured?${params.toString()}`;
      }
    } else {
      const endpoint = tab === 'gif' ? 'gifs' : 'stickers';
      const action = rawQuery ? 'search' : 'trending';
      const params = new URLSearchParams({
        api_key: apiKey,
        limit: String(safeLimit),
        rating: 'pg-13',
      });

      if (rawQuery) {
        params.set('q', rawQuery);
        params.set('lang', 'en');
      }

      upstreamUrl = `https://api.giphy.com/v1/${endpoint}/${action}?${params.toString()}`;
    }

    const upstreamResponse = await fetch(upstreamUrl);
    const payload = await upstreamResponse.json().catch(() => ({}));

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({
        message: 'Media provider request failed.',
        provider,
        status: upstreamResponse.status,
        payload,
      });
    }

    return res.status(200).json(payload);
  } catch (error) {
    const msg = isErrorWithMessage(error) ? error.message : 'Unknown error';
    console.error('Error fetching media library:', msg);
    return res.status(502).json({ message: `Failed to fetch media library: ${msg}` });
  }
};

// =======================================================
// 6?? GET /api/messages/unread-count
// =======================================================
const getUnreadCount = async (req: Request, res: Response) => {
  const currentUser = await fetchCurrentUser(req, res);
  if (!currentUser) return;

  try {
    const currentUid = currentUser.id;
    const unreadSnap = await messagesCollection
      .where('unreadBy', 'array-contains', currentUid)
      .get();
    res.status(200).json({ count: unreadSnap.size });
  } catch (error) {
    const msg = isErrorWithMessage(error) ? error.message : 'Unknown error';
    console.error('Error calculating unread count:', error);
    res.status(500).json({ message: `Server Error: ${msg}` });
  }
};

// =======================================================
// 7?? PATCH /api/messages/:messageId/read
// =======================================================
const markMessageAsRead = async (req: Request, res: Response) => {
  const currentUser = await fetchCurrentUser(req, res);
  if (!currentUser) return;

  try {
    const currentUid = currentUser.id;
    const { messageId } = req.params;

    const msgRef = messagesCollection.doc(messageId);
    const msgDoc = await msgRef.get();
    if (!msgDoc.exists) {
      return res.status(404).json({ message: 'Message not found.' });
    }

    const msgData = msgDoc.data() as IMessage;
    const unreadBy = Array.isArray(msgData.unreadBy) ? msgData.unreadBy : [];
    if (!unreadBy.includes(currentUid)) {
      return res.status(200).json({ success: true });
    }

    await msgRef.update({
      unreadBy: admin.firestore.FieldValue.arrayRemove(currentUid),
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    const msg = isErrorWithMessage(error) ? error.message : 'Unknown error';
    console.error('Error marking message as read:', msg);
    res.status(500).json({ message: `Server Error: ${msg}` });
  }
};

// =======================================================
// 7?? GET /api/matches/mutual
// =======================================================
const getMutualMatches = async (req: Request, res: Response) => {
  const currentUser = await fetchCurrentUser(req, res);
  if (!currentUser) return;

  try {
    console.log(`?? [getMutualMatches] UID: ${currentUser.id}`);
    const allUsersSnap = await usersCollection.get();
    const mutualMatches: IUserProfile[] = [];

    allUsersSnap.forEach((doc) => {
      const user = { id: doc.id, ...doc.data() } as IUserProfile;

      if (
        user.id !== currentUser.id &&
        user.onboardingCompleted === true &&
        user.isActive !== false &&
        !isBlockedBetween(currentUser, user) &&
        user.likes?.includes(currentUser.id) &&
        currentUser.likes?.includes(user.id)
      ) {
        mutualMatches.push(user);
      }
    });

    console.log(`? Mutual matches found: ${mutualMatches.length}`);
    res.status(200).json({ matches: mutualMatches });
  } catch (error) {
    const msg = isErrorWithMessage(error) ? error.message : 'Unknown error';
    console.error('?? Error fetching mutual matches:', msg);
    res.status(500).json({ message: `Server Error: ${msg}` });
  }
};

// =======================================================
// 8?? GET /api/matches/sent
// =======================================================
const getSentMatches = async (req: Request, res: Response) => {
  const currentUser = await fetchCurrentUser(req, res);
  if (!currentUser) return;

  try {
    console.log(`?? [getSentMatches] UID: ${currentUser.id}`);
    const sentIds = currentUser.likes || [];
    console.log(`?? Sent IDs:`, sentIds);

    if (sentIds.length === 0) {
      console.log('?? No sent matches found.');
      return res.status(200).json({ matches: [] });
    }

    const sentDocs = await Promise.all(sentIds.map((id) => usersCollection.doc(id).get()));
    const sentMatches = sentDocs
      .filter((doc) => doc.exists)
      .map((doc) => ({ id: doc.id, ...doc.data() } as IUserProfile))
      .filter((user) => user.onboardingCompleted === true && user.isActive !== false && !isBlockedBetween(currentUser, user));

    console.log(`? Sent matches found: ${sentMatches.length}`);
    res.status(200).json({ matches: sentMatches });
  } catch (error) {
    const msg = isErrorWithMessage(error) ? error.message : 'Unknown error';
    console.error('?? Error fetching sent matches:', msg);
    res.status(500).json({ message: `Server Error: ${msg}` });
  }
};

// =======================================================
// 9?? GET /api/matches/passed
// =======================================================
const getPassedProfiles = async (req: Request, res: Response) => {
  const currentUser = await fetchCurrentUser(req, res);
  if (!currentUser) return;

  try {
    if (!isPremiumSubscriber(currentUser)) {
      return res.status(403).json({
        message: 'Skipped profile review is available on premium only.',
      });
    }

    const passedIds = normalizeIdList(currentUser.passes);
    if (passedIds.length === 0) {
      return res.status(200).json({ profiles: [] });
    }

    const passedDocs = await Promise.all(
      passedIds.map((id) => usersCollection.doc(id).get())
    );

    const profiles = passedDocs
      .filter((doc) => doc.exists)
      .map((doc) => ({ id: doc.id, ...doc.data() } as IUserProfile))
      .filter((user) => user.id !== currentUser.id)
      .filter((user) => user.onboardingCompleted === true)
      .filter((user) => user.isActive !== false)
      .filter((user) => !isBlockedBetween(currentUser, user));

    return res.status(200).json({ profiles });
  } catch (error) {
    const msg = isErrorWithMessage(error) ? error.message : 'Unknown error';
    console.error('?? Error fetching passed profiles:', msg);
    return res.status(500).json({ message: `Server Error: ${msg}` });
  }
};

// =======================================================
// 10?? GET /api/matches/received
// =======================================================
const getReceivedMatches = async (req: Request, res: Response) => {
  const currentUser = await fetchCurrentUser(req, res);
  if (!currentUser) return;

  try {
    console.log(`?? [getReceivedMatches] UID: ${currentUser.id}`);
    const allUsersSnap = await usersCollection.get();
    const receivedMatches: IUserProfile[] = [];

    allUsersSnap.forEach((doc) => {
      const user = { id: doc.id, ...doc.data() } as IUserProfile;
      if (
        user.id !== currentUser.id &&
        user.onboardingCompleted === true &&
        user.isActive !== false &&
        !isBlockedBetween(currentUser, user) &&
        user.likes?.includes(currentUser.id) &&
        !currentUser.likes?.includes(user.id)
      ) {
        receivedMatches.push(user);
      }
    });

    console.log(`? Received matches found: ${receivedMatches.length}`);
    res.status(200).json({ matches: receivedMatches });
  } catch (error) {
    const msg = isErrorWithMessage(error) ? error.message : 'Unknown error';
    console.error('?? Error fetching received matches:', msg);
    res.status(500).json({ message: `Server Error: ${msg}` });
  }
};


// =======================================================
// EXPORTS
// =======================================================
export {
  uploadMessageAttachmentMiddleware,
  uploadMessageAttachment,
  getPotentialMatches,
  likeUser,
  passUser,
  unmatchUser,
  unmatchAndBlockUser,
  getMatchConversations,
  getMatchMessages,
  getMediaLibrary,
  getUnreadCount,
  markMessageAsRead,
  getMutualMatches,
  getSentMatches,
  getPassedProfiles,
  getReceivedMatches,
};
