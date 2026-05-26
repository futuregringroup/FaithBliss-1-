// src/services/paystackService.ts

type PaystackResponse<T> = {
  status: boolean;
  message: string;
  data: T;
};

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const getHeaders = () => {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error('PAYSTACK_SECRET_KEY is not set');
  }
  if (process.env.NODE_ENV === 'production' && secret.startsWith('sk_test_')) {
    console.error(
      '[PAYSTACK] CRITICAL: PAYSTACK_SECRET_KEY is a TEST key in production. ' +
      'Update PAYSTACK_SECRET_KEY in Vercel environment variables to your sk_live_ key. ' +
      'Paystack hosted checkout will show the TEST badge until this is fixed.'
    );
    throw new Error(
      'Payment is misconfigured: production environment must not use Paystack test credentials. ' +
      'Please contact support.'
    );
  }
  return {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json',
  };
};

const paystackRequest = async <T>(path: string, options: RequestInit): Promise<PaystackResponse<T>> => {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.message || 'Paystack request failed';
    throw new Error(message);
  }
  return payload as PaystackResponse<T>;
};

export const initializeTransaction = async (payload: Record<string, unknown>) => {
  return paystackRequest<{
    authorization_url: string;
    access_code: string;
    reference: string;
  }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const verifyTransaction = async (reference: string) => {
  return paystackRequest<Record<string, any>>(`/transaction/verify/${reference}`, {
    method: 'GET',
  });
};

export const chargeAuthorization = async (payload: {
  authorization_code: string;
  email: string;
  amount: number;
  currency?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
  callback_url?: string;
  queue?: boolean;
}) => {
  return paystackRequest<Record<string, any>>('/transaction/charge_authorization', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const enableSubscription = async (payload: {
  code: string;
  token: string;
}) => {
  return paystackRequest<Record<string, any>>('/subscription/enable', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const disableSubscription = async (payload: {
  code: string;
  token: string;
}) => {
  return paystackRequest<Record<string, any>>('/subscription/disable', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const getPlanDetails = async (planCode: string) => {
  return paystackRequest<{
    id: number;
    name: string;
    plan_code: string;
    amount: number;
    interval?: string;
    currency?: string;
  }>(`/plan/${encodeURIComponent(planCode)}`, {
    method: 'GET',
  });
};
