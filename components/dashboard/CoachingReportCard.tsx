"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { EvaIcon, type EvaIconName } from "@/components/icons/EvaIcon";
import apiClient from "@/lib/apiClient";

// Product report: "I checked the dashboard of those web apps... the web
// app dashboard look so empty" -- specifically Yoodli's own dashboard
// report card ("Performing Well / Key Insights / Identify Your Areas For
// Improvement / What's Next"). Real backend contract --
// Saveur-Backend/app/api/coaching_report.py:
//   GET /api/v1/coaching-report -> {empty, completed_count, min_required,
//     performing_well: [str], key_insights: [str], areas_to_improve: [str],
//     whats_next: [str]}
// Built entirely from the user's own real InterviewFeedback history (see
// that endpoint's own service for the full "never fabricated" reasoning)
// -- `empty: true` below is a REAL state (fewer than 2 graded sessions so
// far), shown honestly with a CTA rather than papered over with invented
// content, same as Yoodli's own "Your coaching report is empty. Record a
// speech to get started!" for a brand-new account.
interface CoachingReport {
  empty: boolean;
  completed_count: number;
  min_required: number;
  performing_well: string[];
  key_insights: string[];
  areas_to_improve: string[];
  whats_next: string[];
}

interface Panel {
  key: keyof Pick<CoachingReport, "performing_well" | "key_insights" | "areas_to_improve" | "whats_next">;
  icon: EvaIconName;
  chip: string;
  // BUG FIX (product report: "The Quick actions cards and the Your
  // Coaching Report cards in the web dashboard look identical"): both
  // used to be the exact same rounded-card/border-border/bg-surface-2/p-4
  // shell (ActionCard.tsx's own visual DNA, copy-pasted here). `accent`
  // gives each panel its own soft tinted background + colored left edge
  // instead of flat white, so the report reads as a distinct, colorful
  // "report" surface rather than four more of the same gray tiles as the
  // quick-actions grid above it.
  accent: string;
  titleKey: string;
  titleDefault: string;
}

const PANELS: Panel[] = [
  { key: "performing_well", icon: "checkmark-circle-2", chip: "bg-tint-mint text-tint-mint-text", accent: "border-l-4 border-l-tint-mint-text bg-tint-mint/30", titleKey: "web:coachingReport.performingWell", titleDefault: "Performing Well" },
  { key: "key_insights", icon: "bulb-outline", chip: "bg-tint-purple text-tint-purple-text", accent: "border-l-4 border-l-tint-purple-text bg-tint-purple/30", titleKey: "web:coachingReport.keyInsights", titleDefault: "Key Insights" },
  { key: "areas_to_improve", icon: "flag-outline", chip: "bg-tint-orange text-tint-orange-text", accent: "border-l-4 border-l-tint-orange-text bg-tint-orange/30", titleKey: "web:coachingReport.areasToImprove", titleDefault: "Areas to Improve" },
  { key: "whats_next", icon: "arrow-forward-outline", chip: "bg-tint-rose text-tint-rose-text", accent: "border-l-4 border-l-tint-rose-text bg-tint-rose/30", titleKey: "web:coachingReport.whatsNext", titleDefault: "What's Next" },
];

export function CoachingReportCard() {
  const { t } = useTranslation();
  const [report, setReport] = useState<CoachingReport | null>(null);

  useEffect(() => {
    apiClient
      .get<CoachingReport>("/api/v1/coaching-report")
      .then(setReport)
      .catch(() => setReport(null));
  }, []);

  // Self-contained like this dashboard's other modules (UpcomingSessionCard,
  // ContinueWatchingCard) -- a fetch failure just means the module doesn't
  // render, rather than showing a broken/error state on the dashboard.
  if (!report) return null;

  // BUG FIX (product report: "The Quick actions cards and the Your
  // Coaching Report cards in the web dashboard look identical. At least
  // the Your Coaching Report cards should look a little bit different"):
  // both the empty state and the populated report below now sit inside
  // one bordered, gradient-tinted "report" frame (brand-colored border +
  // a soft diagonal wash) instead of plain bg-surface-2 boxes — the same
  // gradient treatment this dashboard's own HomeBanner uses, so the
  // report reads as a distinct, cohesive surface rather than more of the
  // same flat white tiles as the quick-actions grid directly above it.
  if (report.empty) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-card border-2 border-dashed border-brand/25 bg-gradient-to-br from-brand/5 via-accent-purple/5 to-transparent p-6">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
          <EvaIcon name="bar-chart-2-outline" size={20} />
        </span>
        <div>
          <h2 className="font-semibold text-primary">{t("web:coachingReport.title", { defaultValue: "Your Coaching Report" })}</h2>
          <p className="mt-1 text-sm text-hint">
            {t("web:coachingReport.emptyBody", {
              defaultValue: "Your coaching report is empty — complete {{count}} mock interviews to see what you're doing well and what to work on next.",
              count: report.min_required,
            })}
          </p>
        </div>
        <Link
          href="/practice/mock-interviews"
          className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          <EvaIcon name="mic-outline" size={14} />
          {t("web:coachingReport.emptyCta", { defaultValue: "Practice a mock interview" })}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-card border-2 border-brand/15 bg-gradient-to-br from-brand/5 via-accent-purple/5 to-transparent p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white">
          <EvaIcon name="bar-chart-2-outline" size={18} />
        </span>
        <div>
          <h2 className="text-lg font-bold text-primary">{t("web:coachingReport.title", { defaultValue: "Your Coaching Report" })}</h2>
          <p className="text-xs text-hint">
            {t("web:coachingReport.basedOnSessions", { defaultValue: "Based on your last {{count}} mock interviews", count: report.completed_count })}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PANELS.map((panel) => {
          const items = report[panel.key];
          return (
            <div key={panel.key} className={`flex flex-col gap-2.5 rounded-card p-4 ${panel.accent}`}>
              <span className={`inline-flex w-fit items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ${panel.chip}`}>
                <EvaIcon name={panel.icon} size={13} />
                {t(panel.titleKey, { defaultValue: panel.titleDefault })}
              </span>
              {items.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {items.map((item, i) => (
                    <li key={i} className="text-sm text-primary">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-hint">{t("web:coachingReport.panelEmpty", { defaultValue: "Nothing here yet." })}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
