"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EvaIcon, type EvaIconName } from "@/components/icons/EvaIcon";
import { Skeleton, SkeletonRows } from "@/components/ui/Skeleton";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { StatMiniCard } from "@/components/ui/StatMiniCard";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/career_roadmap.py
//   GET  /api/v1/roadmap          -> {roadmap: Roadmap | null}
//   POST /api/v1/roadmap/generate -> Roadmap  (body: {target_role, current_role?})
//   POST /api/v1/roadmap/steps/<order>/complete -> Roadmap
// Pro Premium-gated (@require_premium) — a 402/403 here is shown as a plain message.
//
// Mobile parity (src/more/CareerRoadmap.tsx, the HOME REDESIGN follow-
// through): a donut-ring + 2x2 stat header card and a "Milestone Overview"
// grid of pastel stat tiles grouped by each step's real `type` — both were
// entirely missing here; this page only rendered a plain text summary and
// a flat step list. `type` itself (career_roadmap.py's CareerRoadmap model:
// "skill"|"project"|"interview"|"milestone" per step) was missing from this
// file's RoadmapStep interface too, even though the backend already sends
// it on every step.
interface RoadmapStep {
  order: number;
  title: string;
  description?: string;
  type: "skill" | "project" | "interview" | "milestone";
  status: "completed" | "current" | "locked" | string;
}

interface Roadmap {
  target_role: string;
  current_role?: string;
  steps: RoadmapStep[];
  completed_count: number;
  total_count: number;
  is_complete: boolean;
  auto_generated?: boolean;
}

const statusStyles: Record<string, string> = {
  completed: "bg-tint-mint text-tint-mint-text",
  current: "bg-brand/10 text-brand",
  locked: "bg-surface-3 text-hint",
};

const TYPE_META: Record<RoadmapStep["type"], { label: string; icon: EvaIconName; bg: string; tint: string }> = {
  skill: { label: "Skills", icon: "book-open-outline", bg: "#ECFDF5", tint: "#059669" },
  project: { label: "Projects", icon: "briefcase-outline", bg: "#E8F0FF", tint: "#0052D9" },
  interview: { label: "Interviews", icon: "mic-outline", bg: "#F5EFFF", tint: "#7C3AED" },
  milestone: { label: "Milestones", icon: "star-outline", bg: "#FFF3E0", tint: "#B45309" },
};

