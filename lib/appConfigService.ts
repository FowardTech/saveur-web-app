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

export interface AppConfig {
  home_banner: HomeBannerConfig;
  // Other sections (feature_flags, release, faq, about, etc.) exist on the
  // backend response too but aren't modeled here yet — add them as web
  // grows to need them, same pattern as this one.
  [key: string]: unknown;
}

const DEFAULT_HOME_BANNER: HomeBannerConfig = {
  enabled: false,
  title: "",
  message: "",
  link_url: "",
  link_label: "",
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
      } as AppConfig;
    } catch {
      // Network/backend unavailable — fail open with defaults so a config
      // fetch failure never blocks the dashboard from rendering.
      cached = { home_banner: DEFAULT_HOME_BANNER };
    }
    return cached;
  })();

  return inFlight;
}
