// src/controllers/paymentController.ts

import { Request, Response } from 'express';
import crypto from 'crypto';
import * as admin from 'firebase-admin';
import { usersCollection } from '../config/firebase-admin';
import {
  disableSubscription as disablePaystackSubscription,
  enableSubscription as enablePaystackSubscription,
  getPlanDetails,
  initializeTransaction,
  verifyTransaction,
} from '../services/paystackService';
import { extractClientIp } from '../services/geoLocationService';
import {
  getRegionalPricingQuote,
  getRegionalProfileBoosterQuote,
  type BillingCycle,
  type PricingRegion,
} from '../services/regionalPricingService';
import {
  grantProfileBoosterForPayment,
  PROFILE_BOOST_PURCHASE_CREDITS,
} from '../utils/profileBooster';

type PlanTier = 'premium' | 'elite';
type Currency = 'NGN' | 'USD';
type PaymentCurrency = Currency | string;
type PublicPlan = {
  tier: PlanTier;
  name: string;
  amount: number;
  currency: PaymentCurrency;
  interval: 'monthly';
};
type StoredSubscription = {
  status?: string;
  tier?: string;
  currency?: string;
  billingCycle?: BillingCycle;
  pricingRegion?: PricingRegion;
  displayCurrency?: string;
  displayAmountMajor?: number;
  chargeAmountMajor?: number;
  chargeAmountSubunits?: number;
  exchangeRate?: number;
  planCode?: string | null;
  reference?: string;
  customerCode?: string;
  subscriptionCode?: string;
  subscriptionEmailToken?: string;
  authorizationCode?: string;
  customerEmail?: string;
  renewalProvider?: 'plan' | 'authorization';
  autoRenewEnabled?: boolean;
  autoRenewDisabledAt?: string;
  lastChargeAttemptAt?: string;
  nextPaymentDate?: string;
};

type StoredBoosterPurchase = {
  productType?: 'profile_booster';
  status?: string;
  tier?: string;
  billingCycle?: 'one_time';
  pricingRegion?: PricingRegion | string;
  displayCurrency?: string;
  displayAmountMajor?: number;
  chargeCurrency?: string;
  chargeAmountMajor?: number;
  chargeAmountSubunits?: number;
  exchangeRate?: number;
  reference?: string;
  customerCode?: string;
  authorizationCode?: string;
  updatedAt?: string | null;
};

type UserPricingContext = {
  countryCode?: string;
  location?: string;
};

type PaymentAnalyticsRecord = {
  userId: string;
  name: string;
  email: string;
  productType: PaymentProductType;
  status: string;
  tier: string;
  billingCycle: BillingCycle | 'monthly' | 'one_time';
  pricingRegion: string;
  displayCurrency: string;
  displayAmountMajor: number;
  chargeCurrency: string;
  chargeAmountMajor: number;
  chargeAmountSubunits: number;
  reference: string;
  planCode: string | null;
  customerCode: string;
  authorizationCode: string;
  nextPaymentDate: string | null;
  updatedAt: string | null;
};

type PaymentProductType = 'subscription' | 'profile_booster';
type ProfileBoosterBundleKey = 'single' | 'bundle';

const PRIMARY_ADMIN_EMAIL = process.env.PRIMARY_ADMIN_EMAIL ?? '';

const PLAN_METADATA: Record<PlanTier, { name: string }> = {
  premium: { name: 'Premium Plan' },
  elite: { name: 'Pro Plan' },
};
const PROFILE_BOOSTER_PRICE_USD = 7;
const PROFILE_BOOSTER_SINGLE_PRICE_USD = 4;

const normalizeProfileBoosterBundleKey = (value: unknown): ProfileBoosterBundleKey =>
  value === 'single' ? 'single' : 'bundle';

const normalizeProfileBoosterCredits = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.max(1, Math.floor(value));
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(1, Math.floor(parsed));
    }
  }

  return PROFILE_BOOST_PURCHASE_CREDITS;
};

const isAdminFromUserDoc = (userData: Record<string, any> | undefined): boolean => {
  const email = typeof userData?.email === 'string' ? userData.email.trim().toLowerCase() : '';
  if (email === PRIMARY_ADMIN_EMAIL) return true;

  const role = typeof userData?.role === 'string' ? userData.role.trim().toLowerCase() : '';
  return role === 'admin';
};

const requireAdminAccess = async (userId: string | undefined, res: Response) => {
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized: Firebase UID missing.' });
    return null;
  }

  const snapshot = await usersCollection.doc(userId).get();
  if (!snapshot.exists) {
    res.status(404).json({ message: 'Admin user not found.' });
    return null;
  }

  const userData = snapshot.data() as Record<string, any> | undefined;
  if (!isAdminFromUserDoc(userData)) {
    res.status(403).json({ message: 'Admin access required.' });
    return null;
  }

  return userData;
};

const isActivePremiumUser = (userData: Record<string, any> | undefined): boolean => {
  const status = typeof userData?.subscriptionStatus === 'string'
    ? userData.subscriptionStatus.trim().toLowerCase()
    : '';
  const tier = typeof userData?.subscriptionTier === 'string'
    ? userData.subscriptionTier.trim().toLowerCase()
    : '';

  return status === 'active' && (tier === 'premium' || tier === 'elite');
};

const normalizeTimestamp = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
};

const removeUndefinedValues = <T extends Record<string, any>>(data: T): Partial<T> => {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
};

const sanitizeStoredBoosterPurchase = (
  purchase: StoredBoosterPurchase
): StoredBoosterPurchase => {
  return removeUndefinedValues({
    productType: 'profile_booster',
    status: purchase.status || 'paid',
    tier: purchase.tier || 'booster',
    billingCycle: 'one_time',
    pricingRegion: purchase.pricingRegion || 'global',
    displayCurrency: purchase.displayCurrency || 'USD',
    displayAmountMajor:
      typeof purchase.displayAmountMajor === 'number' ? purchase.displayAmountMajor : PROFILE_BOOSTER_PRICE_USD,
    chargeCurrency: purchase.chargeCurrency || 'NGN',
    chargeAmountMajor: typeof purchase.chargeAmountMajor === 'number' ? purchase.chargeAmountMajor : 0,
    chargeAmountSubunits: typeof purchase.chargeAmountSubunits === 'number' ? purchase.chargeAmountSubunits : 0,
    exchangeRate: typeof purchase.exchangeRate === 'number' ? purchase.exchangeRate : undefined,
    reference: purchase.reference || '',
    customerCode: purchase.customerCode || '',
    authorizationCode: purchase.authorizationCode || '',
    updatedAt: purchase.updatedAt || null,
  }) as StoredBoosterPurchase;
};

const DIAL_CODE_COUNTRY_MAP: Record<string, string> = {
  '+20': 'EG',
  '+212': 'MA',
  '+213': 'DZ',
  '+216': 'TN',
  '+234': 'NG',
  '+233': 'GH',
  '+237': 'CM',
  '+250': 'RW',
  '+251': 'ET',
  '+254': 'KE',
  '+255': 'TZ',
  '+256': 'UG',
  '+27': 'ZA',
};

