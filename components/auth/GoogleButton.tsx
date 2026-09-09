"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { firebaseAuth, googleAuthProvider, isFirebaseConfigured } from "@/lib/firebase";
import { useAuth } from "@/app/providers/AuthProvider";
import { needsOnboarding } from "@/lib/types";
import { EvaIcon } from "@/components/icons/EvaIcon";

/** "Continue with Google" — the only OAuth provider Saveur's mobile app
 * supports, per AuthContext.tsx. Real Firebase popup sign-in; on success,
 * syncs the backend profile (POST /api/users/me) and routes to /onboarding
 * for a brand-new user or /dashboard for a returning one. */
export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  const router = useRouter();
  const { syncProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!isFirebaseConfigured) {
      setError("Firebase isn't configured yet — see README.md for the two values still needed.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(firebaseAuth, googleAuthProvider);
      const profile = await syncProfile();
      router.push(needsOnboarding(profile) ? "/onboarding" : "/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google sign-in failed. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-pill border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-surface-3 disabled:opacity-60"
      >
        <EvaIcon name="google-outline" size={16} />
        {loading ? "Signing in…" : label}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
