/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/Messages.tsx

import { useState, useRef, useEffect, useLayoutEffect, Suspense, useMemo, useCallback, type ChangeEvent, type TouchEvent as ReactTouchEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

// 1. IMPORT TYPES
import type {
  ConversationSummary,
  ConversationMessagesResponse,
  Message
} from '@/types/chat';

import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { TopBar } from '@/components/dashboard/TopBar';
import { SidePanel } from '@/components/dashboard/SidePanel';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { getApiClient, type MessageAttachment, type MessageType } from '@/services/api-client';
import type {
  CallAnswerPayload,
  CallEndPayload,
  CallIceCandidatePayload,
  CallOfferPayload,
  CallRejectPayload,
  CallStatePayload,
  CallType,
  MessageReactionUpdatePayload,
  UserPresencePayload,
} from '@/services/WebSocketService';
import {
  MessageCircle, ArrowLeft, Search, Send, Phone, Video,
  Smile, Paperclip, Info, Check, CheckCheck, Download, FileText, Loader2, Eye, X, Mic, Square, Play, Pause, Image as ImageIcon, Sticker, Reply, PhoneOff, MicOff, VideoOff, Minimize2, Maximize2, RefreshCcw, Wand2, Lock
} from 'lucide-react';

// Assuming these imports are correct for your Vite project structure
import { useConversations, useConversationMessages, invalidateConversationMessagesCache } from '@/hooks/useAPI';
import { useWebSocket } from '@/hooks/useWebSocket';
import { HeartBeatLoader } from '@/components/HeartBeatLoader';
import AppDropdown from '@/components/AppDropdown';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className: string;
}

type CallVideoFilterPreset = {
  id: string;
  label: string;
  cssFilter: string;
};

type CallBackgroundPreset = {
  id: string;
  label: string;
  className: string;
  overlayClass: string;
};

const CALL_VIDEO_FILTER_PRESETS: CallVideoFilterPreset[] = [
  { id: 'none', label: 'Natural', cssFilter: 'none' },
  { id: 'soft', label: 'Soft', cssFilter: 'brightness(1.1) contrast(1.05) saturate(1.18)' },
  { id: 'warm', label: 'Warm', cssFilter: 'sepia(0.22) saturate(1.35) contrast(1.08) brightness(1.03)' },
  { id: 'mono', label: 'Mono', cssFilter: 'grayscale(1) contrast(1.18) brightness(1.02)' },
  { id: 'dream', label: 'Dream', cssFilter: 'saturate(1.5) hue-rotate(-16deg) brightness(1.1) contrast(1.06)' },
];

const CALL_BACKGROUND_PRESETS: CallBackgroundPreset[] = [
  {
    id: 'default',
    label: 'Default',
    className:
      'bg-[radial-gradient(circle_at_20%_20%,rgba(244,114,182,0.2),transparent_40%),radial-gradient(circle_at_80%_75%,rgba(99,102,241,0.22),transparent_45%),linear-gradient(135deg,#07121d,#0d1d2d,#132b3f)]',
    overlayClass:
      'bg-[radial-gradient(circle_at_16%_18%,rgba(244,114,182,0.22),transparent_42%),radial-gradient(circle_at_82%_80%,rgba(99,102,241,0.2),transparent_46%)] opacity-60',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    className:
      'bg-[radial-gradient(circle_at_10%_20%,rgba(251,146,60,0.3),transparent_42%),radial-gradient(circle_at_85%_75%,rgba(244,114,182,0.26),transparent_45%),linear-gradient(140deg,#2d0f27,#4a1f40,#1f2748)]',
    overlayClass:
      'bg-[linear-gradient(135deg,rgba(251,146,60,0.35),rgba(244,114,182,0.22),rgba(168,85,247,0.2))] opacity-65 mix-blend-screen',
  },
  {
    id: 'ocean',
    label: 'Ocean',
    className:
      'bg-[radial-gradient(circle_at_16%_18%,rgba(56,189,248,0.24),transparent_40%),radial-gradient(circle_at_84%_82%,rgba(34,211,238,0.26),transparent_44%),linear-gradient(140deg,#061a29,#0b2a3f,#103451)]',
    overlayClass:
      'bg-[linear-gradient(145deg,rgba(14,116,144,0.32),rgba(6,182,212,0.25),rgba(59,130,246,0.2))] opacity-65 mix-blend-screen',
  },
  {
    id: 'forest',
    label: 'Forest',
    className:
      'bg-[radial-gradient(circle_at_18%_20%,rgba(74,222,128,0.26),transparent_42%),radial-gradient(circle_at_82%_78%,rgba(163,230,53,0.22),transparent_44%),linear-gradient(140deg,#0b1f18,#123324,#1a3f2e)]',
    overlayClass:
      'bg-[linear-gradient(145deg,rgba(34,197,94,0.26),rgba(163,230,53,0.22),rgba(21,128,61,0.18))] opacity-65 mix-blend-screen',
  },
];

// Utility to parse URL search parameters from useLocation
const useViteSearchParams = () => {
  const location = useLocation();
  return new URLSearchParams(location.search);
};

// Custom Image Component
const OptimizedImage = ({ src, alt, width, height, className }: OptimizedImageProps) => (
  <img
    src={src}
    alt={alt}
    width={width}
    height={height}
    className={className}
    loading="lazy"
  />
);

const getAttachmentPreviewText = (
  messageType?: Message['type'],
  attachment?: Message['attachment']
) => {
  if (messageType === 'IMAGE') return 'Image';
  if (messageType === 'VIDEO') return 'Video';
  if (messageType === 'AUDIO') return 'Audio';
  if (attachment?.mimeType.startsWith('image/')) return 'Image';
  if (attachment?.mimeType.startsWith('video/')) return 'Video';
  if (attachment?.mimeType.startsWith('audio/')) return 'Audio';
  return 'File';
};

const getMessagePreviewText = (
  content: string,
  attachment?: Message['attachment'],
  messageType?: Message['type']
) => {
  if (attachment) {
    return getAttachmentPreviewText(messageType, attachment);
  }

  const trimmed = content.trim();
  if (trimmed) return trimmed;
  return '';
};

const getReplyPreviewFromMessage = (message: Message): NonNullable<Message['replyTo']> => ({
  id: message.id,
  senderId: message.senderId,
  content: message.content || '',
  type: message.type || 'TEXT',
  attachment: message.attachment || null,
});

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const formatRecordingTime = (totalSeconds: number) => {
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
};

const formatCallDuration = (totalSeconds: number) => {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const secs = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins}:${secs}`;
  }
  return `${mins}:${secs}`;
};

const formatLastSeenTimestamp = (isoTimestamp?: string) => {
  if (!isoTimestamp) return '';
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);

  if (diffSeconds >= 0 && diffSeconds < 45) return 'just now';
  if (diffMinutes > 0 && diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  }

  const timeLabel = date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) {
    return `today at ${timeLabel}`;
  }

  if (date >= startOfYesterday) {
    return `yesterday at ${timeLabel}`;
  }

  const daysAgo = Math.floor((startOfToday.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (daysAgo < 7) {
    const weekday = date.toLocaleDateString([], { weekday: 'long' });
    return `${weekday} at ${timeLabel}`;
  }

  const dateLabel = date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${dateLabel} at ${timeLabel}`;
};

const QUICK_EMOJIS = [
  '😀', '😂', '😍', '😘', '🥰', '😊', '😉', '😎', '😭', '😡',
  '🙏', '❤️', '🔥', '👍', '👏', '🎉', '💯', '🤝', '😇', '🤗',
  '🌟', '💖', '💬', '🎶', '😴', '😅', '🙌', '🤍', '🥳', '✨',
];

const QUICK_MESSAGE_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const getAttachmentKind = (
  messageType?: Message['type'],
  attachment?: Message['attachment']
): 'image' | 'video' | 'audio' | 'pdf' | 'file' => {
  if (messageType === 'IMAGE' || attachment?.mimeType.startsWith('image/')) return 'image';
  if (messageType === 'VIDEO' || attachment?.mimeType.startsWith('video/')) return 'video';
  if (messageType === 'AUDIO' || attachment?.mimeType.startsWith('audio/')) return 'audio';
  if (attachment?.mimeType === 'application/pdf') return 'pdf';
  return 'file';
};

const isGifAttachment = (attachment?: Message['attachment']) => {
  if (!attachment) return false;
  const mime = attachment.mimeType.toLowerCase();
  const fileName = attachment.fileName.toLowerCase();
  return mime === 'image/gif' || fileName.endsWith('.gif') || fileName.startsWith('gif-');
};

const isStickerAttachment = (attachment?: Message['attachment']) => {
  if (!attachment) return false;
  const fileName = attachment.fileName.toLowerCase();
  return fileName.startsWith('sticker-') || fileName.includes('sticker');
};

type MediaLibraryTab = 'gif' | 'sticker';

interface MediaLibraryItem {
  id: string;
  previewUrl: string;
  mediaUrl: string;
  title: string;
  mimeType: string;
}

const isMediaLibraryItem = (value: MediaLibraryItem | null): value is MediaLibraryItem => Boolean(value);

interface VoiceNoteAttachmentProps {
  attachment: MessageAttachment;
  isSender: boolean;
}

