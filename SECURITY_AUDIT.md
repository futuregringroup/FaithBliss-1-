# FaithBliss — Security Audit

> **Version:** 1.0 | **Last Updated:** May 2026
>
> This audit is based on direct code inspection of the actual implementation. All issues reference real file locations.

---

## Summary

| Severity | Count |
|---|---|
| 🔴 Critical | 5 |
| 🟡 Medium | 7 |
| 🟢 Low | 6 |
| ✅ Positive (working correctly) | 6 |

---

## 🔴 Critical Issues

### CRIT-1: No Rate Limiting on Any Endpoint

**File:** `backend/src/server.ts`

No rate limiting middleware is applied anywhere in the Express app. This means:
- An attacker can send unlimited requests to `/api/auth/register-profile` (account enumeration)
- An attacker can spam `POST /api/matches/like/:userId` beyond the 10/day app-level limit by manipulating request timing
- Payment initialization (`POST /api/payments/pay`) can be called repeatedly with no throttle
- Support ticket submission has no limit — spam vector

**Impact:** DoS, scraping, financial abuse, spam

**Fix:**
```typescript
// Add to server.ts
import rateLimit from 'express-rate-limit';

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/payments/pay', rateLimit({ windowMs: 60000, max: 5 }));
```

Install: `npm install express-rate-limit`

---

### CRIT-2: All User Profiles Readable by Any Authenticated User

**File:** `firestore.rules`, `users` collection rule

```javascript
match /users/{userId} {
  allow read: if isSignedIn();   // ← ANY authenticated user can read ANY profile
  allow create: if isOwner(userId);
  allow update: if isOwner(userId);
  allow delete: if isOwner(userId);
}
```

This means any logged-in user can directly query Firestore and read the full profile of any other user, including:
- Phone numbers (`phoneNumber`, `countryCode`)
- GPS coordinates (`latitude`, `longitude`)
- Birthday
- Email address
- Private notes/settings

