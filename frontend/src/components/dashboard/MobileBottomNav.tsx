import { Compass, Heart, Home, MessageCircle, User } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useUnreadCount } from '@/hooks/useAPI';

interface MobileBottomNavProps {
  userImage?: string;
  userName?: string;
}

const navItems = [
  { to: '/dashboard', label: 'Home', Icon: Home },
  { to: '/explore', label: 'Explore', Icon: Compass },
  { to: '/matches', label: 'Matches', Icon: Heart },
  { to: '/messages', label: 'Messages', Icon: MessageCircle },
];

export const MobileBottomNav = ({ userImage, userName }: MobileBottomNavProps) => {
  const { data: unreadMessagesData } = useUnreadCount();
  const initials = (userName || 'U').trim().charAt(0).toUpperCase();
  const unreadMessageCount = unreadMessagesData?.count || 0;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-slate-950/94 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-2xl lg:hidden">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between rounded-2xl border border-white/8 bg-slate-900/70 px-1 py-1 shadow-nav">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group inline-flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200 ${
                isActive ? 'text-pink-400' : 'text-slate-500 hover:text-slate-300'
              }`
            }
            aria-label={label}
            title={label}
          >
            {({ isActive }) => (
              <>
                <span className={`relative inline-flex transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                  <Icon className={`h-5 w-5 transition-colors ${isActive ? 'text-pink-400' : ''}`} />
                  {label === 'Messages' && unreadMessageCount > 0 ? (
                    <span className="absolute -right-2.5 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full border border-slate-950/80 bg-gradient-to-r from-pink-500 to-red-500 px-1 text-[9px] font-semibold leading-none text-white shadow-[0_4px_10px_rgba(236,72,153,0.4)]">
                      {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                    </span>
                  ) : null}
                </span>
                <span className={`text-[9px] font-semibold uppercase tracking-[0.06em] transition-colors ${
                  isActive ? 'text-pink-400' : 'text-slate-500'
                }`}>
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `group inline-flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200 ${
              isActive ? 'text-pink-400' : 'text-slate-500 hover:text-slate-300'
            }`
          }
          aria-label="My Profile"
          title="My Profile"
        >
          {({ isActive }) => (
            <>
              <span className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                {userImage ? (
                  <img
                    src={userImage}
                    alt={userName || 'Profile'}
                    className={`h-6 w-6 rounded-full object-cover transition-all ${
                      isActive
                        ? 'ring-2 ring-pink-400/70 ring-offset-1 ring-offset-slate-950'
                        : 'border border-white/30'
                    }`}
                  />
                ) : (
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-pink-500 text-white ring-2 ring-pink-400/50 ring-offset-1 ring-offset-slate-950'
                      : 'bg-slate-700 text-white border border-white/30'
                  }`}>
                    {initials || <User className="h-3.5 w-3.5" />}
                  </span>
                )}
              </span>
              <span className={`text-[9px] font-semibold uppercase tracking-[0.06em] transition-colors ${
                isActive ? 'text-pink-400' : 'text-slate-500'
              }`}>
                Me
              </span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
};
