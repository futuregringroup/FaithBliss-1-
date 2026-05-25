// src/components/TopBar.tsx (Vite/React Conversion)

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { Bell, Filter, ArrowLeft, Download } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useNotificationUnreadCount } from '@/hooks/useAPI';
import { useRequireAuth } from '@/hooks/useAuth';
import ProfileBoosterIcon from '@/components/icons/ProfileBoosterIcon';
import {
  consumeInstallPrompt,
  getCachedInstallPrompt,
  subscribeInstallPrompt,
} from '@/lib/installPrompt';

const NOTIFICATION_PROMPT_STORAGE_KEY_PREFIX = 'faithbliss_notification_prompt_seen';

interface TopBarProps {
  userName: string;
  userImage?: string;
  user?: any;
  showFilterButton?: boolean;
  showFilters?: boolean;
  showSidePanel?: boolean;
  onToggleFilters?: () => void;
  onToggleSidePanel?: () => void;
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

export const TopBar = ({
  userName,
  userImage,
  user,
  showFilterButton = false,
  showFilters = false,
  showSidePanel = false,
  onToggleFilters,
  onToggleSidePanel,
  title,
  showBackButton = false,
  onBack,
}: TopBarProps) => {
  const location = useLocation();
  const displayImage = user?.profilePhotos?.photo1 || userImage || '/default-avatar.png';
  const { data: unreadData } = useNotificationUnreadCount();
  const unreadCount = unreadData?.count || 0;
  const { logout } = useRequireAuth();
  const profileBoosterCredits = typeof user?.profileBoosterCredits === 'number' ? user.profileBoosterCredits : 0;
  const profileBoosterActive = typeof user?.profileBoosterActiveUntil === 'string'
    && Date.parse(user.profileBoosterActiveUntil) > Date.now();
  const showMobileBoosterShortcut = Boolean(user) && location.pathname !== '/premium';
  const notificationPromptUserKey =
    user?.id || user?.firebaseUid || user?.email || userName.trim().toLowerCase() || null;

  const isSamsungInternet = typeof navigator !== 'undefined' && /SamsungBrowser/i.test(navigator.userAgent);
  const [notificationsAvailable, setNotificationsAvailable] = useState(false);
  const [notificationsPermission, setNotificationsPermission] = useState<'default' | 'granted' | 'denied'>('default');
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [showMobileProfileMenu, setShowMobileProfileMenu] = useState(false);
  const [promptAvailable, setPromptAvailable] = useState<boolean>(!!getCachedInstallPrompt());
  const [isInstallPrompting, setIsInstallPrompting] = useState(false);
  const mobileProfileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    setNotificationsAvailable(true);
    setNotificationsPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!notificationsAvailable || !notificationPromptUserKey) {
      setShowNotificationPrompt(false);
      return;
    }