The backend does this intentionally for profile discovery (the `syncUserFromFirebase` flow reads the user's own profile client-side). However, all other user profiles should only be readable via the backend API (which can filter sensitive fields).

**Impact:** PII leakage — phone numbers, GPS coordinates, email, birthday exposed to any authenticated user via direct Firestore queries

**Fix:**
```javascript
// Option 1: Restrict to own profile + matched users only
match /users/{userId} {
  allow read: if isOwner(userId);   // own profile
  // Remove broad read access; all other profile reads go through backend
}

// Option 2: Expose only non-sensitive fields (requires field-level security or a separate public_profiles collection)
```

Note: If you restrict client reads, you must ensure `syncUserFromFirebase` in `useAuth.tsx` still works. It only reads the user's own profile, so `isOwner(userId)` is sufficient.

---

### CRIT-3: Primary Admin Email Hardcoded and Exposed on Client

**Files:**
- `frontend/.env.example` — `VITE_PRIMARY_ADMIN_EMAIL=aginaemmanuel6@gmail.com`
- `backend/.env.example` — `PRIMARY_ADMIN_EMAIL=aginaemmanuel6@gmail.com`
- `frontend/src/components/AuthGate.tsx` — reads `import.meta.env.VITE_PRIMARY_ADMIN_EMAIL`

**Problems:**
1. The admin email is exposed to all frontend users via `import.meta.env` (Vite inlines env vars into the bundle at build time)
2. Anyone who knows the admin email can try to social-engineer Google OAuth or compromise that Google account
3. The `.env.example` files in the repo reveal the current admin email

**Impact:** Social engineering vector; attacker who knows admin email knows target for account takeover

**Fix:**
- Remove `VITE_PRIMARY_ADMIN_EMAIL` from frontend entirely — role checks should only happen server-side
- Frontend should call `GET /api/users/me` and trust the `role` field in the response
- Backend admin check remains in `PRIMARY_ADMIN_EMAIL` env var (server-side only)
- Remove the actual email from `.env.example` — use a placeholder like `admin@yourcompany.com`

---

### CRIT-4: No Cloud Storage Security Rules

**File:** No `storage.rules` file exists in the project

Firebase Cloud Storage defaults to **deny-all** if no rules are deployed — unless a legacy "open" ruleset was previously deployed. If any legacy rules exist on the project, they may be permissive.

**Risk:**
- If legacy rules allow unauthenticated uploads, anyone can upload arbitrary files to Firebase Storage
- Even if locked down, without explicit rules this is a gap

**Fix:**
```javascript
// Create storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 10 * 1024 * 1024  // 10MB
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

Deploy: `firebase deploy --only storage`

---

### CRIT-5: MongoDB Connected with Unclear Security Posture

**File:** `backend/src/server.ts`

MongoDB Atlas is connected on every server boot via `MONGO_URI`. However:
- No identified feature in the codebase writes critical data exclusively to MongoDB
- It's unclear what schemas/models exist and what data they hold
- If the MongoDB connection string is compromised, an attacker could access this database directly

**Impact:** Unknown data exposure if MongoDB holds sensitive records

**Fix:**
1. Audit `backend/src/models/` — identify what data lives in MongoDB vs Firestore
2. If MongoDB is unused, remove the connection: comment out `mongoose.connect()` in `server.ts`
3. If used, ensure MongoDB Atlas IP whitelist restricts access to Vercel egress IPs only

---

## 🟡 Medium Issues

### MED-1: Firebase ID Token Not Proactively Refreshed

**File:** `frontend/src/hooks/useAuth.tsx`

Firebase ID tokens expire after 1 hour. The frontend stores the token in `localStorage` and reads it on each request. If a user's session is exactly 59 minutes old, they can make requests, but the token will expire mid-session.

Firebase automatically refreshes tokens in the background, but the stored token in `localStorage.accessToken` is only updated when `syncUserFromFirebase` is explicitly called.

**Impact:** Intermittent 401 errors for long-session users; degraded UX

**Fix:**
```typescript
// In api-client.ts, before each request:
const user = auth.currentUser;
if (user) {
  const freshToken = await user.getIdToken(); // auto-refreshes if expired
  // use freshToken instead of localStorage.getItem('accessToken')
}
```

---

### MED-2: File Upload MIME Type Validation Only (No Magic Bytes Check)

**File:** `backend/src/middleware/uploadMiddleware.ts`, `backend/src/config/cloudinaryConfig.ts`

Photo uploads validate the file type using Multer's `fileFilter` which checks the MIME type from the `Content-Type` header and `mimetype` property. A malicious actor can set `Content-Type: image/jpeg` on a non-image file to bypass this check.

**Impact:** Malicious files (scripts, executables) could be uploaded and stored on Cloudinary

**Fix:**
```typescript
import { fileTypeFromBuffer } from 'file-type';

// After receiving file buffer, validate magic bytes:
const type = await fileTypeFromBuffer(file.buffer);
if (!type || !['image/jpeg', 'image/png', 'image/webp'].includes(type.mime)) {
  return callback(new Error('Invalid file type'));
}
```

---

### MED-3: No Content Security Policy (CSP) Headers

**File:** `frontend/vercel.json`

The Vercel config only sets cache headers for `sw.js` and `site.webmanifest`. No CSP headers are configured, meaning:
- No protection against XSS-injected scripts
- No restriction on which domains can load resources

**Impact:** If an XSS vulnerability exists elsewhere, no CSP to limit blast radius

**Fix — add to `frontend/vercel.json`:**
```json
{
  "source": "/(.*)",
  "headers": [
    {
      "key": "Content-Security-Policy",
      "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://res.cloudinary.com; img-src 'self' data: https://res.cloudinary.com; frame-src 'none'"
    },
    {
      "key": "X-Frame-Options",
      "value": "DENY"
    },
    {
      "key": "X-Content-Type-Options",
      "value": "nosniff"
    }
  ]
}
```

---

### MED-4: Story seenBy/likedBy Arrays Writable by Any Authenticated User

**File:** `firestore.rules`

```javascript
match /stories/{storyId} {
  allow update: if isSignedIn() &&
                   (request.auth.uid == resource.data.authorId ||
                    request.resource.data.diff(resource.data)
                      .affectedKeys().hasOnly(['seenBy', 'likedBy']));
}
```

Any signed-in user can update `seenBy` and `likedBy` on any story — even stories from users they're not matched with. An attacker could:
- Inflate like counts on any story
- Mark any story as seen without actually viewing it
- Spam like/unlike cycles

**Impact:** Data integrity — fake likes/views; minor

**Fix:** Add a check that the user is a mutual match with the story author before allowing seenBy/likedBy updates.

---

### MED-5: CORS Credentials + No Explicit CSRF Protection

**File:** `backend/src/server.ts`, `frontend/src/services/api-client.ts`

The frontend sends `credentials: 'include'` on every request, and the backend sets CORS to allow this. Combined with the lack of CSRF tokens, a CSRF attack is theoretically possible if cookies are used for auth (they are set via the backend in some flows).

**Impact:** CSRF attacks if attacker can craft a cross-origin request that includes the auth cookie

**Fix:**
- Add `SameSite=Strict` or `SameSite=Lax` to any cookies set by the backend
- Or add a CSRF token to all state-changing requests
- The Firebase ID token in the `Authorization` header (not cookies) provides natural CSRF protection for those routes — verify all sensitive routes use header auth, not cookie auth

---

### MED-6: Subscription Renewal Double-Charge Risk

**File:** `backend/src/services/subscriptionRenewalService.ts`

The renewal service runs every 15 minutes with a 30-minute per-user cooldown to prevent double-charging. However:
- If the server restarts between two 15-minute ticks, the cooldown state (in-memory) is lost
- Two server instances running simultaneously could both attempt renewal for the same user

**Impact:** Edge case double-charge in subscription renewals

**Fix:**
- Store the "last renewal attempt" timestamp in Firestore (persistent) rather than in-memory
- Or use Paystack's built-in subscription management which handles idempotency

---

### MED-7: `bcryptjs` in Frontend Dependencies

**File:** `frontend/package.json`

`bcryptjs` is listed as a frontend dependency. This library is for password hashing and has no legitimate use in a browser-side JavaScript application. There is no password-based auth in the current codebase (Google OAuth only).

**Impact:** Dead dependency that adds bundle size; if a developer mistakenly implements password auth on the frontend, it creates a false sense of security (bcrypt on client is useless for security)

**Fix:** `pnpm remove bcryptjs` from `frontend/package.json`

---

## 🟢 Low Issues

### LOW-1: Verbose Error Messages in Development Mode

**File:** `backend/src/server.ts` (global error handler)

In development mode, full error stack traces are returned in API responses. If `NODE_ENV` is not correctly set to `production` in the Vercel environment, stack traces may be exposed.

**Fix:** Verify Vercel environment variable `NODE_ENV=production` is set for the production deployment. Already handled in the error handler code, but confirm it's configured.

---

### LOW-2: `console.log` in Production Code

**Files:** `backend/src/services/`, `backend/src/controllers/`

Multiple `console.log` statements exist in service and controller files. In production, these:
- Clutter Vercel logs
- May inadvertently log user data or request payloads
- Provide information to anyone with log access

**Fix:** Replace with a structured logger (`pino` or `winston`) with log levels. In production, only log `warn` and `error`.

---

### LOW-3: `@sendgrid/mail` in Frontend Dependencies

**File:** `frontend/package.json`

The SendGrid mail SDK is listed as a frontend dependency. Email should never be sent from the browser:
- It would expose SendGrid API keys to clients
- Browser CSP would likely block the API calls anyway
- It's dead code that increases bundle size

**Fix:** `pnpm remove @sendgrid/mail` from `frontend/package.json`. If email is needed, it goes through the backend only.

---

### LOW-4: Admin Email in `.env.example` Files

**Files:** `frontend/.env.example`, `backend/.env.example`

The actual admin email (`aginaemmanuel6@gmail.com`) is hardcoded in the example files committed to the repository. This reveals the admin's identity.

**Fix:** Replace with a placeholder:
```
PRIMARY_ADMIN_EMAIL=admin@yourcompany.com
```

---

### LOW-5: Google OAuth Passport.js Configured but Unused

**File:** `backend/src/config/passport.ts`

Legacy Google OAuth via Passport.js is configured (client ID, secret, callback URL) but no routes use it. The config file reads Google OAuth credentials from environment variables, meaning those variables must be set even though they do nothing.

**Impact:** Dead configuration; unused OAuth credentials in env — potential confusion about auth method

**Fix:** Remove `passport.ts`, `passport-google-oauth20`, and related env vars from `backend/.env.example`

---

### LOW-6: Firebase Auth Domain Not Using Custom Domain Proxy

**File:** `frontend/src/firebase/config.ts`

The Firebase auth domain is hardcoded to the Firebase default:
```typescript
authDomain: 'faithbliss-79c63.firebaseapp.com'
```

Using the Firebase default domain means Google OAuth popups come from `firebaseapp.com`, not `faithblissafrica.com`. Using a custom auth domain proxy would avoid iOS in-app browser restrictions (the current code has a fallback to `signInWithRedirect` for this reason, but a custom domain would be cleaner).

**Fix:** Configure a custom auth domain in Firebase (Auth → Settings → Authorized domains) and update `VITE_FIREBASE_AUTH_DOMAIN` to use the custom domain.

---

## ✅ Positive Security Observations

These are working correctly and should be maintained:

| Item | Implementation |
|---|---|
| **Firestore deny-all fallback** | `match /{document=**} { allow read, write: if false; }` — any unmatched collection is denied |
| **Paystack HMAC signature verification** | Webhook handler validates `X-Paystack-Signature` before processing payments |
| **Firebase Admin token validation** | Every protected route calls `admin.auth().verifyIdToken()` — no custom JWT |
| **Role-based access control** | Admin/developer routes check role both in frontend guards and backend controllers |
| **Match creation backend-only** | Firestore rules: `allow create: if false` for matches — only the backend Admin SDK can create matches |
| **Notification write protection** | Clients can only update `isRead` field on notifications — all other writes are backend-only |

---

## Recommended Fix Priority

| Priority | Fix |
|---|---|
| P0 — Immediate | CRIT-1: Add rate limiting |
| P0 — Immediate | CRIT-2: Restrict Firestore user reads (remove GPS/phone from client-accessible fields) |
| P0 — Immediate | CRIT-4: Deploy `storage.rules` |
| P1 — This Sprint | CRIT-3: Remove admin email from frontend env |
| P1 — This Sprint | CRIT-5: Audit and remove or isolate MongoDB |
| P1 — This Sprint | MED-3: Add CSP headers |
| P2 — Next Sprint | MED-1: Proactive token refresh |
| P2 — Next Sprint | MED-2: Magic bytes file validation |
| P2 — Next Sprint | MED-6: Persistent renewal cooldown |
| P3 — Backlog | MED-4: Story seenBy/likedBy restriction |
| P3 — Backlog | MED-5: CSRF token or SameSite cookie |
| P3 — Backlog | All LOW items |
