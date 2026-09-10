"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { ActionCard } from "@/components/ui/ActionCard";
import { LinkButton } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { HomeBanner } from "@/components/dashboard/HomeBanner";
import { AnnouncementBanner } from "@/components/dashboard/AnnouncementBanner";
import { WelcomeModal } from "@/components/dashboard/WelcomeModal";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { useAuth } from "@/app/providers/AuthProvider";
import { needsOnboarding } from "@/lib/types";
import { quickActions, tintCycle } from "@/lib/navigation";

function useGreeting() {
  const { t } = useTranslation();
  const [greeting, setGreeting] = useState(() => t("web:dashboard.greetingHello", { defaultValue: "Hello" }));
  useEffect(() => {
    // Deliberately client-only: the server render always uses "Hello" so
    // the greeting can't mismatch across the server/client time zone gap,
    // then swaps to a real greeting once the browser's own clock is
    // available post-mount.
    const hour = new Date().getHours();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hour < 12) setGreeting(t("web:dashboard.greetingMorning", { defaultValue: "Good morning" }));
    else if (hour < 18) setGreeting(t("web:dashboard.greetingAfternoon", { defaultValue: "Good afternoon" }));
    else setGreeting(t("web:dashboard.greetingEvening", { defaultValue: "Good evening" }));
  }, [t]);
  return greeting;
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { firebaseUser, profile, loading } = useAuth();
  const greeting = useGreeting();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace("/login");
    } else if (needsOnboarding(profile)) {
      router.replace("/onboarding");
    }
  }, [loading, firebaseUser, profile, router]);

  const firstName = profile?.firstName || profile?.name?.split(" ")[0] || t("web:dashboard.defaultName", { defaultValue: "there" });

  if (loading || !firebaseUser) {
    return (
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-32 rounded-card" />
          <Skeleton className="h-28 rounded-card" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-40" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <WelcomeModal />
      <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
        <div>
          <h1 className="text-2xl font-bold text-primary">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-hint">{t("web:dashboard.subtitle", { defaultValue: "Here's what's next on your career journey." })}</p>
        </div>

        {/* Admin-authored announcement strip (policy changes, etc.) — above
            the decorative HomeBanner hero card per product ask. */}
        <AnnouncementBanner />

        {/* Home banner */}
        <HomeBanner />

        {/* Promo banner */}
        <div className="flex flex-col items-start gap-4 rounded-card border border-border bg-gradient-to-br from-brand/15 via-accent-purple/10 to-transparent p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white">
              <EvaIcon name="flash-outline" size={20} />
            </span>
            <div>
              <h2 className="font-semibold text-primary">{t("web:dashboard.promoTitle", { defaultValue: "Try a mock interview today" })}</h2>
              <p className="mt-1 text-sm text-hint">
                {t("web:dashboard.promoSubtitle", { defaultValue: "Get matched with an AI interviewer for your target role and receive feedback in minutes." })}
              </p>
            </div>
          </div>
          <LinkButton href="/practice/mock-interviews" size="md" className="shrink-0">
            {t("web:dashboard.promoCta", { defaultValue: "Start now" })}
          </LinkButton>
        </div>

        {/* Quick actions */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-primary">{t("web:dashboard.quickActionsTitle", { defaultValue: "Quick actions" })}</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action, i) => (
              <ActionCard
                key={action.href}
                href={action.href}
                icon={action.icon}
                title={action.labelKey ? t(`common:nav.${action.labelKey}`, { defaultValue: action.label }) : action.label}
                description={action.descriptionKey ? t(action.descriptionKey, { defaultValue: action.description }) : action.description}
                tint={tintCycle[i % tintCycle.length]}
              />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
