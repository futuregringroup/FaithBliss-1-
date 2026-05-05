// src/firebase/config.ts (FINAL)

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  serverTimestamp as firestoreServerTimestamp,
} from "firebase/firestore";
// 💡 CRITICAL ADDITION: Import for Storage services
import { getStorage } from "firebase/storage";

// --- 1. Firebase Configuration Object ---
// const configuredAuthDomain = String(
//   import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
// ).trim();
// const runtimeHost =
//   typeof window !== "undefined" && window.location.hostname
//     ? window.location.hostname
//     : "";
// const shouldUseSameOriginAuthDomain =
//   import.meta.env.PROD &&
//   typeof window !== "undefined" &&
//   runtimeHost.length > 0 &&
//   runtimeHost !== "localhost" &&
//   runtimeHost !== "127.0.0.1";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// --- 2. Initialize the Firebase App ---
// This should only be called once.
const firebaseApp = initializeApp(firebaseConfig);

// --- 3. Initialize Firebase Services ---

// Export the Auth instance
export const auth = getAuth(firebaseApp);

// Export the Firestore instance
export const db = getFirestore(firebaseApp);

// 💡 CRITICAL ADDITION: Export the Storage instance
export const storage = getStorage(firebaseApp);

// Export serverTimestamp utility for document creation/updates
export const serverTimestamp = firestoreServerTimestamp;

export default firebaseApp;
