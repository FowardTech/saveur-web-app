"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";

interface Props {
  open: boolean;
  onSubmit: (score: number) => Promise<void>;
  onDismiss: () => void;
}

// Web port of mobile's components/AppRatingModal.tsx (product report: "you
// did not implement ratings in the web app... just the way it is in the
// mobile app"). Minimal, MyFitnessPal-style prompt per mobile's own
// redesign comment: a plain star row, tapping a star submits immediately
// (no separate comment box + Submit button) -- this app doesn't route
// through a native App Store review sheet (no live listing yet), so
// submitting quietly records the score for the admin's QA view
// (lib/appRatingService.ts) rather than opening a store link.
//
// Rendered via createPortal to document.body -- same fix as the
// video-interview full-screen bug and AppTour's spotlight overlay earlier
// this session: AppShell's .animate-page-in wrapper applies a CSS
// `animation ... both`, and the `both` fill-mode keeps the keyframe's
// transform applied indefinitely (even translateY(0) still counts as a
// non-none transform), which creates a new containing block for any
// `position: fixed` descendant. Rendered as a normal child of this
// dashboard page, this modal would get boxed into that wrapper's bounds
// instead of covering the real viewport.
export function RatingModal({ open, onSubmit, onDismiss }: Props) {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) setSubmitting(false);
  }, [open]);

  if (!open || !mounted) return null;

  async function onPressStar(score: number) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(score);
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6" role="dialog" aria-modal="true">
      <div className="flex w-full max-w-sm flex-col items-center rounded-card bg-surface-2 p-6 shadow-2xl">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand">
          <EvaIcon name="flash-outline" size={28} className="text-white" />
        </span>
        <h2 className="mt-4 text-center text-lg font-bold text-primary">
          {t("web:rating.title", { defaultValue: "Enjoying Saveur?" })}
        </h2>
        <p className="mt-1.5 text-center text-sm text-hint">
          {t("web:rating.subtitle", { defaultValue: "Tap a star to let us know how it's going." })}
        </p>

        <div className="mt-5 flex items-center justify-center gap-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={submitting}
              onClick={() => onPressStar(n)}
              aria-label={t("web:rating.starLabel", { defaultValue: "{{n}} star", n }).toString()}
              className="p-1 text-brand transition disabled:opacity-50"
            >
              <EvaIcon name="star-outline" size={32} />
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={onDismiss}
          className="mt-6 w-full rounded-lg bg-surface-3 py-3 text-sm font-semibold text-primary transition hover:bg-surface-4 disabled:opacity-50"
        >
          {t("web:rating.notNow", { defaultValue: "Not Now" })}
        </button>
      </div>
    </div>,
    document.body
  );
}

export default RatingModal;
