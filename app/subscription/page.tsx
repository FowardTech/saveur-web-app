"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useAuth } from "@/app/providers/AuthProvider";
import { getPlans, createCheckoutSession, createPortalSession, validateCoupon, type CouponPreview } from "@/lib/billingService";
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
  // Product report: "The discount coupon created in the admin dashboard
  // should be applied in the checkout ... I am not seeing a discount part in
  // the stripe checkout." Admin coupons are our own Coupon rows (plan tier +
  // country eligibility), NOT Stripe promotion codes, so Stripe's hosted
  // "Add promotion code" box can't recognise them. The code is entered here
  // instead, previewed per plan via POST /billing/coupons/validate, and
  // passed to /billing/checkout as coupon_code, which attaches it as the
  // Checkout Session's discount.
  const [couponInput, setCouponInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [couponResults, setCouponResults] = useState<Record<string, CouponPreview>>({});
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  async function handleApplyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setApplyingCoupon(true);
    try {
      const entries = await Promise.all(
        plans.filter((p) => p.code).map(async (p) => [p.code as string, await validateCoupon(code, p.code as string)] as const)
      );
      setCouponResults(Object.fromEntries(entries));
      setAppliedCode(code);
    } finally {
      setApplyingCoupon(false);
    }
  }

  function handleClearCoupon() {
    setCouponInput("");
    setAppliedCode(null);
    setCouponResults({});
  }

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
        couponCode: appliedCode && couponResults[plan.code]?.valid ? appliedCode : undefined,
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

        {!loadingPlans && !plansError && plans.length > 0 && (
          <div className="mx-auto flex w-full max-w-md flex-col gap-2">
            <label className="text-sm font-medium text-primary" htmlFor="coupon-code">
              {t("web:subscription.couponLabel", { defaultValue: "Have a discount code?" })}
            </label>
            <div className="flex gap-2">
              <input
                id="coupon-code"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleApplyCoupon();
                }}
                placeholder={t("web:subscription.couponPlaceholder", { defaultValue: "Enter code" })}
                className="flex-1 rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm uppercase text-primary outline-none focus:border-brand"
              />
              {appliedCode ? (
                <Button variant="outline" size="sm" onClick={handleClearCoupon}>
                  {t("web:subscription.couponRemove", { defaultValue: "Remove" })}
                </Button>
              ) : (
                <Button size="sm" onClick={handleApplyCoupon} disabled={applyingCoupon || !couponInput.trim()}>
                  {applyingCoupon
                    ? t("web:subscription.couponApplying", { defaultValue: "Checking…" })
                    : t("web:subscription.couponApply", { defaultValue: "Apply" })}
                </Button>
              )}
            </div>
            {appliedCode && !Object.values(couponResults).some((r) => r.valid) && (
              <p className="text-sm text-danger">
                {Object.values(couponResults)[0]?.message ||
                  t("web:subscription.couponInvalid", { defaultValue: "That code isn't valid." })}
              </p>
            )}
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
                {plan.code && appliedCode && couponResults[plan.code]?.valid && (
                  <p className="mt-1 text-sm font-semibold text-success-text">
                    {couponResults[plan.code].percentOff
                      ? t("web:subscription.couponPercentApplied", {
                          defaultValue: "{{code}} applied: {{pct}}% off",
                          code: couponResults[plan.code].code,
                          pct: couponResults[plan.code].percentOff,
                        })
                      : t("web:subscription.couponAmountApplied", {
                          defaultValue: "{{code}} applied: {{amount}} off",
                          code: couponResults[plan.code].code,
                          amount: formatPrice(couponResults[plan.code].amountOff ?? 0, couponResults[plan.code].currency ?? plan.currency),
                        })}
                  </p>
                )}
                {plan.code && appliedCode && couponResults[plan.code] && !couponResults[plan.code].valid && (
                  <p className="mt-1 text-xs text-hint">{couponResults[plan.code].message}</p>
                )}
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
