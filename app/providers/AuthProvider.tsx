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
}

const AuthContext = React.createContext<AuthContextValue>({
  firebaseUser: null,
  profile: null,
  loading: true,
  syncProfile: async () => null,
  refreshProfile: async () => null,
  updateProfile: async () => null,
  signOut: async () => {},
  subscriptionStatus: null,
  isPro: false,
  isPremium: false,
  refreshSubscriptionStatus: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = React.useState<FirebaseUser | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = React.useState<SubscriptionStatus | null>(null);

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
      subscriptionStatus,
      isPro,
      isPremium,
      refreshSubscriptionStatus,
    }),
    [firebaseUser, profile, loading, syncProfile, refreshProfile, updateProfile, signOut, subscriptionStatus, isPro, isPremium, refreshSubscriptionStatus]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return React.useContext(AuthContext);
}
