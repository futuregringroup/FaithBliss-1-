// src/controllers/supportController.ts

import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { db } from '../config/firebase-admin';
import { createNotification } from '../services/notificationService';

type TicketType = 'HELP' | 'REPORT';
const PRIMARY_ADMIN_EMAIL = process.env.PRIMARY_ADMIN_EMAIL ?? '';

type SupportReply = {
  adminId: string;
  adminEmail: string;
  adminName: string;
  message: string;
  createdAt: admin.firestore.Timestamp;
};

type FirestoreUser = {
  email?: string;
  name?: string;
  role?: string;
  roles?: string[];
};

const getEffectiveRole = (user: FirestoreUser | null | undefined): string => {
  const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (email === PRIMARY_ADMIN_EMAIL) return 'admin';

  const role = typeof user?.role === 'string' ? user.role.trim().toLowerCase() : '';
  return role || 'user';
};

const hasRole = (user: FirestoreUser | null | undefined, role: string): boolean => {
  const normalizedRole = role.trim().toLowerCase();
  const roles = Array.isArray(user?.roles)
    ? user.roles
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().toLowerCase())
    : [];

  return getEffectiveRole(user) === normalizedRole || roles.includes(normalizedRole);
};

const requireAdmin = async (req: Request, res: Response) => {
  const userId = (req as any).userId as string | undefined;

  if (!userId) {
    res.status(401).json({ message: 'Unauthorized: Firebase UID missing.' });
    return null;
  }

  const currentUserDoc = await db.collection('users').doc(userId).get();
  if (!currentUserDoc.exists) {
    res.status(404).json({ message: 'Current user profile not found.' });
    return null;
  }

  const currentUser = currentUserDoc.data() as FirestoreUser;
  if (!hasRole(currentUser, 'admin')) {
    res.status(403).json({ message: 'Admin access required.' });
    return null;
  }

  return { id: currentUserDoc.id, ...currentUser };
};

const getAdminRecipients = async (): Promise<Array<{ id: string; email?: string }>> => {
  const snapshot = await db.collection('users').get();
  const seenIds = new Set<string>();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as FirestoreUser) }))
    .filter((user) => {
      if (!hasRole(user, 'admin')) return false;
      if (seenIds.has(user.id)) return false;
      seenIds.add(user.id);
      return true;
    })
    .map((user) => ({ id: user.id, email: user.email }));
};

export const submitSupportTicket = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    const { type, subject, message, metadata } = req.body as {
      type: TicketType;
      subject?: string;
      message: string;
      metadata?: Record<string, any>;
    };

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: Firebase UID missing.' });
    }
    if (!type || !['HELP', 'REPORT'].includes(type)) {
      return res.status(400).json({ message: 'Invalid ticket type.' });
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'Message is required.' });
    }

    const reporterDoc = await db.collection('users').doc(userId).get();
    const reporter = reporterDoc.exists ? (reporterDoc.data() as FirestoreUser) : null;

    const ticket = {
      userId,
      type,
      subject: subject || '',
      message,
      metadata: metadata || {},
      reporterEmail: reporter?.email || '',
      reporterName: reporter?.name || '',
      status: 'OPEN',
      replies: [] as SupportReply[],
      createdAt: admin.firestore.Timestamp.now(),
    };

    await db.collection('supportTickets').add(ticket);

    if (type === 'REPORT') {
      const adminRecipients = await getAdminRecipients();
      const reporterLabel = reporter?.email || reporter?.name || 'A user';
      const issueSubject = subject?.trim() || 'New reported issue';

      await Promise.allSettled(
        adminRecipients
          .filter((adminRecipient) => adminRecipient.id !== userId)
          .map((adminRecipient) =>
            createNotification({
              userId: adminRecipient.id,
              type: 'REPORT_SUBMITTED',
              message: `${reporterLabel} submitted a new issue report.`,
              data: {
                reporterUserId: userId,
                reporterEmail: reporter?.email || '',
                reporterName: reporter?.name || '',
                subject: issueSubject,
                preview: message.slice(0, 160),
              },
            })
          )
      );
    }

    return res.status(201).json({ message: 'Ticket submitted successfully.' });
  } catch (error: any) {
    console.error('Support ticket error:', error);
    return res.status(500).json({ message: error.message || 'Failed to submit ticket.' });
  }
};

