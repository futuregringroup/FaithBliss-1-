/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-irregular-whitespace */
/* eslint-disable @typescript-eslint/no-explicit-any */
// Custom hooks for API integration - REFACTORED FOR CLIENT-SIDE
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useToast } from '../contexts/ToastContext'; 
import { getApiClient } from '../services/api-client'; 

import { useRequireAuth } from './useAuth'; 
import { useLocation, useNavigate } from 'react-router-dom'; 
import type { GetUsersResponse } from '@/services/api'; 
import type { Match } from "../types/Match";
import { NOTIFICATIONS_UPDATED_EVENT } from '@/lib/notificationCenter';

 // Ã¢Å“â€¦ Adjusted path

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseApiOptions {
  immediate?: boolean;
  showErrorToast?: boolean;
  showSuccessToast?: boolean;
  cacheTime?: number;
  redirectOnUnauthorized?: boolean;
}

export interface ConversationMessagesResponse {
  match: Match;
  messages: Message[];
}

// Global request cache to prevent duplicate requests
const requestCache = new Map<string, { data: any; timestamp: number }>();
const activeRequests = new Map<string, Promise<any>>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes


// Types for messaging
import type { Message } from '@/services/api'; 
import { useWebSocket } from './useWebSocket';
import type { NotificationPayload } from '../services/WebSocketService'; 

