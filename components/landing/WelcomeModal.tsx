"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { ArtWelcomeWave } from "@/components/dashboard/HomeBannerArt";

const STORAGE_KEY = "saveur_welcome_modal_seen";

export function WelcomeModal() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

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

  useEffect(() => {
    // Client-only by nature (reads localStorage) — has to run post-mount.
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(true);
    }
  }, []);

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
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

        {/* Kept in sync with components/dashboard/WelcomeModal.tsx's
            identical swap (task #37: "Add real illustrations to web
            dashboard, not SVG shapes") -- this teaser and that modal are
            documented as sharing the same visual design, and both had the
            same fake "app screenshot" mockup here. */}
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
