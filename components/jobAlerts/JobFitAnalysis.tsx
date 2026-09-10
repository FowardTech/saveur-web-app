"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import * as jdService from "@/lib/jdService";

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

export function JobFitAnalysis({ applyUrl }: JobFitAnalysisProps) {
  const { t } = useTranslation();
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
    </div>
  );
}
