import { useTranslation } from "react-i18next";
import { LinkButton } from "@/components/ui/Button";
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
  const { t } = useTranslation();
  return (
    <div className="rounded-card shadow-lg">
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
          <div className="flex max-w-lg flex-col items-start gap-3">
            <h2 className="text-2xl font-bold leading-tight text-primary">
              {t("web:dashboard.homeBannerTitle", { defaultValue: "Keep building momentum." })}
            </h2>
            <p className="text-sm text-hint sm:text-base">
              {t("web:dashboard.homeBannerSubtitle", {
                defaultValue:
                  "Try a mock interview today — matching you with an AI interviewer and instant feedback usually takes less than 10 minutes.",
              })}
            </p>
            <LinkButton href="/practice/mock-interviews" size="md">
              {t("web:dashboard.homeBannerCta", { defaultValue: "Start now" })}
            </LinkButton>
          </div>
          <div className="hidden shrink-0 md:block">
            <ArtMissionPhone size={128} />
          </div>
        </div>
      </section>
    </div>
  );
}
