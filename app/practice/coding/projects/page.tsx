"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ApiError } from "@/lib/apiClient";
import { useAuth } from "@/app/providers/AuthProvider";
import * as projectsService from "@/lib/codingProjectsService";
import type { CodingProjectSummary, ProjectType } from "@/lib/codingProjectsService";
import { NewProjectModal } from "@/components/coding/NewProjectModal";

// Web UI for the new "Coding Projects" backend feature (Saveur-Backend
// commit 7fa99e9, app/api/coding.py "Coding Projects" section) — a
// persisted, multi-file/folder code workspace, part of the same paid
// "coding_practice" add-on as the rest of app/practice/coding/**. This is
// the project list/hub; app/practice/coding/projects/[id]/page.tsx is the
// actual VS-Code-like editor opened per project.
function formatSize(bytes: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function CodingProjectsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { loading: authLoading } = useAuth();

  const [projects, setProjects] = useState<CodingProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addonRequired, setAddonRequired] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    try {
      const list = await projectsService.listProjects();
      setProjects(list);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402) {
        setAddonRequired(true);
      } else {
        setError(apiErr.message || t("web:practice.codingProjects.loadFailedDefault", { defaultValue: "Couldn't load your projects right now." }));
      }
      setProjects([]);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  async function onCreate(name: string, projectType: ProjectType, languageHint?: string) {
    setCreating(true);
    setCreateError(null);
    try {
      const project = await projectsService.createProject(name, projectType, languageHint);
      setProjects((prev) => (prev ? [project, ...prev] : [project]));
      setShowNewModal(false);
      // Send them straight into the new project — an empty project is
      // useless to look at on the list page.
      router.push(`/practice/coding/projects/${project.id}`);
    } catch (err) {
      setCreateError((err as ApiError).message || t("web:practice.codingProjects.createFailedDefault", { defaultValue: "Couldn't create the project. Please try again." }));
    } finally {
      setCreating(false);
    }
  }

  async function onRename(project: CodingProjectSummary) {
    const next = window.prompt(t("web:practice.codingProjects.renamePrompt", { defaultValue: "Rename project" }).toString(), project.name);
    if (!next || !next.trim() || next.trim() === project.name) return;
    setBusyId(project.id);
    try {
      const updated = await projectsService.renameProject(project.id, next.trim());
      setProjects((prev) => (prev ? prev.map((p) => (p.id === project.id ? { ...p, name: updated.name, updatedAt: updated.updatedAt } : p)) : prev));
    } catch {
      // no-op — list stays as-is if rename genuinely failed
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(project: CodingProjectSummary) {
    if (!window.confirm(t("web:practice.codingProjects.deleteConfirm", { defaultValue: 'Delete "{{name}}"? This removes every file in it and cannot be undone.', name: project.name }).toString())) return;
    setBusyId(project.id);
    try {
      await projectsService.deleteProject(project.id);
      setProjects((prev) => (prev ? prev.filter((p) => p.id !== project.id) : prev));
    } catch {
      // no-op
    } finally {
      setBusyId(null);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
          <Link href="/practice/coding" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-hint hover:text-primary">
            <EvaIcon name="chevron-left-outline" size={16} />
            {t("web:practice.coding.detail.back", { defaultValue: "Back to Coding Practice" })}
          </Link>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <PageHeader
              title={t("web:practice.codingProjects.title", { defaultValue: "My Coding Projects" })}
              subtitle={t("web:practice.codingProjects.subtitle", { defaultValue: "Build and run your own multi-file projects, saved to your account." })}
            />
            {!addonRequired && (
              <Button type="button" onClick={() => setShowNewModal(true)}>
                <EvaIcon name="plus-outline" size={16} />
                {t("web:practice.codingProjects.newProject", { defaultValue: "New Project" })}
              </Button>
            )}
          </div>

          {addonRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:practice.coding.addonRequiredTitle", { defaultValue: "Coding Practice is a paid add-on" })}</h2>
              <p className="text-sm text-hint">
                {t("web:practice.coding.addonRequiredSubtitle", {
                  defaultValue: "Purchase the Coding Practice add-on from your account to unlock the full problem set and code review.",
                })}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          {!addonRequired && !error && projects === null && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {projects && projects.length === 0 && !addonRequired && (
            <EmptyState
              illustration="list"
              title={t("web:practice.codingProjects.empty", {
                defaultValue: "No projects yet — start a new web page or script project and it'll be saved here.",
              })}
              action={
                <Button type="button" onClick={() => setShowNewModal(true)}>
                  <EvaIcon name="plus-outline" size={16} />
                  {t("web:practice.codingProjects.newProject", { defaultValue: "New Project" })}
                </Button>
              }
            />
          )}

          {projects && projects.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <div key={p.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <Link href={`/practice/coding/projects/${p.id}`} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-pill px-2.5 py-1 text-xs font-medium ${
                          p.projectType === "web" ? "bg-tint-purple text-tint-purple-text" : "bg-tint-mint text-tint-mint-text"
                        }`}
                      >
                        {p.projectType === "web"
                          ? t("web:practice.codingProjects.typeWeb", { defaultValue: "Web Project" })
                          : t("web:practice.codingProjects.typeScript", { defaultValue: "Script" })}
                      </span>
                      <EvaIcon name={p.projectType === "web" ? "monitor-outline" : "code-outline"} size={16} className="text-hint" />
                    </div>
                    <div>
                      <h3 className="truncate font-medium text-primary">{p.name}</h3>
                      <p className="mt-1 text-xs text-hint">
                        {t("web:practice.codingProjects.fileSummary", {
                          defaultValue: "{{count}} file(s) · {{size}}",
                          count: p.fileCount,
                          size: formatSize(p.totalSizeBytes),
                        })}
                      </p>
                      {p.updatedAt && (
                        <p className="mt-0.5 text-xs text-hint">
                          {t("web:practice.codingProjects.updatedAt", { defaultValue: "Updated {{date}}", date: formatDate(p.updatedAt) })}
                        </p>
                      )}
                    </div>
                  </Link>
                  <div className="mt-1 flex items-center gap-2 border-t border-border pt-3">
                    <button
                      type="button"
                      onClick={() => onRename(p)}
                      disabled={busyId === p.id}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-hint hover:bg-surface-3 hover:text-primary disabled:opacity-50"
                    >
                      <EvaIcon name="edit-2-outline" size={14} />
                      {t("common:rename", { defaultValue: "Rename" })}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(p)}
                      disabled={busyId === p.id}
                      className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-hint hover:bg-surface-3 hover:text-danger disabled:opacity-50"
                    >
                      <EvaIcon name="trash-2-outline" size={14} />
                      {t("common:delete", { defaultValue: "Delete" })}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <NewProjectModal
          open={showNewModal}
          onClose={() => {
            setShowNewModal(false);
            setCreateError(null);
          }}
          onCreate={onCreate}
          creating={creating}
          error={createError}
        />
      </AppShell>
    </RequireAuth>
  );
}
