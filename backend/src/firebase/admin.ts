// server/firebase/admin.ts (Updated for Base64 Decoding)

import * as admin from "firebase-admin";
import { ServiceAccount } from "firebase-admin";
import { Buffer } from "buffer"; // Import Buffer for decoding

const base64Credentials = process.env.FIREBASE_CREDENTIALS_BASE64;

if (!base64Credentials) {
  throw new Error(
    "FIREBASE_CREDENTIALS_BASE64 environment variable not set. Please set this value in your deployment environment.",
  );
}

try {
  // 1. Decode the Base64 string into a JSON string
  // The Buffer class is used in Node.js for binary data operations
  const credentialsJsonString = Buffer.from(
    base64Credentials,
    "base64",
  ).toString("utf-8");

  // 2. Parse the JSON string into the ServiceAccount object
  const serviceAccount = JSON.parse(credentialsJsonString) as ServiceAccount;

  // 3. Initialize Firebase Admin SDK
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("Firebase Admin SDK initialized successfully.");
} catch (error) {
  console.error(`❌ FATAL ERROR: Could not initialize Firebase Admin SDK.`);
  console.error(
    `Check if FIREBASE_CREDENTIALS_BASE64 is a valid Base64 encoded JSON string.`,
  );
  // Re-throw the error to crash the server, as authentication cannot proceed
  throw error;
}

export default admin;
