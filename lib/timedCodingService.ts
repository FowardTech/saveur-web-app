import i18n from "i18next";
import apiClient from "./apiClient";

// Timed coding practice (web port of mobile's coding mock-interview flow:
// MockInterviewSetup -> CodingInterview). A normal interview session of
// type "coding" owns the countdown + final AI feedback; the solve page
// (app/practice/coding/[slug]) adds the timer, "Next problem", and Finish.
export interface TimedAttempt {
  problemSlug?: string;
  problemTitle?: string;
  problemStatement: string;
  language: string;
  code: string;
  testsPassed?: number;
  testsTotal?: number;
}

export interface TimedState {
  sessionId: string;
  endsAt: number; // epoch ms
  difficulty: string;
}

const attemptsKey = (sessionId: string) => `timedCodingAttempts:${sessionId}`;

export function loadAttempts(sessionId: string): TimedAttempt[] {
  try {
    return JSON.parse(sessionStorage.getItem(attemptsKey(sessionId)) || "[]");
  } catch {
    return [];
  }
}

/** Replace-or-append the attempt for this problem (so re-visiting/re-running
 * the same problem doesn't double count it). */
export function saveAttempt(sessionId: string, attempt: TimedAttempt): TimedAttempt[] {
  const all = loadAttempts(sessionId).filter((a) => a.problemSlug !== attempt.problemSlug);
  all.push(attempt);
  try {
    sessionStorage.setItem(attemptsKey(sessionId), JSON.stringify(all));
  } catch {
    // sessionStorage unavailable — attempts for earlier problems are lost, session still completes
  }
  return all;
}

export async function startTimedSession(difficulty: string, durationMin: number): Promise<string> {
  const data = await apiClient.post<{ id?: string | number; session_id?: string | number }>("/api/v1/interviews/sessions", {
    type: "coding",
    role: "Coding Candidate",
    difficulty,
    duration_min: durationMin,
    mode: "text",
    language: i18n.language || "en",
  });
  return String(data.id ?? data.session_id);
}

export async function nextProblemSlug(difficulty: string, exclude: string[]): Promise<string | null> {
  const p = await apiClient.get<{ slug?: string }>("/api/v1/coding/problem", {
    params: { next: "1", difficulty, exclude: exclude.join(",") },
  });
  return p.slug ?? null;
}

export async function finishTimedSession(sessionId: string, attempts: TimedAttempt[]): Promise<void> {
  const last = attempts[attempts.length - 1];
  await apiClient.post(`/api/v1/interviews/sessions/${sessionId}/end`, {
    coding_result: last
      ? {
          language: last.language,
          code: last.code,
          problemStatement: last.problemStatement,
          testsPassed: last.testsPassed,
          testsTotal: last.testsTotal,
          attempts: attempts.length > 1 ? attempts : undefined,
        }
      : undefined,
  });
}
