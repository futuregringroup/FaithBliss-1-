import { motion, type PanInfo } from 'framer-motion';
import type { ReactNode } from 'react';
import type { SwipeDirection } from './swipeStateMachine';

interface SwipeCardProps {
  children: ReactNode;
  mode: 'top-idle' | 'top-committing' | 'top-entering' | 'underlay' | 'skeleton';
  interactive?: boolean;
  locked?: boolean;
  onSwipeCommit?: (direction: SwipeDirection) => void;
}

const SWIPE_DISTANCE_THRESHOLD = 120;
const SWIPE_VELOCITY_THRESHOLD = 540;

export const SwipeCard = ({
  children,
  mode,
  interactive = false,
  locked = false,
  onSwipeCommit,
}: SwipeCardProps) => {
  const isCommitting = mode === 'top-committing';
  const isEntering = mode === 'top-entering';
  const isUnderlay = mode === 'underlay';
  const isSkeleton = mode === 'skeleton';

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!onSwipeCommit || locked || !interactive) return;

    const byDistance = Math.abs(info.offset.x) >= SWIPE_DISTANCE_THRESHOLD;
    const byVelocity = Math.abs(info.velocity.x) >= SWIPE_VELOCITY_THRESHOLD;
    if (!byDistance && !byVelocity) return;

    onSwipeCommit(info.offset.x > 0 ? 'right' : 'left');
  };

  return (
    <motion.div
      className={`h-full w-full ${locked ? 'pointer-events-none' : ''}`}
      drag={interactive && !locked && !isCommitting && !isSkeleton ? 'x' : false}
      dragDirectionLock
      dragElastic={0.2}
      dragMomentum={false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      style={{
        touchAction: interactive && !locked && !isCommitting && !isSkeleton ? 'pan-y pinch-zoom' : 'auto',
      }}
      initial={
        isEntering
          ? { opacity: 0, scale: 0.98, y: 10, x: 0, rotate: 0 }
          : { opacity: 1, scale: isUnderlay ? 0.98 : 1, y: isUnderlay ? 10 : 0, x: 0, rotate: 0 }
      }
      animate={
        isCommitting
          ? {
              opacity: 0,
              scale: 0.92,
              y: -8,
              x: 0,
              rotate: 0,
            }
          : isEntering
          ? {
              opacity: 1,
              scale: 1,
              y: 0,
              x: 0,
              rotate: 0,
            }
          : isUnderlay
          ? {
              opacity: 0.94,
              scale: 0.98,
              y: 10,
              x: 0,
              rotate: 0,
            }
          : {
              opacity: 1,
              scale: 1,
              y: 0,
              x: 0,
              rotate: 0,
            }
      }
      transition={
        isCommitting
          ? { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
          : isEntering
          ? { duration: 0.19, ease: [0.25, 0.8, 0.25, 1] }
          : { duration: 0.18, ease: 'easeOut' }
      }
    >
      {children}
    </motion.div>
  );
};
