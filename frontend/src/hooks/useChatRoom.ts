import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/firebase/config';

export interface ChatMessage {
  id: string;
  matchId: string;
  senderId: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'SYSTEM';
  isRead: boolean;
  createdAt: string; // ISO string derived from Firestore Timestamp
}

interface FirestoreMessageDoc {
  matchId: string;
  senderId: string;
  content: string;
  type: ChatMessage['type'];
  isRead: boolean;
  timestamp: Timestamp | null;
}

interface UseChatRoomReturn {
  messages: ChatMessage[];
  loading: boolean;
  error: Error | null;
  sendMessage: (text: string) => Promise<void>;
}

const toIso = (ts: Timestamp | null | undefined): string =>
  ts ? ts.toDate().toISOString() : new Date().toISOString();

export function useChatRoom(
  matchId: string,
  currentUserId: string,
): UseChatRoomReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Stable ref so the cleanup function always cancels the right subscription
  // even if the effect closure re-runs before the previous one tears down.
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    if (!matchId || !currentUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const messagesRef = collection(db, 'chats', matchId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const incoming: ChatMessage[] = snapshot.docs.map((doc) => {
          const data = doc.data() as FirestoreMessageDoc;
          return {
            id: doc.id,
            matchId: data.matchId ?? matchId,
            senderId: data.senderId,
            content: data.content ?? '',
            type: data.type ?? 'TEXT',
            isRead: data.isRead ?? false,
            createdAt: toIso(data.timestamp),
          };
        });

        setMessages(incoming);
        setLoading(false);
      },
      (err) => {
        console.error('[useChatRoom] Firestore listener error:', err);
        setError(err);
        setLoading(false);
      },
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [matchId, currentUserId]);

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed || !matchId || !currentUserId) return;

      const messagesRef = collection(db, 'chats', matchId, 'messages');
      await addDoc(messagesRef, {
        matchId,
        senderId: currentUserId,
        content: trimmed,
        type: 'TEXT' as const,
        isRead: false,
        timestamp: serverTimestamp(),
      });
    },
    [matchId, currentUserId],
  );

  return { messages, loading, error, sendMessage };
}
