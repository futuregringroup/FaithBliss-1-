/* eslint-disable @typescript-eslint/no-explicit-any */
// src/pages/Notifications.tsx

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Check,
  Heart,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useNotifications, useClearApiCache, type NotificationItem } from '@/hooks/useAPI';
import { dispatchNotificationsUpdated, getNotificationDestination } from '@/lib/notificationCenter';
import { API } from '@/services/api';
import { HeartBeatLoader } from '@/components/HeartBeatLoader';
import { useToast } from '@/contexts/ToastContext';
import { TopBar } from '@/components/dashboard/TopBar';
import { SidePanel } from '@/components/dashboard/SidePanel';
import { useAuthContext } from '@/contexts/AuthContext';

 

const typeMeta = (type?: string) => {
  switch (type) {
    case 'PROFILE_LIKED':
      return { label: 'New Like', icon: Heart, color: 'from-rose-500 to-amber-500' };
    case 'NEW_MATCH':
      return { label: 'New Match', icon: Sparkles, color: 'from-emerald-500 to-cyan-500' };
    case 'NEW_MESSAGE':
      return { label: 'New Message', icon: MessageCircle, color: 'from-blue-500 to-teal-500' };
    case 'STORY_POSTED':
      return { label: 'New Story', icon: Sparkles, color: 'from-fuchsia-500 to-indigo-500' };
    case 'REPORT_SUBMITTED':
      return { label: 'Reported Issue', icon: AlertTriangle, color: 'from-orange-500 to-rose-500' };
    case 'SUPPORT_REPLY':
      return { label: 'Support Reply', icon: MessageCircle, color: 'from-cyan-500 to-blue-500' };
    default:
      return { label: 'Notification', icon: Bell, color: 'from-slate-500 to-slate-600' };
  }
};

const formatTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const NotificationsContent = () => {
  const { showSuccess, showError } = useToast();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const clearCache = useClearApiCache();
  const { data, loading, error, refetch } = useNotifications();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [showSidePanel, setShowSidePanel] = useState(false);

  const userName = user?.name || 'User';
  const userImage = user?.profilePhoto1 || undefined;

  useEffect(() => {
    if (!Array.isArray(data)) return;
    setItems((prev) => {
      const prevMap = new Map(prev.map((item) => [item.id, item]));
      return data.map((item) => {
        const existing = prevMap.get(item.id);
        return existing ? { ...item, isRead: existing.isRead ?? item.isRead } : item;
      });
    });
  }, [data]);

  const unreadCount = useMemo(
    () => items.filter((item) => !item.isRead).length,
    [items]
  );

  const handleMarkAllRead = async () => {
    try {
      await API.Notification.markAllAsRead();
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      clearCache();
      dispatchNotificationsUpdated();
      showSuccess('All notifications marked as read');
    } catch (err: any) {
      showError(err?.message || 'Failed to mark notifications');
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await API.Notification.markAsRead(id);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      );
      clearCache();
      dispatchNotificationsUpdated();
    } catch (err: any) {
      showError(err?.message || 'Failed to mark notification');
    }
  };

  const handleOpenNotification = async (item: NotificationItem) => {
    if (!item) return;
    if (!item.isRead) {
      void handleMarkRead(item.id);
    }
    navigate(getNotificationDestination(item));
  };

  const handleEnableNotifications = async () => {
    if (!('Notification' in window)) {
      showError('Browser notifications are not supported on this device.');
      return;
    }
    if (Notification.permission === 'granted') {
      showSuccess('Notifications are already enabled.');
      return;
    }
    if (Notification.permission === 'denied') {
      showError('Notifications are blocked. Please enable them in your browser settings.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        showSuccess('Browser notifications enabled!');
      } else {
        showError('Notifications not enabled.');
      }
    } catch {
      showError('Unable to request notification permission.');
    }
  };

  const content = () => {
    if (loading) {
      return <HeartBeatLoader message="Loading notifications..." />;
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-full text-center p-8">
          <div className="max-w-md">
            <div className="mx-auto mb-6 w-16 h-16 rounded-3xl bg-gradient-to-br from-rose-500/80 to-amber-500/80 flex items-center justify-center shadow-lg">
              <Bell className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mb-2">Something went wrong</h2>
            <p className="text-sm text-slate-300 mb-6">
              We couldn’t load your notifications. Please try again.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => { void refetch(); }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-amber-400/80 to-emerald-400/80 text-slate-900 font-semibold hover:from-amber-300 hover:to-emerald-300 transition-all"
              >
                Try again
              </button>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-center p-8">
          <div className="max-w-md">
            <div className="mx-auto mb-6 w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-500/80 to-emerald-500/80 flex items-center justify-center shadow-lg">
              <Bell className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">All quiet for now</h2>
            <p className="text-sm text-slate-300 mb-6">
              Likes, matches, and messages will appear here as they happen.
            </p>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 transition-all"
            >
              Discover People
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-12 space-y-6">
        <div className="flex items-center justify-start">
          <Link
            to="/dashboard"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <div className="p-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-2">Overview</p>
            <h2 className="text-lg font-semibold">Your activity in one place</h2>
            <p className="text-sm text-slate-300 mt-2">
              Stay on top of likes, mutual matches, and messages. Every update arrives in real time.
            </p>
          </div>
          <div className="p-6 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-2">Status</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-emerald-400 flex items-center justify-center text-slate-900 font-bold">
                {unreadCount}
              </div>
              <div>
                <p className="text-sm font-semibold">Unread alerts</p>
                <p className="text-xs text-slate-300">Tap a card to mark it read</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Inbox</p>
            <p className="text-sm text-slate-300">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleEnableNotifications}
              className="px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 bg-white/10 hover:bg-white/20 border border-white/15"
            >
              Enable alerts
            </button>
            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 ${
                unreadCount > 0
                  ? 'bg-gradient-to-r from-amber-400/80 to-emerald-400/80 text-slate-900 hover:from-amber-300 hover:to-emerald-300'
                  : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
              }`}
            >
              Mark all read
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {items.map((item) => {
            const meta = typeMeta(item.type);
            const Icon = meta.icon;
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => handleOpenNotification(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleOpenNotification(item);
                  }
                }}
                className={`group flex items-start gap-4 p-5 rounded-3xl border transition-all duration-300 cursor-pointer ${
                  item.isRead
                    ? 'bg-white/5 border-white/10'
                    : 'bg-gradient-to-r from-white/15 to-white/5 border-amber-400/40 shadow-lg shadow-amber-500/10'
                }`}
              >
                <div className={`w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-br ${meta.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      {meta.label}
                    </span>
                    <span className="text-xs text-slate-400">{formatTime(item.createdAt)}</span>
                  </div>
                  <p className="text-sm text-slate-100 mt-2 leading-relaxed">
                    {item.message || 'You have a new notification.'}
                  </p>
                  {item.data?.senderName && (
                    <p className="text-xs text-slate-400 mt-2">From {item.data.senderName}</p>
                  )}
                </div>
                {!item.isRead && (
                  <button
                    onClick={() => handleMarkRead(item.id)}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClickCapture={(event) => event.stopPropagation()}
                    className="px-3 py-2 text-xs rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white pb-20 no-horizontal-scroll dashboard-main">
      {/* Desktop Layout */}
      <div className="hidden lg:flex min-h-screen">
        <div className="w-80 flex-shrink-0">
          <SidePanel userName={userName} userImage={userImage} user={user} onClose={() => setShowSidePanel(false)} />
        </div>
        <div className="flex-1 flex flex-col min-h-screen">
          <TopBar
            userName={userName}
            userImage={userImage}
            user={user}
            showFilters={false}
            showSidePanel={showSidePanel}
            onToggleFilters={() => {}}
            onToggleSidePanel={() => setShowSidePanel(false)}
            title="Notifications"
          />
          <div className="flex-1 overflow-y-auto">
            <div className="min-h-[calc(100vh-120px)]">{content()}</div>
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="lg:hidden min-h-screen">
        <TopBar
          userName={userName}
          userImage={userImage}
          user={user}
          showFilters={false}
          showSidePanel={showSidePanel}
          onToggleFilters={() => {}}
          onToggleSidePanel={() => setShowSidePanel(true)}
          title="Notifications"
        />
        <div className="flex-1">{content()}</div>
      </div>

      {showSidePanel && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowSidePanel(false)}
          />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw]">
            <SidePanel
              userName={userName}
              userImage={userImage}
              user={user}
              onClose={() => setShowSidePanel(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const NotificationsPage = () => (
  <ProtectedRoute>
    <NotificationsContent />
  </ProtectedRoute>
);

export default NotificationsPage;
