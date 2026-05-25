/* eslint-disable @typescript-eslint/no-explicit-any */
import { io, Socket } from 'socket.io-client';
import type { Message, MessageReaction } from '@/types/chat';

export interface UnreadCountPayload {
  count: number;
}

export interface NotificationPayload {
  id?: string;
  type: string;
  message: string;
  data?: Record<string, any>;
  createdAt?: string;
  matchId?: string;
  otherUser?: { id: string; name: string };
  senderId?: string;
  senderName?: string;
  // Add other notification properties as needed
}

export interface UserTypingPayload {
  userId: string;
  isTyping: boolean;
}

export interface MessageAttachmentPayload {
  url: string;
  publicId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  resourceType?: string;
}

export interface MessageReplyPayload {
  id: string;
  senderId: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'SYSTEM';
  attachment?: MessageAttachmentPayload | null;
}

export type CallType = 'audio' | 'video';

export interface CallOfferPayload {
  fromUserId: string;
  matchId?: string;
  callType: CallType;
  sdp: RTCSessionDescriptionInit;
}

export interface CallAnswerPayload {
  fromUserId: string;
  matchId?: string;
  callType: CallType;
  sdp: RTCSessionDescriptionInit;
}

export interface CallIceCandidatePayload {
  fromUserId: string;
  matchId?: string;
  candidate: RTCIceCandidateInit;
}

export interface CallRejectPayload {
  fromUserId: string;
  matchId?: string;
  reason?: string;
}

export interface CallEndPayload {
  fromUserId: string;
  matchId?: string;
  reason?: string;
}

export interface CallStatePayload {
  fromUserId: string;
  matchId?: string;
  micMuted?: boolean;
  cameraOff?: boolean;
}

export interface UserPresencePayload {
  userId: string;
  isOnline: boolean;
  lastSeenAt?: string;
}

export interface MessageReactionUpdatePayload {
  messageId: string;
  matchId: string;
  reactions: MessageReaction[];
}

class WebSocketService {
  private socket: Socket | null = null;
  private readonly WEBSOCKET_URL: string;

  constructor(token?: string) {
    this.WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');
    
    if (token) {
      this.connect(token).catch(err => console.error('WebSocket connect error:', err));
    }
  }

  public connect(token?: string): Promise<void> {
    return new Promise((resolve) => {
      if (this.socket && this.socket.connected) {
        return resolve();
      }

      this.socket = io(this.WEBSOCKET_URL, {
        auth: token ? { token } : undefined,
        transports: ['websocket', 'polling'],
        withCredentials: true,
      });

      this.socket.on('connect', () => {
        resolve();
      });

      this.socket.on('disconnect', () => {});

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error?.message || error);
        resolve();
      });
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public onNewMessage(callback: (message: Message) => void): void {
    this.socket?.on('newMessage', callback);
  }

  public onMessage(callback: (message: Message) => void): void {
    this.onNewMessage(callback);
  }

  public onUnreadCount(callback: (payload: UnreadCountPayload) => void): void {
    this.socket?.on('unreadCount', callback);
  }

  public onNotification(callback: (payload: NotificationPayload) => void): void {
    this.socket?.on('notification', callback);
  }

  public onUserTyping(callback: (payload: UserTypingPayload) => void): void {
    this.socket?.on('userTyping', callback);
  }

  public onTyping(callback: (payload: UserTypingPayload) => void): void {
    this.onUserTyping(callback);
  }

  public joinMatch(matchId: string): void {
    this.socket?.emit('joinRoom', { matchId });
  }

  public leaveMatch(matchId: string): void {
    this.socket?.emit('leaveRoom', { matchId });
  }

  /**
   * Emits the message to the server. The server should process the message,
   * save it, and then broadcast the full Message object back via 'newMessage'.
   */
  public sendMessage(
    receiverId: string,
    content: string,
    matchId?: string,
    attachment?: MessageAttachmentPayload | null,
    clientTempId?: string,
    replyToMessageId?: string | null
  ): void {
    this.socket?.emit('sendMessage', {
      receiverId,
      content,
      matchId,
      attachment,
      clientTempId,
      replyToMessageId,
    });
  }

