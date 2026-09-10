"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { CompanyLogoAvatar } from "@/components/practice/CompanyLogoAvatar";
import { guessCompanyLogoUrl } from "@/lib/companyData";
import { useAuth } from "@/app/providers/AuthProvider";
import type { ApiError } from "@/lib/apiClient";
import * as dreamCompaniesService from "@/lib/dreamCompaniesService";
import { readinessTier, type DreamCompany } from "@/lib/dreamCompaniesService";

// Dream Company Dashboard — ported from mobile's src/more/DreamCompanies.tsx
// (a persisted, tracked list of target companies, each with cached AI
// research plus real prep-progress: interview sessions actually practiced
// with this company set, and whether it's tracked in Applications). Real
// backend contract confirmed against Saveur-Backend/app/api/dream_companies.py
// — see lib/dreamCompaniesService.ts for the full wire mapping.
//   GET    /api/v1/dream-companies
//   POST   /api/v1/dream-companies              body: {company, role?}
//   POST   /api/v1/dream-companies/<id>/refresh
//   POST   /api/v1/dream-companies/<id>/priority body: {is_top_choice?}
//   POST   /api/v1/dream-companies/<id>/notes    body: {notes}
//   DELETE /api/v1/dream-companies/<id>
// Pro PREMIUM-gated (@require_premium — a step up from the plain-Pro
// Company Intelligence feature this builds on), matching mobile's
// `if (!isPremium) return <ProLockGate variant="premium" .../>`.
const MAX_COMPARE = 3;

function prepLink(basePath: string, company: string, role?: string | null) {
  const params = new URLSearchParams({ company });
  if (role) params.set("role", role);
  return `${basePath}?${params.toString()}`;
}

function shareSummaryText(c: DreamCompany, t: TFunction, notes: string): string {
  const lines: string[] = [
    t("web:career.dreamCompanies.shareTitle", { defaultValue: "{{company}} — Prep Summary", company: c.company }),
  ];
  if (c.targetRole) lines.push(c.targetRole);
  lines.push("");
  lines.push(t("web:career.dreamCompanies.readyPercent", { defaultValue: "{{score}}% ready", score: c.readinessScore }));
  lines.push(
    t("web:career.dreamCompanies.sessionsPracticed", { defaultValue: "{{count}} sessions practiced", count: c.prepProgress.sessionsPracticed })
  );
  if (c.intel?.overview) {
    lines.push("", t("web:career.dreamCompanies.overviewLabel", { defaultValue: "Overview" }), c.intel.overview);
  }
  if (c.intel?.salaryRange) {
    lines.push("", t("web:career.salaryInsights", { defaultValue: "Salary Insights" }), c.intel.salaryRange);
  }
  if (c.intel?.interviewProcess) {
    lines.push("", t("web:career.interviewProcess", { defaultValue: "Interview Process" }), c.intel.interviewProcess);
  }
  if (c.intel?.likelyQuestions?.length) {
    lines.push("", t("web:career.likelyQuestions", { defaultValue: "Likely Interview Questions" }));
    c.intel.likelyQuestions.forEach((q, i) => lines.push(`${i + 1}. ${q}`));
  }
  if (notes.trim()) {
    lines.push("", t("web:career.dreamCompanies.notesLabel", { defaultValue: "My notes" }), notes.trim());
  }
  return lines.join("\n");
}