const LOCATION_COUNTRY_KEYWORDS: Array<{ code: string; patterns: string[] }> = [
  { code: 'NG', patterns: ['nigeria', 'lagos', 'abuja', 'port harcourt'] },
  { code: 'GH', patterns: ['ghana', 'accra', 'kumasi'] },
  { code: 'KE', patterns: ['kenya', 'nairobi', 'mombasa'] },
  { code: 'ZA', patterns: ['south africa', 'johannesburg', 'cape town', 'pretoria'] },
  { code: 'MA', patterns: ['morocco', 'maroc', 'casablanca', 'rabat', 'marrakesh', 'marrakech', 'fes', 'agadir', 'tangier'] },
  { code: 'DZ', patterns: ['algeria', 'algiers', 'oran'] },
  { code: 'TN', patterns: ['tunisia', 'tunis', 'sfax'] },
  { code: 'EG', patterns: ['egypt', 'cairo', 'alexandria'] },
  { code: 'UG', patterns: ['uganda', 'kampala'] },
  { code: 'TZ', patterns: ['tanzania', 'dar es salaam', 'arusha'] },
  { code: 'ET', patterns: ['ethiopia', 'addis ababa'] },
  { code: 'RW', patterns: ['rwanda', 'kigali'] },
  { code: 'CM', patterns: ['cameroon', 'yaounde', 'douala'] },
];

const inferCountryCodeFromUser = (userData: UserPricingContext | null): string | null => {
  if (!userData) return null;

  const countryHint = typeof userData.countryCode === 'string' ? userData.countryCode.trim() : '';
  if (countryHint) {
    const normalizedHint = countryHint.toUpperCase();
    if (/^[A-Z]{2}$/.test(normalizedHint)) {
      return normalizedHint;
    }
    if (DIAL_CODE_COUNTRY_MAP[countryHint]) {
      return DIAL_CODE_COUNTRY_MAP[countryHint];
    }
  }

  const location = typeof userData.location === 'string' ? userData.location.toLowerCase() : '';
  if (!location) return null;

  for (const { code, patterns } of LOCATION_COUNTRY_KEYWORDS) {
    if (patterns.some((pattern) => location.includes(pattern))) {
      return code;
    }
  }

  return null;
};

const addSubscriptionDuration = (date: Date, billingCycle: BillingCycle | undefined): Date => {
  const nextDate = new Date(date);

  if (billingCycle === 'quarterly') {
    nextDate.setMonth(nextDate.getMonth() + 3);
    return nextDate;
  }

  nextDate.setMonth(nextDate.getMonth() + 1);
  return nextDate;
};

const resolvePlanConfig = (tier: PlanTier, currency: Currency) => {
  const envSuffix = `${tier}_${currency}`.toUpperCase();
  const planCode = process.env[`PAYSTACK_PLAN_CODE_${envSuffix}`]?.trim();
  const amountRaw = process.env[`PAYSTACK_AMOUNT_${envSuffix}`];
  const fallbackAmount = amountRaw ? Number(amountRaw) : 0;

  if (!planCode) {
    throw new Error(`Missing PAYSTACK_PLAN_CODE_${envSuffix}. Create the plan in Paystack and set this env var.`);
  }
  if (!fallbackAmount || Number.isNaN(fallbackAmount)) {
    throw new Error(`Missing PAYSTACK_AMOUNT_${envSuffix}`);
  }

  return { planCode, fallbackAmount };
};

const resolveLocalizedSubscriptionPlanConfig = (billingCycle: BillingCycle) => {
  const envSuffix = billingCycle.toUpperCase();
  const planCode = process.env[`PAYSTACK_PLAN_CODE_PREMIUM_${envSuffix}`]?.trim();
  const fallbackAmount = billingCycle === 'quarterly' ? 10000 : 5000;

  if (!planCode) {
    throw new Error(
      `Missing PAYSTACK_PLAN_CODE_PREMIUM_${envSuffix}. Create the ${billingCycle} recurring plan in Paystack and set this env var.`
    );
  }

  return { planCode, fallbackAmount };
};

const resolveRenewalProvider = (
  region: PricingRegion | string | undefined,
  planCode?: string | null,
): 'plan' | 'authorization' => {
  if (typeof region === 'string' && region.trim().toLowerCase() === 'global') {
    return 'authorization';
  }

  if (typeof planCode === 'string' && planCode.trim()) {
    return 'plan';
  }

  return 'authorization';
};

const isAutoRenewEnabled = (subscription: StoredSubscription | null | undefined) =>
  subscription?.autoRenewEnabled !== false;

const resolveLivePlanConfig = async (tier: PlanTier, currency: Currency) => {
  const { planCode, fallbackAmount } = resolvePlanConfig(tier, currency);

  try {
    const response = await getPlanDetails(planCode);
    const liveAmount = typeof response?.data?.amount === 'number' ? response.data.amount : fallbackAmount;
    const liveCurrency = typeof response?.data?.currency === 'string'
      ? response.data.currency.trim().toUpperCase()
      : currency;

    return {
      planCode,
      amount: liveAmount,
      currency: (liveCurrency === 'USD' ? 'USD' : 'NGN') as Currency,
    };
  } catch {
    return {
      planCode,
      amount: fallbackAmount,
      currency,
    };
  }
};

const listConfiguredPlans = async (): Promise<PublicPlan[]> => {
  const plans: PublicPlan[] = [];
  const tiers: PlanTier[] = ['premium', 'elite'];
  const currencies: Currency[] = ['NGN', 'USD'];

  for (const tier of tiers) {
    for (const currency of currencies) {
      try {
        const { amount, currency: resolvedCurrency } = await resolveLivePlanConfig(tier, currency);
        plans.push({
          tier,
          name: PLAN_METADATA[tier].name,
          amount,
          currency: resolvedCurrency,
          interval: 'monthly',
        });
      } catch {
        continue;
      }
    }
  }

  return plans.sort((left, right) => left.amount - right.amount);
};

const getStoredSubscription = async (userId: string): Promise<StoredSubscription | null> => {
  const snapshot = await usersCollection.doc(userId).get();
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as Record<string, any> | undefined;
  const subscription = data?.subscription;
  if (!subscription || typeof subscription !== 'object') {
    return null;
  }

  return subscription as StoredSubscription;
};

