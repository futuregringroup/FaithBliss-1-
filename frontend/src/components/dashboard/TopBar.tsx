// src/components/TopBar.tsx (Vite/React Conversion)

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { Bell, Filter, ArrowLeft, Download } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useNotificationUnreadCount } from '@/hooks/useAPI';
import { useRequireAuth } from '@/hooks/useAuth';
import ProfileBoosterIcon from '@/components/icons/ProfileBoosterIcon';

const NOTIFICATION_PROMPT_STORAGE_KEY_PREFIX = 'faithbliss_notification_prompt_seen';

// Capture the beforeinstallprompt event at module load time so it is never
// missed due to component mount timing. React Router's history.replaceState
// calls can prevent the event from firing in some browsers (Samsung Internet);
// capturing it here — before any navigation occurs — maximises the chance it
// is caught. The stored event is consumed when the user taps "Install app".
let _cachedInstallPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    _cachedInstallPrompt = e as BeforeInstallPromptEvent;
    // Dispatch a custom event so any already-mounted TopBar instances re-render.
    window.dispatchEvent(new Event('faithbliss:installprompt'));
  });
}

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

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
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

  // Samsung Internet identifies itself in the UA — it supports PWA install via
  // the URL bar "+" icon but often doesn't fire beforeinstallprompt reliably.
  const isSamsungInternet = typeof navigator !== 'undefined' && /SamsungBrowser/i.test(navigator.userAgent);
  const [notificationsAvailable, setNotificationsAvailable] = useState(false);
  const [notificationsPermission, setNotificationsPermission] = useState<'default' | 'granted' | 'denied'>('default');
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [showMobileProfileMenu, setShowMobileProfileMenu] = useState(false);
  // Seed from the module-level cache so the button appears even if the event
  // fired before this component mounted (common when navigating to /dashboard).
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(_cachedInstallPrompt);
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
    if (typeof window === 'undefined') return;

    // Pick up the event if it fired after this component mounted.
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      _cachedInstallPrompt = event as BeforeInstallPromptEvent;
      setInstallPromptEvent(event as BeforeInstallPromptEvent);
    };

    // Pick up the event if it fired before this component mounted
    // (relayed via the module-level listener above).
    const onCachedPrompt = () => {
      if (_cachedInstallPrompt) setInstallPromptEvent(_cachedInstallPrompt);
    };

    const onInstalled = () => {
      _cachedInstallPrompt = null;
      setInstallPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
    window.addEventListener('faithbliss:installprompt', onCachedPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
      window.removeEventListener('faithbliss:installprompt', onCachedPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
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
      if (storageKey) {
        localStorage.setItem(storageKey, '1');
      }
      setShowNotificationPrompt(false);
      return;
    }
    if (Notification.permission === 'denied') {
      setNotificationsPermission('denied');
      if (storageKey) {
        localStorage.setItem(storageKey, '1');
      }
      setShowNotificationPrompt(false);
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationsPermission(permission);
      if (storageKey) {
        localStorage.setItem(storageKey, '1');
      }
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
    if (!installPromptEvent || isInstallPrompting) return;
    try {
      setIsInstallPrompting(true);
      await installPromptEvent.prompt();
      await installPromptEvent.userChoice;
    } catch {
      // noop
    } finally {
      setIsInstallPrompting(false);
      _cachedInstallPrompt = null;
      setInstallPromptEvent(null);
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
    <div className="sticky top-0 z-50 border-b border-gray-700/50 bg-gray-900/80 px-2.5 py-2 sm:px-4 sm:py-4 backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-pink-500/5 via-purple-500/5 to-blue-500/5"></div>

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-1.5 sm:gap-3">
          <div className="flex items-center gap-0">
            {showBackButton ? (
              <button
                type="button"
                onClick={onBack}
                className="p-2 hover:bg-white/10 rounded-2xl transition-all hover:scale-105"
              >
                <ArrowLeft className="w-6 h-6 text-gray-300" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSidePanelToggle}
                aria-label={showSidePanel ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={showSidePanel}
                className="relative z-20 shrink-0 p-1.5 sm:p-2 hover:bg-white/10 rounded-2xl transition-all hover:scale-105 lg:hidden"
              >
                <div className="w-6 h-6 flex flex-col justify-center space-y-1">
                  <div className="w-full h-0.5 bg-gray-300 rounded"></div>
                  <div className="w-full h-0.5 bg-gray-300 rounded"></div>
                  <div className="w-full h-0.5 bg-gray-300 rounded"></div>
                </div>
              </button>
            )}

            <Link
              to="/dashboard"
              className="ml-0.5 flex items-center transition-opacity hover:opacity-80 sm:-ml-6"
            >
              <img
                src="/FaithBliss-Logo%20Source.svg"
                alt="FaithBliss"
                className="-mt-1.5 h-10 w-28 shrink-0 object-cover object-left sm:-mt-2 sm:h-14 sm:w-44"
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

          <div className="relative flex items-center justify-end gap-0.5 sm:gap-2">
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

            {installPromptEvent && !isSamsungInternet && (
              <button
                type="button"
                onClick={handleInstallApp}
                disabled={isInstallPrompting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold tracking-wide bg-pink-500/20 text-pink-100 hover:bg-pink-500/30 border border-pink-300/30 transition-all disabled:opacity-70"
              >
                <Download className="w-3.5 h-3.5" />
                {isInstallPrompting ? 'Installing...' : 'Install app'}
              </button>
            )}

            {isSamsungInternet && !installPromptEvent && (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold tracking-wide bg-pink-500/20 text-pink-100 border border-pink-300/30">
                <Download className="w-3.5 h-3.5" />
                Tap + in address bar to install
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
              <button type="button" className="group relative rounded-2xl p-1.5 transition-all hover:scale-105 hover:bg-white/10 sm:p-3">
                <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300 group-hover:text-white transition-colors" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-pink-500 to-red-500 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{unreadCount}</span>
                  </span>
                )}
              </button>
            </Link>

            {showMobileBoosterShortcut && (
              <Link to="/premium" className="sm:hidden">
                <button
                  type="button"
                  className="relative inline-flex rounded-2xl p-1.5 text-fuchsia-100 transition-all hover:scale-105 hover:bg-white/10"
                  aria-label={profileBoosterActive ? 'Profile boost active' : `You have ${profileBoosterCredits} booster credits`}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(236,72,153,0.28),rgba(124,58,237,0.22))] shadow-[0_10px_18px_rgba(168,85,247,0.18)]">
                    <ProfileBoosterIcon className="h-4 w-4" glowId="topbar-booster-mobile" />
                  </div>
                  <span className={`absolute -right-1 -top-1 min-w-[1rem] rounded-full px-1 py-[2px] text-[10px] font-bold leading-none ${
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
                  className={`inline-flex rounded-2xl p-1.5 transition-all hover:scale-105 sm:hidden ${
                    showFilters
                      ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                      : 'hover:bg-white/10 text-gray-300 hover:text-white'
                  }`}
                  aria-label={showFilters ? 'Close filters' : 'Open filters'}
                >
                  <Filter className="w-5 h-5 transition-colors" />
                </button>

                <button
                  type="button"
                  onClick={onToggleFilters}
                  className={`hidden sm:inline-flex p-2 sm:p-3 rounded-2xl transition-all hover:scale-105 ${
                    showFilters
                      ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                      : 'hover:bg-white/10 text-gray-300 hover:text-white'
                  }`}
                  aria-label={showFilters ? 'Close filters' : 'Open filters'}
                >
                  <Filter className="w-5 h-5 sm:w-6 sm:h-6 transition-colors" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setShowMobileProfileMenu((prev) => !prev)}
              className="group rounded-2xl p-1.5 transition-all hover:scale-105 hover:bg-white/10 sm:p-3 lg:hidden"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-purple-600 sm:h-8 sm:w-8">
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
                className="absolute top-full right-0 mt-2 w-44 rounded-xl border border-white/15 bg-gray-900/95 backdrop-blur-xl shadow-xl p-1 lg:hidden"
              >
                <Link
                  to="/profile"
                  onClick={() => setShowMobileProfileMenu(false)}
                  className="block w-full px-3 py-2 text-sm text-gray-200 hover:bg-white/10 rounded-lg"
                >
                  Profile
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    setShowMobileProfileMenu(false);
                    await logout();
                  }}
                  className="block w-full text-left px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 rounded-lg"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {showNotificationPrompt && (
          <div className="mt-3 rounded-[1.4rem] border border-white/15 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-3 shadow-[0_18px_36px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:mt-4 sm:p-4">
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
  );
};
