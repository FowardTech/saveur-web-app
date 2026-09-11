"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EvaIcon, type EvaIconName } from "@/components/icons/EvaIcon";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { DocumentPickerModal } from "@/components/documents/DocumentPickerModal";
import { useAuth } from "@/app/providers/AuthProvider";
import apiClient, { type ApiError } from "@/lib/apiClient";
import * as resumeService from "@/lib/resumeService";
import type { ImportedFileInfo, ResumeImportSourceKey } from "@/lib/resumeService";
import type { DocumentRecord } from "@/lib/documentsService";

// "Import from" grid — web port of Saveur (mobile)'s src/more/
// ResumeBuilder.tsx import cards. Real backend: POST /api/v1/resume/upload
// (source_key: resume|linkedin|portfolio|certificates|transcript), state
// mirrored from GET /api/v1/resume's `sources`. A browser <input
// type="file"> covers mobile's "choose from device"; "choose from My
// Documents" reuses the same DocumentPickerModal JD Analyzer's tailor flow
// uses.
const IMPORT_OPTIONS: { key: ResumeImportSourceKey; labelKey: string; labelDefault: string; icon: EvaIconName }[] = [
  { key: "resume", labelKey: "web:resume.builder.import.resume", labelDefault: "Resume", icon: "file-text-outline" },
  { key: "linkedin", labelKey: "web:resume.builder.import.linkedin", labelDefault: "LinkedIn", icon: "linkedin-outline" },
  { key: "portfolio", labelKey: "web:resume.builder.import.portfolio", labelDefault: "Portfolio", icon: "briefcase-outline" },
  { key: "certificates", labelKey: "web:resume.builder.import.certificates", labelDefault: "Certificates", icon: "award-outline" },
  { key: "transcript", labelKey: "web:resume.builder.import.transcript", labelDefault: "Transcript", icon: "book-open-outline" },
];

