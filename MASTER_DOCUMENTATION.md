# FaithBliss — Master Documentation

> **Version:** 1.0 | **Last Updated:** May 2026 | **Stack:** React 19 · TypeScript · Vite · Express 5 · Firestore · Socket.io · Paystack · Cloudinary

---

## Table of Contents

1. [Executive Product Overview](#1-executive-product-overview)
2. [Full Application Architecture](#2-full-application-architecture)
3. [Folder & Codebase Walkthrough](#3-folder--codebase-walkthrough)
4. [Frontend Documentation](#4-frontend-documentation)
5. [Backend Documentation](#5-backend-documentation)
6. [Database Documentation](#6-database-documentation)
7. [UI/UX System Documentation](#7-uiux-system-documentation)
8. [User & Data Flow Walkthroughs](#8-user--data-flow-walkthroughs)

---

## 1. Executive Product Overview

### What is FaithBliss?

FaithBliss is a **faith-based Christian dating and community platform** targeting African Christians and the global diaspora. It connects believers seeking meaningful relationships grounded in shared faith, denomination, and values.

### Problem It Solves

General dating apps (Tinder, Bumble) lack faith-specific filters — denomination, church attendance, faith journey, spiritual gifts — making it hard for Christians to find partners whose spiritual life aligns with theirs. FaithBliss fills this gap with a product designed specifically for this audience.

### Target Users

- African Christians (primary — Nigeria focus for payments)
- Global African diaspora
- Any Christian seeking a faith-grounded relationship
- Ages 18–45, smartphone-first

### Core Value Proposition

| Pillar | Description |
|---|---|
| **Faith-First Matching** | Filter by denomination, faith journey, church attendance, spiritual gifts |
| **Community** | Prayer requests, blessings, events, posts — not just dating |
| **Safety** | Report system, blocking, account verification |
| **Affordability** | Nigeria NGN pricing, Africa regional pricing, Global USD pricing |
| **Mobile-First** | PWA + native Android (Capacitor) |

### Current Product Status

**Production-ready and live at `faithblissafrica.com`**

| System | Status |
|---|---|
| Authentication (Google OAuth) | ✅ Complete |
| Onboarding (13-step form) | ✅ Complete |
| Profile swipe / matching | ✅ Complete |
| Real-time messaging | ✅ Complete |
| Stories (24hr) | ✅ Complete |
| Community feed | ✅ Complete |
| Payments (Paystack, multi-region) | ✅ Complete |
| Admin dashboard | ✅ Complete |
| Android app (Capacitor) | ✅ Complete |
| PWA | ✅ Complete |
| Voice/video calling | ⚠️ Partial (signaling only, no WebRTC peer) |
| Email notifications | ⚠️ Partial (webhook-based, external) |

### Key Workflows

1. **Sign Up** → Google OAuth → Firestore profile created → Onboarding
2. **Onboarding** → 13-slide form (photos, faith, preferences) → Dashboard
3. **Discovery** → Swipe deck → Like → Mutual match → Chat unlocked
4. **Messaging** → Real-time WebSocket chat → Attachments, reactions, replies
5. **Premium** → Paystack payment → Subscription activated → Advanced filters + unlimited chats
6. **Community** → Posts, prayer requests, events → Engage with other believers

---

## 2. Full Application Architecture

See [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) for ASCII diagrams. Summary:

### Deployment Split

```
faithblissafrica.com  →  Firebase Hosting  →  frontend/dist/
api.faithblissafrica.com (or subdomain)  →  Vercel Serverless  →  backend/api/index.ts
```

### Third-Party Services

| Service | Role | SDK/Client |
|---|---|---|
| Firebase Auth | User authentication (Google OAuth) | `firebase` (client), `firebase-admin` (server) |
| Firestore | Primary database (NoSQL) | `firebase-admin` (server), `firebase` (client) |
| Cloud Storage | File storage | `firebase/storage` (client) |
| Cloudinary | Media CDN for profile photos, messages, stories | `cloudinary` (server), direct browser upload (onboarding) |
| Paystack | Payment processing (subscription + profile booster) | REST API via `paystackService.ts` |
| Socket.io | Real-time messaging, typing, presence, calls | `socket.io` (server), `socket.io-client` (client) |
| MongoDB Atlas | Legacy database (partially used) | `mongoose` |
| Capacitor | Android native wrapper | `@capacitor/core`, `@capacitor/android` |
| GitHub Actions | Android APK/AAB CI build | `.github/workflows/android-build.yml` |

---

## 3. Folder & Codebase Walkthrough

### Project Root

```
FaithBliss-1-/
├── frontend/               # React 19 + Vite + TypeScript SPA
├── backend/                # Express 5 + TypeScript API
├── .firebaserc             # Firebase project ID: faithbliss-79c63
├── firebase.json           # Firebase Hosting config + Firestore rules pointer
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore composite indexes
├── cors.json               # CORS policy for Firebase Storage
├── .gitignore              # Excludes: node_modules, .env, .firebase/
└── .github/
    └── workflows/
        └── android-build.yml  # Manual Android build CI
```

---

### Frontend Structure: `frontend/src/`

```
frontend/src/
├── main.tsx                # App entry point — providers, router, PWA, pre-render
├── App.tsx                 # Root layout — feature gates, route classification
├── index.css               # Global styles, CSS variables, Tailwind directives
├── vite-env.d.ts           # Vite env type declarations
│
├── firebase/
│   ├── config.ts           # Firebase init (auth, db, storage) with persistence fallback
│   └── storageHelpers.ts   # Firebase Cloud Storage upload utilities
│
├── contexts/
│   ├── AuthContext.tsx      # Auth state provider — wraps useAuth hook
│   └── ToastContext.tsx     # Toast notification state + methods
│
├── hooks/
│   ├── useAuth.tsx          # Core auth logic: googleSignIn, syncUser, logout, onboarding
│   ├── useAPI.tsx           # Generic + 8 specific data-fetching hooks with 5-min cache
│   ├── useWebSocket.ts      # Singleton WebSocket connection lifecycle manager
│   ├── useSession.ts        # Current Firebase auth session accessor
│   ├── useNotificationWebSocket.ts  # WebSocket notification-specific event handler
│   └── useSubscriptionDisplay.ts   # Subscription tier + currency formatting
│
├── services/
│   ├── api.ts              # API facade — namespaced methods (Auth, User, Matches, etc.)
│   ├── api-client.ts       # HTTP client — fetch wrapper with auth headers + cache
│   └── WebSocketService.ts # Socket.io-client class — all real-time event handling
│
├── pages/                  # 32 page components (see Section 4 for routing)
│   ├── Login.tsx
│   ├── SignUp.tsx
│   ├── ResetPassword.tsx
│   ├── VerifyEmail.tsx
│   ├── OnboardingPage.tsx
│   ├── Dashboard.tsx
│   ├── Profile.tsx
│   ├── UserProfileView.tsx
│   ├── Messages.tsx
│   ├── Notifications.tsx
│   ├── Community.tsx
│   ├── Explore.tsx
│   ├── Matches.tsx
│   ├── InAppPurchases.tsx
│   ├── PaymentSuccess.tsx
│   ├── Settings.tsx
│   ├── Report.tsx
│   ├── SafetyNote.tsx
│   ├── Deactivate.tsx
│   ├── Admin.tsx
│   ├── DeveloperHub.tsx
│   ├── OnboardingDebug.tsx
│   ├── Home.tsx
│   ├── About.tsx
│   ├── Contact.tsx
│   ├── Privacy.tsx
│   ├── Terms.tsx
│   ├── HelpRoute.tsx / PublicHelp.tsx
│   └── PremiumRoute.tsx / PublicPremium.tsx
│
├── components/
│   ├── AuthGate.tsx         # Route guards: AuthGate, PublicOnlyRoute, AdminRoute, DeveloperRoute
│   ├── SeoMetaManager.tsx   # Dynamic <head> meta tag injection per route
│   ├── NotificationListener.tsx  # WebSocket notification receiver + system notifications
│   ├── HeartBeatLoader.tsx  # Loading spinner with heart animation
│   ├── HeartBeatIcon.tsx    # Reusable heart animation icon
│   ├── Header.tsx           # Public site header
│   ├── Footer.tsx           # Public site footer
│   ├── InstallAppButton.tsx # PWA install prompt trigger
│   ├── CountryCodeSelect.tsx # Phone country code dropdown
│   ├── AppDropdown.tsx      # Generic dropdown component
│   ├── FadeIn.tsx           # Fade-in animation wrapper
│   ├── SuccessModal.tsx     # Generic success confirmation modal
│   ├── PostPaymentSurveyModal.tsx  # Post-purchase attribution survey
│   ├── ProfileBoosterIcon.tsx      # Booster badge UI
│   │
│   ├── dashboard/           # 18 files — entire dashboard UI system
│   │   ├── DashboardPage.tsx         # Root orchestrator — state, overlays, layout switch
│   │   ├── DesktopLayout.tsx         # 1024px+ layout: sidebar + main content
│   │   ├── MobileLayout.tsx          # <1024px layout: full-width + bottom nav
│   │   ├── TopBar.tsx                # Header with title, filters, menu
│   │   ├── SidePanel.tsx             # Left navigation sidebar
│   │   ├── MobileBottomNav.tsx       # Bottom tab bar for mobile
│   │   ├── SwipeDeck.tsx             # Swipeable card stack (Swiper)
│   │   ├── SwipeCard.tsx             # Individual swipe card layout
│   │   ├── HingeStyleProfileCard.tsx # Profile photo grid + info card
│   │   ├── ProfileDisplay.tsx        # Profile detail view (non-card)
│   │   ├── FilterPanel.tsx           # Advanced filter drawer
│   │   ├── StoryBar.tsx              # Story ring/avatar carousel
│   │   ├── OverlayPanels.tsx         # Overlay container
│   │   ├── MatchCelebrationOverlay.tsx      # "You matched!" animation
│   │   ├── PostOnboardingWelcomeOverlay.tsx # First-time dashboard welcome
│   │   ├── ProfileCompletionBanner.tsx      # Prompt to complete profile
│   │   ├── NoProfilesState.tsx              # Empty state (no more swipes)
│   │   └── FloatingActionButtons.tsx        # Like/skip floating CTAs (mobile)
│   │
│   ├── onboarding/          # 13 files — multi-step onboarding slide system
│   │   ├── OnboardingHeader.tsx             # Progress bar indicator
│   │   ├── OnboardingNavigation.tsx         # Back/Next buttons
│   │   ├── ImageUploadSlide.tsx             # Photo selection + crop
│   │   ├── ProfileBuilderSlide.tsx          # Name, age, gender, location
│   │   ├── LocationPermissionSlide.tsx      # Geolocation request
│   │   ├── MatchingPreferencesSlide.tsx     # Partner preferences
│   │   ├── RelationshipGoalsSlide.tsx       # Goals selection
│   │   ├── InterestsSelectionSlide.tsx      # Interests, hobbies, values
│   │   ├── PersonalEssenceSlide.tsx         # Faith journey, church, spiritual gifts
│   │   ├── LifestyleHabitsSlide.tsx         # Drinking, smoking, fitness habits
│   │   ├── ShareMoreAboutYouSlide.tsx       # Bio, verse, personality
│   │   ├── SelectableCard.tsx               # Reusable multi-select card
│   │   └── SelectWithOtherInput.tsx         # Select + "Other" text input
│   │
│   ├── profile/             # 7 files — profile edit sections
│   │   ├── ProfileHeader.tsx
│   │   ├── ProfileTabs.tsx
│   │   ├── PhotosSection.tsx
│   │   ├── BasicInfoSection.tsx
│   │   ├── PassionsSection.tsx
│   │   ├── FaithSection.tsx
│   │   └── ManageSubscriptionSection.tsx
│   │
│   ├── Toast/               # Toast notification UI
│   │   ├── ToastContainer.tsx
│   │   └── ToastItem.tsx
│   │
│   └── icons/               # Custom SVG icon components
│
├── layouts/
│   ├── PublicSiteLayout.tsx  # Minimal layout for public marketing pages
│   └── AppLayout.tsx         # Header + Footer wrapper (legacy)
│
├── types/
│   ├── User.ts              # Full User interface (60+ fields)
│   ├── Match.ts             # Match + matched user relationship
│   ├── chat.ts              # Message, ConversationSummary, Notification types
│   └── profile.ts           # Profile edit form state type
│
├── constants/
│   ├── countries.ts         # Country list for phone code selector
│   ├── exploreCardArt.ts    # Explore category card metadata
│   ├── interestCategories.ts # Interest/hobby category groups
│   ├── onboarding.ts        # MIN_ONBOARDING_PHOTOS = 3
│   ├── profileFitOptions.ts # Profile archetype labels
│   ├── profilePrompts.ts    # Personal prompt question suggestions
│   └── subscriptionPlans.ts # Tier info, features, CTAs
│
├── utils/
│   ├── photoValidation.ts   # Face detection + file format/size validation
│   └── subscriptionDisplay.ts  # Subscription tier + currency display formatting
│
├── lib/
│   ├── installPrompt.ts     # PWA beforeinstallprompt event handler
│   └── notificationCenter.ts # Notification type labels, destinations, system notifications
│
├── seo/
│   └── routeSeo.ts          # Per-route SEO metadata + JSON-LD schema
│
├── api/
│   └── cloudinaryUpload.ts  # Direct browser → Cloudinary upload (bypasses backend)
│
└── prerender/               # SSR pre-render entry point for public routes
```

---

### Backend Structure: `backend/src/`

```
backend/src/
├── server.ts               # Express app, Socket.io, middleware, routes, scheduled services
│
├── config/
│   ├── firebase-admin.ts   # Firebase Admin SDK init (base64 service account)
│   ├── cloudinaryConfig.ts # Cloudinary + Multer storage config
│   └── passport.ts         # Legacy Google OAuth config (unused, no routes)
│
├── firebase/
│   └── admin.ts            # Re-exports db, usersCollection from firebase-admin.ts
│
├── middleware/
│   ├── authMiddleware.ts   # protect() — Firebase ID token validation
│   ├── backendAvailabilityMiddleware.ts  # Blocks non-devs if backendOnlyShutdownEnabled
│   ├── uploadMiddleware.ts # Multer disk storage config for photos
│   └── firebaseAuth.ts     # Legacy auth middleware (superseded, unused)
│
├── routes/
│   ├── authRoutes.ts       # POST /register-profile, PUT /complete-onboarding
│   ├── userRoutes.ts       # GET|PUT|PATCH|DELETE /me, admin user CRUD
│   ├── matchRoutes.ts      # Like, pass, unmatch, block, get matches
│   ├── messageRoutes.ts    # Conversations, messages, attachments, reactions
│   ├── discoverRoutes.ts   # Filter, profile-fit, interests discovery
│   ├── notificationRoutes.ts  # List, unread count, mark read
│   ├── paymentRoutes.ts    # Paystack integration, plans, webhooks
│   ├── photoRoutes.ts      # Upload/delete profile photos (1-6)
│   ├── uploadRoutes.ts     # Generic photo upload endpoints
│   ├── storyRoutes.ts      # CRUD + interactions for 24hr stories
│   └── supportRoutes.ts    # Support tickets, admin replies
│
├── controllers/
│   ├── authController.ts        # createProfileAfterFirebaseRegister, completeOnboarding
│   ├── userController.ts        # Profile CRUD, admin stats, role management
│   ├── matchController.ts       # Match logic + Message logic (1000+ lines — see tech debt)
│   ├── discoverController.ts    # Advanced filtering, interest discovery, profile fits
│   ├── notificationController.ts # Notification CRUD
│   ├── paymentController.ts     # Paystack, regional pricing, auto-renewal (1000+ lines)
│   ├── storyController.ts       # Story CRUD + interactions
│   └── supportController.ts     # Support ticket system
│
├── services/
│   ├── notificationService.ts        # Create + emit + email notifications
│   ├── paystackService.ts            # Paystack REST API wrapper
│   ├── storyCleanupService.ts        # Background: delete expired stories every 5 min
│   ├── subscriptionRenewalService.ts # Background: auto-renew subscriptions every 15 min
│   ├── regionalPricingService.ts     # Region-based pricing (NGN/Africa/USD)
│   ├── exchangeRateService.ts        # USD exchange rates with 15-min cache + fallback
│   ├── localizedPaymentService.ts    # IP-based region detect + initialize payment
│   └── geoLocationService.ts         # IP extraction + ipapi.co geolocation
│
├── socket/
│   └── socket.ts           # Socket.io event handlers (messages, typing, calls, reactions)
│
├── utils/
│   ├── chatAccess.ts        # Free user chat limit logic (max 1 active match)
│   ├── passportMode.ts      # Passport mode: location-restricted discovery
│   ├── profileBooster.ts    # Profile booster credit/activation logic
│   ├── profilePhotos.ts     # Photo field constants + count utility
│   └── validateOnboardingPayload.ts  # Onboarding completeness validation
│
├── models/                  # MongoDB Mongoose schemas (legacy, not primary DB)
│
├── types/                   # TypeScript type definitions
│
└── api/
    └── index.ts             # Vercel serverless function wrapper (exports Express app)
```

---

## 4. Frontend Documentation

### 4.1 Routing Structure

All routes defined in `frontend/src/main.tsx`:

```
/                           → Home (PublicSiteLayout)
/about                      → About
/contact                    → Contact
/privacy                    → Privacy Policy
/terms                      → Terms of Service
/help                       → HelpRoute
/premium                    → PremiumRoute

/login                      → Login (PublicOnlyRoute — redirects if authenticated)
/signup                     → SignUp (PublicOnlyRoute)
/reset-password             → ResetPassword (no auth required)

/verify-email               → VerifyEmail (AuthGate)
/onboarding                 → OnboardingPage (AuthGate)
/dashboard                  → Dashboard (AuthGate)
/community                  → Community (AuthGate)
/explore                    → Explore (AuthGate)
/messages                   → Messages (AuthGate)
/notifications              → Notifications (AuthGate)
/purchases                  → InAppPurchases (AuthGate)
/payment-success            → PaymentSuccess (AuthGate)
/settings                   → Settings (AuthGate)
/report                     → Report (AuthGate)
/safety-note                → SafetyNote (AuthGate)
/deactivate                 → Deactivate (AuthGate)
/profile                    → Profile — own profile edit (AuthGate)
/profile/:id                → UserProfileView — view another user (AuthGate)
/matches                    → Matches (AuthGate)
/admin                      → Admin (AuthGate + AdminRoute guard)
/developer                  → DeveloperHub (AuthGate + DeveloperRoute guard)
/onboarding-debug           → OnboardingDebug (no public guard — access by URL)
*                           → "404 Not Found"
```

### 4.2 Route Guards

**`AuthGate`** (`frontend/src/components/AuthGate.tsx`)
- Requires: authenticated + full user object
- Redirects: unauthenticated → `/login`; onboarding not complete → `/onboarding`
- Exception: allows dashboard access if onboarding is "paused" (localStorage flag per UID)

**`PublicOnlyRoute`**
- Blocks authenticated users
- Redirects: authenticated → `/dashboard` or `/onboarding`

**`AdminRoute`**
- Requires: `user.role === 'admin'` or `user.roles.includes('admin')`
- Redirects unauthorized → `/dashboard`

**`DeveloperRoute`**
- Requires: `user.role === 'developer'` or `user.roles.includes('developer')`

### 4.3 Layout System

| Layout | Used By | Behavior |
|---|---|---|
| `PublicSiteLayout` | Public marketing pages | Minimal, just `<Outlet />` + SEO |
| `App` (App.tsx) | All protected routes | Wraps authenticated app shell |
| Auth routes | Login/Signup | Center-aligned card layout |
| Full-screen routes | Onboarding | Full viewport, no nav |
| App-shell routes | Dashboard, Messages, etc. | Container + bottom/side nav |

### 4.4 State Management

| Mechanism | What It Manages |
|---|---|
| `AuthContext` | Auth state: user, token, loading, auth methods |
| `ToastContext` | Toast notification queue |
| `useState` (component) | UI state: filters, modals, form data, loading |
| `localStorage` | User session cache, token, feature settings cache, onboarding pause flag |
| `useAPI` cache | API response cache (5-min TTL, keyed by endpoint) |
| `WebSocketService` | Real-time event state (singleton) |
| `zustand` | Minimal usage — imported but limited active state |

### 4.5 API Connection Layer

**`frontend/src/services/api-client.ts`**
- Uses native `fetch` (not axios)
- Automatically attaches `Authorization: Bearer <token>` header
- Sets `credentials: 'include'` for cookie support
- Throws `'Unauthorized'` on 401 (triggers logout in `useAPI`)
- Returns `{}` on 204 No Content

**`frontend/src/services/api.ts`** — facade with namespaced methods:
```typescript
API.Auth.completeOnboarding(data)
API.User.getMe()
API.Matches.likeProfile(userId)
API.Messages.sendMessage(matchId, content)
API.Subscriptions.initPayment(plan)
API.Admin.getUsers()
// ... etc
```

**`frontend/src/api/cloudinaryUpload.ts`** — direct browser → Cloudinary upload (used during onboarding for photos, bypasses 4.5MB Vercel function limit)

### 4.6 Onboarding Flow

13-slide multi-step form at `/onboarding` (`OnboardingPage.tsx`):

| Slide | Component | Collects |
|---|---|---|
| 1 | `ImageUploadSlide` | Profile photos (min 3, max 6) — uploaded to Cloudinary |
| 2 | `ProfileBuilderSlide` | Name, age, gender, location |
| 3 | `LocationPermissionSlide` | GPS coordinates (optional) |
| 4 | `MatchingPreferencesSlide` | Partner gender, age range, denomination, max distance |
| 5 | `RelationshipGoalsSlide` | Looking for: Friendship, Dating, Relationship, Marriage |
| 6 | `InterestsSelectionSlide` | Interests, hobbies, values, profile fits |
| 7 | `PersonalEssenceSlide` | Faith journey, church attendance, spiritual gifts |
| 8 | `LifestyleHabitsSlide` | Drinking, smoking, fitness, pets, lifestyle |
| 9 | `ShareMoreAboutYouSlide` | Bio, favorite verse, personality, communication style, love style |
| 10–13 | Additional slides | Profession, education, birthday, phone number |

On completion: `useAuth.completeOnboarding(data)` → `PUT /api/auth/complete-onboarding` → Firestore update → user redirected to `/dashboard`

**Validation:**
- Backend enforces min 3 photos
- `validateOnboardingPayload()` checks all required fields
- Frontend validates each slide before allowing advance

### 4.7 Dashboard & Discovery

**`DashboardPage.tsx`** orchestrates:
- Profile queue state via `usePotentialMatches(filters)`
- Filter state managed locally, applied via `POST /api/discover/filter`
- Desktop (≥1024px): `DesktopLayout` with `SidePanel` + main content
- Mobile (<1024px): `MobileLayout` with `MobileBottomNav`

**Swipe System:**
- `SwipeDeck.tsx` → Swiper.js card stack
- Like: `POST /api/matches/like/:userId` → if mutual → MatchCelebrationOverlay
- Pass: `POST /api/matches/pass/:userId` → 24hr cooldown prevents re-showing
- Free users: 10 swipes/day limit
- Premium users: unlimited swipes

**Filters (FilterPanel.tsx):**
- Free: gender only
- Premium: gender, denomination, faith journey, age range, distance, relationship goals, church attendance

### 4.8 Real-Time Messaging

**Architecture:**
```
Messages.tsx
  └── useConversationMessages(matchId) — HTTP fetch initial messages
  └── useWebSocket() → WebSocketService
        └── socket.io-client → backend/socket.ts
              └── emit 'send_message' → stored in Firestore + broadcast to receiver
```

**Message Types:** TEXT, IMAGE, VIDEO, AUDIO, FILE, SYSTEM

**Features:**
- Reactions (emoji, deduplicated per user)
- Replies (quoted message preview)
- Read receipts (unreadBy array)
- Typing indicators
- Attachment upload via `POST /api/messages/attachments` → Cloudinary

**Chat Access Control:**
- Free users: only 1 active match chat at a time (oldest match)
- Premium/Elite: unlimited chats

### 4.9 Notifications

**Delivery:**
1. Created in Firestore `notifications` collection by backend
2. Emitted via Socket.io in real time
3. `NotificationListener.tsx` receives WebSocket events → shows browser notification (if permitted) → updates unread count

**Types:** profile_liked, new_match, new_message, story_posted, support_reply, report_submitted

**Navigation:** each notification type routes to appropriate page via `getNotificationDestination()` in `lib/notificationCenter.ts`

### 4.10 Payments

**Flow:**
1. User visits `/purchases` → `InAppPurchases.tsx`
2. Selects plan → `GET /api/payments/quote` → localized pricing shown
3. Clicks Pay → `POST /api/payments/pay` → `authorization_url` returned
4. User redirected to Paystack payment page
5. On success → redirected to `/payment-success`
6. Paystack webhook → `POST /api/payments/webhook` → subscription activated in Firestore

**Plan Tiers:**
| Tier | Billing | Nigeria | Global |
|---|---|---|---|
| Premium | Monthly | NGN 5,000 | $11.99 USD |
| Premium | Quarterly | NGN 10,000 | $23.97 USD |

**Profile Booster:**
- Single credit: NGN 800 / $4 USD
- Bundle (5 credits): NGN 2,000 / $7 USD
- 1 credit = 1 hour of elevated visibility in discovery

---

## 5. Backend Documentation

### 5.1 Middleware Chain

Every request to `POST /api/*`:

```
CORS (whitelist: localhost:5173, faithblissafrica.com, www.faithblissafrica.com, CLIENT_URL)
  → JSON body parser
  → Cookie parser
  → backendAvailabilityMiddleware (503 if shutdown enabled, developer bypass)
  → Route handler
    → protect (Firebase token validation) [on protected routes]
      → Controller
        → Firestore / Cloudinary / Paystack
```

### 5.2 Auth Flow (Backend)

```typescript
// protect middleware (authMiddleware.ts)
const token = req.headers.authorization?.split('Bearer ')[1];
const decoded = await admin.auth().verifyIdToken(token);
req.userId = decoded.uid;
req.user = decoded;
next();
```

Role checks are done inline in controllers:
```typescript
// Admin check pattern
const userDoc = await db.collection('users').doc(req.userId).get();
const userData = userDoc.data();
if (userData.role !== 'admin' && !userData.roles?.includes('admin')) {
  return res.status(403).json({ message: 'Admin access required' });
}
```

Primary admin bypass: if `userData.email === process.env.PRIMARY_ADMIN_EMAIL`, admin role granted automatically.

### 5.3 Services

#### Notification Service (`notificationService.ts`)
```typescript
createNotification({
  userId: string,
  type: 'PROFILE_LIKED' | 'NEW_MATCH' | 'NEW_MESSAGE' | 'STORY_POSTED' | 'REPORT_SUBMITTED' | 'SUPPORT_REPLY',
  message: string,
  data: Record<string, any>
})
```
Internally: writes to Firestore → emits via Socket.io → calls EMAIL_WEBHOOK_URL (async, best-effort)

#### Paystack Service (`paystackService.ts`)
Wraps Paystack REST API:
- `initializeTransaction(payload)` — start payment
- `verifyTransaction(reference)` — verify after return
- `chargeAuthorization(payload)` — charge saved card for renewal
- `enableSubscription(code, token)` — toggle auto-renew on
- `disableSubscription(code, token)` — toggle auto-renew off

#### Exchange Rate Service (`exchangeRateService.ts`)
- Primary: `exchangerate-api.com`
- Fallback 1: `open.er-api.com`
- Fallback 2: hardcoded rates
- Cache TTL: 15 minutes

#### Story Cleanup Service (`storyCleanupService.ts`)
- Runs: every 5 minutes
- Action: query `stories` where `expiresAt <= now` → delete Cloudinary media → delete Firestore doc
- **Warning:** Will not work on Vercel serverless (no persistent process). Requires long-running server.

#### Subscription Renewal Service (`subscriptionRenewalService.ts`)
- Runs: every 15 minutes
- Action: find active subscriptions due for renewal → `chargeAuthorization` → update `nextPaymentDate`
- Per-user 30-min cooldown prevents double-charge
- **Warning:** Same serverless caveat as above.

### 5.4 WebSocket Events

**Socket.io server** in `backend/src/socket/socket.ts`

Authentication: `protectSocket` middleware validates Firebase token from `socket.handshake.auth.token`

| Client emits | Server receives | Action |
|---|---|---|
| `send_message` | message + matchId | Save to Firestore, emit `message_received` to recipient |
| `typing` | matchId, isTyping | Emit `user_typing` to other match participant |
| `call_initiated` | matchId, callType | Emit `call_incoming` to recipient |
| `react_to_message` | messageId, emoji | Update reactions array in Firestore, emit `reaction_added` |
| `delete_message` | messageId | Mark deleted in Firestore |

| Server emits | Client receives | Trigger |
|---|---|---|
| `message_received` | New message object | On `send_message` |
| `user_typing` | { matchId, userId, isTyping } | On `typing` |
| `call_incoming` | { matchId, from, callType } | On `call_initiated` |
| `notification` | Notification object | Via notificationService |
| `reaction_added` | { messageId, userId, emoji } | On `react_to_message` |

### 5.5 Background Services Status on Vercel

| Service | Interval | Works on Vercel? | Note |
|---|---|---|---|
| Story cleanup | 5 min | ❌ No | Requires persistent Node process |
| Subscription renewal | 15 min | ❌ No | Requires persistent Node process |

**Mitigation:** These services must run on a long-running server (Railway, Render, DigitalOcean) or be converted to Vercel Cron Jobs (separate deployment).

---

## 6. Database Documentation

### 6.1 Primary: Firestore Collections

#### `users` collection

| Field | Type | Description |
|---|---|---|
| `id` | string | Firebase UID |
| `name` | string | Display name |
| `email` | string | Lowercase email |
| `emailVerified` | boolean | Email verified status |
| `role` | string | 'user' \| 'admin' \| 'developer' \| 'marketer' |
| `roles` | string[] | Array of roles (supports multi-role) |
| `gender` | string | 'MALE' \| 'FEMALE' |
| `age` | number | User age |
| `denomination` | string | Christian denomination |
| `bio` | string | Profile bio (max 500 chars) |
| `location` | string | City, Country |
| `latitude` | number | GPS latitude |
| `longitude` | number | GPS longitude |
| `birthday` | string | ISO date string |
| `profilePhoto1–6` | string | Cloudinary URLs |
| `profilePhotoCount` | number | 0–6 |
| `preferredGender` | string | Matching preference |
| `minAge` / `maxAge` | number | Age preference range |
| `maxDistance` | number | Distance filter (km) |
| `lookingFor` | string[] | Relationship goals |
| `hobbies` / `interests` / `values` | string[] | Profile tags |
| `profileFits` | string[] | Profile archetypes |
| `faithJourney` | string | Faith stage |
| `sundayActivity` | string | Sunday routine |
| `favoriteVerse` | string | Bible verse |
| `denomination` | string | Church denomination |
| `likes` | string[] | UIDs liked by this user |
| `passes` | string[] | UIDs passed by this user |
| `passHistory` | map | userId → Timestamp (24hr cooldown) |
| `matches` | string[] | Match document IDs |
| `blockedUsers` | string[] | Blocked user UIDs |
| `subscriptionStatus` | string | 'active' \| 'inactive' \| 'expired' |
| `subscriptionTier` | string | 'premium' \| 'elite' |
| `subscription` | map | Full subscription details (see below) |
| `profileBoosterCredits` | number | Remaining booster credits |
| `profileBoosterActiveUntil` | string | ISO datetime |
| `isActive` | boolean | Account active status |
| `onboardingCompleted` | boolean | Onboarding completion flag |
| `createdAt` / `updatedAt` | Timestamp | Firestore timestamps |
| `postPaymentSurvey` | map | Marketer attribution data |

**Subscription sub-document:**
```
{
  status, tier, currency, billingCycle,
  pricingRegion, displayCurrency, displayAmountMajor,
  chargeAmountMajor, chargeAmountSubunits,
  reference, planCode, authorizationCode,
  nextPaymentDate, autoRenewEnabled
}
```

#### `matches` collection

| Field | Type | Description |
|---|---|---|
| `id` | string | Auto-generated |
| `users` | string[] | Exactly 2 Firebase UIDs |
| `createdAt` | Timestamp | |
| `updatedAt` | Timestamp | |

#### `messages` collection

| Field | Type | Description |
|---|---|---|
| `id` | string | Auto-generated |
| `matchId` | string | Parent match document ID |
| `senderId` | string | Firebase UID |
| `receiverId` | string | Firebase UID |
| `content` | string | Message text |
| `type` | string | TEXT \| IMAGE \| VIDEO \| AUDIO \| FILE \| SYSTEM |
| `attachment` | map \| null | { url, publicId, fileName, mimeType, fileSize } |
| `replyTo` | map \| null | { id, senderId, content, type, attachment } |
| `reactions` | array | [{ userId, emoji, createdAt }] |
| `unreadBy` | string[] | UIDs who haven't read |
| `createdAt` / `updatedAt` | Timestamp | |

#### `notifications` collection

| Field | Type | Description |
|---|---|---|
| `id` | string | Auto-generated |
| `userId` | string | Recipient UID |
| `type` | string | Notification category |
| `message` | string | Display text |
| `data` | map | Contextual data (matchId, senderId, etc.) |
| `isRead` | boolean | |
| `readAt` | Timestamp | |
| `createdAt` | Timestamp | |

#### `stories` collection

| Field | Type | Description |
|---|---|---|
| `id` | string | Auto-generated |
| `authorId` | string | Firebase UID |
| `mediaUrl` | string | Cloudinary URL |
| `mediaType` | string | 'image' \| 'video' |
| `mediaPublicId` | string | Cloudinary public ID (for deletion) |
| `caption` | string | Optional caption |
| `seenBy` | string[] | UIDs who viewed |
| `likedBy` | string[] | UIDs who liked |
| `createdAt` | Timestamp | |
| `expiresAt` | Timestamp | createdAt + 24 hours |

#### `supportTickets` collection

| Field | Type | Description |
|---|---|---|
| `id` | string | Auto-generated |
| `userId` | string | Submitter UID |
| `type` | string | 'HELP' \| 'REPORT' |
| `subject` | string | |
| `message` | string | |
| `reporterEmail` / `reporterName` | string | |
| `status` | string | 'OPEN' \| 'RESPONDED' \| 'CLOSED' |
| `replies` | array | [{ adminId, adminEmail, adminName, message, createdAt }] |
| `createdAt` / `updatedAt` | Timestamp | |

#### `appConfig/features` document

| Field | Type | Description |
|---|---|---|
| `passportModeEnabled` | boolean | Enable passport location feature |
| `maintenanceModeEnabled` | boolean | Show maintenance overlay to all users |
| `shutdownModeEnabled` | boolean | Complete app shutdown |
| `backendOnlyShutdownEnabled` | boolean | Block backend API for non-developers |

### 6.2 Firestore Indexes

| Collection | Fields | Order | Purpose |
|---|---|---|---|
| `notifications` | userId, createdAt | ASC, DESC | Fetch user notifications newest first |
| `notifications` | userId, isRead | ASC, ASC | Count/fetch unread notifications |

### 6.3 Security Rules Summary

| Collection | Any Auth | Owner | Participants | Backend Only |
|---|---|---|---|---|
| `users` | Read ✅ | Write ✅ | — | — |
| `matches` | — | — | Read, Update ✅ | Create, Delete |
| `messages` | — | — | Read, Update ✅ | Delete |
| `notifications` | — | Read, isRead update ✅ | — | Create, Delete |
| `stories` | Read ✅ | Create, Delete ✅ | seenBy/likedBy ✅ | — |
| `supportTickets` | — | Read, Create ✅ | — | Update, Delete |

### 6.4 Secondary: MongoDB

MongoDB Atlas is connected via `MONGO_URI` on server boot but **Firestore is the primary database**. MongoDB models exist in `backend/src/models/` but no identified controller currently routes core application data through MongoDB exclusively. It should be considered legacy infrastructure.

---

## 7. UI/UX System Documentation

### 7.1 Design System

**Framework:** Tailwind CSS 3.4.18 with custom theme extensions.

**Typography:**
- Body: `Inter` (weights 100–900, Google Fonts)
- Accent/Display: `Dancing Script` (weights 400–700)
- Fallback: system-ui, -apple-system, sans-serif

**Color System** (CSS custom properties, dark-mode aware):

| Token | Value | Usage |
|---|---|---|
| Brand pink | `#ec4899` | Primary CTA, active states |
| Brand purple | `#7c3aed` | Secondary accent |
| Brand fuchsia | `#d946ef` | Gradient midpoint |
| `--color-bg` | CSS var | Page background |
| `--color-surface-raised` | CSS var | Card backgrounds |
| `--color-surface-overlay` | CSS var | Modal/overlay backgrounds |
| `--color-muted` | CSS var | Secondary text |

**Custom Shadows:**
- `shadow-glow-pink` — pink glow (CTAs, active cards)
- `shadow-glow-purple` — purple glow
- `shadow-card-light` / `shadow-card-dark` — card elevation
- `shadow-nav` — navigation bar shadow

**Custom Animations:**
| Name | Usage |
|---|---|
| `fade-up` | Page/section entrance |
| `fade-in` | Element appearance |
| `shimmer` | Loading skeleton |
| `float` | Floating elements (icons) |
| `micro-bounce` | Button tap feedback |

**Custom Transitions:**
- `spring`: `cubic-bezier(0.34, 1.56, 0.64, 1)` — bouncy, natural feel
- `smooth`: `cubic-bezier(0.25, 0.46, 0.45, 0.94)` — silky ease-out

### 7.2 Responsiveness

| Breakpoint | Behavior |
|---|---|
| < 1024px | `MobileLayout` — bottom navigation, full-width cards, floating action buttons |
| ≥ 1024px | `DesktopLayout` — left sidebar + main content area |

The split between mobile and desktop layout happens in `DashboardPage.tsx`:
```tsx
{isMobile ? <MobileLayout ... /> : <DesktopLayout ... />}
```

Standard Tailwind breakpoints (`sm`, `md`, `lg`, `xl`, `2xl`) used throughout for typography, spacing, and grid adjustments.

### 7.3 Animation Library

**Framer Motion** (`framer-motion@12.23.24`) used for:
- Dashboard overlay animations (MatchCelebrationOverlay, PostOnboardingWelcomeOverlay)
- Page transitions
- Swipe deck card animations

**Swiper.js** (`swiper@12.1.0`) used for:
- Profile card swipe deck (touch + mouse swipe gestures)
- Story ring carousel (StoryBar)

### 7.4 Known UI Inconsistencies

- Some pages use `className` string literals directly; no consistent component abstraction for buttons, inputs, or form fields
- Toast notifications are custom-built; no integration with shadcn/ui or headless UI library
- Admin and developer pages have different styling patterns from the main app
- Dark mode defined via CSS variables but not consistently toggled via a user preference setting

---

## 8. User & Data Flow Walkthroughs

### 8.1 New User Signup Flow

```
1. User visits /login
2. Clicks "Continue with Google"
3. googleSignIn("signup") called in useAuth.tsx
4. signInWithPopup(auth, googleProvider) → Firebase returns user
5. createProfileAfterFirebaseRegister() → POST /api/auth/register-profile
   Backend: creates Firestore user doc (basic info, isActive: true, onboardingCompleted: false)
6. syncUserFromFirebase() fetches Firestore user doc
7. AuthGate detects onboardingCompleted: false → redirect to /onboarding
8. User completes 13-slide form
9. completeOnboarding(data) → PUT /api/auth/complete-onboarding
   Backend: validates, writes all profile fields, sets onboardingCompleted: true
10. User redirected to /dashboard
11. PostOnboardingWelcomeOverlay shown on first dashboard visit
```

### 8.2 Authentication Flow (Returning User)

```
1. User visits any route → AuthGate checks auth state
2. onAuthStateChanged (Firebase) fires → fbUser available
3. syncUserFromFirebase(fbUser):
   a. getIdToken() → fresh Firebase ID token
   b. Fetch Firestore user doc
   c. Map Firestore fields → User object
   d. Store token in localStorage
   e. Set user in AuthContext state
4. AuthGate: onboardingCompleted: true → render protected route
```

### 8.3 Match & Message Flow

```
1. Dashboard loads → usePotentialMatches() → POST /api/discover/filter
2. User swipes right → POST /api/matches/like/:userId
   Backend:
   a. Add userId to current user's 'likes' array
   b. Check if target user also has current user in their 'likes'
   c. If mutual: create match doc in 'matches' collection
   d. createNotification(targetUser, 'NEW_MATCH')
   e. Socket.io emit 'match_created' to both users
3. MatchCelebrationOverlay shown on frontend
4. User navigates to /messages
5. useConversations() → GET /api/messages/conversations
6. Selects conversation → useConversationMessages(matchId)
   → GET /api/messages/match/:matchId
7. Types message → socket.emit('send_message', { matchId, content, type })
8. Backend socket.ts:
   a. Save message to Firestore 'messages' collection
   b. emit 'message_received' to recipient's socket room
   c. createNotification(recipient, 'NEW_MESSAGE')
9. Recipient's NotificationListener.tsx receives 'notification' event
10. Messages.tsx receives 'message_received' event → updates UI
```

### 8.4 Payment Flow

```
1. User visits /purchases
2. GET /api/payments/quote?region=nigeria → localized pricing shown
3. User selects plan, clicks Pay
4. POST /api/payments/pay
   Backend:
   a. Extract client IP → geoLocationService → country code
   b. regionalPricingService → localized amount (NGN/USD)
   c. paystackService.initializeTransaction() → Paystack API
   d. Returns { authorization_url }
5. Frontend redirects user to Paystack hosted payment page
6. User completes payment
7. Paystack redirects back to /payment-success
8. Paystack also sends webhook: POST /api/payments/webhook
   Backend:
   a. Verify HMAC signature
   b. Update user Firestore doc: subscriptionStatus, subscriptionTier, subscription map
   c. Set nextPaymentDate
   d. If profile booster: grant credits
9. PaymentSuccess.tsx optionally shows PostPaymentSurveyModal
```

### 8.5 Dashboard Data Load

```
1. Dashboard.tsx mounts
2. Parallel:
   a. usePotentialMatches() → POST /api/discover/filter
      - Returns up to 100 profiles excluding: self, liked, passed, matched, blocked
      - Applies user's saved filters
      - Sorts: boosted first, then distance, then age
   b. useStories() → GET /api/stories/feed
      - Returns 24hr stories from mutual matches
   c. GET /api/users/public-feature-settings
      - Returns: maintenanceModeEnabled, shutdownModeEnabled
3. If maintenanceModeEnabled → MaintenanceOverlay (blocks non-admin)
4. Swipe deck renders with fetched profiles
5. StoryBar renders story rings
```

---

*For deployment instructions see [DEVELOPER_ONBOARDING.md](./DEVELOPER_ONBOARDING.md)*
*For all API endpoints see [API_REFERENCE.md](./API_REFERENCE.md)*
*For architecture diagrams see [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)*
*For security issues see [SECURITY_AUDIT.md](./SECURITY_AUDIT.md)*
*For technical debt see [TECH_DEBT_REPORT.md](./TECH_DEBT_REPORT.md)*
*For feature status see [FEATURE_INVENTORY.md](./FEATURE_INVENTORY.md)*
