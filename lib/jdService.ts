import i18n from "i18next";
import apiClient from "./apiClient";

// Web port of Saveur (mobile)'s services/jdService.ts — just the pieces
// components/jobAlerts/JobFitAnalysis.tsx needs to auto-analyze a job
// posting's requirements on the Job Details page (see that component's own
// header comment). Mobile's JDAnalyzer.tsx equivalent (paste-a-JD standalone
// tool) hasn't been ported to web yet — this file only covers the subset
// mobile's JobFitAnalysis.tsx itself uses: extractJDFromUrl + analyzeJD +
// matchJD. All three require Saveur Basic (@require_pro on the backend —
// see app/api/jd.py), same gate as the Job Alerts details route itself
// (app/api/job_alerts.py's get_alert), so a user who can reach the job
// details page already satisfies these endpoints' own gate too.
function currentLanguage(): string {
  return i18n.language || "en";
}

export interface JDAnalyzeResult {
  keywords: string[];
  mustHaves: string[];
  seniority: string;
}
export interface JDMatchResult {
  score: number;
  missingSkills: string[];
}
interface JDExtractUrlWire {
  jd_text?: string;
  error?: string;
  message?: string;
}
interface JDAnalyzeWire {
  keywords?: string[];
  must_haves?: string[];
  seniority?: string;
}
interface JDMatchWire {
  score?: number;
  missing_skills?: string[];
}

/** POST /api/v1/jd/analyze — extract keywords, must-have requirements, and
 * seniority level from a job description's text. */
export async function analyzeJD(jdText: string): Promise<JDAnalyzeResult> {
  const data = await apiClient.post<JDAnalyzeWire>("/api/v1/jd/analyze", {
    jd_text: jdText,
    language: currentLanguage(),
  });
  return {
    keywords: data.keywords ?? [],
    mustHaves: data.must_haves ?? [],
    seniority: data.seniority ?? "",
  };
}

/** POST /api/v1/jd/match — compare a job description against the user's
 * stored resume and return a match score + missing skills. */
export async function matchJD(jdText: string): Promise<JDMatchResult> {
  const data = await apiClient.post<JDMatchWire>("/api/v1/jd/match", {
    jd_text: jdText,
    language: currentLanguage(),
  });
  return {
    score: data.score ?? 0,
    missingSkills: data.missing_skills ?? [],
  };
}

/** POST /api/v1/jd/extract-url — fetches a job posting URL and asks the
 * model to pull out just the job description text. Backend returns a 4xx
 * with {error, message} for an unreachable/empty/non-job-posting page —
 * apiClient's request() already normalizes that into `.message` on the
 * thrown error, so callers can just try/catch this like any other call. */
export async function extractJDFromUrl(url: string): Promise<string> {
  const data = await apiClient.post<JDExtractUrlWire>("/api/v1/jd/extract-url", {
    url: url.trim(),
    language: currentLanguage(),
  });
  return (data.jd_text ?? "").trim();
}
