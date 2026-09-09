import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Same Firebase project as the Saveur mobile app ("saveur-ac8ec"). The four
// project-wide values below are stable and safe to default in code; the two
// platform-specific ones (apiKey, appId) only exist once a "Web app" is
// registered for this project in the Firebase Console, so those are env-only
// with an obvious placeholder fallback — see .env.local.example / README.md.
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "REPLACE_WITH_FIREBASE_WEB_API_KEY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "saveur-ac8ec.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "saveur-ac8ec",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "saveur-ac8ec.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "679326954548",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "REPLACE_WITH_FIREBASE_WEB_APP_ID",
};

export const firebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const googleAuthProvider = new GoogleAuthProvider();

export const isFirebaseConfigured =
  firebaseConfig.apiKey !== "REPLACE_WITH_FIREBASE_WEB_API_KEY" &&
  firebaseConfig.appId !== "REPLACE_WITH_FIREBASE_WEB_APP_ID";
