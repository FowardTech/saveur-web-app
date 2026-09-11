import apiClient from "./apiClient";

// Real backend contract — Saveur-Backend/app/api/interviews.py. Session
// CREATION already happens inline in app/practice/mock-interviews/page.tsx
// (POST /api/v1/interviews/sessions); this file backs the LIVE session
// itself (app/practice/interview/[id]/page.tsx) — the "real-time Q&A with
// your AI interviewer... instant feedback at the end" experience that page
// used to just describe as "coming to the web app in a future pass"
// (product report: "Why are you leaving this feature out of the web app").
//
// Mirrors mobile's Saveur/services/interviewService.ts + the Q&A loop in
// src/practice/LiveInterviewSession.tsx, with ONE deliberate scope cut:
// Video mode's live on-camera face/speech analysis (react-native-vision-
// camera + ML Kit face detection + a from-scratch native audio-session
// pipeline — see that file's own header comment for just how deep that
// native dependency goes) has no reasonable browser equivalent and isn't
// attempted here. Text and Voice mode are both fully real — same endpoints,
// same session/feedback pipeline mobile uses.
//
//   POST /api/v1/interviews/sessions/:id/next-question -> {question_id, text, requires_whiteboard}
//   POST /api/v1/interviews/sessions/:id/answer         -> {ok: true}   body: {text}
//   POST /api/v1/interviews/sessions/:id/end            -> {status: "pending", id}
//   GET  /api/v1/interviews/sessions/:id                -> full session + messages (see below)
//
// Note: unlike mobile's client-side bookkeeping, the backend's POST .../answer
// never actually reads/validates questionId — it just appends a plain
// candidate message — so this file doesn't bother threading one through.

export interface InterviewMessageWire {
  role: "interviewer" | "candidate";
  text: string;
  at: string;
}

export interface InterviewSessionDetail {
  id: number;
  type: string;
  role: string | null;
  company: string | null;
  mode: "voice" | "text" | "video" | string;
  difficulty: string | null;
  status: "active" | "completed" | string;
  durationMin: number | null;
  messages: InterviewMessageWire[];
}

interface WireSessionDetail {
  id: number;
  type: string;
  role?: string | null;
  company?: string | null;
  mode?: string;
  difficulty?: string | null;
  status: string;
  duration_min?: number | null;
  messages?: InterviewMessageWire[];
}

/** GET /api/v1/interviews/sessions/:id — used on mount to seed the live
 * session screen with everything the setup step already saved (mode,
 * duration, and the first question create_session generated), so nothing
 * needs to be threaded through the navigation itself. */
export async function getSession(sessionId: string | number): Promise<InterviewSessionDetail> {
  const data = await apiClient.get<WireSessionDetail>(`/api/v1/interviews/sessions/${sessionId}`);
  return {
    id: data.id,
    type: data.type,
    role: data.role ?? null,
    company: data.company ?? null,
    mode: (data.mode ?? "voice").toLowerCase(),
    difficulty: data.difficulty ?? null,
    status: (data.status as "active" | "completed") ?? "active",
    durationMin: data.duration_min ?? null,
    messages: data.messages ?? [],
  };
}

export interface NextQuestionResult {
  text: string;
  requiresWhiteboard: boolean;
}

/** POST /api/v1/interviews/sessions/:id/next-question. `requiresWhiteboard`
 * (product feature: the AI hands off to a system-design whiteboard exercise)
 * has no web whiteboard screen to hand off to — callers just keep treating
 * the returned text as a normal follow-up question instead, a deliberate,
 * honest degradation rather than a broken deep link. */
export async function getNextQuestion(sessionId: string | number): Promise<NextQuestionResult> {
  const data = await apiClient.post<{ question_id: string; text: string; requires_whiteboard?: boolean }>(
    `/api/v1/interviews/sessions/${sessionId}/next-question`,
    {}
  );
  return { text: data.text, requiresWhiteboard: !!data.requires_whiteboard };
}

/** POST /api/v1/interviews/sessions/:id/answer — records the candidate's
 * answer (typed in Text mode, transcribed in Voice mode via the Web Speech
 * API) as the next message in the transcript. */
export async function submitAnswer(sessionId: string | number, text: string): Promise<void> {
  await apiClient.post(`/api/v1/interviews/sessions/${sessionId}/answer`, { text });
}

/** POST /api/v1/interviews/sessions/:id/end — marks the session completed
 * and kicks off background AI scoring (Saveur-Backend's feedback_job.py);
 * the caller should navigate to app/practice/session/[id]/page.tsx right
 * after, which already polls GET /api/v1/feedback/session/:id until that
 * scoring finishes. */
export async function endSession(sessionId: string | number): Promise<void> {
  await apiClient.post(`/api/v1/interviews/sessions/${sessionId}/end`, {});
}
