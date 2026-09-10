"use client";

import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionCard } from "@/components/ui/ActionCard";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { INTERVIEW_TYPES, interviewTypeSlug } from "@/lib/interviewData";

export default function PracticeHubPage() {
  const { t } = useTranslation();

  const modes = [
    {
      href: "/practice/mock-interviews",
      icon: "mic-outline" as const,
      title: t("web:practice.hub.mockInterviewsTitle", { defaultValue: "Mock Interviews" }),
      description: t("web:practice.hub.mockInterviewsDescription", {
        defaultValue: "Practice live with an AI interviewer across behavioral, technical, and role-specific formats.",
      }),
      tint: { bg: "bg-tint-mint", text: "text-tint-mint-text" },
    },
    {
      href: "/practice/coding",
      icon: "code-outline" as const,
      title: t("web:practice.hub.codingTitle", { defaultValue: "Coding Practice" }),
      description: t("web:practice.hub.codingDescription", {
        defaultValue: "Work through real coding problems with instant AI review and feedback.",
      }),
      tint: { bg: "bg-tint-purple", text: "text-tint-purple-text" },
    },
    {
      href: "/practice/scenarios",
      icon: "clipboard-outline" as const,
      title: t("web:practice.hub.scenariosTitle", { defaultValue: "Practical Scenarios" }),
      description: t("web:practice.hub.scenariosDescription", {
        defaultValue: "Hands-on, multi-step judgment scenarios for sales, healthcare, finance, and more.",
      }),
      tint: { bg: "bg-tint-orange", text: "text-tint-orange-text" },
    },
  ];

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:practice.hub.title", { defaultValue: "Practice" })}
            subtitle={t("web:practice.hub.subtitle", { defaultValue: "Choose a mode to sharpen your skills before the real thing." })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {modes.map((mode) => (
              <ActionCard
                key={mode.href}
                href={mode.href}
                icon={mode.icon}
                title={mode.title}
                description={mode.description}
                tint={mode.tint}
              />
            ))}
          </div>

          {/* "Interview Types" quick grid — mirrors mobile's FindScreen.tsx
              typesGrid, which jumps straight into the setup wizard with a
              type pre-selected instead of only ever reaching it via the
              generic Mock Interviews card above. Was missing entirely on
              web. */}
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-primary">{t("web:practice.hub.interviewTypesTitle", { defaultValue: "Interview Types" })}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {INTERVIEW_TYPES.map((it) => (
                <Link
                  key={it.wire}
                  href={`/practice/mock-interviews?type=${interviewTypeSlug(it.label)}`}
                  className="flex flex-col items-center gap-2 rounded-card border border-border bg-surface-2 p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-3 text-hint">
                    <EvaIcon name={it.icon} size={18} />
                  </span>
                  <span className="text-sm font-medium text-primary">
                    {t(`web:practice.mockInterviews.types.${interviewTypeSlug(it.label)}`, { defaultValue: it.label })}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
