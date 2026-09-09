"use client";

import React from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import apiClient from "@/lib/apiClient";
import { profileFromWire, profileToWirePatch, type UserProfile, type UserProfileWire } from "@/lib/types";

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
}

const AuthContext = React.createContext<AuthContextValue>({
  firebaseUser: null,
  profile: null,
  loading: true,
  syncProfile: async () => null,
  refreshProfile: async () => null,
  updateProfile: async () => null,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = React.useState<FirebaseUser | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);

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
        await syncProfile();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = React.useCallback(async () => {
    await firebaseSignOut(firebaseAuth);
    setProfile(null);
  }, []);

  const value = React.useMemo(
    () => ({ firebaseUser, profile, loading, syncProfile, refreshProfile, updateProfile, signOut }),
    [firebaseUser, profile, loading, syncProfile, refreshProfile, updateProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return React.useContext(AuthContext);
}
