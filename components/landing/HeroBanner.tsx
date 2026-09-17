"use client";

import { useTranslation } from "react-i18next";
import { LinkButton } from "@/components/ui/Button";
import { LinkedInGlyph } from "@/components/auth/LinkedInButton";
import { EvaIcon } from "@/components/icons/EvaIcon";

/** The landing page's hero — a distinctly-styled boxed/gradient banner
 * (echoing the "rich bannered hero" reference, without copying any
 * gambling-specific branding or imagery), not just text on the page
 * background. Keeps its own Register CTA + OAuth row even though the
 * topbar also has Sign In/Register — that duplication matches the
 * reference's own hero, since a signed-out visitor lands here first. */
export function HeroBanner() {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden rounded-card border border-border bg-gradient-to-br from-brand/15 via-accent-purple/10 to-transparent px-6 py-12 sm:px-10 sm:py-16">
      {/* Decorative soft blurred color blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-accent-purple/20 blur-3xl"
      />

      {/* Decorative translucent icon badges, arranged behind/beside the copy */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-8 top-8 hidden h-16 w-16 rotate-6 items-center justify-center rounded-2xl bg-surface-2/60 text-brand shadow-sm backdrop-blur-sm sm:flex"
      >
        <EvaIcon name="briefcase-outline" size={28} />
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-28 top-32 hidden h-12 w-12 -rotate-12 items-center justify-center rounded-full bg-surface-2/60 text-accent-purple shadow-sm backdrop-blur-sm md:flex"
      >
        <EvaIcon name="mic-outline" size={20} />
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-6 bottom-6 hidden h-14 w-14 rotate-12 items-center justify-center rounded-2xl bg-surface-2/60 text-tint-mint-text shadow-sm backdrop-blur-sm lg:flex"
      >
        <EvaIcon name="trending-up-outline" size={24} />
      </span>

      <div className="relative flex max-w-xl flex-col items-start gap-6">
        <h1 className="text-4xl font-bold leading-tight text-primary sm:text-5xl">
          {t("web:landing.heroTitleLine1", { defaultValue: "Land your next role faster" })}
          <br />
          {t("web:landing.heroTitleLine2", { defaultValue: "with an AI career coach in your corner." })}
        </h1>
        <p className="max-w-xl text-base text-hint sm:text-lg">
          {t("web:landing.heroSubtitle", {
            defaultValue:
              "Saveur pairs realistic AI mock interviews, coding practice, and resume tools with a personalized roadmap and daily job matching — everything you need to go from job search to offer.",
          })}
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <LinkButton href="/register" size="lg">
            {t("web:landing.heroGetStarted", { defaultValue: "Get Started" })}
            <EvaIcon name="arrow-forward-outline" size={16} />
          </LinkButton>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="text-xs uppercase tracking-wide text-hint">{t("common:auth.orContinueWith", { defaultValue: "Or Continue With" })}</span>
          <div className="flex flex-wrap items-center gap-3">
            {/* BUG FIX (product report: "The user is supposed to accept
                the terms and conditions and privacy policy before they
                can sign up or login"): these used to be the real
                GoogleButton/LinkedInButton components, firing an actual
                Firebase/OAuth sign-in immediately on click, right from
                the landing page -- a signed-out visitor could create a
                full account here without ever seeing (or being able to
                see, there was nowhere to check it) the Terms/Privacy
                gate that the actual /register page now enforces. The
                primary "Get Started" button already correctly just
                links to /register instead of acting directly; these two
                now do the same; instead of duplicating the gate on the
                marketing homepage itself, every real account-creation
                path is funneled through the one gated form. */}
            <LinkButton href="/register" variant="outline" className="!rounded-pill gap-2 !bg-surface-2 px-4 py-2.5 text-sm">
              <EvaIcon name="google-outline" size={16} />
              Google
            </LinkButton>
            <LinkButton href="/register" variant="outline" className="!rounded-pill gap-2 !border-transparent !bg-[#0A66C2] px-4 py-2.5 text-sm !text-white hover:!bg-[#0958a8]">
              <LinkedInGlyph size={16} />
              LinkedIn
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  );
}
