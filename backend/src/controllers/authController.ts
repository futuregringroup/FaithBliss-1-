// src/controllers/authController.ts (FIRESTORE/FIREBASE REWRITE)

import { Request, Response } from "express";
import { admin, db } from "../config/firebase-admin";
import { DocumentData, DocumentReference } from "firebase-admin/firestore";
import { createHash, randomInt } from "crypto";
import sgMail from "@sendgrid/mail";
import {
  countProfilePhotos,
  MIN_REQUIRED_PROFILE_PHOTOS,
} from "../utils/profilePhotos";
import { validateOnboardingPayload } from "../utils/validateOnboardingPayload";

// --- FIRESTORE USER TYPE (Simplified for the controller) ---
// Note: We use the Firebase UID as the document ID.
export interface IUserProfile extends DocumentData {
  id: string; // The Firestore Document ID (which is the Firebase UID)
  name: string;
  email: string;
  role?: string;
  roles?: string[];
  gender: string;
  age: number;
  denomination: string;
  bio?: string;
  location?: string;
  profilePhoto1?: string;
  profilePhoto2?: string;
  profilePhoto3?: string;
  profilePhoto4?: string;
  profilePhoto5?: string;
  profilePhoto6?: string;
  profilePhotoCount?: number;
  onboardingCompleted: boolean;
  profileFits?: string[];
  emailVerified?: boolean;
  emailVerificationCodeHash?: string;
  emailVerificationExpiresAt?: FirebaseFirestore.Timestamp | string | Date;
  emailVerificationLastSentAt?: FirebaseFirestore.Timestamp | string | Date;
  emailVerifiedAt?: FirebaseFirestore.Timestamp | string | Date;
  welcomeEmailSentAt?: FirebaseFirestore.Timestamp | string | Date;
  // Add other fields...
  likes?: string[]; // Array of Firestore UIDs
  passes?: string[];
  matches?: string[];
}
// -----------------------------------------------------------
const PRIMARY_ADMIN_EMAIL = "aginaemmanuel6@gmail.com";

const resolveUserRole = (email: unknown, role?: unknown): string => {
  if (
    typeof email === "string" &&
    email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL
  ) {
    return "admin";
  }

  if (typeof role === "string" && role.trim()) {
    return role.trim().toLowerCase();
  }

  return "user";
};

const resolveUserRoles = (email: unknown, roles?: unknown): string[] => {
  const normalizedRoles = Array.isArray(roles)
    ? roles
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    : [];

  if (
    typeof email === "string" &&
    email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL
  ) {
    return Array.from(new Set([...normalizedRoles, "developer"]));
  }

  return Array.from(new Set(normalizedRoles));
};

const EMAIL_VERIFICATION_EXPIRY_MINUTES = 10;
const EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = 45;
const formatSecondsLabel = (seconds: number) =>
  `${seconds} second${seconds === 1 ? "" : "s"}`;

function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  );
}

// Helper to safely parse potential JSON strings from FormData (for arrays like interests)
const safeParseJSON = (data: any): string[] => {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }
  return Array.isArray(data) ? data : [];
};

const hashVerificationCode = (code: string) =>
  createHash("sha256").update(code).digest("hex");

const generateVerificationCode = () =>
  randomInt(0, 1000000).toString().padStart(6, "0");

const maskEmail = (email: string) => {
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return email;
  if (localPart.length <= 2) return `${localPart[0] || "*"}*@${domain}`;
  return `${localPart.slice(0, 2)}${"*".repeat(Math.max(1, localPart.length - 2))}@${domain}`;
};

const toMillis = (value: unknown): number | null => {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return null;
};

