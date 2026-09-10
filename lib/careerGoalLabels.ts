// Shared career-goal option list — mirrors mobile's utils/careerGoalLabels.ts
// (CAREER_GOALS), the single source of truth used by both
// src/auth/Signup/SignupFirstStep.tsx (goal picker at signup) and
// src/more/ChangeCareType/index.tsx (the "change it later" equivalent).
//
// Same stable-identifier convention mobile's own file documents (see that
// file's "BUG FIX" header comment): `defaultValue` below is the untranslated
// English string persisted to profile.goals on the backend, NOT the
// resolved display string for whatever locale is active — a value baked
// into one language at save time could never be re-translated later.
// app/onboarding/page.tsx and app/progress/page.tsx both read/write through
// this shared list rather than each keeping their own copy, so the id set
// can't drift out of sync between the two (the exact bug mobile's own
// header comment traces back to two hand-duplicated lists).
export interface CareerGoalOption {
  /** Suffix under the `web:onboarding.goals.*` i18n namespace. */
  key: string;
  /** Stable English identifier — persisted to profile.goals verbatim, and
   * used as the fallback display string for any locale missing the key. */
  defaultValue: string;
}

export const CAREER_GOALS: CareerGoalOption[] = [
  { key: "newJob", defaultValue: "Land a New Job" },
  { key: "careerChange", defaultValue: "Career Change" },
  { key: "promotion", defaultValue: "Promotion" },
  { key: "returnToWork", defaultValue: "Return to Work" },
  { key: "internship", defaultValue: "Internship / Grad Job" },
  { key: "executive", defaultValue: "Executive Move" },
  { key: "startBusiness", defaultValue: "Start a Business" },
  { key: "relocate", defaultValue: "Relocate / Work Abroad" },
  { key: "growNetwork", defaultValue: "Grow My Network" },
  { key: "exploreOptions", defaultValue: "Explore My Options" },
];

type TFunc = (key: string, options?: Record<string, unknown>) => string;

/** Reverse lookup for display — falls back to the raw stored string if it
 * doesn't match any known goal (covers legacy data saved before this list
 * existed, or before the stable-id fix below shipped). */
export function getCareerGoalLabel(goal: string | undefined, t: TFunc): string {
  if (!goal) return "";
  const found = CAREER_GOALS.find((g) => g.defaultValue === goal);
  return found ? t(`web:onboarding.goals.${found.key}`, { defaultValue: found.defaultValue }) : goal;
}
