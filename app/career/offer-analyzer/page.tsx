"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Offer/Salary Analyzer (product request: "See the Salary analyser too"
// [resume.io's /app/offer-analyzer-result]). Deliberately a SEPARATE page
// from app/career/salary-negotiation/page.tsx (a conversational,
// round-based recruiter-pushback simulator) -- this is a one-shot numeric
// calculator: enter your offer, get a fair-market range and a specific
// counter number. They're complementary, not redundant -- this page's own
// result links into Salary Negotiation to practice the actual
// conversation once you have a number to anchor on. Real backend contract
// -- Saveur-Backend/app/api/offer_analyzer.py:
//   POST /api/v1/offer-analyzer/analyze -> {fair_market_range:{low,mid,high,currency},
//     suggested_counter, offer_assessment, rationale, negotiation_tip}
//   body: {job_title, location, years_experience?, offered_salary, benefits?, currency?, language}
// Gated behind @require_pro, same as Salary Negotiation.
interface FairMarketRange {
  low: number | null;
  mid: number | null;
  high: number | null;
  currency: string;
}

type OfferAssessment = "below_market" | "at_market" | "above_market";

interface AnalyzerResult {
  fair_market_range?: FairMarketRange;
  suggested_counter?: number | null;
  offer_assessment?: OfferAssessment;
  rationale?: string;
  negotiation_tip?: string;
}

const ASSESSMENT_STYLE: Record<OfferAssessment, string> = {
  below_market: "bg-danger/10 text-danger",
  at_market: "bg-tint-orange text-tint-orange-text",
  above_market: "bg-tint-mint text-tint-mint-text",
};

export default function OfferAnalyzerPage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [offeredSalary, setOfferedSalary] = useState("");
  const [benefits, setBenefits] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proRequired, setProRequired] = useState(false);
  const [result, setResult] = useState<AnalyzerResult | null>(null);

  const canAnalyze = jobTitle.trim() && location.trim() && offeredSalary.trim() && !loading;

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!canAnalyze) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiClient.post<AnalyzerResult>("/api/v1/offer-analyzer/analyze", {
        job_title: jobTitle.trim(),
        location: location.trim(),
        years_experience: yearsExperience.trim() ? Number(yearsExperience) : undefined,
        offered_salary: Number(offeredSalary),
        benefits: benefits.trim(),
      });
      setResult(data);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setProRequired(true);
      } else {
        setError(apiErr.message || t("web:career.offerAnalyzer.analyzeFailedDefault", { defaultValue: "Couldn't analyze this offer right now. Please try again." }));
      }
    } finally {
      setLoading(false);
    }
  }

  const assessment = result?.offer_assessment || "at_market";
  const fmr = result?.fair_market_range;

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:career.offerAnalyzer.title", { defaultValue: "Offer & Salary Analyzer" })}
            subtitle={t("web:career.offerAnalyzer.subtitle", {
              defaultValue: "Enter your offer details to see a fair-market range and a specific number to counter with.",
            })}
          />

          {proRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:career.offerAnalyzer.proRequiredTitle", { defaultValue: "Offer Analyzer requires a paid plan" })}</h2>
              <p className="text-sm text-hint">{t("web:career.offerAnalyzer.proRequiredSubtitle", { defaultValue: "Upgrade your plan to get a market-rate read on your offer." })}</p>
            </div>
          )}

          {!proRequired && (
            <form onSubmit={handleAnalyze} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
              <TextField
                label={t("web:career.offerAnalyzer.jobTitle", { defaultValue: "Job title" })}
                placeholder={t("web:career.offerAnalyzer.jobTitlePlaceholder", { defaultValue: "e.g. Senior Product Manager" }).toString()}
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
              <TextField
                label={t("web:career.offerAnalyzer.location", { defaultValue: "Location" })}
                placeholder={t("web:career.offerAnalyzer.locationPlaceholder", { defaultValue: "e.g. Austin, TX" }).toString()}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TextField
                  label={t("web:career.offerAnalyzer.yearsExperience", { defaultValue: "Years of experience (optional)" })}
                  type="number"
                  placeholder="4"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                />
                <TextField
                  label={t("web:career.offerAnalyzer.offeredSalary", { defaultValue: "Offered total compensation (USD)" })}
                  type="number"
                  placeholder="105000"
                  value={offeredSalary}
                  onChange={(e) => setOfferedSalary(e.target.value)}
                />
              </div>
              <TextField
                label={t("web:career.offerAnalyzer.benefits", { defaultValue: "Other benefits mentioned (optional)" })}
                placeholder={t("web:career.offerAnalyzer.benefitsPlaceholder", { defaultValue: "e.g. equity, sign-on bonus, remote" }).toString()}
                value={benefits}
                onChange={(e) => setBenefits(e.target.value)}
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" disabled={!canAnalyze} className="mt-2">
                {loading
                  ? t("web:career.offerAnalyzer.analyzing", { defaultValue: "Analyzing…" })
                  : t("web:career.offerAnalyzer.analyzeButton", { defaultValue: "Analyze my offer" })}
              </Button>
            </form>
          )}

          {result && fmr && (
            <div className="rounded-card border border-border bg-surface-2 p-6">
              <p className="text-sm font-medium text-hint">{t("web:career.offerAnalyzer.fairMarketRange", { defaultValue: "Fair market range" })}</p>
              <p className="mt-1 text-3xl font-bold text-primary">
                {fmr.low?.toLocaleString() ?? "—"} – {fmr.high?.toLocaleString() ?? "—"} {fmr.currency}
              </p>

              <span className={`mt-3 inline-flex items-center rounded-pill px-3 py-1 text-xs font-semibold ${ASSESSMENT_STYLE[assessment]}`}>
                {t(`web:career.offerAnalyzer.assessment.${assessment}`, {
                  defaultValue: assessment === "below_market" ? "Below market" : assessment === "above_market" ? "Above market" : "At market",
                })}
              </span>

              {result.suggested_counter != null && (
                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <p className="text-sm text-hint">{t("web:career.offerAnalyzer.suggestedCounter", { defaultValue: "Suggested counter" })}</p>
                  <p className="text-lg font-bold text-primary">
                    {result.suggested_counter.toLocaleString()} {fmr.currency}
                  </p>
                </div>
              )}

              {result.rationale && <p className="mt-4 text-sm text-primary">{result.rationale}</p>}

              {result.negotiation_tip && (
                <div className="mt-4 flex items-start gap-2 rounded-card bg-surface-1 p-3">
                  <EvaIcon name="bulb-outline" size={16} className="mt-0.5 text-brand" />
                  <p className="text-sm text-primary">{result.negotiation_tip}</p>
                </div>
              )}

              <Button
                className="mt-5 w-full"
                onClick={() => router.push(`/career/salary-negotiation?role=${encodeURIComponent(jobTitle.trim())}`)}
              >
                {t("web:career.offerAnalyzer.practiceNegotiation", { defaultValue: "Practice negotiating this offer" })}
              </Button>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
