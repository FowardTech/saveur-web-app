"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import apiClient, { type ApiError } from "@/lib/apiClient";
import { INTERVIEW_TYPES, interviewTypeSlug } from "@/lib/interviewData";
import { useAuth } from "@/app/providers/AuthProvider";
import { CompanyLogoAvatar } from "@/components/practice/CompanyLogoAvatar";
import { getAppConfig, isFeatureEnabled } from "@/lib/appConfigService";
import * as emailConnectionService from "@/lib/emailConnectionService";
import { type EmailProvider, type EmailConnectionProps } from "@/lib/emailConnectionService";
import * as calendarConnectionService from "@/lib/calendarConnectionService";
import { type CalendarProvider, type CalendarConnectionProps } from "@/lib/calendarConnectionService";

// Web counterpart to Saveur/src/requests/RequestsSrc.tsx: ONE "Interviews"
// screen with a pill tab bar — Applications (index 0, default) and Practice
// History (index 1, see that file's own request:title/applications/
// practice_history translation keys). Used to be two separate top-level web
// pages/nav rows (this file, and app/practice/history/page.tsx) — merged
// here, this route kept as the canonical one. Mobile itself reaches this
// same screen from two differently-labeled entry points that land on
// different default tabs (MoreSrc.tsx's "Applications" row -> tab 0;
// MainDrawer.tsx's "Recent Interviews" row -> tab 1, via `initialTab: 1`) —
// lib/navigation.ts mirrors that exact structure with a `?tab=` query param
// instead of a route param, rather than collapsing down to one nav entry.
type Tab = "applications" | "history";

// ---- Applications tab — Saveur-Backend/app/api/tracker.py -----------------
//   GET/POST     /api/v1/tracker/applications
//   PATCH/DELETE /api/v1/tracker/applications/<id>
//   POST         /api/v1/tracker/applications/parse-email
//   POST         /api/v1/tracker/applications/<id>/draft-followup
//   GET          /api/v1/tracker/analytics
// Basic-and-up feature (@require_pro), same gate as Job Alerts.
const STAGES = ["Applied", "Interviewing", "Offer", "Rejected"] as const;
type Stage = (typeof STAGES)[number];

interface Application {
  id: number;
  company: string;
  role: string;
  location: string;
  stage: Stage;
  status: Stage;
  next_step?: string;
  apply_url?: string;
  applied_date?: number | null;
  offer_amount?: number | null;
  offer_currency?: string | null;
}

interface Analytics {
  total: number;
  by_stage: Record<string, number>;
  response_rate: number | null;
  avg_days_to_interview: number | null;
  stale_after_days: number;
  stale_applications: Array<{ id: number; company: string; role: string; stage: string; days_stale: number }>;
}

// Real Gmail/Outlook/Google Calendar/Outlook Calendar brand marks for the 4
// "Connect ..." cards below, via the same geticon.dev per-domain favicon
// lookup CompanyLogoAvatar already uses for employer logos elsewhere on web
// — see Saveur/src/requests/Applications/AddFromEmail.tsx's identical
// PROVIDER_LOGO_DOMAIN for the full "why per-product Google subdomains"
// reasoning (mail.google.com vs calendar.google.com resolve to distinct
// icons; Outlook doesn't split as cleanly, so both Outlook rows share one).
const PROVIDER_LOGO_DOMAIN: Record<"gmail" | "outlook_mail" | "google_calendar" | "outlook_calendar", string> = {
  gmail: "mail.google.com",
  outlook_mail: "outlook.com",
  google_calendar: "calendar.google.com",
  outlook_calendar: "outlook.com",
};
const providerLogoUrl = (key: keyof typeof PROVIDER_LOGO_DOMAIN) => `https://geticon.dev/?url=${PROVIDER_LOGO_DOMAIN[key]}`;

function stageLabel(t: (k: string, o?: Record<string, unknown>) => string, stage: string) {
  return t(`web:applications.stages.${stage.toLowerCase()}`, { defaultValue: stage });
}

function stageColor(stage: string) {
  switch (stage) {
    case "Offer":
      return "bg-tint-mint text-tint-mint-text";
    case "Rejected":
      return "bg-tint-rose text-tint-rose-text";
    case "Interviewing":
      return "bg-tint-purple text-tint-purple-text";
    default:
      return "bg-tint-orange text-tint-orange-text";
  }
}

// ---- Practice History tab — Saveur-Backend/app/api/interviews.py ----------
//   GET /api/v1/interviews/sessions -> Session[]
interface Session {
  id: number;
  type: string;
  role?: string;
  company?: string;
  mode?: string;
  status: string;
  difficulty?: string;
  started_at: string;
  ended_at?: string | null;
  overall_score?: number | null;
  has_video: boolean;
  duration_min?: number | null;
}

