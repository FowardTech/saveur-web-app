"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/coach.py
//   GET  /api/v1/coach/negotiation/scenario -> {company, role, offer:{base,bonus,equity,currency}, location, level, notes}
//   POST /api/v1/coach/negotiation -> {recruiter_response, updated_offer, is_final_round}
//     body: {offer, ask, context}
// Gated behind @require_pro.
interface Offer {
  base: number;
  bonus?: number;
  equity?: number;
  currency: string;
}

interface Scenario {
  company: string;
  role: string;
  offer: Offer;
  location?: string;
  level?: string;
  notes?: string;
}

interface Round {
  ask: string;
  recruiter_response: string;
}

// Mirrors mobile's NegotiationCritique (services/salaryNegotiationService.ts)
// -- POST /api/v1/coach/negotiation/complete
//   body: {initial_offer, final_offer, log:[{round, approach_title, ask, recruiter_response}], language}
//   -> {summary, strengths[], improvements[], total_increase_pct}
interface Critique {
  summary: string;
  strengths: string[];
  improvements: string[];
  totalIncreasePct: number;
}

function toWireOffer(o: Offer, scenario: Scenario | null) {
  return {
    company: scenario?.company,
    title: scenario?.role,
    base_salary: o.base,
    bonus: o.bonus ?? 0,
    equity: o.equity ?? 0,
    currency: o.currency,
  };
}

function formatOffer(offer: Offer, t: TFunction) {
  const parts = [t("web:career.salaryNegotiation.offerBase", { defaultValue: "Base {{currency}} {{amount}}", currency: offer.currency, amount: offer.base.toLocaleString() })];
  if (offer.bonus) parts.push(t("web:career.salaryNegotiation.offerBonus", { defaultValue: "Bonus {{currency}} {{amount}}", currency: offer.currency, amount: offer.bonus.toLocaleString() }));
  if (offer.equity) parts.push(t("web:career.salaryNegotiation.offerEquity", { defaultValue: "Equity {{currency}} {{amount}}", currency: offer.currency, amount: offer.equity.toLocaleString() }));
  return parts.join(" · ");
}

