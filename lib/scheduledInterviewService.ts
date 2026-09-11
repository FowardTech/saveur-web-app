import apiClient from "./apiClient";
import { INTERVIEW_TYPES, interviewTypeFromSlug, interviewTypeSlug } from "./interviewData";

// Real backend contract, confirmed against Saveur-Backend/app/api/scheduled.py
// + app/models/scheduled.py (NOT just mobile's own client-side contract
// comment in services/scheduledInterviewService.ts, which was written before
// the endpoints existed and doesn't necessarily match 1:1):
//
//   GET    /api/v1/interviews/scheduled       -> ScheduledInterviewWire[]
//     (auth required; server already filters to this user's non-canceled,
//     still-future rows and sorts soonest-first, capped at 100 — no query
//     params needed/supported)
//   POST   /api/v1/interviews/scheduled       -> ScheduledInterviewWire
//     body: { interview_type?, mode?, difficulty?, role?, company?,
//              duration_min?, scheduled_at: number (required, unix SECONDS) }
//     (scheduled_at is the only required field server-side; everything else
//     defaults server-side, but this app always sends all of them)
//   DELETE /api/v1/interviews/scheduled/{id}  -> { ok: true } | 404
//     (soft-cancel — sets canceled_at, doesn't hard-delete the row)
//
// interview_type/mode/difficulty are free-form string columns with no
// server-side enum validation. This uses the same wire values mobile's
// services/scheduledInterviewService.ts (TYPE_TO_WIRE/MODE_TO_WIRE/
// DIFFICULTY_TO_WIRE) sends — lowercase mode/difficulty ("voice"/"text"/
// "video", "beginner"/"intermediate"/"advanced"), and for interview_type the
// label lowercased with underscores (e.g. "System Design" -> "system_design").
// That last one is deliberately the SAME string lib/interviewData.ts's own
// interviewTypeSlug() produces (used for the `?type=` prefill query param
// elsewhere in this app), NOT the hyphenated `wire` field INTERVIEW_TYPES
// entries use for session creation (e.g. "system-design") — so a scheduled
// row's interview_type round-trips straight into the `?type=` convention
// used to pre-fill app/practice/mock-interviews/page.tsx.
export interface ScheduledInterviewWire {
  id: string;
  interview_type: string | null;
  mode: string | null;
  difficulty: string | null;
  role: string | null;
  company?: string | null;
  duration_min: number | null;
  scheduled_at: number | null; // unix seconds
}

export type PracticeModeLabel = "Voice" | "Text" | "Video";
export type DifficultyLabel = "Beginner" | "Intermediate" | "Advanced";

export interface ScheduledInterview {
  id: string;
  interviewTypeSlug: string;
  interviewTypeLabel: string;
  mode: PracticeModeLabel;
  difficulty: DifficultyLabel;
  role: string;
  company?: string;
  durationMin: number;
  scheduledAt: number; // ms epoch
}

const MODE_LABELS: Record<string, PracticeModeLabel> = { voice: "Voice", text: "Text", video: "Video" };
const DIFFICULTY_LABELS: Record<string, DifficultyLabel> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function fromWire(wire: ScheduledInterviewWire): ScheduledInterview {
  const slug = wire.interview_type ?? "behavioral";
  const type = interviewTypeFromSlug(slug) ?? INTERVIEW_TYPES[0];
  return {
    id: wire.id,
    interviewTypeSlug: slug,
    interviewTypeLabel: type.label,
    mode: MODE_LABELS[(wire.mode ?? "voice").toLowerCase()] ?? "Voice",
    difficulty: DIFFICULTY_LABELS[(wire.difficulty ?? "intermediate").toLowerCase()] ?? "Intermediate",
    role: wire.role ?? "",
    company: wire.company ?? undefined,
    durationMin: wire.duration_min ?? 30,
    scheduledAt: (wire.scheduled_at ?? 0) * 1000,
  };
}

export interface CreateScheduledInput {
  /** One of INTERVIEW_TYPES[].label (lib/interviewData.ts). */
  interviewTypeLabel: string;
  mode: PracticeModeLabel;
  difficulty: DifficultyLabel;
  role: string;
  company?: string;
  durationMin: number;
  /** ms epoch — must be in the future; the caller validates this. */
  scheduledAt: number;
}

function toWire(input: CreateScheduledInput) {
  return {
    interview_type: interviewTypeSlug(input.interviewTypeLabel),
    mode: input.mode.toLowerCase(),
    difficulty: input.difficulty.toLowerCase(),
    role: input.role.trim(),
    company: input.company ?? null,
    duration_min: input.durationMin,
    scheduled_at: Math.round(input.scheduledAt / 1000),
  };
}

/** GET /api/v1/interviews/scheduled */
export async function listUpcoming(): Promise<ScheduledInterview[]> {
  const rows = await apiClient.get<ScheduledInterviewWire[]>("/api/v1/interviews/scheduled");
  return (rows ?? []).map(fromWire);
}

/** POST /api/v1/interviews/scheduled */
export async function createScheduled(input: CreateScheduledInput): Promise<ScheduledInterview> {
  const wire = await apiClient.post<ScheduledInterviewWire>("/api/v1/interviews/scheduled", toWire(input));
  return fromWire(wire);
}

/** DELETE /api/v1/interviews/scheduled/{id} — soft-cancel. */
export async function cancelScheduled(id: string): Promise<void> {
  await apiClient.delete<{ ok: boolean }>(`/api/v1/interviews/scheduled/${id}`);
}
