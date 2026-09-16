"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { useAuth } from "@/app/providers/AuthProvider";
import { getErrorMessage } from "@/lib/errors";

/**
 * Non-blocking "verify your email" banner — mirrors mobile's
 * HomeSrc.tsx (see AuthProvider.tsx's emailVerified/resendVerificationEmail
 * doc comments for the full "why").
 *
 * BUG FIX (product report: "there is no email verification step in the web
 * app"): mobile has always sent a verification email right after
 * email/password signup and shown this exact banner until Firebase reports
 * the link was clicked. Web never had either half — this is the second
 * half (see app/register/page.tsx for the send-on-signup half).
 *
 * Deliberately NOT a hard gate on the rest of the app — same reasoning as
 * mobile's own comment: most of this app has no action that strictly
 * requires a verified email, and a hard gate risks locking someone out
 * entirely if a verification email gets lost or delayed. Only ever shown
 * for an email/password account; Google/LinkedIn sign-ins are pre-verified.
 * Renders nothing while loading, signed out, or already verified.
 */
export function EmailVerificationBanner() {
  const { t } = useTranslation();
  const { firebaseUser, emailVerified, refreshEmailVerified, resendVerificationEmail } = useAuth();
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Firebase only learns the user tapped the emailed link after an explicit
  // reload — refresh whenever the tab regains focus (same idea as mobile's
  // AppState listener) so the banner clears itself without the user having
  // to do anything extra.
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

  if (!firebaseUser || emailVerified) return null;

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

  return (
    <div className="flex items-start gap-3 rounded-card border border-warning-text bg-surface-2 p-4">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint-orange text-tint-orange-text">
        <EvaIcon name="email-outline" size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-primary">
          {t("web:dashboard.verifyEmailTitle", { defaultValue: "Verify your email" })}
        </p>
        <p className="mt-0.5 text-sm text-hint">
          {sent
            ? t("web:dashboard.verifyEmailResent", { defaultValue: "Check your inbox for the verification link." })
            : t("web:dashboard.verifyEmailBody", { defaultValue: "We sent you a link — click it, then come back here." })}
        </p>
        {error && <p className="mt-1 text-xs font-medium text-danger">{error}</p>}
      </div>
      <button
        type="button"
        disabled={resending}
        onClick={onResend}
        className="shrink-0 rounded-full border border-warning-text px-3 py-1.5 text-xs font-semibold text-warning-text hover:bg-tint-orange disabled:opacity-50"
      >
        {resending
          ? t("web:dashboard.verifyEmailResending", { defaultValue: "Sending…" })
          : t("web:dashboard.verifyEmailResend", { defaultValue: "Resend" })}
      </button>
    </div>
  );
}

export default EmailVerificationBanner;
