import React from 'react';
import type { ProfileData } from '@/types/profile';
import { BIO_MAX_LENGTH, PROFILE_PROMPT_OPTIONS, PROMPT_ANSWER_MAX_LENGTH } from '@/constants/profilePrompts';
import { CountryCodeSelect } from '@/components/CountryCodeSelect';
import { countries, defaultCountry, type Country } from '@/constants/countries';
import AppDropdown from '@/components/AppDropdown';
import { MIN_PROFILE_FITS, PROFILE_FIT_OPTIONS } from '@/constants/profileFitOptions';

interface BasicInfoSectionProps {
  profileData: ProfileData;
  setProfileData: React.Dispatch<React.SetStateAction<ProfileData | null>>;
}

const LANGUAGE_OPTIONS = [
  'English',
  'French',
  'Spanish',
  'Portuguese',
  'German',
  'Italian',
  'Dutch',
  'Arabic',
  'Mandarin Chinese',
  'Hindi',
  'Yoruba',
  'Igbo',
  'Hausa',
];

const COMMUNICATION_STYLE_OPTIONS = ['Big time texter', 'Phone caller', 'Video chatter', 'Bad texter', 'Better in person'];
const LOVE_STYLE_OPTIONS = ['Thoughtful gestures', 'Presents', 'Touch', 'Compliments', 'Time together'];
const GENDER_OPTIONS = [
  { value: '', label: 'Select gender' },
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
];
const PROMPT_QUESTION_OPTIONS = [
  { value: '', label: 'Select a question' },
  ...PROFILE_PROMPT_OPTIONS.map((prompt) => ({ value: prompt, label: prompt })),
];

const toArray = (value?: string[] | string): string[] => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