const getStoredBoosterPurchases = (userData: Record<string, any> | undefined): StoredBoosterPurchase[] => {
  const purchases = userData?.profileBoosterPurchases;
  if (!Array.isArray(purchases)) return [];

  return purchases
    .filter((purchase): purchase is Record<string, any> => Boolean(purchase) && typeof purchase === 'object')
    .map((purchase) => sanitizeStoredBoosterPurchase({
      productType: 'profile_booster',
      status: typeof purchase.status === 'string' ? purchase.status : 'paid',
      tier: typeof purchase.tier === 'string' ? purchase.tier : 'booster',
      billingCycle: 'one_time',
      pricingRegion: typeof purchase.pricingRegion === 'string' ? purchase.pricingRegion : 'global',
      displayCurrency: typeof purchase.displayCurrency === 'string' ? purchase.displayCurrency : 'USD',
      displayAmountMajor:
        typeof purchase.displayAmountMajor === 'number' ? purchase.displayAmountMajor : PROFILE_BOOSTER_PRICE_USD,
      chargeCurrency: typeof purchase.chargeCurrency === 'string' ? purchase.chargeCurrency : 'NGN',
      chargeAmountMajor: typeof purchase.chargeAmountMajor === 'number' ? purchase.chargeAmountMajor : 0,
      chargeAmountSubunits: typeof purchase.chargeAmountSubunits === 'number' ? purchase.chargeAmountSubunits : 0,
      exchangeRate: typeof purchase.exchangeRate === 'number' ? purchase.exchangeRate : undefined,
      reference: typeof purchase.reference === 'string' ? purchase.reference : '',
      customerCode: typeof purchase.customerCode === 'string' ? purchase.customerCode : '',
      authorizationCode: typeof purchase.authorizationCode === 'string' ? purchase.authorizationCode : '',
      updatedAt: normalizeTimestamp(purchase.updatedAt) || null,
    }));
};

const getLegacyBoosterPurchase = (
  userData: Record<string, any> | undefined,
  subscription: StoredSubscription | null | undefined
): StoredBoosterPurchase | null => {
  const legacyReference =
    typeof userData?.profileBoosterLastGrantedReference === 'string'
      ? userData.profileBoosterLastGrantedReference.trim()
      : '';

  if (!legacyReference) return null;

  return {
    productType: 'profile_booster',
    status: 'granted',
    tier: 'booster',
    billingCycle: 'one_time',
    pricingRegion:
      typeof subscription?.pricingRegion === 'string' ? subscription.pricingRegion : 'unknown',
    displayCurrency: 'USD',
    displayAmountMajor: 0,
    chargeCurrency:
      typeof subscription?.currency === 'string' ? subscription.currency : 'NGN',
    chargeAmountMajor: 0,
    chargeAmountSubunits: 0,
    reference: legacyReference,
    customerCode:
      typeof subscription?.customerCode === 'string' ? subscription.customerCode : '',
    authorizationCode:
      typeof subscription?.authorizationCode === 'string' ? subscription.authorizationCode : '',
    updatedAt: normalizeTimestamp(userData?.updatedAt),
  };
};

const upsertProfileBoosterPurchase = async (
  userId: string,
  purchase: StoredBoosterPurchase
) => {
  const userRef = usersCollection.doc(userId);
  const userSnapshot = await userRef.get();
  const userData = userSnapshot.data() as Record<string, any> | undefined;
  const existingPurchases = getStoredBoosterPurchases(userData);
  const reference = typeof purchase.reference === 'string' ? purchase.reference : '';

  const normalizedPurchase: StoredBoosterPurchase = sanitizeStoredBoosterPurchase({
    ...purchase,
    reference,
    updatedAt: new Date().toISOString(),
  });

  const nextPurchases =
    reference
      ? [
          ...existingPurchases.filter((entry) => entry.reference !== reference),
          normalizedPurchase,
        ]
      : [...existingPurchases, normalizedPurchase];

  await userRef.set(
    {
      profileBoosterPurchases: nextPurchases.map((entry) => sanitizeStoredBoosterPurchase(entry)),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
};

const getUserPricingContext = async (userId: string): Promise<UserPricingContext | null> => {
  const snapshot = await usersCollection.doc(userId).get();
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as Record<string, unknown> | undefined;
  if (!data) {
    return null;
  }

  return {
    countryCode: typeof data.countryCode === 'string' ? data.countryCode : undefined,
    location: typeof data.location === 'string' ? data.location : undefined,
  };
};

const resolveTierFromPlanCode = (planCode?: string | null): PlanTier | undefined => {
  const normalizedPlanCode = typeof planCode === 'string' ? planCode.trim() : '';
  if (!normalizedPlanCode) {
    return undefined;
  }

  const tiers: PlanTier[] = ['premium', 'elite'];
  const currencies: Currency[] = ['NGN', 'USD'];

  for (const tier of tiers) {
    for (const currency of currencies) {
      const configuredPlanCode = process.env[`PAYSTACK_PLAN_CODE_${tier.toUpperCase()}_${currency}`]?.trim();
      if (configuredPlanCode && configuredPlanCode === normalizedPlanCode) {
        return tier;
      }
    }
  }

  const localizedMonthlyPlanCode = process.env.PAYSTACK_PLAN_CODE_PREMIUM_MONTHLY?.trim();
  if (localizedMonthlyPlanCode && localizedMonthlyPlanCode === normalizedPlanCode) {
    return 'premium';
  }

  const localizedQuarterlyPlanCode = process.env.PAYSTACK_PLAN_CODE_PREMIUM_QUARTERLY?.trim();
  if (localizedQuarterlyPlanCode && localizedQuarterlyPlanCode === normalizedPlanCode) {
    return 'premium';
  }

  return undefined;
};

const updateSubscription = async (
  userId: string,
  data: Record<string, any>
) => {
  const sanitizedSubscription = removeUndefinedValues(data);

  await usersCollection.doc(userId).set(
    removeUndefinedValues({
      subscription: {
        ...sanitizedSubscription,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      subscriptionStatus: sanitizedSubscription.status ?? sanitizedSubscription.subscriptionStatus ?? 'active',
      subscriptionTier: sanitizedSubscription.tier ?? sanitizedSubscription.subscriptionTier,
      subscriptionCurrency: sanitizedSubscription.currency ?? sanitizedSubscription.subscriptionCurrency,
    }),
    { merge: true }
  );
};

export const initializeSubscription = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    const email = (req as any).user?.email || req.body?.email;
    const { tier, currency } = req.body as { tier: PlanTier; currency: Currency };

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: Firebase UID missing.' });
    }
    if (!email) {
      return res.status(400).json({ message: 'Email is required for payment.' });
    }
    if (!tier || !['premium', 'elite'].includes(tier)) {
      return res.status(400).json({ message: 'Invalid tier provided.' });
    }
    if (!currency || !['NGN', 'USD'].includes(currency)) {
      return res.status(400).json({ message: 'Invalid currency provided.' });
    }

    const { planCode, amount, currency: resolvedCurrency } = await resolveLivePlanConfig(tier, currency);

    const payload = {
      email,
      amount,
      currency: resolvedCurrency,
      plan: planCode,
      metadata: {
        userId,
        tier,
        currency: resolvedCurrency,
      },
    };

    const response = await initializeTransaction(payload);

    await updateSubscription(userId, {
      status: 'pending',
      tier,
      currency: resolvedCurrency,
      planCode,
      reference: response.data.reference,
      autoRenewEnabled: true,
      autoRenewDisabledAt: undefined,
    });

    return res.status(200).json({
      authorizationUrl: response.data.authorization_url,
      accessCode: response.data.access_code,
      reference: response.data.reference,
      amount,
      currency: resolvedCurrency,
    });
  } catch (error: any) {
    console.error('Paystack init error:', error);
    const message = error?.message || 'Payment initialization failed.';
    return res.status(400).json({ message });
  }
};

