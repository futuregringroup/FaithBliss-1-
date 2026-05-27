# Payment Gateway Integration & Architecture Guide
> Paystack · Node.js/Express · Firebase/Firestore · Vercel  
> Built from the FaithBliss production implementation — May 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Problems We Encountered & Fixed](#2-problems-we-encountered--fixed)
3. [Correct Production Architecture](#3-correct-production-architecture)
4. [Step-by-Step Integration Guide](#4-step-by-step-integration-guide)
5. [Security Best Practices](#5-security-best-practices)
6. [Common Mistakes & Pitfalls](#6-common-mistakes--pitfalls)
7. [Go-Live Checklist](#7-go-live-checklist)
8. [Reusable Boilerplate Examples](#8-reusable-boilerplate-examples)
9. [Troubleshooting Playbook](#9-troubleshooting-playbook)

---

## 1. System Overview

### 1.1 What Paystack Actually Does

Paystack is a payment processor. You send it a charge request; it handles card collection, bank transfers, fraud checks, and currency conversion. You never see raw card numbers — Paystack handles PCI compliance on your behalf.

The two things Paystack gives back that matter most:

| Object | What it is | When you use it |
|--------|------------|-----------------|
| `authorization_url` | A hosted checkout page URL | Redirect or pop the user here to pay |
| `authorization_code` | A stored card token | Charge the user again later without a new form |

### 1.2 Full Payment Lifecycle

```
User clicks "Subscribe"
        │
        ▼
[Frontend] GET /api/payments/quote
  ← { displayCurrency, displayAmountMajor, chargeCurrency, chargeAmountSubunits }
        │
        ▼
[Frontend] POST /api/pay  { tier, billingCycle }
        │
        ▼
[Backend] initializeTransaction → Paystack /transaction/initialize
  ← { authorization_url, access_code, reference }
        │
        ▼
[Frontend] redirect to authorization_url  (Paystack hosted checkout)
        │
        ▼
[Paystack] user enters card / completes bank transfer
        │
        ├──── [Paystack] sends webhook → POST /api/payments/webhook
        │          (async, server-to-server, HMAC-signed)
        │
        └──── [Paystack] redirects user to callback_url?reference=xxx
                   │
                   ▼
             [Frontend /payment-success page]
                   │
                   ▼
             [Frontend] POST /api/payments/verify  { reference }
                   │
                   ▼
             [Backend] verifyTransaction → Paystack /transaction/verify/:ref
                   │
                   ▼
             [Backend] updates Firestore subscription to "active"
                   │
                   ▼
             [Frontend] shows success screen
```

### 1.3 Three Events You Must Understand

| Event | Who triggers it | Purpose |
|-------|----------------|---------|
| **Initialization** | Your backend | Create a payment session, get `authorization_url` |
| **Callback** | Paystack → browser redirect | Tell the frontend "payment completed, go verify it" |
| **Webhook** | Paystack → your backend (HTTP POST) | Tell your server the payment succeeded/failed — this is the authoritative source |

**Key insight:** The callback redirect is *not* proof of payment. The user's browser can be closed, modified, or replayed. The webhook and the `/transaction/verify` API call are the only two trustworthy signals.

### 1.4 Why Verification Must Happen on the Backend

If you verify a payment on the frontend, an attacker can:
1. Open DevTools and fake the response from Paystack
2. Replay a successful verification from a different, smaller transaction
3. Skip the Paystack page entirely and POST a fake `{ status: "success" }` to your app

Backend verification calls Paystack's API with your secret key. The secret key is never exposed to the browser. Paystack's server confirms the transaction is genuine and returns the real amount charged.

### 1.5 Test Mode vs Production Mode

| | Test mode | Production mode |
|---|-----------|----------------|
| Secret key prefix | `sk_test_` | `sk_live_` |
| Public key prefix | `pk_test_` | `pk_live_` |
| Real money charged | No | Yes |
| Webhook delivery | Yes (to test URL) | Yes (to live URL) |
| Plans created in | Test dashboard | Live dashboard |

**Critical:** Plans created in the test dashboard do **not** exist in production. This was the root cause of our "Plan not found" crash — see Section 2.

---

## 2. Problems We Encountered & Fixed

### Problem 1: "Plan not found" — Runtime Payment Crash

**Symptom**  
Every card payment attempt failed with the error `Plan not found` returned from Paystack.

**Root cause**  
The backend was reading two environment variables:
```
PAYSTACK_PLAN_CODE_PREMIUM_MONTHLY=PLN_xxx_test_xxx
PAYSTACK_PLAN_CODE_PREMIUM_QUARTERLY=PLN_xxx_test_xxx
```
These were *test environment* plan codes created in the Paystack test dashboard. The production environment was using a `sk_live_` key. Paystack's live API does not know about plans created in test mode — they exist in completely separate databases. The API correctly returned "Plan not found."

Additionally, sending a `plan` field to `/transaction/initialize` tells Paystack to create a Paystack-managed subscription, not just charge a card. This creates a tight coupling to Paystack's subscription system, which is brittle and unnecessary when you manage subscription state yourself.

**Fix applied**  
Removed all plan-based code paths. The payment initialization now uses *authorization-based charging* — Paystack charges the card directly, stores the `authorization_code`, and we re-use that code for renewals ourselves.

```typescript
// BEFORE (broken)
const planCode = process.env.PAYSTACK_PLAN_CODE_PREMIUM_MONTHLY; // test code in production
await initializeTransaction({ email, amount, plan: planCode }); // "Plan not found"

// AFTER (correct)
const planCode = null; // never send plan to Paystack
await initializeTransaction({ email, amount, currency, callback_url, metadata });
```

Removed env vars: `PAYSTACK_PLAN_CODE_PREMIUM_MONTHLY`, `PAYSTACK_PLAN_CODE_PREMIUM_QUARTERLY`

**How to prevent in future projects**  
- Never use Paystack plans unless you specifically need Paystack to manage recurring billing for you.
- Authorization-based charging (described in Section 3) gives you full control and avoids this entire class of bugs.
- If you do use plans, create them separately in test and production dashboards, and use two separate env vars (`PAYSTACK_PLAN_CODE_..._TEST` vs `..._LIVE`).

---

### Problem 2: Backend Deploying to the Wrong Vercel Project

**Symptom**  
After pushing code, the backend at `faithbliss-backend.vercel.app` was not updating. Logs showed deployments going to a different project (`backend` in the wrong team scope).

**Root cause**  
The `backend/.vercel/project.json` file was pointing to a stale project from a different Vercel team:
```json
{ "projectId": "prj_OLD...", "orgId": "team_WRONG_TEAM", "projectName": "backend" }
```
The Vercel CLI uses this file to determine where to deploy. It was never updated when the project was migrated between teams.

Additionally, the correct Vercel project (`faithbliss-backend`) had `rootDirectory: "backend"` configured in the dashboard. Deploying from *inside* the `backend/` folder caused a path doubling error:
```
Error: The provided path `backend\backend` does not exist
```
Because Vercel prepends `rootDirectory` to the path the CLI provides.

**Fix applied**  
1. Deleted stale `backend/.vercel/project.json`
2. Created `/.vercel/project.json` at the **repo root** pointing to the correct project
3. All deploys now run from the repo root: `vercel deploy --prod`

```json
// /.vercel/project.json (repo root)
{
  "projectId": "prj_U79rrzFc2ZpwMarKtfgDIfUDtgVB",
  "orgId": "team_fIHimpVUNVZyhn20tx6mHLBO",
  "projectName": "faithbliss-backend"
}
```

**How to prevent in future projects**  
- Always store `.vercel/project.json` at the **same level from which you run `vercel deploy`**.
- If `rootDirectory` is set in the Vercel dashboard, deploy from the directory *above* it (repo root).
- After linking, run `vercel inspect` to confirm the deployment alias points to the right project before going live.

---

### Problem 3: Test Key in Production

**Symptom**  
Paystack checkout showed a "TEST" badge on the payment page in production.

**Root cause**  
`PAYSTACK_SECRET_KEY` in the production Vercel environment was still set to `sk_test_...`.

**Fix applied**  
Updated the Vercel environment variable to `sk_live_...`. Added a runtime guard in `paystackService.ts` that throws immediately if a test key is detected in `NODE_ENV=production`:

```typescript
if (process.env.NODE_ENV === 'production' && secret.startsWith('sk_test_')) {
  throw new Error('Payment is misconfigured: production must not use test credentials.');
}
```

**How to prevent**  
- Treat `sk_live_` as a production secret. Set it only in Vercel's Production environment scope, never in Preview or Development.
- Use the runtime guard above — it fails fast and loudly instead of silently processing test transactions.

---

## 3. Correct Production Architecture

### 3.1 Folder Structure

```
my-app/
├── backend/
│   ├── api/
│   │   └── index.ts            # Vercel serverless entry point
│   ├── src/
│   │   ├── controllers/
│   │   │   └── paymentController.ts
│   │   ├── routes/
│   │   │   └── paymentRoutes.ts
│   │   ├── services/
│   │   │   ├── paystackService.ts        # Paystack API wrapper
│   │   │   ├── regionalPricingService.ts # IP-based pricing logic
│   │   │   ├── geoLocationService.ts     # IP → country lookup
│   │   │   └── exchangeRateService.ts    # USD FX rates
│   │   ├── middleware/
│   │   │   └── authMiddleware.ts         # Firebase token verification
│   │   └── config/
│   │       └── firebase-admin.ts
│   └── vercel.json
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Premium.tsx               # Pricing UI
│       │   └── PaymentSuccess.tsx        # Post-payment verification
│       └── services/
│           └── api.ts                    # Typed API client
└── .vercel/
    └── project.json                      # Links CLI to correct Vercel project
```

### 3.2 Active API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/api/payments/webhook` | None (HMAC) | Receive Paystack events |
| `GET` | `/api/payments/quote` | JWT | Get localized pricing |
| `GET` | `/api/payments/profile-booster/quote` | JWT | Get booster pricing |
| `POST` | `/api/pay` | JWT | Initialize subscription payment |
| `POST` | `/api/payments/profile-booster/pay` | JWT | Initialize booster payment |
| `POST` | `/api/payments/verify` | JWT | Verify payment after callback |
| `PATCH` | `/api/payments/subscription/auto-renew` | JWT | Toggle auto-renewal |
| `GET` | `/api/payments/admin/analytics` | JWT + Admin | Payment analytics |
| `DELETE` | `/api/payments/admin/records/:userId` | JWT + Admin | Delete payment record |

### 3.3 Pricing Architecture: Three Regions

Every user is classified into one of three pricing regions based on their IP address, with a fallback to their Firestore profile's `countryCode` or `location` fields:

```
Nigeria (NG)
  → charge in NGN  (₦5,000/mo · ₦10,000/qtr)
  → display in NGN

Africa (any African country except NG)
  → charge in USD  ($11.99/mo · $23.97/qtr)
  → display in local currency (KES, GHS, ZAR, etc.)
  → exchange rate from live FX API

Global (everyone else)
  → charge in USD  ($11.99/mo · $23.97/qtr)
  → display in USD
```

The `chargeCurrency` and `chargeAmountSubunits` are what go to Paystack. The `displayCurrency` and `displayAmountMajor` are what the user sees on the pricing page. They can differ (a Kenyan user sees KES but is charged in USD).

### 3.4 Authorization-Based Renewal Flow

After a successful first payment, Paystack returns an `authorization_code`. This is a tokenized card reference. Your backend stores it in Firestore:

```
user.subscription.authorizationCode = "AUTH_xxx"
user.subscription.customerCode = "CUS_xxx"
user.subscription.renewalProvider = "authorization"
```

When it's time to renew (via cron or manual trigger):
```typescript
await chargeAuthorization({
  authorization_code: subscription.authorizationCode,
  email: subscription.customerEmail,
  amount: subscription.chargeAmountSubunits,
  currency: subscription.currency,
  metadata: { userId, tier, billingCycle }
});
```

This charges the saved card silently — no checkout page needed.

### 3.5 Webhook Event Handling

Paystack sends a signed POST to your webhook URL for every meaningful event. The events you must handle:

| Event | Meaning | Action |
|-------|---------|--------|
| `charge.success` | One-time or recurring charge succeeded | Activate subscription / grant credits |
| `subscription.create` | Paystack-managed subscription created | Activate subscription (plan-based only) |
| `invoice.payment_succeeded` | Plan subscription renewed | Extend subscription period |
| `invoice.payment_failed` | Renewal failed | Mark subscription for deactivation |
| `subscription.disable` | User cancelled on Paystack side | Deactivate subscription |

Always respond with `200 OK` immediately, even if your processing fails. If you return non-200, Paystack will retry the webhook, potentially activating a subscription multiple times. Use idempotency keys (the transaction `reference`) to prevent double-processing.

---

## 4. Step-by-Step Integration Guide

Follow these steps in order. Skipping ahead causes the "works in test but breaks in production" failure mode.

### Step 1: Paystack Dashboard Setup

1. Create a Paystack account at `paystack.com`
2. Complete business verification (required for live keys)
3. Navigate to **Settings → API Keys & Webhooks**
4. Copy your **Test Secret Key** (`sk_test_...`) for development
5. Copy your **Live Secret Key** (`sk_live_...`) for production — treat this like a database password
6. Set your webhook URL (you'll deploy first, then come back): `https://your-backend.vercel.app/api/payments/webhook`
7. In webhook settings, enable at minimum: `charge.success`, `invoice.payment_succeeded`, `invoice.payment_failed`

### Step 2: Backend Environment Variables

Create `backend/.env` for local development (never commit this):

```bash
# Server
PORT=5000
NODE_ENV=development

# Frontend URL (no trailing slash)
CLIENT_URL=http://localhost:5173

# MongoDB / Firestore connection
MONGO_URI=mongodb+srv://...

# Firebase Admin SDK (base64-encoded service account JSON)
# Windows: [Convert]::ToBase64String([IO.File]::ReadAllBytes('serviceAccountKey.json'))
# macOS/Linux: base64 -i serviceAccountKey.json | tr -d '\n'
FIREBASE_CREDENTIALS_BASE64=

# Paystack — use sk_test_ locally, sk_live_ in production only
PAYSTACK_SECRET_KEY=sk_test_...

# Email / admin
EMAIL_WEBHOOK_URL=
PRIMARY_ADMIN_EMAIL=admin@yourdomain.com
```

Set production variables in **Vercel Dashboard → Project → Settings → Environment Variables**, scoped to the `Production` environment only for live keys.

### Step 3: Backend — Paystack Service Layer

Create `src/services/paystackService.ts` (see Section 8 for full boilerplate). The service wraps four Paystack API calls:

- `initializeTransaction` — start a payment session
- `verifyTransaction` — confirm a payment succeeded
- `chargeAuthorization` — charge a saved card (renewals)
- `enableSubscription` / `disableSubscription` — toggle Paystack-managed plans (only if using plan mode)

### Step 4: Backend — Regional Pricing Service

Create `src/services/regionalPricingService.ts`. This service:

1. Looks up the user's country from their IP address
2. Classifies them into a pricing region (nigeria / africa / global)
3. Returns both the charge amount (what Paystack sees) and the display amount (what the user sees)

Do not hardcode prices in the controller. The pricing service is the single source of truth.

### Step 5: Backend — Payment Controller

Create `src/controllers/paymentController.ts` with these exported functions:

- `initializeLocalizedSubscription` — creates a Paystack transaction, saves `pending` status to DB
- `verifySubscription` — calls Paystack to confirm, upgrades DB to `active`
- `handlePaystackWebhook` — validates HMAC, processes events idempotently
- `getLocalizedPricingQuote` — returns pricing for the current user's region
- `updateSubscriptionAutoRenew` — toggles the `autoRenewEnabled` flag

### Step 6: Backend — Routes

```typescript
// src/routes/paymentRoutes.ts
router.post('/webhook', handlePaystackWebhook);        // no auth — HMAC protected
router.get('/quote', protect, getLocalizedPricingQuote);
router.post('/pay', protect, initializeLocalizedSubscription);  // also mounted directly on server.ts
router.post('/verify', protect, verifySubscription);
router.patch('/subscription/auto-renew', protect, updateSubscriptionAutoRenew);
```

Mount in your server: `app.use('/api/payments', paymentRoutes)`

The webhook route must be mounted **before** any `express.json()` middleware, or you need to save the raw body separately. Paystack signature verification requires the exact raw bytes.

### Step 7: Raw Body Capture for Webhooks

```typescript
// In your Express server setup — MUST come before express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, _res, next) => {
  (req as any).rawBody = req.body; // Buffer
  next();
});

// Then parse JSON for all other routes
app.use(express.json());
```

### Step 8: Frontend — Pricing Quote

Before showing prices, fetch the localized quote:

```typescript
// On the pricing page, on mount
const quote = await PaymentAPI.getQuote(); // GET /api/payments/quote
// Show quote.quotes.monthly.displayLabel and quote.quotes.quarterly.displayLabel to the user
```

Never hardcode prices on the frontend. They change by region.

### Step 9: Frontend — Payment Initialization

```typescript
const handleSubscribe = async (tier: string, billingCycle: string) => {
  const result = await PaymentAPI.pay({ tier, billingCycle }); // POST /api/pay
  // result.authorizationUrl is the Paystack hosted checkout page
  window.location.href = result.authorizationUrl;
};
```

### Step 10: Frontend — Payment Success Page

After the user pays, Paystack redirects to `CLIENT_URL/payment-success?reference=xxx`. Your success page must:

1. Extract `reference` from the URL query string
2. Call `POST /api/payments/verify` with the reference
3. Only show success UI after the backend confirms it

```typescript
// pages/PaymentSuccess.tsx
const reference = new URLSearchParams(window.location.search).get('reference');
const result = await PaymentAPI.verify({ reference });
if (result.data.status === 'success') {
  // Show success, refresh user profile
}
```

### Step 11: Vercel Deployment Configuration

1. In the Vercel dashboard, set `rootDirectory` to `backend` for your backend project
2. Create `.vercel/project.json` at the **repo root** (not inside `backend/`):

```json
{
  "projectId": "prj_YOUR_PROJECT_ID",
  "orgId": "team_YOUR_ORG_ID",
  "projectName": "your-backend-project-name"
}
```

3. Deploy from repo root: `vercel deploy --prod`
4. Set all production environment variables in the Vercel dashboard
5. Update your webhook URL in Paystack dashboard to the deployed URL

### Step 12: Verify End-to-End in Test Mode

1. Use Paystack test card: `4084084084084081`, CVV `408`, expiry any future date
2. Complete a payment, confirm the backend receives the webhook
3. Check Firestore that `subscriptionStatus` changed from `pending` → `active`
4. Confirm the `/payment-success` page shows the correct state

---

## 5. Security Best Practices

### 5.1 Never Verify Payments on the Frontend

```typescript
// INSECURE — attacker can fake this response
const response = await fetch('https://api.paystack.co/transaction/verify/' + reference, {
  headers: { Authorization: `Bearer ${publicKey}` } // public key is visible in browser
});

// CORRECT — backend verifies with secret key, never exposed to browser
const response = await PaymentAPI.verify({ reference }); // your own backend endpoint
```

### 5.2 Webhook Signature Validation

Every webhook from Paystack includes an `x-paystack-signature` header — an HMAC-SHA512 hash of the raw request body using your secret key. Always verify this before processing:

```typescript
const hash = crypto
  .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
  .update(rawBody)      // must be the raw Buffer, not parsed JSON
  .digest('hex');

if (hash !== req.headers['x-paystack-signature']) {
  return res.status(401).json({ message: 'Invalid webhook signature.' });
}
```

**Why raw body:** JSON parsers may reorder keys or strip whitespace. Even a single character change invalidates the HMAC. Always verify against the exact bytes Paystack sent.

### 5.3 Secret Key Protection

- `sk_live_` keys must never appear in frontend code, git history, or logs
- Store in environment variables only — never in source code
- Rotate immediately if accidentally committed (Paystack provides key rotation in the dashboard)
- Scope Vercel env vars: set `sk_live_` only for the `Production` environment, `sk_test_` for `Preview` and `Development`

### 5.4 Idempotency — Prevent Double Processing

A webhook may be delivered more than once (Paystack retries on non-200 responses, network issues, etc.). Your handler must be idempotent — processing the same event twice must produce the same result.

```typescript
// Check if this reference was already processed
const existingSubscription = await getStoredSubscription(userId);
if (existingSubscription?.reference === data.reference && existingSubscription?.status === 'active') {
  return res.status(200).json({ received: true }); // already done
}

// Process and mark as handled
await updateSubscription(userId, { status: 'active', reference: data.reference });
return res.status(200).json({ received: true });
```

Always return `200 OK` immediately even if something fails internally — log the error but don't return non-200 to Paystack, or you'll receive the same webhook repeatedly.

### 5.5 Duplicate Charge Prevention

Before initializing a new payment, check if the user already has a `pending` or `active` subscription:

```typescript
const existingSubscription = await getStoredSubscription(userId);
if (existingSubscription?.status === 'active') {
  return res.status(409).json({ message: 'Subscription is already active.' });
}
```

### 5.6 Secure Callback Handling

The callback URL (`callback_url`) is the page Paystack redirects the user to after payment. Treat the `reference` in this URL as untrusted input — it confirms the user went through checkout, not that they paid:

```typescript
// INSECURE — trusting the URL parameter directly
if (searchParams.get('status') === 'success') grantAccess(); // forgeable

// CORRECT — always verify via backend
const ref = searchParams.get('reference');
const result = await PaymentAPI.verify({ reference: ref });
if (result.data.status === 'success') grantAccess();
```

### 5.7 Authorization Code Safety

`authorization_code` values stored in Firestore are sensitive — they allow charging the user without their interaction. Apply Firestore security rules:

```
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;
  // The authorization_code inside subscription is write-only for backend
  // Frontend should not be able to read subscription.authorizationCode
}
```

---

## 6. Common Mistakes & Pitfalls

### 6.1 Test Plan Codes in Production
**Symptom:** `Plan not found`  
**Cause:** Plans exist per environment. Test plans don't exist in live mode.  
**Fix:** Don't use Paystack plans. Use authorization-based charging instead.

### 6.2 Sending `plan` Field Without a Plan Existing
**Symptom:** `Plan not found` or `This plan does not exist`  
**Cause:** Passing `plan: planCode` to `/transaction/initialize` when either the plan doesn't exist in that environment, or the plan code is `undefined`/`null` and evaluates to a string.  
**Fix:**
```typescript
// Only include plan if you actually have a valid plan code
...(planCode ? { plan: planCode } : {})
```

### 6.3 Wrong Vercel Project Linked
**Symptom:** Deployments succeed but the production URL doesn't update  
**Cause:** `.vercel/project.json` points to a different project  
**Fix:** Delete `.vercel/project.json`, run `vercel link`, verify with `vercel inspect`

### 6.4 rootDirectory + Deploy Path Doubling
**Symptom:** `Error: path backend/backend does not exist`  
**Cause:** Vercel project has `rootDirectory: "backend"` set. You're running `vercel deploy` from inside `backend/`. Vercel prepends `rootDirectory` again.  
**Fix:** Always deploy from the repo root when `rootDirectory` is set in the dashboard.

### 6.5 Verifying Payment on Callback, Not on Webhook
**Symptom:** Users get access before payment clears, or don't get access if they close the browser  
**Cause:** Relying only on the callback URL redirect to trigger verification  
**Fix:** The webhook is the authoritative event. Your webhook handler should activate subscriptions. Verification via the success page is a UX convenience only.

### 6.6 Not Saving Raw Body for Webhook Verification
**Symptom:** `Invalid webhook signature` on every request  
**Cause:** `express.json()` parses the body before you can access it as raw bytes  
**Fix:** Use `express.raw()` before `express.json()` for the webhook route, or use a body parser middleware that captures `rawBody`.

### 6.7 Hardcoded Amounts in Frontend
**Symptom:** Prices don't match what Paystack charges; users complain about wrong amounts  
**Cause:** Amount is set client-side and can drift from backend pricing  
**Fix:** Always fetch the quote from the backend (`GET /api/payments/quote`) immediately before rendering the pricing page.

### 6.8 Currency Mismatch
**Symptom:** Paystack error `Currency mismatch` or incorrect charges  
**Cause:** Initializing with `currency: "NGN"` for a user who should be charged in USD  
**Fix:** The regional pricing service determines `chargeCurrency`. Never hardcode it.

### 6.9 Amount in Wrong Unit
**Symptom:** User charged ₦50 instead of ₦5,000 (or vice versa)  
**Cause:** Paystack expects amounts in **subunits** (kobo for NGN, cents for USD). ₦5,000 = `500000` kobo.  
**Fix:** Always multiply by 100: `chargeAmountSubunits = chargeAmountMajor * 100`

### 6.10 Non-200 Response to Webhook
**Symptom:** Same subscription activated 3–5 times; duplicate charges  
**Cause:** Webhook handler throws an error, returns 500. Paystack retries.  
**Fix:** Catch all errors inside webhook handler, log them, always return 200. Process idempotently.

### 6.11 Metadata Not Passed Through
**Symptom:** Webhook fires but `userId` is `undefined`, subscription not activated  
**Cause:** Forgetting to include `metadata: { userId, tier, billingCycle }` in the initialization payload  
**Fix:** Pass all context in `metadata` — it's returned verbatim in the webhook and verify response.

### 6.12 Using Public Key on Backend
**Symptom:** `Invalid key` errors or test transactions going through in production  
**Cause:** Using `pk_live_` or `pk_test_` on the backend instead of `sk_live_` / `sk_test_`  
**Fix:** Backend always uses the **Secret Key** (`sk_`). The **Public Key** (`pk_`) is only for frontend SDKs or Paystack's inline JS.

---

## 7. Go-Live Checklist

Work through this list from top to bottom before opening payments to real users.

### Paystack Dashboard
- [ ] Business verification complete (required for live key activation)
- [ ] Live secret key (`sk_live_`) copied and stored in a password manager
- [ ] Webhook URL set to production backend: `https://your-backend.vercel.app/api/payments/webhook`
- [ ] Webhook events enabled: `charge.success`, `invoice.payment_succeeded`, `invoice.payment_failed`
- [ ] Test a webhook delivery from the Paystack dashboard — confirm your backend responds 200

### Environment Variables (Vercel Dashboard)
- [ ] `PAYSTACK_SECRET_KEY` = `sk_live_...` (Production scope only)
- [ ] `CLIENT_URL` = production frontend URL (no trailing slash)
- [ ] `MONGO_URI` or `FIREBASE_CREDENTIALS_BASE64` configured for production database
- [ ] `NODE_ENV` = `production`
- [ ] `PRIMARY_ADMIN_EMAIL` = real admin email
- [ ] No `PAYSTACK_PLAN_CODE_*` variables set (these were removed)

### Backend Code
- [ ] Runtime key guard present in `paystackService.ts` (throws if `sk_test_` in production)
- [ ] Webhook signature validation in place (HMAC-SHA512 against raw body)
- [ ] Idempotency check before activating subscription in webhook handler
- [ ] `callback_url` set to `CLIENT_URL/payment-success`
- [ ] All payment amounts come from the regional pricing service, never hardcoded
- [ ] `amount` sent to Paystack is in subunits (multiply by 100)

### Frontend Code
- [ ] Pricing page fetches quote from backend on mount (never hardcoded)
- [ ] Payment success page calls `/api/payments/verify` before showing success
- [ ] No secret keys, Paystack credentials, or authorization codes in frontend code

### Database / Firestore
- [ ] Firestore security rules deployed (not the default "allow all")
- [ ] Users' `subscription` field readable only by the owning user
- [ ] `authorizationCode` not directly readable via frontend queries

### Deployment
- [ ] `.vercel/project.json` at repo root, pointing to correct project and team
- [ ] Deploy from repo root (not from inside `backend/`)
- [ ] `vercel inspect <deployment-url>` confirms the right alias and project
- [ ] SSL/HTTPS active on production domain (required by Paystack for webhooks)

### Post-Deploy Smoke Test
- [ ] Complete a full test payment with Paystack test card: `4084084084084081`
- [ ] Confirm webhook is received and processed (check Vercel function logs)
- [ ] Confirm Firestore `subscriptionStatus` changes from `pending` → `active`
- [ ] Confirm `/payment-success` page shows correct state
- [ ] Switch to live keys, complete a real ₦100 or $1 test charge, then refund via Paystack dashboard
- [ ] Set up error alerting (Vercel log drain, Sentry, or similar)

---

## 8. Reusable Boilerplate Examples

### 8.1 Paystack Service Layer

```typescript
// src/services/paystackService.ts
import crypto from 'crypto';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const getHeaders = () => {
  const secret = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secret) throw new Error('PAYSTACK_SECRET_KEY is not set');
  if (process.env.NODE_ENV === 'production' && secret.startsWith('sk_test_')) {
    throw new Error('Production must use sk_live_ key, not sk_test_');
  }
  return {
    Authorization: `Bearer ${secret}`,
    'Content-Type': 'application/json',
  };
};

const paystackRequest = async <T>(path: string, options: RequestInit) => {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers || {}) },
  });
  const payload = await response.json() as { status: boolean; message: string; data: T };
  if (!response.ok) throw new Error(payload?.message || 'Paystack request failed');
  return payload;
};

export const initializeTransaction = (payload: Record<string, unknown>) =>
  paystackRequest<{ authorization_url: string; access_code: string; reference: string }>(
    '/transaction/initialize',
    { method: 'POST', body: JSON.stringify(payload) }
  );

export const verifyTransaction = (reference: string) =>
  paystackRequest<Record<string, any>>(
    `/transaction/verify/${reference}`,
    { method: 'GET' }
  );

export const chargeAuthorization = (payload: {
  authorization_code: string;
  email: string;
  amount: number;
  currency?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}) =>
  paystackRequest<Record<string, any>>(
    '/transaction/charge_authorization',
    { method: 'POST', body: JSON.stringify(payload) }
  );

export const verifyWebhookSignature = (rawBody: Buffer, signature: string): boolean => {
  const secret = process.env.PAYSTACK_SECRET_KEY!;
  const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  return hash === signature;
};
```

### 8.2 Payment Initialization Endpoint

```typescript
// POST /api/pay
export const initializePayment = async (req: Request, res: Response) => {
  const userId = req.userId;
  const email = req.user?.email;
  const { tier, billingCycle } = req.body;

  if (!userId || !email) return res.status(401).json({ message: 'Unauthorized.' });
  if (!['premium', 'elite'].includes(tier)) return res.status(400).json({ message: 'Invalid tier.' });
  if (!['monthly', 'quarterly'].includes(billingCycle)) return res.status(400).json({ message: 'Invalid billing cycle.' });

  // Get IP-based regional pricing
  const clientIp = extractClientIp(req.headers);
  const quote = await getRegionalPricingQuote(billingCycle, clientIp);

  const callbackUrl = `${process.env.CLIENT_URL}/payment-success`;

  // IMPORTANT: never send `plan` field — use authorization-based charging
  const response = await initializeTransaction({
    email,
    amount: quote.chargeAmountSubunits,  // subunits (kobo / cents)
    currency: quote.chargeCurrency,
    callback_url: callbackUrl,
    metadata: {
      userId,
      tier,
      billingCycle,
      renewalProvider: 'authorization',
      pricingRegion: quote.region,
      displayCurrency: quote.displayCurrency,
      displayAmountMajor: quote.displayAmountMajor,
      chargeAmountMajor: quote.chargeAmountMajor,
      chargeAmountSubunits: quote.chargeAmountSubunits,
    },
  });

  // Save pending state immediately — webhook or verify will activate it
  await db.collection('users').doc(userId).set({
    subscription: {
      status: 'pending',
      tier,
      currency: quote.chargeCurrency,
      billingCycle,
      reference: response.data.reference,
      customerEmail: email,
      renewalProvider: 'authorization',
      autoRenewEnabled: true,
    },
  }, { merge: true });

  return res.status(200).json({
    authorizationUrl: response.data.authorization_url,
    reference: response.data.reference,
    chargeAmountMajor: quote.chargeAmountMajor,
    chargeCurrency: quote.chargeCurrency,
    displayAmountMajor: quote.displayAmountMajor,
    displayCurrency: quote.displayCurrency,
  });
};
```

### 8.3 Payment Verification Endpoint

```typescript
// POST /api/payments/verify
export const verifyPayment = async (req: Request, res: Response) => {
  const userId = req.userId;
  const { reference } = req.body;

  if (!userId) return res.status(401).json({ message: 'Unauthorized.' });
  if (!reference) return res.status(400).json({ message: 'Reference is required.' });

  const response = await verifyTransaction(reference);
  const data = response.data;

  if (data.status !== 'success') {
    return res.status(400).json({ message: 'Payment not successful.' });
  }

  const metadata = data.metadata || {};
  const nextPaymentDate = addMonths(new Date(), metadata.billingCycle === 'quarterly' ? 3 : 1);

  // Idempotency: check if already processed
  const existing = await db.collection('users').doc(userId).get();
  const currentSub = existing.data()?.subscription;
  if (currentSub?.reference === reference && currentSub?.status === 'active') {
    return res.status(200).json({ message: 'Already verified.', data });
  }

  await db.collection('users').doc(userId).set({
    subscription: {
      status: 'active',
      tier: metadata.tier,
      currency: data.currency,
      billingCycle: metadata.billingCycle,
      pricingRegion: metadata.pricingRegion,
      reference: data.reference,
      authorizationCode: data.authorization?.authorization_code,
      customerCode: data.customer?.customer_code,
      customerEmail: data.customer?.email,
      renewalProvider: 'authorization',
      autoRenewEnabled: true,
      nextPaymentDate: nextPaymentDate.toISOString(),
    },
    subscriptionStatus: 'active',
    subscriptionTier: metadata.tier,
  }, { merge: true });

  return res.status(200).json({ message: 'Subscription verified.', data });
};
```

### 8.4 Webhook Handler

```typescript
// POST /api/payments/webhook (no auth middleware — HMAC protected)
export const handleWebhook = async (req: Request, res: Response) => {
  const signature = req.headers['x-paystack-signature'] as string;
  const rawBody = (req as any).rawBody as Buffer;

  // Step 1: Verify signature
  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ message: 'Invalid signature.' });
  }

  // Step 2: Acknowledge immediately (before any async work)
  res.status(200).json({ received: true });

  // Step 3: Process asynchronously (response already sent)
  try {
    const event = req.body;
    const data = event?.data || {};
    const metadata = data?.metadata || {};

    const userId = metadata.userId || await findUserByEmail(data.customer?.email);
    if (!userId) return; // unknown user — log and ignore

    const HANDLED_EVENTS = ['charge.success', 'invoice.payment_succeeded'];
    if (!HANDLED_EVENTS.includes(event.event)) return;

    // Idempotency check
    const userDoc = await db.collection('users').doc(userId).get();
    const currentSub = userDoc.data()?.subscription;
    if (currentSub?.reference === data.reference && currentSub?.status === 'active') return;

    const nextPaymentDate = addMonths(new Date(), metadata.billingCycle === 'quarterly' ? 3 : 1);

    await db.collection('users').doc(userId).set({
      subscription: {
        status: 'active',
        reference: data.reference,
        authorizationCode: data.authorization?.authorization_code,
        customerCode: data.customer?.customer_code,
        nextPaymentDate: nextPaymentDate.toISOString(),
      },
      subscriptionStatus: 'active',
    }, { merge: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    // Do NOT re-throw — response already sent
  }
};
```

### 8.5 Frontend Payment Integration

```typescript
// hooks/usePayment.ts
import { useState } from 'react';
import { PaymentAPI } from '../services/api';

export const usePayment = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initiateSubscription = async (tier: string, billingCycle: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await PaymentAPI.pay({ tier, billingCycle });
      // Redirect to Paystack-hosted checkout
      window.location.href = result.authorizationUrl;
    } catch (err: any) {
      setError(err?.message || 'Payment initialization failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return { initiateSubscription, isLoading, error };
};
```

```typescript
// pages/PaymentSuccess.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PaymentAPI } from '../services/api';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    const reference = searchParams.get('reference');
    if (!reference) {
      setStatus('error');
      return;
    }

    PaymentAPI.verify({ reference })
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'verifying') return <p>Confirming your payment...</p>;
  if (status === 'error') return <p>Could not confirm payment. Please contact support.</p>;
  return <p>Payment confirmed. Welcome to Premium!</p>;
}
```

### 8.6 Subscription Renewal (Cron / Scheduled Job)

```typescript
// api/cron/renew-subscriptions.ts (Vercel cron or external scheduler)
export const renewDueSubscriptions = async () => {
  const now = new Date();
  const dueUsers = await db.collection('users')
    .where('subscriptionStatus', '==', 'active')
    .where('subscription.autoRenewEnabled', '==', true)
    .where('subscription.renewalProvider', '==', 'authorization')
    .where('subscription.nextPaymentDate', '<=', now.toISOString())
    .get();

  for (const doc of dueUsers.docs) {
    const user = doc.data();
    const sub = user.subscription;

    try {
      const result = await chargeAuthorization({
        authorization_code: sub.authorizationCode,
        email: sub.customerEmail,
        amount: sub.chargeAmountSubunits,
        currency: sub.currency,
        metadata: {
          userId: doc.id,
          tier: sub.tier,
          billingCycle: sub.billingCycle,
          renewalProvider: 'authorization',
        },
      });

      if (result.data.status === 'success') {
        const nextDate = addMonths(new Date(), sub.billingCycle === 'quarterly' ? 3 : 1);
        await doc.ref.set({
          subscription: { nextPaymentDate: nextDate.toISOString(), lastChargeAttemptAt: now.toISOString() },
        }, { merge: true });
      }
    } catch (error) {
      console.error(`Renewal failed for ${doc.id}:`, error);
      // Mark as failed — do not deactivate immediately; allow retry window
      await doc.ref.set({
        subscription: { lastChargeAttemptAt: now.toISOString() },
      }, { merge: true });
    }
  }
};
```

---

## 9. Troubleshooting Playbook

### "Plan not found"
1. Check `PAYSTACK_SECRET_KEY` — is it `sk_test_` with plans that only exist in the test dashboard?
2. Remove the `plan` field from your `initializeTransaction` call entirely
3. Switch to authorization-based charging

### "Invalid key" or "Authorization not found"
1. Verify `PAYSTACK_SECRET_KEY` starts with `sk_` (not `pk_`)
2. Confirm the key environment matches — `sk_test_` for test dashboard, `sk_live_` for live
3. Check that the env var is set in Vercel (run `vercel env ls` in terminal)

### "Invalid webhook signature"
1. Confirm you're verifying against the **raw request body** (Buffer), not `JSON.stringify(req.body)`
2. Confirm `express.raw()` middleware runs before `express.json()` for the webhook route
3. Confirm `PAYSTACK_SECRET_KEY` in production matches the key in the Paystack dashboard

### Payment succeeds but subscription not activated
1. Check Vercel function logs for the webhook endpoint — was it called?
2. In Paystack dashboard → Developers → Webhook Logs — confirm delivery and your response status
3. If webhook returned non-200, Paystack may have stopped retrying — manually trigger from dashboard
4. Check `metadata.userId` is present in the webhook payload — if missing, user lookup by email fails

### User paid but sees "pending" status
1. The webhook may have failed silently — check Vercel logs for errors
2. The frontend may not have called `/api/payments/verify` — check network tab in DevTools
3. Try having the user visit `/payment-success?reference=THEIR_REFERENCE` manually to trigger verification

### Payment goes through in test mode but fails in production
1. Check for test plan codes being sent — remove them
2. Check for currency mismatch between initialization and Paystack account settings
3. Verify `PAYSTACK_SECRET_KEY` is `sk_live_` in production Vercel environment

### Webhook delivers successfully but Firestore not updated
1. Check Firebase Admin SDK credentials (`FIREBASE_CREDENTIALS_BASE64`) are set in production
2. Check Firestore security rules don't block backend writes (server SDK bypasses client rules if using Admin SDK)
3. Add explicit try/catch with `console.error` inside the webhook handler and check logs

### How to trace a full payment request
1. Find the `reference` from Paystack dashboard or user report
2. Search Vercel function logs for that reference string: `vercel logs --search REFERENCE`
3. Call `/transaction/verify/REFERENCE` directly from your backend shell to see Paystack's current status
4. Cross-reference with Firestore to see what was written

### How to check if a webhook was delivered
1. Paystack Dashboard → Developers → Webhook Logs
2. Find the event by reference or timestamp
3. Look at the Response Status column — it shows exactly what your server returned
4. Use "Retry" button to re-send a failed webhook

---

*This document reflects the production implementation of FaithBliss Africa as of May 2026. The architecture described — authorization-based charging, regional pricing, idempotent webhook handling — applies to any application using Paystack as a payment processor.*
