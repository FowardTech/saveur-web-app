"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";
import { useAuth } from "@/app/providers/AuthProvider";
import apiClient, { type ApiError } from "@/lib/apiClient";
import * as gamificationService from "@/lib/gamificationService";
import type { GamificationStreak } from "@/lib/gamificationService";
import { getCareerGoalLabel } from "@/lib/careerGoalLabels";
import { getWeeklyTargets, setWeeklyTargets, type WeeklyTargets } from "@/lib/goalsPreferencesService";

// Web port of Saveur/src/more/GoalsScreen.tsx — a DIFFERENT screen from
// mobile's MyProgress.tsx (already ported to app/progress/page.tsx). This is
// the "Career" + "Weekly targets" + "Progress" hub reachable from More >
// Career Goal on mobile: current career goal + target-roles/countries
// counts, this-account's own weekly practice/application quotas (with
// inline-editable targets), and a current/longest streak readout.
//
// Real backend contracts (same ones already used elsewhere on web):
//   GET /api/v1/interviews/sessions      (lib usage: app/progress/page.tsx)
//   GET /api/v1/tracker/applications     (lib usage: app/applications/page.tsx)
//   GET /api/v1/gamification/streak      (lib/gamificationService.ts)
// The weekly PRACTICE/APPLICATIONS TARGETS themselves (the "3" in "0 of 3
// this week") are not a backend concept on either client — mobile's
// services/goalsPreferencesService.ts stores them in local AsyncStorage only
// (see that file's own comment: "personal targets... not something the
// admin dashboard or any other part of the product needs to read or
// enforce"). This page mirrors that exactly via lib/goalsPreferencesService.ts
// (localStorage, scoped per-uid) rather than inventing a new endpoint.

interface Session {
  id: number;
  status: string;
  started_at: string;
}

interface Application {
  id: number;
  applied_date?: number | string | null;
}

/** Mon-first calendar week boundary — same convention as
 * app/progress/page.tsx's computeWeeklyPractice and mobile's
 * GoalsScreen.tsx's isThisWeek (dayjs `.day()`, not `startOf('week')`), so
 * "this week" means the same calendar days everywhere in the app. */
function isThisWeek(ts?: number | string | null): boolean {
  if (!ts) return false;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const todayMonFirst = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - todayMonFirst);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);
  return d >= monday && d < sunday;
}

type TargetKey = keyof WeeklyTargets;

