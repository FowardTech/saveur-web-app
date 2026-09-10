"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, LinkButton } from "@/components/ui/Button";
import { Pill, PillCard } from "@/components/ui/Pill";
import { EvaIcon, type EvaIconName } from "@/components/icons/EvaIcon";
import { CompanyLogoAvatar } from "@/components/practice/CompanyLogoAvatar";
import { useAuth } from "@/app/providers/AuthProvider";
import apiClient, { type ApiError } from "@/lib/apiClient";
import { getAppConfig } from "@/lib/appConfigService";
import * as billingService from "@/lib/billingService";
import { searchCompany, type CompanySearchResult } from "@/lib/companySearchService";
import { COMPANY_ANY, companiesForCountries, guessCompanyLogoUrl } from "@/lib/companyData";
import { INTERVIEW_TYPES, interviewTypeFromSlug, interviewTypeSlug } from "@/lib/interviewData";

// Real backend contract — ported from mobile's services/interviewService.ts
// (TYPE_TO_WIRE/MODE_TO_WIRE/DIFFICULTY_TO_WIRE) and
// src/practice/MockInterviewSetup.tsx (the actual setup wizard this page was
// missing entirely — see constants/Data.ts for the source pill data).
//   POST /api/v1/interviews/sessions -> {id, type, role, company, difficulty,
//     mode, status, first_question?, question_id?}
const PRACTICE_MODES: { mode: "Voice" | "Text" | "Video"; icon: EvaIconName; description: string }[] = [
  { mode: "Voice", icon: "phone-call-outline", description: "Speak your answers, get spoken feedback" },
  { mode: "Text", icon: "edit-2-outline", description: "Type your answers at your own pace" },
  { mode: "Video", icon: "video-outline", description: "Practice on camera like a real interview" },
];

const DIFFICULTIES: Array<"Beginner" | "Intermediate" | "Advanced"> = ["Beginner", "Intermediate", "Advanced"];
const DURATION_OPTIONS_MIN = [15, 30, 45, 60];
const FREE_SESSIONS_PER_MONTH = 5;

interface InterviewPersona {
  id: string;
  enabled: boolean;
  name: string;
  description: string;
  icon: string;
}

interface SessionResult {
  id: string;
  type: string;
  role?: string;
  company?: string;
  first_question?: string;
}

