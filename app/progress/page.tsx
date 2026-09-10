"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";
import apiClient, { type ApiError } from "@/lib/apiClient";
import { useAuth } from "@/app/providers/AuthProvider";
import { getCareerGoalLabel } from "@/lib/careerGoalLabels";
import * as gamificationService from "@/lib/gamificationService";
import type { DailyChallenge, GamificationStreak, LeaderboardEntry } from "@/lib/gamificationService";

// Web port of Saveur/src/practice/MyProgress.tsx (Overview/Skills/History
// tabs — goal + roadmap progress, 3 stat tiles, weekly bar chart, leaderboard
// preview) — see that file's own header comment for the "what used to live
// here and moved out" history (streak/XP/check-in -> src/home/Leaderboard.tsx
// "Your standing" card, now app/progress/leaderboard/page.tsx; Continue
// Learning -> src/home/HomeSrc.tsx, dropped from Home entirely in the later
// SYMPHONY REDESIGN and never replaced — nothing to port). The Daily
// Challenge card below is the one addition beyond mobile's current
// MyProgress.tsx: mobile now surfaces it on Home's "Today's Mission" hero
// instead (missionHero's priority chain), but web's /dashboard doesn't have
// an equivalent hero yet, so this remains the one reachable gamification
// surface for it on web today.
//
// Real backend contracts:
//   GET /api/v1/interviews/sessions -> Session[] (Saveur-Backend/app/api/interviews.py)
//   GET /api/v1/roadmap -> {roadmap: Roadmap | null} (Saveur-Backend/app/api/career_roadmap.py)
//   GET /api/v1/gamification/streak, /leaderboard (lib/gamificationService.ts)
//   GET /api/v1/daily-challenge/today (lib/gamificationService.ts)
//   GET /api/v1/feedback/heatmap -> {session_count, dimensions[]}

interface Session {
  id: number;
  type: string;
  status: string;
  started_at: string;
  overall_score?: number | null;
}

interface RoadmapStep {
  order: number;
  title: string;
  status: "completed" | "current" | "locked" | string;
}

interface Roadmap {
  target_role: string;
  steps: RoadmapStep[];
  completed_count: number;
  total_count: number;
  is_complete: boolean;
}

interface HeatMapDimension {
  key: string;
  label: string;
  score: number;
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Mon-first weekly practice bucket, mirrors mobile's
 * interviewService.computeWeeklyPractice — counts completed sessions whose
 * started_at falls within the current Mon-Sun calendar week. */
function computeWeeklyPractice(completed: Session[]): number[] {
  const now = new Date();
  const todayMonFirst = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - todayMonFirst);
  const counts = new Array(7).fill(0);
  for (const s of completed) {
    const d = new Date(s.started_at);
    const diffDays = Math.floor((d.getTime() - monday.getTime()) / 86400000);
    if (diffDays >= 0 && diffDays < 7) counts[diffDays] += 1;
  }
  return counts;
}

