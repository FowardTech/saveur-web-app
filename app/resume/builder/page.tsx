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

// Real backend contract — Saveur-Backend/app/api/resume.py + resume_gen.py
//   GET   /api/v1/resume         -> {sources, sections, ats_score}
//   PATCH /api/v1/resume         -> saves {sections} merge-patch, returns the same shape
//   POST  /api/v1/resume/generate -> full tailored `sections` object (body: {target_role, jd_text?})
//   POST  /api/v1/resume/ats-score -> {score, suggestions} (also persists onto the primary resume row)
type Sections = Record<string, unknown>;

interface ResumePayload {
  sources: { source_key: string; file_name: string }[];
  sections: Sections;
  ats_score: number | null;
}

function renderSectionValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .join(" · ");
  }
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value ?? "");
}

export default function ResumeBuilderPage() {
  const { t } = useTranslation();
  const [resume, setResume] = useState<ResumePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState("");
  const [jdText, setJdText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [atsResult, setAtsResult] = useState<{ score: number; suggestions: string[] } | null>(null);

  const SECTION_LABELS: Record<string, string> = {
    contact: t("web:resume.builder.sections.contact", { defaultValue: "Contact" }),
    summary: t("web:resume.builder.sections.summary", { defaultValue: "Professional Summary" }),
    professional_summary: t("web:resume.builder.sections.professional_summary", { defaultValue: "Professional Summary" }),
    core_skills: t("web:resume.builder.sections.core_skills", { defaultValue: "Core Skills" }),
    skills: t("web:resume.builder.sections.skills", { defaultValue: "Skills" }),
    experience: t("web:resume.builder.sections.experience", { defaultValue: "Professional Experience" }),
    professional_experience: t("web:resume.builder.sections.professional_experience", { defaultValue: "Professional Experience" }),
    education: t("web:resume.builder.sections.education", { defaultValue: "Education" }),
    projects: t("web:resume.builder.sections.projects", { defaultValue: "Projects" }),
    certifications: t("web:resume.builder.sections.certifications", { defaultValue: "Certifications" }),
  };

  async function load() {
    try {
      const data = await apiClient.get<ResumePayload>("/api/v1/resume");
      setResume(data);
    } catch (err) {
      setError((err as ApiError).message || t("web:resume.builder.loadFailedDefault", { defaultValue: "Couldn't load your resume." }));
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
      const sections = await apiClient.post<Sections>("/api/v1/resume/generate", {
        target_role: targetRole.trim(),
        jd_text: jdText.trim() || undefined,
      });
      const saved = await apiClient.patch<ResumePayload>("/api/v1/resume", { sections });
      setResume(saved);
    } catch (err) {
      setError((err as ApiError).message || t("web:resume.builder.generateFailedDefault", { defaultValue: "Couldn't generate a resume right now." }));
    } finally {
      setGenerating(false);
    }
  }

  async function handleAtsScore() {
    setScoring(true);
    setError(null);
    setAtsResult(null);
    try {
      const data = await apiClient.post<{ score: number; suggestions: string[] }>("/api/v1/resume/ats-score", {});
      setAtsResult(data);
    } catch (err) {
      setError((err as ApiError).message || t("web:resume.builder.scoreFailedDefault", { defaultValue: "Couldn't score your resume right now." }));
    } finally {
      setScoring(false);
    }
  }

  const sectionEntries = resume ? Object.entries(resume.sections || {}) : [];

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:resume.builder.title", { defaultValue: "Resume Builder" })}
            subtitle={t("web:resume.builder.subtitle", { defaultValue: "Generate an AI-tailored resume, or check your current one's ATS score." })}
          />

          {error && <p className="text-sm text-danger">{error}</p>}

          <form onSubmit={handleGenerate} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <h2 className="font-semibold text-primary">{t("web:resume.builder.generateSectionTitle", { defaultValue: "Generate a tailored resume" })}</h2>
            <TextField
              label={t("web:resume.builder.targetRoleLabel", { defaultValue: "Target role" })}
              placeholder={t("web:resume.builder.targetRolePlaceholder", { defaultValue: "e.g. Senior Backend Engineer" })}
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              required
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-primary">{t("web:resume.builder.jdLabel", { defaultValue: "Job description (optional)" })}</span>
              <textarea
                rows={4}
                placeholder={t("web:resume.builder.jdPlaceholder", { defaultValue: "Paste a job posting to tailor your resume to it" })}
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <Button type="submit" disabled={generating || !targetRole.trim()} className="mt-1 w-full">
              {generating ? t("web:resume.builder.generating", { defaultValue: "Generating…" }) : t("web:resume.builder.generateResume", { defaultValue: "Generate resume" })}
            </Button>
          </form>

          {resume && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-card border border-border bg-surface-2 p-5">
                <div>
                  <h2 className="font-semibold text-primary">{t("web:resume.builder.yourResume", { defaultValue: "Your resume" })}</h2>
                  <p className="text-sm text-hint">
                    {resume.ats_score != null
                      ? t("web:resume.builder.atsScoreLabel", { defaultValue: "ATS score: {{score}}/100", score: resume.ats_score })
                      : t("web:resume.builder.noAtsScore", { defaultValue: "No ATS score yet" })}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleAtsScore} disabled={scoring}>
                  {scoring ? t("web:resume.builder.scoring", { defaultValue: "Scoring…" }) : t("web:resume.builder.checkAtsScore", { defaultValue: "Check ATS score" })}
                </Button>
              </div>

              {atsResult && (
                <div className="rounded-card border border-border bg-surface-2 p-5">
                  <p className="font-semibold text-primary">{t("web:resume.builder.scoreLabel", { defaultValue: "Score: {{score}}/100", score: atsResult.score })}</p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {(atsResult.suggestions || []).map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-hint">
                        <EvaIcon name="checkmark-outline" size={14} className="mt-0.5 shrink-0 text-success-text" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {sectionEntries.length === 0 ? (
                <p className="text-sm text-hint">
                  {t("web:resume.builder.noContent", { defaultValue: "No resume content yet — generate one above, or upload an existing resume from My Documents." })}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {sectionEntries.map(([key, value]) => (
                    <div key={key} className="rounded-card border border-border bg-surface-2 p-4">
                      <h3 className="text-sm font-semibold text-primary">{SECTION_LABELS[key] || key}</h3>
                      <p className="mt-1.5 text-sm text-hint">{renderSectionValue(value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
