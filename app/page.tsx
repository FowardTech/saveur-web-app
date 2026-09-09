import { AppShell } from "@/components/shell/AppShell";
import { ActionCard } from "@/components/ui/ActionCard";
import { LinkButton } from "@/components/ui/Button";
import { HeroBanner } from "@/components/landing/HeroBanner";
import { CookieBar } from "@/components/landing/CookieBar";
import { WelcomeModal } from "@/components/landing/WelcomeModal";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { quickActions, tintCycle } from "@/lib/navigation";

const statPills = [
  { icon: "mic-outline" as const, label: "10,000+ interviews practiced" },
  { icon: "briefcase-outline" as const, label: "5,000+ jobs matched" },
  { icon: "edit-2-outline" as const, label: "8,500+ resumes built" },
];

const howItWorks = [
  {
    step: "1",
    title: "Tell us where you're headed",
    description: "Share your goals, desired roles, and target countries in a two-minute onboarding.",
    icon: "compass-outline" as const,
  },
  {
    step: "2",
    title: "Practice with your AI coach",
    description: "Run mock interviews, coding drills, and real scenarios — with feedback after every session.",
    icon: "message-circle-outline" as const,
  },
  {
    step: "3",
    title: "Apply with confidence",
    description: "Ship a stronger resume, get daily job alerts, and track your progress on one roadmap.",
    icon: "trending-up-outline" as const,
  },
];

export default function LandingPage() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-6xl flex-col gap-14 pb-16">
        {/* Hero */}
        <div className="pt-6 sm:pt-10">
          <HeroBanner />
        </div>

        {/* Stat pills */}
        <section className="flex flex-wrap gap-3">
          {statPills.map((pill) => (
            <div
              key={pill.label}
              className="flex items-center gap-2 rounded-pill border border-border bg-surface-2 px-4 py-2 text-sm text-primary shadow-sm"
            >
              <EvaIcon name={pill.icon} size={16} className="text-brand" />
              {pill.label}
            </div>
          ))}
        </section>

        {/* Search bar */}
        <section>
          <div className="flex items-center gap-3 rounded-pill border border-border bg-surface-2 px-4 py-3 shadow-sm">
            <EvaIcon name="search-outline" size={18} className="text-hint" />
            <input
              type="text"
              disabled
              placeholder="Search mock interviews, courses, tools…"
              className="w-full bg-transparent text-sm text-primary placeholder:text-hint focus:outline-none"
            />
          </div>
        </section>

        {/* Popular tools */}
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-bold text-primary">Popular Tools</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action, i) => (
              <ActionCard
                key={action.href}
                href={action.href}
                icon={action.icon}
                title={action.label}
                description={action.description}
                tint={tintCycle[i % tintCycle.length]}
              />
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-bold text-primary">How it works</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {howItWorks.map((item) => (
              <div key={item.step} className="rounded-card border border-border bg-surface-2 p-5 shadow-sm">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <EvaIcon name={item.icon} size={18} />
                </span>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-hint">Step {item.step}</p>
                <h3 className="mt-1 font-semibold text-primary">{item.title}</h3>
                <p className="mt-1.5 text-sm text-hint">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="flex flex-col items-center gap-4 rounded-card border border-border bg-gradient-to-br from-brand/10 via-accent-purple/5 to-transparent px-6 py-10 text-center">
          <h2 className="text-2xl font-bold text-primary">Ready to start practicing?</h2>
          <p className="max-w-md text-sm text-hint">
            Create a free account and run your first AI mock interview in minutes.
          </p>
          <LinkButton href="/register" size="lg">
            Create your free account
          </LinkButton>
        </section>
      </div>

      <WelcomeModal />
      <CookieBar />
    </AppShell>
  );
}
