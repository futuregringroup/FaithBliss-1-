import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@/services/api';

const DISMISSED_KEY = 'faithbliss_profile_banner_dismissed';

const isProfileIncomplete = (user: User): boolean => {
  const hasInterests = Array.isArray(user.interests) && user.interests.length >= 1;
  const hasBio = typeof user.bio === 'string' && user.bio.trim().length > 0;
  return !hasInterests || !hasBio;
};

export const ProfileCompletionBanner = ({ user }: { user: User }) => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === '1'
  );

  if (dismissed || !isProfileIncomplete(user)) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="mx-3 mt-2 mb-1 flex items-center justify-between gap-2 rounded-xl border border-indigo-500/30 bg-indigo-600/20 px-3 py-2 text-xs sm:mx-4 sm:mt-3 sm:gap-3 sm:px-4 sm:py-3 sm:text-sm">
      <p className="min-w-0 leading-snug text-indigo-200">
        Complete your profile for better matches and visibility.
      </p>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          onClick={() => navigate('/profile')}
          className="whitespace-nowrap rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-indigo-500 sm:px-3 sm:text-xs"
        >
          Complete
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="flex h-6 w-6 items-center justify-center rounded-full text-lg leading-none text-indigo-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
      </div>
    </div>
  );
};
