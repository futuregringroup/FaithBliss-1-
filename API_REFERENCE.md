# FaithBliss — API Reference

> **Version:** 1.0 | **Last Updated:** May 2026
>
> Base URL (production): `https://your-backend.vercel.app`
> Base URL (local): `http://localhost:5000`
>
> All authenticated endpoints require: `Authorization: Bearer <Firebase ID Token>`

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Users](#2-users)
3. [Matches](#3-matches)
4. [Messages](#4-messages)
5. [Discover](#5-discover)
6. [Notifications](#6-notifications)
7. [Payments](#7-payments)
8. [Photos & Uploads](#8-photos--uploads)
9. [Stories](#9-stories)
10. [Support](#10-support)
11. [System](#11-system)
12. [Error Reference](#12-error-reference)

---

## Conventions

### Authentication

All protected endpoints verify the Firebase ID token:
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6...
```

Token is obtained via `firebase.auth().currentUser.getIdToken()`.

### Response Envelope

Responses follow these patterns (not fully standardized — see Tech Debt Report):
```json
// Success
{ "message": "Success", "data": { ... } }
{ "user": { ... } }
{ "matches": [ ... ] }

// Error
{ "message": "Error description" }
{ "error": "Error description" }
```

### Role Levels

| Level | Description |
|---|---|
| Public | No auth required |
| Authenticated | Any valid Firebase ID token |
| Admin | `role === 'admin'` OR `roles.includes('admin')` OR email === PRIMARY_ADMIN_EMAIL |
| Developer | `role === 'developer'` OR `roles.includes('developer')` |

---

## 1. Authentication

### POST `/api/auth/register-profile`

Creates a Firestore user profile after Firebase Auth registration. Called automatically on first Google sign-in.

**Auth:** Authenticated

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "gender": "MALE",
  "age": 28,
  "denomination": "Baptist",
  "bio": "Passionate about faith",
  "location": "Lagos, Nigeria"
}
```

**Success Response (201):**
```json
{
  "id": "firebase-uid",
  "name": "John Doe",
  "email": "john@example.com",
  "onboardingCompleted": false
}
```

**Error Responses:**
| Status | Condition |
|---|---|
| 400 | User profile already exists |
| 401 | Missing or invalid Firebase token; missing UID |
| 500 | Firestore write failed |

---

### PUT `/api/auth/complete-onboarding`

Saves all onboarding data and marks the user's profile as complete. Called at the end of the 13-step onboarding flow.

**Auth:** Authenticated

**Request Body:**
```json
{
  "birthday": "1996-03-15",
  "location": "Lagos, Nigeria",
  "latitude": 6.5244,
  "longitude": 3.3792,
  "denomination": "Baptist",
  "gender": "MALE",
  "age": 28,
  "bio": "Faith-driven, love music and travel",
  "profession": "Software Engineer",
  "fieldOfStudy": "Computer Science",
  "educationLevel": "Bachelor's",
  "faithJourney": "Growing",
  "sundayActivity": "Church service",
  "churchAttendance": "Weekly",
  "favoriteVerse": "Philippians 4:13",
  "spiritualGifts": ["Teaching", "Evangelism"],
  "relationshipGoals": ["MARRIAGE", "RELATIONSHIP"],
  "lookingFor": ["MARRIAGE"],
  "profileFits": ["Professional", "Intellectual", "Adventurer"],
  "hobbies": ["Reading", "Hiking"],
  "interests": ["Music", "Technology"],
  "values": ["Faith", "Family", "Integrity"],
  "lifestyle": "Active",
  "drinkingHabit": "Never",
  "smokingHabit": "Never",
  "workoutHabit": "Sometimes",
  "petPreference": "Dogs",
  "personality": ["INTJ", "Ambivert"],
  "communicationStyle": "Direct",
  "loveStyle": "Acts of Service",
  "personalPromptQuestion": "My biggest adventure was...",
  "personalPromptAnswer": "Hiking Kilimanjaro",
  "height": 180,
  "language": "English",
  "languageSpoken": ["English", "Yoruba"],
  "zodiacSign": "Pisces",
  "countryCode": "+234",
  "passportCountry": null,
  "profilePhoto1": "https://res.cloudinary.com/...",
  "profilePhoto2": "https://res.cloudinary.com/...",
  "profilePhoto3": "https://res.cloudinary.com/...",
  "preferredGender": "FEMALE",
  "minAge": 24,
  "maxAge": 34,
  "maxDistance": 50,
  "preferredDenomination": "Baptist",
  "preferredFaithJourney": "Growing"
}
```

**Validation Rules:**
- `profilePhoto1`, `profilePhoto2`, `profilePhoto3` must all be present (minimum 3 photos)
- `profileFits` must have at least 3 items
- `relationshipGoals` must have at least 1 item
- All required text fields must be non-empty strings

**Success Response (200):**
```json
{
  "message": "Onboarding completed successfully",
  "user": { /* full user profile */ }
}
```

**Error Responses:**
| Status | Condition |
|---|---|
| 400 | Missing required fields; fewer than 3 photos; validation failed |
| 401 | Invalid token |
| 500 | Firestore write failed |

---

## 2. Users

### GET `/api/users/me`

Returns the authenticated user's full profile.

**Auth:** Authenticated

**Success Response (200):**
```json
{
  "id": "firebase-uid",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "user",
  "gender": "MALE",
  "age": 28,
  "denomination": "Baptist",
  "bio": "...",
  "location": "Lagos, Nigeria",
  "profilePhoto1": "https://res.cloudinary.com/...",
  "profilePhotoCount": 3,
  "onboardingCompleted": true,
  "subscriptionStatus": "active",
  "subscriptionTier": "premium",
  "subscription": { /* full subscription object */ },
  "profileBoosterCredits": 2,
  "isActive": true,
  "createdAt": "2026-01-15T10:00:00.000Z"
}
```

---

### PUT `/api/users/me`

Updates the authenticated user's profile.

**Auth:** Authenticated

**Request Body:** Any subset of profile fields (partial update):
```json
{
  "bio": "Updated bio text",
  "location": "Abuja, Nigeria",
  "profession": "Product Manager",
  "profilePhoto1": "https://res.cloudinary.com/...",
  "profilePhoto4": "https://res.cloudinary.com/..."
}
```

**Success Response (200):**
```json
{
  "message": "Profile updated",
  "user": { /* updated user profile */ }
}
```

---

### PATCH `/api/users/me/settings`

Updates notification and privacy settings.

**Auth:** Authenticated

**Request Body:**
```json
{
  "settings": {
    "notifications": {
      "newMatch": true,
      "newMessage": true,
      "profileLiked": false
    },
    "privacy": {
      "showOnlineStatus": true,
      "showLastSeen": false
    }
  }
}
```

**Success Response (200):**
```json
{ "message": "Settings updated" }
```

---

### PATCH `/api/users/me/passport`

Updates the user's passport country (premium feature for location-based discovery).

**Auth:** Authenticated (Premium)

**Request Body:**
```json
{
  "passportCountry": "GH"
}
```

**Success Response (200):**
```json
{ "message": "Passport country updated" }
```

---

### POST `/api/users/me/profile-booster/activate`

Activates a profile booster, using 1 credit to boost visibility for 1 hour.

**Auth:** Authenticated

**Request Body:** None

**Success Response (200):**
```json
{
  "message": "Profile booster activated",
  "activeUntil": "2026-05-26T15:00:00.000Z",
  "creditsRemaining": 1
}
```

**Error Responses:**
| Status | Condition |
|---|---|
| 400 | No booster credits remaining |
| 400 | Booster already active |

---

### POST `/api/users/me/deactivate`

Soft-deletes the account (sets `isActive: false`). User can reactivate later.

**Auth:** Authenticated

**Success Response (200):**
```json
{ "message": "Account deactivated" }
```

---

### POST `/api/users/me/reactivate`

Restores a deactivated account.

**Auth:** Authenticated

**Success Response (200):**
```json
{ "message": "Account reactivated" }
```

---

### DELETE `/api/users/me`

Permanently deletes the user's account and all associated data.

**Auth:** Authenticated

**Success Response (200):**
```json
{ "message": "Account deleted" }
```

---

### POST `/api/users/me/post-payment-survey`

Submits marketer attribution survey after payment.

**Auth:** Authenticated

**Request Body:**
```json
{
  "marketerId": "marketer-user-id",
  "marketerName": "John Marketer"
}
```

**Success Response (200):**
```json
{ "message": "Survey submitted" }
```

---

### GET `/api/users/public-feature-settings`

Returns public feature flags (no auth required). Used to check maintenance/shutdown mode before login.

**Auth:** None

**Success Response (200):**
```json
{
  "passportModeEnabled": true,
  "maintenanceModeEnabled": false,
  "shutdownModeEnabled": false
}
```

---

### GET `/api/users/feature-settings`

Returns full feature settings for the authenticated user.

**Auth:** Authenticated

**Success Response (200):**
```json
{
  "passportModeEnabled": true,
  "maintenanceModeEnabled": false,
  "shutdownModeEnabled": false,
  "backendOnlyShutdownEnabled": false
}
```

---

### PATCH `/api/users/feature-settings`

Updates a user's personal feature preferences.

**Auth:** Authenticated

**Request Body:**
```json
{
  "someFeatureFlag": true
}
```

---

### GET `/api/users/admin/platform-stats`

Returns global platform statistics.

**Auth:** Admin

**Success Response (200):**
```json
{
  "totalUsers": 1250,
  "activeUsers": 980,
  "totalSubscriptions": 340,
  "premiumSubscriptions": 280,
  "eliteSubscriptions": 60,
  "totalRevenue": 15000000
}
```

---

### GET `/api/users/developer/overview`

Returns developer dashboard statistics.

**Auth:** Developer

**Success Response (200):**
```json
{
  "totalUsers": 1250,
  "onboardedUsers": 1100,
  "activeToday": 89
}
```

---

### PATCH `/api/users/developer/feature-settings`

Updates global feature flags (stored in Firestore `appConfig/features`).

**Auth:** Developer

**Request Body:**
```json
{
  "maintenanceModeEnabled": true,
  "passportModeEnabled": false
}
```

**Success Response (200):**
```json
{ "message": "Feature settings updated" }
```

---

### PATCH `/api/users/:id/role`

Changes a user's role. Admin only.

**Auth:** Admin

**Request Body:**
```json
{
  "role": "developer"
}
```

**Valid roles:** `user`, `admin`, `developer`, `marketer`

---

### PATCH `/api/users/:id`

Admin bulk edit of any user profile.

**Auth:** Admin

**Request Body:** Any user fields to update.

---

### DELETE `/api/users/:id`

Admin hard-delete of a user account.

**Auth:** Admin

---

### GET `/api/users/marketers`

Lists all users with the marketer role.

**Auth:** Admin

---

### GET `/api/users/marketers/:id/customers`

Returns customers who were referred by a specific marketer.

**Auth:** Admin

---

### GET `/api/users/:id`

Gets a single user's public profile by Firebase UID.

**Auth:** Authenticated

**Success Response (200):**
```json
{
  "id": "firebase-uid",
  "name": "Jane Doe",
  "age": 26,
  "gender": "FEMALE",
  "denomination": "Anglican",
  "bio": "...",
  "location": "Accra, Ghana",
  "profilePhoto1": "https://res.cloudinary.com/...",
  "faithJourney": "Committed",
  "interests": ["Music", "Prayer"]
}
```

---

### GET `/api/users`

Lists all users (paginated). Admin only.

**Auth:** Admin

**Query Params:**
- `page` — page number (default: 1)
- `limit` — results per page (default: 20)
- `search` — filter by name/email

---

## 3. Matches

### GET `/api/matches/potential`

Returns profiles available for swiping (not yet liked, passed, matched, or blocked).

**Auth:** Authenticated

**Success Response (200):**
```json
{
  "profiles": [
    {
      "id": "firebase-uid",
      "name": "Jane Doe",
      "age": 26,
      "gender": "FEMALE",
      "denomination": "Anglican",
      "bio": "...",
      "location": "Accra, Ghana",
      "latitude": 5.6037,
      "longitude": -0.1870,
      "profilePhoto1": "https://res.cloudinary.com/...",
      "profileBoosterActiveUntil": null,
      "distance": 12.4
    }
  ]
}
```

---

### POST `/api/matches/like/:userId`

Likes a user's profile. Creates a mutual match if the target also likes back.

**Auth:** Authenticated

**Path Param:** `userId` — Firebase UID of the profile to like

**Success Response (200) — Like recorded, no match yet:**
```json
{
  "message": "Like recorded",
  "matched": false
}
```

**Success Response (200) — Mutual match created:**
```json
{
  "message": "It's a match!",
  "matched": true,
  "matchId": "match-document-id"
}
```

**Error Responses:**
| Status | Condition |
|---|---|
| 400 | Daily swipe limit reached (free users: 10/day) |
| 404 | Target user not found |

---

### POST `/api/matches/pass/:userId`

Passes on a profile. The passed user won't appear in the swipe deck for 24 hours.

**Auth:** Authenticated

**Path Param:** `userId` — Firebase UID to pass

**Success Response (200):**
```json
{ "message": "Profile passed" }
```

---

### POST `/api/matches/unmatch/:userId`

Removes an existing match.

**Auth:** Authenticated

**Path Param:** `userId` — Firebase UID of matched user

**Success Response (200):**
```json
{ "message": "Unmatched successfully" }
```

---

### POST `/api/matches/unmatch-block/:userId`

Removes the match AND blocks the user from future contact.

**Auth:** Authenticated

**Success Response (200):**
```json
{ "message": "User unmatched and blocked" }
```

---

### GET `/api/matches/mutual`

Returns all confirmed mutual matches (both users liked each other).

**Auth:** Authenticated

**Success Response (200):**
```json
{
  "matches": [
    {
      "id": "match-doc-id",
      "matchedUser": { /* User profile */ },
      "matchedUserId": "firebase-uid",
      "createdAt": "2026-05-20T10:00:00.000Z"
    }
  ]
}
```

---

### GET `/api/matches/sent`

Returns profiles you've liked but that haven't liked back yet.

**Auth:** Authenticated

**Success Response (200):**
```json
{
  "sent": [ /* User profiles */ ]
}
```

---

### GET `/api/matches/passed`

Returns profiles you've passed on.

**Auth:** Authenticated

---

### GET `/api/matches/received`

Returns users who have liked your profile but you haven't responded.

**Auth:** Authenticated

---

## 4. Messages

### GET `/api/messages/conversations`

Returns all match conversations with last message and unread count.

**Auth:** Authenticated

**Success Response (200):**
```json
{
  "conversations": [
    {
      "id": "match-doc-id",
      "otherUser": {
        "id": "firebase-uid",
        "name": "Jane Doe",
        "profilePhoto1": "https://res.cloudinary.com/..."
      },
      "lastMessage": {
        "id": "msg-id",
        "content": "Hey, how are you?",
        "type": "TEXT",
        "senderId": "firebase-uid",
        "createdAt": "2026-05-25T14:30:00.000Z"
      },
      "unreadCount": 2,
      "updatedAt": "2026-05-25T14:30:00.000Z",
      "chatLocked": false,
      "chatAccessMessage": null
    }
  ]
}
```

**Note:** For free users, `chatLocked: true` on conversations that aren't the active one, with `chatAccessMessage` explaining the limitation.

---

### GET `/api/messages/unread-count`

Returns total unread message count across all conversations.

**Auth:** Authenticated

**Success Response (200):**
```json
{ "unreadCount": 5 }
```

---

### GET `/api/messages/match/:matchId`

Returns paginated messages in a specific match conversation.

**Auth:** Authenticated

**Path Param:** `matchId` — Match document ID

**Query Params:**
- `limit` — messages per page (default: 50)
- `before` — cursor (message ID) for pagination

**Success Response (200):**
```json
{
  "messages": [
    {
      "id": "msg-id",
      "matchId": "match-doc-id",
      "senderId": "firebase-uid",
      "receiverId": "firebase-uid-2",
      "content": "Hello!",
      "type": "TEXT",
      "attachment": null,
      "replyTo": null,
      "reactions": [],
      "isRead": true,
      "createdAt": "2026-05-25T14:30:00.000Z"
    }
  ]
}
```

---

### GET `/api/messages/media/library`

Proxies Giphy/Tenor API requests to avoid browser CORS restrictions.

**Auth:** Authenticated

**Query Params:**
- `provider` — `giphy` or `tenor`
- `q` — search query
- `limit` — number of results

**Success Response (200):** Giphy/Tenor API response passthrough

---

### POST `/api/messages/attachments`

Uploads a file to Cloudinary for use as a message attachment.

**Auth:** Authenticated

**Request:** `multipart/form-data`
- `photo` — file field (JPEG, PNG, WebP, video, audio; max 5MB)

**Success Response (200):**
```json
{
  "url": "https://res.cloudinary.com/faithbliss/...",
  "publicId": "faithbliss_messages/abc123",
  "fileName": "photo.jpg",
  "mimeType": "image/jpeg",
  "fileSize": 204800,
  "resourceType": "image"
}
```

---

### PATCH `/api/messages/:messageId/read`

Marks a specific message as read by the current user.

**Auth:** Authenticated

**Success Response (200):**
```json
{ "message": "Message marked as read" }
```

---

## 5. Discover

### POST `/api/discover/filter`

Advanced profile discovery with filters. Returns profiles matching the criteria.

**Auth:** Authenticated

**Request Body:**
```json
{
  "gender": "FEMALE",
  "minAge": 24,
  "maxAge": 34,
  "maxDistance": 50,
  "denomination": "Baptist",
  "faithJourney": "Committed",
  "churchAttendance": "Weekly",
  "relationshipGoals": ["MARRIAGE"]
}
```

**Filter Availability:**
- Free users: `gender` only
- Premium users: all filters

**Success Response (200):**
```json
{
  "profiles": [
    /* Array of User profiles, sorted by: boosted first, then distance, then age */
  ]
}
```

**Note:** Excludes profiles already liked, passed, matched, or blocked.

---

### GET `/api/discover/profile-fit-counts`

Returns the count of users in each profile fit category.

**Auth:** Authenticated

**Success Response (200):**
```json
{
  "counts": {
    "Professional": 45,
    "Adventurer": 32,
    "Intellectual": 28,
    "Creative": 19
  }
}
```

---

### GET `/api/discover/profile-fits`

Returns profiles matching a specific profile fit category. Premium only.

**Auth:** Authenticated (Premium)

**Query Params:**
- `fit` — profile fit category (e.g., `Professionals`, `Adventurers`)

**Error Responses:**
| Status | Condition |
|---|---|
| 403 | User does not have premium subscription |

**Success Response (200):**
```json
{
  "profiles": [ /* User profiles with matching profileFits */ ]
}
```

---

### GET `/api/discover/interests`

Returns profiles with matching interests/hobbies.

**Auth:** Authenticated

**Query Params:**
- `interests` — comma-separated interest names (e.g., `Music,Prayer,Reading`)

**Success Response (200):**
```json
{
  "profiles": [ /* Profiles sorted by interest match count */ ]
}
```

---

## 6. Notifications

### GET `/api/notifications`

Returns the 50 most recent notifications for the authenticated user.

**Auth:** Authenticated

**Success Response (200):**
```json
{
  "notifications": [
    {
      "id": "notif-id",
      "type": "NEW_MATCH",
      "message": "You have a new match with Jane Doe!",
      "data": {
        "matchId": "match-doc-id",
        "senderId": "firebase-uid"
      },
      "isRead": false,
      "createdAt": "2026-05-25T14:00:00.000Z"
    }
  ]
}
```

**Notification Types:**
| Type | Meaning |
|---|---|
| `PROFILE_LIKED` | Someone liked your profile |
| `NEW_MATCH` | You have a mutual match |
| `NEW_MESSAGE` | New message in a conversation |
| `STORY_POSTED` | A match posted a story |
| `SUPPORT_REPLY` | Admin replied to your support ticket |
| `REPORT_SUBMITTED` | [Admin] A report was submitted |

---

### GET `/api/notifications/unread-count`

Returns the count of unread notifications.

**Auth:** Authenticated

**Success Response (200):**
```json
{ "count": 3 }
```

---

### PATCH `/api/notifications/:id/read`

Marks a single notification as read.

**Auth:** Authenticated

**Success Response (200):**
```json
{ "message": "Notification marked as read" }
```

---

### PATCH `/api/notifications/read-all`

Marks all unread notifications as read.

**Auth:** Authenticated

**Success Response (200):**
```json
{ "message": "All notifications marked as read" }
```

---

## 7. Payments

### GET `/api/payments/quote`

Returns localized pricing for subscriptions based on user's region (detected via IP).

**Auth:** Authenticated

**Query Params:**
- `region` — optional override: `nigeria`, `africa`, `global`
- `billingCycle` — `monthly` or `quarterly` (default: monthly)

**Success Response (200):**
```json
{
  "region": "nigeria",
  "currency": "NGN",
  "displayCurrency": "₦",
  "premium": {
    "monthly": {
      "displayAmount": 5000,
      "chargeAmountSubunits": 500000
    },
    "quarterly": {
      "displayAmount": 10000,
      "chargeAmountSubunits": 1000000
    }
  }
}
```

---

### GET `/api/payments/profile-booster/quote`

Returns localized pricing for profile booster.

**Auth:** Authenticated

**Query Params:**
- `bundleKey` — `bundle` (5 credits) or `single` (1 credit)

**Success Response (200):**
```json
{
  "currency": "NGN",
  "displayCurrency": "₦",
  "displayAmount": 2000,
  "chargeAmountSubunits": 200000,
  "credits": 5
}
```

---

### GET `/api/payments/plans`

Returns available subscription plans with pricing.

**Auth:** Authenticated

**Success Response (200):**
```json
{
  "plans": [
    {
      "id": "premium",
      "name": "Premium",
      "billingCycle": "monthly",
      "features": ["Advanced filters", "Unlimited chats", "See who liked you"]
    }
  ]
}
```

---

### POST `/api/payments/pay`

Initializes a Paystack payment for a subscription. Returns a redirect URL.

**Auth:** Authenticated

**Request Body:**
```json
{
  "tier": "premium",
  "billingCycle": "monthly"
}
```

**Success Response (200):**
```json
{
  "authorization_url": "https://checkout.paystack.com/...",
  "reference": "fb_12345678"
}
```

**Error Responses:**
| Status | Condition |
|---|---|
| 400 | Invalid tier or billing cycle |
| 500 | Paystack API error |

---

### POST `/api/payments/initialize`

Legacy/direct subscription initialization (alternative to `/pay`).

**Auth:** Authenticated

**Request Body:** Same as `/pay`

---

### POST `/api/payments/verify`

Verifies a Paystack payment after the user returns from the payment page.

**Auth:** Authenticated

**Request Body:**
```json
{
  "reference": "fb_12345678"
}
```

**Success Response (200):**
```json
{
  "message": "Payment verified",
  "subscription": { /* updated subscription data */ }
}
```

---

### PATCH `/api/payments/subscription/auto-renew`

Toggles auto-renewal on or off.

**Auth:** Authenticated

**Request Body:**
```json
{
  "autoRenewEnabled": false
}
```

**Success Response (200):**
```json
{ "message": "Auto-renewal updated" }
```

---

### POST `/api/payments/profile-booster/pay`

Initializes a Paystack payment for profile booster credits.

**Auth:** Authenticated

**Request Body:**
```json
{
  "bundleKey": "bundle"
}
```

**Success Response (200):**
```json
{
  "authorization_url": "https://checkout.paystack.com/...",
  "reference": "fb_booster_12345"
}
```

---

### POST `/api/payments/webhook`

Paystack webhook endpoint. Called by Paystack after payment completion.

**Auth:** None (verified via HMAC signature)

**Headers Required:**
```
x-paystack-signature: <HMAC-SHA512 of request body using PAYSTACK_SECRET_KEY>
```

**Request Body:** Paystack webhook event payload

**Events Handled:**
- `charge.success` — activates subscription or grants booster credits

**Success Response (200):**
```json
{ "message": "Webhook received" }
```

---

### GET `/api/payments/admin/analytics`

Returns payment analytics dashboard data.

**Auth:** Admin

**Success Response (200):**
```json
{
  "mrr": 1500000,
  "totalRevenue": 18000000,
  "usersByTier": {
    "premium": 280,
    "elite": 60
  },
  "revenueByRegion": {
    "nigeria": 12000000,
    "global": 6000000
  }
}
```

---

### POST `/api/pay`

Alias for `POST /api/payments/pay`.

---

## 8. Photos & Uploads

### POST `/api/users/me/photo/:photoNumber`

Uploads a profile photo to Cloudinary and saves the URL to the user's profile.

**Auth:** Authenticated

**Path Param:** `photoNumber` — integer 1–6

**Request:** `multipart/form-data`
- `photo` — image file (JPEG, PNG, WebP; max 5MB)

**Success Response (200):**
```json
{
  "url": "https://res.cloudinary.com/...",
  "photoCount": 3
}
```

**Error Responses:**
| Status | Condition |
|---|---|
| 400 | Invalid photo number (must be 1–6) |
| 400 | File too large or wrong format |

---

### DELETE `/api/users/me/photo/:photoNumber`

Removes a profile photo.

**Auth:** Authenticated

**Path Param:** `photoNumber` — integer 1–6

**Success Response (200):**
```json
{
  "photos": {
    "profilePhoto1": "https://...",
    "profilePhoto2": "https://...",
    "profilePhoto3": null
  },
  "photoCount": 2
}
```

---

### POST `/api/uploads/upload-photo`

Generic single photo upload. Returns URL without attaching to profile.

**Auth:** Authenticated

**Request:** `multipart/form-data`
- `photo` — image file

**Success Response (200):**
```json
{ "url": "https://res.cloudinary.com/..." }
```

---

### POST `/api/uploads/upload-photos`

Batch upload up to 6 photos. Returns array of URLs.

**Auth:** Authenticated

**Request:** `multipart/form-data`
- `photos` — up to 6 image files

**Success Response (200):**
```json
{
  "urls": [
    "https://res.cloudinary.com/...",
    "https://res.cloudinary.com/..."
  ]
}
```

---

## 9. Stories

### GET `/api/stories/feed`

Returns all active (non-expired) stories from the user's mutual matches.

**Auth:** Authenticated

**Success Response (200):**
```json
{
  "stories": [
    {
      "id": "story-id",
      "authorId": "firebase-uid",
      "author": { "name": "Jane Doe", "profilePhoto1": "..." },
      "mediaUrl": "https://res.cloudinary.com/...",
      "mediaType": "image",
      "caption": "Good morning!",
      "seenBy": ["uid1"],
      "likedBy": [],
      "createdAt": "2026-05-26T08:00:00.000Z",
      "expiresAt": "2026-05-27T08:00:00.000Z"
    }
  ]
}
```

---

### POST `/api/stories`

Creates a new story. Expires in 24 hours.

**Auth:** Authenticated

**Request:** `multipart/form-data`
- `media` — image or video file
- `caption` — optional text caption

**Success Response (201):**
```json
{
  "id": "story-id",
  "mediaUrl": "https://res.cloudinary.com/...",
  "mediaType": "image",
  "expiresAt": "2026-05-27T08:00:00.000Z"
}
```

---

### PATCH `/api/stories/:storyId/seen`

Marks the current user as having seen a story.

**Auth:** Authenticated

**Success Response (200):**
```json
{ "message": "Story marked as seen" }
```

---

### POST `/api/stories/:storyId/like`

Toggles the current user's like on a story.

**Auth:** Authenticated

**Success Response (200):**
```json
{
  "liked": true,
  "likeCount": 3
}
```

---

### GET `/api/stories/:storyId/likes`

Returns a list of users who liked a story.

**Auth:** Authenticated

**Success Response (200):**
```json
{
  "likes": [
    { "id": "firebase-uid", "name": "John Doe", "profilePhoto1": "..." }
  ]
}
```

---

### POST `/api/stories/:storyId/reply`

Sends a message to the story author in the shared match conversation.

**Auth:** Authenticated

**Request Body:**
```json
{
  "content": "This is beautiful!"
}
```

**Success Response (200):**
```json
{ "message": "Reply sent" }
```

---

### DELETE `/api/stories/:storyId`

Deletes a story. Only the author can delete their own stories.

**Auth:** Authenticated (author only)

**Success Response (200):**
```json
{ "message": "Story deleted" }
```

---

## 10. Support

### POST `/api/support`

Submits a support ticket (help request or user report).

**Auth:** Authenticated

**Request Body:**
```json
{
  "type": "REPORT",
  "subject": "Inappropriate behavior",
  "message": "This user sent offensive messages...",
  "metadata": {
    "reportedUserId": "firebase-uid",
    "reportedUserName": "Bad Actor"
  }
}
```

**Valid types:** `HELP`, `REPORT`

**Success Response (201):**
```json
{
  "message": "Ticket submitted",
  "ticketId": "ticket-id"
}
```

---

### GET `/api/support/my-tickets`

Returns the current user's support tickets.

**Auth:** Authenticated

**Query Params:**
- `type` — filter by `HELP` or `REPORT`

**Success Response (200):**
```json
{
  "tickets": [
    {
      "id": "ticket-id",
      "type": "HELP",
      "subject": "Can't upload photo",
      "status": "RESPONDED",
      "replies": [
        {
          "adminName": "Support Team",
          "message": "Please try clearing your cache...",
          "createdAt": "2026-05-25T09:00:00.000Z"
        }
      ],
      "createdAt": "2026-05-24T15:00:00.000Z"
    }
  ]
}
```

---

### GET `/api/support/tickets`

Returns all support tickets. Admin only.

**Auth:** Admin

**Query Params:**
- `type` — filter by type
- `status` — filter by `OPEN`, `RESPONDED`, `CLOSED`

---

### POST `/api/support/tickets/:id/reply`

Admin adds a reply to a support ticket. Notifies the user.

**Auth:** Admin

**Request Body:**
```json
{
  "message": "We've resolved your issue. Please try again."
}
```

**Success Response (200):**
```json
{ "message": "Reply sent" }
```

---

## 11. System

### GET `/api/health`

Health check endpoint. No auth required.

**Success Response (200):**
```json
{
  "status": "ok",
  "service": "FaithBliss API",
  "mongodb": "connected",
  "timestamp": "2026-05-26T10:00:00.000Z"
}
```

---

## 12. Error Reference

### Standard Error Codes

| Status | Meaning | Common Causes |
|---|---|---|
| 400 | Bad Request | Missing required fields, validation failure, invalid parameters |
| 401 | Unauthorized | Missing or expired Firebase ID token |
| 403 | Forbidden | Insufficient role (not admin/developer/premium) |
| 404 | Not Found | User, match, or resource doesn't exist |
| 503 | Service Unavailable | Backend shutdown mode enabled by developer |
| 500 | Internal Server Error | Firestore write failed, Cloudinary error, Paystack API error |

### Common Error Response Format

```json
{ "message": "Human-readable error description" }
```

Some endpoints return:
```json
{ "error": "Error description" }
```

### Firebase Token Errors

| Error | Fix |
|---|---|
| Token expired | Call `getIdToken(true)` to force refresh |
| Token invalid | Re-authenticate the user |
| Token missing | Ensure `Authorization` header is set |

### Rate Limits

There is currently **no rate limiting** implemented on the API. Each endpoint has application-level limits:
- Free users: 10 swipes per day (enforced in `matchController.ts`)
- Free users: 1 active chat conversation at a time (enforced in `chatAccess.ts`)
- Premium users: Unlimited swipes and chats
