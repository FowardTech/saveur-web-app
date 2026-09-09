"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/referrals.py
//   GET /api/v1/referrals/me -> {code, share_url, reward_amount_cents,
//     referred_count, pending_count, rewarded_count, credit_earned_cents}
interface ReferralInfo {
  code: string;
  share_url: string;
  reward_amount_cents: number;
  referred_count: number;
  pending_count: number;
  rewarded_count: number;
  credit_earned_cents: number;
}

export default function ReferralProgramPage() {
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient.get<ReferralInfo>("/api/v1/referrals/me");
        setInfo(data);
      } catch (err) {
        setError((err as ApiError).message || "Couldn't load your referral info.");
      }
    })();
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

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-xl flex-col gap-8 pb-10">
          <PageHeader title="Referral Program" subtitle="Share Saveur and earn rewards when your referrals subscribe." />

          {error && <p className="text-sm text-danger">{error}</p>}
          {!info && !error && <p className="text-sm text-hint">Loading…</p>}

          {info && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-card border border-border bg-surface-2 p-4">
                  <p className="text-xl font-bold text-primary">{info.referred_count}</p>
                  <p className="mt-1 text-xs text-hint">Referred</p>
                </div>
                <div className="rounded-card border border-border bg-surface-2 p-4">
                  <p className="text-xl font-bold text-primary">{info.pending_count}</p>
                  <p className="mt-1 text-xs text-hint">Pending</p>
                </div>
                <div className="rounded-card border border-border bg-surface-2 p-4">
                  <p className="text-xl font-bold text-primary">{info.rewarded_count}</p>
                  <p className="mt-1 text-xs text-hint">Rewarded</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-mint text-tint-mint-text">
                    <EvaIcon name="gift-outline" size={20} />
                  </span>
                  <div>
                    <h2 className="font-semibold text-primary">Your referral link</h2>
                    <p className="text-sm text-hint">Earn ${(info.reward_amount_cents / 100).toFixed(2)} credit per referral who subscribes.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-1 px-3.5 py-2.5">
                  <span className="flex-1 truncate text-sm text-primary">{info.share_url}</span>
                  <Button size="sm" variant="outline" onClick={handleCopy}>
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>

              <p className="text-sm text-hint">
                Total credit earned: <span className="font-medium text-primary">${(info.credit_earned_cents / 100).toFixed(2)}</span>
              </p>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
