"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useAuth } from "@/app/providers/AuthProvider";
import { createPortalSession } from "@/lib/billingService";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/billing.py
//   GET /api/v1/billing/payments -> {data: Payment[]} (most recent first)
// Mobile: src/more/PaymentHistory.tsx.
interface Payment {
  id: number;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  card_brand?: string;
  card_last4?: string;
  created_at: string;
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

// Reuses lib/billingService.ts's existing Stripe portal wiring (same
// POST /api/v1/billing/portal used by /subscription) — this page is the
// "Payment Method" settings entry point, /subscription stays the full
// plan-comparison page.
export default function PaymentSettingsPage() {
  const { t } = useTranslation();
  const { isPro, subscriptionStatus, loading: authLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);

  useEffect(() => {
    if (authLoading) return;
    (async () => {
      try {
        const data = await apiClient.get<{ data: Payment[] }>("/api/v1/billing/payments");
        setPayments(data.data);
      } catch {
        // Payment History is a nice-to-have list, not core billing
        // functionality — a failed fetch just leaves the section empty
        // rather than blocking the rest of this page.
        setPayments([]);
      }
    })();
  }, [authLoading]);

  async function handleManageBilling() {
    setBusy(true);
    setError(null);
    try {
      const url = await createPortalSession(`${window.location.origin}/settings/payment`);
      window.location.assign(url);
    } catch (err) {
      setError((err as ApiError).message || t("web:settings.payment.openPortalFailedDefault", { defaultValue: "Couldn't open the billing portal. Please try again." }));
      setBusy(false);
    }
  }

  // BUG FIX: was `profile?.subscriptionTier`, a field the backend never
  // actually sends (see lib/billingService.ts's header comment) — this line
  // always evaluated falsy for every real paid subscriber. `isPro` now
  // comes from the real GET /api/v1/billing/subscription-backed
  // AuthProvider state. Plan display name (not the raw tier code) mirrors
  // entitlements_service.py's own naming ("pro" -> Saveur Basic, everything
  // in PREMIUM_TIERS -> Saveur Premium).
  const isPaidSubscriber = isPro;
  const planDisplayName =
    subscriptionStatus?.tier === "pro"
      ? t("web:settings.payment.planNamePro", { defaultValue: "Saveur Basic" })
      : t("web:settings.payment.planNamePremium", { defaultValue: "Saveur Premium" });

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:settings.payment.title", { defaultValue: "Payment Method" })}
            subtitle={t("web:settings.payment.subtitle", { defaultValue: "Manage your subscription and billing details." })}
          />

          <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="credit-card-outline" size={20} />
              </span>
              <div>
                <h2 className="font-semibold text-primary">
                  {isPaidSubscriber
                    ? t("web:settings.payment.paidPlanLine", { defaultValue: "You're on the {{plan}} plan", plan: planDisplayName })
                    : t("web:settings.payment.freePlanLine", { defaultValue: "You're on the free plan" })}
                </h2>
                <p className="text-sm text-hint">
                  {t("web:settings.payment.description", {
                    defaultValue: "Manage your payment method, invoices, and plan through Stripe's secure billing portal.",
                  })}
                </p>
              </div>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button onClick={handleManageBilling} disabled={busy} className="w-fit">
              {busy ? t("web:settings.payment.opening", { defaultValue: "Opening…" }) : t("web:settings.payment.manageBilling", { defaultValue: "Manage billing" })}
            </Button>
            <Link href="/subscription" className="text-sm text-link hover:underline">
              {t("web:settings.payment.viewPlans", { defaultValue: "View plans & pricing" })}
            </Link>
          </div>

          {payments === null && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">
                {t("web:settings.payment.historyTitle", { defaultValue: "Payment history" })}
              </h2>
              <SkeletonRows count={3} />
            </div>
          )}

          {payments && payments.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">
                {t("web:settings.payment.historyTitle", { defaultValue: "Payment history" })}
              </h2>
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface-2 p-4">
                  <div>
                    <p className="font-medium text-primary">{p.description || t("web:settings.payment.paymentFallbackLabel", { defaultValue: "Payment" })}</p>
                    <p className="text-sm text-hint">
                      {new Date(p.created_at).toLocaleDateString()}
                      {p.card_brand && p.card_last4 ? ` · ${p.card_brand.toUpperCase()} •••• ${p.card_last4}` : ""}
                    </p>
                  </div>
                  <span className="font-semibold text-primary">{formatMoney(p.amount, p.currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
