// Referral-code capture for the web app. The backend's share landing page
// (Saveur-Backend app/web.py GET /r/<code>) sends desktop visitors, and
// mobile visitors who choose "Continue in browser", to
// https://<web-app>/register?ref=<CODE>. The code is parked in localStorage
// here and sent as `referred_by_code` on the next POST /api/users/me
// (AuthProvider.syncProfile), which every sign-up path (email, Google,
// LinkedIn) already calls — the backend only honours it for a brand-new user.

const KEY = "saveur.pendingReferralCode";
const CODE_RE = /^[A-Za-z0-9_-]{3,32}$/;

export function captureReferralFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = (params.get("ref") || params.get("referral") || "").trim();
    if (!CODE_RE.test(raw)) return null;
    const code = raw.toUpperCase();
    window.localStorage.setItem(KEY, code);
    return code;
  } catch {
    return null;
  }
}

export function getPendingReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearPendingReferralCode(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
