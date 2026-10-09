"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { useAuth } from "@/app/providers/AuthProvider";
import { useCoachReadiness } from "@/lib/coachReadiness";

// One-time first-login prompt: "the first thing you should do". Product
// report: new users aren't told what to do first so the AI coach can help
// them as much as possible. Shows once per account, AFTER the welcome modal
// and the app tour have been dealt with (those two are one-time overlays with
// their own localStorage flags -- see WelcomeModal.tsx / AppTour.tsx -- so
// this waits for both rather than stacking on top of them), and only while an
// essential setup step is still missing. The persistent card on the dashboard
// (GettingStartedChecklist.tsx) remains afterwards.
const SEEN_PREFIX = "saveur.coachSetupPromptSeen.";
const WELCOME_PREFIX = "saveur_welcome_modal_seen_";
const TOUR_PREFIX = "saveur.appTourSeen.";

export function CoachSetupPrompt() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const readiness = useCoachReadiness();
  const [open, setOpen] = useState(false);
  const uid = profile?.uid;

  useEffect(() => {
    if (!uid || readiness.loading || readiness.allDone) return;
    try {
      if (window.localStorage.getItem(SEEN_PREFIX + uid)) return;
    } catch {
      return;
    }
    // Wait (cheaply) until the welcome modal and tour have been closed.
    const ready = () => {
      try {
        const welcomeDone = !!profile?.hasSeenWelcomeModal || !!window.localStorage.getItem(WELCOME_PREFIX + uid);
        const tourDone = !!window.localStorage.getItem(TOUR_PREFIX + uid);
        return welcomeDone && tourDone;
      } catch {
        return false;
      }
    };
    if (ready()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
      return;
    }
    const timer = window.setInterval(() => {
      if (ready()) {
        window.clearInterval(timer);
        setOpen(true);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [uid, readiness.loading, readiness.allDone, profile?.hasSeenWelcomeModal]);

  function close() {
    setOpen(false);
    try {
      if (uid) window.localStorage.setItem(SEEN_PREFIX + uid, "1");
    } catch {
      // ignore
    }
  }

  if (!open || !readiness.next) return null;
  const { next, steps, doneCount, total } = readiness;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[10vh]" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-card border border-border bg-surface-2 p-6 shadow-2xl">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
          <EvaIcon name="flash-outline" size={24} />
        </span>
        <h2 className="mt-4 text-xl font-bold text-primary">
          {t("web:dashboard.coachReadiness.promptTitle", { defaultValue: "One thing to do first" })}
        </h2>
        <p className="mt-2 text-sm text-hint">
          {t("web:dashboard.coachReadiness.promptBody", {
            defaultValue: "Your AI coach is only as good as what it knows about you. Finish these {{count}} quick steps so it can give you the most accurate, personal help.",
            count: total - doneCount,
          })}
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {steps.map((s) => (
            <li key={s.key} className={`flex items-center gap-2.5 text-sm ${s.done ? "text-hint line-through" : "font-medium text-primary"}`}>
              <EvaIcon name={s.done ? "checkmark-circle-2-outline" : "arrow-circle-right-outline"} size={16} className={s.done ? "text-success" : "text-hint"} />
              {s.label}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <Link
            href={next.href}
            onClick={close}
            className="inline-flex flex-1 items-center justify-center rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(39,115,238,0.55)] transition hover:bg-brand-600"
          >
            {t("web:dashboard.coachReadiness.promptCta", { defaultValue: "Start: {{step}}", step: next.label })}
          </Link>
          <button
            type="button"
            onClick={close}
            className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-hint transition hover:bg-surface-3 hover:text-primary"
          >
            {t("web:dashboard.coachReadiness.promptLater", { defaultValue: "I'll do it later" })}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CoachSetupPrompt;
