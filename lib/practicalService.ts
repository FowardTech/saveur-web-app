import apiClient, { type ApiError } from "./apiClient";

// ---------------------------------------------------------------------------
// practicalService — Practical Scenarios (product request): "coding practice
// already gives software engineers something hands-on to actually DO — every
// other career type only gets talk-based mock interviews." This backs the
// hands-on, multi-step decision scenario for non-engineering tracks (mobile
// counterpart: Saveur/services/practicalService.ts) rendered by
// app/practice/scenarios/page.tsx. Real backend contract, confirmed against
// Saveur-Backend/app/api/practical.py:
//   POST /api/v1/practical/sessions              -> {session, step}
//   POST /api/v1/practical/sessions/:id/choose       -> {status: "active", step} | {status: "completed"}
//   POST /api/v1/practical/sessions/:id/submit-task  -> {status, step?, task_feedback}
//
// Product follow-up ("what about adding more advance features... like hands
// on works?"): a couple of steps per session (server-determined; see
// practical.py's TASK_STEP_NUMBERS = (3, 5) of MAX_STEPS=6) are now
// `step_type: "task"` instead of `step_type: "choice"` — the AI poses a real
// written deliverable (task_prompt), the learner submits free text via
// submitTask() below, and that ONE submission is graded immediately
// (task_feedback), mirroring codingService's instant AI review of real code
// rather than only finding out how they did at the very end. `choose()` now
// explicitly rejects being called on a pending task step (`no_pending_step`)
// — the client must check `step.stepType` and route to submitTask() instead.
// ---------------------------------------------------------------------------

export type PracticalType = "healthcare" | "sales" | "marketing" | "finance" | "consulting" | "science";
export type PracticalStepType = "choice" | "task";

export interface PracticalChoice {
  id: string;
  text: string;
}

export interface PracticalTaskFeedback {
  feedback: string;
  strengths: string[];
  improvements: string[];
}

export interface PracticalStep {
  order: number;
  stepType: PracticalStepType;
  situation: string;
  // Only meaningful when stepType === "choice".
  choices: PracticalChoice[];
  chosenChoiceId: string | null;
  // Only meaningful when stepType === "task".
  taskPrompt: string | null;
  responseText: string | null;
  taskFeedback: PracticalTaskFeedback | null;
  isFinal: boolean;
}

export interface PracticalSessionSummary {
  id: number;
  type: PracticalType;
  role: string | null;
  status: "active" | "completed";
}

export interface PracticalStepNote {
  order: number;
  note: string;
  isStrongMoment: boolean;
}

// Aggregated end-of-session scoring — generated in the BACKGROUND right
// after the final step (Saveur-Backend/app/tasks/practical_feedback_job.py),
// so it usually isn't ready the instant the session completes. Mirrors
// mobile's Saveur/services/practicalService.ts PracticalFeedback 1:1 (same
// four named rubric scores + overall + summary + strengths/improvements +
// per-step notes) -- see PracticalScenarioFeedback.tsx on that side for the
// screen this feeds, which this web page's own completion view now mirrors
// (product report: "But i did not see any feedback" -- the web completion
// screen only ever said "being generated in the background" and never
// actually fetched/displayed it once ready; this was a genuine missing
// screen, not a backend bug).
export interface PracticalFeedback {
  judgment: number | null;
  domainKnowledge: number | null;
  communication: number | null;
  criticalThinking: number | null;
  overall: number | null;
  summary: string;
  strengths: string[];
  improvements: string[];
  stepNotes: PracticalStepNote[];
}

export interface PracticalSessionDetail extends PracticalSessionSummary {
  steps: PracticalStep[];
  feedback: PracticalFeedback | null;
}

interface WireChoice {
  id?: string;
  text?: string;
}

interface WireTaskFeedback {
  feedback?: string;
  strengths?: string[];
  improvements?: string[];
}

interface WireStep {
  order?: number;
  step_type?: string;
  situation?: string;
  choices?: WireChoice[];
  chosen_choice_id?: string | null;
  task_prompt?: string | null;
  response_text?: string | null;
  task_feedback?: WireTaskFeedback | null;
  is_final?: boolean;
}

interface WireFeedback {
  judgment?: number | null;
  domain_knowledge?: number | null;
  communication?: number | null;
  critical_thinking?: number | null;
  overall?: number | null;
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  step_notes?: { order?: number; note?: string; is_strong_moment?: boolean }[];
}

interface WireSession {
  id?: number;
  type?: string;
  role?: string | null;
  status?: string;
  steps?: WireStep[];
  feedback?: WireFeedback | null;
}

function mapTaskFeedback(raw: WireTaskFeedback | null | undefined): PracticalTaskFeedback | null {
  if (!raw) return null;
  return {
    feedback: raw.feedback ?? "",
    strengths: raw.strengths ?? [],
    improvements: raw.improvements ?? [],
  };
}