export const initializeLocalizedSubscription = async (req: Request, res: Response) => {
  console.error('[pay] initializeLocalizedSubscription invoked — build: 2026-05-27-usd-routing');
  try {
    const userId = req.userId;
    const email = req.user?.email || req.body?.email;
    const { tier, billingCycle } = req.body as { tier?: PlanTier; billingCycle?: BillingCycle };

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: Firebase UID missing.' });
    }
    if (!email) {
      return res.status(400).json({ message: 'Email is required for payment.' });
    }
    if (!tier || !['premium', 'elite'].includes(tier)) {
      return res.status(400).json({ message: 'Invalid tier provided.' });
    }
    if (tier !== 'premium') {
      return res.status(400).json({ message: 'Only the premium tier is currently available.' });
    }
    if (!billingCycle || !['monthly', 'quarterly'].includes(billingCycle)) {
      return res.status(400).json({ message: 'Invalid billing cycle provided.' });
    }

    const callbackBaseUrl = process.env.CLIENT_URL?.trim();
    const callbackUrl = callbackBaseUrl ? `${callbackBaseUrl.replace(/\/+$/, '')}/payment-success` : undefined;
    const clientIp = extractClientIp(req.headers as Record<string, unknown>);
    const userPricingContext = await getUserPricingContext(userId);
    const fallbackCountryCode = inferCountryCodeFromUser(userPricingContext);
    const pricingQuote = await getRegionalPricingQuote(billingCycle, clientIp, fallbackCountryCode);
    console.error(`[pay] region=${pricingQuote.region} country=${pricingQuote.countryCode} currency=${pricingQuote.chargeCurrency} subunits=${pricingQuote.chargeAmountSubunits}`);
    res.setHeader('X-Charge-Currency', pricingQuote.chargeCurrency);
    res.setHeader('X-Pricing-Region', pricingQuote.region);
    const shouldUsePlanSubscription = pricingQuote.region === 'nigeria';
    const planCode = shouldUsePlanSubscription
      ? resolveLocalizedSubscriptionPlanConfig(billingCycle).planCode
      : null;

    const response = await initializeTransaction({
      email,
      amount: pricingQuote.chargeAmountSubunits,
      currency: pricingQuote.chargeCurrency,
      ...(planCode ? { plan: planCode } : {}),
      callback_url: callbackUrl,
      metadata: {
        userId,
        tier,
        billingCycle,
        renewalProvider: shouldUsePlanSubscription ? 'plan' : 'authorization',
        ...(planCode ? { planCode } : {}),
        pricingRegion: pricingQuote.region,
        countryCode: pricingQuote.countryCode,
        displayCurrency: pricingQuote.displayCurrency,
        displayAmountMajor: pricingQuote.displayAmountMajor,
        chargeAmountMajor: pricingQuote.chargeAmountMajor,
        chargeAmountSubunits: pricingQuote.chargeAmountSubunits,
        exchangeRate: pricingQuote.exchangeRate,
      },
    });

    await updateSubscription(userId, {
      status: 'pending',
      tier,
      currency: pricingQuote.chargeCurrency,
      billingCycle,
      pricingRegion: pricingQuote.region,
      displayCurrency: pricingQuote.displayCurrency,
      displayAmountMajor: pricingQuote.displayAmountMajor,
      chargeAmountMajor: pricingQuote.chargeAmountMajor,
      chargeAmountSubunits: pricingQuote.chargeAmountSubunits,
      exchangeRate: pricingQuote.exchangeRate,
      planCode,
      reference: response.data.reference,
      customerEmail: email,
      renewalProvider: shouldUsePlanSubscription ? 'plan' : 'authorization',
      autoRenewEnabled: true,
      autoRenewDisabledAt: undefined,
      countryCode: pricingQuote.countryCode,
    });

    return res.status(200).json({
      authorizationUrl: response.data.authorization_url,
      accessCode: response.data.access_code,
      reference: response.data.reference,
      chargeCurrency: pricingQuote.chargeCurrency,
      chargeAmountMajor: pricingQuote.chargeAmountMajor,
      chargeAmountSubunits: pricingQuote.chargeAmountSubunits,
      displayCurrency: pricingQuote.displayCurrency,
      displayAmountMajor: pricingQuote.displayAmountMajor,
      billingCycle,
      region: pricingQuote.region,
      countryCode: pricingQuote.countryCode,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Localized payment initialization failed.';
    return res.status(400).json({ message });
  }
};

export const getLocalizedPricingQuote = async (req: Request, res: Response) => {
  try {
    const clientIp = extractClientIp(req.headers as Record<string, unknown>);
    const userPricingContext = req.userId ? await getUserPricingContext(req.userId) : null;
    const fallbackCountryCode = inferCountryCodeFromUser(userPricingContext);
    const monthly = await getRegionalPricingQuote('monthly', clientIp, fallbackCountryCode);
    const quarterly = await getRegionalPricingQuote('quarterly', clientIp, fallbackCountryCode);

    return res.status(200).json({
      countryCode: monthly.countryCode,
      region: monthly.region,
      quotes: {
        monthly,
        quarterly,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Pricing quote generation failed.';
    return res.status(500).json({ message });
  }
};

export const getLocalizedProfileBoosterQuote = async (req: Request, res: Response) => {
  try {
    const clientIp = extractClientIp(req.headers as Record<string, unknown>);
    const userPricingContext = req.userId ? await getUserPricingContext(req.userId) : null;
    const fallbackCountryCode = inferCountryCodeFromUser(userPricingContext);
    const [single, bundle] = await Promise.all([
      getRegionalProfileBoosterQuote(clientIp, 'single', fallbackCountryCode),
      getRegionalProfileBoosterQuote(clientIp, 'bundle', fallbackCountryCode),
    ]);

    return res.status(200).json({
      countryCode: single.countryCode,
      region: single.region,
      quotes: {
        single,
        bundle,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Booster pricing quote generation failed.';
    return res.status(500).json({ message });
  }
};

export const initializeProfileBoosterPurchase = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const email = req.user?.email || req.body?.email;
    const bundleKey = normalizeProfileBoosterBundleKey(req.body?.bundleKey);

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: Firebase UID missing.' });
    }
    if (!email) {
      return res.status(400).json({ message: 'Email is required for payment.' });
    }

    const userSnapshot = await usersCollection.doc(userId).get();
    if (!userSnapshot.exists) {
      return res.status(404).json({ message: 'User profile not found.' });
    }

    const userData = userSnapshot.data() as Record<string, any> | undefined;

    const callbackBaseUrl = process.env.CLIENT_URL?.trim();
    const callbackUrl = callbackBaseUrl ? `${callbackBaseUrl.replace(/\/+$/, '')}/payment-success` : undefined;
    const clientIp = extractClientIp(req.headers as Record<string, unknown>);
    const fallbackCountryCode = inferCountryCodeFromUser(userData as UserPricingContext);
    const pricingQuote = await getRegionalProfileBoosterQuote(clientIp, bundleKey, fallbackCountryCode);

    const response = await initializeTransaction({
      email,
      amount: pricingQuote.chargeAmountSubunits,
      currency: pricingQuote.chargeCurrency,
      callback_url: callbackUrl,
      metadata: {
        userId,
        productType: 'profile_booster' satisfies PaymentProductType,
        bundleKey: pricingQuote.bundleKey,
        creditsToGrant: pricingQuote.bundleSize,
        pricingRegion: pricingQuote.region,
        countryCode: pricingQuote.countryCode,
        displayCurrency: pricingQuote.displayCurrency,
        displayAmountMajor: pricingQuote.displayAmountMajor,
        chargeCurrency: pricingQuote.chargeCurrency,
        chargeAmountMajor: pricingQuote.chargeAmountMajor,
        chargeAmountSubunits: pricingQuote.chargeAmountSubunits,
        exchangeRate: pricingQuote.exchangeRate,
      },
    });

    return res.status(200).json({
      authorizationUrl: response.data.authorization_url,
      accessCode: response.data.access_code,
      reference: response.data.reference,
      bundleKey: pricingQuote.bundleKey,
      bundleSize: pricingQuote.bundleSize,
      region: pricingQuote.region,
      countryCode: pricingQuote.countryCode,
      displayCurrency: pricingQuote.displayCurrency,
      displayAmountMajor: pricingQuote.displayAmountMajor,
      displayLabel: pricingQuote.displayLabel,
      chargeCurrency: pricingQuote.chargeCurrency,
      chargeAmountMajor: pricingQuote.chargeAmountMajor,
      chargeAmountSubunits: pricingQuote.chargeAmountSubunits,
    });
  } catch (error: any) {
    return res.status(400).json({ message: error?.message || 'Booster payment initialization failed.' });
  }
};

export const updateSubscriptionAutoRenew = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const { enabled } = req.body as { enabled?: boolean };

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: Firebase UID missing.' });
    }
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'A boolean enabled value is required.' });
    }

    const existingSubscription = await getStoredSubscription(userId);
    if (!existingSubscription) {
      return res.status(404).json({ message: 'No subscription record found for this account.' });
    }

    const renewalProvider =
      existingSubscription.renewalProvider ||
      resolveRenewalProvider(existingSubscription.pricingRegion, existingSubscription.planCode);
    const currentEnabled = isAutoRenewEnabled(existingSubscription);

    if (enabled === currentEnabled) {
      return res.status(200).json({
        message: enabled ? 'Auto-debit is already enabled.' : 'Auto-debit is already paused.',
        autoRenewEnabled: enabled,
        renewalProvider,
      });
    }

    if (renewalProvider === 'plan') {
      const subscriptionCode = typeof existingSubscription.subscriptionCode === 'string'
        ? existingSubscription.subscriptionCode.trim()
        : '';
      const subscriptionEmailToken = typeof existingSubscription.subscriptionEmailToken === 'string'
        ? existingSubscription.subscriptionEmailToken.trim()
        : '';

      if (!subscriptionCode || !subscriptionEmailToken) {
        return res.status(400).json({
          message: 'This Paystack subscription cannot be updated yet. Please contact support if your plan was created before subscription controls were added.',
        });
      }

      if (enabled) {
        await enablePaystackSubscription({
          code: subscriptionCode,
          token: subscriptionEmailToken,
        });
      } else {
        await disablePaystackSubscription({
          code: subscriptionCode,
          token: subscriptionEmailToken,
        });
      }
    }

    await updateSubscription(userId, {
      renewalProvider,
      autoRenewEnabled: enabled,
      autoRenewDisabledAt: enabled ? admin.firestore.FieldValue.delete() : new Date().toISOString(),
      lastChargeAttemptAt: admin.firestore.FieldValue.delete(),
    });

    return res.status(200).json({
      message: enabled ? 'Auto-debit enabled successfully.' : 'Auto-debit paused successfully.',
      autoRenewEnabled: enabled,
      renewalProvider,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Unable to update subscription auto-debit.';
    return res.status(400).json({ message });
  }
};

