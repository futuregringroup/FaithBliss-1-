import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Crown, Heart, Sparkles, Zap } from 'lucide-react';
import { PREMIUM_PLAN_CONTENT } from '@/constants/subscriptionPlans';

type PublicPlan = {
  name: string;
  price: string;
  cadence: string;
  description: string;
  cta: string;
  highlight?: boolean;
  tag?: string;
};

const premiumPlans: PublicPlan[] = [
  {
    name: 'Premium Monthly',
    price: '$11.99',
    cadence: '/month',
    description: 'Best for steady monthly access to all premium features.',
    cta: 'Start Monthly Plan',
    highlight: true,
  },
  {
    name: 'Premium 3-Month',
    price: '$23.97',
    cadence: '/3 months',
    description: 'Commit to three months of uninterrupted premium access.',
    cta: 'Start 3-Month Plan',
    tag: 'Popular',
  },
];

const EXPLORE_FEATURE_PREFIX = 'Full access to the Explore page:';

const renderFeature = (feature: string) => {
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

export default function PublicPremium() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navOpacity = Math.min(scrollY / 100, 0.95);

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 text-white no-horizontal-scroll">
      <nav
        className="fixed left-0 right-0 top-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: `rgba(17, 24, 39, ${navOpacity})`,
          backdropFilter: navOpacity > 0.1 ? 'blur(10px)' : 'none',
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center space-x-2">
            <Heart className="h-8 w-8 text-pink-500" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-white">FaithBliss</span>
              <span className="text-xs font-medium text-pink-300">
                Africa&apos;s Trusted Platform for
                <br />
                Christian Singles
              </span>
            </div>
          </Link>
          <div className="hidden md:flex space-x-8">
            <Link to="/" className="text-white transition-colors hover:text-pink-400">
              Home
            </Link>
            <Link to="/about" className="text-white transition-colors hover:text-pink-400">
              About
            </Link>
            <Link to="/help" className="text-white transition-colors hover:text-pink-400">
              Help
            </Link>
            <Link to="/contact" className="text-white transition-colors hover:text-pink-400">
              Contact
            </Link>
          </div>
          <Link
            to="/signup"
            className="whitespace-nowrap rounded-full bg-pink-500 px-6 py-2 text-sm text-white transition-all hover:bg-pink-600 md:text-base"
          >
            Join Now
          </Link>
        </div>
      </nav>

      <div className="relative overflow-hidden px-6 pb-20 pt-32 sm:px-8 lg:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(236,72,153,0.18),transparent_42%),radial-gradient(circle_at_bottom,rgba(168,85,247,0.12),transparent_58%)]" />
        <div className="absolute -right-20 top-24 h-60 w-60 rounded-full bg-pink-500/15 blur-3xl" />
        <div className="absolute -left-16 bottom-16 h-72 w-72 rounded-full bg-purple-500/15 blur-3xl" />

        <div className="relative mx-auto max-w-7xl">
          <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div className="max-w-2xl space-y-5 rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-[0_30px_90px_rgba(2,6,23,0.35)] sm:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-pink-200">
                <Crown className="h-4 w-4 text-pink-300" />
                Premium for intentional believers
              </div>
              <h1 className="text-4xl font-semibold leading-tight text-white md:text-5xl">
                Premium tools built for more intentional Christian matching.
              </h1>
              <p className="text-base leading-8 text-gray-300 md:text-lg">
                FaithBliss Premium is designed for people who want extra clarity, better visibility,
                and more ways to connect with believers who share their faith and life direction. You
                can compare plans here, then create an account or sign in when you are ready to start.
              </p>
              <p className="text-sm text-gray-400">
                Prices are shown in USD on this public page. Nigerian users are charged in NGN; all other countries are charged in USD at checkout.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/signup"
                  className="rounded-full bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/30 transition hover:from-pink-400 hover:to-purple-500"
                >
                  Create account
                </Link>
                <Link
                  to="/help"
                  className="rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 transition hover:border-white/30 hover:bg-white/10"
                >
                  Questions about premium?
                </Link>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-1">
              {premiumPlans.map((plan) => (
                <article
                  key={plan.name}
                  className={`relative flex h-full flex-col rounded-3xl border p-6 transition ${
                    plan.highlight
                      ? 'border-pink-500/50 bg-gradient-to-br from-pink-500/20 to-purple-600/20 shadow-lg shadow-pink-500/20'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  {plan.tag ? (
                    <div className="mb-5">
                      <div className="inline-flex rounded-full bg-white/12 px-4 py-1.5 text-sm font-semibold text-white shadow-sm shadow-pink-500/10">
                        {plan.tag}
                      </div>
                    </div>
                  ) : null}
                  <h2 className="text-xl font-semibold text-white">{plan.name}</h2>
                  <p className="mt-2 text-sm text-gray-300">{plan.description}</p>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-3xl font-semibold text-white">{plan.price}</span>
                    <span className="text-xs text-gray-400">{plan.cadence}</span>
                  </div>

                  <ul className="mt-6 space-y-3 text-sm text-gray-300">
                    {PREMIUM_PLAN_CONTENT.premium.features.map((feature) => (
                      <li key={`${plan.name}-${feature}`} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-pink-300" />
                        <span>{renderFeature(feature)}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to="/signup"
                    className={`mt-8 inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                      plan.highlight
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/30 hover:from-pink-400 hover:to-purple-500'
                        : 'border border-white/15 bg-white/5 text-white/90 hover:border-white/30 hover:bg-white/10'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 text-sm text-pink-200">
                <Zap className="h-4 w-4 text-pink-300" />
                Why members upgrade
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-white">More control, more visibility, more intentional matches.</h2>
              <p className="mt-4 text-sm leading-7 text-gray-300">
                Premium helps serious members move beyond free-plan limits. If you want more swipes,
                stronger filtering, access to the Explore experience, and the ability to connect more
                consistently, this page gives you a clean view of what unlocks after sign in.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/about"
                  className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40"
                >
                  Learn about FaithBliss
                </Link>
                <Link
                  to="/contact"
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-gray-900 transition hover:bg-white/90"
                >
                  Contact support
                </Link>
              </div>
            </article>

            <article className="rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-transparent p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 text-sm text-pink-200">
                <Sparkles className="h-4 w-4 text-pink-300" />
                Premium note
              </div>
              <h2 className="mt-3 text-2xl font-semibold text-white">Need help before upgrading?</h2>
              <p className="mt-4 text-sm leading-7 text-gray-300">
                Visit the <Link to="/help" className="font-semibold text-pink-300 hover:text-pink-200">Help Center</Link>{' '}
                for support details, or review our{' '}
                <Link to="/terms" className="font-semibold text-pink-300 hover:text-pink-200">
                  Terms
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="font-semibold text-pink-300 hover:text-pink-200">
                  Privacy Policy
                </Link>{' '}
                before checkout.
              </p>
            </article>
          </section>
        </div>
      </div>
    </main>
  );
}