export default function DreamCompaniesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isPremium, loading: authLoading } = useAuth();

  const [companies, setCompanies] = useState<DreamCompany[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [companyInput, setCompanyInput] = useState("");
  const [roleInput, setRoleInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);
  const [togglingPriorityId, setTogglingPriorityId] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const [savingNotesId, setSavingNotesId] = useState<number | null>(null);
  const [shareCopiedId, setShareCopiedId] = useState<number | null>(null);

  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3500);
  }

  async function load() {
    try {
      const data = await dreamCompaniesService.listDreamCompanies();
      setCompanies(data);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setPremiumRequired(true);
      } else {
        setLoadError(apiErr.message || t("web:career.dreamCompanies.loadFailedDefault", { defaultValue: "Couldn't load your dream companies." }));
      }
    }
  }

  useEffect(() => {
    if (authLoading) return;
    // Intentional fetch-on-mount — load() sets state once its async GET
    // resolves, not synchronously in this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  // Silent background poll while any tracked company's research is still
  // running (add_company returns before research finishes — see
  // app/api/dream_companies.py's research_pending). No loading flash; this
  // just refetches until every card's researchPending clears itself.
  const anyResearchPending = companies?.some((c) => c.researchPending) ?? false;
  useEffect(() => {
    if (!anyResearchPending) return;
    const timer = window.setInterval(async () => {
      try {
        setCompanies(await dreamCompaniesService.listDreamCompanies());
      } catch {
        // best-effort — a failed poll tick just tries again next time
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [anyResearchPending]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = companyInput.trim();
    if (!name || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      const added = await dreamCompaniesService.addDreamCompany(name, roleInput.trim());
      setCompanies((prev) => [...(prev ?? []), added]);
      setCompanyInput("");
      setRoleInput("");
      setExpandedId(added.id);
      setShowAddModal(false);
    } catch (err) {
      setAddError((err as ApiError).message || t("web:career.dreamCompanies.addFailedDefault", { defaultValue: "Couldn't add that company right now." }));
    } finally {
      setAdding(false);
    }
  }

  async function handleRefresh(id: number) {
    if (refreshingId) return;
    setRefreshingId(id);
    try {
      const updated = await dreamCompaniesService.refreshDreamCompany(id);
      setCompanies((prev) => (prev ?? []).map((c) => (c.id === id ? updated : c)));
    } catch {
      // Leave existing cached research in place on a failed refresh.
    } finally {
      setRefreshingId(null);
    }
  }

  async function handleTogglePriority(c: DreamCompany) {
    if (togglingPriorityId) return;
    setTogglingPriorityId(c.id);
    const next = !c.isTopChoice;
    setCompanies((prev) =>
      (prev ?? [])
        .map((row) => (row.id === c.id ? { ...row, isTopChoice: next } : row))
        .sort((a, b) => Number(b.isTopChoice) - Number(a.isTopChoice))
    );
    try {
      await dreamCompaniesService.toggleDreamCompanyPriority(c.id, next);
    } catch {
      setCompanies((prev) =>
        (prev ?? [])
          .map((row) => (row.id === c.id ? { ...row, isTopChoice: !next } : row))
          .sort((a, b) => Number(b.isTopChoice) - Number(a.isTopChoice))
      );
    } finally {
      setTogglingPriorityId(null);
    }
  }

  async function handleRemove(id: number) {
    setCompanies((prev) => (prev ?? []).filter((c) => c.id !== id));
    setCompareIds((prev) => prev.filter((cid) => cid !== id));
    try {
      await dreamCompaniesService.removeDreamCompany(id);
    } catch {
      load(); // resync if the delete actually failed server-side
    }
  }

  async function handleSaveNotes(companyId: number) {
    const notes = notesDraft[companyId] ?? "";
    if (savingNotesId) return;
    setSavingNotesId(companyId);
    try {
      const updated = await dreamCompaniesService.updateDreamCompanyNotes(companyId, notes);
      setCompanies((prev) => (prev ?? []).map((c) => (c.id === companyId ? updated : c)));
    } catch {
      showToast(t("web:career.dreamCompanies.notesSaveFailed", { defaultValue: "Couldn't save your note. Please try again." }));
    } finally {
      setSavingNotesId(null);
    }
  }

  function onToggleCompareSelect(id: number) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((cid) => cid !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  }

  async function onShareSummary(c: DreamCompany) {
    const text = shareSummaryText(c, t, notesDraft[c.id] ?? c.notes);
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share({ text, title: c.company });
        return;
      }
    } catch {
      // User cancelled the native share sheet, or it's unsupported —
      // fall through to the clipboard copy below.
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareCopiedId(c.id);
      window.setTimeout(() => setShareCopiedId((id) => (id === c.id ? null : id)), 2000);
    } catch {
      // Clipboard unavailable — nothing more we can do.
    }
  }

  async function onDrillQuestion(c: DreamCompany, question: string) {
    const message = t("web:career.dreamCompanies.drillQuestionPrompt", {
      defaultValue: 'Let\'s practice this interview question for {{company}}: "{{question}}" Ask me the question, and give me feedback on my answer.',
      company: c.company,
      question,
    });
    try {
      await navigator.clipboard.writeText(message);
      showToast(
        t("web:career.dreamCompanies.drillQuestionCopied", {
          defaultValue: "Copied — paste it into your AI Coach chat to start practicing.",
        })
      );
    } catch {
      // Clipboard unavailable — still navigate, just without the copy.
    }
    router.push("/ai-coach");
  }

  const summary =
    companies && companies.length > 0
      ? {
          tracked: companies.length,
          avgReadiness: Math.round(companies.reduce((sum, c) => sum + c.readinessScore, 0) / companies.length),
          needsPractice: companies.filter((c) => c.readinessScore < 35).length,
        }
      : null;

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-16">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title={t("web:career.dreamCompanies.title", { defaultValue: "Dream Company Dashboard" })}
              subtitle={t("web:career.dreamCompanies.subtitle", {
                defaultValue: "Track target companies — jobs, interview prep, and your readiness for each.",
              })}
            />
            {isPremium && !premiumRequired && companies && companies.length >= 2 && (
              <Button
                variant={compareMode ? "outline" : "secondary"}
                size="sm"
                onClick={() => {
                  setCompareMode((v) => !v);
                  setCompareIds([]);
                }}
              >
                {compareMode
                  ? t("common:actions.cancel", { defaultValue: "Cancel" })
                  : t("web:career.dreamCompanies.compareCta", { defaultValue: "Compare companies" })}
              </Button>
            )}
          </div>

          {(premiumRequired || !isPremium) && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">
                {t("web:career.dreamCompanies.premiumRequiredTitle", { defaultValue: "Dream Company Dashboard is a Premium feature" })}
              </h2>
              <p className="text-sm text-hint">
                {t("web:career.dreamCompanies.premiumRequiredSubtitle", {
                  defaultValue: "Track your target companies with real research, matching job alerts, and prep progress — a Premium feature.",
                })}
              </p>
              <Link href="/subscription" className="mt-1 text-sm font-semibold text-link hover:underline">
                {t("web:career.dreamCompanies.upgradeToPremium", { defaultValue: "Upgrade to Premium" })}
              </Link>
            </div>
          )}

          {isPremium && !premiumRequired && (
            <>
              <div className="flex items-start gap-3 rounded-card border border-border bg-tint-purple/40 p-4">
                <EvaIcon name="info-outline" size={18} className="mt-0.5 shrink-0 text-tint-purple-text" />
                <p className="text-sm text-tint-purple-text">
                  {t("web:career.dreamCompanies.description", {
                    defaultValue: "Track target companies — jobs, interview prep, and your readiness for each.",
                  })}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface-2 p-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <EvaIcon name="plus-outline" size={20} className="text-brand" />
                  <span className="font-semibold text-primary">{t("web:career.dreamCompanies.add", { defaultValue: "Add to Dashboard" })}</span>
                  <EvaIcon name="arrow-forward-outline" size={16} className="ml-auto text-hint" />
                </button>
              </div>

              {/* "Link the company intelligence from the dream company
                  dashboard" — Company Intelligence is the same AI research
                  shown per-company below, just for a one-off lookup before
                  deciding to track anywhere. */}
              <Link href="/career/company-intelligence" className="mx-auto text-sm font-semibold text-link hover:underline">
                {t("web:career.dreamCompanies.lookupLink", { defaultValue: "Just researching? Look up any company →" })}
              </Link>

              {loadError && <p className="text-sm text-danger">{loadError}</p>}

              {companies === null && !loadError && <SkeletonRows count={4} />}

              {companies && companies.length === 0 && (
                <p className="py-6 text-center text-sm text-hint">
                  {t("web:career.dreamCompanies.empty", { defaultValue: "Add a company above to start tracking it." })}
                </p>
              )}

              {summary && (
                <div className="flex items-center rounded-card border border-border bg-surface-2 p-4">
                  <SummaryStat value={String(summary.tracked)} label={t("web:career.dreamCompanies.summaryTracked", { defaultValue: "Tracked" })} />
                  <div className="h-10 w-px bg-border" />
                  <SummaryStat
                    value={`${summary.avgReadiness}%`}
                    label={t("web:career.dreamCompanies.summaryReadiness", { defaultValue: "Avg. readiness" })}
                  />
                  <div className="h-10 w-px bg-border" />
                  <SummaryStat
                    value={String(summary.needsPractice)}
                    label={t("web:career.dreamCompanies.summaryNeedsPractice", { defaultValue: "Need practice" })}
                  />
                </div>
              )}

              {compareMode && (
                <div className="flex items-center justify-between gap-3 rounded-card border border-dashed border-brand/50 bg-brand/5 p-3 text-sm">
                  <span className="text-primary">
                    {t("web:career.dreamCompanies.compareModeHint", {
                      defaultValue: "Select up to {{max}} companies to compare — {{count}} selected.",
                      max: MAX_COMPARE,
                      count: compareIds.length,
                    })}
                  </span>
                  {compareIds.length >= 2 && (
                    <Button size="sm" onClick={() => setShowCompareModal(true)}>
                      {t("web:career.dreamCompanies.compareBarCta", { defaultValue: "Compare {{count}} companies", count: compareIds.length })}
                    </Button>
                  )}
                </div>
              )}

              {companies && companies.length > 0 && (
                <div className="flex flex-col gap-3">
                  {companies.map((c) => (
                    <CompanyCard
                      key={c.id}
                      c={c}
                      t={t}
                      expanded={expandedId === c.id}
                      compareMode={compareMode}
                      selected={compareIds.includes(c.id)}
                      refreshing={refreshingId === c.id}
                      togglingPriority={togglingPriorityId === c.id}
                      savingNotes={savingNotesId === c.id}
                      shareCopied={shareCopiedId === c.id}
                      notesValue={notesDraft[c.id] ?? c.notes}
                      onToggleExpand={() => (compareMode ? onToggleCompareSelect(c.id) : setExpandedId(expandedId === c.id ? null : c.id))}
                      onTogglePriority={() => handleTogglePriority(c)}
                      onRemove={() => handleRemove(c.id)}
                      onRefresh={() => handleRefresh(c.id)}
                      onNotesChange={(text) => setNotesDraft((prev) => ({ ...prev, [c.id]: text }))}
                      onSaveNotes={() => handleSaveNotes(c.id)}
                      onShareSummary={() => onShareSummary(c)}
                      onDrillQuestion={(q) => onDrillQuestion(c, q)}
                      onExpandForChecklist={() => setExpandedId(c.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {toast && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-pill bg-surface-4 px-4 py-2.5 text-sm text-primary shadow-lg">
            {toast}
          </div>
        )}

        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowAddModal(false)}>
            <form
              onSubmit={handleAdd}
              onClick={(e) => e.stopPropagation()}
              className="flex w-full max-w-md flex-col gap-4 rounded-card border border-border bg-surface-2 p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-primary">{t("web:career.dreamCompanies.add", { defaultValue: "Add to Dashboard" })}</h2>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  aria-label={t("common:actions.close", { defaultValue: "Close" })}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-hint hover:bg-surface-3"
                >
                  <EvaIcon name="close-outline" size={18} />
                </button>
              </div>
              <TextField
                label={t("web:career.dreamCompanies.companyLabel", { defaultValue: "Company" })}
                placeholder={t("web:career.dreamCompanies.companyPlaceholder", { defaultValue: "e.g. Acme Corp" })}
                value={companyInput}
                onChange={(e) => setCompanyInput(e.target.value)}
                required
              />
              <TextField
                label={t("web:career.dreamCompanies.targetRoleLabel", { defaultValue: "Target role (optional)" })}
                placeholder={t("web:career.dreamCompanies.targetRolePlaceholder", { defaultValue: "e.g. Product Manager" })}
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
              />
              {addError && <p className="text-sm text-danger">{addError}</p>}
              <Button type="submit" disabled={adding || !companyInput.trim()}>
                {adding ? t("web:career.dreamCompanies.adding", { defaultValue: "Adding…" }) : t("web:career.dreamCompanies.add", { defaultValue: "Add to Dashboard" })}
              </Button>
            </form>
          </div>
        )}

        {showCompareModal && companies && (
          <CompareModal companies={companies.filter((c) => compareIds.includes(c.id))} t={t} onClose={() => setShowCompareModal(false)} />
        )}
      </AppShell>
    </RequireAuth>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <span className="text-xl font-bold text-primary">{value}</span>
      <span className="mt-0.5 text-center text-xs text-hint">{label}</span>
    </div>
  );
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

interface CompanyCardProps {
  c: DreamCompany;
  t: TFunction;
  expanded: boolean;
  compareMode: boolean;
  selected: boolean;
  refreshing: boolean;
  togglingPriority: boolean;
  savingNotes: boolean;
  shareCopied: boolean;
  notesValue: string;
  onToggleExpand: () => void;
  onTogglePriority: () => void;
  onRemove: () => void;
  onRefresh: () => void;
  onNotesChange: (text: string) => void;
  onSaveNotes: () => void;
  onShareSummary: () => void;
  onDrillQuestion: (question: string) => void;
  onExpandForChecklist: () => void;
}

function CompanyCard({
  c,
  t,
  expanded,
  compareMode,
  selected,
  refreshing,
  togglingPriority,
  savingNotes,
  shareCopied,
  notesValue,
  onToggleExpand,
  onTogglePriority,
  onRemove,
  onRefresh,
  onNotesChange,
  onSaveNotes,
  onShareSummary,
  onDrillQuestion,
  onExpandForChecklist,
}: CompanyCardProps) {
  const tier = readinessTier(c.readinessScore);
  const tierClasses =
    tier === "success" ? "bg-success/15 text-success-text" : tier === "link" ? "bg-brand/10 text-brand" : "bg-surface-3 text-hint";
  const logoUrl = c.logoUrl ?? guessCompanyLogoUrl(c.company);
  const notesChanged = notesValue !== c.notes;

  const checklist: { done: boolean; label: string; onClick?: () => void; href?: string }[] = [
    {
      done: !!c.intel,
      label: t("web:career.dreamCompanies.checklistResearch", { defaultValue: "Review company research" }),
      onClick: onExpandForChecklist,
    },
    {
      done: c.prepProgress.sessionsPracticed >= 1,
      label: t("web:career.dreamCompanies.checklistPracticeOne", { defaultValue: "Practice a mock interview" }),
      href: prepLink("/practice/mock-interviews", c.company, c.targetRole),
    },
    {
      done: c.prepProgress.sessionsPracticed >= 3,
      label: t("web:career.dreamCompanies.checklistPracticeThree", { defaultValue: "Practice 3 mock interviews" }),
      href: prepLink("/practice/mock-interviews", c.company, c.targetRole),
    },
    {
      done: c.prepProgress.applicationTracked,
      label: t("web:career.dreamCompanies.checklistApplication", { defaultValue: "Track your application" }),
      href: "/applications",
    },
  ];

  return (
    <div className={`flex flex-col gap-3 rounded-card border bg-surface-2 p-4 ${c.isTopChoice ? "border-accent-purple" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={onToggleExpand} className="flex flex-1 items-center gap-3 text-left">
          {compareMode && (
            <EvaIcon
              name={selected ? "checkmark-circle-2-outline" : "checkmark-circle-outline"}
              size={20}
              className={selected ? "text-brand" : "text-hint"}
            />
          )}
          <CompanyLogoAvatar logoUrl={logoUrl} companyName={c.company} size={40} className="shrink-0 bg-tint-purple" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-semibold text-primary">{c.company}</h3>
              {c.isTopChoice && <EvaIcon name="star-outline" size={14} className="shrink-0 text-accent-purple" />}
            </div>
            {c.targetRole && <p className="text-sm text-hint">{c.targetRole}</p>}
          </div>
        </button>
        {!compareMode && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onTogglePriority}
              disabled={togglingPriority}
              aria-label={t("web:career.dreamCompanies.markTopChoice", { defaultValue: "Mark top choice" })}
              className="p-1 text-hint transition hover:text-accent-purple disabled:opacity-50"
            >
              <EvaIcon name="star-outline" size={18} className={c.isTopChoice ? "text-accent-purple" : undefined} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label={t("common:actions.delete", { defaultValue: "Remove" })}
              className="p-1 text-hint transition hover:text-danger"
            >
              <EvaIcon name="trash-2-outline" size={16} />
            </button>
            <button type="button" onClick={onToggleExpand} aria-label={expanded ? "Collapse" : "Expand"} className="p-1 text-hint">
              <EvaIcon name={expanded ? "chevron-up-outline" : "chevron-down-outline"} size={18} />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className={tierClasses}>{t("web:career.dreamCompanies.readyPercent", { defaultValue: "{{score}}% ready", score: c.readinessScore })}</Badge>
        {c.researchPending && (
          <Badge className="bg-brand/10 text-brand">
            <EvaIcon name="clock-outline" size={12} className="animate-spin" />
            {t("web:career.dreamCompanies.researching", { defaultValue: "Researching…" })}
          </Badge>
        )}
        {c.hasNewJobAlert && (
          <Badge className="bg-accent-purple/15 text-accent-purple">
            {t("web:career.dreamCompanies.newJobMatch", { defaultValue: "New job match!" })}
          </Badge>
        )}
        {c.openJobsCount > 0 && (
          <Link href={`/job-alerts?company=${encodeURIComponent(c.company)}`}>
            <Badge className="bg-success/15 text-success-text transition hover:opacity-80">
              {t("web:career.dreamCompanies.openJobs", { defaultValue: "{{count}} open jobs", count: c.openJobsCount })}
            </Badge>
          </Link>
        )}
        {c.prepProgress.sessionsPracticed > 0 && (
          <Badge className="bg-brand/10 text-brand">
            {t("web:career.dreamCompanies.sessionsPracticed", { defaultValue: "{{count}} sessions practiced", count: c.prepProgress.sessionsPracticed })}
          </Badge>
        )}
        {c.prepProgress.applicationTracked && (
          <Badge className="bg-surface-3 text-primary">{t("web:career.dreamCompanies.applicationTracked", { defaultValue: "Application tracked" })}</Badge>
        )}
      </div>

      {!compareMode && (
        <div className="flex flex-wrap gap-2">
          <Link
            href={prepLink("/practice/mock-interviews", c.company, c.targetRole)}
            className="inline-flex items-center gap-1.5 rounded-pill bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand/20"
          >
            <EvaIcon name="mic-outline" size={14} />
            {t("web:career.dreamCompanies.practiceCta", { defaultValue: "Practice interview" })}
          </Link>
          <Link
            href={prepLink("/resume/cover-letter", c.company, c.targetRole)}
            className="inline-flex items-center gap-1.5 rounded-pill bg-surface-3 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-surface-4"
          >
            <EvaIcon name="file-text-outline" size={14} />
            {t("web:career.dreamCompanies.coverLetterCta", { defaultValue: "Generate cover letter" })}
          </Link>
          {c.intel?.salaryRange && (
            <Link
              href={prepLink("/career/salary-negotiation", c.company, c.targetRole)}
              className="inline-flex items-center gap-1.5 rounded-pill bg-surface-3 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-surface-4"
            >
              <EvaIcon name="trending-up-outline" size={14} />
              {t("web:career.dreamCompanies.negotiateCta", { defaultValue: "Practice negotiation" })}
            </Link>
          )}
          <button
            type="button"
            onClick={onShareSummary}
            className="inline-flex items-center gap-1.5 rounded-pill bg-surface-3 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-surface-4"
          >
            <EvaIcon name="share-outline" size={14} />
            {shareCopied ? t("web:career.dreamCompanies.copied", { defaultValue: "Copied!" }) : t("web:career.dreamCompanies.shareCta", { defaultValue: "Share summary" })}
          </button>
        </div>
      )}

      {expanded && !compareMode && (
        <div className="mt-1 flex flex-col gap-4 border-t border-border pt-4">
          <div className="rounded-card bg-surface-3 p-3">
            <p className="mb-2 text-sm font-semibold text-primary">{t("web:career.dreamCompanies.checklistTitle", { defaultValue: "Prep checklist" })}</p>
            <div className="flex flex-col gap-1.5">
              {checklist.map((item, i) =>
                item.href && !item.done ? (
                  <Link key={i} href={item.href} className="flex items-center gap-2 text-sm text-primary hover:text-brand">
                    <EvaIcon name="checkmark-circle-outline" size={16} className="text-hint" />
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={i}
                    type="button"
                    disabled={item.done}
                    onClick={item.onClick}
                    className={`flex items-center gap-2 text-left text-sm ${item.done ? "text-hint line-through" : "text-primary hover:text-brand"}`}
                  >
                    <EvaIcon name="checkmark-circle-2-outline" size={16} className={item.done ? "text-success-text" : "text-hint"} />
                    {item.label}
                  </button>
                )
              )}
            </div>
          </div>

          {c.intel ? (
            <>
              <p className="text-sm text-primary">{c.intel.overview}</p>
              {c.intel.salaryRange && (
                <div className="rounded-card bg-surface-3 p-3">
                  <p className="mb-1 text-xs font-semibold text-primary">{t("web:career.salaryInsights", { defaultValue: "Salary Insights" })}</p>
                  <p className="text-sm text-hint">{c.intel.salaryRange}</p>
                </div>
              )}
              {c.intel.interviewProcess && (
                <div className="rounded-card bg-surface-3 p-3">
                  <p className="mb-1 text-xs font-semibold text-primary">{t("web:career.interviewProcess", { defaultValue: "Interview Process" })}</p>
                  <p className="text-sm text-hint">{c.intel.interviewProcess}</p>
                </div>
              )}
              {c.intel.likelyQuestions.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-primary">{t("web:career.likelyQuestions", { defaultValue: "Likely Interview Questions" })}</p>
                  <div className="flex flex-col gap-1.5">
                    {c.intel.likelyQuestions.map((q, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onDrillQuestion(q)}
                        className="flex items-start justify-between gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2 text-left text-sm text-primary transition hover:border-brand/50"
                      >
                        <span>
                          {i + 1}. {q}
                        </span>
                        <EvaIcon name="mic-outline" size={14} className="mt-0.5 shrink-0 text-brand" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : c.researchPending ? (
            <div className="flex items-center gap-2 text-sm text-hint">
              <EvaIcon name="clock-outline" size={14} className="animate-spin" />
              {t("web:career.dreamCompanies.researchingLong", { defaultValue: "Researching this company…" })}
            </div>
          ) : (
            <p className="text-sm text-hint">
              {t("web:career.dreamCompanies.noResearchYet", { defaultValue: "Research not available yet — try refreshing." })}
            </p>
          )}

          {c.researchStale && (
            <p className="text-sm text-warning">{t("web:career.dreamCompanies.researchStale", { defaultValue: "This research may be out of date." })}</p>
          )}

          <div className="flex items-center gap-4">
            <button type="button" disabled={refreshing} onClick={onRefresh} className="text-sm font-semibold text-link disabled:opacity-50">
              {refreshing ? t("web:career.dreamCompanies.refreshing", { defaultValue: "Refreshing…" }) : t("web:career.dreamCompanies.refreshResearch", { defaultValue: "Refresh research" })}
            </button>
            <button type="button" onClick={onRemove} className="text-sm font-semibold text-danger">
              {t("common:actions.delete", { defaultValue: "Remove" })}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-primary">{t("web:career.dreamCompanies.notesLabel", { defaultValue: "My notes" })}</p>
            <textarea
              value={notesValue}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={3}
              placeholder={t("web:career.dreamCompanies.notesPlaceholder", { defaultValue: "Add a personal note about this company…" })}
              className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            {notesChanged && (
              <Button size="sm" className="w-fit" disabled={savingNotes} onClick={onSaveNotes}>
                {savingNotes ? t("web:career.dreamCompanies.saving", { defaultValue: "Saving…" }) : t("common:actions.save", { defaultValue: "Save" })}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CompareModal({
  companies,
  t,
  onClose,
}: {
  companies: DreamCompany[];
  t: TFunction;
  onClose: () => void;
}) {
  const rows: { label: string; render: (c: DreamCompany) => string }[] = [
    { label: t("web:career.dreamCompanies.readinessLabel", { defaultValue: "Readiness" }), render: (c) => `${c.readinessScore}%` },
    {
      label: t("web:career.dreamCompanies.sessionsPracticedLabel", { defaultValue: "Sessions practiced" }),
      render: (c) => `${c.prepProgress.sessionsPracticed}`,
    },
    {
      label: t("web:career.dreamCompanies.avgScoreLabel", { defaultValue: "Avg. interview score" }),
      render: (c) => (c.prepProgress.avgScore != null ? `${c.prepProgress.avgScore}%` : "—"),
    },
    {
      label: t("web:career.dreamCompanies.applicationTrackedLabel", { defaultValue: "Application tracked" }),
      render: (c) => (c.prepProgress.applicationTracked ? t("common:yes", { defaultValue: "Yes" }) : t("common:no", { defaultValue: "No" })),
    },
    { label: t("web:career.dreamCompanies.openJobsLabel", { defaultValue: "Open jobs" }), render: (c) => `${c.openJobsCount}` },
    { label: t("web:career.salaryInsights", { defaultValue: "Salary Insights" }), render: (c) => c.intel?.salaryRange || "—" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 rounded-t-card border border-border bg-surface-2 p-6 shadow-2xl sm:rounded-card"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-primary">{t("web:career.dreamCompanies.compareTitle", { defaultValue: "Compare companies" })}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common:actions.close", { defaultValue: "Close" })}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-hint hover:bg-surface-3"
          >
            <EvaIcon name="close-outline" size={18} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-32 pb-3 text-left align-bottom text-xs font-medium text-hint"> </th>
                {companies.map((c) => (
                  <th key={c.id} className="w-36 pb-3 pl-4 text-left align-bottom font-semibold text-primary">
                    {c.company}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="py-2.5 pr-2 text-hint">{r.label}</td>
                  {companies.map((c) => (
                    <td key={c.id} className="py-2.5 pl-4 text-primary">
                      {r.render(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
