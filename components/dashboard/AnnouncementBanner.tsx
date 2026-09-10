"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { useAuth } from "@/app/providers/AuthProvider";
import { getAppConfig, type HomeBannerConfig } from "@/lib/appConfigService";

// Web counterpart to the mobile app's src/home/AnnouncementBanner.tsx — see
// that file's top-of-file comment for the full product history. Admin-
// authored via Saveur-Backend's app_config_service.py "home_banner" section
// (Admin > Content > Home banner), already server-side translated per the
// user's locale the same way FAQ/About are (see content.py's GET /config).
//
// NOT the same thing as components/dashboard/HomeBanner.tsx just below where
// this renders — that's this app's own static decorative hero card
// ("Keep building momentum"), unrelated to admin-authored config. This is a
// slim, non-blocking, dismissible strip meant for "FYI, nothing's broken"
// notices (policy changes, ToS updates, etc.), rendered above it per the
// product ask that this be visible "above" the hero card.
//
// Dismissible per account, remembered by fingerprinting title+message+
// link_url in localStorage (mirrors mobile's AsyncStorage-keyed
// `homeBannerDismissed:<uid>`) — an admin editing the copy later changes the
// fingerprint, so it reappears once for everyone who already dismissed the
// old wording, with nothing for an admin to remember to bump.
const DEFAULT_CONFIG: HomeBannerConfig = {
  enabled: false,
  title: "",
  message: "",
  link_url: "",
  link_label: "",
};

function dismissedStorageKey(uid?: string | null): string {
  return `saveur.homeBannerDismissed.${uid || "anon"}`;
}

function readDismissedFingerprint(uid?: string | null): string | null {
  try {
    return window.localStorage.getItem(dismissedStorageKey(uid));
  } catch {
    return null;
  }
}

function writeDismissedFingerprint(uid: string | null | undefined, fingerprint: string): void {
  try {
    window.localStorage.setItem(dismissedStorageKey(uid), fingerprint);
  } catch {
    // Private browsing / storage disabled — dismissal just won't persist
    // across reloads, which is a safe degrade, not a crash.
  }
}

export function AnnouncementBanner() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();

  const [config, setConfig] = useState<HomeBannerConfig>(DEFAULT_CONFIG);
  // undefined = still reading localStorage / awaiting the config fetch —
  // render nothing yet, to avoid a one-frame flash of a banner that turns
  // out to already be dismissed (or doesn't exist).
  const [dismissed, setDismissed] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getAppConfig(i18n.language).then((data) => {
      if (!cancelled) setConfig(data.home_banner);
    });
    return () => {
      cancelled = true;
    };
  }, [i18n.language]);

  useEffect(() => {
    // Client-only by nature (reads localStorage) — has to run post-mount,
    // so this can't be a lazy useState initializer without risking a
    // server/client render mismatch (same pattern as CookieBar/WelcomeModal).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(readDismissedFingerprint(profile?.uid));
  }, [profile?.uid]);

  const fingerprint = `${config.title}|${config.message}|${config.link_url}`;

  function onDismiss() {
    setDismissed(fingerprint);
    writeDismissedFingerprint(profile?.uid, fingerprint);
  }

  if (!config.enabled || (!config.title && !config.message)) return null;
  if (dismissed === undefined || dismissed === fingerprint) return null;

  return (
    <div className="flex items-start gap-3 rounded-card border border-border bg-surface-2 px-4 py-3">
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
        <EvaIcon name="info-outline" size={16} />
      </span>
      <div className="min-w-0 flex-1">
        {config.title && <p className="text-sm font-semibold text-primary">{config.title}</p>}
        {config.message && <p className="mt-0.5 text-sm text-hint">{config.message}</p>}
        {config.link_url && (
          <a
            href={config.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-sm font-medium text-link hover:underline"
          >
            {config.link_label || t("web:dashboard.announcementLearnMore", { defaultValue: "Learn more" })}
          </a>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("common:actions.close", { defaultValue: "Close" })}
        className="shrink-0 rounded-full p-1 text-hint transition hover:bg-surface-3 hover:text-primary"
      >
        <EvaIcon name="close-outline" size={16} />
      </button>
    </div>
  );
}

export default AnnouncementBanner;
