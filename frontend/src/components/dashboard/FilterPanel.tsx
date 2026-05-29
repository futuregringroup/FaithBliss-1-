import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Filter, Lock, RotateCcw, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppDropdown from '@/components/AppDropdown';
import { countries } from '@/constants/countries';

export interface DashboardFiltersPayload {
  preferredGender?: 'MALE' | 'FEMALE' | '';
  preferredDenominations?: string[];
  minAge?: number;
  maxAge?: number;
  maxDistance?: number;
  preferredMinHeight?: number;
  preferredFaithJourney?: string[];
  preferredChurchAttendance?: string[];
  preferredRelationshipGoals?: string[];
  passportCountry?: string | null;
}

export type DashboardFilterFocusSection =
  | 'gender'
  | 'passport'
  | 'distance'
  | 'age'
  | 'height'
  | 'faith-journey'
  | 'denomination'
  | 'church-attendance'
  | 'relationship-goal';

interface FilterPanelProps {
  onClose: () => void;
  onApplyFilters: (filters: DashboardFiltersPayload) => void;
  isOpen?: boolean;
  initialFocusSection?: DashboardFilterFocusSection | null;
  isPremiumUser?: boolean;
  passportModeEnabled?: boolean;
  initialPassportCountry?: string | null;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const sanitizeNumberInput = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getRangePercent = (value: number, min: number, max: number) =>
  ((value - min) / (max - min)) * 100;

const INTERESTED_IN_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'MALE', label: 'Men' },
  { value: 'FEMALE', label: 'Women' },
];

const FAITH_JOURNEY_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'EXPLORING', label: 'Exploring' },
  { value: 'GROWING', label: 'Growing' },
  { value: 'ROOTED', label: 'Rooted' },
  { value: 'PASSIONATE', label: 'Passionate' },
];

const DENOMINATION_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'BAPTIST', label: 'Baptist' },
  { value: 'METHODIST', label: 'Methodist' },
  { value: 'PRESBYTERIAN', label: 'Presbyterian' },
  { value: 'PENTECOSTAL', label: 'Pentecostal' },
  { value: 'CATHOLIC', label: 'Catholic' },
  { value: 'ORTHODOX', label: 'Orthodox' },
  { value: 'ANGLICAN', label: 'Anglican' },
  { value: 'LUTHERAN', label: 'Lutheran' },
  { value: 'ASSEMBLIES_OF_GOD', label: 'Assemblies of God' },
  { value: 'SEVENTH_DAY_ADVENTIST', label: 'Seventh-day Adventist' },
  { value: 'OTHER', label: 'Other' },
];

const CHURCH_ATTENDANCE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Bi-weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'OCCASIONALLY', label: 'Occasionally' },
  { value: 'RARELY', label: 'Rarely' },
];

const RELATIONSHIP_GOAL_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'FRIENDSHIP', label: 'Friendship' },
  { value: 'RELATIONSHIP', label: 'Relationship' },
  { value: 'MARRIAGE_MINDED', label: 'Marriage-minded' },
];

