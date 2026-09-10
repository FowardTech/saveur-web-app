import apiClient from "./apiClient";

// ---------------------------------------------------------------------------
// gamificationService — web port of Saveur/services/gamificationService.ts +
// services/dailyChallengeService.ts. Real backend contract, confirmed
// against Saveur-Backend:
//   GET  /api/v1/gamification/streak       — current streak + XP
//   POST /api/v1/gamification/checkin      — daily check-in
//   GET  /api/v1/gamification/leaderboard  — top users, ?period=
//   GET  /api/v1/daily-challenge/today     — today's Surprise Daily Challenge
//   POST /api/v1/daily-challenge/submit    — {response, language}
//   POST /api/v1/daily-challenge/skip      — {language}
// Backs app/progress/page.tsx (mirrors mobile's src/practice/MyProgress.tsx)
// and app/progress/leaderboard/page.tsx (mirrors src/home/Leaderboard.tsx).
// ---------------------------------------------------------------------------

export interface GamificationStreak {
  streakDays: number;
  longestStreak?: number;
  xp: number;
  checkedInToday: boolean;
}

interface StreakWire {
  streak_days: number;
  longest_streak?: number;
  xp: number;
  checked_in_today: boolean;
}

function fromStreakWire(wire: StreakWire): GamificationStreak {
  return {
    streakDays: wire.streak_days ?? 0,
    longestStreak: wire.longest_streak,
    xp: wire.xp ?? 0,
    checkedInToday: wire.checked_in_today ?? false,
  };
}

export async function getStreak(): Promise<GamificationStreak> {
  const data = await apiClient.get<StreakWire>("/api/v1/gamification/streak");
  return fromStreakWire(data);
}

export async function checkin(): Promise<GamificationStreak> {
  const data = await apiClient.post<StreakWire>("/api/v1/gamification/checkin", {});
  return fromStreakWire(data);
}

export type LeaderboardPeriod = "all" | "daily" | "weekly" | "monthly";

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatarUrl?: string;
  xp: number;
  rank: number;
  isCurrentUser: boolean;
  changePct: number | null;
}

interface LeaderboardEntryWire {
  user_id: string;
  name: string;
  avatar_url?: string;
  xp: number;
  rank: number;
  change_pct?: number | null;
}

/** GET /api/v1/gamification/leaderboard?period=. `currentUid` (the signed-in
 * Firebase uid) is passed in by the caller rather than read from a global
 * auth singleton here (mobile's fromLeaderboardWire reads
 * auth().currentUser?.uid directly — web's Firebase SDK usage goes through
 * AuthProvider/useAuth instead, so this stays a pure function of its args). */
export async function getLeaderboard(period: LeaderboardPeriod = "all", currentUid?: string | null): Promise<LeaderboardEntry[]> {
  const data = await apiClient.get<LeaderboardEntryWire[]>("/api/v1/gamification/leaderboard", {
    params: { period },
  });
  return (data ?? []).map((wire) => ({
    id: wire.user_id,
    name: wire.name,
    avatarUrl: wire.avatar_url,
    xp: wire.xp ?? 0,
    rank: wire.rank,
    isCurrentUser: !!currentUid && wire.user_id === currentUid,
    changePct: wire.change_pct ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Surprise Daily Challenge (Saveur-Backend/app/api/daily_challenge.py) — one
// unpredictable practice challenge a day. Mobile surfaces this via Home's
// "Today's Mission" hero card (src/home/HomeSrc.tsx's missionHero, priority
// #1) rather than on My Progress/Leaderboard — web has no equivalent
// dashboard mission-hero yet, so this is surfaced as its own compact card on
// app/progress/page.tsx instead, the closest existing gamification surface.
// ---------------------------------------------------------------------------

export interface DailyChallenge {
  id: number;
  day: string;
  challengeType: string;
  promptText: string;
  responseText: string | null;
  aiFeedback: string | null;
  completed: boolean;
  skipped: boolean;
  xpAwarded: number;
}

interface DailyChallengeWire {
  id: number;
  day?: string;
  challenge_type?: string;
  prompt_text?: string;
  response_text?: string | null;
  ai_feedback?: string | null;
  completed?: boolean;
  skipped?: boolean;
  xp_awarded?: number;
}

function fromChallengeWire(w: DailyChallengeWire): DailyChallenge {
  return {
    id: w.id,
    day: w.day ?? "",
    challengeType: w.challenge_type ?? "",
    promptText: w.prompt_text ?? "",
    responseText: w.response_text ?? null,
    aiFeedback: w.ai_feedback ?? null,
    completed: !!w.completed,
    skipped: !!w.skipped,
    xpAwarded: w.xp_awarded ?? 0,
  };
}

export async function getTodayChallenge(language?: string): Promise<DailyChallenge> {
  const data = await apiClient.get<DailyChallengeWire>("/api/v1/daily-challenge/today", {
    params: { language },
  });
  return fromChallengeWire(data);
}

export async function submitChallengeResponse(response: string, language?: string): Promise<DailyChallenge> {
  const data = await apiClient.post<DailyChallengeWire>("/api/v1/daily-challenge/submit", { response, language });
  return fromChallengeWire(data);
}

export async function skipTodayChallenge(language?: string): Promise<DailyChallenge> {
  const data = await apiClient.post<DailyChallengeWire>("/api/v1/daily-challenge/skip", { language });
  return fromChallengeWire(data);
}
