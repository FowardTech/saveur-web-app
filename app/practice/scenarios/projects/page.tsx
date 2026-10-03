"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { ShareToUserModal } from "@/components/jobAlerts/ShareToUserModal";
import { useAuth } from "@/app/providers/AuthProvider";
import type { ApiError } from "@/lib/apiClient";
import * as service from "@/lib/practicalProjectsService";
import type { PracticalProjectDetail, PracticalProjectSummary } from "@/lib/practicalProjectsService";
import * as projectActions from "@/lib/projectActionsService";

const INDUSTRIES = ["healthcare", "sales", "marketing", "finance", "consulting", "science"];

// Industry-based projects for Practical Scenarios: pick an industry, the AI
// writes a realistic project brief, the learner writes their solution, then
// can send it to the AI coach for analysis, share it, or export it as a zip.
export default function PracticalProjectsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { loading: authLoading } = useAuth();
  const [industry, setIndustry] = useState(INDUSTRIES[0]);
  const [role, setRole] = useState("");
  const [projects, setProjects] = useState<PracticalProjectSummary[] | null>(null);
  const [active, setActive] = useState<PracticalProjectDetail | null>(null);
  const [solution, setSolution] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addonRequired, setAddonRequired] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setProjects(await service.listPracticalProjects());
    } catch (e) {
      if ((e as ApiError).status === 402) setAddonRequired(true);
      else setError((e as ApiError).message);
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  async function open(id: number) {
    setError(null);
    try {
      const p = await service.getPracticalProject(id);
      setActive(p);
      setSolution(p.files.find((f) => f.path === "SOLUTION.md")?.content ?? "");
      setDirty(false);
    } catch (e) {
      setError((e as ApiError).message);
    }
  }

  async function create() {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const p = await service.createPracticalProject(industry, role.trim() || undefined);
      setActive(p);
      setSolution(p.files.find((f) => f.path === "SOLUTION.md")?.content ?? "");
      setDirty(false);
      load();
    } catch (e) {
      if ((e as ApiError).status === 402) setAddonRequired(true);
      else setError((e as ApiError).message || t("common:somethingWentWrong", { defaultValue: "Something went wrong. Please try again." }));
    } finally {
      setCreating(false);
    }
  }

  async function save() {
    if (!active || saving) return;
    setSaving(true);
    try {
      await service.savePracticalProject(active.id, [{ path: "SOLUTION.md", content: solution }]);
      setDirty(false);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  const brief = active?.files.find((f) => f.path === "BRIEF.md")?.content ?? "";

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-10">
          <PageHeader
            title={t("web:practice.scenarios.projects.title", { defaultValue: "Industry Projects" })}
            subtitle={t("web:practice.scenarios.projects.subtitle", { defaultValue: "Build a realistic project for your field, then get your AI coach to review it." })}
          />
          {addonRequired && (
            <p className="rounded-card border border-border bg-surface-2 p-4 text-sm text-hint">
              {t("web:practice.scenarios.addonRequiredSubtitle", { defaultValue: "Purchase the Practical Scenarios add-on from your account to unlock this practice mode." })}
            </p>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}

          {!active && !addonRequired && (
            <>
              <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-5">
                <span className="text-sm font-medium text-primary">{t("web:practice.scenarios.scenarioTypeLabel", { defaultValue: "Choose a field" })}</span>
                <div className="flex flex-wrap gap-2">
                  {INDUSTRIES.map((i) => (
                    <Pill key={i} selected={i === industry} onClick={() => setIndustry(i)}>
                      {t(`web:practice.scenarios.types.${i}`, { defaultValue: i[0].toUpperCase() + i.slice(1) })}
                    </Pill>
                  ))}
                </div>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder={t("web:practice.scenarios.rolePlaceholder", { defaultValue: "e.g. Registered Nurse, Account Executive" })}
                  className="rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none"
                />
                <Button onClick={create} disabled={creating}>
                  {creating ? t("web:practice.scenarios.projects.generating", { defaultValue: "Generating project…" }) : t("web:practice.scenarios.projects.generate", { defaultValue: "Generate a project" })}
                </Button>
              </div>

              {projects && projects.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h2 className="text-sm font-semibold text-primary">{t("web:practice.scenarios.projects.yours", { defaultValue: "Your projects" })}</h2>
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => open(p.id)}
                      className="flex items-center justify-between rounded-card border border-border bg-surface-2 p-4 text-left hover:shadow-md"
                    >
                      <span className="text-sm font-medium text-primary">{p.name}</span>
                      <span className="text-xs capitalize text-hint">{p.industry}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {active && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => setActive(null)} className="text-sm font-medium text-hint hover:text-primary">
                  ← {t("common:actions.back", { defaultValue: "Back" })}
                </button>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={save} disabled={saving || !dirty}>
                    {saving ? t("web:practice.codingProjects.saving", { defaultValue: "Saving…" }) : dirty ? t("web:practice.codingProjects.saveUnsaved", { defaultValue: "Save*" }) : t("web:practice.codingProjects.saved", { defaultValue: "Saved" })}
                  </Button>
                  <Button size="sm" variant="outline" disabled={dirty} onClick={() => setShareOpen(true)}>
                    <EvaIcon name="share-outline" size={14} /> {t("web:practice.codingProjects.share", { defaultValue: "Share" })}
                  </Button>
                  <Button size="sm" variant="outline" disabled={dirty} onClick={() => projectActions.exportProjectZip("practical", active.id).catch((e) => setError((e as ApiError).message))}>
                    <EvaIcon name="download-outline" size={14} /> {t("web:practice.codingProjects.export", { defaultValue: "Export" })}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={dirty}
                    onClick={() => router.push(`/ai-coach?codingProjectId=${active.id}&codingProjectName=${encodeURIComponent(active.name)}`)}
                  >
                    <EvaIcon name="message-circle-outline" size={14} /> {t("web:practice.codingProjects.analyzeWithCoach", { defaultValue: "Analyze with your coach" })}
                  </Button>
                </div>
              </div>
              <h2 className="text-lg font-bold text-primary">{active.name}</h2>
              <pre className="whitespace-pre-wrap rounded-card border border-border bg-surface-2 p-4 text-sm text-primary">{brief}</pre>
              <textarea
                value={solution}
                onChange={(e) => {
                  setSolution(e.target.value);
                  setDirty(true);
                }}
                rows={16}
                className="w-full rounded-card border border-border bg-surface-2 p-4 font-mono text-sm text-primary focus:border-brand focus:outline-none"
              />
              <ShareToUserModal
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                contentType="project"
                contentId={active.id}
                getPublicLink={() => projectActions.getProjectPublicUrl("practical", active.id)}
              />
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