export default function CareerRoadmapPage() {
  const { t } = useTranslation();
  const [roadmap, setRoadmap] = useState<Roadmap | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [targetRole, setTargetRole] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [generating, setGenerating] = useState(false);
  // Streak — feeds the stats-header card's "Streak" tile, same independent
  // GET /api/v1/gamification/streak fetch mobile's HomeSrc.tsx/
  // CareerRoadmap.tsx both make; non-critical, fails open to 0 days.
  const [streakDays, setStreakDays] = useState(0);

  useEffect(() => {
    apiClient
      .get<{ streak_days: number }>("/api/v1/gamification/streak")
      .then((data) => setStreakDays(data.streak_days ?? 0))
      .catch(() => {});
  }, []);

  async function load() {
    try {
      const data = await apiClient.get<{ roadmap: Roadmap | null }>("/api/v1/roadmap");
      setRoadmap(data.roadmap);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setPremiumRequired(true);
      } else {
        setError(apiErr.message || t("web:career.roadmap.loadFailedDefault", { defaultValue: "Couldn't load your roadmap." }));
      }
      setRoadmap(null);
    }
  }

  useEffect(() => {
    // Intentional fetch-on-mount — load() sets state once its async GET
    // resolves, not synchronously in this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!targetRole.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const data = await apiClient.post<Roadmap>("/api/v1/roadmap/generate", {
        target_role: targetRole.trim(),
        current_role: currentRole.trim() || undefined,
      });
      setRoadmap(data);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setPremiumRequired(true);
      } else {
        setError(apiErr.message || t("web:career.roadmap.generateFailedDefault", { defaultValue: "Couldn't generate a roadmap right now." }));
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleComplete(order: number) {
    try {
      const data = await apiClient.post<Roadmap>(`/api/v1/roadmap/steps/${order}/complete`);
      setRoadmap(data);
    } catch {
      // no-op — the step just stays as-is if this fails
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:career.roadmap.title", { defaultValue: "Career Roadmap" })}
            subtitle={t("web:career.roadmap.subtitle", { defaultValue: "An AI-planned, step-by-step path toward your target role." })}
          />

          {premiumRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:career.roadmap.premiumRequiredTitle", { defaultValue: "Career Roadmap is a Premium feature" })}</h2>
              <p className="text-sm text-hint">{t("web:career.roadmap.premiumRequiredSubtitle", { defaultValue: "Upgrade your plan to generate and track a personalized roadmap." })}</p>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          {roadmap === undefined && !premiumRequired && (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-20 rounded-card" />
              <SkeletonRows count={4} />
            </div>
          )}

          {roadmap === null && !premiumRequired && (
            <form onSubmit={handleGenerate} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
              <TextField
                label={t("web:career.roadmap.targetRoleLabel", { defaultValue: "Target role" })}
                placeholder={t("web:career.roadmap.targetRolePlaceholder", { defaultValue: "e.g. Senior Backend Engineer" })}
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                required
              />
              <TextField
                label={t("web:career.roadmap.currentRoleLabel", { defaultValue: "Current role (optional)" })}
                placeholder={t("web:career.roadmap.currentRolePlaceholder", { defaultValue: "e.g. Junior Backend Engineer" })}
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value)}
              />
              <Button type="submit" disabled={generating} className="mt-1 w-full">
                {generating ? t("web:career.roadmap.generating", { defaultValue: "Generating…" }) : t("web:career.roadmap.generateRoadmap", { defaultValue: "Generate roadmap" })}
              </Button>
            </form>
          )}

          {roadmap && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 rounded-card border border-border bg-surface-2 p-5">
                <h2 className="font-semibold text-primary">{t("web:career.roadmap.towardPrefix", { defaultValue: "Toward: {{role}}", role: roadmap.target_role })}</h2>
                {roadmap.auto_generated && (
                  <p className="text-xs text-hint">{t("web:career.roadmap.autoGeneratedNote", { defaultValue: "Built from what you told us when you signed up." })}</p>
                )}
              </div>

              {/* Donut-ring + 2x2 stat header — mirrors mobile's HOME
                  REDESIGN follow-through (CareerRoadmap.tsx's statsCard). */}
              <div className="flex items-center gap-5 rounded-card border border-border bg-surface-2 p-5">
                <CircularProgress progress={roadmap.total_count > 0 ? Math.round((roadmap.completed_count / roadmap.total_count) * 100) : 0} size={84} strokeWidth={8}>
                  <span className="text-base font-bold text-primary">{roadmap.total_count > 0 ? Math.round((roadmap.completed_count / roadmap.total_count) * 100) : 0}%</span>
                  <span className="text-[10px] text-hint">{t("web:career.roadmap.completeLabel", { defaultValue: "Complete" })}</span>
                </CircularProgress>
                <div className="grid flex-1 grid-cols-2 gap-y-3">
                  <div>
                    <p className="text-xs text-hint">{t("web:career.roadmap.currentStepLabel", { defaultValue: "Current Step" })}</p>
                    <p className="mt-0.5 text-sm font-bold text-primary">
                      {roadmap.steps.find((s) => s.status === "current")?.order ?? (roadmap.is_complete ? roadmap.total_count : "—")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-hint">{t("web:career.roadmap.completedLabel", { defaultValue: "Completed" })}</p>
                    <p className="mt-0.5 text-sm font-bold text-primary">
                      {t("web:career.roadmap.completedOfTotal", { defaultValue: "{{completed}} of {{total}}", completed: roadmap.completed_count, total: roadmap.total_count })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-hint">{t("web:career.roadmap.streakLabel", { defaultValue: "Streak" })}</p>
                    <p className="mt-0.5 text-sm font-bold text-primary">{t("web:career.roadmap.streakDays", { defaultValue: "{{count}} Days", count: streakDays })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-hint">{t("web:career.roadmap.totalStepsLabel", { defaultValue: "Total Steps" })}</p>
                    <p className="mt-0.5 text-sm font-bold text-primary">{roadmap.total_count}</p>
                  </div>
                </div>
              </div>

              {roadmap.is_complete && (
                <div className="flex items-center gap-2.5 rounded-card bg-tint-mint p-4">
                  <EvaIcon name="award-outline" size={20} className="text-tint-mint-text" />
                  <p className="text-sm font-semibold text-tint-mint-text">
                    {t("web:career.roadmap.allComplete", { defaultValue: "You've reached every milestone toward {{role}}!", role: roadmap.target_role })}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {roadmap.steps.map((step) => (
                  <div key={step.order} className="flex items-start gap-4 rounded-card border border-border bg-surface-2 p-4">
                    <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${statusStyles[step.status] ?? "bg-surface-3 text-hint"}`}>
                      {step.status === "completed" ? <EvaIcon name="checkmark-outline" size={16} /> : step.status === "locked" ? <EvaIcon name="lock-outline" size={14} /> : step.order}
                    </span>
                    <div className="flex-1">
                      <h3 className="font-medium text-primary">{step.title}</h3>
                      {step.description && <p className="mt-1 text-sm text-hint">{step.description}</p>}
                    </div>
                    {step.status === "current" && (
                      <Button size="sm" variant="outline" onClick={() => handleComplete(step.order)}>
                        {t("web:career.roadmap.markDone", { defaultValue: "Mark done" })}
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* "Milestone Overview" grid grouped by real step type — see
                  TYPE_META above; mirrors mobile's Milestone Overview grid
                  instead of leaving this data (present in every step, just
                  never grouped/summarized) unused. */}
              {(() => {
                const groups = (["skill", "project", "interview", "milestone"] as const)
                  .map((type) => {
                    const stepsOfType = roadmap.steps.filter((s) => s.type === type);
                    return {
                      type,
                      total: stepsOfType.length,
                      completed: stepsOfType.filter((s) => s.status === "completed").length,
                    };
                  })
                  .filter((g) => g.total > 0);
                if (groups.length === 0) return null;
                const pairs: (typeof groups)[] = [];
                for (let i = 0; i < groups.length; i += 2) pairs.push(groups.slice(i, i + 2));
                return (
                  <div className="flex flex-col gap-3">
                    <h2 className="text-sm font-semibold text-primary">{t("web:career.roadmap.milestoneOverview", { defaultValue: "Milestone Overview" })}</h2>
                    {pairs.map((pair, i) => (
                      <div key={i} className="flex gap-3">
                        {pair.map((group) => (
                          <StatMiniCard
                            key={group.type}
                            icon={TYPE_META[group.type].icon}
                            iconTint={TYPE_META[group.type].tint}
                            title={t(`web:career.roadmap.type.${group.type}`, { defaultValue: TYPE_META[group.type].label })}
                            value={t("web:career.roadmap.completedOfTotal", { defaultValue: "{{completed}} of {{total}}", completed: group.completed, total: group.total })}
                            valueColor={TYPE_META[group.type].tint}
                            caption={t("web:career.roadmap.typeCaption", { defaultValue: "{{completed}} of {{total}} steps complete", completed: group.completed, total: group.total })}
                            progressPercent={group.total > 0 ? Math.round((group.completed / group.total) * 100) : 0}
                            progressColor={TYPE_META[group.type].tint}
                            backgroundColor={TYPE_META[group.type].bg}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
