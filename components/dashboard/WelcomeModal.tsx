"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { useAuth } from "@/app/providers/AuthProvider";
import { ArtWelcomeWave } from "./HomeBannerArt";

// First-login "Welcome to Saveur" onboarding popup — shown exactly once per
// account, the first time a signed-in user lands on /dashboard. Same
// visual design/content as components/landing/WelcomeModal.tsx (that one
// is a localStorage-only teaser shown on the public marketing homepage, a
// different surface with a different, lower-stakes "don't nag" contract),
// but this one's dismissal is account-level: it PATCHes
// has_seen_welcome_modal on the backend User record (see Saveur-Backend's
// app/models/user.py + app/api/users.py's update_me()) so the modal never
// reappears even if the user next logs in from a completely different
// browser or device — a per-browser localStorage flag alone would be wrong
// for a genuine "first login" event. localStorage here is only a same-tab
// fast-path cache (avoids a flash-open if this remounts while the dismiss
// PATCH is still in flight), never the source of truth.
const STORAGE_KEY_PREFIX = "saveur_welcome_modal_seen_";

export function WelcomeModal() {
  const { t } = useTranslation();
  const { profile, loading, updateProfile } = useAuth();
  const [open, setOpen] = useState(false);

  const uid = profile?.uid;

  useEffect(() => {
    if (loading || !profile || !uid) return;
    if (profile.hasSeenWelcomeModal) return;
    if (window.localStorage.getItem(STORAGE_KEY_PREFIX + uid)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [loading, profile, uid]);

  const bulletGroups: { title: string; icon: Parameters<typeof EvaIcon>[0]["name"]; items: string[] }[] = [
    {
      title: t("web:welcomeModal.group1Title", { defaultValue: "What you get" }),
      icon: "checkmark-circle-2-outline",
      items: [
        t("web:welcomeModal.group1Item1", { defaultValue: "Realistic AI mock interviews with instant feedback" }),
        t("web:welcomeModal.group1Item2", { defaultValue: "A personalized career roadmap built around your goals" }),
        t("web:welcomeModal.group1Item3", { defaultValue: "Resume, cover letter, and LinkedIn tools in one place" }),
      ],
    },
    {
      title: t("web:welcomeModal.group2Title", { defaultValue: "Built for your search" }),
      icon: "briefcase-outline",
      items: [
        t("web:welcomeModal.group2Item1", { defaultValue: "Daily job alerts matched to your desired roles" }),
        t("web:welcomeModal.group2Item2", { defaultValue: "Coding practice and real-world scenario drills" }),
        t("web:welcomeModal.group2Item3", { defaultValue: "Guided learning courses to close skill gaps" }),
      ],
    },
  ];

  async function dismiss() {
    setOpen(false);
    if (uid) window.localStorage.setItem(STORAGE_KEY_PREFIX + uid, "1");
    try {
      await updateProfile({ hasSeenWelcomeModal: true });
    } catch {
      // Best-effort: the localStorage flag above still keeps this browser
      // from showing it again even if the PATCH failed (e.g. offline) — a
      // later successful profile save (or a retried dismiss) will persist
      // the real account-level flag.
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-card border border-border bg-surface-2 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-tint-mint text-tint-mint-text">
              <EvaIcon name="compass-outline" size={18} />
            </span>
            <span className="font-semibold text-primary">{t("web:welcomeModal.title", { defaultValue: "Welcome to Saveur" })}</span>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("common:actions.close", { defaultValue: "Close" })}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-hint hover:bg-surface-3"
          >
            <EvaIcon name="close-outline" size={18} />
          </button>
        </div>

        {/* BUG FIX (task #37: "Add real illustrations to web dashboard, not
            SVG shapes"): was a fake "app screenshot" mockup (a bordered
            rect standing in for a card, with a few colored bars/a dot for
            text lines) rather than an actual illustration. Replaced with
            ArtWelcomeWave (mobile's own welcome-screen art — a waving
            figure with an AI-Coach chat-bubble accent), same as
            components/landing/WelcomeModal.tsx's identical swap. */}
        <div className="flex items-center justify-center bg-gradient-to-br from-brand/15 via-accent-purple/10 to-transparent px-5 py-8">
          <ArtWelcomeWave size={150} />
        </div>

        <div className="px-5 pb-6 pt-4">
          <h2 className="text-xl font-bold text-primary">
            {t("web:welcomeModal.heading", { defaultValue: "Your AI-powered co-pilot for landing the next role" })}
          </h2>
          <p className="mt-2 text-sm text-hint">
            {t("web:welcomeModal.description", {
              defaultValue:
                "Saveur pairs an AI coach with practical tools — interviews, resumes, roadmaps, and job matching — so every step of your search is backed by data, not guesswork.",
            })}
          </p>

          <div className="mt-5 flex flex-col gap-4">
            {bulletGroups.map((group) => (
              <div key={group.title}>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                  <EvaIcon name={group.icon} size={16} className="text-brand" />
                  {group.title}
                </div>
                <ul className="flex flex-col gap-1.5 pl-1">
                  {group.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-hint">
                      <EvaIcon name="checkmark-outline" size={14} className="mt-0.5 shrink-0 text-success-text" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={dismiss}
            className="mt-6 w-full rounded-pill bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            {t("web:welcomeModal.cta", { defaultValue: "Let's get started" })}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WelcomeModal;
