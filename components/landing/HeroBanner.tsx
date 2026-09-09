import { LinkButton } from "@/components/ui/Button";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { LinkedInButton } from "@/components/auth/LinkedInButton";
import { EvaIcon } from "@/components/icons/EvaIcon";

/** The landing page's hero — a distinctly-styled boxed/gradient banner
 * (echoing the "rich bannered hero" reference, without copying any
 * gambling-specific branding or imagery), not just text on the page
 * background. Keeps its own Register CTA + OAuth row even though the
 * topbar also has Sign In/Register — that duplication matches the
 * reference's own hero, since a signed-out visitor lands here first. */
export function HeroBanner() {
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
          Land your next role faster
          <br />
          with an AI career coach in your corner.
        </h1>
        <p className="max-w-xl text-base text-hint sm:text-lg">
          Saveur pairs realistic AI mock interviews, coding practice, and resume tools with a personalized roadmap
          and daily job matching — everything you need to go from job search to offer.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <LinkButton href="/register" size="lg">
            Get Started
            <EvaIcon name="arrow-forward-outline" size={16} />
          </LinkButton>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className="text-xs uppercase tracking-wide text-hint">Or Continue With</span>
          <div className="flex flex-wrap items-center gap-3">
            <GoogleButton label="Google" />
            <LinkedInButton label="LinkedIn" />
          </div>
        </div>
      </div>
    </section>
  );
}
