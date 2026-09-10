"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { DocumentPickerModal } from "@/components/documents/DocumentPickerModal";
import { useAuth } from "@/app/providers/AuthProvider";
import * as jdService from "@/lib/jdService";
import apiClient, { type ApiError } from "@/lib/apiClient";
import { downloadUrlAsFile } from "@/lib/downloadFile";
import type { DocumentRecord } from "@/lib/documentsService";

// Web port of Saveur (mobile)'s src/more/JDAnalyzer.tsx — the GENERAL-
// PURPOSE version of components/jobAlerts/JobFitAnalysis.tsx's auto-run
// analysis (that component analyzes ONE specific job alert's apply_url on
// the job details page; this screen lets a user paste ANY job description
// or posting URL standalone). Reuses lib/jdService.ts's existing
// analyzeJD/matchJD/extractJDFromUrl — see that file's own header comment.
//
// Real backend — Saveur-Backend/app/api/jd.py (both @require_pro):
//   POST /api/v1/jd/analyze -> keywords, must-haves, seniority
//   POST /api/v1/jd/match   -> match score + missing skills vs. stored resume
//   POST /api/v1/jd/extract-url -> jd_text (for the "Paste URL" tab)
//
// "Build Resume" hands off to app/resume/generate/page.tsx via
// sessionStorage (see that page's own header comment on why — jdText can be
// long). "Generate Cover Letter" is inline on this page (mirrors mobile's
// src/more/JDCoverLetterGenerator.tsx: generates immediately from the JD
// alone, no company/role form — the backend infers those from jd_text).
const RESUME_GEN_INPUT_KEY = "saveur:resumeGenerate:input";

type InputMode = "text" | "url";

