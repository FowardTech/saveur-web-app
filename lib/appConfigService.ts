import apiClient from "./apiClient";

// ---------------------------------------------------------------------------
// Thin web counterpart to the mobile app's services/configService.ts — reads
// the same public, unauthenticated GET /api/v1/content/config (see
// Saveur-Backend's app/api/content.py + app/services/app_config_service.py).
// Deliberately does not replicate mobile's full pub/sub/AsyncStorage-cache
// machinery (feature flags, force-update gate, etc. aren't used on web
// today) — just enough to fetch the config once per session and hand back
// the sections a caller asks for, e.g. `home_banner` for
// components/dashboard/AnnouncementBanner.tsx.
// ---------------------------------------------------------------------------

export interface HomeBannerConfig {
  enabled: boolean;
  title: string;
  message: string;
  link_url: string;
  link_label: string;
}

// Job Tracker inbox/calendar auto-scan admin kill-switches (Saveur-Backend's
// app_config_service.py DEFAULTS["feature_flags"], Saveur/services/
// configService.ts's own FeatureFlags interface) — the only feature_flags
// keys the web app currently reads (gate the 4 "Connect ..." cards on
// app/applications/page.tsx). Deliberately a narrow subset, not the mobile
// app's full ~30-key FeatureFlags shape, matching this file's existing
// "add sections as web grows to need them" convention. All 4 default to
// false (fail CLOSED), same reasoning as mobile's DEFAULT_CONFIG: a
// "Connect Gmail" button that's guaranteed to 503 isn't a better fallback
// during a network hiccup than just hiding it.
export interface FeatureFlags {
  gmail_inbox_scan: boolean;
  outlook_inbox_scan: boolean;
  google_calendar_scan: boolean;
  outlook_calendar_scan: boolean;
}

export interface AppConfig {
  home_banner: HomeBannerConfig;
  feature_flags: FeatureFlags;
  // Other sections (release, faq, about, etc.) exist on the backend
  // response too but aren't modeled here yet — add them as web grows to
  // need them, same pattern as this one.
  [key: string]: unknown;
}

const DEFAULT_HOME_BANNER: HomeBannerConfig = {
  enabled: false,
  title: "",
  message: "",
  link_url: "",
  link_label: "",
};

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  gmail_inbox_scan: false,
  outlook_inbox_scan: false,
  google_calendar_scan: false,
  outlook_calendar_scan: false,
};

// Module-scope cache — good enough for "no need to replicate mobile's pub/sub
// complexity" per the product ask: one fetch per page session, shared by any
// component that calls getAppConfig() while the promise is in flight or
// after it resolves.
let cached: AppConfig | null = null;
let inFlight: Promise<AppConfig> | null = null;

/** Fetches (and caches for the session) the public app config. Never throws
 * — falls back to safe defaults on any network/parse failure, same
 * fail-open convention as mobile's loadAppConfig(). */
export async function getAppConfig(language?: string): Promise<AppConfig> {
  if (cached) return cached;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const data = await apiClient.get<Partial<AppConfig>>("/api/v1/content/config", {
        auth: false,
        params: language ? { language } : undefined,
      });
      cached = {
        ...data,
        home_banner: { ...DEFAULT_HOME_BANNER, ...data.home_banner },
        feature_flags: { ...DEFAULT_FEATURE_FLAGS, ...data.feature_flags },
      } as AppConfig;
    } catch {
      // Network/backend unavailable — fail open with defaults so a config
      // fetch failure never blocks the dashboard from rendering. (The 4
      // Job Tracker connect flags inside DEFAULT_FEATURE_FLAGS themselves
      // fail CLOSED — see that const's own comment — this outer fail-open
      // is only about the fetch itself, not what those individual flags
      // default to.)
      cached = { home_banner: DEFAULT_HOME_BANNER, feature_flags: DEFAULT_FEATURE_FLAGS };
    }
    return cached;
  })();

  return inFlight;
}

/** Synchronous read of whichever feature-flag section was last fetched by
 * getAppConfig() (or DEFAULT_FEATURE_FLAGS if it hasn't resolved yet this
 * session) — mirrors mobile's services/configService.ts isFeatureEnabled().
 * Callers that need this to reflect a live fetch should await
 * getAppConfig() first (e.g. on mount), then re-render off its result;
 * this helper itself never triggers a fetch. */
export function isFeatureEnabled(key: keyof FeatureFlags): boolean {
  return (cached?.feature_flags ?? DEFAULT_FEATURE_FLAGS)[key] !== false;
}
