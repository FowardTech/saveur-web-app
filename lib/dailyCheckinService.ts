import apiClient from "./apiClient";

// dailyCheckinService — web port of Saveur (mobile)'s services/dailyCheckinService.ts.
// BUG FIX (product report: "you did not implement... the regular check up
// and daily tips just the way it is in the mobile app"). Real backend --
// Saveur-Backend/app/api/daily_checkin.py:
//   GET  /api/v1/daily-checkin/today      -> {id, day, goal_text, goal_answered, reflection_text, reflection_answered, created_at}
//   POST /api/v1/daily-checkin/goal       body {text} -> same shape
//   POST /api/v1/daily-checkin/reflection body {text} -> same shape
// Explicitly distinct from the one-time, signup-time career goal
// (profile.goals) -- this is a fresh goal/reflection pair asked once per
// calendar day, used to personalize that day's coaching content.
export interface DailyCheckIn {
  id: number | null;
  day: string | null;
  goalText: string | null;
  goalAnswered: boolean;
  reflectionText: string | null;
  reflectionAnswered: boolean;
}

interface DailyCheckInWire {
  id: number | null;
  day: string | null;
  goal_text: string | null;
  goal_answered: boolean;
  reflection_text: string | null;
  reflection_answered: boolean;
}

function fromWire(w: DailyCheckInWire): DailyCheckIn {
  return {
    id: w.id,
    day: w.day,
    goalText: w.goal_text,
    goalAnswered: !!w.goal_answered,
    reflectionText: w.reflection_text,
    reflectionAnswered: !!w.reflection_answered,
  };
}

/** Read-only -- never creates a row server-side (see the backend model's
 * docstring). Dashboard uses `goalAnswered`/`reflectionAnswered` to decide
 * whether to show either prompt at all. */
export async function getToday(): Promise<DailyCheckIn> {
  const data = await apiClient.get<DailyCheckInWire>("/api/v1/daily-checkin/today");
  return fromWire(data);
}

export async function submitGoal(text: string): Promise<DailyCheckIn> {
  const data = await apiClient.post<DailyCheckInWire>("/api/v1/daily-checkin/goal", { text });
  return fromWire(data);
}

export async function submitReflection(text: string): Promise<DailyCheckIn> {
  const data = await apiClient.post<DailyCheckInWire>("/api/v1/daily-checkin/reflection", { text });
  return fromWire(data);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Local-only "already asked (and dismissed without answering) today" flags
// -- mirrors mobile's AsyncStorage-backed dailyCheckinGoalDismissedDay flag,
// using localStorage since web has no AsyncStorage. The server-side
// goalAnswered/reflectionAnswered flags alone aren't enough to stop either
// prompt from reappearing every time the dashboard mounts again the same
// day if the user closed it without answering.
const GOAL_DISMISSED_KEY = "saveur.dailyCheckinGoalDismissedDay";
const REFLECTION_DISMISSED_KEY = "saveur.dailyCheckinReflectionDismissedDay";

export function wasGoalPromptDismissedToday(): boolean {
  try {
    return window.localStorage.getItem(GOAL_DISMISSED_KEY) === todayIso();
  } catch {
    return false;
  }
}

export function dismissGoalPromptForToday(): void {
  try {
    window.localStorage.setItem(GOAL_DISMISSED_KEY, todayIso());
  } catch {
    // Private browsing / storage disabled -- worst case the prompt just
    // shows again next mount today.
  }
}

// Mobile's reflection prompt is triggered by a push notification ("How did
// your day go?") sent later in the day -- web has no push channel, so this
// approximates the same "later in the day" intent with a local time-of-day
// gate (see app/dashboard/page.tsx's own effect) instead, using the same
// per-day dismissed-flag idea so it doesn't reappear after being closed.
export function wasReflectionPromptDismissedToday(): boolean {
  try {
    return window.localStorage.getItem(REFLECTION_DISMISSED_KEY) === todayIso();
  } catch {
    return false;
  }
}

export function dismissReflectionPromptForToday(): void {
  try {
    window.localStorage.setItem(REFLECTION_DISMISSED_KEY, todayIso());
  } catch {
    // Best-effort, same as above.
  }
}
