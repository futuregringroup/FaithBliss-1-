import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@/services/api';

interface UseProfileQueueOptions {
  preloadSize?: number;
  onRefill?: (() => Promise<unknown> | void) | null;
}

interface UseProfileQueueResult {
  queue: User[];
  currentProfile: User | null;
  nextProfile: User | null;
  cursor: number;
  isExhausted: boolean;
  advance: () => boolean;
  retreat: () => void;
  reset: () => void;
}

const DEFAULT_PRELOAD_SIZE = 5;

export const useProfileQueue = (
  profiles: User[],
  { preloadSize = DEFAULT_PRELOAD_SIZE, onRefill = null }: UseProfileQueueOptions = {}
): UseProfileQueueResult => {
  const [cursor, setCursor] = useState(0);
  const cursorRef = useRef(0);
  const refillingRef = useRef(false);

  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  useEffect(() => {
    const maxCursor = profiles.length;
    if (cursorRef.current <= maxCursor) return;
    cursorRef.current = maxCursor;
    setCursor(maxCursor);
  }, [profiles.length]);

  const queue = useMemo(() => {
    if (!Array.isArray(profiles) || profiles.length === 0) return [];
    return profiles.slice(cursor, cursor + Math.max(1, preloadSize));
  }, [profiles, cursor, preloadSize]);

  const currentProfile = queue[0] ?? null;
  const nextProfile = queue[1] ?? null;
  const isExhausted = profiles.length === 0 || cursor >= profiles.length;

  const refillAsync = useCallback(() => {
    if (!onRefill || refillingRef.current) return;
    refillingRef.current = true;
    void Promise.resolve(onRefill()).finally(() => {
      refillingRef.current = false;
    });
  }, [onRefill]);

  const advance = useCallback(() => {
    const maxCursor = profiles.length;
    const currentCursor = cursorRef.current;

    if (maxCursor === 0) {
      refillAsync();
      return false;
    }

    const nextCursor = currentCursor + 1;
    const hasNextProfile = nextCursor < maxCursor;
    const clampedCursor = hasNextProfile ? nextCursor : maxCursor;

    cursorRef.current = clampedCursor;
    setCursor(clampedCursor);
    // Only trigger a refill when the queue is exhausted. Calling refillAsync on
    // every advance replaces the full profile list while the user is mid-swipe,
    // which causes the currently-displayed card to silently change to a different
    // profile and permanently drops any profile that lands behind the new cursor.
    if (!hasNextProfile) {
      refillAsync();
    }

    return hasNextProfile;
  }, [profiles.length, refillAsync]);

  const retreat = useCallback(() => {
    const nextCursor = Math.max(0, cursorRef.current - 1);
    cursorRef.current = nextCursor;
    setCursor(nextCursor);
  }, []);

  const reset = useCallback(() => {
    cursorRef.current = 0;
    setCursor(0);
  }, []);

  return {
    queue,
    currentProfile,
    nextProfile,
    cursor,
    isExhausted,
    advance,
    retreat,
    reset,
  };
};

