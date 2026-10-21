"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, LinkButton } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCredits } from "@/app/providers/CreditsProvider";
import * as creditsService from "@/lib/creditsService";
import { actionLabel, type CreditTransaction } from "@/lib/creditsService";
import { formatPrice } from "@/lib/types";
import { getErrorMessage } from "@/lib/errors";

function CreditsInner() {
  const { t, i18n } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { credits, refresh } = useCredits();
  const [history, setHistory] = useState<CreditTransaction[] | null>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCosts, setShowCosts] = useState(false);

  const loadHistory = useCallback(() => {
    creditsService.getCreditHistory().then(setHistory).catch(() => setHistory([]));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Back from Stripe Checkout: confirm right away (webhook is the fallback).
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) return;
    creditsService
      .confirmPackPurchase(sessionId)
      .then(() => {
        setNotice(t("web:credits.purchased", { defaultValue: "Credits added to your account." }));
        refresh();
        loadHistory();
      })
      .catch(() => setNotice(t("web:credits.purchasePending", { defaultValue: "Payment received — your credits will appear in a moment." })))
      .finally(() => router.replace("/credits"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buy(code: string) {
    if (buying) return;
    setBuying(code);
    setError(null);
    try {
      const origin = window.location.origin;
      const url = await creditsService.createPackCheckout(code, `${origin}/credits?session_id={CHECKOUT_SESSION_ID}`, `${origin}/credits`);
      window.location.assign(url);
    } catch (e) {
      setError(getErrorMessage(e, t("web:credits.buyFailed", { defaultValue: "Couldn't start checkout. Please try again." })));
      setBuying(null);
    }
  }

  const resets = credits ? new Date(credits.resets_at).toLocaleDateString(i18n.language, { month: "long", day: "numeric" }) : "";
  const pct = credits && credits.allowance > 0 ? Math.min(100, Math.round((credits.monthly / credits.allowance) * 100)) : 0;
  const tierName = credits
    ? { free: t("web:credits.tierFree", { defaultValue: "Free" }), pro: "Saveur Basic", premium: "Saveur Premium" }[credits.tier]
    : "";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 pb-10">
      <PageHeader
        title={t("web:credits.title", { defaultValue: "AI credits" })}
        subtitle={t("web:credits.subtitle", { defaultValue: "Credits power every AI feature. Your plan refills each month, and you can top up any time." })}
      />

      {notice && <p className="rounded-card bg-tint-mint px-4 py-3 text-sm text-tint-mint-text">{notice}</p>}
      {error && <p className="rounded-card bg-tint-rose px-4 py-3 text-sm text-tint-rose-text">{error}</p>}

      {!credits ? (
        <Skeleton className="h-40" />
      ) : !credits.enabled ? (
        <p className="rounded-card border border-border bg-surface-2 p-5 text-sm text-hint">
          {t("web:credits.disabled", { defaultValue: "Credits are not in use right now." })}
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-5 rounded-card border border-border bg-surface-2 p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-hint">{t("web:credits.balance", { defaultValue: "Available credits" })}</p>
                <p className="text-5xl font-extrabold tracking-tight text-primary">{credits.total}</p>
              </div>
              <span className="rounded-pill bg-tint-blue px-3 py-1 text-xs font-bold text-tint-blue-text">{tierName}</span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-xs text-hint">
                <span>
                  {t("web:credits.monthlyLeft", { defaultValue: "{{left}} of {{total}} monthly credits left", left: credits.monthly, total: credits.allowance })}
                </span>
                <span>{t("web:credits.resetsOn", { defaultValue: "Resets {{date}}", date: resets })}</span>
              </div>
              {credits.topup > 0 && (
                <p className="text-xs text-hint">
                  {t("web:credits.topupLeft", { defaultValue: "+ {{count}} purchased credits (never expire)", count: credits.topup })}
                </p>
              )}
            </div>
            {credits.tier !== "premium" && (
              <LinkButton href="/subscription" variant="outline" size="sm" className="self-start">
                {t("web:credits.upgrade", { defaultValue: "Get more credits every month" })}
              </LinkButton>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-primary">{t("web:credits.topUp", { defaultValue: "Buy more credits" })}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {credits.packs.map((p) => (
                <div key={p.code} className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-5">
                  <div className="flex items-center gap-2">
                    <EvaIcon name="flash-outline" size={18} className="text-brand" />
                    <span className="text-2xl font-extrabold text-primary">{p.credits}</span>
                    <span className="text-sm text-hint">{t("web:credits.creditsWord", { defaultValue: "credits" })}</span>
                  </div>
                  <p className="text-sm text-hint">{formatPrice(p.amount, p.currency)}</p>
                  <Button size="sm" disabled={!!buying} onClick={() => buy(p.code)}>
                    {buying === p.code ? t("web:credits.redirecting", { defaultValue: "Redirecting…" }) : t("web:credits.buy", { defaultValue: "Buy" })}
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-hint">{t("web:credits.packNote", { defaultValue: "Purchased credits are used after your monthly credits and never expire." })}</p>
          </section>

          <section className="flex flex-col gap-3">
            <button type="button" onClick={() => setShowCosts((v) => !v)} className="flex items-center gap-2 self-start text-sm font-bold text-link">
              {t("web:credits.whatThingsCost", { defaultValue: "What things cost" })}
              <EvaIcon name={showCosts ? "chevron-up-outline" : "chevron-down-outline"} size={16} />
            </button>
            {showCosts && (
              <div className="grid grid-cols-1 gap-x-8 gap-y-1 rounded-card border border-border bg-surface-2 p-5 sm:grid-cols-2">
                {Object.entries(credits.costs)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-0">
                      <span className="text-primary">{actionLabel(t, k)}</span>
                      <span className="font-bold text-hint">{v}</span>
                    </div>
                  ))}
              </div>
            )}
          </section>
        </>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-bold text-primary">{t("web:credits.history", { defaultValue: "Recent activity" })}</h2>
        {history === null ? (
          <Skeleton className="h-24" />
        ) : history.length === 0 ? (
          <p className="text-sm text-hint">{t("web:credits.noHistory", { defaultValue: "No credit activity yet." })}</p>
        ) : (
          <ul className="flex flex-col rounded-card border border-border bg-surface-2">
            {history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-primary">
                    {h.kind === "monthly_grant"
                      ? t("web:credits.kindMonthly", { defaultValue: "Monthly credits" })
                      : h.kind === "topup"
                        ? t("web:credits.kindTopup", { defaultValue: "Credit purchase" })
                        : h.kind === "refund"
                          ? t("web:credits.kindRefund", { defaultValue: "Refund" }) + (h.action ? ` · ${actionLabel(t, h.action)}` : "")
                          : h.kind === "admin"
                            ? t("web:credits.kindAdmin", { defaultValue: "Adjustment" })
                            : actionLabel(t, h.action)}
                  </p>
                  <p className="text-xs text-hint">{new Date(h.created_at).toLocaleString(i18n.language, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                </div>
                <span className={`text-sm font-bold ${h.delta > 0 ? "text-success-text" : "text-primary"}`}>{h.delta > 0 ? `+${h.delta}` : h.delta}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function CreditsPage() {
  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={null}>
          <CreditsInner />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}
