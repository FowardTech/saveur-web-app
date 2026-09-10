"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/tracker.py
// (Blueprint url_prefix "/api/v1/tracker")
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

export default function ApplicationTrackerPage() {
  const { t } = useTranslation();
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

  async function loadAll() {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      loadAll();
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
      loadAll();
    } catch (err) {
      setError((err as ApiError).message || t("web:applications.updateFailedDefault", { defaultValue: "Couldn't update that application right now." }));
    }
  }

  async function handleDelete(app: Application) {
    setApplications((prev) => (prev ? prev.filter((a) => a.id !== app.id) : prev));
    try {
      await apiClient.delete(`/api/v1/tracker/applications/${app.id}`);
      loadAll();
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
      loadAll();
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

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-8 pb-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title={t("web:applications.title", { defaultValue: "Application Tracker" })}
              subtitle={t("web:applications.subtitle", { defaultValue: "Track every job you've applied for, all the way to offer." })}
            />
            {!proRequired && (
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
            <p className="text-sm text-hint">{t("web:applications.empty", { defaultValue: "No applications tracked yet — add one above to get started." })}</p>
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
        </div>
      </AppShell>
    </RequireAuth>
  );
}
