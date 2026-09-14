"use client";

import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionCard } from "@/components/ui/ActionCard";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { useAuth } from "@/app/providers/AuthProvider";
import { resetAppTour } from "@/components/dashboard/AppTour";

export default function SettingsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { profile } = useAuth();

  // "Show app tour" replay entry — mobile's More menu equivalent
  // (src/more/MoreSrc.tsx's onReplayTour). Clears the local "seen" flag and
  // navigates to /dashboard, where AppTour's own mount effect picks it up
  // immediately (same clear-then-navigate-back-to-Home pattern mobile
  // uses).
  function onReplayTour() {
    resetAppTour(profile?.uid);
    router.push("/dashboard");
  }

  const settingsLinks = [
    {
      href: "/settings/profile",
      icon: "person-outline" as const,
      title: t("web:settings.hub.profileTitle", { defaultValue: "Profile" }),
      description: t("web:settings.hub.profileDescription", { defaultValue: "Update your name and view your account email." }),
      tint: { bg: "bg-tint-mint", text: "text-tint-mint-text" },
    },
    {
      href: "/settings/payment",
      icon: "credit-card-outline" as const,
      title: t("web:settings.hub.paymentTitle", { defaultValue: "Payment Method" }),
      description: t("web:settings.hub.paymentDescription", { defaultValue: "Manage your subscription and billing details." }),
      tint: { bg: "bg-tint-purple", text: "text-tint-purple-text" },
    },
    {
      href: "/settings/security",
      icon: "shield-outline" as const,
      title: t("web:settings.hub.securityTitle", { defaultValue: "Security" }),
      description: t("web:settings.hub.securityDescription", { defaultValue: "Two-factor authentication and account security." }),
      tint: { bg: "bg-tint-orange", text: "text-tint-orange-text" },
    },
    {
      href: "/settings/student",
      icon: "award-outline" as const,
      title: t("web:settings.hub.studentTitle", { defaultValue: "Student Package" }),
      description: t("web:settings.hub.studentDescription", { defaultValue: "Verify your school email for a discount and student-tailored AI." }),
      tint: { bg: "bg-tint-mint", text: "text-tint-mint-text" },
    },
  ];

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:settings.hub.title", { defaultValue: "Settings" })}
            subtitle={t("web:settings.hub.subtitle", { defaultValue: "Manage your account, billing, and security." })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {settingsLinks.map((link) => (
              <ActionCard key={link.href} href={link.href} icon={link.icon} title={link.title} description={link.description} tint={link.tint} />
            ))}
          </div>

          <button
            type="button"
            onClick={onReplayTour}
            className="flex w-fit items-center gap-2 rounded-pill border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-surface-3"
          >
            <EvaIcon name="compass-outline" size={16} className="text-brand" />
            {t("web:settings.hub.showAppTour", { defaultValue: "Show app tour" })}
          </button>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
