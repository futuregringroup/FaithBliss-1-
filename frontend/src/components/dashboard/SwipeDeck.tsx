import { useEffect, useReducer, useRef, useState } from 'react';
import type { User } from '@/services/api';
import { HingeStyleProfileCard } from './HingeStyleProfileCard';
import { NoProfilesState } from './NoProfilesState';
import type { DashboardFilterFocusSection } from './FilterPanel';
import { SwipeCard } from './SwipeCard';
import {
  INITIAL_SWIPE_DECK_STATE,
  swipeDeckReducer,
  type SwipeDirection,
} from './swipeStateMachine';

type ProfileWithLegacyId = User & { _id?: string };

const getProfileId = (profile?: User | null): string | null => {
  if (!profile) return null;
  const candidate = profile as ProfileWithLegacyId;
  const id = candidate.id || candidate._id;
  return id ? String(id) : null;
};

interface SwipeDeckProps {
  profileQueue: User[];
  viewerLatitude?: number;
  viewerLongitude?: number;
  forceMobileCardLayout?: boolean;
  onStartOver: () => void;
  onGoBack: () => void;
  onLike: () => void;
  onPass: () => void;
  noProfilesTitle?: string;
  noProfilesDescription?: string;
  noProfilesActionLabel?: string;
  onNoProfilesAction?: () => void;
  noProfilesActionLoading?: boolean;
  noProfilesSecondaryActionLabel?: string;
  onNoProfilesSecondaryAction?: () => void;
  onOpenFilterSection?: (section?: DashboardFilterFocusSection | null) => void;
}

