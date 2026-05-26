import React from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';

interface OnboardingNavigationProps {
  currentSlide: number;
  totalSlides: number;
  canGoBack: boolean;
  canProceed: boolean;
  submitting: boolean;
  submittingLabel?: string;
  validationError: string | null;
  onPrevious: () => void;
  onNext: () => void;
}

export const OnboardingNavigation: React.FC<OnboardingNavigationProps> = ({
  currentSlide,
  totalSlides,
  canGoBack,
  canProceed,
  submitting,
  submittingLabel = 'Submitting...',
  validationError,
  onPrevious,
  onNext,
}) => {
  const isLastSlide = currentSlide === totalSlides - 1;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-gray-950/90 backdrop-blur-xl border-t border-white/[0.08] px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
      <div className="max-w-2xl mx-auto space-y-2">

        {/* Validation error */}
        {validationError && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 shadow-[0_10px_30px_rgba(127,29,29,0.18)]">
            <p className="text-center text-sm font-medium text-red-300">{validationError}</p>
          </div>
        )}

        {/* Incomplete fields hint */}
        {!canProceed && !validationError && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2">
            <p className="text-center text-sm text-amber-300">Complete all required fields to continue.</p>
          </div>
        )}

        {/* Navigation row — back left, continue right */}
        <div className="flex items-center gap-3">
          {/* Back arrow — left side */}
          {canGoBack && !submitting ? (
            <button
              type="button"
              onClick={onPrevious}
              aria-label="Go back"
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-gray-300 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-95"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : (
            /* Invisible placeholder keeps continue button right-aligned */
            <div className="h-14 w-14 flex-shrink-0" />
          )}

          {/* Continue / Complete — right side, fills remaining space */}
          <button
            type="button"
            onClick={onNext}
            disabled={submitting}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold text-white
              transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60
              ${canProceed
                ? 'bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 shadow-[0_8px_24px_rgba(236,72,153,0.35)] hover:brightness-110 active:scale-[0.98]'
                : 'bg-pink-700/70 cursor-default'
              }`}
          >
            {submitting ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {submittingLabel}
              </>
            ) : (
              <>
                {isLastSlide ? 'Complete Profile' : 'Continue'}
                {isLastSlide ? <Check className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
