import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Receipt,
  ShieldCheck,
  Sparkles,
  Wallet,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { TopBar } from '@/components/dashboard/TopBar';
import { SidePanel } from '@/components/dashboard/SidePanel';
import ProfileBoosterIcon from '@/components/icons/ProfileBoosterIcon';
import { useAuthContext } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  API,
  type ProfileBoosterPricingQuoteResponse,
} from '@/services/api';
import { useSubscriptionDisplay } from '@/hooks/useSubscriptionDisplay';

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
    return `${hours}h ${minutes}m remaining`;
  }

  return `${minutes}m remaining`;
};

const boosterBenefits = [
  'One credit activates one hour of priority visibility.',
  'Activate only when you want extra profile momentum.',
  'Secure checkout with localized pricing where available.',
];

const purchaseSteps = [
  {
    title: 'Buy credits',
    description: 'Choose a single credit or a small bundle based on how often you want to boost.',
    icon: Wallet,
  },
  {
    title: 'Activate anytime',
    description: 'Use a credit when you want an immediate lift in discovery without changing your setup.',
    icon: Sparkles,
  },
  {
    title: 'Stay visible for one hour',
    description: 'Your profile gets a focused priority window designed to increase profile views.',
    icon: Clock3,
  },
];

export default function InAppPurchases() {
  const { user, refetchUser } = useAuthContext();
  const { showError, showSuccess } = useToast();
  const subscriptionDisplay = useSubscriptionDisplay(user);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [boosterQuote, setBoosterQuote] = useState<ProfileBoosterPricingQuoteResponse | null>(null);
  const [isActivatingBooster, setIsActivatingBooster] = useState(false);
  const [isBuyingBooster, setIsBuyingBooster] = useState<'single' | 'bundle' | null>(null);

  const layoutName = user?.name || 'User';
  const layoutImage = user?.profilePhoto1 || undefined;
  const layoutUser = user || null;
  const profileBoosterCredits = typeof user?.profileBoosterCredits === 'number' ? user.profileBoosterCredits : 0;
  const profileBoosterActiveUntil =
    typeof user?.profileBoosterActiveUntil === 'string' && Date.parse(user.profileBoosterActiveUntil) > Date.now()
      ? user.profileBoosterActiveUntil
      : null;
  const profileBoosterCountdown = formatProfileBoosterCountdown(profileBoosterActiveUntil);
  const effectiveBoosterQuote = boosterQuote ?? fallbackBoosterQuote;
  const singleQuote = effectiveBoosterQuote.quotes.single;
  const bundleQuote = effectiveBoosterQuote.quotes.bundle;

  useEffect(() => {
    let isMounted = true;

    const loadBoosterQuote = async () => {
      try {
        setPricingLoading(true);
        const quote = await API.Payment.getProfileBoosterQuote();
        if (isMounted) {
          setBoosterQuote(quote);
        }
      } catch (error: unknown) {
        if (isMounted) {
          setBoosterQuote(null);
        }
        showError(getErrorMessage(error, 'Unable to load in-app purchase pricing.'));
      } finally {
        if (isMounted) {
          setPricingLoading(false);
        }
      }
    };

    loadBoosterQuote();

    return () => {
      isMounted = false;
    };
  }, [showError]);

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
      showError('No booster credits available. Buy a boost bundle to continue.');
      return;
    }

    try {
      setIsActivatingBooster(true);
      const response = await API.User.activateProfileBooster();
      await refetchUser();
      showSuccess(
        `Your profile is now boosted for 1 hour. ${response.remainingCredits} credit${response.remainingCredits === 1 ? '' : 's'} left.`,
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

  const purchaseCards = [
    {
      key: 'bundle' as const,
      tag: 'Recommended',
      title: `${bundleQuote.bundleSize} booster credits`,
      subtitle: 'Best for members who want credits ready when discovery matters most.',
      price: bundleQuote.displayLabel,
      description: 'Keep a small reserve of visibility boosts for profile updates, peak activity hours, or returning after time away.',
      note: getPricingNote(bundleQuote.region, bundleQuote.displayCurrency),
      accentClass: 'border-emerald-200/80 bg-white',
      badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      iconClass: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
      buttonClass: 'bg-slate-950 text-white hover:bg-slate-800',
      detailLabel: `${bundleQuote.bundleSize} separate one-hour boosts`,
    },
    {
      key: 'single' as const,
      tag: 'Flexible',
      title: `${singleQuote.bundleSize} booster credit`,
      subtitle: 'A simple top-up when you only need one focused visibility session.',
      price: singleQuote.displayLabel,
      description: 'Ideal if you want a single push now without committing to a larger pack of credits.',
      note: getPricingNote(singleQuote.region, singleQuote.displayCurrency),
      accentClass: 'border-slate-200/90 bg-slate-50',
      badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
      iconClass: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
      buttonClass: 'bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50',
      detailLabel: `${singleQuote.bundleSize} one-hour boost ready to use`,
    },
  ];

  const boosterStatusLabel = profileBoosterActiveUntil
    ? 'Boost live'
    : profileBoosterCredits > 0
    ? 'Credits available'
    : 'No credits';
  const boosterStatusDescription = profileBoosterActiveUntil
    ? `Priority visibility is active${profileBoosterCountdown ? `, ${profileBoosterCountdown}.` : '.'}`
    : profileBoosterCredits > 0
    ? 'You have credits ready to activate whenever you want a stronger discovery window.'
    : 'Buy a credit pack to unlock one-hour profile boosts on demand.';
  const isActivationDisabled =
    !subscriptionDisplay.isActivePaid || profileBoosterCredits < 1 || Boolean(profileBoosterActiveUntil) || isActivatingBooster;

  const mainContent = (
    <div className="flex-1">
      <div className="relative overflow-hidden px-3 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8 xl:px-12">
        <div className="absolute inset-0 bg-slate-200/10" />
        <div className="absolute left-8 top-8 h-40 w-40 rounded-full bg-emerald-200/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-sky-200/10 blur-3xl" />

        <div className="relative mx-auto max-w-7xl space-y-4 sm:space-y-6">
          <div className="flex items-center justify-start">
            <Link
              to="/dashboard"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white transition hover:bg-white/10"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </div>

          <section className="overflow-hidden rounded-[1.6rem] border border-slate-200/70 bg-slate-50 text-slate-950 shadow-[0_28px_80px_rgba(15,23,42,0.18)] sm:rounded-[2rem]">
            <div className="grid gap-0 xl:grid-cols-[minmax(0,1.45fr)_360px]">
              <div className="border-b border-slate-200/80 px-4 py-5 sm:px-8 sm:py-7 lg:px-10 lg:py-9 xl:border-b-0 xl:border-r">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-700">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      Secure in-app purchases
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-700">
                      <Sparkles className="h-3.5 w-3.5 text-slate-600" />
                      Booster credits
                    </span>
                  </div>

                  <div className="max-w-3xl space-y-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600">
                      Visibility store
                    </p>
                    <h1 className="max-w-[16ch] text-balance text-[2rem] font-semibold leading-[0.98] tracking-[-0.05em] text-slate-950 sm:text-[2.7rem] lg:text-[3.4rem]">
                      Buy booster credits with a calmer, cleaner checkout flow.
                    </h1>
                    <p className="max-w-2xl text-[15px] leading-7 text-slate-700 sm:text-base sm:leading-8">
                      See your current booster balance, understand what each credit does, and top up only when you need more profile visibility.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <button
                      type="button"
                      onClick={handleActivateBooster}
                      disabled={isActivationDisabled}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    >
                      {profileBoosterActiveUntil
                        ? profileBoosterCountdown || 'Boost live'
                        : isActivatingBooster
                        ? 'Activating...'
                        : 'Activate a booster'}
                    </button>

                    <a
                      href="#booster-packages"
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                    >
                      View booster packages
                    </a>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {boosterBenefits.map((benefit) => (
                      <div
                        key={benefit}
                        className="rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                          <p className="text-sm leading-6 text-slate-700">{benefit}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="px-4 py-5 sm:px-8 sm:py-7 lg:px-10 lg:py-9">
                <div className="rounded-[1.45rem] border border-slate-200 bg-white p-4 shadow-[0_18px_36px_rgba(15,23,42,0.08)] sm:rounded-[1.8rem] sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                      <img
                        src={layoutImage || '/default-avatar.png'}
                        alt={layoutName}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">Purchase profile</p>
                      <h2 className="truncate text-xl font-semibold tracking-[-0.04em] text-slate-950">{layoutName}</h2>
                      <p className="text-sm font-medium text-slate-700">Booster wallet overview</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:mt-6">
                    <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Available credits</p>
                          <p className="mt-2 text-[2rem] font-semibold leading-none tracking-[-0.05em] text-slate-950">
                            {profileBoosterCredits}
                          </p>
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                          <Wallet className="h-5 w-5" />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Boost status</p>
                          <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-950">{boosterStatusLabel}</p>
                        </div>
                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                          profileBoosterActiveUntil ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          <Sparkles className="h-5 w-5" />
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-700">{boosterStatusDescription}</p>
                    </div>
                    <div className="rounded-[1.35rem] border border-slate-200 bg-slate-900 p-4 text-white">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">Visibility note</p>
                      <p className="mt-2 text-base font-semibold">Use credits when timing matters most</p>
                      <p className="mt-3 text-sm leading-6 text-slate-100">
                        Keep credits available for profile refreshes, peak activity hours, or whenever you want a focused discovery push.
                      </p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-6">
              <section
                id="booster-packages"
                className="rounded-[1.6rem] border border-slate-200/70 bg-white p-4 text-slate-950 shadow-[0_20px_50px_rgba(15,23,42,0.12)] sm:rounded-[2rem] sm:p-6 lg:p-8"
              >
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:pb-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">Booster packages</p>
                    <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.1rem]">
                      Choose the right top-up for your next visibility push
                    </h2>
                  </div>
                  <div className="w-fit rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                    {pricingLoading ? 'Refreshing pricing...' : 'Localized pricing loaded'}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:mt-6 sm:gap-5 xl:grid-cols-2">
                  {purchaseCards.map((card) => (
                    <article
                      key={card.key}
                      className={`relative overflow-hidden rounded-[1.45rem] border p-4 shadow-[0_18px_36px_rgba(15,23,42,0.08)] sm:rounded-[1.7rem] sm:p-6 ${card.accentClass}`}
                    >
                      <div className="absolute right-0 top-0 h-32 w-32 bg-slate-100/80" />

                      <div className="relative flex h-full flex-col gap-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                            <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] ${card.iconClass}`}>
                              <ProfileBoosterIcon className="h-7 w-7" glowId={`purchases-${card.key}-booster`} />
                            </div>

                            <div className="min-w-0">
                              <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${card.badgeClass}`}>
                                {card.tag}
                              </span>
                              <h3 className="mt-3 text-[1.5rem] font-semibold leading-none tracking-[-0.04em] text-slate-950 sm:text-[1.85rem]">
                                {card.title}
                              </h3>
                              <p className="mt-2 text-sm leading-6 text-slate-700">{card.subtitle}</p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200/80 bg-white/90 px-3 py-2 text-left sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-right">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Price</p>
                            <p className="mt-1 text-[1.8rem] font-semibold tracking-[-0.05em] text-slate-950 sm:mt-2 sm:text-3xl">
                              {pricingLoading ? '...' : card.price}
                            </p>
                          </div>
                        </div>

                        <p className="text-[15px] leading-7 text-slate-700 sm:text-base">{card.description}</p>

                        <div className="space-y-3 rounded-[1.35rem] border border-slate-200/80 bg-white p-4">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <span className="text-sm leading-6 text-slate-700">{card.detailLabel}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                            <span className="text-sm leading-6 text-slate-700">Activate one credit at a time when you want a focused boost.</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" />
                            <span className="text-sm leading-6 text-slate-700">{card.note}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleBuyBooster(card.key)}
                          disabled={isBuyingBooster !== null}
                          className={`inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${card.buttonClass}`}
                        >
                          {isBuyingBooster === card.key ? 'Starting checkout...' : `Buy for ${pricingLoading ? '...' : card.price}`}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-[2rem] border border-slate-200/70 bg-white p-5 text-slate-950 shadow-[0_20px_50px_rgba(15,23,42,0.12)] sm:p-6 lg:p-8">
                <div className="max-w-2xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600">How it works</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[2.05rem]">
                    A purchase flow that feels simple, not salesy
                  </h2>
                  <p className="mt-3 text-base leading-7 text-slate-700">
                    Profile boosters are meant to be practical. You buy credits, use them when timing matters, and stay in control of when your extra visibility starts.
                  </p>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {purchaseSteps.map((step, index) => {
                    const Icon = step.icon;

                    return (
                      <div
                        key={step.title}
                        className="rounded-[1.45rem] border border-slate-200 bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className="text-sm font-semibold text-slate-500">0{index + 1}</span>
                        </div>
                        <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-slate-950">{step.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-700">{step.description}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            <aside className="hidden space-y-6 xl:sticky xl:top-24 xl:block xl:self-start">
              <section className="rounded-[1.8rem] border border-slate-200/70 bg-white p-5 text-slate-950 shadow-[0_18px_40px_rgba(15,23,42,0.12)] sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">Booster wallet</p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-slate-950">Ready to activate</h2>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-slate-950 text-white">
                    <ProfileBoosterIcon className="h-6 w-6" glowId="purchases-sidebar-booster" />
                  </div>
                </div>

                <div className="mt-5 rounded-[1.4rem] border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Current balance</p>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <p className="text-[2.4rem] font-semibold leading-none tracking-[-0.06em] text-slate-950">
                      {profileBoosterCredits}
                    </p>
                    <p className="pb-1 text-sm font-medium text-slate-700">
                      credit{profileBoosterCredits === 1 ? '' : 's'}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{boosterStatusDescription}</p>
                </div>

                {profileBoosterActiveUntil ? (
                  <div className="mt-4 rounded-[1.4rem] border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Live session</p>
                    <p className="mt-2 text-base font-semibold text-emerald-900">
                      {profileBoosterCountdown || 'Your profile is currently boosted.'}
                    </p>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleActivateBooster}
                  disabled={isActivationDisabled}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {profileBoosterActiveUntil
                    ? profileBoosterCountdown || 'Boost live'
                    : isActivatingBooster
                    ? 'Activating...'
                    : 'Activate now'}
                </button>
              </section>

              <section className="rounded-[1.8rem] border border-slate-200/70 bg-white p-5 text-slate-950 shadow-[0_18px_40px_rgba(15,23,42,0.12)] sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">Checkout details</p>
                <div className="mt-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-950">Protected payments</p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">All booster purchases move through a secure Paystack checkout session.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Receipt className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-950">Clear pricing</p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">{getPricingNote(bundleQuote.region, bundleQuote.displayCurrency)}</p>
                    </div>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#0f172a,#111827)] pb-20 text-white no-horizontal-scroll dashboard-main">
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
            title="In-App Purchases"
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
          title="In-App Purchases"
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
}
