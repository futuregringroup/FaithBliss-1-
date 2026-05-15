// src/services/notificationService.ts
import { admin, usersCollection, db } from '../config/firebase-admin';
import { emitToUser } from '../socket/socket';

type NotificationType =
  | 'PROFILE_LIKED'
  | 'NEW_MATCH'
  | 'NEW_MESSAGE'
  | 'STORY_POSTED'
  | 'REPORT_SUBMITTED'
  | 'SUPPORT_REPLY';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  message: string;
  data?: Record<string, any>;
}

const sendEmail = async (to: string, subject: string, text: string) => {
  const webhook = (globalThis as any).process?.env?.EMAIL_WEBHOOK_URL;
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, text }),
    });
  } catch (error) {
    console.error('Failed to send email notification:', error);
  }
};

const getEmailSubject = (type: NotificationType) => {
  if (type === 'PROFILE_LIKED') return 'You have a new like';
  if (type === 'NEW_MATCH') return "It's a match!";
  if (type === 'SUPPORT_REPLY') return 'New response from FaithBliss support';
  if (type === 'REPORT_SUBMITTED') return 'New issue reported on FaithBliss';
  if (type === 'STORY_POSTED') return 'A new story was posted';
  return 'New message on FaithBliss';
};

export const createNotification = async ({
  userId,
  type,
  message,
  data = {},
}: CreateNotificationInput) => {
  const notificationRef = await db.collection('notifications').add({
    userId,
    type,
    message,
    data,
    isRead: false,
    createdAt: admin.firestore.Timestamp.now(),
  });

  emitToUser(userId, {
    id: notificationRef.id,
    type,
    message,
    data,
    createdAt: new Date().toISOString(),
  });

  void (async () => {
    const userDoc = await usersCollection.doc(userId).get();
    const email = userDoc.exists ? (userDoc.data() as any)?.email : null;
    if (!email) return;
    await sendEmail(email, getEmailSubject(type), message);
  })().catch((error) => {
    console.error('Failed to queue email notification:', error);
  });
};
