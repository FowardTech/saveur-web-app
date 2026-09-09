"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/career_roadmap.py
//   GET  /api/v1/roadmap          -> {roadmap: Roadmap | null}
//   POST /api/v1/roadmap/generate -> Roadmap  (body: {target_role, current_role?})
//   POST /api/v1/roadmap/steps/<order>/complete -> Roadmap
// Pro Premium-gated (@require_premium) — a 402/403 here is shown as a plain message.
interface RoadmapStep {
  order: number;
  title: string;
  description?: string;
  status: "completed" | "current" | "upcoming" | string;
}

interface Roadmap {
  target_role: string;
  current_role?: string;
  steps: RoadmapStep[];
  completed_count: number;
  total_count: number;
  is_complete: boolean;
}

const statusStyles: Record<string, string> = {
  completed: "bg-tint-mint text-tint-mint-text",
  current: "bg-brand/10 text-brand",
  upcoming: "bg-surface-3 text-hint",
};

export default function CareerRoadmapPage() {
  const { t } = useTranslation();
  const [roadmap, setRoadmap] = useState<Roadmap | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [targetRole, setTargetRole] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [generating, setGenerating] = useState(false);

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
          {roadmap === undefined && !premiumRequired && <p className="text-sm text-hint">{t("web:career.roadmap.loading", { defaultValue: "Loading…" })}</p>}

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
              <div className="rounded-card border border-border bg-surface-2 p-5">
                <h2 className="font-semibold text-primary">{t("web:career.roadmap.towardPrefix", { defaultValue: "Toward: {{role}}", role: roadmap.target_role })}</h2>
                <p className="mt-1 text-sm text-hint">
                  {t("web:career.roadmap.milestonesCompleted", { defaultValue: "{{completed}}/{{total}} milestones completed", completed: roadmap.completed_count, total: roadmap.total_count })}
                  {roadmap.is_complete ? t("web:career.roadmap.completeSuffix", { defaultValue: " — complete!" }) : ""}
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {roadmap.steps.map((step) => (
                  <div key={step.order} className="flex items-start gap-4 rounded-card border border-border bg-surface-2 p-4">
                    <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${statusStyles[step.status] ?? "bg-surface-3 text-hint"}`}>
                      {step.status === "completed" ? <EvaIcon name="checkmark-outline" size={16} /> : step.order}
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
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