export const SwipeDeck = ({
  profileQueue,
  viewerLatitude,
  viewerLongitude,
  forceMobileCardLayout = false,
  onStartOver,
  onGoBack,
  onLike,
  onPass,
  noProfilesTitle,
  noProfilesDescription,
  noProfilesActionLabel,
  onNoProfilesAction,
  noProfilesActionLoading,
  noProfilesSecondaryActionLabel,
  onNoProfilesSecondaryAction,
  onOpenFilterSection,
}: SwipeDeckProps) => {
  const [state, dispatch] = useReducer(swipeDeckReducer, INITIAL_SWIPE_DECK_STATE);
  const [showSkeletonCard, setShowSkeletonCard] = useState(false);
  const [skeletonHoldCompleted, setSkeletonHoldCompleted] = useState(false);
  const committingProfileRef = useRef<User | null>(null);
  const committingProfileIdRef = useRef<string | null>(null);

  const sourceTopProfile = profileQueue[0] ?? null;
  const sourceNextProfile = profileQueue[1] ?? null;
  const sourceTopProfileId = getProfileId(sourceTopProfile);
  const committedProfileId = committingProfileIdRef.current;
  const hasShiftedToNewTop = Boolean(
    sourceTopProfileId && committedProfileId && sourceTopProfileId !== committedProfileId
  );

  const topProfile =
    state.phase === 'COMMITTING'
      ? committingProfileRef.current
      : state.phase === 'LOADING_NEXT' && !hasShiftedToNewTop
      ? null
      : sourceTopProfile;
  const topProfileId = getProfileId(topProfile);

  const underlayProfile =
    state.phase === 'COMMITTING'
      ? sourceTopProfileId === committedProfileId
        ? sourceNextProfile
        : sourceTopProfile
      : sourceNextProfile;
  const underlayProfileId = getProfileId(underlayProfile);

  const isInteractionLocked = state.phase !== 'IDLE';

  const requestCommit = (direction: SwipeDirection) => {
    if (state.phase !== 'IDLE') return;
    if (!sourceTopProfile) return;

    committingProfileRef.current = sourceTopProfile;
    committingProfileIdRef.current = getProfileId(sourceTopProfile);
    dispatch({ type: 'START_COMMIT', direction });
  };

  useEffect(() => {
    if (state.phase !== 'COMMITTING') return;

    const exitTimer = window.setTimeout(() => {
      const action = state.direction === 'right' ? onLike : onPass;
      try {
        action();
      } finally {
        dispatch({ type: 'EXIT_COMPLETE' });
      }
    }, 280);

    return () => {
      window.clearTimeout(exitTimer);
    };
  }, [onLike, onPass, state.direction, state.phase]);

  useEffect(() => {
    if (state.phase !== 'LOADING_NEXT') {
      setShowSkeletonCard(false);
      setSkeletonHoldCompleted(false);
      return;
    }

    if (!sourceTopProfileId) {
      setShowSkeletonCard(false);
      setSkeletonHoldCompleted(true);
      dispatch({ type: 'NO_NEXT' });
      return;
    }

    const hasReadyProfile = Boolean(sourceTopProfileId && sourceTopProfileId !== committedProfileId);
    if (hasReadyProfile) {
      if (showSkeletonCard && !skeletonHoldCompleted) {
        return;
      }
      setShowSkeletonCard(false);
      setSkeletonHoldCompleted(true);
      return;
    }

    setShowSkeletonCard(true);
    setSkeletonHoldCompleted(false);

    const holdTimer = window.setTimeout(() => {
      setSkeletonHoldCompleted(true);
    }, 260);

    const noNextTimer = window.setTimeout(() => {
      dispatch({ type: 'NO_NEXT' });
    }, 1500);

    return () => {
      window.clearTimeout(holdTimer);
      window.clearTimeout(noNextTimer);
    };
  }, [committedProfileId, showSkeletonCard, skeletonHoldCompleted, sourceTopProfileId, state.phase]);

  useEffect(() => {
    if (state.phase !== 'LOADING_NEXT') return;

    const hasReadyProfile = Boolean(sourceTopProfileId && sourceTopProfileId !== committedProfileId);
    if (!hasReadyProfile) return;
    if (showSkeletonCard && !skeletonHoldCompleted) return;

    dispatch({ type: 'NEXT_READY' });
  }, [committedProfileId, showSkeletonCard, skeletonHoldCompleted, sourceTopProfileId, state.phase]);

  useEffect(() => {
    if (state.phase !== 'ENTER_NEXT') return;

    const settleTimer = window.setTimeout(() => {
      dispatch({ type: 'ENTER_COMPLETE' });
    }, 190);

    return () => {
      window.clearTimeout(settleTimer);
    };
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== 'IDLE') return;

    committingProfileRef.current = null;
    committingProfileIdRef.current = null;
  }, [state.phase]);

  if (!topProfile && state.phase === 'IDLE') {
    return (
      <NoProfilesState
        title={noProfilesTitle}
        description={noProfilesDescription}
        actionLabel={noProfilesActionLabel}
        onAction={onNoProfilesAction}
        actionLoading={noProfilesActionLoading}
        secondaryActionLabel={noProfilesSecondaryActionLabel}
        onSecondaryAction={onNoProfilesSecondaryAction}
        onStartOver={onStartOver}
      />
    );
  }

  const topMode =
    state.phase === 'COMMITTING'
      ? 'top-committing'
      : state.phase === 'ENTER_NEXT' || state.phase === 'LOADING_NEXT'
      ? 'top-entering'
      : 'top-idle';
  const useFlowDesktopLayout = forceMobileCardLayout;
  const desktopCardShellClass = forceMobileCardLayout
    ? 'mx-auto w-full lg:max-w-[680px] xl:max-w-[760px] 2xl:max-w-[820px]'
    : 'mx-auto h-full w-full lg:max-w-[560px]';

  return (
    <div className={useFlowDesktopLayout ? 'relative w-full overflow-visible' : 'relative h-full w-full overflow-hidden'}>
      {!useFlowDesktopLayout && underlayProfile && underlayProfileId && (
        <div className="pointer-events-none absolute inset-0">
          <SwipeCard mode="underlay" locked>
            <div className={desktopCardShellClass}>
              <HingeStyleProfileCard
                profile={underlayProfile}
                viewerLatitude={viewerLatitude}
                viewerLongitude={viewerLongitude}
                forceMobileStyle={forceMobileCardLayout}
                onGoBack={() => {}}
                onLike={() => {}}
                onPass={() => {}}
                onOpenFilterSection={onOpenFilterSection}
              />
            </div>
          </SwipeCard>
        </div>
      )}

      {!useFlowDesktopLayout && showSkeletonCard && (
        <div className="absolute inset-0">
          <SwipeCard mode="skeleton" locked>
            <div className={desktopCardShellClass}>
              <div className="h-full w-full overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 p-4">
                <div className="h-full w-full animate-pulse rounded-[1.5rem] bg-gradient-to-br from-slate-800/70 via-slate-700/40 to-slate-800/70" />
              </div>
            </div>
          </SwipeCard>
        </div>
      )}

      {topProfile && topProfileId && (
        <div className={useFlowDesktopLayout ? 'relative w-full' : 'absolute inset-0'}>
          <SwipeCard
            key={`${topProfileId}-${topMode}`}
            mode={topMode}
            interactive
            locked={isInteractionLocked}
            onSwipeCommit={requestCommit}
          >
            <div className={desktopCardShellClass}>
              <HingeStyleProfileCard
                profile={topProfile}
                viewerLatitude={viewerLatitude}
                viewerLongitude={viewerLongitude}
                forceMobileStyle={forceMobileCardLayout}
                onGoBack={() => {
                  if (isInteractionLocked) return;
                  onGoBack();
                }}
                onLike={() => requestCommit('right')}
                onPass={() => requestCommit('left')}
                onOpenFilterSection={onOpenFilterSection}
              />
            </div>
          </SwipeCard>
        </div>
      )}
    </div>
  );
};
