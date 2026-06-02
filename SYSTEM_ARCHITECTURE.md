# FaithBliss — System Architecture

> **Version:** 1.0 | **Last Updated:** May 2026

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Frontend Architecture](#2-frontend-architecture)
3. [Backend Architecture](#3-backend-architecture)
4. [Authentication Flow](#4-authentication-flow)
5. [Request Flow (REST)](#5-request-flow-rest)
6. [Real-Time Flow (WebSocket)](#6-real-time-flow-websocket)
7. [Payment Flow](#7-payment-flow)
8. [Deployment Architecture](#8-deployment-architecture)
9. [Data Flow Diagram](#9-data-flow-diagram)
10. [Android Build Pipeline](#10-android-build-pipeline)
11. [Third-Party Service Map](#11-third-party-service-map)

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                              │
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │   Web Browser    │    │  Android App     │                   │
│  │  (PWA)           │    │  (Capacitor)     │                   │
│  │  faithblissafrica│    │  APK/AAB         │                   │
│  │  .com            │    │                  │                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                              │
│           └───────────┬───────────┘                              │
│                       │                                          │
└───────────────────────┼──────────────────────────────────────────┘
                        │
         ┌──────────────┼──────────────────┐
         │              │                  │
         ▼              ▼                  ▼
  ┌─────────────┐ ┌───────────────┐ ┌───────────────────┐
  │  Firebase   │ │   Vercel      │ │  Socket.io        │
  │  Auth       │ │   Serverless  │ │  (WebSocket)      │
  │  (Google    │ │   Functions   │ │                   │
  │   OAuth)    │ │   Express API │ │  ws://backend     │
  └──────┬──────┘ └───────┬───────┘ └─────────┬─────────┘
         │                │                    │
         ▼                ▼                    │
  ┌─────────────┐ ┌───────────────┐            │
  │  Firestore  │ │  Cloudinary   │            │
  │  (NoSQL DB) │ │  (Media CDN)  │            │
  └─────────────┘ └───────────────┘            │
         ▲                                     │
         │          ┌───────────────┐          │
         │          │   Paystack    │          │
         │          │   (Payments)  │          │
         │          └───────────────┘          │
         │                                     │
         └─────────────────────────────────────┘
                  (all write through backend)
```

---

## 2. Frontend Architecture

```
frontend/src/main.tsx  (Entry Point)
│
├── Providers
│   ├── <ToastProvider>         ToastContext — global notifications
│   │   └── <BrowserRouter>
│   │       └── <AuthProvider>  AuthContext — user auth state
│   │           └── <Routes>
│
├── Route Guards
│   ├── PublicOnlyRoute         blocks authenticated users
│   ├── AuthGate                requires authenticated + onboarded user
│   ├── AdminRoute              requires admin role
│   └── DeveloperRoute          requires developer role
│
├── Pages (32 total)
│   ├── Public: Home, About, Contact, Privacy, Terms, Help, Premium
│   ├── Auth: Login, SignUp, ResetPassword
│   └── Protected: Dashboard, Onboarding, Messages, Profile, ...
│
├── Components
│   ├── dashboard/   (18 files) — Swipe UI, layouts, overlays
│   ├── onboarding/  (13 files) — Multi-step form slides
│   ├── profile/     (7 files)  — Profile edit sections
│   └── shared/                — Toast, AuthGate, SEO, Loaders
│
├── State Management
│   ├── AuthContext             user, token, auth methods
│   ├── ToastContext            toast queue
│   ├── useAPI (hook)           data fetching + 5-min cache
│   └── component useState      local UI state
│
├── Services
│   ├── api-client.ts           fetch wrapper (REST → backend)
│   ├── api.ts                  namespaced API facade
│   └── WebSocketService.ts     Socket.io client (singleton)
│
└── Firebase SDK
    ├── auth                    signInWithPopup, onAuthStateChanged
    ├── db (Firestore)          direct client reads (user profile)
    └── storage                 Cloud Storage (secondary)
```

### Frontend Data Sources

```
Component needs data
       │
       ├── Own profile?
       │     └── Firestore (via syncUserFromFirebase in useAuth)
       │
       ├── API data (matches, messages, etc.)?
       │     └── useAPI hook → api-client.ts → GET/POST backend
       │
       ├── Real-time updates?
       │     └── useWebSocket → WebSocketService → socket.io
       │
       └── Media upload?
             ├── Onboarding photos → cloudinaryUpload.ts (direct)
             └── Message attachments → POST /api/messages/attachments
```

---

## 3. Backend Architecture

```
Vercel Serverless Function: backend/api/index.ts
│
└── Express App (server.ts)
    │
    ├── Global Middleware
    │   ├── cors()                     whitelist origins
    │   ├── express.json()             parse request bodies
    │   ├── cookieParser()             parse cookies
    │   └── backendAvailabilityMiddleware  503 if shutdown enabled
    │
    ├── Routes
    │   ├── GET  /api/health           health check (no auth)
    │   ├── /api/auth                  authRoutes
    │   ├── /api/users                 userRoutes
    │   ├── /api/matches               matchRoutes
    │   ├── /api/messages              messageRoutes
    │   ├── /api/discover              discoverRoutes
    │   ├── /api/notifications         notificationRoutes
    │   ├── /api/payments              paymentRoutes
    │   ├── /api/uploads               uploadRoutes
    │   ├── /api/stories               storyRoutes
    │   └── /api/support               supportRoutes
    │
    ├── Protected Routes (per route)
    │   └── protect middleware
    │       └── admin.auth().verifyIdToken(token)
    │           └── req.userId = decoded.uid
    │
    ├── Controllers
    │   ├── authController         profile creation, onboarding
    │   ├── userController         profile CRUD, admin ops
    │   ├── matchController        likes, passes, blocking + messages
    │   ├── discoverController     filtered discovery, interest/fit search
    │   ├── notificationController  list, mark read
    │   ├── paymentController      Paystack, pricing, webhooks, renewal
    │   ├── storyController        story CRUD + interactions
    │   └── supportController      ticket system
    │
    ├── Services (business logic)
    │   ├── notificationService    create + emit + email
    │   ├── paystackService        Paystack REST wrapper
    │   ├── regionalPricingService NGN/Africa/Global pricing
    │   ├── exchangeRateService    USD rates with cache + fallback
    │   ├── geoLocationService     IP → country code
    │   ├── localizedPaymentService full init payment flow
    │   ├── storyCleanupService    background: expire stories (5 min)
    │   └── subscriptionRenewalService background: auto-renew (15 min)
    │
    ├── Utilities
    │   ├── chatAccess.ts          free user chat limit enforcement
    │   ├── passportMode.ts        location-restricted discovery
    │   ├── profileBooster.ts      credit/activation management
    │   ├── profilePhotos.ts       photo field helpers
    │   └── validateOnboardingPayload.ts  completeness check
    │
    └── External Integrations
        ├── Firebase Admin SDK     Firestore + Auth token validation
        ├── Cloudinary             photo/video CDN + multer storage
        ├── Paystack               payment processing
        ├── ipapi.co               IP → country geolocation
        └── exchangerate-api.com   USD exchange rates
```

---

## 4. Authentication Flow

### Google Sign-In (new user)

```
Browser                Firebase Auth         Backend              Firestore
   │                        │                   │                    │
   │── signInWithPopup() ──►│                   │                    │
   │                        │── OAuth popup ──► Google              │
   │                        │◄── Google token ──│                    │
   │◄── Firebase User ──────│                   │                    │
   │                        │                   │                    │
   │── getIdToken() ────────│                   │                    │
   │◄── ID Token ───────────│                   │                    │
   │                        │                   │                    │
   │── POST /api/auth/register-profile ─────────►│                    │
   │   { Authorization: Bearer <token> }        │                    │
   │                        │                   │── verifyIdToken() ─│
   │                        │                   │                    │
   │                        │                   │── create user doc ►│
   │◄──────────────────────────────────────────── { id, name, ... } │
   │                        │                   │                    │
   │── /onboarding (redirect)                   │                    │
```

### Returning User Token Validation

```
Frontend                             Backend (protect middleware)
   │                                         │
   │── fetch('/api/...', {                   │
   │     headers: {                          │
   │       Authorization: 'Bearer <token>'   │
   │     }                                   │
   │   }) ──────────────────────────────────►│
   │                                         │── admin.auth().verifyIdToken(token)
   │                                         │
   │                                         │   If valid:
   │                                         │   req.userId = decoded.uid
   │                                         │   next()
   │                                         │
   │                                         │   If invalid/expired:
   │◄──────────────────── 401 Unauthorized ──│
   │
   │── (useAPI hook catches 401)
   │── redirect to /login
```

### Role Resolution

```
Admin check (inline in controllers):

1. Fetch user doc from Firestore
2. Check: userData.email === process.env.PRIMARY_ADMIN_EMAIL → admin
3. OR: userData.role === 'admin'
4. OR: userData.roles?.includes('admin')

Role hierarchy: developer > admin > user
```

---

## 5. Request Flow (REST)

### Standard Protected Request

```
Frontend Component
   │
   │── useAPI hook (or direct api-client call)
   │   ├── Check 5-min cache → return cached if hit
   │   └── Cache miss → fetch
   │
   ▼
api-client.ts
   │── Build URL: VITE_API_URL + endpoint
   │── Add headers:
   │   ├── Content-Type: application/json
   │   ├── Authorization: Bearer <localStorage token>
   │   └── credentials: 'include'
   │
   ▼
Vercel Serverless (Express)
   │
   ├── CORS check
   ├── backendAvailabilityMiddleware
   │
   ├── Route match
   │
   ├── protect middleware
   │   └── verifyIdToken → req.userId
   │
   ├── Controller function
   │   ├── Read from Firestore: db.collection('users').doc(req.userId).get()
   │   ├── Write to Firestore: doc.set(data, { merge: true })
   │   ├── Call Cloudinary (if media)
   │   └── Call Paystack (if payment)
   │
   └── res.json({ ... })
   │
   ▼
api-client.ts
   │── Parse JSON
   │── Return data to hook
   │
   ▼
Component re-renders with new data
```

---

## 6. Real-Time Flow (WebSocket)

### Connection Lifecycle

```
Component mounts using useWebSocket()
   │
   ├── WebSocketService.getInstance()
   │   └── If no existing connection:
   │       └── io(VITE_WEBSOCKET_URL, {
   │             auth: { token: localStorage.accessToken },
   │             transports: ['websocket', 'polling']
   │           })
   │
   ├── Backend socket.ts
   │   └── protectSocket middleware
   │       └── verifyIdToken(socket.handshake.auth.token)
   │       └── socket.join(userId)  [personal room]
   │
   └── Connection established

Component unmounts
   │
   └── useWebSocket cleanup:
       └── 750ms debounce → if no more consumers → socket.disconnect()
```

### Message Send Flow

```
Messages.tsx user sends message
   │
   ├── socket.emit('send_message', {
   │     matchId, content, type,
   │     attachment?, replyTo?, reactions?
   │   })
   │
   ▼
Backend socket.ts handler
   │
   ├── Verify sender is participant in match
   ├── Save to Firestore 'messages' collection
   ├── Create notification for recipient
   │
   ├── socket.to(recipientId).emit('message_received', message)
   └── socket.to(recipientId).emit('notification', notif)
   │
   ▼
Recipient's NotificationListener.tsx
   │
   ├── Receives 'message_received' → update Messages UI
   └── Receives 'notification' → show browser notification
```

### Typing Indicator Flow

```
User typing in input
   │
   └── socket.emit('typing', { matchId, isTyping: true })
   │
   ▼
Backend broadcasts to other participant:
   └── socket.to(otherUserId).emit('user_typing', { matchId, userId, isTyping: true })
   │
   ▼
Messages.tsx shows typing indicator
```

---

## 7. Payment Flow

### Subscription Purchase

```
User selects plan on /purchases
   │
   ├── GET /api/payments/quote?region=nigeria
   │   Backend:
   │   ├── Extract IP from request headers
   │   ├── ipapi.co → country code
   │   ├── regionalPricingService(countryCode, billingCycle)
   │   │   ├── Nigeria → NGN 5,000/month
   │   │   ├── Africa → local currency (exchangeRateService)
   │   │   └── Global → $11.99 USD
   │   └── Return { displayCurrency, displayAmount, chargeAmountSubunits }
   │
   ├── User clicks Pay
   │
   ├── POST /api/payments/pay
   │   { tier: 'premium', billingCycle: 'monthly' }
   │   Backend:
   │   ├── Detect region again
   │   ├── paystackService.initializeTransaction({
   │   │     email: user.email,
   │   │     amount: chargeAmountSubunits,
   │   │     currency: displayCurrency,
   │   │     metadata: { userId, tier, region, billingCycle }
   │   │   })
   │   └── Return { authorization_url }
   │
   ├── Frontend: window.location.href = authorization_url
   │   (redirect to Paystack hosted page)
   │
   ├── User completes payment on Paystack
   │
   ├── Paystack redirects user to /payment-success
   │
   └── Paystack sends webhook: POST /api/payments/webhook
       Backend:
       ├── Verify HMAC signature (X-Paystack-Signature header)
       ├── Parse event: charge.success
       ├── Extract userId from metadata
       ├── Update Firestore user doc:
       │   ├── subscriptionStatus: 'active'
       │   ├── subscriptionTier: tier
       │   ├── subscription.nextPaymentDate: +30 or +90 days
       │   ├── subscription.authorizationCode: (for auto-renewal)
       │   └── subscription.reference: reference
       └── If profile booster: profileBoosterCredits += credits
```

### Auto-Renewal

```
subscriptionRenewalService (runs every 15 min on long-running server)
   │
   ├── Query Firestore: active subscriptions where nextPaymentDate <= now
   │
   ├── For each user:
   │   ├── Check 30-min cooldown
   │   ├── paystackService.chargeAuthorization({
   │   │     authorization_code: user.subscription.authorizationCode,
   │   │     email: user.email,
   │   │     amount: user.subscription.chargeAmountSubunits
   │   │   })
   │   └── On success: update nextPaymentDate in Firestore
   │
   └── ⚠️ WARNING: Does not run on Vercel serverless
```

---

## 8. Deployment Architecture

### Current Setup

```
┌──────────────────────────────────────────────────────┐
│                  faithblissafrica.com                 │
│                                                      │
│            Firebase Hosting (CDN)                    │
│            ├── frontend/dist/ (static files)         │
│            ├── SPA fallback: all routes → /index.html │
│            ├── Pre-rendered: /about, /contact, etc.  │
│            └── Proxy: /__/auth/* → Firebase Auth     │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│              backend.faithblissafrica.com             │
│             (or Vercel-assigned subdomain)            │
│                                                      │
│            Vercel Serverless Function                 │
│            ├── backend/api/index.ts                  │
│            ├── Runtime: @vercel/node                 │
│            ├── All routes → Express app              │
│            └── No persistent process (stateless)     │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                  External Services                    │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────┐ │
│  │  Firestore    │  │  Cloudinary   │  │ Paystack │ │
│  │  (Google      │  │  (Media CDN)  │  │(Payments)│ │
│  │   Cloud)      │  │               │  │          │ │
│  └───────────────┘  └───────────────┘  └──────────┘ │
│  ┌───────────────┐  ┌───────────────┐               │
│  │  MongoDB      │  │  Firebase     │               │
│  │  Atlas        │  │  Auth         │               │
│  │  (legacy)     │  │               │               │
│  └───────────────┘  └───────────────┘               │
└──────────────────────────────────────────────────────┘
```

### Vercel Frontend Config (`frontend/vercel.json`)

```
Routes:
  /__/auth/*          → Proxy to Firebase Auth endpoint
  /__/firebase/init.json → Proxy to Firebase init
  /                   → /index.html
  /about              → /about/index.html (pre-rendered)
  /contact            → /contact/index.html (pre-rendered)
  /privacy            → /privacy/index.html (pre-rendered)
  /terms              → /terms/index.html (pre-rendered)
  /help               → /help/index.html (pre-rendered)
  /premium            → /premium/index.html (pre-rendered)
  (filesystem)        → static files
  /*                  → /app-shell.html (SPA fallback)

Headers:
  /sw.js              → Cache-Control: no-cache, no-store, must-revalidate
  /site.webmanifest   → Cache-Control: no-cache
```

### Vercel Backend Config (`backend/vercel.json`)

```
Build:
  src:  api/index.ts
  use:  @vercel/node

Routes:
  /(.*)  →  api/index.ts (all requests to Express)
```

### Firebase Hosting Config (`firebase.json`)

```
public:   frontend/dist
rewrites: **  →  /index.html
```

---

## 9. Data Flow Diagram

### Who Reads/Writes What

```
                    Firestore    Cloudinary    MongoDB    Paystack
                    ─────────    ──────────    ───────    ────────
Frontend (auth)       Read         ──           ──          ──
Frontend (onboard)    ──           Write         ──          ──
  (direct upload)
Backend (all ops)     R/W          R/W           R/W         R/W
Socket.io server      Write        ──            ──          ──
  (messages)
Paystack webhook      ──           ──            ──          →Write*
  (*Paystack → Backend → Firestore)

Legend:
  Read  = reads data
  Write = writes data
  R/W   = reads and writes
  ──    = no direct access
```

### Firestore Client vs. Admin Access

| Access Path | Who | When |
|---|---|---|
| Firestore client SDK (frontend) | User browser | Reading own profile in `syncUserFromFirebase` |
| Firestore Admin SDK (backend) | Server | All writes, admin reads, cross-user queries |

The frontend reads the user's own profile directly from Firestore (faster, no roundtrip). All writes and queries involving other users go through the backend.

---

## 10. Android Build Pipeline

```
Developer triggers workflow_dispatch in GitHub Actions
   │
   └── .github/workflows/android-build.yml
       │
       ├── Checkout code
       ├── Setup Node 24 + pnpm 9.15.0
       ├── Setup Java 21 (Gradle requirement)
       │
       ├── pnpm install (frontend dependencies)
       ├── pnpm android:prepare
       │   ├── pnpm build
       │   │   ├── tsc -b
       │   │   ├── node scripts/build-prerender.mjs  (static HTML for public routes)
       │   │   └── node scripts/check-prerender.mjs  (validation)
       │   └── cap sync android  (copy web assets → android/)
       │
       ├── Decode ANDROID_KEYSTORE_B64 → keystore.jks
       │
       ├── ./gradlew bundleRelease (signed AAB)
       │   OR ./gradlew assembleRelease (unsigned APK fallback)
       │
       └── Upload artifacts (14-day retention):
           ├── *.aab  (Google Play)
           └── *.apk  (direct install)

Required GitHub Secrets:
  ANDROID_KEYSTORE_B64       Base64-encoded keystore file
  ANDROID_KEYSTORE_PASSWORD  Keystore password
  ANDROID_KEY_ALIAS          Key alias name
  ANDROID_KEY_PASSWORD       Key password
```

---

## 11. Third-Party Service Map

| Service | Endpoint / SDK | Auth Method | Used By | Purpose |
|---|---|---|---|---|
| Firebase Auth | `firebase/auth` SDK | API Key (client) | Frontend | Google OAuth |
| Firebase Auth Admin | `firebase-admin` | Service Account | Backend | Token verification |
| Firestore (client) | `firebase/firestore` | API Key + Auth | Frontend | Read own profile |
| Firestore (admin) | `firebase-admin` | Service Account | Backend | All DB operations |
| Cloudinary | `cloudinary` SDK + REST | API Key + Secret | Backend | Profile/story/message media |
| Cloudinary (direct) | REST API | Upload preset | Frontend | Onboarding photo upload |
| Paystack | REST API | Secret Key | Backend | Payments + webhooks |
| ipapi.co | REST API | None (free tier) | Backend | IP geolocation |
| exchangerate-api.com | REST API | API Key | Backend | USD exchange rates (primary) |
| open.er-api.com | REST API | None | Backend | Exchange rates (fallback) |
| Email webhook | HTTP POST | URL-based | Backend | Notification emails |
| Socket.io | WebSocket | Firebase token | Both | Real-time messaging |

### Environment Variables Required

**Frontend (`frontend/.env`):**
```
VITE_API_URL                    Backend REST API base URL
VITE_WEBSOCKET_URL              Socket.io server URL
VITE_FIREBASE_API_KEY           Firebase client API key
VITE_FIREBASE_AUTH_DOMAIN       Firebase auth domain
VITE_FIREBASE_PROJECT_ID        Firebase project ID
VITE_FIREBASE_STORAGE_BUCKET    Firebase storage bucket
VITE_FIREBASE_MESSAGING_SENDER_ID  FCM sender ID
VITE_FIREBASE_APP_ID            Firebase app ID
VITE_PRIMARY_ADMIN_EMAIL        Admin email (client-side role check)
```

**Backend (`backend/.env`):**
```
PORT                            Express server port (default: 5000)
NODE_ENV                        development | production
CLIENT_URL                      Frontend URL for CORS
MONGO_URI                       MongoDB Atlas connection string
FIREBASE_CREDENTIALS_BASE64     Base64-encoded service account JSON
CLOUDINARY_CLOUD_NAME           Cloudinary cloud name
CLOUDINARY_API_KEY              Cloudinary API key
CLOUDINARY_API_SECRET           Cloudinary API secret
PAYSTACK_SECRET_KEY             Paystack secret key
PAYSTACK_PLAN_CODE_PREMIUM_MONTHLY    Paystack plan code
PAYSTACK_PLAN_CODE_PREMIUM_QUARTERLY  Paystack plan code
GOOGLE_CLIENT_ID                Google OAuth client ID (legacy)
GOOGLE_CLIENT_SECRET            Google OAuth client secret (legacy)
GOOGLE_CALLBACK_URL             Google OAuth callback URL (legacy)
EMAIL_WEBHOOK_URL               Email notification webhook URL
PRIMARY_ADMIN_EMAIL             Primary admin email address
```
