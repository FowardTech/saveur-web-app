import i18n from "i18next";
import apiClient from "./apiClient";

// Lifetime career features (Saveur-Backend app/api/lifetime.py) — mirrors
// Saveur/services/lifetimeService.ts.
const B = "/api/v1/lifetime";
const lang = () => ({ language: i18n.language || "en" });

export interface Overview {
  weekly_checkin_done: boolean;
  weekly_next_step: string | null;
  brag_count: number;
  timeline_count: number;
  pay_checked_at: string | null;
  pay_behind: boolean;
  market_checked_at: string | null;
  skill_milestones_open: number;
}
export interface WeeklyCheckin {
  id: number;
  week_start: string;
  next_step_done: boolean;
  summary: string;
  wins: string[];
  learnings: string[];
  focus_next_week: string;
  next_step: { title: string; why: string; action: string };
  encouragement: string;
  entries_used: number;
}
export interface BragItem {
  id: number;
  title: string;
  bullet: string;
  impact?: string;
  skills: string[];
  applied_to_resume: boolean;
}
export interface ReviewPrep {
  kind: string;
  evidence: { claim: string; proof: string }[];
  self_review: string;
  talking_points: string[];
  likely_questions: { question: string; tip: string }[];
  gaps: string[];
  ask: string;
}
export interface LeadershipPrep {
  kind: string;
  title: string;
  goal: string;
  sections: { heading: string; points: string[] }[];
  script: string;
  avoid: string[];
}
export interface RoleplayFeedback {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  better_phrasing: { you_said: string; try: string }[];
}
export interface PayCheck {
  behind: boolean;
  position: string;
  gap_pct: number;
  current_base: number;
  currency: string;
  role?: string;
  location: string;
  market: { p25: number; p50: number; p75: number };
  suggested_ask?: number | null;
  tip?: string;
  caveat?: string;
  created_at?: string;
}
export interface MarketRole {
  id: number;
  title: string;
  company: string;
  location?: string;
  apply_url?: string;
  why: string;
  step_up: string;
}
export interface MarketDigest {
  roles: MarketRole[];
  summary: string;
  empty?: boolean;
  created_at?: string;
}
export interface SkillPlan {
  target_role: string;
  current_role: string;
  weeks: number;
  gap_summary: string;
  skills: { name: string; why: string; level_now: string; level_goal: string }[];
  certifications: { name: string; provider: string; why: string; est_weeks: number }[];
  milestones: { id: string; title: string; type: string; due: string; done: boolean }[];
}
export interface TimelineEvent {
  id: string;
  source: "timeline" | "pay" | "certificate";
  kind: string;
  title: string;
  detail?: string | null;
  date: string;
  deletable: boolean;
}
export type Msg = { role: "user" | "ai"; text: string };

export const getOverview = () => apiClient.get<Overview>(`${B}/overview`);

export const getWeekly = () => apiClient.get<{ current_week_start: string; checkins: WeeklyCheckin[] }>(`${B}/checkin/weekly`);
export const generateWeekly = (reflection?: string) => apiClient.post<WeeklyCheckin>(`${B}/checkin/weekly`, { reflection, ...lang() });
export const setStepDone = (id: number, done: boolean) => apiClient.post<WeeklyCheckin>(`${B}/checkin/weekly/${id}/step-done`, { done });

export const getBrag = async () => (await apiClient.get<{ items: BragItem[] }>(`${B}/brag`)).items;
export const generateBrag = async () => (await apiClient.post<{ items: BragItem[] }>(`${B}/brag/generate`, lang())).items;
export const deleteBrag = (id: number) => apiClient.delete(`${B}/brag/${id}`);
export const applyBragToResume = async () => (await apiClient.post<{ applied: number }>(`${B}/brag/apply-to-resume`, {})).applied;

export const getReviewPrep = async () => {
  const data = await apiClient.get<Partial<ReviewPrep>>(`${B}/review/prep`);
  return data.self_review ? (data as ReviewPrep) : null;
};
export const buildReviewPrep = (kind: "performance_review" | "promotion", role: string, target_role: string) =>
  apiClient.post<ReviewPrep>(`${B}/review/prep`, { kind, role, target_role, ...lang() });

export const buildLeadershipPrep = (kind: string, situation: string, person: string) =>
  apiClient.post<LeadershipPrep>(`${B}/leadership/prep`, { kind, situation, person, ...lang() });

export const roleplayReply = async (scenario: string, context: string, messages: Msg[]) =>
  (await apiClient.post<{ reply: string }>(`${B}/roleplay`, { scenario, context, messages, ...lang() })).reply;
export const roleplayFeedback = async (scenario: string, context: string, messages: Msg[]) =>
  (await apiClient.post<{ feedback: RoleplayFeedback }>(`${B}/roleplay`, { scenario, context, messages, finish: true, ...lang() })).feedback;

export const getPay = () => apiClient.get<{ latest: PayCheck | null; due: boolean }>(`${B}/pay`);
export const runPayCheck = async (location?: string) => (await apiClient.post<{ latest: PayCheck }>(`${B}/pay/check`, { location, ...lang() })).latest;

export const getMarket = async () => (await apiClient.get<{ latest: MarketDigest | null }>(`${B}/market`)).latest;
export const refreshMarket = async () => (await apiClient.post<{ latest: MarketDigest }>(`${B}/market/refresh`, lang())).latest;

export const getSkillPlan = async () => (await apiClient.get<{ plan: SkillPlan | null }>(`${B}/skills`)).plan;
export const buildSkillPlan = async (target_role: string, current_role: string, weeks: number) =>
  (await apiClient.post<{ plan: SkillPlan }>(`${B}/skills/plan`, { target_role, current_role, weeks, ...lang() })).plan;
export const setMilestone = async (id: string, done: boolean) => (await apiClient.post<{ plan: SkillPlan }>(`${B}/skills/milestone`, { id, done })).plan;

export const getTimeline = async () => (await apiClient.get<{ events: TimelineEvent[] }>(`${B}/timeline`)).events;
export const addTimeline = (e: { title: string; kind: string; date: string; detail?: string }) => apiClient.post<TimelineEvent>(`${B}/timeline`, e);
export const deleteTimeline = (id: string) => apiClient.delete(`${B}/timeline/${id.replace(/^t/, "")}`);