export const listSubscriptionPlans = async (_req: Request, res: Response) => {
  try {
    const plans = await listConfiguredPlans();
    return res.status(200).json({ plans });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Failed to load plans.' });
  }
};

export const getAdminPaymentAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    const adminUser = await requireAdminAccess(userId, res);
    if (!adminUser) return;

    const snapshot = await usersCollection.get();
    const records: PaymentAnalyticsRecord[] = [];

    snapshot.forEach((doc) => {
      const user = doc.data() as Record<string, any>;
      const subscription = (user.subscription || {}) as StoredSubscription & {
        updatedAt?: unknown;
      };
      const status = typeof user.subscriptionStatus === 'string'
        ? user.subscriptionStatus
        : typeof subscription.status === 'string'
          ? subscription.status
          : '';

      const tier = typeof user.subscriptionTier === 'string'
        ? user.subscriptionTier
        : typeof subscription.tier === 'string'
          ? subscription.tier
          : '';

      const hasPaymentRecord = Boolean(
        status ||
        tier ||
        subscription.reference ||
        subscription.chargeAmountMajor ||
        subscription.displayAmountMajor
      );

      if (!hasPaymentRecord) return;

      records.push({
        userId: doc.id,
        name: typeof user.name === 'string' ? user.name : 'Unknown user',
        email: typeof user.email === 'string' ? user.email : '',
        productType: 'subscription',
        status: status || 'unknown',
        tier: tier || 'free',
        billingCycle: subscription.billingCycle === 'quarterly' ? 'quarterly' : 'monthly',
        pricingRegion: typeof subscription.pricingRegion === 'string' ? subscription.pricingRegion : 'unknown',
        displayCurrency: typeof subscription.displayCurrency === 'string' ? subscription.displayCurrency : 'NGN',
        displayAmountMajor: typeof subscription.displayAmountMajor === 'number' ? subscription.displayAmountMajor : 0,
        chargeCurrency: typeof subscription.currency === 'string'
          ? subscription.currency
          : typeof user.subscriptionCurrency === 'string'
            ? user.subscriptionCurrency
            : 'NGN',
        chargeAmountMajor: typeof subscription.chargeAmountMajor === 'number' ? subscription.chargeAmountMajor : 0,
        chargeAmountSubunits: typeof subscription.chargeAmountSubunits === 'number' ? subscription.chargeAmountSubunits : 0,
        reference: typeof subscription.reference === 'string' ? subscription.reference : '',
        planCode: typeof subscription.planCode === 'string' ? subscription.planCode : null,
        customerCode: typeof subscription.customerCode === 'string' ? subscription.customerCode : '',
        authorizationCode: typeof subscription.authorizationCode === 'string' ? subscription.authorizationCode : '',
        nextPaymentDate: typeof subscription.nextPaymentDate === 'string' ? subscription.nextPaymentDate : null,
        updatedAt: normalizeTimestamp(subscription.updatedAt) || normalizeTimestamp(user.updatedAt),
      });

      const boosterPurchases = getStoredBoosterPurchases(user);
      const legacyBoosterPurchase = getLegacyBoosterPurchase(user, subscription);
      const allBoosterPurchases = legacyBoosterPurchase &&
        !boosterPurchases.some((purchase) => purchase.reference === legacyBoosterPurchase.reference)
        ? [...boosterPurchases, legacyBoosterPurchase]
        : boosterPurchases;
      allBoosterPurchases.forEach((purchase) => {
        records.push({
          userId: doc.id,
          name: typeof user.name === 'string' ? user.name : 'Unknown user',
          email: typeof user.email === 'string' ? user.email : '',
          productType: 'profile_booster',
          status: purchase.status || 'paid',
          tier: purchase.tier || 'booster',
          billingCycle: 'one_time',
          pricingRegion: typeof purchase.pricingRegion === 'string' ? purchase.pricingRegion : 'global',
          displayCurrency: typeof purchase.displayCurrency === 'string' ? purchase.displayCurrency : 'USD',
          displayAmountMajor:
            typeof purchase.displayAmountMajor === 'number' ? purchase.displayAmountMajor : PROFILE_BOOSTER_PRICE_USD,
          chargeCurrency: typeof purchase.chargeCurrency === 'string' ? purchase.chargeCurrency : 'NGN',
          chargeAmountMajor: typeof purchase.chargeAmountMajor === 'number' ? purchase.chargeAmountMajor : 0,
          chargeAmountSubunits:
            typeof purchase.chargeAmountSubunits === 'number' ? purchase.chargeAmountSubunits : 0,
          reference: typeof purchase.reference === 'string' ? purchase.reference : '',
          planCode: null,
          customerCode: typeof purchase.customerCode === 'string' ? purchase.customerCode : '',
          authorizationCode:
            typeof purchase.authorizationCode === 'string' ? purchase.authorizationCode : '',
          nextPaymentDate: null,
          updatedAt: purchase.updatedAt || normalizeTimestamp(user.updatedAt),
        });
      });
    });

    records.sort((left, right) => {
      const rightTime = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
      const leftTime = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
      return rightTime - leftTime;
    });

    const summary = records.reduce(
      (acc, record) => {
        acc.totalRecords += 1;
        if (record.status === 'active') acc.activeSubscriptions += 1;
        if (record.status === 'pending') acc.pendingSubscriptions += 1;
        if (record.status === 'inactive') acc.inactiveSubscriptions += 1;
        if (record.productType === 'subscription') {
          if (record.billingCycle === 'monthly') acc.monthlyPlans += 1;
          if (record.billingCycle === 'quarterly') acc.quarterlyPlans += 1;
        }
        if (record.status === 'active') {
          acc.activeChargeVolumeNgn += record.chargeCurrency === 'NGN' ? record.chargeAmountMajor : 0;
        }
        if (record.status === 'active' || record.status === 'pending') {
          acc.trackedChargeVolumeNgn += record.chargeCurrency === 'NGN' ? record.chargeAmountMajor : 0;
        }
        return acc;
      },
      {
        totalRecords: 0,
        activeSubscriptions: 0,
        pendingSubscriptions: 0,
        inactiveSubscriptions: 0,
        monthlyPlans: 0,
        quarterlyPlans: 0,
        activeChargeVolumeNgn: 0,
        trackedChargeVolumeNgn: 0,
      }
    );

    const statusBreakdown = records.reduce<Record<string, number>>((acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    }, {});

    const regionBreakdown = records.reduce<Record<string, number>>((acc, record) => {
      acc[record.pricingRegion] = (acc[record.pricingRegion] || 0) + 1;
      return acc;
    }, {});

    const tierBreakdown = records.reduce<Record<string, number>>((acc, record) => {
      acc[record.tier] = (acc[record.tier] || 0) + 1;
      return acc;
    }, {});

    return res.status(200).json({
      adminEmail: adminUser.email,
      summary,
      breakdowns: {
        status: statusBreakdown,
        region: regionBreakdown,
        tier: tierBreakdown,
      },
      records,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Failed to load payment analytics.' });
  }
};

