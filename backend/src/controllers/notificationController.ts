// src/controllers/notificationController.ts
import { Request, Response } from 'express';
import { admin, db } from '../config/firebase-admin';

const notificationsCollection = db.collection('notifications');

export const getNotifications = async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized: Firebase UID missing.' });
  }

  try {
    let snapshot;
    try {
      snapshot = await notificationsCollection
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
    } catch (indexError: any) {
      // Composite index may not be deployed yet — fall back to unordered query and sort in memory.
      // Run `firebase deploy --only firestore:indexes` to deploy the index and remove this fallback.
      console.warn(
        '[notificationController] Ordered query failed (index likely missing), falling back to unordered:',
        indexError?.message
      );
      snapshot = await notificationsCollection
        .where('userId', '==', userId)
        .limit(200)
        .get();
    }

    const notifications = snapshot.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.().toISOString?.() ?? data.createdAt ?? null,
      };
    });

    notifications.sort((a: any, b: any) => {
      const aMs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bMs - aMs;
    });

    return res.status(200).json(notifications.slice(0, 50));
  } catch (error: any) {
    console.error('[notificationController] getNotifications failed:', {
      userId,
      message: error?.message,
      code: error?.code,
    });
    return res.status(500).json({ message: 'Failed to fetch notifications.' });
  }
};

export const getUnreadNotificationCount = async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized: Firebase UID missing.' });
  }

  try {
    const snapshot = await notificationsCollection
      .where('userId', '==', userId)
      .where('isRead', '==', false)
      .get();

    return res.status(200).json({ count: snapshot.size });
  } catch (error) {
    console.error('[notificationController] getUnreadNotificationCount failed:', error);
    return res.status(500).json({ message: 'Failed to fetch unread notification count.' });
  }
};

export const markNotificationRead = async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized: Firebase UID missing.' });
  }

  try {
    const { id } = req.params;
    const ref = notificationsCollection.doc(id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ message: 'Notification not found.' });
    const data = doc.data() as { userId?: string } | undefined;
    if (data?.userId !== userId) {
      return res.status(403).json({ message: 'You cannot modify this notification.' });
    }

    await ref.update({
      isRead: true,
      readAt: admin.firestore.Timestamp.now(),
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[notificationController] markNotificationRead failed:', error);
    return res.status(500).json({ message: 'Failed to mark notification as read.' });
  }
};

export const markAllNotificationsRead = async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized: Firebase UID missing.' });
  }

  try {
    const snapshot = await notificationsCollection
      .where('userId', '==', userId)
      .where('isRead', '==', false)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, {
        isRead: true,
        readAt: admin.firestore.Timestamp.now(),
      });
    });
    await batch.commit();

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[notificationController] markAllNotificationsRead failed:', error);
    return res.status(500).json({ message: 'Failed to mark all notifications as read.' });
  }
};
