// src/controllers/messageController.ts

import { Request, Response } from 'express';
import { db } from '../config/firebase-admin';
import { ConversationSummary, Message } from '../types/chat';

// Helper function to get the authenticated user ID
const getUserIdFromRequest = (req: Request): string => {
    return (req as any).userId;
};

/**
 * GET /api/messages/conversations
 * Fetches a list of match conversations for the authenticated user.
 */
export const getMatchConversations = async (
    req: Request,
    res: Response
): Promise<Response> => {
    const currentUserId = getUserIdFromRequest(req);

    try {
        // 1️⃣ Fetch current user document
        const currentUserDoc = await db.collection('users').doc(currentUserId).get();
        if (!currentUserDoc.exists) {
            return res.status(404).json({ message: 'User not found' });
        }
        const currentUserData = currentUserDoc.data();
        const matchIds: string[] = currentUserData?.matches || [];

        if (matchIds.length === 0) return res.status(200).json([]);

        // 2️⃣ Fetch match documents
        const matchDocs = await Promise.all(
            matchIds.map(id => db.collection('matches').doc(id).get())
        );

        const conversations = await Promise.all(
            matchDocs.map(async matchDoc => {
                if (!matchDoc.exists) return null;

                const matchData = matchDoc.data();
                if (!matchData) return null;

                const otherUserId = matchData.users.find((uid: string) => uid !== currentUserId);
                if (!otherUserId) return null;

                // 3️⃣ Fetch other user info
                const otherUserDoc = await db.collection('users').doc(otherUserId).get();
                const otherUser = otherUserDoc.exists
                    ? {
                          id: otherUserDoc.id,
                          name: otherUserDoc.data()?.name || 'Unknown',
                          profilePhoto1: otherUserDoc.data()?.profilePhoto1 || '',
                      }
                    : { id: otherUserId, name: 'Unknown', profilePhoto1: '' };

                // 4️⃣ Fetch last message
                const lastMsgSnap = await db
                    .collection('messages')
                    .where('matchId', '==', matchDoc.id)
                    .orderBy('createdAt', 'desc')
                    .limit(1)
                    .get();

                const lastMessage = lastMsgSnap.empty
                    ? null
                    : {
                          id: lastMsgSnap.docs[0].id,
                          content: lastMsgSnap.docs[0].data().content,
                          createdAt:
                              lastMsgSnap.docs[0].data().createdAt?.toDate().toISOString() ||
                              new Date().toISOString(),
                      };

                return {
                    id: matchDoc.id,
                    otherUser,
                    lastMessage,
                    unreadCount: 0, // optional: implement unread count later
                    updatedAt:
                        lastMessage?.createdAt ||
                        (matchData.createdAt?.toDate?.() || new Date()).toISOString(),
                } as ConversationSummary;
            })
        );

        // Filter out null matches
        const filteredConversations = conversations.filter(Boolean) as ConversationSummary[];

        // Sort by last message time
        filteredConversations.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        return res.status(200).json(filteredConversations);
    } catch (error: any) {
        console.error('Error fetching conversations:', error);
        return res
            .status(500)
            .json({ message: 'Internal Server Error', error: error.message });
    }
};

/**
 * GET /api/messages/:matchId
 * Fetches paginated messages for a specific conversation/match with real sender info.
 * Query params: page (default 1), limit (default 50)
 */
export const getConversationMessages = async (
    req: Request,
    res: Response
): Promise<Response> => {
    const { matchId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const currentUserId = getUserIdFromRequest(req);

    try {
        // 1️⃣ Verify match exists and user is part of it
        const matchDoc = await db.collection('matches').doc(matchId).get();
        if (!matchDoc.exists) return res.status(404).json({ message: 'Match not found' });

        const matchData = matchDoc.data();
        if (!matchData) return res.status(404).json({ message: 'Match data not found' });

        if (!Array.isArray(matchData.users) || !matchData.users.includes(currentUserId)) {
            return res.status(403).json({ message: 'You are not part of this match.' });
        }

        // 2️⃣ Fetch all user info for participants
        const userDocs = await Promise.all(
            matchData.users.map((uid: string) => db.collection('users').doc(uid).get())
        );

        const userMap: Record<string, { id: string; name: string; profilePhoto1?: string }> = {};
        userDocs.forEach(doc => {
            if (doc.exists) {
                const data = doc.data();
                userMap[doc.id] = {
                    id: doc.id,
                    name: data?.name || 'Unknown',
                    profilePhoto1: data?.profilePhoto1 || '',
                };
            }
        });

        // 3️⃣ Fetch messages with pagination
        const messagesRef = db
            .collection('messages')
            .where('matchId', '==', matchId)
            .orderBy('createdAt', 'asc')
            .offset((page - 1) * limit)
            .limit(limit);

        const snapshot = await messagesRef.get();

        const messages: Message[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                matchId: data.matchId,
                senderId: data.senderId,
                receiverId: data.receiverId,
                content: data.content,
                type: data.type || 'TEXT',
                attachment: data.attachment || null,
                isRead: data.isRead || false,
                createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
                updatedAt: data.updatedAt?.toDate().toISOString() || new Date().toISOString(),
                sender: userMap[data.senderId] || { id: data.senderId, name: 'Unknown' },
                receiver: userMap[data.receiverId] || { id: data.receiverId, name: 'Unknown' },
            } as Message;
        });

        return res.status(200).json({
            page,
            limit,
            messages,
            match: {
                id: matchId,
                users: Object.values(userMap), // include participants info
            },
        });
    } catch (error: any) {
        console.error('Error fetching messages:', error);

        if (error.code === 9) {
            return res.status(400).json({
                message: 'Firestore requires a composite index for this query.',
                details: error.details,
                fix: 'Create index on matchId (ASC) + createdAt (ASC) in Firestore console.',
            });
        }

        return res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};
