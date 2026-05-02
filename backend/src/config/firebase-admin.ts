// src/config/firebase-admin.ts (FINAL DEPLOYMENT FIX)

import * as admin from "firebase-admin";
import { ServiceAccount } from "firebase-admin";
import { Buffer } from "buffer"; // Import Buffer for decoding
// import * as path from 'path'; // Removed path dependency

const base64Credentials = process.env.FIREBASE_CREDENTIALS_BASE64;

if (!base64Credentials) {
  // Crucial: Throwing an error if the new variable is missing
  throw new Error("FIREBASE_CREDENTIALS_BASE64 environment variable not set.");
}

if (!admin.apps.length) {
  try {
    // 1. Decode the Base64 string into a JSON string
    const credentialsJsonString = Buffer.from(
      base64Credentials,
      "base64",
    ).toString("utf-8");

    // 2. Parse the JSON string into the ServiceAccount object
    const serviceAccount = JSON.parse(credentialsJsonString) as ServiceAccount;

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("Firebase Admin SDK initialized successfully."); // Added log for verification
  } catch (error) {
    console.error(
      "❌ FATAL ERROR: Could not initialize Firebase Admin SDK. Check Base64 format.",
    );
    throw error;
  }
}

// FIX: Export 'db' here.
export const db = admin.firestore();

// Firestore user profile collection reference
export const usersCollection = db.collection("users");

// Re-export admin for field values, etc.
export { admin };
