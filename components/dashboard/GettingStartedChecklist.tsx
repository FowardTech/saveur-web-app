"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { useAuth } from "@/app/providers/AuthProvider";
import * as documentsService from "@/lib/documentsService";
import * as onboardingAssessmentService from "@/lib/onboardingAssessmentService";
import { ArtRoadmapPath, ArtTrophy } from "./GettingStartedArt";

// "Getting Started" checklist — product report: "When a user logs in for
// the first time, the app should suggest important steps to the user
// things like 1. Upload a resume, Tell us about yourself, What do you like
// to do at your free time, Whats are your hobbies, Update your profile
// etc." Net-new — neither this nor mobile had any concrete "next steps"
// nudge before this (the existing WelcomeModal is a one-time static pitch,
// not a checklist; see that component's own header comment). Self-
// contained: fetches its own data (profile is already loaded by
// AuthProvider; resume presence needs its own GET /api/v1/documents call).
//
// BUG FIX (product report: "I need a beautiful illustration or a nice
// image on this card place on the right side. And also When user have
// completed all the tasked. A readiness indicattion should appear in the
// card. The card should not auto disappear even when all tasks are
// completed the user can decide to close or leave it"): this used to
// `return null` the instant `remaining.length === 0`, so a user who
// finished every item never saw any confirmation of that — the card just
// vanished on whatever render happened to notice. Now it stays mounted and
// switches to a "You're all set" readiness state (ArtTrophy + a green
// "Profile ready" badge) instead, and the ONLY way it goes away is the
// explicit close button below (same dismissal mechanism as before). Also
// added a right-side illustration (GettingStartedArt.tsx, ported from
// mobile's src/home/HomeHeroArt.tsx) for both states — a winding road
// while steps remain, the trophy once they're done.
//
// Dismissible per account, remembered in localStorage keyed by uid — same
// convention as components/dashboard/AnnouncementBanner.tsx's
// homeBannerDismissed key. Unlike that banner, this doesn't need a
// fingerprint (there's no admin-editable copy to invalidate an old
// dismissal): once dismissed, it stays dismissed. A user who reaches 100%
// and dismisses the readiness state won't have it silently reappear later
// either, same "once dismissed, stays dismissed" rule as the in-progress
// state always had.
function dismissedStorageKey(uid?: string | null): string {
  return `saveur.gettingStartedDismissed.${uid || "anon"}`;
}

interface ChecklistItem {
  key: string;
  label: string;
  href: string;
  done: boolean;
}

