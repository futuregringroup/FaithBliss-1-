# FaithBliss — Technical Debt Report

> **Version:** 1.0 | **Last Updated:** May 2026
>
> Based on direct code inspection. Issues are prioritized by impact on maintainability, scalability, and developer experience.

---

## Summary

| Priority | Count | Description |
|---|---|---|
| P1 — High (fix soon) | 6 | Structural problems that slow down development or hide bugs |
| P2 — Medium (next sprint) | 8 | Patterns that cause friction or accumulate risk over time |
| P3 — Low (backlog) | 7 | Inconsistencies and minor improvements |

---

## P1 — High Priority

### TD-01: `matchController.ts` Handles Both Matching AND Messaging (1000+ lines)

**File:** `backend/src/controllers/matchController.ts`

This single controller handles two completely separate domains:
- **Match logic:** likeUser, passUser, unmatchUser, unmatchAndBlockUser, getPotentialMatches, getMutualMatches, getSentMatches, getPassedProfiles, getReceivedMatches
- **Message logic:** getMatchMessages, uploadMessageAttachment, getMatchConversations, getMediaLibrary, markMessageAsRead

The file is over 1,000 lines. This makes it:
- Hard to navigate — you have to search for functions across a huge file
- Hard to test in isolation (if tests are ever added)
- High merge conflict risk — any two developers touching matches or messages will conflict
- Violates single responsibility principle

**Fix:** Split into two files:
```
backend/src/controllers/
  matchController.ts    ← match logic only (like, pass, unmatch, block, get matches)
  messageController.ts  ← message logic only (conversations, send, attach, react, read)
```

Update `backend/src/routes/matchRoutes.ts` and `backend/src/routes/messageRoutes.ts` imports accordingly.

---

### TD-02: `paymentController.ts` Handles Too Many Concerns (1000+ lines)

**File:** `backend/src/controllers/paymentController.ts`

This file combines:
- Subscription initialization and verification
- Profile booster purchase
- Webhook handling
- Admin analytics
- Regional pricing logic
- Exchange rate fetching
- Paystack plan management

**Fix:** Extract into:
```
backend/src/controllers/
  paymentController.ts         ← initialize, verify, webhook, auto-renew
  adminPaymentController.ts    ← analytics, admin record management
backend/src/services/
  subscriptionService.ts       ← subscription state management
  profileBoosterService.ts     ← booster credit/activation (extract from utils)
```

---

### TD-03: MongoDB Connected but Purpose Unclear

**File:** `backend/src/server.ts`

```typescript
mongoose.connect(process.env.MONGO_URI!)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));
```

MongoDB connects on every server boot and adds startup latency, but:
- The primary database is Firestore (all controllers write to Firestore)
- No controller was found routing critical user data exclusively through Mongoose models
- `backend/src/models/` contains schemas but their active usage is unclear

**Risk:** 
- Unnecessary dependency and startup latency
- Two databases in flight means two potential failure points
- New developers assume MongoDB is actively used and may write data there

**Fix:**
1. Audit every file in `backend/src/models/` — identify if any endpoint writes to these models
2. If unused: remove `mongoose.connect()`, remove `mongoose` from `package.json`
3. If used for specific features: document exactly which features use MongoDB vs Firestore

---

### TD-04: Legacy Auth Middleware Coexists with Active Middleware

**Files:**
- `backend/src/middleware/authMiddleware.ts` — active, used by all routes
- `backend/src/middleware/firebaseAuth.ts` — legacy, no routes import it

Having two auth middleware files in the same directory is a maintenance trap. A future developer may accidentally import the wrong one, or assume both are needed.

**Fix:**
```bash
# Verify no routes import firebaseAuth.ts
grep -r "firebaseAuth" backend/src/routes/
# If clean, delete:
rm backend/src/middleware/firebaseAuth.ts
```

---

### TD-05: Passport.js Configured but No Routes Use It

**Files:**
- `backend/src/config/passport.ts`
- `backend/package.json` — `passport`, `passport-google-oauth20`

Google OAuth via Passport.js was presumably planned or used in an earlier version. Currently:
- `passport.ts` reads `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` from env
- No route file registers any `/auth/google` endpoint
- The frontend uses Firebase's `signInWithPopup` for Google OAuth — Passport.js is entirely redundant

**Fix:**
```bash
cd backend
pnpm remove passport passport-google-oauth20
rm src/config/passport.ts
# Remove GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL from .env.example
```

---