function GoalsPageInner() {
  const { t } = useTranslation();
  const { profile, firebaseUser, loading: authLoading } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  const [practiceThisWeek, setPracticeThisWeek] = useState(0);
  const [appliedThisWeek, setAppliedThisWeek] = useState(0);
  const [streak, setStreak] = useState<GamificationStreak | null>(null);
  const [targets, setTargets] = useState<WeeklyTargets | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editingKey, setEditingKey] = useState<TargetKey | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSavingTarget, setIsSavingTarget] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [sessions, applications, streakResult] = await Promise.all([
        apiClient.get<Session[]>("/api/v1/interviews/sessions").catch(() => []),
        apiClient.get<Application[]>("/api/v1/tracker/applications").catch(() => []),
        gamificationService.getStreak().catch(() => null),
      ]);
      const completedThisWeek = (sessions ?? []).filter(
        (s) => (s.status || "").toLowerCase() === "completed" && isThisWeek(s.started_at)
      );
      setPracticeThisWeek(completedThisWeek.length);
      setAppliedThisWeek((applications ?? []).filter((a) => isThisWeek(a.applied_date)).length);
      setStreak(streakResult);
      setTargets(getWeeklyTargets(uid));
    } catch (err) {
      setLoadError((err as ApiError).message || t("web:goals.loadFailedDefault", { defaultValue: "Could not load your goals." }));
    } finally {
      setIsLoading(false);
    }
  }, [uid, t]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, uid]);

  const goal = profile?.goals?.[0];
  const desiredRolesCount = profile?.desiredRoles?.length ?? 0;
  const countriesCount = profile?.preferredCountries?.length ?? 0;

  function onOpenEdit(key: TargetKey) {
    setEditingKey(key);
    setEditValue(String(targets?.[key] ?? ""));
  }

  async function onSaveTarget(e: React.FormEvent) {
    e.preventDefault();
    if (!editingKey || !targets || isSavingTarget) return;
    const parsed = parseInt(editValue, 10);
    if (!parsed || parsed <= 0) return;
    setIsSavingTarget(true);
    try {
      const next: WeeklyTargets = { ...targets, [editingKey]: parsed };
      setWeeklyTargets(next, uid);
      setTargets(next);
      setEditingKey(null);
    } finally {
      setIsSavingTarget(false);
    }
  }

  const practicePct = useMemo(
    () => Math.min(100, (practiceThisWeek / Math.max(1, targets?.practiceSessions ?? 1)) * 100),
    [practiceThisWeek, targets]
  );
  const applicationsPct = useMemo(
    () => Math.min(100, (appliedThisWeek / Math.max(1, targets?.applications ?? 1)) * 100),
    [appliedThisWeek, targets]
  );

  const editTitle =
    editingKey === "practiceSessions"
      ? t("web:goals.editPracticeTarget", { defaultValue: "Weekly practice sessions target" })
      : t("web:goals.editApplicationsTarget", { defaultValue: "Weekly applications target" });

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:goals.title", { defaultValue: "Goals" })}
            subtitle={t("web:goals.subtitle", { defaultValue: "Your career goal, weekly targets, and streak — all in one place." })}
          />

          {loadError && <p className="text-sm text-danger">{loadError}</p>}

          {isLoading && !loadError && (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-32 rounded-card" />
              <Skeleton className="h-40 rounded-card" />
              <SkeletonRows count={2} />
            </div>
          )}

          {!isLoading && !loadError && (
            <>
              {/* Career */}
              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px]" style={{ backgroundColor: "#0063f8" }}>
                    <EvaIcon name="briefcase-outline" size={16} className="text-white" />
                  </span>
                  <h2 className="text-base font-bold text-primary">{t("web:goals.sectionCareer", { defaultValue: "Career" })}</h2>
                </div>
                <div className="flex flex-col rounded-card border border-border bg-surface-2 p-4">
                  <Link href="/settings/profile" className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-hint">{t("web:goals.currentGoal", { defaultValue: "Current goal" })}</p>
                      <p className="mt-0.5 truncate text-sm font-bold text-primary">
                        {goal ? getCareerGoalLabel(goal, t) : t("web:goals.noGoalSet", { defaultValue: "Not set" })}
                      </p>
                    </div>
                    <EvaIcon name="edit-2-outline" size={18} className="shrink-0 text-hint" />
                  </Link>
                  <div className="my-3.5 h-px bg-border" />
                  <Link href="/settings/profile" className="flex items-center">
                    <div className="flex-1 text-center">
                      <p className="text-lg font-bold text-primary">{desiredRolesCount}</p>
                      <p className="mt-0.5 text-xs text-hint">{t("web:goals.targetRoles", { defaultValue: "Target roles" })}</p>
                    </div>
                    <div className="flex-1 border-x border-border text-center">
                      <p className="text-lg font-bold text-primary">{countriesCount}</p>
                      <p className="mt-0.5 text-xs text-hint">{t("web:goals.countries", { defaultValue: "Countries" })}</p>
                    </div>
                    <div className="flex-1 text-center">
                      <EvaIcon name="chevron-right-outline" size={18} className="mx-auto text-hint" />
                      <p className="mt-0.5 text-xs text-hint">{t("web:goals.edit", { defaultValue: "Edit" })}</p>
                    </div>
                  </Link>
                </div>
              </section>

              {/* Weekly targets */}
              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px]" style={{ backgroundColor: "#F59E0B" }}>
                    <EvaIcon name="clipboard-outline" size={16} className="text-white" />
                  </span>
                  <h2 className="text-base font-bold text-primary">{t("web:goals.sectionWeeklyTargets", { defaultValue: "Weekly targets" })}</h2>
                </div>
                <div className="flex flex-col rounded-card border border-border bg-surface-2 p-4">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-primary">{t("web:goals.practiceSessions", { defaultValue: "Practice sessions" })}</p>
                      <p className="mt-0.5 text-xs text-hint">
                        {t("web:goals.ofTargetThisWeek", {
                          defaultValue: "{{done}} of {{target}} this week",
                          done: practiceThisWeek,
                          target: targets?.practiceSessions ?? 0,
                        })}
                      </p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-surface-3">
                        <div className="h-full rounded-pill bg-brand" style={{ width: `${practicePct}%` }} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenEdit("practiceSessions")}
                      className="shrink-0 p-1 text-hint hover:text-primary"
                      aria-label={t("web:goals.editPracticeTarget", { defaultValue: "Weekly practice sessions target" })}
                    >
                      <EvaIcon name="edit-2-outline" size={18} />
                    </button>
                  </div>
                  <div className="my-3.5 h-px bg-border" />
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-primary">{t("web:goals.applications", { defaultValue: "Applications" })}</p>
                      <p className="mt-0.5 text-xs text-hint">
                        {t("web:goals.ofTargetThisWeek", {
                          defaultValue: "{{done}} of {{target}} this week",
                          done: appliedThisWeek,
                          target: targets?.applications ?? 0,
                        })}
                      </p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-surface-3">
                        <div className="h-full rounded-pill bg-brand" style={{ width: `${applicationsPct}%` }} />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenEdit("applications")}
                      className="shrink-0 p-1 text-hint hover:text-primary"
                      aria-label={t("web:goals.editApplicationsTarget", { defaultValue: "Weekly applications target" })}
                    >
                      <EvaIcon name="edit-2-outline" size={18} />
                    </button>
                  </div>

                  {editingKey && (
                    <form onSubmit={onSaveTarget} className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-surface-1 p-3">
                      <label className="flex flex-1 items-center gap-2 text-sm text-primary">
                        {editTitle}
                        <input
                          autoFocus
                          type="number"
                          min={1}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-16 rounded-md border border-border bg-surface-2 px-2 py-1 text-sm text-primary focus:border-brand focus:outline-none"
                        />
                      </label>
                      <button type="submit" disabled={isSavingTarget} className="rounded-pill bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                        {t("common:actions.save", { defaultValue: "Save" })}
                      </button>
                      <button type="button" onClick={() => setEditingKey(null)} className="text-xs font-medium text-hint hover:text-primary">
                        {t("common:actions.cancel", { defaultValue: "Cancel" })}
                      </button>
                    </form>
                  )}

                  <Link href="/learning" className="mt-3.5 inline-block w-fit text-sm font-bold text-link">
                    {t("web:goals.viewLearningCourses", { defaultValue: "Continue Learning Courses →" })}
                  </Link>
                </div>
              </section>

              {/* Progress */}
              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px]" style={{ backgroundColor: "#10B981" }}>
                    <EvaIcon name="trending-up-outline" size={16} className="text-white" />
                  </span>
                  <h2 className="text-base font-bold text-primary">{t("web:goals.sectionProgress", { defaultValue: "Progress" })}</h2>
                </div>
                <div className="flex flex-col rounded-card border border-border bg-surface-2 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-xs text-hint">{t("web:goals.currentStreak", { defaultValue: "Current streak" })}</p>
                      <p className="mt-1 text-lg font-bold text-primary">
                        {t("web:goals.daysCount", { defaultValue: "{{count}} days", count: streak?.streakDays ?? 0 })}
                      </p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-hint">{t("web:goals.longestStreak", { defaultValue: "Longest streak" })}</p>
                      <p className="mt-1 text-lg font-bold text-primary">
                        {t("web:goals.daysCount", { defaultValue: "{{count}} days", count: streak?.longestStreak ?? streak?.streakDays ?? 0 })}
                      </p>
                    </div>
                  </div>
                  <Link href="/progress" className="mt-4 inline-block w-fit text-sm font-bold text-link">
                    {t("web:goals.viewFullProgress", { defaultValue: "View full progress →" })}
                  </Link>
                </div>
              </section>
            </>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}

export default function GoalsPage() {
  return <GoalsPageInner />;
}