export function GettingStartedChecklist() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [hasResume, setHasResume] = useState<boolean | undefined>(undefined);
  // undefined = still reading localStorage — render nothing yet, same
  // "avoid a one-frame flash" reasoning as AnnouncementBanner's identical
  // guard.
  const [dismissed, setDismissed] = useState<boolean | undefined>(undefined);
  // Product request: "I want us to add prep test and many other
  // personality test during onboarding and also when user enters the
  // dashboard for the first time" — a checklist item for anyone who
  // skipped app/onboarding/assessment/page.tsx at signup. Checks the
  // backend's real completion status (not just a local flag) so a user
  // who already did it doesn't see a stale "not done" item.
  const [assessmentCompleted, setAssessmentCompleted] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    documentsService
      .listDocuments()
      .then((docs) => setHasResume(docs.some((d) => d.kind === "resume")))
      .catch(() => setHasResume(false));
    onboardingAssessmentService
      .getStatus()
      .then((status) => setAssessmentCompleted(status.personalityCompleted))
      .catch(() => setAssessmentCompleted(true)); // fail open — don't nag on a failed check
  }, []);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(window.localStorage.getItem(dismissedStorageKey(profile?.uid)) === "1");
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(false);
    }
  }, [profile?.uid]);

  function onDismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(dismissedStorageKey(profile?.uid), "1");
    } catch {
      // Private browsing / storage disabled — dismissal just won't persist
      // across reloads, a safe degrade rather than a crash.
    }
  }

  if (!profile || dismissed === undefined || dismissed || hasResume === undefined || assessmentCompleted === undefined) return null;

  const items: ChecklistItem[] = [
    {
      key: "resume",
      label: t("web:dashboard.gettingStarted.uploadResume", { defaultValue: "Upload a resume" }),
      href: "/documents",
      done: hasResume,
    },
    {
      key: "careerAssessment",
      label: t("web:dashboard.gettingStarted.careerAssessment", { defaultValue: "Take your career assessment" }),
      href: "/onboarding/assessment",
      done: assessmentCompleted,
    },
    {
      key: "bio",
      label: t("web:dashboard.gettingStarted.tellUsAboutYou", { defaultValue: "Tell us about yourself" }),
      href: "/settings/profile",
      done: !!profile.bio?.trim(),
    },
    {
      key: "hobbies",
      label: t("web:dashboard.gettingStarted.hobbies", { defaultValue: "Share your hobbies & free time" }),
      href: "/settings/profile",
      done: !!profile.hobbies?.trim(),
    },
    {
      key: "profile",
      label: t("web:dashboard.gettingStarted.updateProfile", { defaultValue: "Update your profile" }),
      href: "/settings/profile",
      done: !!(profile.name?.trim() && (profile.phoneNumber?.trim() || profile.homeAddress?.trim())),
    },
  ];

  const remaining = items.filter((i) => !i.done);
  const allDone = remaining.length === 0;

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-5 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-primary">
                {allDone
                  ? t("web:dashboard.gettingStarted.doneTitle", { defaultValue: "You're all set up!" })
                  : t("web:dashboard.gettingStarted.title", { defaultValue: "Finish setting up your account" })}
              </h2>
              {/* Readiness indicator (product report: "when user have
                  completed all the tasked, a readiness indication should
                  appear in the card") -- a plain title swap alone read too
                  similar to the in-progress heading at a glance, so this
                  adds an unmissable status pill too. */}
              {allDone && (
                <span className="inline-flex items-center gap-1 rounded-pill bg-tint-mint px-2.5 py-0.5 text-xs font-semibold text-tint-mint-text">
                  <EvaIcon name="checkmark-circle-2-outline" size={12} />
                  {t("web:dashboard.gettingStarted.readyBadge", { defaultValue: "Profile ready" })}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-hint">
              {allDone
                ? t("web:dashboard.gettingStarted.doneSubtitle", {
                    defaultValue: "Your profile is fully filled in — Saveur can now personalize coaching, practice, and recommendations for you.",
                  })
                : t("web:dashboard.gettingStarted.subtitle", {
                    defaultValue: "{{count}} quick steps left — these help us personalize your coaching.",
                    count: remaining.length,
                  })}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("common:actions.close", { defaultValue: "Close" })}
            className="shrink-0 rounded-full p-1 text-hint transition hover:bg-surface-3 hover:text-primary"
          >
            <EvaIcon name="close-outline" size={16} />
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition hover:bg-surface-3 ${
                item.done ? "text-hint line-through" : "font-medium text-primary"
              }`}
            >
              <EvaIcon
                name={item.done ? "checkmark-circle-2-outline" : "arrow-circle-right-outline"}
                size={16}
                className={item.done ? "shrink-0 text-success" : "shrink-0 text-brand"}
              />
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Illustration -- product report: "I need a beautiful illustration
          or a nice image on this card placed on the right side." Hidden
          below `sm` purely for space (a 5-item checklist plus a 96px
          illustration doesn't fit a narrow phone-width card), not tied to
          done/dismiss state. */}
      <div className="hidden shrink-0 sm:block">{allDone ? <ArtTrophy size={124} /> : <ArtRoadmapPath size={124} />}</div>
    </div>
  );
}

export default GettingStartedChecklist;
