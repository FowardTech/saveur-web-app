"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { useAuth } from "@/app/providers/AuthProvider";
import type { ApiError } from "@/lib/apiClient";
import * as growth from "@/lib/growthService";
import type { PayRecord, PaySummary, PromotionPlan } from "@/lib/growthService";

// Career Growth — the post-hire loop. Pay tracking over time (free), market
// check + promotion/raise plan (paid), and a quarterly check-in prompt.
type Tab = "pay" | "plan";
const KINDS = ["start", "raise", "promotion", "job_change", "other"];

const fmt = (n?: number | null, cur = "USD") =>
  n == null ? "—" : new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);

export default function CareerGrowthPage() {
  const { t } = useTranslation();
  const { loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("pay");
  const [records, setRecords] = useState<PayRecord[]>([]);
  const [summary, setSummary] = useState<PaySummary>({ count: 0 });
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<false | "pro" | "premium">(false);

  // add-pay form
  const [date, setDate] = useState("");
  const [base, setBase] = useState("");
  const [bonus, setBonus] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [kind, setKind] = useState("start");
  const [saving, setSaving] = useState(false);

  // promotion plan
  const [plan, setPlan] = useState<PromotionPlan | null>(null);
  const [goal, setGoal] = useState("promotion");
  const [curRole, setCurRole] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [tenure, setTenure] = useState("");
  const [context, setContext] = useState("");
  const [planning, setPlanning] = useState(false);

  // quarterly check-in
  const [checkinId, setCheckinId] = useState<number | null>(null);
  const [checkinText, setCheckinText] = useState("");

  const load = useCallback(async () => {
    // Independent loads: the promotion plan is Premium-only, so a Basic user's 402 there
    // must not stop their pay records from loading.
    const [p, pl, c] = await Promise.allSettled([growth.listPay(), growth.getPromotionPlan(), growth.getPendingCheckin()]);
    if (p.status === "fulfilled") {
      setRecords(p.value.records);
      setSummary(p.value.summary);
    } else if ((p.reason as ApiError).status === 402) {
      setPaywall("pro");
    } else {
      setError((p.reason as ApiError).message);
    }
    if (pl.status === "fulfilled") setPlan(pl.value.plan);
    else if ((pl.reason as ApiError).status === 402) setPaywall((cur) => cur || "premium");
    if (c.status === "fulfilled") setCheckinId(c.value.checkin?.id ?? null);
  }, []);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  const err = (e: unknown) => {
    const a = e as ApiError;
    if (a.status === 402 || a.status === 403) setPaywall(a.error === "premium_required" ? "premium" : "pro");
    else setError(a.message || t("common:somethingWentWrong", { defaultValue: "Something went wrong. Please try again." }));
  };

  async function onAddPay() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const r = await growth.addPay({
        effective_date: date,
        base_salary: Number(base),
        bonus: bonus ? Number(bonus) : undefined,
        role: role || undefined,
        company: company || undefined,
        kind,
      });
      setRecords((prev) => [...prev, r.record].sort((a, b) => a.effective_date.localeCompare(b.effective_date)));
      setSummary(r.summary);
      setBase("");
      setBonus("");
    } catch (e) {
      err(e);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number) {
    await growth.deletePay(id).catch(() => undefined);
    load();
  }

  async function onPlan() {
    if (planning || !curRole.trim()) return;
    setPlanning(true);
    setError(null);
    try {
      const r = await growth.makePromotionPlan({
        goal,
        current_role: curRole.trim(),
        target_role: targetRole.trim() || undefined,
        tenure_months: tenure ? Number(tenure) : undefined,
        context: context.trim() || undefined,
      });
      setPlan(r.plan);
    } catch (e) {
      err(e);
    } finally {
      setPlanning(false);
    }
  }

  async function onCheckin() {
    if (!checkinId) return;
    await growth.respondCheckin(checkinId, checkinText).catch(() => undefined);
    setCheckinId(null);
    setCheckinText("");
  }

  const card = "flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-5";
  const textarea =
    "w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-primary focus:outline-none";

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-10">
          <PageHeader
            title={t("web:growth.title", { defaultValue: "Career Growth" })}
            subtitle={t("web:growth.subtitle", { defaultValue: "Track your pay over time, check if you're paid fairly, and prepare for your next raise or promotion." })}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          {paywall && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-4">
              <p className="text-sm text-hint">
                {paywall === "premium"
                  ? t("web:growth.premiumPaywall", { defaultValue: "The market check and promotion plan are Premium features." })
                  : t("web:growth.paywall", { defaultValue: "Pay tracking is available on paid plans." })}
              </p>
              <Link href="/subscription" className="text-sm font-semibold text-link hover:underline">
                {paywall === "premium"
                  ? t("web:growth.upgradePremium", { defaultValue: "Upgrade to Premium" })
                  : t("web:growth.upgrade", { defaultValue: "Upgrade" })}
              </Link>
            </div>
          )}

          {checkinId && (
            <div className={card}>
              <h2 className="font-semibold text-primary">{t("web:growth.checkinTitle", { defaultValue: "Quarterly check-in" })}</h2>
              <p className="text-sm text-hint">{t("web:growth.checkinBody", { defaultValue: "Any new wins, a raise, or a new role since last time? We'll save it to your Career Diary as promotion evidence." })}</p>
              <textarea className={textarea} rows={3} value={checkinText} onChange={(e) => setCheckinText(e.target.value)} />
              <Button onClick={onCheckin} className="w-fit">{t("web:growth.checkinSave", { defaultValue: "Save" })}</Button>
            </div>
          )}

          <div className="flex gap-2">
            <Pill selected={tab === "pay"} onClick={() => setTab("pay")}>{t("web:growth.tabPay", { defaultValue: "Pay tracking" })}</Pill>
            <Pill selected={tab === "plan"} onClick={() => setTab("plan")}>{t("web:growth.tabPlan", { defaultValue: "Raise & promotion plan" })}</Pill>
          </div>

          {tab === "pay" && (
            <>
              {summary.count > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    [t("web:growth.current", { defaultValue: "Current base" }), fmt(summary.current_base, summary.currency)],
                    [t("web:growth.totalGrowth", { defaultValue: "Total growth" }), summary.total_growth_pct != null ? `${summary.total_growth_pct}%` : "—"],
                    [t("web:growth.perYear", { defaultValue: "Per year" }), summary.annualized_growth_pct != null ? `${summary.annualized_growth_pct}%` : "—"],
                    [t("web:growth.sinceChange", { defaultValue: "Months since change" }), String(summary.months_since_last_change ?? "—")],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-card border border-border bg-surface-2 p-4">
                      <p className="text-xs text-hint">{k}</p>
                      <p className="mt-1 text-lg font-bold text-primary">{v}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className={card}>
                <h2 className="font-semibold text-primary">{t("web:growth.logPay", { defaultValue: "Log a pay change" })}</h2>
                <div className="flex flex-wrap gap-2">
                  {KINDS.map((k) => (
                    <Pill key={k} selected={k === kind} onClick={() => setKind(k)}>
                      {t(`web:growth.kind.${k}`, { defaultValue: k.replace("_", " ") })}
                    </Pill>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label={t("web:growth.date", { defaultValue: "Effective date" })} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  <TextField label={t("web:growth.base", { defaultValue: "Base salary (yearly)" })} type="number" value={base} onChange={(e) => setBase(e.target.value)} />
                  <TextField label={t("web:growth.bonus", { defaultValue: "Bonus (optional)" })} type="number" value={bonus} onChange={(e) => setBonus(e.target.value)} />
                  <TextField label={t("web:growth.role", { defaultValue: "Role" })} value={role} onChange={(e) => setRole(e.target.value)} />
                  <TextField label={t("web:growth.company", { defaultValue: "Company" })} value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>
                <Button onClick={onAddPay} disabled={saving || !date || !base} className="w-fit">
                  {t("web:growth.add", { defaultValue: "Add" })}
                </Button>
              </div>

              {records.length > 0 && (
                <div className={card}>
                  {[...records].reverse().map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-primary">{fmt(r.base_salary, r.currency)} <span className="text-hint">· {r.kind.replace("_", " ")}</span></p>
                        <p className="text-xs text-hint">{r.effective_date}{r.role ? ` · ${r.role}` : ""}{r.company ? ` · ${r.company}` : ""}</p>
                      </div>
                      <button type="button" onClick={() => onDelete(r.id)} className="text-xs text-danger hover:underline">
                        {t("common:actions.delete", { defaultValue: "Delete" })}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {records.length > 0 && (
                <div className={card}>
                  <h2 className="font-semibold text-primary">{t("web:growth.marketTitle", { defaultValue: "Am I paid fairly?" })}</h2>
                  <p className="text-sm text-hint">{t("web:growth.marketBody", { defaultValue: "Compare your current pay with the market range for your role." })}</p>
                  <Link
                    href={`/career/salary-benchmark?kind=current&title=${encodeURIComponent(records[records.length - 1]?.role ?? "")}&salary=${summary.current_base ?? ""}&currency=${encodeURIComponent(summary.currency ?? "")}`}
                    className="w-fit rounded-pill bg-solid px-4 py-2.5 text-sm font-semibold text-solid-fg hover:opacity-90"
                  >
                    {t("web:growth.check", { defaultValue: "Check against the market" })}
                  </Link>
                </div>
              )}
            </>
          )}

          {tab === "plan" && (
            <>
              <div className={card}>
                <div className="flex gap-2">
                  <Pill selected={goal === "promotion"} onClick={() => setGoal("promotion")}>{t("web:growth.goalPromotion", { defaultValue: "Promotion" })}</Pill>
                  <Pill selected={goal === "raise"} onClick={() => setGoal("raise")}>{t("web:growth.goalRaise", { defaultValue: "Raise" })}</Pill>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label={t("web:growth.currentRole", { defaultValue: "Current role" })} value={curRole} onChange={(e) => setCurRole(e.target.value)} />
                  <TextField label={t("web:growth.targetRole", { defaultValue: "Target role (optional)" })} value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
                  <TextField label={t("web:growth.tenure", { defaultValue: "Months in this role" })} type="number" value={tenure} onChange={(e) => setTenure(e.target.value)} />
                </div>
                <textarea
                  className={textarea}
                  rows={3}
                  placeholder={t("web:growth.contextPlaceholder", { defaultValue: "Anything else: recent wins, feedback from your manager, company situation…" })}
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                />
                <Button onClick={onPlan} disabled={planning || !curRole.trim()} className="w-fit">
                  {planning ? t("web:growth.planning", { defaultValue: "Building plan…" }) : plan ? t("web:growth.regenerate", { defaultValue: "Regenerate plan" }) : t("web:growth.generate", { defaultValue: "Build my plan" })}
                </Button>
              </div>

              {plan && (
                <div className={card}>
                  {plan.payload.readiness && (
                    <div>
                      <p className="text-sm font-semibold text-primary">
                        {t("web:growth.readiness", { defaultValue: "Readiness" })}: {plan.payload.readiness.score ?? "—"}/100
                      </p>
                      <p className="text-sm text-hint">{plan.payload.readiness.summary}</p>
                    </div>
                  )}
                  {!!plan.payload.evidence?.length && (
                    <div>
                      <p className="text-sm font-semibold text-primary">{t("web:growth.evidence", { defaultValue: "Your evidence" })}</p>
                      <ul className="ml-5 list-disc text-sm text-primary">{plan.payload.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>
                    </div>
                  )}
                  {!!plan.payload.talking_points?.length && (
                    <div>
                      <p className="text-sm font-semibold text-primary">{t("web:growth.talkingPoints", { defaultValue: "What to say" })}</p>
                      {plan.payload.talking_points.map((tp, i) => (
                        <div key={i} className="mt-2 rounded-lg bg-surface-1 p-3 text-sm">
                          <p className="font-medium text-primary">{tp.title}</p>
                          <p className="text-hint">“{tp.script}”</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {!!plan.payload.timeline?.length && (
                    <div>
                      <p className="text-sm font-semibold text-primary">{t("web:growth.timeline", { defaultValue: "Timeline" })}</p>
                      <ul className="ml-5 list-disc text-sm text-primary">{plan.payload.timeline.map((s, i) => <li key={i}><b>{s.when}:</b> {s.action}</li>)}</ul>
                    </div>
                  )}
                  {!!plan.payload.risks?.length && (
                    <div>
                      <p className="text-sm font-semibold text-primary">{t("web:growth.risks", { defaultValue: "Watch out for" })}</p>
                      <ul className="ml-5 list-disc text-sm text-hint">{plan.payload.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