  public emitTyping(receiverId: string, isTyping: boolean): void {
    this.socket?.emit('userTyping', { receiverId, isTyping });
  }

  public sendTyping(receiverId: string, isTyping: boolean): void {
    this.emitTyping(receiverId, isTyping);
  }

  public sendMessageReaction(
    messageId: string,
    payload: { matchId?: string; emoji: string }
  ): void {
    this.socket?.emit('message:reaction', {
      messageId,
      ...payload,
    });
  }

  public sendCallOffer(
    targetUserId: string,
    payload: { matchId?: string; callType: CallType; sdp: RTCSessionDescriptionInit }
  ): void {
    this.socket?.emit('call:offer', {
      targetUserId,
      ...payload,
    });
  }

  public sendCallAnswer(
    targetUserId: string,
    payload: { matchId?: string; callType: CallType; sdp: RTCSessionDescriptionInit }
  ): void {
    this.socket?.emit('call:answer', {
      targetUserId,
      ...payload,
    });
  }

  public sendCallIceCandidate(
    targetUserId: string,
    payload: { matchId?: string; candidate: RTCIceCandidateInit }
  ): void {
    this.socket?.emit('call:ice-candidate', {
      targetUserId,
      ...payload,
    });
  }

  public sendCallReject(
    targetUserId: string,
    payload: { matchId?: string; reason?: string }
  ): void {
    this.socket?.emit('call:reject', {
      targetUserId,
      ...payload,
    });
  }

  public sendCallEnd(
    targetUserId: string,
    payload: { matchId?: string; reason?: string }
  ): void {
    this.socket?.emit('call:end', {
      targetUserId,
      ...payload,
    });
  }

  public sendCallState(
    targetUserId: string,
    payload: { matchId?: string; micMuted?: boolean; cameraOff?: boolean }
  ): void {
    this.socket?.emit('call:state', {
      targetUserId,
      ...payload,
    });
  }

  public onCallOffer(callback: (payload: CallOfferPayload) => void): void {
    this.socket?.on('call:offer', callback);
  }

  public onCallAnswer(callback: (payload: CallAnswerPayload) => void): void {
    this.socket?.on('call:answer', callback);
  }

  public onCallIceCandidate(callback: (payload: CallIceCandidatePayload) => void): void {
    this.socket?.on('call:ice-candidate', callback);
  }

  public onCallReject(callback: (payload: CallRejectPayload) => void): void {
    this.socket?.on('call:reject', callback);
  }

  public onCallEnd(callback: (payload: CallEndPayload) => void): void {
    this.socket?.on('call:end', callback);
  }

  public onCallState(callback: (payload: CallStatePayload) => void): void {
    this.socket?.on('call:state', callback);
  }

  public onUserPresence(callback: (payload: UserPresencePayload) => void): void {
    this.socket?.on('user:presence', callback);
  }

  public onMessageReaction(callback: (payload: MessageReactionUpdatePayload) => void): void {
    this.socket?.on('message:reaction', callback);
  }

  public requestPresence(userIds: string[]): Promise<UserPresencePayload[]> {
    return new Promise((resolve) => {
      if (!this.socket || !this.socket.connected) {
        resolve([]);
        return;
      }

      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        resolve([]);
      }, 2500);

      this.socket.emit(
        'presence:batch',
        { userIds },
        (payload?: { presence?: UserPresencePayload[] }) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          resolve(Array.isArray(payload?.presence) ? payload!.presence : []);
        }
      );
    });
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  public get connected(): boolean {
    return this.isConnected();
  }

  public onError(callback: (err: any) => void): void {
    this.socket?.on('connect_error', callback);
    this.socket?.on('error', callback);
  }

  public off(event?: string, callback?: any): void {
    if (!this.socket) return;
    if (!event) {
      this.socket.removeAllListeners();
      return;
    }
    if (callback) this.socket.off(event, callback);
    else this.socket.off(event);
  }
}

export default WebSocketService;
