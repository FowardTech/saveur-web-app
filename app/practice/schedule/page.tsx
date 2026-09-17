"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, LinkButton } from "@/components/ui/Button";
import { Pill, PillCard } from "@/components/ui/Pill";
import { TextField } from "@/components/ui/TextField";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { CompanyLogoAvatar } from "@/components/practice/CompanyLogoAvatar";
import { useAuth } from "@/app/providers/AuthProvider";
import { searchCompany, type CompanySearchResult } from "@/lib/companySearchService";
import { COMPANY_ANY, companiesForCountries, guessCompanyLogoUrl } from "@/lib/companyData";
import { INTERVIEW_TYPES, PRACTICE_MODES, DIFFICULTIES, DURATION_OPTIONS_MIN, interviewTypeSlug } from "@/lib/interviewData";
import * as scheduledInterviewService from "@/lib/scheduledInterviewService";
import type { DifficultyLabel, PracticeModeLabel } from "@/lib/scheduledInterviewService";

// Ported from mobile's src/practice/ScheduleInterview.tsx — a near-twin of
// app/practice/mock-interviews/page.tsx (same mode/type/role/difficulty/
// company/duration fields, same region-aware company picker + AI search
// fallback) plus a future date+time picker. Sets a real reminder row (see
// lib/scheduledInterviewService.ts for the confirmed backend contract) that
// powers the dashboard's "Upcoming Session" card (app/dashboard/page.tsx) —
// tapping that card later hands every field straight to the Mock Interview
// Setup wizard via the same `?type=`/`?company=`/`?role=` prefill convention
// other deep links on this app already use, so the user just taps Start.
function formatDateInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatTimeInput(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mi}`;
}

// Defaults to an hour from now, rounded to the top of the hour — same
// reasonable "later today" starting point mobile's ScheduleInterview.tsx
// defaults to.
function defaultScheduledAt(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

export default function ScheduleInterviewPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { profile, isPremium } = useAuth();

  const [mode, setMode] = useState<PracticeModeLabel>("Voice");
  const [interviewType, setInterviewType] = useState(() => INTERVIEW_TYPES[0]);
  const [role, setRole] = useState("");
  const [difficulty, setDifficulty] = useState<DifficultyLabel>("Intermediate");
  const [durationMin, setDurationMin] = useState(30);
  const [videoGateNotice, setVideoGateNotice] = useState(false);

  const defaultAt = useMemo(() => defaultScheduledAt(), []);
  const [dateValue, setDateValue] = useState(() => formatDateInput(defaultAt));
  const [timeValue, setTimeValue] = useState(() => formatTimeInput(defaultAt));

  // ---- Company picker (region-aware — see lib/companyData.ts), identical
  // to app/practice/mock-interviews/page.tsx's own picker. ----
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

  function onSelectMode(next: PracticeModeLabel) {
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

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState<scheduledInterviewService.ScheduledInterview | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setError(null);

    if (!role.trim()) {
      setError(t("web:practice.mockInterviews.targetRoleRequired", { defaultValue: "Let us know what role you're practicing for so questions can be tailored to it." }));
      return;
    }
    if (!dateValue || !timeValue) {
      setError(t("web:practice.schedule.dateTimeRequired", { defaultValue: "Pick a date and time for the reminder." }));
      return;
    }
    const scheduledAtDate = new Date(`${dateValue}T${timeValue}`);
    if (Number.isNaN(scheduledAtDate.getTime()) || scheduledAtDate.getTime() <= Date.now()) {
      setError(t("web:practice.schedule.timeInPast", { defaultValue: "The date and time you picked has already passed — pick a future time." }));
      return;
    }

    setIsSaving(true);
    try {
      const created = await scheduledInterviewService.createScheduled({
        interviewTypeLabel: interviewType.label,
        mode,
        difficulty,
        role: role.trim(),
        company,
        durationMin,
        scheduledAt: scheduledAtDate.getTime(),
      });
      setScheduled(created);
    } catch {
      setError(t("web:practice.schedule.scheduleFailed", { defaultValue: "Could not schedule interview. Please try again." }));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:practice.schedule.title", { defaultValue: "Schedule an Interview" })}
            subtitle={t("web:practice.schedule.subtitle", {
              defaultValue: "Set a reminder for a future mock interview — it'll show up on your dashboard until then.",
            })}
          />

          {scheduled ? (
            <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-mint text-tint-mint-text">
                  <EvaIcon name="checkmark-circle-2-outline" size={22} />
                </span>
                <div>
                  <h2 className="font-semibold text-primary">{t("web:practice.schedule.scheduledTitle", { defaultValue: "Interview scheduled" })}</h2>
                  <p className="text-sm text-hint">
                    {labelFor(scheduled.interviewTypeLabel)}
                    {scheduled.role ? ` · ${scheduled.role}` : ""}
                    {scheduled.company ? ` · ${scheduled.company}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-hint">
                    {new Date(scheduled.scheduledAt).toLocaleString(i18n.language, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <LinkButton href="/dashboard" className="flex-1">
                  {t("web:practice.schedule.goToDashboard", { defaultValue: "Go to dashboard" })}
                </LinkButton>
                <Button variant="outline" className="flex-1" onClick={() => router.push("/practice")}>
                  {t("web:practice.schedule.backToPractice", { defaultValue: "Back to Practice" })}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-8">
              <section className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-hint">{t("web:practice.schedule.whenLabel", { defaultValue: "When" })}</h2>
                <div className="flex flex-wrap gap-3">
                  <TextField
                    label={t("web:practice.schedule.dateLabel", { defaultValue: "Date" })}
                    type="date"
                    value={dateValue}
                    min={formatDateInput(new Date())}
                    onChange={(e) => setDateValue(e.target.value)}
                    className="max-w-[200px]"
                  />
                  <TextField
                    label={t("web:practice.schedule.timeLabel", { defaultValue: "Time" })}
                    type="time"
                    value={timeValue}
                    onChange={(e) => setTimeValue(e.target.value)}
                    className="max-w-[160px]"
                  />
                </div>
              </section>

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
                <h2 className="text-sm font-semibold text-hint">
                  {t("web:practice.mockInterviews.targetRoleLabel", { defaultValue: "Target role" })}
                  <span className="ml-0.5 text-danger" aria-hidden="true">*</span>
                </h2>
                <p className="text-xs text-hint">{t("web:practice.mockInterviews.targetRoleDescription", { defaultValue: "What role are you interviewing for? Used to tailor your questions." })}</p>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder={t("web:practice.mockInterviews.targetRolePlaceholder", { defaultValue: "e.g. Software Engineer" })}
                  required
                  aria-required="true"
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

              {error && <p className="text-sm text-danger">{error}</p>}

              <Button type="submit" disabled={isSaving} className="w-full">
                {isSaving ? t("web:practice.schedule.scheduling", { defaultValue: "Scheduling…" }) : t("web:practice.schedule.scheduleCta", { defaultValue: "Schedule interview" })}
              </Button>
            </form>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
