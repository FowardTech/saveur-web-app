"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, LinkButton } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonCards } from "@/components/ui/Skeleton";
import * as billingService from "@/lib/billingService";
import { type AddonProps } from "@/lib/billingService";
import { formatPrice } from "@/lib/types";
import { getErrorMessage } from "@/lib/errors";

// Add-ons screen — one-time-purchase catalog (e.g. unlocking Coding
// Practice), independent of subscription tier. Ported from mobile's
// src/more/AddOns.tsx; mobile buys through the in-app Stripe PaymentSheet
// (or native IAP on iOS/Android), this uses the same hosted Checkout
// Session redirect the web app already uses for subscriptions (see
// app/subscription/page.tsx) — see lib/billingService.ts's
// createCheckoutSession addonCode option and Saveur-Backend's
// app/api/billing.py checkout()'s addon_code branch.
export default function AddOnsPage() {
  const { t } = useTranslation();
  const [addons, setAddons] = useState<AddonProps[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [purchasingCode, setPurchasingCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await billingService.listAddons();
      setAddons(data);
    } catch (err: unknown) {
      setLoadError(getErrorMessage(err, t("web:addons.loadFailedDefault", { defaultValue: "Could not load add-ons." })));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function onPurchase(addon: AddonProps) {
    if (purchasingCode) return;
    setPurchasingCode(addon.code);
    setActionError(null);
    try {
      const origin = window.location.origin;
      const url = await billingService.createCheckoutSession({
        addonCode: addon.code,
        successUrl: `${origin}/addons/success?addon=${encodeURIComponent(addon.code)}`,
        cancelUrl: `${origin}/addons`,
      });
      window.location.assign(url);
    } catch (err: unknown) {
      setActionError(getErrorMessage(err, t("web:addons.purchaseFailedDefault", { defaultValue: "Couldn't complete purchase. Please try again." })));
      setPurchasingCode(null);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:addons.title", { defaultValue: "Add-ons" })}
            subtitle={t("web:addons.subtitle", { defaultValue: "Unlock extra practice tools with a one-time purchase — pay once, keep it forever." })}
          />

          {addons === null && !loadError && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SkeletonCards count={4} />
            </div>
          )}

          {loadError && (
            <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface-2 p-6 text-center">
              <p className="text-sm text-danger">{loadError}</p>
              <Button variant="outline" size="sm" onClick={load}>
                {t("common:actions.tryAgain", { defaultValue: "Try again" })}
              </Button>
            </div>
          )}

          {actionError && <p className="text-sm text-danger">{actionError}</p>}

          {addons && addons.length === 0 && !loadError && (
            <p className="text-center text-sm text-hint">{t("web:addons.noneAvailable", { defaultValue: "No add-ons are available right now." })}</p>
          )}

          {addons && addons.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {addons.map((addon) => (
                <div key={addon.code} className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                      <EvaIcon name="pricetags-outline" size={18} />
                    </span>
                    {addon.unlocked ? (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-success-text/10 px-2.5 py-1 text-xs font-semibold text-success-text">
                        <EvaIcon name="checkmark-outline" size={12} />
                        {t("web:addons.unlocked", { defaultValue: "Unlocked" })}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-primary">{formatPrice(addon.amount, addon.currency)}</span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-primary">{addon.name}</h3>
                    {addon.description && <p className="mt-1 text-sm text-hint">{addon.description}</p>}
                  </div>
                  {!addon.unlocked ? (
                    <Button size="sm" disabled={purchasingCode === addon.code} onClick={() => onPurchase(addon)} className="mt-auto">
                      {purchasingCode === addon.code
                        ? t("web:addons.redirecting", { defaultValue: "Redirecting…" })
                        : t("web:addons.unlockCta", { defaultValue: "Unlock for {{price}}", price: formatPrice(addon.amount, addon.currency) })}
                    </Button>
                  ) : addon.code === "coding_practice" ? (
                    <LinkButton href="/practice/coding" size="sm" variant="outline" className="mt-auto">
                      {t("web:addons.practiceNow", { defaultValue: "Practice now" })}
                    </LinkButton>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
