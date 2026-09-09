"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/app/providers/AuthProvider";
import { needsOnboarding } from "@/lib/types";
import { AppShell } from "@/components/shell/AppShell";
import { EvaIcon } from "@/components/icons/EvaIcon";

/** Lands here after Saveur-Backend's /api/v1/auth/linkedin/callback 302s the
 * browser back with either ?token=&is_new_user= (success) or ?error=
 * (failure) — see linkedin_auth.py's _app_redirect() for the "web" branch.
 * This page only flashes briefly in the normal redirect chain. */
function LinkedInCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { syncProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const errorParam = searchParams.get("error");
    const token = searchParams.get("token");

    if (errorParam) {
      setError(errorParam);
      return;
    }

    if (!token) {
      setError("missing_token");
      return;
    }

    (async () => {
      try {
        await signInWithCustomToken(firebaseAuth, token);
        const profile = await syncProfile();
        router.replace(needsOnboarding(profile) ? "/onboarding" : "/dashboard");
      } catch {
        setError("sign_in_failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (error) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
          <EvaIcon name="close-circle-outline" size={28} />
        </span>
        <h1 className="text-xl font-bold text-primary">LinkedIn sign-in failed</h1>
        <p className="text-sm text-hint">Error code: {error}</p>
        <Link href="/login" className="text-sm font-medium text-link hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <span className="inline-flex h-9 w-9 animate-spin items-center justify-center rounded-full border-2 border-brand border-t-transparent" />
      <p className="text-sm text-hint">Finishing LinkedIn sign-in…</p>
    </div>
  );
}

export default function LinkedInCallbackPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
            <span className="inline-flex h-9 w-9 animate-spin items-center justify-center rounded-full border-2 border-brand border-t-transparent" />
            <p className="text-sm text-hint">Finishing LinkedIn sign-in…</p>
          </div>
        }
      >
        <LinkedInCallbackInner />
      </Suspense>
    </AppShell>
  );
}
