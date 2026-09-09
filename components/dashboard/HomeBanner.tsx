import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";

/** Dashboard counterpart to the landing page's HeroBanner — same boxed/
 * gradient banner treatment, but no Register CTA or OAuth row since the
 * viewer is already signed in. The shadow lives on this outer wrapper
 * (not on the rounded+overflow-hidden inner element) — same convention as
 * the mobile app's cards, since shadow + overflow-hidden on the same
 * element silently clips the shadow in CSS. */
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
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-8 top-8 hidden h-14 w-14 rotate-6 items-center justify-center rounded-2xl bg-surface-2/60 text-brand shadow-sm backdrop-blur-sm sm:flex"
        >
          <EvaIcon name="flash-outline" size={24} />
        </span>

        <div className="relative flex max-w-lg flex-col items-start gap-2">
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
      </section>
    </div>
  );
}
