"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/resume_gen.py
//   POST /api/v1/resume/cover-letter -> {cover_letter: str}
//   body: {company?, role?, hiring_manager?, jd_text?} — at least one of company/role/jd_text required
export default function CoverLetterPage() {
  const { t } = useTranslation();
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [hiringManager, setHiringManager] = useState("");
  const [jdText, setJdText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [letter, setLetter] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canSubmit = company.trim() || role.trim() || jdText.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setLetter(null);
    try {
      const data = await apiClient.post<{ cover_letter: string }>("/api/v1/resume/cover-letter", {
        company: company.trim() || undefined,
        role: role.trim() || undefined,
        hiring_manager: hiringManager.trim() || undefined,
        jd_text: jdText.trim() || undefined,
      });
      setLetter(data.cover_letter);
    } catch (err) {
      setError((err as ApiError).message || t("web:resume.coverLetter.generateFailedDefault", { defaultValue: "Couldn't generate a cover letter right now." }));
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!letter) return;
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — no-op
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:resume.coverLetter.title", { defaultValue: "Cover Letter Generator" })}
            subtitle={t("web:resume.coverLetter.subtitle", { defaultValue: "Generate a tailored cover letter from your resume and a target role." })}
          />

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField
                label={t("web:resume.coverLetter.companyLabel", { defaultValue: "Company" })}
                placeholder={t("web:resume.coverLetter.companyPlaceholder", { defaultValue: "e.g. Acme Corp" })}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
              <TextField
                label={t("web:resume.coverLetter.roleLabel", { defaultValue: "Role" })}
                placeholder={t("web:resume.coverLetter.rolePlaceholder", { defaultValue: "e.g. Product Manager" })}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
            <TextField
              label={t("web:resume.coverLetter.hiringManagerLabel", { defaultValue: "Hiring manager (optional)" })}
              placeholder={t("web:resume.coverLetter.hiringManagerPlaceholder", { defaultValue: "e.g. Jane Smith" })}
              value={hiringManager}
              onChange={(e) => setHiringManager(e.target.value)}
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-primary">{t("web:resume.coverLetter.jdLabel", { defaultValue: "Job description (optional)" })}</span>
              <textarea
                rows={4}
                placeholder={t("web:resume.coverLetter.jdPlaceholder", { defaultValue: "Paste a job posting — company/role can be left blank if it's here" })}
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </label>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" disabled={loading || !canSubmit} className="mt-1 w-full">
              {loading ? t("web:resume.coverLetter.generating", { defaultValue: "Generating…" }) : t("web:resume.coverLetter.generateCoverLetter", { defaultValue: "Generate cover letter" })}
            </Button>
          </form>

          {letter && (
            <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-6">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-primary">{letter}</p>
              <Button variant="outline" size="sm" onClick={handleCopy} className="w-fit">
                {copied ? t("web:resume.coverLetter.copied", { defaultValue: "Copied!" }) : t("web:resume.coverLetter.copyLetter", { defaultValue: "Copy letter" })}
              </Button>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
