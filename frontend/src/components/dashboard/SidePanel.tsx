import { Link, useLocation } from 'react-router-dom';
import type { User as AppUser } from '@/types/User';
import {
  AlertTriangle,
  Bell,
  Compass,
  Crown,
  Heart,
  HelpCircle,
  Home,
  LogOut,
  MessageCircle,
  Settings,
  ShieldCheck,
  Wrench,
  Star,
  User,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNotificationUnreadCount, useUnreadCount } from '@/hooks/useAPI';
import { useSubscriptionDisplay } from '@/hooks/useSubscriptionDisplay';
import ProfileBoosterIcon from '@/components/icons/ProfileBoosterIcon';

interface SidePanelProps {
  userName: string;
  userImage?: string;
  user?: AppUser | null;
  onClose: () => void;
}

export const SidePanel = ({ userName, userImage, user, onClose }: SidePanelProps) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  const { logout, isLoggingOut } = useAuthContext();
  const { data: unreadData } = useNotificationUnreadCount();
  const { data: unreadMessagesData } = useUnreadCount();
  const extraRoles = Array.isArray(user?.roles)
    ? user.roles.map((role) => String(role).trim().toLowerCase()).filter(Boolean)
    : [];
  const unreadCount = unreadData?.count || 0;
  const unreadMessageCount = unreadMessagesData?.count || 0;
  const displayImage = user?.profilePhoto1 || userImage || '/default-avatar.png';
  const faithJourney = user?.faithJourney || 'Passionate Believer';
  const subscriptionDisplay = useSubscriptionDisplay(user);
  const isAdminUser = String(user?.role || 'user').toLowerCase() === 'admin' || extraRoles.includes('admin');
  const isDeveloperUser = extraRoles.includes('developer') || String(user?.role || 'user').toLowerCase() === 'developer';
  const profileBoosterCredits = typeof user?.profileBoosterCredits === 'number' ? user.profileBoosterCredits : 0;
  const profileBoosterActiveUntil =
    typeof user?.profileBoosterActiveUntil === 'string' && Date.parse(user.profileBoosterActiveUntil) > Date.now()
      ? user.profileBoosterActiveUntil
      : null;

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  return (
    <div className="relative flex h-full min-h-screen flex-col border-r border-white/[0.06] bg-slate-950 lg:bg-slate-950/85 lg:backdrop-blur-xl">
      <div className="flex-shrink-0 border-b border-white/8 p-5 xl:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 xl:h-12 xl:w-12 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-purple-600">
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={userName}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <span className="text-lg font-bold text-white">{userName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{userName}</h3>
              <p className="text-sm capitalize text-gray-400">{String(faithJourney).toLowerCase()}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 transition-colors hover:bg-gray-700/50 lg:hidden"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className={`mt-3 rounded-[1.4rem] border px-3 py-2.5 shadow-[0_12px_24px_rgba(2,6,23,0.18)] ${
          subscriptionDisplay.isActivePaid
            ? 'border-yellow-400/30 bg-gradient-to-br from-yellow-500/15 via-amber-500/10 to-transparent'
            : 'border-white/10 bg-white/5'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">Current plan</p>
              <h4 className="mt-1 flex items-center gap-2 font-semibold leading-tight text-white">
                {subscriptionDisplay.isActivePaid ? (
                  <Crown className="h-4 w-4 text-yellow-300" />
                ) : (
                  <Star className="h-4 w-4 text-slate-300" />
                )}
                {subscriptionDisplay.tierLabel}
              </h4>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              subscriptionDisplay.isActivePaid
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'bg-white/10 text-gray-300'
            }`}>
              {subscriptionDisplay.statusLabel}
            </span>
          </div>

          <div className="mt-2 space-y-2">
            <Link
              to="/premium"
              onClick={onClose}
              className="flex items-center justify-between gap-3 rounded-2xl border border-fuchsia-300/15 bg-[linear-gradient(135deg,rgba(236,72,153,0.14),rgba(124,58,237,0.12))] px-3 py-2 transition hover:border-fuchsia-200/25 hover:bg-[linear-gradient(135deg,rgba(236,72,153,0.18),rgba(124,58,237,0.16))]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-visible rounded-[1rem] border border-fuchsia-200/20 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.24),rgba(255,255,255,0.08)_34%,rgba(15,23,42,0.88)_100%)] shadow-[0_12px_24px_rgba(76,29,149,0.28)] ring-1 ring-fuchsia-300/10">
                  <div className="absolute inset-1 rounded-[0.85rem] bg-[linear-gradient(145deg,rgba(168,85,247,0.22),rgba(236,72,153,0.16),rgba(2,6,23,0.06))]" />
                  <ProfileBoosterIcon
                    className="relative z-10 h-6 w-6 drop-shadow-[0_8px_18px_rgba(236,72,153,0.3)]"
                    glowId="sidepanel-booster"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fuchsia-100/75">Profile booster</p>
                  <p className="mt-0.5 text-sm font-semibold leading-tight text-white">
                    {profileBoosterActiveUntil
                      ? '1-hour boost active'
                      : `${profileBoosterCredits} credit${profileBoosterCredits === 1 ? '' : 's'} available`}
                  </p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                profileBoosterActiveUntil
                  ? 'animate-[pulse_2.4s_ease-in-out_infinite] bg-emerald-500/15 text-emerald-200 shadow-[0_0_0_4px_rgba(16,185,129,0.08)]'
                  : 'bg-fuchsia-500/15 text-fuchsia-100'
              }`}>
                {profileBoosterActiveUntil ? 'Live' : 'Boost'}
              </span>
            </Link>

            {!subscriptionDisplay.isActivePaid ? (
            <div className="mt-2 space-y-1.5">
              <p className="text-xs leading-4 text-gray-400">
                Upgrade to unlock premium visibility, deeper filters, and faster matching.
              </p>
              <Link
                to="/premium"
                onClick={onClose}
                className="inline-flex items-center rounded-full border border-pink-400/30 bg-pink-500/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-pink-200 transition hover:bg-pink-500/25 hover:text-white"
              >
                Upgrade Now
              </Link>
            </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="side-panel-scroll flex-1 min-h-0 space-y-2 overflow-y-auto p-4 xl:p-6">
        <div className="mb-6">
          <h5 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Navigation</h5>

          <Link to="/dashboard" onClick={onClose}>
            <div className={`group flex cursor-pointer items-center space-x-4 rounded-2xl p-3.5 transition-colors border ${isActive('/dashboard') ? 'bg-pink-500/10 border-pink-500/15' : 'border-transparent hover:bg-white/5'}`}>
              <div className={`rounded-xl p-2 transition-colors ${isActive('/dashboard') ? 'bg-pink-500/30' : 'bg-pink-500/20 group-hover:bg-pink-500/30'}`}>
                <Home className="h-5 w-5 text-pink-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Home</h4>
                <p className="text-sm text-gray-400">Discover new connections</p>
              </div>
            </div>
          </Link>

          <Link to="/explore" onClick={onClose}>
            <div className={`group flex cursor-pointer items-center space-x-4 rounded-2xl p-3.5 transition-colors border ${isActive('/explore') ? 'bg-pink-500/10 border-pink-500/15' : 'border-transparent hover:bg-white/5'}`}>
              <div className={`rounded-xl p-2 transition-colors ${isActive('/explore') ? 'bg-cyan-500/30' : 'bg-cyan-500/20 group-hover:bg-cyan-500/30'}`}>
                <Compass className="h-5 w-5 text-cyan-300" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Explore</h4>
                <p className="text-sm text-gray-400">Find by shared interests</p>
              </div>
            </div>
          </Link>

          <Link to="/matches" onClick={onClose}>
            <div className={`group flex cursor-pointer items-center space-x-4 rounded-2xl p-3.5 transition-colors border ${isActive('/matches') ? 'bg-pink-500/10 border-pink-500/15' : 'border-transparent hover:bg-white/5'}`}>
              <div className={`rounded-xl p-2 transition-colors ${isActive('/matches') ? 'bg-pink-500/30' : 'bg-pink-500/20 group-hover:bg-pink-500/30'}`}>
                <Heart className="h-5 w-5 text-pink-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white">My Matches</h4>
                <p className="text-sm text-gray-400">See who liked you</p>
              </div>
            </div>
          </Link>

          <Link to="/messages" onClick={onClose}>
            <div className={`group flex cursor-pointer items-center space-x-4 rounded-2xl p-3.5 transition-colors border ${isActive('/messages') ? 'bg-pink-500/10 border-pink-500/15' : 'border-transparent hover:bg-white/5'}`}>
              <div className={`relative rounded-xl p-2 transition-colors ${isActive('/messages') ? 'bg-blue-500/30' : 'bg-blue-500/20 group-hover:bg-blue-500/30'}`}>
                <MessageCircle className="h-5 w-5 text-blue-400" />
                {unreadMessageCount > 0 ? (
                  <span className="absolute -right-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-red-500 px-1 text-[10px] font-semibold text-white">
                    {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                  </span>
                ) : null}
              </div>
              <div>
                <h4 className="font-semibold text-white">Messages</h4>
                <p className="text-sm text-gray-400">Chat with connections</p>
              </div>
            </div>
          </Link>

          <Link to="/community" onClick={onClose}>
            <div className={`group flex cursor-pointer items-center space-x-4 rounded-2xl p-3.5 transition-colors border ${isActive('/community') ? 'bg-pink-500/10 border-pink-500/15' : 'border-transparent hover:bg-white/5'}`}>
              <div className={`rounded-xl p-2 transition-colors ${isActive('/community') ? 'bg-violet-500/30' : 'bg-violet-500/20 group-hover:bg-violet-500/30'}`}>
                <Users className="h-5 w-5 text-violet-300" />
              </div>
              <div>
                <h4 className="font-semibold text-white">Community</h4>
                <p className="text-sm text-gray-400">Fellowship and events</p>
              </div>
            </div>
          </Link>

          <div className="mt-4 border-t border-white/8 pt-4 lg:mt-0 lg:border-t-0 lg:pt-0">
            <h5 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 lg:hidden">Account</h5>

            <Link to="/profile" onClick={onClose}>
              <div className={`group flex cursor-pointer items-center space-x-4 rounded-2xl p-3.5 transition-colors border ${isActive('/profile') ? 'bg-pink-500/10 border-pink-500/15' : 'border-transparent hover:bg-white/5'}`}>
                <div className={`rounded-xl p-2 transition-colors ${isActive('/profile') ? 'bg-green-500/30' : 'bg-green-500/20 group-hover:bg-green-500/30'}`}>
                  <User className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">My Profile</h4>
                  <p className="text-sm text-gray-400">Edit profile & photos</p>
                </div>
              </div>
            </Link>

            <Link to="/notifications" onClick={onClose}>
              <div className={`group flex cursor-pointer items-center space-x-4 rounded-2xl p-3.5 transition-colors border ${isActive('/notifications') ? 'bg-pink-500/10 border-pink-500/15' : 'border-transparent hover:bg-white/5'}`}>
                <div className={`relative rounded-xl p-2 transition-colors ${isActive('/notifications') ? 'bg-amber-500/30' : 'bg-amber-500/20 group-hover:bg-amber-500/30'}`}>
                  <Bell className="h-5 w-5 text-amber-400" />
                  {unreadCount > 0 ? (
                    <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-red-500 text-xs text-white">
                      {unreadCount}
                    </span>
                  ) : null}
                </div>
                <div>
                  <h4 className="font-semibold text-white">Notifications</h4>
                  <p className="text-sm text-gray-400">Likes, matches & messages</p>
                </div>
              </div>
            </Link>

            <Link to="/premium" onClick={onClose}>
              <div className={`group flex cursor-pointer items-center space-x-4 rounded-2xl p-3.5 transition-colors border ${isActive('/premium') ? 'bg-pink-500/10 border-pink-500/15' : 'border-transparent hover:bg-white/5'}`}>
                <div className={`rounded-xl p-2 transition-colors ${isActive('/premium') ? 'bg-yellow-500/30' : 'bg-yellow-500/20 group-hover:bg-yellow-500/30'}`}>
                  <Star className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Premium Features</h4>
                  <p className="text-sm text-gray-400">
                    {subscriptionDisplay.isActivePaid
                      ? `${subscriptionDisplay.tierLabel}${subscriptionDisplay.countdownLabel ? ` • ${subscriptionDisplay.countdownLabel}` : ''}`
                      : 'Explore exclusive benefits'}
                  </p>
                </div>
              </div>
            </Link>

            {isAdminUser ? (
              <Link to="/admin" onClick={onClose}>
                <div className="group flex cursor-pointer items-center space-x-4 rounded-2xl border border-transparent p-3.5 transition-colors hover:bg-white/5">
                  <div className="rounded-xl bg-cyan-500/20 p-2 transition-colors group-hover:bg-cyan-500/30">
                    <ShieldCheck className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Admin Console</h4>
                    <p className="text-sm text-gray-400">User oversight and platform access</p>
                  </div>
                </div>
              </Link>
            ) : null}

            {isDeveloperUser ? (
              <Link to="/developer" onClick={onClose}>
                <div className="group flex cursor-pointer items-center space-x-4 rounded-2xl border border-transparent p-3.5 transition-colors hover:bg-white/5">
                  <div className="rounded-xl bg-violet-500/20 p-2 transition-colors group-hover:bg-violet-500/30">
                    <Wrench className="h-5 w-5 text-violet-300" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">Developer Hub</h4>
                    <p className="text-sm text-gray-400">Platform diagnostics and live overview</p>
                  </div>
                </div>
              </Link>
            ) : null}
          </div>
        </div>

        <div className="border-t border-white/8 pt-4">
          <h5 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">More</h5>

          <div className="mt-2 border-t border-white/8 pt-2">
            <Link to="/settings" onClick={onClose}>
              <div className={`group flex cursor-pointer items-center space-x-4 rounded-2xl p-3.5 transition-colors border ${isActive('/settings') ? 'bg-pink-500/10 border-pink-500/15' : 'border-transparent hover:bg-white/5'}`}>
                <div className={`rounded-xl p-2 transition-colors ${isActive('/settings') ? 'bg-gray-500/30' : 'bg-gray-500/20 group-hover:bg-gray-500/30'}`}>
                  <Settings className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Settings</h4>
                  <p className="text-sm text-gray-400">Privacy & preferences</p>
                </div>
              </div>
            </Link>

            <Link to="/help" onClick={onClose}>
              <div className="group flex cursor-pointer items-center space-x-4 rounded-2xl border border-transparent p-3.5 transition-colors hover:bg-white/5">
                <div className="rounded-xl bg-gray-500/20 p-2 transition-colors group-hover:bg-gray-500/30">
                  <HelpCircle className="h-5 w-5 text-gray-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Help & Support</h4>
                  <p className="text-sm text-gray-400">Find answers and contact us</p>
                </div>
              </div>
            </Link>

            <Link to="/report" onClick={onClose}>
              <div className="group flex cursor-pointer items-center space-x-4 rounded-2xl border border-transparent p-3.5 transition-colors hover:bg-white/5">
                <div className="rounded-xl bg-orange-500/20 p-2 transition-colors group-hover:bg-orange-500/30">
                  <AlertTriangle className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Report an Issue</h4>
                  <p className="text-sm text-gray-400">Report users or content</p>
                </div>
              </div>
            </Link>

            <Link to="/deactivate" onClick={onClose}>
              <div className="group flex cursor-pointer items-center space-x-4 rounded-2xl border border-transparent p-3.5 transition-colors hover:bg-white/5">
                <div className="rounded-xl bg-red-500/20 p-2 transition-colors group-hover:bg-red-500/30">
                  <UserX className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white">Deactivate Account</h4>
                  <p className="text-sm text-gray-400">Temporarily disable account</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-white/8 p-4 xl:p-6">
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`group flex w-full items-center space-x-4 rounded-2xl p-4 transition-colors ${
            isLoggingOut ? 'cursor-not-allowed bg-red-500/5 opacity-50' : 'cursor-pointer hover:bg-red-500/10'
          }`}
        >
          <div className="rounded-xl bg-red-500/20 p-2 transition-colors group-hover:bg-red-500/30">
            <LogOut className={`h-5 w-5 text-red-400 ${isLoggingOut ? 'animate-spin' : ''}`} />
          </div>
          <div className="text-left">
            <h4 className="font-semibold text-red-400">
              {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
            </h4>
            <p className="text-sm text-gray-500">
              {isLoggingOut ? 'Please wait...' : 'See you later!'}
            </p>
          </div>
        </button>
      </div>
      {/* Decorative gradient right border */}
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-pink-500/20 to-transparent" />
    </div>
  );
};
