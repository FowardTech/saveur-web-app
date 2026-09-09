"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";

const STORAGE_KEY = "saveur_cookie_consent";

export function CookieBar() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Client-only by nature (reads localStorage, which doesn't exist during
    // SSR) — has to run post-mount, so this can't be a lazy useState
    // initializer without risking a server/client render mismatch.
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    }
  }, []);

  function accept() {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-2 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <p className="text-sm text-hint">
          {t("web:cookieBar.message", {
            defaultValue: "We use cookies to keep you signed in and to understand how Saveur is used. See our Privacy Policy for details.",
          })}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={accept}
            className="rounded-pill bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            {t("web:cookieBar.accept", { defaultValue: "Accept" })}
          </button>
          <button
            type="button"
            onClick={() => setVisible(false)}
            aria-label={t("web:cookieBar.dismiss", { defaultValue: "Dismiss" })}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-hint hover:bg-surface-3"
          >
            <EvaIcon name="close-outline" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
