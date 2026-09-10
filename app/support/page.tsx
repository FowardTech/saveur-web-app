"use client";

import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { EvaIcon } from "@/components/icons/EvaIcon";

const SUPPORT_EMAIL = "support@saveurnow.com";

// No live-chat backend endpoint exists yet in Saveur-Backend for this — the
// mobile app's "Live Support" entry point isn't backed by a real chat API
// either. Honest static contact page rather than fake wiring, per this
// pass's "simplified static state is fine for genuinely out-of-scope
// features" guidance.
export default function LiveSupportPage() {
  const { t } = useTranslation();
  return (
    <AppShell>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-tint-mint text-tint-mint-text">
          <EvaIcon name="headphones-outline" size={26} />
        </span>
        <h1 className="text-2xl font-bold text-primary">{t("web:support.title", { defaultValue: "Live Support" })}</h1>
        <p className="text-sm text-hint">
          {t("web:support.description", {
            defaultValue:
              "In-app live chat support is coming to the web app in a future update. In the meantime, reach us directly and we'll get back to you as soon as we can.",
          })}
        </p>
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="rounded-pill bg-brand px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
        >
          {t("web:support.emailCta", { defaultValue: "Email {{email}}", email: SUPPORT_EMAIL })}
        </a>
      </div>
    </AppShell>
  );
}
