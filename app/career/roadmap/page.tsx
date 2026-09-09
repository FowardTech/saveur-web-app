"use client";

import { useEffect, useState } from "react";
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
        setError(apiErr.message || "Couldn't load your roadmap.");
      }
      setRoadmap(null);
    }
  }

  useEffect(() => {
    load();
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
        setError(apiErr.message || "Couldn't generate a roadmap right now.");
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
          <PageHeader title="Career Roadmap" subtitle="An AI-planned, step-by-step path toward your target role." />

          {premiumRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">Career Roadmap is a Premium feature</h2>
              <p className="text-sm text-hint">Upgrade your plan to generate and track a personalized roadmap.</p>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          {roadmap === undefined && !premiumRequired && <p className="text-sm text-hint">Loading…</p>}

          {roadmap === null && !premiumRequired && (
            <form onSubmit={handleGenerate} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
              <TextField
                label="Target role"
                placeholder="e.g. Senior Backend Engineer"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                required
              />
              <TextField
                label="Current role (optional)"
                placeholder="e.g. Junior Backend Engineer"
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value)}
              />
              <Button type="submit" disabled={generating} className="mt-1 w-full">
                {generating ? "Generating…" : "Generate roadmap"}
              </Button>
            </form>
          )}

          {roadmap && (
            <div className="flex flex-col gap-4">
              <div className="rounded-card border border-border bg-surface-2 p-5">
                <h2 className="font-semibold text-primary">Toward: {roadmap.target_role}</h2>
                <p className="mt-1 text-sm text-hint">
                  {roadmap.completed_count}/{roadmap.total_count} milestones completed
                  {roadmap.is_complete ? " — complete!" : ""}
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
                        Mark done
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
