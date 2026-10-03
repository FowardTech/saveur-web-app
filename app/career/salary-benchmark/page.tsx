"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import type { ApiError } from "@/lib/apiClient";
import { getSalaryBenchmark, type SalaryBenchmark } from "@/lib/salaryBenchmarkService";

// Numeric salary benchmark: role + location + experience -> P10-P90 market
// range. Complements Offer Analyzer (which needs an actual offer) and Salary
// Negotiation (a conversational simulator).
export default function SalaryBenchmarkPage() {
  return (
    <Suspense fallback={null}>
      <SalaryBenchmarkInner />
    </Suspense>
  );
}

function SalaryBenchmarkInner() {
  const { t, i18n } = useTranslation();
  const params = useSearchParams();
  const [title, setTitle] = useState(params.get("title") ?? "");
  const [location, setLocation] = useState(params.get("location") ?? "");
  const [years, setYears] = useState(params.get("years") ?? "");
  const [currency, setCurrency] = useState(params.get("currency") ?? "");
  const [salary, setSalary] = useState(params.get("salary") ?? "");
  const [kind, setKind] = useState<"offer" | "current">(params.get("kind") === "offer" ? "offer" : "current");
  const [needsPlan, setNeedsPlan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SalaryBenchmark | null>(null);

  async function run() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setNeedsPlan(false);
    try {
      setResult(
        await getSalaryBenchmark({
          title: title.trim(),
          location: location.trim(),
          years_experience: years ? Number(years) : undefined,
          currency: currency.trim() || undefined,
          your_salary: salary ? Number(salary) : undefined,
          kind: salary ? kind : undefined,
        })
      );
    } catch (e) {
      if ((e as ApiError).status === 402) {
        setNeedsPlan(true);
        setLoading(false);
        return;
      }
      setError((e as ApiError).message || t("common:somethingWentWrong", { defaultValue: "Something went wrong. Please try again." }));
    } finally {
      setLoading(false);
    }
  }

  const fmt = (n: number, cur: string) => {
    try {
      return new Intl.NumberFormat(i18n.language, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${cur} ${Math.round(n).toLocaleString(i18n.language)}`;
    }
  };

  const pc = result?.percentiles;
  const span = pc ? Math.max(pc.p90 - pc.p10, 1) : 1;
  const pos = (v: number) => (pc ? `${((v - pc.p10) / span) * 100}%` : "0%");
  const rows: { key: keyof SalaryBenchmark["percentiles"]; label: string }[] = [
    { key: "p10", label: t("web:salaryBenchmark.p10", { defaultValue: "Low (10th percentile)" }) },
    { key: "p25", label: t("web:salaryBenchmark.p25", { defaultValue: "25th percentile" }) },
    { key: "p50", label: t("web:salaryBenchmark.p50", { defaultValue: "Typical (median)" }) },
    { key: "p75", label: t("web:salaryBenchmark.p75", { defaultValue: "75th percentile" }) },
    { key: "p90", label: t("web:salaryBenchmark.p90", { defaultValue: "High (90th percentile)" }) },
  ];

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-10">
          <PageHeader
            title={t("web:salaryBenchmark.title", { defaultValue: "Salary Benchmark" })}
            subtitle={t("web:salaryBenchmark.subtitle", { defaultValue: "See the market pay range for any role, location and experience level." })}
          />
          <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label={t("web:salaryBenchmark.role", { defaultValue: "Job title" })} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("web:salaryBenchmark.rolePlaceholder", { defaultValue: "e.g. Product Manager" })} />
              <TextField label={t("web:salaryBenchmark.location", { defaultValue: "Location" })} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("web:salaryBenchmark.locationPlaceholder", { defaultValue: "e.g. Lagos, Nigeria" })} />
              <TextField label={t("web:salaryBenchmark.years", { defaultValue: "Years of experience" })} type="number" value={years} onChange={(e) => setYears(e.target.value)} />
              <TextField label={t("web:salaryBenchmark.currency", { defaultValue: "Currency (optional)" })} value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="USD" />
            </div>
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <span className="text-sm font-medium text-primary">{t("web:salaryBenchmark.compareTitle", { defaultValue: "Compare your own number (optional)" })}</span>
              <div className="flex flex-wrap gap-2">
                <Pill selected={kind === "offer"} onClick={() => setKind("offer")}>{t("web:salaryBenchmark.kindOffer", { defaultValue: "A job offer" })}</Pill>
                <Pill selected={kind === "current"} onClick={() => setKind("current")}>{t("web:salaryBenchmark.kindCurrent", { defaultValue: "My current pay" })}</Pill>
              </div>
              <TextField label={t("web:salaryBenchmark.yourSalary", { defaultValue: "Yearly base salary" })} type="number" value={salary} onChange={(e) => setSalary(e.target.value)} />
              {needsPlan && (
                <p className="text-sm text-hint">
                  {t("web:salaryBenchmark.needsPlan", { defaultValue: "Comparing your own number is available on paid plans." })}{" "}
                  <Link href="/subscription" className="font-medium text-link hover:underline">{t("web:salaryBenchmark.upgrade", { defaultValue: "Upgrade" })}</Link>
                </p>
              )}
            </div>
            <Button onClick={run} disabled={loading || !title.trim() || !location.trim()} className="w-fit">
              {loading ? t("web:salaryBenchmark.loading", { defaultValue: "Estimating…" }) : t("web:salaryBenchmark.run", { defaultValue: "Get salary range" })}
            </Button>
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>

          {result && pc && (
            <div className="flex flex-col gap-5 rounded-card border border-border bg-surface-2 p-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-hint">{t("web:salaryBenchmark.typical", { defaultValue: "Typical yearly base" })}</p>
                <p className="text-3xl font-bold text-primary">{fmt(pc.p50, result.currency)}</p>
                <p className="text-sm text-hint">
                  {fmt(pc.p10, result.currency)} – {fmt(pc.p90, result.currency)}
                </p>
              </div>
              {result.position && result.your_salary != null && (
                <div className="rounded-lg bg-surface-3 p-3 text-sm text-primary">
                  <p className="font-bold">
                    {result.kind === "offer" ? t("web:salaryBenchmark.yourOffer", { defaultValue: "Your offer" }) : t("web:salaryBenchmark.yourPay", { defaultValue: "Your pay" })}: {fmt(result.your_salary, result.currency)} ·{" "}
                    {t(`web:salaryBenchmark.position_${result.position}`, { defaultValue: result.position.replace(/_/g, " ") })}
                  </p>
                  {result.gap_pct != null && <p className="text-hint">{Math.abs(result.gap_pct)}% {result.gap_pct >= 0 ? t("web:salaryBenchmark.belowMedian", { defaultValue: "below the median" }) : t("web:salaryBenchmark.aboveMedian", { defaultValue: "above the median" })}</p>}
                  {result.suggested_ask != null && <p>{t("web:salaryBenchmark.suggestedAsk", { defaultValue: "Suggested ask" })}: <strong>{fmt(result.suggested_ask, result.currency)}</strong></p>}
                </div>
              )}
              <div className="relative h-3 rounded-full bg-surface-3">
                <div className="absolute inset-y-0 rounded-full bg-surface-4" style={{ left: pos(pc.p25), width: `${((pc.p75 - pc.p25) / span) * 100}%` }} />
                <div className="absolute -top-1 h-5 w-1 rounded bg-solid" style={{ left: pos(pc.p50) }} />
                {result.your_salary != null && (
                  <div className="absolute -top-2 h-7 w-1 rounded bg-danger" style={{ left: `${Math.max(0, Math.min(100, ((result.your_salary - pc.p10) / span) * 100))}%` }} />
                )}
              </div>
              <div className="flex flex-col divide-y divide-border">
                {rows.map((r) => (
                  <div key={r.key} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-hint">{r.label}</span>
                    <span className="font-semibold text-primary">{fmt(pc[r.key], result.currency)}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-hint">
                {t("web:salaryBenchmark.confidence", { defaultValue: "Confidence" })}: {t(`web:salaryBenchmark.confidence_${result.confidence}`, { defaultValue: result.confidence })}
              </p>
              {result.factors.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-bold text-primary">{t("web:salaryBenchmark.factors", { defaultValue: "What moves this number" })}</h3>
                  {result.factors.map((f, i) => (
                    <p key={i} className="text-sm text-primary">
                      <strong>{f.effect === "raises" ? "↑" : "↓"} {f.name}:</strong> {f.detail}
                    </p>
                  ))}
                </div>
              )}
              {result.negotiation_tip && <p className="rounded-lg bg-surface-3 p-3 text-sm text-primary">{result.negotiation_tip}</p>}
              {result.caveat && <p className="text-xs text-hint">{result.caveat}</p>}
              <div className="flex gap-4 text-sm">
                <Link href="/career/salary-negotiation" className="font-medium text-link hover:underline">{t("web:salaryBenchmark.toNegotiation", { defaultValue: "Practice negotiating" })}</Link>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
