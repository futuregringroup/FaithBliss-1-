import { initializeApp } from "firebase/app";
import { getAuth, browserLocalPersistence, browserSessionPersistence, setPersistence } from "firebase/auth";
import {
  getFirestore,
  serverTimestamp as firestoreServerTimestamp,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // Always use the Firebase default auth domain — custom domain proxy (faithblissafrica.com/__/auth)
  // requires Firebase Hosting custom domain setup which is not configured. The default domain
  // works on all platforms without any extra setup.
  authDomain: "faithbliss-79c63.firebaseapp.com",
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

// Set persistence once at startup so it never needs to be awaited inside a
// user-gesture handler. Awaiting setPersistence before signInWithPopup breaks
// the synchronous call chain browsers require to allow popups.
//
// iOS Safari in private browsing mode blocks localStorage entirely. When
// browserLocalPersistence fails, fall back to browserSessionPersistence so
// the auth session survives for the duration of the tab instead of looping
// forever on the loading spinner.
setPersistence(auth, browserLocalPersistence).catch(() => {
  setPersistence(auth, browserSessionPersistence).catch(() => {
    // Both failed — Firebase will use in-memory persistence automatically.
  });
});

// Export the Firestore instance
export const db = getFirestore(firebaseApp);

// 💡 CRITICAL ADDITION: Export the Storage instance
export const storage = getStorage(firebaseApp);

// Export serverTimestamp utility for document creation/updates
export const serverTimestamp = firestoreServerTimestamp;

export default firebaseApp;