const BasicInfoSection = ({ profileData, setProfileData }: BasicInfoSectionProps) => {
  const [selectedCountry, setSelectedCountry] = React.useState<Country>(defaultCountry);

  React.useEffect(() => {
    if (!profileData.countryCode) return;
    const match = countries.find((country) => country.dialCode === profileData.countryCode);
    if (match) setSelectedCountry(match);
  }, [profileData.countryCode]);

  const parsedHeight = React.useMemo(() => {
    if (!profileData.height) return 170;
    const match = String(profileData.height).match(/(\d+)\s*cm/i);
    const raw = match ? parseInt(match[1], 10) : parseInt(String(profileData.height), 10);
    if (Number.isNaN(raw)) return 170;
    return Math.min(220, Math.max(120, raw));
  }, [profileData.height]);

  const heightProgress = ((parsedHeight - 120) / (220 - 120)) * 100;

  const handleHeightChange = (value: number) => {
    const inches = Math.round(value / 2.54);
    const feet = Math.floor(inches / 12);
    const remInches = inches % 12;
    setProfileData((prev) => (prev ? { ...prev, height: `${value} cm (${feet}'${remInches}")` } : null));
  };

  const toggleFromList = (field: 'languageSpoken' | 'communicationStyle' | 'loveStyle', item: string) => {
    setProfileData((prev) => {
      if (!prev) return null;
      const current = toArray(prev[field] as string[] | string);
      const next = current.includes(item) ? current.filter((value) => value !== item) : [...current, item];
      if (field === 'languageSpoken') {
        return { ...prev, languageSpoken: next, language: next[0] || '' };
      }
      return { ...prev, [field]: next };
    });
  };

  const handleBirthdayChange = (value: string) => {
    setProfileData((prev) => {
      if (!prev) return null;
      const birthDate = new Date(value);
      let age = prev.age || 0;
      if (!Number.isNaN(birthDate.getTime())) {
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age -= 1;
      }
      return { ...prev, birthday: value, age: Math.max(18, age || 18) };
    });
  };

  const toggleProfileFit = (fit: string) => {
    setProfileData((prev) => {
      if (!prev) return null;
      const current = Array.isArray(prev.profileFits) ? prev.profileFits : [];
      const next = current.includes(fit)
        ? current.filter((item) => item !== fit)
        : [...current, fit];
      return { ...prev, profileFits: next };
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-700/50 bg-gray-800/50 p-8">
        <h2 className="mb-6 text-2xl font-bold text-white">Basic Information</h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-3 block text-sm font-semibold text-gray-300">Gender</label>
            <AppDropdown
              value={profileData.gender || ''}
              onChange={(next) =>
                setProfileData((prev) => (prev ? ({ ...prev, gender: next as 'MALE' | 'FEMALE' }) : null))
              }
              options={GENDER_OPTIONS}
              placeholder="Select gender"
              triggerClassName="w-full rounded-2xl border border-gray-600/50 bg-gray-700/50 p-4 text-white transition-colors focus:border-pink-500"
              menuClassName="border-gray-600/60 bg-slate-900/98"
            />
          </div>

          <div>
            <label className="mb-3 block text-sm font-semibold text-gray-300">First Name</label>
            <input
              type="text"
              value={profileData.name || ''}
              onChange={(e) => setProfileData((prev) => (prev ? ({ ...prev, name: e.target.value }) : null))}
              className="w-full rounded-2xl border border-gray-600/50 bg-gray-700/50 p-4 text-white placeholder-gray-400 transition-colors focus:border-pink-500 focus:outline-none"
              placeholder="Enter your first name"
            />
          </div>

          <div>
            <label className="mb-3 block text-sm font-semibold text-gray-300">Birthday</label>
            <input
              type="date"
              value={typeof profileData.birthday === 'string' ? profileData.birthday.slice(0, 10) : ''}
              onChange={(e) => handleBirthdayChange(e.target.value)}
              className="w-full rounded-2xl border border-gray-600/50 bg-gray-700/50 p-4 text-white transition-colors focus:border-pink-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-3 block text-sm font-semibold text-gray-300">Age</label>
            <input
              type="number"
              value={profileData.age || ''}
              onChange={(e) => setProfileData((prev) => (prev ? ({ ...prev, age: Number(e.target.value) || 0 }) : null))}
              className="w-full rounded-2xl border border-gray-600/50 bg-gray-700/50 p-4 text-white placeholder-gray-400 transition-colors focus:border-pink-500 focus:outline-none"
              placeholder="25"
            />
          </div>

          <div>
            <label className="mb-3 block text-sm font-semibold text-gray-300">Profession</label>
            <input
              type="text"
              value={profileData.profession || ''}
              onChange={(e) => setProfileData((prev) => (prev ? ({ ...prev, profession: e.target.value }) : null))}
              className="w-full rounded-2xl border border-gray-600/50 bg-gray-700/50 p-4 text-white placeholder-gray-400 transition-colors focus:border-pink-500 focus:outline-none"
              placeholder="Product Designer"
            />
          </div>

          <div>
            <label className="mb-3 block text-sm font-semibold text-gray-300">Field of Study</label>
            <input
              type="text"
              value={profileData.fieldOfStudy || ''}
              onChange={(e) => setProfileData((prev) => (prev ? ({ ...prev, fieldOfStudy: e.target.value }) : null))}
              className="w-full rounded-2xl border border-gray-600/50 bg-gray-700/50 p-4 text-white placeholder-gray-400 transition-colors focus:border-pink-500 focus:outline-none"
              placeholder="Computer Science"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-3 block text-sm font-semibold text-gray-300">Height</label>
            <div className="rounded-2xl border border-gray-600/40 bg-gray-700/40 p-4">
              <div className="mb-3 flex items-center justify-between text-sm text-gray-300">
                <span>120 cm</span>
                <span className="font-semibold text-white">{profileData.height || `${parsedHeight} cm`}</span>
                <span>220 cm</span>
              </div>
              <input
                type="range"
                min={120}
                max={220}
                step={1}
                value={parsedHeight}
                onChange={(e) => handleHeightChange(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full"
                style={{
                  background: `linear-gradient(90deg, rgba(236,72,153,0.95) ${heightProgress}%, rgba(51,65,85,0.95) ${heightProgress}%)`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-3 block text-sm font-semibold text-gray-300">Phone Number</label>
          <CountryCodeSelect
            selectedCountry={selectedCountry}
            onCountryChange={(country) => {
              setSelectedCountry(country);
              setProfileData((prev) => (prev ? { ...prev, countryCode: country.dialCode } : null));
            }}
            phoneNumber={profileData.phoneNumber || ''}
            onPhoneChange={(phone) => setProfileData((prev) => (prev ? { ...prev, phoneNumber: phone } : null))}
          />
        </div>

        <div className="mt-6">
          <label className="mb-3 block text-sm font-semibold text-gray-300">Location</label>
          <input
            type="text"
            value={profileData.location?.address || ''}
            onChange={(e) =>
              setProfileData((prev) =>
                prev
                  ? {
                      ...prev,
                      location: {
                        ...(prev.location || { latitude: null, longitude: null, address: '' }),
                        address: e.target.value,
                      },
                    }
                  : null
              )
            }
            className="w-full rounded-2xl border border-gray-600/50 bg-gray-700/50 p-4 text-white placeholder-gray-400 transition-colors focus:border-pink-500 focus:outline-none"
            placeholder="City, State / Country"
          />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-3 block text-sm font-semibold text-gray-300">Personal Prompt</label>
            <AppDropdown
              value={profileData.personalPromptQuestion || ''}
              onChange={(next) => setProfileData((prev) => (prev ? ({ ...prev, personalPromptQuestion: next }) : null))}
              options={PROMPT_QUESTION_OPTIONS}
              placeholder="Select a question"
              searchable
              searchPlaceholder="Search prompts..."
              triggerClassName="w-full rounded-2xl border border-gray-600/50 bg-gray-700/50 p-4 text-white transition-colors focus:border-pink-500"
              menuClassName="border-gray-600/60 bg-slate-900/98"
            />
          </div>

          <div>
            <label className="mb-3 block text-sm font-semibold text-gray-300">Prompt Answer</label>
            <textarea
              value={profileData.personalPromptAnswer || ''}
              onChange={(e) =>
                setProfileData((prev) =>
                  prev
                    ? ({
                        ...prev,
                        personalPromptAnswer: e.target.value.slice(0, PROMPT_ANSWER_MAX_LENGTH),
                      })
                    : null
                )
              }
              className="w-full rounded-2xl border border-gray-600/50 bg-gray-700/50 p-4 text-white placeholder-gray-400 transition-colors focus:border-pink-500 focus:outline-none"
              placeholder="Your answer"
              rows={3}
            />
            <p className="mt-2 text-right text-xs text-gray-400">
              {(profileData.personalPromptAnswer?.length || 0)}/{PROMPT_ANSWER_MAX_LENGTH}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-300">Which of these fits you the most?</label>
            <p className="mb-3 text-xs text-slate-400">
              Pick at least {MIN_PROFILE_FITS}. This appears on your public profile.
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {PROFILE_FIT_OPTIONS.map((option) => {
                const isSelected = Array.isArray(profileData.profileFits) && profileData.profileFits.includes(option.title);
                return (
                  <button
                    key={option.title}
                    type="button"
                    onClick={() => toggleProfileFit(option.title)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? 'border-pink-400 bg-pink-500/20 text-white'
                        : 'border-white/15 bg-slate-800/30 text-slate-200 hover:border-pink-300/60'
                    }`}
                  >
                    <p className="text-sm font-semibold">{option.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-300">{option.description}</p>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Selected: {profileData.profileFits?.length || 0}/{PROFILE_FIT_OPTIONS.length}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-300">Languages spoken</label>
            <p className="mb-3 text-xs text-slate-400">Select all that apply.</p>
            <div className="flex flex-wrap gap-2">
              {LANGUAGE_OPTIONS.map((option) => {
                const isSelected = toArray(profileData.languageSpoken).includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleFromList('languageSpoken', option)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      isSelected
                        ? 'border-pink-400 bg-pink-500/20 text-pink-100'
                        : 'border-white/15 bg-slate-800/30 text-slate-200 hover:border-pink-300/60'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-300">Communication style</label>
            <div className="flex flex-wrap gap-2">
              {COMMUNICATION_STYLE_OPTIONS.map((option) => {
                const isSelected = toArray(profileData.communicationStyle).includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleFromList('communicationStyle', option)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      isSelected
                        ? 'border-pink-400 bg-pink-500/20 text-pink-100'
                        : 'border-white/15 bg-slate-800/30 text-slate-200 hover:border-pink-300/60'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-300">How do you receive love?</label>
            <div className="flex flex-wrap gap-2">
              {LOVE_STYLE_OPTIONS.map((option) => {
                const isSelected = toArray(profileData.loveStyle).includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggleFromList('loveStyle', option)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      isSelected
                        ? 'border-pink-400 bg-pink-500/20 text-pink-100'
                        : 'border-white/15 bg-slate-800/30 text-slate-200 hover:border-pink-300/60'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 scroll-mt-32" data-profile-focus="bio">
          <label className="mb-3 block text-sm font-semibold text-gray-300">About Me (Bio)</label>
          <textarea
            value={profileData.bio || ''}
            onChange={(e) =>
              setProfileData((prev) =>
                prev
                  ? ({
                      ...prev,
                      bio: e.target.value.slice(0, BIO_MAX_LENGTH),
                    })
                  : null
              )
            }
            rows={5}
            className="w-full resize-none rounded-2xl border border-gray-600/50 bg-gray-700/50 p-4 text-white placeholder-gray-400 transition-colors focus:border-pink-500 focus:outline-none"
            placeholder="Introduce yourself to make a strong impression."
          />
          <p className="mt-2 text-right text-xs text-gray-400">{(profileData.bio?.length || 0)}/{BIO_MAX_LENGTH}</p>
        </div>
      </div>
    </div>
  );
};

export default BasicInfoSection;