const sendVerificationCodeEmail = async (
  to: string,
  code: string,
  name?: string,
) => {
  const firstName =
    typeof name === "string" && name.trim()
      ? name.trim().split(/\s+/)[0]
      : "there";
  const siteUrl = (
    process.env.PUBLIC_APP_URL ||
    process.env.CLIENT_URL ||
    "https://faithblissafrica.com"
  ).replace(/\/$/, "");
  const sendgridFrom = process.env.SENDGRID_FROM?.trim();
  const supportEmail =
    process.env.SENDGRID_REPLY_TO?.trim() ||
    process.env.SUPPORT_EMAIL?.trim() ||
    sendgridFrom ||
    "faithbliss@futuregrin.com";
  const subject = "Your FaithBliss verification code";

  const text = `Hi ${firstName},\n\nUse this FaithBliss verification code to confirm your email address:\n\n${code}\n\nThis code expires in ${EMAIL_VERIFICATION_EXPIRY_MINUTES} minutes.\n\nIf you did not create a FaithBliss account, you can ignore this email.\n\nNeed help? Contact ${supportEmail} or visit ${siteUrl}/contact.\n\nFaithBliss Africa`;

  const html = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; color: #111827;">
            <p style="margin: 0 0 16px; font-size: 14px; color: #6B7280;">FaithBliss Africa email verification</p>
            <h1 style="margin: 0 0 16px; font-size: 24px; line-height: 1.3; color: #111827;">Verify your email address</h1>
            <p style="margin: 0 0 16px; color: #374151;">Hi ${firstName},</p>
            <p style="margin: 0 0 20px; color: #374151;">Use the verification code below to confirm your FaithBliss account. This code expires in <strong>${EMAIL_VERIFICATION_EXPIRY_MINUTES} minutes</strong>.</p>
            <div style="margin: 0 0 24px; padding: 18px 20px; border-radius: 16px; background: #F3F4F6; border: 1px solid #E5E7EB; text-align: center;">
                <p style="margin: 0; font-size: 30px; font-weight: 700; letter-spacing: 6px; color: #111827;">${code}</p>
            </div>
            <p style="margin: 0 0 16px; color: #4B5563;">If you did not create a FaithBliss account, you can ignore this email.</p>
            <p style="margin: 0 0 8px; color: #6B7280; font-size: 13px;">Need help? Contact <a href="mailto:${supportEmail}" style="color: #2563EB; text-decoration: none;">${supportEmail}</a> or visit <a href="${siteUrl}/contact" style="color: #2563EB; text-decoration: none;">${siteUrl}/contact</a>.</p>
            <p style="margin: 0; color: #9CA3AF; font-size: 12px;">This is a transactional security email from FaithBliss Africa.</p>
        </div>
    `;

  // Prefer SendGrid if API key is configured
  const sendgridKey = process.env.SENDGRID_API_KEY?.trim();

  if (!sendgridKey || !sendgridFrom) {
    // Both must be set in production for email to work. Log clearly so the
    // issue is visible in backend logs rather than silently falling through.
    console.error(
      "[EMAIL] SENDGRID_API_KEY or SENDGRID_FROM is not set. " +
      "Verification email was NOT sent. " +
      `SENDGRID_FROM=${sendgridFrom || "(missing)"} ` +
      `SENDGRID_API_KEY=${sendgridKey ? "(set)" : "(missing)"}`
    );
    throw new Error(
      "Email service is not configured. Please contact support."
    );
  }

  if (sendgridKey && sendgridFrom) {
    sgMail.setApiKey(sendgridKey);
    const msg = {
      to,
      from: {
        email: sendgridFrom,
        name: "FaithBliss",
      },
      subject,
      text,
      html,
      replyTo: {
        email: supportEmail,
        name: "FaithBliss Support",
      },
      trackingSettings: {
        clickTracking: {
          enable: false,
          enableText: false,
        },
        openTracking: {
          enable: false,
        },
        subscriptionTracking: {
          enable: false,
        },
      },
      headers: {
        "X-Entity-Ref-ID": `email-verification-${Date.now()}`,
      },
      categories: ["transactional", "email_verification"],
    };

    try {
      await sgMail.send(msg);
      return;
    } catch (error: unknown) {
      console.error("SendGrid send error:", error);

      // SendGrid errors can include structured response data. Include it when available.
      let sendGridDetails = "";
      if (typeof error === "object" && error !== null) {
        const anyErr = error as any;
        if (anyErr.response?.body) {
          console.error("SendGrid response body:", anyErr.response.body);
          try {
            sendGridDetails = JSON.stringify(anyErr.response.body);
          } catch {
            sendGridDetails = String(anyErr.response.body);
          }
        }
      }

      const normalizedDetails = sendGridDetails.toLowerCase();
      if (
        normalizedDetails.includes("verified sender identity") ||
        normalizedDetails.includes("from address does not match")
      ) {
        throw new Error(
          "Verification email is not configured correctly yet. Please contact support and try again later.",
        );
      }

      throw new Error(
        `SendGrid send failure (check API key / sender permissions)${
          sendGridDetails ? ` — details: ${sendGridDetails}` : ""
        }`,
      );
    }
  }

  // Fallback: existing webhook method (for legacy setups)
  const webhook = process.env.EMAIL_WEBHOOK_URL;
  if (!webhook || webhook.includes("localhost:5173")) {
    console.warn(
      "Email delivery is currently mocked; set SENDGRID_API_KEY or EMAIL_WEBHOOK_URL to send real emails.",
    );
    console.log(`Mock send email to ${to}:`, { subject, text });
    return;
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, subject, text }),
  });

  if (!response.ok) {
    throw new Error(`Email delivery failed with status ${response.status}.`);
  }
};

const sendWelcomeEmail = async (to: string, name?: string) => {
  const firstName =
    typeof name === "string" && name.trim()
      ? name.trim().split(/\s+/)[0]
      : "there";
  const siteUrl = (
    process.env.PUBLIC_APP_URL ||
    process.env.CLIENT_URL ||
    "https://faithblissafrica.com"
  ).replace(/\/$/, "");
  const sendgridFrom = process.env.SENDGRID_FROM?.trim();
  const supportEmail =
    process.env.SENDGRID_REPLY_TO?.trim() ||
    process.env.SUPPORT_EMAIL?.trim() ||
    sendgridFrom ||
    "faithbliss@futuregrin.com";
  const subject = "Welcome to FaithBliss";
  const text = `Hi ${firstName},\n\nWelcome to FaithBliss. We are glad you are here.\n\nYou can finish verifying your email and then continue setting up your profile to start meeting intentional Christian singles.\n\nIf you need help at any point, contact ${supportEmail} or visit ${siteUrl}/contact.\n\nFaithBliss Africa`;
  const html = `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #ffffff; color: #111827;">
            <p style="margin: 0 0 16px; font-size: 14px; color: #6B7280;">FaithBliss Africa</p>
            <h1 style="margin: 0 0 16px; font-size: 24px; line-height: 1.3; color: #111827;">Welcome to FaithBliss</h1>
            <p style="margin: 0 0 16px; color: #374151;">Hi ${firstName},</p>
            <p style="margin: 0 0 16px; color: #374151;">We are glad you joined FaithBliss.</p>
            <p style="margin: 0 0 20px; color: #374151;">Once you verify your email, you can continue setting up your profile and start meeting intentional Christian singles.</p>
            <p style="margin: 0 0 8px; color: #6B7280; font-size: 13px;">Need help? Contact <a href="mailto:${supportEmail}" style="color: #2563EB; text-decoration: none;">${supportEmail}</a> or visit <a href="${siteUrl}/contact" style="color: #2563EB; text-decoration: none;">${siteUrl}/contact</a>.</p>
            <p style="margin: 0; color: #9CA3AF; font-size: 12px;">This is a transactional welcome email from FaithBliss Africa.</p>
        </div>
    `;

  const sendgridKey = process.env.SENDGRID_API_KEY;
  if (sendgridKey && sendgridFrom) {
    sgMail.setApiKey(sendgridKey);
    await sgMail.send({
      to,
      from: {
        email: sendgridFrom,
        name: "FaithBliss",
      },
      subject,
      text,
      html,
      replyTo: {
        email: supportEmail,
        name: "FaithBliss Support",
      },
      trackingSettings: {
        clickTracking: {
          enable: false,
          enableText: false,
        },
        openTracking: {
          enable: false,
        },
        subscriptionTracking: {
          enable: false,
        },
      },
      categories: ["transactional", "welcome_email"],
    });
    return;
  }

  const webhook = process.env.EMAIL_WEBHOOK_URL;
  if (!webhook || webhook.includes("localhost:5173")) {
    console.warn(
      "Welcome email delivery is currently mocked; set SENDGRID_API_KEY or EMAIL_WEBHOOK_URL to send real emails.",
    );
    console.log(`Mock send welcome email to ${to}:`, { subject, text });
    return;
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, subject, text }),
  });

  if (!response.ok) {
    throw new Error(
      `Welcome email delivery failed with status ${response.status}.`,
    );
  }
};

// ----------------------------------------
// 1. Firebase Auth: Profile Creation (Post-Register)
// ----------------------------------------
/**
 * @route POST /api/auth/register-profile
 * @desc Creates the custom Firestore profile for a newly Firebase-registered user.
 * @access Private (Requires Firebase ID Token via protect middleware)
 */
const createProfileAfterFirebaseRegister = async (
  req: Request,
  res: Response,
) => {
  // req.userId is set by the protect middleware (which validates the Firebase token)
  // 🛑 The Firestore Document ID is the Firebase UID
  const uid = req.userId;
  const { name, email, gender, age, denomination, bio, location } = req.body;

  if (!uid) {
    return res
      .status(401)
      .json({ message: "Authentication required: Firebase UID missing." });
  }
  if (!name || !email || !age || !gender || !denomination || !location) {
    return res
      .status(400)
      .json({ message: "Please provide all required profile fields." });
  }

  try {
    // Check if profile document already exists using the UID
    const userRef = db.collection("users").doc(uid);
    const doc = await userRef.get();

    if (doc.exists) {
      return res
        .status(400)
        .json({ message: "User profile already exists in Firestore." });
    }

    const profileData: Partial<IUserProfile> = {
      name,
      email,
      role: resolveUserRole(email),
      roles: resolveUserRoles(email),
      emailVerified: false,
      gender,
      age: parseInt(age),
      denomination,
      bio,
      location,
      onboardingCompleted: false, // Initial state
      profilePhotoCount: 0,
      createdAt: new Date(),
      likes: [], // Initialize arrays for future use
      passes: [],
      matches: [],
    };

    await userRef.set(profileData);

    const newUserProfile = { id: doc.id, ...profileData } as IUserProfile;

    res.status(201).json({
      id: newUserProfile.id,
      name: newUserProfile.name,
      email: newUserProfile.email,
      onboardingCompleted: newUserProfile.onboardingCompleted,
      age: newUserProfile.age,
    });
  } catch (error: unknown) {
    console.error("Registration Profile Error:", error);
    const errorMessage = isErrorWithMessage(error)
      ? error.message
      : "An unknown error occurred during profile creation";
    res.status(500).json({ message: `Server Error: ${errorMessage}` });
  }
};

// ----------------------------------------
// 1b. Email Verification Code
// ----------------------------------------
const sendEmailVerificationCode = async (req: Request, res: Response) => {
  const uid = req.userId;

  if (!uid) {
    return res
      .status(401)
      .json({ message: "Authentication required: Firebase UID missing." });
  }

  try {
    const userRef = db.collection("users").doc(uid);
    const doc = await userRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "User profile not found." });
    }

    const userData = doc.data() as IUserProfile;
    const email =
      typeof userData.email === "string"
        ? userData.email.trim().toLowerCase()
        : "";
    if (!email) {
      return res
        .status(400)
        .json({ message: "No email address is available for this account." });
    }

    if (userData.emailVerified === true) {
      return res.status(200).json({
        message: "Your email is already verified.",
        isVerified: true,
        email: maskEmail(email),
      });
    }

    const lastSentAtMs = toMillis(userData.emailVerificationLastSentAt);
    if (lastSentAtMs) {
      const secondsSinceLastSend = Math.floor(
        (Date.now() - lastSentAtMs) / 1000,
      );
      if (secondsSinceLastSend < EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS) {
        const retryAfterSeconds =
          EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS - secondsSinceLastSend;
        return res.status(429).json({
          message: `Please wait ${formatSecondsLabel(retryAfterSeconds)} before requesting another code.`,
          retryAfterSeconds,
        });
      }
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(
      Date.now() + EMAIL_VERIFICATION_EXPIRY_MINUTES * 60 * 1000,
    );

    await userRef.set(
      {
        emailVerificationCodeHash: hashVerificationCode(code),
        emailVerificationExpiresAt:
          admin.firestore.Timestamp.fromDate(expiresAt),
        emailVerificationLastSentAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      },
      { merge: true },
    );

    await sendVerificationCodeEmail(email, code, userData.name);

    if (!userData.welcomeEmailSentAt) {
      try {
        await sendWelcomeEmail(email, userData.name);
        await userRef.set(
          {
            welcomeEmailSentAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
          },
          { merge: true },
        );
      } catch (welcomeError) {
        console.warn("Welcome email send failed:", welcomeError);
      }
    }

    return res.status(200).json({
      message: `Verification code sent to ${maskEmail(email)}.`,
      email: maskEmail(email),
      expiresInMinutes: EMAIL_VERIFICATION_EXPIRY_MINUTES,
      isVerified: false,
    });
  } catch (error: unknown) {
    console.error("Email verification send error:", error);
    const errorMessage = isErrorWithMessage(error)
      ? error.message
      : "Unable to send verification code.";
    return res.status(500).json({ message: errorMessage });
  }
};

const verifyEmailVerificationCode = async (req: Request, res: Response) => {
  const uid = req.userId;
  const rawCode =
    typeof req.body?.code === "string" ? req.body.code.trim() : "";

  if (!uid) {
    return res
      .status(401)
      .json({ message: "Authentication required: Firebase UID missing." });
  }

  if (!/^\d{6}$/.test(rawCode)) {
    return res.status(400).json({
      message: "Enter the 6-digit verification code sent to your email.",
    });
  }

  try {
    const userRef = db.collection("users").doc(uid);
    const doc = await userRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: "User profile not found." });
    }

    const userData = doc.data() as IUserProfile;
    if (userData.emailVerified === true) {
      return res.status(200).json({
        message: "Your email is already verified.",
        isVerified: true,
      });
    }

    const storedHash =
      typeof userData.emailVerificationCodeHash === "string"
        ? userData.emailVerificationCodeHash.trim()
        : "";
    const expiresAtMs = toMillis(userData.emailVerificationExpiresAt);

    if (!storedHash || !expiresAtMs) {
      return res.status(400).json({
        message:
          "No verification code is active. Request a new code and try again.",
      });
    }

    if (Date.now() > expiresAtMs) {
      await userRef.set(
        {
          emailVerificationCodeHash: admin.firestore.FieldValue.delete(),
          emailVerificationExpiresAt: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.Timestamp.now(),
        },
        { merge: true },
      );

      return res.status(400).json({
        message:
          "This verification code has expired. Request a new one and try again.",
      });
    }

    if (hashVerificationCode(rawCode) !== storedHash) {
      return res.status(400).json({
        message: "That verification code is incorrect. Please try again.",
      });
    }

    await userRef.set(
      {
        emailVerified: true,
        emailVerifiedAt: admin.firestore.Timestamp.now(),
        emailVerificationCodeHash: admin.firestore.FieldValue.delete(),
        emailVerificationExpiresAt: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.Timestamp.now(),
      },
      { merge: true },
    );

    try {
      await admin.auth().updateUser(uid, { emailVerified: true });
    } catch (firebaseError) {
      console.warn(
        "Unable to update Firebase emailVerified flag:",
        firebaseError,
      );
    }

    return res.status(200).json({
      message: "Email verified successfully.",
      isVerified: true,
      emailVerifiedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Email verification confirm error:", error);
    const errorMessage = isErrorWithMessage(error)
      ? error.message
      : "Unable to verify email right now.";
    return res.status(500).json({ message: errorMessage });
  }
};

// -----------------------------------------------------------
// 2. Onboarding Controller (Cloudinary Implementation)
// -----------------------------------------------------------
/**
 * @route PUT /auth/complete-onboarding
 * @desc Complete user onboarding, including photo uploads to Cloudinary and profile data update.
 * @access Private
 */
const completeOnboarding = async (req: Request, res: Response) => {
  const uid = req.userId;

  if (!uid) {
    return res
      .status(401)
      .json({ message: "User not authenticated (Firebase UID missing)" });
  }

  const userRef: DocumentReference = db.collection("users").doc(uid);
  const doc = await userRef.get();

  if (!doc.exists) {
    return res.status(404).json({
      message:
        "User profile not found in database. Please complete initial profile creation.",
    });
  }

  const user = { id: doc.id, ...doc.data() } as IUserProfile;

  // Extract all expected fields from the body (Comprehensive)
  const {
    birthday,
    location,
    latitude,
    longitude,
    faithJourney,
    sundayActivity,
    preferredGender,
    minAge,
    maxAge,
    maxDistance,
    lookingFor,
    hobbies,
    values,
    bio,
    interests,
    profileFits,
    ...otherFields
  } = req.body;

  const parsedInterests = safeParseJSON(interests);
  const parsedLookingFor = safeParseJSON(lookingFor);
  const parsedHobbies = safeParseJSON(hobbies);
  const parsedValues = safeParseJSON(values);
  const parsedProfileFits = safeParseJSON(profileFits);

  const updateFields: Partial<IUserProfile> = {
    // General Profile fields
    ...otherFields,
    bio,
    birthday: birthday ? new Date(birthday).toISOString() : undefined, // Firestore friendly
    location,
    latitude: latitude ? parseFloat(latitude) : undefined,
    longitude: longitude ? parseFloat(longitude) : undefined,

    // Faith/Goals
    faithJourney,
    sundayActivity,

    // Preferences (Parsed from JSON strings)
    interests: parsedInterests,
    lookingFor: parsedLookingFor,
    hobbies: parsedHobbies,
    values: parsedValues,
    profileFits: profileFits === undefined ? undefined : parsedProfileFits,

    // Matching Preferences
    preferredGender,
    minAge: minAge ? parseInt(minAge) : undefined,
    maxAge: maxAge ? parseInt(maxAge) : undefined,
    maxDistance: maxDistance ? parseInt(maxDistance) : undefined,

    // 🌟 CRITICAL: Set the completion flag
    onboardingCompleted: true,
  };

  // Read Cloudinary URLs sent as JSON strings in the request body.
  for (let i = 1; i <= 6; i++) {
    const fieldName = `profilePhoto${i}` as keyof IUserProfile;
    const url = req.body[fieldName];
    if (typeof url === 'string' && url.trim()) {
      updateFields[fieldName] = url.trim();
    }
  }

  console.log(`[completeOnboarding] uid=${uid} photoCount=${Object.keys(updateFields).filter(k => k.startsWith('profilePhoto')).length} fields=${Object.keys(updateFields).join(',')}`);

  const nextUserSnapshot = { ...user, ...updateFields };
  const profilePhotoCount = countProfilePhotos(nextUserSnapshot);
  if (profilePhotoCount < MIN_REQUIRED_PROFILE_PHOTOS) {
    return res.status(400).json({
      message: `Please upload at least ${MIN_REQUIRED_PROFILE_PHOTOS} profile photos before completing onboarding.`,
    });
  }
  updateFields.profilePhotoCount = profilePhotoCount;

  const validationError = validateOnboardingPayload({
    ...nextUserSnapshot,
    profilePhotoCount,
  } as Record<string, unknown>);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  // Clean up undefined values (Firestore update ignores undefined, but good practice)
  Object.keys(updateFields).forEach(
    (key) =>
      updateFields[key as keyof Partial<IUserProfile>] === undefined &&
      delete updateFields[key as keyof Partial<IUserProfile>],
  );

  try {
    await userRef.update(updateFields);

    // Fetch the updated document
    const updatedDoc = await userRef.get();
    if (!updatedDoc.exists) {
      return res.status(404).json({ message: "User not found after update." });
    }

    const updatedUser = {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    } as IUserProfile;

    return res.status(200).json({
      message: "Onboarding complete! Profile updated successfully.",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        onboardingCompleted: updatedUser.onboardingCompleted,
        profilePhoto1: updatedUser.profilePhoto1,
        profilePhotoCount: updatedUser.profilePhotoCount,
      },
    });
  } catch (error: unknown) {
    const errorMessage = isErrorWithMessage(error)
      ? error.message
      : "An unknown error occurred during onboarding";
    console.error("Onboarding update error:", error);
    res.status(500).json({ message: `Server Error: ${errorMessage}` });
  }
};

// ----------------------------------------
// NO LONGER NEEDED (Replaced by Firebase Auth)
// ----------------------------------------
// const registerUser = ...
// const loginUser = ...
// const logoutUser = ...
// const googleAuth = ...
// const googleAuthCallback = ...

// ----------------------------------------
// FINAL EXPORTS
// ----------------------------------------
export {
  sendEmailVerificationCode,
  verifyEmailVerificationCode,
  completeOnboarding,
  createProfileAfterFirebaseRegister,
};
