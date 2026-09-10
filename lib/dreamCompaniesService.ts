import apiClient from "./apiClient";

// ---------------------------------------------------------------------------
// dreamCompaniesService — Dream Company Dashboard (product request item): a
// persisted, tracked list of target companies with cached AI research (same
// generation as Company Intelligence — lib/... company-intel call — just
// persisted here instead of generate-on-demand) and real prep-progress
// signal. Ported from mobile's services/dreamCompaniesService.ts. See
// Saveur-Backend's app/api/dream_companies.py for the real contract.
//   GET    /api/v1/dream-companies              -> DreamCompany[]
//   POST   /api/v1/dream-companies               -> DreamCompany (body: {company, role?})
//   POST   /api/v1/dream-companies/<id>/refresh   -> DreamCompany
//   POST   /api/v1/dream-companies/<id>/priority  -> DreamCompany (body: {is_top_choice?})
//   POST   /api/v1/dream-companies/<id>/notes     -> DreamCompany (body: {notes})
//   DELETE /api/v1/dream-companies/<id>
// Pro Premium-gated (@require_premium) — a 402/403 on GET means the account
// needs Premium (not just Basic/Pro), matching mobile's isPremium gate.
// ---------------------------------------------------------------------------

export interface DreamCompanyIntel {
  overview: string;
  recentDevelopments: string[];
  cultureNotes: string;
  likelyQuestions: string[];
  talkingPoints: string[];
  salaryRange: string;
  interviewProcess: string;
  sources: string[];
}

export interface DreamCompanyPrepProgress {
  sessionsPracticed: number;
  avgScore: number | null;
  applicationTracked: boolean;
}

export interface DreamCompany {
  id: number;
  company: string;
  logoUrl: string | null;
  targetRole: string | null;
  intel: DreamCompanyIntel | null;
  researchedAt: string | null;
  prepProgress: DreamCompanyPrepProgress;
  openJobsCount: number;
  researchStale: boolean;
  readinessScore: number;
  isTopChoice: boolean;
  hasNewJobAlert: boolean;
  researchPending: boolean;
  notes: string;
}

interface DreamCompanyIntelWire {
  overview?: string;
  recent_developments?: string[];
  culture_notes?: string;
  likely_questions?: string[];
  talking_points?: string[];
  salary_range?: string;
  interview_process?: string;
  sources?: string[];
}

interface DreamCompanyWire {
  id: number;
  company: string;
  logo_url?: string | null;
  target_role?: string | null;
  intel?: DreamCompanyIntelWire | null;
  researched_at?: string | null;
  prep_progress?: { sessions_practiced?: number; avg_score?: number | null; application_tracked?: boolean };
  open_jobs_count?: number;
  research_stale?: boolean;
  readiness_score?: number;
  is_top_choice?: boolean;
  has_new_job_alert?: boolean;
  research_pending?: boolean;
  notes?: string;
}

function intelFromWire(intel?: DreamCompanyIntelWire | null): DreamCompanyIntel | null {
  if (!intel) return null;
  return {
    overview: intel.overview ?? "",
    recentDevelopments: intel.recent_developments ?? [],
    cultureNotes: intel.culture_notes ?? "",
    likelyQuestions: intel.likely_questions ?? [],
    talkingPoints: intel.talking_points ?? [],
    salaryRange: intel.salary_range ?? "",
    interviewProcess: intel.interview_process ?? "",
    sources: intel.sources ?? [],
  };
}

function fromWire(w: DreamCompanyWire): DreamCompany {
  return {
    id: w.id,
    company: w.company,
    logoUrl: w.logo_url ?? null,
    targetRole: w.target_role ?? null,
    intel: intelFromWire(w.intel),
    researchedAt: w.researched_at ?? null,
    prepProgress: {
      sessionsPracticed: w.prep_progress?.sessions_practiced ?? 0,
      avgScore: w.prep_progress?.avg_score ?? null,
      applicationTracked: !!w.prep_progress?.application_tracked,
    },
    openJobsCount: w.open_jobs_count ?? 0,
    researchStale: !!w.research_stale,
    readinessScore: w.readiness_score ?? 0,
    isTopChoice: !!w.is_top_choice,
    hasNewJobAlert: !!w.has_new_job_alert,
    researchPending: !!w.research_pending,
    notes: w.notes ?? "",
  };
}

export async function listDreamCompanies(): Promise<DreamCompany[]> {
  const data = await apiClient.get<DreamCompanyWire[]>("/api/v1/dream-companies");
  return (data ?? []).map(fromWire);
}

/** Throws an ApiError with status 400 and error "limit_reached" |
 * "already_tracked" | "company_required" on failure — see
 * app/api/dream_companies.py's add_company for the exact messages. */
export async function addDreamCompany(company: string, role?: string): Promise<DreamCompany> {
  const data = await apiClient.post<DreamCompanyWire>("/api/v1/dream-companies", {
    company,
    role: role || "",
  });
  return fromWire(data);
}

export async function refreshDreamCompany(id: number): Promise<DreamCompany> {
  const data = await apiClient.post<DreamCompanyWire>(`/api/v1/dream-companies/${id}/refresh`);
  return fromWire(data);
}

export async function removeDreamCompany(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/dream-companies/${id}`);
}

/** Body omitted = flip the current value server-side — see
 * app/api/dream_companies.py's toggle_priority. */
export async function toggleDreamCompanyPriority(id: number, isTopChoice?: boolean): Promise<DreamCompany> {
  const data = await apiClient.post<DreamCompanyWire>(
    `/api/v1/dream-companies/${id}/priority`,
    isTopChoice === undefined ? undefined : { is_top_choice: isTopChoice }
  );
  return fromWire(data);
}

/** Plain overwrite, same shape as toggleDreamCompanyPriority above. See
 * app/api/dream_companies.py's update_notes. */
export async function updateDreamCompanyNotes(id: number, notes: string): Promise<DreamCompany> {
  const data = await apiClient.post<DreamCompanyWire>(`/api/v1/dream-companies/${id}/notes`, { notes });
  return fromWire(data);
}

// ---------------------------------------------------------------------------
// Readiness tier — 3-tier color coding so a glance at the badge tells you
// where a company stands: green once genuinely interview-ready, blue while
// there's real but partial prep, gray when there's essentially nothing yet.
// Mirrors mobile's DreamCompanies.tsx readinessTier.
// ---------------------------------------------------------------------------
export function readinessTier(score: number): "success" | "link" | "neutral" {
  if (score >= 70) return "success";
  if (score >= 35) return "link";
  return "neutral";
}