export const deleteAdminPaymentRecord = async (req: Request, res: Response) => {
  try {
    const adminUserId = (req as any).userId as string | undefined;
    const adminUser = await requireAdminAccess(adminUserId, res);
    if (!adminUser) return;

    const targetUserId = typeof req.params.userId === 'string' ? req.params.userId.trim() : '';
    const requestedProductType = typeof req.query.productType === 'string'
      ? req.query.productType.trim().toLowerCase()
      : 'subscription';
    const targetReference = typeof req.query.reference === 'string' ? req.query.reference.trim() : '';
    if (!targetUserId) {
      return res.status(400).json({ message: 'Target user ID is required.' });
    }

    const targetRef = usersCollection.doc(targetUserId);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      return res.status(404).json({ message: 'Payment record owner not found.' });
    }

    const targetUser = targetSnap.data() as Record<string, any> | undefined;
    if (requestedProductType === 'profile_booster') {
      const boosterPurchases = getStoredBoosterPurchases(targetUser);
      const nextPurchases = targetReference
        ? boosterPurchases.filter((purchase) => purchase.reference !== targetReference)
        : boosterPurchases.slice(0, -1);

      if (nextPurchases.length === boosterPurchases.length) {
        return res.status(404).json({ message: 'No booster payment record exists for this user.' });
      }

      await targetRef.set(
        {
          profileBoosterPurchases: nextPurchases,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return res.status(200).json({
        message: 'Booster payment record deleted successfully.',
        userId: targetUserId,
        email: typeof targetUser?.email === 'string' ? targetUser.email : '',
      });
    }

    const hadSubscriptionRecord = Boolean(
      targetUser?.subscription ||
      targetUser?.subscriptionStatus ||
      targetUser?.subscriptionTier ||
      targetUser?.subscriptionCurrency
    );

    if (!hadSubscriptionRecord) {
      return res.status(404).json({ message: 'No payment record exists for this user.' });
    }

    await targetRef.set(
      {
        subscription: admin.firestore.FieldValue.delete(),
        subscriptionStatus: admin.firestore.FieldValue.delete(),
        subscriptionTier: admin.firestore.FieldValue.delete(),
        subscriptionCurrency: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return res.status(200).json({
      message: 'Payment record deleted successfully.',
      userId: targetUserId,
      email: typeof targetUser?.email === 'string' ? targetUser.email : '',
    });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || 'Failed to delete payment record.' });
  }
};

export const verifySubscription = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string | undefined;
    const { reference } = req.body as { reference: string };

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: Firebase UID missing.' });
    }
    if (!reference) {
      return res.status(400).json({ message: 'Reference is required.' });
    }

    const response = await verifyTransaction(reference);
    const data = response.data;
    const existingSubscription = await getStoredSubscription(userId);

    if (data.status !== 'success') {
      return res.status(400).json({ message: 'Payment not successful yet.' });
    }

    const metadata = data.metadata || {};
    const productType = typeof metadata.productType === 'string'
      ? metadata.productType.trim().toLowerCase()
      : 'subscription';

    if (productType === 'profile_booster') {
      const creditsToGrant = normalizeProfileBoosterCredits(metadata.creditsToGrant);
      const displayAmountMajor =
        typeof metadata.displayAmountMajor === 'number'
          ? metadata.displayAmountMajor
          : creditsToGrant === 1
            ? PROFILE_BOOSTER_SINGLE_PRICE_USD
            : PROFILE_BOOSTER_PRICE_USD;
      const boosterGrant = await grantProfileBoosterForPayment(
        userId,
        data.reference,
        creditsToGrant
      );
      await upsertProfileBoosterPurchase(userId, {
        productType: 'profile_booster',
        status: 'paid',
        tier: 'booster',
        billingCycle: 'one_time',
        pricingRegion:
          typeof metadata.pricingRegion === 'string' ? metadata.pricingRegion : 'global',
        displayCurrency:
          typeof metadata.displayCurrency === 'string' ? metadata.displayCurrency : 'USD',
        displayAmountMajor,
        chargeCurrency:
          typeof metadata.chargeCurrency === 'string' ? metadata.chargeCurrency : data.currency || 'NGN',
        chargeAmountMajor:
          typeof metadata.chargeAmountMajor === 'number'
            ? metadata.chargeAmountMajor
            : typeof data.amount === 'number'
              ? data.amount / 100
              : 0,
        chargeAmountSubunits:
          typeof metadata.chargeAmountSubunits === 'number'
            ? metadata.chargeAmountSubunits
            : typeof data.amount === 'number'
              ? data.amount
              : 0,
        exchangeRate: typeof metadata.exchangeRate === 'number' ? metadata.exchangeRate : undefined,
        reference: data.reference,
        customerCode: data.customer?.customer_code,
        authorizationCode: data.authorization?.authorization_code,
      });
      return res.status(200).json({
        message: boosterGrant.granted
          ? `Profile booster bundle purchased successfully. ${creditsToGrant} credit${creditsToGrant === 1 ? '' : 's'} added.`
          : 'Profile booster payment already processed.',
        purchaseType: 'profile_booster',
        data,
      });
    }

    const rawPlanCode = data.plan?.plan_code || data.plan;
    const tier =
      (typeof metadata.tier === 'string' && metadata.tier.trim().toLowerCase()) ||
      (typeof existingSubscription?.tier === 'string' && existingSubscription.tier.trim().toLowerCase()) ||
      resolveTierFromPlanCode(rawPlanCode) ||
      resolveTierFromPlanCode(existingSubscription?.planCode) ||
      undefined;
    const currency =
      data.currency ||
      metadata.currency ||
      existingSubscription?.currency;
    const billingCycle =
      (typeof metadata.billingCycle === 'string' && metadata.billingCycle.trim().toLowerCase()) ||
      (typeof existingSubscription?.billingCycle === 'string' && existingSubscription.billingCycle.trim().toLowerCase()) ||
      'monthly';
    const planCode =
      (typeof rawPlanCode === 'string' && rawPlanCode.trim()) ||
      (typeof existingSubscription?.planCode === 'string' && existingSubscription.planCode.trim()) ||
      undefined;
    const pricingRegion =
      (typeof metadata.pricingRegion === 'string' && metadata.pricingRegion.trim().toLowerCase()) ||
      existingSubscription?.pricingRegion;
    const nextPaymentDate =
      typeof data.next_payment_date === 'string' && data.next_payment_date.trim()
        ? data.next_payment_date
        : addSubscriptionDuration(new Date(), billingCycle === 'quarterly' ? 'quarterly' : 'monthly').toISOString();

    await updateSubscription(userId, {
      status: 'active',
      tier,
      currency,
      billingCycle: billingCycle === 'quarterly' ? 'quarterly' : 'monthly',
      pricingRegion,
      displayCurrency:
        (typeof metadata.displayCurrency === 'string' && metadata.displayCurrency.trim()) ||
        existingSubscription?.displayCurrency,
      displayAmountMajor:
        typeof metadata.displayAmountMajor === 'number'
          ? metadata.displayAmountMajor
          : existingSubscription?.displayAmountMajor,
      chargeAmountMajor:
        typeof metadata.chargeAmountMajor === 'number'
          ? metadata.chargeAmountMajor
          : existingSubscription?.chargeAmountMajor,
      chargeAmountSubunits:
        typeof metadata.chargeAmountSubunits === 'number'
          ? metadata.chargeAmountSubunits
          : existingSubscription?.chargeAmountSubunits,
      exchangeRate:
        typeof metadata.exchangeRate === 'number'
          ? metadata.exchangeRate
          : existingSubscription?.exchangeRate,
      reference: data.reference,
      planCode,
      subscriptionCode: data.subscription?.subscription_code || data.subscription_code,
      subscriptionEmailToken: data.subscription?.email_token,
      customerCode: data.customer?.customer_code,
      authorizationCode: data.authorization?.authorization_code,
      customerEmail:
        (typeof data.customer?.email === 'string' && data.customer.email.trim()) ||
        (typeof existingSubscription?.customerEmail === 'string' && existingSubscription.customerEmail.trim()) ||
        undefined,
      renewalProvider:
        (typeof metadata.renewalProvider === 'string' &&
        ['plan', 'authorization'].includes(metadata.renewalProvider.trim().toLowerCase())
          ? (metadata.renewalProvider.trim().toLowerCase() as 'plan' | 'authorization')
          : existingSubscription?.renewalProvider) ||
        resolveRenewalProvider(pricingRegion, planCode),
      autoRenewEnabled: isAutoRenewEnabled(existingSubscription),
      autoRenewDisabledAt: existingSubscription?.autoRenewDisabledAt,
      lastChargeAttemptAt: undefined,
      nextPaymentDate,
    });
    await grantProfileBoosterForPayment(userId, data.reference);

    return res.status(200).json({ message: 'Subscription verified', purchaseType: 'subscription', data });
  } catch (error: any) {
    console.error('Paystack verify error:', error);
    return res.status(500).json({ message: error.message || 'Payment verification failed.' });
  }
};

