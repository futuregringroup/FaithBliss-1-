/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ConversationMessagesResponse } from '@/hooks/useAPI';
import type {
  AdminResetPasswordResponse,
  AdminUpdateUserPayload,
  AdminUpdateUserResponse,
  GetUsersResponse,
  UpdateProfileDto,
  UpdateUserRoleResponse,
  User,
} from '@/services/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'SYSTEM';

export interface MessageAttachment {
  url: string;
  publicId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  resourceType?: string;
}

// Generic API request function for the client
const apiClientRequest = async <T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {};

  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => (headers[key] = value));
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => (headers[key] = value));
    } else {
      Object.assign(headers, options.headers);
    }
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && token) {
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }

  if (response.status === 204) return {} as T;

  return await response.json();
};

// Factory for API client
export const getApiClient = (accessToken: string | null) => ({
  Match: {
    getMatches: () =>
      apiClientRequest<any[]>('/api/matches', { method: 'GET' }, accessToken),

    getMutualMatches: () =>
      apiClientRequest<any[]>('/api/matches/mutual', { method: 'GET' }, accessToken),

    getSentMatches: () =>
      apiClientRequest<any[]>('/api/matches/sent', { method: 'GET' }, accessToken),

    getPassedProfiles: () =>
      apiClientRequest<{ profiles: any[] }>('/api/matches/passed', { method: 'GET' }, accessToken),

    getReceivedMatches: () =>
      apiClientRequest<any[]>('/api/matches/received', { method: 'GET' }, accessToken),

    getPotentialMatches: () =>
      apiClientRequest<any[]>('/api/matches/potential', { method: 'GET' }, accessToken),

    likeUser: (userId: string) =>
      apiClientRequest<any>(`/api/matches/like/${userId}`, { method: 'POST' }, accessToken),

    passUser: (userId: string) =>
      apiClientRequest<void>(`/api/matches/pass/${userId}`, { method: 'POST' }, accessToken),

    unmatchUser: (userId: string) =>
      apiClientRequest<{ message: string; removedMatchIds?: string[] }>(
        `/api/matches/unmatch/${userId}`,
        { method: 'POST' },
        accessToken
      ),

    unmatchAndBlockUser: (userId: string) =>
      apiClientRequest<{ message: string; removedMatchIds?: string[] }>(
        `/api/matches/unmatch-block/${userId}`,
        { method: 'POST' },
        accessToken
      ),
  },

  User: {
    getMe: () => apiClientRequest<User>('/api/users/me', { method: 'GET' }, accessToken),
    getUserById: (userId: string) =>
      apiClientRequest<User>(`/api/users/${userId}`, { method: 'GET' }, accessToken),

    getAllUsers: (filters?: { page?: number; limit?: number; search?: string }) => {
      const queryParams: Record<string, string> = {};
      if (filters?.page) queryParams.page = filters.page.toString();
      if (filters?.limit) queryParams.limit = filters.limit.toString();
      if (filters?.search) queryParams.search = filters.search;
      const query =
        Object.keys(queryParams).length > 0
          ? `?${new URLSearchParams(queryParams).toString()}`
          : '';
      return apiClientRequest<GetUsersResponse>(
        `/api/users${query}`,
        { method: 'GET' },
        accessToken
      );
    },

    updateUserRole: (userId: string, role: 'user' | 'admin' | 'marketer') =>
      apiClientRequest<UpdateUserRoleResponse>(
        `/api/users/${userId}/role`,
        { method: 'PATCH', body: JSON.stringify({ role }) },
        accessToken
      ),

    adminUpdateUser: (userId: string, payload: AdminUpdateUserPayload) =>
      apiClientRequest<AdminUpdateUserResponse>(
        `/api/users/${userId}`,
        { method: 'PATCH', body: JSON.stringify(payload) },
        accessToken
      ),

    adminResetPassword: (userId: string) =>
      apiClientRequest<AdminResetPasswordResponse>(
        `/api/users/${userId}/reset-password`,
        { method: 'POST' },
        accessToken
      ),

    adminDeleteUser: (userId: string) =>
      apiClientRequest<{ message: string }>(
        `/api/users/${userId}`,
        { method: 'DELETE' },
        accessToken
      ),

    deleteAccount: () =>
      apiClientRequest<{ message: string }>(
        '/api/users/me',
        { method: 'DELETE' },
        accessToken
      ),
  },

  Message: {
    sendMessage: (matchId: string, content: string, attachment?: MessageAttachment | null) =>
      apiClientRequest<any>(
        '/api/messages',
        { method: 'POST', body: JSON.stringify({ matchId, content, attachment }) },
        accessToken
      ),
    uploadAttachment: (payload: FormData) =>
      apiClientRequest<{ attachment: MessageAttachment; type: MessageType }>(
        '/api/messages/attachments',
        { method: 'POST', body: payload },
        accessToken
      ),
    getCreateMatchMessages: (matchId: string, otherUserId?: string, page = 1, limit = 50) =>
      apiClientRequest<ConversationMessagesResponse>(
        `/api/messages/match/${matchId}?page=${page}&limit=${limit}${
          otherUserId ? `&otherUserId=${otherUserId}` : ''
        }`,
        { method: 'GET' },
        accessToken
      ),
    markMessageAsRead: (messageId: string) =>
      apiClientRequest<void>(`/api/messages/${messageId}/read`, { method: 'PATCH' }, accessToken),
    getUnreadCount: () =>
      apiClientRequest<{ count: number }>(
        '/api/messages/unread-count',
        { method: 'GET' },
        accessToken
      ),
    getMatchConversations: (params?: { limit?: number; cursor?: string | null }) => {
      const query = new URLSearchParams();
      query.set('limit', String(params?.limit ?? 25));
      if (params?.cursor) query.set('cursor', params.cursor);
      return apiClientRequest<{ items: any[]; nextCursor: string | null; hasMore: boolean }>(
        `/api/messages/conversations?${query.toString()}`,
        { method: 'GET' },
        accessToken
      );
    },
  },
  Notification: {
    getNotifications: () =>
      apiClientRequest<any[]>('/api/notifications', { method: 'GET' }, accessToken),
    getUnreadCount: () =>
      apiClientRequest<{ count: number }>(
        '/api/notifications/unread-count',
        { method: 'GET' },
        accessToken
      ),
    markAsRead: (id: string) =>
      apiClientRequest<void>(`/api/notifications/${id}/read`, { method: 'PATCH' }, accessToken),
    markAllAsRead: () =>
      apiClientRequest<void>('/api/notifications/read-all', { method: 'PATCH' }, accessToken),
  },
  Story: {
    getFeed: () =>
      apiClientRequest<{ stories: any[] }>('/api/stories/feed', { method: 'GET' }, accessToken),
    create: (payload: FormData) =>
      apiClientRequest<{ story: any }>('/api/stories', { method: 'POST', body: payload }, accessToken),
    markSeen: (storyId: string) =>
      apiClientRequest<{ success: boolean }>(`/api/stories/${storyId}/seen`, { method: 'PATCH' }, accessToken),
    like: (storyId: string) =>
      apiClientRequest<{ liked: boolean; likesCount: number }>(`/api/stories/${storyId}/like`, { method: 'POST' }, accessToken),
    getLikes: (storyId: string) =>
      apiClientRequest<{ users: Array<{ id: string; name: string; profilePhoto1?: string }>; count: number }>(
        `/api/stories/${storyId}/likes`,
        { method: 'GET' },
        accessToken
      ),
    reply: (storyId: string, content: string) =>
      apiClientRequest<{ success: boolean; matchId: string; message: any }>(
        `/api/stories/${storyId}/reply`,
        { method: 'POST', body: JSON.stringify({ content }) },
        accessToken
      ),
    delete: (storyId: string) =>
      apiClientRequest<{ success: boolean }>(`/api/stories/${storyId}`, { method: 'DELETE' }, accessToken),
  },
});

export async function updateProfileClient(
  userData: UpdateProfileDto,
  accessToken: string
): Promise<User> {
  const url = `${API_BASE_URL}/api/users/me`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(userData),
    credentials: 'include',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function uploadSpecificPhotoClient(
  photoNumber: number,
  photo: FormData,
  accessToken: string
) {
  const url = `${API_BASE_URL}/api/users/me/photo/${photoNumber}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: photo,
    credentials: 'include',
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  return response.json();
}
