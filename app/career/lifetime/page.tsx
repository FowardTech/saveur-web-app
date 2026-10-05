"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Hub, Weekly, Brag, Review, Leadership, RolePlay, Pay, Market, Skills, Timeline } from "@/components/lifetime/Sections";

// Career Success Hub — weekly check-in, brag document, review/promotion prep,
// pay & market alerts, market watch, leadership track, skills plan, timeline.
export default function LifetimePage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "hub";
  const [rp, setRp] = useState<{ scenario: string; context: string } | null>(null);

  const titles: Record<string, string> = {
    weekly: t("web:lifetime.weeklyTitle", { defaultValue: "Weekly Check-in" }),
    brag: t("web:lifetime.bragTitle", { defaultValue: "Brag Document" }),
    review: t("web:lifetime.reviewTitle", { defaultValue: "Review & Promotion Prep" }),
    pay: t("web:lifetime.payTitle", { defaultValue: "Pay & Market Alerts" }),
    market: t("web:lifetime.marketTitle", { defaultValue: "Job-market Watch" }),
    leadership: t("web:lifetime.leadershipTitle", { defaultValue: "Leadership Track" }),
    skills: t("web:lifetime.skillsTitle", { defaultValue: "Skills & Certifications" }),
    timeline: t("web:lifetime.timelineTitle", { defaultValue: "Career Timeline" }),
  };
  const go = (next: string) => {
    setRp(null);
    router.push(next === "hub" ? "/career/lifetime" : `/career/lifetime?tab=${next}`);
  };
  const practice = (scenario: string, context: string) => setRp({ scenario, context });

  let body;
  if (rp) body = <RolePlay scenario={rp.scenario} context={rp.context} onExit={() => setRp(null)} />;
  else if (tab === "weekly") body = <Weekly />;
  else if (tab === "brag") body = <Brag />;
  else if (tab === "review") body = <Review onPractice={practice} />;
  else if (tab === "pay") body = <Pay onPractice={practice} />;
  else if (tab === "market") body = <Market />;
  else if (tab === "leadership") body = <Leadership onPractice={practice} />;
  else if (tab === "skills") body = <Skills />;
  else if (tab === "timeline") body = <Timeline />;
  else body = <Hub onOpen={go} />;

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
          {tab !== "hub" && (
            <button type="button" onClick={() => go("hub")} className="self-start text-sm font-semibold text-hint underline">
              ← {t("web:lifetime.hubTitle", { defaultValue: "Career Success Hub" })}
            </button>
          )}
          <PageHeader
            title={rp ? t("web:lifetime.roleplayTitle", { defaultValue: "Practice conversation" }) : titles[tab] ?? t("web:lifetime.hubTitle", { defaultValue: "Career Success Hub" })}
            subtitle={tab === "hub" ? t("web:lifetime.hubIntro", { defaultValue: "Tools for every stage, long after you land the job." }) : undefined}
          />
          {body}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