### TD-06: Background Services Cannot Run on Vercel Serverless

**Files:**
- `backend/src/services/storyCleanupService.ts` — `setInterval` every 5 minutes
- `backend/src/services/subscriptionRenewalService.ts` — `setInterval` every 15 minutes
- `backend/src/server.ts` — starts both services on boot

Vercel serverless functions are stateless and ephemeral. Each invocation is a new process — `setInterval` timers created during one invocation are destroyed when that invocation ends (typically in seconds). These services will silently never fire in production on Vercel.

**Symptoms:**
- Stories never expire (accumulate forever in Firestore)
- Subscriptions never auto-renew (users lose access without notification)

**Fix Options:**

Option A — Vercel Cron Jobs (easiest):
```json
// vercel.json (backend)
{
  "crons": [
    { "path": "/api/cron/cleanup-stories", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/renew-subscriptions", "schedule": "*/15 * * * *" }
  ]
}
```
Create corresponding route handlers that call the service logic once (not in a loop).

Option B — Deploy backend to a long-running platform (Railway, Render, DigitalOcean App Platform) where the Node.js process persists.

---

## P2 — Medium Priority

### TD-07: `useAuth.tsx` is a 300+ Line Auth Implementation, Not a Hook

**File:** `frontend/src/hooks/useAuth.tsx`

This file contains the entire auth implementation: Firebase listeners, Firestore reads, token management, onboarding submission, password reset, profile fetching. It's named like a hook but acts as an auth provider.

**Problem:** The naming misleads contributors into treating it like a lightweight consumer hook rather than the core auth engine.

**Fix:** Rename and reorganize:
```
frontend/src/auth/
  AuthProvider.tsx         ← the actual provider (moved from hooks/)
  useAuthContext.tsx        ← thin consumer hook (already exists as useAuthContext)
```

This doesn't change functionality but dramatically clarifies intent.

---

### TD-08: `useAPI.tsx` Contains One Generic Hook + Eight Specific Hooks

**File:** `frontend/src/hooks/useAPI.tsx`

The file exports:
- `useApi<T>` — generic hook
- `useUserProfile()` — fetches own profile
- `usePotentialMatches()` — swipe deck
- `useMatching()` — match/skip actions
- `useStories()` — story feed
- `useConversations()` — chat list
- `useConversationMessages()` — single thread
- `useNotifications()` — notifications
- `useSubscription()` — subscription info

A file with 8+ exported hooks becomes a catch-all. Adding a new API hook means touching this file, increasing merge conflict risk.

**Fix:** Split into domain files:
```
frontend/src/hooks/
  useApi.tsx                 ← generic hook only
  useMatches.tsx             ← usePotentialMatches, useMatching
  useMessages.tsx            ← useConversations, useConversationMessages
  useNotifications.tsx       ← useNotifications
  useProfile.tsx             ← useUserProfile
  useSubscription.tsx        ← useSubscription
  useStories.tsx             ← useStories
```

---

### TD-09: `App.tsx` Polls Feature Settings Excessively

**File:** `frontend/src/App.tsx`

Feature settings (maintenance mode, shutdown mode) are fetched:
- On component mount
- Every 15 seconds via `setInterval`
- On window focus (`visibilitychange`)
- On tab visibility change (`blur`/`focus`)
- On storage events

Feature flags like "maintenance mode" change at most once every few hours (admin sets them manually). Polling every 15 seconds + on every focus event creates unnecessary API calls.

**Fix:**
```typescript
// Use exponential backoff or a much longer interval
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes instead of 15 seconds

// Remove the focus/blur/storage event listeners for this specific use case
// Or add a minimum 60-second debounce between refetches
```

---

### TD-10: Dual Photo Upload Paths Create Developer Confusion

**Files:**
- `frontend/src/api/cloudinaryUpload.ts` — direct browser → Cloudinary (used in onboarding)
- `backend/src/routes/photoRoutes.ts` + `uploadRoutes.ts` — server-side upload endpoints

There are two separate code paths for uploading photos:
1. Onboarding uses direct browser upload to Cloudinary (bypasses backend)
2. Profile photo management uses the backend upload endpoints