export const handlePaystackWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string | undefined;
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const rawBody = (req as any).rawBody as Buffer | undefined;

    if (!secret || !signature || !rawBody) {
      return res.status(400).json({ message: 'Missing webhook signature or body.' });
    }

    const hash = crypto
      .createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      return res.status(401).json({ message: 'Invalid webhook signature.' });
    }

    const event = req.body;
    const data = event?.data || {};
    const metadata = data?.metadata || {};

    let userId = metadata.userId as string | undefined;

    if (!userId && data.customer?.email) {
      const snapshot = await usersCollection
        .where('email', '==', data.customer.email)
        .limit(1)
        .get();
      if (!snapshot.empty) {
        userId = snapshot.docs[0].id;
      }
    }

    if (!userId) {
      return res.status(200).json({ received: true });
    }

    if (['charge.success', 'subscription.create', 'invoice.payment_succeeded'].includes(event.event)) {
      const productType = typeof metadata.productType === 'string'
        ? metadata.productType.trim().toLowerCase()
        : 'subscription';

      if (productType === 'profile_booster') {
        const creditsToGrant = normalizeProfileBoosterCredits(metadata.creditsToGrant);
        const displayAmountMajor =
          typeof metadata.displayAmountMajor === 'number'
            ? metadata.displayAmountMajor
            : creditsToGrant === 1
              ? PROFILE_BOOSTER_SINGLE_PRICE_USD
              : PROFILE_BOOSTER_PRICE_USD;
        await grantProfileBoosterForPayment(
          userId,
          data.reference,
          creditsToGrant
        );
        await upsertProfileBoosterPurchase(userId, {
          productType: 'profile_booster',
          status: 'paid',
          tier: 'booster',
          billingCycle: 'one_time',
          pricingRegion:
            typeof metadata.pricingRegion === 'string' ? metadata.pricingRegion : 'global',
          displayCurrency:
            typeof metadata.displayCurrency === 'string' ? metadata.displayCurrency : 'USD',
          displayAmountMajor,
          chargeCurrency:
            typeof metadata.chargeCurrency === 'string' ? metadata.chargeCurrency : data.currency || 'NGN',
          chargeAmountMajor:
            typeof metadata.chargeAmountMajor === 'number'
              ? metadata.chargeAmountMajor
              : typeof data.amount === 'number'
                ? data.amount / 100
                : 0,
          chargeAmountSubunits:
            typeof metadata.chargeAmountSubunits === 'number'
              ? metadata.chargeAmountSubunits
              : typeof data.amount === 'number'
                ? data.amount
                : 0,
          exchangeRate: typeof metadata.exchangeRate === 'number' ? metadata.exchangeRate : undefined,
          reference: data.reference,
          customerCode: data.customer?.customer_code,
          authorizationCode: data.authorization?.authorization_code,
        });
        return res.status(200).json({ received: true });
      }

      const existingSubscription = await getStoredSubscription(userId);
      const rawPlanCode = data.plan?.plan_code || data.plan;
      const tier =
        (typeof metadata.tier === 'string' && metadata.tier.trim().toLowerCase()) ||
        (typeof existingSubscription?.tier === 'string' && existingSubscription.tier.trim().toLowerCase()) ||
        resolveTierFromPlanCode(rawPlanCode) ||
        resolveTierFromPlanCode(existingSubscription?.planCode) ||
        undefined;
      const currency =
        data.currency ||
        metadata.currency ||
        existingSubscription?.currency;
      const billingCycle =
        (typeof metadata.billingCycle === 'string' && metadata.billingCycle.trim().toLowerCase()) ||
        (typeof existingSubscription?.billingCycle === 'string' && existingSubscription.billingCycle.trim().toLowerCase()) ||
        'monthly';
      const planCode =
        (typeof rawPlanCode === 'string' && rawPlanCode.trim()) ||
        (typeof existingSubscription?.planCode === 'string' && existingSubscription.planCode.trim()) ||
        undefined;
      const pricingRegion =
        (typeof metadata.pricingRegion === 'string' && metadata.pricingRegion.trim().toLowerCase()) ||
        existingSubscription?.pricingRegion;
      const nextPaymentDate =
        typeof data.next_payment_date === 'string' && data.next_payment_date.trim()
          ? data.next_payment_date
          : addSubscriptionDuration(new Date(), billingCycle === 'quarterly' ? 'quarterly' : 'monthly').toISOString();

      await updateSubscription(userId, {
        status: 'active',
        tier,
        currency,
        billingCycle: billingCycle === 'quarterly' ? 'quarterly' : 'monthly',
        pricingRegion,
        displayCurrency:
          (typeof metadata.displayCurrency === 'string' && metadata.displayCurrency.trim()) ||
          existingSubscription?.displayCurrency,
        displayAmountMajor:
          typeof metadata.displayAmountMajor === 'number'
            ? metadata.displayAmountMajor
            : existingSubscription?.displayAmountMajor,
        chargeAmountMajor:
          typeof metadata.chargeAmountMajor === 'number'
            ? metadata.chargeAmountMajor
            : existingSubscription?.chargeAmountMajor,
        chargeAmountSubunits:
          typeof metadata.chargeAmountSubunits === 'number'
            ? metadata.chargeAmountSubunits
            : existingSubscription?.chargeAmountSubunits,
        exchangeRate:
          typeof metadata.exchangeRate === 'number'
            ? metadata.exchangeRate
            : existingSubscription?.exchangeRate,
        reference: data.reference,
        planCode,
        customerCode: data.customer?.customer_code,
        subscriptionCode: data.subscription?.subscription_code || data.subscription_code,
        subscriptionEmailToken: data.subscription?.email_token,
        authorizationCode: data.authorization?.authorization_code,
        customerEmail:
          (typeof data.customer?.email === 'string' && data.customer.email.trim()) ||
          (typeof existingSubscription?.customerEmail === 'string' && existingSubscription.customerEmail.trim()) ||
          undefined,
        renewalProvider:
          (typeof metadata.renewalProvider === 'string' &&
          ['plan', 'authorization'].includes(metadata.renewalProvider.trim().toLowerCase())
            ? (metadata.renewalProvider.trim().toLowerCase() as 'plan' | 'authorization')
            : existingSubscription?.renewalProvider) ||
          resolveRenewalProvider(pricingRegion, planCode),
        autoRenewEnabled: isAutoRenewEnabled(existingSubscription),
        autoRenewDisabledAt: existingSubscription?.autoRenewDisabledAt,
        lastChargeAttemptAt: undefined,
        nextPaymentDate,
      });
      await grantProfileBoosterForPayment(userId, data.reference);
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Paystack webhook error:', error);
    return res.status(500).json({ message: error.message || 'Webhook handling failed.' });
  }
};
