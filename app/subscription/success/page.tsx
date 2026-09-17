"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { LinkButton } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { useAuth } from "@/app/providers/AuthProvider";
import * as billingService from "@/lib/billingService";

// Stripe Checkout success redirect for a subscription purchase (see
// app/subscription/page.tsx's handleSubscribe — successUrl points here
// with `?session_id={CHECKOUT_SESSION_ID}` appended by Stripe).
//
// BUG FIX (product report: "I have subscribed for the saveur premium
// plan. But the AI career coach, emotional coach and many other features
// are still gated... Something is wrong somewhere"): this page used to
// just show a static "being confirmed" message and call NOTHING — the
// local Subscription row's plan/status was left entirely dependent on
// the async Stripe webhook actually reaching the backend, with no
// synchronous fallback the way mobile's payWithPaymentSheet() already
// had (pollForSubscriptionTier / /subscription/confirm). If that webhook
// is slow, misconfigured, or never fires for this deployment, a real,
// successfully-paying subscriber's plan simply never updates locally —
// every gated feature keeps reading them as free tier no matter how long
// they wait, which is exactly what was reported. Now calls
// billingService.confirmSubscription(session_id) — mirrors
// app/addons/success/page.tsx's already-correct pattern for add-ons —
// and refreshes AuthProvider's cached subscriptionStatus afterward so
// isPro/isPremium (and every gate reading them) flips immediately,
// without the user needing to reload or navigate away and back.
// useSearchParams() requires a Suspense boundary in the app router (same
// pattern as app/auth/linkedin/callback/page.tsx).
function SubscriptionSuccessInner() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const { refreshSubscriptionStatus } = useAuth();
  const [status, setStatus] = useState<"confirming" | "confirmed" | "pending" | "error">("confirming");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      // No session_id at all (e.g. someone navigated here directly) —
      // nothing to reconcile synchronously; fall back to whatever the
      // webhook eventually does, same as before this fix.
      setStatus("pending");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await billingService.confirmSubscription({ sessionId });
        if (cancelled) return;
        if (result.tier !== "free" && (result.status === "active" || result.status === "trialing")) {
          setStatus("confirmed");
        } else {
          setStatus("pending");
        }
        // Refresh the cached status regardless, so AuthProvider's
        // isPro/isPremium reflect reality even in the "pending" branch
        // above (e.g. Stripe reports a not-yet-active status).
        await refreshSubscriptionStatus();
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <span className={`inline-flex h-14 w-14 items-center justify-center rounded-full ${status === "error" ? "bg-tint-rose text-tint-rose-text" : "bg-tint-mint text-tint-mint-text"}`}>
        <EvaIcon name={status === "error" ? "alert-circle-outline" : "checkmark-circle-2-outline"} size={28} />
      </span>
      <h1 className="text-2xl font-bold text-primary">
        {status === "confirmed"
          ? t("web:subscription.success.confirmedTitle", { defaultValue: "You're all set" })
          : status === "error"
          ? t("web:subscription.success.errorTitle", { defaultValue: "Couldn't confirm subscription" })
          : t("web:subscription.success.title", { defaultValue: "You're all set" })}
      </h1>
      <p className="text-sm text-hint">
        {status === "confirmed"
          ? t("web:subscription.success.confirmedBody", { defaultValue: "Your plan is active — every feature it includes is unlocked now." })
          : status === "error"
          ? t("web:subscription.success.errorBody", { defaultValue: "Your payment may still have gone through — check the Subscription page in a moment, or contact support if features stay locked." })
          : t("web:subscription.success.description", {
              defaultValue: "Your subscription is being confirmed. It may take a moment to reflect everywhere in your account.",
            })}
      </p>
      <LinkButton href="/dashboard">{t("web:subscription.success.goToDashboard", { defaultValue: "Go to dashboard" })}</LinkButton>
      <Link href="/subscription" className="text-sm text-link hover:underline">
        {t("web:subscription.success.backToPlans", { defaultValue: "Back to plans" })}
      </Link>
    </div>
  );
}

function SubscriptionSuccessFallback() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <span className="inline-flex h-9 w-9 animate-spin items-center justify-center rounded-full border-2 border-brand border-t-transparent" />
    </div>
  );
}

export default function SubscriptionSuccessPage() {
  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={<SubscriptionSuccessFallback />}>
          <SubscriptionSuccessInner />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}
