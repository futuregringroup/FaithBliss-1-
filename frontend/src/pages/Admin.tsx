import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowLeft, CircleDollarSign, Crown, PencilLine, Search, ShieldCheck, SlidersHorizontal, Trash2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAllUsers } from '@/hooks/useAPI';
import { API, type AdminUpdateUserPayload } from '@/services/api';
import { useToast } from '@/contexts/ToastContext';
import type { User } from '@/types/User';

type EditableUser = {
  id: string;
  name: string;
  email: string;
  role: NonNullable<AdminUpdateUserPayload['role']>;
  roles: string[];
  hasDeveloperAccess: boolean;
  age: number;
  gender: 'MALE' | 'FEMALE';
  preferredGender: 'MALE' | 'FEMALE' | null;
  location: string;
  bio: string;
  denomination: string;
  onboardingCompleted: boolean;
  isActive: boolean;
  subscriptionStatus: 'active' | 'pending' | 'inactive';
  subscriptionTier: 'free' | 'premium' | 'elite';
  subscriptionBillingCycle: 'monthly' | 'quarterly';
};

type EditableSource = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  roles?: string[];
  age?: number;
  gender?: string;
  preferredGender?: string | null;
  location?: string;
  bio?: string;
  denomination?: string;
  onboardingCompleted?: boolean;
  isActive?: boolean;
  subscriptionStatus?: string;
  subscriptionTier?: string;
  subscriptionBillingCycle?: string;
};

const normalizeEditableGender = (value: unknown): 'MALE' | 'FEMALE' => {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return normalized === 'FEMALE' ? 'FEMALE' : 'MALE';
};

const normalizeEditablePreferredGender = (value: unknown): 'MALE' | 'FEMALE' | null => {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (normalized === 'MALE') return 'MALE';
  if (normalized === 'FEMALE') return 'FEMALE';
  return null;
};

const normalizeEditableRole = (value: unknown): NonNullable<AdminUpdateUserPayload['role']> => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'admin' || normalized === 'marketer') return normalized;
  return 'user';
};

const FEATURE_SETTINGS_SYNC_KEY = 'faithbliss:feature-settings-updated-at';
const FEATURE_SETTINGS_SYNC_EVENT = 'faithbliss:feature-settings-updated';
const FEATURE_SETTINGS_CACHE_KEY = 'faithbliss:feature-settings-cache';

const isAdminRole = (role: string | undefined) => (role || '').trim().toLowerCase() === 'admin';
const getNormalizedRoles = (roles: unknown): string[] =>
  Array.isArray(roles)
    ? roles.map((role) => String(role).trim().toLowerCase()).filter(Boolean)
    : [];

const getRoleSummaryLabel = (user: { role?: string; roles?: string[] }) => {
  const normalizedRoles = getNormalizedRoles(user.roles);
  const lowerRole = (user.role || '').trim().toLowerCase();
  const baseRole = isAdminRole(user.role)
    ? 'Admin'
    : lowerRole === 'marketer' || normalizedRoles.includes('marketer')
    ? 'Marketer'
    : 'User';
  return normalizedRoles.includes('developer') ? `${baseRole} + Developer` : baseRole;
};

const isAdminDeveloperUser = (user: { role?: string; roles?: string[] }) =>
  isAdminRole(user.role) && getNormalizedRoles(user.roles).includes('developer');

const toEditableUser = (user: EditableSource): EditableUser => ({
  id: user.id,
  name: user.name || '',
  email: user.email || '',
  role: normalizeEditableRole(user.role),
  roles: getNormalizedRoles(user.roles),
  hasDeveloperAccess: getNormalizedRoles(user.roles).includes('developer'),
  age: typeof user.age === 'number' ? user.age : 18,
  gender: normalizeEditableGender(user.gender),
  preferredGender: normalizeEditablePreferredGender(user.preferredGender),
  location: user.location || '',
  bio: user.bio || '',
  denomination: typeof user.denomination === 'string' ? user.denomination : '',
  onboardingCompleted: Boolean(user.onboardingCompleted),
  isActive: user.isActive !== false,
  subscriptionStatus:
    user.subscriptionStatus === 'active' || user.subscriptionStatus === 'pending' || user.subscriptionStatus === 'inactive'
      ? user.subscriptionStatus
      : 'inactive',
  subscriptionTier:
    user.subscriptionTier === 'premium' || user.subscriptionTier === 'elite' || user.subscriptionTier === 'free'
      ? user.subscriptionTier
      : 'free',
  subscriptionBillingCycle: user.subscriptionBillingCycle === 'quarterly' ? 'quarterly' : 'monthly',
});

type TimelinePoint = {
  label: string;
  value: number;
};

const getRecentValidDates = (timestamps: Array<string | null | undefined>, days = 7): Date[] => {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));

  return timestamps
    .map((timestamp) => {
      if (!timestamp) return null;
      const parsed = new Date(timestamp);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    })
    .filter((value): value is Date => Boolean(value && value.getTime() >= cutoff.getTime() && value.getTime() <= now.getTime()));
};

const buildDailySeries = (timestamps: Array<string | null | undefined>, days = 7): TimelinePoint[] => {
  const now = new Date();
  const buckets = new Map<string, number>();
  const labels: string[] = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(now.getDate() - index);
    const key = date.toISOString().slice(0, 10);
    labels.push(key);
    buckets.set(key, 0);
  }

  timestamps.forEach((timestamp) => {
    if (!timestamp) return;
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return;
    parsed.setHours(0, 0, 0, 0);
    const key = parsed.toISOString().slice(0, 10);
    if (!buckets.has(key)) return;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });

  return labels.map((key) => {
    const parsed = new Date(key);
    const label = parsed.toLocaleDateString(undefined, { weekday: 'short' });
    return {
      label,
      value: buckets.get(key) || 0,
    };
  });
};

const buildHourlySeries = (timestamps: Array<string | null | undefined>, days = 7): TimelinePoint[] => {
  const buckets = Array.from({ length: 24 }, () => 0);
  const recentDates = getRecentValidDates(timestamps, days);

  recentDates.forEach((date) => {
    buckets[date.getHours()] += 1;
  });

  return buckets.map((value, hour) => ({
    label: formatHourLabel(hour),
    value,
  }));
};

const buildWeekdayBreakdown = (timestamps: Array<string | null | undefined>, days = 7) => {
  const buckets = [
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 0 },
    { label: 'Tue', value: 0 },
    { label: 'Wed', value: 0 },
    { label: 'Thu', value: 0 },
    { label: 'Fri', value: 0 },
    { label: 'Sat', value: 0 },
  ];

  getRecentValidDates(timestamps, days).forEach((date) => {
    buckets[date.getDay()].value += 1;
  });

  return buckets;
};

