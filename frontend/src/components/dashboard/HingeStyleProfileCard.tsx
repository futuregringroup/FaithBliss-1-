import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Minus, MoreHorizontal, Plus, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

import type { User } from '@/services/api';
import { FloatingActionButtons } from './FloatingActionButtons';
import type { DashboardFilterFocusSection } from './FilterPanel';

interface HingeStyleProfileCardProps {
  profile: User;
  viewerLatitude?: number;
  viewerLongitude?: number;
  forceMobileStyle?: boolean;
  onGoBack: () => void;
  onPass: () => void;
  onLike: () => void;
  onOpenFilterSection?: (section?: DashboardFilterFocusSection | null) => void;
}

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type TouchPoint = {
  clientX: number;
  clientY: number;
};

const pointerDistance = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
};

export const HingeStyleProfileCard = ({
  profile,
  viewerLatitude,
  viewerLongitude,
  forceMobileStyle = false,
  onGoBack,
  onPass,
  onLike,
  onOpenFilterSection,
}: HingeStyleProfileCardProps) => {
  const navigate = useNavigate();
  const [currentPhotoAspectRatio, setCurrentPhotoAspectRatio] = useState(1);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [viewerPhotoIndex, setViewerPhotoIndex] = useState<number | null>(null);
  const [viewerScale, setViewerScale] = useState(1);
  const [viewerOffset, setViewerOffset] = useState({ x: 0, y: 0 });
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const [isCompactHeight, setIsCompactHeight] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-height: 760px)').matches;
  });
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const carouselLockRef = useRef<'horizontal' | 'vertical' | null>(null);
  const viewerStageRef = useRef<HTMLDivElement | null>(null);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef(1);
  const panStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchPinchDistanceRef = useRef<number | null>(null);
  const touchPinchScaleRef = useRef(1);
  const touchPanStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const touchSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapAtRef = useRef(0);

  const toCardCloudinary = (url: string) => {
    if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
      return url;
    }

    const [prefix, suffix] = url.split('/upload/');
    if (!prefix || !suffix) return url;

    // Card render: face-aware crop to keep faces safe in cover mode.
    const deliveryTransform = 'c_fill,g_auto:face,ar_7:5,w_2000,f_auto,q_auto:best,dpr_auto,e_sharpen:70';
    return `${prefix}/upload/${deliveryTransform}/${suffix}`;
  };

  const toViewerCloudinary = (url: string) => {
    if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
      return url;
    }

    const [prefix, suffix] = url.split('/upload/');
    if (!prefix || !suffix) return url;

    // Fullscreen viewer: no forced crop, keep original framing.
    const deliveryTransform = 'f_auto,q_auto:best,dpr_auto,c_limit,w_2400,e_sharpen:60';
    return `${prefix}/upload/${deliveryTransform}/${suffix}`;
  };

  const stopEvent = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const rawPhotos = useMemo(() => {
    const list = [
      profile.profilePhoto1,
      profile.profilePhoto2,
      profile.profilePhoto3,
      profile.profilePhoto4,
      profile.profilePhoto5,
      profile.profilePhoto6,
    ].filter(Boolean) as string[];
    return list.length > 0 ? list : ['/default-avatar.png'];
  }, [
    profile.profilePhoto1,
    profile.profilePhoto2,
    profile.profilePhoto3,
    profile.profilePhoto4,
    profile.profilePhoto5,
    profile.profilePhoto6,
  ]);

  const cardPhotos = useMemo(() => rawPhotos.map(toCardCloudinary), [rawPhotos]);
  const viewerPhotos = useMemo(() => rawPhotos.map(toViewerCloudinary), [rawPhotos]);
  const currentViewerPhotoIndex = viewerPhotoIndex ?? 0;
  const currentViewerPhoto = viewerPhotos[currentViewerPhotoIndex] || viewerPhotos[0];
  const viewerCanNavigate = false;

  const clampViewerOffset = useCallback((offset: { x: number; y: number }, scale: number) => {
    const stage = viewerStageRef.current;
    if (!stage || scale <= 1) return { x: 0, y: 0 };

    const maxX = (stage.clientWidth * (scale - 1)) / 2;
    const maxY = (stage.clientHeight * (scale - 1)) / 2;
    return {
      x: clamp(offset.x, -maxX, maxX),
      y: clamp(offset.y, -maxY, maxY),
    };
  }, []);

  const applyViewerScale = useCallback((nextScale: number) => {
    const clampedScale = clamp(nextScale, 1, 4);
    setViewerScale(clampedScale);
    setViewerOffset((prev) => clampViewerOffset(prev, clampedScale));
  }, [clampViewerOffset]);

  const resetViewerTransform = useCallback(() => {
    setViewerScale(1);
    setViewerOffset({ x: 0, y: 0 });
  }, []);

  const handleViewerPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointersRef.current.size === 1) {
      swipeStartRef.current = { x: event.clientX, y: event.clientY };
      const now = Date.now();
      if (now - lastTapAtRef.current < 300) {
        resetViewerTransform();
      }
      lastTapAtRef.current = now;

      if (viewerScale > 1) {
        panStartRef.current = {
          x: event.clientX,
          y: event.clientY,
          offsetX: viewerOffset.x,
          offsetY: viewerOffset.y,
        };
      }
    }

    if (activePointersRef.current.size === 2) {
      const points = Array.from(activePointersRef.current.values());
      pinchStartDistanceRef.current = pointerDistance(points[0], points[1]);
      pinchStartScaleRef.current = viewerScale;
      panStartRef.current = null;
      swipeStartRef.current = null;
    }
  };

  const handleViewerPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    if (!activePointersRef.current.has(event.pointerId)) return;
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointersRef.current.size === 2 && pinchStartDistanceRef.current) {
      const points = Array.from(activePointersRef.current.values());
      const nextDistance = pointerDistance(points[0], points[1]);
      const nextScale = pinchStartScaleRef.current * (nextDistance / pinchStartDistanceRef.current);
      applyViewerScale(nextScale);
      return;
    }

    if (activePointersRef.current.size === 1 && panStartRef.current && viewerScale > 1) {
      const dx = event.clientX - panStartRef.current.x;
      const dy = event.clientY - panStartRef.current.y;
      const nextOffset = clampViewerOffset(
        {
          x: panStartRef.current.offsetX + dx,
          y: panStartRef.current.offsetY + dy,
        },
        viewerScale,
      );
      setViewerOffset(nextOffset);
    }
  };

  const handleViewerPointerUpOrCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    const pointerStart = swipeStartRef.current;
    const pointerEnd = activePointersRef.current.get(event.pointerId);
    activePointersRef.current.delete(event.pointerId);

    if (
      pointerStart &&
      pointerEnd &&
      activePointersRef.current.size === 0 &&
      viewerScale <= 1.02 &&
      viewerCanNavigate
    ) {
      // Fullscreen preview is single-photo only.
    }

    if (activePointersRef.current.size < 2) {
      pinchStartDistanceRef.current = null;
    }

    if (activePointersRef.current.size === 1 && viewerScale > 1) {
      const remaining = Array.from(activePointersRef.current.values())[0];
      panStartRef.current = {
        x: remaining.x,
        y: remaining.y,
        offsetX: viewerOffset.x,
        offsetY: viewerOffset.y,
      };
    } else {
      panStartRef.current = null;
    }

    if (activePointersRef.current.size === 0) {
      swipeStartRef.current = null;
    }
  };

  const handleViewerWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!event.cancelable) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.18 : 0.18;
    applyViewerScale(viewerScale + delta);
  };

  const touchDistance = (a: TouchPoint, b: TouchPoint) => {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  };

  const handleViewerTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };

      const now = Date.now();
      if (now - lastTapAtRef.current < 300) {
        resetViewerTransform();
      }
      lastTapAtRef.current = now;

      if (viewerScale > 1) {
        touchPanStartRef.current = {
          x: touch.clientX,
          y: touch.clientY,
          offsetX: viewerOffset.x,
          offsetY: viewerOffset.y,
        };
      } else {
        touchPanStartRef.current = null;
      }
    }

    if (event.touches.length === 2) {
      touchPinchDistanceRef.current = touchDistance(event.touches[0], event.touches[1]);
      touchPinchScaleRef.current = viewerScale;
      touchPanStartRef.current = null;
      touchSwipeStartRef.current = null;
    }
  };

  const handleViewerTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2 && touchPinchDistanceRef.current) {
      const nextDistance = touchDistance(event.touches[0], event.touches[1]);
      const nextScale = touchPinchScaleRef.current * (nextDistance / touchPinchDistanceRef.current);
      applyViewerScale(nextScale);
      return;
    }

    if (event.touches.length === 1 && touchPanStartRef.current && viewerScale > 1) {
      const touch = event.touches[0];
      const dx = touch.clientX - touchPanStartRef.current.x;
      const dy = touch.clientY - touchPanStartRef.current.y;
      const nextOffset = clampViewerOffset(
        {
          x: touchPanStartRef.current.offsetX + dx,
          y: touchPanStartRef.current.offsetY + dy,
        },
        viewerScale,
      );
      setViewerOffset(nextOffset);
    }
  };

  const handleViewerTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (
      event.touches.length === 0 &&
      touchSwipeStartRef.current &&
      event.changedTouches.length > 0 &&
      viewerScale <= 1.02 &&
      viewerCanNavigate
    ) {
      // Fullscreen preview is single-photo only.
    }

    if (event.touches.length < 2) {
      touchPinchDistanceRef.current = null;
    }

    if (event.touches.length === 1 && viewerScale > 1) {
      const touch = event.touches[0];
      touchPanStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        offsetX: viewerOffset.x,
        offsetY: viewerOffset.y,
      };
    } else if (event.touches.length === 0) {
      touchPanStartRef.current = null;
      touchSwipeStartRef.current = null;
    }
  };

  const openImageViewer = (photoIndex: number, event?: React.SyntheticEvent) => {
    if (event) {
      event.stopPropagation();
    }
    setViewerPhotoIndex(photoIndex);
    resetViewerTransform();
    setIsImageViewerOpen(true);
  };

  const closeImageViewer = useCallback(() => {
    setIsImageViewerOpen(false);
    setViewerPhotoIndex(null);
    resetViewerTransform();
  }, [resetViewerTransform]);

  useEffect(() => {
    if (!isImageViewerOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeImageViewer();
      } else if (event.key === '+' || event.key === '=') {
        applyViewerScale(viewerScale + 0.2);
      } else if (event.key === '-') {
        applyViewerScale(viewerScale - 0.2);
      } else if (event.key === '0') {
        resetViewerTransform();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [applyViewerScale, closeImageViewer, isImageViewerOpen, resetViewerTransform, viewerScale]);

  useEffect(() => {
    if (isImageViewerOpen) {
      resetViewerTransform();
    }
  }, [currentViewerPhotoIndex, isImageViewerOpen, resetViewerTransform]);
  const profileWithExtras = profile as User & { _id?: string; distance?: number };
  const profileId = profileWithExtras.id || profileWithExtras._id || 'missing';
  const profileLatitude = typeof profileWithExtras.latitude === 'number' ? profileWithExtras.latitude : null;
  const profileLongitude = typeof profileWithExtras.longitude === 'number' ? profileWithExtras.longitude : null;
  const apiDistance = typeof profileWithExtras.distance === 'number' ? Math.round(profileWithExtras.distance) : null;
  const calculatedDistance =
    viewerLatitude != null && viewerLongitude != null && profileLatitude != null && profileLongitude != null
      ? Math.round(haversineDistanceKm(viewerLatitude, viewerLongitude, profileLatitude, profileLongitude))
      : null;
  const distance = apiDistance ?? calculatedDistance;
  const distanceBadge = distance !== null ? `${distance} km away` : 'Nearby';
  const locationText = profile.location?.trim() || 'Location not set';
  const formatLabel = (value: string) =>
    value
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  const formattedGender = profile.gender ? formatLabel(profile.gender) : '';
  const formattedDenomination = profile.denomination ? formatLabel(String(profile.denomination)) : '';
  const favoriteVerse = profile.favoriteVerse?.trim() || '';
  const isPremiumProfile =
    typeof profile.subscriptionStatus === 'string' &&
    profile.subscriptionStatus.toLowerCase() === 'active' &&
    typeof profile.subscriptionTier === 'string' &&
    ['premium', 'elite'].includes(profile.subscriptionTier.toLowerCase());
  const spiritualGifts = (Array.isArray(profile.spiritualGifts) ? profile.spiritualGifts : [])
    .map((gift) => gift?.trim())
    .filter((gift): gift is string => Boolean(gift))
    .slice(0, 4);
  const mobileDisplayName = profile.name?.trim().split(/\s+/)[0] || profile.name || 'User';
  const primaryGoal = profile.relationshipGoals?.[0] || profile.lookingFor?.[0] || '';
  const ageFilterLabel = profile.age ? `Age ${profile.age}` : 'Age';
  const heightFilterLabel = profile.height ? profile.height.split('(')[0].trim() : 'Height';
  const goalFilterLabel = primaryGoal ? formatLabel(primaryGoal) : 'Dating Intentions';
  const mobileChips: Array<{ label: string; section: DashboardFilterFocusSection }> = [
    { label: ageFilterLabel, section: 'age' },
    { label: heightFilterLabel, section: 'height' },
    { label: goalFilterLabel, section: 'relationship-goal' },
  ];
  const renderPremiumCrown = (className: string) =>
    isPremiumProfile ? (
      <img
        src="/crown.svg"
        alt="Premium member"
        className={className}
        style={{
          filter:
            'brightness(0) saturate(100%) invert(78%) sepia(75%) saturate(1300%) hue-rotate(357deg) brightness(101%) contrast(104%) drop-shadow(0 8px 18px rgba(245, 158, 11, 0.28))',
        }}
        draggable={false}
        loading="eager"
        decoding="async"
      />
    ) : null;
  const useDesktopMobileLayout = forceMobileStyle && !isMobileView;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileView(event.matches);
    };

    setIsMobileView(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const compactHeightQuery = window.matchMedia('(max-height: 760px)');
    const handleCompactHeightChange = (event: MediaQueryListEvent) => {
      setIsCompactHeight(event.matches);
    };

    setIsCompactHeight(compactHeightQuery.matches);
    compactHeightQuery.addEventListener('change', handleCompactHeightChange);
    return () => compactHeightQuery.removeEventListener('change', handleCompactHeightChange);
  }, []);

  useEffect(() => {
    const currentPhotoUrl = rawPhotos[0];
    if (!currentPhotoUrl) return;

    let isCancelled = false;
    const image = new Image();
    image.onload = () => {
      if (isCancelled) return;
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        setCurrentPhotoAspectRatio(image.naturalWidth / image.naturalHeight);
      }
    };
    image.onerror = () => {
      if (!isCancelled) {
        setCurrentPhotoAspectRatio(1);
      }
    };
    image.src = currentPhotoUrl;

    return () => {
      isCancelled = true;
    };
  }, [rawPhotos]);

  // Reset carousel to first photo whenever the profile changes
  useEffect(() => {
    setCarouselIndex(0);
  }, [profileId]);

  const CAROUSEL_THRESHOLD = 40;

  const handleCarouselTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    const t = e.touches[0];
    carouselTouchStartRef.current = { x: t.clientX, y: t.clientY };
    carouselLockRef.current = null;
  };

  const handleCarouselTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!carouselTouchStartRef.current) return;
    const dx = e.touches[0].clientX - carouselTouchStartRef.current.x;
    const dy = e.touches[0].clientY - carouselTouchStartRef.current.y;
    if (!carouselLockRef.current) {
      carouselLockRef.current = Math.abs(dx) > Math.abs(dy) + 5 ? 'horizontal' : 'vertical';
    }
    if (carouselLockRef.current === 'horizontal') e.preventDefault();
  };

  const handleCarouselTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (!carouselTouchStartRef.current || carouselLockRef.current !== 'horizontal') {
      carouselTouchStartRef.current = null;
      carouselLockRef.current = null;
      return;
    }
    const dx = e.changedTouches[0].clientX - carouselTouchStartRef.current.x;
    if (dx < -CAROUSEL_THRESHOLD) setCarouselIndex((i) => Math.min(cardPhotos.length - 1, i + 1));
    else if (dx > CAROUSEL_THRESHOLD) setCarouselIndex((i) => Math.max(0, i - 1));
    carouselTouchStartRef.current = null;
    carouselLockRef.current = null;
  };

  if (isMobileView || forceMobileStyle) {
    const mobileCoverPosition = currentPhotoAspectRatio < 0.95 ? '50% 24%' : '50% 35%';
    const aboutMeBody = profile.bio?.trim() || 'Still filling this out.';
    const promptQuestion = profile.personalPromptQuestion?.trim() || '';
    const promptAnswer = profile.personalPromptAnswer?.trim() || '';
    const mobileInterests = ((profile.interests && profile.interests.length > 0)
      ? profile.interests
      : (profile.hobbies || [])
    )
      .map((item) => item?.trim())
      .filter((item): item is string => Boolean(item))
      .slice(0, 8);
    const mobileHeight = profile.height ? profile.height.split('(')[0].trim() : '';
    const mobileSectionLabelClass = 'pr-4 text-[0.72rem] font-bold uppercase tracking-[0.12em] text-slate-500';
    const mobileBodyTextClass = isCompactHeight
      ? 'mt-2 text-[1.4rem] font-semibold leading-[1.12] tracking-[-0.03em] text-slate-950'
      : 'mt-3 text-[1.7rem] font-semibold leading-[1.1] tracking-[-0.035em] text-slate-950';
    const mobilePromptTextClass = isCompactHeight
      ? 'mt-2 text-[1.28rem] font-serif font-semibold leading-[1.16] tracking-[-0.02em] text-slate-950'
      : 'mt-3 text-[1.52rem] font-serif font-semibold leading-[1.14] tracking-[-0.025em] text-slate-950';
    const mobileShellClass = useDesktopMobileLayout
      ? 'flex w-full flex-col px-0 pb-8 pt-0 text-slate-900'
      : 'flex h-full w-full flex-col bg-white px-3 pb-3 pt-3 text-slate-900';
    const mobileFiltersBarClass = useDesktopMobileLayout
      ? 'mb-6 flex flex-wrap items-center gap-3 overflow-visible'
      : `flex items-center gap-2 overflow-x-auto scroll-fade-x scrollbar-none ${isCompactHeight ? 'mb-2 pb-0.5' : 'mb-3 pb-1'}`;
    const mobileContentScrollClass = useDesktopMobileLayout
      ? 'overflow-visible px-0 pb-8 pt-2'
      : 'min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-1 pb-4 pt-2 [-webkit-overflow-scrolling:touch] [touch-action:pan-y]';
    const mobileHeaderClass = useDesktopMobileLayout
      ? 'text-[3.35rem] min-w-0 flex-1 font-bold leading-[0.92] tracking-[-0.05em] text-white/95 drop-shadow-[0_10px_30px_rgba(15,23,42,0.28)]'
      : `${isCompactHeight ? 'text-[1.9rem]' : 'text-[2.08rem]'} min-w-0 flex-1 truncate font-bold leading-[0.96] tracking-[-0.035em] text-slate-950`;
    const desktopDetailGridClass = useDesktopMobileLayout ? 'mt-6 grid gap-5 lg:grid-cols-2' : '';
    const desktopWideSectionClass = useDesktopMobileLayout ? 'lg:col-span-2' : '';
    const renderMobileInfoSection = ({
      title,
      value,
      children,
    }: {
      title: string;
      value?: string;
      children?: ReactNode;
    }) => {
      if (!value && !children) return null;

      return (
        <motion.div
          className={`relative ${useDesktopMobileLayout ? 'mt-5 rounded-[30px] px-6 py-6 shadow-[0_16px_36px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.82)]' : 'mt-4 rounded-[26px] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'} bg-slate-100`}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <p className={mobileSectionLabelClass}>{title}</p>
          {value ? <p className={`${useDesktopMobileLayout ? 'mt-4 text-[1.28rem] leading-8' : 'mt-3 text-[1.18rem] leading-7'} font-semibold text-slate-900`}>{value}</p> : null}
          {children}
        </motion.div>
      );
    };
    const renderMobileLikeButton = (positionClassName = 'absolute top-4 right-4') => (
      <button
        type="button"
        onPointerDown={stopEvent}
        onMouseDown={stopEvent}
        onTouchStart={stopEvent}
        onClick={(event) => {
          stopEvent(event);
          onLike();
        }}
        className={`${positionClassName} z-30 inline-flex h-[4.1rem] w-[4.1rem] select-none touch-manipulation items-center justify-center rounded-full bg-transparent text-slate-950 transition-all duration-200 hover:-translate-y-0.5`}
        aria-label="Like"
        style={{
          WebkitTapHighlightColor: 'transparent',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'manipulation',
        }}
      >
        <span className="relative inline-flex h-[3.2rem] w-[3.2rem] items-center justify-center rounded-full border border-white/70 bg-white/82 backdrop-blur-md shadow-[0_14px_24px_rgba(15,23,42,0.22),0_0_0_1px_rgba(255,255,255,0.18),0_4px_12px_rgba(236,72,153,0.18)]">
          <span className="relative inline-flex h-[2.45rem] w-[2.45rem] items-center justify-center rounded-[1rem] bg-gradient-to-br from-fuchsia-500 via-pink-500 to-rose-500 shadow-[0_8px_14px_rgba(236,72,153,0.2)]">
            <span className="absolute inset-[1px] rounded-[0.95rem] bg-gradient-to-br from-white/18 to-transparent" />
            <Heart className="relative h-[1.05rem] w-[1.05rem] fill-white text-white stroke-[2.35]" />
          </span>
        </span>
      </button>
    );
    return (
      <>
        <div className={mobileShellClass}>
          <div className={mobileFiltersBarClass}>
                    <button
                      type="button"
                      onClick={() => onOpenFilterSection?.()}
              className={`inline-flex shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-100 text-slate-700 shadow-[0_10px_22px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:text-slate-950 hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)] ${
                useDesktopMobileLayout ? 'h-11 w-11' : isCompactHeight ? 'h-9 w-9' : 'h-10 w-10'
              }`}
              aria-label="Filter options"
            >
                  <SlidersHorizontal className={useDesktopMobileLayout ? 'h-5 w-5' : 'h-4 w-4'} />
                </button>
            {mobileChips.map((chip, index) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => onOpenFilterSection?.(chip.section)}
                className={`inline-flex shrink-0 items-center rounded-full border text-xs font-semibold shadow-sm transition-all duration-150 hover:-translate-y-px ${
                  index === 0
                    ? 'border-pink-400/30 bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-[0_4px_14px_rgba(236,72,153,0.25)]'
                    : 'border-slate-200 bg-white text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.06)]'
                } ${useDesktopMobileLayout ? 'px-5 py-2.5 text-sm' : isCompactHeight ? 'px-3.5 py-1.5' : 'px-4 py-2'}`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <article className={`${useDesktopMobileLayout ? 'flex flex-col bg-transparent' : 'flex min-h-0 flex-1 flex-col bg-transparent'}`}>
            <div className={mobileContentScrollClass}>
              <div className={`${useDesktopMobileLayout ? 'mb-6' : 'mb-3'} flex items-start justify-between gap-3`}>
                <h2 className={mobileHeaderClass}>
                  <span className={`inline-flex ${useDesktopMobileLayout ? 'flex-wrap' : 'max-w-full'} items-center gap-2 align-top`}>
                    <span className={useDesktopMobileLayout ? '' : 'truncate'}>
                      {mobileDisplayName}
                      {profile.age ? `, ${profile.age}` : ''}
                    </span>
                    {renderPremiumCrown(`${useDesktopMobileLayout ? 'h-[0.95em] w-[0.95em]' : 'h-[0.85em] w-[0.85em]'} shrink-0 object-contain`)}
                  </span>
                </h2>
                <div className="flex shrink-0 items-center gap-2 pt-1 text-slate-400">
                  <button
                    type="button"
                    onClick={onGoBack}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:text-slate-900 hover:shadow-[0_12px_24px_rgba(15,23,42,0.1)]"
                    aria-label="Go back"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/profile/${profileId}`)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white/90 text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:text-slate-900 hover:shadow-[0_12px_24px_rgba(15,23,42,0.1)]"
                    aria-label="More options"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Photo carousel — swipe horizontally to cycle photos, isolated from card swipe */}
              <div
                className="relative w-full overflow-hidden rounded-[26px] bg-slate-100 shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
                style={{ aspectRatio: '4/5', minHeight: isCompactHeight ? '352px' : '420px' }}
              >
                {/* Sliding strip */}
                <div
                  className="carousel-strip absolute inset-0 h-full"
                  style={{
                    width: `${cardPhotos.length * 100}%`,
                    transform: `translateX(-${(carouselIndex * 100) / cardPhotos.length}%)`,
                    transition: 'transform 0.26s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                  }}
                  onTouchStart={handleCarouselTouchStart}
                  onTouchMove={handleCarouselTouchMove}
                  onTouchEnd={handleCarouselTouchEnd}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {cardPhotos.map((photoUrl, idx) => (
                    <div
                      key={`${profileId}-c-${idx}`}
                      className="relative inline-block h-full"
                      style={{ width: `${100 / cardPhotos.length}%` }}
                      onClick={() => openImageViewer(idx)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Photo ${idx + 1} of ${cardPhotos.length}`}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openImageViewer(idx); }}
                    >
                      <img
                        src={photoUrl}
                        alt={`${profile.name} photo ${idx + 1}`}
                        className="absolute inset-0 h-full w-full object-cover [backface-visibility:hidden] [transform:translateZ(0)]"
                        style={{ objectPosition: mobileCoverPosition }}
                        draggable={false}
                        loading={idx === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                      />
                    </div>
                  ))}
                </div>

                {/* Tap zones: left 28% = prev, right area before like button = next */}
                {carouselIndex > 0 && (
                  <button
                    type="button"
                    aria-label="Previous photo"
                    className="absolute inset-y-0 left-0 z-20 w-[28%]"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); setCarouselIndex((i) => Math.max(0, i - 1)); }}
                  />
                )}
                {carouselIndex < cardPhotos.length - 1 && (
                  <button
                    type="button"
                    aria-label="Next photo"
                    className="absolute inset-y-0 right-[4.5rem] z-20 w-[calc(100%-4.5rem-28%)]"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); setCarouselIndex((i) => Math.min(cardPhotos.length - 1, i + 1)); }}
                  />
                )}

                {/* Bottom gradient for dot readability */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-[26px] bg-gradient-to-t from-black/35 to-transparent" />

                {/* Dot indicators */}
                {cardPhotos.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5">
                    {cardPhotos.map((_, idx) => (
                      <div
                        key={idx}
                        className={`carousel-dot ${idx === carouselIndex ? 'carousel-dot-active' : 'w-1.5 opacity-50'}`}
                      />
                    ))}
                  </div>
                )}

                {/* Like button */}
                {renderMobileLikeButton('absolute bottom-4 right-4')}
              </div>

              <div className={`relative bg-slate-100 ${useDesktopMobileLayout ? 'mt-6 rounded-[32px] px-7 py-8 shadow-[0_18px_40px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.82)]' : 'mt-4 rounded-[26px] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'}`}>
                <p className={mobileSectionLabelClass}>About me</p>
                <p className={mobileBodyTextClass}>
                  {aboutMeBody}
                </p>
              </div>

              <div className={desktopDetailGridClass}>
                <div className={desktopWideSectionClass}>
                  {renderMobileInfoSection({
                    title: 'Gender & location',
                    children: (
                      <div className={`mt-3 ${useDesktopMobileLayout ? 'grid gap-5 lg:grid-cols-2' : 'space-y-3'}`}>
                        {formattedGender ? (
                          <div>
                            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Gender</p>
                            <p className="mt-1 text-[1.12rem] font-semibold leading-7 text-slate-900">{formattedGender}</p>
                          </div>
                        ) : null}
                        {locationText ? (
                          <div>
                            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Location</p>
                            <p className="mt-1 text-[1.12rem] font-semibold leading-7 text-slate-900">{locationText}</p>
                          </div>
                        ) : null}
                      </div>
                    ),
                  })}
                </div>

                {renderMobileInfoSection({ title: 'Height', value: mobileHeight })}
                {renderMobileInfoSection({ title: 'Denomination', value: formattedDenomination })}

                {promptQuestion || promptAnswer ? (
                  <div className={`relative bg-slate-100 ${useDesktopMobileLayout ? 'rounded-[30px] px-6 py-7 shadow-[0_16px_36px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.82)]' : 'mt-4 rounded-[26px] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'}`}>
                    <p className={mobileSectionLabelClass}>
                      {promptQuestion || 'Personal prompt'}
                    </p>
                    <p className={mobilePromptTextClass}>
                      {promptAnswer || 'No response added yet.'}
                    </p>
                  </div>
                ) : null}
                {renderMobileInfoSection({
                  title: 'Spiritual gifts',
                  children: spiritualGifts.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2.5">
                      {spiritualGifts.map((gift) => (
                        <span
                          key={gift}
                          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[0.76rem] font-semibold tracking-[-0.01em] text-slate-700 shadow-[0_6px_14px_rgba(15,23,42,0.06)]"
                        >
                          {gift}
                        </span>
                      ))}
                    </div>
                  ) : undefined,
                })}

                {renderMobileInfoSection({
                  title: 'Favorite verse',
                  value: favoriteVerse ? `"${favoriteVerse}"` : '',
                })}

                <div className={desktopWideSectionClass}>
                  {mobileInterests.length > 0 ? (
                    <div className={`bg-slate-100 ${useDesktopMobileLayout ? 'rounded-[30px] px-6 py-6 shadow-[0_16px_36px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.82)]' : 'mt-4 rounded-[26px] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'}`}>
                      <p className={mobileSectionLabelClass}>Interests</p>
                      <div className="mt-3 flex flex-wrap gap-2.5">
                        {mobileInterests.map((interest) => (
                          <span
                            key={interest}
                            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[0.76rem] font-semibold tracking-[-0.01em] text-slate-700 shadow-[0_6px_14px_rgba(15,23,42,0.06)]"
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className={desktopWideSectionClass}>
                  <Link
                    to={`/profile/${profileId}`}
                    className={`inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200 hover:-translate-y-0.5 ${useDesktopMobileLayout ? 'min-w-[240px] border border-white/14 bg-[linear-gradient(135deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06))] px-7 py-4 text-base text-white/95 shadow-[0_18px_36px_rgba(15,23,42,0.2)] backdrop-blur-xl hover:border-white/24 hover:bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(255,255,255,0.08))] hover:shadow-[0_24px_44px_rgba(15,23,42,0.24)]' : 'mt-4 w-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 px-5 py-4 text-sm text-white shadow-[0_14px_28px_rgba(236,72,153,0.25)] hover:from-pink-400 hover:via-fuchsia-400 hover:to-purple-500'}`}
                  >
                    View Full Profile
                  </Link>
                </div>

                <div className={desktopWideSectionClass}>
                  <div className={`pointer-events-none z-[60] flex ${useDesktopMobileLayout ? 'sticky bottom-4 mt-3 justify-end pr-1' : 'fixed bottom-[calc(env(safe-area-inset-bottom,0px)+var(--nav-height,88px)+0.5rem)] left-4 justify-start'}`}>
                    <button
                      type="button"
                      onPointerDown={stopEvent}
                      onMouseDown={stopEvent}
                      onTouchStart={stopEvent}
                      onClick={(event) => {
                        stopEvent(event);
                        onPass();
                      }}
                      className="pointer-events-auto inline-flex h-[4.1rem] w-[4.1rem] items-center justify-center rounded-full bg-transparent text-slate-950 transition-all duration-200 hover:-translate-y-0.5"
                      aria-label="Pass"
                    >
                      <span className="relative inline-flex h-[2.8rem] w-[2.8rem] items-center justify-center rounded-[1.15rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 shadow-[0_10px_18px_rgba(15,23,42,0.26)]">
                        <span className="absolute inset-[1px] rounded-[1rem] border border-white/10" />
                        <X className="relative h-5.5 w-5.5 text-white stroke-[2.8]" />
                      </span>
                    </button>
                  </div>
              </div>
              <div className="pointer-events-none sticky bottom-0 h-8 w-full bg-gradient-to-t from-white/90 to-transparent" aria-hidden="true" />
              </div>
            </div>
          </article>
        </div>

        <AnimatePresence>
          {isImageViewerOpen && (
            <motion.div
              className="fixed inset-0 z-[140] flex items-center justify-center bg-black/92 p-2 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeImageViewer}
            >
              <div className="relative flex h-full w-full max-w-5xl flex-col items-center justify-center" onClick={(event) => event.stopPropagation()}>
                <div className="absolute left-2 right-2 top-2 z-20 flex items-center gap-2 rounded-2xl border border-white/20 bg-black/35 px-2.5 py-2 text-white backdrop-blur-md sm:left-3 sm:right-3 sm:top-3 sm:px-3">
                  <button
                    type="button"
                    onClick={closeImageViewer}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/35 bg-black/35 text-white"
                    aria-label="Close full image viewer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1 truncate text-center text-xs font-semibold sm:text-sm">
                    {mobileDisplayName}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => applyViewerScale(viewerScale - 0.2)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/35 bg-black/35 text-white"
                      aria-label="Zoom out"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={resetViewerTransform}
                      className="rounded-full border border-white/35 bg-black/35 px-2.5 py-1 text-xs font-semibold text-white"
                    >
                      {Math.round(viewerScale * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={() => applyViewerScale(viewerScale + 0.2)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/35 bg-black/35 text-white"
                      aria-label="Zoom in"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div
                  ref={viewerStageRef}
                  className="relative h-[80dvh] w-full touch-none overflow-hidden rounded-2xl border border-white/20 bg-black/30 shadow-[0_20px_60px_rgba(2,6,23,0.75)]"
                  onPointerDown={handleViewerPointerDown}
                  onPointerMove={handleViewerPointerMove}
                  onPointerUp={handleViewerPointerUpOrCancel}
                  onPointerCancel={handleViewerPointerUpOrCancel}
                  onWheel={handleViewerWheel}
                  onTouchStart={handleViewerTouchStart}
                  onTouchMove={handleViewerTouchMove}
                  onTouchEnd={handleViewerTouchEnd}
                  onTouchCancel={handleViewerTouchEnd}
                >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.img
                    key={`${profileId}-${currentViewerPhotoIndex}-viewer`}
                    src={currentViewerPhoto}
                    alt={profile.name}
                    className="h-full w-full select-none object-contain"
                    style={{
                      transform: `translate3d(${viewerOffset.x}px, ${viewerOffset.y}px, 0) scale(${viewerScale})`,
                      transformOrigin: 'center center',
                      willChange: 'transform',
                    }}
                    initial={{ opacity: 0.4 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0.4 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    draggable={false}
                    loading="eager"
                    decoding="async"
                  />
                </AnimatePresence>

                  <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[11px] text-white/85 backdrop-blur-md">
                    Pinch to zoom - Drag to pan - Double tap to reset
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden rounded-none border-0 bg-slate-900/78 shadow-none sm:rounded-3xl sm:border sm:border-white/12 sm:shadow-[0_20px_65px_rgba(3,12,28,0.62)] sm:backdrop-blur-sm">
      <div className="relative h-full bg-slate-700">
        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={`${profileId}-0-blur`}
            src={cardPhotos[0]}
            alt={profile.name}
            className="absolute inset-0 h-full w-full object-cover blur-xl brightness-50"
            initial={{ opacity: 0.45, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0.45, scale: 0.985 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            draggable={false}
            loading="eager"
            decoding="async"
          />
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={`${profileId}-0`}
            src={cardPhotos[0]}
            alt={profile.name}
            className="absolute inset-0 h-full w-full object-cover object-center [image-rendering:auto] [backface-visibility:hidden] [transform:translateZ(0)]"
            initial={{ opacity: 0.45 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0.45 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            draggable={false}
            loading="eager"
            decoding="async"
          />
        </AnimatePresence>

        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-24 sm:px-4 sm:pb-5 sm:pt-20">
          <div className="mb-2 inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-200 backdrop-blur-sm">
            {distanceBadge}
          </div>
          <h2 className="text-[2rem] font-semibold leading-tight text-white sm:text-[2.7rem]">
            <span className="inline-flex items-center gap-2 align-top">
              <span>
                {profile.name}
                {profile.age ? `, ${profile.age}` : ''}
              </span>
              {renderPremiumCrown('mt-1 h-[0.9em] w-[0.9em] shrink-0 object-contain sm:h-[0.92em] sm:w-[0.92em]')}
            </span>
          </h2>
          <p className="mt-1 text-base font-medium text-slate-100">{locationText}</p>

          <p className="mt-2 line-clamp-3 max-w-xl text-sm text-slate-200 sm:text-base">
            {profile.bio?.trim() || 'No bio available yet.'}
          </p>

          {formattedGender || profile.height || locationText || formattedDenomination ? (
            <div className="mt-3 flex max-w-xl flex-wrap gap-2">
              {formattedGender ? (
                <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1.5 text-xs font-semibold text-white/95 backdrop-blur-sm">
                  {formattedGender}
                </span>
              ) : null}
              {profile.height ? (
                <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1.5 text-xs font-semibold text-white/95 backdrop-blur-sm">
                  {profile.height.split('(')[0].trim()}
                </span>
              ) : null}
              {locationText ? (
                <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1.5 text-xs font-semibold text-white/95 backdrop-blur-sm">
                  {locationText}
                </span>
              ) : null}
              {formattedDenomination ? (
                <span className="rounded-full border border-white/20 bg-white/12 px-3 py-1.5 text-xs font-semibold text-white/95 backdrop-blur-sm">
                  {formattedDenomination}
                </span>
              ) : null}
            </div>
          ) : null}

          {spiritualGifts.length > 0 ? (
            <div className="mt-3 flex max-w-xl flex-wrap gap-2">
              {spiritualGifts.map((gift) => (
                <span
                  key={gift}
                  className="rounded-full border border-white/20 bg-white/12 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm"
                >
                  {gift}
                </span>
              ))}
            </div>
          ) : null}

          {favoriteVerse ? (
            <p className="mt-3 max-w-xl text-sm italic text-slate-100">
              "{favoriteVerse}"
            </p>
          ) : null}

          <Link
            to={`/profile/${profileId}`}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(236,72,153,0.28)] transition hover:brightness-110 hover:-translate-y-0.5"
          >
            View Full Profile
          </Link>

          <div className="mt-5">
            <FloatingActionButtons onPass={onPass} onLike={onLike} />
          </div>
        </div>
      </div>
    </div>
  );
};