const VoiceNoteAttachment = ({ attachment, isSender }: VoiceNoteAttachmentProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRafRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const resolveDuration = (audio: HTMLAudioElement) => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      return audio.duration;
    }
    if (audio.seekable && audio.seekable.length > 0) {
      const seekableEnd = audio.seekable.end(audio.seekable.length - 1);
      if (Number.isFinite(seekableEnd) && seekableEnd > 0) {
        return seekableEnd;
      }
    }
    return 0;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const stopProgressLoop = () => {
      if (progressRafRef.current !== null) {
        cancelAnimationFrame(progressRafRef.current);
        progressRafRef.current = null;
      }
    };

    const syncProgress = () => {
      setCurrentTime(audio.currentTime || 0);
      const resolved = resolveDuration(audio);
      if (resolved > 0) {
        setDuration(resolved);
      }
    };

    const startProgressLoop = () => {
      stopProgressLoop();
      const tick = () => {
        if (!audio || audio.paused) return;
        syncProgress();
        progressRafRef.current = requestAnimationFrame(tick);
      };
      progressRafRef.current = requestAnimationFrame(tick);
    };

    const onLoaded = () => {
      syncProgress();
    };
    const onDurationChange = () => {
      syncProgress();
    };
    const onTimeUpdate = () => {
      syncProgress();
    };
    const onProgress = () => {
      syncProgress();
    };
    const onPlay = () => {
      setIsPlaying(true);
      startProgressLoop();
    };
    const onPause = () => {
      setIsPlaying(false);
      stopProgressLoop();
      setCurrentTime(audio.currentTime || 0);
    };
    const onEnded = () => {
      setIsPlaying(false);
      stopProgressLoop();
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('progress', onProgress);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      stopProgressLoop();
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('progress', onProgress);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      return;
    }

    try {
      await audio.play();
    } catch {
      setIsPlaying(false);
    }
  };

  const handleSeek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
  };

  const shownTotal = duration > 0 ? duration : currentTime;
  const progressPercent = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  return (
    <div
      className={`w-[220px] sm:w-[240px] rounded-2xl border px-3 py-2.5 ${
        isSender
          ? 'bg-white/15 border-white/25'
          : 'bg-black/35 border-white/20'
      }`}
    >
      <audio ref={audioRef} src={attachment.url} preload="metadata" />
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={togglePlayback}
          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-white text-gray-900 hover:bg-gray-100 transition-colors flex-shrink-0"
          aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 1}
            value={duration > 0 ? Math.min(currentTime, duration) : 0}
            onChange={(e) => handleSeek(Number(e.target.value))}
            step={0.01}
            disabled={duration <= 0}
            style={{
              background: `linear-gradient(to right, #f472b6 0%, #f472b6 ${progressPercent}%, rgba(255,255,255,0.25) ${progressPercent}%, rgba(255,255,255,0.25) 100%)`,
            }}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          />
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/75">
            <span className="font-mono">{formatRecordingTime(currentTime)}</span>
            <span className="truncate">Voice note</span>
            <span className="font-mono">{formatRecordingTime(shownTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const MessagesContent = () => {
  const searchParams = useViteSearchParams();
  const didAutoSelect = useRef(false);
  const profileIdParam = searchParams.get('profileId');
  const profileNameParam = searchParams.get('profileName');

  const [selectedChat, setSelectedChat] = useState<string | null>(
    profileIdParam || null
  );
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const conversationsListRef = useRef<HTMLDivElement | null>(null);
  const messagesListRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const localCallVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteCallVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteCallAudioRef = useRef<HTMLAudioElement | null>(null);
  const localPreviewContainerRef = useRef<HTMLDivElement | null>(null);
  const minimizedCallContainerRef = useRef<HTMLDivElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localCallStreamRef = useRef<MediaStream | null>(null);
  const remoteCallStreamRef = useRef<MediaStream | null>(null);
  const pendingIncomingOfferRef = useRef<CallOfferPayload | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const isCleaningUpCallRef = useRef(false);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callDisconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callStartedAtRef = useRef<number | null>(null);
  const activeCallPeerIdRef = useRef<string | null>(null);
  const activeCallMatchIdRef = useRef<string | null>(null);
  const callStatusRef = useRef<'idle' | 'dialing' | 'ringing' | 'connecting' | 'active'>('idle');
  const currentConversationRef = useRef<ConversationSummary | null>(null);
  const minimizedCallDragStateRef = useRef<{
    dragging: boolean;
    offsetX: number;
    offsetY: number;
  }>({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
  });
  const localPreviewDragStateRef = useRef<{
    dragging: boolean;
    offsetX: number;
    offsetY: number;
  }>({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
  });
  const mobileCallGestureStartRef = useRef<{ x: number; y: number } | null>(null);
  const ringtoneAudioContextRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const incomingCallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefetchedMatchId = useRef<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({});
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, UserPresencePayload>>({});
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [viewerMessage, setViewerMessage] = useState<Message | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [mediaLibraryTab, setMediaLibraryTab] = useState<MediaLibraryTab>('gif');
  const [mediaLibraryQuery, setMediaLibraryQuery] = useState('');
  const [mediaLibraryItems, setMediaLibraryItems] = useState<MediaLibraryItem[]>([]);
  const [mediaLibraryLoading, setMediaLibraryLoading] = useState(false);
  const [mediaLibraryError, setMediaLibraryError] = useState<string | null>(null);
  const [isImportingMediaItem, setIsImportingMediaItem] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<{
    fromUserId: string;
    matchId?: string;
    callType: CallType;
  } | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'ringing' | 'connecting' | 'active'>('idle');
  const [callMode, setCallMode] = useState<CallType | null>(null);
  const [activeCallPeerId, setActiveCallPeerId] = useState<string | null>(null);
  const [activeCallMatchId, setActiveCallMatchId] = useState<string | null>(null);
  const [localCallStream, setLocalCallStream] = useState<MediaStream | null>(null);
  const [remoteCallStream, setRemoteCallStream] = useState<MediaStream | null>(null);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [isCallMicMuted, setIsCallMicMuted] = useState(false);
  const [isCallCameraOff, setIsCallCameraOff] = useState(false);
  const [isRemoteCallMicMuted, setIsRemoteCallMicMuted] = useState(false);
  const [isRemoteCallCameraOff, setIsRemoteCallCameraOff] = useState(false);
  const [callCameraFacingMode, setCallCameraFacingMode] = useState<'user' | 'environment'>('user');
  const [callQualityLabel, setCallQualityLabel] = useState<'Excellent' | 'Good' | 'Weak' | 'Offline'>('Excellent');
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [minimizedCallPosition, setMinimizedCallPosition] = useState<{ x: number; y: number } | null>(null);
  const [isMinimizedCallDragging, setIsMinimizedCallDragging] = useState(false);
  const [localPreviewPosition, setLocalPreviewPosition] = useState<{ x: number; y: number } | null>(null);
  const [isLocalPreviewDragging, setIsLocalPreviewDragging] = useState(false);
  const [selectedVideoFilterId, setSelectedVideoFilterId] = useState<string>('none');
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<string>('default');
  const [pendingAttachment, setPendingAttachment] = useState<{
    attachment: MessageAttachment;
    type: MessageType;
  } | null>(null);

  const { user: layoutUser, accessToken } = useAuthContext();
  const { showError } = useToast();
  const navigate = useNavigate();
  const hasPremiumCallAccess =
    layoutUser?.subscriptionStatus === 'active' &&
    ['premium', 'elite'].includes(String(layoutUser?.subscriptionTier || '').toLowerCase());
  const apiClient = useMemo(() => getApiClient(accessToken ?? null), [accessToken]);
  const tenorApiKey = (import.meta.env.VITE_TENOR_API_KEY as string | undefined)?.trim() || '';
  const tenorClientKey = (import.meta.env.VITE_TENOR_CLIENT_KEY as string | undefined)?.trim() || 'faithbliss-chat';
  const giphyApiKey = (import.meta.env.VITE_GIPHY_API_KEY as string | undefined)?.trim() || '';
  const turnUrlsRaw = (import.meta.env.VITE_TURN_URLS as string | undefined)?.trim() || '';
  const turnUsername = (import.meta.env.VITE_TURN_USERNAME as string | undefined)?.trim() || '';
  const turnCredential = (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined)?.trim() || '';
  const mediaLibraryProvider: 'tenor' | 'giphy' | null = tenorApiKey
    ? 'tenor'
    : giphyApiKey
      ? 'giphy'
      : null;
  const rtcIceServers = useMemo<RTCIceServer[]>(() => {
    const defaults: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    const turnUrls = turnUrlsRaw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!turnUrls.length) return defaults;

    const turnServer: RTCIceServer = { urls: turnUrls };
    if (turnUsername && turnCredential) {
      turnServer.username = turnUsername;
      turnServer.credential = turnCredential;
    }

    return [...defaults, turnServer];
  }, [turnCredential, turnUrlsRaw, turnUsername]);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [isDesktopLayout, setIsDesktopLayout] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth >= 1024;
  });
  const [isCompactCallViewport, setIsCompactCallViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 380 || window.innerHeight <= 740;
  });
  const layoutName = layoutUser?.name || 'User';
  const layoutImage = layoutUser?.profilePhoto1 || undefined;
  const currentUserId = layoutUser?.id;
  const webSocketService = useWebSocket();

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    activeCallPeerIdRef.current = activeCallPeerId;
  }, [activeCallPeerId]);

  useEffect(() => {
    activeCallMatchIdRef.current = activeCallMatchId;
  }, [activeCallMatchId]);

  useEffect(() => {
    const localVideo = localCallVideoRef.current;
    if (!localVideo) return;
    localVideo.srcObject = localCallStream;
  }, [localCallStream]);

  useEffect(() => {
    const remoteVideo = remoteCallVideoRef.current;
    if (remoteVideo) {
      remoteVideo.srcObject = remoteCallStream;
      void remoteVideo.play().catch(() => {
        // autoplay may be blocked until a gesture; call UI has controls to resume.
      });
    }

    const remoteAudio = remoteCallAudioRef.current;
    if (remoteAudio) {
      remoteAudio.srcObject = remoteCallStream;
      void remoteAudio.play().catch(() => {
        // autoplay may be blocked until a gesture; call UI has controls to resume.
      });
    }
  }, [remoteCallStream]);

  // Re-attach streams whenever call window layout switches (full <-> minimized),
  // because the underlying <video> elements are remounted.
  useLayoutEffect(() => {
    const localVideo = localCallVideoRef.current;
    if (localVideo && localVideo.srcObject !== localCallStream) {
      localVideo.srcObject = localCallStream;
    }

    const remoteVideo = remoteCallVideoRef.current;
    if (remoteVideo && remoteVideo.srcObject !== remoteCallStream) {
      remoteVideo.srcObject = remoteCallStream;
      void remoteVideo.play().catch(() => {
        // noop
      });
    }

    const remoteAudio = remoteCallAudioRef.current;
    if (remoteAudio && remoteAudio.srcObject !== remoteCallStream) {
      remoteAudio.srcObject = remoteCallStream;
      void remoteAudio.play().catch(() => {
        // noop
      });
    }
  }, [isCallMinimized, localCallStream, remoteCallStream]);

  const stopCallTimer = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    callStartedAtRef.current = null;
  }, []);

  const startCallTimer = useCallback(() => {
    stopCallTimer();
    callStartedAtRef.current = Date.now();
    setCallDurationSeconds(0);
    callTimerRef.current = setInterval(() => {
      if (!callStartedAtRef.current) return;
      setCallDurationSeconds(Math.floor((Date.now() - callStartedAtRef.current) / 1000));
    }, 1000);
  }, [stopCallTimer]);

  const clearIncomingCallTimeout = useCallback(() => {
    if (incomingCallTimeoutRef.current) {
      clearTimeout(incomingCallTimeoutRef.current);
      incomingCallTimeoutRef.current = null;
    }
  }, []);

  const clearCallDisconnectTimeout = useCallback(() => {
    if (callDisconnectTimeoutRef.current) {
      clearTimeout(callDisconnectTimeoutRef.current);
      callDisconnectTimeoutRef.current = null;
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }

    const audioContext = ringtoneAudioContextRef.current;
    ringtoneAudioContextRef.current = null;
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch(() => {
        // noop
      });
    }
  }, []);

  const startRingtone = useCallback((toneType: 'incoming' | 'outgoing') => {
    const AudioContextCtor =
      window.AudioContext
      || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    stopRingtone();
    const audioContext = new AudioContextCtor();
    ringtoneAudioContextRef.current = audioContext;

    const playTone = (frequency: number, durationSec: number, delaySec = 0) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime + delaySec);
      gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + delaySec + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + delaySec + durationSec
      );
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(audioContext.currentTime + delaySec);
      oscillator.stop(audioContext.currentTime + delaySec + durationSec + 0.02);
    };

    const playPattern = () => {
      if (audioContext.state === 'suspended') {
        void audioContext.resume().catch(() => {
          // noop
        });
      }
      if (toneType === 'incoming') {
        playTone(760, 0.15, 0);
        playTone(640, 0.15, 0.23);
        return;
      }
      playTone(520, 0.14, 0);
      playTone(520, 0.14, 0.2);
    };

    playPattern();
    ringtoneIntervalRef.current = setInterval(playPattern, toneType === 'incoming' ? 1500 : 1200);
  }, [stopRingtone]);

  const sendMissedCallMessage = useCallback((targetUserId: string, matchId?: string, callType?: CallType) => {
    if (!webSocketService || !targetUserId || !matchId) return;
    const kind = callType === 'video' ? 'video' : 'audio';
    const clientTempId = `temp-call-${Date.now()}-${Math.random()}`;
    webSocketService.sendMessage(
      targetUserId,
      `Missed ${kind} call`,
      matchId,
      null,
      clientTempId,
      null
    );
  }, [webSocketService]);

  const sendEndedCallMessage = useCallback((targetUserId: string, matchId?: string, callType?: CallType) => {
    if (!webSocketService || !targetUserId || !matchId) return;
    const kind = callType === 'video' ? 'Video' : 'Audio';
    const clientTempId = `temp-call-ended-${Date.now()}-${Math.random()}`;
    webSocketService.sendMessage(
      targetUserId,
      `${kind} call ended`,
      matchId,
      null,
      clientTempId,
      null
    );
  }, [webSocketService]);

  const resetCallState = useCallback(() => {
    setIncomingCall(null);
    setCallStatus('idle');
    setCallMode(null);
    setActiveCallPeerId(null);
    setActiveCallMatchId(null);
    setLocalCallStream(null);
    setRemoteCallStream(null);
    setCallDurationSeconds(0);
    setIsCallMicMuted(false);
    setIsCallCameraOff(false);
    setIsRemoteCallMicMuted(false);
    setIsRemoteCallCameraOff(false);
    setCallCameraFacingMode('user');
    setCallQualityLabel('Excellent');
    setIsCallMinimized(false);
    setMinimizedCallPosition(null);
    setIsMinimizedCallDragging(false);
    minimizedCallDragStateRef.current.dragging = false;
    setLocalPreviewPosition(null);
    setIsLocalPreviewDragging(false);
    localPreviewDragStateRef.current.dragging = false;
    mobileCallGestureStartRef.current = null;
    setSelectedVideoFilterId('none');
    setSelectedBackgroundId('default');
  }, []);

  const teardownCallResources = useCallback(() => {
    stopCallTimer();
    clearIncomingCallTimeout();
    clearCallDisconnectTimeout();
    stopRingtone();
    pendingIncomingOfferRef.current = null;
    pendingIceCandidatesRef.current = [];

    const peerConnection = peerConnectionRef.current;
    if (peerConnection) {
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.oniceconnectionstatechange = null;
      try {
        peerConnection.close();
      } catch {
        // noop
      }
    }
    peerConnectionRef.current = null;

    if (localCallStreamRef.current) {
      localCallStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    localCallStreamRef.current = null;
    remoteCallStreamRef.current = null;
  }, [clearCallDisconnectTimeout, clearIncomingCallTimeout, stopCallTimer, stopRingtone]);

  const cleanupCallSession = useCallback((resetUi = true) => {
    isCleaningUpCallRef.current = true;
    teardownCallResources();
    activeCallPeerIdRef.current = null;
    activeCallMatchIdRef.current = null;
    if (resetUi) {
      resetCallState();
    }
    window.setTimeout(() => {
      isCleaningUpCallRef.current = false;
    }, 0);
  }, [resetCallState, teardownCallResources]);

  const endActiveCall = useCallback((options?: { notifyPeer?: boolean; reason?: string }) => {
    const shouldNotifyPeer = options?.notifyPeer ?? true;
    const peerId = activeCallPeerIdRef.current;
    const matchId = activeCallMatchIdRef.current || undefined;
    const statusAtEnd = callStatusRef.current;
    if (shouldNotifyPeer && peerId && webSocketService) {
      webSocketService.sendCallEnd(peerId, {
        matchId,
        reason: options?.reason,
      });
      if (statusAtEnd === 'active' && options?.reason === 'ended-by-user') {
        sendEndedCallMessage(peerId, matchId, callMode || undefined);
      } else if (statusAtEnd !== 'active') {
        sendMissedCallMessage(peerId, matchId, callMode || undefined);
      }
    }
    cleanupCallSession();
  }, [callMode, cleanupCallSession, sendEndedCallMessage, sendMissedCallMessage, webSocketService]);

  const flushPendingIceCandidates = useCallback(async (peerConnection: RTCPeerConnection) => {
    if (!pendingIceCandidatesRef.current.length) return;

    const queuedCandidates = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];
    for (const candidate of queuedCandidates) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.warn('Failed to add queued ICE candidate:', error);
      }
    }
  }, []);

  const createPeerConnection = useCallback((targetUserId: string, matchId?: string) => {
    const peerConnection = new RTCPeerConnection({
      iceServers: rtcIceServers,
    });

    const markCallAsActive = () => {
      clearCallDisconnectTimeout();
      if (!callStartedAtRef.current) {
        startCallTimer();
      }
      setCallStatus((previous) => (previous === 'active' ? previous : 'active'));
    };

    const scheduleDisconnectCleanup = () => {
      clearCallDisconnectTimeout();
      callDisconnectTimeoutRef.current = setTimeout(() => {
        const unstableConnection =
          peerConnection.connectionState === 'disconnected'
          || peerConnection.iceConnectionState === 'disconnected'
          || peerConnection.connectionState === 'failed'
          || peerConnection.iceConnectionState === 'failed';

        if (!isCleaningUpCallRef.current && unstableConnection) {
          cleanupCallSession();
        }
      }, 10000);
    };

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !webSocketService) return;
      webSocketService.sendCallIceCandidate(targetUserId, {
        matchId,
        candidate: event.candidate.toJSON(),
      });
    };

    peerConnection.ontrack = (event) => {
      const [incomingStream] = event.streams;
      if (incomingStream) {
        remoteCallStreamRef.current = incomingStream;
        setRemoteCallStream(incomingStream);
      } else {
        const fallbackStream = remoteCallStreamRef.current || new MediaStream();
        fallbackStream.addTrack(event.track);
        remoteCallStreamRef.current = fallbackStream;
        setRemoteCallStream(fallbackStream);
      }

      markCallAsActive();
    };

    peerConnection.onconnectionstatechange = () => {
      if (peerConnection.connectionState === 'connected') {
        markCallAsActive();
        return;
      }

      if (peerConnection.connectionState === 'connecting') {
        clearCallDisconnectTimeout();
        return;
      }

      if (
        !isCleaningUpCallRef.current
        && peerConnection.connectionState === 'disconnected'
      ) {
        scheduleDisconnectCleanup();
        return;
      }

      if (
        !isCleaningUpCallRef.current
        && (
          peerConnection.connectionState === 'failed'
          || peerConnection.connectionState === 'closed'
        )
      ) {
        cleanupCallSession();
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      const { iceConnectionState } = peerConnection;
      if (iceConnectionState === 'connected' || iceConnectionState === 'completed') {
        markCallAsActive();
        return;
      }

      if (
        !isCleaningUpCallRef.current
        && iceConnectionState === 'disconnected'
      ) {
        scheduleDisconnectCleanup();
        return;
      }

      if (
        !isCleaningUpCallRef.current
        && (
          iceConnectionState === 'failed'
          || iceConnectionState === 'closed'
        )
      ) {
        cleanupCallSession();
      }
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  }, [cleanupCallSession, clearCallDisconnectTimeout, rtcIceServers, startCallTimer, webSocketService]);

  const getCallUserMedia = useCallback(async (
    mode: CallType,
    facingMode: 'user' | 'environment' = callCameraFacingMode
  ) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia is unavailable in this browser.');
    }

    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: mode === 'video'
        ? {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          }
        : false,
    });
  }, [callCameraFacingMode]);

  const startOutgoingCall = useCallback(async (mode: CallType) => {
    const activeConversation = currentConversationRef.current;
    if (!webSocketService || !activeConversation?.otherUser?.id) return;
    if (callStatusRef.current !== 'idle') return;
    if (!hasPremiumCallAccess) {
      showError('Audio and video calls are available on Premium only.', 'Premium Feature');
      navigate('/premium');
      return;
    }

    const targetUserId = activeConversation.otherUser.id;
    const matchId = activeConversation.id;
    try {
      setShowEmojiPicker(false);
      setShowMediaLibrary(false);
      setCallStatus('dialing');
      setCallMode(mode);
      setIsCallMinimized(false);
      setIncomingCall(null);
      setActiveCallPeerId(targetUserId);
      activeCallPeerIdRef.current = targetUserId;
      setActiveCallMatchId(matchId);
      activeCallMatchIdRef.current = matchId;

      const stream = await getCallUserMedia(mode);
      localCallStreamRef.current = stream;
      setLocalCallStream(stream);
      setIsCallMicMuted(false);
      setIsCallCameraOff(false);

      const peerConnection = createPeerConnection(targetUserId, matchId);
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      webSocketService.sendCallOffer(targetUserId, {
        matchId,
        callType: mode,
        sdp: offer,
      });
      setCallStatus('connecting');
    } catch (error) {
      console.error('Failed to start outgoing call:', error);
      cleanupCallSession();
      showError('Unable to start call. Please check permissions and try again.', 'Call Error');
    }
  }, [cleanupCallSession, createPeerConnection, getCallUserMedia, hasPremiumCallAccess, navigate, showError, webSocketService]);

  const acceptIncomingCall = useCallback(async () => {
    if (!webSocketService) return;

    const offerPayload = pendingIncomingOfferRef.current;
    if (!offerPayload) return;
    if (!hasPremiumCallAccess) {
      webSocketService.sendCallReject(offerPayload.fromUserId, {
        matchId: offerPayload.matchId,
        reason: 'premium-required',
      });
      cleanupCallSession();
      showError('Audio and video calls are available on Premium only.', 'Premium Feature');
      navigate('/premium');
      return;
    }

    try {
      setIncomingCall(null);
      setCallStatus('connecting');
      setCallMode(offerPayload.callType);
      setIsCallMinimized(false);
      setActiveCallPeerId(offerPayload.fromUserId);
      activeCallPeerIdRef.current = offerPayload.fromUserId;
      setActiveCallMatchId(offerPayload.matchId || null);
      activeCallMatchIdRef.current = offerPayload.matchId || null;

      if (offerPayload.matchId) {
        setSelectedChat(offerPayload.matchId);
      }

      const stream = await getCallUserMedia(offerPayload.callType);
      localCallStreamRef.current = stream;
      setLocalCallStream(stream);
      setIsCallMicMuted(false);
      setIsCallCameraOff(false);

      const peerConnection = createPeerConnection(offerPayload.fromUserId, offerPayload.matchId);
      stream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      await peerConnection.setRemoteDescription(new RTCSessionDescription(offerPayload.sdp));
      await flushPendingIceCandidates(peerConnection);

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      webSocketService.sendCallAnswer(offerPayload.fromUserId, {
        matchId: offerPayload.matchId,
        callType: offerPayload.callType,
        sdp: answer,
      });
    } catch (error) {
      const fallbackOffer = pendingIncomingOfferRef.current;
      console.error('Failed to accept call:', error);
      cleanupCallSession();
      if (fallbackOffer?.fromUserId) {
        webSocketService.sendCallReject(fallbackOffer.fromUserId, {
          matchId: fallbackOffer.matchId,
          reason: 'failed',
        });
      }
      showError('Unable to answer this call right now.', 'Call Error');
    }
  }, [cleanupCallSession, createPeerConnection, flushPendingIceCandidates, getCallUserMedia, hasPremiumCallAccess, navigate, showError, webSocketService]);

  const declineIncomingCall = useCallback((reason: 'declined' | 'missed' = 'declined') => {
    const offerPayload = pendingIncomingOfferRef.current;
    if (offerPayload?.fromUserId && webSocketService) {
      webSocketService.sendCallReject(offerPayload.fromUserId, {
        matchId: offerPayload.matchId,
        reason,
      });
      sendMissedCallMessage(offerPayload.fromUserId, offerPayload.matchId, offerPayload.callType);
    }
    cleanupCallSession();
  }, [cleanupCallSession, sendMissedCallMessage, webSocketService]);

  const toggleCallMic = useCallback(() => {
    setIsCallMicMuted((prev) => {
      const next = !prev;
      localCallStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
      return next;
    });
  }, []);

  const toggleCallCamera = useCallback(() => {
    setIsCallCameraOff((prev) => {
      const next = !prev;
      localCallStreamRef.current?.getVideoTracks().forEach((track) => {
        track.enabled = !next;
      });
      return next;
    });
  }, []);

  const cycleCallVideoFilter = useCallback(() => {
    setSelectedVideoFilterId((prev) => {
      const currentIndex = Math.max(
        0,
        CALL_VIDEO_FILTER_PRESETS.findIndex((preset) => preset.id === prev)
      );
      const nextIndex = (currentIndex + 1) % CALL_VIDEO_FILTER_PRESETS.length;
      return CALL_VIDEO_FILTER_PRESETS[nextIndex].id;
    });
  }, []);

  const cycleCallBackground = useCallback(() => {
    setSelectedBackgroundId((prev) => {
      const currentIndex = Math.max(
        0,
        CALL_BACKGROUND_PRESETS.findIndex((preset) => preset.id === prev)
      );
      const nextIndex = (currentIndex + 1) % CALL_BACKGROUND_PRESETS.length;
      return CALL_BACKGROUND_PRESETS[nextIndex].id;
    });
  }, []);

  const switchCallCameraFacing = useCallback(async () => {
    if (callMode !== 'video') return;
    const currentStream = localCallStreamRef.current;
    if (!currentStream || !navigator.mediaDevices?.getUserMedia) return;

    const nextFacingMode = callCameraFacingMode === 'user' ? 'environment' : 'user';
    let exposedCameraCount: number | null = null;
    let exposedCameraLabels: string[] = [];

    try {
      const currentVideoTrack = currentStream.getVideoTracks()[0];
      const currentDeviceId = currentVideoTrack?.getSettings().deviceId;
      const devices = typeof navigator.mediaDevices.enumerateDevices === 'function'
        ? await navigator.mediaDevices.enumerateDevices()
        : [];
      const videoInputs = devices.filter((device) => device.kind === 'videoinput');
      exposedCameraCount = videoInputs.length;
      exposedCameraLabels = videoInputs.map((device) => device.label || '(unlabeled camera)');

      const scoreCameraDevice = (device: MediaDeviceInfo) => {
        const label = device.label.toLowerCase();
        if (nextFacingMode === 'environment') {
          if (label.includes('back') || label.includes('rear') || label.includes('environment')) return 3;
          if (label.includes('front') || label.includes('user') || label.includes('facetime')) return 0;
          return 1;
        }

        if (label.includes('front') || label.includes('user') || label.includes('facetime')) return 3;
        if (label.includes('back') || label.includes('rear') || label.includes('environment')) return 0;
        return 1;
      };

      const preferredAlternateDevice = videoInputs
        .filter((device) => device.deviceId && device.deviceId !== currentDeviceId)
        .sort((a, b) => scoreCameraDevice(b) - scoreCameraDevice(a))[0];

      let replacementStream: MediaStream | null = null;
      const attemptConstraints: MediaStreamConstraints[] = [];

      if (preferredAlternateDevice?.deviceId) {
        attemptConstraints.push({
          audio: false,
          video: {
            deviceId: { exact: preferredAlternateDevice.deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      }

      attemptConstraints.push(
        {
          audio: false,
          video: {
            facingMode: { exact: nextFacingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        {
          audio: false,
          video: {
            facingMode: nextFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        {
          audio: false,
          video: true,
        }
      );

      let lastError: unknown = null;
      for (const constraints of attemptConstraints) {
        try {
          replacementStream = await navigator.mediaDevices.getUserMedia(constraints);
          const track = replacementStream.getVideoTracks()[0];
          const nextDeviceId = track?.getSettings().deviceId;
          if (track && nextDeviceId && currentDeviceId && nextDeviceId === currentDeviceId && videoInputs.length > 1) {
            replacementStream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
            replacementStream = null;
            continue;
          }
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!replacementStream) {
        throw lastError instanceof Error ? lastError : new Error('No replacement stream available.');
      }

      const nextVideoTrack = replacementStream.getVideoTracks()[0];

      if (!nextVideoTrack) {
        replacementStream.getTracks().forEach((track) => track.stop());
        throw new Error('No replacement camera track available.');
      }

      nextVideoTrack.enabled = !isCallCameraOff;

      const audioTracks = currentStream.getAudioTracks();
      const nextStream = new MediaStream([...audioTracks, nextVideoTrack]);

      const videoSender = peerConnectionRef.current
        ?.getSenders()
        .find((sender) => sender.track?.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(nextVideoTrack);
      }

      const previousVideoTracks = currentStream.getVideoTracks();
      previousVideoTracks.forEach((track) => {
        track.stop();
      });

      localCallStreamRef.current = nextStream;
      setLocalCallStream(nextStream);

      if (localCallVideoRef.current) {
        localCallVideoRef.current.srcObject = nextStream;
      }

      setCallCameraFacingMode(nextFacingMode);
    } catch (error) {
      console.error('Failed to switch call camera:', error);
      console.info('Call camera switch diagnostic:', {
        currentFacingMode: callCameraFacingMode,
        nextFacingMode,
        exposedCameraCount,
        exposedCameraLabels,
        error: error instanceof Error ? error.message : String(error),
      });
      const recoveryMessage = exposedCameraCount !== null && exposedCameraCount <= 1
        ? 'Unable to switch camera right now. Try refreshing the page or closing other apps using your camera. Your browser may be limiting camera access.'
        : 'Unable to switch camera right now. Try refreshing the page or closing other apps using your camera.';
      showError(recoveryMessage, 'Camera Switch Unavailable');
    }
  }, [callCameraFacingMode, callMode, isCallCameraOff, showError]);

  const clampMinimizedCallPosition = useCallback((x: number, y: number) => {
    if (typeof window === 'undefined') return { x, y };
    const card = minimizedCallContainerRef.current;
    const width = card?.offsetWidth || 280;
    const height = card?.offsetHeight || 230;
    const margin = 12;
    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const maxY = Math.max(margin, window.innerHeight - height - margin);
    return {
      x: Math.min(Math.max(margin, x), maxX),
      y: Math.min(Math.max(margin, y), maxY),
    };
  }, []);

  const snapMinimizedCallToEdge = useCallback((x: number, y: number) => {
    if (typeof window === 'undefined') return { x, y };
    const card = minimizedCallContainerRef.current;
    const width = card?.offsetWidth || 280;
    const margin = 12;
    const clamped = clampMinimizedCallPosition(x, y);
    const centerX = clamped.x + (width / 2);
    const snapX = centerX < (window.innerWidth / 2)
      ? margin
      : Math.max(margin, window.innerWidth - width - margin);
    return clampMinimizedCallPosition(snapX, clamped.y);
  }, [clampMinimizedCallPosition]);

  const startMinimizedCallDrag = useCallback((clientX: number, clientY: number) => {
    const card = minimizedCallContainerRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    minimizedCallDragStateRef.current = {
      dragging: true,
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
    };
    setIsMinimizedCallDragging(true);
  }, []);

  const updateMinimizedCallDrag = useCallback((clientX: number, clientY: number) => {
    if (!minimizedCallDragStateRef.current.dragging) return;
    const nextX = clientX - minimizedCallDragStateRef.current.offsetX;
    const nextY = clientY - minimizedCallDragStateRef.current.offsetY;
    setMinimizedCallPosition(clampMinimizedCallPosition(nextX, nextY));
  }, [clampMinimizedCallPosition]);

  const stopMinimizedCallDrag = useCallback(() => {
    if (!minimizedCallDragStateRef.current.dragging) {
      setIsMinimizedCallDragging(false);
      return;
    }
    minimizedCallDragStateRef.current.dragging = false;
    setIsMinimizedCallDragging(false);
    setMinimizedCallPosition((previous) => {
      if (!previous) return previous;
      return snapMinimizedCallToEdge(previous.x, previous.y);
    });
  }, [snapMinimizedCallToEdge]);

  useEffect(() => {
    if (!isCallMinimized || typeof window === 'undefined') return;

    setMinimizedCallPosition((previous) => {
      if (previous) {
        return clampMinimizedCallPosition(previous.x, previous.y);
      }
      const card = minimizedCallContainerRef.current;
      const width = card?.offsetWidth || 280;
      const height = card?.offsetHeight || 230;
      return clampMinimizedCallPosition(
        window.innerWidth - width - 16,
        window.innerHeight - height - 16
      );
    });

    const handleResize = () => {
      setMinimizedCallPosition((previous) => {
        if (!previous) return previous;
        return clampMinimizedCallPosition(previous.x, previous.y);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [clampMinimizedCallPosition, isCallMinimized]);

  useEffect(() => {
    if (!isCallMinimized) return;

    const onMouseMove = (event: MouseEvent) => {
      updateMinimizedCallDrag(event.clientX, event.clientY);
    };
    const onMouseUp = () => {
      stopMinimizedCallDrag();
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!minimizedCallDragStateRef.current.dragging) return;
      const touch = event.touches[0];
      if (!touch) return;
      event.preventDefault();
      updateMinimizedCallDrag(touch.clientX, touch.clientY);
    };
    const onTouchEnd = () => {
      stopMinimizedCallDrag();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isCallMinimized, stopMinimizedCallDrag, updateMinimizedCallDrag]);

  const clampLocalPreviewPosition = useCallback((x: number, y: number) => {
    if (typeof window === 'undefined') return { x, y };
    const card = localPreviewContainerRef.current;
    const width = card?.offsetWidth || 128;
    const height = card?.offsetHeight || 176;
    const margin = 14;
    const maxX = Math.max(margin, window.innerWidth - width - margin);
    const reservedBottomSpace = isCompactCallViewport ? 192 : 218;
    const maxY = Math.max(margin, window.innerHeight - height - reservedBottomSpace);
    return {
      x: Math.min(Math.max(margin, x), maxX),
      y: Math.min(Math.max(margin, y), maxY),
    };
  }, [isCompactCallViewport]);

  const startLocalPreviewDrag = useCallback((clientX: number, clientY: number) => {
    const card = localPreviewContainerRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    localPreviewDragStateRef.current = {
      dragging: true,
      offsetX: clientX - rect.left,
      offsetY: clientY - rect.top,
    };
    setIsLocalPreviewDragging(true);
  }, []);

  const updateLocalPreviewDrag = useCallback((clientX: number, clientY: number) => {
    if (!localPreviewDragStateRef.current.dragging) return;
    const nextX = clientX - localPreviewDragStateRef.current.offsetX;
    const nextY = clientY - localPreviewDragStateRef.current.offsetY;
    setLocalPreviewPosition(clampLocalPreviewPosition(nextX, nextY));
  }, [clampLocalPreviewPosition]);

  const stopLocalPreviewDrag = useCallback(() => {
    localPreviewDragStateRef.current.dragging = false;
    setIsLocalPreviewDragging(false);
  }, []);

  useEffect(() => {
    if (callStatus === 'idle' || callMode !== 'video' || isDesktopLayout) return;

    setLocalPreviewPosition((previous) => {
      if (previous) {
        return clampLocalPreviewPosition(previous.x, previous.y);
      }
      const card = localPreviewContainerRef.current;
      const width = card?.offsetWidth || 128;
      const height = card?.offsetHeight || 176;
      return clampLocalPreviewPosition(
        window.innerWidth - width - 16,
        window.innerHeight - height - (isCompactCallViewport ? 208 : 236)
      );
    });

    const handleResize = () => {
      setLocalPreviewPosition((previous) => {
        if (!previous) return previous;
        return clampLocalPreviewPosition(previous.x, previous.y);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [callMode, callStatus, clampLocalPreviewPosition, isCompactCallViewport, isDesktopLayout]);

  useEffect(() => {
    if (callStatus === 'idle' || isDesktopLayout) return;

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      updateLocalPreviewDrag(event.clientX, event.clientY);
    };
    const onPointerUp = () => {
      stopLocalPreviewDrag();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    const onTouchMove = (event: TouchEvent) => {
      if (!localPreviewDragStateRef.current.dragging) return;
      const touch = event.touches[0];
      if (!touch) return;
      event.preventDefault();
      updateLocalPreviewDrag(touch.clientX, touch.clientY);
    };
    const onTouchEnd = () => {
      stopLocalPreviewDrag();
    };
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [callStatus, isDesktopLayout, stopLocalPreviewDrag, updateLocalPreviewDrag]);

  useEffect(() => {
    if (callStatus === 'idle') {
      setCallQualityLabel('Excellent');
      return;
    }

    const updateQuality = () => {
      if (!navigator.onLine) {
        setCallQualityLabel('Offline');
        return;
      }

      const connection = (navigator as Navigator & {
        connection?: {
          effectiveType?: string;
          downlink?: number;
          rtt?: number;
          addEventListener?: (type: 'change', listener: () => void) => void;
          removeEventListener?: (type: 'change', listener: () => void) => void;
        };
      }).connection;

      const effectiveType = connection?.effectiveType;
      const downlink = typeof connection?.downlink === 'number' ? connection.downlink : 10;
      const rtt = typeof connection?.rtt === 'number' ? connection.rtt : 80;
      const iceState = peerConnectionRef.current?.iceConnectionState;

      if (
        iceState === 'failed'
        || iceState === 'disconnected'
        || effectiveType === 'slow-2g'
        || effectiveType === '2g'
        || downlink < 1.2
        || rtt > 450
      ) {
        setCallQualityLabel('Weak');
        return;
      }

      if (
        iceState === 'checking'
        || effectiveType === '3g'
        || downlink < 3
        || rtt > 220
      ) {
        setCallQualityLabel('Good');
        return;
      }

      setCallQualityLabel('Excellent');
    };

    updateQuality();
    const intervalId = window.setInterval(updateQuality, 5000);
    const connection = (navigator as Navigator & {
      connection?: {
        addEventListener?: (type: 'change', listener: () => void) => void;
        removeEventListener?: (type: 'change', listener: () => void) => void;
      };
    }).connection;

    connection?.addEventListener?.('change', updateQuality);
    window.addEventListener('online', updateQuality);
    window.addEventListener('offline', updateQuality);

    return () => {
      window.clearInterval(intervalId);
      connection?.removeEventListener?.('change', updateQuality);
      window.removeEventListener('online', updateQuality);
      window.removeEventListener('offline', updateQuality);
    };
  }, [callStatus, remoteCallStream]);

  useEffect(() => {
    if (!webSocketService || !activeCallPeerId || (callStatus !== 'connecting' && callStatus !== 'active')) {
      return;
    }

    webSocketService.sendCallState(activeCallPeerId, {
      matchId: activeCallMatchId || undefined,
      micMuted: isCallMicMuted,
      cameraOff: isCallCameraOff,
    });
  }, [
    activeCallMatchId,
    activeCallPeerId,
    callStatus,
    isCallCameraOff,
    isCallMicMuted,
    webSocketService,
  ]);

  useEffect(() => {
    if (callStatus === 'ringing') {
      startRingtone('incoming');
      return;
    }
    if (callStatus === 'dialing' || callStatus === 'connecting') {
      startRingtone('outgoing');
      return;
    }
    stopRingtone();
  }, [callStatus, startRingtone, stopRingtone]);

  useEffect(() => {
    clearIncomingCallTimeout();
    if (callStatus !== 'ringing' || !incomingCall) return;

    incomingCallTimeoutRef.current = setTimeout(() => {
      declineIncomingCall('missed');
    }, 30000);

    return () => {
      clearIncomingCallTimeout();
    };
  }, [callStatus, clearIncomingCallTimeout, declineIncomingCall, incomingCall]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const onChange = (event: MediaQueryListEvent) => {
      setIsDesktopLayout(event.matches);
    };

    setIsDesktopLayout(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onChange);
      return () => mediaQuery.removeEventListener('change', onChange);
    }

    mediaQuery.addListener(onChange);
    return () => mediaQuery.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateCompactViewport = () => {
      setIsCompactCallViewport(window.innerWidth <= 380 || window.innerHeight <= 740);
    };

    updateCompactViewport();
    window.addEventListener('resize', updateCompactViewport);
    return () => {
      window.removeEventListener('resize', updateCompactViewport);
    };
  }, []);

  useEffect(() => {
    if (isDesktopLayout && showSidePanel) {
      setShowSidePanel(false);
    }
  }, [isDesktopLayout, showSidePanel]);

  useEffect(() => {
    if (!viewerMessage) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setViewerMessage(null);
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [viewerMessage]);

  useEffect(() => {
    if (!showMediaLibrary) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMediaLibrary(false);
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showMediaLibrary]);

  useEffect(() => {
    if (!showMediaLibrary) return;

    if (!mediaLibraryProvider) {
      setMediaLibraryItems([]);
      setMediaLibraryError('Add VITE_TENOR_API_KEY or VITE_GIPHY_API_KEY in frontend/.env.');
      return;
    }

    const query = mediaLibraryQuery.trim();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setMediaLibraryLoading(true);
      setMediaLibraryError(null);
      try {
        let requestUrl = '';
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

        const params = new URLSearchParams({
          provider: mediaLibraryProvider,
          tab: mediaLibraryTab,
          limit: '28',
        });
        if (query) {
          params.set('q', query);
        }
        // Optional client fallback keys if backend env keys are not configured yet.
        if (mediaLibraryProvider === 'giphy' && giphyApiKey) {
          params.set('apiKey', giphyApiKey);
        }
        if (mediaLibraryProvider === 'tenor' && tenorApiKey) {
          params.set('apiKey', tenorApiKey);
          params.set('clientKey', tenorClientKey);
        }
        requestUrl = `${apiBaseUrl}/api/messages/media/library?${params.toString()}`;

        const response = await fetch(requestUrl, {
          signal: controller.signal,
          credentials: 'include',
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        if (!response.ok) {
          throw new Error(`Media request failed with ${response.status}`);
        }
        const payload = await response.json();

        let items: MediaLibraryItem[] = [];
        if (mediaLibraryProvider === 'tenor') {
          const results = Array.isArray(payload?.results) ? payload.results : [];
          items = results
            .map((entry: any): MediaLibraryItem | null => {
              const formats = entry?.media_formats || {};
              const gif = formats.gif || formats.mediumgif || formats.tinygif;
              const webp = formats.webp || formats.tinywebp;
              const tinyGif = formats.tinygif || formats.nanogif;

              const previewUrl = webp?.url || tinyGif?.url || gif?.preview || gif?.url;
              const mediaUrl = gif?.url || webp?.url || tinyGif?.url;
              if (!previewUrl || !mediaUrl) return null;

              return {
                id: String(entry?.id || mediaUrl),
                previewUrl,
                mediaUrl,
                title: entry?.content_description || entry?.title || (mediaLibraryTab === 'gif' ? 'GIF' : 'Sticker'),
                mimeType: mediaUrl.includes('.webp') ? 'image/webp' : 'image/gif',
              };
            })
            .filter(isMediaLibraryItem);
        } else {
          const results = Array.isArray(payload?.data) ? payload.data : [];
          items = results
            .map((entry: any): MediaLibraryItem | null => {
              const images = entry?.images || {};
              const previewUrl = images?.fixed_width?.webp
                || images?.fixed_width?.url
                || images?.downsized_still?.url
                || images?.original_still?.url;
              const mediaUrl = images?.original?.url
                || images?.downsized_large?.url
                || images?.downsized?.url
                || previewUrl;
              if (!previewUrl || !mediaUrl) return null;

              return {
                id: String(entry?.id || mediaUrl),
                previewUrl,
                mediaUrl,
                title: entry?.title || (mediaLibraryTab === 'gif' ? 'GIF' : 'Sticker'),
                mimeType: mediaUrl.includes('.webp') ? 'image/webp' : 'image/gif',
              };
            })
            .filter(isMediaLibraryItem);
        }

        setMediaLibraryItems(items);
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        console.error('Failed to load media library:', error);
        setMediaLibraryItems([]);
        setMediaLibraryError('Could not load GIFs/stickers right now. Try another search.');
      } finally {
        setMediaLibraryLoading(false);
      }
    }, query ? 250 : 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    showMediaLibrary,
    mediaLibraryProvider,
    mediaLibraryQuery,
    mediaLibraryTab,
    accessToken,
    tenorApiKey,
    tenorClientKey,
    giphyApiKey,
  ]);

  // Use a local state for messages to allow real-time updates without immediate refetch
  const [localMessagesData, setLocalMessagesData] = useState<ConversationMessagesResponse | null>(null);
  const lastReadMatchId = useRef<string | null>(null);

  // Fetch messages for selected conversation, and update local state
  const effectiveMatchId = selectedChat && selectedChat !== profileIdParam ? selectedChat : '';
  const {
    data: fetchedMessages,
    loading: conversationLoading,
  } = useConversationMessages(
    effectiveMatchId, profileIdParam || ''
  ) as { data: ConversationMessagesResponse | null, loading: boolean };

  // Sync fetched messages with local state
  useEffect(() => {
    setLocalMessagesData(fetchedMessages);
    if (fetchedMessages?.match?.id && lastReadMatchId.current !== fetchedMessages.match.id) {
      lastReadMatchId.current = fetchedMessages.match.id;
    }
  }, [fetchedMessages]);

  // Fetch raw conversations data from backend
  const {
    data: rawConversations, loading, loadingMore, error, hasMore, refetch, loadMore
  } = useConversations() as {
    data: ConversationSummary[] | null;
    loading: boolean;
    loadingMore: boolean;
    error: any;
    hasMore: boolean;
    refetch: () => void;
    loadMore: () => void;
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const container = messagesListRef.current;
    if (container) {
      if (behavior === 'smooth') {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      } else {
        container.scrollTop = container.scrollHeight;
      }
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const scheduleScrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    let raf1 = 0;
    let raf2 = 0;
    let timeout1: ReturnType<typeof setTimeout> | null = null;
    let timeout2: ReturnType<typeof setTimeout> | null = null;

    scrollToBottom(behavior);
    raf1 = requestAnimationFrame(() => {
      scrollToBottom(behavior);
      raf2 = requestAnimationFrame(() => {
        scrollToBottom(behavior);
      });
    });
    timeout1 = setTimeout(() => {
      scrollToBottom(behavior);
    }, 80);
    timeout2 = setTimeout(() => {
      scrollToBottom(behavior);
    }, 220);

    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      if (timeout1) clearTimeout(timeout1);
      if (timeout2) clearTimeout(timeout2);
    };
  }, [scrollToBottom]);

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopRecordingStream = () => {
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }
  };

  const uploadPendingAttachment = async (file: File) => {
    if (!accessToken) {
      showError('Please sign in again before sending attachments.', 'Authentication Error');
      return;
    }

    if (!webSocketService?.connected) {
      showError('Chat is offline. Reconnect and try again.', 'Connection Error');
      return;
    }

    try {
      setIsUploadingAttachment(true);
      const formData = new FormData();
      formData.append('file', file);
      const uploadResponse = await apiClient.Message.uploadAttachment(formData);
      setPendingAttachment({
        attachment: uploadResponse.attachment,
        type: uploadResponse.type,
      });
    } catch (error) {
      console.error('Failed to upload attachment:', error);
      showError('Unable to upload attachment.', 'Upload Error');
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  useEffect(() => {
    return () => {
      stopRecordingTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.onstop = null;
          mediaRecorderRef.current.stop();
        } catch {
          // noop
        }
      }
      mediaRecorderRef.current = null;
      stopRecordingStream();
    };
  }, []);

  const realConversations: ConversationSummary[] = Array.isArray(rawConversations) ? rawConversations : [];

  const dedupedConversations = useMemo(() => {
    const map = new Map<string, ConversationSummary>();
    for (const conv of realConversations) {
      const otherId = conv.otherUser?.id;
      const key = otherId ? String(otherId) : String(conv.id);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, conv);
        continue;
      }
      const existingTime = existing.lastMessage?.createdAt
        ? new Date(existing.lastMessage.createdAt).getTime()
        : 0;
      const nextTime = conv.lastMessage?.createdAt
        ? new Date(conv.lastMessage.createdAt).getTime()
        : 0;
      map.set(key, nextTime >= existingTime ? conv : existing);
    }
    return Array.from(map.values());
  }, [realConversations]);

  const [localConversations, setLocalConversations] = useState<ConversationSummary[]>([]);

  useEffect(() => {
    setLocalConversations((prev) => {
      if (prev.length === dedupedConversations.length) {
        let same = true;
        for (let i = 0; i < prev.length; i += 1) {
          const a = prev[i];
          const b = dedupedConversations[i];
          if (
            a.id !== b.id ||
            a.updatedAt !== b.updatedAt ||
            (a.lastMessage?.content || '') !== (b.lastMessage?.content || '') ||
            Boolean(a.chatLocked) !== Boolean(b.chatLocked) ||
            (a.chatAccessMessage || '') !== (b.chatAccessMessage || '')
          ) {
            same = false;
            break;
          }
        }
        if (same) return prev;
      }
      return dedupedConversations;
    });
  }, [dedupedConversations]);

  const currentConversation: ConversationSummary | null = useMemo(() => {
    const found = localConversations.find(conv => conv.id === selectedChat);
    if (found) return found;

    // Handle virtual conversation case (new chat from profileIdParam)
    if (profileIdParam && profileNameParam && selectedChat === profileIdParam) {
      return {
        id: profileIdParam,
        otherUser: {
          id: profileIdParam,
          name: profileNameParam,
          profilePhoto1: '/default-avatar.png'
        },
        lastMessage: null,
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
      } as ConversationSummary;
    }

    return null;
  }, [selectedChat, localConversations, profileIdParam, profileNameParam]);

  useEffect(() => {
    currentConversationRef.current = currentConversation;
  }, [currentConversation]);

  const isCurrentConversationLocked = useMemo(() => {
    if (!currentConversation) return false;
    const fetchedLockState =
      localMessagesData?.match?.id === currentConversation.id
        ? Boolean(localMessagesData?.match?.chatLocked)
        : false;
    return Boolean(currentConversation.chatLocked) || fetchedLockState;
  }, [currentConversation, localMessagesData?.match?.chatLocked, localMessagesData?.match?.id]);

  const currentConversationLockMessage = useMemo(() => {
    if (!currentConversation) return '';
    const fetchedLockMessage =
      localMessagesData?.match?.id === currentConversation.id
        ? localMessagesData?.match?.chatAccessMessage
        : null;
    return (
      currentConversation.chatAccessMessage ||
      fetchedLockMessage ||
      'Free plan allows 1 active chat at a time. Upgrade to premium or unmatch your current active chat to unlock another conversation.'
    );
  }, [currentConversation, localMessagesData?.match?.chatAccessMessage, localMessagesData?.match?.id]);

  useEffect(() => {
    setReplyingTo(null);
    setActiveReactionMessageId(null);
  }, [selectedChat]);

  // 1. Join/Leave WebSocket Room
  useEffect(() => {
    if (webSocketService && effectiveMatchId) {
      webSocketService.joinMatch(effectiveMatchId);

      return () => {
        webSocketService.leaveMatch(effectiveMatchId);
      };
    }
  }, [effectiveMatchId, webSocketService]);

  // 2. Real-time Message Listener (with optimistic message replacement logic)
  const handleNewMessage = useCallback((message: Message) => {
    const matchId = message.matchId;

    // TRACE: instrument newMessage receipt on client
    console.log('[TRACE][RECIPIENT] handleNewMessage received', {
      messageId: message.id,
      clientTempId: message.clientTempId,
      matchId,
      senderId: message.senderId,
      receiverId: message.receiverId,
      contentLength: message.content?.length ?? 0,
      currentActiveMatchId: lastReadMatchId.current,
      isForCurrentConversation: matchId === lastReadMatchId.current,
    });

    // If the message is for a conversation the user isn't currently viewing,
    // drop the stale cache so the next open triggers a fresh Firestore fetch.
    if (matchId !== lastReadMatchId.current) {
      invalidateConversationMessagesCache(matchId);
    }

    setLocalMessagesData(prev => {
      if (!prev) return null;

      // Only proceed if the message belongs to the current chat
      if (prev.match.id === matchId) {
        const tempIndex = message.clientTempId
          ? prev.messages.findIndex((m) => m.id === message.clientTempId)
          : prev.messages.findIndex((m) =>
              m.content === message.content &&
              m.senderId === message.senderId &&
              m.id.startsWith('temp-')
            );

        let newMessages = [...prev.messages];

        if (tempIndex !== -1) {
          // Replace the optimistic (temporary) message with the real message
          console.log('[TRACE][RECIPIENT] handleNewMessage: replaced optimistic temp message', { tempIndex, messageId: message.id, clientTempId: message.clientTempId });
          newMessages[tempIndex] = message;
        } else if (!newMessages.some(m => m.id === message.id)) {
          // Add the real message only if it's not already in the list
          console.log('[TRACE][RECIPIENT] handleNewMessage: appended new message to state', { messageId: message.id });
          newMessages = [...newMessages, message];
        } else {
          // Message already exists
          console.log('[TRACE][RECIPIENT] handleNewMessage: message already exists in state, skipping', { messageId: message.id });
          return prev;
        }

        return {
          ...prev,
          messages: newMessages,
        };
      }

      // If this message is for a new chat (virtual match) that just became real...
      console.log('[TRACE][RECIPIENT] handleNewMessage: message is NOT for current conversation', { messageMatchId: matchId, currentMatchId: prev?.match?.id });
      if (
        matchId &&
        !localConversations.find(conv => conv.id === matchId) &&
        lastRefetchedMatchId.current !== matchId
      ) {
        refetch(); // Refetch conversation list to include the new match
        lastRefetchedMatchId.current = matchId;
      }

      return prev;
    });

    setLocalConversations(prev => {
      const updated = prev.map(conv => {
        if (conv.id !== matchId) return conv;
        return {
          ...conv,
          lastMessage: {
            content: getMessagePreviewText(message.content, message.attachment, message.type),
            createdAt: message.createdAt,
            type: message.type,
            attachment: message.attachment || null,
          },
          unreadCount:
            message.senderId !== currentUserId
              ? (conv.unreadCount || 0) + 1
              : conv.unreadCount,
          updatedAt: message.createdAt,
        };
      });
      return updated.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });

    scheduleScrollToBottom('auto');
  }, [localConversations, refetch, selectedChat, currentUserId]);

  const applyMessageReactionsUpdate = useCallback(
    (messageId: string, reactions: Message['reactions'], matchId?: string) => {
      setLocalMessagesData((prev) => {
        if (!prev?.messages?.length) return prev;
        if (matchId && prev.match?.id && prev.match.id !== matchId) return prev;

        let changed = false;
        const nextMessages = prev.messages.map((msg) => {
          if (msg.id !== messageId) return msg;
          changed = true;
          return {
            ...msg,
            reactions: Array.isArray(reactions) ? reactions : [],
          };
        });

        if (!changed) return prev;
        return {
          ...prev,
          messages: nextMessages,
        };
      });
    },
    []
  );

  const toggleMessageReaction = useCallback(
    (message: Message, emoji: string) => {
      if (!currentUserId || !webSocketService || !currentConversation?.id) return;
      if (!emoji.trim()) return;

      const currentReactions = Array.isArray(message.reactions) ? message.reactions : [];
      const nextReactions = [...currentReactions];
      const existingIndex = nextReactions.findIndex((reaction) => reaction.userId === currentUserId);
      const nowIso = new Date().toISOString();

      if (existingIndex === -1) {
        nextReactions.push({ userId: currentUserId, emoji, createdAt: nowIso });
      } else if (nextReactions[existingIndex].emoji === emoji) {
        nextReactions.splice(existingIndex, 1);
      } else {
        nextReactions[existingIndex] = { userId: currentUserId, emoji, createdAt: nowIso };
      }

      applyMessageReactionsUpdate(message.id, nextReactions, currentConversation.id);
      webSocketService.sendMessageReaction(message.id, {
        matchId: currentConversation.id,
        emoji,
      });
      setActiveReactionMessageId(null);
    },
    [applyMessageReactionsUpdate, currentConversation?.id, currentUserId, webSocketService]
  );


  useEffect(() => {
    if (webSocketService) {
      webSocketService.onNewMessage(handleNewMessage);
      // Remove listener on cleanup
      return () => {
        webSocketService.off('newMessage', handleNewMessage);
      };
    }
  }, [webSocketService, handleNewMessage]);

  useEffect(() => {
    if (!webSocketService) return;
    const handleSocketError = (payload: unknown) => {
      const message = typeof payload === 'string' ? payload : (payload as any)?.message;
      showError(typeof message === 'string' && message ? message : 'Message failed to send.', 'Send Failed');
    };
    webSocketService.onError(handleSocketError);
    return () => {
      webSocketService.off('error', handleSocketError);
      webSocketService.off('connect_error', handleSocketError);
    };
  }, [webSocketService, showError]);

  useEffect(() => {
    if (!webSocketService) return;

    const handleMessageReaction = (payload: MessageReactionUpdatePayload) => {
      if (!payload?.messageId) return;
      applyMessageReactionsUpdate(payload.messageId, payload.reactions, payload.matchId);
    };

    webSocketService.onMessageReaction(handleMessageReaction);
    return () => {
      webSocketService.off('message:reaction', handleMessageReaction);
    };
  }, [applyMessageReactionsUpdate, webSocketService]);

  useEffect(() => {
    if (!webSocketService) return;
    const handleTyping = (payload: { userId: string; isTyping: boolean }) => {
      setTypingStatus(prev => ({
        ...prev,
        [payload.userId]: payload.isTyping
      }));
    };
    webSocketService.onTyping(handleTyping);
    return () => {
      webSocketService.off('userTyping', handleTyping);
    };
  }, [webSocketService]);

  useEffect(() => {
    if (!webSocketService) return;

    const handlePresence = (payload: UserPresencePayload) => {
      if (!payload?.userId) return;
      setPresenceByUserId((prev) => ({
        ...prev,
        [payload.userId]: {
          userId: payload.userId,
          isOnline: Boolean(payload.isOnline),
          lastSeenAt: payload.lastSeenAt,
        },
      }));
    };

    webSocketService.onUserPresence(handlePresence);
    return () => {
      webSocketService.off('user:presence', handlePresence);
    };
  }, [webSocketService]);

  useEffect(() => {
    if (!webSocketService) return;

    const userIds = Array.from(
      new Set(
        localConversations
          .map((conversation) => conversation.otherUser?.id)
          .filter((value): value is string => Boolean(value))
      )
    );

    const selectedOtherUserId = currentConversation?.otherUser?.id;
    if (selectedOtherUserId && !userIds.includes(selectedOtherUserId)) {
      userIds.push(selectedOtherUserId);
    }

    if (!userIds.length) return;

    let cancelled = false;
    void webSocketService.requestPresence(userIds).then((presenceList) => {
      if (cancelled || !Array.isArray(presenceList)) return;
      setPresenceByUserId((prev) => {
        const next = { ...prev };
        presenceList.forEach((entry) => {
          if (!entry?.userId) return;
          next[entry.userId] = {
            userId: entry.userId,
            isOnline: Boolean(entry.isOnline),
            lastSeenAt: entry.lastSeenAt,
          };
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [currentConversation?.otherUser?.id, localConversations, webSocketService]);

  useEffect(() => {
    if (!webSocketService) return;

    const handleCallOffer = (payload: CallOfferPayload) => {
      if (!payload?.fromUserId || payload.fromUserId === currentUserId) return;

      if (!hasPremiumCallAccess) {
        webSocketService.sendCallReject(payload.fromUserId, {
          matchId: payload.matchId,
          reason: 'premium-required',
        });
        showError('Incoming calls require Premium.', 'Premium Feature');
        return;
      }

      const busy =
        callStatusRef.current !== 'idle'
        || Boolean(activeCallPeerIdRef.current)
        || Boolean(peerConnectionRef.current);
      if (busy) {
        webSocketService.sendCallReject(payload.fromUserId, {
          matchId: payload.matchId,
          reason: 'busy',
        });
        return;
      }

      pendingIncomingOfferRef.current = payload;
      pendingIceCandidatesRef.current = [];
      setIncomingCall({
        fromUserId: payload.fromUserId,
        matchId: payload.matchId,
        callType: payload.callType,
      });
      setCallMode(payload.callType);
      setIsCallMinimized(false);
      setActiveCallPeerId(payload.fromUserId);
      activeCallPeerIdRef.current = payload.fromUserId;
      setActiveCallMatchId(payload.matchId || null);
      activeCallMatchIdRef.current = payload.matchId || null;
      setCallStatus('ringing');
    };

    const handleCallAnswer = async (payload: CallAnswerPayload) => {
      if (!payload?.fromUserId) return;
      if (payload.fromUserId !== activeCallPeerIdRef.current) return;

      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) return;

      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushPendingIceCandidates(peerConnection);
        setCallMode(payload.callType);
        setCallStatus((previous) => (previous === 'active' ? previous : 'connecting'));
      } catch (error) {
        console.error('Failed to apply call answer:', error);
        cleanupCallSession();
      }
    };

    const handleCallIceCandidate = async (payload: CallIceCandidatePayload) => {
      if (!payload?.fromUserId || !payload.candidate) return;
      if (payload.fromUserId !== activeCallPeerIdRef.current) return;

      const peerConnection = peerConnectionRef.current;
      if (!peerConnection || !peerConnection.remoteDescription) {
        pendingIceCandidatesRef.current.push(payload.candidate);
        return;
      }

      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (error) {
        console.warn('Failed to add ICE candidate:', error);
      }
    };

    const handleCallReject = (payload: CallRejectPayload) => {
      if (!payload?.fromUserId) return;
      if (payload.fromUserId !== activeCallPeerIdRef.current) return;

      if (payload.reason === 'busy') {
        showError('User is currently busy on another call.', 'Call Busy');
      } else if (payload.reason === 'offline') {
        const matchId = payload.matchId || activeCallMatchIdRef.current || undefined;
        sendMissedCallMessage(payload.fromUserId, matchId, callMode || undefined);
        showError('User is offline. Missed call notification sent.', 'User Offline');
      } else if (payload.reason === 'missed') {
        showError('Call was not answered.', 'Missed Call');
      } else if (payload.reason === 'premium-required') {
        showError('Calls are available for Premium members only.', 'Premium Feature');
      } else if (payload.reason !== 'ended-by-user') {
        showError('Call was declined.', 'Call Declined');
      }
      cleanupCallSession();
    };

    const handleCallEnd = (payload: CallEndPayload) => {
      if (!payload?.fromUserId) return;
      if (payload.fromUserId !== activeCallPeerIdRef.current) return;
      cleanupCallSession();
    };

    const handleCallState = (payload: CallStatePayload) => {
      if (!payload?.fromUserId) return;
      if (payload.fromUserId !== activeCallPeerIdRef.current) return;

      if (typeof payload.micMuted === 'boolean') {
        setIsRemoteCallMicMuted(payload.micMuted);
      }

      if (typeof payload.cameraOff === 'boolean') {
        setIsRemoteCallCameraOff(payload.cameraOff);
      }
    };

    webSocketService.onCallOffer(handleCallOffer);
    webSocketService.onCallAnswer(handleCallAnswer);
    webSocketService.onCallIceCandidate(handleCallIceCandidate);
    webSocketService.onCallReject(handleCallReject);
    webSocketService.onCallEnd(handleCallEnd);
    webSocketService.onCallState(handleCallState);

    return () => {
      webSocketService.off('call:offer', handleCallOffer);
      webSocketService.off('call:answer', handleCallAnswer);
      webSocketService.off('call:ice-candidate', handleCallIceCandidate);
      webSocketService.off('call:reject', handleCallReject);
      webSocketService.off('call:end', handleCallEnd);
      webSocketService.off('call:state', handleCallState);
    };
  }, [callMode, cleanupCallSession, currentUserId, flushPendingIceCandidates, hasPremiumCallAccess, sendMissedCallMessage, showError, webSocketService]);

  useEffect(() => {
    return () => {
      teardownCallResources();
    };
  }, [teardownCallResources]);

  useEffect(() => {
    if (!webSocketService && callStatusRef.current !== 'idle') {
      cleanupCallSession();
    }
  }, [cleanupCallSession, webSocketService]);

  // Scroll to bottom when opening/switching a conversation and once messages finish loading.
  useEffect(() => {
    if (!selectedChat) return;
    if (conversationLoading) return;
    if (!localMessagesData) return;
    if (effectiveMatchId && localMessagesData.match?.id && localMessagesData.match.id !== effectiveMatchId) return;

    const cleanupScroll = scheduleScrollToBottom('auto');
    const container = messagesListRef.current;
    if (!container) return cleanupScroll;

    const cleanupMediaListeners: Array<() => void> = [];
    const mediaNodes = Array.from(container.querySelectorAll('img,video'));

    mediaNodes.forEach((node) => {
      if (node instanceof HTMLImageElement) {
        if (node.complete) return;
        const onImageReady = () => scheduleScrollToBottom('auto');
        node.addEventListener('load', onImageReady);
        node.addEventListener('error', onImageReady);
        cleanupMediaListeners.push(() => {
          node.removeEventListener('load', onImageReady);
          node.removeEventListener('error', onImageReady);
        });
        return;
      }

      if (node instanceof HTMLVideoElement) {
        if (node.readyState >= 1) return;
        const onVideoReady = () => scheduleScrollToBottom('auto');
        node.addEventListener('loadedmetadata', onVideoReady);
        node.addEventListener('error', onVideoReady);
        cleanupMediaListeners.push(() => {
          node.removeEventListener('loadedmetadata', onVideoReady);
          node.removeEventListener('error', onVideoReady);
        });
      }
    });

    return () => {
      cleanupScroll();
      cleanupMediaListeners.forEach((cleanup) => cleanup());
    };
  }, [
    selectedChat,
    effectiveMatchId,
    conversationLoading,
    localMessagesData?.match?.id,
    localMessagesData?.messages.length,
    scheduleScrollToBottom
  ]);

  useLayoutEffect(() => {
    if (!selectedChat) return;
    if (conversationLoading) return;
    if (!localMessagesData) return;
    if (effectiveMatchId && localMessagesData.match?.id && localMessagesData.match.id !== effectiveMatchId) return;

    const container = messagesListRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [
    selectedChat,
    effectiveMatchId,
    conversationLoading,
    localMessagesData?.match?.id,
    localMessagesData?.messages.length
  ]);

  const sendOutgoingMessage = async ({
    messageContent,
    attachment,
    messageType,
    replyToMessage,
  }: {
    messageContent: string;
    attachment?: MessageAttachment | null;
    messageType?: MessageType;
    replyToMessage?: Message | null;
  }): Promise<boolean> => {
    // TRACE: instrument sendOutgoingMessage entry
    console.log('[TRACE][CLIENT] sendOutgoingMessage entered', {
      hasCurrentConversation: Boolean(currentConversation),
      conversationId: currentConversation?.id,
      hasWebSocketService: Boolean(webSocketService),
      wsConnected: webSocketService?.isConnected(),
      currentUserId,
      contentLength: messageContent?.trim().length ?? 0,
      hasAttachment: Boolean(attachment),
      isCurrentConversationLocked,
      isVirtualConversation: Boolean(profileIdParam && currentConversation?.id === profileIdParam),
    });

    if (!currentConversation || !webSocketService || !currentUserId) {
      console.warn('[TRACE][CLIENT] sendOutgoingMessage: early exit – missing currentConversation/webSocketService/currentUserId');
      return false;
    }

    if (!messageContent.trim() && !attachment) {
      console.warn('[TRACE][CLIENT] sendOutgoingMessage: early exit – no content and no attachment');
      return false;
    }

    if (isCurrentConversationLocked) {
      console.warn('[TRACE][CLIENT] sendOutgoingMessage: early exit – chat locked');
      showError(currentConversationLockMessage, 'Chat Locked');
      return false;
    }

    if (profileIdParam && currentConversation.id === profileIdParam) {
      console.warn('[TRACE][CLIENT] sendOutgoingMessage: early exit – virtual/unmatched conversation');
      showError(
        'You can only send messages after both users have matched.',
        'Not Matched Yet'
      );
      return false;
    }

    const actualMatchId = currentConversation.id;
    const clientTempId = `temp-${Date.now()}-${Math.random()}`;
    const normalizedContent = messageContent.trim();
    const resolvedType: Message['type'] = messageType
      || (attachment?.mimeType.startsWith('image/')
        ? 'IMAGE'
        : attachment?.mimeType.startsWith('video/')
          ? 'VIDEO'
          : attachment?.mimeType.startsWith('audio/')
            ? 'AUDIO'
            : attachment
              ? 'FILE'
              : 'TEXT');
    const nowIso = new Date().toISOString();
    const replyPreview = replyToMessage ? getReplyPreviewFromMessage(replyToMessage) : null;

    const tempMessage: Message = {
      id: clientTempId,
      clientTempId,
      senderId: currentUserId,
      receiverId: currentConversation.otherUser.id,
      content: normalizedContent,
      createdAt: nowIso,
      updatedAt: nowIso,
      isRead: false,
      matchId: actualMatchId,
      type: resolvedType,
      attachment: attachment || null,
      replyTo: replyPreview,
      reactions: [],
    };

    setLocalMessagesData(prev => {
      if (!prev) {
        return {
          match: { id: actualMatchId },
          messages: [tempMessage],
        } as ConversationMessagesResponse;
      }
      return {
        ...prev,
        messages: [...prev.messages, tempMessage],
      };
    });

    setLocalConversations(prev => {
      const updated = prev.map(conv => {
        if (conv.id !== actualMatchId) return conv;
        return {
          ...conv,
          lastMessage: {
            content: getMessagePreviewText(normalizedContent, attachment || null, resolvedType),
            createdAt: nowIso,
            type: resolvedType,
            attachment: attachment || null,
          },
          updatedAt: nowIso,
        };
      });
      return updated.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });

    // TRACE: about to call webSocketService.sendMessage
    console.log('[TRACE][CLIENT] calling webSocketService.sendMessage', {
      receiverId: currentConversation.otherUser.id,
      matchId: actualMatchId,
      clientTempId,
      contentLength: normalizedContent.length,
      hasAttachment: Boolean(attachment),
      replyToMessageId: replyPreview?.id || null,
    });
    webSocketService.sendMessage(
      currentConversation.otherUser.id,
      normalizedContent,
      actualMatchId,
      attachment || null,
      clientTempId,
      replyPreview?.id || null
    );

    scheduleScrollToBottom('auto');
    return true;
  };

  const handleSendMessage = async () => {
    // TRACE: instrument handleSendMessage entry
    console.log('[TRACE][CLIENT] handleSendMessage entered', {
      newMessageLength: newMessage.trim().length,
      hasPendingAttachment: Boolean(pendingAttachment),
      selectedChat,
      currentConversationId: currentConversation?.id,
      otherUserId: currentConversation?.otherUser?.id,
    });
    if (!newMessage.trim() && !pendingAttachment) return;

    const receiverId = currentConversation?.otherUser?.id;
    try {
      const sent = await sendOutgoingMessage({
        messageContent: newMessage,
        attachment: pendingAttachment?.attachment || null,
        messageType: pendingAttachment?.type,
        replyToMessage: replyingTo,
      });
      if (!sent) return;

      setNewMessage('');
      setPendingAttachment(null);
      setReplyingTo(null);
      setShowEmojiPicker(false);
      if (receiverId && webSocketService) {
        webSocketService.sendTyping(receiverId, false);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      showError('Unable to send message.', 'Message Error');
    }
  };

  const handleAttachmentButtonClick = () => {
    setShowEmojiPicker(false);
    openAttachmentPicker();
  };

  const openAttachmentPicker = () => {
    attachmentInputRef.current?.click();
  };

  const handleAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await uploadPendingAttachment(file);
  };

  const openMediaLibrary = (tab: MediaLibraryTab) => {
    setShowEmojiPicker(false);
    setMediaLibraryTab(tab);
    setShowMediaLibrary(true);
  };

  const handleStickerButtonClick = () => {
    openMediaLibrary('sticker');
  };

  const handleMediaLibraryItemSelect = async (item: MediaLibraryItem) => {
    if (isImportingMediaItem || isUploadingAttachment) return;

    try {
      setIsImportingMediaItem(true);
      const response = await fetch(item.mediaUrl);
      if (!response.ok) {
        throw new Error(`Failed to download media: ${response.status}`);
      }

      const blob = await response.blob();
      const mimeType = blob.type || item.mimeType || 'image/gif';
      const extension = mimeType.includes('webp')
        ? 'webp'
        : mimeType.includes('png')
          ? 'png'
          : mimeType.includes('jpeg') || mimeType.includes('jpg')
            ? 'jpg'
            : 'gif';
      const fileNameBase = mediaLibraryTab === 'gif' ? 'gif' : 'sticker';
      const file = new File(
        [blob],
        `${fileNameBase}-${Date.now()}-${Math.floor(Math.random() * 10000)}.${extension}`,
        { type: mimeType }
      );

      await uploadPendingAttachment(file);
      setShowMediaLibrary(false);
    } catch (error) {
      console.error('Failed to import media item:', error);
      showError('Unable to add this GIF/sticker right now.', 'Media Error');
    } finally {
      setIsImportingMediaItem(false);
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    const next = `${newMessage}${emoji}`;
    handleTypingChange(next);
    setShowEmojiPicker(false);
    setTimeout(() => composerInputRef.current?.focus(), 0);
  };

  const handleVoiceRecordingStart = async () => {
    if (isRecordingVoice || isUploadingAttachment) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      showError('Voice recording is not supported on this device/browser.', 'Unsupported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((candidate) => {
          try {
            return MediaRecorder.isTypeSupported(candidate);
          } catch {
            return false;
          }
        });

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setIsRecordingVoice(false);
        stopRecordingTimer();
        stopRecordingStream();
        mediaRecorderRef.current = null;
        showError('Could not capture voice note. Please try again.', 'Recording Error');
      };

      recorder.onstop = async () => {
        setIsRecordingVoice(false);
        stopRecordingTimer();
        const chunks = recordingChunksRef.current;
        recordingChunksRef.current = [];

        const blobType = recorder.mimeType || 'audio/webm';
        const voiceBlob = new Blob(chunks, { type: blobType });
        mediaRecorderRef.current = null;
        stopRecordingStream();

        if (!voiceBlob.size) {
          showError('Voice note is empty. Please record again.', 'Recording Error');
          return;
        }

        const fileExtension = blobType.includes('mp4')
          ? 'm4a'
          : blobType.includes('ogg')
            ? 'ogg'
            : 'webm';

        const voiceFile = new File(
          [voiceBlob],
          `voice-note-${Date.now()}.${fileExtension}`,
          { type: blobType }
        );

        await uploadPendingAttachment(voiceFile);
      };

      setRecordingSeconds(0);
      setIsRecordingVoice(true);
      stopRecordingTimer();
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
      recorder.start(250);
    } catch {
      stopRecordingTimer();
      stopRecordingStream();
      mediaRecorderRef.current = null;
      setIsRecordingVoice(false);
      showError('Microphone access was denied or unavailable.', 'Recording Error');
    }
  };

  const handleVoiceRecordingStop = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    if (recorder.state !== 'inactive') {
      recorder.stop();
    }
    setIsRecordingVoice(false);
    stopRecordingTimer();
  };

  const handleTypingChange = (value: string) => {
    setNewMessage(value);
    if (isCurrentConversationLocked) return;
    if (!currentConversation || !webSocketService || !currentConversation.otherUser?.id) return;
    const receiverId = currentConversation.otherUser.id;
    webSocketService.sendTyping(receiverId, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      webSocketService.sendTyping(receiverId, false);
    }, 1200);
  };

  const handleSelectChat = (id: string) => {
    setSelectedChat(id);
    setReplyingTo(null);
    setLocalConversations(prev =>
      prev.map(conv =>
        conv.id === id ? { ...conv, unreadCount: 0 } : conv
      )
    );
  };

  const getMessageAuthorLabel = useCallback((senderId: string) => {
    if (senderId === currentUserId) return 'You';
    return currentConversation?.otherUser?.name || 'Matched user';
  }, [currentConversation?.otherUser?.name, currentUserId]);

  const handleReplyToMessage = (message: Message) => {
    setReplyingTo(message);
    setShowEmojiPicker(false);
    setShowMediaLibrary(false);
    setTimeout(() => composerInputRef.current?.focus(), 0);
  };

  // Auto select logic
  useEffect(() => {
    if (localConversations.length === 0) return;

    if (profileIdParam && !didAutoSelect.current) {
      const found = localConversations.find(
        conv => conv.otherUser?.id === profileIdParam
      );
      if (found && selectedChat !== found.id) {
        setSelectedChat(found.id);
        didAutoSelect.current = true;
      } else if (!found && selectedChat === profileIdParam) {
        didAutoSelect.current = true;
      }
    } else if (!selectedChat && !didAutoSelect.current && isDesktopLayout) {
      setSelectedChat(localConversations[0]?.id);
      didAutoSelect.current = true;
    }
  }, [isDesktopLayout, localConversations, profileIdParam, selectedChat]);

  const handleConversationListScroll = useCallback(() => {
    const el = conversationsListRef.current;
    if (!el || loadingMore || !hasMore) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining < 220) {
      loadMore();
    }
  }, [loadingMore, hasMore, loadMore]);

  // Show loading state
  if (loading) {
    return <HeartBeatLoader message="Loading your conversations..." />;
  }

  // Handle error state
  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center p-8">
          <p className="text-red-600 mb-4">Failed to load conversations: {error.toString()}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show no conversations state
  if (localConversations.length === 0 && !profileIdParam) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white flex items-center justify-center">
        <div className="text-center p-8">
          <MessageCircle className="w-20 h-20 text-pink-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">No Conversations Yet</h2>
          <p className="text-gray-400 mb-4">Start matching with people to begin new conversations!</p>
          <Link
            to="/dashboard"
            className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-full text-lg font-semibold hover:from-pink-600 hover:to-purple-700 transition-all duration-300 shadow-lg"
          >
            Find Matches
          </Link>
        </div>
      </div>
    );
  }

  const filteredConversations = localConversations.filter(conv => {
    const matchedUser = conv.otherUser;
    return matchedUser?.name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const selectedOtherUserId = currentConversation?.otherUser?.id;
  const selectedUserPresence = selectedOtherUserId ? presenceByUserId[selectedOtherUserId] : undefined;
  const selectedUserOnline = Boolean(selectedUserPresence?.isOnline);
  const selectedUserLastSeenLabel = formatLastSeenTimestamp(selectedUserPresence?.lastSeenAt);

  const callPeerId = incomingCall?.fromUserId || activeCallPeerId;
  const matchedCallConversation = callPeerId
    ? localConversations.find((conversation) => conversation.otherUser?.id === callPeerId)
    : null;
  const callPeerUser = matchedCallConversation?.otherUser
    || (currentConversation?.otherUser?.id === callPeerId ? currentConversation.otherUser : null);

  const callPeerName = callPeerUser?.name || 'Matched user';
  const callPeerAvatar = callPeerUser?.profilePhoto1 || '/default-avatar.png';
  const callStatusLabel = callStatus === 'dialing'
    ? 'Calling...'
    : callStatus === 'connecting'
      ? 'Connecting...'
      : callStatus === 'ringing'
        ? 'Incoming call'
        : callStatus === 'active'
          ? formatCallDuration(callDurationSeconds)
          : '';
  const selectedVideoFilter = CALL_VIDEO_FILTER_PRESETS.find((preset) => preset.id === selectedVideoFilterId)
    || CALL_VIDEO_FILTER_PRESETS[0];
  const selectedBackground = CALL_BACKGROUND_PRESETS.find((preset) => preset.id === selectedBackgroundId)
    || CALL_BACKGROUND_PRESETS[0];
  const callVideoFilterStyle = callMode === 'video'
    ? { filter: selectedVideoFilter.cssFilter }
    : undefined;
  const callQualityToneClass = callQualityLabel === 'Excellent'
    ? 'text-emerald-200'
    : callQualityLabel === 'Good'
      ? 'text-amber-200'
      : callQualityLabel === 'Offline'
        ? 'text-rose-200'
        : 'text-orange-200';

  const renderCallLayer = () => {
    const shouldShowCallWindow = callStatus !== 'idle' && Boolean(activeCallPeerId);
    if (!shouldShowCallWindow) return null;

    if (isCallMinimized) {
      const hasPosition = Boolean(minimizedCallPosition);
      return (
        <div
          ref={minimizedCallContainerRef}
          className={`fixed z-[95] ${hasPosition ? '' : 'right-4 bottom-4'} ${callMode === 'video' ? 'w-[252px] sm:w-[286px]' : 'w-[272px] sm:w-[304px]'} ${isMinimizedCallDragging ? '' : 'transition-[left,top] duration-200 ease-out'}`}
          style={hasPosition ? { left: minimizedCallPosition!.x, top: minimizedCallPosition!.y } : undefined}
        >
          <div className="relative overflow-hidden rounded-3xl border border-white/20 bg-[#07121d]/95 shadow-[0_22px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <div className={`absolute inset-0 ${selectedBackground.className}`} />

            {callMode === 'video' ? (
              <div className="relative h-[152px] sm:h-[168px]">
                {remoteCallStream ? (
                  <video
                    ref={remoteCallVideoRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-cover"
                    style={callVideoFilterStyle}
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
                )}

                {localCallStream && (
                  <div className="absolute right-2 top-2 w-16 h-24 rounded-2xl overflow-hidden border border-white/35 bg-black/40 shadow-xl">
                    <video
                      ref={localCallVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-full w-full object-cover"
                      style={callVideoFilterStyle}
                    />
                  </div>
                )}
                <div className={`pointer-events-none absolute inset-0 transition-all duration-300 ${selectedBackground.overlayClass}`} />
                <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/65 to-transparent" />
              </div>
            ) : (
              <div className="relative h-16 sm:h-20 bg-[radial-gradient(circle_at_20%_20%,rgba(244,114,182,0.2),transparent_40%),radial-gradient(circle_at_80%_75%,rgba(99,102,241,0.22),transparent_45%),linear-gradient(135deg,#07121d,#0d1d2d,#132b3f)]" />
            )}

            <div className="relative bg-black/45 px-3 pb-3 pt-2.5">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-grab active:cursor-grabbing touch-none select-none"
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    startMinimizedCallDrag(event.clientX, event.clientY);
                  }}
                  onTouchStart={(event) => {
                    const touch = event.touches[0];
                    if (!touch) return;
                    startMinimizedCallDrag(touch.clientX, touch.clientY);
                  }}
                >
                  <p className="text-[15px] font-semibold leading-5 text-white truncate">{callPeerName}</p>
                  <p className="text-[12px] text-white/80 truncate">{callStatusLabel}</p>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsCallMinimized(false)}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/25 transition-colors"
                    aria-label="Restore call window"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (callStatus === 'ringing') {
                        declineIncomingCall();
                        return;
                      }
                      endActiveCall({ notifyPeer: true, reason: 'ended-by-user' });
                    }}
                    className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-rose-500/90 hover:bg-rose-500 text-white border border-rose-300/50 transition-colors"
                    aria-label="End call"
                  >
                    <PhoneOff className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {callStatus === 'ringing' && incomingCall ? (
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => declineIncomingCall()}
                    className="flex-1 inline-flex items-center justify-center h-9 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={() => void acceptIncomingCall()}
                    className="flex-1 inline-flex items-center justify-center h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors"
                  >
                    Accept
                  </button>
                </div>
              ) : (
                <div className="mt-2.5 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={toggleCallMic}
                    className={`inline-flex items-center justify-center h-9 w-9 rounded-xl border transition-colors ${
                      isCallMicMuted
                        ? 'bg-white/90 text-gray-900 border-white'
                        : 'bg-white/10 text-white border-white/25 hover:bg-white/20'
                    }`}
                    aria-label={isCallMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isCallMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                  {callMode === 'video' && (
                    <button
                      type="button"
                      onClick={toggleCallCamera}
                      className={`inline-flex items-center justify-center h-9 w-9 rounded-xl border transition-colors ${
                        isCallCameraOff
                          ? 'bg-white/90 text-gray-900 border-white'
                          : 'bg-white/10 text-white border-white/25 hover:bg-white/20'
                      }`}
                      aria-label={isCallCameraOff ? 'Turn camera on' : 'Turn camera off'}
                    >
                      {isCallCameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    const isMobileCallView = !isDesktopLayout;
    const isCompactMobileCallView = isMobileCallView && isCompactCallViewport;
    const hasLocalPreviewPosition = Boolean(localPreviewPosition);

    const handleCallGestureStart = (event: ReactTouchEvent<HTMLDivElement>) => {
      if (!isMobileCallView) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, a, [data-call-control="true"]')) return;
      const touch = event.touches[0];
      if (!touch) return;
      mobileCallGestureStartRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const handleCallGestureEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
      if (!isMobileCallView) return;
      const start = mobileCallGestureStartRef.current;
      mobileCallGestureStartRef.current = null;
      if (!start) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;

      if (Math.abs(deltaX) < 64 && Math.abs(deltaY) < 64) return;

      if (Math.abs(deltaY) > Math.abs(deltaX) && deltaY < -72) {
        void switchCallCameraFacing();
        return;
      }

      if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX < -72) {
        cycleCallVideoFilter();
        return;
      }

      if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 72) {
        cycleCallBackground();
      }
    };

    return (
      <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 backdrop-blur-md p-3 md:p-5">
        <div
          className="relative w-full h-full max-h-[92vh] max-w-5xl rounded-3xl overflow-hidden border border-white/15 bg-gradient-to-br from-[#07121d] via-[#0b1b2b] to-[#10263a] shadow-[0_30px_120px_rgba(0,0,0,0.6)]"
          onTouchStart={handleCallGestureStart}
          onTouchEnd={handleCallGestureEnd}
        >
          <div className={`absolute inset-0 ${selectedBackground.className}`} />
          <div className="absolute inset-0">
            {callMode === 'video' ? (
              remoteCallStream ? (
                <video
                  ref={remoteCallVideoRef}
                  autoPlay
                  playsInline
                  className="h-full w-full object-cover"
                  style={callVideoFilterStyle}
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
              )
            ) : (
              <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(244,114,182,0.2),transparent_40%),radial-gradient(circle_at_80%_75%,rgba(99,102,241,0.22),transparent_45%),linear-gradient(135deg,#07121d,#0d1d2d,#132b3f)]" />
            )}
          </div>

          <div className={`pointer-events-none absolute inset-0 transition-all duration-300 ${selectedBackground.overlayClass}`} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/55" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.06),transparent_30%),linear-gradient(180deg,rgba(244,114,182,0.08),transparent_24%,transparent_62%,rgba(12,18,30,0.38)_100%)] mix-blend-screen" />

          {(isCallMicMuted || isRemoteCallMicMuted) && (
            <div className="absolute right-4 top-20 z-20 flex flex-col items-end gap-2">
              {isCallMicMuted ? (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-xl shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
                  <MicOff className="h-3.5 w-3.5 text-rose-300" />
                  <span>You are muted</span>
                </div>
              ) : null}
              {isRemoteCallMicMuted ? (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-[11px] font-medium text-white/90 backdrop-blur-xl shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
                  <MicOff className="h-3.5 w-3.5 text-amber-200" />
                  <span>{callPeerName.split(' ')[0]} muted</span>
                </div>
              ) : null}
            </div>
          )}

          {isRemoteCallCameraOff ? (
            <div className="pointer-events-none absolute inset-x-0 top-24 z-20 flex justify-center px-4">
              <div className="inline-flex max-w-[88%] items-center gap-2 rounded-2xl border border-white/15 bg-black/50 px-4 py-2.5 text-center text-sm font-medium text-white/95 backdrop-blur-xl shadow-[0_16px_34px_rgba(0,0,0,0.24)]">
                <VideoOff className="h-4 w-4 text-amber-200" />
                <span>{callPeerName} turned off their camera</span>
              </div>
            </div>
          ) : null}

          <div className={`absolute left-4 right-4 flex items-start justify-between ${isCompactMobileCallView ? 'top-3 gap-2.5' : 'top-4 gap-3'}`}>
            <div className={`flex items-center rounded-2xl border border-white/15 bg-black/35 backdrop-blur-xl ${isCompactMobileCallView ? 'gap-2 px-2.5 py-2' : 'gap-3 px-3 py-2'}`}>
              <OptimizedImage
                src={callPeerAvatar}
                alt={callPeerName}
                width={44}
                height={44}
                className={isCompactMobileCallView ? 'w-9 h-9 rounded-full object-cover ring-2 ring-pink-400/50' : 'w-11 h-11 rounded-full object-cover ring-2 ring-pink-400/50'}
              />
              <div className="min-w-0">
                <p className={`text-white font-semibold truncate ${isCompactMobileCallView ? 'text-[0.95rem]' : ''}`}>{callPeerName}</p>
                <p className={`${isCompactMobileCallView ? 'text-[11px]' : 'text-xs'} text-white/75`}>{callStatusLabel}</p>
                {isMobileCallView ? (
                  <p className={`mt-0.5 font-medium ${isCompactMobileCallView ? 'text-[10px]' : 'text-[11px]'} ${callQualityToneClass}`}>📶 {callQualityLabel}</p>
                ) : null}
              </div>
            </div>
            <div className={`flex items-center ${isCompactMobileCallView ? 'gap-1.5' : 'gap-2'}`}>
              <button
                type="button"
                onClick={() => setIsCallMinimized(true)}
                className={`inline-flex items-center justify-center rounded-2xl bg-white/15 hover:bg-white/25 text-white border border-white/25 transition-colors ${isCompactMobileCallView ? 'h-10 w-10' : 'h-11 w-11'}`}
                aria-label="Minimize call"
              >
                <Minimize2 className={isCompactMobileCallView ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (callStatus === 'ringing') {
                    declineIncomingCall();
                    return;
                  }
                  endActiveCall({ notifyPeer: true, reason: 'ended-by-user' });
                }}
                className={`inline-flex items-center justify-center rounded-2xl bg-rose-500/80 hover:bg-rose-500 text-white border border-rose-300/45 transition-colors ${isCompactMobileCallView ? 'h-10 w-10' : 'h-11 w-11'}`}
                aria-label="End call"
              >
                <PhoneOff className={isCompactMobileCallView ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
              </button>
            </div>
          </div>

          {callMode === 'video' && localCallStream && (
            <div
              ref={localPreviewContainerRef}
              data-call-control="true"
              className={`absolute overflow-hidden border bg-black/30 ${isMobileCallView ? `${isCompactMobileCallView ? 'w-20 h-28 rounded-[1.15rem]' : 'w-24 h-36 rounded-[1.35rem]'} border-white/35 shadow-[0_16px_40px_rgba(0,0,0,0.34),0_0_0_1px_rgba(255,255,255,0.14),0_0_24px_rgba(244,114,182,0.16)] backdrop-blur-md touch-none select-none` : 'right-3 bottom-24 md:right-4 md:bottom-28 w-28 h-40 sm:w-32 sm:h-44 rounded-2xl border-white/25 shadow-2xl'} ${isLocalPreviewDragging ? '' : 'transition-[left,top,transform] duration-200 ease-out'} ${isMobileCallView ? 'cursor-grab active:cursor-grabbing' : ''}`}
              style={isMobileCallView
                ? (hasLocalPreviewPosition
                    ? { left: localPreviewPosition!.x, top: localPreviewPosition!.y }
                    : { right: 16, bottom: isCompactMobileCallView ? 208 : 236 })
                : undefined}
              onPointerDown={(event) => {
                if (!isMobileCallView) return;
                if (event.pointerType === 'touch') return;
                event.preventDefault();
                startLocalPreviewDrag(event.clientX, event.clientY);
              }}
              onTouchStart={(event) => {
                if (!isMobileCallView) return;
                const touch = event.touches[0];
                if (!touch) return;
                startLocalPreviewDrag(touch.clientX, touch.clientY);
              }}
            >
              <div className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] ring-1 ring-white/20" />
              <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/35 via-transparent to-white/8" />
                <video
                  ref={localCallVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="pointer-events-none h-full w-full object-cover"
                  style={callVideoFilterStyle}
                />
              </div>
            )}

          <div className={`absolute inset-x-0 bottom-0 ${isCompactMobileCallView ? 'p-3' : 'p-4 md:p-5'}`}>
            {callStatus === 'ringing' && incomingCall ? (
              <div className="mx-auto w-full max-w-md rounded-2xl border border-white/20 bg-black/45 backdrop-blur-xl p-4">
                <p className="text-center text-sm text-white/85 mb-3">
                  {incomingCall.callType === 'video' ? 'Incoming video call' : 'Incoming audio call'}
                </p>
                {!hasPremiumCallAccess ? (
                  <div className="mb-3 text-center">
                    <p className="text-xs text-amber-200">
                      Premium is required to answer calls.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/premium')}
                      className="mt-2 inline-flex items-center justify-center rounded-full border border-amber-300/30 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:bg-white/15"
                    >
                      Upgrade to Premium
                    </button>
                  </div>
                ) : null}
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => declineIncomingCall()}
                    className="inline-flex items-center justify-center h-11 px-5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold transition-colors"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!hasPremiumCallAccess) {
                        navigate('/premium');
                        return;
                      }
                      void acceptIncomingCall();
                    }}
                    className={`inline-flex items-center justify-center h-11 px-5 rounded-xl font-semibold transition-colors ${
                      hasPremiumCallAccess
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : 'bg-amber-500/15 text-white'
                    }`}
                  >
                    {hasPremiumCallAccess ? 'Accept' : 'Premium Only'}
                  </button>
                </div>
              </div>
            ) : (
              <div
                data-call-control="true"
                className={`mx-auto w-full ${isMobileCallView ? `${isCompactMobileCallView ? 'max-w-[17.75rem] rounded-[1.55rem] px-3 py-2' : 'max-w-[20rem] rounded-[1.8rem] px-3.5 py-2.5'} border-white/18 bg-black/34 shadow-[0_22px_48px_rgba(0,0,0,0.26)]` : 'max-w-md rounded-2xl border-white/20 bg-black/45 px-4 py-3'} border backdrop-blur-2xl`}
              >
                <div className={`flex items-center justify-center ${isMobileCallView ? (isCompactMobileCallView ? 'gap-2' : 'gap-2.5') : 'gap-3'}`}>
                  <button
                    type="button"
                    onClick={toggleCallMic}
                    className={`inline-flex items-center justify-center border transition-all duration-150 active:scale-95 ${
                      isMobileCallView ? `${isCompactMobileCallView ? 'h-10 w-10 rounded-[1.15rem]' : 'h-12 w-12 rounded-2xl'} shadow-[0_10px_26px_rgba(0,0,0,0.22)]` : 'h-11 w-11 rounded-xl'
                    } ${
                      isCallMicMuted
                        ? 'bg-white/90 text-gray-900 border-white'
                        : 'bg-white/10 text-white border-white/25 hover:bg-white/20'
                    }`}
                    aria-label={isCallMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isCallMicMuted ? <MicOff className={isCompactMobileCallView ? 'w-3.5 h-3.5' : 'w-4 h-4'} /> : <Mic className={isCompactMobileCallView ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
                  </button>
                  {callMode === 'video' && (
                    <button
                      type="button"
                      onClick={toggleCallCamera}
                      className={`inline-flex items-center justify-center border transition-all duration-150 active:scale-95 ${
                        isMobileCallView ? `${isCompactMobileCallView ? 'h-10 w-10 rounded-[1.15rem]' : 'h-12 w-12 rounded-2xl'} shadow-[0_10px_26px_rgba(0,0,0,0.22)]` : 'h-11 w-11 rounded-xl'
                      } ${
                        isCallCameraOff
                          ? 'bg-white/90 text-gray-900 border-white'
                          : 'bg-white/10 text-white border-white/25 hover:bg-white/20'
                      }`}
                      aria-label={isCallCameraOff ? 'Turn camera on' : 'Turn camera off'}
                    >
                      {isCallCameraOff ? <VideoOff className={isCompactMobileCallView ? 'w-3.5 h-3.5' : 'w-4 h-4'} /> : <Video className={isCompactMobileCallView ? 'w-3.5 h-3.5' : 'w-4 h-4'} />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => endActiveCall({ notifyPeer: true, reason: 'ended-by-user' })}
                    className={`inline-flex items-center justify-center bg-rose-500 hover:bg-rose-600 text-white transition-all duration-150 active:scale-95 ${isMobileCallView ? `${isCompactMobileCallView ? 'h-10 w-12 rounded-[1.15rem]' : 'h-12 w-14 rounded-2xl'} shadow-[0_16px_30px_rgba(244,63,94,0.32)]` : 'h-11 w-14 rounded-xl'}`}
                    aria-label="Hang up call"
                  >
                    <PhoneOff className={isCompactMobileCallView ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
                  </button>
                </div>
                {callMode === 'video' && (
                  <div className={`grid grid-cols-2 ${isMobileCallView ? (isCompactMobileCallView ? 'mt-2 gap-1.5' : 'mt-2.5 gap-2') : 'mt-2.5 gap-2'}`}>
                    <AppDropdown
                      value={selectedVideoFilterId}
                      onChange={setSelectedVideoFilterId}
                      options={CALL_VIDEO_FILTER_PRESETS.map((preset) => ({
                        value: preset.id,
                        label: preset.label,
                      }))}
                      placeholder="Filter"
                      triggerClassName={`${isMobileCallView ? `${isCompactMobileCallView ? 'h-9 rounded-[1rem] px-2.5 text-xs' : 'h-11 rounded-2xl px-3 text-sm'} border-white/18 bg-white/8 font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]` : 'h-9 rounded-lg border border-white/20 bg-white/10 px-2 text-xs text-white'} focus:border-pink-300/70`}
                      menuClassName="z-[140] border-white/20 bg-slate-900/98"
                      optionClassName="text-xs sm:text-sm"
                      ariaLabel="Video filter"
                    />
                    <AppDropdown
                      value={selectedBackgroundId}
                      onChange={setSelectedBackgroundId}
                      options={CALL_BACKGROUND_PRESETS.map((preset) => ({
                        value: preset.id,
                        label: preset.label,
                      }))}
                      placeholder="Background"
                      triggerClassName={`${isMobileCallView ? `${isCompactMobileCallView ? 'h-9 rounded-[1rem] px-2.5 text-xs' : 'h-11 rounded-2xl px-3 text-sm'} border-white/18 bg-white/8 font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]` : 'h-9 rounded-lg border border-white/20 bg-white/10 px-2 text-xs text-white'} focus:border-pink-300/70`}
                      menuClassName="z-[140] border-white/20 bg-slate-900/98"
                      optionClassName="text-xs sm:text-sm"
                      ariaLabel="Call background"
                    />
                  </div>
                )}
                {isMobileCallView && callMode === 'video' ? (
                  <div className={`flex items-center justify-between rounded-[1.2rem] border border-white/10 bg-white/[0.03] text-white/75 ${isCompactMobileCallView ? 'mt-2 gap-1 px-2 py-1.5 text-[9px]' : 'mt-2.5 gap-1.5 px-2.5 py-2 text-[10px]'}`}>
                    <button
                      type="button"
                      data-call-control="true"
                      onClick={() => void switchCallCameraFacing()}
                      className={`inline-flex items-center rounded-full transition-transform duration-150 active:scale-95 ${isCompactMobileCallView ? 'gap-1 px-1.5 py-0.5' : 'gap-1.5 px-2 py-1'}`}
                      aria-label="Switch camera"
                    >
                      <RefreshCcw className={isCompactMobileCallView ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                      <span>Swipe up</span>
                    </button>
                    <button
                      type="button"
                      data-call-control="true"
                      onClick={cycleCallVideoFilter}
                      className={`inline-flex items-center rounded-full transition-transform duration-150 active:scale-95 ${isCompactMobileCallView ? 'gap-1 px-1.5 py-0.5' : 'gap-1.5 px-2 py-1'}`}
                      aria-label="Cycle video filters"
                    >
                      <Wand2 className={isCompactMobileCallView ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                      <span>Swipe left</span>
                    </button>
                    <button
                      type="button"
                      data-call-control="true"
                      onClick={cycleCallBackground}
                      className={`inline-flex items-center rounded-full transition-transform duration-150 active:scale-95 ${isCompactMobileCallView ? 'gap-1 px-1.5 py-0.5' : 'gap-1.5 px-2 py-1'}`}
                      aria-label="Cycle backgrounds"
                    >
                      <ImageIcon className={isCompactMobileCallView ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                      <span>Swipe right</span>
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMessageAttachment = (message: Message) => {
    const attachment = message.attachment;
    if (!attachment) return null;
    const kind = getAttachmentKind(message.type, attachment);
    const isDirectGifOrSticker = kind === 'image' && (isGifAttachment(attachment) || isStickerAttachment(attachment));
    const label = getAttachmentPreviewText(message.type, attachment);
    const isSender = message.senderId === currentUserId;

    if (kind === 'audio') {
      return <VoiceNoteAttachment attachment={attachment} isSender={isSender} />;
    }

    if (isDirectGifOrSticker) {
      return (
        <button
          type="button"
          onClick={() => setViewerMessage(message)}
          className="block max-w-[170px] sm:max-w-[220px] rounded-2xl overflow-hidden border border-white/15 bg-black/20"
        >
          <img
            src={attachment.url}
            alt={attachment.fileName || 'Sticker or GIF'}
            className="w-full max-h-[240px] h-auto object-contain"
            loading="lazy"
          />
        </button>
      );
    }

    const PreviewIcon = kind === 'image'
      ? ImageIcon
      : kind === 'video'
        ? Video
        : FileText;

    return (
      <div className="w-[200px] sm:w-[220px] rounded-2xl overflow-hidden border border-white/20 bg-black/35 shadow-lg shadow-black/30">
        <button
          type="button"
          onClick={() => setViewerMessage(message)}
          className="relative block w-full h-28 group"
        >
          {kind === 'image' ? (
            <img
              src={attachment.url}
              alt={attachment.fileName || 'Image attachment'}
              className={`w-full h-full object-cover scale-105 ${isSender ? 'blur-0 brightness-95' : 'blur-[6px] brightness-75'}`}
              loading="lazy"
            />
          ) : kind === 'video' ? (
            <video
              src={attachment.url}
              className={`w-full h-full object-cover scale-105 pointer-events-none ${isSender ? 'blur-0 brightness-95' : 'blur-[6px] brightness-75'}`}
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-white/20 via-white/10 to-transparent flex items-center justify-center">
              <PreviewIcon className="w-8 h-8 text-white/80" />
            </div>
          )}

          <div className={`absolute inset-0 bg-gradient-to-t ${isSender ? 'from-black/55 via-black/25 to-black/5' : 'from-black/80 via-black/35 to-black/10'}`} />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/55 border border-white/20 text-xs font-medium text-white">
              <PreviewIcon className="w-3.5 h-3.5" />
              {label}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 text-gray-900 text-xs font-semibold shadow-md">
              <Eye className="w-3.5 h-3.5" />
              View
            </span>
          </div>
        </button>

        <div className="p-2.5">
          <p className="text-[11px] text-white truncate">{attachment.fileName}</p>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] text-white/65">{formatBytes(attachment.fileSize)}</span>
            {!isSender && (
              <a
                href={attachment.url}
                download={attachment.fileName}
                className="inline-flex items-center gap-1 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 px-2 py-1 text-[10px] font-medium text-white transition-colors"
              >
                <Download className="w-3 h-3" />
                Download
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAttachmentViewer = () => {
    if (!viewerMessage?.attachment) return null;

    const attachment = viewerMessage.attachment;
    const kind = getAttachmentKind(viewerMessage.type, attachment);
    const isDirectGifOrSticker = kind === 'image' && (isGifAttachment(attachment) || isStickerAttachment(attachment));
    if (kind === 'audio') return null;
    const label = getAttachmentPreviewText(viewerMessage.type, attachment);
    const isSender = viewerMessage.senderId === currentUserId;

    if (isDirectGifOrSticker) {
      return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <button
            type="button"
            aria-label="Close viewer"
            onClick={() => setViewerMessage(null)}
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
          />
          <div className="relative z-10 w-full h-full p-3 md:p-6 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setViewerMessage(null)}
              className="absolute top-3 right-3 md:top-5 md:right-5 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-black/50 hover:bg-black/70 border border-white/25 text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={attachment.url}
              alt={attachment.fileName || 'Sticker or GIF'}
              className="max-h-[86vh] max-w-[88vw] w-auto object-contain rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.65)]"
            />
          </div>
        </div>
      );
    }

    const content = kind === 'image'
      ? (
        <img
          src={attachment.url}
          alt={attachment.fileName || 'Image attachment'}
          className="max-h-[72vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl shadow-black/60"
        />
      )
      : kind === 'video'
        ? (
          <video
            src={attachment.url}
            controls
            autoPlay
            className="max-h-[72vh] w-auto max-w-full rounded-2xl bg-black shadow-2xl shadow-black/60"
          />
        )
        : kind === 'pdf'
            ? (
              <iframe
                title={attachment.fileName || 'PDF attachment'}
                src={attachment.url}
                className="w-full h-[72vh] rounded-2xl border border-white/15 bg-white"
              />
            )
            : (
              <div className="w-full max-w-xl rounded-3xl border border-white/20 bg-gradient-to-br from-white/20 via-white/10 to-transparent p-6 md:p-8 text-center">
                <FileText className="w-12 h-12 text-white/90 mx-auto mb-4" />
                <h4 className="text-white text-lg font-semibold mb-2">File Ready</h4>
                <p className="text-white/70 text-sm mb-6 break-all">{attachment.fileName}</p>
                {!isSender && (
                  <a
                    href={attachment.url}
                    download={attachment.fileName}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download File
                  </a>
                )}
              </div>
            );

    return (
      <div className="fixed inset-0 z-[80] p-3 md:p-6 flex items-center justify-center">
        <button
          type="button"
          aria-label="Close viewer"
          onClick={() => setViewerMessage(null)}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />
        <div className="relative z-10 w-full max-w-5xl max-h-[92vh] rounded-3xl overflow-hidden border border-white/20 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 shadow-[0_20px_80px_rgba(0,0,0,0.65)]">
          <div className="px-4 py-3 md:px-6 md:py-4 border-b border-white/10 bg-white/5 backdrop-blur-xl flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.18em] text-pink-300/90">{label}</p>
              <h3 className="text-white font-semibold truncate">{attachment.fileName}</h3>
              <p className="text-[11px] text-white/60 mt-0.5">{formatBytes(attachment.fileSize)}</p>
            </div>
            <div className="flex items-center gap-2">
              {!isSender && (
                <a
                  href={attachment.url}
                  download={attachment.fileName}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              )}
              <button
                type="button"
                onClick={() => setViewerMessage(null)}
                className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="p-3 md:p-6 overflow-auto max-h-[calc(92vh-82px)] flex items-center justify-center bg-gradient-to-b from-transparent to-black/25">
            {content}
          </div>
        </div>
      </div>
    );
  };

  const renderMediaLibrary = () => {
    if (!showMediaLibrary) return null;

    const showConfigHint = !mediaLibraryProvider;
    const isBusy = mediaLibraryLoading || isImportingMediaItem || isUploadingAttachment;

    return (
      <div className="fixed inset-0 z-[78] flex items-end justify-center md:items-center md:p-4">
        <button
          type="button"
          aria-label="Close media library"
          onClick={() => setShowMediaLibrary(false)}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />
        <div className="relative z-10 w-full h-[80vh] md:h-[86vh] md:max-w-6xl rounded-t-3xl md:rounded-3xl overflow-hidden border border-white/10 bg-[#081420] shadow-[0_24px_80px_rgba(0,0,0,0.55)] flex flex-col">
          <div className="px-3 pt-2 pb-3 md:px-5 md:pt-4 md:pb-4 border-b border-white/10 bg-[#0a1928]/90 backdrop-blur-xl">
            <div className="mx-auto mb-2 h-1.5 w-14 rounded-full bg-white/30 md:hidden" />
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={mediaLibraryQuery}
                  onChange={(event) => setMediaLibraryQuery(event.target.value)}
                  placeholder={`Search ${mediaLibraryTab === 'gif' ? 'GIFs' : 'stickers'}...`}
                  className="w-full h-11 rounded-xl border border-white/15 bg-white/10 pl-9 pr-3 text-sm text-white placeholder-slate-300 focus:outline-none focus:border-pink-400/60"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowMediaLibrary(false)}
                className="inline-flex items-center justify-center h-11 w-11 rounded-xl border border-white/15 bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 inline-flex rounded-full border border-white/15 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setMediaLibraryTab('gif')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-colors ${
                  mediaLibraryTab === 'gif'
                    ? 'bg-white text-[#0b1a2a]'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                GIF
              </button>
              <button
                type="button"
                onClick={() => setMediaLibraryTab('sticker')}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-colors ${
                  mediaLibraryTab === 'sticker'
                    ? 'bg-white text-[#0b1a2a]'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                Sticker
              </button>
            </div>
            {showConfigHint && (
              <p className="mt-2 text-xs text-amber-200/90">
                Configure `VITE_TENOR_API_KEY` or `VITE_GIPHY_API_KEY` in `frontend/.env` to enable in-app library.
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 md:p-4">
            {isBusy && (
              <div className="h-full flex items-center justify-center text-slate-200">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm">{isImportingMediaItem ? 'Adding to chat...' : 'Loading media...'}</span>
              </div>
            )}

            {!isBusy && mediaLibraryError && (
              <div className="h-full flex items-center justify-center text-center px-6">
                <p className="text-sm text-rose-200">{mediaLibraryError}</p>
              </div>
            )}

            {!isBusy && !mediaLibraryError && mediaLibraryItems.length === 0 && (
              <div className="h-full flex items-center justify-center text-center px-6">
                <p className="text-sm text-slate-300">
                  {mediaLibraryQuery.trim()
                    ? `No ${mediaLibraryTab} results found. Try another search.`
                    : `No ${mediaLibraryTab}s available right now.`}
                </p>
              </div>
            )}

            {!isBusy && !mediaLibraryError && mediaLibraryItems.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                {mediaLibraryItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleMediaLibraryItemSelect(item)}
                    className="group relative rounded-2xl overflow-hidden border border-white/10 bg-black/25 hover:border-pink-300/60 transition-colors"
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.title}
                      loading="lazy"
                      className="w-full aspect-[4/5] object-cover"
                    />
                    <span className="absolute inset-x-2 bottom-2 inline-flex items-center justify-center rounded-full bg-black/60 border border-white/20 py-1 text-[11px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      Add
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };


  if (!currentConversation && selectedChat) {
    return <HeartBeatLoader message="Initializing chat..." />;
  }

  const hasComposerPayload = Boolean(newMessage.trim() || pendingAttachment);
  const isComposerConnected = Boolean(webSocketService?.connected);
  const primaryActionDisabled = isCurrentConversationLocked
    ? true
    : isRecordingVoice
      ? false
      : (isUploadingAttachment || !isComposerConnected);

  const handlePrimaryComposerAction = () => {
    if (isRecordingVoice) {
      handleVoiceRecordingStop();
      return;
    }

    if (hasComposerPayload) {
      void handleSendMessage();
      return;
    }

    void handleVoiceRecordingStart();
  };

  const mainContent = (
    <div className="h-[calc(100dvh-78px)] lg:h-[calc(100dvh-82px)] flex flex-col md:flex-row overflow-hidden max-w-full">
        {/* Conversations List */}
        <div className={`${selectedChat ? 'hidden md:flex' : 'flex'} w-full md:w-[360px] lg:w-[390px] xl:w-[420px] flex-shrink-0 bg-gradient-to-b from-gray-900/70 to-gray-900/40 backdrop-blur-xl md:border-r border-gray-700/50 overflow-hidden min-w-0 flex-col`}>
          {/* Header */}
          <div className="p-3 md:p-4 border-b border-gray-700/50">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Link
                  to="/dashboard"
                  className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white transition-all duration-300 hover:bg-white/20"
                  aria-label="Back to dashboard"
                  title="Back to dashboard"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-white">Messages</h2>
                  <p className="text-xs text-gray-400">Choose a conversation</p>
                </div>
              </div>
            </div>
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl pl-12 pr-4 py-2.5 text-white placeholder-gray-400 focus:outline-none focus:border-pink-500/50 transition-all duration-300"
              />
            </div>
          </div>

          {/* Conversations */}
          <div
            ref={conversationsListRef}
            onScroll={handleConversationListScroll}
            className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-2.5 space-y-1.5 min-w-0"
          >
            {filteredConversations.map((conversation) => {
              const matchedUser = conversation.otherUser;
              const matchedUserPresence = matchedUser?.id ? presenceByUserId[matchedUser.id] : undefined;
              const isMatchedUserOnline = Boolean(matchedUserPresence?.isOnline);
              return (
                <button
                  key={conversation.id}
                  onClick={() => handleSelectChat(conversation.id)}
                  className={`w-full p-3.5 rounded-2xl transition-all duration-300 hover:bg-white/10 min-w-0 text-left ${
                    selectedChat === conversation.id
                      ? 'bg-gradient-to-r from-pink-500/20 to-purple-600/20 border border-pink-500/30'
                      : 'hover:bg-white/5'
                    }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <OptimizedImage
                        src={matchedUser?.profilePhoto1 || '/default-avatar.png'}
                        alt={matchedUser?.name || 'User'}
                        width={48}
                        height={48}
                        className="w-12 h-12 object-cover rounded-full ring-2 ring-pink-500/30"
                      />
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-900 ${
                        isMatchedUserOnline ? 'bg-emerald-400' : 'bg-slate-500'
                      }`} />
                      {conversation.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold text-white">{conversation.unreadCount}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 text-left min-w-0 overflow-hidden">
                      <div className="flex items-center justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                          <h3 className="font-semibold text-white truncate hover:text-pink-300 transition-colors cursor-pointer">{matchedUser?.name}</h3>
                          {conversation.chatLocked ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100">
                              <Lock className="h-3 w-3" />
                              Locked
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                          {conversation.lastMessage ? new Date(conversation.lastMessage.createdAt).toLocaleDateString() : 'New'}
                        </span>
                      </div>
                      <p className={`text-sm truncate ${
                        conversation.unreadCount > 0 ? 'text-white font-medium' : 'text-gray-400'
                        }`}>
                        {conversation.lastMessage ? (
                          (() => {
                            const previewText = getMessagePreviewText(
                              conversation.lastMessage.content || '',
                              conversation.lastMessage.attachment || null,
                              conversation.lastMessage.type
                            );

                            const attachmentType = conversation.lastMessage.type;
                            const showIcon = Boolean(
                              conversation.lastMessage.attachment ||
                              attachmentType === 'IMAGE' ||
                              attachmentType === 'VIDEO' ||
                              attachmentType === 'AUDIO' ||
                              attachmentType === 'FILE'
                            );

                            const PreviewIcon = attachmentType === 'IMAGE'
                              ? ImageIcon
                              : attachmentType === 'VIDEO'
                                ? Video
                                : attachmentType === 'AUDIO'
                                  ? FileText
                                  : FileText;

                            return showIcon ? (
                              <span className="inline-flex items-center gap-1.5 truncate">
                                <PreviewIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="truncate">{previewText || 'File'}</span>
                              </span>
                            ) : (
                              previewText || 'Start a conversation...'
                            );
                          })()
                        ) : 'Start a conversation...'}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
            {loadingMore && (
              <div className="text-center text-xs text-gray-400 py-3">Loading more...</div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        {selectedChat && currentConversation ? (
          <div className={`${selectedChat ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 overflow-hidden bg-gradient-to-b from-gray-900/30 to-gray-950/60`}>
            {/* Chat Header */}
            <div className="bg-gray-900/85 backdrop-blur-xl border-b border-gray-700/50 px-3 py-2.5 md:px-4 md:py-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedChat(null)}
                    className="md:hidden p-2 bg-white/10 hover:bg-white/20 rounded-2xl transition-all duration-300"
                  >
                    <ArrowLeft className="w-5 h-5 text-white" />
                  </button>

                  <div className="relative">
                    <OptimizedImage
                      src={currentConversation.otherUser.profilePhoto1 || '/default-avatar.png'}
                      alt={currentConversation.otherUser.name || 'User'}
                      width={40}
                      height={40}
                      className="w-10 h-10 object-cover rounded-full ring-2 ring-pink-500/30"
                    />
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-gray-900 ${
                      selectedUserOnline ? 'bg-emerald-400' : 'bg-slate-500'
                    }`} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="font-semibold text-white truncate">{currentConversation.otherUser.name}</h3>
                      {isCurrentConversationLocked ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100">
                          <Lock className="h-3 w-3" />
                          Locked
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-gray-400">
                      {typingStatus[currentConversation.otherUser.id]
                        ? 'Typing...'
                        : selectedUserOnline
                          ? 'Online'
                          : selectedUserLastSeenLabel
                            ? `Last seen ${selectedUserLastSeenLabel}`
                            : 'Offline'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => void startOutgoingCall('audio')}
                    disabled={callStatus !== 'idle'}
                    className={`p-2 md:p-2.5 backdrop-blur-xl border rounded-2xl transition-all duration-300 group ${
                      callStatus === 'idle'
                        ? hasPremiumCallAccess
                          ? 'bg-white/10 hover:bg-white/20 border-white/20 hover:border-white/30 hover:scale-105'
                          : 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-300/30 hover:border-amber-200/40 hover:scale-105'
                        : 'bg-white/5 border-white/10 text-gray-400 cursor-not-allowed'
                    }`}
                    title={hasPremiumCallAccess ? 'Start audio call' : 'Upgrade to Premium for audio calls'}
                  >
                    <Phone className="w-4 h-4 md:w-5 md:h-5 text-white group-hover:scale-110 transition-transform duration-300" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void startOutgoingCall('video')}
                    disabled={callStatus !== 'idle'}
                    className={`p-2 md:p-2.5 backdrop-blur-xl border rounded-2xl transition-all duration-300 group ${
                      callStatus === 'idle'
                        ? hasPremiumCallAccess
                          ? 'bg-white/10 hover:bg-white/20 border-white/20 hover:border-white/30 hover:scale-105'
                          : 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-300/30 hover:border-amber-200/40 hover:scale-105'
                        : 'bg-white/5 border-white/10 text-gray-400 cursor-not-allowed'
                    }`}
                    title={hasPremiumCallAccess ? 'Start video call' : 'Upgrade to Premium for video calls'}
                  >
                    <Video className="w-4 h-4 md:w-5 md:h-5 text-white group-hover:scale-110 transition-transform duration-300" />
                  </button>
                  <button className="hidden sm:inline-flex p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 hover:border-white/30 rounded-2xl transition-all duration-300 hover:scale-105 group">
                    <Info className="w-5 h-5 text-white group-hover:scale-110 transition-transform duration-300" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesListRef}
              className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 md:p-4 space-y-3 min-w-0"
            >
              {conversationLoading && !localMessagesData ? (
                <div className="flex justify-center items-center h-full">
                  <HeartBeatLoader message="Loading messages..." />
                </div>
              ) : (
                localMessagesData?.messages && localMessagesData.messages.map((message) => {
                  const messageReactions = Array.isArray(message.reactions) ? message.reactions : [];
                  const myReactionEmoji = messageReactions.find(
                    (reaction) => reaction.userId === currentUserId
                  )?.emoji;
                  const groupedReactionsMap = new Map<
                    string,
                    { emoji: string; count: number; reactedByMe: boolean }
                  >();
                  messageReactions.forEach((reaction) => {
                    if (!reaction?.emoji) return;
                    const current = groupedReactionsMap.get(reaction.emoji) || {
                      emoji: reaction.emoji,
                      count: 0,
                      reactedByMe: false,
                    };
                    current.count += 1;
                    if (reaction.userId === currentUserId) {
                      current.reactedByMe = true;
                    }
                    groupedReactionsMap.set(reaction.emoji, current);
                  });
                  const groupedReactions = Array.from(groupedReactionsMap.values());
                  const isReactionPickerOpen = activeReactionMessageId === message.id;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${message.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[82%] md:max-w-xl lg:max-w-2xl px-3.5 py-2.5 rounded-2xl ${
                        message.senderId === currentUserId
                          ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-br-md'
                          : 'bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-bl-md'
                        }`}>
                        {message.replyTo ? (
                          <div className={`mb-2 rounded-xl border-l-4 px-2.5 py-1.5 ${
                            message.senderId === currentUserId
                              ? 'bg-white/20 border-white/80'
                              : 'bg-black/25 border-pink-300/80'
                          }`}>
                            <p className={`text-[10px] font-semibold ${
                              message.senderId === currentUserId ? 'text-white' : 'text-pink-200'
                            }`}>
                              {getMessageAuthorLabel(message.replyTo.senderId)}
                            </p>
                            <p className={`text-xs truncate ${
                              message.senderId === currentUserId ? 'text-white/90' : 'text-white/80'
                            }`}>
                              {getMessagePreviewText(
                                message.replyTo.content || '',
                                message.replyTo.attachment || null,
                                message.replyTo.type
                              ) || 'Message'}
                            </p>
                          </div>
                        ) : null}
                        {message.attachment ? (
                          <div>
                            {renderMessageAttachment(message)}
                          </div>
                        ) : null}
                        {message.content?.trim() ? (
                          <p className={`text-sm whitespace-pre-wrap break-words ${message.attachment ? 'mt-2' : ''}`}>
                            {message.content}
                          </p>
                        ) : null}

                        {groupedReactions.length > 0 && (
                          <div className={`mt-2 flex flex-wrap gap-1.5 ${
                            message.senderId === currentUserId ? 'justify-end' : 'justify-start'
                          }`}>
                            {groupedReactions.map((reaction) => (
                              <button
                                key={`${message.id}-${reaction.emoji}`}
                                type="button"
                                onClick={() => toggleMessageReaction(message, reaction.emoji)}
                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 border text-xs transition-colors ${
                                  reaction.reactedByMe
                                    ? 'bg-white/90 text-gray-900 border-white'
                                    : message.senderId === currentUserId
                                      ? 'bg-white/20 text-white border-white/40 hover:bg-white/30'
                                      : 'bg-white/10 text-white border-white/25 hover:bg-white/20'
                                }`}
                              >
                                <span>{reaction.emoji}</span>
                                <span>{reaction.count}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        <div className={`flex items-center mt-1 gap-2 ${
                          message.senderId === currentUserId ? 'justify-end' : 'justify-start'
                          }`}>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveReactionMessageId((prev) => (prev === message.id ? null : message.id));
                              }}
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
                                message.senderId === currentUserId
                                  ? 'hover:bg-white/20 text-white/80'
                                  : 'hover:bg-white/10 text-white/70'
                              }`}
                              aria-label="React to message"
                            >
                              <Smile className="w-3.5 h-3.5" />
                            </button>
                            {isReactionPickerOpen && (
                              <div className={`absolute bottom-[calc(100%+8px)] z-20 flex items-center gap-1.5 rounded-full border border-white/25 bg-black/75 backdrop-blur-xl px-2 py-1.5 shadow-xl ${
                                message.senderId === currentUserId ? 'right-0' : 'left-0'
                              }`}>
                                {QUICK_MESSAGE_REACTIONS.map((emoji) => (
                                  <button
                                    key={`${message.id}-${emoji}`}
                                    type="button"
                                    onClick={() => toggleMessageReaction(message, emoji)}
                                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm transition-colors ${
                                      myReactionEmoji === emoji
                                        ? 'bg-white text-gray-900'
                                        : 'hover:bg-white/20 text-white'
                                    }`}
                                    aria-label={`React with ${emoji}`}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleReplyToMessage(message)}
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors ${
                              message.senderId === currentUserId
                                ? 'hover:bg-white/20 text-white/80'
                                : 'hover:bg-white/10 text-white/70'
                            }`}
                            aria-label="Reply to message"
                          >
                            <Reply className="w-3.5 h-3.5" />
                          </button>
                          <span className={`text-xs ${
                            message.senderId === currentUserId ? 'text-white/70' : 'text-gray-400'
                            }`}>
                            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {message.senderId === currentUserId && (
                            <div className="ml-2">
                              {message.isRead ? (
                                <CheckCheck className="w-3 h-3 text-white/70" />
                              ) : (
                                <Check className="w-3 h-3 text-white/50" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="bg-gray-900/85 backdrop-blur-xl border-t border-gray-700/50 px-3 py-2.5 md:p-4 flex-shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 10px)' }}>
              {isCurrentConversationLocked && (
                <div className="mb-2.5 rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-3 text-amber-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-100">Chat Locked</p>
                      <p className="mt-1 text-sm text-amber-50/90">{currentConversationLockMessage}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/premium')}
                      className="inline-flex shrink-0 items-center justify-center rounded-full border border-amber-200/30 bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-white/15"
                    >
                      Upgrade
                    </button>
                  </div>
                </div>
              )}
              {replyingTo && (
                <div className="mb-2.5 rounded-xl border border-pink-300/35 bg-pink-500/10 px-3 py-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-pink-200">
                      Replying to {getMessageAuthorLabel(replyingTo.senderId)}
                    </p>
                    <p className="text-xs text-white/85 truncate">
                      {getMessagePreviewText(
                        replyingTo.content || '',
                        replyingTo.attachment || null,
                        replyingTo.type
                      ) || 'Message'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
                    aria-label="Cancel reply"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {pendingAttachment && (
                <div className="mb-2.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex items-center gap-2 text-white">
                    <Paperclip className="w-4 h-4 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{pendingAttachment.attachment.fileName}</p>
                      <p className="text-[10px] text-white/70">
                        {getAttachmentPreviewText(pendingAttachment.type, pendingAttachment.attachment)} • {formatBytes(pendingAttachment.attachment.fileSize)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingAttachment(null);
                    }}
                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {isRecordingVoice && (
                <div className="mb-2.5 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-rose-100">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-400 animate-pulse" />
                    <span className="text-xs font-medium">Recording voice note...</span>
                  </div>
                  <span className="text-xs font-mono text-rose-100">{formatRecordingTime(recordingSeconds)}</span>
                </div>
              )}
              <div className="flex items-end gap-2 min-w-0">
                <input
                  ref={attachmentInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleAttachmentChange}
                />

                <div className="flex-1 relative min-w-0">
                  <div className="relative h-12 rounded-full border border-slate-600/70 bg-slate-900/85 backdrop-blur-xl pl-2.5 pr-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmojiPicker((prev) => !prev);
                      }}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <Smile className="w-5 h-5" />
                    </button>

                    <input
                      ref={composerInputRef}
                      type="text"
                      placeholder={isCurrentConversationLocked ? 'This chat is locked on Free plan' : 'Message'}
                      value={newMessage}
                      onChange={(e) => handleTypingChange(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !isRecordingVoice && handleSendMessage()}
                      disabled={isCurrentConversationLocked}
                      className="flex-1 h-full bg-transparent text-white placeholder-slate-300 focus:outline-none min-w-0 disabled:cursor-not-allowed disabled:text-slate-500"
                    />

                    <button
                      type="button"
                      onClick={handleAttachmentButtonClick}
                      disabled={isUploadingAttachment || isRecordingVoice || isCurrentConversationLocked}
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
                        !isUploadingAttachment && !isRecordingVoice && !isCurrentConversationLocked
                          ? 'text-slate-300 hover:text-white hover:bg-white/10'
                          : 'text-gray-500 cursor-not-allowed'
                      }`}
                      aria-label="Attach file"
                    >
                      {isUploadingAttachment ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Paperclip className="w-5 h-5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleStickerButtonClick}
                      disabled={isUploadingAttachment || isRecordingVoice || isCurrentConversationLocked}
                      className={`inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
                        !isUploadingAttachment && !isRecordingVoice && !isCurrentConversationLocked
                          ? 'text-slate-300 hover:text-white hover:bg-white/10'
                          : 'text-gray-500 cursor-not-allowed'
                      }`}
                      aria-label="Open sticker library"
                    >
                      <Sticker className="w-5 h-5" />
                    </button>
                  </div>

                  {showEmojiPicker && (
                    <div className="absolute bottom-[calc(100%+10px)] left-0 w-[300px] max-w-[92vw] rounded-2xl border border-slate-600/70 bg-slate-900/95 backdrop-blur-xl p-3 shadow-2xl z-30">
                      <div className="grid grid-cols-8 gap-1.5">
                        {QUICK_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleInsertEmoji(emoji)}
                            className="h-8 w-8 rounded-lg hover:bg-white/10 text-lg leading-none transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handlePrimaryComposerAction}
                  disabled={primaryActionDisabled}
                  className={`inline-flex items-center justify-center h-12 w-12 rounded-full border flex-shrink-0 transition-colors ${
                    isRecordingVoice
                      ? 'bg-rose-500/25 border-rose-400/50 text-rose-100 hover:bg-rose-500/35'
                      : hasComposerPayload
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 border-transparent text-white shadow-lg shadow-pink-500/25 hover:from-pink-400 hover:to-purple-500'
                        : !primaryActionDisabled
                          ? 'bg-[#F18668] border-transparent text-gray-900 hover:bg-[#f09a80]'
                          : 'bg-slate-800/55 border-slate-700/60 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isRecordingVoice ? (
                    <Square className="w-4 h-4 fill-current" />
                  ) : hasComposerPayload ? (
                    <Send className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="bg-gradient-to-r from-pink-500/20 to-purple-600/20 backdrop-blur-xl border border-pink-500/30 rounded-3xl p-8 max-w-md">
                <MessageCircle className="w-16 h-16 text-pink-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Select a Conversation</h3>
                <p className="text-gray-400">Choose a conversation from the sidebar to start messaging</p>
              </div>
            </div>
          </div>
        )}
      </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white overflow-x-hidden no-horizontal-scroll dashboard-main">
      {isDesktopLayout ? (
        <div className="min-h-screen flex">
          <div className="w-80 flex-shrink-0">
            <SidePanel userName={layoutName} userImage={layoutImage} user={layoutUser} onClose={() => setShowSidePanel(false)} />
          </div>
          <div className="flex-1 flex flex-col min-h-screen min-w-0">
            <TopBar
              userName={layoutName}
              userImage={layoutImage}
              user={layoutUser}
              showFilters={false}
              showSidePanel={showSidePanel}
              onToggleFilters={() => {}}
              onToggleSidePanel={() => setShowSidePanel(false)}
              title="Messages"
            />
            <div className="flex-1 min-h-0">{mainContent}</div>
          </div>
        </div>
      ) : (
        <div className="min-h-screen flex flex-col">
          <TopBar
            userName={layoutName}
            userImage={layoutImage}
            user={layoutUser}
            showFilters={false}
            showSidePanel={showSidePanel}
            onToggleFilters={() => {}}
            onToggleSidePanel={() => setShowSidePanel(true)}
            title="Messages"
          />
          <div className="flex-1 min-h-0">{mainContent}</div>
        </div>
      )}

      {!isDesktopLayout && showSidePanel && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowSidePanel(false)}
          />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw]">
            <SidePanel
              userName={layoutName}
              userImage={layoutImage}
              user={layoutUser}
              onClose={() => setShowSidePanel(false)}
            />
          </div>
        </div>
      )}

      <audio ref={remoteCallAudioRef} autoPlay playsInline className="hidden" />
      {renderAttachmentViewer()}
      {renderMediaLibrary()}
      {renderCallLayer()}
    </div>
  );
};

const MessagesPage = () => {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white">Loading messages...</div>
      </div>
    }>
      <MessagesContent />
    </Suspense>
  );
};

// Final component for export, wrapped in the protective component
export default function ProtectedMessages() {
  return (
    <ProtectedRoute>
      <MessagesPage />
    </ProtectedRoute>
  );
}