const formatHourLabel = (hour: number) => {
  const normalized = ((hour % 24) + 24) % 24;
  const period = normalized >= 12 ? 'PM' : 'AM';
  const base = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${base}${period}`;
};

const getPeakPoint = (points: TimelinePoint[]) =>
  points.reduce<TimelinePoint | null>((peak, point) => {
    if (!peak || point.value > peak.value) return point;
    return peak;
  }, null);

const LineTrendCard = ({
  title,
  subtitle,
  data,
  accentClass,
}: {
  title: string;
  subtitle: string;
  data: TimelinePoint[];
  accentClass: string;
}) => {
  const peak = Math.max(...data.map((point) => point.value), 1);
  const total = data.reduce((sum, point) => sum + point.value, 0);
  const width = 360;
  const height = 168;
  const paddingX = 18;
  const paddingTop = 14;
  const paddingBottom = 24;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;
  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : 0;

  const points = data.map((point, index) => {
    const x = paddingX + stepX * index;
    const y = paddingTop + chartHeight - (point.value / peak) * chartHeight;
    return { ...point, x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`
    : '';
  const visibleLabelStep =
    data.length <= 10 ? 1 : data.length <= 31 ? 5 : 10;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
        </div>
        <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300">
          {total} total
        </div>
      </div>

      <div className="mt-6">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-3">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
            <defs>
              <linearGradient id={`${title.replace(/\s+/g, '-').toLowerCase()}-gradient`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.32)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((tick, index) => {
              const y = paddingTop + chartHeight - chartHeight * tick;
              return (
                <line
                  key={`${title}-grid-${index}`}
                  x1={paddingX}
                  x2={width - paddingX}
                  y1={y}
                  y2={y}
                  stroke="rgba(148,163,184,0.16)"
                  strokeDasharray="4 6"
                />
              );
            })}
            {areaPath ? (
              <path
                d={areaPath}
                fill={`url(#${title.replace(/\s+/g, '-').toLowerCase()}-gradient)`}
              />
            ) : null}
            {linePath ? (
              <path
                d={linePath}
                fill="none"
                className={accentClass.replace('bg-gradient-to-t ', '').replace('from-', 'stroke-').replace(' to-', ' ')}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {points.map((point, index) => (
              <g key={`${title}-point-${index}`}>
                <circle cx={point.x} cy={point.y} r="3.5" fill="white" opacity="0.9" />
                {(index % visibleLabelStep === 0 || index === points.length - 1) ? (
                  <>
                    <text
                      x={point.x}
                      y={height - 6}
                      textAnchor="middle"
                      fontSize="10"
                      fill="rgba(203,213,225,0.8)"
                    >
                      {point.label}
                    </text>
                    <text
                      x={point.x}
                      y={Math.max(point.y - 10, 10)}
                      textAnchor="middle"
                      fontSize="10"
                      fill="rgba(255,255,255,0.92)"
                    >
                      {point.value}
                    </text>
                  </>
                ) : null}
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
};

const DonutBreakdownCard = ({
  title,
  subtitle,
  values,
  colors,
}: {
  title: string;
  subtitle: string;
  values: Array<{ label: string; value: number }>;
  colors: string[];
}) => {
  const total = values.reduce((sum, item) => sum + item.value, 0);
  const circumference = 2 * Math.PI * 44;
  let accumulated = 0;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
      </div>

      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="mx-auto sm:mx-0">
          <svg viewBox="0 0 120 120" className="h-32 w-32">
            <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(148,163,184,0.16)" strokeWidth="14" />
            {values.map((item, index) => {
              const portion = total > 0 ? item.value / total : 0;
              const dash = portion * circumference;
              const offset = circumference - accumulated;
              accumulated += dash;
              return (
                <circle
                  key={`${title}-${item.label}`}
                  cx="60"
                  cy="60"
                  r="44"
                  fill="none"
                  stroke={colors[index % colors.length]}
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={offset}
                  transform="rotate(-90 60 60)"
                />
              );
            })}
            <text x="60" y="56" textAnchor="middle" fontSize="12" fill="rgba(148,163,184,0.8)">
              Total
            </text>
            <text x="60" y="72" textAnchor="middle" fontSize="18" fontWeight="700" fill="white">
              {total}
            </text>
          </svg>
        </div>

        <div className="flex-1 space-y-3">
          {values.map((item, index) => (
            <div key={`${title}-legend-${item.label}`} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="text-sm text-gray-200">{item.label}</span>
              </div>
              <span className="text-sm font-semibold text-white">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const csvEscape = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const parseTimestamp = (value: unknown): Date | null => {
  if (!value) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as any).toDate === 'function') {
    const parsed = (value as any).toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }
  return null;
};

const formatTimestamp = (value: unknown): string | null => {
  const date = parseTimestamp(value);
  return date ? date.toLocaleString() : null;
};

const AdminPage = () => {
  const { showError, showSuccess, showInfo } = useToast();
  const [activeSection, setActiveSection] = useState<'overview' | 'users' | 'marketers' | 'payments' | 'reports' | 'features'>('overview');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<EditableUser | null>(null);
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);
  const [passportModeEnabled, setPassportModeEnabled] = useState(false);
  const [featureLoading, setFeatureLoading] = useState(true);
  const [featureSaving, setFeatureSaving] = useState(false);
  const [supportTickets, setSupportTickets] = useState<Awaited<ReturnType<typeof API.Support.getTickets>>['tickets']>([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingTicketId, setReplyingTicketId] = useState<string | null>(null);

  const [marketers, setMarketers] = useState<Array<{
    id: string;
    name: string;
    email: string;
    profilePhoto1?: string;
    marketedCount?: number;
  }>>([]);
  const [marketersLoading, setMarketersLoading] = useState(true);
  const [selectedMarketerId, setSelectedMarketerId] = useState<string | null>(null);
  const [marketerCustomers, setMarketerCustomers] = useState<Array<{
    id: string;
    name: string;
    email: string;
    subscriptionStatus?: string;
    location?: string;
    postPaymentSurvey?: {
      contacted: boolean;
      marketerId?: string;
      marketerName?: string;
      submittedAt?: string;
    };
  }>>([]);
  const [marketerCustomersLoading, setMarketerCustomersLoading] = useState(false);
  const [marketerCustomersModalOpen, setMarketerCustomersModalOpen] = useState(false);

  const [paymentAnalytics, setPaymentAnalytics] = useState<Awaited<ReturnType<typeof API.Payment.getAdminAnalytics>> | null>(null);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [platformStats, setPlatformStats] = useState<Awaited<ReturnType<typeof API.User.getAdminPlatformStats>> | null>(null);
  const [platformStatsLoading, setPlatformStatsLoading] = useState(true);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentProductFilter, setPaymentProductFilter] = useState<'all' | 'subscription' | 'profile_booster'>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'active' | 'paid' | 'pending' | 'inactive' | 'unknown'>('all');
  const [paymentTierFilter, setPaymentTierFilter] = useState<'all' | 'premium' | 'elite' | 'free' | 'booster'>('all');
  const [paymentCycleFilter, setPaymentCycleFilter] = useState<'all' | 'monthly' | 'quarterly' | 'one_time'>('all');
  const [paymentSort, setPaymentSort] = useState<'latest' | 'oldest' | 'amount-high' | 'amount-low' | 'name-az'>('latest');
  const [deletingPaymentUserId, setDeletingPaymentUserId] = useState<string | null>(null);
  const [overviewRangeDays, setOverviewRangeDays] = useState<7 | 30 | 90>(7);

  const broadcastFeatureSettingsUpdate = (settings: {
    passportModeEnabled: boolean;
    shutdownModeEnabled?: boolean;
  }) => {
    const marker = String(Date.now());
    window.localStorage.setItem(
      FEATURE_SETTINGS_CACHE_KEY,
      JSON.stringify({
        passportModeEnabled: Boolean(settings.passportModeEnabled),
        shutdownModeEnabled: Boolean(settings.shutdownModeEnabled),
      })
    );
    window.localStorage.setItem(FEATURE_SETTINGS_SYNC_KEY, marker);
    window.dispatchEvent(new Event(FEATURE_SETTINGS_SYNC_EVENT));
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    let isMounted = true;

    const loadAdminData = async () => {
      try {
        const [settingsResponse, issuesResponse, paymentsResponse, platformStatsResponse] = await Promise.all([
          API.User.getFeatureSettings(),
          API.Support.getTickets(),
          API.Payment.getAdminAnalytics(),
          API.User.getAdminPlatformStats().catch(() => null),
        ]);

        if (isMounted) {
          setPassportModeEnabled(Boolean(settingsResponse.passportModeEnabled));
          setSupportTickets(Array.isArray(issuesResponse.tickets) ? issuesResponse.tickets : []);
          setPaymentAnalytics(paymentsResponse);
          setPlatformStats(platformStatsResponse);
        }
      } catch (settingsError) {
        const message =
          settingsError instanceof Error && settingsError.message
            ? settingsError.message
            : 'Failed to load admin data.';
        showError(message);
      } finally {
        if (isMounted) {
          setFeatureLoading(false);
          setIssuesLoading(false);
          setPaymentsLoading(false);
          setPlatformStatsLoading(false);
        }
      }
    };

    void loadAdminData();

    return () => {
      isMounted = false;
    };
  }, [showError]);

  useEffect(() => {
    if (activeSection !== 'marketers') return;

    let isMounted = true;

    const loadMarketers = async () => {
      setMarketersLoading(true);
      try {
        const response = await API.User.getMarketers();
        if (!isMounted) return;
        setMarketers(response.marketers || []);
      } catch (error) {
        console.error('Failed to load marketers', error);
        showError('Unable to load marketers right now.');
      } finally {
        if (isMounted) setMarketersLoading(false);
      }
    };

    void loadMarketers();

    return () => {
      isMounted = false;
    };
  }, [activeSection, showError]);

  const { data, loading, error, refetch } = useAllUsers({ page: 1, limit: 200, search: debouncedSearch });

  const users = useMemo(
    () => (data?.users || []).filter((user) => !isAdminDeveloperUser(user)),
    [data?.users]
  );
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((user) => String(user.role || 'user').toLowerCase() === 'admin').length;
    const premium = users.filter((user) => user.subscriptionStatus === 'active').length;
    const completedOnboarding = users.filter((user) => user.onboardingCompleted).length;
    const tickets = supportTickets.length;
    const paymentRecords = paymentAnalytics?.summary.totalRecords ?? 0;
    return { total, admins, premium, completedOnboarding, tickets, paymentRecords };
  }, [data?.total, paymentAnalytics?.summary.totalRecords, supportTickets.length, users]);

  const overviewStats = useMemo(() => {
    const activeUsers = users.filter((user) => user.isActive !== false).length;
    const inactiveUsers = users.filter((user) => user.isActive === false).length;
    const onlineUsers = users.filter((user) => user.isOnline).length;
    const freeUsers = users.filter((user) => user.subscriptionStatus !== 'active').length;
    const pendingSubscriptions = users.filter((user) => user.subscriptionStatus === 'pending').length;
    const maleUsers = users.filter((user) => String(user.gender).toUpperCase() === 'MALE').length;
    const femaleUsers = users.filter((user) => String(user.gender).toUpperCase() === 'FEMALE').length;
    const openTickets = supportTickets.filter((ticket) => ticket.status === 'OPEN').length;
    const respondedTickets = supportTickets.filter((ticket) => ticket.status === 'RESPONDED').length;
    const helpTickets = supportTickets.filter((ticket) => ticket.type === 'HELP').length;
    const reportTickets = supportTickets.filter((ticket) => ticket.type === 'REPORT').length;
    const monthlySubscriptions = paymentAnalytics?.summary.monthlyPlans ?? 0;
    const quarterlySubscriptions = paymentAnalytics?.summary.quarterlyPlans ?? 0;

    return {
      activeUsers,
      inactiveUsers,
      onlineUsers,
      freeUsers,
      pendingSubscriptions,
      maleUsers,
      femaleUsers,
      openTickets,
      respondedTickets,
      helpTickets,
      reportTickets,
      monthlySubscriptions,
      quarterlySubscriptions,
    };
  }, [paymentAnalytics?.summary.monthlyPlans, paymentAnalytics?.summary.quarterlyPlans, supportTickets, users]);

  const recentTickets = useMemo(() => supportTickets.slice(0, 5), [supportTickets]);
  const recentPayments = useMemo(() => (paymentAnalytics?.records || []).slice(0, 5), [paymentAnalytics?.records]);
  const userGrowthSeries = useMemo(
    () => buildDailySeries(users.map((user) => user.createdAt), overviewRangeDays),
    [overviewRangeDays, users]
  );
  const paymentTrendSeries = useMemo(
    () => buildDailySeries((paymentAnalytics?.records || []).map((record) => record.updatedAt), overviewRangeDays),
    [overviewRangeDays, paymentAnalytics?.records]
  );
  const supportVolumeSeries = useMemo(
    () => buildDailySeries(supportTickets.map((ticket) => ticket.createdAt), overviewRangeDays),
    [overviewRangeDays, supportTickets]
  );
  const activityHourlySeries = useMemo(
    () => buildHourlySeries(users.map((user) => user.lastSeenAt), overviewRangeDays),
    [overviewRangeDays, users]
  );
  const activityWeekdaySeries = useMemo(
    () => buildWeekdayBreakdown(users.map((user) => user.lastSeenAt), overviewRangeDays),
    [overviewRangeDays, users]
  );
  const peakHour = useMemo(() => getPeakPoint(activityHourlySeries), [activityHourlySeries]);
  const peakWeekday = useMemo(
    () => activityWeekdaySeries.reduce<{ label: string; value: number } | null>((peak, point) => {
      if (!peak || point.value > peak.value) return point;
      return peak;
    }, null),
    [activityWeekdaySeries]
  );
  const activePresenceSignals = useMemo(
    () => getRecentValidDates(users.map((user) => user.lastSeenAt), overviewRangeDays).length,
    [overviewRangeDays, users]
  );
  const activeUsersInRange = activePresenceSignals;

  const selectedMarketer = useMemo(
    () => (selectedMarketerId ? marketers.find((m) => m.id === selectedMarketerId) : null),
    [marketers, selectedMarketerId]
  );

  const downloadCsv = (filename: string, rows: string[][]) => {
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportSupportTickets = () => {
    const rows: string[][] = [
      ['Type', 'Status', 'Reporter Name', 'Reporter Email', 'Subject', 'Message', 'Replies', 'Created At'],
      ...supportTickets.map((ticket) => [
        ticket.type,
        ticket.status,
        ticket.reporterName || '',
        ticket.reporterEmail || '',
        ticket.subject || '',
        ticket.message || '',
        String(ticket.replies?.length || 0),
        ticket.createdAt || '',
      ]),
    ];
    downloadCsv(`faithbliss-support-tickets-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    showSuccess('Support tickets exported.');
  };

  const exportPaymentRecords = () => {
    const rows: string[][] = [
      ['Name', 'Email', 'Product Type', 'Status', 'Plan', 'Billing Cycle', 'Region', 'Display Price', 'Charge Price', 'Reference', 'Updated At'],
      ...filteredPaymentRecords.map((record) => [
        record.name,
        record.email,
        getPaymentProductLabel(record),
        record.status,
        record.tier,
        getPaymentCycleLabel(record),
        record.pricingRegion,
        formatMoney(record.displayAmountMajor, record.displayCurrency),
        formatMoney(record.chargeAmountMajor, record.chargeCurrency),
        record.reference,
        record.updatedAt || '',
      ]),
    ];
    downloadCsv(`faithbliss-payment-records-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    showSuccess('Payment records exported.');
  };

  const filteredPaymentRecords = useMemo(() => {
    const records = paymentAnalytics?.records || [];
    const normalizedSearch = paymentSearch.trim().toLowerCase();

    const filtered = records.filter((record) => {
      if (paymentProductFilter !== 'all' && record.productType !== paymentProductFilter) return false;
      if (paymentStatusFilter !== 'all' && record.status !== paymentStatusFilter) return false;
      if (paymentTierFilter !== 'all' && record.tier !== paymentTierFilter) return false;
      if (paymentCycleFilter !== 'all' && record.billingCycle !== paymentCycleFilter) return false;

      if (!normalizedSearch) return true;

      const haystack = [
        record.name,
        record.email,
        record.reference,
        record.productType,
        record.tier,
        record.status,
        record.pricingRegion,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });

    const sorted = [...filtered];
    sorted.sort((left, right) => {
      if (paymentSort === 'name-az') {
        return left.name.localeCompare(right.name);
      }
      if (paymentSort === 'amount-high') {
        return right.chargeAmountMajor - left.chargeAmountMajor;
      }
      if (paymentSort === 'amount-low') {
        return left.chargeAmountMajor - right.chargeAmountMajor;
      }

      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
      const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
      return paymentSort === 'oldest' ? leftTime - rightTime : rightTime - leftTime;
    });

    return sorted;
  }, [
    paymentAnalytics?.records,
    paymentProductFilter,
    paymentCycleFilter,
    paymentSearch,
    paymentSort,
    paymentStatusFilter,
    paymentTierFilter,
  ]);

  const openEditor = (user: User) => {
    const editable = toEditableUser(user);
    setSelectedUser(editable);
    setEditingUser(editable);
  };

  const openMarketerCustomers = async (marketerId: string) => {
    setSelectedMarketerId(marketerId);
    setMarketerCustomersLoading(true);
    setMarketerCustomersModalOpen(true);

    try {
      const response = await API.User.getMarketerCustomers(marketerId);
      setMarketerCustomers(response.users || []);
    } catch (err) {
      console.error('Failed to load marketer customers', err);
      showError('Unable to load marketer customers right now.');
      setMarketerCustomers([]);
    } finally {
      setMarketerCustomersLoading(false);
    }
  };

  const closeEditor = () => {
    if (saving || deletingUser || resettingPassword) return;
    setSelectedUser(null);
    setEditingUser(null);
  };

  const updateEditingField = <K extends keyof EditableUser>(field: K, value: EditableUser[K]) => {
    setEditingUser((current) => (current ? { ...current, [field]: value } : current));
  };

  const handleSave = async () => {
    if (!selectedUser || !editingUser) return;

    const payload: AdminUpdateUserPayload = {
      name: editingUser.name.trim(),
      email: editingUser.email.trim().toLowerCase(),
      role: isAdminRole(selectedUser.role) ? undefined : normalizeEditableRole(editingUser.role),
      age: Number(editingUser.age),
      gender: editingUser.gender,
      preferredGender: editingUser.preferredGender,
      location: editingUser.location.trim(),
      bio: editingUser.bio.trim(),
      denomination: editingUser.denomination.trim(),
      onboardingCompleted: Boolean(editingUser.onboardingCompleted),
      isActive: Boolean(editingUser.isActive),
      subscriptionStatus: editingUser.subscriptionStatus,
      subscriptionTier: editingUser.subscriptionTier,
      subscriptionBillingCycle: editingUser.subscriptionBillingCycle,
    };

    try {
      setSaving(true);
      const response = await API.User.adminUpdateUser(selectedUser.id, payload);
      showSuccess(response.message || 'User updated successfully.');
      await refetch();
      const refreshed = toEditableUser(response.user);
      setSelectedUser(refreshed);
      setEditingUser(refreshed);
    } catch (saveError) {
      const message =
        saveError instanceof Error && saveError.message
          ? saveError.message
          : 'Failed to update user.';
      showError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;

    try {
      setResettingPassword(true);
      const response = await API.User.adminResetPassword(selectedUser.id);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(response.resetLink);
        showSuccess('Password reset link generated and copied to clipboard.');
      } else {
        showInfo(response.resetLink, 'Password reset link');
      }
    } catch (resetError) {
      const message =
        resetError instanceof Error && resetError.message
          ? resetError.message
          : 'Failed to generate password reset link.';
      showError(message);
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    const confirmed = window.confirm(`Delete ${selectedUser.name || selectedUser.email}? This removes the account permanently.`);
    if (!confirmed) return;

    try {
      setDeletingUser(true);
      const response = await API.User.adminDeleteUser(selectedUser.id);
      showSuccess(response.message || 'User deleted successfully.');
      closeEditor();
      await refetch();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error && deleteError.message
          ? deleteError.message
          : 'Failed to delete user.';
      showError(message);
    } finally {
      setDeletingUser(false);
    }
  };

  const handleTogglePassportMode = async () => {
    try {
      setFeatureSaving(true);
      const response = await API.User.updateFeatureSettings({
        passportModeEnabled: !passportModeEnabled,
      });
      setPassportModeEnabled(Boolean(response.passportModeEnabled));
      broadcastFeatureSettingsUpdate(response);
      showSuccess(response.message || 'Feature settings updated.');
    } catch (toggleError) {
      const message =
        toggleError instanceof Error && toggleError.message
          ? toggleError.message
          : 'Failed to update Passport Mode.';
      showError(message);
    } finally {
      setFeatureSaving(false);
    }
  };

  const reloadPaymentAnalytics = async () => {
    const paymentsResponse = await API.Payment.getAdminAnalytics();
    setPaymentAnalytics(paymentsResponse);
  };

  const handleDeletePaymentRecord = async (record: NonNullable<typeof paymentAnalytics>['records'][number]) => {
    const userLabel = record.name || record.email;
    const confirmed = window.confirm(
      `Delete the stored ${getPaymentProductLabel(record).toLowerCase()} record for ${userLabel}?`
    );
    if (!confirmed) return;

    try {
      setDeletingPaymentUserId(`${record.userId}:${record.reference || record.productType}`);
      const response = await API.Payment.deleteAdminRecord(record.userId, {
        productType: record.productType,
        reference: record.reference || undefined,
      });
      await reloadPaymentAnalytics();
      await refetch();
      showSuccess(response.message || 'Payment record deleted successfully.');
    } catch (deleteError) {
      const message =
        deleteError instanceof Error && deleteError.message
          ? deleteError.message
          : 'Failed to delete payment record.';
      showError(message);
    } finally {
      setDeletingPaymentUserId(null);
    }
  };

  const formatReportedAt = (value: string | null) => {
    if (!value) return 'Unknown time';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Unknown time';
    return parsed.toLocaleString();
  };

  const formatMoney = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'NGN',
        maximumFractionDigits: currency === 'NGN' ? 0 : 2,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toLocaleString()}`;
    }
  };

  const getPaymentProductLabel = (record: NonNullable<typeof paymentAnalytics>['records'][number]) =>
    record.productType === 'profile_booster' ? 'Booster Purchase' : 'Subscription';

  const getPaymentCycleLabel = (record: NonNullable<typeof paymentAnalytics>['records'][number]) => {
    if (record.productType === 'profile_booster' || record.billingCycle === 'one_time') {
      return 'One-time';
    }
    return record.billingCycle === 'quarterly' ? '3-Month' : 'Monthly';
  };

  const handleReplyDraftChange = (ticketId: string, value: string) => {
    setReplyDrafts((current) => ({ ...current, [ticketId]: value }));
  };

  const handleReplyToTicket = async (ticketId: string) => {
    const message = replyDrafts[ticketId]?.trim() || '';
    if (!message) {
      showError('Reply message is required.');
      return;
    }

    try {
      setReplyingTicketId(ticketId);
      const response = await API.Support.replyToTicket(ticketId, { message });
      setSupportTickets((current) =>
        current.map((ticket) =>
          ticket.id === ticketId
            ? {
                ...ticket,
                status: 'RESPONDED',
                replies: [...(ticket.replies || []), response.reply],
              }
            : ticket
        )
      );
      setReplyDrafts((current) => ({ ...current, [ticketId]: '' }));
      showSuccess(response.message || 'Reply sent successfully.');
    } catch (replyError) {
      const message =
        replyError instanceof Error && replyError.message
          ? replyError.message
          : 'Failed to send support reply.';
      showError(message);
    } finally {
      setReplyingTicketId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.18),_transparent_40%),linear-gradient(135deg,#020617,#0f172a_45%,#111827)] px-2 py-4 text-white sm:px-6 sm:py-8 lg:px-12">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-5 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Admin</p>
            <h1 className="mt-2 text-xl font-semibold text-white sm:text-3xl">FaithBliss Admin Console</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-300">Full platform access for account management, support handling, feature control, and subscription administration.</p>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>

        <div className="-mx-2 overflow-x-auto px-2 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-max snap-x snap-mandatory grid-flow-col gap-3 sm:min-w-0 sm:grid-flow-row sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
          <div className="w-[78vw] max-w-[280px] snap-start rounded-3xl border border-white/10 bg-white/5 p-4 sm:w-auto sm:max-w-none sm:p-5">
            <div className="flex items-center gap-3 text-cyan-200">
              <Users className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.22em]">Total users</span>
            </div>
            <p className="mt-4 text-3xl font-semibold text-white">{stats.total}</p>
          </div>
          <div className="w-[78vw] max-w-[280px] snap-start rounded-3xl border border-white/10 bg-white/5 p-4 sm:w-auto sm:max-w-none sm:p-5">
            <div className="flex items-center gap-3 text-emerald-200">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.22em]">Admins</span>
            </div>
            <p className="mt-4 text-3xl font-semibold text-white">{stats.admins}</p>
          </div>
          <div className="w-[78vw] max-w-[280px] snap-start rounded-3xl border border-white/10 bg-white/5 p-4 sm:w-auto sm:max-w-none sm:p-5">
            <div className="flex items-center gap-3 text-yellow-200">
              <Crown className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.22em]">Active premium</span>
            </div>
            <p className="mt-4 text-3xl font-semibold text-white">{stats.premium}</p>
          </div>
          <div className="w-[78vw] max-w-[280px] snap-start rounded-3xl border border-white/10 bg-white/5 p-4 sm:w-auto sm:max-w-none sm:p-5">
            <div className="flex items-center gap-3 text-pink-200">
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.22em]">Completed onboarding</span>
            </div>
            <p className="mt-4 text-3xl font-semibold text-white">{stats.completedOnboarding}</p>
          </div>
          <div className="w-[78vw] max-w-[280px] snap-start rounded-3xl border border-white/10 bg-white/5 p-4 sm:w-auto sm:max-w-none sm:p-5">
            <div className="flex items-center gap-3 text-orange-200">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.22em]">Support inbox</span>
            </div>
            <p className="mt-4 text-3xl font-semibold text-white">{stats.tickets}</p>
          </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-white/10 bg-white/5 p-3 lg:sticky lg:top-8 lg:h-fit">
            <p className="px-3 text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">Admin navigation</p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:block lg:space-y-2">
              <button
                type="button"
                onClick={() => setActiveSection('overview')}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                  activeSection === 'overview' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-black/20 text-gray-200 hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Activity className="h-4 w-4" />
                  <span className="font-medium">Overview</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('users')}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                  activeSection === 'users' ? 'bg-cyan-500/15 text-cyan-200' : 'bg-black/20 text-gray-200 hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Users className="h-4 w-4" />
                  <span className="font-medium">User directory</span>
                </span>
                <span className="text-xs text-gray-400">{stats.total}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('marketers')}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                  activeSection === 'marketers' ? 'bg-purple-500/15 text-purple-200' : 'bg-black/20 text-gray-200 hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Crown className="h-4 w-4" />
                  <span className="font-medium">Marketers</span>
                </span>
                <span className="text-xs text-gray-400">
                  {marketersLoading ? '...' : marketers.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('payments')}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                  activeSection === 'payments' ? 'bg-yellow-500/15 text-yellow-200' : 'bg-black/20 text-gray-200 hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-3">
                  <CircleDollarSign className="h-4 w-4" />
                  <span className="font-medium">Payments</span>
                </span>
                <span className="text-xs text-gray-400">{stats.paymentRecords}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('reports')}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                  activeSection === 'reports' ? 'bg-orange-500/15 text-orange-200' : 'bg-black/20 text-gray-200 hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Support inbox</span>
                </span>
                <span className="text-xs text-gray-400">{stats.tickets}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('features')}
                className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                  activeSection === 'features' ? 'bg-violet-500/15 text-violet-200' : 'bg-black/20 text-gray-200 hover:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-3">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span className="font-medium">Feature control</span>
                </span>
              </button>
            </div>
          </aside>

          <div className="space-y-6">
            {activeSection === 'overview' ? (
              <div className="space-y-6">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">Overview</p>
                      <h2 className="mt-2 text-xl font-semibold text-white">Platform operations dashboard</h2>
                      <p className="mt-2 max-w-3xl text-sm text-gray-400">
                        A consolidated view of user growth, support load, subscription activity, feature status, and live platform movement.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-300">
                      <div>
                        Passport Mode:{' '}
                        <span className={passportModeEnabled ? 'font-semibold text-emerald-200' : 'font-semibold text-gray-200'}>
                          {featureLoading ? 'Loading...' : passportModeEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {[7, 30, 90].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setOverviewRangeDays(days as 7 | 30 | 90)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                          overviewRangeDays === days
                            ? 'bg-emerald-500/15 text-emerald-200'
                            : 'bg-black/20 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Active users in range</p>
                      <p className="mt-3 text-3xl font-semibold text-white">
                        {platformStatsLoading ? '...' : activeUsersInRange}
                      </p>
                      <p className="mt-2 text-sm text-gray-400">
                        Users with recorded presence in the last {overviewRangeDays} days.
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Total matches</p>
                      <p className="mt-3 text-3xl font-semibold text-white">
                        {platformStatsLoading ? '...' : platformStats?.totalMatches ?? 0}
                      </p>
                      <p className="mt-2 text-sm text-gray-400">Total mutual connections recorded across the app.</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Active boosts</p>
                      <p className="mt-3 text-3xl font-semibold text-white">
                        {platformStatsLoading ? '...' : platformStats?.activeBoosts ?? 0}
                      </p>
                      <p className="mt-2 text-sm text-gray-400">Profiles currently being prioritised by a live booster.</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Open support tickets</p>
                      <p className="mt-3 text-3xl font-semibold text-white">{overviewStats.openTickets}</p>
                      <p className="mt-2 text-sm text-gray-400">Tickets still waiting for admin response.</p>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Active subscriptions</p>
                      <p className="mt-3 text-3xl font-semibold text-white">{paymentAnalytics?.summary.activeSubscriptions ?? 0}</p>
                      <p className="mt-2 text-sm text-gray-400">Users currently holding active premium access.</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <h3 className="text-lg font-semibold text-white">User health</h3>
                    <div className="mt-4 space-y-3 text-sm text-gray-200">
                      <div className="flex items-center justify-between"><span>Active accounts</span><span className="font-semibold text-white">{overviewStats.activeUsers}</span></div>
                      <div className="flex items-center justify-between"><span>Inactive accounts</span><span className="font-semibold text-white">{overviewStats.inactiveUsers}</span></div>
                      <div className="flex items-center justify-between"><span>Online right now</span><span className="font-semibold text-white">{overviewStats.onlineUsers}</span></div>
                      <div className="flex items-center justify-between"><span>Free users</span><span className="font-semibold text-white">{overviewStats.freeUsers}</span></div>
                      <div className="flex items-center justify-between"><span>Pending subscriptions</span><span className="font-semibold text-white">{overviewStats.pendingSubscriptions}</span></div>
                      <div className="flex items-center justify-between"><span>Active boosts</span><span className="font-semibold text-white">{platformStats?.activeBoosts ?? 0}</span></div>
                      <div className="flex items-center justify-between"><span>Male users</span><span className="font-semibold text-white">{overviewStats.maleUsers}</span></div>
                      <div className="flex items-center justify-between"><span>Female users</span><span className="font-semibold text-white">{overviewStats.femaleUsers}</span></div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <h3 className="text-lg font-semibold text-white">Support activity</h3>
                    <div className="mt-4 space-y-3 text-sm text-gray-200">
                      <div className="flex items-center justify-between"><span>Open tickets</span><span className="font-semibold text-white">{overviewStats.openTickets}</span></div>
                      <div className="flex items-center justify-between"><span>Responded tickets</span><span className="font-semibold text-white">{overviewStats.respondedTickets}</span></div>
                      <div className="flex items-center justify-between"><span>Help requests</span><span className="font-semibold text-white">{overviewStats.helpTickets}</span></div>
                      <div className="flex items-center justify-between"><span>Reported issues</span><span className="font-semibold text-white">{overviewStats.reportTickets}</span></div>
                      <div className="flex items-center justify-between"><span>Support inbox total</span><span className="font-semibold text-white">{stats.tickets}</span></div>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <h3 className="text-lg font-semibold text-white">Subscription mix</h3>
                    <div className="mt-4 space-y-3 text-sm text-gray-200">
                      <div className="flex items-center justify-between"><span>Monthly plans</span><span className="font-semibold text-white">{overviewStats.monthlySubscriptions}</span></div>
                      <div className="flex items-center justify-between"><span>3-Month plans</span><span className="font-semibold text-white">{overviewStats.quarterlySubscriptions}</span></div>
                      <div className="flex items-center justify-between"><span>Tracked payment records</span><span className="font-semibold text-white">{stats.paymentRecords}</span></div>
                      <div className="flex items-center justify-between"><span>Active charge volume</span><span className="font-semibold text-white">{formatMoney(paymentAnalytics?.summary.activeChargeVolumeNgn ?? 0, 'NGN')}</span></div>
                      <div className="flex items-center justify-between"><span>Tracked charge volume</span><span className="font-semibold text-white">{formatMoney(paymentAnalytics?.summary.trackedChargeVolumeNgn ?? 0, 'NGN')}</span></div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white">Recent support activity</h3>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={exportSupportTickets}
                          className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-gray-200 transition hover:bg-white/10"
                        >
                          Export CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSection('reports')}
                          className="rounded-full border border-orange-400/25 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-200 transition hover:bg-orange-500/20"
                        >
                          Open inbox
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {recentTickets.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-gray-400">No support activity yet.</div>
                      ) : (
                        recentTickets.map((ticket) => (
                          <div key={ticket.id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-white">{ticket.subject || 'No subject provided'}</p>
                              <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-gray-300">{ticket.status}</span>
                            </div>
                            <p className="mt-1 truncate text-xs text-gray-400">{ticket.reporterEmail || 'Unknown reporter'}</p>
                            <p className="mt-2 line-clamp-2 text-sm text-gray-300">{ticket.message}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-white">Recent payment activity</h3>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={exportPaymentRecords}
                          className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-gray-200 transition hover:bg-white/10"
                        >
                          Export CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSection('payments')}
                          className="rounded-full border border-yellow-400/25 bg-yellow-500/10 px-3 py-1.5 text-xs font-semibold text-yellow-200 transition hover:bg-yellow-500/20"
                        >
                          Open payments
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {recentPayments.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-gray-400">No subscription records yet.</div>
                      ) : (
                        recentPayments.map((record) => (
                          <div key={`${record.userId}-${record.reference}`} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-white">{record.name || record.email}</p>
                              <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-gray-300">{record.status}</span>
                            </div>
                            <p className="mt-1 truncate text-xs text-gray-400">{record.email}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-300">
                              <span>{getPaymentProductLabel(record)}</span>
                              <span>•</span>
                              <span>{getPaymentCycleLabel(record)}</span>
                              <span>•</span>
                              <span>{formatMoney(record.chargeAmountMajor, record.chargeCurrency)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Peak activity window</h3>
                        <p className="mt-1 text-sm text-gray-400">
                          Based on recorded user presence during the last {overviewRangeDays} days.
                        </p>
                      </div>
                      <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200">
                        {activePresenceSignals} signals
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Busiest hour</p>
                        <p className="mt-2 text-2xl font-semibold text-white">
                          {peakHour && peakHour.value > 0 ? peakHour.label : 'No activity yet'}
                        </p>
                        <p className="mt-1 text-sm text-gray-400">
                          {peakHour && peakHour.value > 0
                            ? `${peakHour.value} recorded presence update${peakHour.value === 1 ? '' : 's'}`
                            : 'No recorded presence updates in the selected range.'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Busiest day</p>
                        <p className="mt-2 text-2xl font-semibold text-white">
                          {peakWeekday && peakWeekday.value > 0 ? peakWeekday.label : 'No activity yet'}
                        </p>
                        <p className="mt-1 text-sm text-gray-400">
                          {peakWeekday && peakWeekday.value > 0
                            ? `${peakWeekday.value} recorded presence update${peakWeekday.value === 1 ? '' : 's'}`
                            : 'No recorded presence updates in the selected range.'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <LineTrendCard
                    title="User growth"
                    subtitle={`New user profiles created over the last ${overviewRangeDays} days.`}
                    data={userGrowthSeries}
                    accentClass="stroke-cyan-400"
                  />
                  <LineTrendCard
                    title="Payment trend"
                    subtitle={`Subscription payment updates tracked over the last ${overviewRangeDays} days.`}
                    data={paymentTrendSeries}
                    accentClass="stroke-amber-400"
                  />
                  <LineTrendCard
                    title="Support volume"
                    subtitle={`Help and report tickets created over the last ${overviewRangeDays} days.`}
                    data={supportVolumeSeries}
                    accentClass="stroke-fuchsia-400"
                  />
                </div>

                <div className="grid gap-4 xl:grid-cols-3">
                  <LineTrendCard
                    title="Hourly activity"
                    subtitle={`Recorded presence distribution across the last ${overviewRangeDays} days.`}
                    data={activityHourlySeries}
                    accentClass="stroke-emerald-400"
                  />
                  <DonutBreakdownCard
                    title="Support ticket mix"
                    subtitle="Current distribution of support requests by type."
                    values={[
                      { label: 'Help requests', value: overviewStats.helpTickets },
                      { label: 'Reported issues', value: overviewStats.reportTickets },
                    ]}
                    colors={['#22d3ee', '#fb923c']}
                  />
                  <DonutBreakdownCard
                    title="Subscription cycle mix"
                    subtitle="Current distribution of active tracked billing cycles."
                    values={[
                      { label: 'Monthly', value: overviewStats.monthlySubscriptions },
                      { label: '3-Month', value: overviewStats.quarterlySubscriptions },
                    ]}
                    colors={['#e879f9', '#a855f7']}
                  />
                  <DonutBreakdownCard
                    title="Activity by weekday"
                    subtitle={`Which days users appear most often over the last ${overviewRangeDays} days.`}
                    values={activityWeekdaySeries}
                    colors={['#22d3ee', '#38bdf8', '#818cf8', '#a78bfa', '#e879f9', '#f97316', '#facc15']}
                  />
                </div>
              </div>
            ) : null}

            {activeSection === 'features' ? (
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200">Feature control</p>
                      <h2 className="mt-2 text-xl font-semibold text-white">Passport Mode</h2>
                      <p className="mt-2 max-w-2xl text-sm text-gray-400">
                        Controls whether premium users can target any country and be discoverable only within that selected country.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="text-right">
                        <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Status</p>
                        <p className={`text-sm font-semibold ${passportModeEnabled ? 'text-emerald-300' : 'text-slate-300'}`}>
                          {featureLoading ? 'Loading...' : passportModeEnabled ? 'Enabled' : 'Disabled'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleTogglePassportMode()}
                        disabled={featureLoading || featureSaving}
                        className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition ${
                          passportModeEnabled
                            ? 'bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/20'
                            : 'bg-violet-500/15 text-violet-200 hover:bg-violet-500/20'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {featureSaving
                          ? 'Updating...'
                          : passportModeEnabled
                            ? 'Disable Passport Mode'
                            : 'Enable Passport Mode'}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            ) : null}

            {activeSection === 'users' ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">User directory</h2>
                    <p className="mt-1 text-sm text-gray-400">All users, including admins and incomplete profiles. Edit any user from one control point.</p>
                  </div>

                  <label className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 lg:max-w-md">
                    <Search className="h-4 w-4 text-gray-400" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by name, email, or location"
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                    />
                  </label>
                </div>

                {loading ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-gray-300">
                    Loading admin data...
                  </div>
                ) : error ? (
                  <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-6 text-sm text-red-200">
                    {error}
                  </div>
                ) : users.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-gray-300">
                    No users available.
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 lg:hidden">
                      {users.map((user) => (
                        <div key={user.id} className="rounded-[1.75rem] border border-white/10 bg-black/20 p-4 shadow-[0_12px_30px_rgba(2,6,23,0.32)]">
                          <div className="flex flex-col gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-base font-semibold text-white">{user.name}</p>
                              <p className="truncate text-xs text-gray-400">{user.email}</p>
                            </div>
                            <button
                              onClick={() => openEditor(user)}
                              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                              Edit User
                            </button>
                          </div>

                          <div className="mt-4 grid gap-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Role</p>
                                <p className="mt-1 text-sm text-white">{getRoleSummaryLabel(user)}</p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Status</p>
                                <p className={`mt-1 text-sm font-medium ${user.isActive === false ? 'text-red-200' : 'text-emerald-200'}`}>
                                  {user.isActive === false ? 'Inactive' : 'Active'}
                                </p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Plan</p>
                                <p className={`mt-1 text-sm font-medium ${user.subscriptionStatus === 'active' ? 'text-yellow-200' : 'text-gray-200'}`}>
                                  {user.subscriptionStatus === 'active' ? 'Premium' : 'Free'}
                                </p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Location</p>
                                <p className="mt-1 line-clamp-2 text-sm text-white">{user.location || 'Unknown'}</p>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Survey status</p>
                                <p className="mt-1 line-clamp-2 text-sm text-white">
                                  {user.postPaymentSurvey
                                    ? user.postPaymentSurvey.contacted
                                      ? user.postPaymentSurvey.marketerName || 'Yes (unknown)'
                                      : 'No'
                                    : 'Not answered'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="hidden overflow-x-auto rounded-2xl border border-white/10 lg:block">
                    <div className="min-w-[980px]">
                      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 bg-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-300">
                        <span>User</span>
                        <span>Role</span>
                        <span>Status</span>
                        <span>Plan</span>
                        <span>Location</span>
                        <span>Survey status</span>
                        <span>Action</span>
                      </div>
                      <div className="divide-y divide-white/10">
                        {users.map((user) => (
                          <div
                            key={user.id}
                            className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 px-4 py-4 text-sm text-gray-200"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-white">{user.name}</p>
                              <p className="truncate text-xs text-gray-400">{user.email}</p>
                            </div>
                            <div>
                              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white">
                                {getRoleSummaryLabel(user)}
                              </span>
                            </div>
                            <div>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                user.isActive === false ? 'bg-red-500/15 text-red-200' : 'bg-emerald-500/15 text-emerald-200'
                              }`}>
                                {user.isActive === false ? 'Inactive' : 'Active'}
                              </span>
                            </div>
                            <div>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                user.subscriptionStatus === 'active'
                                  ? 'bg-yellow-500/15 text-yellow-200'
                                  : 'bg-white/10 text-gray-300'
                              }`}>
                                {user.subscriptionStatus === 'active' ? 'Premium' : 'Free'}
                              </span>
                            </div>
                            <div className="truncate text-gray-300">{user.location || 'Unknown'}</div>
                            <div className="truncate text-gray-300">
                              {user.postPaymentSurvey
                                ? user.postPaymentSurvey.contacted
                                  ? user.postPaymentSurvey.marketerName || 'Yes (unknown)'
                                  : 'No'
                                : 'Not answered'}
                            </div>
                            <div className="flex justify-end">
                              <button
                                onClick={() => openEditor(user)}
                                className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                              >
                                <PencilLine className="h-3.5 w-3.5" />
                                Edit
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  </>
                )}
              </div>
            ) : null}

            {activeSection === 'marketers' ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
                <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Marketers</h2>
                    <p className="mt-1 text-sm text-gray-400">View which marketers have contacted users and how many leads they’ve referred.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/10 px-3 py-2 text-xs text-gray-300">
                      {marketersLoading ? 'Loading…' : `${marketers.length} marketers`}
                    </span>
                  </div>
                </div>

                {marketersLoading ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-gray-300">
                    Loading marketers...
                  </div>
                ) : marketers.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-gray-300">
                    No marketers found.
                  </div>
                ) : (
                  <>
                    <div className="space-y-3 lg:hidden">
                      {marketers.map((marketer) => (
                        <div key={marketer.id} className="rounded-[1.75rem] border border-white/10 bg-black/20 p-4 shadow-[0_12px_30px_rgba(2,6,23,0.32)]">
                          <div className="flex flex-col gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-base font-semibold text-white">{marketer.name}</p>
                              <p className="truncate text-xs text-gray-400">{marketer.email}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300">
                                {marketer.marketedCount ?? 0} leads
                              </span>
                              <button
                                onClick={() => openMarketerCustomers(marketer.id)}
                                className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                              >
                                See all
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden overflow-x-auto rounded-2xl border border-white/10 lg:block">
                      <div className="min-w-[860px]">
                        <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] gap-4 bg-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-300">
                          <span>Marketer</span>
                          <span>Leads referred</span>
                          <span>Action</span>
                        </div>
                        <div className="divide-y divide-white/10">
                          {marketers.map((marketer) => (
                            <div key={marketer.id} className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto] gap-4 px-4 py-4 text-sm text-gray-200">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-white">{marketer.name}</p>
                                <p className="truncate text-xs text-gray-400">{marketer.email}</p>
                              </div>
                              <div className="truncate text-gray-200">{marketer.marketedCount ?? 0}</div>
                              <div className="flex justify-end">
                                <button
                                  onClick={() => openMarketerCustomers(marketer.id)}
                                  className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                                >
                                  See all
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {activeSection === 'payments' ? (
                <div className="space-y-4 sm:space-y-6">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
                  <div className="mb-5">
                    <h2 className="text-xl font-semibold text-white">Subscription payments</h2>
                    <p className="mt-1 text-sm text-gray-400">
                      Monitor active subscriptions, tracked charge volume, billing cycles, and recent subscription records.
                    </p>
                  </div>

                  {paymentsLoading ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-gray-300">
                      Loading payment analytics...
                    </div>
                  ) : !paymentAnalytics ? (
                    <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-6 text-sm text-red-200">
                      Failed to load payment analytics.
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
                          <div className="min-w-0 rounded-3xl border border-white/10 bg-black/20 p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Active subscriptions</p>
                            <p className="mt-3 text-3xl font-semibold text-white">{paymentAnalytics.summary.activeSubscriptions}</p>
                          </div>
                          <div className="min-w-0 rounded-3xl border border-white/10 bg-black/20 p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Pending subscriptions</p>
                            <p className="mt-3 text-3xl font-semibold text-white">{paymentAnalytics.summary.pendingSubscriptions}</p>
                          </div>
                          <div className="min-w-0 rounded-3xl border border-white/10 bg-black/20 p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Active NGN volume</p>
                            <p className="mt-3 break-words text-3xl font-semibold text-white">
                              {formatMoney(paymentAnalytics.summary.activeChargeVolumeNgn, 'NGN')}
                            </p>
                          </div>
                          <div className="min-w-0 rounded-3xl border border-white/10 bg-black/20 p-5">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Tracked NGN volume</p>
                            <p className="mt-3 break-words text-3xl font-semibold text-white">
                              {formatMoney(paymentAnalytics.summary.trackedChargeVolumeNgn, 'NGN')}
                            </p>
                          </div>
                      </div>

                      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Billing cycles</p>
                          <div className="mt-4 space-y-3">
                            <div className="flex items-center justify-between text-sm text-gray-200">
                              <span>Monthly</span>
                              <span className="font-semibold text-white">{paymentAnalytics.summary.monthlyPlans}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm text-gray-200">
                              <span>Quarterly</span>
                              <span className="font-semibold text-white">{paymentAnalytics.summary.quarterlyPlans}</span>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Status breakdown</p>
                          <div className="mt-4 space-y-3">
                            {Object.entries(paymentAnalytics.breakdowns.status).map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between text-sm text-gray-200">
                                <span className="capitalize">{key}</span>
                                <span className="font-semibold text-white">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Region breakdown</p>
                          <div className="mt-4 space-y-3">
                            {Object.entries(paymentAnalytics.breakdowns.region).map(([key, value]) => (
                              <div key={key} className="flex items-center justify-between text-sm text-gray-200">
                                <span className="capitalize">{key}</span>
                                <span className="font-semibold text-white">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-5">
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-white">Recent payment records</h3>
                            <p className="mt-1 text-sm text-gray-400">Latest subscription and booster purchases tracked across all users.</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300">
                              {filteredPaymentRecords.length} of {paymentAnalytics.records.length} records
                            </span>
                            <button
                              type="button"
                              onClick={exportPaymentRecords}
                              className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-gray-200 transition hover:bg-white/10"
                            >
                              Export CSV
                            </button>
                          </div>
                        </div>

                        <div className="mb-4 grid gap-3 min-[560px]:grid-cols-2 xl:grid-cols-5">
                          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 min-[560px]:col-span-2 xl:col-span-2">
                            <Search className="h-4 w-4 shrink-0 text-gray-400" />
                            <input
                              value={paymentSearch}
                              onChange={(event) => setPaymentSearch(event.target.value)}
                              placeholder="Search by user, email, or reference"
                              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                            />
                          </label>
                          <select
                            value={paymentProductFilter}
                            onChange={(event) => setPaymentProductFilter(event.target.value as typeof paymentProductFilter)}
                            className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none"
                          >
                            <option value="all">All products</option>
                            <option value="subscription">Subscriptions</option>
                            <option value="profile_booster">Booster purchases</option>
                          </select>
                          <select
                            value={paymentStatusFilter}
                            onChange={(event) => setPaymentStatusFilter(event.target.value as typeof paymentStatusFilter)}
                            className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none"
                          >
                            <option value="all">All statuses</option>
                            <option value="active">Active</option>
                            <option value="paid">Paid</option>
                            <option value="pending">Pending</option>
                            <option value="inactive">Inactive</option>
                            <option value="unknown">Unknown</option>
                          </select>
                          <select
                            value={paymentTierFilter}
                            onChange={(event) => setPaymentTierFilter(event.target.value as typeof paymentTierFilter)}
                            className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none"
                          >
                            <option value="all">All plans</option>
                            <option value="premium">Premium</option>
                            <option value="elite">Pro</option>
                            <option value="free">Free</option>
                            <option value="booster">Booster</option>
                          </select>
                          <select
                            value={paymentCycleFilter}
                            onChange={(event) => setPaymentCycleFilter(event.target.value as typeof paymentCycleFilter)}
                            className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none"
                          >
                            <option value="all">All cycles</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">3-Month</option>
                            <option value="one_time">One-time</option>
                          </select>
                          <select
                            value={paymentSort}
                            onChange={(event) => setPaymentSort(event.target.value as typeof paymentSort)}
                            className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none min-[560px]:col-span-2 xl:col-span-1"
                          >
                            <option value="latest">Sort: Latest</option>
                            <option value="oldest">Sort: Oldest</option>
                            <option value="amount-high">Sort: Amount high-low</option>
                            <option value="amount-low">Sort: Amount low-high</option>
                            <option value="name-az">Sort: Name A-Z</option>
                          </select>
                        </div>

                        {paymentAnalytics.records.length === 0 ? (
                          <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-6 text-sm text-gray-300">
                            No subscription records tracked yet.
                          </div>
                        ) : filteredPaymentRecords.length === 0 ? (
                          <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-6 text-sm text-gray-300">
                            No payment records match the current filters.
                          </div>
                        ) : (
                          <>
                            <div className="space-y-4 lg:hidden">
                              {filteredPaymentRecords.map((record) => (
                                <div key={`${record.userId}-${record.reference || record.updatedAt || record.email}`} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                                  <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
                                    <div className="min-w-0">
                                      <p className="truncate text-base font-semibold text-white">{record.name}</p>
                                      <p className="truncate text-xs text-gray-400">{record.email}</p>
                                    </div>
                                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                                      record.status === 'active'
                                        ? 'bg-emerald-500/15 text-emerald-200'
                                        : record.status === 'pending'
                                          ? 'bg-yellow-500/15 text-yellow-200'
                                          : 'bg-white/10 text-gray-300'
                                    }`}>
                                      {record.status}
                                    </span>
                                  </div>
                                  <div className="mt-4 grid gap-3 min-[420px]:grid-cols-2">
                                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Plan</p>
                                      <p className="mt-1 text-sm text-white capitalize">{getPaymentProductLabel(record)} • {getPaymentCycleLabel(record)}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Charge</p>
                                      <p className="mt-1 text-sm text-white">{formatMoney(record.chargeAmountMajor, record.chargeCurrency)}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Shown to user</p>
                                      <p className="mt-1 text-sm text-white">{formatMoney(record.displayAmountMajor, record.displayCurrency)}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Region</p>
                                      <p className="mt-1 text-sm text-white capitalize">{record.pricingRegion}</p>
                                    </div>
                                  </div>
                                  <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3 text-xs text-gray-300">
                                    <div className="grid gap-2 min-[420px]:grid-cols-3">
                                      <p className="break-all min-[420px]:col-span-3">Reference: {record.reference || 'N/A'}</p>
                                      <p>Updated: {formatReportedAt(record.updatedAt)}</p>
                                      <p className="min-[420px]:col-span-2">Next payment: {formatReportedAt(record.nextPaymentDate)}</p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeletePaymentRecord(record)}
                                    disabled={deletingPaymentUserId === `${record.userId}:${record.reference || record.productType}`}
                                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-red-400/25 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    {deletingPaymentUserId === `${record.userId}:${record.reference || record.productType}` ? 'Deleting...' : 'Delete payment record'}
                                  </button>
                                </div>
                              ))}
                            </div>

                            <div className="hidden overflow-x-auto rounded-2xl border border-white/10 lg:block">
                              <div className="min-w-[1260px]">
                                <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto] gap-4 bg-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-300">
                                  <span>User</span>
                                  <span>Plan</span>
                                  <span>Status</span>
                                  <span>Charge</span>
                                  <span>Shown price</span>
                                  <span>Reference</span>
                                  <span>Action</span>
                                </div>
                                <div className="divide-y divide-white/10">
                                  {filteredPaymentRecords.map((record) => (
                                    <div
                                      key={`${record.userId}-${record.reference || record.updatedAt || record.email}`}
                                      className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto] gap-4 px-4 py-4 text-sm text-gray-200"
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate font-semibold text-white">{record.name}</p>
                                        <p className="truncate text-xs text-gray-400">{record.email}</p>
                                      </div>
                                      <div className="text-sm capitalize text-white">{getPaymentProductLabel(record)} • {getPaymentCycleLabel(record)}</div>
                                      <div>
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                          record.status === 'active'
                                            ? 'bg-emerald-500/15 text-emerald-200'
                                            : record.status === 'pending'
                                              ? 'bg-yellow-500/15 text-yellow-200'
                                              : 'bg-white/10 text-gray-300'
                                        }`}>
                                          {record.status}
                                        </span>
                                      </div>
                                      <div className="text-white">{formatMoney(record.chargeAmountMajor, record.chargeCurrency)}</div>
                                      <div className="text-gray-300">{formatMoney(record.displayAmountMajor, record.displayCurrency)}</div>
                                      <div className="min-w-0">
                                        <p className="truncate text-white">{record.reference || 'N/A'}</p>
                                        <p className="truncate text-xs text-gray-400">{formatReportedAt(record.updatedAt)}</p>
                                      </div>
                                      <div className="flex justify-end">
                                        <button
                                          type="button"
                                          onClick={() => void handleDeletePaymentRecord(record)}
                                          disabled={deletingPaymentUserId === `${record.userId}:${record.reference || record.productType}`}
                                          className="inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          {deletingPaymentUserId === `${record.userId}:${record.reference || record.productType}` ? 'Deleting...' : 'Delete'}
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {activeSection === 'reports' ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 sm:p-6">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Support inbox</h2>
                    <p className="mt-1 text-sm text-gray-400">All help and report tickets submitted by users. Review ticket type, reporter email, subject, and message content here.</p>
                  </div>
                  <button
                    type="button"
                    onClick={exportSupportTickets}
                    className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-gray-200 transition hover:bg-white/10"
                  >
                    Export CSV
                  </button>
                </div>

                {issuesLoading ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-gray-300">
                    Loading support tickets...
                  </div>
                ) : supportTickets.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-gray-300">
                    No support tickets submitted yet.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {supportTickets.map((issue) => (
                      <div key={issue.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${issue.type === 'REPORT' ? 'text-orange-200' : 'text-cyan-200'}`}>
                              {issue.type === 'REPORT' ? 'Reported issue' : 'Help & support'}
                            </p>
                            <h3 className="mt-2 text-lg font-semibold text-white">{issue.subject || 'No subject provided'}</h3>
                            <p className="mt-1 text-sm text-gray-400">{issue.reporterEmail || 'Unknown reporter email'}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                              issue.type === 'REPORT' ? 'bg-orange-500/15 text-orange-200' : 'bg-cyan-500/15 text-cyan-200'
                            }`}>
                              {issue.type}
                            </span>
                            <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-orange-200">
                              {issue.status}
                            </span>
                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300">
                              {formatReportedAt(issue.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-sm leading-6 text-gray-200">
                          {issue.message}
                        </div>
                        {Array.isArray(issue.replies) && issue.replies.length > 0 ? (
                          <div className="mt-4 space-y-3">
                            {issue.replies.map((reply, index) => (
                              <div key={`${issue.id}-reply-${index}`} className="rounded-2xl border border-cyan-400/15 bg-cyan-500/5 px-4 py-4">
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                                    Admin reply{reply.adminName ? ` • ${reply.adminName}` : ''}
                                  </p>
                                  <span className="text-xs text-gray-400">{formatReportedAt(reply.createdAt)}</span>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-gray-200">{reply.message}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Reply to user</p>
                          <textarea
                            value={replyDrafts[issue.id] || ''}
                            onChange={(event) => handleReplyDraftChange(issue.id, event.target.value)}
                            rows={3}
                            placeholder="Write a response that will be sent to the user."
                            className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500"
                          />
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              onClick={() => void handleReplyToTicket(issue.id)}
                              disabled={replyingTicketId === issue.id}
                              className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {replyingTicketId === issue.id ? 'Sending...' : 'Send reply'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {editingUser && selectedUser ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm">
          <div className="flex min-h-[100dvh] items-stretch justify-center p-0 sm:min-h-full sm:items-center sm:p-4">
            <div className="flex h-[100dvh] w-full max-w-3xl min-h-0 flex-col overflow-hidden border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,24,39,0.98))] text-white shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:rounded-[2rem]">
              <div className="shrink-0 border-b border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,24,39,0.98))] px-4 py-4 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Edit user</p>
                    <h2 className="mt-2 truncate text-2xl font-semibold text-white">{editingUser.name || editingUser.email}</h2>
                    <p className="mt-1 truncate text-sm text-gray-400">{editingUser.email}</p>
                  </div>
                  <button
                    onClick={closeEditor}
                    disabled={saving || deletingUser || resettingPassword}
                    className="shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Name</span>
                    <input value={editingUser.name} onChange={(e) => updateEditingField('name', e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Email</span>
                    <input value={editingUser.email} onChange={(e) => updateEditingField('email', e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Role</span>
                    {isAdminRole(selectedUser.role) ? (
                      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white">
                        <span>Admin</span>
                        <span className="rounded-full bg-yellow-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-yellow-200">
                          Locked
                        </span>
                      </div>
                    ) : (
                      <select
                        value={editingUser.role || 'user'}
                        onChange={(e) => updateEditingField('role', normalizeEditableRole(e.target.value))}
                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none"
                      >
                        <option value="user">User</option>
                        <option value="marketer">Marketer</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Age</span>
                    <input type="number" min={18} max={99} value={editingUser.age} onChange={(e) => updateEditingField('age', Number(e.target.value))} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Gender</span>
                    <select value={editingUser.gender} onChange={(e) => updateEditingField('gender', normalizeEditableGender(e.target.value))} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none">
                      <option value="MALE">MALE</option>
                      <option value="FEMALE">FEMALE</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Preferred Gender</span>
                    <select value={editingUser.preferredGender ?? ''} onChange={(e) => updateEditingField('preferredGender', normalizeEditablePreferredGender(e.target.value))} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none">
                      <option value="">Any</option>
                      <option value="MALE">MALE</option>
                      <option value="FEMALE">FEMALE</option>
                    </select>
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Denomination</span>
                    <input value={editingUser.denomination} onChange={(e) => updateEditingField('denomination', e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
                  </label>
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Location</span>
                    <input value={editingUser.location} onChange={(e) => updateEditingField('location', e.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
                  </label>
                  <label className="space-y-2 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Bio</span>
                    <textarea value={editingUser.bio} onChange={(e) => updateEditingField('bio', e.target.value)} rows={4} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none" />
                  </label>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <span className="text-sm text-white">Onboarding completed</span>
                    <input type="checkbox" checked={editingUser.onboardingCompleted} onChange={(e) => updateEditingField('onboardingCompleted', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-transparent" />
                  </label>
                  <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <span className="text-sm text-white">Account active</span>
                    <input type="checkbox" checked={editingUser.isActive !== false} onChange={(e) => updateEditingField('isActive', e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-transparent" />
                  </label>
                </div>

                <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-yellow-200">Subscription access</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Subscription status</span>
                      <select
                        value={editingUser.subscriptionStatus}
                        onChange={(e) => updateEditingField('subscriptionStatus', e.target.value as EditableUser['subscriptionStatus'])}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none"
                      >
                        <option value="inactive">Inactive</option>
                        <option value="pending">Pending</option>
                        <option value="active">Active</option>
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Subscription tier</span>
                      <select
                        value={editingUser.subscriptionTier}
                        onChange={(e) => updateEditingField('subscriptionTier', e.target.value as EditableUser['subscriptionTier'])}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none"
                      >
                        <option value="free">Free</option>
                        <option value="premium">Premium</option>
                        <option value="elite">Pro</option>
                      </select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Billing cycle</span>
                      <select
                        value={editingUser.subscriptionBillingCycle}
                        onChange={(e) => updateEditingField('subscriptionBillingCycle', e.target.value as EditableUser['subscriptionBillingCycle'])}
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-white outline-none"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">3-Month</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,24,39,0.98))] px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => void handleSave()}
                      disabled={saving || deletingUser || resettingPassword}
                      className="rounded-full bg-gradient-to-r from-pink-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? 'Saving...' : 'Save changes'}
                    </button>
                    <button
                      onClick={() => void handleResetPassword()}
                      disabled={saving || deletingUser || resettingPassword}
                      className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-5 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {resettingPassword ? 'Generating...' : 'Reset password'}
                    </button>
                    <button
                      onClick={() => void handleDeleteUser()}
                      disabled={saving || deletingUser || resettingPassword}
                      className="inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                      {deletingUser ? 'Deleting...' : 'Delete user'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">Password reset generates a Firebase reset link and copies it to your clipboard. Delete permanently removes the auth account and Firestore user record.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {marketerCustomersModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10 bg-gray-950/95 shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-gray-900/80 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Customers referred</h2>
                <p className="mt-1 text-sm text-gray-400">
                  {selectedMarketer ? selectedMarketer.name : 'Marketer'} — {marketerCustomers.length} customer{marketerCustomers.length === 1 ? '' : 's'}
                </p>
              </div>
              <button
                onClick={() => setMarketerCustomersModalOpen(false)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              {marketerCustomersLoading ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-gray-300">
                  Loading customers…
                </div>
              ) : marketerCustomers.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-gray-300">
                  No customers recorded for this marketer yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {marketerCustomers.map((customer) => (
                    <div key={customer.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-white">{customer.name}</p>
                          <p className="truncate text-xs text-gray-400">{customer.email}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300">
                            {customer.subscriptionStatus ? customer.subscriptionStatus : 'No subscription'}
                          </span>
                          {customer.location ? (
                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300">
                              {customer.location}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {customer.postPaymentSurvey?.submittedAt ? (
                        <p className="mt-3 text-xs text-gray-400">
                          Survey submitted: {formatTimestamp(customer.postPaymentSurvey.submittedAt) ?? 'Invalid date'}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminPage;
