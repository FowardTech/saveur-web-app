"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useAuth } from "@/app/providers/AuthProvider";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Web port of Saveur (mobile)'s src/more/WhatsNext.tsx — Premium post-offer
// guided journey: negotiation talking points, a pre-start checklist, and a
// 90-day success plan for a specific job offer, all from one AI call. Real
// backend — Saveur-Backend/app/api/post_offer.py:
//   GET    /api/v1/whats-next                          -> {plan: Plan | null}
//   POST   /api/v1/whats-next/generate                  -> Plan (@require_premium)
//   POST   /api/v1/whats-next/checklist/<id>/toggle      -> Plan
//   POST   /api/v1/whats-next/plan-steps/<order>/complete -> Plan
//   DELETE /api/v1/whats-next
//   GET    /api/v1/whats-next/checkin                    -> {checkin: CheckIn | null}
//   POST   /api/v1/whats-next/checkin/<id>/respond        -> {checkin: CheckIn}
interface NegotiationPoint {
  title: string;
  script: string;
}
interface ChecklistItem {
  id: number;
  title: string;
  description: string;
  status: "pending" | "done";
}
interface PlanStep {
  order: number;
  phase: string;
  title: string;
  description: string;
  status: "completed" | "current" | "locked";
}
interface Plan {
  company: string;
  role: string;
  negotiation_points: NegotiationPoint[];
  checklist: ChecklistItem[];
  checklist_done_count: number;
  checklist_total_count: number;
  ninety_day_plan: PlanStep[];
  plan_is_complete: boolean;
}
interface CheckIn {
  id: number;
  week_number: number;
  responded: boolean;
}
interface OfferApplication {
  company: string;
  role: string;
  offer_amount?: number | null;
  offer_currency?: string | null;
}

const stepBadge: Record<PlanStep["status"], string> = {
  completed: "bg-tint-mint text-tint-mint-text",
  current: "bg-brand/10 text-brand",
  locked: "bg-surface-3 text-hint",
};

