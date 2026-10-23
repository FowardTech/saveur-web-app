"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import * as jdService from "@/lib/jdService";
import { Button } from "@/components/ui/Button";
import { DocumentPickerModal } from "@/components/documents/DocumentPickerModal";
import type { DocumentRecord } from "@/lib/documentsService";

// Same one-shot sessionStorage hand-off app/jd-analyzer/page.tsx uses to
// pass the job description to app/resume/generate/page.tsx (the JD can be
// too long for a URL).
const RESUME_GEN_INPUT_KEY = "saveur:resumeGenerate:input";

// Web port of Saveur (mobile)'s src/more/JobFitAnalysis.tsx — see that
// file's own header comment for the full design rationale. Reuses the same
// analysis pipeline the (not-yet-ported) JD Analyzer tool would use
// (jdService.analyzeJD + matchJD, both backed by POST /jd/analyze and
// POST /jd/match), sourced from this specific job's apply_url via
// jdService.extractJDFromUrl rather than a user-pasted job description.
//
// Auto-runs once on mount (this component only ever analyzes the one job
// it's given — no "maybe I don't want this yet" case to gate behind a
// button, same as mobile). Silently hides on ANY failure (unreachable
// posting, a page that doesn't read as a job posting, empty JD text)
// rather than showing an error — mobile's own file comment calls this out
// explicitly ("silently hides on any failure... same self-hide, don't nag
// convention every other best-effort card in this app follows"). The rest
// of the job details page is fully useful without this section.
//
// Gating: /jd/analyze and /jd/match both require Saveur Basic
// (entitlements_service.require_pro — see Saveur-Backend/app/api/jd.py),
// the exact same gate app/job-alerts/[id]/page.tsx's own GET
// /api/v1/job-alerts/<id> call already requires (app/api/job_alerts.py's
// get_alert). Any user who got past that page's own "Pro required" gate
// already satisfies these two endpoints too — no separate check needed
// here, same reasoning mobile's file documents.
interface JobFitAnalysisProps {
  applyUrl?: string | null;
  jobTitle?: string;
}

