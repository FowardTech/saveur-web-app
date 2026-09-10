"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { getHomeBanner, type HomeBannerAd as HomeBannerAdData } from "@/lib/adsService";

// THE REAL admin home banner — an admin-uploaded IMAGE ad
// (Saveur-Backend's Advertisement model, placement="home_banner"), fetched
// authenticated via GET /api/v1/ads/banner. This is NOT
// components/dashboard/AnnouncementBanner.tsx (that's the plain-text
// app_config_service "home_banner" config section) and NOT
// components/dashboard/HomeBanner.tsx (this app's own static "Keep building
// momentum" hero card) — see both of those files' own comments for the
// full disambiguation. Mirrors Saveur/src/home/HomeSrc.tsx's homeBanner
// card: a persistent, tappable image card, never impression-capped, shown
// for as long as the admin leaves an active placement="home_banner" ad —
// renders nothing at all until one exists.
//
// Placement: above BOTH AnnouncementBanner and the "Keep building momentum"
// hero card in app/dashboard/page.tsx, per explicit repeated product ask
// ("above the Keep building momentum card") — leading with the real admin
// visual promo felt like the right call between the two "above" banners
// since it's the more attention-grabbing, intentionally-designed asset.
//
// Tapping navigates to /ads/[id], a new page mirroring src/more/AdDetails.tsx.
export function HomeBannerAd() {
  const { t } = useTranslation();
  const [ad, setAd] = useState<HomeBannerAdData | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getHomeBanner()
      .then((data) => {
        if (!cancelled) setAd(data);
      })
      .catch(() => {
        // Offline or the request failed — same fail-open convention as
        // AnnouncementBanner/getAppConfig: just don't show a banner this
        // load rather than surfacing an error for a non-critical promo card.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setImageFailed(false);
  }, [ad?.imageUrl]);

  if (!ad) return null;

  return (
    <Link
      href={`/ads/${ad.id}`}
      className="group block overflow-hidden rounded-card border border-border bg-surface-2 shadow-lg transition hover:border-brand/40"
    >
      <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-brand/20 via-accent-purple/15 to-transparent sm:h-48">
        {ad.imageUrl && !imageFailed ? (
          // Admin-uploaded marketing image — arbitrary remote origin (S3/
          // DigitalOcean Spaces via the backend's own /ads/image/<key>
          // proxy, see ads.py), so a plain <img> rather than next/image
          // (which would need every possible remote host allow-listed in
          // next.config.ts's images.remotePatterns).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ad.imageUrl}
            alt={ad.title || ""}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            onError={() => setImageFailed(true)}
          />
        ) : (
          // Code-drawn fallback tile — mirrors mobile's homeBannerImageFailed
          // degrade (no admin image, or it failed to load) rather than
          // leaving a blank space.
          <div className="flex h-full w-full items-center justify-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-surface-1/70 text-brand shadow-sm backdrop-blur-sm">
              <EvaIcon name="flash-outline" size={28} />
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-4 p-4">
        <div className="min-w-0 flex-1">
          {ad.title && <p className="truncate text-sm font-semibold text-primary">{ad.title}</p>}
          {ad.body && <p className="mt-0.5 line-clamp-2 text-sm text-hint">{ad.body}</p>}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand">
          {ad.ctaLabel || t("web:dashboard.homeBannerAdViewDetails", { defaultValue: "View details" })}
          <EvaIcon name="arrow-forward-outline" size={16} />
        </span>
      </div>
    </Link>
  );
}

export default HomeBannerAd;
