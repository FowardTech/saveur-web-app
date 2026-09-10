import apiClient from "./apiClient";

// goalTipsService — web port of Saveur/services/goalTipsService.ts.
// Real backend contract (Saveur-Backend/app/api/goals.py's tips_today ->
// app/services/goal_tip_service.py's get_or_create_tips_for_user):
//   GET /api/v1/goals/tips/today?language=xx -> GoalTipWire[]
// One AI-generated tip per goal the signed-in user currently has set,
// refreshed once per day server-side — this never asks the backend to
// *generate* a tip on demand, it just reads whatever's cached for "today".
// Backs app/goals/today-tip/page.tsx, the web destination for a "goal_tip"
// notification tap (see lib/notifications.ts's notificationHref) — same
// relationship mobile's GoalTipDetail.tsx has to the "goal_tip" push/in-app
// notification tap (services/pushNotificationService.ts's handleDataTap).
export interface GoalTip {
  id: string;
  goal: string;
  tip: string;
  createdAt: number;
}

interface GoalTipWire {
  id: string;
  goal: string;
  tip: string;
  created_at: string | number;
}

function toMillis(value: string | number): number {
  if (typeof value === "number") {
    return value < 1e12 ? value * 1000 : value;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

function fromWire(wire: GoalTipWire): GoalTip {
  return {
    id: wire.id,
    goal: wire.goal,
    tip: wire.tip,
    createdAt: toMillis(wire.created_at),
  };
}

export async function getTodayTips(language?: string): Promise<GoalTip[]> {
  const data = await apiClient.get<GoalTipWire[]>("/api/v1/goals/tips/today", {
    params: { language: language || "en" },
  });
  return (data ?? []).map(fromWire);
}
