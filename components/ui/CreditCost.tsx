"use client";

import { useTranslation } from "react-i18next";
import { useCredits } from "@/app/providers/CreditsProvider";

/** Small "Uses N credits" hint to sit next to the button that triggers an AI
 * action. Renders nothing when the action is free or credits are off. */
export function CreditCost({ action, className = "" }: { action: string; className?: string }) {
  const { t } = useTranslation();
  const { costOf } = useCredits();
  const n = costOf(action);
  if (!n) return null;
  return (
    <span className={`text-xs font-medium text-hint ${className}`}>
      {t("web:credits.usesCredits", { defaultValue: "Uses {{count}} credits", count: n })}
    </span>
  );
}
