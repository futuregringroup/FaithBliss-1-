import React from 'react';
import { motion } from 'framer-motion';
import { Heart, MapPin, Ruler, UserRoundSearch, Plus } from 'lucide-react';
import type { OnboardingData, FaithJourney, ChurchAttendance, RelationshipGoals } from './types';
import SelectableCard from './SelectableCard';

interface PartnerPreferencesSlideProps {
  onboardingData: OnboardingData;
  setOnboardingData: React.Dispatch<React.SetStateAction<OnboardingData>>;
  isVisible: boolean;
  showValidationErrors?: boolean;
}

const faithJourneyOptions = [
  { value: 'ROOTED', label: 'Rooted', emoji: '🌳' },
  { value: 'GROWING', label: 'Growing', emoji: '🌱' },
  { value: 'EXPLORING', label: 'Exploring', emoji: '🧭' },
  { value: 'PASSIONATE', label: 'Passionate', emoji: '🔥' },
];

const churchAttendanceOptions = [
  { value: 'WEEKLY', label: 'Weekly', emoji: '🙌' },
  { value: 'BIWEEKLY', label: 'Bi-weekly', emoji: '🙏' },
  { value: 'MONTHLY', label: 'Monthly', emoji: '🗓️' },
  { value: 'OCCASIONALLY', label: 'Occasionally', emoji: '⛪' },
  { value: 'RARELY', label: 'Rarely', emoji: '🤔' },
];

const relationshipGoalsOptions = [
  { value: 'MARRIAGE_MINDED', label: 'Marriage Minded', emoji: '💍' },
  { value: 'RELATIONSHIP', label: 'Relationship', emoji: '❤️' },
  { value: 'FRIENDSHIP', label: 'Friendship', emoji: '🤝' },
];

const denominationOptions = [
  'BAPTIST',
  'METHODIST',
  'PRESBYTERIAN',
  'PENTECOSTAL',
  'CATHOLIC',
  'ORTHODOX',
  'ANGLICAN',
  'LUTHERAN',
  'ASSEMBLIES_OF_GOD',
  'SEVENTH_DAY_ADVENTIST',
  'OTHER',
];

const genderOptions = [
  { value: 'MALE', label: 'Men', emoji: '👨' },
  { value: 'FEMALE', label: 'Women', emoji: '👩' },
];