    const storageKey = `${NOTIFICATION_PROMPT_STORAGE_KEY_PREFIX}:${String(notificationPromptUserKey)}`;
    const hasSeenPrompt = localStorage.getItem(storageKey) === '1';
    const shouldShowPrompt = Notification.permission === 'default' && !hasSeenPrompt;
    setShowNotificationPrompt(shouldShowPrompt);
  }, [notificationPromptUserKey, notificationsAvailable, notificationsPermission]);

  useEffect(() => {
    return subscribeInstallPrompt(() => {
      setPromptAvailable(!!getCachedInstallPrompt());
    });
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (mobileProfileMenuRef.current && !mobileProfileMenuRef.current.contains(target)) {
        setShowMobileProfileMenu(false);
      }
    };

    if (showMobileProfileMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showMobileProfileMenu]);

  const handleEnableNotifications = async () => {
    if (!notificationsAvailable) return;
    const storageKey = notificationPromptUserKey
      ? `${NOTIFICATION_PROMPT_STORAGE_KEY_PREFIX}:${String(notificationPromptUserKey)}`
      : null;
    if (Notification.permission === 'granted') {
      setNotificationsPermission('granted');
      if (storageKey) localStorage.setItem(storageKey, '1');
      setShowNotificationPrompt(false);
      return;
    }
    if (Notification.permission === 'denied') {
      setNotificationsPermission('denied');
      if (storageKey) localStorage.setItem(storageKey, '1');
      setShowNotificationPrompt(false);
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationsPermission(permission);
      if (storageKey) localStorage.setItem(storageKey, '1');
      setShowNotificationPrompt(false);
    } catch {
      // ignore
    }
  };

  const handleDismissNotificationPrompt = () => {
    if (typeof window !== 'undefined' && notificationPromptUserKey) {
      const storageKey = `${NOTIFICATION_PROMPT_STORAGE_KEY_PREFIX}:${String(notificationPromptUserKey)}`;
      localStorage.setItem(storageKey, '1');
    }
    setShowNotificationPrompt(false);
  };

  const handleInstallApp = async () => {
    if (!promptAvailable || isInstallPrompting) return;
    setIsInstallPrompting(true);
    try {
      await consumeInstallPrompt();
    } finally {
      setIsInstallPrompting(false);
    }
  };

  const subtitleText = title
    ? title === 'My Profile'
      ? `Edit your profile, ${userName}`
      : `${title} page`
    : userName;
  const showTitleBlock = Boolean(title);
  const handleSidePanelToggle = () => {
    setShowMobileProfileMenu(false);
    onToggleSidePanel?.();
  };

  return (
    <>
      <div className="sticky top-0 z-50 border-b border-white/8 bg-gray-950/85 px-6 py-2 sm:px-8 xl:px-10 2xl:px-12 sm:py-3 backdrop-blur-2xl transition-shadow duration-300">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-pink-500/4 via-transparent to-purple-500/4" />

        <div className="relative z-10 w-full">
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-0">
              {showBackButton ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="p-2 hover:bg-white/10 rounded-2xl transition-all active:scale-95"
                >
                  <ArrowLeft className="w-6 h-6 text-gray-300" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSidePanelToggle}
                  aria-label={showSidePanel ? 'Close navigation menu' : 'Open navigation menu'}
                  aria-expanded={showSidePanel}
                  className={`relative z-20 shrink-0 p-1.5 sm:p-2 hover:bg-white/10 rounded-2xl transition-all active:scale-95 lg:hidden${showSidePanel ? ' is-open' : ''}`}
                >
                  <div className="w-6 h-6 flex flex-col justify-center gap-[5px]">
                    <span className="hamburger-bar" />
                    <span className="hamburger-bar" />
                    <span className="hamburger-bar" />
                  </div>
                </button>
              )}

              <Link
                to="/dashboard"
                className="flex items-center transition-opacity hover:opacity-75 active:opacity-60"
              >
                <img
                  src="/FaithBliss-Logo%20Source.svg"
                  alt="FaithBliss"
                  className="-mt-1 h-10 w-28 shrink-0 object-cover object-left sm:-mt-2 sm:h-14 sm:w-44"
                  loading="eager"
                  decoding="async"
                />
              </Link>
            </div>

            {showTitleBlock ? (
              <div className="min-w-0">
                <h1 className="truncate text-center text-[15px] font-bold text-white sm:text-left sm:text-xl">
                  {title}
                </h1>
                <p className="text-xs text-gray-400 hidden md:block truncate">
                  {subtitleText}
                </p>
              </div>
            ) : <div />}

            <div className="relative flex items-center justify-end gap-1 sm:gap-2">
              {user && (
                <Link
                  to="/premium"
                  className="hidden sm:inline-flex items-center gap-2 rounded-full border border-fuchsia-300/20 bg-[linear-gradient(135deg,rgba(236,72,153,0.14),rgba(124,58,237,0.12))] px-3 py-2 text-xs font-semibold text-white transition hover:border-fuchsia-200/30 hover:bg-[linear-gradient(135deg,rgba(236,72,153,0.18),rgba(124,58,237,0.16))]"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/20">
                    <ProfileBoosterIcon className="h-4 w-4" glowId="topbar-booster" />
                  </div>
                  <span className={profileBoosterActive ? 'animate-[pulse_2.4s_ease-in-out_infinite]' : ''}>
                    {profileBoosterActive ? 'Boost Live' : `${profileBoosterCredits} Boost${profileBoosterCredits === 1 ? '' : 's'}`}
                  </span>
                </Link>
              )}

              {isSamsungInternet && !promptAvailable && (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-pink-300/30 bg-pink-500/20 px-3 py-2 text-xs font-semibold tracking-wide text-pink-100">
                  <Download className="h-3.5 w-3.5" />
                  Tap ⋮ › Install App
                </span>
              )}

              {notificationsAvailable && notificationsPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={handleEnableNotifications}
                  className="hidden md:inline-flex items-center px-3 py-2 rounded-full text-xs font-semibold tracking-wide bg-white/10 hover:bg-white/20 border border-white/15 transition-all"
                >
                  Enable alerts
                </button>
              )}

              <Link to="/notifications">
                <button
                  type="button"
                  className="group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all hover:bg-white/10 active:bg-white/15 active:scale-95"
                  aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
                >
                  <Bell className="h-5 w-5 text-slate-300 transition-colors group-hover:text-white" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-rose-500 shadow-[0_4px_10px_rgba(236,72,153,0.4)]">
                      <span className="text-[9px] font-bold leading-none text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>
                    </span>
                  )}
                </button>
              </Link>

              {showMobileBoosterShortcut && (
                <Link to="/premium" className="sm:hidden">
                  <button
                    type="button"
                    className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl text-fuchsia-100 transition-all hover:bg-white/10 active:scale-95"
                    aria-label={profileBoosterActive ? 'Profile boost active' : `You have ${profileBoosterCredits} booster credits`}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(236,72,153,0.28),rgba(124,58,237,0.22))] shadow-[0_10px_18px_rgba(168,85,247,0.18)]">
                      <ProfileBoosterIcon className="h-4 w-4" glowId="topbar-booster-mobile" />
                    </div>
                    <span className={`absolute right-1 top-1 min-w-[1rem] rounded-full px-1 py-[2px] text-[10px] font-bold leading-none ${
                      profileBoosterActive
                        ? 'animate-[pulse_2.2s_ease-in-out_infinite] bg-emerald-500 text-white shadow-[0_0_0_4px_rgba(16,185,129,0.16)]'
                        : 'bg-fuchsia-500 text-white'
                    }`}>
                      {profileBoosterActive ? '!' : profileBoosterCredits}
                    </span>
                  </button>
                </Link>
              )}

              {showFilterButton && onToggleFilters && (
                <>
                  <button
                    type="button"
                    onClick={onToggleFilters}
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-all active:scale-95 sm:hidden ${
                      showFilters
                        ? 'border border-pink-500/30 bg-pink-500/20 text-pink-400'
                        : 'text-gray-300 hover:bg-white/10 hover:text-white'
                    }`}
                    aria-label={showFilters ? 'Close filters' : 'Open filters'}
                  >
                    <Filter className="h-5 w-5 transition-colors" />
                  </button>

                  <button
                    type="button"
                    onClick={onToggleFilters}
                    className={`hidden sm:inline-flex h-11 w-11 items-center justify-center rounded-2xl transition-all active:scale-95 ${
                      showFilters
                        ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                        : 'hover:bg-white/10 text-gray-300 hover:text-white'
                    }`}
                    aria-label={showFilters ? 'Close filters' : 'Open filters'}
                  >
                    <Filter className="w-5 h-5 transition-colors" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setShowMobileProfileMenu((prev) => !prev)}
                className="group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all hover:bg-white/10 active:scale-95 lg:hidden"
                aria-label="Profile menu"
                aria-expanded={showMobileProfileMenu}
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-600 ring-2 transition-all duration-200 ${showMobileProfileMenu ? 'ring-pink-400/60' : 'ring-transparent'}`}>
                  {displayImage ? (
                    <img
                      src={displayImage}
                      alt={userName}
                      className="rounded-full w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-sm">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              </button>

              {showMobileProfileMenu && (
                <div
                  ref={mobileProfileMenuRef}
                  className="absolute top-full right-0 mt-2 w-48 rounded-2xl border border-white/12 bg-gray-950/96 backdrop-blur-2xl shadow-[0_20px_60px_rgba(2,6,23,0.5)] p-1.5 lg:hidden animate-fade-in"
                >
                  <Link
                    to="/profile"
                    onClick={() => setShowMobileProfileMenu(false)}
                    className="block w-full px-3 py-2.5 text-sm text-gray-200 hover:bg-white/10 rounded-xl transition-colors"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      setShowMobileProfileMenu(false);
                      await logout();
                    }}
                    className="block w-full text-left px-3 py-2.5 text-sm text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          {showNotificationPrompt && (
            <div className="mt-2 rounded-2xl border border-pink-400/15 bg-[linear-gradient(135deg,rgba(236,72,153,0.08),rgba(124,58,237,0.06))] p-3 backdrop-blur-xl sm:mt-3 sm:rounded-[1.4rem] sm:p-4">
              <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-pink-300/20 bg-pink-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-pink-100">
                    <Bell className="h-3.5 w-3.5" />
                    Notifications
                  </div>
                  <p className="mt-2 text-sm font-semibold text-white sm:text-base">
                    Stay informed about new matches, messages, and important updates.
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300 sm:text-sm">
                    Allow FaithBliss to send browser notifications so you never miss meaningful activity.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:shrink-0">
                  <button
                    type="button"
                    onClick={handleEnableNotifications}
                    className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(217,70,239,0.22)] transition hover:-translate-y-0.5 hover:from-pink-400 hover:via-fuchsia-400 hover:to-violet-400"
                  >
                    Allow notifications
                  </button>
                  <button
                    type="button"
                    onClick={handleDismissNotificationPrompt}
                    className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white"
                  >
                    Not now
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Install app banner — rendered below header, not inside the icon cluster */}
      {promptAvailable && (
        <div className="relative z-40 flex items-center justify-between gap-3 border-b border-pink-400/15 bg-[linear-gradient(135deg,rgba(236,72,153,0.1),rgba(124,58,237,0.08))] px-4 py-2.5 backdrop-blur-md">
          <span className="text-xs font-medium text-pink-100">
            Get the full app experience on your device
          </span>
          <button
            type="button"
            onClick={handleInstallApp}
            disabled={isInstallPrompting}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(236,72,153,0.3)] transition hover:brightness-110 disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            {isInstallPrompting ? 'Installing...' : 'Install App'}
          </button>
        </div>
      )}
    </>
  );
};
