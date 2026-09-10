"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useAuth } from "@/app/providers/AuthProvider";
import * as goalTipsService from "@/lib/goalTipsService";
import type { GoalTip } from "@/lib/goalTipsService";

// Web port of Saveur (mobile)'s src/home/GoalTipDetail.tsx — a dedicated
// "Today's Goal Tips" screen, reached only via a "goal_tip" notification tap
// (see lib/notifications.ts's notificationHref and components/shell/
// NotificationBell.tsx). No route params — fetches GET
// /api/v1/goals/tips/today itself (lib/goalTipsService.ts), the same source
// app/goals/page.tsx's own "Career" section is built on, so this always
// shows today's full, current tip(s) regardless of which one the
// notification happened to mention.
//
// BUG FIX (product report: clicking "Today's Tip" in the notification
// center didn't redirect anywhere) — the "goal_tip" notification kind
// (Saveur-Backend's goal_tip_service.py) had no web destination at all
// before this page existed; notificationHref() silently returned undefined
// for it, so the click did nothing. Mobile already had a real destination
// (GoalTipDetail.tsx) for the exact same notification kind — this mirrors
// it on web.
function TodayTipPageInner() {
  const { t, i18n } = useTranslation();
  const { loading: authLoading } = useAuth();
  const [tips, setTips] = useState<GoalTip[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    goalTipsService
      .getTodayTips(i18n.language)
      .then(setTips)
      .catch(() =>
        setError(t("web:goalTip.loadFailedDefault", { defaultValue: "Something went wrong. Please try again." }))
      );
  }, [t, i18n.language]);

  useEffect(() => {
    if (authLoading) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
          <PageHeader
            title={t("web:goalTip.title", { defaultValue: "Today's Goal Tips" })}
            subtitle={today}
          />

          {error && !tips && (
            <div className="flex flex-col items-start gap-3 rounded-card border border-border bg-surface-2 p-6">
              <p className="text-sm text-danger">{error}</p>
              <button
                type="button"
                onClick={load}
                className="text-sm font-semibold text-link hover:underline"
              >
                {t("common:try_again", { defaultValue: "Try again" })}
              </button>
            </div>
          )}

          {!error && tips === null && <SkeletonRows count={2} />}

          {tips && tips.length === 0 && !error && (
            <div className="rounded-card border border-border bg-surface-2 p-6 text-center text-sm text-hint">
              {t("web:goalTip.empty", { defaultValue: "No tips for today yet — check back later." })}
            </div>
          )}

          {tips && tips.length > 0 && (
            <div className="flex flex-col gap-3">
              {tips.map((tip) => (
                <div key={tip.id} className="rounded-card border border-border bg-tint-purple/10 p-4">
                  <span className="inline-flex items-center rounded-pill bg-tint-purple px-2.5 py-1 text-xs font-bold text-tint-purple-text">
                    {tip.goal}
                  </span>
                  <p className="mt-2.5 text-sm leading-relaxed text-primary">{tip.tip}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}

export default function TodayTipPage() {
  return <TodayTipPageInner />;
}
