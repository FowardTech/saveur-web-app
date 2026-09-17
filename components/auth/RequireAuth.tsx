"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { useAuth } from "@/app/providers/AuthProvider";
import { needsOnboarding } from "@/lib/types";

/** Wraps a feature page's content and gates it behind sign-in, mirroring
 * /dashboard's original inline auth check (see app/dashboard/page.tsx).
 * Anonymous visitors are redirected to /login and signed-in users who
 * haven't finished onboarding are redirected to /onboarding — in both
 * cases `children` never mounts, so no feature UI or data fetching kicks
 * off before the redirect lands.
 *
 * Usage: wrap the page's existing `<AppShell>...</AppShell>` return value
 * in `<RequireAuth>`, e.g. `return <RequireAuth><AppShell>...</AppShell></RequireAuth>`.
 * Do not put `<RequireAuth>` *inside* `<AppShell>` — this component renders
 * its own `<AppShell>` for the loading/redirect state, so nesting the other
 * way would double up the sidebar/topbar. */
export function RequireAuth({ children, label }: { children: React.ReactNode; label?: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { firebaseUser, profile, loading, emailVerified } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
    } else if (needsOnboarding(profile)) {
      router.replace("/onboarding");
    } else if (!emailVerified) {
      // BUG FIX (product report: "Why is the user allowed to enter the web
      // app dashboard when they have not verified their email? You need
      // to fix that now") -- every RequireAuth-wrapped feature page now
      // gates the same way /dashboard's own inline check does (see that
      // page's identical effect) -- see app/verify-email/page.tsx's own
      // header comment for the full "why". emailVerified is only ever
      // false for a password-signup account (Google/LinkedIn always
      // report verified), so this never touches a federated sign-in.
      router.replace("/verify-email");
    }
  }, [loading, firebaseUser, profile, emailVerified, router]);

  if (loading || !firebaseUser) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center text-sm text-hint">
          {label ?? t("web:requireAuth.loading", { defaultValue: "Loading…" })}
        </div>
      </AppShell>
    );
  }

  return <>{children}</>;
}
