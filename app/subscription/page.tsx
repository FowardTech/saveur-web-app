"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useAuth } from "@/app/providers/AuthProvider";
import { getPlans, createCheckoutSession, createPortalSession } from "@/lib/billingService";
import { formatPrice, type BillingPlan } from "@/lib/types";
import { getErrorMessage } from "@/lib/errors";

export default function SubscriptionPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { firebaseUser, isPro } = useAuth();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getPlans();
        if (!cancelled) setPlans(data);
      } catch {
        if (!cancelled) setPlansError(t("web:subscription.loadPlansFailedDefault", { defaultValue: "Couldn't load plans right now. Please try again in a moment." }));
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubscribe(plan: BillingPlan) {
    if (!firebaseUser) {
      router.push("/login");
      return;
    }
    if (!plan.code) return;
    setBusyCode(plan.code);
    setActionError(null);
    try {
      const origin = window.location.origin;
      const url = await createCheckoutSession({
        planCode: plan.code,
        successUrl: `${origin}/subscription/success`,
        cancelUrl: `${origin}/subscription`,
      });
      window.location.assign(url);
    } catch (err: unknown) {
      const message = getErrorMessage(err, t("web:subscription.checkoutFailedDefault", { defaultValue: "Couldn't start checkout. Please try again." }));
      setActionError(message);
      setBusyCode(null);
    }
  }

  async function handleManageBilling() {
    setBusyCode("__portal__");
    setActionError(null);
    try {
      const url = await createPortalSession(`${window.location.origin}/subscription`);
      window.location.assign(url);
    } catch (err: unknown) {
      const message = getErrorMessage(err, t("web:subscription.portalFailedDefault", { defaultValue: "Couldn't open the billing portal. Please try again." }));
      setActionError(message);
      setBusyCode(null);
    }
  }

  // BUG FIX: was `profile?.subscriptionTier` — a field the backend never
  // actually sends (see lib/billingService.ts's header comment), so this
  // banner never showed for any real paid subscriber. `isPro` now comes
  // from the real GET /api/v1/billing/subscription-backed AuthProvider
  // state; the plan NAME (not the raw tier code) comes from whichever
  // catalog entry the backend already flagged `is_current` on.
  const isPaidSubscriber = isPro;
  const currentPlanName = plans.find((p) => p.isCurrent)?.name;

  return (
    <AppShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-bold text-primary">{t("web:subscription.title", { defaultValue: "Plans built for every stage of your search" })}</h1>
          <p className="text-sm text-hint">
            {t("web:subscription.subtitle", { defaultValue: "Upgrade any time — cancel or switch plans whenever you need to." })}
          </p>
        </div>

        {isPaidSubscriber && (
          <div className="flex items-center justify-between rounded-card border border-border bg-surface-2 px-5 py-4">
            <div className="flex items-center gap-3">
              <EvaIcon name="credit-card-outline" size={18} className="text-brand" />
              <p className="text-sm text-primary">
                {t("web:subscription.currentPlanLine", { defaultValue: "You're currently on the {{plan}} plan.", plan: currentPlanName ?? t("web:subscription.paidPlanFallback", { defaultValue: "paid" }) })}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleManageBilling} disabled={busyCode === "__portal__"}>
              {busyCode === "__portal__"
                ? t("web:subscription.opening", { defaultValue: "Opening…" })
                : t("web:subscription.manageBilling", { defaultValue: "Manage billing" })}
            </Button>
          </div>
        )}

        {loadingPlans && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} className="h-64 p-6" />
            ))}
          </div>
        )}
        {plansError && <p className="text-center text-sm text-danger">{plansError}</p>}
        {actionError && <p className="text-center text-sm text-danger">{actionError}</p>}

        {!loadingPlans && !plansError && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`flex flex-col gap-4 rounded-card border p-6 ${
                  plan.recommended ? "border-brand shadow-md" : "border-border"
                } bg-surface-2`}
              >
                {plan.recommended && (
                  <span className="w-fit rounded-pill bg-brand px-3 py-1 text-xs font-semibold text-white">
                    {t("web:subscription.mostPopular", { defaultValue: "Most popular" })}
                  </span>
                )}
                <div>
                  <h3 className="text-lg font-bold text-primary">{plan.name}</h3>
                  <p className="mt-1 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-primary">{formatPrice(plan.amount, plan.currency)}</span>
                    {plan.interval && (
                      <span className="text-sm text-hint">
                        {plan.interval === "month"
                          ? t("web:subscription.perMonth", { defaultValue: "/mo" })
                          : t("web:subscription.perYear", { defaultValue: "/yr" })}
                      </span>
                    )}
                  </p>
                </div>
                <ul className="flex flex-1 flex-col gap-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-hint">
                      <EvaIcon name="checkmark-outline" size={14} className="mt-0.5 shrink-0 text-success-text" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.isCurrent ? (
                  <Button variant="secondary" disabled className="w-full">
                    {t("web:subscription.currentPlan", { defaultValue: "Current plan" })}
                  </Button>
                ) : plan.code ? (
                  <Button onClick={() => handleSubscribe(plan)} disabled={busyCode === plan.code} className="w-full">
                    {busyCode === plan.code
                      ? t("web:subscription.redirecting", { defaultValue: "Redirecting…" })
                      : t("web:subscription.subscribe", { defaultValue: "Subscribe" })}
                  </Button>
                ) : (
                  <Button variant="secondary" disabled className="w-full">
                    {t("web:subscription.free", { defaultValue: "Free" })}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {!loadingPlans && !plansError && plans.length === 0 && (
          <p className="text-center text-sm text-hint">{t("web:subscription.noPlansAvailable", { defaultValue: "Plans aren't available right now — check back soon." })}</p>
        )}
      </div>
    </AppShell>
  );
}
