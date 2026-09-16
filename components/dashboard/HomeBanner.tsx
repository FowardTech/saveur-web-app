import { useTranslation } from "react-i18next";
import { ArtMissionPhone } from "./HomeBannerArt";

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
 * circles as a soft color backdrop behind it. */
export function HomeBanner() {
  const { t } = useTranslation();
  return (
    <div className="shadow-lg">
      <section className="relative overflow-hidden rounded-card border border-border bg-gradient-to-br from-brand/15 via-accent-purple/10 to-transparent px-6 py-8 sm:px-8 sm:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-brand/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 left-1/4 h-56 w-56 rounded-full bg-accent-purple/20 blur-3xl"
        />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex max-w-lg flex-col items-start gap-2">
            <h2 className="text-2xl font-bold leading-tight text-primary">
              {t("web:dashboard.homeBannerTitle", { defaultValue: "Keep building momentum." })}
            </h2>
            <p className="text-sm text-hint sm:text-base">
              {t("web:dashboard.homeBannerSubtitle", {
                defaultValue:
                  "Try a mock interview today — matching you with an AI interviewer and instant feedback usually takes less than 10 minutes.",
              })}
            </p>
          </div>
          <div className="hidden shrink-0 md:block">
            <ArtMissionPhone size={128} />
          </div>
        </div>
      </section>
    </div>
  );
}
