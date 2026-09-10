import apiClient from "./apiClient";

// ---------------------------------------------------------------------------
// Web counterpart to the mobile app's services/adsService.ts — the REAL
// admin-uploaded-image ad system (Saveur-Backend's app/models/advertisement.py
// + app/api/ads.py), distinct from lib/appConfigService.ts's plain-text
// "home_banner" config section that components/dashboard/AnnouncementBanner.tsx
// reads. See that component's own comment for the full disambiguation.
//
// Only the "home_banner" placement is wired up here (GET /api/v1/ads/banner)
// — the popup placement (GET /api/v1/ads/next, POST /ads/<id>/impression)
// has no web surface yet, same scoping the mobile home-banner restoration
// commit used.
//
// GET /api/v1/ads/banner is authenticated (require_auth) and already
// server-side localized to the caller's profile.locale (title/body/
// detail_body/cta_label via ad_translation_service, image_url via
// image_urls_i18n — see ads.py's _localize_ad_image) — this file does no
// translation work of its own, just wire->camelCase mapping.
// ---------------------------------------------------------------------------

export interface HomeBannerAd {
  id: number;
  title: string;
  body: string;
  imageUrl?: string;
  detailBody: string;
  ctaUrl?: string;
  ctaLabel?: string;
}

interface AdWire {
  id?: number;
  title?: string | null;
  body?: string | null;
  image_url?: string;
  detail_body?: string | null;
  cta_url?: string;
  cta_label?: string;
}

// Mirrors mobile's adsService.ts fromWire — only `id` is genuinely required;
// an ad with no image AND no caption at all can't exist per admin.py's own
// validation. An empty `{}` response (no active home_banner ad configured)
// has no `id` and maps to null here.
function fromWire(wire: AdWire | null | undefined): HomeBannerAd | null {
  if (!wire || !wire.id) return null;
  return {
    id: wire.id,
    title: wire.title || "",
    body: wire.body || "",
    imageUrl: wire.image_url || undefined,
    detailBody: wire.detail_body || "",
    ctaUrl: wire.cta_url || undefined,
    ctaLabel: wire.cta_label || undefined,
  };
}

/**
 * GET /api/v1/ads/banner — the current admin-configured Home-screen banner
 * ad (placement="home_banner"), or null if the admin hasn't configured/
 * activated one. Never impression-capped (see Advertisement.placement's own
 * backend comment) — safe to call every time the dashboard mounts.
 */
export async function getHomeBanner(): Promise<HomeBannerAd | null> {
  const data = await apiClient.get<AdWire>("/api/v1/ads/banner");
  return fromWire(data);
}

export default { getHomeBanner };