function fallbackLabelFor(type: string) {
  return type
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function formatSessionDate(iso: string) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function InterviewsPageInner() {
  const { t } = useTranslation();
  const router = useRouter();
  // BUG FIX (real root cause of "Request failed with status 401" on every
  // page refresh): both fetch effects below used to fire unconditionally
  // on mount (`[]` deps). This component's own body mounts with the route
  // regardless of what RequireAuth (rendered further down in this file's
  // return) decides to do with its `children` -- RequireAuth only gates
  // rendering of the JSX it wraps, not this component's own effects. See
  // components/shell/Sidebar.tsx's identical fix for the full mechanism
  // (AuthProvider sets `firebaseUser` before awaiting the backend profile
  // sync, flipping `loading` false only afterward).
  const { loading } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab");
  const tab: Tab = tabParam === "history" ? "history" : "applications";
  function setTab(next: Tab) {
    const qs = next === "history" ? "?tab=history" : "";
    router.replace(`/applications${qs}`);
  }

  // ---- Applications state ----
  const [applications, setApplications] = useState<Application[] | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proRequired, setProRequired] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [adding, setAdding] = useState(false);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailText, setEmailText] = useState("");
  const [parsingEmail, setParsingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);

  const [draftFor, setDraftFor] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ id: number; subject: string; body: string } | null>(null);

  // ---- Connect inbox/calendar (Job Tracker auto-scan) ----
  // Web counterpart to Saveur/src/requests/Applications/AddFromEmail.tsx's
  // own connector cards — see lib/emailConnectionService.ts /
  // lib/calendarConnectionService.ts for the OAuth flow. Each provider is
  // independently controlled by an admin Feature Flags toggle
  // (isFeatureEnabled below), matching mobile.
  const [connectFlags, setConnectFlags] = useState<{
    outlookMail: boolean;
    gmail: boolean;
    googleCalendar: boolean;
    outlookCalendar: boolean;
  } | null>(null);
  const [emailConnections, setEmailConnections] = useState<EmailConnectionProps[] | null>(null);
  const [calendarConnections, setCalendarConnections] = useState<CalendarConnectionProps[] | null>(null);
  const [connectingEmailProvider, setConnectingEmailProvider] = useState<EmailProvider | null>(null);
  const [disconnectingEmailProvider, setDisconnectingEmailProvider] = useState<EmailProvider | null>(null);
  const [connectingCalendarProvider, setConnectingCalendarProvider] = useState<CalendarProvider | null>(null);
  const [disconnectingCalendarProvider, setDisconnectingCalendarProvider] = useState<CalendarProvider | null>(null);
  // Result banner after landing back here from a provider's OAuth consent
  // page (see lib/emailConnectionService.ts's own header comment — the
  // backend 302s straight to this page with ?email_connected=/
  // ?calendar_connected=&ok=/&error=/&email= rather than a popup message).
  const [connectResultBanner, setConnectResultBanner] = useState<{ ok: boolean; label: string; email?: string; errorCode?: string } | null>(null);

  const loadConnections = useCallback(() => {
    emailConnectionService.listConnections().then(setEmailConnections).catch(() => setEmailConnections([]));
    calendarConnectionService.listConnections().then(setCalendarConnections).catch(() => setCalendarConnections([]));
  }, []);

  useEffect(() => {
    if (loading) return;
    getAppConfig().then(() => {
      setConnectFlags({
        outlookMail: isFeatureEnabled("outlook_inbox_scan"),
        gmail: isFeatureEnabled("gmail_inbox_scan"),
        googleCalendar: isFeatureEnabled("google_calendar_scan"),
        outlookCalendar: isFeatureEnabled("outlook_calendar_scan"),
      });
    });
    loadConnections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // One-time read of the OAuth-callback redirect's query params (see this
  // section's header comment) -- guarded so a later unrelated navigation
  // that happens to keep `searchParams` referentially different doesn't
  // re-show a stale banner. Strips the params from the URL once read so a
  // page refresh doesn't re-trigger it.
  const connectRedirectHandled = useRef(false);
  useEffect(() => {
    if (connectRedirectHandled.current) return;
    const emailProvider = searchParams?.get("email_connected");
    const calendarProvider = searchParams?.get("calendar_connected");
    if (!emailProvider && !calendarProvider) return;
    connectRedirectHandled.current = true;

    const ok = searchParams?.get("ok") === "1";
    const email = searchParams?.get("email") || undefined;
    const errorCode = searchParams?.get("error") || undefined;
    const label = emailProvider
      ? emailProvider === "gmail"
        ? t("web:applications.connectGmail", { defaultValue: "Gmail" })
        : t("web:applications.connectOutlook", { defaultValue: "Outlook" })
      : calendarProvider === "google"
        ? t("web:applications.connectGoogleCalendar", { defaultValue: "Google Calendar" })
        : t("web:applications.connectOutlookCalendar", { defaultValue: "Outlook Calendar" });
    // One-time redirect-result handling (guarded by the `connectRedirectHandled`
    // ref above), same pattern as app/auth/linkedin/callback/page.tsx's own
    // one-shot query-param read.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConnectResultBanner({ ok, label, email, errorCode });
    loadConnections();

    const url = new URL(window.location.href);
    ["email_connected", "calendar_connected", "ok", "email", "error"].forEach((k) => url.searchParams.delete(k));
    router.replace(url.pathname + url.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function onConnectEmail(provider: EmailProvider) {
    if (connectingEmailProvider) return;
    setConnectingEmailProvider(provider);
    try {
      await emailConnectionService.connect(provider);
      // Browser is navigating away to the provider's consent page now --
      // no further state update needed (or reachable) here.
    } catch (err) {
      setConnectingEmailProvider(null);
      setError((err as ApiError).message || t("web:applications.connectFailedDefault", { defaultValue: "Couldn't start that connection right now." }));
    }
  }

  async function onDisconnectEmail(provider: EmailProvider) {
    if (disconnectingEmailProvider) return;
    setDisconnectingEmailProvider(provider);
    try {
      await emailConnectionService.disconnect(provider);
      loadConnections();
    } catch (err) {
      setError((err as ApiError).message || t("web:applications.disconnectFailedDefault", { defaultValue: "Couldn't disconnect right now." }));
    } finally {
      setDisconnectingEmailProvider(null);
    }
  }

  async function onConnectCalendar(provider: CalendarProvider) {
    if (connectingCalendarProvider) return;
    setConnectingCalendarProvider(provider);
    try {
      await calendarConnectionService.connect(provider);
    } catch (err) {
      setConnectingCalendarProvider(null);
      setError((err as ApiError).message || t("web:applications.connectFailedDefault", { defaultValue: "Couldn't start that connection right now." }));
    }
  }

  async function onDisconnectCalendar(provider: CalendarProvider) {
    if (disconnectingCalendarProvider) return;
    setDisconnectingCalendarProvider(provider);
    try {
      await calendarConnectionService.disconnect(provider);
      loadConnections();
    } catch (err) {
      setError((err as ApiError).message || t("web:applications.disconnectFailedDefault", { defaultValue: "Couldn't disconnect right now." }));
    } finally {
      setDisconnectingCalendarProvider(null);
    }
  }

  async function loadApplications() {
    try {
      const [apps, stats] = await Promise.all([
        apiClient.get<Application[]>("/api/v1/tracker/applications"),
        apiClient.get<Analytics>("/api/v1/tracker/analytics"),
      ]);
      setApplications(apps);
      setAnalytics(stats);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setProRequired(true);
      } else {
        setError(apiErr.message || t("web:applications.loadFailedDefault", { defaultValue: "Couldn't load your applications." }));
      }
    }
  }

  useEffect(() => {
    if (loading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!company.trim() || !role.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const created = await apiClient.post<Application>("/api/v1/tracker/applications", {
        company: company.trim(),
        role: role.trim(),
        location: location.trim(),
        stage: "Applied",
      });
      setApplications((prev) => (prev ? [created, ...prev] : [created]));
      setCompany("");
      setRole("");
      setLocation("");
      setShowAddForm(false);
      loadApplications();
    } catch (err) {
      setError((err as ApiError).message || t("web:applications.addFailedDefault", { defaultValue: "Couldn't add that application right now." }));
    } finally {
      setAdding(false);
    }
  }

  async function handleStageChange(app: Application, stage: Stage) {
    setApplications((prev) => (prev ? prev.map((a) => (a.id === app.id ? { ...a, stage, status: stage } : a)) : prev));
    try {
      await apiClient.patch(`/api/v1/tracker/applications/${app.id}`, { stage });
      loadApplications();
    } catch (err) {
      setError((err as ApiError).message || t("web:applications.updateFailedDefault", { defaultValue: "Couldn't update that application right now." }));
    }
  }

  async function handleDelete(app: Application) {
    setApplications((prev) => (prev ? prev.filter((a) => a.id !== app.id) : prev));
    try {
      await apiClient.delete(`/api/v1/tracker/applications/${app.id}`);
      loadApplications();
    } catch (err) {
      setError((err as ApiError).message || t("web:applications.deleteFailedDefault", { defaultValue: "Couldn't delete that application right now." }));
    }
  }

  async function handleParseEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailText.trim()) return;
    setParsingEmail(true);
    setError(null);
    setEmailResult(null);
    try {
      const data = await apiClient.post<{ application: Application; matched_existing: boolean }>(
        "/api/v1/tracker/applications/parse-email",
        { email_text: emailText }
      );
      setEmailResult(
        data.matched_existing
          ? t("web:applications.emailMatchedExisting", { defaultValue: "Updated your existing {{company}} application to {{stage}}.", company: data.application.company, stage: stageLabel(t, data.application.stage) })
          : t("web:applications.emailCreatedNew", { defaultValue: "Added a new application for {{company}}.", company: data.application.company })
      );
      setEmailText("");
      loadApplications();
    } catch (err) {
      setError((err as ApiError).message || t("web:applications.parseEmailFailedDefault", { defaultValue: "Couldn't read that email right now." }));
    } finally {
      setParsingEmail(false);
    }
  }

  async function handleDraftFollowup(app: Application) {
    setDraftFor(app.id);
    setDraft(null);
    setError(null);
    try {
      const data = await apiClient.post<{ subject: string; body: string }>(`/api/v1/tracker/applications/${app.id}/draft-followup`);
      setDraft({ id: app.id, ...data });
    } catch (err) {
      setError((err as ApiError).message || t("web:applications.draftFailedDefault", { defaultValue: "Couldn't generate a follow-up draft right now." }));
    } finally {
      setDraftFor(null);
    }
  }

  const active = (applications ?? []).filter((a) => a.stage === "Applied" || a.stage === "Interviewing");
  const closed = (applications ?? []).filter((a) => a.stage === "Offer" || a.stage === "Rejected");

  // ---- Practice History state ----
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");

  useEffect(() => {
    if (loading) return;
    (async () => {
      try {
        const data = await apiClient.get<Session[]>("/api/v1/interviews/sessions");
        setSessions(data);
      } catch (err) {
        setHistoryError((err as ApiError).message || t("web:practice.history.loadFailedDefault", { defaultValue: "Couldn't load your practice history." }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  function sessionTypeLabel(type: string) {
    return t(`web:practice.mockInterviews.types.${type}`, { defaultValue: fallbackLabelFor(type) });
  }

  const hq = historyQuery.trim().toLowerCase();
  const filteredSessions = useMemo(
    () =>
      (sessions ?? []).filter((s) => {
        if (!hq) return true;
        return [sessionTypeLabel(s.type), s.company, s.role, s.mode, s.difficulty].filter(Boolean).join(" ").toLowerCase().includes(hq);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, hq]
  );

  const isSessionPastDue = (s: Session) => {
    const startMs = Date.parse(s.started_at);
    const endMs = startMs + (s.duration_min ?? 30) * 60 * 1000;
    return Date.now() > endMs;
  };

  const upcomingSessions = filteredSessions.filter((s) => ["scheduled", "in_progress"].includes((s.status || "").toLowerCase()) && !isSessionPastDue(s));
  const pastSessions = filteredSessions.filter((s) => !upcomingSessions.includes(s));

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title={t("web:applications.pageTitle", { defaultValue: "Interviews" })}
              subtitle={t("web:applications.pageSubtitle", { defaultValue: "Track every application you've sent, and revisit your past practice sessions." })}
            />
            {tab === "applications" && !proRequired && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowEmailForm((s) => !s)}>
                  <EvaIcon name="email-outline" size={16} />
                  {t("web:applications.addFromEmail", { defaultValue: "Add from email" })}
                </Button>
                <Button size="sm" onClick={() => setShowAddForm((s) => !s)}>
                  <EvaIcon name="plus-outline" size={16} />
                  {t("web:applications.addApplication", { defaultValue: "Add application" })}
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Pill selected={tab === "applications"} onClick={() => setTab("applications")}>
              {t("web:applications.tabs.applications", { defaultValue: "Applications" })}
            </Pill>
            <Pill selected={tab === "history"} onClick={() => setTab("history")}>
              {t("web:applications.tabs.history", { defaultValue: "Practice History" })}
            </Pill>
          </div>

          {tab === "applications" ? (
            <>
              {!proRequired && (
                <ConnectInboxSection
                  flags={connectFlags}
                  emailConnections={emailConnections}
                  calendarConnections={calendarConnections}
                  connectingEmailProvider={connectingEmailProvider}
                  disconnectingEmailProvider={disconnectingEmailProvider}
                  connectingCalendarProvider={connectingCalendarProvider}
                  disconnectingCalendarProvider={disconnectingCalendarProvider}
                  onConnectEmail={onConnectEmail}
                  onDisconnectEmail={onDisconnectEmail}
                  onConnectCalendar={onConnectCalendar}
                  onDisconnectCalendar={onDisconnectCalendar}
                  resultBanner={connectResultBanner}
                  onDismissBanner={() => setConnectResultBanner(null)}
                />
              )}

              {proRequired && (
                <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                    <EvaIcon name="lock-outline" size={20} />
                  </span>
                  <h2 className="font-semibold text-primary">{t("web:applications.proRequiredTitle", { defaultValue: "Application Tracker requires a paid plan" })}</h2>
                  <p className="text-sm text-hint">{t("web:applications.proRequiredSubtitle", { defaultValue: "Upgrade to Saveur Basic or above to track applications, parse emails, and get AI follow-up drafts." })}</p>
                </div>
              )}

              {error && <p className="text-sm text-danger">{error}</p>}

              {applications === null && !proRequired && !error && <SkeletonRows count={4} />}

              {showAddForm && !proRequired && (
                <form onSubmit={handleAdd} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6 sm:flex-row sm:items-end sm:flex-wrap">
                  <TextField label={t("web:applications.companyLabel", { defaultValue: "Company" })} value={company} onChange={(e) => setCompany(e.target.value)} required className="sm:w-48" />
                  <TextField label={t("web:applications.roleLabel", { defaultValue: "Role" })} value={role} onChange={(e) => setRole(e.target.value)} required className="sm:w-48" />
                  <TextField label={t("web:applications.locationLabel", { defaultValue: "Location (optional)" })} value={location} onChange={(e) => setLocation(e.target.value)} className="sm:w-48" />
                  <Button type="submit" disabled={adding || !company.trim() || !role.trim()}>
                    {adding ? t("common:actions.saving", { defaultValue: "Saving…" }) : t("common:actions.add", { defaultValue: "Add" })}
                  </Button>
                </form>
              )}

              {showEmailForm && !proRequired && (
                <form onSubmit={handleParseEmail} className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-6">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-primary">{t("web:applications.emailTextLabel", { defaultValue: "Paste the application-related email" })}</span>
                    <textarea
                      value={emailText}
                      onChange={(e) => setEmailText(e.target.value)}
                      rows={6}
                      placeholder={t("web:applications.emailTextPlaceholder", { defaultValue: "Paste a confirmation, interview invite, rejection, or offer email…" })}
                      className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                  </label>
                  {emailResult && <p className="text-sm text-brand">{emailResult}</p>}
                  <Button type="submit" disabled={parsingEmail || !emailText.trim()} className="w-fit">
                    {parsingEmail ? t("web:applications.parsing", { defaultValue: "Reading…" }) : t("web:applications.parseEmail", { defaultValue: "Parse email" })}
                  </Button>
                </form>
              )}

              {analytics && analytics.total > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-card border border-border bg-surface-2 p-4 text-center">
                    <p className="text-xl font-bold text-primary">{analytics.total}</p>
                    <p className="mt-1 text-xs text-hint">{t("web:applications.totalTracked", { defaultValue: "Tracked" })}</p>
                  </div>
                  <div className="rounded-card border border-border bg-surface-2 p-4 text-center">
                    <p className="text-xl font-bold text-primary">{analytics.response_rate ?? "—"}{analytics.response_rate !== null ? "%" : ""}</p>
                    <p className="mt-1 text-xs text-hint">{t("web:applications.responseRate", { defaultValue: "Response rate" })}</p>
                  </div>
                  <div className="rounded-card border border-border bg-surface-2 p-4 text-center">
                    <p className="text-xl font-bold text-primary">{analytics.avg_days_to_interview ?? "—"}</p>
                    <p className="mt-1 text-xs text-hint">{t("web:applications.avgDaysToInterview", { defaultValue: "Avg. days to interview" })}</p>
                  </div>
                  <div className="rounded-card border border-border bg-surface-2 p-4 text-center">
                    <p className="text-xl font-bold text-primary">{analytics.stale_applications.length}</p>
                    <p className="mt-1 text-xs text-hint">{t("web:applications.staleApplications", { defaultValue: "Gone quiet" })}</p>
                  </div>
                </div>
              )}

              {applications && applications.length === 0 && !proRequired && (
                <EmptyState
                  illustration="list"
                  title={t("web:applications.empty", { defaultValue: "No applications tracked yet — add one above to get started." })}
                />
              )}

              {[
                { label: t("web:applications.active", { defaultValue: "Active" }), items: active },
                { label: t("web:applications.closed", { defaultValue: "Closed" }), items: closed },
              ].map(
                (section) =>
                  section.items.length > 0 && (
                    <div key={section.label} className="flex flex-col gap-3">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">{section.label}</h2>
                      {section.items.map((app) => (
                        <div key={app.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tint-mint text-tint-mint-text font-semibold">
                                {app.company?.[0]?.toUpperCase() || "?"}
                              </span>
                              <div>
                                <h3 className="font-medium text-primary">{app.role}</h3>
                                <p className="text-sm text-hint">
                                  {app.company}
                                  {app.location ? ` · ${app.location}` : ""}
                                </p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center rounded-pill px-2.5 py-1 text-xs font-medium ${stageColor(app.stage)}`}>
                              {stageLabel(t, app.stage)}
                            </span>
                          </div>

                          {app.next_step && <p className="text-sm text-hint">{t("web:applications.nextStepPrefix", { defaultValue: "Next: {{step}}", step: app.next_step })}</p>}

                          <div className="flex flex-wrap items-center gap-2">
                            <SelectField
                              label=""
                              value={app.stage}
                              onChange={(e) => handleStageChange(app, e.target.value as Stage)}
                              className="!py-1.5 !text-xs w-auto"
                            >
                              {STAGES.map((s) => (
                                <option key={s} value={s}>
                                  {stageLabel(t, s)}
                                </option>
                              ))}
                            </SelectField>
                            <Button variant="outline" size="sm" onClick={() => handleDraftFollowup(app)} disabled={draftFor === app.id}>
                              {draftFor === app.id ? t("web:applications.drafting", { defaultValue: "Drafting…" }) : t("web:applications.draftFollowup", { defaultValue: "Draft follow-up" })}
                            </Button>
                            <button
                              type="button"
                              onClick={() => handleDelete(app)}
                              aria-label={t("common:actions.delete", { defaultValue: "Delete" })}
                              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-hint transition hover:bg-surface-3 hover:text-danger"
                            >
                              <EvaIcon name="trash-2-outline" size={16} />
                            </button>
                          </div>

                          {draft && draft.id === app.id && (
                            <div className="rounded-lg bg-surface-1 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-hint">{draft.subject}</p>
                              <p className="mt-1 whitespace-pre-wrap text-sm text-primary">{draft.body}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
              )}
            </>
          ) : (
            <>
              {historyError && <p className="text-sm text-danger">{historyError}</p>}

              {sessions === null && !historyError && <SkeletonRows count={4} />}

              {sessions && sessions.length > 0 && (
                <input
                  type="text"
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  placeholder={t("web:practice.history.searchPlaceholder", { defaultValue: "Search by type, mode, or company…" })}
                  className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              )}

              {sessions && sessions.length === 0 && (
                <EmptyState
                  illustration="list"
                  title={t("web:practice.history.empty", { defaultValue: "No sessions yet — start a mock interview to see it here." })}
                />
              )}

              {sessions && sessions.length > 0 && filteredSessions.length === 0 && (
                <EmptyState
                  illustration="search"
                  title={t("web:practice.history.noMatch", { defaultValue: "No sessions match your search." })}
                />
              )}

              {upcomingSessions.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">{t("web:practice.history.upcoming", { defaultValue: "Upcoming" })}</h2>
                  {upcomingSessions.map((s) => (
                    <SessionRow key={s.id} session={s} typeLabel={sessionTypeLabel} />
                  ))}
                </div>
              )}

              {pastSessions.length > 0 && (
                <div className="flex flex-col gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">{t("web:practice.history.past", { defaultValue: "Past" })}</h2>
                  {pastSessions.map((s) => (
                    <SessionRow key={s.id} session={s} typeLabel={sessionTypeLabel} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}

// Mirrors mobile's PracticeSessionItem.tsx onPress routing: a Completed
// session opens its real feedback; a not-yet-taken session (Scheduled /
// in_progress) can't show feedback that doesn't exist yet (mobile's
// InterviewFeedback screen would call completeSession on mount and
// silently mark it "Completed" with a fake score — the web detail page
// deliberately doesn't do that), so it routes into the setup flow instead,
// pre-filled with the same interview type, matching mobile's
// `navigate('MockInterviewSetup', {interviewType: item.interviewType})`.
function sessionHref(session: Session): string {
  if ((session.status || "").toLowerCase() === "completed") {
    return `/practice/session/${session.id}`;
  }
  const typeDef = INTERVIEW_TYPES.find((td) => td.wire === session.type);
  const slug = typeDef ? interviewTypeSlug(typeDef.label) : undefined;
  return slug ? `/practice/mock-interviews?type=${slug}` : "/practice/mock-interviews";
}

function SessionRow({ session, typeLabel }: { session: Session; typeLabel: (t: string) => string }) {
  const { t } = useTranslation();
  const scorePct = session.overall_score != null ? Math.round(session.overall_score) : null;
  return (
    <Link
      href={sessionHref(session)}
      className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface-2 p-4 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
          <EvaIcon name={session.has_video ? "mic-outline" : "clipboard-outline"} size={18} />
        </span>
        <div>
          <h3 className="font-medium text-primary">
            {typeLabel(session.type)}
            {session.company ? ` · ${session.company}` : ""}
          </h3>
          <p className="text-sm text-hint">
            {formatSessionDate(session.started_at)}
            {session.duration_min ? ` · ${t("web:practice.history.durationMin", { defaultValue: "{{min}} min", min: session.duration_min })}` : ""}
          </p>
        </div>
      </div>
      {scorePct != null && (
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint-mint text-xs font-semibold text-tint-mint-text">
          {scorePct}%
        </span>
      )}
    </Link>
  );
}

// "Connect your inbox or calendar" — web counterpart to Saveur/src/requests/
// Applications/AddFromEmail.tsx's connector cards (see that file's own
// module comment for the full product history: real auto-detect on top of
// the permanent paste-email fallback above/below this section). Self-hides
// entirely if every provider's admin flag is off (fresh/not-yet-launched
// install) or the flags haven't loaded yet, same as mobile's
// `anyConnectRowVisible` gate.
function ConnectInboxSection({
  flags,
  emailConnections,
  calendarConnections,
  connectingEmailProvider,
  disconnectingEmailProvider,
  connectingCalendarProvider,
  disconnectingCalendarProvider,
  onConnectEmail,
  onDisconnectEmail,
  onConnectCalendar,
  onDisconnectCalendar,
  resultBanner,
  onDismissBanner,
}: {
  flags: { outlookMail: boolean; gmail: boolean; googleCalendar: boolean; outlookCalendar: boolean } | null;
  emailConnections: EmailConnectionProps[] | null;
  calendarConnections: CalendarConnectionProps[] | null;
  connectingEmailProvider: EmailProvider | null;
  disconnectingEmailProvider: EmailProvider | null;
  connectingCalendarProvider: CalendarProvider | null;
  disconnectingCalendarProvider: CalendarProvider | null;
  onConnectEmail: (p: EmailProvider) => void;
  onDisconnectEmail: (p: EmailProvider) => void;
  onConnectCalendar: (p: CalendarProvider) => void;
  onDisconnectCalendar: (p: CalendarProvider) => void;
  resultBanner: { ok: boolean; label: string; email?: string; errorCode?: string } | null;
  onDismissBanner: () => void;
}) {
  const { t } = useTranslation();

  const rows: React.ReactNode[] = [];
  if (flags?.outlookMail) {
    const conn = emailConnections?.find((c) => c.provider === "outlook") ?? null;
    rows.push(
      <ConnectorCard
        key="outlook"
        logoKey="outlook_mail"
        label={t("web:applications.connectOutlook", { defaultValue: "Outlook" })}
        subtitle={t("web:applications.connectOutlookSubtitle", { defaultValue: "Automatically detect application updates in your Outlook inbox." })}
        connectedAs={conn?.isActive ? conn.emailAddress : null}
        isConnecting={connectingEmailProvider === "outlook"}
        isDisconnecting={disconnectingEmailProvider === "outlook"}
        onConnect={() => onConnectEmail("outlook")}
        onDisconnect={() => onDisconnectEmail("outlook")}
      />
    );
  }
  if (flags?.gmail) {
    const conn = emailConnections?.find((c) => c.provider === "gmail") ?? null;
    rows.push(
      <ConnectorCard
        key="gmail"
        logoKey="gmail"
        label={t("web:applications.connectGmail", { defaultValue: "Gmail" })}
        subtitle={t("web:applications.connectGmailSubtitle", { defaultValue: "Automatically detect application updates in your Gmail inbox." })}
        connectedAs={conn?.isActive ? conn.emailAddress : null}
        isConnecting={connectingEmailProvider === "gmail"}
        isDisconnecting={disconnectingEmailProvider === "gmail"}
        onConnect={() => onConnectEmail("gmail")}
        onDisconnect={() => onDisconnectEmail("gmail")}
      />
    );
  }
  if (flags?.googleCalendar) {
    const conn = calendarConnections?.find((c) => c.provider === "google") ?? null;
    rows.push(
      <ConnectorCard
        key="google-calendar"
        logoKey="google_calendar"
        label={t("web:applications.connectGoogleCalendar", { defaultValue: "Google Calendar" })}
        subtitle={t("web:applications.connectCalendarSubtitle", { defaultValue: "See interview invites and manage your schedule." })}
        connectedAs={conn?.isActive ? conn.emailAddress : null}
        isConnecting={connectingCalendarProvider === "google"}
        isDisconnecting={disconnectingCalendarProvider === "google"}
        onConnect={() => onConnectCalendar("google")}
        onDisconnect={() => onDisconnectCalendar("google")}
      />
    );
  }
  if (flags?.outlookCalendar) {
    const conn = calendarConnections?.find((c) => c.provider === "outlook") ?? null;
    rows.push(
      <ConnectorCard
        key="outlook-calendar"
        logoKey="outlook_calendar"
        label={t("web:applications.connectOutlookCalendar", { defaultValue: "Outlook Calendar" })}
        subtitle={t("web:applications.connectCalendarSubtitle", { defaultValue: "See interview invites and manage your schedule." })}
        connectedAs={conn?.isActive ? conn.emailAddress : null}
        isConnecting={connectingCalendarProvider === "outlook"}
        isDisconnecting={disconnectingCalendarProvider === "outlook"}
        onConnect={() => onConnectCalendar("outlook")}
        onDisconnect={() => onDisconnectCalendar("outlook")}
      />
    );
  }

  if (rows.length === 0 && !resultBanner) return null;

  return (
    <div className="flex flex-col gap-3">
      {resultBanner && (
        <div
          className={`flex items-start justify-between gap-3 rounded-card border p-4 text-sm ${
            resultBanner.ok ? "border-tint-mint/40 bg-tint-mint/10 text-tint-mint-text" : "border-danger/40 bg-danger/10 text-danger"
          }`}
        >
          <span>
            {resultBanner.ok
              ? t("web:applications.connectSucceeded", {
                  defaultValue: "{{provider}} connected{{email}}.",
                  provider: resultBanner.label,
                  email: resultBanner.email ? ` — ${resultBanner.email}` : "",
                })
              : t("web:applications.connectFailed", {
                  defaultValue: "Couldn't connect {{provider}}. {{code}}",
                  provider: resultBanner.label,
                  code: resultBanner.errorCode ?? "",
                })}
          </span>
          <button type="button" onClick={onDismissBanner} aria-label={t("common:actions.dismiss", { defaultValue: "Dismiss" })} className="shrink-0 opacity-70 hover:opacity-100">
            <EvaIcon name="close-outline" size={16} />
          </button>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div>
            <h2 className="text-sm font-semibold text-primary">{t("web:applications.connectSectionTitle", { defaultValue: "Connect your inbox or calendar" })}</h2>
            <p className="mt-1 text-sm text-hint">
              {t("web:applications.connectSectionBody", {
                defaultValue: "Automatically track application emails and interview invites as they arrive — no copy-pasting. We only read job-related messages/events; everything else is left alone.",
              })}
            </p>
          </div>
          <div className="flex flex-col gap-2">{rows}</div>
        </>
      )}
    </div>
  );
}

function ConnectorCard({
  logoKey,
  label,
  subtitle,
  connectedAs,
  isConnecting,
  isDisconnecting,
  onConnect,
  onDisconnect,
}: {
  logoKey: keyof typeof PROVIDER_LOGO_DOMAIN;
  label: string;
  subtitle: string;
  connectedAs: string | null | undefined;
  isConnecting: boolean;
  isDisconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const { t } = useTranslation();
  const isConnected = !!connectedAs;
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface-2 p-4">
      <CompanyLogoAvatar logoUrl={providerLogoUrl(logoKey)} companyName={label} size={36} />
      <div className="min-w-0 flex-1">
        <h3 className="font-medium text-primary">{label}</h3>
        <p className="truncate text-sm text-hint">
          {isConnected
            ? t("web:applications.connectedAs", { defaultValue: "Connected — {{email}}", email: connectedAs })
            : subtitle}
        </p>
      </div>
      {isConnected ? (
        isDisconnecting ? (
          <span className="inline-flex h-8 w-8 shrink-0 animate-spin items-center justify-center rounded-full border-2 border-hint border-t-transparent" />
        ) : (
          <Button variant="outline" size="sm" onClick={onDisconnect}>
            {t("web:applications.disconnect", { defaultValue: "Disconnect" })}
          </Button>
        )
      ) : isConnecting ? (
        <span className="inline-flex h-8 w-8 shrink-0 animate-spin items-center justify-center rounded-full border-2 border-hint border-t-transparent" />
      ) : (
        <Button variant="outline" size="sm" onClick={onConnect}>
          {t("web:applications.connect", { defaultValue: "Connect" })}
        </Button>
      )}
    </div>
  );
}

// useSearchParams() requires a Suspense boundary in the app router (same
// pattern as app/practice/mock-interviews/page.tsx).
export default function InterviewsPage() {
  return (
    <Suspense fallback={null}>
      <InterviewsPageInner />
    </Suspense>
  );
}
