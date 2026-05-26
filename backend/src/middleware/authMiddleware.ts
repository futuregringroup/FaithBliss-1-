import { NextFunction, Request, Response } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { Socket } from 'socket.io';
import { admin, usersCollection } from '../config/firebase-admin';
import { getPassportFeatureSettings } from '../utils/passportMode';

declare global {
  namespace Express {
    interface Request {
      user?: DecodedIdToken;
      userId?: string;
    }
  }
}

interface AuthenticatedSocket extends Socket {
  user?: { id: string };
}

const PRIMARY_ADMIN_EMAIL = process.env.PRIMARY_ADMIN_EMAIL ?? '';

const hasDeveloperAccess = async (userId: string): Promise<boolean> => {
  const userDoc = await usersCollection.doc(userId).get();
  if (!userDoc.exists) return false;

  const userData = userDoc.data() as { email?: unknown; role?: unknown; roles?: unknown } | undefined;
  const email = typeof userData?.email === 'string' ? userData.email.trim().toLowerCase() : '';
  const role = typeof userData?.role === 'string' ? userData.role.trim().toLowerCase() : '';
  const roles = Array.isArray(userData?.roles)
    ? userData.roles
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().toLowerCase())
    : [];

  return email === PRIMARY_ADMIN_EMAIL || role === 'developer' || roles.includes('developer');
};

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  let token: string | undefined;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, Firebase ID token missing' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    req.userId = decodedToken.uid;
    next();
  } catch (error) {
    console.error('Firebase auth middleware error:', (error as Error).message);
    return res.status(401).json({ message: 'Not authorized, Firebase ID token invalid or expired' });
  }
};

export const protectSocket = (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Authentication error: No token provided.'));
  }

  void admin.auth().verifyIdToken(token)
    .then(async (decodedToken: DecodedIdToken) => {
      const settings = await getPassportFeatureSettings();
      if (settings.backendOnlyShutdownEnabled) {
        const developerAccess = await hasDeveloperAccess(decodedToken.uid);
        if (!developerAccess) {
          return next(new Error('Backend services are temporarily disabled.'));
        }
      }

      socket.user = { id: decodedToken.uid };
      next();
    })
    .catch((error: Error) => {
      console.error('Socket auth error:', error.message);
      next(new Error('Authentication error: Invalid or expired token.'));
    });
};
