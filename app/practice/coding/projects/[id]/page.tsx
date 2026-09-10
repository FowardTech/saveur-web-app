"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import CodeMirror from "@uiw/react-codemirror";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { FileTree } from "@/components/coding/FileTree";
import { RunPanel } from "@/components/coding/RunPanel";
import type { ApiError } from "@/lib/apiClient";
import { useAuth } from "@/app/providers/AuthProvider";
import * as projectsService from "@/lib/codingProjectsService";
import type { CodingProjectDetail, RunResult } from "@/lib/codingProjectsService";
import { buildFileTree, isUnderOrEqual, remapPath, sanitizeProjectPath, type TreeNode } from "@/lib/codingProjectsTree";
import { languageExtensionForPath, guessRunLanguage } from "@/lib/codingProjectsLanguage";
import { buildProjectPreviewHtml } from "@/lib/codingProjectsPreview";

const MAX_PROJECT_BYTES = projectsService.MAX_PROJECT_BYTES;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * The actual VS-Code-like editor for one saved Coding Project — file tree +
 * tabs + CodeMirror + Save (full-tree PUT) + Run (script projects) / Preview
 * (web projects, client-side iframe). See this feature's other pieces:
 *   - lib/codingProjectsService.ts — backend contract
 *   - lib/codingProjectsTree.ts — pure tree/path helpers
 *   - lib/codingProjectsLanguage.ts — CodeMirror language-by-extension
 *   - lib/codingProjectsPreview.ts — "web" project iframe srcDoc builder
 *   - components/coding/FileTree.tsx, components/coding/RunPanel.tsx
 *
 * Everything about the file tree (create/rename/delete) is client-side-only
 * state — Saveur-Backend's PUT .../files is a full authoritative replace
 * (any path not sent is deleted server-side), so nothing here talks to the
 * server until the user hits Save, matching the product ask ("Autosave is
 * NOT required... explicit Save button is fine").
 */
export default function CodingProjectEditorPage() {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const params = useParams<{ id: string }>();
  const projectId = params?.id;
  const { loading: authLoading } = useAuth();

  const [project, setProject] = useState<CodingProjectDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [addonRequired, setAddonRequired] = useState(false);

  // `files`: current in-memory content, path -> text. `savedFiles`: the last
  // persisted snapshot (from load or a successful Save) — diffing the two
  // drives every "unsaved changes" indicator on this page.
  const [files, setFiles] = useState<Record<string, string>>({});
  const [savedFiles, setSavedFiles] = useState<Record<string, string>>({});
  const [emptyFolders, setEmptyFolders] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const [languages, setLanguages] = useState<string[]>([]);
  const [runLanguage, setRunLanguage] = useState("python");
  const [stdin, setStdin] = useState("");
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [projectName, setProjectName] = useState("");

  // ---- Load ----------------------------------------------------------
  useEffect(() => {
    if (authLoading || !projectId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await projectsService.getProject(projectId);
        if (cancelled) return;
        setProject(data);
        setProjectName(data.name);
        const map: Record<string, string> = {};
        data.files.forEach((f) => {
          map[f.path] = f.content;
        });
        setFiles(map);
        setSavedFiles(map);
        const firstFile = data.files[0]?.path ?? null;
        setOpenTabs(firstFile ? [firstFile] : []);
        setActiveTab(firstFile);
        setExpanded(new Set(data.files.map((f) => f.path.split("/").slice(0, -1).join("/")).filter(Boolean)));
        if (data.projectType === "script") {
          setRunLanguage(data.languageHint || guessRunLanguage(firstFile || "") || "python");
        } else {
          setPreviewOpen(true);
        }
      } catch (err) {
        if (cancelled) return;
        const apiErr = err as ApiError;
        if (apiErr.status === 402) setAddonRequired(true);
        else if (apiErr.status === 404) setProject(null);
        else setError(apiErr.message || t("web:practice.codingProjects.detailLoadFailedDefault", { defaultValue: "Couldn't load this project right now." }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, projectId]);

  useEffect(() => {
    if (project?.projectType !== "script") return;
    projectsService
      .getLanguages()
      .then(setLanguages)
      .catch(() => setLanguages([]));
  }, [project?.projectType]);

  // ---- Derived state ---------------------------------------------------
  const tree = useMemo(() => buildFileTree(Object.keys(files), Array.from(emptyFolders)), [files, emptyFolders]);

  const dirtyPaths = useMemo(() => {
    const set = new Set<string>();
    for (const [path, content] of Object.entries(files)) {
      if (savedFiles[path] === undefined || savedFiles[path] !== content) set.add(path);
    }
    return set;
  }, [files, savedFiles]);

  const isDirty = useMemo(() => {
    if (dirtyPaths.size > 0) return true;
    return Object.keys(savedFiles).some((p) => files[p] === undefined);
  }, [dirtyPaths, savedFiles, files]);

  const totalBytes = useMemo(() => {
    let sum = 0;
    for (const content of Object.values(files)) sum += new TextEncoder().encode(content).length;
    return sum;
  }, [files]);
  const nearOrOverLimit = totalBytes > MAX_PROJECT_BYTES * 0.9;
  const overLimit = totalBytes > MAX_PROJECT_BYTES;

  const previewHtml = useMemo(() => (project?.projectType === "web" ? buildProjectPreviewHtml(files) : ""), [files, project?.projectType]);

  // ---- Unsaved-changes guards -------------------------------------------
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function confirmDiscardIfDirty(): boolean {
    if (!isDirty) return true;
    return window.confirm(t("web:practice.codingProjects.unsavedNavigateConfirm", { defaultValue: "You have unsaved changes. Leave without saving?" }).toString());
  }

  function onBackClick(e: React.MouseEvent) {
    if (!confirmDiscardIfDirty()) e.preventDefault();
  }

  // ---- File tree mutations (client-side only) ---------------------------
  function toggleExpand(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function openTab(path: string) {
    setOpenTabs((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveTab(path);
  }

  function closeTab(path: string) {
    setOpenTabs((prev) => {
      const next = prev.filter((p) => p !== path);
      if (activeTab === path) setActiveTab(next.length ? next[next.length - 1] : null);
      return next;
    });
  }

  function handleNewFile(basePath?: string) {
    const suggestion = basePath ? `${basePath}/` : "";
    const raw = window.prompt(t("web:practice.codingProjects.newFilePrompt", { defaultValue: "New file path (e.g. src/index.js)" }).toString(), suggestion);
    if (raw == null) return;
    const path = sanitizeProjectPath(raw);
    if (!path) {
      window.alert(t("web:practice.codingProjects.invalidPath", { defaultValue: "That's not a valid file path." }).toString());
      return;
    }
    if (files[path] !== undefined) {
      window.alert(t("web:practice.codingProjects.pathExists", { defaultValue: "A file already exists at that path." }).toString());
      return;
    }
    setFiles((prev) => ({ ...prev, [path]: "" }));
    if (basePath) setExpanded((prev) => new Set(prev).add(basePath));
    openTab(path);
  }

  function handleNewFolder(basePath?: string) {
    const suggestion = basePath ? `${basePath}/` : "";
    const raw = window.prompt(t("web:practice.codingProjects.newFolderPrompt", { defaultValue: "New folder path (e.g. src/components)" }).toString(), suggestion);
    if (raw == null) return;
    const path = sanitizeProjectPath(raw);
    if (!path) {
      window.alert(t("web:practice.codingProjects.invalidPath", { defaultValue: "That's not a valid file path." }).toString());
      return;
    }
    setEmptyFolders((prev) => new Set(prev).add(path));
    setExpanded((prev) => new Set(prev).add(path));
  }

  function handleRenameNode(node: TreeNode) {
    const raw = window.prompt(t("web:practice.codingProjects.renamePathPrompt", { defaultValue: "Rename to" }).toString(), node.path);
    if (raw == null) return;
    const newPath = sanitizeProjectPath(raw);
    if (!newPath || newPath === node.path) return;

    if (node.type === "file") {
      if (files[newPath] !== undefined) {
        window.alert(t("web:practice.codingProjects.pathExists", { defaultValue: "A file already exists at that path." }).toString());
        return;
      }
      setFiles((prev) => {
        const next = { ...prev };
        const content = next[node.path];
        delete next[node.path];
        next[newPath] = content;
        return next;
      });
      setOpenTabs((prev) => prev.map((p) => remapPath(p, node.path, newPath)));
      setActiveTab((prev) => (prev ? remapPath(prev, node.path, newPath) : prev));
    } else {
      setFiles((prev) => {
        const next: Record<string, string> = {};
        for (const [p, c] of Object.entries(prev)) next[remapPath(p, node.path, newPath)] = c;
        return next;
      });
      setEmptyFolders((prev) => new Set(Array.from(prev).map((p) => remapPath(p, node.path, newPath))));
      setOpenTabs((prev) => prev.map((p) => remapPath(p, node.path, newPath)));
      setActiveTab((prev) => (prev ? remapPath(prev, node.path, newPath) : prev));
      setExpanded((prev) => new Set(Array.from(prev).map((p) => remapPath(p, node.path, newPath))));
    }
  }

  function handleDeleteNode(node: TreeNode) {
    const confirmMsg =
      node.type === "folder"
        ? t("web:practice.codingProjects.deleteFolderConfirm", { defaultValue: 'Delete "{{name}}" and everything inside it?', name: node.name })
        : t("web:practice.codingProjects.deleteFileConfirm", { defaultValue: 'Delete "{{name}}"?', name: node.name });
    if (!window.confirm(confirmMsg.toString())) return;

    setFiles((prev) => {
      const next: Record<string, string> = {};
      for (const [p, c] of Object.entries(prev)) if (!isUnderOrEqual(p, node.path)) next[p] = c;
      return next;
    });
    setEmptyFolders((prev) => new Set(Array.from(prev).filter((p) => !isUnderOrEqual(p, node.path))));
    setOpenTabs((prev) => {
      const next = prev.filter((p) => !isUnderOrEqual(p, node.path));
      if (activeTab && isUnderOrEqual(activeTab, node.path)) setActiveTab(next.length ? next[next.length - 1] : null);
      return next;
    });
  }

  // ---- Save / Run --------------------------------------------------------
  const saveFiles = useCallback(async (): Promise<CodingProjectDetail> => {
    if (!project) throw new Error("no project");
    const filesArray = Object.entries(files).map(([path, content]) => ({ path, content }));
    const updated = await projectsService.saveProjectFiles(project.id, filesArray);
    const map: Record<string, string> = {};
    updated.files.forEach((f) => {
      map[f.path] = f.content;
    });
    setSavedFiles(map);
    setProject(updated);
    setLastSavedAt(Date.now());
    return updated;
  }, [project, files]);

  async function handleSaveClick() {
    if (overLimit) {
      setSaveError(
        t("web:practice.codingProjects.tooLargeClientSide", {
          defaultValue: "This project is {{actual}}, which is over the 50 MB limit ({{max}}). Remove or shrink some files before saving.",
          actual: formatBytes(totalBytes),
          max: formatBytes(MAX_PROJECT_BYTES),
        }).toString()
      );
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveFiles();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 413) {
        setSaveError(
          t("web:practice.codingProjects.tooLargeServerSide", {
            defaultValue: "Save failed: this project is over the 50 MB limit. Remove or shrink some files and try again.",
          }).toString()
        );
      } else {
        setSaveError(apiErr.message || t("web:practice.codingProjects.saveFailedDefault", { defaultValue: "Couldn't save your changes. Please try again." }));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRun() {
    if (!project || project.projectType !== "script" || !activeTab) return;
    setBottomPanelOpen(true);
    setRunning(true);
    setRunError(null);
    setRunResult(null);
    try {
      // The run endpoint executes the SAVED content of entry_path, so make
      // sure the server actually has what's currently in the editor first.
      if (isDirty) await saveFiles();
      const result = await projectsService.runProject(project.id, activeTab, runLanguage, stdin);
      setRunResult(result);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 413) {
        setRunError(t("web:practice.codingProjects.tooLargeServerSide", { defaultValue: "Save failed: this project is over the 50 MB limit. Remove or shrink some files and try again." }));
      } else {
        setRunError(apiErr.message || t("web:practice.codingProjects.runFailedDefault", { defaultValue: "Couldn't run this project right now." }));
      }
    } finally {
      setRunning(false);
    }
  }

  async function onRenameProject() {
    if (!project) return;
    const next = window.prompt(t("web:practice.codingProjects.renamePrompt", { defaultValue: "Rename project" }).toString(), project.name);
    if (!next || !next.trim() || next.trim() === project.name) return;
    try {
      const updated = await projectsService.renameProject(project.id, next.trim());
      setProjectName(updated.name);
      setProject((prev) => (prev ? { ...prev, name: updated.name, updatedAt: updated.updatedAt } : prev));
    } catch {
      // no-op — title stays as-is if rename genuinely failed
    }
  }

  // ---- Render -------------------------------------------------------
  if (project === null) {
    return (
      <RequireAuth>
        <AppShell>
          <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-10">
            <Link href="/practice/coding/projects" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-hint hover:text-primary">
              <EvaIcon name="chevron-left-outline" size={16} />
              {t("web:practice.codingProjects.backToProjects", { defaultValue: "Back to My Projects" })}
            </Link>
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 text-hint">
                <EvaIcon name="alert-circle-outline" size={20} />
              </span>
              <h1 className="font-semibold text-primary">{t("web:practice.codingProjects.notFoundTitle", { defaultValue: "This project isn't available" })}</h1>
              <p className="text-sm text-hint">{t("web:practice.codingProjects.notFoundSubtitle", { defaultValue: "It may have been deleted." })}</p>
            </div>
          </div>
        </AppShell>
      </RequireAuth>
    );
  }

  if (addonRequired) {
    return (
      <RequireAuth>
        <AppShell>
          <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-10">
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h1 className="font-semibold text-primary">{t("web:practice.coding.addonRequiredTitle", { defaultValue: "Coding Practice is a paid add-on" })}</h1>
              <p className="text-sm text-hint">
                {t("web:practice.coding.addonRequiredSubtitle", { defaultValue: "Purchase the Coding Practice add-on from your account to unlock the full problem set and code review." })}
              </p>
            </div>
          </div>
        </AppShell>
      </RequireAuth>
    );
  }

  if (error) {
    return (
      <RequireAuth>
        <AppShell>
          <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-10">
            <p className="text-sm text-danger">{error}</p>
          </div>
        </AppShell>
      </RequireAuth>
    );
  }

  if (project === undefined) {
    return (
      <RequireAuth>
        <AppShell>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-[70vh] rounded-card" />
          </div>
        </AppShell>
      </RequireAuth>
    );
  }

  const isWeb = project.projectType === "web";

  return (
    <RequireAuth>
      <AppShell>
        <div className="flex h-[calc(100vh-6.5rem)] flex-col gap-3">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Link href="/practice/coding/projects" onClick={onBackClick} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-hint hover:text-primary">
                <EvaIcon name="chevron-left-outline" size={16} />
                {t("web:practice.codingProjects.backToProjects", { defaultValue: "Back to My Projects" })}
              </Link>
              <span className="text-hint">/</span>
              <button type="button" onClick={onRenameProject} className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-primary hover:text-brand" title={t("common:rename", { defaultValue: "Rename" }).toString()}>
                <span className="truncate">{projectName}</span>
                <EvaIcon name="edit-2-outline" size={13} className="shrink-0 text-hint" />
              </button>
              <span className={`ml-1 shrink-0 rounded-pill px-2 py-0.5 text-xs font-medium ${isWeb ? "bg-tint-purple text-tint-purple-text" : "bg-tint-mint text-tint-mint-text"}`}>
                {isWeb ? t("web:practice.codingProjects.typeWeb", { defaultValue: "Web Project" }) : t("web:practice.codingProjects.typeScript", { defaultValue: "Script" })}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs ${overLimit ? "font-semibold text-danger" : nearOrOverLimit ? "text-warning-text" : "text-hint"}`}>
                {formatBytes(totalBytes)} / {formatBytes(MAX_PROJECT_BYTES)}
              </span>
              {isWeb ? (
                <Button type="button" variant={previewOpen ? "secondary" : "outline"} size="sm" onClick={() => setPreviewOpen((v) => !v)}>
                  <EvaIcon name="monitor-outline" size={14} />
                  {t("web:practice.codingProjects.preview", { defaultValue: "Preview" })}
                </Button>
              ) : (
                <Button type="button" variant={bottomPanelOpen ? "secondary" : "outline"} size="sm" onClick={() => (bottomPanelOpen ? setBottomPanelOpen(false) : handleRun())} disabled={running}>
                  <EvaIcon name="play-circle-outline" size={14} />
                  {running ? t("web:practice.codingProjects.running", { defaultValue: "Running…" }) : t("web:practice.codingProjects.run", { defaultValue: "Run" })}
                </Button>
              )}
              <Button type="button" size="sm" onClick={handleSaveClick} disabled={saving || !isDirty}>
                <EvaIcon name="save-outline" size={14} />
                {saving ? t("web:practice.codingProjects.saving", { defaultValue: "Saving…" }) : isDirty ? t("web:practice.codingProjects.saveUnsaved", { defaultValue: "Save*" }) : t("web:practice.codingProjects.saved", { defaultValue: "Saved" })}
              </Button>
            </div>
          </div>

          {saveError && <p className="text-sm text-danger">{saveError}</p>}
          {!saveError && lastSavedAt && !isDirty && (
            <p className="text-xs text-hint">{t("web:practice.codingProjects.lastSaved", { defaultValue: "Saved just now" })}</p>
          )}

          {/* Body: tree + editor(+preview) */}
          <div className="flex min-h-0 flex-1 overflow-hidden rounded-card border border-border">
            <div className="w-56 shrink-0 border-r border-border bg-surface-2">
              <FileTree
                tree={tree}
                activePath={activeTab}
                dirtyPaths={dirtyPaths}
                expanded={expanded}
                onToggleExpand={toggleExpand}
                onOpenFile={openTab}
                onNewFile={handleNewFile}
                onNewFolder={handleNewFolder}
                onRename={handleRenameNode}
                onDelete={handleDeleteNode}
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              {/* Tabs */}
              <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border bg-surface-2 px-1 py-1">
                {openTabs.length === 0 && <span className="px-2 py-1 text-xs text-hint">{t("web:practice.codingProjects.noTabsOpen", { defaultValue: "No files open — pick one from the tree." })}</span>}
                {openTabs.map((path) => (
                  <div
                    key={path}
                    onClick={() => setActiveTab(path)}
                    className={`flex shrink-0 cursor-pointer items-center gap-1.5 rounded-t px-3 py-1.5 text-xs ${activeTab === path ? "bg-surface-1 font-medium text-primary" : "text-hint hover:bg-surface-3"}`}
                  >
                    <span className="max-w-[10rem] truncate">{path.split("/").pop()}</span>
                    {dirtyPaths.has(path) && <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(path);
                      }}
                      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-surface-4"
                      aria-label={t("common:actions.close", { defaultValue: "Close" }).toString()}
                    >
                      <EvaIcon name="close-outline" size={11} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Editor + optional preview side pane */}
              <div className="flex min-h-0 flex-1">
                <div className={`min-h-0 flex-1 ${isWeb && previewOpen ? "w-1/2" : "w-full"}`}>
                  {activeTab ? (
                    <CodeMirror
                      key={activeTab}
                      value={files[activeTab] ?? ""}
                      height="100%"
                      theme={resolvedTheme === "dark" ? "dark" : "light"}
                      extensions={languageExtensionForPath(activeTab)}
                      onChange={(value) => setFiles((prev) => ({ ...prev, [activeTab]: value }))}
                      style={{ height: "100%" }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-hint">
                      {t("web:practice.codingProjects.emptyEditor", { defaultValue: "Open a file from the tree, or create a new one, to start editing." })}
                    </div>
                  )}
                </div>
                {isWeb && previewOpen && (
                  <div className="min-h-0 w-1/2 shrink-0 border-l border-border bg-white">
                    <iframe title="Project preview" srcDoc={previewHtml} sandbox="allow-scripts allow-forms allow-modals allow-popups" className="h-full w-full border-0" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom run panel (script projects only) */}
          {!isWeb && bottomPanelOpen && (
            <div className="h-64 shrink-0 overflow-hidden rounded-card border border-border">
              <RunPanel
                languages={languages.length ? languages : [runLanguage]}
                language={runLanguage}
                onLanguageChange={setRunLanguage}
                stdin={stdin}
                onStdinChange={setStdin}
                entryPath={activeTab}
                running={running}
                onRun={handleRun}
                result={runResult}
                error={runError}
                onClose={() => setBottomPanelOpen(false)}
              />
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
