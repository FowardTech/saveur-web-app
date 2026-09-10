"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/app/providers/AuthProvider";
import * as gamificationService from "@/lib/gamificationService";
import type { GamificationStreak, LeaderboardEntry, LeaderboardPeriod } from "@/lib/gamificationService";
import type { ApiError } from "@/lib/apiClient";

// Web port of Saveur/src/home/Leaderboard.tsx — "Your standing" (streak/XP
// ring + Check-In button), Daily/Weekly/Monthly period tabs, top-3 podium,
// and the ranked list below it. Reachable from app/progress/page.tsx's
// leaderboard preview "View all" link (mirrors mobile's MyProgress.tsx ->
// Leaderboard navigation).
//
// Deliberately NOT ported: the Badges modal/button (components/BadgesModal.tsx
// + gamificationService.getUnlockedBadgeIds's client-computed unlock rules,
// which cross-reference practice history, resume imports, and networking
// contacts). That's a self-contained catalog/UI sub-feature, not part of the
// streak/leaderboard data contract this page is about — left as a follow-up
// rather than a partial/half-ported badges grid.

const PERIODS: { key: LeaderboardPeriod; labelKey: string; defaultValue: string }[] = [
  { key: "daily", labelKey: "web:progress.leaderboardPage.periodDaily", defaultValue: "Daily" },
  { key: "weekly", labelKey: "web:progress.leaderboardPage.periodWeekly", defaultValue: "Weekly" },
  { key: "monthly", labelKey: "web:progress.leaderboardPage.periodMonthly", defaultValue: "Monthly" },
];

const PODIUM_ORDER: Array<1 | 2 | 3> = [2, 1, 3];
const PODIUM_STYLE: Record<1 | 2 | 3, { border: string; badgeBg: string }> = {
  1: { border: "border-tint-mint-text", badgeBg: "bg-tint-mint-text" },
  2: { border: "border-brand", badgeBg: "bg-brand" },
  3: { border: "border-tint-orange-text", badgeBg: "bg-tint-orange-text" },
};

function ChangeBadge({ changePct, t }: { changePct: number | null; t: (k: string, o?: Record<string, unknown>) => string }) {
  if (changePct == null) {
    return <span className="mt-1.5 text-xs font-bold text-primary">{t("web:progress.leaderboardPage.new", { defaultValue: "New" })}</span>;
  }
  const isUp = changePct >= 0;
  return (
    <span className={`mt-1.5 inline-flex items-center gap-0.5 text-xs font-bold ${isUp ? "text-success" : "text-danger"}`}>
      <EvaIcon name="trending-up-outline" size={12} className={isUp ? "" : "rotate-180"} />
      {isUp ? "+" : ""}
      {changePct}%
    </span>
  );
}

