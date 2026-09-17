"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { getTodayTips, type GoalTip } from "@/lib/goalTipsService";

// BUG FIX (product report: "you did not implement... daily tips just the
// way it is in the mobile app"). The backend + service already existed
// (lib/goalTipsService.ts, GET /api/v1/goals/tips/today) but was only ever
// reachable on web via a notification-bell tap into app/goals/today-tip
// (a "goal_tip" push-tap destination) -- there was no proactive card on the
// dashboard itself showing today's tip the way mobile's Home surfaces it.
// Self-contained like this dashboard's other modules (CoachingReportCard,
// UpcomingSessionCard) -- renders nothing while loading or if the user has
// no active goals yet (goalTipsService returns one tip per goal, so zero
// goals means zero tips, a real and expected state, not an error).
export function DailyTipBanner() {
  const { t, i18n } = useTranslation();
  const [tips, setTips] = useState<GoalTip[] | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    getTodayTips(i18n.language)
      .then(setTips)
      .catch(() => setTips([]));
  }, [i18n.language]);

  if (!tips || tips.length === 0) return null;
  const tip = tips[index % tips.length];

  return (
    <div className="flex items-start gap-3 rounded-card border border-border bg-tint-orange p-4">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-1 text-tint-orange-text">
        <EvaIcon name="bulb-outline" size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-hint">
            {t("web:dashboard.dailyTipLabel", { defaultValue: "Today's tip · {{goal}}", goal: tip.goal })}
          </p>
          {tips.length > 1 && (
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % tips.length)}
              className="shrink-0 text-xs font-medium text-brand hover:underline"
            >
              {t("web:dashboard.dailyTipNext", { defaultValue: "Next tip" })}
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-primary">{tip.tip}</p>
      </div>
    </div>
  );
}

export default DailyTipBanner;
