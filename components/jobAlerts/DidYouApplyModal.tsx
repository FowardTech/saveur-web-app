"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";

// Web counterpart to mobile's "Did you apply?" fallback Alert
// (Saveur/src/more/WebViewScreen.tsx, ~lines 371-385) — same copy, same
// two-choice shape. Visual pattern (fixed inset-0 dialog, rounded-card
// surface-2 panel) matches this app's other small confirmation dialogs,
// e.g. components/jobAlerts/ShareToUserModal.tsx.
interface DidYouApplyModalProps {
  open: boolean;
  company: string;
  role: string;
  isSubmitting: boolean;
  feedback: { tone: "success" | "danger"; text: string } | null;
  onConfirm: () => void;
  onDismiss: () => void;
}

export function DidYouApplyModal({ open, company, role, isSubmitting, feedback, onConfirm, onDismiss }: DidYouApplyModalProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-card border border-border bg-surface-2 p-5 shadow-2xl">
        <h2 className="mb-2 font-semibold text-primary">
          {t("web:jobAlerts.details.didYouApplyTitle", { defaultValue: "Did you apply for this job?" })}
        </h2>
        <p className="mb-4 text-sm text-hint">
          {t("web:jobAlerts.details.didYouApplyBody", {
            defaultValue: "We couldn't confirm automatically — mark {{role}} at {{company}} as applied?",
            role,
            company,
          })}
        </p>

        {feedback && (
          <p className={`mb-4 text-sm font-medium ${feedback.tone === "success" ? "text-success-text" : "text-danger"}`}>{feedback.text}</p>
        )}

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDismiss} disabled={isSubmitting} className="flex-1 justify-center">
            {t("web:jobAlerts.details.didYouApplyNotYet", { defaultValue: "Not yet" })}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isSubmitting || !!feedback} className="flex-1 justify-center">
            {isSubmitting
              ? t("web:jobAlerts.details.markingApplied", { defaultValue: "Marking…" })
              : t("web:jobAlerts.details.yesMarkApplied", { defaultValue: "Yes, mark as applied" })}
          </Button>
        </div>
      </div>
    </div>
  );
}
