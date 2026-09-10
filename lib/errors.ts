/**
 * Extracts a displayable message from a caught error, regardless of shape.
 *
 * Bug this fixes: every catch block that did `err instanceof Error ?
 * err.message : "<generic fallback>"` was silently discarding real,
 * already-computed error text whenever the error came from `apiClient`
 * (lib/apiClient.ts) — that module deliberately throws plain `ApiError`
 * OBJECTS, not `Error` instances (e.g. `{message: "No internet connection.
 * Please check your connection and try again.", code: "ERR_NETWORK"}`), so
 * `instanceof Error` was always false for those and every apiClient failure
 * showed the same generic per-screen fallback instead of the specific
 * reason. This checks for a `.message` string on ANY object shape — Error
 * instances, ApiError objects, and Firebase's FirebaseError (which IS a
 * real Error subclass, so it was already working) all satisfy this.
 */
// Firebase's own FirebaseError.message is literally "Firebase: Error
// (auth/invalid-credential)." — real product report: this leaked to end
// users verbatim ("normal people don't know what firebase is"). Firebase
// auth errors are the one error shape below that needs translating BEFORE
// the generic ".message" passthrough, since (unlike apiClient's ApiError,
// which already carries a real human-readable .message) Firebase's message
// text is the raw SDK/wire error name, not something meant to be shown.
// Keyed by the stable `.code` string (e.g. "auth/invalid-credential"),
// present on every real FirebaseError — see
// https://firebase.google.com/docs/reference/js/auth#autherrorcodes.
const FIREBASE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Incorrect email or password. Please check your details and try again.",
  "auth/user-not-found": "We couldn't find an account with that email.",
  "auth/wrong-password": "Incorrect email or password. Please check your details and try again.",
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/user-disabled": "This account has been disabled. Please contact support.",
  "auth/email-already-in-use": "An account with that email already exists. Try signing in instead.",
  "auth/weak-password": "Please choose a stronger password (at least 6 characters).",
  "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
  "auth/network-request-failed": "No internet connection. Please check your connection and try again.",
  "auth/popup-closed-by-user": "Sign-in was cancelled before it finished.",
  "auth/cancelled-popup-request": "Sign-in was cancelled before it finished.",
  "auth/account-exists-with-different-credential": "An account already exists with this email using a different sign-in method.",
  "auth/requires-recent-login": "Please sign in again to complete this action.",
  "auth/invalid-verification-code": "That verification code isn't valid. Please try again.",
  "auth/expired-action-code": "That link has expired. Please request a new one.",
};

function isFirebaseAuthErrorCode(code: unknown): code is string {
  return typeof code === "string" && code.startsWith("auth/");
}

export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    if ("code" in err && isFirebaseAuthErrorCode((err as { code?: unknown }).code)) {
      const code = (err as { code: string }).code;
      return FIREBASE_AUTH_ERROR_MESSAGES[code] || "Something went wrong. Please check your details and try again.";
    }
    if ("message" in err && typeof (err as { message?: unknown }).message === "string" && (err as { message: string }).message) {
      return (err as { message: string }).message;
    }
  }
  return fallback;
}
