"use client";

import React from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import apiClient from "@/lib/apiClient";
import { profileFromWire, profileToWirePatch, type UserProfile, type UserProfileWire } from "@/lib/types";
import { getSubscriptionStatus, isPremiumTier, isProTier, type SubscriptionStatus } from "@/lib/billingService";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  /** Re-syncs the backend profile record (POST /api/users/me) — call right
   * after a Firebase sign-in/sign-up completes. */
  syncProfile: () => Promise<UserProfile | null>;
  refreshProfile: () => Promise<UserProfile | null>;
  updateProfile: (partial: Partial<UserProfile>) => Promise<UserProfile | null>;
  signOut: () => Promise<void>;
  /** Permanently deletes the backend user row AND the Firebase Auth account
   * itself server-side (Saveur-Backend's account_deletion_service.py), plus
   * immediately cancels any active Stripe subscription — mirrors mobile's
   * AuthContext.deleteAccount. Callers don't need to separately delete the
   * Firebase account client-side afterward; this just signs out locally
   * once the backend call resolves. See app/settings/profile/page.tsx for
   * the confirmation UI. */
  deleteAccount: () => Promise<void>;
  /** Real entitlement state (GET /api/v1/billing/subscription) — see
   * lib/billingService.ts's own header comment for why this replaced the
   * old (always-broken) `profile.subscriptionTier` checks. `null` while
   * still loading or signed out. */
  subscriptionStatus: SubscriptionStatus | null;
  /** Any active/trialing paid plan (Saveur Basic and up) — mirrors
   * entitlements_service.py's is_pro. Use to gate anything @require_pro on
   * the backend. */
  isPro: boolean;
  /** Saveur Premium/Premium (Yearly) only — mirrors entitlements_service.py's
   * is_premium. Use to gate anything @require_premium on the backend. */
  isPremium: boolean;
  refreshSubscriptionStatus: () => Promise<SubscriptionStatus | null>;
  /** Mirrors Firebase's `currentUser.emailVerified` — mirrors mobile's
   * AuthContext.emailVerified. Federated providers (Google/LinkedIn) assert
   * a verified email at sign-in time, so this is only ever false for an
   * email/password account that hasn't clicked its verification link yet.
   * Not auto-refreshed — Firebase only updates this locally after an
   * explicit `reload()`, so call `refreshEmailVerified()` (e.g. when the
   * tab regains focus) to pick up a change made by tapping the emailed
   * link. */
  emailVerified: boolean;
  refreshEmailVerified: () => Promise<boolean>;
  /** POST /api/v1/email/send-verification — same real backend contract
   * mobile already uses (Saveur-Backend/app/api/email.py's
   * send_verification(): generates a Firebase-hosted verification link
   * server-side and emails it via Resend). */
  resendVerificationEmail: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue>({
  firebaseUser: null,
  profile: null,
  loading: true,
  syncProfile: async () => null,
  refreshProfile: async () => null,
  updateProfile: async () => null,
  signOut: async () => {},
  deleteAccount: async () => {},
  subscriptionStatus: null,
  isPro: false,
  isPremium: false,
  refreshSubscriptionStatus: async () => null,
  emailVerified: false,
  refreshEmailVerified: async () => false,
  resendVerificationEmail: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = React.useState<FirebaseUser | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = React.useState<SubscriptionStatus | null>(null);
  const [emailVerified, setEmailVerified] = React.useState(false);

  const refreshSubscriptionStatus = React.useCallback(async (): Promise<SubscriptionStatus | null> => {
    try {
      const status = await getSubscriptionStatus();
      setSubscriptionStatus(status);
      return status;
    } catch {
      // Fails closed — a failed fetch leaves subscriptionStatus at whatever
      // it was (null on first load), so isPro/isPremium below stay false
      // rather than a network hiccup accidentally unlocking a paid feature.
      return null;
    }
  }, []);

  const syncProfile = React.useCallback(async (): Promise<UserProfile | null> => {
    try {
      // POST /api/users/me upserts + returns the backend user record — see
      // Saveur-Backend app/api/users.py's sync(). Safe to call on every
      // sign-in, not just first sign-up.
      const wire = await apiClient.post<UserProfileWire>("/api/users/me", {});
      const next = profileFromWire(wire);
      setProfile(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  const refreshProfile = React.useCallback(async (): Promise<UserProfile | null> => {
    try {
      const wire = await apiClient.get<UserProfileWire>("/api/users/me");
      const next = profileFromWire(wire);
      setProfile(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  const updateProfile = React.useCallback(async (partial: Partial<UserProfile>): Promise<UserProfile | null> => {
    const wire = await apiClient.patch<UserProfileWire>("/api/users/me", profileToWirePatch(partial));
    const next = profileFromWire(wire);
    setProfile(next);
    return next;
  }, []);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      setFirebaseUser(user);
      setEmailVerified(!!user?.emailVerified);
      if (user) {
        await Promise.all([syncProfile(), refreshSubscriptionStatus()]);
      } else {
        setProfile(null);
        setSubscriptionStatus(null);
      }
      setLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = React.useCallback(async () => {
    await firebaseSignOut(firebaseAuth);
    setProfile(null);
    setSubscriptionStatus(null);
  }, []);

  // BUG FIX (product report: "You did not add delete account to the
  // profile screen in the web app") — DELETE /api/users/me already exists
  // and mobile has always called it (services/authService.ts's
  // deleteAccount), but web's AuthProvider never exposed an equivalent, so
  // there was nowhere in the UI to reach it. Same real endpoint, same
  // "server deletes the Firebase account too, then we just clear local
  // state" flow as mobile's AuthContext.deleteAccount (see that file's own
  // comment for why calling firebaseUser.delete() here would be wrong —
  // the account is already gone server-side by the time this resolves).
  const deleteAccount = React.useCallback(async () => {
    await apiClient.delete("/api/users/me");
    await firebaseSignOut(firebaseAuth);
    setProfile(null);
    setSubscriptionStatus(null);
  }, []);

  // BUG FIX (product report: "there is no email verification step in the
  // web app") — mobile has always sent a verification email right after
  // email/password signup (AuthContext.tsx's signUp -> emailService.
  // sendVerificationEmail) and shown a non-blocking "verify your email"
  // banner with a resend action until Firebase reports the link was
  // clicked (HomeSrc.tsx). Web never called the equivalent endpoint at
  // all, so a password-signup web user's email was simply never verified
  // and there was no UI anywhere hinting this mattered — even though the
  // backend's require_verified_email gate (Saveur-Backend/app/auth.py,
  // guards a couple of interview/practice routes) has been silently
  // rejecting them with 403 email_not_verified this whole time.
  //
  // Firebase only updates `currentUser.emailVerified` locally after an
  // explicit `reload()` — it doesn't push the change from tapping the
  // emailed link. Call this when the tab regains focus (see
  // components/shell/AppShell.tsx's visibilitychange listener) or from a
  // manual "I've verified — refresh" action.
  const refreshEmailVerified = React.useCallback(async (): Promise<boolean> => {
    const user = firebaseAuth.currentUser;
    if (!user) {
      setEmailVerified(false);
      return false;
    }
    await user.reload();
    const verified = !!firebaseAuth.currentUser?.emailVerified;
    setEmailVerified(verified);
    // `user.reload()` only updates `currentUser.emailVerified` locally; it
    // does NOT reissue the cached Firebase ID token. apiClient.ts's
    // authHeader() calls `user.getIdToken()` without forceRefresh, so every
    // backend call would keep sending the STALE token (still asserting
    // email_verified: false) until it naturally expires up to an hour
    // later — the backend's require_verified_email gate reads that claim,
    // not a fresh DB lookup, so it would keep 403ing right after a user
    // verifies. Force a fresh token now so the very next API call already
    // carries the updated claim.
    if (verified) {
      try {
        await user.getIdToken(true);
      } catch {
        // Best-effort — a failed forced refresh just means the natural
        // token expiry still catches up eventually.
      }
    }
    return verified;
  }, []);

  const resendVerificationEmail = React.useCallback(async () => {
    await apiClient.post("/api/v1/email/send-verification", {});
  }, []);

  const isPro = isProTier(subscriptionStatus);
  const isPremium = isPremiumTier(subscriptionStatus);

  const value = React.useMemo(
    () => ({
      firebaseUser,
      profile,
      loading,
      syncProfile,
      refreshProfile,
      updateProfile,
      signOut,
      deleteAccount,
      subscriptionStatus,
      isPro,
      isPremium,
      refreshSubscriptionStatus,
      emailVerified,
      refreshEmailVerified,
      resendVerificationEmail,
    }),
    [firebaseUser, profile, loading, syncProfile, refreshProfile, updateProfile, signOut, deleteAccount, subscriptionStatus, isPro, isPremium, refreshSubscriptionStatus, emailVerified, refreshEmailVerified, resendVerificationEmail]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return React.useContext(AuthContext);
}
