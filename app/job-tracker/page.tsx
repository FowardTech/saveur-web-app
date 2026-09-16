"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EvaIcon, type EvaIconName } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { CompanyLogoAvatar } from "@/components/practice/CompanyLogoAvatar";
import { guessCompanyLogoUrl } from "@/lib/companyData";
import { DidYouApplyModal } from "@/components/jobAlerts/DidYouApplyModal";
import { useApplyTracking } from "@/hooks/useApplyTracking";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Product request: "I checked the dashboard of those web apps... there is a
// lot of designs and features... the web app dashboard look so empty" —
// specifically citing resume.io's Job Tracker (a single Kanban board:
// Recommended -> Shortlist -> Auto Apply -> Applied -> Interview -> Offer
// -> Rejected, cards you move between stages) where this app previously
// had TWO separate, disconnected pages: Job Alerts (a discovery feed with
// no notion of application stage) and Applications (a flat list with a
// plain <select> to change stage, no visual board). This page unifies both
// into one real board, backed entirely by the two existing APIs — no new
// backend endpoints needed:
//   GET  /api/v1/job-alerts               -> discovery feed (Recommended/Shortlisted)
//   GET  /api/v1/tracker/applications     -> tracked applications (Applied/Interview/Offer/Rejected)
//   GET  /api/v1/tracker/analytics        -> the same stat strip app/applications/page.tsx already shows
//   POST /api/v1/job-alerts/<id>/pin      -> Recommended <-> Shortlisted
//   POST /api/v1/tracker/applications     -> converts an alert into a real tracked application
//                                             (dedup'd server-side by apply_url — see tracker.py's
//                                             create_app() — so dragging the same alert twice is safe)
//   PATCH /api/v1/tracker/applications/<id> -> moves a tracked application between stages
//
// Deliberately does NOT reimplement Applications' power tools (Gmail/Outlook
// inbox scanning, paste-an-email parsing, AI follow-up drafts, manual
// "Add application" form) here — those stay on /applications, linked from
// this board's header, rather than duplicating a large, already-working
// surface. This page's job is the missing piece: one visual board that
// actually connects discovery to tracking, the thing the product report
// specifically called out as absent.
//
// No "Auto Apply" column/toggle: resume.io's Auto Apply actually submits
// applications on the user's behalf — a real third-party automation
// capability this app doesn't have. Adding a toggle that LOOKS like that
// but doesn't actually apply anywhere would be fabricated functionality,
// so it's intentionally left out rather than faked.
interface JobAlert {
  id: string;
  title: string;
  company: string;
  location?: string;
  apply_url?: string;
  read: boolean;
  pinned: boolean;
  applied?: boolean;
  company_logo_url?: string;
}

interface Application {
  id: number;
  company: string;
  role: string;
  location: string;
  stage: string; // "Applied" | "Interviewing" | "Offer" | "Rejected"
  next_step?: string;
  apply_url?: string;
  company_logo_url?: string;
}

interface Analytics {
  total: number;
  response_rate: number | null;
  avg_days_to_interview: number | null;
  stale_applications: Array<{ id: number; company: string; role: string; stage: string; days_stale: number }>;
}

type ColumnKey = "recommended" | "shortlisted" | "applied" | "interview" | "offer" | "rejected";
type StageColumn = "applied" | "interview" | "offer" | "rejected";

const STAGE_BY_COLUMN: Record<StageColumn, string> = {
  applied: "Applied",
  interview: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};
const COLUMN_BY_STAGE: Record<string, StageColumn> = {
  Applied: "applied",
  Interviewing: "interview",
  Offer: "offer",
  Rejected: "rejected",
};
const STAGE_COLUMNS: StageColumn[] = ["applied", "interview", "offer", "rejected"];
const COLUMN_ICON: Record<ColumnKey, EvaIconName> = {
  recommended: "compass-outline",
  shortlisted: "star-outline",
  applied: "briefcase-outline",
  interview: "people-outline",
  offer: "award-outline",
  rejected: "close-circle-outline",
};

