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
// src/practice/LiveInterviewSession.tsx. Text, Voice, AND Video mode are all
// fully real — same endpoints, same session/feedback pipeline mobile uses.
// Video mode swaps mobile's on-device react-native-vision-camera + ML Kit
// face detector for a real AI-vision backend call (see analyzeCameraFrame
// below and Saveur-Backend/app/api/interviews.py's analyze-camera-frame
// endpoint) — same CameraAnalysisFrame persistence/replay either way.
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

// ---------------------------------------------------------------------------
// Video mode — real webcam capture + recording (product report: "For video
// mode I think it can be accomplishable in web too... make use of AI and
// some APIs. I want you to implement it perfectly on web too"). The Q&A
// loop itself is identical to Voice mode (same TTS question / Web Speech
// API answer capture); these three functions are what's ADDED on top:
// recording the whole session and getting a real, AI-scored engagement
// read on the candidate, matching mobile's real recorded video + real
// per-frame camera metrics as closely as a browser honestly allows.
// ---------------------------------------------------------------------------

export interface CameraFrameAnalysis {
  faceDetected: boolean;
  eyeContact: boolean;
  smile: boolean;
  headYaw: number | null;
  headPitch: number | null;
  postureScore: number | null;
}

/** POST /api/v1/interviews/sessions/:id/analyze-camera-frame — a single
 * webcam snapshot judged by a real AI vision call (Saveur-Backend has no
 * on-device ML Kit face detector to reach for on web, see that endpoint's
 * own docstring for the full reasoning). `imageDataUrl` is a
 * `data:image/jpeg;base64,...` string, e.g. from `canvas.toDataURL(...)`.
 * Returns null on any failure (including a real LLM billing/quota outage)
 * — best-effort, must never interrupt the live interview over one missed
 * engagement sample. */
export async function analyzeCameraFrame(sessionId: string | number, imageDataUrl: string): Promise<CameraFrameAnalysis | null> {
  try {
    const data = await apiClient.post<{
      ok: boolean;
      face_detected?: boolean;
      eye_contact?: boolean;
      smile?: boolean;
      head_yaw?: number | null;
      head_pitch?: number | null;
      posture_score?: number | null;
    }>(`/api/v1/interviews/sessions/${sessionId}/analyze-camera-frame`, { image: imageDataUrl });
    if (!data.ok) return null;
    return {
      faceDetected: data.face_detected ?? false,
      eyeContact: data.eye_contact ?? false,
      smile: data.smile ?? false,
      headYaw: data.head_yaw ?? null,
      headPitch: data.head_pitch ?? null,
      postureScore: data.posture_score ?? null,
    };
  } catch {
    return null;
  }
}

/** POST /api/v1/feedback/session/:id/camera-frame — persists one analyzed
 * frame into the SAME CameraAnalysisFrame timeline mobile's on-device
 * detector writes to, so GET /api/v1/feedback/session/:id/replay's
 * camera_points and camera-summary work identically for a web session.
 * Best-effort — a dropped sample is never worth surfacing to the user. */
export async function postCameraFrame(sessionId: string | number, analysis: CameraFrameAnalysis): Promise<void> {
  try {
    await apiClient.post(`/api/v1/feedback/session/${sessionId}/camera-frame`, {
      frames: [{
        ts: Date.now(),
        eye_contact: analysis.eyeContact,
        smile: analysis.smile,
        head_yaw: analysis.headYaw,
        head_pitch: analysis.headPitch,
        posture_score: analysis.postureScore,
      }],
    });
  } catch {
    // best-effort
  }
}

/** POST /api/v1/interviews/sessions/:id/video — uploads the real recorded
 * MediaRecorder blob once the session ends, same multipart contract
 * mobile's react-native-vision-camera recording uploads to. Sets
 * InterviewSession.video_key server-side, which is what makes
 * GET .../replay return a real, watchable video_url afterward. Throws on
 * failure — the caller decides whether a failed upload should still let
 * the session end (recommended: yes, same as mobile's own resilient-retry
 * posture — losing the recording is much less bad than getting the
 * candidate stuck unable to see their score). */
export async function uploadSessionVideo(sessionId: string | number, blob: Blob, durationSec: number): Promise<void> {
  const formData = new FormData();
  formData.append("file", blob, "interview.webm");
  formData.append("duration_sec", String(durationSec));
  await apiClient.upload(`/api/v1/interviews/sessions/${sessionId}/video`, formData);
}
