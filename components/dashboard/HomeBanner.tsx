"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LinkButton } from "@/components/ui/Button";
import { ArtMissionPhone } from "./HomeBannerArt";
import { getAppConfig, resolveDashboardHeroImage } from "@/lib/appConfigService";

// Default gradient — unchanged from before this card's background became
// admin-configurable (product request: "I want to be able to change the
// background of this card from the admin dashboard. Its the web app hero
// card"), so any deployment with no admin-set value looks exactly like it
// always has.
const DEFAULT_BACKGROUND_CSS =
  "linear-gradient(to bottom right, color-mix(in srgb, var(--brand) 15%, transparent), color-mix(in srgb, var(--accent-purple) 10%, transparent), transparent)";

/** Dashboard counterpart to the landing page's HeroBanner — same boxed/
 * gradient banner treatment, but no Register CTA or OAuth row since the
 * viewer is already signed in. The shadow lives on this outer wrapper
 * (not on the rounded+overflow-hidden inner element) — same convention as
 * the mobile app's cards, since shadow + overflow-hidden on the same
 * element silently clips the shadow in CSS.
 *
 * BUG FIX (task #37: "Add real illustrations to web dashboard, not SVG
 * shapes"): this banner — the very first thing a user sees on the
 * dashboard — had no actual picture at all, just two blurred gradient
 * circles and a small floating flash-icon badge standing in for
 * decoration. Replaced that badge with ArtMissionPhone (mobile's own
 * dashboard-hero illustration, see HomeBannerArt.tsx), kept the blurred
 * circles as a soft color backdrop behind it.
 *
 * BUG FIX (task #43 redundancy audit): app/dashboard/page.tsx used to
 * ALSO render a separate "Promo banner" block right below this one, with
 * near-identical copy ("Try a mock interview today" / AI interviewer /
 * feedback in minutes) and the same /practice/mock-interviews
 * destination, on the same page one screenful apart -- a real button was
 * missing here, so a second whole card existed mainly to carry a "Start
 * now" CTA. That block is now deleted and its CTA lives here instead,
 * making this one banner both the visual hero AND the actionable one
 * rather than needing a second, mostly-redundant card just for a button.
 *
 * BUG FIX (product report: "This card has like another white card behind
 * it. I can see the white edges"): the outer shadow wrapper had no
 * rounded-card class, so its box-shadow was cast as a sharp-cornered
 * rectangle while the inner section it wraps is rounded -- the shadow's
 * square corners stuck out past the card's rounded ones, reading as a
 * second white card peeking out from behind. Every other shadow-lg
 * wrapper in this codebase (SiteSearch, NotificationBell, Sidebar,
 * UserMenu dropdowns) already pairs it with rounded-card on the same
 * element; this one was just missing it. */
export function HomeBanner() {
  const { t, i18n } = useTranslation();
  const [backgroundCss, setBackgroundCss] = useState(DEFAULT_BACKGROUND_CSS);
  const [heroImageUrl, setHeroImageUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    getAppConfig(i18n.language).then((config) => {
      if (cancelled) return;
      const image = resolveDashboardHeroImage(config.dashboard_hero, i18n.language);
      setHeroImageUrl(image);
      if (!image && config.dashboard_hero.background_css) {
        setBackgroundCss(config.dashboard_hero.background_css);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [i18n.language]);

  // An admin-uploaded image takes over as the card's actual background
  // (product report: "The web dashboard hero is not a css background I
  // want uploading of image. Just like the way the homebanner for the
  // mobile has homebanner for all the 12 languages") — same base-image +
  // per-language-override upload as that mobile placement, see
  // DashboardHeroConfig's own comment in lib/appConfigService.ts. A dark
  // scrim keeps the title/subtitle/button legible over an arbitrary photo
  // regardless of theme, and the decorative blur circles + illustration
  // (which assume the built-in gradient) step aside so they don't clash
  // with someone else's image.
  const sectionStyle = heroImageUrl
    ? {
        backgroundImage: `linear-gradient(to bottom right, rgba(0,0,0,0.45), rgba(0,0,0,0.2)), url("${heroImageUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : { background: backgroundCss };

  return (
    <div className="rounded-card shadow-lg">
      <section
        className="relative overflow-hidden rounded-card border border-border px-6 py-8 sm:px-8 sm:py-10"
        style={sectionStyle}
      >
        {!heroImageUrl && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-brand/20 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 left-1/4 h-56 w-56 rounded-full bg-accent-purple/20 blur-3xl"
            />
          </>
        )}

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex max-w-lg flex-col items-start gap-3">
            <h2 className={`text-2xl font-bold leading-tight ${heroImageUrl ? "text-white" : "text-primary"}`}>
              {t("web:dashboard.homeBannerTitle", { defaultValue: "Keep building momentum." })}
            </h2>
            <p className={`text-sm sm:text-base ${heroImageUrl ? "text-white/85" : "text-hint"}`}>
              {t("web:dashboard.homeBannerSubtitle", {
                defaultValue:
                  "Try a mock interview today — matching you with an AI interviewer and instant feedback usually takes less than 10 minutes.",
              })}
            </p>
            <LinkButton href="/practice/mock-interviews" size="md">
              {t("web:dashboard.homeBannerCta", { defaultValue: "Start now" })}
            </LinkButton>
          </div>
          {!heroImageUrl && (
            <div className="hidden shrink-0 md:block">
              <ArtMissionPhone size={150} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
