import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Crown,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { TopBar } from '@/components/dashboard/TopBar';
import { SidePanel } from '@/components/dashboard/SidePanel';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  API,
  type LocalizedPricingQuoteResponse,
  type ProfileBoosterPricingQuoteResponse,
} from '@/services/api';
import {
  PREMIUM_PLAN_CONTENT,
  getSubscriptionTierLabel,
} from '@/constants/subscriptionPlans';
import { useSubscriptionDisplay } from '@/hooks/useSubscriptionDisplay';
import ProfileBoosterIcon from '@/components/icons/ProfileBoosterIcon';

type BillingCycle = 'monthly' | 'quarterly';

type DisplayPlan = {
  tier: 'free' | 'premium';
  billingCycle?: BillingCycle;
  name: string;
  description: string;
  displayPrice: string;
  billingSummary?: string;
  pricingNote?: string;
  originalPrice?: string;
  savingsLabel?: string;
  highlight?: boolean;
  tag?: string;
  features: string[];
  cta: string;
};

const FREE_PLAN: DisplayPlan = {
  tier: 'free',
  name: 'FaithBliss Free',
  description: 'A limited starter plan for browsing and basic matching.',
  displayPrice: 'Free',
  features: [
    'Sign in and create your account',
    '10 likes or swipes per day',
    '1 active chat at a time',
    'Gender filtering',
    'View user profiles',
  ],
  cta: 'Current Plan',
};

const badges = [
  'Verified community',
  'Faith-first matching',
  'Zero ads',
  'Cancel anytime',
];

const EXPLORE_FEATURE_PREFIX = 'Full access to the Explore page:';

const renderPlanFeature = (feature: string): ReactNode => {
  if (!feature.startsWith(EXPLORE_FEATURE_PREFIX)) {
    return feature;
  }

  const suffix = feature.slice(EXPLORE_FEATURE_PREFIX.length).trim();

  return (
    <span className="leading-6 text-gray-200">
      Full access to the{' '}
      <span className="inline-flex items-center rounded-full border border-fuchsia-400/40 bg-gradient-to-r from-pink-500/20 via-fuchsia-500/20 to-violet-500/20 px-2.5 py-0.5 text-[0.7rem] font-semibold tracking-[0.16em] text-pink-100 shadow-[0_0_18px_rgba(236,72,153,0.22)] backdrop-blur-sm">
        Explore
      </span>{' '}
      page: {suffix}
    </span>
  );
};

const fallbackQuote: LocalizedPricingQuoteResponse = {
  countryCode: null,
  region: 'global',
  quotes: {
    monthly: {
      tier: 'premium',
      billingCycle: 'monthly',
      region: 'global',
      countryCode: null,
      displayCurrency: 'USD',
      displayAmountMajor: 11.99,
      chargeCurrency: 'USD',
      chargeAmountMajor: 11.99,
      chargeAmountSubunits: 1199,
      exchangeRate: 1,
      displayLabel: '$11.99',
    },
    quarterly: {
      tier: 'premium',
      billingCycle: 'quarterly',
      region: 'global',
      countryCode: null,
      displayCurrency: 'USD',
      displayAmountMajor: 23.97,
      chargeCurrency: 'USD',
      chargeAmountMajor: 23.97,
      chargeAmountSubunits: 2397,
      exchangeRate: 1,
      displayLabel: '$23.97',
    },
  },
};

const fallbackBoosterQuote: ProfileBoosterPricingQuoteResponse = {
  countryCode: null,
  region: 'global',
  quotes: {
    single: {
      productType: 'profile_booster',
      bundleKey: 'single',
      bundleSize: 1,
      region: 'global',
      countryCode: null,
      displayCurrency: 'USD',
      displayAmountMajor: 4,
      chargeCurrency: 'USD',
      chargeAmountMajor: 4,
      chargeAmountSubunits: 400,
      exchangeRate: 1,
      displayLabel: '$4.00',
    },
    bundle: {
      productType: 'profile_booster',
      bundleKey: 'bundle',
      bundleSize: 5,
      region: 'global',
      countryCode: null,
      displayCurrency: 'USD',
      displayAmountMajor: 7,
      chargeCurrency: 'USD',
      chargeAmountMajor: 7,
      chargeAmountSubunits: 700,
      exchangeRate: 1,
      displayLabel: '$7.00',
    },
  },
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string' &&
    (error as { message: string }).message.trim()
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
};