function LeaderboardPageInner() {
  const { t } = useTranslation();
  const { firebaseUser, loading: authLoading } = useAuth();

  const [streak, setStreak] = useState<GamificationStreak | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  const [period, setPeriod] = useState<LeaderboardPeriod>("daily");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    gamificationService.getStreak().then(setStreak).catch(() => {
      // Non-critical — "Your standing" just stays hidden on a failed fetch.
    });
  }, [authLoading]);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await gamificationService.getLeaderboard(period, firebaseUser?.uid);
      setLeaderboard(data);
    } catch (err) {
      setLoadError((err as ApiError).message || t("web:progress.leaderboardLoadFailedDefault", { defaultValue: "Could not load the leaderboard." }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, period, firebaseUser?.uid]);

  async function onCheckIn() {
    if (checkingIn || !streak || streak.checkedInToday) return;
    setCheckingIn(true);
    setCheckInError(null);
    try {
      setStreak(await gamificationService.checkin());
    } catch (err) {
      setCheckInError((err as ApiError).message || t("web:progress.leaderboardPage.checkInFailed", { defaultValue: "Couldn't check in — please try again in a moment." }));
    } finally {
      setCheckingIn(false);
    }
  }

  const currentUserRank = leaderboard?.find((e) => e.isCurrentUser)?.rank ?? null;
  const top3 = (leaderboard ?? []).slice(0, 3);
  const rest = (leaderboard ?? []).slice(3);
  const podiumEntry = (rank: 1 | 2 | 3) => top3[rank - 1];

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
          <div className="flex items-center justify-between gap-3">
            <PageHeader
              title={t("web:progress.leaderboardPage.title", { defaultValue: "Leaderboard" })}
              subtitle={t("web:progress.leaderboardPage.subtitle", { defaultValue: "See how your XP stacks up against the Saveur community." })}
            />
            <Link href="/progress" className="shrink-0 text-sm font-semibold text-link">
              {t("web:progress.leaderboardPage.backToProgress", { defaultValue: "My Progress" })}
            </Link>
          </div>

          {/* "Your standing" */}
          {streak && (
            <div className="rounded-card border border-border bg-surface-2 p-4">
              <div className="flex items-center gap-3">
                <CircularProgress progress={Math.min(100, (streak.streakDays / 7) * 100)} size={60} strokeWidth={6}>
                  <span className="text-sm font-bold text-primary">{streak.streakDays}</span>
                </CircularProgress>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-primary">{t("web:progress.leaderboardPage.yourStanding", { defaultValue: "Your standing" })}</p>
                  <p className="mt-0.5 text-sm text-hint">
                    {t("web:progress.leaderboardPage.yourStatsLine", { defaultValue: "{{xp}} XP · {{days}}-day streak", xp: streak.xp, days: streak.streakDays })}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-brand/10 px-3 py-1.5 text-sm font-bold text-brand">
                  <EvaIcon name="star-outline" size={14} />
                  {currentUserRank ? `#${currentUserRank}` : t("web:progress.leaderboardPage.unranked", { defaultValue: "Unranked" })}
                </span>
              </div>
              <div className="mt-3.5">
                {streak.checkedInToday ? (
                  <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-3 px-4 py-2 text-sm font-bold text-primary">
                    <EvaIcon name="checkmark-circle-2-outline" size={15} />
                    {t("web:progress.leaderboardPage.checkedInToday", { defaultValue: "Checked in" })}
                  </span>
                ) : (
                  <Button size="sm" variant="secondary" onClick={onCheckIn} disabled={checkingIn}>
                    {checkingIn ? t("common:actions.loading", { defaultValue: "Loading…" }) : t("web:progress.leaderboardPage.checkIn", { defaultValue: "Check In" })}
                  </Button>
                )}
                {checkInError && <p className="mt-2 text-xs text-danger">{checkInError}</p>}
              </div>
            </div>
          )}

          {/* Period tabs */}
          <div className="flex gap-1 rounded-pill bg-surface-3 p-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={`flex-1 rounded-pill py-2 text-sm font-bold transition ${period === p.key ? "bg-brand text-white" : "text-hint hover:text-primary"}`}
              >
                {t(p.labelKey, { defaultValue: p.defaultValue })}
              </button>
            ))}
          </div>

          {isLoading && <SkeletonRows count={4} />}
          {loadError && !isLoading && <p className="text-sm text-danger">{loadError}</p>}

          {!isLoading && !loadError && leaderboard && leaderboard.length === 0 && (
            <p className="rounded-card border border-border bg-surface-2 p-6 text-center text-sm text-hint">
              {t("web:progress.leaderboardEmpty", { defaultValue: "No leaderboard data yet." })}
            </p>
          )}

          {!isLoading && !loadError && leaderboard && leaderboard.length > 0 && (
            <>
              {/* Top-3 podium */}
              <div className="flex items-end gap-3">
                {PODIUM_ORDER.map((rank) => {
                  const entry = podiumEntry(rank);
                  const style = PODIUM_STYLE[rank];
                  if (!entry) return <div key={rank} className="flex-1" />;
                  return (
                    <div
                      key={rank}
                      className={`relative flex flex-1 flex-col items-center rounded-card border-2 bg-surface-2 px-2 pb-4 pt-5 ${style.border}`}
                      style={{ minHeight: rank === 1 ? 210 : 180 }}
                    >
                      <span className={`absolute left-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${style.badgeBg}`}>{rank}</span>
                      <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-brand/10 text-base font-bold text-brand shadow-sm">
                        {entry.name?.[0]?.toUpperCase() ?? "?"}
                      </span>
                      <span className="mt-2.5 max-w-full truncate text-center text-sm font-bold text-primary">
                        {entry.name}
                        {entry.isCurrentUser ? ` (${t("web:progress.you", { defaultValue: "You" })})` : ""}
                      </span>
                      <span className={`mt-2 inline-flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-bold text-white ${style.badgeBg}`}>
                        <EvaIcon name="star-outline" size={12} />
                        {entry.xp}
                      </span>
                      <ChangeBadge changePct={entry.changePct} t={t} />
                    </div>
                  );
                })}
              </div>

              {rest.length > 0 && (
                <div className="flex flex-col gap-1">
                  <h3 className="mb-1 text-sm font-bold text-primary">{t("web:progress.leaderboardPage.moreRankings", { defaultValue: "More Rankings" })}</h3>
                  <div className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface-2">
                    {rest.map((entry) => (
                      <div key={entry.id} className={`flex items-center gap-3 p-3 ${entry.isCurrentUser ? "bg-brand/5" : ""}`}>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-hint">{entry.rank}</span>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                          {entry.name?.[0]?.toUpperCase() ?? "?"}
                        </span>
                        <span className="flex-1 truncate text-sm font-semibold text-primary">
                          {entry.name}
                          {entry.isCurrentUser ? ` (${t("web:progress.you", { defaultValue: "You" })})` : ""}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-pill bg-surface-3 px-2.5 py-1 text-xs font-bold text-primary">
                          <EvaIcon name="star-outline" size={11} />
                          {entry.xp}
                        </span>
                        <ChangeBadge changePct={entry.changePct} t={t} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}

export default function LeaderboardPage() {
  return <LeaderboardPageInner />;
}
