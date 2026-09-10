"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/referrals.py
//   GET  /api/v1/referrals/me     -> {code, share_url, reward_amount_cents,
//     referred_count, pending_count, rewarded_count, credit_earned_cents,
//     billing_provider, bonus_pro_until}
//   POST /api/v1/referrals/redeem -> {code} -> {ok, referral?} | {ok: false, reason}
interface ReferralInfo {
  code: string;
  share_url: string;
  reward_amount_cents: number;
  referred_count: number;
  pending_count: number;
  rewarded_count: number;
  credit_earned_cents: number;
  billing_provider?: string | null;
  bonus_pro_until?: string | null;
}

export default function ReferralProgramPage() {
  const { t } = useTranslation();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    try {
      const data = await apiClient.get<ReferralInfo>("/api/v1/referrals/me");
      setInfo(data);
    } catch (err) {
      setError((err as ApiError).message || t("web:referral.loadFailedDefault", { defaultValue: "Couldn't load your referral info." }));
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCopy() {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — no-op
    }
  }

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    const code = redeemCode.trim();
    if (!code || redeeming) return;
    setRedeeming(true);
    setRedeemMessage(null);
    try {
      const data = await apiClient.post<{ ok: boolean }>("/api/v1/referrals/redeem", { code });
      if (data.ok) {
        setRedeemMessage({ ok: true, text: t("web:referral.codeAppliedBody", { defaultValue: "This referral has been recorded." }) });
        setRedeemCode("");
        load();
      } else {
        setRedeemMessage({
          ok: false,
          text: t("web:referral.codeFailedBody", { defaultValue: "It may be invalid, your own code, or you've already been referred." }),
        });
      }
    } catch (err) {
      setRedeemMessage({ ok: false, text: (err as ApiError).message || t("web:referral.codeFailedBody", { defaultValue: "It may be invalid, your own code, or you've already been referred." }) });
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:referral.title", { defaultValue: "Referral Program" })}
            subtitle={t("web:referral.subtitle", { defaultValue: "Share Saveur and earn rewards when your referrals subscribe." })}
          />

          {error && <p className="text-sm text-danger">{error}</p>}
          {!info && !error && <p className="text-sm text-hint">{t("common:actions.loading", { defaultValue: "Loading…" })}</p>}

          {info && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-card border border-border bg-surface-2 p-4">
                  <p className="text-xl font-bold text-primary">{info.referred_count}</p>
                  <p className="mt-1 text-xs text-hint">{t("web:referral.referred", { defaultValue: "Referred" })}</p>
                </div>
                <div className="rounded-card border border-border bg-surface-2 p-4">
                  <p className="text-xl font-bold text-primary">{info.pending_count}</p>
                  <p className="mt-1 text-xs text-hint">{t("web:referral.pending", { defaultValue: "Pending" })}</p>
                </div>
                <div className="rounded-card border border-border bg-surface-2 p-4">
                  <p className="text-xl font-bold text-primary">{info.rewarded_count}</p>
                  <p className="mt-1 text-xs text-hint">{t("web:referral.rewarded", { defaultValue: "Rewarded" })}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-mint text-tint-mint-text">
                    <EvaIcon name="gift-outline" size={20} />
                  </span>
                  <div>
                    <h2 className="font-semibold text-primary">{t("web:referral.yourReferralLink", { defaultValue: "Your referral link" })}</h2>
                    <p className="text-sm text-hint">
                      {t("web:referral.earnCreditPerReferral", {
                        defaultValue: "Earn {{amount}} credit per referral who subscribes.",
                        amount: `$${(info.reward_amount_cents / 100).toFixed(2)}`,
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-1 px-3.5 py-2.5">
                  <span className="flex-1 truncate text-sm text-primary">{info.share_url}</span>
                  <Button size="sm" variant="outline" onClick={handleCopy}>
                    {copied ? t("web:referral.copied", { defaultValue: "Copied!" }) : t("web:referral.copy", { defaultValue: "Copy" })}
                  </Button>
                </div>
              </div>

              {info.credit_earned_cents > 0 && (
                <div className="rounded-card border border-border bg-tint-mint/40 p-4">
                  <p className="text-sm font-semibold text-tint-mint-text">
                    {t("web:referral.totalCreditEarned", {
                      defaultValue: "Total credit earned: {{amount}}",
                      amount: `$${(info.credit_earned_cents / 100).toFixed(2)}`,
                    })}
                  </p>
                  {/* Which of these three applies depends entirely on
                      billing_provider (Stripe/web vs Apple/Google IAP) —
                      there's no Saveur "invoice" to credit for an IAP
                      subscriber, so that copy would be actively wrong for
                      them. Mirrors mobile ReferralProgram.tsx's own
                      billingProvider/bonusProUntil branch exactly. */}
                  <p className="mt-1 text-xs text-hint">
                    {info.billing_provider === "apple" || info.billing_provider === "google"
                      ? info.bonus_pro_until
                        ? t("web:referral.creditBonusDays", {
                            defaultValue: "Applied as free Saveur Basic access through {{date}}.",
                            date: new Date(info.bonus_pro_until).toLocaleDateString(),
                          })
                        : t("web:referral.creditBonusDaysGeneric", {
                            defaultValue: "Applied as free Saveur Basic access days, on top of your App Store/Play Store subscription.",
                          })
                      : t("web:referral.creditAutoApplied", { defaultValue: "Automatically applied to your next Saveur invoice." })}
                  </p>
                </div>
              )}

              <form onSubmit={handleRedeem} className="flex flex-col gap-2 rounded-card border border-border bg-surface-2 p-5">
                <h2 className="font-semibold text-primary">{t("web:referral.haveCode", { defaultValue: "Have a code from a friend?" })}</h2>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={redeemCode}
                    onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                    placeholder={t("web:referral.codePlaceholder", { defaultValue: "Enter referral code" })}
                    className="flex-1 rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                  <Button type="submit" variant="outline" size="md" disabled={!redeemCode.trim() || redeeming}>
                    {redeeming ? "…" : t("web:referral.apply", { defaultValue: "Apply" })}
                  </Button>
                </div>
                {redeemMessage && (
                  <p className={`text-sm ${redeemMessage.ok ? "text-brand" : "text-danger"}`}>{redeemMessage.text}</p>
                )}
              </form>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