export default function WhatsNextPage() {
  const { t } = useTranslation();
  const { isPremium } = useAuth();

  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [currentOffer, setCurrentOffer] = useState("");
  const [targetAsk, setTargetAsk] = useState("");
  const [startDate, setStartDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [completingOrder, setCompletingOrder] = useState<number | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);

  const [pendingCheckIn, setPendingCheckIn] = useState<CheckIn | null>(null);
  const [checkInText, setCheckInText] = useState("");
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);

  async function load() {
    try {
      const data = await apiClient.get<{ plan: Plan | null }>("/api/v1/whats-next");
      setPlan(data.plan);
    } catch {
      setPlan(null);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  // Auto-detect a single Offer-stage tracked application and pre-fill the
  // form sheet from it — mirrors mobile's WhatsNext.tsx (does nothing when
  // there are zero or multiple Offer-stage applications).
  useEffect(() => {
    if (plan !== null) return;
    apiClient
      .get<OfferApplication[]>("/api/v1/tracker/applications")
      .then((apps) => {
        const offers = (apps as (OfferApplication & { stage?: string })[]).filter((a) => a.stage === "Offer");
        if (offers.length !== 1) return;
        const offer = offers[0];
        setCompany(offer.company ?? "");
        setRole(offer.role ?? "");
        if (offer.offer_amount != null) setCurrentOffer(`${offer.offer_currency ?? ""} ${offer.offer_amount}`.trim());
        setAutoDetected(true);
      })
      .catch(() => {});
  }, [plan]);

  useEffect(() => {
    if (!plan) return;
    apiClient
      .get<{ checkin: CheckIn | null }>("/api/v1/whats-next/checkin")
      .then((data) => setPendingCheckIn(data.checkin))
      .catch(() => {});
  }, [plan]);

  async function onGenerate() {
    if (!company.trim() || !role.trim() || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const data = await apiClient.post<Plan>("/api/v1/whats-next/generate", {
        company: company.trim(),
        role: role.trim(),
        current_offer: currentOffer.trim(),
        target_ask: targetAsk.trim(),
        start_date: startDate || "",
      });
      setPlan(data);
      setShowForm(false);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || t("web:whatsNext.generateFailedDefault", { defaultValue: "Couldn't build your plan right now. Please try again." }));
    } finally {
      setGenerating(false);
    }
  }

  async function onReset() {
    if (!confirm(t("web:whatsNext.resetConfirm", { defaultValue: "Start over with a new offer? Your current plan will be cleared." }).toString())) return;
    try {
      await apiClient.delete("/api/v1/whats-next");
    } catch {
      // best-effort
    }
    setPlan(null);
    setCompany("");
    setRole("");
    setCurrentOffer("");
    setTargetAsk("");
    setStartDate("");
  }

  async function onToggleChecklistItem(id: number) {
    if (togglingId != null) return;
    setTogglingId(id);
    try {
      const data = await apiClient.post<Plan>(`/api/v1/whats-next/checklist/${id}/toggle`);
      setPlan(data);
    } catch {
      setError(t("web:whatsNext.updateFailedDefault", { defaultValue: "Couldn't update your plan right now. Please try again." }));
    } finally {
      setTogglingId(null);
    }
  }

  async function onCompletePlanStep(order: number) {
    if (completingOrder != null) return;
    setCompletingOrder(order);
    try {
      const data = await apiClient.post<Plan>(`/api/v1/whats-next/plan-steps/${order}/complete`);
      setPlan(data);
    } catch {
      setError(t("web:whatsNext.updateFailedDefault", { defaultValue: "Couldn't update your plan right now. Please try again." }));
    } finally {
      setCompletingOrder(null);
    }
  }

  async function onSubmitCheckIn() {
    if (!pendingCheckIn || !checkInText.trim() || submittingCheckIn) return;
    setSubmittingCheckIn(true);
    try {
      await apiClient.post(`/api/v1/whats-next/checkin/${pendingCheckIn.id}/respond`, { text: checkInText.trim() });
      setPendingCheckIn(null);
      setCheckInText("");
    } catch {
      // best-effort
    } finally {
      setSubmittingCheckIn(false);
    }
  }

  if (plan === undefined) {
    return (
      <RequireAuth>
        <AppShell>
          <div className="mx-auto max-w-2xl">
            <SkeletonRows count={3} />
          </div>
        </AppShell>
      </RequireAuth>
    );
  }

  if (!plan && !isPremium) {
    return (
      <RequireAuth>
        <AppShell>
          <div className="mx-auto flex max-w-2xl flex-col gap-6">
            <PageHeader title={t("web:whatsNext.title", { defaultValue: "What's Next" })} />
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:whatsNext.premiumRequiredTitle", { defaultValue: "What's Next is a Premium feature" })}</h2>
              <p className="text-sm text-hint">
                {t("web:whatsNext.premiumRequiredSubtitle", {
                  defaultValue: "Negotiation talking points, a pre-start checklist, and a plan for settling in and succeeding with your new team.",
                })}
              </p>
            </div>
          </div>
        </AppShell>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
          <PageHeader title={t("web:whatsNext.title", { defaultValue: "What's Next" })} />

          {error && <p className="text-sm text-danger">{error}</p>}

          {pendingCheckIn && (
            <div className="flex flex-col gap-3 rounded-card border border-brand bg-brand/5 p-5">
              <h2 className="font-semibold text-primary">{t("web:whatsNext.checkinTitle", { defaultValue: "How's the new role going?" })}</h2>
              <p className="text-sm text-hint">{t("web:whatsNext.checkinSubtitle", { defaultValue: "Week {{week}} at {{company}} — tell us how it's going.", week: pendingCheckIn.week_number, company: plan?.company ?? "" })}</p>
              <textarea
                rows={3}
                value={checkInText}
                onChange={(e) => setCheckInText(e.target.value)}
                placeholder={t("web:whatsNext.checkinPlaceholder", { defaultValue: "e.g. Settling in well, still learning the codebase, my manager has been great…" }).toString()}
                className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={onSubmitCheckIn} disabled={!checkInText.trim() || submittingCheckIn}>
                  {submittingCheckIn ? t("common:actions.saving", { defaultValue: "Saving…" }) : t("common:save", { defaultValue: "Submit" })}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setPendingCheckIn(null)}>
                  {t("web:whatsNext.checkinDismiss", { defaultValue: "Not now" })}
                </Button>
              </div>
            </div>
          )}

          {!plan ? (
            <div className="flex flex-col items-center gap-4 rounded-card border border-border bg-surface-2 p-8 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="compass-outline" size={26} />
              </span>
              <p className="max-w-sm text-sm text-hint">
                {t("web:whatsNext.description", {
                  defaultValue: "Tell the AI about your offer, and it builds your negotiation talking points, a pre-start checklist, and a plan for navigating your first 90 days.",
                })}
              </p>
              <Button type="button" onClick={() => setShowForm(true)} className="w-full max-w-xs">
                {t("web:whatsNext.getStartedCta", { defaultValue: "Get started" })}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between rounded-card border border-border bg-surface-2 p-5">
                <div>
                  <p className="text-xs text-hint">{t("web:whatsNext.offerLabel", { defaultValue: "Offer" })}</p>
                  <p className="mt-0.5 font-semibold text-primary">{plan.role}</p>
                  <p className="text-sm text-hint">{plan.company}</p>
                </div>
                <button type="button" onClick={onReset} className="text-sm font-medium text-brand hover:underline">
                  {t("web:whatsNext.startOver", { defaultValue: "Start over" })}
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <h2 className="font-semibold text-primary">{t("web:whatsNext.negotiateTitle", { defaultValue: "Negotiate your offer" })}</h2>
                <p className="text-sm text-hint">{t("web:whatsNext.negotiateDescription", { defaultValue: "Concrete talking points for this offer — say them in your own words." })}</p>
                {plan.negotiation_points.map((point, i) => (
                  <div key={i} className="rounded-card border border-border bg-surface-2 p-4">
                    <p className="text-sm font-semibold text-primary">{point.title}</p>
                    <p className="mt-1 text-sm text-hint">{point.script}</p>
                  </div>
                ))}
                <Link href="/career/salary-negotiation" className="w-fit">
                  <Button type="button" variant="outline" size="sm">
                    <EvaIcon name="mic-outline" size={14} />
                    {t("web:whatsNext.practiceThisLive", { defaultValue: "Practice this live" })}
                  </Button>
                </Link>
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="font-semibold text-primary">{t("web:whatsNext.checklistTitle", { defaultValue: "Before you start" })}</h2>
                <p className="text-sm text-hint">{t("web:whatsNext.checklistProgress", { defaultValue: "{{done}} of {{total}} done", done: plan.checklist_done_count, total: plan.checklist_total_count })}</p>
                <div className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface-2">
                  {plan.checklist.map((item) => {
                    const done = item.status === "done";
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={togglingId === item.id}
                        onClick={() => onToggleChecklistItem(item.id)}
                        className="flex items-start gap-3 p-4 text-left disabled:opacity-60"
                      >
                        <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-success-text bg-success-text" : "border-border"}`}>
                          {done && <EvaIcon name="checkmark-outline" size={12} className="text-white" />}
                        </span>
                        <div>
                          <p className={`text-sm font-medium ${done ? "text-hint line-through" : "text-primary"}`}>{item.title}</p>
                          {item.description && <p className="mt-0.5 text-xs text-hint">{item.description}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <h2 className="font-semibold text-primary">{t("web:whatsNext.ninetyDayTitle", { defaultValue: "Your first 90 days" })}</h2>
                <p className="text-sm text-hint">{t("web:whatsNext.ninetyDayDescription", { defaultValue: "A phase-by-phase plan for settling in, working well with your new team, and succeeding in this role." })}</p>

                {plan.plan_is_complete && (
                  <div className="flex items-center gap-2.5 rounded-card bg-tint-mint p-4">
                    <EvaIcon name="award-outline" size={20} className="text-tint-mint-text" />
                    <p className="text-sm font-semibold text-tint-mint-text">{t("web:whatsNext.ninetyDayComplete", { defaultValue: "You've worked through your first 90 days at {{company}}!", company: plan.company })}</p>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {plan.ninety_day_plan.map((step) => (
                    <div key={step.order} className="flex items-start gap-4 rounded-card border border-border bg-surface-2 p-4">
                      <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${stepBadge[step.status]}`}>
                        {step.status === "completed" ? <EvaIcon name="checkmark-outline" size={16} /> : step.status === "locked" ? <EvaIcon name="lock-outline" size={14} /> : step.order}
                      </span>
                      <div className="flex-1">
                        <p className="text-xs text-hint">{step.phase}</p>
                        <p className={`text-sm font-medium ${step.status === "locked" ? "text-hint" : "text-primary"}`}>{step.title}</p>
                        <p className="mt-0.5 text-xs text-hint">{step.description}</p>
                        {step.status === "current" && (
                          <Button type="button" size="sm" className="mt-2" disabled={completingOrder != null} onClick={() => onCompletePlanStep(step.order)}>
                            {completingOrder === step.order ? "…" : t("web:whatsNext.markComplete", { defaultValue: "Mark complete" })}
                          </Button>
                        )}
                        {step.status === "completed" && <p className="mt-1 text-xs font-semibold text-success-text">{t("web:whatsNext.completed", { defaultValue: "Completed" })}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setShowForm(false)}>
            <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-card border border-border bg-surface-2 p-6 sm:rounded-card" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-primary">{t("web:whatsNext.formSheetTitle", { defaultValue: "Tell us about your offer" })}</h2>
                <button type="button" onClick={() => setShowForm(false)} aria-label={t("common:actions.close", { defaultValue: "Close" })}>
                  <EvaIcon name="close-outline" size={20} className="text-hint" />
                </button>
              </div>
              {autoDetected && (
                <p className="mb-4 text-sm text-brand">{t("web:whatsNext.autodetectedNotice", { defaultValue: "Filled in from your Offer-stage application — edit anything below before building your plan." })}</p>
              )}
              <div className="flex flex-col gap-3">
                <TextField label={t("web:whatsNext.companyLabel", { defaultValue: "Company" })} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme Inc." />
                <TextField label={t("web:whatsNext.roleLabel", { defaultValue: "Role" })} value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Senior Product Manager" />
                <TextField label={t("web:whatsNext.currentOfferLabel", { defaultValue: "Your current offer (optional)" })} value={currentOffer} onChange={(e) => setCurrentOffer(e.target.value)} placeholder="e.g. $115k base + $10k signing bonus" />
                <TextField label={t("web:whatsNext.targetAskLabel", { defaultValue: "What you'd like to negotiate for (optional)" })} value={targetAsk} onChange={(e) => setTargetAsk(e.target.value)} placeholder="e.g. $130k base, or more PTO" />
                <TextField label={t("web:whatsNext.startDateLabel", { defaultValue: "Start date (optional)" })} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="mt-5 flex flex-col gap-2">
                <Button type="button" onClick={onGenerate} disabled={!company.trim() || !role.trim() || generating}>
                  {generating ? t("common:actions.generating", { defaultValue: "Generating…" }) : t("web:whatsNext.buildCta", { defaultValue: "Build my plan" })}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={generating}>
                  {t("common:cancel", { defaultValue: "Cancel" })}
                </Button>
              </div>
            </div>
          </div>
        )}
      </AppShell>
    </RequireAuth>
  );
}
