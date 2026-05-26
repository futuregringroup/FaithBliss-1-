import rateLimit from 'express-rate-limit';

const isProd = process.env.NODE_ENV === 'production';

const json429 = (message: string) => ({
  status: 429,
  message,
});

// Auth: profile creation, onboarding — 10 req / 15 min in prod
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429('Too many auth requests. Please try again in 15 minutes.'),
});

// Payment actions: initialise, verify, profile booster — 20 req / 15 min
export const paymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429('Too many payment requests. Please try again in 15 minutes.'),
});

// Match / like / pass swipe actions — 120 req / min (2 swipes/sec on average)
export const matchRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: isProd ? 120 : 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429('Too many match actions. Please slow down.'),
});

// Support ticket submission — 5 req / hour
export const supportSubmitRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: isProd ? 5 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429('Too many support tickets submitted. Please wait before trying again.'),
});

// Global API fallback — 300 req / 15 min, skips health check
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 300 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429('Too many requests. Please try again in 15 minutes.'),
  skip: (req) => req.path === '/api/health',
});