interface DragPayload {
  kind: "alert" | "application";
  id: string;
}

function readDragPayload(e: React.DragEvent): DragPayload | null {
  try {
    const raw = e.dataTransfer.getData("text/plain");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.kind === "alert" || parsed.kind === "application") && typeof parsed.id === "string") {
      return parsed as DragPayload;
    }
  } catch {
    // ignore malformed payloads (e.g. a stray OS-level drag of something else)
  }
  return null;
}

function ColumnHeader({ icon, label, count }: { icon: EvaIconName; label: string; count: number }) {
  return (
    <div className="flex items-center justify-between rounded-t-card border border-b-0 border-border bg-surface-2 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
        <EvaIcon name={icon} size={15} className="text-hint" />
        {label}
      </div>
      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill bg-surface-3 px-1.5 text-xs font-semibold text-hint">
        {count}
      </span>
    </div>
  );
}

function AlertKanbanCard({
  alert,
  isDragging,
  onDragStart,
  onDragEnd,
  onTogglePin,
  onDragToApplied,
}: {
  alert: JobAlert;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onTogglePin: (alert: JobAlert) => void;
  onDragToApplied: () => void;
}) {
  const { t } = useTranslation();
  const logoUrl = alert.company_logo_url ?? guessCompanyLogoUrl(alert.company);
  const apply = useApplyTracking({
    company: alert.company,
    role: alert.title,
    location: alert.location,
    applyUrl: alert.apply_url,
    companyLogoUrl: logoUrl,
  });

  async function handleConfirmApplied() {
    const succeeded = await apply.confirmApplied();
    if (succeeded) onDragToApplied();
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "alert", id: alert.id }));
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`cursor-grab flex flex-col gap-2 rounded-card border border-border bg-surface-2 p-3 shadow-sm transition active:cursor-grabbing ${
        isDragging ? "opacity-40" : "hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      <Link href={`/job-alerts/${alert.id}`} className="flex items-start gap-2.5">
        <CompanyLogoAvatar logoUrl={logoUrl ?? undefined} companyName={alert.company} size={32} className="mt-0.5 shrink-0 bg-tint-mint" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-primary">{alert.title}</p>
          <p className="truncate text-xs text-hint">
            {alert.company}
            {alert.location ? ` · ${alert.location}` : ""}
          </p>
        </div>
      </Link>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onTogglePin(alert)}
          className={`inline-flex flex-1 items-center justify-center gap-1 rounded-pill border px-2 py-1 text-xs font-semibold transition ${
            alert.pinned ? "border-brand bg-brand/10 text-brand" : "border-border text-hint hover:border-brand/50 hover:text-primary"
          }`}
        >
          <EvaIcon name="star-outline" size={12} />
          {alert.pinned ? t("web:jobTracker.saved", { defaultValue: "Saved" }) : t("web:jobTracker.save", { defaultValue: "Save" })}
        </button>
        {alert.apply_url && (
          <button
            type="button"
            onClick={apply.openApply}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-pill bg-brand px-2 py-1 text-xs font-semibold text-white transition hover:bg-brand-600"
          >
            {t("web:jobTracker.apply", { defaultValue: "Apply" })}
            <EvaIcon name="external-link-outline" size={11} />
          </button>
        )}
      </div>
      <DidYouApplyModal
        open={apply.promptOpen}
        company={alert.company}
        role={alert.title}
        isSubmitting={apply.isSubmitting}
        feedback={apply.feedback}
        onConfirm={handleConfirmApplied}
        onDismiss={apply.dismissPrompt}
      />
    </div>
  );
}

function ApplicationKanbanCard({
  app,
  isDragging,
  onDragStart,
  onDragEnd,
  onDelete,
}: {
  app: Application;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDelete: (app: Application) => void;
}) {
  const { t } = useTranslation();
  const logoUrl = app.company_logo_url ?? guessCompanyLogoUrl(app.company);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "application", id: String(app.id) }));
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`group cursor-grab flex flex-col gap-2 rounded-card border border-border bg-surface-2 p-3 shadow-sm transition active:cursor-grabbing ${
        isDragging ? "opacity-40" : "hover:-translate-y-0.5 hover:shadow-md"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <CompanyLogoAvatar logoUrl={logoUrl ?? undefined} companyName={app.company} size={32} className="mt-0.5 shrink-0 bg-tint-purple" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-primary">{app.role}</p>
          <p className="truncate text-xs text-hint">
            {app.company}
            {app.location ? ` · ${app.location}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDelete(app)}
          aria-label={t("common:actions.delete", { defaultValue: "Delete" })}
          className="shrink-0 text-hint opacity-0 transition hover:text-danger group-hover:opacity-100"
        >
          <EvaIcon name="trash-2-outline" size={14} />
        </button>
      </div>
      {app.next_step && <p className="text-xs text-hint">{t("web:jobTracker.nextStep", { defaultValue: "Next: {{step}}", step: app.next_step })}</p>}
      <Link href="/applications" className="text-xs font-semibold text-link hover:underline">
        {t("web:jobTracker.viewInApplications", { defaultValue: "View details →" })}
      </Link>
    </div>
  );
}

export default function JobTrackerPage() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<JobAlert[] | null>(null);
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proRequired, setProRequired] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ColumnKey | null>(null);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await apiClient.get<{ data: JobAlert[] }>("/api/v1/job-alerts");
      setAlerts(data.data);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) setProRequired(true);
    }
  }, []);

  const loadApplications = useCallback(async () => {
    try {
      const [apps, stats] = await Promise.all([
        apiClient.get<Application[]>("/api/v1/tracker/applications"),
        apiClient.get<Analytics>("/api/v1/tracker/analytics").catch(() => null),
      ]);
      setApplications(apps);
      if (stats) setAnalytics(stats);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) setProRequired(true);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
    loadApplications();
  }, [loadAlerts, loadApplications]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await apiClient.post("/api/v1/job-alerts/refresh");
      await loadAlerts();
    } catch {
      setError(t("web:jobTracker.refreshFailed", { defaultValue: "Couldn't refresh alerts right now." }));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleTogglePin(alert: JobAlert) {
    const nextPinned = !alert.pinned;
    setAlerts((prev) => (prev ? prev.map((a) => (a.id === alert.id ? { ...a, pinned: nextPinned } : a)) : prev));
    try {
      await apiClient.post(`/api/v1/job-alerts/${alert.id}/pin`, { pinned: nextPinned });
    } catch {
      setAlerts((prev) => (prev ? prev.map((a) => (a.id === alert.id ? { ...a, pinned: !nextPinned } : a)) : prev));
    }
  }

  async function createApplicationFromAlert(alert: JobAlert, stage: string) {
    try {
      await apiClient.post("/api/v1/tracker/applications", {
        company: alert.company,
        role: alert.title,
        location: alert.location || "",
        apply_url: alert.apply_url,
        stage,
        company_logo_url: alert.company_logo_url,
        source: "manual_confirm",
      });
      await loadApplications();
    } catch {
      setError(t("web:jobTracker.moveFailed", { defaultValue: "Couldn't move that job right now." }));
    }
  }

  async function handleStageChange(app: Application, stage: string) {
    if (app.stage === stage) return;
    setApplications((prev) => (prev ? prev.map((a) => (a.id === app.id ? { ...a, stage } : a)) : prev));
    try {
      await apiClient.patch(`/api/v1/tracker/applications/${app.id}`, { stage });
    } catch {
      loadApplications();
    }
  }

  async function handleDelete(app: Application) {
    setApplications((prev) => (prev ? prev.filter((a) => a.id !== app.id) : prev));
    try {
      await apiClient.delete(`/api/v1/tracker/applications/${app.id}`);
    } catch {
      loadApplications();
    }
  }

  const appliedApplyUrls = useMemo(
    () => new Set((applications ?? []).map((a) => a.apply_url).filter((u): u is string => !!u)),
    [applications]
  );

  // Hides an alert once it's become a real tracked application (matched by
  // apply_url, the same dedup key the backend itself uses) so it doesn't
  // show up in BOTH the Recommended/Shortlisted columns and its real stage
  // column at once.
  const visibleAlerts = useMemo(
    () => (alerts ?? []).filter((a) => !a.apply_url || !appliedApplyUrls.has(a.apply_url)),
    [alerts, appliedApplyUrls]
  );
  const recommended = useMemo(() => visibleAlerts.filter((a) => !a.pinned), [visibleAlerts]);
  const shortlisted = useMemo(() => visibleAlerts.filter((a) => a.pinned), [visibleAlerts]);
  const byStage = useMemo(() => {
    const map: Record<StageColumn, Application[]> = { applied: [], interview: [], offer: [], rejected: [] };
    for (const a of applications ?? []) {
      const col = COLUMN_BY_STAGE[a.stage] ?? "applied";
      map[col].push(a);
    }
    return map;
  }, [applications]);

  function handleDrop(column: ColumnKey, e: React.DragEvent) {
    e.preventDefault();
    setDragOverColumn(null);
    const payload = readDragPayload(e);
    if (!payload) return;
    if (payload.kind === "alert") {
      const alert = alerts?.find((a) => a.id === payload.id);
      if (!alert) return;
      if (column === "shortlisted" && !alert.pinned) return handleTogglePin(alert);
      if (column === "recommended" && alert.pinned) return handleTogglePin(alert);
      if (column === "applied" || column === "interview" || column === "offer" || column === "rejected") {
        return createApplicationFromAlert(alert, STAGE_BY_COLUMN[column]);
      }
    } else {
      if (column === "recommended" || column === "shortlisted") return; // can't move a real application back into discovery
      const app = applications?.find((a) => String(a.id) === payload.id);
      if (!app) return;
      return handleStageChange(app, STAGE_BY_COLUMN[column as StageColumn]);
    }
  }

  const loading = alerts === null && applications === null && !proRequired;
  const totalCount =
    recommended.length + shortlisted.length + byStage.applied.length + byStage.interview.length + byStage.offer.length + byStage.rejected.length;

  const columns: Array<{ key: ColumnKey; label: string }> = [
    { key: "recommended", label: t("web:jobTracker.columns.recommended", { defaultValue: "Recommended" }) },
    { key: "shortlisted", label: t("web:jobTracker.columns.shortlisted", { defaultValue: "Shortlisted" }) },
    { key: "applied", label: t("web:jobTracker.columns.applied", { defaultValue: "Applied" }) },
    { key: "interview", label: t("web:jobTracker.columns.interview", { defaultValue: "Interview" }) },
    { key: "offer", label: t("web:jobTracker.columns.offer", { defaultValue: "Offer" }) },
    { key: "rejected", label: t("web:jobTracker.columns.rejected", { defaultValue: "Rejected" }) },
  ];

  function columnCards(key: ColumnKey) {
    if (key === "recommended") return recommended;
    if (key === "shortlisted") return shortlisted;
    return byStage[key as StageColumn];
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-[1400px] flex-col gap-6 pb-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title={t("web:jobTracker.title", { defaultValue: "Job Tracker" })}
              subtitle={t("web:jobTracker.subtitle", {
                defaultValue: "Every job you're tracking, from first match to offer, in one board. Drag a card between columns, or use Save/Apply.",
              })}
            />
            <div className="flex items-center gap-2">
              <Link href="/applications" className="text-sm font-medium text-hint hover:text-primary hover:underline">
                {t("web:jobTracker.advancedTools", { defaultValue: "Advanced tools →" })}
              </Link>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || proRequired}>
                {refreshing ? t("web:jobTracker.refreshing", { defaultValue: "Refreshing…" }) : t("web:jobTracker.refreshAlerts", { defaultValue: "Refresh alerts" })}
              </Button>
            </div>
          </div>

          {proRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:jobTracker.proRequiredTitle", { defaultValue: "Job Tracker requires a paid plan" })}</h2>
              <p className="text-sm text-hint">{t("web:jobTracker.proRequiredSubtitle", { defaultValue: "Upgrade to Saveur Basic or above to track job matches and applications." })}</p>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          {!proRequired && analytics && analytics.total > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-card border border-border bg-surface-2 p-4 text-center">
                <p className="text-xl font-bold text-primary">{analytics.total}</p>
                <p className="mt-1 text-xs text-hint">{t("web:jobTracker.stats.tracked", { defaultValue: "Tracked" })}</p>
              </div>
              <div className="rounded-card border border-border bg-surface-2 p-4 text-center">
                <p className="text-xl font-bold text-primary">{analytics.response_rate ?? "—"}{analytics.response_rate !== null ? "%" : ""}</p>
                <p className="mt-1 text-xs text-hint">{t("web:jobTracker.stats.responseRate", { defaultValue: "Response rate" })}</p>
              </div>
              <div className="rounded-card border border-border bg-surface-2 p-4 text-center">
                <p className="text-xl font-bold text-primary">{analytics.avg_days_to_interview ?? "—"}</p>
                <p className="mt-1 text-xs text-hint">{t("web:jobTracker.stats.avgDays", { defaultValue: "Avg. days to interview" })}</p>
              </div>
              <div className="rounded-card border border-border bg-surface-2 p-4 text-center">
                <p className="text-xl font-bold text-primary">{analytics.stale_applications.length}</p>
                <p className="mt-1 text-xs text-hint">{t("web:jobTracker.stats.stale", { defaultValue: "Gone quiet" })}</p>
              </div>
            </div>
          )}

          {loading && !proRequired && <SkeletonRows count={5} />}

          {!proRequired && !loading && totalCount === 0 && (
            <div className="rounded-card border border-dashed border-border p-10 text-center">
              <p className="text-sm text-hint">
                {t("web:jobTracker.empty", { defaultValue: "No jobs tracked yet — refresh alerts above, or add an application from Advanced tools." })}
              </p>
            </div>
          )}

          {!proRequired && !loading && totalCount > 0 && (
            <div className="grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-flow-col lg:auto-cols-[260px] lg:grid-cols-none">
              {columns.map((col) => {
                const cards = columnCards(col.key);
                const isOver = dragOverColumn === col.key;
                return (
                  <div key={col.key} className="flex min-w-0 flex-col lg:min-w-[260px]">
                    <ColumnHeader icon={COLUMN_ICON[col.key]} label={col.label} count={cards.length} />
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverColumn !== col.key) setDragOverColumn(col.key);
                      }}
                      onDragLeave={() => setDragOverColumn((prev) => (prev === col.key ? null : prev))}
                      onDrop={(e) => handleDrop(col.key, e)}
                      className={`flex min-h-[120px] flex-1 flex-col gap-2.5 rounded-b-card border border-t-0 border-border p-2.5 transition ${
                        isOver ? "bg-brand/5 ring-2 ring-inset ring-brand/30" : "bg-surface-1"
                      }`}
                    >
                      {cards.length === 0 && (
                        <p className="py-4 text-center text-xs text-hint">{t("web:jobTracker.columnEmpty", { defaultValue: "Nothing here yet" })}</p>
                      )}
                      {col.key === "recommended" || col.key === "shortlisted"
                        ? (cards as JobAlert[]).map((alert) => (
                            <AlertKanbanCard
                              key={alert.id}
                              alert={alert}
                              isDragging={draggingId === alert.id}
                              onDragStart={() => setDraggingId(alert.id)}
                              onDragEnd={() => setDraggingId(null)}
                              onTogglePin={handleTogglePin}
                              onDragToApplied={() => createApplicationFromAlert(alert, "Applied")}
                            />
                          ))
                        : (cards as Application[]).map((app) => (
                            <ApplicationKanbanCard
                              key={app.id}
                              app={app}
                              isDragging={draggingId === String(app.id)}
                              onDragStart={() => setDraggingId(String(app.id))}
                              onDragEnd={() => setDraggingId(null)}
                              onDelete={handleDelete}
                            />
                          ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
