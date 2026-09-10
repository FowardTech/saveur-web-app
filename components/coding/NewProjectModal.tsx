"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import * as projectsService from "@/lib/codingProjectsService";
import type { ProjectType } from "@/lib/codingProjectsService";

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, projectType: ProjectType, languageHint?: string) => void | Promise<void>;
  creating: boolean;
  error: string | null;
}

/** "New Project" dialog — name + type ("Web Project (HTML/CSS/JS)" vs
 * "Script (run code)"), matching the modal shape ShareToUserModal.tsx and
 * WelcomeModal.tsx already use elsewhere in this app. When "Script" is
 * picked, also offers a language hint from GET /api/v1/coding/languages
 * (the same Judge0-backed list the single-file problem editor already
 * relies on) so the project's run panel can default sensibly. */
export function NewProjectModal({ open, onClose, onCreate, creating, error }: NewProjectModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("web");
  const [languages, setLanguages] = useState<string[]>([]);
  const [languageHint, setLanguageHint] = useState("");

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName("");
      setProjectType("web");
      setLanguageHint("");
      return;
    }
    projectsService
      .getLanguages()
      .then((list) => {
        setLanguages(list);
        if (list.length && !languageHint) setLanguageHint(list.includes("python") ? "python" : list[0]);
      })
      .catch(() => setLanguages([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const canCreate = name.trim().length > 0 && !creating;

  function submit() {
    if (!canCreate) return;
    onCreate(name.trim(), projectType, projectType === "script" ? languageHint : undefined);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-card border border-border bg-surface-2 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-primary">{t("web:practice.codingProjects.newProjectTitle", { defaultValue: "New project" })}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common:actions.close", { defaultValue: "Close" })}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-hint hover:bg-surface-3"
          >
            <EvaIcon name="close-outline" size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <TextField
            label={t("web:practice.codingProjects.nameLabel", { defaultValue: "Project name" })}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("web:practice.codingProjects.namePlaceholder", { defaultValue: "My landing page" }).toString()}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-primary">{t("web:practice.codingProjects.typeLabel", { defaultValue: "Project type" })}</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setProjectType("web")}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition ${
                  projectType === "web" ? "border-brand bg-brand/5" : "border-border hover:bg-surface-3"
                }`}
              >
                <EvaIcon name="monitor-outline" size={18} className={projectType === "web" ? "text-brand" : "text-hint"} />
                <span className="text-sm font-medium text-primary">{t("web:practice.codingProjects.typeWeb", { defaultValue: "Web Project" })}</span>
                <span className="text-xs text-hint">{t("web:practice.codingProjects.typeWebHint", { defaultValue: "HTML/CSS/JS" })}</span>
              </button>
              <button
                type="button"
                onClick={() => setProjectType("script")}
                className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition ${
                  projectType === "script" ? "border-brand bg-brand/5" : "border-border hover:bg-surface-3"
                }`}
              >
                <EvaIcon name="code-outline" size={18} className={projectType === "script" ? "text-brand" : "text-hint"} />
                <span className="text-sm font-medium text-primary">{t("web:practice.codingProjects.typeScript", { defaultValue: "Script" })}</span>
                <span className="text-xs text-hint">{t("web:practice.codingProjects.typeScriptHint", { defaultValue: "Run code" })}</span>
              </button>
            </div>
          </div>

          {projectType === "script" && languages.length > 0 && (
            <SelectField
              label={t("web:practice.codingProjects.languageLabel", { defaultValue: "Primary language" })}
              value={languageHint}
              onChange={(e) => setLanguageHint(e.target.value)}
            >
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </SelectField>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="button" onClick={submit} disabled={!canCreate} className="w-full justify-center">
            {creating ? t("web:practice.codingProjects.creating", { defaultValue: "Creating…" }) : t("web:practice.codingProjects.create", { defaultValue: "Create project" })}
          </Button>
        </div>
      </div>
    </div>
  );
}