export const FilterPanel = ({
  onClose,
  onApplyFilters,
  isOpen = false,
  initialFocusSection = null,
  isPremiumUser = false,
  passportModeEnabled = false,
  initialPassportCountry = null,
}: FilterPanelProps) => {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | ''>('');
  const [distance, setDistance] = useState(50);
  const [minAge, setMinAge] = useState(22);
  const [maxAge, setMaxAge] = useState(40);
  const [minHeight, setMinHeight] = useState(120);
  const [faithJourney, setFaithJourney] = useState('');
  const [churchAttendance, setChurchAttendance] = useState('');
  const [relationshipGoal, setRelationshipGoal] = useState('');
  const [denomination, setDenomination] = useState('');
  const [passportCountry, setPassportCountry] = useState<string>('');
  const [passportPickerOpen, setPassportPickerOpen] = useState(false);
  const [passportSearchTerm, setPassportSearchTerm] = useState('');

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (gender) count += 1;
    if (isPremiumUser) {
      if (passportModeEnabled && passportCountry) count += 1;
      if (distance !== 50) count += 1;
      if (minAge !== 22 || maxAge !== 40) count += 1;
      if (minHeight > 120) count += 1;
      if (faithJourney) count += 1;
      if (churchAttendance) count += 1;
      if (relationshipGoal) count += 1;
      if (denomination) count += 1;
    }
    return count;
  }, [churchAttendance, denomination, distance, faithJourney, gender, isPremiumUser, maxAge, minAge, minHeight, passportCountry, passportModeEnabled, relationshipGoal]);

  const resetLocalState = () => {
    setGender('');
    setPassportCountry('');
    setPassportSearchTerm('');
    setPassportPickerOpen(false);
    setDistance(50);
    setMinAge(22);
    setMaxAge(40);
    setMinHeight(120);
    setFaithJourney('');
    setChurchAttendance('');
    setRelationshipGoal('');
    setDenomination('');
  };

  const buildPayload = (): DashboardFiltersPayload => {
    const safeMinAge = clamp(Math.round(minAge), 18, 55);
    const safeMaxAge = clamp(Math.round(maxAge), 18, 55);
    const normalizedMinAge = Math.min(safeMinAge, safeMaxAge);
    const normalizedMaxAge = Math.max(safeMinAge, safeMaxAge);

    const payload: DashboardFiltersPayload = {};
    payload.preferredGender = gender; // '' means Any — still send so filterProfiles skips gender check
    if (isPremiumUser) {
      if (passportModeEnabled) payload.passportCountry = passportCountry || null;
      if (distance !== 50) payload.maxDistance = clamp(Math.round(distance), 1, 500);
      if (minAge !== 22 || maxAge !== 40) {
        payload.minAge = normalizedMinAge;
        payload.maxAge = normalizedMaxAge;
      }
      if (minHeight > 120) payload.preferredMinHeight = clamp(Math.round(minHeight), 120, 220);
      if (faithJourney) payload.preferredFaithJourney = [faithJourney];
      if (churchAttendance) payload.preferredChurchAttendance = [churchAttendance];
      if (relationshipGoal) payload.preferredRelationshipGoals = [relationshipGoal];
      if (denomination) payload.preferredDenominations = [denomination];
    }

    return payload;
  };

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setPassportCountry(initialPassportCountry || '');
      setPassportSearchTerm('');
      setPassportPickerOpen(false);
    }

    wasOpenRef.current = isOpen;
  }, [initialPassportCountry, isOpen]);

  const handleApply = () => {
    onApplyFilters(buildPayload());
    onClose();
  };

  const handleClear = () => {
    resetLocalState();
    onApplyFilters({});
    onClose();
  };

  useEffect(() => {
    if (!isOpen || !initialFocusSection) return;

    if (
      isPremiumUser &&
      (initialFocusSection === 'denomination' ||
        initialFocusSection === 'church-attendance' ||
        initialFocusSection === 'relationship-goal')
    ) {
      setShowAdvanced(true);
    }

    const timer = window.setTimeout(() => {
      const lockedAdvancedSection =
        !isPremiumUser &&
        (initialFocusSection === 'denomination' ||
          initialFocusSection === 'church-attendance' ||
          initialFocusSection === 'relationship-goal');
      const selector = lockedAdvancedSection
        ? '[data-filter-section="gender"]'
        : `[data-filter-section="${initialFocusSection}"]`;
      const section = scrollContainerRef.current?.querySelector(selector) as HTMLElement | null;
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 140);

    return () => window.clearTimeout(timer);
  }, [initialFocusSection, isOpen, isPremiumUser]);

  const lockedSectionClass = !isPremiumUser
    ? 'border-amber-400/30 bg-gradient-to-br from-slate-900/95 via-slate-900/92 to-slate-800/95 ring-1 ring-amber-300/15'
    : '';
  const goToPremium = () => {
    onClose();
    navigate('/premium');
  };
  const renderLockedHeader = () =>
    !isPremiumUser ? (
      <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-amber-300/20 bg-slate-950/75 px-3 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-2.5">
        <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100 sm:text-[11px]">
          <Lock className="h-3.5 w-3.5" />
          Premium Only
        </span>
        <button
          type="button"
          onClick={goToPremium}
          className="w-full rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-white/85 transition hover:bg-white/10 sm:w-auto sm:px-4 sm:py-1.5"
        >
          Upgrade
        </button>
      </div>
    ) : null;

  const renderUnavailableHeader = () =>
    isPremiumUser && !passportModeEnabled ? (
      <div className="mb-3 flex flex-col gap-2 rounded-2xl border border-slate-300/15 bg-slate-950/75 px-3 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-2.5">
        <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-200 sm:text-[11px]">
          <Lock className="h-3.5 w-3.5" />
          Passport Mode Disabled
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400 sm:text-[11px]">
          Admin controlled
        </span>
      </div>
    ) : null;

  const passportOptions = useMemo(
    () => [
      { value: '', label: 'Anywhere' },
      ...countries.map((country) => ({
        value: country.code,
        label: country.name,
      })),
    ],
    []
  );

  const selectedPassportOption = useMemo(
    () => passportOptions.find((option) => option.value === passportCountry) ?? passportOptions[0],
    [passportCountry, passportOptions]
  );

  const filteredPassportOptions = useMemo(() => {
    const normalizedSearch = passportSearchTerm.trim().toLowerCase();
    if (!normalizedSearch) return passportOptions;
    return passportOptions.filter((option) => option.label.toLowerCase().includes(normalizedSearch));
  }, [passportOptions, passportSearchTerm]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-10 border-b border-slate-700/60 bg-slate-950/95 px-3 py-4 backdrop-blur-xl sm:px-5 sm:py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-white sm:text-xl">
              <Filter className="h-5 w-5 text-pink-400" />
              Match Filters
            </h3>
            <p className="mt-1 max-w-sm text-sm text-slate-400">
              Refine your discovery feed with accurate preferences.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 transition-colors hover:bg-slate-700/60"
            aria-label="Close filters"
          >
            <X className="h-5 w-5 text-slate-300" />
          </button>
        </div>
        <div className="mt-3 inline-flex items-center rounded-full border border-pink-400/30 bg-pink-500/15 px-3 py-1 text-xs font-semibold text-pink-200">
          {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}
        </div>
        {!isPremiumUser && (
          <div className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-3 py-3 text-xs text-amber-100 sm:px-4">
            <p className="leading-relaxed">Free plan allows gender filtering only. All other filters are premium-only.</p>
            <button
              type="button"
              onClick={goToPremium}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-amber-300/30 bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:bg-white/15 sm:w-auto sm:justify-start sm:px-4"
            >
              <Lock className="h-3.5 w-3.5" />
              Upgrade to Premium
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-3 sm:px-5 sm:py-5"
      >
        <section data-filter-section="gender" className="rounded-[22px] border border-indigo-400/20 bg-indigo-500/10 p-4 sm:p-5">
          <label className="block text-xs font-semibold uppercase tracking-wide text-indigo-200 mb-2">Interested In</label>
          <AppDropdown
            value={gender}
            onChange={(next) => setGender(next as 'MALE' | 'FEMALE' | '')}
            options={INTERESTED_IN_OPTIONS}
            placeholder="Any"
            triggerClassName="w-full rounded-xl bg-slate-900/70 border border-indigo-300/30 px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-400/40"
            menuClassName="border-indigo-300/30 bg-slate-900/98"
          />
        </section>

        <section
          data-filter-section="passport"
          className={`rounded-[22px] border border-violet-400/20 bg-violet-500/10 p-4 sm:p-5 ${
            !isPremiumUser || !passportModeEnabled ? 'border-violet-300/20 bg-violet-500/5' : ''
          }`}
        >
          {!isPremiumUser ? renderLockedHeader() : renderUnavailableHeader()}
          <div className="mb-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-violet-200">Passport Mode</label>
            <p className="mt-1 text-xs text-slate-300">
              Choose a country and only see profiles from there. When active, only users from that country can also discover you.
            </p>
          </div>
          <button
            type="button"
            disabled={!isPremiumUser || !passportModeEnabled}
            onClick={() => {
              setPassportSearchTerm('');
              setPassportPickerOpen(true);
            }}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-violet-300/30 bg-slate-900/70 px-3 py-2.5 text-left text-base text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
          >
            <span className={passportCountry ? 'text-white' : 'text-slate-400'}>
              {selectedPassportOption.label}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        </section>

        <section data-filter-section="distance" className={`rounded-[22px] border border-pink-400/20 bg-pink-500/10 p-4 sm:p-5 ${lockedSectionClass}`}>
          {renderLockedHeader()}
          <label className="block text-xs font-semibold uppercase tracking-wide text-pink-200 mb-2">Distance</label>
          <input
            type="range"
            min={1}
            max={500}
            value={distance}
            onChange={(e) => setDistance(clamp(sanitizeNumberInput(e.target.value, 50), 1, 500))}
            disabled={!isPremiumUser}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
          />
          <div className="mt-2 text-sm text-slate-200 font-semibold">{distance} km</div>
        </section>

        <section data-filter-section="age" className={`rounded-[22px] border border-cyan-400/20 bg-cyan-500/10 p-4 sm:p-5 ${lockedSectionClass}`}>
          {renderLockedHeader()}
          <label className="block text-xs font-semibold uppercase tracking-wide text-cyan-200 mb-2">Age Range</label>
          <div className="rounded-2xl border border-cyan-300/20 bg-slate-950/35 px-3 py-4 sm:px-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2 text-center">
                <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-200/80">Min</div>
                <div className="text-base font-semibold text-white">{minAge}</div>
              </div>
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-300">to</div>
              <div className="rounded-xl border border-cyan-300/20 bg-slate-900/70 px-3 py-2 text-center">
                <div className="text-[10px] uppercase tracking-[0.16em] text-cyan-200/80">Max</div>
                <div className="text-base font-semibold text-white">{maxAge}</div>
              </div>
            </div>

            <div className="relative h-8">
              <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-slate-700/90" />
              <div
                className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-400 to-sky-400"
                style={{
                  left: `${getRangePercent(minAge, 18, 55)}%`,
                  width: `${getRangePercent(maxAge, 18, 55) - getRangePercent(minAge, 18, 55)}%`,
                }}
              />
              <input
                type="range"
                min={18}
                max={55}
                value={minAge}
                onChange={(e) =>
                  setMinAge(Math.min(clamp(sanitizeNumberInput(e.target.value, 22), 18, 55), maxAge))
                }
                disabled={!isPremiumUser}
                className="pointer-events-none absolute left-0 top-1/2 h-8 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-cyan-200 [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(34,211,238,0.18)] [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-cyan-200 [&::-moz-range-thumb]:bg-cyan-500 [&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(34,211,238,0.18)] disabled:opacity-60"
              />
              <input
                type="range"
                min={18}
                max={55}
                value={maxAge}
                onChange={(e) =>
                  setMaxAge(Math.max(clamp(sanitizeNumberInput(e.target.value, 40), 18, 55), minAge))
                }
                disabled={!isPremiumUser}
                className="pointer-events-none absolute left-0 top-1/2 h-8 w-full -translate-y-1/2 appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-cyan-200 [&::-webkit-slider-thumb]:bg-sky-500 [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(56,189,248,0.18)] [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-cyan-200 [&::-moz-range-thumb]:bg-sky-500 [&::-moz-range-thumb]:shadow-[0_0_0_4px_rgba(56,189,248,0.18)] disabled:opacity-60"
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
              <span>18</span>
              <span>55</span>
            </div>
          </div>
        </section>

        <section data-filter-section="height" className={`rounded-[22px] border border-fuchsia-400/20 bg-fuchsia-500/10 p-4 sm:p-5 ${lockedSectionClass}`}>
          {renderLockedHeader()}
          <label className="block text-xs font-semibold uppercase tracking-wide text-fuchsia-200 mb-2">Minimum Height</label>
          <input
            type="range"
            min={120}
            max={220}
            value={minHeight}
            onChange={(e) => setMinHeight(clamp(sanitizeNumberInput(e.target.value, 120), 120, 220))}
            disabled={!isPremiumUser}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
          />
          <div className="mt-2 text-sm text-slate-200 font-semibold">{minHeight} cm +</div>
        </section>

        <section data-filter-section="faith-journey" className={`rounded-[22px] border border-emerald-400/20 bg-emerald-500/10 p-4 sm:p-5 ${lockedSectionClass}`}>
          {renderLockedHeader()}
          <label className="block text-xs font-semibold uppercase tracking-wide text-emerald-200 mb-2">Faith Journey</label>
          <AppDropdown
            value={faithJourney}
            onChange={setFaithJourney}
            options={FAITH_JOURNEY_OPTIONS}
            placeholder="Any"
            disabled={!isPremiumUser}
            triggerClassName="w-full rounded-xl bg-slate-900/70 border border-emerald-300/30 px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-400/40"
            menuClassName="border-emerald-300/30 bg-slate-900/98"
          />
        </section>

        <button
          type="button"
          onClick={() => {
            if (!isPremiumUser) {
              goToPremium();
              return;
            }
            setShowAdvanced((prev) => !prev);
          }}
          className="flex w-full items-center justify-between rounded-[22px] border border-slate-600/60 bg-slate-800/60 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700/60"
        >
          <span className="inline-flex items-center gap-2">
            Advanced Filters
            {!isPremiumUser ? <Lock className="h-4 w-4" /> : null}
          </span>
          <ChevronDown className={`w-5 h-5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {showAdvanced && (
          <div className="space-y-4">
            <section data-filter-section="denomination" className="rounded-[22px] border border-purple-400/20 bg-purple-500/10 p-4 sm:p-5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-purple-200 mb-2">Denomination</label>
              <AppDropdown
                value={denomination}
                onChange={setDenomination}
                options={DENOMINATION_OPTIONS}
                placeholder="Any"
                searchable
                searchPlaceholder="Search denomination..."
                triggerClassName="w-full rounded-xl bg-slate-900/70 border border-purple-300/30 px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-purple-400/40"
                menuClassName="border-purple-300/30 bg-slate-900/98"
              />
            </section>

            <section data-filter-section="church-attendance" className="rounded-[22px] border border-amber-400/20 bg-amber-500/10 p-4 sm:p-5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-amber-200 mb-2">Church Attendance</label>
              <AppDropdown
                value={churchAttendance}
                onChange={setChurchAttendance}
                options={CHURCH_ATTENDANCE_OPTIONS}
                placeholder="Any"
                triggerClassName="w-full rounded-xl bg-slate-900/70 border border-amber-300/30 px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-amber-400/40"
                menuClassName="border-amber-300/30 bg-slate-900/98"
              />
            </section>

            <section data-filter-section="relationship-goal" className="rounded-[22px] border border-rose-400/20 bg-rose-500/10 p-4 sm:p-5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-rose-200 mb-2">Relationship Goal</label>
              <AppDropdown
                value={relationshipGoal}
                onChange={setRelationshipGoal}
                options={RELATIONSHIP_GOAL_OPTIONS}
                placeholder="Any"
                triggerClassName="w-full rounded-xl bg-slate-900/70 border border-rose-300/30 px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-rose-400/40"
                menuClassName="border-rose-300/30 bg-slate-900/98"
              />
            </section>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-slate-700/60 bg-slate-950/95 px-3 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur-xl sm:px-5 sm:py-5">
        <div className="space-y-3">
        <button
          type="button"
          onClick={handleApply}
          className="w-full rounded-[22px] bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-3 text-white font-semibold transition-colors hover:from-pink-400 hover:to-purple-500"
        >
          Apply Filters
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="flex w-full items-center justify-center gap-2 rounded-[22px] border border-slate-600/70 bg-slate-800/60 px-4 py-3 font-medium text-slate-200 transition-colors hover:bg-slate-700/60"
        >
          <RotateCcw className="w-4 h-4" />
          Clear Filters
        </button>
        </div>
      </div>

      {passportPickerOpen && isPremiumUser && passportModeEnabled ? (
        <div className="fixed inset-0 z-[1300] sm:hidden">
          <button
            type="button"
            aria-label="Close passport picker"
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setPassportPickerOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-hidden rounded-t-[28px] border-t border-white/10 bg-slate-950 shadow-[0_-20px_60px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-center px-4 pb-2 pt-3">
              <div className="h-1.5 w-12 rounded-full bg-white/15" />
            </div>
            <div className="border-b border-slate-800 px-4 pb-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">Choose country</p>
                  <p className="mt-1 text-xs text-slate-400">Selected: {selectedPassportOption.label}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPassportPickerOpen(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/80"
                >
                  Done
                </button>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={passportSearchTerm}
                  onChange={(event) => setPassportSearchTerm(event.target.value)}
                  placeholder="Search countries..."
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/90 py-3 pl-10 pr-4 text-base text-white placeholder-slate-400 outline-none focus:border-pink-500"
                />
              </div>
            </div>
            <div className="max-h-[calc(82dvh-132px)] overflow-y-auto overscroll-contain px-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-2">
              {filteredPassportOptions.length > 0 ? (
                filteredPassportOptions.map((option) => {
                  const isSelected = option.value === passportCountry;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPassportCountry(option.value)}
                      className={`mb-1 flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left text-base leading-snug transition ${
                        isSelected ? 'bg-pink-500/20 text-pink-100' : 'text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      <span className="min-w-0 flex-1 whitespace-normal break-words">{option.label}</span>
                      {isSelected ? <span className="shrink-0 text-sm font-semibold text-pink-200">Selected</span> : null}
                    </button>
                  );
                })
              ) : (
                <p className="px-4 py-4 text-sm text-slate-400">No countries found.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
