"use client";

import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionCard } from "@/components/ui/ActionCard";

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
        <div className="mx-auto flex max-w-5xl flex-col gap-8 pb-10">
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
        </div>
      </AppShell>
    </RequireAuth>
  );
}
