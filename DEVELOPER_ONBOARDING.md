# FaithBliss — Developer Onboarding Guide

> **Version:** 1.0 | **Last Updated:** May 2026
>
> This guide takes a new developer from zero to a fully running local environment. Read it top to bottom on your first day.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Clone & Install](#2-clone--install)
3. [Firebase Project Setup](#3-firebase-project-setup)
4. [Environment Configuration](#4-environment-configuration)
5. [Run Locally](#5-run-locally)
6. [Test the Full App Flow](#6-test-the-full-app-flow)
7. [Android Development](#7-android-development)
8. [Deploying Frontend](#8-deploying-frontend)
9. [Deploying Backend](#9-deploying-backend)
10. [Codebase Orientation](#10-codebase-orientation)
11. [Coding Conventions](#11-coding-conventions)
12. [Git Workflow](#12-git-workflow)
13. [Debugging Guide](#13-debugging-guide)

---

## 1. Prerequisites

Install these before anything else:

| Tool | Version | Install |
|---|---|---|
| Node.js | 24.x | https://nodejs.org |
| pnpm | 9.15.0 | `npm install -g pnpm@9.15.0` |
| Firebase CLI | latest | `npm install -g firebase-tools` |
| Git | any | https://git-scm.com |
| Java JDK | 21 (Android only) | https://adoptium.net |
| Android Studio | latest (Android only) | https://developer.android.com/studio |

**Verify your setup:**
```bash
node --version    # should be v24.x
pnpm --version    # should be 9.15.0
firebase --version
java -version     # Android only
```

---

## 2. Clone & Install

```bash
# Clone the repo
git clone <repo-url>
cd FaithBliss-1-

# Install frontend dependencies
cd frontend
pnpm install

# Install backend dependencies
cd ../backend
pnpm install
```

**Dependency notes:**
- Frontend uses `pnpm` with a lockfile — always use `pnpm install`, never `npm install`
- Backend uses `pnpm` as well
- Never delete `pnpm-lock.yaml` files — they ensure reproducible installs

---

## 3. Firebase Project Setup

You need a Firebase project with Firestore and Google Auth enabled.

### Option A: Use the existing project (team members)

Get the service account JSON from a team lead. Skip to [Section 4](#4-environment-configuration).

### Option B: Create your own Firebase project (new contributors)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g., `faithbliss-dev`)
3. Enable **Authentication**:
   - Authentication → Sign-in method → Google → Enable
   - Add your email as a test user if using emulators
4. Enable **Firestore**:
   - Firestore Database → Create database → Start in production mode
   - Choose region (us-central1 recommended)
5. Get your **web config keys**:
   - Project settings → General → Your apps → Add web app
   - Copy the `firebaseConfig` object values
6. Generate a **service account key** (for backend):
   - Project settings → Service accounts → Generate new private key
   - Save as `serviceAccountKey.json`
7. Encode the service account for the backend env var:
   ```bash
   # macOS / Linux
   base64 -i serviceAccountKey.json | tr -d '\n'

   # Windows PowerShell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes('serviceAccountKey.json'))
   ```
   Copy the output — this is your `FIREBASE_CREDENTIALS_BASE64`.

8. Deploy Firestore rules and indexes:
   ```bash
   firebase login
   firebase use --add   # select your project
   firebase deploy --only firestore:rules,firestore:indexes
   ```

---

## 4. Environment Configuration

### Frontend: `frontend/.env`

Copy the example and fill in values:
```bash
cp frontend/.env.example frontend/.env
```

```env
# Backend REST API (local dev)
VITE_API_URL=http://localhost:5000

# WebSocket server (same as backend for local dev)
VITE_WEBSOCKET_URL=http://localhost:5000

# Firebase client keys (from Firebase console → Project settings → Your apps)
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# Primary admin email (your email for local dev)
VITE_PRIMARY_ADMIN_EMAIL=your@email.com
```

### Backend: `backend/.env`

```bash
cp backend/.env.example backend/.env
```

```env
PORT=5000
NODE_ENV=development

# Frontend URL for CORS
CLIENT_URL=http://localhost:5173

# MongoDB (optional for local — most features use Firestore)
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/faithbliss

# Firebase Admin SDK (base64-encoded service account JSON)
FIREBASE_CREDENTIALS_BASE64=eyJ0eXBlIjoic2Vydmljal9hY2...

# Cloudinary (create free account at cloudinary.com)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your-secret

# Paystack (use test keys from dashboard.paystack.com)
PAYSTACK_SECRET_KEY=sk_test_...
PAYSTACK_PLAN_CODE_PREMIUM_MONTHLY=PLN_...
PAYSTACK_PLAN_CODE_PREMIUM_QUARTERLY=PLN_...

# Email webhook (optional for local dev — leave blank to skip emails)
EMAIL_WEBHOOK_URL=

# Admin email (same as VITE_PRIMARY_ADMIN_EMAIL)
PRIMARY_ADMIN_EMAIL=your@email.com
```

### Variable Reference

| Variable | Required? | Where to get it |
|---|---|---|
| `VITE_FIREBASE_*` | Yes | Firebase console → Project settings |
| `FIREBASE_CREDENTIALS_BASE64` | Yes | Firebase console → Service accounts → Generate key → encode |
| `CLOUDINARY_*` | Yes (for photos) | cloudinary.com → Dashboard |
| `PAYSTACK_SECRET_KEY` | Yes (for payments) | dashboard.paystack.com → Settings → API Keys |
| `PAYSTACK_PLAN_CODE_*` | Yes (for subscriptions) | Paystack dashboard → Products → Plans |
| `MONGO_URI` | Recommended | MongoDB Atlas cluster connection string |
| `EMAIL_WEBHOOK_URL` | Optional | Your email service webhook URL |
| `PRIMARY_ADMIN_EMAIL` | Yes | Your own email |

---

## 5. Run Locally

You need **two terminal windows** running simultaneously.

### Terminal 1 — Backend

```bash
cd backend
pnpm dev
```

Expected output:
```
Server running on port 5000
MongoDB connected (or MongoDB connection error if MONGO_URI not set)
```

The backend runs at: `http://localhost:5000`

Health check: `GET http://localhost:5000/api/health`

### Terminal 2 — Frontend

```bash
cd frontend
pnpm dev
```

Expected output:
```
  VITE v7.x.x  ready in 800ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open `http://localhost:5173` in your browser.

---

## 6. Test the Full App Flow

Follow this sequence to verify everything works end-to-end:

### Step 1: Sign In
- Click "Continue with Google"
- Complete the Google OAuth popup
- You should land on `/onboarding`

### Step 2: Complete Onboarding
- Upload **at least 3 profile photos** (required)
- Fill in all required fields (name, age, gender, location, denomination, bio)
- Complete all 13 slides
- Click "Finish" → should redirect to `/dashboard`

### Step 3: Test Discovery
- The swipe deck should load profiles (if test users exist in Firestore)
- Try liking a profile: `POST /api/matches/like/:userId` should fire

### Step 4: Test Messaging
- Create a mutual match (two test accounts both like each other)
- Navigate to `/messages` → open conversation → send a message
- Verify it appears in real-time (WebSocket)

### Step 5: Test Admin
- Your account email must match `VITE_PRIMARY_ADMIN_EMAIL` / `PRIMARY_ADMIN_EMAIL`
- Visit `/admin` — you should see the admin dashboard

### Step 6: Test Payments (optional)
- Visit `/purchases`
- Use Paystack test card: `4084084084084081`, any future date, `408`
- Verify subscription status updates after webhook

**Paystack Webhook Local Testing:**
Use [ngrok](https://ngrok.com) to expose your local backend:
```bash
ngrok http 5000
# Copy the https URL → set as webhook in Paystack dashboard
```

---

## 7. Android Development

### Prerequisites
- Java JDK 21 installed
- Android Studio installed with an emulator configured
- Android SDK installed (via Android Studio)

### Initial Setup
```bash
cd frontend

# Add Android platform (first time only)
pnpm cap:add:android

# Build and sync
pnpm android:prepare
```

### Open in Android Studio
```bash
pnpm cap:open
# OR
npx cap open android
```

### Run on Emulator
```bash
pnpm android:run
```

### Signing for Release
The signing keystore is managed via GitHub Actions secrets for CI. For local builds:
1. Generate a keystore: `keytool -genkey -v -keystore my-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias my-alias`
2. Configure `frontend/android/app/build.gradle` with signing config
3. Build: `./gradlew bundleRelease` from `frontend/android/`

### Capacitor Config
`frontend/capacitor.config.ts` — adjust `server.url` for local development:
```typescript
server: {
  url: 'http://10.0.2.2:5173',  // Android emulator localhost
  cleartext: true
}
```

---

## 8. Deploying Frontend

### Option A: Firebase Hosting (current setup)

```bash
cd frontend
pnpm build

cd ..  # back to project root
firebase login
firebase deploy --only hosting
```

**What happens:**
1. `pnpm build` → TypeScript compile + Vite build + pre-render scripts → `frontend/dist/`
2. `firebase deploy` → uploads `frontend/dist/` to Firebase CDN

### Option B: Vercel (alternative)

```bash
cd frontend
vercel --prod
```

The `frontend/vercel.json` handles routing + Firebase Auth proxy automatically.

### Build Process Details

`pnpm build` runs three steps:
```bash
tsc -b                              # TypeScript type check + compile
node scripts/build-prerender.mjs    # Generate static HTML for public routes
node scripts/check-prerender.mjs    # Validate pre-rendered output
```

Pre-rendered routes: `/`, `/about`, `/contact`, `/privacy`, `/terms`, `/help`, `/premium`

These are served as static HTML for SEO — the rest of the app is a standard SPA.

---

## 9. Deploying Backend

### Vercel (current setup)

```bash
cd backend
vercel --prod
```

Vercel reads `backend/vercel.json`:
- Entry: `api/index.ts`
- Runtime: `@vercel/node`
- All routes → Express app

**Set environment variables in Vercel dashboard:**
- Go to your Vercel project → Settings → Environment Variables
- Add all variables from `backend/.env.example`
- Set `NODE_ENV=production`

**Important:** The background services (story cleanup, subscription renewal) **do not run on Vercel serverless**. See [Tech Debt Report](./TECH_DEBT_REPORT.md) for options.

### Alternative: Long-Running Server (Railway / Render / DigitalOcean)

For background services to work:

```bash
# Build
cd backend
pnpm build     # tsc → dist/

# Start
pnpm start     # node dist/server.js
```

Set all env vars on your hosting platform. Background services start automatically on `server.ts` boot.

---

## 10. Codebase Orientation

### Where to find things

| What you're looking for | Where to look |
|---|---|
| All routes | `frontend/src/main.tsx` |
| API call to backend | `frontend/src/services/api.ts` + `api-client.ts` |
| Auth logic | `frontend/src/hooks/useAuth.tsx` |
| Firebase config | `frontend/src/firebase/config.ts` |
| Backend entry point | `backend/src/server.ts` |
| A specific API endpoint | `backend/src/routes/*.ts` → `backend/src/controllers/*.ts` |
| Firestore write logic | `backend/src/controllers/*.ts` |
| Real-time events | `backend/src/socket/socket.ts` |
| Payment logic | `backend/src/controllers/paymentController.ts` |
| Feature flags | `backend/src/controllers/userController.ts` (getFeatureSettings) |
| TypeScript types | `frontend/src/types/*.ts` |
| Environment variables | `frontend/.env.example` + `backend/.env.example` |

### Key Files — Must Know

| File | Why it matters |
|---|---|
| `frontend/src/main.tsx` | All routes live here. Change routing here. |
| `frontend/src/hooks/useAuth.tsx` | Auth state, Google sign-in, onboarding submission. Touch carefully. |
| `frontend/src/services/api-client.ts` | Every REST call goes through here. |
| `frontend/src/services/WebSocketService.ts` | All real-time events defined here. |
| `backend/src/server.ts` | Middleware, route registration, service startup. |
| `backend/src/middleware/authMiddleware.ts` | Token validation. All protected routes use this. |
| `backend/src/controllers/matchController.ts` | Match AND message logic. Very large file. |
| `backend/src/controllers/paymentController.ts` | Payment logic. Very large file. |
| `firestore.rules` | Security rules. Changing these affects what users can access directly. |

---

## 11. Coding Conventions

### TypeScript
- Strict mode is enabled (`tsconfig.json` → `"strict": true`)
- No `any` types — use proper interfaces or `unknown`
- All new functions must have explicit return types
- Use types from `frontend/src/types/` — don't duplicate interfaces

### Styling
- **Tailwind only** — no new CSS files, no inline `style` attributes
- Custom theme values are in `frontend/tailwind.config.js` — use those tokens
- Dark mode is handled via CSS variables in `frontend/src/index.css`
- Mobile-first: write base styles for mobile, add `lg:` overrides for desktop

### API Calls (Frontend)
- Always go through `api.ts` facade, never call `api-client.ts` directly from components
- Use the `useAPI` hook for data fetching with caching
- Never store raw API responses in localStorage — use the auth token only

### Firestore (Backend)
- All Firestore writes go through the backend (never from the frontend except `syncUserFromFirebase`)
- Use `{ merge: true }` on `doc.set()` to avoid overwriting unrelated fields
- Always use `admin.firestore.FieldValue.serverTimestamp()` for timestamps

### Error Handling
- Backend controllers: return `res.status(4xx/5xx).json({ message: '...' })`
- Frontend: use `showError()` from `useToast()` hook for user-facing errors
- Never `console.error` sensitive data (tokens, passwords, PII)

### Comments
- Only comment non-obvious logic — don't explain what the code does, explain *why*
- No TODO comments in committed code — create a GitHub issue instead

---

## 12. Git Workflow

### Branching

```
main                  ← production (protected)
  └── feature/your-feature-name
  └── fix/bug-description
  └── chore/maintenance-task
```

### Creating a Branch

```bash
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

### Committing

```bash
git add frontend/src/components/YourComponent.tsx
git commit -m "feat(component): add denomination filter to swipe deck"
```

**Commit message format:** `type(scope): short description`
- Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`
- Keep under 72 characters
- Use present tense ("add", not "added")

### Pull Requests

1. Push your branch: `git push origin feature/your-feature-name`
2. Open a PR on GitHub → `main`
3. PR description: what changed + how to test + screenshots if UI
4. At least one review required before merge
5. Squash merge preferred to keep main history clean

### Never Do

- Force push to `main`
- Commit `.env` files (already in .gitignore)
- Commit `serviceAccountKey.json`
- Commit `node_modules/`

---

## 13. Debugging Guide

### Firebase Auth Issues

**Problem:** "auth/popup-blocked" on mobile
**Fix:** `useAuth.tsx` handles this — falls back to `signInWithRedirect`. Test in a real mobile browser, not desktop emulation.

**Problem:** "auth/network-request-failed"
**Fix:** Likely a network issue or Firebase project misconfiguration. Check `VITE_FIREBASE_AUTH_DOMAIN` — must be the Firebase default domain (`your-project.firebaseapp.com`), not a custom domain.

**Problem:** 401 on all API calls after login
**Fix:** Check that `VITE_API_URL` matches where your backend is actually running. Verify the Firebase token is in localStorage (`accessToken` key).

### CORS Issues

**Problem:** "CORS error" in browser console
**Fix:** Check `backend/src/server.ts` CORS config — your frontend URL must be in the allowed origins list. For local dev: `http://localhost:5173` must be in the whitelist or `CLIENT_URL` env var.

### Photo Upload Failures

**Problem:** Cloudinary upload fails during onboarding
**Fix:** Check `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in backend `.env`. For direct browser uploads (onboarding), verify the Cloudinary upload preset allows unsigned uploads if used.

**Problem:** "Request Entity Too Large" from Vercel
**Fix:** Onboarding photos go directly to Cloudinary from the browser (bypassing Vercel). Message attachments go through `POST /api/messages/attachments` — Vercel has a 4.5MB limit for serverless function request bodies. File larger than this must use the direct Cloudinary path.

### WebSocket Not Connecting

**Problem:** Real-time messages not working
**Fix:**
1. Check `VITE_WEBSOCKET_URL` points to your backend
2. Verify the backend is running and Socket.io is initialized
3. Check browser DevTools → Network → WS tab for connection attempts
4. Verify Firebase token is valid (not expired — 1 hour TTL)

### Onboarding Not Completing

**Problem:** `PUT /api/auth/complete-onboarding` returns 400
**Fix:**
- Must have at least 3 profile photos uploaded
- All required fields must be present (birthday, location, denomination, gender, bio, profileFits (3+), relationshipGoals (1+))
- Check the backend response body for the specific validation error message

### Background Services Not Running

**Problem:** Stories not expiring / subscriptions not auto-renewing
**Fix:** These run as `setInterval` timers in `server.ts`. They require a **persistent Node.js process**. They do NOT run on Vercel serverless. Deploy the backend to Railway, Render, or DigitalOcean App Platform for these to work.

### Paystack Webhook Not Firing Locally

**Fix:** Paystack can't reach `localhost`. Use ngrok:
```bash
ngrok http 5000
# Get URL like: https://abc123.ngrok.io
# Set in Paystack dashboard: https://abc123.ngrok.io/api/payments/webhook
```

### Admin Route Not Accessible

**Problem:** `/admin` redirects to dashboard even for admin user
**Fix:**
1. Ensure your email matches `PRIMARY_ADMIN_EMAIL` (backend) AND `VITE_PRIMARY_ADMIN_EMAIL` (frontend)
2. Or manually set `role: 'admin'` in your Firestore user document
3. Clear localStorage and re-login to refresh the user object

### Build Failures

**Problem:** `pnpm build` fails with TypeScript errors
**Fix:** Fix all TypeScript errors — the build is strict. Run `pnpm lint` to see ESLint issues too.

**Problem:** Pre-render script fails
**Fix:** The pre-render script (`scripts/build-prerender.mjs`) generates static HTML for public routes. Check if Vite built successfully first (`frontend/dist/` should exist).
