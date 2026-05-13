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
    <div className="mx-4 mt-3 mb-1 flex items-center justify-between gap-3 rounded-xl bg-indigo-600/20 border border-indigo-500/30 px-4 py-3 text-sm">
      <p className="text-indigo-200 leading-snug">
        Complete your profile for better matches and visibility.
      </p>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => navigate('/profile')}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
        >
          Complete Profile
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-indigo-300 hover:text-white transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
};
