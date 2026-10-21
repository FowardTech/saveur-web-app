"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { useCredits } from "@/app/providers/CreditsProvider";

/** Top-bar credit balance — links to the Credits page. Renders nothing while
 * the balance is loading or when credits are switched off by the admin. */
export function CreditsChip() {
  const { t } = useTranslation();
  const { credits } = useCredits();
  if (!credits?.enabled) return null;
  const low = credits.total <= Math.max(5, Math.round(credits.allowance * 0.1));
  return (
    <Link
      href="/credits"
      aria-label={t("web:credits.chipLabel", { defaultValue: "AI credits" }).toString()}
      className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-sm font-bold transition hover:bg-surface-3 ${
        low ? "border-danger text-danger" : "border-border text-primary"
      }`}
    >
      <EvaIcon name="flash-outline" size={14} className={low ? "text-danger" : "text-brand"} />
      {credits.total}
    </Link>
  );
}