export function JobFitAnalysis({ applyUrl, jobTitle }: JobFitAnalysisProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [jdText, setJdText] = useState<string | null>(null);
  const [showBuildChoices, setShowBuildChoices] = useState(false);
  const [showTailorChoices, setShowTailorChoices] = useState(false);
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [qualifications, setQualifications] = useState<string[]>([]);
  const [gaps, setGaps] = useState<string[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!applyUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailed(true);
      return;
    }
    setIsLoading(true);
    setFailed(false);
    (async () => {
      try {
        const text = await jdService.extractJDFromUrl(applyUrl);
        if (!text.trim()) throw new Error("empty jd");
        const [analysis, match] = await Promise.all([jdService.analyzeJD(text), jdService.matchJD(text)]);
        if (cancelled) return;
        setJdText(text);
        setQualifications(analysis.mustHaves.length ? analysis.mustHaves : analysis.keywords);
        setGaps(match.missingSkills);
        setScore(match.score);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyUrl]);

  function goToGenerate(handoff: { useStoredResume?: boolean; existingResumeDocumentId?: string }) {
    if (!jdText) return;
    try {
      sessionStorage.setItem(RESUME_GEN_INPUT_KEY, JSON.stringify({ jdText, ...handoff }));
    } catch {
      // sessionStorage unavailable — the generate page just builds fresh
    }
    const role = jobTitle?.trim() ? `&role=${encodeURIComponent(jobTitle.trim())}` : "";
    router.push(`/resume/generate?docType=resume${role}`);
  }

  function closeChoices() {
    setShowBuildChoices(false);
    setShowTailorChoices(false);
  }

  function onPickedDocumentToTailor(doc: DocumentRecord) {
    setShowDocumentPicker(false);
    closeChoices();
    goToGenerate({ existingResumeDocumentId: doc.id });
  }

  if (failed) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2.5 rounded-card border border-border bg-surface-2 px-5 py-4">
        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-hint border-t-transparent" aria-hidden="true" />
        <span className="text-sm text-hint">{t("web:jobAlerts.details.jobFitAnalyzing", { defaultValue: "Analyzing this role's requirements…" })}</span>
      </div>
    );
  }

  if (!qualifications.length && !gaps.length) return null;

  const scoreVariant = score === null ? null : score >= 75 ? "success" : score >= 50 ? "warning" : "danger";
  const scoreClasses =
    scoreVariant === "success"
      ? "bg-tint-mint text-tint-mint-text"
      : scoreVariant === "warning"
      ? "bg-tint-yellow text-tint-yellow-text"
      : "bg-tint-red text-tint-red-text";

  return (
    <div className="flex flex-col gap-5 rounded-card border border-border bg-surface-2 p-6">
      {qualifications.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-primary">{t("web:jobAlerts.details.qualificationsTitle", { defaultValue: "Qualifications" })}</h2>
            {score !== null && (
              <span className={`inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-medium ${scoreClasses}`}>
                {t("web:jobAlerts.details.matchScorePct", { defaultValue: "{{score}}% match", score })}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2.5">
            {qualifications.map((q, i) => (
              <div key={i} className="rounded-lg bg-surface-3 px-4 py-3 text-sm font-medium text-primary">
                {q}
              </div>
            ))}
          </div>
        </div>
      )}

      {gaps.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold text-primary">{t("web:jobAlerts.details.missingSkillsTitle", { defaultValue: "Missing Skills" })}</h2>
          <div className="flex flex-wrap gap-2">
            {gaps.map((skill, i) => (
              <span key={i} className="rounded-pill bg-surface-3 px-3.5 py-1.5 text-sm font-medium text-primary">
                {skill}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm font-medium text-success-text">
          {t("web:jobAlerts.details.jobFitNoGaps", { defaultValue: "Your resume already covers this role's key requirements." })}
        </p>
      )}
      {jdText && (
        <Button type="button" onClick={() => setShowBuildChoices(true)} className="w-full justify-center">
          {t("web:jdAnalyzer.buildResumeCta", { defaultValue: "Build Resume" })}
        </Button>
      )}

      {/* Build Resume choice sheet: fresh vs. tailor an existing one (same
          flow as app/jd-analyzer/page.tsx and mobile's JobFitAnalysis). */}
      {showBuildChoices && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={closeChoices}>
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-card border border-border bg-surface-2 p-6 sm:rounded-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 font-semibold text-primary">{t("web:jdAnalyzer.buildResumeCta", { defaultValue: "Build Resume" })}</h2>
            <p className="mb-4 text-sm text-hint">{t("web:jdAnalyzer.buildResumeChoiceDescription", { defaultValue: "Tailor a resume you already have to this job, or build a brand-new one from scratch." })}</p>
            <div className="flex flex-col gap-2">
              <Button type="button" onClick={() => { closeChoices(); goToGenerate({}); }}>
                {t("web:jdAnalyzer.buildResumeFresh", { defaultValue: "Build a fresh one" })}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowBuildChoices(false); setShowTailorChoices(true); }}>
                {t("web:jdAnalyzer.buildResumeTailor", { defaultValue: "Tailor an existing resume" })}
              </Button>
              <Button type="button" variant="ghost" onClick={closeChoices}>
                {t("common:cancel", { defaultValue: "Cancel" })}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showTailorChoices && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={closeChoices}>
          <div className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-card border border-border bg-surface-2 p-6 sm:rounded-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-4 font-semibold text-primary">{t("web:jdAnalyzer.buildResumeTailor", { defaultValue: "Tailor an existing resume" })}</h2>
            <div className="flex flex-col gap-2">
              <Button type="button" onClick={() => { closeChoices(); goToGenerate({ useStoredResume: true }); }}>
                {t("web:jdAnalyzer.tailorMyGeneratedResume", { defaultValue: "My generated resume" })}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowDocumentPicker(true)}>
                {t("web:jdAnalyzer.chooseFromMyDocuments", { defaultValue: "Choose from My Documents" })}
              </Button>
              <Button type="button" variant="ghost" onClick={closeChoices}>
                {t("common:cancel", { defaultValue: "Cancel" })}
              </Button>
            </div>
          </div>
        </div>
      )}

      <DocumentPickerModal
        open={showDocumentPicker}
        onClose={() => setShowDocumentPicker(false)}
        onSelect={onPickedDocumentToTailor}
        title={t("web:jdAnalyzer.buildResumeTailor", { defaultValue: "Tailor an existing resume" }).toString()}
      />
    </div>
  );
}
