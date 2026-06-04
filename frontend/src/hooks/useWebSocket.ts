// Socket.IO has been removed. Real-time messaging is now handled by Firestore
// onSnapshot listeners (useChatRoom). All callers that received the service
// instance are already guarded by `if (!webSocketService) return;` and degrade
// gracefully to their existing REST polling fallbacks.
import type WebSocketService from '@/services/WebSocketService';

export function useWebSocket(): WebSocketService | null {
  return null;
}
