"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { CompanyLogoAvatar } from "@/components/practice/CompanyLogoAvatar";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { DidYouApplyModal } from "@/components/jobAlerts/DidYouApplyModal";
import { useApplyTracking } from "@/hooks/useApplyTracking";

// Product request: "See the Job Page too I like the layout and structure"
// [resume.io's /app/job-search — a Recommended/Search toggle, Save Job,
// and a one-click Apply that auto-prompts to add the job to the
// Tracker]. Extracted out of app/job-alerts/page.tsx's own row markup so
// each card can own its own useApplyTracking() hook instance (a hook
// can't be called conditionally inside a .map() in the parent — one
// instance per rendered component is the correct pattern). Previously
// this list only had a pin/star toggle per row and no way to apply
// without opening the detail page first; Save (a relabeled version of the
// same pin concept resume.io calls "Save Job") and Apply now live
// directly on the card, same as the detail page already offered.
export interface JobAlertCardData {
  id: string;
  title: string;
  company: string;
  location?: string;
  apply_url?: string;
  read: boolean;
  pinned: boolean;
  applied?: boolean;
  company_logo_url?: string;
}

interface JobAlertCardProps {
  alert: JobAlertCardData;
  logoUrl: string | null;
  togglingPin: boolean;
  onTogglePin: (alert: JobAlertCardData) => void;
  onMarkApplied: (id: string) => void;
  animationDelayMs?: number;
}

export function JobAlertCard({ alert: a, logoUrl, togglingPin, onTogglePin, onMarkApplied, animationDelayMs }: JobAlertCardProps) {
  const { t } = useTranslation();
  const apply = useApplyTracking({
    company: a.company,
    role: a.title,
    location: a.location,
    applyUrl: a.apply_url,
    companyLogoUrl: logoUrl,
    alreadyApplied: !!a.applied,
  });

  async function handleConfirmApplied() {
    const succeeded = await apply.confirmApplied();
    if (succeeded) onMarkApplied(a.id);
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-card border bg-surface-2 p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md animate-card-in sm:flex-row sm:items-center sm:justify-between ${
        !a.read ? "border-accent-purple" : "border-border"
      }`}
      style={animationDelayMs != null ? { animationDelay: `${animationDelayMs}ms` } : undefined}
    >
      <Link href={`/job-alerts/${a.id}`} className="flex flex-1 items-center gap-3">
        <CompanyLogoAvatar logoUrl={logoUrl ?? undefined} companyName={a.company} size={44} className="shrink-0 bg-tint-mint" />
        <div>
          {!a.read && (
            <span className="mb-1 inline-block rounded-pill bg-accent-purple/15 px-2 py-0.5 text-xs font-semibold text-accent-purple">
              {t("web:jobAlerts.newBadge", { defaultValue: "New" })}
            </span>
          )}
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-primary">{a.title}</h3>
            {a.applied && (
              <span className="inline-flex items-center rounded-pill bg-tint-purple px-2 py-0.5 text-xs font-medium text-tint-purple-text">
                {t("web:jobAlerts.appliedBadge", { defaultValue: "Applied" })}
              </span>
            )}
          </div>
          <p className="text-sm text-hint">
            {a.company}
            {a.location ? ` · ${a.location}` : ""}
          </p>
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => onTogglePin(a)}
          disabled={togglingPin}
          aria-label={t("web:jobAlerts.saveJobAria", { defaultValue: "Save this job" })}
          className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
            a.pinned ? "border-brand bg-brand/10 text-brand" : "border-border text-hint hover:border-brand/50 hover:text-primary"
          }`}
        >
          <EvaIcon name="star-outline" size={14} />
          {a.pinned
            ? t("web:jobAlerts.saved", { defaultValue: "Saved" })
            : t("web:jobAlerts.saveJob", { defaultValue: "Save" })}
        </button>

        {a.apply_url && !a.applied && (
          <button
            type="button"
            onClick={apply.openApply}
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600"
          >
            {t("web:jobAlerts.applyButton", { defaultValue: "Apply" })}
            <EvaIcon name="external-link-outline" size={13} />
          </button>
        )}
      </div>

      <DidYouApplyModal
        open={apply.promptOpen}
        company={a.company}
        role={a.title}
        isSubmitting={apply.isSubmitting}
        feedback={apply.feedback}
        onConfirm={handleConfirmApplied}
        onDismiss={apply.dismissPrompt}
      />
    </div>
  );
}
