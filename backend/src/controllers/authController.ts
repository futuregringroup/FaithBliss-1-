// src/controllers/authController.ts

import { Request, Response } from "express";
import { admin, db } from "../config/firebase-admin";
import { DocumentData, DocumentReference } from "firebase-admin/firestore";
import {
  countProfilePhotos,
  MIN_REQUIRED_PROFILE_PHOTOS,
} from "../utils/profilePhotos";
import { validateOnboardingPayload } from "../utils/validateOnboardingPayload";

// --- FIRESTORE USER TYPE ---
export interface IUserProfile extends DocumentData {
  id: string;
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
  likes?: string[];
  passes?: string[];
  matches?: string[];
  [key: string]: unknown;
}

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

function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  );
}

// Helper to safely parse potential JSON strings from FormData
const safeParseJSON = (data: unknown): string[] => {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
  return Array.isArray(data) ? data : [];
};

// ----------------------------------------
// 1. Firebase Auth: Profile Creation (Post-Register)
// ----------------------------------------
const createProfileAfterFirebaseRegister = async (
  req: Request,
  res: Response,
) => {
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
      emailVerified: true, // Google accounts are always email-verified
      gender,
      age: parseInt(age),
      denomination,
      bio,
      location,
      onboardingCompleted: false,
      profilePhotoCount: 0,
      createdAt: new Date(),
      likes: [],
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
// 2. Onboarding Controller
// ----------------------------------------
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
    ...otherFields,
    bio,
    birthday: birthday ? new Date(birthday).toISOString() : undefined,
    location,
    latitude: latitude ? parseFloat(latitude) : undefined,
    longitude: longitude ? parseFloat(longitude) : undefined,
    faithJourney,
    sundayActivity,
    interests: parsedInterests,
    lookingFor: parsedLookingFor,
    hobbies: parsedHobbies,
    values: parsedValues,
    profileFits: profileFits === undefined ? undefined : parsedProfileFits,
    preferredGender,
    minAge: minAge ? parseInt(minAge) : undefined,
    maxAge: maxAge ? parseInt(maxAge) : undefined,
    maxDistance: maxDistance ? parseInt(maxDistance) : undefined,
    onboardingCompleted: true,
  };

  // Read Cloudinary URLs sent as JSON strings in the request body.
  for (let i = 1; i <= 6; i++) {
    const fieldName = `profilePhoto${i}` as keyof IUserProfile;
    const url = req.body[fieldName];
    if (typeof url === "string" && url.trim()) {
      updateFields[fieldName] = url.trim();
    }
  }

  console.log(
    `[completeOnboarding] uid=${uid} photoCount=${Object.keys(updateFields).filter((k) => k.startsWith("profilePhoto")).length} fields=${Object.keys(updateFields).join(",")}`,
  );

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

  Object.keys(updateFields).forEach(
    (key) =>
      updateFields[key as keyof Partial<IUserProfile>] === undefined &&
      delete updateFields[key as keyof Partial<IUserProfile>],
  );

  try {
    await userRef.update(updateFields);

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
// EXPORTS
// ----------------------------------------
export {
  completeOnboarding,
  createProfileAfterFirebaseRegister,
};