export interface StoryItem {
  id: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  caption?: string;
  hasSeen?: boolean;
  seenByCount?: number;
  likesCount?: number;
  likedByCurrentUser?: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface StoryGroup {
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  isCurrentUser: boolean;
  latestCreatedAt: string;
  unseenCount?: number;
  items: StoryItem[];
}
interface ConversationSummary {
  id: string; // matchId
  otherUser: {
    id: string;
    name: string;
    profilePhoto1: string;
  };
  lastMessage: Message | null;
  unreadCount: number;
  updatedAt: string; // ISO date string
}

// Generic hook for API calls
export function useApi<T>(
  apiCall: ((signal?: AbortSignal) => Promise<T>) | null,
  dependencies: unknown[] = [],
  options: UseApiOptions = { showErrorToast: false }
) {

  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const { showError, showSuccess } = useToast();
  const navigate = useNavigate(); 
  const { 
    immediate = true, 
    showErrorToast = false, 
    showSuccessToast = false,
    cacheTime = CACHE_DURATION,
    redirectOnUnauthorized = true
  } = options;

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Generate stable cache key from dependencies
  const cacheKey = useMemo(() => JSON.stringify(dependencies), [dependencies]);

  const execute = useCallback(async () => {
        if (!apiCall) return;

    // Check cache first
    if (requestCache.has(cacheKey)) {
      const cached = requestCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < cacheTime) {
        if (isMountedRef.current) {
          setState({ data: cached.data, loading: false, error: null });
        }
        return cached.data;
      }
    }

    // Return existing request if one is in flight
    if (activeRequests.has(cacheKey)) {
      return activeRequests.get(cacheKey);
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    if (isMountedRef.current) {
      setState(prev => ({ ...prev, loading: true, error: null }));
    }

    // Create the promise for this request
    const requestPromise = (async () => {
      try {
        const data = await apiCall(signal);

        if (!isMountedRef.current) return data;
        if (signal.aborted) return data;

        // Cache the result
        requestCache.set(cacheKey, { data, timestamp: Date.now() });

        setState({ data, loading: false, error: null });

        if (showSuccessToast) {
          showSuccess('Operation completed successfully');
        }

        return data;
      } catch (error: any) {
        console.error("Ã¢ÂÅ’ API call failed:", cacheKey, error);
        if (!isMountedRef.current) throw error;
        if (signal.aborted) throw error;

        // Ã¢Å”â€¦ FIX: Check for 'Unauthorized' message thrown by api-client.ts on 401
        if (error?.message?.includes('Unauthorized')) {
          showError('Your session has expired. Please log in again.', 'Authentication Error');
          if (redirectOnUnauthorized) {
            navigate('/login'); // Redirect to login
          }
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : 'An error occurred';
        setState(prev => ({ ...prev, loading: false, error: errorMessage }));

        if (showErrorToast) {
          showError(errorMessage, 'API Error');
        }

        throw error;
      } finally {
        activeRequests.delete(cacheKey);
      }
    })();

    // Track this request
    activeRequests.set(cacheKey, requestPromise);

    return requestPromise;
  }, [apiCall, cacheKey, cacheTime, showError, showSuccess, showErrorToast, showSuccessToast, navigate]);

  useEffect(() => {
    isMountedRef.current = true;

    if (immediate && apiCall) {
      execute().catch(() => null);
    }

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [immediate, apiCall, cacheKey, execute]); 

  const refetch = useCallback(async () => {
    requestCache.delete(cacheKey);
    activeRequests.delete(cacheKey);
    return execute();
  }, [execute, cacheKey]);

  return {
    ...state,
    execute,
    refetch,
  };
}

// Hook for user profile
export function useUserProfile(currentUserId?: string, currentUserEmail?: string) {
  const { accessToken, isAuthenticated } = useRequireAuth();
  const apiClient = useMemo(() => getApiClient(accessToken ?? null), [accessToken]);

  const apiCall = useCallback(async (signal?: AbortSignal) => {
    if (!accessToken) {
      throw new Error('Authentication required. Please log in.');
    }

    const response = await apiClient.User.getMe(signal);
    if (Array.isArray(response)) {
      if (currentUserId) {
        const found = response.find((u: any) => String(u.id) === String(currentUserId) || String(u.firebaseUid) === String(currentUserId));
        if (found) return found;
      }
      if (currentUserEmail) {
        const foundByEmail = response.find((u: any) => String(u.email).toLowerCase() === String(currentUserEmail).toLowerCase());
        if (foundByEmail) return foundByEmail;
      }
      if (response.length === 1) return response[0];
      return null;
    }

    return response;
  }, [apiClient, accessToken, currentUserId, currentUserEmail]);

  const { refetch, execute, ...rest } = useApi(
    isAuthenticated ? apiCall : null,
    [accessToken, isAuthenticated, currentUserId, currentUserEmail],
    { immediate: isAuthenticated, showErrorToast: false, redirectOnUnauthorized: false }
  );

  return { ...rest, execute, refetch };
}

// Hook for potential matches
export function usePotentialMatches() {
  const { accessToken, isAuthenticated } = useRequireAuth();
  const apiClient = useMemo(() => getApiClient(accessToken ?? null), [accessToken]);
  const resetPassesRef = useRef(false);

  const apiCall = useCallback((signal?: AbortSignal) => {
    if (!accessToken) throw new Error('Authentication required.');
    const doReset = resetPassesRef.current;
    resetPassesRef.current = false;
    return apiClient.Match.getPotentialMatches(signal, doReset);
  }, [apiClient, accessToken]);

  const result = useApi(
    isAuthenticated ? apiCall : null,
    [accessToken, isAuthenticated],
    { immediate: isAuthenticated, showErrorToast: true, cacheTime: 0, redirectOnUnauthorized: false }
  );

  const refetchWithReset = useCallback(async () => {
    resetPassesRef.current = true;
    return result.refetch();
  }, [result.refetch]);

  return { ...result, refetchWithReset };
}

// Hook for matches
export function useMatches() {
  const { accessToken } = useRequireAuth();
  const api = getApiClient(accessToken);
  const [mutual, setMutual] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [received, setReceived] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      setError(null);

      const [mutualData, sentData, receivedData] = await Promise.all([
        api.Match.getMutualMatches(),
        api.Match.getSentMatches(),
        api.Match.getReceivedMatches(),
      ]);


      setMutual(mutualData || []);
      setSent(sentData || []);
      setReceived(receivedData || []);
    } catch (err: any) {
      console.error("Ã¢ÂÅ’ Error fetching matches:", err);
      setError(err.message || "Failed to fetch matches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [accessToken]);

  return {
    mutual,
    sent,
    received,
    loading,
    error,
    refetch: fetchMatches,
  };
}

// Ã¢Å“â€¦ Mutual, Sent, Received match hooks with logs
export function useMutualMatches() {
  const { accessToken, isAuthenticated } = useRequireAuth();
  const apiClient = useMemo(() => getApiClient(accessToken ?? null), [accessToken]);

  const apiCall = useCallback((signal?: AbortSignal) => {
    if (!accessToken) throw new Error('Authentication required.');
    return apiClient.Match.getMutualMatches(signal);
  }, [apiClient, accessToken]);

  return useApi<any[]>(
    isAuthenticated ? apiCall : null,
    [accessToken, isAuthenticated],
    { immediate: isAuthenticated, showErrorToast: true }
  );
}

export function useSentMatches() {
  const { accessToken, isAuthenticated } = useRequireAuth();
  const apiClient = useMemo(() => getApiClient(accessToken ?? null), [accessToken]);

  const apiCall = useCallback((signal?: AbortSignal) => {
    if (!accessToken) throw new Error('Authentication required.');
    return apiClient.Match.getSentMatches(signal);
  }, [apiClient, accessToken]);

  return useApi<any[]>(
    isAuthenticated ? apiCall : null,
    [accessToken, isAuthenticated],
    { immediate: isAuthenticated, showErrorToast: true }
  );
}

export function useReceivedMatches() {
  const { accessToken, isAuthenticated } = useRequireAuth();
  const apiClient = useMemo(() => getApiClient(accessToken ?? null), [accessToken]);

  const apiCall = useCallback((signal?: AbortSignal) => {
    if (!accessToken) throw new Error('Authentication required.');
    return apiClient.Match.getReceivedMatches(signal);
  }, [apiClient, accessToken]);

  return useApi<any[]>(
    isAuthenticated ? apiCall : null,
    [accessToken, isAuthenticated],
    { immediate: isAuthenticated, showErrorToast: true }
  );
}

// Hook for liking/passing users (No change needed)
export function useMatching() {
  const { accessToken } = useRequireAuth();
  const apiClient = useMemo(() => getApiClient(accessToken ?? null), [accessToken]);
  const { showSuccess, showError, showInfo } = useToast();

  // Store toast refs to avoid adding them to dependencies
  const toastRef = useRef({ showSuccess, showError, showInfo });

  // Update refs when they change, but don't trigger callback recreation
  useEffect(() => {
    toastRef.current = { showSuccess, showError, showInfo };
  }, [showSuccess, showError, showInfo]);

  const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }

    return fallback;
  };

  const likeUser = useCallback(async (userId: string, options?: { suppressSuccessToast?: boolean }) => {
    if (!accessToken) {
      throw new Error('Authentication required. Please log in.');
    }
    try {
      const result = await apiClient.Match.likeUser(userId);
      if (!options?.suppressSuccessToast) {
        toastRef.current.showSuccess(result.isMatch ? "It's a match!" : 'Like sent!');
      }
      return result;
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Failed to like user');
      if (errorMessage.includes('already liked') || errorMessage.includes('already recorded')) {
        toastRef.current.showInfo('You\'ve already liked this profile!', 'Already Liked');
        return; // Do not re-throw, just inform the user
      }
      toastRef.current.showError(errorMessage, 'Error');
      throw error; // Re-throw other errors
    }
  }, [apiClient, accessToken]);

  const passUser = useCallback(async (userId: string) => {
    if (!accessToken) {
      throw new Error('Authentication required. Please log in.');
    }
    try {
      await apiClient.Match.passUser(userId);
      return true;
    } catch (error: unknown) {
      toastRef.current.showError(getErrorMessage(error, 'Failed to pass user'), 'Error');
      throw error;
    }
  }, [apiClient, accessToken]);

  const unmatchUser = useCallback(async (userId: string) => {
    if (!accessToken) {
      throw new Error('Authentication required. Please log in.');
    }
    try {
      const result = await apiClient.Match.unmatchUser(userId);
      toastRef.current.showSuccess(result.message || 'User unmatched.');
      return result;
    } catch (error) {
      toastRef.current.showError('Failed to unmatch user', 'Error');
      throw error;
    }
  }, [apiClient, accessToken]);

  const unmatchAndBlockUser = useCallback(async (userId: string) => {
    if (!accessToken) {
      throw new Error('Authentication required. Please log in.');
    }
    try {
      const result = await apiClient.Match.unmatchAndBlockUser(userId);
      toastRef.current.showSuccess(result.message || 'User unmatched and blocked.');
      return result;
    } catch (error) {
      toastRef.current.showError('Failed to unmatch and block user', 'Error');
      throw error;
    }
  }, [apiClient, accessToken]);

  return { likeUser, passUser, unmatchUser, unmatchAndBlockUser };
}

// Hook for completing onboarding
export function useOnboarding() {
  // Ã°Å¸â€ºâ€˜ NOTE: completeOnboarding API function is REMOVED from apiClient.
  // The actual Firestore logic should be in useAuth's completeOnboarding method.
  // This hook is now just a stub for client-side API logic if needed.
  const { accessToken, refetchUser } = useRequireAuth();
  const { showSuccess, showError } = useToast();

  const toastRef = useRef({ showSuccess, showError });

  useEffect(() => {
    toastRef.current = { showSuccess, showError };
  }, [showSuccess, showError]);

  // This is a placeholder now, as the main onboarding logic is in useAuth.
  const completeOnboarding = useCallback(async () => {
    if (!accessToken) {
      throw new Error('Authentication required. Please log in.');
    }
    try {
      // Ã°Å¸â€ºâ€˜ ERROR: This line is still incorrect if you intended to use the old API.
      // If you are migrating the API call to Firestore, this function should 
      // be called from useAuth, and this hook should be removed/re-written 
      // if it's not performing any API calls.
      // Since the user is asking for the fully updated code, I am commenting out 
      // the now-deleted API call, as per your previous request.
      // const result = await apiClient.Auth.completeOnboarding(onboardingData); 
      
      // *** Assuming the actual API call logic (if any) is now handled elsewhere ***
      const result = { success: true, profilePhotos: { photo1: '' } }; // Placeholder result

      if (refetchUser) {
        await refetchUser(); 
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      toastRef.current.showSuccess('Profile setup complete! Welcome to FaithBliss! Ã°Å¸Å½â€°', 'Ready to Find Love');
      return result;
    } catch (error: any) {
      console.error('Onboarding error:', error);
      
      if (error?.message?.includes('Unauthorized')) {
        toastRef.current.showError('Your session has expired. Please login again.', 'Authentication Error');
      } else {
        toastRef.current.showError('Failed to complete profile setup. Please try again.', 'Setup Error');
      }
      
      throw error;
    }
  }, [accessToken, refetchUser]); // apiClient removed from dependencies as it's not used in the body

  return { completeOnboarding };
}


// Hook for WebSocket connection
export function useConversations() {
  const { pathname } = useLocation();
  const { accessToken, isAuthenticated } = useRequireAuth();
  const apiClient = useMemo(() => getApiClient(accessToken ?? null), [accessToken]);

  const [data, setData] = useState<ConversationSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadPage = useCallback(async (cursor: string | null = null, append = false) => {
    if (!accessToken || !isAuthenticated) return;

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const resp = await apiClient.Message.getMatchConversations({ limit: 25, cursor });
      const items = (resp?.items || []) as ConversationSummary[];

      setData((prev) => {
        if (!append || !prev) return items;
        const merged = [...prev, ...items];
        const seen = new Set<string>();
        return merged.filter((item) => {
          const key = item.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });

      setNextCursor(resp?.nextCursor || null);
      setHasMore(Boolean(resp?.hasMore));
    } catch (err: any) {
      setError(err?.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [apiClient, accessToken, isAuthenticated]);

  const refetch = useCallback(async () => {
    await loadPage(null, false);
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore || loading) return;
    await loadPage(nextCursor, true);
  }, [nextCursor, loadingMore, loading, loadPage]);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      loadPage(null, false);
    } else {
      setData(null);
      setNextCursor(null);
      setHasMore(false);
      setError(null);
    }
  }, [isAuthenticated, accessToken, loadPage]);

  useEffect(() => {
    if (pathname === '/messages' && isAuthenticated && accessToken) {
      refetch();
    }
  }, [pathname, refetch, isAuthenticated, accessToken]);

  return { data, loading, loadingMore, error, hasMore, refetch, loadMore };
}

// Hook for conversation messages (No change needed other than imports)
export function useConversationMessages(
  matchId: string,
  otherUserId?: string,
  page: number = 1,
  limit: number = 50
): {
  execute: () => Promise<ConversationMessagesResponse>;
  refetch: () => Promise<ConversationMessagesResponse>;
  data: ConversationMessagesResponse | null;
  loading: boolean;
  error: string | null;
} {
  const { accessToken, isAuthenticated } = useRequireAuth();
  const apiClient = useMemo(() => getApiClient(accessToken ?? null), [accessToken]);
  
  const apiCall = useCallback(async (signal?: AbortSignal): Promise<ConversationMessagesResponse> => {
    if (!accessToken) throw new Error('Authentication required');

    // Return the full response from backend
    const response = await apiClient.Message.getCreateMatchMessages(matchId, otherUserId, page, limit, signal);
    return response; // should be { match: ..., messages: [...] }
  }, [apiClient, accessToken, matchId, otherUserId, page, limit]);

  return useApi<ConversationMessagesResponse>(
    isAuthenticated && matchId ? apiCall : null,
    [accessToken, isAuthenticated, matchId, otherUserId, page, limit],
    { immediate: !!(isAuthenticated && matchId) }
  );
}

// Hook for notifications (No change needed other than imports)
export type NotificationItem = {
  id: string;
  type?: 'NEW_MESSAGE' | 'PROFILE_LIKED' | 'NEW_MATCH' | 'REPORT_SUBMITTED' | 'SUPPORT_REPLY' | string;
  message?: string;
  data?: Record<string, any>;
  isRead?: boolean;
  createdAt?: string;
};

export function useNotifications() {
  const { accessToken, isAuthenticated } = useRequireAuth();
  const webSocketService = useWebSocket();
  const apiClient = useMemo(() => getApiClient(accessToken ?? null), [accessToken]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setError(null);
      const items = await apiClient.Notification.getNotifications();
      setNotifications(Array.isArray(items) ? (items as NotificationItem[]) : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [apiClient, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void refetchNotifications();
  }, [isAuthenticated, refetchNotifications]);

  useEffect(() => {
    if (!isAuthenticated || !webSocketService) return;
    const handleNotification = (payload: NotificationPayload) => {
      const resolvedId =
        typeof payload.id === 'string' && payload.id.trim()
          ? payload.id
          : `ws-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const newItem: NotificationItem = {
        id: resolvedId,
        type: payload.type,
        message: payload.message,
        data: {
          ...(payload.data || {}),
          ...(payload.senderId ? { senderId: payload.senderId } : {}),
          ...(payload.senderName ? { senderName: payload.senderName } : {}),
          ...(payload.matchId ? { matchId: payload.matchId } : {}),
          ...(payload.otherUser?.id ? { otherUserId: payload.otherUser.id } : {}),
          ...(payload.otherUser?.name ? { otherUserName: payload.otherUser.name } : {}),
        },
        isRead: false,
        createdAt: payload.createdAt || new Date().toISOString(),
      };
      setNotifications(prev => {
        if (prev.some((item) => item.id === newItem.id)) {
          return prev;
        }
        return [newItem, ...prev];
      });
    };
    webSocketService.onNotification(handleNotification);
    return () => {
      webSocketService.off('notification', handleNotification);
    };
  }, [isAuthenticated, webSocketService]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleNotificationsUpdated = () => {
      void refetchNotifications();
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void refetchNotifications();
      }
    };

    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleNotificationsUpdated);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleNotificationsUpdated);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [isAuthenticated, refetchNotifications]);

  return {
    data: notifications,
    loading: loading || !isAuthenticated,
    error,
    refetch: refetchNotifications,
  };
}

export function useNotificationUnreadCount() {
  const { accessToken, isAuthenticated } = useRequireAuth();
  const apiClient = useMemo(() => getApiClient(accessToken ?? null), [accessToken]);
  const webSocketService = useWebSocket();
  const apiCall = useCallback((signal?: AbortSignal) => apiClient.Notification.getUnreadCount(signal), [apiClient]);
  const hook = useApi<{ count: number }>(
    isAuthenticated ? apiCall : null,
    [accessToken, isAuthenticated],
    { immediate: isAuthenticated, showErrorToast: false, redirectOnUnauthorized: false }
  );

  useEffect(() => {
    if (!isAuthenticated || !webSocketService) return;
    const handleNotification = () => {
      hook.refetch();
    };
    webSocketService.onNotification(handleNotification);
    return () => {
      webSocketService.off('notification', handleNotification);
    };
  }, [isAuthenticated, webSocketService, hook]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleNotificationsUpdated = () => {
      void hook.refetch();
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void hook.refetch();
      }
    };

    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleNotificationsUpdated);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleNotificationsUpdated);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [hook, isAuthenticated]);

  return hook;
}


export function useStories() {
  const { accessToken, isAuthenticated } = useRequireAuth();
  const apiClient = useMemo(() => getApiClient(accessToken ?? null), [accessToken]);
  const webSocketService = useWebSocket();
  const { showSuccess, showError } = useToast();

  const apiCall = useCallback((signal?: AbortSignal) => apiClient.Story.getFeed(signal), [apiClient]);
  const feedHook = useApi<{ stories: StoryGroup[] }>(
    isAuthenticated ? apiCall : null,
    [accessToken, isAuthenticated, 'stories'],
    { immediate: isAuthenticated, showErrorToast: false, redirectOnUnauthorized: false, cacheTime: 60 * 1000 }
  );

  const createStory = useCallback(async (payload: FormData) => {
    try {
      const result = await apiClient.Story.create(payload);
      showSuccess('Story posted');
      await feedHook.refetch();
      return result;
    } catch (error) {
      showError('Failed to post story', 'Story Error');
      throw error;
    }
  }, [apiClient, feedHook, showError, showSuccess]);

  const markStorySeen = useCallback(async (storyId: string) => {
    try {
      await apiClient.Story.markSeen(storyId);
    } catch {
      // Best effort only. UI keeps local seen state.
    }
  }, [apiClient]);

  const deleteStory = useCallback(async (storyId: string) => {
    try {
      await apiClient.Story.delete(storyId);
      showSuccess('Story deleted');
      await feedHook.refetch();
    } catch (error) {
      showError('Failed to delete story', 'Story Error');
      throw error;
    }
  }, [apiClient, feedHook, showError, showSuccess]);

  const likeStory = useCallback(async (storyId: string) => {
    return apiClient.Story.like(storyId);
  }, [apiClient]);

  const getStoryLikes = useCallback(async (storyId: string) => {
    return apiClient.Story.getLikes(storyId);
  }, [apiClient]);

  const replyToStory = useCallback(async (storyId: string, content: string) => {
    return apiClient.Story.reply(storyId, content);
  }, [apiClient]);

  useEffect(() => {
    if (!isAuthenticated || !webSocketService) return;

    const handleNotification = (payload: NotificationPayload) => {
      if (payload.type === 'STORY_POSTED') {
        feedHook.refetch().catch(() => null);
      }
    };

    webSocketService.onNotification(handleNotification);
    return () => {
      webSocketService.off('notification', handleNotification);
    };
  }, [isAuthenticated, webSocketService, feedHook.refetch]);

  return {
    ...feedHook,
    stories: feedHook.data?.stories || [],
    createStory,
    markStorySeen,
    likeStory,
    getStoryLikes,
    replyToStory,
    deleteStory,
  };
}
// Hook for fetching all users (No change needed)
export function useAllUsers(filters?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const { accessToken, isAuthenticated } = useRequireAuth();
  const apiClient = useMemo(() => getApiClient(accessToken ?? null), [accessToken]);

  const apiCall = useCallback((signal?: AbortSignal) => {
    if (!accessToken) {
      throw new Error('Authentication required. Please log in.');
    }

    const normalizedFilters = {
      page: filters?.page || 1,
      limit: Math.min(filters?.limit || 50, 200),
      search: filters?.search || undefined,
    };

    return apiClient.User.getAllUsers(normalizedFilters, signal);
  }, [apiClient, accessToken, filters?.page, filters?.limit, filters?.search]);

  return useApi<GetUsersResponse>(
    isAuthenticated ? apiCall : null,
    [filters?.page, filters?.limit, filters?.search],
    { immediate: isAuthenticated, showErrorToast: true, cacheTime: 10 * 60 * 1000, redirectOnUnauthorized: false }
  );
}

// Hook for unread message count (No change needed)
export function useUnreadCount() {
  const { accessToken, isAuthenticated } = useRequireAuth();
  const apiClient = useMemo(() => getApiClient(accessToken ?? null), [accessToken]);
  const webSocketService = useWebSocket();

  const apiCall = useCallback((signal?: AbortSignal) => {
    if (!accessToken) {
      throw new Error('Authentication required. Please log in.');
    }
    return apiClient.Message.getUnreadCount(signal);
  }, [apiClient, accessToken]);

  const hook = useApi<{ count: number }>(
    isAuthenticated ? apiCall : null,
    [accessToken, isAuthenticated],
    { immediate: isAuthenticated }
  );

  useEffect(() => {
    if (!isAuthenticated || !webSocketService) return;

    const syncUnreadCount = () => {
      void hook.refetch();
    };

    webSocketService.onNewMessage(syncUnreadCount);
    webSocketService.onUnreadCount(syncUnreadCount);

    return () => {
      webSocketService.off('newMessage', syncUnreadCount);
      webSocketService.off('unreadCount', syncUnreadCount);
    };
  }, [hook, isAuthenticated, webSocketService]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void hook.refetch();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [hook, isAuthenticated]);

  return hook;
}

export function useClearApiCache() {
  return useCallback(() => {
    requestCache.clear();
    activeRequests.clear();
  }, []);
}






