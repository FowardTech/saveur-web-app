"use client";

import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActionCard } from "@/components/ui/ActionCard";

export default function SettingsPage() {
  const { t } = useTranslation();

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
  ];

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-5xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:settings.hub.title", { defaultValue: "Settings" })}
            subtitle={t("web:settings.hub.subtitle", { defaultValue: "Manage your account, billing, and security." })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {settingsLinks.map((link) => (
              <ActionCard key={link.href} href={link.href} icon={link.icon} title={link.title} description={link.description} tint={link.tint} />
            ))}
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
