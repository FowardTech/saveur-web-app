"use client";

import { AppShell } from "@/components/shell/AppShell";
import { LinkButton } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { useAuth } from "@/app/providers/AuthProvider";

/** Custom 404 — Next.js renders this in place of its bare default error
 * screen for any unmatched route. Uses AppShell so it stays visually
 * consistent with the rest of the app (sidebar/topbar for a signed-in user,
 * same page chrome for a signed-out one) rather than dropping to an
 * unstyled page. */
export default function NotFound() {
  const { firebaseUser, loading } = useAuth();
  const homeHref = !loading && firebaseUser ? "/dashboard" : "/";

  return (
    <AppShell>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
          <EvaIcon name="question-mark-circle-outline" size={28} />
        </span>
        <h1 className="text-2xl font-bold text-primary">Page not found</h1>
        <p className="text-sm text-hint">
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved. Let&rsquo;s get you back on track.
        </p>
        <LinkButton href={homeHref}>{firebaseUser ? "Go to dashboard" : "Go home"}</LinkButton>
      </div>
    </AppShell>
  );
}
