"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { LinkButton } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import * as billingService from "@/lib/billingService";

// Stripe Checkout success redirect for a one-time Add-on purchase (see
// app/addons/page.tsx's onPurchase — successUrl points here with
// `?session_id={CHECKOUT_SESSION_ID}` appended by Stripe, plus our own
// `addon` query param). Calls the same synchronous confirm-and-unlock
// endpoint mobile's AddOns.tsx calls right after presentPaymentSheet()
// resolves, instead of waiting out webhook latency to see the unlock
// reflect — mirrors app/subscription/success/page.tsx's role for
// subscriptions, but this one actually confirms rather than just
// reassuring, since the session_id needed to do that synchronously is
// available here. useSearchParams() requires a Suspense boundary in the
// app router (same pattern as app/auth/linkedin/callback/page.tsx).
function AddOnsSuccessInner() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"confirming" | "unlocked" | "pending" | "error">("confirming");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      setStatus("pending");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const result = await billingService.confirmAddonPurchase({ sessionId });
        if (cancelled) return;
        setStatus(result.unlocked ? "unlocked" : "pending");
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
        {status === "unlocked"
          ? t("web:addons.success.unlockedTitle", { defaultValue: "Add-on activated" })
          : status === "error"
          ? t("web:addons.success.errorTitle", { defaultValue: "Couldn't confirm purchase" })
          : t("web:addons.success.pendingTitle", { defaultValue: "Payment received" })}
      </h1>
      <p className="text-sm text-hint">
        {status === "unlocked"
          ? t("web:addons.success.unlockedBody", { defaultValue: "It's unlocked for good — head back to Add-ons or start practicing." })
          : status === "error"
          ? t("web:addons.success.errorBody", { defaultValue: "Your payment may still have gone through — check the Add-ons page in a moment, or contact support if it doesn't unlock." })
          : t("web:addons.success.pendingBody", { defaultValue: "Your payment went through, but it's taking a bit longer than usual to activate. Check back in a moment." })}
      </p>
      <LinkButton href="/addons">{t("web:addons.success.backToAddons", { defaultValue: "Back to Add-ons" })}</LinkButton>
    </div>
  );
}

function AddOnsSuccessFallback() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <span className="inline-flex h-9 w-9 animate-spin items-center justify-center rounded-full border-2 border-brand border-t-transparent" />
    </div>
  );
}

export default function AddOnsSuccessPage() {
  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={<AddOnsSuccessFallback />}>
          <AddOnsSuccessInner />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}