const getPricingNote = (region: 'nigeria' | 'africa' | 'global', displayCurrency: string) => {
  if (region === 'nigeria') {
    return 'Charged in NGN at checkout.';
  }

  if (region === 'africa') {
    return `Shown in ${displayCurrency}. Charged in USD at checkout.`;
  }

  return 'Charged in USD at checkout.';
};

const formatProfileBoosterCountdown = (activeUntil: string | null | undefined) => {
  if (!activeUntil) return null;

  const timeLeftMs = Date.parse(activeUntil) - Date.now();
  if (Number.isNaN(timeLeftMs) || timeLeftMs <= 0) return null;

  const totalMinutes = Math.ceil(timeLeftMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m left`;
  }

  return `${minutes}m left`;
};

const PremiumContent = () => {
  const { user, refetchUser } = useAuthContext();
  const { showError, showSuccess } = useToast();
  const planSectionRef = useRef<HTMLDivElement | null>(null);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [loadingPlanKey, setLoadingPlanKey] = useState<'premium:monthly' | 'premium:quarterly' | null>(null);
  const [pricingQuote, setPricingQuote] = useState<LocalizedPricingQuoteResponse | null>(null);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [boosterQuote, setBoosterQuote] = useState<ProfileBoosterPricingQuoteResponse | null>(null);
  const [boosterPricingLoading, setBoosterPricingLoading] = useState(true);
  const [isBuyingBooster, setIsBuyingBooster] = useState<'single' | 'bundle' | null>(null);
  const [isActivatingBooster, setIsActivatingBooster] = useState(false);

  const layoutName = user?.name || 'User';
  const layoutImage = user?.profilePhoto1 || undefined;
  const layoutUser = user || null;
  const profileBoosterCredits = typeof user?.profileBoosterCredits === 'number' ? user.profileBoosterCredits : 0;
  const profileBoosterActiveUntil =
    typeof user?.profileBoosterActiveUntil === 'string' && Date.parse(user.profileBoosterActiveUntil) > Date.now()
      ? user.profileBoosterActiveUntil
      : null;
  const profileBoosterCountdown = formatProfileBoosterCountdown(profileBoosterActiveUntil);
  const isPremium =
    user?.subscriptionStatus === 'active' &&
    user?.subscriptionTier === 'premium';
  const activeTier = user?.subscriptionTier || 'free';
  const activeBillingCycle = user?.subscription?.billingCycle === 'quarterly' ? 'quarterly' : 'monthly';
  const normalizedActiveTier: DisplayPlan['tier'] = isPremium ? 'premium' : 'free';
  const subscriptionDisplay = useSubscriptionDisplay(user);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    refetchUser();

    const handleFocusRefresh = () => {
      refetchUser();
    };

    window.addEventListener('focus', handleFocusRefresh);
    document.addEventListener('visibilitychange', handleFocusRefresh);

    return () => {
      window.removeEventListener('focus', handleFocusRefresh);
      document.removeEventListener('visibilitychange', handleFocusRefresh);
    };
  }, [refetchUser, user?.id]);

  useEffect(() => {
    let isMounted = true;

    const loadPricingQuote = async () => {
      try {
        setPricingLoading(true);
        const quote = await API.Payment.getQuote();
        if (isMounted) {
          setPricingQuote(quote);
        }
      } catch (error: unknown) {
        if (isMounted) {
          setPricingQuote(null);
        }
        showError(getErrorMessage(error, 'Unable to load localized pricing.'));
      } finally {
        if (isMounted) {
          setPricingLoading(false);
        }
      }
    };

    loadPricingQuote();

    return () => {
      isMounted = false;
    };
  }, [showError]);

  useEffect(() => {
    let isMounted = true;

    const loadBoosterQuote = async () => {
      try {
        setBoosterPricingLoading(true);
        const quote = await API.Payment.getProfileBoosterQuote();
        if (isMounted) {
          setBoosterQuote(quote);
        }
      } catch (error: unknown) {
        if (isMounted) {
          setBoosterQuote(null);
        }
        showError(getErrorMessage(error, 'Unable to load booster pricing.'));
      } finally {
        if (isMounted) {
          setBoosterPricingLoading(false);
        }
      }
    };

    loadBoosterQuote();

    return () => {
      isMounted = false;
    };
  }, [showError]);

  const effectiveQuote = pricingQuote ?? fallbackQuote;
  const effectiveBoosterQuote = boosterQuote ?? fallbackBoosterQuote;
  const singleBoosterQuote = effectiveBoosterQuote.quotes.single;
  const bundleBoosterQuote = effectiveBoosterQuote.quotes.bundle;

  const paidPlans = useMemo<DisplayPlan[]>(() => {
    const monthlyQuote = effectiveQuote.quotes.monthly;
    const quarterlyQuote = effectiveQuote.quotes.quarterly;

    return [
      {
        tier: 'premium',
        billingCycle: 'monthly',
        name: 'Premium Monthly',
        ...PREMIUM_PLAN_CONTENT.premium,
        description: 'Best for steady monthly access to all premium features.',
        displayPrice: monthlyQuote.displayLabel,
        pricingNote: getPricingNote(monthlyQuote.region, monthlyQuote.displayCurrency),
        highlight: true,
        cta: 'Start Monthly Plan',
      },
      {
        tier: 'premium',
        billingCycle: 'quarterly',
        name: 'Premium 3-Month',
        ...PREMIUM_PLAN_CONTENT.premium,
        description: 'Commit to three months of uninterrupted premium access.',
        displayPrice: quarterlyQuote.displayLabel,
        billingSummary:
          quarterlyQuote.region === 'global'
            ? 'Equivalent to $7.99 per month, billed as $23.97 every 3 months.'
            : undefined,
        pricingNote: getPricingNote(quarterlyQuote.region, quarterlyQuote.displayCurrency),
        highlight: true,
        tag: 'Popular • 3 Months',
        cta: 'Start 3-Month Plan',
      },
    ];
  }, [effectiveQuote]);

  const primaryPaidPlan = paidPlans[0];

  const displayPlans = useMemo<DisplayPlan[]>(
    () => [FREE_PLAN, ...paidPlans],
    [paidPlans],
  );

  const handleComparePlans = () => {
    planSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleStartPlan = async (plan: DisplayPlan) => {
    if (!user?.email) {
      showError('Please sign in to continue.');
      return;
    }

    if (plan.tier === 'free' || !plan.billingCycle) {
      showError('This plan is not payable.');
      return;
    }

    if (isPremium && activeTier === plan.tier && activeBillingCycle === plan.billingCycle) {
      showSuccess('Your subscription is already active.');
      return;
    }

    try {
      setLoadingPlanKey(`premium:${plan.billingCycle}`);
      const initResponse = await API.Payment.pay({
        tier: 'premium',
        billingCycle: plan.billingCycle,
      });

      if (!initResponse.authorizationUrl) {
        throw new Error('Payment initialization failed. Missing authorization URL.');
      }

      window.location.assign(initResponse.authorizationUrl);
    } catch (error: unknown) {
      setLoadingPlanKey(null);
      showError(getErrorMessage(error, 'Unable to start payment.'));
    }
  };

  const handleActivateBooster = async () => {
    if (!subscriptionDisplay.isActivePaid) {
      showError('An active premium subscription is required to use profile boosters.');
      return;
    }

    if (profileBoosterActiveUntil) {
      showSuccess('Your profile boost is already live.');
      return;
    }

    if (profileBoosterCredits < 1) {
      showError('No booster credits available yet.');
      return;
    }

    try {
      setIsActivatingBooster(true);
      const response = await API.User.activateProfileBooster();
      await refetchUser();
      showSuccess(
        `Your profile is boosted for 1 hour. ${response.remainingCredits} credit${response.remainingCredits === 1 ? '' : 's'} left.`,
        'Booster Activated'
      );
    } catch (error: unknown) {
      showError(getErrorMessage(error, 'Unable to activate your booster right now.'));
    } finally {
      setIsActivatingBooster(false);
    }
  };

  const handleBuyBooster = async (bundleKey: 'single' | 'bundle') => {
    try {
      setIsBuyingBooster(bundleKey);
      const response = await API.Payment.buyProfileBooster({ bundleKey });

      if (!response.authorizationUrl) {
        throw new Error('Booster checkout URL is unavailable.');
      }

      window.location.assign(response.authorizationUrl);
    } catch (error: unknown) {
      setIsBuyingBooster(null);
      showError(getErrorMessage(error, 'Unable to start booster checkout.'));
    }
  };

  const boosterStatusPill = profileBoosterActiveUntil
    ? profileBoosterCountdown || 'Boost live'
    : `${profileBoosterCredits} credit${profileBoosterCredits === 1 ? '' : 's'}`;
  const isBoosterActivationDisabled =
    !subscriptionDisplay.isActivePaid || profileBoosterCredits < 1 || Boolean(profileBoosterActiveUntil) || isActivatingBooster;
  const boosterSection = (
    <section id="boosters" className="px-6 pb-16 lg:px-12">
      <div className="rounded-3xl border border-fuchsia-300/20 bg-[linear-gradient(145deg,rgba(17,24,39,0.88),rgba(88,28,135,0.38))] p-5 shadow-[0_18px_40px_rgba(88,28,135,0.22)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-fuchsia-200/20 bg-white/10">
                <ProfileBoosterIcon className="h-6 w-6" glowId="premium-booster-card" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-100/70">Booster corner</p>
                <h3 className="mt-1 text-xl font-semibold text-white">Profile boosters</h3>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-200">
              Keep booster credits ready for the moments when extra visibility matters most.
            </p>
          </div>

          <div className="w-fit rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-50">
            {boosterStatusPill}
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">1 credit = 1 hour boost</p>
              {profileBoosterActiveUntil ? (
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-200">
                  <Clock3 className="h-3.5 w-3.5" />
                  {profileBoosterCountdown || 'Live now'}
                </div>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-gray-300">
              Buy a quick top-up here and activate when timing matters.
            </p>
          </div>

          <button
            type="button"
            onClick={handleActivateBooster}
            disabled={isBoosterActivationDisabled}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 bg-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-black/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {profileBoosterActiveUntil
              ? profileBoosterCountdown || 'Boost live'
              : isActivatingBooster
              ? 'Activating...'
              : 'Activate credit'}
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:max-w-xl">
          <button
            type="button"
            onClick={() => handleBuyBooster('single')}
            disabled={isBuyingBooster !== null}
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBuyingBooster === 'single'
              ? 'Starting...'
              : `${singleBoosterQuote.bundleSize} Boost${singleBoosterQuote.bundleSize === 1 ? '' : 's'} - ${boosterPricingLoading ? '...' : singleBoosterQuote.displayLabel}`}
          </button>
          <button
            type="button"
            onClick={() => handleBuyBooster('bundle')}
            disabled={isBuyingBooster !== null}
            className="rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-pink-400 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBuyingBooster === 'bundle'
              ? 'Starting...'
              : `${bundleBoosterQuote.bundleSize} Boosts - ${boosterPricingLoading ? '...' : bundleBoosterQuote.displayLabel}`}
          </button>
        </div>

        <p className="mt-3 text-[11px] text-fuchsia-100/75">
          {subscriptionDisplay.isActivePaid ? 'Checkout stays in Paystack.' : 'Premium is required before you can activate credits.'}
        </p>
      </div>
    </section>
  );

  const mainContent = (
    <div className="flex-1">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.25),_transparent_55%)]" />
        <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />

        <div className="relative px-6 pb-12 pt-7 lg:px-12 lg:py-16">
          <div className="mb-5 flex items-center justify-start">
            <Link
              to="/dashboard"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
              aria-label="Back to dashboard"
              title="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="max-w-2xl space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-pink-200">
                <Crown className="h-4 w-4 text-pink-300" />
                Premium for intentional believers
              </div>
              <h1 className="text-3xl font-semibold text-white md:text-4xl lg:text-5xl">
                Elevate your love journey with premium connections.
              </h1>
              <p className="text-base text-gray-300 md:text-lg">
                Designed for believers seeking marriage-minded relationships, FaithBliss Premium
                gives you clarity, priority visibility, and a beautifully guided path to the right match.
              </p>
              <p className="text-sm text-gray-400">
                Your displayed price is localized by country. Nigerian users are charged in NGN; all other countries are charged in USD.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleStartPlan(primaryPaidPlan)}
                  disabled={
                    pricingLoading ||
                    loadingPlanKey === `premium:${primaryPaidPlan.billingCycle}` ||
                    (isPremium && activeBillingCycle === primaryPaidPlan.billingCycle)
                  }
                  className="rounded-full bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/30 transition hover:from-pink-400 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pricingLoading
                    ? 'Loading price...'
                    : isPremium && activeBillingCycle === primaryPaidPlan.billingCycle
                    ? `${getSubscriptionTierLabel(primaryPaidPlan.tier)} Active`
                    : `Start ${getSubscriptionTierLabel(primaryPaidPlan.tier)}`}
                </button>
                <button
                  onClick={handleComparePlans}
                  className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 transition hover:border-white/30 hover:bg-white/10"
                >
                  Compare plans
                </button>
              </div>
              <div className="flex flex-wrap gap-3 pt-2 text-xs text-gray-400">
                {badges.map((badge) => (
                  <span
                    key={badge}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            </div>

            <div className="w-full max-w-[520px] lg:justify-self-end">
              <div className={`mb-4 rounded-3xl border p-5 shadow-[0_18px_40px_rgba(2,6,23,0.18)] ${
                subscriptionDisplay.isActivePaid
                  ? 'border-yellow-400/30 bg-gradient-to-br from-yellow-500/15 via-pink-500/10 to-transparent'
                  : 'border-white/10 bg-white/5'
              }`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">Current plan</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">{subscriptionDisplay.tierLabel}</h3>
                    <p className="mt-2 text-sm text-gray-300">
                      {subscriptionDisplay.isActivePaid
                        ? `Your ${activeBillingCycle === 'quarterly' ? '3-month' : 'monthly'} premium benefits are active right now.`
                        : 'You are currently on the free plan.'}
                    </p>
                  </div>
                  <span className={`rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                    subscriptionDisplay.isActivePaid
                      ? 'bg-emerald-500/15 text-emerald-200'
                      : 'bg-white/10 text-gray-300'
                  }`}>
                    {subscriptionDisplay.statusLabel}
                  </span>
                </div>

                {subscriptionDisplay.isActivePaid ? (
                  <div className="mt-4">
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">Next renewal</p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {subscriptionDisplay.renewalLabel || 'Auto-renewing'}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section ref={planSectionRef} className="px-6 pb-16 pt-4 lg:px-12">
        <div className="mb-8 flex flex-col gap-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-purple-200">
            <Zap className="h-4 w-4 text-purple-300" />
            Choose your plan
          </div>
          <h2 className="text-2xl font-semibold text-white md:text-3xl">Premium that fits your journey</h2>
          <p className="text-sm text-gray-300">
            Unlock the tools that help you connect intentionally with people who share your faith and values.
          </p>
          <p className="text-xs uppercase tracking-[0.18em] text-gray-400">
            Region: {effectiveQuote.region}{effectiveQuote.countryCode ? ` • ${effectiveQuote.countryCode}` : ''}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {displayPlans.map((plan) => {
            const isCurrentPlan =
              normalizedActiveTier === plan.tier &&
              (plan.tier === 'free' || activeBillingCycle === plan.billingCycle);
            const planKey = plan.billingCycle ? (`premium:${plan.billingCycle}` as const) : null;
            const isPlanLoading = planKey !== null && loadingPlanKey === planKey;

            return (
              <div
                key={`${plan.name}-${plan.billingCycle ?? 'free'}`}
                className={`relative flex h-full flex-col rounded-3xl border p-6 transition ${
                  plan.highlight
                    ? 'border-pink-500/50 bg-gradient-to-br from-pink-500/20 to-purple-600/20 shadow-lg shadow-pink-500/20'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                {(plan.tag || plan.savingsLabel) && (
                  <div className="mb-5 flex min-h-[2rem] flex-wrap items-start gap-2 pr-16">
                    {plan.savingsLabel && (
                      <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                        {plan.savingsLabel}
                      </div>
                    )}
                    {plan.tag && (
                      <div className="rounded-full bg-white/12 px-4 py-1.5 text-sm font-semibold text-white shadow-sm shadow-pink-500/10">
                        {plan.tag}
                      </div>
                    )}
                  </div>
                )}
                <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                <p className="mt-2 text-sm text-gray-300">{plan.description}</p>
                <div className="mt-4 flex items-end gap-2">
                  <span className="text-3xl font-semibold text-white">{plan.displayPrice}</span>
                  {plan.tier !== 'free' && (
                    <span className="text-xs text-gray-400">
                      /{plan.billingCycle === 'quarterly' ? '3 months' : 'month'}
                    </span>
                  )}
                </div>
                {plan.originalPrice && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500 line-through">{plan.originalPrice}</span>
                    <span className="rounded-full border border-pink-400/30 bg-pink-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-pink-200">
                      Limited pricing
                    </span>
                  </div>
                )}
                {plan.billingSummary ? (
                  <p className="mt-2 text-xs font-medium text-pink-100/85">
                    {plan.billingSummary}
                  </p>
                ) : null}

                <ul className="mt-6 space-y-3 text-sm text-gray-300">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-pink-300" />
                      <span>{renderPlanFeature(feature)}</span>
                    </li>
                  ))}
                </ul>

                {plan.pricingNote ? (
                  <p className="mt-5 text-xs text-gray-400">{plan.pricingNote}</p>
                ) : null}

                <button
                  onClick={() => {
                    handleStartPlan(plan);
                  }}
                  disabled={
                    plan.tier === 'free' ||
                    pricingLoading ||
                    isPlanLoading ||
                    isCurrentPlan
                  }
                  className={`mt-8 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/30 hover:from-pink-400 hover:to-purple-500'
                      : 'border border-white/15 bg-white/5 text-white/90 hover:border-white/30 hover:bg-white/10'
                  } ${plan.tier === 'free' ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  {pricingLoading && plan.tier !== 'free'
                    ? 'Loading price...'
                    : isPlanLoading
                    ? 'Processing...'
                    : isCurrentPlan
                    ? 'Current Plan'
                    : plan.tier === 'free'
                    ? 'Free Plan'
                    : plan.cta}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {boosterSection}

      <section className="px-6 pb-16 lg:px-12">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-white/5 via-white/3 to-white/5 p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 text-sm text-pink-200">
                <Sparkles className="h-4 w-4 text-pink-300" />
                Premium experience
              </div>
              <h3 className="text-2xl font-semibold text-white">
                Ready to unlock the full FaithBliss experience?
              </h3>
              <p className="text-sm text-gray-300">
                Join believers discovering meaningful, marriage-minded connections with localized pricing.
              </p>
            </div>
            <button
              onClick={() => handleStartPlan(primaryPaidPlan)}
              disabled={
                pricingLoading ||
                loadingPlanKey === `premium:${primaryPaidPlan.billingCycle}` ||
                (isPremium && activeBillingCycle === primaryPaidPlan.billingCycle)
              }
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pricingLoading
                ? 'Loading price...'
                : isPremium && activeBillingCycle === primaryPaidPlan.billingCycle
                ? `${getSubscriptionTierLabel(primaryPaidPlan.tier)} Active`
                : `Upgrade to ${getSubscriptionTierLabel(primaryPaidPlan.tier)}`}
            </button>
          </div>
        </div>
      </section>
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 pb-20 text-white no-horizontal-scroll dashboard-main">
      <div className="hidden min-h-screen lg:flex">
        <div className="w-80 flex-shrink-0">
          <SidePanel
            userName={layoutName}
            userImage={layoutImage}
            user={layoutUser}
            onClose={() => setShowSidePanel(false)}
          />
        </div>
        <div className="flex min-h-screen flex-1 flex-col">
          <TopBar
            userName={layoutName}
            userImage={layoutImage}
            user={layoutUser}
            showFilters={false}
            showSidePanel={showSidePanel}
            onToggleFilters={() => {}}
            onToggleSidePanel={() => setShowSidePanel(false)}
            title="Premium"
          />
          <div className="flex-1 overflow-y-auto">{mainContent}</div>
        </div>
      </div>

      <div className="min-h-screen lg:hidden">
        <TopBar
          userName={layoutName}
          userImage={layoutImage}
          user={layoutUser}
          showFilters={false}
          showSidePanel={showSidePanel}
          onToggleFilters={() => {}}
          onToggleSidePanel={() => setShowSidePanel(true)}
          title="Premium"
        />
        <div className="flex-1">{mainContent}</div>
      </div>

      {showSidePanel && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowSidePanel(false)}
          />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw]">
            <SidePanel
              userName={layoutName}
              userImage={layoutImage}
              user={layoutUser}
              onClose={() => setShowSidePanel(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const PremiumPage = () => {
  return <PremiumContent />;
};

export default function ProtectedPremium() {
  return (
    <ProtectedRoute>
      <PremiumPage />
    </ProtectedRoute>
  );
}