function SalaryNegotiationPageInner() {
  const { t, i18n } = useTranslation();
  const searchParams = useSearchParams();
  // Deep-link overrides from the Dream Company Dashboard's "Practice
  // negotiation" quick action (app/career/dream-companies/page.tsx,
  // ?company=<name>&role=<role>) — mirrors mobile's salaryNegotiationService.
  // getScenario(overrides), which applies these uniformly over whichever
  // source actually generated the scenario (the backend never reads these
  // as request params; the client stamps them onto the result instead).
  const companyOverride = searchParams.get("company");
  const roleOverride = searchParams.get("role");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proRequired, setProRequired] = useState(false);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [currentOffer, setCurrentOffer] = useState<Offer | null>(null);
  const [ask, setAsk] = useState("");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [sending, setSending] = useState(false);
  const [isFinal, setIsFinal] = useState(false);
  const [critique, setCritique] = useState<Critique | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  // Product report: "In the salary negotiation for the web app the web app
  // does not give a final conclusion just like the one in the mobile app."
  // Mobile calls POST /negotiation/complete once the last round lands and
  // renders a Negotiation Summary (summary / what worked / try next time);
  // web only ever showed a plain "final round reached" notice. Falls back
  // to the same local percentage-change sentence mobile uses if the AI
  // call fails, so a transient error never leaves the user with no wrap-up.
  async function finalize(initial: Offer, final: Offer, log: Round[]) {
    setFinalizing(true);
    const totalIncreasePct =
      initial.base > 0 ? Math.round(((final.base - initial.base) / initial.base) * 100) : 0;
    try {
      const data = await apiClient.post<{
        summary?: string;
        strengths?: string[];
        improvements?: string[];
        total_increase_pct?: number;
      }>("/api/v1/coach/negotiation/complete", {
        initial_offer: toWireOffer(initial, scenario),
        final_offer: toWireOffer(final, scenario),
        log: log.map((r, i) => ({ round: i + 1, approach_title: "", ask: r.ask, recruiter_response: r.recruiter_response })),
        language: i18n.language || "en",
      });
      if (!data.summary) throw new Error("empty_critique");
      setCritique({
        summary: data.summary,
        strengths: data.strengths ?? [],
        improvements: data.improvements ?? [],
        totalIncreasePct: data.total_increase_pct ?? totalIncreasePct,
      });
    } catch {
      setCritique({
        summary:
          totalIncreasePct > 0
            ? t("web:career.salaryNegotiation.fallbackSummaryUp", {
                defaultValue: "You negotiated your base salary up by {{pct}}% — from {{from}} to {{to}}.",
                pct: totalIncreasePct,
                from: initial.base.toLocaleString(),
                to: final.base.toLocaleString(),
              })
            : t("web:career.salaryNegotiation.fallbackSummaryFlat", {
                defaultValue: "Your base salary stayed at {{to}}, but you may have picked up extra bonus/equity value along the way.",
                to: final.base.toLocaleString(),
              }),
        strengths: [],
        improvements: [],
        totalIncreasePct,
      });
    } finally {
      setFinalizing(false);
    }
  }

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<Scenario>("/api/v1/coach/negotiation/scenario");
      const scenarioWithOverrides: Scenario = {
        ...data,
        company: companyOverride || data.company,
        role: roleOverride || data.role,
      };
      setScenario(scenarioWithOverrides);
      setCurrentOffer(data.offer);
      setRounds([]);
      setIsFinal(false);
      setCritique(null);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setProRequired(true);
      } else {
        setError(apiErr.message || t("web:career.salaryNegotiation.startFailedDefault", { defaultValue: "Couldn't start a negotiation scenario right now." }));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!ask.trim() || !scenario || !currentOffer) return;
    setSending(true);
    setError(null);
    try {
      // BUG FIX (product report: "look at the chat bubble after the
      // user's own its empty"): this used to read data.recruiter_response
      // as the only possible field name and pass data.updated_offer
      // through untouched. The backend prompt this hits
      // (app_config_service.py's negotiation_system) has at times declared
      // a DIFFERENT updated_offer shape ({baseSalary, signingBonus, ...})
      // than the {base, bonus, equity, currency} shape the rest of this
      // screen uses for `Offer` — an LLM reply that actually followed that
      // older prompt literally would produce a response object neither
      // key name here expected, rendering as an empty bubble with no
      // error (a missing object field silently becomes undefined, not a
      // thrown exception). Mobile's salaryNegotiationService.ts already
      // reads several possible key-name variants defensively for exactly
      // this reason — mirrored here, plus a non-empty fallback line so a
      // genuinely empty/missing reply is never rendered as a blank bubble
      // again, backend prompt fix or not.
      const data = await apiClient.post<{
        recruiter_response?: string;
        response?: string;
        message?: string;
        updated_offer?: Partial<Offer> & { baseSalary?: number; signingBonus?: number };
        is_final_round?: boolean;
      }>("/api/v1/coach/negotiation", {
        offer: currentOffer,
        ask: ask.trim(),
        context: { company: scenario.company, role: scenario.role, level: scenario.level },
      });
      const recruiterResponse =
        data.recruiter_response?.trim() ||
        data.response?.trim() ||
        data.message?.trim() ||
        t("web:career.salaryNegotiation.recruiterResponseFallback", {
          defaultValue: "Let's keep talking — what matters most to you in this offer?",
        }).toString();
      const wireOffer = data.updated_offer;
      const updatedOffer: Offer = wireOffer
        ? {
            base: wireOffer.base ?? wireOffer.baseSalary ?? currentOffer.base,
            bonus: wireOffer.bonus ?? currentOffer.bonus,
            equity: wireOffer.equity ?? currentOffer.equity,
            currency: wireOffer.currency ?? currentOffer.currency,
          }
        : currentOffer;
      const newRound: Round = { ask: ask.trim(), recruiter_response: recruiterResponse };
      setRounds((prev) => [...prev, newRound]);
      setCurrentOffer(updatedOffer);
      setIsFinal(Boolean(data.is_final_round));
      setAsk("");
      if (data.is_final_round && scenario) {
        void finalize(scenario.offer, updatedOffer, [...rounds, newRound]);
      }
    } catch (err) {
      setError((err as ApiError).message || t("web:career.salaryNegotiation.sendFailedDefault", { defaultValue: "Couldn't send that ask right now." }));
    } finally {
      setSending(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:career.salaryNegotiation.title", { defaultValue: "Salary Negotiation" })}
            subtitle={t("web:career.salaryNegotiation.subtitle", { defaultValue: "Practice pushing back on an offer with a realistic recruiter simulation." })}
          />

          {proRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:career.salaryNegotiation.proRequiredTitle", { defaultValue: "Salary Negotiation requires a paid plan" })}</h2>
              <p className="text-sm text-hint">{t("web:career.salaryNegotiation.proRequiredSubtitle", { defaultValue: "Upgrade your plan to practice negotiation with the AI coach." })}</p>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          {!scenario && !proRequired && (
            <div className="rounded-card border border-border bg-surface-2 p-6 text-center">
              <p className="text-sm text-hint">{t("web:career.salaryNegotiation.startPrompt", { defaultValue: "Start a scenario to get a realistic offer and practice your ask." })}</p>
              <Button onClick={handleStart} disabled={loading} className="mt-4">
                {loading ? t("web:career.salaryNegotiation.generatingScenario", { defaultValue: "Generating scenario…" }) : t("web:career.salaryNegotiation.startPractice", { defaultValue: "Start negotiation practice" })}
              </Button>
            </div>
          )}

          {scenario && currentOffer && (
            <div className="flex flex-col gap-4">
              <div className="rounded-card border border-border bg-gradient-to-br from-brand/15 via-accent-purple/10 to-transparent p-5">
                <h2 className="font-semibold text-primary">
                  {scenario.role} at {scenario.company}
                </h2>
                <p className="mt-1 text-sm text-hint">{scenario.location} {scenario.level ? `· ${scenario.level}` : ""}</p>
                <p className="mt-3 text-sm font-medium text-primary">
                  {t("web:career.salaryNegotiation.currentOfferLabel", { defaultValue: "Current offer: {{offer}}", offer: formatOffer(currentOffer, t) })}
                </p>
                {scenario.notes && <p className="mt-2 text-xs text-hint">{scenario.notes}</p>}
              </div>

              {rounds.map((r, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="ml-auto max-w-[85%] rounded-card bg-brand px-4 py-2.5 text-sm text-white">{r.ask}</div>
                  <div className="mr-auto max-w-[85%] rounded-card border border-border bg-surface-2 px-4 py-2.5 text-sm text-primary">
                    {r.recruiter_response}
                  </div>
                </div>
              ))}

              {isFinal ? (
                <div className="rounded-card border border-brand bg-surface-2 p-5">
                  <h3 className="text-lg font-bold text-primary">
                    {t("web:career.salaryNegotiation.summaryTitle", { defaultValue: "Negotiation Summary" })}
                  </h3>
                  {finalizing || !critique ? (
                    <p className="mt-2 text-sm text-hint">
                      {t("web:career.salaryNegotiation.summaryLoading", { defaultValue: "Wrapping up your negotiation…" })}
                    </p>
                  ) : (
                    <>
                      <p className="mt-2 text-sm text-primary">{critique.summary}</p>
                      {critique.strengths.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-primary">
                            {t("web:career.salaryNegotiation.summaryStrengths", { defaultValue: "What worked" })}
                          </p>
                          <ul className="mt-1.5 flex flex-col gap-1.5">
                            {critique.strengths.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-primary">
                                <EvaIcon name="checkmark-circle-2-outline" size={16} className="mt-0.5 shrink-0 text-success-text" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {critique.improvements.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-semibold text-primary">
                            {t("web:career.salaryNegotiation.summaryImprovements", { defaultValue: "Try next time" })}
                          </p>
                          <ul className="mt-1.5 flex flex-col gap-1.5">
                            {critique.improvements.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-primary">
                                <EvaIcon name="arrow-forward-outline" size={16} className="mt-0.5 shrink-0 text-brand" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSend} className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-4 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <TextField
                      label={t("web:career.salaryNegotiation.askLabel", { defaultValue: "Your ask" })}
                      placeholder={t("web:career.salaryNegotiation.askPlaceholder", { defaultValue: "e.g. Could we move the base to $175,000?" })}
                      value={ask}
                      onChange={(e) => setAsk(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={sending || !ask.trim()}>
                    {sending ? t("web:career.salaryNegotiation.sending", { defaultValue: "Sending…" }) : t("web:career.salaryNegotiation.send", { defaultValue: "Send" })}
                  </Button>
                </form>
              )}

              <Button variant="outline" onClick={handleStart} className="w-fit">
                {t("web:career.salaryNegotiation.startNewScenario", { defaultValue: "Start a new scenario" })}
              </Button>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}

// useSearchParams() requires a Suspense boundary in the app router (same
// pattern as app/practice/mock-interviews/page.tsx).
export default function SalaryNegotiationPage() {
  return (
    <Suspense fallback={null}>
      <SalaryNegotiationPageInner />
    </Suspense>
  );
}