function fallbackTypeLabel(type: string) {
  return type
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function ProgressPageInner() {
  const { t, i18n } = useTranslation();
  const { profile, firebaseUser, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<"overview" | "skills" | "history">("overview");

  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [streak, setStreak] = useState<GamificationStreak | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const [heatMap, setHeatMap] = useState<HeatMapDimension[] | null>(null);
  const [heatMapSessionCount, setHeatMapSessionCount] = useState(0);
  const [heatMapLoading, setHeatMapLoading] = useState(true);

  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(true);
  const [response, setResponse] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [sessionsResult, streakResult, roadmapResult] = await Promise.all([
        apiClient.get<Session[]>("/api/v1/interviews/sessions"),
        gamificationService.getStreak().catch(() => null),
        // .catch(() => null) — GET /api/v1/roadmap 402s for a non-Premium
        // user (see career_roadmap.py's @require_premium); without this a
        // free user's failed roadmap fetch would fail the whole Promise.all
        // and break sessions/streak too. Same fallback mobile's MyProgress.tsx
        // uses (see that file's own comment).
        apiClient
          .get<{ roadmap: Roadmap | null }>("/api/v1/roadmap")
          .then((d) => d.roadmap)
          .catch(() => null),
      ]);
      setSessions(sessionsResult);
      setStreak(streakResult);
      setRoadmap(roadmapResult);
    } catch (err) {
      setLoadError((err as ApiError).message || t("web:progress.loadFailedDefault", { defaultValue: "Could not load your progress." }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setLeaderboardError(null);
    gamificationService
      .getLeaderboard("all", firebaseUser?.uid)
      .then((data) => {
        if (!cancelled) setLeaderboard(data);
      })
      .catch((err: ApiError) => {
        if (!cancelled) setLeaderboardError(err.message || t("web:progress.leaderboardLoadFailedDefault", { defaultValue: "Could not load the leaderboard." }));
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, firebaseUser?.uid, t]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    apiClient
      .get<{ session_count: number; dimensions?: { key: string; score: number }[] }>("/api/v1/feedback/heatmap")
      .then((data) => {
        if (cancelled) return;
        setHeatMapSessionCount(data.session_count ?? 0);
        setHeatMap(
          (data.dimensions ?? []).map((d) => ({
            key: d.key,
            label: t(`web:progress.skillLabels.${d.key}`, { defaultValue: fallbackTypeLabel(d.key) }),
            score: Math.round(d.score ?? 0),
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setHeatMap(null);
      })
      .finally(() => {
        if (!cancelled) setHeatMapLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, t]);

  const loadChallenge = () => {
    setChallengeLoading(true);
    gamificationService
      .getTodayChallenge(i18n.language)
      .then(setChallenge)
      .catch(() => setChallenge(null))
      .finally(() => setChallengeLoading(false));
  };
  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadChallenge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, i18n.language]);

  async function onSubmitChallenge() {
    if (!response.trim() || submitting) return;
    setSubmitting(true);
    try {
      setChallenge(await gamificationService.submitChallengeResponse(response.trim(), i18n.language));
      setResponse("");
    } catch {
      // Best-effort — leave the input as-is so the user can retry.
    } finally {
      setSubmitting(false);
    }
  }
  async function onSkipChallenge() {
    if (skipping) return;
    setSkipping(true);
    try {
      setChallenge(await gamificationService.skipTodayChallenge(i18n.language));
    } catch {
      // Best-effort.
    } finally {
      setSkipping(false);
    }
  }

  const completed = useMemo(() => (sessions ?? []).filter((s) => (s.status || "").toLowerCase() === "completed"), [sessions]);
  const scored = useMemo(() => completed.filter((s) => typeof s.overall_score === "number"), [completed]);
  const avgScore = scored.length ? Math.round(scored.reduce((sum, s) => sum + (s.overall_score ?? 0), 0) / scored.length) : null;
  const weeklyPractice = useMemo(() => computeWeeklyPractice(completed), [completed]);
  const todayWeekIndex = (new Date().getDay() + 6) % 7;
  const maxWeekly = Math.max(1, ...weeklyPractice);
  const streakDays = streak?.streakDays ?? 0;
  const roadmapPercent = roadmap && roadmap.total_count > 0 ? Math.round((roadmap.completed_count / roadmap.total_count) * 100) : 0;
  const currentRoadmapStep = roadmap?.steps.find((s) => s.status === "current") ?? null;
  const goals = profile?.goals ?? [];
  const recentSessions = useMemo(
    () => [...completed].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at)).slice(0, 6),
    [completed]
  );

  const TABS: Array<{ key: "overview" | "skills" | "history"; label: string }> = [
    { key: "overview", label: t("web:progress.tabs.overview", { defaultValue: "Overview" }) },
    { key: "skills", label: t("web:progress.tabs.skills", { defaultValue: "Skills" }) },
    { key: "history", label: t("web:progress.tabs.history", { defaultValue: "History" }) },
  ];

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-10">
          <PageHeader
            title={t("web:progress.title", { defaultValue: "My Progress" })}
            subtitle={t("web:progress.subtitle", { defaultValue: "Your real progress toward the career goal you set." })}
          />

          <div className="flex gap-2">
            {TABS.map((tb) => (
              <Pill key={tb.key} selected={tab === tb.key} onClick={() => setTab(tb.key)}>
                {tb.label}
              </Pill>
            ))}
          </div>

          {loadError && <p className="text-sm text-danger">{loadError}</p>}

          {isLoading && !loadError && (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-24 rounded-card" />
              <Skeleton className="h-28 rounded-card" />
              <SkeletonRows count={3} />
            </div>
          )}

          {!isLoading && !loadError && tab === "overview" && (
            <div className="flex flex-col gap-5">
              {/* Daily Challenge — see this file's header comment on why
                  it's here rather than a dashboard mission-hero. */}
              {!challengeLoading && challenge && !challenge.skipped && (
                <div className="flex flex-col rounded-card border border-border bg-[rgba(126,168,226,0.1)] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                        <EvaIcon name="flash-outline" size={18} />
                      </span>
                      <div>
                        <h3 className="font-semibold text-primary">{t("web:progress.dailyChallenge.title", { defaultValue: "Today's Surprise Challenge" })}</h3>
                        <p className="mt-0.5 text-xs text-hint">{fallbackTypeLabel(challenge.challengeType)}</p>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">
                      <EvaIcon name="flash-outline" size={13} />
                      {challenge.completed ? challenge.xpAwarded : t("web:progress.dailyChallenge.xpSuffix", { defaultValue: "XP" })}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-pill bg-black/[0.08]">
                    <div className="h-full rounded-pill bg-brand" style={{ width: challenge.completed ? "100%" : "4%" }} />
                  </div>
                  <p className="mt-4 text-sm text-primary">{challenge.promptText}</p>
                  {challenge.completed ? (
                    <div className="mt-4 rounded-lg bg-surface-2 p-3">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-success">
                        <EvaIcon name="checkmark-circle-2-outline" size={16} />
                        {t("web:progress.dailyChallenge.completed", { defaultValue: "+{{xp}} XP earned", xp: challenge.xpAwarded })}
                      </div>
                      {challenge.aiFeedback && <p className="mt-2 text-sm text-hint">{challenge.aiFeedback}</p>}
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-col gap-2.5">
                      <textarea
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                        placeholder={t("web:progress.dailyChallenge.responsePlaceholder", { defaultValue: "Type your response…" })}
                        rows={3}
                        className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                      />
                      <div className="flex items-center gap-4">
                        <Button size="sm" onClick={onSubmitChallenge} disabled={!response.trim() || submitting}>
                          {submitting ? t("common:actions.saving", { defaultValue: "Saving…" }) : t("web:progress.dailyChallenge.submit", { defaultValue: "Submit" })}
                        </Button>
                        <button type="button" disabled={skipping} onClick={onSkipChallenge} className="text-sm font-semibold text-hint hover:text-primary disabled:opacity-60">
                          {skipping ? t("common:actions.loading", { defaultValue: "Loading…" }) : t("web:progress.dailyChallenge.skip", { defaultValue: "Skip today" })}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Career goal card */}
              <div className="rounded-card border border-border bg-surface-2 p-5">
                <h3 className="mb-2.5 text-sm font-bold text-primary">{t("web:progress.yourCareerGoal", { defaultValue: "Your career goal" })}</h3>
                {goals.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {goals.map((goal) => (
                      <span key={goal} className="rounded-pill bg-surface-3 px-3.5 py-1.5 text-sm font-bold text-primary">
                        {getCareerGoalLabel(goal, t)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-hint">{t("web:progress.noCareerGoal", { defaultValue: "You haven't set a career goal yet." })}</p>
                )}
              </div>

              {/* Roadmap progress card */}
              <div className="rounded-card border border-border bg-surface-2 p-5">
                <h3 className="mb-3.5 text-sm font-bold text-primary">{t("web:progress.goalProgressTitle", { defaultValue: "Progress toward your goal" })}</h3>
                {roadmap ? (
                  <>
                    <div className="flex items-center gap-4">
                      <CircularProgress progress={roadmapPercent} size={72} strokeWidth={7}>
                        <span className="text-base font-bold text-primary">{roadmapPercent}%</span>
                      </CircularProgress>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-primary">{roadmap.target_role}</p>
                        <p className="mt-1 text-sm text-hint">
                          {t("web:progress.goalProgressStepsOf", { defaultValue: "{{completed}} of {{total}} steps complete", completed: roadmap.completed_count, total: roadmap.total_count })}
                        </p>
                      </div>
                    </div>
                    {roadmap.is_complete ? (
                      <p className="mt-3 text-sm font-semibold text-success">{t("web:progress.goalProgressComplete", { defaultValue: "You've completed every step — congratulations!" })}</p>
                    ) : currentRoadmapStep ? (
                      <p className="mt-3 text-sm text-primary">{t("web:progress.goalProgressCurrentStep", { defaultValue: "Current step: {{step}}", step: currentRoadmapStep.title })}</p>
                    ) : null}
                    <Link href="/career/roadmap" className="mt-3 inline-block text-sm font-semibold text-link">
                      {t("web:progress.goalProgressViewRoadmap", { defaultValue: "View full roadmap →" })}
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-hint">{t("web:progress.goalProgressNoRoadmap", { defaultValue: "Build a step-by-step roadmap to see your progress toward this goal." })}</p>
                    <Link href="/career/roadmap" className="mt-3 inline-block text-sm font-semibold text-link">
                      {t("web:progress.goalProgressBuildRoadmap", { defaultValue: "Build my roadmap →" })}
                    </Link>
                  </>
                )}
              </div>

              {/* 3 stat tiles */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center rounded-card border border-border bg-tint-mint p-4">
                  <CircularProgress progress={Math.min(100, (completed.length / 10) * 100)} size={56} strokeWidth={5} progressClassName="text-tint-mint-text" trackClassName="text-white/60">
                    <span className="text-sm font-bold text-tint-mint-text">{completed.length}</span>
                  </CircularProgress>
                  <span className="mt-2 text-center text-xs font-bold text-tint-mint-text">{t("web:progress.sessionsCompleted", { defaultValue: "Sessions completed" })}</span>
                </div>
                <div className="flex flex-col items-center rounded-card border border-border bg-tint-orange p-4">
                  <CircularProgress progress={Math.min(100, (streakDays / 7) * 100)} size={56} strokeWidth={5} progressClassName="text-tint-orange-text" trackClassName="text-white/60">
                    <span className="text-sm font-bold text-tint-orange-text">{streakDays}</span>
                  </CircularProgress>
                  <span className="mt-2 text-center text-xs font-bold text-tint-orange-text">{t("web:progress.dayStreak", { defaultValue: "Day streak" })}</span>
                </div>
                <div className="flex flex-col items-center rounded-card border border-border bg-tint-purple p-4">
                  <CircularProgress progress={avgScore ?? 0} size={56} strokeWidth={5} progressClassName="text-tint-purple-text" trackClassName="text-white/60">
                    <span className="text-sm font-bold text-tint-purple-text">{avgScore != null ? avgScore : "—"}</span>
                  </CircularProgress>
                  <span className="mt-2 text-center text-xs font-bold text-tint-purple-text">{t("web:progress.averageScore", { defaultValue: "Average score" })}</span>
                </div>
              </div>

              {/* Weekly bar chart */}
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-bold text-primary">{t("web:progress.thisWeek", { defaultValue: "This week" })}</h3>
                <div className="flex items-end justify-between gap-2 rounded-card border border-border bg-surface-2 p-5 pt-6">
                  {weeklyPractice.map((count, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-24 w-full items-end justify-center">
                        <div
                          className={`w-5 rounded-pill ${i === todayWeekIndex ? "bg-brand" : "bg-surface-4"}`}
                          style={{ height: `${Math.max(6, (count / maxWeekly) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-hint">{t(`web:progress.weekdayShort.${WEEKDAY_LABELS[i].toLowerCase()}`, { defaultValue: WEEKDAY_LABELS[i] })}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leaderboard preview */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-primary">{t("web:progress.leaderboard", { defaultValue: "Leaderboard" })}</h3>
                  <Link href="/progress/leaderboard" className="text-sm font-semibold text-link">
                    {t("common:actions.viewAll", { defaultValue: "View all" })}
                  </Link>
                </div>
                {leaderboard === null && !leaderboardError && <SkeletonRows count={3} />}
                {leaderboardError && <p className="text-sm text-danger">{leaderboardError}</p>}
                {leaderboard && leaderboard.length === 0 && <p className="text-sm text-hint">{t("web:progress.leaderboardEmpty", { defaultValue: "No leaderboard data yet." })}</p>}
                {leaderboard && leaderboard.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {leaderboard.slice(0, 3).map((entry) => (
                      <div key={entry.id} className={`flex items-center gap-3 rounded-card border border-border p-3 ${entry.isCurrentUser ? "bg-brand/5" : "bg-surface-2"}`}>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-hint">{entry.rank}</span>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                          {entry.name?.[0]?.toUpperCase() ?? "?"}
                        </span>
                        <span className="flex-1 truncate text-sm font-semibold text-primary">
                          {entry.name}
                          {entry.isCurrentUser ? ` (${t("web:progress.you", { defaultValue: "You" })})` : ""}
                        </span>
                        <span className="text-xs text-hint">
                          {entry.xp} {t("web:progress.xpLabel", { defaultValue: "XP" })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!isLoading && !loadError && tab === "skills" && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold text-primary">{t("web:progress.skillHeatMapTitle", { defaultValue: "Skill Heat Map" })}</h3>
              <p className="mb-2 text-sm text-hint">{t("web:progress.skillHeatMapDescription", { defaultValue: "Your average across every scored interview — see what to work on next." })}</p>
              {heatMapLoading && <SkeletonRows count={4} />}
              {!heatMapLoading && heatMap && heatMap.length > 0 && heatMapSessionCount > 0 && (
                <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-5">
                  {heatMap.map((entry) => (
                    <div key={entry.key}>
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-sm font-semibold text-primary">{entry.label}</span>
                        <span className="text-sm font-semibold text-link">{entry.score}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-pill bg-surface-3">
                        <div
                          className={`h-full rounded-pill ${entry.score >= 80 ? "bg-success" : entry.score >= 60 ? "bg-warning" : "bg-danger"}`}
                          style={{ width: `${Math.max(0, Math.min(100, entry.score))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!heatMapLoading && (!heatMap || heatMap.length === 0 || heatMapSessionCount === 0) && (
                <p className="rounded-card border border-border bg-surface-2 p-6 text-center text-sm text-hint">
                  {t("web:progress.skillHeatMapEmpty", { defaultValue: "Complete a scored interview to see your skill breakdown here." })}
                </p>
              )}
            </div>
          )}

          {!isLoading && !loadError && tab === "history" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2 rounded-card border border-border bg-surface-2 p-3">
                {streak?.checkedInToday && (
                  <span className="inline-flex items-center gap-1 rounded-pill bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                    <EvaIcon name="checkmark-circle-2-outline" size={13} />
                    {t("web:progress.checkedInToday", { defaultValue: "Checked in today" })}
                  </span>
                )}
                <span className="text-xs text-hint">{t("web:progress.streakDays", { defaultValue: "{{count}}-day streak", count: streakDays })}</span>
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-bold text-primary">{t("web:progress.recentSessions", { defaultValue: "Recent sessions" })}</h3>
                {recentSessions.length === 0 ? (
                  <p className="rounded-card border border-border bg-surface-2 p-6 text-center text-sm text-hint">
                    {t("web:progress.completeFirstInterview", { defaultValue: "Complete your first mock interview to start tracking progress here." })}
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface-2">
                    {recentSessions.map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-3 p-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-primary">{t(`web:practice.mockInterviews.types.${s.type}`, { defaultValue: fallbackTypeLabel(s.type) })}</p>
                          <p className="mt-0.5 text-xs text-hint">{new Date(s.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                        </div>
                        <span className={`text-sm font-bold ${typeof s.overall_score === "number" ? "text-link" : "text-hint"}`}>{typeof s.overall_score === "number" ? `${s.overall_score}%` : "—"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}

export default function ProgressPage() {
  return <ProgressPageInner />;
}