function MockInterviewSetupInner() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const searchParams = useSearchParams();

  // Pro Premium / Pro (Yearly) only — same gate mobile's isPremium applies
  // to Video mode + the persona picker (see entitlementsService.ts's
  // isPremiumTier). The web profile type declares subscriptionTier as
  // "free" | "premium" | "premium_plus"; checking both non-free-highest
  // values keeps this correct regardless of which one the backend actually
  // sends for that tier.
  const isPremium = profile?.subscriptionTier === "premium" || profile?.subscriptionTier === "premium_plus";
  const isFreeTier = !profile?.subscriptionTier || profile.subscriptionTier === "free";

  const [mode, setMode] = useState<"Voice" | "Text" | "Video">("Voice");
  // Prefills from the Practice hub's "Interview Types" quick grid (app/
  // practice/page.tsx, ?type=<slug>) — mirrors mobile's FindScreen.tsx
  // typesGrid jumping straight into MockInterviewSetup with a type
  // pre-selected instead of always defaulting to Behavioral.
  const [interviewType, setInterviewType] = useState(() => interviewTypeFromSlug(searchParams.get("type")) ?? INTERVIEW_TYPES[0]);
  const [role, setRole] = useState("");
  const [difficulty, setDifficulty] = useState<"Beginner" | "Intermediate" | "Advanced">("Intermediate");
  const [durationMin, setDurationMin] = useState(30);
  const [videoGateNotice, setVideoGateNotice] = useState(false);

  // ---- Company picker (region-aware — see lib/companyData.ts) ----
  const regionCompanies = useMemo(() => companiesForCountries(profile?.preferredCountries), [profile?.preferredCountries]);
  const [company, setCompany] = useState<string | undefined>(undefined);
  const [companySearch, setCompanySearch] = useState("");
  const [customCompanies, setCustomCompanies] = useState<CompanySearchResult[]>([]);
  const customCompanyLogos = useMemo(() => {
    const map: Record<string, string> = {};
    customCompanies.forEach((c) => {
      if (c.logoUrl) map[c.name.toLowerCase()] = c.logoUrl;
    });
    return map;
  }, [customCompanies]);

  type AiCompanySearchState = "idle" | "searching" | "confirming" | "not_found";
  const [aiSearchState, setAiSearchState] = useState<AiCompanySearchState>("idle");
  const [aiSearchResult, setAiSearchResult] = useState<CompanySearchResult | null>(null);
  useEffect(() => {
    setAiSearchState("idle");
    setAiSearchResult(null);
  }, [companySearch]);

  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    const combined = [
      ...regionCompanies,
      ...customCompanies.map((c) => c.name).filter((name) => !regionCompanies.some((r) => r.toLowerCase() === name.toLowerCase())),
    ];
    const list = query ? combined.filter((name) => name.toLowerCase().includes(query)) : combined;
    return [...list, COMPANY_ANY];
  }, [companySearch, regionCompanies, customCompanies]);

  const hasNoLocalMatch = companySearch.trim().length > 0 && filteredCompanies.every((name) => name === COMPANY_ANY);

  async function onSearchCompanyOnline() {
    const query = companySearch.trim();
    if (!query || aiSearchState === "searching") return;
    setAiSearchState("searching");
    const result = await searchCompany(query);
    if (result) {
      setAiSearchResult(result);
      setAiSearchState("confirming");
    } else {
      setAiSearchResult(null);
      setAiSearchState("not_found");
    }
  }

  function onConfirmAiCompanyYes() {
    if (!aiSearchResult) return;
    setCustomCompanies((prev) => (prev.some((c) => c.name.toLowerCase() === aiSearchResult.name.toLowerCase()) ? prev : [...prev, aiSearchResult]));
    setCompany(aiSearchResult.name);
    setCompanySearch("");
    setAiSearchState("idle");
    setAiSearchResult(null);
  }

  function onConfirmAiCompanyNo() {
    setAiSearchResult(null);
    setAiSearchState("not_found");
  }

  // ---- AI Interview Laboratory personas (optional, Premium-only) ----
  const [personas, setPersonas] = useState<InterviewPersona[]>([]);
  const [laboratoryEnabled, setLaboratoryEnabled] = useState(false);
  const [persona, setPersona] = useState<string | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const config = await getAppConfig(i18n.language);
      if (cancelled) return;
      const flags = config.feature_flags as { interview_laboratory?: boolean } | undefined;
      const laboratory = config.interview_personas as { items?: InterviewPersona[] } | undefined;
      setLaboratoryEnabled(!!flags?.interview_laboratory);
      setPersonas((laboratory?.items ?? []).filter((p) => p.enabled));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);
  const showPersonaPicker = laboratoryEnabled && personas.length > 0 && isPremium;

  // ---- Add-on gating (Coding Practice) + free-session cap banner ----
  const [unlockedAddonCodes, setUnlockedAddonCodes] = useState<string[] | null>(null);
  const [remainingFreeSessions, setRemainingFreeSessions] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const addons = await billingService.listAddons();
        if (!cancelled) setUnlockedAddonCodes(addons.filter((a) => a.unlocked).map((a) => a.code));
      } catch {
        if (!cancelled) setUnlockedAddonCodes([]);
      }
      if (isFreeTier) {
        try {
          const sessions = await apiClient.get<{ started_at: string }[]>("/api/v1/interviews/sessions");
          if (cancelled) return;
          const now = new Date();
          const usedThisMonth = sessions.filter((s) => {
            const d = new Date(s.started_at);
            return !Number.isNaN(d.getTime()) && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
          }).length;
          setRemainingFreeSessions(Math.max(0, FREE_SESSIONS_PER_MONTH - usedThisMonth));
        } catch {
          if (!cancelled) setRemainingFreeSessions(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFreeTier]);

  const requiredAddonCode = billingService.addonCodeForInterviewType(interviewType.label);
  const selectedTypeAddonOwned = requiredAddonCode ? !!unlockedAddonCodes?.includes(requiredAddonCode) : false;

  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addonRequiredNotice, setAddonRequiredNotice] = useState<string | null>(null);
  const [upgradeRequiredNotice, setUpgradeRequiredNotice] = useState(false);
  const [session, setSession] = useState<SessionResult | null>(null);

  function onSelectMode(next: "Voice" | "Text" | "Video") {
    if (next === "Video" && !isPremium) {
      setVideoGateNotice(true);
      return;
    }
    setVideoGateNotice(false);
    setMode(next);
  }

  function labelFor(label: string) {
    return t(`web:practice.mockInterviews.types.${interviewTypeSlug(label)}`, { defaultValue: label });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isStarting) return;
    setError(null);
    setAddonRequiredNotice(null);
    setUpgradeRequiredNotice(false);

    if (mode === "Video" && !isPremium && interviewType.label !== "Coding") {
      setVideoGateNotice(true);
      return;
    }
    if (!role.trim()) {
      setError(t("web:practice.mockInterviews.targetRoleRequired", { defaultValue: "Let us know what role you're practicing for so questions can be tailored to it." }));
      return;
    }

    setIsStarting(true);
    try {
      // Paid Add-on gate (Coding Practice) — checked before the free-session
      // cap, same order/reasoning as mobile's onStart: an owned add-on
      // skips the shared monthly pool entirely instead of needing headroom
      // in it on top of already being paid for.
      if (requiredAddonCode && !selectedTypeAddonOwned) {
        setAddonRequiredNotice(
          t("web:practice.mockInterviews.addonRequired", {
            defaultValue: "{{type}} is a paid add-on — purchase it once to unlock it for good.",
            type: interviewType.label,
          })
        );
        return;
      }

      if (!selectedTypeAddonOwned && isFreeTier && remainingFreeSessions !== null && remainingFreeSessions <= 0) {
        setUpgradeRequiredNotice(true);
        return;
      }

      const payload = {
        type: interviewType.wire,
        role: role.trim(),
        company,
        difficulty: difficulty.toLowerCase(),
        duration_min: durationMin,
        mode: mode.toLowerCase(),
        language: i18n.language || "en",
        persona,
      };
      const data = await apiClient.post<{
        id?: string | number;
        session_id?: string | number;
        type: string;
        role?: string;
        company?: string;
        first_question?: string;
      }>("/api/v1/interviews/sessions", payload);
      setSession({
        id: String(data.id ?? data.session_id ?? ""),
        type: data.type,
        role: data.role,
        company: data.company,
        first_question: data.first_question,
      });
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr.message || t("web:practice.mockInterviews.startFailedDefault", { defaultValue: "Couldn't start a session. Please try again." }));
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:practice.mockInterviews.title", { defaultValue: "Mock Interview" })}
            subtitle={t("web:practice.mockInterviews.subtitle", { defaultValue: "Set up a session and practice with an AI interviewer." })}
          />

          {!session && isFreeTier && remainingFreeSessions !== null && !selectedTypeAddonOwned && (
            <Link
              href="/subscription"
              className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface-2 px-4 py-3 transition hover:border-brand/50"
            >
              <div className="flex items-center gap-3">
                <EvaIcon name="flash-outline" size={18} className="text-brand" />
                <p className={`text-sm ${remainingFreeSessions > 0 ? "text-primary" : "text-danger"}`}>
                  {remainingFreeSessions > 0
                    ? t("web:practice.mockInterviews.freeSessionsRemaining", {
                        defaultValue: `${remainingFreeSessions} free session${remainingFreeSessions === 1 ? "" : "s"} left this month`,
                        count: remainingFreeSessions,
                      })
                    : t("web:practice.mockInterviews.freeSessionsUsedUp", { defaultValue: "You've used all your free sessions this month" })}
                </p>
              </div>
              <span className="text-sm font-semibold text-link">{t("web:practice.mockInterviews.upgrade", { defaultValue: "Upgrade" })}</span>
            </Link>
          )}

          {!session && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-8">
              {interviewType.label !== "Coding" && (
                <section className="flex flex-col gap-3">
                  <h2 className="text-sm font-semibold text-hint">{t("web:practice.mockInterviews.chooseMode", { defaultValue: "Choose mode" })}</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {PRACTICE_MODES.map((item) => (
                      <PillCard
                        key={item.mode}
                        selected={item.mode === mode}
                        locked={item.mode === "Video" && !isPremium}
                        icon={item.icon}
                        title={t(`web:practice.mockInterviews.modes.${item.mode.toLowerCase()}`, { defaultValue: item.mode })}
                        description={t(`web:practice.mockInterviews.modeDescriptions.${item.mode.toLowerCase()}`, { defaultValue: item.description })}
                        onClick={() => onSelectMode(item.mode)}
                      />
                    ))}
                  </div>
                  {videoGateNotice && (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border p-3 text-sm text-hint">
                      <span>
                        {t("web:practice.mockInterviews.videoPremiumGate", {
                          defaultValue: "Practicing on camera with video analysis needs Saveur Premium or Premium (Yearly).",
                        })}
                      </span>
                      <LinkButton href="/subscription" size="sm" variant="outline">
                        {t("web:practice.mockInterviews.upgradeToPremium", { defaultValue: "Upgrade to Premium" })}
                      </LinkButton>
                    </div>
                  )}
                </section>
              )}

              <section className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-hint">{t("web:practice.mockInterviews.interviewType", { defaultValue: "Interview type" })}</h2>
                <div className="flex flex-wrap gap-2">
                  {INTERVIEW_TYPES.map((item) => (
                    <Pill key={item.wire} selected={item.wire === interviewType.wire} icon={item.icon} onClick={() => setInterviewType(item)}>
                      {labelFor(item.label)}
                    </Pill>
                  ))}
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-hint">{t("web:practice.mockInterviews.targetRoleLabel", { defaultValue: "Target role" })}</h2>
                <p className="text-xs text-hint">{t("web:practice.mockInterviews.targetRoleDescription", { defaultValue: "What role are you interviewing for? Used to tailor your questions." })}</p>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder={t("web:practice.mockInterviews.targetRolePlaceholder", { defaultValue: "e.g. Software Engineer" })}
                  className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </section>

              <section className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-hint">{t("web:practice.mockInterviews.difficultyLabel", { defaultValue: "Difficulty" })}</h2>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTIES.map((item) => (
                    <Pill key={item} selected={item === difficulty} onClick={() => setDifficulty(item)}>
                      {t(`web:practice.difficulty.${item.toLowerCase()}`, { defaultValue: item })}
                    </Pill>
                  ))}
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-hint">{t("web:practice.mockInterviews.companyLabel", { defaultValue: "Company (optional)" })}</h2>
                <p className="text-xs text-hint">{t("web:practice.mockInterviews.companyDescription", { defaultValue: "Get a company-flavored intro on your questions." })}</p>
                <div className="relative">
                  <EvaIcon name="search-outline" size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-hint" />
                  <input
                    value={companySearch}
                    onChange={(e) => setCompanySearch(e.target.value)}
                    placeholder={t("web:practice.mockInterviews.searchCompany", { defaultValue: "Search companies…" })}
                    className="w-full rounded-lg border border-border bg-surface-1 py-2.5 pl-9 pr-3.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {filteredCompanies.map((name) => {
                    const active = name === COMPANY_ANY ? company === undefined : company === name;
                    const isRealCompany = name !== COMPANY_ANY;
                    return (
                      <Pill
                        key={name}
                        selected={active}
                        onClick={() => setCompany(name === COMPANY_ANY ? undefined : name)}
                        leading={
                          isRealCompany ? (
                            <CompanyLogoAvatar logoUrl={customCompanyLogos[name.toLowerCase()] ?? guessCompanyLogoUrl(name)} companyName={name} size={16} />
                          ) : undefined
                        }
                      >
                        {name}
                      </Pill>
                    );
                  })}
                </div>

                {hasNoLocalMatch && (
                  <div className="mt-1">
                    {aiSearchState === "confirming" && aiSearchResult ? (
                      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-4">
                        <div className="flex items-center gap-2.5">
                          <CompanyLogoAvatar logoUrl={aiSearchResult.logoUrl} companyName={aiSearchResult.name} size={28} />
                          <span className="font-semibold text-primary">{aiSearchResult.name}</span>
                        </div>
                        <p className="text-sm text-hint">{t("web:practice.mockInterviews.aiCompanyConfirmQuestion", { defaultValue: "Is this the company you're looking for?" })}</p>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" className="flex-1" onClick={onConfirmAiCompanyYes}>
                            {t("common:yes", { defaultValue: "Yes" })}
                          </Button>
                          <Button type="button" size="sm" variant="outline" className="flex-1" onClick={onConfirmAiCompanyNo}>
                            {t("common:no", { defaultValue: "No" })}
                          </Button>
                        </div>
                      </div>
                    ) : aiSearchState === "not_found" ? (
                      <p className="text-sm text-danger">
                        {t("web:practice.mockInterviews.aiCompanyNotFound", { defaultValue: "Couldn't confirm that company — check the name and spelling, or try searching again." })}
                      </p>
                    ) : (
                      <button
                        type="button"
                        disabled={aiSearchState === "searching"}
                        onClick={onSearchCompanyOnline}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-sm font-medium text-link disabled:opacity-60"
                      >
                        <EvaIcon name="globe-2-outline" size={16} />
                        {aiSearchState === "searching"
                          ? t("web:practice.mockInterviews.aiCompanySearching", { defaultValue: "Searching the web…" })
                          : t("web:practice.mockInterviews.aiCompanySearchCta", { defaultValue: 'Search the web for "{{query}}"', query: companySearch.trim() })}
                      </button>
                    )}
                  </div>
                )}
              </section>

              {showPersonaPicker && (
                <section className="flex flex-col gap-2">
                  <h2 className="text-sm font-semibold text-hint">{t("web:practice.mockInterviews.interviewerPersonality", { defaultValue: "Interviewer Personality" })}</h2>
                  <p className="text-xs text-hint">{t("web:practice.mockInterviews.interviewerPersonalityDescription", { defaultValue: "Practice against a specific interviewer style — the AI Interview Laboratory." })}</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {personas.map((p) => (
                      <PillCard
                        key={p.id}
                        selected={persona === p.id}
                        icon={(p.icon as EvaIconName) || "person-outline"}
                        title={p.name}
                        description={p.description}
                        onClick={() => setPersona(persona === p.id ? undefined : p.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-hint">{t("web:practice.mockInterviews.sessionLength", { defaultValue: "Session Length" })}</h2>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS_MIN.map((min) => (
                    <Pill key={min} selected={min === durationMin} onClick={() => setDurationMin(min)}>
                      {t("web:practice.mockInterviews.minutesUnit", { defaultValue: "{{min}} min", min })}
                    </Pill>
                  ))}
                </div>
              </section>

              {addonRequiredNotice && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border p-3 text-sm text-hint">
                  <span>{addonRequiredNotice}</span>
                  <LinkButton href="/addons" size="sm" variant="outline">
                    {t("web:addons.title", { defaultValue: "Add-ons" })}
                  </LinkButton>
                </div>
              )}
              {upgradeRequiredNotice && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border p-3 text-sm text-hint">
                  <span>
                    {t("web:practice.mockInterviews.freeLimitReachedBody", {
                      defaultValue: "Free plans include {{limit}} practice sessions a month. Upgrade to Basic for unlimited practice.",
                      limit: FREE_SESSIONS_PER_MONTH,
                    })}
                  </span>
                  <LinkButton href="/subscription" size="sm" variant="outline">
                    {t("web:practice.mockInterviews.upgradeToBasic", { defaultValue: "Upgrade to Basic" })}
                  </LinkButton>
                </div>
              )}
              {error && <p className="text-sm text-danger">{error}</p>}

              <Button type="submit" disabled={isStarting} className="w-full">
                {isStarting ? t("web:practice.mockInterviews.startingLabel", { defaultValue: "Starting…" }) : t("web:practice.mockInterviews.startSession", { defaultValue: "Start session" })}
              </Button>
            </form>
          )}

          {session && (
            <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-mint text-tint-mint-text">
                  <EvaIcon name="checkmark-circle-2-outline" size={22} />
                </span>
                <div>
                  <h2 className="font-semibold text-primary">{t("web:practice.mockInterviews.sessionCreated", { defaultValue: "Session created" })}</h2>
                  <p className="text-sm text-hint">
                    {interviewType.label}
                    {session.role ? ` · ${session.role}` : ""}
                    {session.company ? ` · ${session.company}` : ""}
                  </p>
                </div>
              </div>

              {interviewType.label === "Coding" ? (
                <LinkButton href="/practice/coding">{t("web:practice.mockInterviews.goToCodingPractice", { defaultValue: "Go to Coding Practice" })}</LinkButton>
              ) : (
                <>
                  {session.first_question && (
                    <div className="rounded-lg bg-surface-1 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-hint">{t("web:practice.mockInterviews.firstQuestionLabel", { defaultValue: "First question" })}</p>
                      <p className="mt-1.5 text-sm text-primary">{session.first_question}</p>
                    </div>
                  )}
                  <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-hint">
                    {t("web:practice.mockInterviews.livePlaceholder", {
                      defaultValue:
                        "This is where the live interview session would run — real-time Q&A with your AI interviewer, voice/video mode, and instant feedback at the end. That experience is coming to the web app in a future pass; for now, this session is saved to your account the same as a mobile session.",
                    })}
                  </div>
                </>
              )}

              <Button variant="outline" onClick={() => setSession(null)}>
                {t("web:practice.mockInterviews.startAnother", { defaultValue: "Start another session" })}
              </Button>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}

// useSearchParams() requires a Suspense boundary in the app router (same
// pattern as app/auth/linkedin/callback/page.tsx and app/addons/success/page.tsx).
export default function MockInterviewSetupPage() {
  return (
    <Suspense fallback={null}>
      <MockInterviewSetupInner />
    </Suspense>
  );
}