This is intentional (Vercel's 4.5MB request body limit), but it's not documented anywhere and creates confusion:
- New developers don't know which path to use for new upload features
- The Cloudinary credentials/upload preset needed for direct upload are different from server-side
- Error handling differs between the two paths

**Fix:** Add a comment in both files explaining the design decision and when to use each path. Consider consolidating by using Cloudinary's signed upload URLs from the backend (both paths go through the backend for the URL, then upload directly to Cloudinary).

---

### TD-11: Dashboard Component Folder Has No Barrel Export

**File:** `frontend/src/components/dashboard/`

18 components in this folder are all imported using full paths:
```typescript
import DashboardPage from '../components/dashboard/DashboardPage';
import DesktopLayout from '../components/dashboard/DesktopLayout';
import MobileLayout from '../components/dashboard/MobileLayout';
// ... 15 more
```

**Fix:** Add `frontend/src/components/dashboard/index.ts`:
```typescript
export { default as DashboardPage } from './DashboardPage';
export { default as DesktopLayout } from './DesktopLayout';
export { default as MobileLayout } from './MobileLayout';
// ...
```

Then imports become:
```typescript
import { DashboardPage, DesktopLayout } from '../components/dashboard';
```

---

### TD-12: No Test Coverage Anywhere

**Files:** `frontend/package.json`, `backend/package.json`

Neither the frontend nor backend has any test infrastructure:
- `backend/package.json` script: `"test": "echo \"Error: no test specified\" && exit 1"`
- No `vitest.config.ts`, `jest.config.ts`, or test files exist

This means:
- Regressions go undetected until they hit production
- Refactoring is risky (no safety net)
- Contributors have no way to verify their changes don't break existing behavior

**Fix (minimal viable):**
```bash
# Backend
cd backend
pnpm add -D vitest @vitest/coverage-v8 supertest @types/supertest
# Write tests for: protect middleware, validateOnboardingPayload, chatAccess, profileBooster

# Frontend
cd frontend
pnpm add -D vitest @testing-library/react @testing-library/user-event jsdom
# Write tests for: useAuth logic, api-client.ts, route guards
```

---

### TD-13: Inconsistent API Response Envelope

**Files:** `backend/src/controllers/*.ts`

API responses have no consistent shape:
```typescript
// Some return:
res.json({ message: 'Success', user: { ... } })

// Others return:
res.json({ error: 'Something went wrong' })

// Others return the data directly:
res.json({ matches: [ ... ] })

// Others return:
res.json({ success: true, data: { ... } })
```

This forces frontend code to handle multiple shapes and makes it hard to build generic error handling.

**Fix:** Standardize on a response envelope:
```typescript
// Success
res.status(200).json({ ok: true, data: { ... } })

// Error
res.status(4xx).json({ ok: false, message: 'Human-readable error' })
```

Apply via a helper:
```typescript
// backend/src/utils/response.ts
export const ok = (res: Response, data: any, status = 200) =>
  res.status(status).json({ ok: true, data });

export const fail = (res: Response, message: string, status = 400) =>
  res.status(status).json({ ok: false, message });
```

---

### TD-14: Pre-render Build Scripts Are Undocumented

**Files:**
- `frontend/scripts/build-prerender.mjs`
- `frontend/scripts/check-prerender.mjs`

These scripts run as part of `pnpm build` and generate static HTML for public routes (`/about`, `/contact`, `/privacy`, etc.). They are not documented anywhere — a new developer who sees the build output directory with multiple `index.html` files won't know why they're there or how to add a new pre-rendered route.

**Fix:** Add a comment block at the top of each script explaining:
- What the script does
- Which routes get pre-rendered and why
- How to add a new pre-rendered route
- What `app-shell.html` is (SPA shell for auth'd routes)

---

## P3 — Low Priority

### TD-15: `zustand` Imported but Usage Is Minimal

**File:** `frontend/package.json`, various component files

Zustand is installed as a dependency but its actual usage in the codebase appears minimal — most state is managed via React Context (`AuthContext`, `ToastContext`) or component `useState`.

**Fix:** Either document exactly what global state is managed in Zustand stores (and create a `frontend/src/store/` directory with clearly named stores), or remove the dependency if unused:
```bash
pnpm remove zustand
```

---

### TD-16: Hardcoded Swipe Limit and Business Rules in Controllers

**File:** `backend/src/controllers/matchController.ts`

Business rules like the daily swipe limit (`10` swipes for free users) and pass cooldown (`24 hours`) are hardcoded as magic numbers directly in controller logic.

**Fix:** Extract to a constants file:
```typescript
// backend/src/constants/businessRules.ts
export const FREE_DAILY_SWIPE_LIMIT = 10;
export const PASS_COOLDOWN_HOURS = 24;
export const PROFILE_BOOSTER_DURATION_HOURS = 1;
export const STORY_EXPIRY_HOURS = 24;
```

This makes rule changes a one-line edit rather than a codebase search.

---

### TD-17: No Structured Logging — `console.log` Throughout Backend

**Files:** `backend/src/services/`, `backend/src/controllers/`, `backend/src/server.ts`

The backend uses `console.log`, `console.error`, and `console.warn` directly. In production on Vercel, these appear in the function logs but:
- No log levels (can't filter warnings vs debug)
- No structured format (hard to search/aggregate)
- Risk of accidentally logging sensitive data (tokens, user PII)

**Fix:**
```bash
cd backend
pnpm add pino pino-pretty
```

```typescript
// backend/src/lib/logger.ts
import pino from 'pino';
export const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Usage
logger.info({ userId, action: 'like' }, 'User liked a profile');
logger.error({ err, userId }, 'Failed to process payment');
```

---

### TD-18: `discoverController.ts` and `matchController.ts` Both Handle Profile Discovery

**Files:**
- `backend/src/controllers/matchController.ts` — `getPotentialMatches()`
- `backend/src/controllers/discoverController.ts` — `filterProfiles()`, `discoverByProfileFit()`, `discoverByInterests()`

There are two controllers that do profile discovery. `getPotentialMatches` (in matchController) and `filterProfiles` (in discoverController) have overlapping logic (both exclude liked/passed/matched/blocked users, both sort by booster status).

**Fix:** Move `getPotentialMatches` to `discoverController.ts` — all discovery logic lives in one place. The match controller only handles the social graph (like, pass, match creation).

---

### TD-19: TypeScript `any` Usage in Some Controllers

**Files:** `backend/src/controllers/`

Some controllers use `any` types when destructuring Firestore document data:
```typescript
const userData = userDoc.data() as any;
```

This defeats TypeScript's purpose in those sections.

**Fix:** Create a `FirestoreUser` interface in `backend/src/types/` that mirrors the Firestore user document structure, and cast properly:
```typescript
import { FirestoreUser } from '../types/FirestoreUser';
const userData = userDoc.data() as FirestoreUser;
```

---

### TD-20: No Documented Git Branching Strategy

**File:** No `CONTRIBUTING.md` or branching documentation

The repository has no documented contribution guidelines, branching strategy, or PR process. This leads to inconsistent commit messages, direct commits to main, and unclear PR expectations.

**Fix:** Create `CONTRIBUTING.md` at the project root covering:
- Branch naming convention
- Commit message format
- PR template
- Review requirements
- Release process

---

### TD-21: `frontend/src/hooks/useAuth.tsx` Silently Falls Back to Cached User on Firestore Errors

**File:** `frontend/src/hooks/useAuth.tsx`, `fetchUserDataFromFirestore()`

When Firestore is unavailable, the auth hook silently falls back to a cached user from localStorage. While this improves offline resilience, it means a user could see stale profile data (old subscription status, old photos) without any indication that the data might be outdated.

**Fix:** Add a visible indicator (banner or toast) when the user is operating from cached data:
```typescript
if (firestoreError) {
  setIsUsingCachedData(true);
  showWarning('Using cached data — some information may be outdated');
}
```

---

## Suggested Refactoring Roadmap

### Sprint 1 (1–2 weeks)
- TD-01: Split matchController
- TD-02: Split paymentController
- TD-04: Delete legacy firebaseAuth.ts
- TD-05: Remove Passport.js
- TD-06: Fix background services for Vercel (Cron Jobs)

### Sprint 2 (1–2 weeks)
- TD-07: Rename useAuth.tsx → AuthProvider.tsx
- TD-08: Split useAPI.tsx into domain hooks
- TD-09: Reduce App.tsx polling frequency
- TD-13: Standardize response envelope
- TD-17: Add structured logging (pino)

### Sprint 3 (2–3 weeks)
- TD-12: Add test infrastructure + baseline tests for auth, onboarding validation, chat access
- TD-03: Audit and remove MongoDB
- TD-11: Add barrel exports to component folders

### Backlog (as time allows)
- TD-10: Document/consolidate photo upload paths
- TD-14: Document pre-render scripts
- TD-15: Clarify/remove Zustand
- TD-16: Extract business rules to constants
- TD-18: Consolidate discovery logic
- TD-19: Remove `any` casts
- TD-20: Create CONTRIBUTING.md
- TD-21: Cached data indicator
