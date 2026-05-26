import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HeartBeatLoader } from '@/components/HeartBeatLoader';
import { TopBar } from '@/components/dashboard/TopBar';
import { SidePanel } from '@/components/dashboard/SidePanel';
import { useAuthContext } from '@/contexts/AuthContext';
import { useMatches, useMatching } from '@/hooks/useAPI';
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Church,
  Flame,
  GraduationCap,
  Heart,
  HeartHandshake,
  Languages,
  MapPin,
  MessageCircle,
  Ruler,
  Sparkles,
  Target,
  UserRound,
  VenusAndMars,
  X,
} from 'lucide-react';
import type { User } from '@/services/api';

const getProfilePhotos = (user: User): string[] => {
  const photos = [
    user.profilePhoto1,
    user.profilePhoto2,
    user.profilePhoto3,
    user.profilePhoto4,
    user.profilePhoto5,
    user.profilePhoto6,
  ].filter(Boolean) as string[];

  if (photos.length === 0) {
    return ['/default-avatar.png'];
  }

  return photos;
};

const formatValue = (value?: string | null): string => {
  if (!value) return 'Not provided';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const DashboardPanel = ({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) => (
  <section className="rounded-[36px] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)] sm:p-6">
    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-slate-500">{eyebrow}</p>
    <h2 className="profile-display mt-3 text-[1.9rem] leading-[0.98] tracking-[-0.02em] text-slate-900 sm:text-[2.2rem]">{title}</h2>
    <div className="mt-5">{children}</div>
  </section>
);

const DetailTile = ({
  label,
  value,
  icon,
}: {
  label: string;
  value?: string | null;
  icon?: ReactNode;
}) => (
  <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
    <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
      {icon}
      <span>{label}</span>
    </div>
    <p className="mt-2.5 text-[1rem] font-medium leading-7 text-slate-900 sm:text-[1.05rem]">{value || 'Not provided'}</p>
  </div>
);

const ChipList = ({ items, emptyText = 'Not provided' }: { items?: string[]; emptyText?: string }) => {
  if (!items || items.length === 0) {
    return <p className="text-[0.98rem] leading-7 text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      {items.map((item, index) => (
        <span
          key={`${item}-${index}`}
          className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[0.8rem] font-semibold tracking-[-0.01em] text-slate-700 shadow-[0_6px_18px_rgba(15,23,42,0.06)] sm:text-[0.88rem]"
        >
          {formatValue(item)}
        </span>
      ))}
    </div>
  );
};

const getInterestList = (profile: User): string[] => {
  if (Array.isArray(profile.interests) && profile.interests.length > 0) return profile.interests;
  if (Array.isArray(profile.hobbies) && profile.hobbies.length > 0) return profile.hobbies;
  return [];
};

const normalizeList = (value?: string[] | string | null): string[] => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

const buildRangeLabel = (min?: number | null, max?: number | null, suffix = ''): string => {
  const minLabel = typeof min === 'number' ? `${min}${suffix}` : null;
  const maxLabel = typeof max === 'number' ? `${max}${suffix}` : null;

  if (minLabel && maxLabel) return `${minLabel} - ${maxLabel}`;
  if (minLabel) return `From ${minLabel}`;
  if (maxLabel) return `Up to ${maxLabel}`;
  return 'Not provided';
};

