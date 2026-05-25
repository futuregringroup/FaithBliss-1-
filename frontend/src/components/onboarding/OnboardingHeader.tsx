import { ChevronLeft } from "lucide-react";
import React from "react";

interface OnboardingHeaderProps {
  currentSlide: number;
  totalSlides: number;
  onPrevious: () => void;
  canGoBack: boolean;
}

const STEP_LABELS = [
  'Your Photos',
  'Your Location',
  'Your Profile',
  'Your Intentions',
  'Partner Preferences',
];

export const OnboardingHeader: React.FC<OnboardingHeaderProps> = ({
  currentSlide,
  totalSlides,
  onPrevious,
  canGoBack,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-gray-950/90 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-6 pt-[env(safe-area-inset-top,0px)]">
      <div className="max-w-2xl mx-auto py-3">
        {/* Row 1: back button + brand wordmark + step counter */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onPrevious}
            disabled={!canGoBack}
            aria-label="Go back"
            className={`flex items-center gap-1 text-sm font-medium transition-colors duration-200 min-w-[56px]
              ${canGoBack
                ? 'text-gray-300 hover:text-white'
                : 'text-gray-600 cursor-not-allowed pointer-events-none'
              }`}
          >
            <ChevronLeft className="w-5 h-5 shrink-0" />
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Brand wordmark */}
          <span
            className="text-xs font-bold tracking-[0.18em] uppercase select-none"
            style={{
              background: 'var(--gradient-brand)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            FaithBliss
          </span>

          {/* Step counter */}
          <span className="text-xs text-gray-400 font-medium tabular-nums min-w-[56px] text-right">
            {currentSlide + 1} / {totalSlides}
          </span>
        </div>

        {/* Row 2: Segmented progress pills */}
        <div
          className="flex gap-1.5"
          role="progressbar"
          aria-valuenow={currentSlide + 1}
          aria-valuemax={totalSlides}
          aria-label={`Step ${currentSlide + 1} of ${totalSlides}`}
        >
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-500
                ${i < currentSlide
                  ? 'bg-pink-500'
                  : i === currentSlide
                    ? 'bg-gradient-to-r from-pink-500 to-purple-500'
                    : 'bg-gray-700'
                }`}
            />
          ))}
        </div>

        {/* Row 3: Contextual step label */}
        <p className="mt-2 text-[11px] text-gray-400 font-medium tracking-wide text-center">
          Step {currentSlide + 1} — {STEP_LABELS[currentSlide] ?? ''}
        </p>
      </div>
    </header>
  );
};
