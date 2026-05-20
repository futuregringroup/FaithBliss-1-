import React from 'react';
import type { ProfileData } from '@/types/profile';
import { INTEREST_CATEGORIES } from '@/constants/interestCategories';

interface PassionsSectionProps {
  profileData: ProfileData;
  setProfileData: React.Dispatch<React.SetStateAction<ProfileData | null>>;
}

const PassionsSection = ({ profileData, setProfileData }: PassionsSectionProps) => {
  const MAX_INTERESTS = 10;
  const INITIAL_VISIBLE_PER_CATEGORY = 8;
  const [expandedCategories, setExpandedCategories] = React.useState<Record<string, boolean>>({});

  const togglePassion = (passion: string) => {
    const currentInterests = Array.isArray(profileData.interests)
      ? profileData.interests
      : Array.isArray(profileData.hobbies)
        ? profileData.hobbies
        : [];
    const exists = currentInterests.includes(passion);
    const nextInterests = exists
      ? currentInterests.filter((p: string) => p !== passion)
      : currentInterests.length >= MAX_INTERESTS
        ? currentInterests
        : [...currentInterests, passion];

    setProfileData((prev) => (prev ? ({ ...prev, interests: nextInterests, hobbies: nextInterests }) : null));
  };

  const selectedInterests = Array.isArray(profileData.interests)
    ? profileData.interests
    : Array.isArray(profileData.hobbies)
      ? profileData.hobbies
      : [];

  return (
    <div className="space-y-6">
      <div
        className="bg-gray-800/50 rounded-3xl p-8 border border-gray-700/50 scroll-mt-32"
        data-profile-focus="interests"
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Interests</h2>
          <p className="text-gray-400">
            Select up to {MAX_INTERESTS} things you are into ({selectedInterests.length}/{MAX_INTERESTS})
          </p>
        </div>

        <div className="space-y-8">
          {INTEREST_CATEGORIES.map((category) => {
            const expanded = Boolean(expandedCategories[category.title]);
            const visibleOptions = expanded
              ? category.options
              : category.options.slice(0, INITIAL_VISIBLE_PER_CATEGORY);

            return (
              <section key={category.title} className="space-y-3 border-b border-white/10 pb-6 last:border-b-0">
                <h3 className="text-xl font-semibold text-white">
                  <span className="mr-2">{category.emoji}</span>
                  {category.title}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {visibleOptions.map((option) => (
                    <button
                      key={`${category.title}-${option}`}
                      onClick={() => togglePassion(option)}
                      disabled={!selectedInterests.includes(option) && selectedInterests.length >= MAX_INTERESTS}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                        selectedInterests.includes(option)
                          ? 'border-pink-400 bg-pink-500/20 text-pink-100'
                          : 'border-white/20 bg-slate-800/30 text-slate-200 hover:border-pink-300/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {category.options.length > INITIAL_VISIBLE_PER_CATEGORY && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCategories((prev) => ({
                        ...prev,
                        [category.title]: !prev[category.title],
                      }))
                    }
                    className="text-sm font-semibold text-slate-300 transition hover:text-white"
                  >
                    {expanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PassionsSection;
