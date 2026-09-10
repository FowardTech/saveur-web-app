// goalsPreferencesService — web port of Saveur/services/goalsPreferencesService.ts.
// Local-only weekly targets for the Goals hub (app/goals/page.tsx) — "3 of 5
// practice sessions this week" style progress rows. Deliberately plain
// localStorage rather than a new backend model/endpoint, matching mobile's
// own AsyncStorage-only implementation (see that file's header comment):
// these are personal targets the learner sets for their own glance-value,
// not something the admin dashboard or any other part of the product needs
// to read or enforce. Scoped per-uid (mirrors mobile's accountScopedKey) so
// a shared browser profile doesn't leak one account's targets into another.
export interface WeeklyTargets {
  practiceSessions: number;
  applications: number;
}

const DEFAULT_TARGETS: WeeklyTargets = {
  practiceSessions: 3,
  applications: 5,
};

function storageKey(uid?: string | null): string {
  return `saveur:goalsWeeklyTargets:${uid || "anon"}`;
}

export function getWeeklyTargets(uid?: string | null): WeeklyTargets {
  if (typeof window === "undefined") return DEFAULT_TARGETS;
  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    if (!raw) return DEFAULT_TARGETS;
    const parsed = JSON.parse(raw);
    return {
      practiceSessions: Number(parsed?.practiceSessions) || DEFAULT_TARGETS.practiceSessions,
      applications: Number(parsed?.applications) || DEFAULT_TARGETS.applications,
    };
  } catch {
    return DEFAULT_TARGETS;
  }
}

export function setWeeklyTargets(targets: WeeklyTargets, uid?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(uid), JSON.stringify(targets));
  } catch {
    // best-effort — worst case the edited target doesn't persist
  }
}
