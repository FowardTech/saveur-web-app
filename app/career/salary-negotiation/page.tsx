"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
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

function formatOffer(offer: Offer) {
  const parts = [`Base ${offer.currency} ${offer.base.toLocaleString()}`];
  if (offer.bonus) parts.push(`Bonus ${offer.currency} ${offer.bonus.toLocaleString()}`);
  if (offer.equity) parts.push(`Equity ${offer.currency} ${offer.equity.toLocaleString()}`);
  return parts.join(" · ");
}

export default function SalaryNegotiationPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proRequired, setProRequired] = useState(false);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [currentOffer, setCurrentOffer] = useState<Offer | null>(null);
  const [ask, setAsk] = useState("");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [sending, setSending] = useState(false);
  const [isFinal, setIsFinal] = useState(false);

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<Scenario>("/api/v1/coach/negotiation/scenario");
      setScenario(data);
      setCurrentOffer(data.offer);
      setRounds([]);
      setIsFinal(false);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setProRequired(true);
      } else {
        setError(apiErr.message || "Couldn't start a negotiation scenario right now.");
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
      const data = await apiClient.post<{ recruiter_response: string; updated_offer: Offer; is_final_round: boolean }>(
        "/api/v1/coach/negotiation",
        {
          offer: currentOffer,
          ask: ask.trim(),
          context: { company: scenario.company, role: scenario.role, level: scenario.level },
        }
      );
      setRounds((prev) => [...prev, { ask: ask.trim(), recruiter_response: data.recruiter_response }]);
      setCurrentOffer(data.updated_offer || currentOffer);
      setIsFinal(Boolean(data.is_final_round));
      setAsk("");
    } catch (err) {
      setError((err as ApiError).message || "Couldn't send that ask right now.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-10">
        <PageHeader title="Salary Negotiation" subtitle="Practice pushing back on an offer with a realistic recruiter simulation." />

        {proRequired && (
          <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
              <EvaIcon name="lock-outline" size={20} />
            </span>
            <h2 className="font-semibold text-primary">Salary Negotiation requires a paid plan</h2>
            <p className="text-sm text-hint">Upgrade your plan to practice negotiation with the AI coach.</p>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        {!scenario && !proRequired && (
          <div className="rounded-card border border-border bg-surface-2 p-6 text-center">
            <p className="text-sm text-hint">Start a scenario to get a realistic offer and practice your ask.</p>
            <Button onClick={handleStart} disabled={loading} className="mt-4">
              {loading ? "Generating scenario…" : "Start negotiation practice"}
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
              <p className="mt-3 text-sm font-medium text-primary">Current offer: {formatOffer(currentOffer)}</p>
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
              <div className="rounded-card border border-dashed border-border p-4 text-center text-sm text-hint">
                This negotiation has reached its final round. Start a new scenario to practice again.
              </div>
            ) : (
              <form onSubmit={handleSend} className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <TextField
                    label="Your ask"
                    placeholder="e.g. Could we move the base to $175,000?"
                    value={ask}
                    onChange={(e) => setAsk(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={sending || !ask.trim()}>
                  {sending ? "Sending…" : "Send"}
                </Button>
              </form>
            )}

            <Button variant="outline" onClick={handleStart} className="w-fit">
              Start a new scenario
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
