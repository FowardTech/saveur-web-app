"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EvaIcon, type EvaIconName } from "@/components/icons/EvaIcon";
import { useAuth } from "@/app/providers/AuthProvider";

// Web port of mobile's components/AppTour.tsx — a short, one-time "how this
// app works" walkthrough (product report: "The web version does not have
// tour guide. You need to implement that"). Same content/order/trigger
// model as mobile: a full-screen step carousel (not a spotlight-the-
// actual-button overlay — this app's screens live across many independent
// routes, so a single walkthrough can't point at live elements spread
// across all of them without navigating the user around mid-tour), shown
// once automatically and replayable any time (see the "Show app tour" entry
// in app/settings/page.tsx).
//
// Mobile stores "seen" purely in local AsyncStorage, not a backend field
// (confirmed: no has_seen_tour/tour_completed column exists anywhere in
// Saveur-Backend) — this mirrors that exactly with a localStorage flag,
// same `saveur.<feature>.<uid>` convention as AnnouncementBanner/
// GettingStartedChecklist, rather than inventing new backend state mobile
// doesn't have either.
const TOUR_STORAGE_KEY_PREFIX = "saveur.appTourSeen.";

interface TourStep {
  icon: EvaIconName;
  titleKey: string;
  titleDefault: string;
  bodyKey: string;
  bodyDefault: string;
  accentText: string;
  accentBg: string;
}

const STEPS: TourStep[] = [
  {
    icon: "home-outline",
    titleKey: "web:tour.welcomeTitle",
    titleDefault: "Welcome to Saveur",
    bodyKey: "web:tour.welcomeBody",
    bodyDefault: "Your career coach, job search, and interview prep — all in one app. Here's a quick look at what you can do.",
    accentText: "text-brand",
    accentBg: "bg-brand/10",
  },
  {
    icon: "briefcase-outline",
    titleKey: "web:tour.jobsTitle",
    titleDefault: "Daily job matches",
    bodyKey: "web:tour.jobsBody",
    bodyDefault: "Home shows job alerts matched to your desired roles and countries every day, plus a goal tip to keep you moving forward.",
    accentText: "text-tint-orange-text",
    accentBg: "bg-tint-orange",
  },
  {
    icon: "mic-outline",
    titleKey: "web:tour.practiceTitle",
    titleDefault: "Practice interviews",
    bodyKey: "web:tour.practiceBody",
    bodyDefault: "Run realistic mock interviews (text or voice) in Practice and get real AI feedback on your answers afterward.",
    accentText: "text-tint-rose-text",
    accentBg: "bg-tint-rose",
  },
  {
    icon: "message-circle-outline",
    titleKey: "web:tour.coachTitle",
    titleDefault: "Talk to your AI Coach",
    bodyKey: "web:tour.coachBody",
    bodyDefault: "The AI Coach is a real conversation — by text or live voice — that knows your goals, progress, and history so its advice actually fits you.",
    accentText: "text-brand",
    accentBg: "bg-brand/10",
  },
  {
    icon: "book-open-outline",
    titleKey: "web:tour.coursesTitle",
    titleDefault: "Learn a new skill",
    bodyKey: "web:tour.coursesBody",
    bodyDefault: "Learning Courses builds a real Basic → Intermediate → Advanced course on any career path you pick, with a badge when you finish.",
    accentText: "text-tint-mint-text",
    accentBg: "bg-tint-mint",
  },
  {
    icon: "award-outline",
    titleKey: "web:tour.gamificationTitle",
    titleDefault: "Streaks & leaderboard",
    bodyKey: "web:tour.gamificationBody",
    bodyDefault: "Practicing daily earns XP and builds a streak. You'll show up on the leaderboard under a fun generated username — never your real name.",
    accentText: "text-success-text",
    accentBg: "bg-success/10",
  },
  {
    icon: "checkmark-square-2-outline",
    titleKey: "web:tour.applicationsTitle",
    titleDefault: "Track your applications",
    bodyKey: "web:tour.applicationsBody",
    bodyDefault: "Keep every job you've applied to in one place, with status updates, so nothing falls through the cracks.",
    accentText: "text-brand",
    accentBg: "bg-brand/10",
  },
];

function tourStorageKey(uid?: string | null): string {
  return `${TOUR_STORAGE_KEY_PREFIX}${uid || "anon"}`;
}

/** Clears the "seen" flag and returns true if it actually needs a
 * navigation to /dashboard to be visible there — used by the "Show app
 * tour" replay entry in Settings. */
export function resetAppTour(uid?: string | null): void {
  try {
    window.localStorage.removeItem(tourStorageKey(uid));
  } catch {
    // Private browsing / storage disabled — nothing to clean up.
  }
}

export function AppTour() {
  const { t } = useTranslation();
  const { profile, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const uid = profile?.uid;

  useEffect(() => {
    if (loading || !profile || !uid) return;
    // Sequenced after WelcomeModal (mirrors mobile's overlay-priority queue,
    // simplified: web has no multi-modal priority system, so this just
    // waits for that one specific higher-priority modal to have already
    // been dismissed at least once, current or prior session, before this
    // one becomes eligible at all).
    if (!profile.hasSeenWelcomeModal) return;
    try {
      if (window.localStorage.getItem(tourStorageKey(uid))) return;
    } catch {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStepIndex(0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [loading, profile, uid]);

  // Also reacts to the "Show app tour" replay entry clearing localStorage
  // while this component is already mounted (Settings navigates back to
  // /dashboard afterward, remounting this anyway, but a same-tab
  // storage-event listener makes it robust either way).
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === tourStorageKey(uid) && e.newValue === null) {
        setStepIndex(0);
        setOpen(true);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [uid]);

  function close() {
    setOpen(false);
    try {
      window.localStorage.setItem(tourStorageKey(uid), "1");
    } catch {
      // Best-effort — worst case the tour just shows again next visit.
    }
  }

  if (!open) return null;

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-card border border-border bg-surface-2 p-7 shadow-2xl">
        <div className="flex justify-end">
          <button type="button" onClick={close} className="p-1 text-sm font-medium text-hint hover:text-primary">
            {t("web:tour.skip", { defaultValue: "Skip" })}
          </button>
        </div>

        <div className="mx-auto mt-2 flex h-24 w-24 items-center justify-center rounded-full opacity-80">
          <div className={`flex h-[72px] w-[72px] items-center justify-center rounded-full ${step.accentBg}`}>
            <EvaIcon name={step.icon} size={36} className={step.accentText} />
          </div>
        </div>

        <h2 className="mt-5 text-center text-lg font-bold text-primary">
          {t(step.titleKey, { defaultValue: step.titleDefault })}
        </h2>
        <p className="mt-2.5 text-center text-sm text-hint">
          {t(step.bodyKey, { defaultValue: step.bodyDefault })}
        </p>

        <div className="mt-5 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === stepIndex ? "bg-brand" : "bg-surface-4"}`} />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            className="p-2 text-sm font-medium text-hint disabled:opacity-40"
          >
            {t("web:tour.back", { defaultValue: "Back" })}
          </button>
          <button
            type="button"
            onClick={() => (isLast ? close() : setStepIndex((i) => i + 1))}
            className="p-2 text-sm font-bold text-brand"
          >
            {isLast ? t("web:tour.getStarted", { defaultValue: "Get started" }) : t("web:tour.next", { defaultValue: "Next" })}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AppTour;