const ChipButton = ({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-150 active:scale-95 ${
      selected
        ? 'bg-pink-600 text-white scale-95'
        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
    }`}
  >
    {children}
  </button>
);

const PartnerPreferencesSlide: React.FC<PartnerPreferencesSlideProps> = ({
  onboardingData,
  setOnboardingData,
  isVisible,
  showValidationErrors = false,
}) => {
  const [denomInput, setDenomInput] = React.useState('');

  if (!isVisible) return null;

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const parsed = value ? parseInt(value, 10) : null;
    setOnboardingData((prev) => ({ ...prev, [name as keyof OnboardingData]: parsed }));
  };

  const handleMultiSelect = (
    name: 'preferredFaithJourney' | 'preferredChurchAttendance' | 'preferredRelationshipGoals',
    value: string
  ) => {
    setOnboardingData((prev) => {
      const currentList = (prev[name] || []) as string[];
      const newList = currentList.includes(value)
        ? currentList.filter((item) => item !== value)
        : [...currentList, value];
      return { ...prev, [name]: newList };
    });
  };

  const handleDenomSelect = (value: string) => {
    setOnboardingData((prev) => {
      if (prev.preferredDenomination === 'all') {
        return { ...prev, preferredDenomination: value };
      }
      return {
        ...prev,
        preferredDenomination: prev.preferredDenomination === value ? '' : value,
      };
    });
  };

  const handleAddCustomDenom = () => {
    const trimmed = denomInput.trim();
    if (!trimmed) return;
    setOnboardingData((prev) => ({ ...prev, preferredDenomination: trimmed }));
    setDenomInput('');
  };

  const preferredMinHeight = onboardingData.preferredMinHeight ?? 160;
  const preferredHeightInches = Math.round(preferredMinHeight / 2.54);
  const preferredHeightFeet = Math.floor(preferredHeightInches / 12);
  const preferredHeightRemainder = preferredHeightInches % 12;
  const invalidAgeRange =
    onboardingData.minAge === null ||
    onboardingData.minAge === undefined ||
    onboardingData.maxAge === null ||
    onboardingData.maxAge === undefined ||
    onboardingData.minAge > onboardingData.maxAge;

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.5 }}
      className="space-y-10"
    >
      <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-pink-500/20 to-indigo-500/20 p-5">
        <div className="mb-2 flex items-center gap-2 text-pink-200">
          <UserRoundSearch className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">Partner Preferences</span>
        </div>
        <h2 className="text-3xl font-bold text-white">What are you looking for?</h2>
        <p className="mt-1 text-gray-300">Set values, distance, age, and height preferences for better matches.</p>
      </div>

      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-white">
          <Heart className="h-5 w-5 text-pink-400" />
          I&apos;m interested in... <span className="text-red-400">*</span>
        </h3>
        <div className={`grid grid-cols-2 gap-4 rounded-2xl p-2 ${showValidationErrors && !onboardingData.preferredGender ? 'border border-red-400/40 bg-red-500/5' : ''}`}>
          {genderOptions.map((option) => (
            <SelectableCard
              key={option.value}
              label={option.label}
              emoji={option.emoji}
              isSelected={onboardingData.preferredGender === option.value}
              onClick={() => setOnboardingData((prev) => ({ ...prev, preferredGender: option.value as 'MALE' | 'FEMALE' }))}
            />
          ))}
        </div>
        {showValidationErrors && !onboardingData.preferredGender ? (
          <p className="text-sm text-red-400">Select who you want to match with.</p>
        ) : null}
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Age Range <span className="text-red-400">*</span></h3>
        <div className="flex items-center justify-center space-x-4">
          <input
            type="number"
            name="minAge"
            value={onboardingData.minAge === null || onboardingData.minAge === undefined ? '' : onboardingData.minAge}
            onChange={handleRangeChange}
            className={`input-style w-24 text-center ${showValidationErrors && invalidAgeRange ? 'border-red-400/70' : ''}`}
            min="18"
            max="99"
          />
          <span className="text-gray-400 text-lg">to</span>
          <input
            type="number"
            name="maxAge"
            value={onboardingData.maxAge === null || onboardingData.maxAge === undefined ? '' : onboardingData.maxAge}
            onChange={handleRangeChange}
            className={`input-style w-24 text-center ${showValidationErrors && invalidAgeRange ? 'border-red-400/70' : ''}`}
            min="18"
            max="99"
          />
        </div>
        {showValidationErrors && invalidAgeRange ? (
          <p className="text-sm text-red-400">Enter a valid age range and make sure minimum age is not above maximum age.</p>
        ) : null}
      </div>

      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-white">
          <MapPin className="h-5 w-5 text-pink-400" />
          Maximum Distance <span className="text-red-400">*</span>
        </h3>
        <div className={`rounded-xl border bg-slate-900/40 p-4 ${showValidationErrors && !onboardingData.maxDistance ? 'border-red-400/70' : 'border-white/10'}`}>
          <input
            type="range"
            id="maxDistance"
            name="maxDistance"
            min="1"
            max="100"
            value={onboardingData.maxDistance || 0}
            onChange={handleRangeChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="mt-2 text-center text-lg font-semibold text-pink-400">{onboardingData.maxDistance || 0} miles</div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-white">
          <Ruler className="h-5 w-5 text-pink-400" />
          Preferred minimum height <span className="text-red-400">*</span>
        </h3>
        <div className={`rounded-xl border bg-slate-900/40 p-4 ${showValidationErrors && !onboardingData.preferredMinHeight ? 'border-red-400/70' : 'border-white/10'}`}>
          <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
            <span>120 cm</span>
            <span className="font-semibold text-white">
              {preferredMinHeight} cm ({preferredHeightFeet}'{preferredHeightRemainder}")
            </span>
            <span>220 cm</span>
          </div>
          <input
            type="range"
            name="preferredMinHeight"
            min="120"
            max="220"
            value={preferredMinHeight}
            onChange={handleRangeChange}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Their ideal faith journey? <span className="text-red-400">*</span></h3>
        <div className={`flex flex-wrap gap-2 rounded-2xl p-2 ${showValidationErrors && !onboardingData.preferredFaithJourney?.length ? 'border border-red-400/40 bg-red-500/5' : ''}`}>
          {faithJourneyOptions.map((option) => (
            <ChipButton
              key={option.value}
              selected={!!onboardingData.preferredFaithJourney?.includes(option.value as FaithJourney)}
              onClick={() => handleMultiSelect('preferredFaithJourney', option.value)}
            >
              {option.emoji} {option.label}
            </ChipButton>
          ))}
        </div>
        {showValidationErrors && !onboardingData.preferredFaithJourney?.length ? (
          <p className="text-sm text-red-400">Pick at least one preferred faith journey.</p>
        ) : null}
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white">How often should they attend church? <span className="text-red-400">*</span></h3>
        <div className={`flex flex-wrap gap-2 rounded-2xl p-2 ${showValidationErrors && !onboardingData.preferredChurchAttendance?.length ? 'border border-red-400/40 bg-red-500/5' : ''}`}>
          {churchAttendanceOptions.map((option) => (
            <ChipButton
              key={option.value}
              selected={!!onboardingData.preferredChurchAttendance?.includes(option.value as ChurchAttendance)}
              onClick={() => handleMultiSelect('preferredChurchAttendance', option.value)}
            >
              {option.emoji} {option.label}
            </ChipButton>
          ))}
        </div>
        {showValidationErrors && !onboardingData.preferredChurchAttendance?.length ? (
          <p className="text-sm text-red-400">Pick at least one church attendance preference.</p>
        ) : null}
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white">What kind of relationship are they seeking? <span className="text-red-400">*</span></h3>
        <div className={`flex flex-wrap gap-2 rounded-2xl p-2 ${showValidationErrors && !onboardingData.preferredRelationshipGoals?.length ? 'border border-red-400/40 bg-red-500/5' : ''}`}>
          {relationshipGoalsOptions.map((option) => (
            <ChipButton
              key={option.value}
              selected={!!onboardingData.preferredRelationshipGoals?.includes(option.value as RelationshipGoals)}
              onClick={() => handleMultiSelect('preferredRelationshipGoals', option.value)}
            >
              {option.emoji} {option.label}
            </ChipButton>
          ))}
        </div>
        {showValidationErrors && !onboardingData.preferredRelationshipGoals?.length ? (
          <p className="text-sm text-red-400">Pick at least one preferred relationship goal.</p>
        ) : null}
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white">Any denomination preference?</h3>
        <div className="flex flex-wrap gap-2 rounded-2xl p-2">
          <ChipButton
            selected={onboardingData.preferredDenomination === 'all'}
            onClick={() =>
              setOnboardingData((prev) => ({
                ...prev,
                preferredDenomination: prev.preferredDenomination === 'all' ? '' : 'all',
              }))
            }
          >
            All
          </ChipButton>
          {denominationOptions.map((option) => (
            <ChipButton
              key={option}
              selected={
                onboardingData.preferredDenomination === 'all' ||
                onboardingData.preferredDenomination === option
              }
              onClick={() => handleDenomSelect(option)}
            >
              {option.replace(/_/g, ' ')}
            </ChipButton>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={denomInput}
            onChange={(e) => setDenomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomDenom(); } }}
            placeholder="Type a denomination..."
            className="flex-1 rounded-xl border border-white/20 bg-slate-900/75 px-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-pink-500"
          />
          <button
            type="button"
            onClick={handleAddCustomDenom}
            className="flex items-center gap-1.5 rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-pink-700 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        {onboardingData.preferredDenomination &&
         onboardingData.preferredDenomination !== 'all' &&
         !denominationOptions.includes(onboardingData.preferredDenomination) ? (
          <p className="text-sm text-pink-300">Added: {onboardingData.preferredDenomination}</p>
        ) : null}
      </div>
    </motion.div>
  );
};

export default PartnerPreferencesSlide;