export const getSupportTickets = async (req: Request, res: Response) => {
  try {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;

    const snapshot = await db.collection('supportTickets').get();

    const tickets = snapshot.docs
      .map((doc) => {
        const data = doc.data() as {
          userId?: string;
          type?: TicketType;
          subject?: string;
          message?: string;
          status?: string;
          metadata?: Record<string, unknown>;
          reporterEmail?: string;
          reporterName?: string;
          replies?: Array<{
            adminId?: string;
            adminEmail?: string;
            adminName?: string;
            message?: string;
            createdAt?: admin.firestore.Timestamp;
          }>;
          createdAt?: admin.firestore.Timestamp;
        };

        return {
          id: doc.id,
          userId: data.userId || '',
          type: data.type || 'HELP',
          subject: data.subject || '',
          message: data.message || '',
          status: data.status || 'OPEN',
          metadata: data.metadata || {},
          reporterEmail: data.reporterEmail || '',
          reporterName: data.reporterName || '',
          replies: Array.isArray(data.replies)
            ? data.replies.map((reply) => ({
                adminId: reply.adminId || '',
                adminEmail: reply.adminEmail || '',
                adminName: reply.adminName || '',
                message: reply.message || '',
                createdAt: reply.createdAt?.toDate().toISOString() || null,
              }))
            : [],
          createdAt: data.createdAt?.toDate().toISOString() || null,
        };
      })
      .sort((left, right) => {
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return rightTime - leftTime;
      });

    return res.status(200).json({ tickets });
  } catch (error: any) {
    console.error('Support tickets fetch error:', error);
    return res.status(500).json({ message: error.message || 'Failed to fetch support tickets.' });
  }
};

export const getMySupportTickets = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    const typeFilter = typeof req.query.type === 'string' ? req.query.type.trim().toUpperCase() : '';

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: Firebase UID missing.' });
    }

    if (typeFilter && !['HELP', 'REPORT'].includes(typeFilter)) {
      return res.status(400).json({ message: 'Invalid ticket type filter.' });
    }

    const snapshot = await db.collection('supportTickets').where('userId', '==', userId).get();

    const tickets = snapshot.docs
      .map((doc) => {
        const data = doc.data() as {
          userId?: string;
          type?: TicketType;
          subject?: string;
          message?: string;
          status?: string;
          metadata?: Record<string, unknown>;
          reporterEmail?: string;
          reporterName?: string;
          replies?: Array<{
            adminId?: string;
            adminEmail?: string;
            adminName?: string;
            message?: string;
            createdAt?: admin.firestore.Timestamp;
          }>;
          createdAt?: admin.firestore.Timestamp;
        };

        return {
          id: doc.id,
          userId: data.userId || '',
          type: data.type || 'HELP',
          subject: data.subject || '',
          message: data.message || '',
          status: data.status || 'OPEN',
          metadata: data.metadata || {},
          reporterEmail: data.reporterEmail || '',
          reporterName: data.reporterName || '',
          replies: Array.isArray(data.replies)
            ? data.replies.map((reply) => ({
                adminId: reply.adminId || '',
                adminEmail: reply.adminEmail || '',
                adminName: reply.adminName || '',
                message: reply.message || '',
                createdAt: reply.createdAt?.toDate().toISOString() || null,
              }))
            : [],
          createdAt: data.createdAt?.toDate().toISOString() || null,
        };
      })
      .filter((ticket) => (typeFilter ? ticket.type === typeFilter : true))
      .sort((left, right) => {
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return rightTime - leftTime;
      });

    return res.status(200).json({ tickets });
  } catch (error: any) {
    console.error('My support tickets fetch error:', error);
    return res.status(500).json({ message: error.message || 'Failed to fetch your support tickets.' });
  }
};

export const replyToSupportTicket = async (req: Request, res: Response) => {
  try {
    const adminUser = await requireAdmin(req, res);
    if (!adminUser) return;

    const ticketId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

    if (!ticketId) {
      return res.status(400).json({ message: 'Ticket ID is required.' });
    }

    if (!message) {
      return res.status(400).json({ message: 'Reply message is required.' });
    }

    const ticketRef = db.collection('supportTickets').doc(ticketId);
    const ticketDoc = await ticketRef.get();

    if (!ticketDoc.exists) {
      return res.status(404).json({ message: 'Support ticket not found.' });
    }

    const ticket = ticketDoc.data() as {
      userId?: string;
      subject?: string;
      type?: TicketType;
      reporterEmail?: string;
      reporterName?: string;
      replies?: SupportReply[];
    };

    if (!ticket.userId) {
      return res.status(400).json({ message: 'Ticket owner is missing.' });
    }

    const reply: SupportReply = {
      adminId: adminUser.id,
      adminEmail: adminUser.email || '',
      adminName: adminUser.name || adminUser.email || 'Admin',
      message,
      createdAt: admin.firestore.Timestamp.now(),
    };

    await ticketRef.set(
      {
        replies: admin.firestore.FieldValue.arrayUnion(reply),
        status: 'RESPONDED',
        updatedAt: admin.firestore.Timestamp.now(),
      },
      { merge: true }
    );

    await createNotification({
      userId: ticket.userId,
      type: 'SUPPORT_REPLY',
      message: `FaithBliss support replied to your ${ticket.type === 'REPORT' ? 'reported issue' : 'help request'}.`,
      data: {
        ticketId,
        ticketType: ticket.type || 'HELP',
        subject: ticket.subject || '',
        replyMessage: message,
        adminName: reply.adminName,
        adminEmail: reply.adminEmail,
      },
    });

    return res.status(200).json({
      message: 'Reply sent successfully.',
      reply: {
        adminId: reply.adminId,
        adminEmail: reply.adminEmail,
        adminName: reply.adminName,
        message: reply.message,
        createdAt: reply.createdAt.toDate().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Support reply error:', error);
    return res.status(500).json({ message: error.message || 'Failed to send support reply.' });
  }
};
