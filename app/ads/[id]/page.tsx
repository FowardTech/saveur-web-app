"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import { getHomeBanner, type HomeBannerAd } from "@/lib/adsService";

// Web counterpart to Saveur/src/more/AdDetails.tsx — the landing screen a
// tap on the home banner ad card (components/dashboard/HomeBannerAd.tsx)
// opens. Renders the ad's full image/title/detail_body, plus a CTA button
// (opens cta_url in a new tab — this is a web app, not an in-app WebView the
// way mobile's WebViewScreen is).
//
// There is deliberately no `GET /api/v1/ads/<id>` single-ad endpoint on the
// backend (see Saveur-Backend's app/api/ads.py — only /next, /banner, and
// the impression POST exist for non-admin callers) — mobile never needs one
// either, since AdDetails.tsx just reads the full ad object straight out of
// navigation params instead of re-fetching. A full page route can't carry
// that same in-memory object across a URL navigation/reload, so this
// re-fetches GET /api/v1/ads/banner (the only real contract available) and
// confirms the id in the URL still matches the currently-active banner —
// correct per that endpoint's own "most-recently-created active row wins"
// semantics, since there is only ever one active home_banner ad at a time.
// If the admin swapped/deactivated the banner between the dashboard fetch
// and this page loading, the id won't match and this shows a clear
// "no longer available" state instead of silently mismatched content.
export default function AdDetailsPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const adId = params?.id;

  const [ad, setAd] = useState<HomeBannerAd | null | undefined>(undefined);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getHomeBanner()
      .then((data) => {
        if (cancelled) return;
        if (data && String(data.id) === String(adId)) {
          setAd(data);
        } else {
          setAd(null);
        }
      })
      .catch(() => {
        if (!cancelled) setAd(null);
      });
    return () => {
      cancelled = true;
    };
  }, [adId]);

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
          <Link href="/dashboard" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-hint hover:text-primary">
            <EvaIcon name="chevron-left-outline" size={16} />
            {t("web:ads.backToDashboard", { defaultValue: "Back to dashboard" })}
          </Link>

          {ad === undefined && (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-48 rounded-card" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-20 rounded-card" />
            </div>
          )}

          {ad === null && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 text-hint">
                <EvaIcon name="alert-circle-outline" size={20} />
              </span>
              <h1 className="font-semibold text-primary">{t("web:ads.noLongerAvailableTitle", { defaultValue: "This advert is no longer available" })}</h1>
              <p className="text-sm text-hint">
                {t("web:ads.noLongerAvailableSubtitle", { defaultValue: "It may have been updated or removed since you last saw it." })}
              </p>
            </div>
          )}

          {ad && (
            <>
              {ad.imageUrl && !imageFailed && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ad.imageUrl}
                  alt={ad.title || ""}
                  className="h-56 w-full rounded-card object-cover sm:h-72"
                  onError={() => setImageFailed(true)}
                />
              )}

              {(ad.title || ad.detailBody) && (
                <div className="rounded-card border border-border bg-surface-2 p-6">
                  {ad.title && <h1 className="text-xl font-bold text-primary">{ad.title}</h1>}
                  {ad.detailBody && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-hint">{ad.detailBody}</p>}
                </div>
              )}

              {ad.ctaUrl && (
                <a
                  href={ad.ctaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-2 rounded-pill bg-brand px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-600"
                >
                  {ad.ctaLabel || t("web:ads.learnMore", { defaultValue: "Learn more" })}
                  <EvaIcon name="external-link-outline" size={16} />
                </a>
              )}
            </>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