const ProfilePage = () => {
  const { id: profileId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getUserProfileById, user: contextUser } = useAuthContext();
  const { likeUser, passUser } = useMatching();
  const { mutual, sent, refetch: refetchMatches } = useMatches();

  const [showSidePanel, setShowSidePanel] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'like' | 'pass' | null>(null);
  const [hasLikedFromProfile, setHasLikedFromProfile] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const layoutName = contextUser?.name || 'User';
  const layoutImage = contextUser?.profilePhoto1 || undefined;

  useEffect(() => {
    const fetchProfile = async () => {
      if (!profileId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const userData = await getUserProfileById(profileId);
        setProfile(userData);
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [profileId, getUserProfileById]);

  const photos = useMemo(() => (profile ? getProfilePhotos(profile) : ['/default-avatar.png']), [profile]);

  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [profile?.id]);

  useEffect(() => {
    setHasLikedFromProfile(false);
  }, [profile?.id]);

  const isOwnProfile = Boolean(contextUser?.id && profile?.id && contextUser.id === profile.id);

  const mutualIds = useMemo(() => {
    const list = Array.isArray(mutual)
      ? mutual
      : mutual && typeof mutual === 'object' && 'matches' in (mutual as Record<string, unknown>)
      ? ((mutual as { matches?: Array<Record<string, unknown>> }).matches ?? [])
      : [];

    return new Set(
      list
        .map((item) => item?.matchedUserId || item?.id || item?.matchedUser?.id)
        .filter(Boolean)
        .map((id) => String(id))
    );
  }, [mutual]);

  const isMutual = Boolean(profile?.id && mutualIds.has(String(profile.id)));

  const sentIds = useMemo(() => {
    const list = Array.isArray(sent)
      ? sent
      : sent && typeof sent === 'object' && 'matches' in (sent as Record<string, unknown>)
      ? ((sent as { matches?: Array<Record<string, unknown>> }).matches ?? [])
      : [];

    return new Set(
      list
        .map((item) => item?.likedUserId || item?.id || item?.likedUser?.id || item?.userId || item?.matchedUserId)
        .filter(Boolean)
        .map((id) => String(id))
    );
  }, [sent]);

  const hasSentLike = Boolean(profile?.id && (hasLikedFromProfile || sentIds.has(String(profile.id))));
  const showMessageAction = !isOwnProfile && isMutual;
  const showPendingLikeState = !isOwnProfile && !isMutual && hasSentLike;

  useEffect(() => {
    if (!profile?.id || isOwnProfile || isMutual || !hasSentLike) return;

    const intervalId = window.setInterval(() => {
      void refetchMatches();
    }, 12000);

    const syncOnVisible = () => {
      if (document.visibilityState === 'visible') {
        void refetchMatches();
      }
    };

    window.addEventListener('focus', syncOnVisible);
    document.addEventListener('visibilitychange', syncOnVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', syncOnVisible);
      document.removeEventListener('visibilitychange', syncOnVisible);
    };
  }, [hasSentLike, isMutual, isOwnProfile, profile?.id, refetchMatches]);

  const nextPhoto = () => setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  const prevPhoto = () => setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (delta < -50) nextPhoto();
    else if (delta > 50) prevPhoto();
    setTouchStartX(null);
  };

  const handleMessage = () => {
    if (!profile?.id) return;
    navigate(`/messages?profileId=${profile.id}&profileName=${encodeURIComponent(profile.name)}`);
  };

  const handleLike = async () => {
    if (!profile?.id || isOwnProfile) return;
    setActionLoading('like');
    try {
      await likeUser(profile.id);
      setHasLikedFromProfile(true);
      void refetchMatches();
    } finally {
      setActionLoading(null);
    }
  };

  const handlePass = async () => {
    if (!profile?.id || isOwnProfile) return;
    setActionLoading('pass');
    try {
      await passUser(profile.id);
      navigate('/dashboard');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <HeartBeatLoader message="Loading profile..." />;

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f4] px-6 text-slate-900">
        <div className="max-w-md rounded-[32px] border border-slate-200 bg-white p-7 text-center shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <h1 className="profile-display mb-2 text-2xl font-semibold text-slate-900">Profile Not Found</h1>
          <p className="mb-6 text-sm text-slate-500">This user may no longer be available or the link is invalid.</p>
          <button
            onClick={() => navigate('/dashboard')}
            type="button"
            className="rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(236,72,153,0.22)] transition hover:brightness-110"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const firstName = profile.name?.trim().split(/\s+/)[0] || profile.name || 'This user';
  const hasRealPhotos = !(photos.length === 1 && photos[0] === '/default-avatar.png');
  const realPhotoCount = hasRealPhotos ? photos.length : 0;
  const totalPhotoCount = profile.profilePhotoCount ?? realPhotoCount;
  const profileFitList = normalizeList(profile.profileFits);
  const interestList = getInterestList(profile);
  const personalityList = normalizeList(profile.personality);
  const communicationList = normalizeList(profile.communicationStyle);
  const loveStyleList = normalizeList(profile.loveStyle);
  const languageList = normalizeList(profile.languageSpoken);
  const preferenceDenominations = normalizeList(profile.preferredDenomination);
  const preferenceFaithJourney = normalizeList(profile.preferredFaithJourney);
  const preferenceChurchAttendance = normalizeList(profile.preferredChurchAttendance);
  const preferenceRelationshipGoals = normalizeList(profile.preferredRelationshipGoals);
  // Own-profile view uses contextUser for PII fields (not returned by the public API)
  const contactNumber = [contextUser?.countryCode, contextUser?.phoneNumber].filter(Boolean).join(' ').trim();
  const primaryGoal = profile.relationshipGoals?.[0] || profile.lookingFor?.[0] || '';
  const quickHighlights = [
    { label: 'Denomination', value: formatValue(profile.denomination) },
    { label: 'Faith Journey', value: formatValue(profile.faithJourney) },
    { label: 'Primary Goal', value: primaryGoal ? formatValue(primaryGoal) : 'Not provided' },
    { label: 'Profession', value: profile.profession || 'Not provided' },
  ];

  const actionButtons = (
    <>
      {showMessageAction ? (
        <button
          onClick={handleMessage}
          type="button"
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(236,72,153,0.2)] transition hover:brightness-110"
        >
          <MessageCircle className="h-4 w-4" />
          Message {firstName}
        </button>
      ) : showPendingLikeState ? (
        <div className="rounded-2xl border border-pink-200 bg-pink-50 px-4 py-3 text-center text-sm font-semibold text-pink-700">
          Like sent. We&apos;ll unlock messaging when it becomes a match.
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={handlePass}
            disabled={actionLoading !== null}
            type="button"
            className="inline-flex h-[4rem] w-[4rem] items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white shadow-[0_12px_28px_rgba(2,6,23,0.38)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Pass"
          >
            <span className="relative inline-flex h-[2.8rem] w-[2.8rem] items-center justify-center rounded-[1.1rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 shadow-[0_10px_18px_rgba(15,23,42,0.26)]">
              <span className="absolute inset-[1px] rounded-[1rem] border border-white/10" />
              <X className="relative h-5 w-5 text-white" style={{ strokeWidth: 2.8 }} />
            </span>
          </button>
          <button
            onClick={handleLike}
            disabled={actionLoading !== null}
            type="button"
            className="inline-flex h-[4rem] w-[4rem] items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white shadow-[0_12px_28px_rgba(2,6,23,0.38)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Like"
          >
            <span className="relative inline-flex h-[2.8rem] w-[2.8rem] items-center justify-center rounded-[1.1rem] bg-gradient-to-br from-fuchsia-500 via-pink-500 to-rose-500 shadow-[0_8px_16px_rgba(236,72,153,0.26)]">
              <span className="absolute inset-[1px] rounded-[1rem] bg-gradient-to-br from-white/18 to-transparent" />
              <Heart className="relative h-5 w-5 fill-white text-white" style={{ strokeWidth: 2.4 }} />
            </span>
          </button>
        </div>
      )}
    </>
  );

  const content = (
    <div className="profile-page mx-auto w-full max-w-[88rem] px-3 pb-28 pt-5 sm:px-5 sm:pb-24 lg:px-8">
      <div className="rounded-[40px] border border-slate-200 bg-[#f8f8f7] p-3 shadow-[0_20px_45px_rgba(15,23,42,0.05)] sm:rounded-[44px] sm:p-4">
        {/* Back button */}
        <div className="mb-4 flex items-center">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_10px_22px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:text-slate-900"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>

        {/* Two-column grid: left sticky photo+highlights, right scrollable sections */}
        <div className="grid gap-4 lg:grid-cols-[minmax(300px,0.85fr)_1.4fr] lg:gap-6">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">

            {/* Photo card: carousel + identity + faith chips */}
            <section className="overflow-hidden rounded-[38px] border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.08)]">

              {/* ── CAROUSEL ── */}
              <div
                className="relative overflow-hidden rounded-t-[38px] select-none"
                style={{ height: 'min(75svh, 560px)' }}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {/* Sliding photo strip */}
                <div
                  className="flex h-full"
                  style={{
                    transform: `translateX(-${currentPhotoIndex * 100}%)`,
                    width: `${photos.length * 100}%`,
                    transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  {photos.map((url, i) => (
                    <div
                      key={`photo-slide-${i}`}
                      className="relative h-full flex-shrink-0"
                      style={{ width: `${100 / photos.length}%` }}
                    >
                      <img
                        src={url}
                        alt={`${profile.name} photo ${i + 1}`}
                        className="h-full w-full object-cover"
                        loading={i === 0 ? 'eager' : 'lazy'}
                        draggable={false}
                      />
                    </div>
                  ))}
                </div>

                {/* Dark gradient overlay */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/15 to-transparent" />

                {/* Top row: photo count badge + verified + mutual */}
                <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/60 bg-black/30 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-white backdrop-blur-md">
                      {totalPhotoCount} {totalPhotoCount === 1 ? 'Photo' : 'Photos'}
                    </span>
                    {profile.isVerified && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/60 bg-black/30 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-emerald-300 backdrop-blur-md">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Verified
                      </span>
                    )}
                  </div>
                  {!isOwnProfile && isMutual && (
                    <span className="rounded-full border border-white/60 bg-black/30 px-3 py-1 text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-fuchsia-300 backdrop-blur-md">
                      Mutual Match
                    </span>
                  )}
                </div>

                {/* Prev / Next arrows */}
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white backdrop-blur-sm transition hover:bg-black/50"
                      aria-label="Previous photo"
                      type="button"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white backdrop-blur-sm transition hover:bg-black/50"
                      aria-label="Next photo"
                      type="button"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}

                {/* Dot indicators — overlaid inside image, bottom-center */}
                {photos.length > 1 && (
                  <div className="absolute bottom-[5.5rem] inset-x-0 flex justify-center gap-1.5 px-4">
                    {photos.map((_, i) => (
                      <button
                        key={`photo-dot-${i}`}
                        onClick={() => setCurrentPhotoIndex(i)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === currentPhotoIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/45'
                        }`}
                        aria-label={`Go to photo ${i + 1}`}
                        type="button"
                      />
                    ))}
                  </div>
                )}

                {/* Identity strip — name + location overlaid at image bottom */}
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {profile.age ? (
                      <span className="rounded-full border border-white/50 bg-black/30 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                        Age {profile.age}
                      </span>
                    ) : null}
                    {profile.gender ? (
                      <span className="rounded-full border border-white/50 bg-black/30 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                        {formatValue(profile.gender)}
                      </span>
                    ) : null}
                    {profile.height ? (
                      <span className="rounded-full border border-white/50 bg-black/30 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                        {profile.height}
                      </span>
                    ) : null}
                  </div>
                  <h1 className="profile-display text-[2.2rem] leading-[0.92] tracking-[-0.02em] text-white sm:text-[2.85rem]">
                    {profile.name}
                  </h1>
                  <p className="mt-2 flex items-center gap-1.5 text-[0.95rem] text-white/85">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    {profile.location || 'Location not provided'}
                  </p>
                </div>
              </div>

              {/* ── FAITH CHIPS STRIP — below image, above scroll ── */}
              {(profile.denomination || profile.faithJourney || primaryGoal) && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
                  {profile.denomination && (
                    <span className="rounded-full border border-fuchsia-100 bg-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-fuchsia-700">
                      {formatValue(profile.denomination)}
                    </span>
                  )}
                  {profile.faithJourney && (
                    <span className="rounded-full border border-pink-100 bg-pink-50 px-3 py-1.5 text-xs font-semibold text-pink-700">
                      {formatValue(profile.faithJourney)}
                    </span>
                  )}
                  {primaryGoal && (
                    <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                      {formatValue(primaryGoal)}
                    </span>
                  )}
                </div>
              )}
            </section>

            {/* Quick highlights panel */}
            <DashboardPanel eyebrow="Snapshot" title="Quick Highlights">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {quickHighlights.map((item) => (
                  <DetailTile key={item.label} label={item.label} value={item.value} />
                ))}
              </div>
            </DashboardPanel>

            {/* Action buttons — desktop only */}
            {!isOwnProfile && (
              <div className="hidden rounded-[34px] border border-slate-200 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)] lg:block">
                {actionButtons}
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN — content sections ── */}
          <div className="space-y-4 sm:space-y-5">

            {/* About */}
            <DashboardPanel eyebrow="Overview" title={`About ${firstName}`}>
              <p className="text-[1.03rem] leading-8 text-slate-700 sm:text-[1.1rem]">
                {profile.bio?.trim() || 'No bio provided yet.'}
              </p>

              {(profile.personalPromptQuestion || profile.personalPromptAnswer) && (
                <div className="mt-5 rounded-[30px] border border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    {profile.personalPromptQuestion || 'Prompt'}
                  </p>
                  <p className="profile-display mt-3 text-[1.52rem] leading-[1.08] tracking-[-0.015em] text-slate-900 sm:text-[1.74rem]">
                    {profile.personalPromptAnswer || 'No answer provided yet.'}
                  </p>
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <DetailTile label="Age" value={profile.age ? String(profile.age) : 'Not provided'} />
                <DetailTile label="Gender" value={formatValue(profile.gender)} icon={<VenusAndMars className="h-3.5 w-3.5" />} />
                <DetailTile label="Location" value={profile.location || 'Not provided'} icon={<MapPin className="h-3.5 w-3.5" />} />
              </div>
            </DashboardPanel>

            {/* Faith Walk */}
            <DashboardPanel eyebrow="Faith" title="Faith Walk">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailTile label="Denomination" value={formatValue(profile.denomination)} />
                <DetailTile label="Faith Journey" value={formatValue(profile.faithJourney)} icon={<Flame className="h-3.5 w-3.5" />} />
                <DetailTile
                  label="Church Attendance"
                  value={formatValue(profile.churchAttendance || profile.sundayActivity)}
                  icon={<Church className="h-3.5 w-3.5" />}
                />
                <DetailTile label="Baptism Status" value={formatValue(profile.baptismStatus)} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4">
                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Spiritual Gifts</p>
                  <div className="mt-3">
                    <ChipList items={profile.spiritualGifts} emptyText="No spiritual gifts listed" />
                  </div>
                </div>
                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Core Values</p>
                  <div className="mt-3">
                    <ChipList items={profile.values} emptyText="No values listed" />
                  </div>
                </div>
                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Favorite Verse</p>
                  <p className="mt-3 text-base italic leading-relaxed text-slate-800">
                    {profile.favoriteVerse ? `"${profile.favoriteVerse}"` : 'Not provided'}
                  </p>
                </div>
              </div>
            </DashboardPanel>

            {/* Relationship */}
            <DashboardPanel eyebrow="Connection" title="Relationship">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-4">
                  <p className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    <HeartHandshake className="h-3.5 w-3.5" />
                    Looking For
                  </p>
                  <div className="mt-3">
                    <ChipList items={profile.lookingFor} emptyText="No relationship preference listed" />
                  </div>
                </div>
                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-4">
                  <p className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    <Target className="h-3.5 w-3.5" />
                    Relationship Goals
                  </p>
                  <div className="mt-3">
                    <ChipList items={profile.relationshipGoals} emptyText="No goals listed" />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailTile label="Love Language" value={loveStyleList.length ? loveStyleList.map(formatValue).join(', ') : 'Not provided'} />
              </div>

              <div className="mt-4 rounded-[30px] border border-slate-200 bg-slate-50 p-4">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Communication Style</p>
                <div className="mt-3">
                  <ChipList items={communicationList} emptyText="Not provided" />
                </div>
              </div>
            </DashboardPanel>

            {/* Personal Details */}
            <DashboardPanel eyebrow="Identity" title="Personal Details">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <DetailTile label="Profession" value={profile.profession || 'Not provided'} icon={<Briefcase className="h-3.5 w-3.5" />} />
                <DetailTile label="Field of Study" value={profile.fieldOfStudy || 'Not provided'} icon={<GraduationCap className="h-3.5 w-3.5" />} />
                <DetailTile label="Education Level" value={formatValue(profile.educationLevel)} />
                <DetailTile label="Height" value={profile.height || 'Not provided'} icon={<Ruler className="h-3.5 w-3.5" />} />
                <DetailTile label="Primary Language" value={profile.language || 'Not provided'} icon={<Languages className="h-3.5 w-3.5" />} />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Languages Spoken</p>
                  <div className="mt-3">
                    <ChipList items={languageList} emptyText="No languages listed" />
                  </div>
                </div>
                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Profile Fits</p>
                  <div className="mt-3">
                    <ChipList items={profileFitList} emptyText="No profile fit selections listed" />
                  </div>
                </div>
                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-4">
                  <p className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    <Sparkles className="h-3.5 w-3.5" />
                    Interests and Hobbies
                  </p>
                  <div className="mt-3">
                    <ChipList items={interestList} emptyText="No interests listed" />
                  </div>
                </div>
                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-4">
                  <p className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
                    <UserRound className="h-3.5 w-3.5" />
                    Personality
                  </p>
                  <div className="mt-3">
                    <ChipList items={personalityList} emptyText="No personality traits listed" />
                  </div>
                </div>
              </div>
            </DashboardPanel>

            {/* Preferences */}
            <DashboardPanel eyebrow="Preferences" title="What They Want">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <DetailTile label="Preferred Gender" value={formatValue(profile.preferredGender || undefined)} />
                <DetailTile label="Preferred Age Range" value={buildRangeLabel(profile.minAge, profile.maxAge)} />
                <DetailTile label="Maximum Distance" value={buildRangeLabel(undefined, profile.maxDistance, ' km')} />
                <DetailTile
                  label="Preferred Minimum Height"
                  value={typeof profile.preferredMinHeight === 'number' ? `${profile.preferredMinHeight} cm` : 'Not provided'}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Preferred Denomination</p>
                  <div className="mt-3">
                    <ChipList items={preferenceDenominations} emptyText="No denomination preference listed" />
                  </div>
                </div>
                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Preferred Faith Journey</p>
                  <div className="mt-3">
                    <ChipList items={preferenceFaithJourney} emptyText="No faith journey preference listed" />
                  </div>
                </div>
                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Preferred Church Attendance</p>
                  <div className="mt-3">
                    <ChipList items={preferenceChurchAttendance} emptyText="No church attendance preference listed" />
                  </div>
                </div>
                <div className="rounded-[30px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-slate-500">Preferred Relationship Goals</p>
                  <div className="mt-3">
                    <ChipList items={preferenceRelationshipGoals} emptyText="No relationship goal preference listed" />
                  </div>
                </div>
              </div>
            </DashboardPanel>

            {/* Private — own profile only */}
            {isOwnProfile && (
              <DashboardPanel eyebrow="Private" title="Your Saved Account Details">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetailTile label="Email" value={contextUser?.email || 'Not provided'} />
                  <DetailTile label="Phone Number" value={contactNumber || 'Not provided'} />
                </div>
              </DashboardPanel>
            )}
          </div>
        </div>
      </div>

      {/* Mobile fixed action bar */}
      {!isOwnProfile && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 py-4 lg:hidden">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between rounded-[32px] border border-slate-200 bg-white/94 px-5 py-4 shadow-[0_16px_40px_rgba(15,23,42,0.1)] backdrop-blur-xl">
            {showMessageAction ? (
              <button
                onClick={handleMessage}
                type="button"
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 px-5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(236,72,153,0.18)] transition hover:brightness-110"
              >
                <MessageCircle className="h-4 w-4" />
                Message
              </button>
            ) : showPendingLikeState ? (
              <div className="w-full rounded-2xl border border-pink-200 bg-pink-50 px-4 py-3 text-center text-sm font-semibold text-pink-700">
                Like sent. We&apos;ll unlock messaging when it becomes a match.
              </div>
            ) : (
              <>
                <button
                  onClick={handlePass}
                  disabled={actionLoading !== null}
                  type="button"
                  className="inline-flex h-[4rem] w-[4rem] items-center justify-center rounded-full border border-slate-200 bg-white text-white shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Pass"
                >
                  <span className="relative inline-flex h-[2.55rem] w-[2.55rem] items-center justify-center rounded-[1.05rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 shadow-[0_10px_18px_rgba(15,23,42,0.26)]">
                    <span className="absolute inset-[1px] rounded-[0.98rem] border border-white/10" />
                    <X className="relative h-5 w-5 text-white" style={{ strokeWidth: 2.8 }} />
                  </span>
                </button>
                <button
                  onClick={handleLike}
                  disabled={actionLoading !== null}
                  type="button"
                  className="inline-flex h-[4rem] w-[4rem] items-center justify-center rounded-full border border-slate-200 bg-white text-white shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Like"
                >
                  <span className="relative inline-flex h-[2.55rem] w-[2.55rem] items-center justify-center rounded-[1.05rem] bg-gradient-to-br from-fuchsia-500 via-pink-500 to-rose-500 shadow-[0_8px_16px_rgba(236,72,153,0.26)]">
                    <span className="absolute inset-[1px] rounded-[0.98rem] bg-gradient-to-br from-white/18 to-transparent" />
                    <Heart className="relative h-5 w-5 fill-white text-white" style={{ strokeWidth: 2.4 }} />
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f5f5f4] text-slate-900 dashboard-main">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .profile-page {
          font-family: "Plus Jakarta Sans", "Segoe UI", sans-serif;
          color: #0f172a;
        }

        .profile-display {
          font-family: "Cormorant Garamond", "Times New Roman", serif;
        }
      `}</style>

      {/* Desktop layout */}
      <div className="hidden min-h-screen lg:flex">
        <div className="w-80 flex-shrink-0 self-stretch">
          <SidePanel userName={layoutName} userImage={layoutImage} user={contextUser} onClose={() => setShowSidePanel(false)} />
        </div>
        <div className="flex min-h-screen flex-1 flex-col bg-transparent">
          <TopBar
            userName={layoutName}
            userImage={layoutImage}
            user={contextUser}
            showFilters={false}
            showSidePanel={showSidePanel}
            onToggleFilters={() => {}}
            onToggleSidePanel={() => setShowSidePanel(false)}
            title={`${profile.name}'s Profile`}
          />
          <div className="flex-1 overflow-y-auto">{content}</div>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="min-h-screen lg:hidden">
        <TopBar
          userName={layoutName}
          userImage={layoutImage}
          user={contextUser}
          showFilters={false}
          showSidePanel={showSidePanel}
          onToggleFilters={() => {}}
          onToggleSidePanel={() => setShowSidePanel(true)}
          title={`${profile.name}'s Profile`}
        />
        <div className="flex-1">{content}</div>
      </div>

      {/* Mobile side panel overlay */}
      {showSidePanel && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowSidePanel(false)} />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw]">
            <SidePanel userName={layoutName} userImage={layoutImage} user={contextUser} onClose={() => setShowSidePanel(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
