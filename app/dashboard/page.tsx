"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { ActionCard } from "@/components/ui/ActionCard";
import { HomeBanner } from "@/components/dashboard/HomeBanner";
import { AnnouncementBanner } from "@/components/dashboard/AnnouncementBanner";
import { WelcomeModal } from "@/components/dashboard/WelcomeModal";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";
import { useAuth } from "@/app/providers/AuthProvider";
import { needsOnboarding } from "@/lib/types";
import { quickActions, tintCycle } from "@/lib/navigation";
import { UpcomingSessionCard } from "@/components/dashboard/UpcomingSessionCard";
import { ContinueWatchingCard } from "@/components/dashboard/ContinueWatchingCard";
import { GettingStartedChecklist } from "@/components/dashboard/GettingStartedChecklist";
import { AppTour } from "@/components/dashboard/AppTour";
import { CoachingReportCard } from "@/components/dashboard/CoachingReportCard";
import { DailyTipBanner } from "@/components/dashboard/DailyTipBanner";
import { RatingModal } from "@/components/dashboard/RatingModal";
import { DailyCheckInModal, type DailyCheckInMode } from "@/components/dashboard/DailyCheckInModal";
import * as appRatingService from "@/lib/appRatingService";
import * as dailyCheckinService from "@/lib/dailyCheckinService";

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

  // BUG FIX (product report: "you did not implement ratings in the web
  // app and also the regular check up and daily tips just the way it is
  // in the mobile app"). Both backends already existed
  // (Saveur-Backend/app/api/ratings.py, app/api/daily_checkin.py) --
  // mobile's Home screen had this wired up the whole time, web never did.
  //
  // Rating prompt: server-authoritative due-check (see
  // lib/appRatingService.ts), same as mobile's HomeSrc.tsx -- checked once
  // per mount, not on every render, so a dismiss/submit that already
  // closed the modal this session can't immediately re-trigger it.
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);
  useEffect(() => {
    if (loading || !firebaseUser) return;
    let cancelled = false;
    appRatingService.isRatingPromptDue().then((due) => {
      if (due && !cancelled) setShowRatingPrompt(true);
    });
    return () => {
      cancelled = true;
    };
  }, [loading, firebaseUser]);

  async function onSubmitRating(score: number) {
    try {
      await appRatingService.submitRating(score);
    } finally {
      setShowRatingPrompt(false);
    }
  }
  async function onDismissRating() {
    setShowRatingPrompt(false);
    appRatingService.dismissRatingPrompt().catch(() => {});
  }

  // Daily career-goal check-in: mobile shows the "goal" prompt on login
  // before noon (skipped if already answered today server-side, or
  // dismissed-without-answering today per a local flag), and the
  // "reflection" prompt from an evening push notification asking "how did
  // your day go?". Web has no push channel, so the reflection prompt is
  // approximated with a local afternoon/evening time gate instead (see
  // lib/dailyCheckinService.ts's own comment) rather than being reachable
  // at all, which is the actual gap here relative to mobile.
  const [checkinModal, setCheckinModal] = useState<DailyCheckInMode | null>(null);
  useEffect(() => {
    if (loading || !firebaseUser) return;
    const hour = new Date().getHours();
    let cancelled = false;
    dailyCheckinService
      .getToday()
      .then((today) => {
        if (cancelled) return;
        if (hour < 12) {
          if (!today.goalAnswered && !dailyCheckinService.wasGoalPromptDismissedToday()) {
            setCheckinModal("goal");
          }
        } else if (hour >= 15) {
          if (today.goalAnswered && !today.reflectionAnswered && !dailyCheckinService.wasReflectionPromptDismissedToday()) {
            setCheckinModal("reflection");
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loading, firebaseUser]);

  async function onSubmitCheckin(text: string) {
    if (!checkinModal) return;
    try {
      if (checkinModal === "goal") await dailyCheckinService.submitGoal(text);
      else await dailyCheckinService.submitReflection(text);
    } finally {
      setCheckinModal(null);
    }
  }
  function onDismissCheckin() {
    if (checkinModal === "goal") dailyCheckinService.dismissGoalPromptForToday();
    else if (checkinModal === "reflection") dailyCheckinService.dismissReflectionPromptForToday();
    setCheckinModal(null);
  }

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
      {/* One-time "how this app works" walkthrough (product report: "The
          web version does not have tour guide. You need to implement
          that", later: "The web tour guid is not professional at all.
          Its supposed to move all around the screen pointing to every
          section in the dashboard") — see AppTour's own header comment
          for the real spotlight mechanics. The `data-tour="..."`
          attributes below on stable wrapper divs are what it targets;
          replayable from Settings. */}
      <AppTour />
      <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
        <div data-tour="dashboard-greeting">
          <h1 className="text-2xl font-bold text-primary">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-hint">{t("web:dashboard.subtitle", { defaultValue: "Here's what's next on your career journey." })}</p>
        </div>

        {/* Admin-authored announcement strip (policy changes, etc.) — above
            the decorative HomeBanner hero card per product ask. */}
        <AnnouncementBanner />

        {/* Home banner */}
        <div data-tour="dashboard-home-banner">
          <HomeBanner />
        </div>

        {/* Daily tip — product report: "you did not implement... daily
            tips just the way it is in the mobile app". Self-contained,
            renders nothing if the user has no active goals yet. */}
        <DailyTipBanner />

        {/* "Getting Started" checklist — product report: "When a user logs
            in for the first time, the app should suggest important steps
            to the user things like Upload a resume, Tell us about
            yourself, ... Update your profile etc." Self-contained, renders
            nothing only once the user dismisses it -- reaching 100% no
            longer auto-hides it, see that component's own header comment. */}
        <GettingStartedChecklist />

        {/* Upcoming Session — self-contained, renders nothing when there's
            nothing scheduled (see app/practice/schedule/page.tsx for the
            scheduling entry point, reached from the Practice hub). */}
        <UpcomingSessionCard />

        {/* Continue Watching — product report: "Continue video is not
            implemented in the web version." Self-contained, renders
            nothing when there's no in-progress video (see
            components/learning/InAppVideoPlayer.tsx for the real position
            tracking that feeds this). */}
        <ContinueWatchingCard />

        {/* Quick actions */}
        <div data-tour="dashboard-quick-actions" className="flex flex-col gap-4">
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
                animationDelayMs={i * 50}
              />
            ))}
          </div>
        </div>

        {/* Coaching report — product report: "the web app dashboard look
            so empty" [Yoodli's own dashboard report card]. Self-contained,
            renders nothing while loading and shows an honest empty state
            (with a CTA) rather than fabricated content for a new user with
            fewer than 2 graded mock interviews. The data-tour wrapper is
            deliberately on this stable outer div rather than inside the
            component, since the component itself can render nothing while
            its data is still loading — see AppTour.tsx's STEPS comment. */}
        <div data-tour="dashboard-coaching-report">
          <CoachingReportCard />
        </div>
      </div>

      {/* Mutual exclusion: never stack this on top of the daily check-in
          modal (both are full-screen, centered dialogs) -- if a rating
          becomes due while a check-in prompt is already showing, it'll
          simply be shown the next time the dashboard mounts instead. */}
      <RatingModal open={showRatingPrompt && checkinModal === null} onSubmit={onSubmitRating} onDismiss={onDismissRating} />
      <DailyCheckInModal
        open={checkinModal !== null}
        mode={checkinModal ?? "goal"}
        onSubmit={onSubmitCheckin}
        onDismiss={onDismissCheckin}
      />
    </AppShell>
  );
}
