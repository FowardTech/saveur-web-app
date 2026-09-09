"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { useAuth } from "@/app/providers/AuthProvider";
import { createPortalSession } from "@/lib/billingService";
import type { ApiError } from "@/lib/apiClient";

// Reuses lib/billingService.ts's existing Stripe portal wiring (same
// POST /api/v1/billing/portal used by /subscription) — this page is the
// "Payment Method" settings entry point, /subscription stays the full
// plan-comparison page.
export default function PaymentSettingsPage() {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleManageBilling() {
    setBusy(true);
    setError(null);
    try {
      const url = await createPortalSession(`${window.location.origin}/settings/payment`);
      window.location.assign(url);
    } catch (err) {
      setError((err as ApiError).message || "Couldn't open the billing portal. Please try again.");
      setBusy(false);
    }
  }

  const isPaidSubscriber = profile?.subscriptionTier && profile.subscriptionTier !== "free";

  return (
    <AppShell>
      <div className="mx-auto flex max-w-xl flex-col gap-8 pb-10">
        <PageHeader title="Payment Method" subtitle="Manage your subscription and billing details." />

        <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
              <EvaIcon name="credit-card-outline" size={20} />
            </span>
            <div>
              <h2 className="font-semibold text-primary">
                {isPaidSubscriber ? `You're on the ${profile?.subscriptionTier} plan` : "You're on the free plan"}
              </h2>
              <p className="text-sm text-hint">Manage your payment method, invoices, and plan through Stripe's secure billing portal.</p>
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button onClick={handleManageBilling} disabled={busy} className="w-fit">
            {busy ? "Opening…" : "Manage billing"}
          </Button>
          <Link href="/subscription" className="text-sm text-link hover:underline">
            View plans &amp; pricing
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