// Real backend contract — Saveur-Backend/app/api/resume.py + resume_gen.py.
// Unlike mobile (whole ResumeBuilder.tsx screen wrapped in
// `if (!isPro) return <ProLockGate variant="pro" .../>`), the backend only
// actually enforces @require_pro on POST /api/v1/resume/generate — viewing
// your resume (GET), the ATS score check, and the bullet rewrite are all
// ungated at the API level (no @require_pro on resume.py's routes at all).
// So rather than blocking the whole page (which would over-restrict a free
// user away from features the backend genuinely lets them use), only the
// "Generate a tailored resume" action shows the upsell — reactively, on the
// real 402 from /generate — matching what the backend actually requires.

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
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const [resume, setResume] = useState<ResumePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState("");
  const [jdText, setJdText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [proRequired, setProRequired] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [atsResult, setAtsResult] = useState<{ score: number; suggestions: string[] } | null>(null);
  // "Rewrite a Bullet with AI" — was entirely missing from this page (see
  // mobile's src/more/ResumeBuilder.tsx, POST /api/v1/resume/rewrite-bullet)
  // even though the backend endpoint already exists.
  const [bulletText, setBulletText] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [rewriteResult, setRewriteResult] = useState<{ rewritten: string; explanation: string } | null>(null);
  // Per-bullet "Rewrite with AI" launched from a real structured experience
  // bullet (see the experience-section render below) instead of the manual
  // paste box — tracks which exact sections[key][entryIndex].bullets[bulletIndex]
  // the current bulletText/rewriteResult came from, so "Apply to resume" can
  // write the rewritten text back to that exact spot via PATCH.
  const [activeBulletTarget, setActiveBulletTarget] = useState<{ sectionKey: string; entryIndex: number; bulletIndex: number; label: string } | null>(null);
  const [applyingBullet, setApplyingBullet] = useState(false);
  const rewriteCardRef = useRef<HTMLDivElement>(null);
  const targetRoleRef = useRef<HTMLInputElement>(null);
  const generateFormRef = useRef<HTMLFormElement>(null);

  // "Import from" grid state — see IMPORT_OPTIONS above.
  const [imported, setImported] = useState<Record<string, ImportedFileInfo>>({});
  const [importingKey, setImportingKey] = useState<ResumeImportSourceKey | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [documentPickerFor, setDocumentPickerFor] = useState<ResumeImportSourceKey | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImportKey, setPendingImportKey] = useState<ResumeImportSourceKey | null>(null);

  useEffect(() => {
    if (authLoading) return;
    resumeService.getImportedSources().then(setImported).catch(() => {});
  }, [authLoading]);

  function onPickDeviceFile(key: ResumeImportSourceKey) {
    setPendingImportKey(key);
    fileInputRef.current?.click();
  }

  async function onDeviceFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const key = pendingImportKey;
    setPendingImportKey(null);
    if (!file || !key) return;
    setImportingKey(key);
    setImportError(null);
    try {
      await resumeService.importSource(key, file);
      setImported((prev) => ({ ...prev, [key]: { name: file.name, sizeBytes: file.size, mimeType: file.type } }));
    } catch (err) {
      setImportError((err as ApiError).message || t("web:resume.builder.importFailedDefault", { defaultValue: "Upload failed. Please try again." }));
    } finally {
      setImportingKey(null);
    }
  }

  async function onPickFromMyDocuments(doc: DocumentRecord) {
    const key = documentPickerFor;
    setDocumentPickerFor(null);
    if (!key || !doc.url) return;
    setImportingKey(key);
    setImportError(null);
    try {
      await resumeService.importSourceFromUrl(key, doc.url, doc.name ?? t("web:resume.builder.documentFallbackName", { defaultValue: "Document" }).toString(), doc.mimeType);
      setImported((prev) => ({ ...prev, [key]: { name: doc.name ?? "Document", sizeBytes: doc.sizeBytes, mimeType: doc.mimeType } }));
    } catch (err) {
      setImportError((err as ApiError).message || t("web:resume.builder.importFailedDefault", { defaultValue: "Upload failed. Please try again." }));
    } finally {
      setImportingKey(null);
    }
  }

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
    // Raw text stored by POST /resume/upload before any AI generation has
    // run (Saveur-Backend/app/api/resume.py's upload() — parsed_json is
    // literally just {extracted_text: <raw blob>} at that point). Without
    // this entry it fell through to the literal key name "extracted_text"
    // as a section header, which is what the user's bug report screenshot
    // showed.
    extracted_text: t("web:resume.builder.sections.extracted_text", { defaultValue: "Uploaded Resume (unformatted)" }),
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
    if (authLoading) return;
    // Intentional fetch-on-mount — load() sets state once its async GET
    // resolves, not synchronously in this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // Core generation call, shared by the "Generate a tailored resume" form
  // submit AND the "Organize into editable sections with AI" CTA on the raw
  // extracted-text card below — same POST /resume/generate + PATCH
  // /resume flow either way, so the CTA path gets the exact same
  // Pro-gating (402/403 -> proRequired banner) and error handling instead
  // of a separate, less-safe request.
  async function runGenerate() {
    if (!targetRole.trim()) return;
    setGenerating(true);
    setError(null);
    setProRequired(false);
    try {
      const sections = await apiClient.post<Sections>("/api/v1/resume/generate", {
        target_role: targetRole.trim(),
        jd_text: jdText.trim() || undefined,
      });
      const saved = await apiClient.patch<ResumePayload>("/api/v1/resume", { sections });
      setResume(saved);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setProRequired(true);
      } else {
        setError(apiErr.message || t("web:resume.builder.generateFailedDefault", { defaultValue: "Couldn't generate a resume right now." }));
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    await runGenerate();
  }

  // "Organize into editable sections with AI" CTA on the raw
  // extracted_text card. Always scrolls to the "Generate a tailored
  // resume" form first, so the user sees the generating state and — if
  // this account isn't Pro — the existing proRequired upsell banner that
  // lives in that form, rather than a silent background request. If
  // target role isn't filled in yet (required by the backend), focuses it
  // instead of submitting an empty role.
  function handleOrganizeCta() {
    generateFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!targetRole.trim()) {
      window.setTimeout(() => targetRoleRef.current?.focus(), 350);
      return;
    }
    void runGenerate();
  }

  // Launched from a "Rewrite with AI" button on a real structured
  // experience bullet (see the experience-section render below) — pre-fills
  // the existing manual bulletText state instead of making the user
  // retype/copy-paste the bullet themselves, and remembers exactly which
  // bullet it came from so a later "Apply to resume" can write the
  // rewritten text back in place.
  function startBulletRewrite(sectionKey: string, entryIndex: number, bulletIndex: number, text: string, label: string) {
    setBulletText(text);
    setActiveBulletTarget({ sectionKey, entryIndex, bulletIndex, label });
    setRewriteResult(null);
    setError(null);
    rewriteCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Writes the just-rewritten bullet back into that exact
  // sections[sectionKey][entryIndex].bullets[bulletIndex] slot via the
  // existing PATCH /api/v1/resume endpoint, so the rewrite closes the loop
  // in place instead of only ever showing as a separate result the user has
  // to manually copy back into their resume.
  async function handleApplyBulletRewrite() {
    if (!activeBulletTarget || !rewriteResult || !resume) return;
    const { sectionKey, entryIndex, bulletIndex } = activeBulletTarget;
    const sectionValue = resume.sections[sectionKey];
    if (!Array.isArray(sectionValue)) return;
    const updatedSection = sectionValue.map((entry, i) => {
      if (i !== entryIndex || typeof entry !== "object" || entry === null) return entry;
      const record = entry as Record<string, unknown>;
      const bullets = Array.isArray(record.bullets) ? [...(record.bullets as unknown[])] : [];
      bullets[bulletIndex] = rewriteResult.rewritten;
      return { ...record, bullets };
    });
    setApplyingBullet(true);
    setError(null);
    try {
      const saved = await apiClient.patch<ResumePayload>("/api/v1/resume", { sections: { [sectionKey]: updatedSection } });
      setResume(saved);
      setActiveBulletTarget(null);
      setRewriteResult(null);
      setBulletText("");
    } catch (err) {
      setError((err as ApiError).message || t("web:resume.builder.applyBulletFailedDefault", { defaultValue: "Couldn't save that change right now." }));
    } finally {
      setApplyingBullet(false);
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

  async function handleRewriteBullet() {
    if (!bulletText.trim() || rewriting) return;
    setRewriting(true);
    setRewriteResult(null);
    try {
      const data = await apiClient.post<{ rewritten: string; explanation: string }>("/api/v1/resume/rewrite-bullet", {
        bullet: bulletText.trim(),
        role: targetRole.trim() || undefined,
      });
      setRewriteResult(data);
    } catch (err) {
      setError((err as ApiError).message || t("web:resume.builder.rewriteFailedDefault", { defaultValue: "Couldn't rewrite that bullet right now." }));
    } finally {
      setRewriting(false);
    }
  }

  const sectionEntries = resume ? Object.entries(resume.sections || {}) : [];

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:resume.builder.title", { defaultValue: "Resume Builder" })}
            subtitle={t("web:resume.builder.subtitle", { defaultValue: "Generate an AI-tailored resume, or check your current one's ATS score." })}
          />

          <div className="flex flex-wrap gap-2">
            <Link href="/documents" className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-2 px-3.5 py-2 text-sm font-medium text-primary hover:border-brand/40">
              <EvaIcon name="layers-outline" size={14} />
              {t("web:resume.builder.myDocumentsLink", { defaultValue: "My Documents" })}
            </Link>
            <Link href="/documents/generated" className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-2 px-3.5 py-2 text-sm font-medium text-primary hover:border-brand/40">
              <EvaIcon name="download-outline" size={14} />
              {t("web:resume.builder.generatedDocumentsLink", { defaultValue: "Generated Documents" })}
            </Link>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          {importError && <p className="text-sm text-danger">{importError}</p>}

          {/* "Import from" grid — mobile's ResumeBuilder.tsx equivalent
              (device picker or "choose from My Documents") for the five
              fixed source slots the backend tracks. */}
          <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <h2 className="font-semibold text-primary">{t("web:resume.builder.importFromTitle", { defaultValue: "Import from" })}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {IMPORT_OPTIONS.map((opt) => {
                const file = imported[opt.key];
                const busy = importingKey === opt.key;
                return (
                  <div key={opt.key} className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface-1 p-4 text-center">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white">
                      <EvaIcon name={opt.icon} size={16} />
                    </span>
                    <p className="text-sm font-semibold text-primary">{t(opt.labelKey, { defaultValue: opt.labelDefault })}</p>
                    <p className={`truncate text-xs ${file ? "text-success-text" : "text-hint"}`} title={file?.name}>
                      {busy ? t("web:resume.builder.uploading", { defaultValue: "Uploading…" }) : file ? file.name : t("web:resume.builder.tapToUpload", { defaultValue: "Tap to upload" })}
                    </p>
                    <div className="flex gap-1.5">
                      <button type="button" disabled={busy} onClick={() => onPickDeviceFile(opt.key)} className="text-xs font-medium text-brand hover:underline disabled:opacity-50">
                        {t("web:resume.builder.chooseDevice", { defaultValue: "Device" })}
                      </button>
                      <span className="text-xs text-hint">·</span>
                      <button type="button" disabled={busy} onClick={() => setDocumentPickerFor(opt.key)} className="text-xs font-medium text-brand hover:underline disabled:opacity-50">
                        {t("web:resume.builder.chooseMyDocuments", { defaultValue: "My Documents" })}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,image/*" onChange={onDeviceFileChosen} />
          <DocumentPickerModal
            open={documentPickerFor !== null}
            onClose={() => setDocumentPickerFor(null)}
            onSelect={onPickFromMyDocuments}
            title={t("web:resume.builder.chooseMyDocumentsTitle", { defaultValue: "Choose a file to import" }).toString()}
          />

          {/* "Create My CV" / "Generate Cover Letter" — mobile's
              ResumeBuilder.tsx CTAs below the import grid. Reuses the same
              /resume/generate screen JD Analyzer's "Build Resume" uses,
              just with docType=cv. */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => router.push(`/resume/generate?docType=cv${targetRole.trim() ? `&role=${encodeURIComponent(targetRole.trim())}` : profile?.desiredRoles?.[0] ? `&role=${encodeURIComponent(profile.desiredRoles[0])}` : ""}`)}
            >
              {t("web:resume.builder.createMyCv", { defaultValue: "Create My CV" })}
            </Button>
            <Link href="/resume/cover-letter" className="flex-1">
              <Button type="button" variant="outline" className="w-full">
                {t("web:resume.builder.generateCoverLetter", { defaultValue: "Generate Cover Letter" })}
              </Button>
            </Link>
          </div>

          <form ref={generateFormRef} onSubmit={handleGenerate} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <h2 className="font-semibold text-primary">{t("web:resume.builder.generateSectionTitle", { defaultValue: "Generate a tailored resume" })}</h2>
            <TextField
              ref={targetRoleRef}
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
            {proRequired && (
              <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-1 p-4">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                  <EvaIcon name="lock-outline" size={16} />
                </span>
                <p className="text-sm font-semibold text-primary">{t("web:resume.builder.proRequiredTitle", { defaultValue: "Generating a tailored resume is a Basic feature" })}</p>
                <p className="text-sm text-hint">{t("web:resume.builder.proRequiredSubtitle", { defaultValue: "Upgrade to Saveur Basic or above to unlock AI resume generation." })}</p>
              </div>
            )}
            <Button type="submit" disabled={generating || !targetRole.trim()} className="mt-1 w-full">
              {generating ? t("web:resume.builder.generating", { defaultValue: "Generating…" }) : t("web:resume.builder.generateResume", { defaultValue: "Generate resume" })}
            </Button>
          </form>

          {resume === null && !error && (
            <div className="flex flex-col gap-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {resume && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-card border border-border bg-surface-2 p-5">
                <div>
                  <h2 className="font-semibold text-primary">{t("web:resume.builder.yourResume", { defaultValue: "Your resume" })}</h2>
                  {resume.ats_score == null && !atsResult && <p className="text-sm text-hint">{t("web:resume.builder.noAtsScore", { defaultValue: "No ATS score yet" })}</p>}
                </div>
                {/* Redesign parity (mobile's ResumeBuilder.tsx ProgressCard
                    gradient ring) — this used to render the score as a
                    plain "ATS score: N/100" text line. */}
                {(atsResult?.score ?? resume.ats_score) != null && (
                  <CircularProgress progress={atsResult?.score ?? resume.ats_score ?? 0} size={64} strokeWidth={6} progressClassName="text-brand">
                    <span className="text-sm font-bold text-primary">{atsResult?.score ?? resume.ats_score}</span>
                  </CircularProgress>
                )}
                <Button variant="outline" size="sm" onClick={handleAtsScore} disabled={scoring}>
                  {scoring ? t("web:resume.builder.scoring", { defaultValue: "Scoring…" }) : t("web:resume.builder.checkAtsScore", { defaultValue: "Check ATS score" })}
                </Button>
              </div>

              {atsResult && (
                <div className="rounded-card border border-border bg-surface-2 p-5">
                  <h3 className="text-sm font-semibold text-primary">{t("web:resume.builder.atsTips", { defaultValue: "Suggestions to improve your score" })}</h3>
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
                  {sectionEntries.map(([key, value]) => {
                    // Raw, not-yet-organized text from /resume/upload
                    // (see SECTION_LABELS['extracted_text'] comment above) —
                    // preserve its original line breaks instead of
                    // collapsing them into one dense paragraph, and surface
                    // the real fix (AI generation) right on the card.
                    if (key === "extracted_text") {
                      return (
                        <div key={key} className="rounded-card border border-border bg-surface-2 p-4">
                          <h3 className="text-sm font-semibold text-primary">{SECTION_LABELS[key] || key}</h3>
                          <p className="mt-1.5 whitespace-pre-wrap text-sm text-hint">{renderSectionValue(value)}</p>
                          <div className="mt-3 flex flex-col items-start gap-2 rounded-lg border border-brand/30 bg-surface-1 p-3">
                            <p className="text-sm text-primary">
                              {t("web:resume.builder.extractedTextCtaDescription", {
                                defaultValue: "This is your raw uploaded text, unformatted. Organize it into clean, editable resume sections with AI.",
                              })}
                            </p>
                            <Button type="button" size="sm" onClick={handleOrganizeCta} disabled={generating}>
                              {generating
                                ? t("web:resume.builder.generating", { defaultValue: "Generating…" })
                                : t("web:resume.builder.organizeWithAi", { defaultValue: "Organize into editable sections with AI" })}
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    // Real AI-generated experience section (see
                    // Saveur-Backend's RESUME_JSON_SCHEMA:
                    // experience: [{title, company, location, start, end,
                    // bullets: [str]}]) — render each bullet individually
                    // with its own "Rewrite with AI" action instead of
                    // flattening the whole entry through the generic
                    // JSON.stringify fallback below.
                    if ((key === "experience" || key === "professional_experience") && Array.isArray(value)) {
                      return (
                        <div key={key} className="rounded-card border border-border bg-surface-2 p-4">
                          <h3 className="text-sm font-semibold text-primary">{SECTION_LABELS[key] || key}</h3>
                          <div className="mt-2 flex flex-col gap-4">
                            {value.map((entry, entryIndex) => {
                              if (typeof entry !== "object" || entry === null) {
                                return (
                                  <p key={entryIndex} className="whitespace-pre-wrap text-sm text-hint">
                                    {renderSectionValue(entry)}
                                  </p>
                                );
                              }
                              const record = entry as Record<string, unknown>;
                              const bullets = Array.isArray(record.bullets) ? (record.bullets as unknown[]) : [];
                              const titleLine = [record.title, record.company].filter(Boolean).join(" · ");
                              const dateLine = [record.start, record.end].filter(Boolean).join(" – ");
                              const entryLabel = titleLine || (SECTION_LABELS[key] || key);
                              return (
                                <div key={entryIndex} className="rounded-lg border border-border bg-surface-1 p-3">
                                  {(titleLine || dateLine) && (
                                    <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-1">
                                      {titleLine && <p className="text-sm font-semibold text-primary">{titleLine}</p>}
                                      {dateLine && <p className="text-xs text-hint">{dateLine}</p>}
                                    </div>
                                  )}
                                  {bullets.length > 0 ? (
                                    <ul className="flex flex-col gap-1.5">
                                      {bullets.map((bullet, bulletIndex) => {
                                        const bulletStr = typeof bullet === "string" ? bullet : renderSectionValue(bullet);
                                        return (
                                          <li key={bulletIndex} className="flex items-start justify-between gap-2 text-sm text-hint">
                                            <span className="whitespace-pre-wrap">{bulletStr}</span>
                                            <button
                                              type="button"
                                              onClick={() => startBulletRewrite(key, entryIndex, bulletIndex, bulletStr, entryLabel)}
                                              className="inline-flex shrink-0 items-center gap-1 rounded-pill border border-border px-2 py-0.5 text-xs font-medium text-brand hover:border-brand/40"
                                            >
                                              <EvaIcon name="edit-2-outline" size={12} />
                                              {t("web:resume.builder.rewriteBulletCta", { defaultValue: "Rewrite with AI" })}
                                            </button>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  ) : (
                                    <p className="whitespace-pre-wrap text-sm text-hint">{renderSectionValue(record.description)}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={key} className="rounded-card border border-border bg-surface-2 p-4">
                        <h3 className="text-sm font-semibold text-primary">{SECTION_LABELS[key] || key}</h3>
                        <p className="mt-1.5 whitespace-pre-wrap text-sm text-hint">{renderSectionValue(value)}</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* "Rewrite a Bullet with AI" — was entirely missing on web
                  (see mobile's ResumeBuilder.tsx, same feature/endpoint). */}
              <div ref={rewriteCardRef} className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-5">
                <div>
                  <h3 className="font-semibold text-primary">{t("web:resume.builder.aiBulletRewrite", { defaultValue: "Rewrite a Bullet with AI" })}</h3>
                  <p className="mt-1 text-sm text-hint">
                    {activeBulletTarget
                      ? t("web:resume.builder.aiBulletRewriteFromEntry", {
                          defaultValue: "Editing a bullet from \"{{label}}\" — rewrite it, then apply it back in place.",
                          label: activeBulletTarget.label,
                        })
                      : t("web:resume.builder.aiBulletRewriteDescription", { defaultValue: "Paste a resume bullet — we'll tighten the wording and lead with a stronger verb." })}
                  </p>
                </div>
                <textarea
                  rows={3}
                  value={bulletText}
                  onChange={(e) => {
                    setBulletText(e.target.value);
                    // Manually editing the text after it was pre-filled from
                    // a specific bullet detaches it from that origin — Apply
                    // only ever writes back a rewrite of the exact bullet it
                    // started from, not an edited/different one.
                    if (activeBulletTarget) setActiveBulletTarget(null);
                  }}
                  placeholder={t("web:resume.builder.bulletPlaceholder", { defaultValue: "e.g. Responsible for managing the onboarding process for new hires" })}
                  className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
                <Button onClick={handleRewriteBullet} disabled={rewriting || !bulletText.trim()} className="w-fit">
                  {rewriting ? t("web:resume.builder.rewriting", { defaultValue: "Rewriting…" }) : t("web:resume.builder.rewriteWithAi", { defaultValue: "Rewrite with AI" })}
                </Button>
                {rewriteResult && (
                  <div className="flex flex-col gap-3">
                    <div className="rounded-lg bg-surface-1 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-hint">{t("web:resume.builder.before", { defaultValue: "Before" })}</p>
                      <p className="mt-1.5 text-sm text-primary">{bulletText.trim()}</p>
                    </div>
                    <div className="rounded-lg border border-brand bg-surface-1 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-success-text">{t("web:resume.builder.after", { defaultValue: "After" })}</p>
                      <p className="mt-1.5 text-sm font-medium text-primary">{rewriteResult.rewritten}</p>
                      {rewriteResult.explanation && <p className="mt-2 text-xs text-hint">{rewriteResult.explanation}</p>}
                    </div>
                    {/* Closes the loop: writes the rewritten text back into
                        the exact experience bullet it came from via PATCH
                        /api/v1/resume, instead of leaving the user to copy
                        it back in by hand. Only shown when this rewrite
                        actually originated from a real structured bullet
                        (see startBulletRewrite above) — the manual paste-box
                        flow has nowhere in `sections` to write back to. */}
                    {activeBulletTarget && (
                      <Button onClick={handleApplyBulletRewrite} disabled={applyingBullet} variant="outline" className="w-fit">
                        {applyingBullet
                          ? t("web:resume.builder.applyingBullet", { defaultValue: "Applying…" })
                          : t("web:resume.builder.applyBulletToResume", { defaultValue: "Apply to resume" })}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
