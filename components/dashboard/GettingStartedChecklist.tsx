"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { CircularProgress } from "@/components/ui/CircularProgress";
import { useAuth } from "@/app/providers/AuthProvider";
import { useCoachReadiness } from "@/lib/coachReadiness";
import { ArtRoadmapPath, ArtTrophy } from "./GettingStartedArt";

// "Coach readiness" card (formerly the plain "Getting Started" checklist).
// Product report: "when users login for the first time the app dont really
// tell them what is the first thing they should do ... something that is
// necessary for the users to do in order for the AI career coach to give the
// maximum help." It now leads with the four inputs the coach actually builds
// its context from (resume, target roles/countries, career goal, Career DNA
// assessment -- see lib/coachReadiness.ts), shows a readiness %, and flags
// the first unfinished step as "Start here". It cannot be dismissed while
// any essential step is missing; once all four are done it flips to a
// "ready" state that the user can close. The softer personal-profile items
// from the original checklist (bio / hobbies / contact details) stay below
// as optional extras.
//
// Dismissible (once everything essential is done) per account, remembered in
// localStorage keyed by uid.
function dismissedStorageKey(uid?: string | null): string {
  return `saveur.gettingStartedDismissed.${uid || "anon"}`;
}

export function GettingStartedChecklist() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const readiness = useCoachReadiness();
  // undefined = still reading localStorage — render nothing yet.
  const [dismissed, setDismissed] = useState<boolean | undefined>(undefined);

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
      // Storage disabled — dismissal just won't persist across reloads.
    }
  }

  if (!profile || readiness.loading || dismissed === undefined) return null;
  // Only a COMPLETED setup can be dismissed away; an unfinished one always shows.
  if (dismissed && readiness.allDone) return null;

  const { steps, allDone, percent, next } = readiness;
  const extras = [
    { key: "bio", label: t("web:dashboard.gettingStarted.tellUsAboutYou", { defaultValue: "Tell us about yourself" }), done: !!profile.bio?.trim() },
    { key: "hobbies", label: t("web:dashboard.gettingStarted.hobbies", { defaultValue: "Share your hobbies & free time" }), done: !!profile.hobbies?.trim() },
    {
      key: "profile",
      label: t("web:dashboard.gettingStarted.updateProfile", { defaultValue: "Update your profile" }),
      done: !!(profile.name?.trim() && (profile.phoneNumber?.trim() || profile.homeAddress?.trim())),
    },
  ].filter((e) => !e.done);

  return (
    <div className="flex flex-col gap-5 rounded-card border border-brand/30 bg-brand-soft p-5 sm:flex-row sm:items-start sm:gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            <CircularProgress progress={percent} size={64} strokeWidth={7} progressClassName={allDone ? "text-success" : "text-brand"}>
              <span className="text-sm font-extrabold text-primary">{percent}%</span>
            </CircularProgress>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-primary">
                  {allDone
                    ? t("web:dashboard.coachReadiness.doneTitle", { defaultValue: "Your AI coach is ready" })
                    : t("web:dashboard.coachReadiness.title", { defaultValue: "Set up your AI career coach" })}
                </h2>
                {allDone && (
                  <span className="inline-flex items-center gap-1 rounded-pill bg-tint-mint px-2.5 py-0.5 text-xs font-semibold text-tint-mint-text">
                    <EvaIcon name="checkmark-circle-2-outline" size={12} />
                    {t("web:dashboard.gettingStarted.readyBadge", { defaultValue: "Profile ready" })}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-hint">
                {allDone
                  ? t("web:dashboard.coachReadiness.doneSubtitle", { defaultValue: "Saveur now has what it needs to personalize your coaching, practice and recommendations." })
                  : t("web:dashboard.coachReadiness.subtitle", {
                      defaultValue: "Complete these {{count}} steps first — your coach gives much better, more personal help once it knows you.",
                      count: steps.length - readiness.doneCount,
                    })}
              </p>
            </div>
          </div>
          {allDone && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t("common:actions.close", { defaultValue: "Close" })}
              className="shrink-0 rounded-full p-1 text-hint transition hover:bg-surface-3 hover:text-primary"
            >
              <EvaIcon name="close-outline" size={16} />
            </button>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {steps.map((step, i) => {
            const isNext = next?.key === step.key;
            return (
              <Link
                key={step.key}
                href={step.href}
                className={`group flex items-center gap-3 rounded-xl border px-3.5 py-3 transition ${
                  step.done
                    ? "border-transparent bg-surface-2/60"
                    : isNext
                      ? "border-brand/40 bg-surface-2 shadow-soft"
                      : "border-border bg-surface-2 hover:border-brand/30"
                }`}
              >
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    step.done ? "bg-tint-mint text-tint-mint-text" : isNext ? "bg-brand text-white" : "bg-surface-3 text-hint"
                  }`}
                >
                  {step.done ? <EvaIcon name="checkmark-outline" size={16} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${step.done ? "text-hint line-through" : "text-primary"}`}>{step.label}</span>
                  {!step.done && <span className="block text-xs text-hint">{step.why}</span>}
                </span>
                {isNext && (
                  <span className="hidden shrink-0 rounded-pill bg-brand px-2.5 py-1 text-[11px] font-bold text-white sm:inline">
                    {t("web:dashboard.coachReadiness.startHere", { defaultValue: "Start here" })}
                  </span>
                )}
                {!step.done && <EvaIcon name="arrow-forward-outline" size={16} className="shrink-0 text-hint transition group-hover:translate-x-0.5 group-hover:text-brand" />}
              </Link>
            );
          })}
        </div>

        {extras.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-hint">
              {t("web:dashboard.coachReadiness.optionalTitle", { defaultValue: "Nice to have" })}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {extras.map((e) => (
                <Link
                  key={e.key}
                  href="/settings/profile"
                  className="rounded-pill border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-primary transition hover:border-brand/30"
                >
                  + {e.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="hidden shrink-0 sm:block">{allDone ? <ArtTrophy size={124} /> : <ArtRoadmapPath size={124} />}</div>
    </div>
  );
}

export default GettingStartedChecklist;