function mapStep(raw: WireStep): PracticalStep {
  return {
    order: raw.order ?? 0,
    stepType: (raw.step_type as PracticalStepType) || "choice",
    situation: raw.situation ?? "",
    choices: (raw.choices ?? []).map((c) => ({ id: c.id ?? "", text: c.text ?? "" })),
    chosenChoiceId: raw.chosen_choice_id ?? null,
    taskPrompt: raw.task_prompt ?? null,
    responseText: raw.response_text ?? null,
    taskFeedback: mapTaskFeedback(raw.task_feedback),
    isFinal: raw.is_final ?? false,
  };
}

function mapSession(raw: WireSession): PracticalSessionSummary {
  return {
    id: raw.id ?? 0,
    type: (raw.type as PracticalType) || "healthcare",
    role: raw.role ?? null,
    status: (raw.status as "active" | "completed") || "active",
  };
}

function mapFeedback(raw: WireFeedback | null | undefined): PracticalFeedback | null {
  if (!raw) return null;
  return {
    judgment: raw.judgment ?? null,
    domainKnowledge: raw.domain_knowledge ?? null,
    communication: raw.communication ?? null,
    criticalThinking: raw.critical_thinking ?? null,
    overall: raw.overall ?? null,
    summary: raw.summary ?? "",
    strengths: raw.strengths ?? [],
    improvements: raw.improvements ?? [],
    stepNotes: (raw.step_notes ?? []).map((n) => ({
      order: n.order ?? 0,
      note: n.note ?? "",
      isStrongMoment: n.is_strong_moment ?? false,
    })),
  };
}

/** POST /api/v1/practical/sessions — starts a new scenario and returns its first AI-generated step (always step_type "choice" — see practical.py's TASK_STEP_NUMBERS, which deliberately excludes step 1). */
export async function createSession(
  type: PracticalType,
  role?: string
): Promise<{ session: PracticalSessionSummary; step: PracticalStep }> {
  const data = await apiClient.post<{ session: WireSession; step: WireStep }>("/api/v1/practical/sessions", {
    type,
    role: role || undefined,
  });
  return { session: mapSession(data.session), step: mapStep(data.step) };
}

/**
 * POST /api/v1/practical/sessions/:id/choose — records the learner's pick for
 * the current step. Only valid when that step is step_type "choice"; calling
 * this on a pending "task" step gets a 400 `no_pending_step` back (route to
 * submitTask() instead). Returns the next step if the scenario continues, or
 * {status: 'completed'} once the final step is reached.
 */
export async function chooseOption(
  sessionId: number,
  choiceId: string
): Promise<{ status: "completed" } | { status: "active"; step: PracticalStep }> {
  const data = await apiClient.post<{ status: string; step?: WireStep }>(
    `/api/v1/practical/sessions/${sessionId}/choose`,
    { choice_id: choiceId }
  );
  if (data.status === "completed" || !data.step) {
    return { status: "completed" };
  }
  return { status: "active", step: mapStep(data.step) };
}

/**
 * POST /api/v1/practical/sessions/:id/submit-task — the task-step equivalent
 * of chooseOption() above. Stores the learner's free-text response, grades it
 * immediately with AI, and (unless this was the final step) generates the
 * next step in the same round trip — returns both `taskFeedback` (always
 * present) and the next `step` (absent once the session is complete).
 */
export async function submitTask(
  sessionId: number,
  responseText: string
): Promise<
  | { status: "completed"; taskFeedback: PracticalTaskFeedback }
  | { status: "active"; step: PracticalStep; taskFeedback: PracticalTaskFeedback }
> {
  const data = await apiClient.post<{ status: string; step?: WireStep; task_feedback?: WireTaskFeedback }>(
    `/api/v1/practical/sessions/${sessionId}/submit-task`,
    { response_text: responseText }
  );
  const taskFeedback = mapTaskFeedback(data.task_feedback) || { feedback: "", strengths: [], improvements: [] };
  if (data.status === "completed" || !data.step) {
    return { status: "completed", taskFeedback };
  }
  return { status: "active", step: mapStep(data.step), taskFeedback };
}

/** GET /api/v1/practical/sessions/:id — full session with steps + feedback
 * (feedback is null until practical_feedback_job's background pass finishes;
 * poll this like mobile's PracticalScenarioFeedback.tsx does). */
export async function getSession(sessionId: number): Promise<PracticalSessionDetail> {
  const data = await apiClient.get<WireSession>(`/api/v1/practical/sessions/${sessionId}`);
  return {
    ...mapSession(data),
    steps: (data.steps ?? []).map(mapStep),
    feedback: mapFeedback(data.feedback),
  };
}

/** True when an ApiError came from the backend's shared LLMUnavailable
 * handler (Saveur-Backend/app/__init__.py) — see lib/learningService.ts's
 * isLLMUnavailable for the full explanation of this app-wide convention. The
 * handler already scrubs the raw provider error, so callers should just
 * display `err.message` rather than inventing their own copy. */
export function isLLMUnavailable(err: unknown): boolean {
  return (err as ApiError | undefined)?.error === "llm_unavailable";
}
