"use client";

import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { CoachingReportCard } from "@/components/dashboard/CoachingReportCard";

/** Your AI coaching report (what you're doing well, key insights, areas to
 * improve, what's next), built from your graded mock interviews. Lives on its
 * own page — linked from Practice in the top nav — instead of the dashboard,
 * same as the mobile app's drawer. */
export default function CoachingReportPage() {
  const { t } = useTranslation();
  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <PageHeader
            title={t("web:coachingReport.title", { defaultValue: "Your Coaching Report" })}
            subtitle={t("web:coachingReport.subtitle", { defaultValue: "What you're doing well and what to work on next, based on your recent mock interviews." })}
          />
          <CoachingReportCard />
        </div>
      </AppShell>
    </RequireAuth>
  );
}
