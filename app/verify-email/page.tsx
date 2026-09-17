"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import { needsOnboarding } from "@/lib/types";
import { getErrorMessage } from "@/lib/errors";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";

/**
 * Hard gate: a password-signup account can't reach the dashboard (or any
 * other RequireAuth-wrapped page) until Firebase reports its email as
 * verified. Lands here instead — same real backend contract as the
 * previously non-blocking EmailVerificationBanner (resendVerificationEmail/
 * refreshEmailVerified, see AuthProvider.tsx's own doc comments), but now
 * an actual gate rather than a dismissible banner.
 *
 * BUG FIX (product report: "Why is the user allowed to enter the web app
 * dashboard when they have not verified their email? You need to fix that
 * now"): the banner approach (still shown on /dashboard for anyone who
 * lands there some other way) intentionally mirrored mobile's own
 * non-blocking design — but the product decision here is that web
 * specifically should block entry outright, so this page is the actual
 * enforcement point: RequireAuth.tsx and /dashboard's own redirect effect
 * both send an unverified password-account user here instead of onward.
 *
 * Never blocks a federated (Google/LinkedIn) sign-in -- emailVerified is
 * only ever false for a password account in the first place (those
 * providers assert a verified email at sign-in time), so redirecting here
 * is inherently scoped the same way the backend's own
 * require_verified_email decorator already is.
 */
export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { firebaseUser, profile, loading, emailVerified, refreshEmailVerified, resendVerificationEmail, signOut } = useAuth();
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notYet, setNotYet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
    } else if (needsOnboarding(profile)) {
      router.replace("/onboarding");
    } else if (emailVerified) {
      router.replace("/dashboard");
    }
  }, [loading, firebaseUser, profile, emailVerified, router]);

  // Same "tab regains focus -> re-check" convenience the old banner had —
  // clicking the emailed link opens in a new tab, so coming back to this
  // one should notice without the user having to click anything.
  useEffect(() => {
    if (!firebaseUser || emailVerified) return;
    function onVisible() {
      if (document.visibilityState === "visible") {
        void refreshEmailVerified();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [firebaseUser, emailVerified, refreshEmailVerified]);

  if (loading || !firebaseUser || needsOnboarding(profile) || emailVerified) {
    return (
      <AuthLayout title={t("web:verifyEmail.title", { defaultValue: "Verify your email" })} subtitle="" footer={null}>
        <div className="flex h-32 items-center justify-center text-sm text-hint">
          {t("web:requireAuth.loading", { defaultValue: "Loading…" })}
        </div>
      </AuthLayout>
    );
  }

  async function onResend() {
    if (resending) return;
    setResending(true);
    setError(null);
    try {
      await resendVerificationEmail();
      setSent(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("web:dashboard.verifyEmailResendFailedDefault", { defaultValue: "Couldn't send that. Please try again in a moment." })));
    } finally {
      setResending(false);
    }
  }

  async function onCheckVerified() {
    if (checking) return;
    setChecking(true);
    setError(null);
    setNotYet(false);
    try {
      const verified = await refreshEmailVerified();
      if (verified) {
        router.replace("/dashboard");
      } else {
        setNotYet(true);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("web:verifyEmail.checkFailedDefault", { defaultValue: "Couldn't check right now. Please try again in a moment." })));
    } finally {
      setChecking(false);
    }
  }

  return (
    <AuthLayout
      title={t("web:verifyEmail.title", { defaultValue: "Verify your email" })}
      subtitle={t("web:verifyEmail.subtitle", {
        defaultValue: "We sent a verification link to {{email}}. Click it, then come back here to continue.",
        email: firebaseUser.email ?? "",
      })}
      footer={null}
    >
      <div className="flex flex-col gap-4">
        {sent && (
          <p className="rounded-card border border-success-text/30 bg-success-text/10 px-3 py-2 text-sm text-success-text">
            {t("web:dashboard.verifyEmailResent", { defaultValue: "Check your inbox for the verification link." })}
          </p>
        )}
        {notYet && (
          <p className="rounded-card border border-warning-text/30 bg-warning-text/10 px-3 py-2 text-sm text-warning-text">
            {t("web:verifyEmail.notYetVerified", { defaultValue: "Still not verified — check your inbox (and spam folder), click the link, then try again." })}
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}

        <Button onClick={onCheckVerified} disabled={checking} className="w-full">
          {checking
            ? t("web:verifyEmail.checking", { defaultValue: "Checking…" })
            : t("web:verifyEmail.iveVerified", { defaultValue: "I've verified — continue" })}
        </Button>
        <Button variant="outline" onClick={onResend} disabled={resending} className="w-full">
          {resending
            ? t("web:dashboard.verifyEmailResending", { defaultValue: "Sending…" })
            : t("web:dashboard.verifyEmailResend", { defaultValue: "Resend verification email" })}
        </Button>

        <button
          type="button"
          onClick={() => {
            void signOut();
            router.replace("/login");
          }}
          className="mt-2 text-center text-xs font-medium text-hint hover:underline"
        >
          {t("web:verifyEmail.useDifferentAccount", { defaultValue: "Sign in with a different account" })}
        </button>
      </div>
    </AuthLayout>
  );
}
