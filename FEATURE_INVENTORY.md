# FaithBliss — Feature Inventory

> **Version:** 1.0 | **Last Updated:** May 2026
>
> A complete inventory of every feature in the application — what's built, what's partially built, what's hidden, and what's disabled.

---

## Table of Contents

1. [Fully Implemented Features](#1-fully-implemented-features)
2. [Partially Implemented Features](#2-partially-implemented-features)
3. [Admin & Developer-Only Features](#3-admin--developer-only-features)
4. [Disabled / Legacy / Dead Code](#4-disabled--legacy--dead-code)
5. [Feature Flag System](#5-feature-flag-system)
6. [Feature Matrix by User Tier](#6-feature-matrix-by-user-tier)
7. [Missing Features (Common in Similar Products)](#7-missing-features-common-in-similar-products)

---

## 1. Fully Implemented Features

### Authentication

| Feature | Status | Files |
|---|---|---|
| Google OAuth sign-in | ✅ Complete | `frontend/src/hooks/useAuth.tsx`, `backend/src/controllers/authController.ts` |
| Firebase ID token validation | ✅ Complete | `backend/src/middleware/authMiddleware.ts` |
| Persistent auth session (localStorage) | ✅ Complete | `useAuth.tsx` — stores token + user in localStorage |
| Fallback auth persistence (iOS private browsing) | ✅ Complete | `frontend/src/firebase/config.ts` — tries browserLocal → browserSession → inMemory |
| Google sign-in popup with redirect fallback | ✅ Complete | `useAuth.tsx` — detects in-app browser, falls back to redirect |
| Password reset via email | ✅ Complete | `useAuth.tsx` — `requestPasswordReset`, `validatePasswordResetCode`, `resetPassword` |
| Logout (clears all storage + cookies) | ✅ Complete | `useAuth.tsx` — clears localStorage, sessionStorage, cookies |
| Account deactivation (soft delete) | ✅ Complete | `POST /api/users/me/deactivate` |
| Account reactivation | ✅ Complete | `POST /api/users/me/reactivate` |
| Account deletion (hard delete) | ✅ Complete | `DELETE /api/users/me` |

---

### Onboarding

| Feature | Status | Files |
|---|---|---|
| 13-slide multi-step form | ✅ Complete | `frontend/src/pages/OnboardingPage.tsx`, `frontend/src/components/onboarding/` |
| Profile photo upload (min 3, max 6) | ✅ Complete | `ImageUploadSlide.tsx`, `cloudinaryUpload.ts` |
| Face detection on photos | ✅ Complete | `frontend/src/utils/photoValidation.ts` — `analyzePhotoFaces()` |
| Faith profile collection (denomination, journey, attendance, gifts) | ✅ Complete | `PersonalEssenceSlide.tsx` |
| Location + GPS coordinates | ✅ Complete | `ProfileBuilderSlide.tsx`, `LocationPermissionSlide.tsx` |
| Matching preferences (age, distance, denomination) | ✅ Complete | `MatchingPreferencesSlide.tsx` |
| Interests, hobbies, values, profile fits | ✅ Complete | `InterestsSelectionSlide.tsx` |
| Lifestyle habits (drinking, smoking, fitness) | ✅ Complete | `LifestyleHabitsSlide.tsx` |
| Bio, favorite verse, personality | ✅ Complete | `ShareMoreAboutYouSlide.tsx` |
| Server-side validation (min photos, required fields) | ✅ Complete | `backend/src/utils/validateOnboardingPayload.ts` |
| Onboarding pause + resume (localStorage) | ✅ Complete | `AuthGate.tsx` — paused onboarding flag |
| Post-onboarding welcome overlay | ✅ Complete | `PostOnboardingWelcomeOverlay.tsx` |

---

### Profile Discovery (Swiping)

| Feature | Status | Files |
|---|---|---|
| Swipeable card deck (touch + mouse) | ✅ Complete | `SwipeDeck.tsx`, `SwipeCard.tsx` — Swiper.js |
| Profile cards with photos, bio, faith info | ✅ Complete | `HingeStyleProfileCard.tsx` |
| Like a profile | ✅ Complete | `POST /api/matches/like/:userId` |
| Pass a profile (24hr cooldown) | ✅ Complete | `POST /api/matches/pass/:userId` |
| Mutual match detection + celebration overlay | ✅ Complete | `matchController.ts`, `MatchCelebrationOverlay.tsx` |
| Advanced discovery filters | ✅ Complete | `POST /api/discover/filter` |
| Profile booster sorting (boosted first) | ✅ Complete | `discoverController.ts` — sorts boosted profiles to top |
| Haversine distance calculation | ✅ Complete | `discoverController.ts` — GPS-based km distance |
| Empty state when no profiles remain | ✅ Complete | `NoProfilesState.tsx` |
| Profile completion banner | ✅ Complete | `ProfileCompletionBanner.tsx` |
| Floating action buttons (mobile like/skip) | ✅ Complete | `FloatingActionButtons.tsx` |
| Daily swipe limit for free users (10/day) | ✅ Complete | `matchController.ts` |

---

### Matching & Connections

| Feature | Status | Files |
|---|---|---|
| Mutual matches list | ✅ Complete | `GET /api/matches/mutual`, `Matches.tsx` |
| Sent likes list | ✅ Complete | `GET /api/matches/sent` |
| Received likes list | ✅ Complete | `GET /api/matches/received` |
| Passed profiles list | ✅ Complete | `GET /api/matches/passed` |
| Unmatch | ✅ Complete | `POST /api/matches/unmatch/:userId` |
| Unmatch + block | ✅ Complete | `POST /api/matches/unmatch-block/:userId` |
| Block user | ✅ Complete | Stored in `blockedUsers[]` on user document |
| View another user's public profile | ✅ Complete | `UserProfileView.tsx`, `GET /api/users/:id` |

---

### Messaging

| Feature | Status | Files |
|---|---|---|
| Real-time chat via WebSocket | ✅ Complete | `backend/src/socket/socket.ts`, `WebSocketService.ts` |
| Conversation list with unread count | ✅ Complete | `GET /api/messages/conversations` |
| Message history (paginated) | ✅ Complete | `GET /api/messages/match/:matchId` |
| Text messages | ✅ Complete | Type: TEXT |
| Image/video/audio/file attachments | ✅ Complete | `POST /api/messages/attachments` → Cloudinary |
| Message reactions (emoji) | ✅ Complete | `react_to_message` socket event, reactions array |
| Reply to a specific message | ✅ Complete | `replyTo` field on message |
| Read receipts | ✅ Complete | `unreadBy` array, `PATCH /api/messages/:id/read` |
| Typing indicators | ✅ Complete | `typing` socket event → `user_typing` broadcast |
| GIF/sticker support (Giphy/Tenor) | ✅ Complete | `GET /api/messages/media/library` — API proxy |
| System messages | ✅ Complete | Type: SYSTEM (for match events, etc.) |
| Free user chat limit (1 active match) | ✅ Complete | `chatAccess.ts` — `FREE_CHAT_LIMIT_MESSAGE` |
| Chat locked state for free users | ✅ Complete | `chatLocked` + `chatAccessMessage` in conversations response |

---

### Stories (24-Hour Content)

| Feature | Status | Files |
|---|---|---|
| Create a story (image or video) | ✅ Complete | `POST /api/stories` |
| 24-hour auto-expiry | ✅ Complete | `expiresAt` field, `storyCleanupService.ts` |
| Story feed from mutual matches | ✅ Complete | `GET /api/stories/feed` |
| Story ring/avatar carousel | ✅ Complete | `StoryBar.tsx` |
| Mark story as seen | ✅ Complete | `PATCH /api/stories/:id/seen` |
| Like a story (toggle) | ✅ Complete | `POST /api/stories/:id/like` |
| Reply to a story | ✅ Complete | `POST /api/stories/:id/reply` → sends to match chat |
| Delete own story | ✅ Complete | `DELETE /api/stories/:id` |
| View who liked a story | ✅ Complete | `GET /api/stories/:id/likes` |
| Cloudinary media hosting for stories | ✅ Complete | Multer → Cloudinary in `storyController.ts` |

---

### Notifications

| Feature | Status | Files |
|---|---|---|
| In-app notification feed | ✅ Complete | `Notifications.tsx`, `GET /api/notifications` |
| Real-time notification delivery (WebSocket) | ✅ Complete | `notificationService.ts` → socket.io emit |
| Browser push notifications | ✅ Complete | `NotificationListener.tsx` — `showSystemNotification()` |
| Unread notification count | ✅ Complete | `GET /api/notifications/unread-count` |
| Mark single notification as read | ✅ Complete | `PATCH /api/notifications/:id/read` |
| Mark all as read | ✅ Complete | `PATCH /api/notifications/read-all` |
| Notification types: liked, match, message, story | ✅ Complete | 6 notification types |
| Deep link routing from notification | ✅ Complete | `lib/notificationCenter.ts` — `getNotificationDestination()` |

---

### Payments & Subscriptions

| Feature | Status | Files |
|---|---|---|
| Paystack payment integration | ✅ Complete | `paystackService.ts`, `paymentController.ts` |
| Region-based pricing (Nigeria/Africa/Global) | ✅ Complete | `regionalPricingService.ts` |
| IP geolocation for region detection | ✅ Complete | `geoLocationService.ts` → ipapi.co |
| USD exchange rate conversion | ✅ Complete | `exchangeRateService.ts` — with cache + fallback |
| Premium Monthly subscription | ✅ Complete | NGN 5,000 / $11.99 USD |
| Premium Quarterly subscription | ✅ Complete | NGN 10,000 / $23.97 USD |
| Subscription auto-renewal (authorization code) | ✅ Complete | `subscriptionRenewalService.ts` |
| Toggle auto-renewal on/off | ✅ Complete | `PATCH /api/payments/subscription/auto-renew` |
| Paystack webhook handler + HMAC verification | ✅ Complete | `POST /api/payments/webhook` |
| Profile booster single credit | ✅ Complete | NGN 800 / $4 USD |
| Profile booster bundle (5 credits) | ✅ Complete | NGN 2,000 / $7 USD |
| Profile booster activation (1hr boost) | ✅ Complete | `profileBooster.ts` — `activateProfileBoosterForUser()` |
| Subscription status in profile | ✅ Complete | `ManageSubscriptionSection.tsx` |
| Post-payment survey (marketer attribution) | ✅ Complete | `PostPaymentSurveyModal.tsx`, `POST /api/users/me/post-payment-survey` |
| Payment success page | ✅ Complete | `PaymentSuccess.tsx` |

---

### Community

| Feature | Status | Files |
|---|---|---|
| Community feed | ✅ Complete | `Community.tsx` |
| Prayer requests | ✅ Complete | Community post type |
| Blessings/encouragements | ✅ Complete | Community post type |
| Events | ✅ Complete | Community events section |
| Posts | ✅ Complete | Community posts section |

---

### Explore

| Feature | Status | Files |
|---|---|---|
| Discover by profile fit category | ✅ Complete | `GET /api/discover/profile-fits` (Premium only) |
| Discover by interests | ✅ Complete | `GET /api/discover/interests` |
| Profile fit category counts | ✅ Complete | `GET /api/discover/profile-fit-counts` |
| Explore page UI | ✅ Complete | `Explore.tsx`, `exploreCardArt.ts` |

---

### Profile Management

| Feature | Status | Files |
|---|---|---|
| Edit basic info (name, bio, location, age) | ✅ Complete | `BasicInfoSection.tsx` |
| Edit faith profile (denomination, journey, verse) | ✅ Complete | `FaithSection.tsx` |
| Edit interests/passions | ✅ Complete | `PassionsSection.tsx` |
| Upload/delete profile photos (1-6) | ✅ Complete | `PhotosSection.tsx`, `POST/DELETE /api/users/me/photo/:n` |
| View own profile | ✅ Complete | `Profile.tsx` |
| View another user's profile | ✅ Complete | `UserProfileView.tsx` |
| Passport mode country setting | ✅ Complete | `PATCH /api/users/me/passport` |
| Settings (notifications, privacy) | ✅ Complete | `Settings.tsx`, `PATCH /api/users/me/settings` |

---

### Safety & Reporting

| Feature | Status | Files |
|---|---|---|
| Report user/content | ✅ Complete | `Report.tsx`, `POST /api/support` with type REPORT |
| Safety note overlay | ✅ Complete | `SafetyNote.tsx` |
| Block user (via unmatch-block) | ✅ Complete | `POST /api/matches/unmatch-block/:userId` |
| Support ticket submission | ✅ Complete | `POST /api/support` with type HELP |
| View own support tickets | ✅ Complete | `GET /api/support/my-tickets` |

---

### PWA & Mobile

| Feature | Status | Files |
|---|---|---|
| Progressive Web App (PWA) | ✅ Complete | Service worker, `public/site.webmanifest` |
| PWA install prompt | ✅ Complete | `InstallAppButton.tsx`, `lib/installPrompt.ts` |
| Service worker (offline caching) | ✅ Complete | Registered in `main.tsx` (production only) |
| Android native app (Capacitor) | ✅ Complete | `frontend/android/`, `capacitor.config.ts` |
| Signed Android release build (CI) | ✅ Complete | `.github/workflows/android-build.yml` |
| SEO pre-rendering for public pages | ✅ Complete | `scripts/build-prerender.mjs` |
| Dynamic SEO meta tags | ✅ Complete | `SeoMetaManager.tsx`, `seo/routeSeo.ts` |
| Mobile-first responsive layout | ✅ Complete | MobileLayout (<1024px) / DesktopLayout (≥1024px) |

---

## 2. Partially Implemented Features

### Voice/Video Calling

**Status:** ⚠️ Signaling implemented — WebRTC peer connection missing

**What exists:**
- Socket.io events defined: `call_offer`, `call_answer`, `call_ice_candidate`, `call_reject`, `call_end`, `call_state`
- Call initiation event: `call_initiated` emitted from frontend
- `call_incoming` event broadcast to recipient
- Call UI elements visible in `Messages.tsx`

**What's missing:**
- No WebRTC `RTCPeerConnection` implementation in the frontend
- No ICE candidate exchange logic
- No media stream handling (`getUserMedia()`)
- The signaling infrastructure is in place but without the WebRTC layer, actual audio/video calls cannot be completed

**Files:** `backend/src/socket/socket.ts` (events), `frontend/src/services/WebSocketService.ts` (events), `frontend/src/pages/Messages.tsx` (UI)

**Estimate to complete:** 2–3 days of frontend WebRTC implementation

---

### Email Notifications

**Status:** ⚠️ Webhook trigger implemented — email service not in codebase

**What exists:**
- `EMAIL_WEBHOOK_URL` environment variable defined
- `notificationService.ts` makes an HTTP POST to `EMAIL_WEBHOOK_URL` after creating notifications
- This is best-effort (errors are silently caught)

**What's missing:**
- The actual email service (SendGrid, Resend, Postmark, etc.) is not implemented in this codebase
- The `EMAIL_WEBHOOK_URL` presumably points to an external service or a separate deployment
- No email templates, no email queue, no retry logic

**Status:** Emails work only if `EMAIL_WEBHOOK_URL` points to a properly configured external email handler.

---

### Explore Page — Full Category Coverage

**Status:** ⚠️ Backend endpoints exist — not all frontend categories verified wired

**What exists:**
- `GET /api/discover/profile-fits?fit=Professionals` — filters by profile fit
- `GET /api/discover/interests?interests=Music,Prayer` — filters by interests
- `Explore.tsx` UI with category cards
- `exploreCardArt.ts` — metadata for explore categories

**Uncertainty:** It's unconfirmed from inspection whether every Explore category card on the frontend correctly maps to and calls the backend endpoints, or if some categories are placeholder UI only.

**Action:** Manual QA needed — click every Explore category and verify API calls fire and results return.

---

### Marketer Attribution System

**Status:** ⚠️ Data model exists — UI/reporting incomplete

**What exists:**
- `role: 'marketer'` user role
- `postPaymentSurvey` field on user document
- `POST /api/users/me/post-payment-survey` endpoint
- `PostPaymentSurveyModal.tsx` — shown after payment
- `GET /api/users/marketers` — list all marketers (admin only)
- `GET /api/users/marketers/:id/customers` — customers per marketer (admin only)

**What's missing:**
- No marketer-specific dashboard or earnings view
- No referral link generation
- No commission tracking or payout system

**Status:** Data collection works; business logic for marketer rewards is not implemented.

---

## 3. Admin & Developer-Only Features

### Admin Dashboard (`/admin`) — `AdminRoute` guard

| Feature | Status | Access |
|---|---|---|
| Platform stats (users, subscriptions, revenue) | ✅ Complete | Admin |
| All users list (paginated, searchable) | ✅ Complete | Admin |
| Edit any user's profile | ✅ Complete | Admin — `PATCH /api/users/:id` |
| Change user role | ✅ Complete | Admin — `PATCH /api/users/:id/role` |
| Reset user password | ✅ Complete | Admin — `POST /api/users/:id/reset-password` |
| Delete any user | ✅ Complete | Admin — `DELETE /api/users/:id` |
| View all support tickets | ✅ Complete | Admin — `GET /api/support/tickets` |
| Reply to support tickets | ✅ Complete | Admin — `POST /api/support/tickets/:id/reply` |
| Payment analytics dashboard | ✅ Complete | Admin — `GET /api/payments/admin/analytics` |
| Delete payment records | ✅ Complete | Admin — `DELETE /api/payments/admin/records/:userId` |
| View marketer list + customers | ✅ Complete | Admin |

### Developer Hub (`/developer`) — `DeveloperRoute` guard

| Feature | Status | Access |
|---|---|---|
| Developer overview stats | ✅ Complete | Developer — `GET /api/users/developer/overview` |
| Toggle global feature flags | ✅ Complete | Developer — `PATCH /api/users/developer/feature-settings` |
| Enable/disable maintenance mode | ✅ Complete | Via feature flags |
| Enable/disable shutdown mode | ✅ Complete | Via feature flags |
| Enable/disable backend-only shutdown | ✅ Complete | Via feature flags |
| Enable/disable passport mode | ✅ Complete | Via feature flags |
| Bypass maintenance/shutdown mode | ✅ Complete | Admin/developer routes are excluded from the gate |

### Onboarding Debug (`/onboarding-debug`)

| Feature | Status | Access |
|---|---|---|
| Debug onboarding state | ✅ Complete | No route guard — accessible by URL only |
| View onboarding completion status | ✅ Complete | `GET /api/users/me/onboarding-debug` |

**Note:** This page has no authentication or role guard — any user who knows the URL can access it. It only reads debug info (no write capability), but it should ideally be protected.

---

## 4. Disabled / Legacy / Dead Code

### Password-Based Authentication

**Status:** ❌ Not implemented — dead dependency

- `bcryptjs` is installed in `frontend/package.json`
- No password registration, login, or change password endpoints exist
- No form for username/password input exists
- The only authentication method is Google OAuth via Firebase

**Action:** Remove `bcryptjs` from frontend dependencies.

---

### Google OAuth via Passport.js

**Status:** ❌ Configured but no routes registered

- `backend/src/config/passport.ts` configures a Google OAuth strategy
- No route in `backend/src/routes/` uses `passport.authenticate('google')`
- Firebase handles all Google OAuth — Passport.js is completely redundant

**Action:** Remove `passport`, `passport-google-oauth20` from backend; delete `config/passport.ts`.

---

### Legacy Firebase Auth Middleware

**Status:** ❌ Superseded — not imported anywhere

- `backend/src/middleware/firebaseAuth.ts` is a legacy auth middleware
- `backend/src/middleware/authMiddleware.ts` is the active implementation
- No route imports `firebaseAuth.ts`

**Action:** Delete `backend/src/middleware/firebaseAuth.ts`.

---

### MongoDB Models

**Status:** ❌ Present but primary DB is Firestore

- `backend/src/models/` contains Mongoose schema definitions
- All active controllers write to Firestore via Firebase Admin SDK
- MongoDB connection established in `server.ts` but no clear feature uses it exclusively

**Action:** Audit models directory; remove if unused.

---

### `@sendgrid/mail` in Frontend

**Status:** ❌ Wrong package location — email is a backend concern

- `@sendgrid/mail` is in `frontend/package.json`
- Sending emails from the browser exposes API keys and is blocked by most CSPs
- Email is handled via webhook in `notificationService.ts` (backend)

**Action:** `pnpm remove @sendgrid/mail` in frontend.

---

## 5. Feature Flag System

Feature flags are stored in the Firestore `appConfig/features` document and managed by developers via the Developer Hub.

| Flag | Type | Effect |
|---|---|---|
| `maintenanceModeEnabled` | boolean | Shows full-screen maintenance overlay to all users (admin/developer bypass) |
| `shutdownModeEnabled` | boolean | Complete app shutdown — shows shutdown overlay |
| `backendOnlyShutdownEnabled` | boolean | Returns 503 from all backend API routes for non-developer users |
| `passportModeEnabled` | boolean | Enables passport country feature in profile discovery |

**How they work:**
- Frontend polls `GET /api/users/public-feature-settings` every 15 seconds
- Cached in `localStorage` as `featureSettings`
- `App.tsx` checks flags and renders overlays accordingly
- Backend `backendAvailabilityMiddleware.ts` checks `backendOnlyShutdownEnabled` on every API request

---

## 6. Feature Matrix by User Tier

| Feature | Free | Premium | Elite | Admin/Dev |
|---|---|---|---|---|
| Create profile + onboarding | ✅ | ✅ | ✅ | ✅ |
| Swipe deck | ✅ (10/day) | ✅ (unlimited) | ✅ (unlimited) | ✅ |
| Like / match | ✅ | ✅ | ✅ | ✅ |
| Message 1 active match | ✅ | — | — | — |
| Unlimited messaging | — | ✅ | ✅ | ✅ |
| Advanced discovery filters | — | ✅ | ✅ | ✅ |
| Discover by profile fit | — | ✅ | ✅ | ✅ |
| See who liked you | — | ✅ | ✅ | ✅ |
| Passport mode | — | ✅ | ✅ | ✅ |
| Profile booster | Purchase separately | Included credits | More credits | N/A |
| Stories | ✅ | ✅ | ✅ | ✅ |
| Community | ✅ | ✅ | ✅ | ✅ |
| Notifications | ✅ | ✅ | ✅ | ✅ |
| Admin dashboard | — | — | — | ✅ (admin) |
| Developer tools | — | — | — | ✅ (developer) |

**Notes:**
- Free user chat limit enforced via `chatAccess.ts` (1 active match = oldest match by createdAt)
- Free user swipe limit enforced in `matchController.ts` (10/day based on daily like count)
- Profile booster can be purchased separately by any user tier

---

## 7. Missing Features (Common in Similar Products)

These features are **not currently implemented** but are typical in comparable dating/community apps:

| Feature | Priority | Notes |
|---|---|---|
| Email/password authentication | Medium | Only Google OAuth currently — limits accessibility |
| Profile verification (ID or selfie) | High | No verification badge system exists |
| Super Like / prioritized like | Medium | Common premium feature, not implemented |
| Undo last swipe | Medium | Common premium feature, not implemented |
| See who visited your profile | Low | No profile view tracking |
| Boost visibility timer UI | Low | Profile booster activates but no countdown timer shown |
| In-app browser notification permissions flow | Medium | Relies on browser default prompt |
| Match expiry (e.g., 7 days to message) | Low | Matches never expire |
| Video profiles / prompts | Medium | Only static photos — no video intro |
| Verified phone number | Medium | Phone collected but not verified via OTP |
| Two-factor authentication | Low | Firebase supports it but not implemented |
| Apple Sign-In | Medium | Required for iOS App Store submission |
| Dark mode toggle (user preference) | Low | CSS vars defined but no toggle UI |
| In-app purchase via Google Play / App Store | High | Required for Play Store compliance (can't use Paystack for digital goods in-app) |
| Push notifications (FCM) | Medium | Browser notifications exist; no Firebase Cloud Messaging for background push |
| Profile prompts / icebreakers | Low | `personalPromptQuestion/Answer` collected in onboarding but no UI highlight |
| Mutual friend/connection indicators | Low | No social graph beyond matching |
| Language filter in discovery | Low | `languageSpoken` collected but no discovery filter |