export default function JDAnalyzerPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isPro } = useAuth();

  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [jd, setJd] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [result, setResult] = useState<{ score: number; missingSkills: string[]; keywordSuggestions: string[] } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proRequired, setProRequired] = useState(false);

  const [showBuildResumeChoices, setShowBuildResumeChoices] = useState(false);
  const [showTailorChoices, setShowTailorChoices] = useState(false);
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);

  // Inline "Generate Cover Letter" (mirrors JDCoverLetterGenerator.tsx).
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [coverLetterError, setCoverLetterError] = useState<string | null>(null);
  const [coverLetterDownloading, setCoverLetterDownloading] = useState<"pdf" | "docx" | null>(null);

  function switchMode(mode: InputMode) {
    setInputMode(mode);
    setResult(null);
  }

  async function onAnalyze() {
    if (isAnalyzing || isFetchingUrl) return;
    let jdText = jd;
    setError(null);
    setProRequired(false);
    if (inputMode === "url") {
      if (!jdUrl.trim()) return;
      setIsFetchingUrl(true);
      try {
        jdText = await jdService.extractJDFromUrl(jdUrl);
      } catch (err) {
        setIsFetchingUrl(false);
        const apiErr = err as ApiError;
        if (apiErr.status === 402 || apiErr.status === 403) setProRequired(true);
        else setError(apiErr.message || t("web:jdAnalyzer.urlFetchFailedDefault", { defaultValue: "Couldn't read that job posting." }));
        return;
      }
      setIsFetchingUrl(false);
      if (!jdText.trim()) {
        setError(t("web:jdAnalyzer.urlEmptyResult", { defaultValue: "Try pasting the job description text instead." }));
        return;
      }
      setJd(jdText);
    }
    if (!jdText.trim()) return;
    setIsAnalyzing(true);
    try {
      const [analysis, match] = await Promise.all([jdService.analyzeJD(jdText), jdService.matchJD(jdText)]);
      setResult({
        score: match.score,
        missingSkills: match.missingSkills.length ? match.missingSkills : analysis.mustHaves,
        keywordSuggestions: analysis.keywords,
      });
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) setProRequired(true);
      else setError(apiErr.message || t("web:jdAnalyzer.analysisFailedDefault", { defaultValue: "Analysis failed. Please try again." }));
    } finally {
      setIsAnalyzing(false);
    }
  }

  function goToGenerate(handoff: { useStoredResume?: boolean; existingResumeDocumentId?: string }) {
    try {
      sessionStorage.setItem(RESUME_GEN_INPUT_KEY, JSON.stringify({ jdText: jd, ...handoff }));
    } catch {
      // sessionStorage unavailable — generate page just builds fresh
    }
    router.push("/resume/generate?docType=resume");
  }

  function onBuildFresh() {
    setShowBuildResumeChoices(false);
    goToGenerate({});
  }
  function onTailorFromStoredResume() {
    setShowBuildResumeChoices(false);
    setShowTailorChoices(false);
    goToGenerate({ useStoredResume: true });
  }
  function onPickedDocumentToTailor(doc: DocumentRecord) {
    setShowDocumentPicker(false);
    setShowBuildResumeChoices(false);
    setShowTailorChoices(false);
    goToGenerate({ existingResumeDocumentId: doc.id });
  }

  async function onGenerateCoverLetter() {
    setShowCoverLetter(true);
    setCoverLetterLoading(true);
    setCoverLetterError(null);
    setCoverLetter(null);
    try {
      const data = await apiClient.post<{ cover_letter: string }>("/api/v1/resume/cover-letter", { jd_text: jd });
      setCoverLetter(data.cover_letter);
    } catch (err) {
      const apiErr = err as ApiError;
      setCoverLetterError(apiErr.message || t("web:jdAnalyzer.coverLetterFailedDefault", { defaultValue: "Couldn't generate a cover letter right now." }));
    } finally {
      setCoverLetterLoading(false);
    }
  }

  async function onDownloadCoverLetter(format: "pdf" | "docx") {
    if (!coverLetter || coverLetterDownloading) return;
    setCoverLetterDownloading(format);
    try {
      const data = await apiClient.post<{ url?: string }>("/api/v1/resume/cover-letter/export", { text: coverLetter, format });
      if (data.url) await downloadUrlAsFile(data.url, `Cover Letter.${format}`);
    } catch {
      setCoverLetterError(t("web:jdAnalyzer.coverLetterDownloadFailedDefault", { defaultValue: "Couldn't download the file. Please try again." }));
    } finally {
      setCoverLetterDownloading(null);
    }
  }

  const isBusy = isAnalyzing || isFetchingUrl;
  const canSubmit = inputMode === "text" ? !!jd.trim() : !!jdUrl.trim();
  const scoreColor = !result ? "" : result.score >= 75 ? "text-success-text" : result.score >= 50 ? "text-warning-text" : "text-danger";

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-10">
          <PageHeader
            title={t("web:jdAnalyzer.title", { defaultValue: "JD Analyzer" })}
            subtitle={t("web:jdAnalyzer.subtitle", { defaultValue: "Paste a job description and see how your resume stacks up, with a matching resume generated for you." })}
          />

          {(!isPro || proRequired) && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:jdAnalyzer.proRequiredTitle", { defaultValue: "JD Analyzer is a Basic feature" })}</h2>
              <p className="text-sm text-hint">{t("web:jdAnalyzer.proRequiredSubtitle", { defaultValue: "Upgrade to Saveur Basic or above to analyze job descriptions against your resume." })}</p>
            </div>
          )}

          {isPro && (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => switchMode("text")}
                  className={`rounded-pill px-4 py-1.5 text-sm font-medium ${inputMode === "text" ? "bg-brand text-white" : "bg-surface-3 text-hint"}`}
                >
                  {t("web:jdAnalyzer.pasteText", { defaultValue: "Paste text" })}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("url")}
                  className={`rounded-pill px-4 py-1.5 text-sm font-medium ${inputMode === "url" ? "bg-brand text-white" : "bg-surface-3 text-hint"}`}
                >
                  {t("web:jdAnalyzer.pasteUrl", { defaultValue: "Paste URL" })}
                </button>
              </div>

              {inputMode === "text" ? (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-primary">{t("web:jdAnalyzer.pasteJdLabel", { defaultValue: "Paste a job description" })}</span>
                  <textarea
                    rows={10}
                    value={jd}
                    onChange={(e) => setJd(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-primary">{t("web:jdAnalyzer.pasteUrlLabel", { defaultValue: "Paste a job posting link" })}</span>
                  <input
                    value={jdUrl}
                    onChange={(e) => setJdUrl(e.target.value)}
                    disabled={isFetchingUrl}
                    placeholder={t("web:jdAnalyzer.urlPlaceholder", { defaultValue: "e.g. https://jobs.lever.co/company/role" }).toString()}
                    className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                  <p className="text-xs text-hint">{t("web:jdAnalyzer.urlHint", { defaultValue: "We'll fetch the posting and pull out the job description for you." })}</p>
                </div>
              )}

              {error && <p className="text-sm text-danger">{error}</p>}

              <Button type="button" onClick={onAnalyze} disabled={isBusy || !canSubmit} className="w-full">
                {isFetchingUrl ? t("web:jdAnalyzer.fetchingPosting", { defaultValue: "Fetching posting…" }) : isAnalyzing ? t("web:jdAnalyzer.analyzing", { defaultValue: "Analyzing…" }) : t("web:jdAnalyzer.analyzeMatch", { defaultValue: "Analyze Match" })}
              </Button>

              {result && (
                <>
                  <div className="flex flex-col items-center gap-2 py-4">
                    <CircularProgress progress={result.score} size={140} strokeWidth={10}>
                      <span className={`text-2xl font-bold ${scoreColor}`}>{result.score}</span>
                      <span className="text-xs text-hint">{t("web:jdAnalyzer.matchScore", { defaultValue: "Match Score" })}</span>
                    </CircularProgress>
                  </div>

                  <h2 className="font-semibold text-primary">{t("web:jdAnalyzer.missingSkills", { defaultValue: "Missing Skills" })}</h2>
                  <div className="flex flex-wrap gap-2">
                    {result.missingSkills.map((skill, i) => (
                      <span key={i} className="rounded-pill bg-surface-3 px-3.5 py-1.5 text-sm font-medium text-primary">
                        {skill}
                      </span>
                    ))}
                  </div>

                  <h2 className="mt-2 font-semibold text-primary">{t("web:jdAnalyzer.keywordSuggestions", { defaultValue: "Keyword Suggestions" })}</h2>
                  <div className="flex flex-wrap gap-2">
                    {result.keywordSuggestions.map((word, i) => (
                      <span key={i} className="rounded-pill bg-surface-3 px-3.5 py-1.5 text-sm font-medium text-primary">
                        {word}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-col gap-2 rounded-card border border-border bg-surface-2 p-5">
                    <h3 className="font-semibold text-primary">{t("web:jdAnalyzer.buildResumeTitle", { defaultValue: "Want a resume tailored to this job?" })}</h3>
                    <p className="text-sm text-hint">{t("web:jdAnalyzer.buildResumeDescription", { defaultValue: "We'll draft a resume around this job's keywords and skills, ready to download." })}</p>
                    <Button type="button" onClick={() => setShowBuildResumeChoices(true)} className="w-fit">
                      {t("web:jdAnalyzer.buildResumeCta", { defaultValue: "Build Resume" })}
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-2 p-5">
                    <h3 className="font-semibold text-primary">{t("web:jdAnalyzer.buildCoverLetterTitle", { defaultValue: "Want a cover letter for this job?" })}</h3>
                    <p className="text-sm text-hint">{t("web:jdAnalyzer.buildCoverLetterDescription", { defaultValue: "We'll draft a cover letter tailored to this job description, ready to download." })}</p>
                    <Button type="button" onClick={onGenerateCoverLetter} className="w-fit">
                      {t("web:jdAnalyzer.buildCoverLetterCta", { defaultValue: "Generate Cover Letter" })}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Build Resume choice sheet: fresh vs. tailor an existing one. */}
        {showBuildResumeChoices && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setShowBuildResumeChoices(false)}>
            <div className="w-full max-w-sm rounded-t-card border border-border bg-surface-2 p-6 sm:rounded-card" onClick={(e) => e.stopPropagation()}>
              <h2 className="mb-1 font-semibold text-primary">{t("web:jdAnalyzer.buildResumeCta", { defaultValue: "Build Resume" })}</h2>
              <p className="mb-4 text-sm text-hint">{t("web:jdAnalyzer.buildResumeChoiceDescription", { defaultValue: "Tailor a resume you already have to this job, or build a brand-new one from scratch." })}</p>
              <div className="flex flex-col gap-2">
                <Button type="button" onClick={onBuildFresh}>
                  {t("web:jdAnalyzer.buildResumeFresh", { defaultValue: "Build a fresh one" })}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowTailorChoices(true)}>
                  {t("web:jdAnalyzer.buildResumeTailor", { defaultValue: "Tailor an existing resume" })}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowBuildResumeChoices(false)}>
                  {t("common:cancel", { defaultValue: "Cancel" })}
                </Button>
              </div>
            </div>
          </div>
        )}

        {showTailorChoices && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setShowTailorChoices(false)}>
            <div className="w-full max-w-sm rounded-t-card border border-border bg-surface-2 p-6 sm:rounded-card" onClick={(e) => e.stopPropagation()}>
              <h2 className="mb-4 font-semibold text-primary">{t("web:jdAnalyzer.buildResumeTailor", { defaultValue: "Tailor an existing resume" })}</h2>
              <div className="flex flex-col gap-2">
                <Button type="button" onClick={onTailorFromStoredResume}>
                  {t("web:jdAnalyzer.tailorMyGeneratedResume", { defaultValue: "My generated resume" })}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowDocumentPicker(true)}>
                  {t("web:jdAnalyzer.chooseFromMyDocuments", { defaultValue: "Choose from My Documents" })}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowTailorChoices(false)}>
                  {t("common:cancel", { defaultValue: "Cancel" })}
                </Button>
              </div>
            </div>
          </div>
        )}

        <DocumentPickerModal open={showDocumentPicker} onClose={() => setShowDocumentPicker(false)} onSelect={onPickedDocumentToTailor} title={t("web:jdAnalyzer.buildResumeTailor", { defaultValue: "Tailor an existing resume" }).toString()} />

        {/* Inline cover letter generation/preview — mirrors mobile's
            JDCoverLetterGenerator.tsx (generates immediately from jd_text
            alone, no company/role form). */}
        {showCoverLetter && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => !coverLetterLoading && setShowCoverLetter(false)}>
            <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-card border border-border bg-surface-2 p-6 sm:rounded-card" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-primary">{t("web:jdAnalyzer.coverLetterTitle", { defaultValue: "Cover Letter" })}</h2>
                <button type="button" onClick={() => setShowCoverLetter(false)} aria-label={t("common:actions.close", { defaultValue: "Close" })}>
                  <EvaIcon name="close-outline" size={20} className="text-hint" />
                </button>
              </div>
              {coverLetterLoading ? (
                <p className="py-8 text-center text-sm text-hint">{t("web:jdAnalyzer.coverLetterGenerating", { defaultValue: "Writing your cover letter for this job…" })}</p>
              ) : coverLetterError ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <p className="text-sm text-danger">{coverLetterError}</p>
                  <Button type="button" variant="outline" size="sm" onClick={onGenerateCoverLetter}>
                    {t("common:try_again", { defaultValue: "Try again" })}
                  </Button>
                </div>
              ) : coverLetter ? (
                <div className="flex flex-col gap-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-primary">{coverLetter}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={onGenerateCoverLetter}>
                      {t("web:jdAnalyzer.regenerate", { defaultValue: "Regenerate" })}
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={!!coverLetterDownloading} onClick={() => onDownloadCoverLetter("docx")}>
                      <EvaIcon name="download-outline" size={14} />
                      {coverLetterDownloading === "docx" ? t("web:jdAnalyzer.preparing", { defaultValue: "Preparing…" }) : t("web:jdAnalyzer.downloadWord", { defaultValue: "Download Word" })}
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={!!coverLetterDownloading} onClick={() => onDownloadCoverLetter("pdf")}>
                      <EvaIcon name="download-outline" size={14} />
                      {coverLetterDownloading === "pdf" ? t("web:jdAnalyzer.preparing", { defaultValue: "Preparing…" }) : t("web:jdAnalyzer.downloadPdf", { defaultValue: "Download PDF" })}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </AppShell>
    </RequireAuth>
  );
}
