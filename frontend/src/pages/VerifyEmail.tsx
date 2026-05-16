import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';

const extractRetryAfterSeconds = (message: string) => {
  const match = message.match(/Please wait (\d+) second/);
  return match ? Number(match[1]) : null;
};

export default function VerifyEmail() {
  const {
    user,
    logout,
    sendEmailVerificationCode,
    verifyEmailVerificationCode,
  } = useAuthContext() as {
    user: { email?: string | null; emailVerified?: boolean; onboardingCompleted?: boolean } | null;
    logout: () => Promise<void>;
    sendEmailVerificationCode: () => Promise<{ message: string; retryAfterSeconds?: number }>;
    verifyEmailVerificationCode: (code: string) => Promise<{ message: string; isVerified: boolean }>;
  };

  const [code, setCode] = useState('');
  const [statusMessage, setStatusMessage] = useState('Sending your verification code...');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // On mount, always request a fresh code. This ensures the user receives a
  // code even if the fire-and-forget send during signup failed silently (e.g.
  // due to a network blip or email service error). If a code was already sent
  // within the cooldown window the backend returns 429 with a retryAfterSeconds
  // value — we surface that as a countdown so the UI stays consistent.
  useEffect(() => {
    let cancelled = false;
    const requestCode = async () => {
      try {
        const response = await sendEmailVerificationCode();
        if (cancelled) return;
        setStatusMessage(response.message || 'Code sent — check your inbox.');
        if (typeof response.retryAfterSeconds === 'number') {
          setCountdown(response.retryAfterSeconds);
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : '';
        const retryAfterSeconds = extractRetryAfterSeconds(message);
        if (typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0) {
          // A code was already sent recently — that's fine, it will arrive.
          setCountdown(retryAfterSeconds);
          setStatusMessage('A code was recently sent — check your inbox or spam folder.');
        } else {
          setStatusMessage(message || 'Could not send the code. Use the Resend button below to try again.');
        }
      }
    };
    void requestCode();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;

    const timer = window.setTimeout(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [countdown]);

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setStatusMessage('Checking your code...');
      await verifyEmailVerificationCode(code);
      setStatusMessage('Code accepted. Taking you to the next step...');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to verify that code right now.';
      setStatusMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    try {
      setIsResending(true);
      const response = await sendEmailVerificationCode();
      setStatusMessage(response.message);
      setCountdown(typeof response.retryAfterSeconds === 'number' ? response.retryAfterSeconds : 45);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to resend the verification code right now.';
      const retryAfterSeconds = extractRetryAfterSeconds(message);
      if (typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0) {
        setCountdown(retryAfterSeconds);
      }
      setStatusMessage(message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-gray-800 bg-gray-900/95 p-6 text-white shadow-[0_30px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            aria-label="Back to home"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-gray-700 bg-gray-800/70 text-gray-200 transition hover:border-pink-500/40 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <button
            type="button"
            onClick={() => void logout()}
            className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 transition hover:text-white"
          >
            Use another email
          </button>
        </div>

        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-pink-500/12 text-pink-300">
            <MailCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white">Verify your email</h1>
          <p className="mt-3 text-sm leading-6 text-gray-300">
            We sent a one-time code to <span className="font-semibold text-white">{user?.email || 'your email'}</span>.
          </p>
        </div>

        <form onSubmit={handleVerify} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-300">Verification code</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full rounded-2xl border border-gray-700 bg-gray-800/80 px-4 py-3 text-center text-2xl font-semibold tracking-[0.35em] text-white outline-none transition focus:border-pink-500 focus:ring-2 focus:ring-pink-500/30"
              placeholder="123456"
              required
            />
          </label>

          <button
            type="submit"
            disabled={isSubmitting || code.length !== 6}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:from-pink-400 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Verifying...' : 'Verify and continue'}
          </button>
        </form>

        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-gray-800 bg-black/20 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <p className="text-sm leading-6 text-gray-300">{statusMessage}</p>
          </div>

          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || countdown > 0}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-700 bg-gray-800/70 px-4 py-2 text-sm font-medium text-white transition hover:border-gray-600 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isResending ? 'animate-spin' : ''}`} />
            {isResending ? 'Sending code...' : countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
          </button>
        </div>
      </div>
    </div>
  );
}
