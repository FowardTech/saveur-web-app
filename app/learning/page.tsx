"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/learning.py
//   GET  /api/v1/learning/curriculum -> {curriculum: {goal, weeks: Week[]} | null}
//   POST /api/v1/learning/curriculum -> Curriculum (body: {goal, weeks_count?})  -- Premium-gated
//   GET  /api/v1/learning/progress   -> {progress: [...], by_course: {course_id: {completed_modules, last_module_index}}}
//   GET  /api/v1/learning/certificates -> {items: Certificate[]}
// Learning Courses is "AI-taught, on any free-text topic" rather than a
// fixed catalog (see coach.py's module docstring), so this page centers on
// the learner's saved week-by-week Curriculum plus their course progress
// summary, rather than a browsable list of pre-made courses.
//
// Mobile parity (src/more/LearningCourses.tsx): the "Your Badges" card
// (tiered-topic completion certificates, GET .../certificates) was missing
// entirely even though the endpoint already exists and mobile renders it
// front and center, above the curriculum.
interface Week {
  week: number;
  topic: string;
  level?: string;
  completed?: boolean;
  unlocked?: boolean;
  course_id?: string;
}

interface Curriculum {
  goal: string;
  weeks: Week[];
}

interface ProgressByCourse {
  [courseId: string]: { completed_modules: number; last_module_index: number };
}

interface Certificate {
  code: string;
  topic: string;
  levels_completed?: string[];
}

export default function LearningPage() {
  const { t } = useTranslation();
  const [curriculum, setCurriculum] = useState<Curriculum | null | undefined>(undefined);
  const [byCourse, setByCourse] = useState<ProgressByCourse>({});
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [goal, setGoal] = useState("");
  const [generating, setGenerating] = useState(false);

  async function load() {
    try {
      const [curr, prog, certs] = await Promise.all([
        apiClient.get<{ curriculum: Curriculum | null }>("/api/v1/learning/curriculum"),
        apiClient.get<{ by_course: ProgressByCourse }>("/api/v1/learning/progress"),
        apiClient.get<{ items: Certificate[] }>("/api/v1/learning/certificates").catch(() => ({ items: [] })),
      ]);
      setCurriculum(curr.curriculum);
      setByCourse(prog.by_course || {});
      setCertificates(certs.items || []);
    } catch (err) {
      setError((err as ApiError).message || t("web:learning.loadFailedDefault", { defaultValue: "Couldn't load your learning progress." }));
      setCurriculum(null);
    }
  }

  useEffect(() => {
    // Intentional fetch-on-mount — load() sets state once its async GETs
    // resolve, not synchronously in this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!goal.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const data = await apiClient.post<Curriculum>("/api/v1/learning/curriculum", { goal: goal.trim() });
      setCurriculum(data);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setPremiumRequired(true);
      } else {
        setError(apiErr.message || t("web:learning.buildFailedDefault", { defaultValue: "Couldn't build a curriculum right now." }));
      }
    } finally {
      setGenerating(false);
    }
  }

  const courseIds = Object.keys(byCourse);

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:learning.title", { defaultValue: "Learning Courses" })}
            subtitle={t("web:learning.subtitle", { defaultValue: "An AI-built, week-by-week curriculum toward your career goal." })}
          />

          {error && <p className="text-sm text-danger">{error}</p>}
          {curriculum === undefined && <SkeletonRows count={4} />}

          {certificates.length > 0 && (
            <div className="rounded-card border border-border bg-surface-2 p-5">
              <h2 className="font-semibold text-primary">{t("web:learning.yourBadges", { defaultValue: "Your Badges" })}</h2>
              <div className="mt-3 flex flex-col gap-3">
                {certificates.map((c) => (
                  <div key={c.code} className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint-orange text-tint-orange-text">
                      <EvaIcon name="award-outline" size={18} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-primary">{c.topic}</p>
                      <p className="text-xs text-hint">
                        {t("web:learning.badgeTiersCode", { defaultValue: "Basic · Intermediate · Advanced — {{code}}", code: c.code })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {premiumRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:learning.premiumRequiredTitle", { defaultValue: "Building a curriculum is a Premium feature" })}</h2>
              <p className="text-sm text-hint">{t("web:learning.premiumRequiredSubtitle", { defaultValue: "Upgrade your plan to generate a guided, multi-week learning plan." })}</p>
            </div>
          )}

          {curriculum === null && !premiumRequired && (
            <form onSubmit={handleGenerate} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
              <TextField
                label={t("web:learning.careerGoalLabel", { defaultValue: "Career goal" })}
                placeholder={t("web:learning.careerGoalPlaceholder", { defaultValue: "e.g. Become a backend engineer" })}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                required
              />
              <Button type="submit" disabled={generating || !goal.trim()} className="mt-1 w-full">
                {generating ? t("web:learning.building", { defaultValue: "Building…" }) : t("web:learning.buildCurriculum", { defaultValue: "Build my curriculum" })}
              </Button>
            </form>
          )}

          {curriculum && (
            <div className="flex flex-col gap-4">
              <div className="rounded-card border border-border bg-surface-2 p-5">
                <h2 className="font-semibold text-primary">{t("web:learning.goalPrefix", { defaultValue: "Goal: {{goal}}", goal: curriculum.goal })}</h2>
              </div>
              <div className="flex flex-col gap-3">
                {curriculum.weeks.map((w) => (
                  <div key={w.week} className="flex items-center gap-4 rounded-card border border-border bg-surface-2 p-4">
                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        w.completed ? "bg-tint-mint text-tint-mint-text" : w.unlocked ? "bg-brand/10 text-brand" : "bg-surface-3 text-hint"
                      }`}
                    >
                      {w.completed ? <EvaIcon name="checkmark-outline" size={16} /> : w.week}
                    </span>
                    <div className="flex-1">
                      <h3 className="font-medium text-primary">{w.topic}</h3>
                      <p className="text-xs text-hint">
                        {t("web:learning.weekLabel", { defaultValue: "Week {{week}}", week: w.week })}
                        {w.level ? ` · ${w.level}` : ""}
                        {!w.unlocked && !w.completed ? ` · ${t("web:learning.locked", { defaultValue: "Locked" })}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {courseIds.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-primary">{t("web:learning.courseProgressTitle", { defaultValue: "Course progress" })}</h2>
              {courseIds.map((courseId) => (
                <div key={courseId} className="flex items-center justify-between rounded-card border border-border bg-surface-2 p-4">
                  <span className="text-sm text-primary capitalize">{courseId.split("::")[0].replace(/-/g, " ")}</span>
                  <span className="text-xs text-hint">
                    {t("web:learning.modulesCompleted", { defaultValue: "{{count}} module(s) completed", count: byCourse[courseId].completed_modules })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
