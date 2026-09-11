import apiClient from "./apiClient";

// Web port of mobile's services/interviewReplayService.ts — Video Interview
// Replay (product report: "why is the video not recording in the web
// version because i just checked there is no video replay in web
// version"). There was no web equivalent of this service or of mobile's
// InterviewReplay.tsx screen at all: app/practice/session/[id]/page.tsx
// explicitly scoped video replay out as "a much larger feature... doesn't
// exist on web yet." Now that Video mode genuinely records and uploads a
// real session (see lib/interviewService.ts's uploadSessionVideo), that gap
// is a real regression against mobile, not just a missing nice-to-have —
// this is the client for GET /api/v1/feedback/session/:id/replay that
// closes it.
//
// Same real backend endpoint mobile uses, so the same eventual-consistency
// behavior applies here too: `videoUrl` is null for Voice/Text-mode
// sessions (nothing was ever recorded) and for a Video-mode session whose
// upload hasn't landed on the server yet.

export interface ReplayTranscriptEntry {
  role: string;
  text: string;
  tMs: number;
}

export interface ReplayAnnotation {
  tMs: number;
  type: "confidence_dip" | "strong_moment" | string;
  label: string;
}

export interface ReplayVoiceMetrics {
  wordsPerMinute: number | null;
  fillerCount: number | null;
  longPauses: number | null;
}

export interface SessionReplay {
  durationMs: number;
  /** Playable URL for the real recorded video, or null if this session has
   * none (Voice/Text mode, or a Video-mode upload that hasn't landed yet). */
  videoUrl: string | null;
  videoDurationSec: number | null;
  /** Raw diagnostic string set by POST .../video-error when the client
   * itself knows why videoUrl is null. Technical/internal by design —
   * mapped to a short human sentence below, never shown verbatim. */
  videoError: string | null;
  /** 'uploading' takes priority over a non-null videoError (an interim
   * "will retry" error can coexist with a still-in-flight upload).
   * 'none' means this was never a Video-mode session at all. */
  videoStatus: "ready" | "uploading" | "failed" | "none";
  sessionType: string | null;
  transcript: ReplayTranscriptEntry[];
  voiceMetrics: ReplayVoiceMetrics | null;
  annotations: ReplayAnnotation[];
}

interface WireReplay {
  duration_ms?: number;
  video_url?: string | null;
  video_duration_sec?: number | null;
  video_error?: string | null;
  video_status?: "ready" | "uploading" | "failed" | "none" | null;
  session_type?: string | null;
  transcript?: Array<{ role?: string; text?: string; t_ms?: number }>;
  voice_metrics?: { words_per_minute?: number; filler_count?: number; long_pauses?: number } | null;
  annotations?: Array<{ t_ms?: number; type?: string; label?: string }>;
}

function annotationLabel(type: string | undefined, rawLabel: string | undefined): string {
  // BUG FIX (mirrors mobile's own fix): the backend sends `label` as a
  // fixed, hardcoded-English template string per annotation `type` — not
  // AI-generated commentary, so there's nothing to localize server-side.
  // `type` itself is a stable, translatable enum; the actual i18n happens
  // where this is rendered (the caller passes its own `t`), so this just
  // returns the backend's raw label as a safe fallback for a future
  // annotation type this client doesn't recognize yet.
  return rawLabel ?? "";
}

/** GET /api/v1/feedback/session/:id/replay */
export async function getSessionReplay(sessionId: string | number): Promise<SessionReplay> {
  // NOTE: apiClient.get returns the parsed body directly (no `.data`
  // wrapper) — unlike mobile's axios-based apiClient this is porting from.
  const data = await apiClient.get<WireReplay>(`/api/v1/feedback/session/${sessionId}/replay`);
  return {
    durationMs: data.duration_ms ?? 0,
    videoUrl: data.video_url ?? null,
    videoDurationSec: data.video_duration_sec ?? null,
    videoError: data.video_error ?? null,
    videoStatus: data.video_status ?? "none",
    sessionType: data.session_type ?? null,
    transcript: (data.transcript ?? []).map((m) => ({
      role: m.role ?? "",
      text: m.text ?? "",
      tMs: m.t_ms ?? 0,
    })),
    voiceMetrics: data.voice_metrics
      ? {
          wordsPerMinute: data.voice_metrics.words_per_minute ?? null,
          fillerCount: data.voice_metrics.filler_count ?? null,
          longPauses: data.voice_metrics.long_pauses ?? null,
        }
      : null,
    annotations: (data.annotations ?? []).map((a) => ({
      tMs: a.t_ms ?? 0,
      type: (a.type as ReplayAnnotation["type"]) ?? "",
      label: annotationLabel(a.type, a.label),
    })),
  };
}

/** DELETE /api/v1/interviews/sessions/:id/video — lets a user delete their
 * own recorded interview video on demand, same as mobile's identical
 * "There should be a delete button in the video interview" feature. */
export async function deleteSessionVideo(sessionId: string | number): Promise<void> {
  await apiClient.delete(`/api/v1/interviews/sessions/${sessionId}/video`);
}

export function formatMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
