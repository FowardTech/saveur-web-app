"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";
import { guessCompanyLogoUrl } from "@/lib/companyData";
import apiClient, { type ApiError } from "@/lib/apiClient";
import { useAuth } from "@/app/providers/AuthProvider";
import { JobAlertCard } from "@/components/jobAlerts/JobAlertCard";

// Real backend contract — Saveur-Backend/app/api/job_alerts.py
//   GET  /api/v1/job-alerts -> {data: JobAlert[], next_cursor: string | null}
//   POST /api/v1/job-alerts/refresh -> kicks a background discovery run
//   POST /api/v1/job-alerts/read -> marks alerts read (mirrors career-events)
//   POST /api/v1/job-alerts/<id>/pin -> {pinned?: bool} toggles pin
// Preferences (target roles/countries) are edited via PATCH /api/v1/users/me
// (desired_roles/preferred_countries) — same fields Settings > Profile uses,
// per app/api/users.py's update_me() and job_role_country_caps' per-tier caps.
//
// Mobile parity (src/more/JobAlerts.tsx): cards ignored `company_logo_url`
// entirely (generic letter-avatar instead of CompanyLogoAvatar, same class
// of bug career events had), the pinned star used a nonexistent "star" icon
// name (only "star-outline" is generated — see lib/eva-icons.generated.ts —
// so this silently rendered the icon-not-found placeholder), and there was
// no unread "New" badge/purple-border treatment or working pin toggle at
// all despite the backend already supporting both.
interface JobAlert {
  id: string;
  title: string;
  company: string;
  location?: string;
  source?: string;
  matched_role?: string;
  apply_url?: string;
  posted_at?: string;
  read: boolean;
  pinned: boolean;
  applied?: boolean;
  company_logo_url?: string;
}

function JobAlertsPageInner() {
  const { t } = useTranslation();
  const { profile, updateProfile, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  // "Users should be able to click on the job pill and it should take the
  // user to a page that lists the jobs fetched for that company" — deep
  // link from the Dream Company Dashboard's "N open jobs" badge
  // (app/career/dream-companies/page.tsx, ?company=<name>). Client-side
  // filter only (no matching backend query param) since GET /job-alerts
  // already returns the user's full list in one page.
  const companyFilter = searchParams.get("company");
  const [alerts, setAlerts] = useState<JobAlert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proRequired, setProRequired] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rolesText, setRolesText] = useState("");
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [togglingPinId, setTogglingPinId] = useState<string | null>(null);
  // Product request: "See the Job Page too I like the layout and structure"
  // [resume.io's /app/job-search — a Recommended/Search toggle above the
  // list]. Client-side only: GET /api/v1/job-alerts already returns the
  // user's full alert list in one page and there's no backend search
  // endpoint to call into, so "Search" here just re-filters what's already
  // been fetched by title/company/location rather than issuing a new request.
  const [viewMode, setViewMode] = useState<"recommended" | "search">("recommended");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Syncs the roles text field from the async-loaded profile once it
    // arrives — can't be a lazy useState initializer since `profile` is
    // still null on first render while the backend call is in flight.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (profile) setRolesText((profile.desiredRoles || []).join(", "));
  }, [profile]);

  async function load() {
    try {
      const data = await apiClient.get<{ data: JobAlert[] }>("/api/v1/job-alerts");
      setAlerts(data.data);
      const unreadIds = data.data.filter((a) => !a.read).map((a) => a.id);
      if (unreadIds.length) {
        apiClient.post("/api/v1/job-alerts/read", { ids: unreadIds }).catch(() => {});
      }
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setProRequired(true);
      } else {
        setError(apiErr.message || t("web:jobAlerts.loadFailedDefault", { defaultValue: "Couldn't load your job alerts." }));
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

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await apiClient.post("/api/v1/job-alerts/refresh");
      await load();
    } catch (err) {
      setError((err as ApiError).message || t("web:jobAlerts.refreshFailedDefault", { defaultValue: "Couldn't refresh alerts right now." }));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleTogglePin(alert: JobAlert) {
    if (togglingPinId) return;
    setTogglingPinId(alert.id);
    try {
      await apiClient.post(`/api/v1/job-alerts/${alert.id}/pin`, { pinned: !alert.pinned });
      setAlerts((prev) => (prev ? prev.map((a) => (a.id === alert.id ? { ...a, pinned: !a.pinned } : a)) : prev));
    } catch {
      // no-op — the pin just stays as-is if this fails
    } finally {
      setTogglingPinId(null);
    }
  }

  // Local state update once JobAlertCard's DidYouApplyModal flow confirms a
  // POST /api/v1/application-tracker entry — mirrors handleTogglePin's
  // optimistic-patch pattern so the "Applied" badge appears immediately
  // without refetching the whole list.
  function handleMarkApplied(id: string) {
    setAlerts((prev) => (prev ? prev.map((a) => (a.id === id ? { ...a, applied: true } : a)) : prev));
  }

  const visibleAlerts = useMemo(() => {
    if (!alerts) return alerts;
    if (!companyFilter) return alerts;
    return alerts.filter((a) => a.company.toLowerCase() === companyFilter.toLowerCase());
  }, [alerts, companyFilter]);

  const displayedAlerts = useMemo(() => {
    if (!visibleAlerts) return visibleAlerts;
    if (viewMode !== "search" || !searchQuery.trim()) return visibleAlerts;
    const q = searchQuery.trim().toLowerCase();
    return visibleAlerts.filter(
      (a) => a.title.toLowerCase().includes(q) || a.company.toLowerCase().includes(q) || (a.location || "").toLowerCase().includes(q)
    );
  }, [visibleAlerts, viewMode, searchQuery]);

  async function handleSavePreferences(e: React.FormEvent) {
    e.preventDefault();
    setSavingPrefs(true);
    try {
      const roles = rolesText
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);
      await updateProfile({ desiredRoles: roles });
    } catch (err) {
      setError((err as ApiError).message || t("web:jobAlerts.saveFailedDefault", { defaultValue: "Couldn't save your preferences." }));
    } finally {
      setSavingPrefs(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title={t("web:jobAlerts.title", { defaultValue: "Job Alerts" })}
              subtitle={t("web:jobAlerts.subtitle", { defaultValue: "Daily matches for your target roles." })}
            />
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || proRequired}>
              {refreshing ? t("web:jobAlerts.refreshing", { defaultValue: "Refreshing…" }) : t("web:jobAlerts.refreshAlerts", { defaultValue: "Refresh alerts" })}
            </Button>
          </div>

          {proRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:jobAlerts.proRequiredTitle", { defaultValue: "Job Alerts requires a paid plan" })}</h2>
              <p className="text-sm text-hint">{t("web:jobAlerts.proRequiredSubtitle", { defaultValue: "Upgrade to Saveur Basic or above to get daily job matches." })}</p>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          {companyFilter && (
            <div className="flex items-center justify-between gap-3 rounded-card border border-dashed border-border p-3 text-sm">
              <span className="text-hint">
                {t("web:jobAlerts.filteredByCompany", { defaultValue: "Showing alerts for {{company}}", company: companyFilter })}
              </span>
              <Link href="/job-alerts" className="font-semibold text-link hover:underline">
                {t("web:jobAlerts.clearFilter", { defaultValue: "Clear filter" })}
              </Link>
            </div>
          )}

          <form onSubmit={handleSavePreferences} className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-5 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-sm font-medium text-primary">{t("web:jobAlerts.targetRolesLabel", { defaultValue: "Target roles (comma-separated)" })}</span>
              <input
                type="text"
                value={rolesText}
                onChange={(e) => setRolesText(e.target.value)}
                placeholder={t("web:jobAlerts.targetRolesPlaceholder", { defaultValue: "e.g. Backend Engineer, Product Manager" })}
                className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <Button type="submit" size="md" disabled={savingPrefs}>
              {savingPrefs ? t("web:jobAlerts.saving", { defaultValue: "Saving…" }) : t("web:jobAlerts.save", { defaultValue: "Save" })}
            </Button>
          </form>

          {alerts !== null && !proRequired && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex w-fit rounded-pill border border-border bg-surface-2 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("recommended")}
                  className={`rounded-pill px-4 py-1.5 text-sm font-semibold transition ${
                    viewMode === "recommended" ? "bg-brand text-white" : "text-hint hover:text-primary"
                  }`}
                >
                  {t("web:jobAlerts.recommendedTab", { defaultValue: "Recommended" })}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("search")}
                  className={`rounded-pill px-4 py-1.5 text-sm font-semibold transition ${
                    viewMode === "search" ? "bg-brand text-white" : "text-hint hover:text-primary"
                  }`}
                >
                  {t("web:jobAlerts.searchTab", { defaultValue: "Search" })}
                </button>
              </div>
              {viewMode === "search" && (
                <div className="relative w-full sm:max-w-xs">
                  <EvaIcon name="search-outline" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hint" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("web:jobAlerts.searchPlaceholder", { defaultValue: "Search title, company, or location" }).toString()}
                    className="w-full rounded-pill border border-border bg-surface-1 py-2 pl-9 pr-3.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
              )}
            </div>
          )}

          {alerts === null && !proRequired && !error && <SkeletonRows count={5} />}

          {displayedAlerts && displayedAlerts.length === 0 && !proRequired && (
            <EmptyState
              illustration={companyFilter || (viewMode === "search" && searchQuery.trim()) ? "search" : "list"}
              title={
                companyFilter
                  ? t("web:jobAlerts.emptyForCompany", { defaultValue: "No open job alerts for {{company}} yet.", company: companyFilter })
                  : viewMode === "search" && searchQuery.trim()
                    ? t("web:jobAlerts.emptyForSearch", { defaultValue: "No alerts match \"{{query}}\".", query: searchQuery.trim() })
                    : t("web:jobAlerts.empty", { defaultValue: "No job alerts yet — check back after your next refresh." })
              }
            />
          )}

          {displayedAlerts && displayedAlerts.length > 0 && (
            <div className="flex flex-col gap-3">
              {displayedAlerts.map((a, index) => {
                // Backend (Saveur-Backend/app/services/company_logo_service.py)
                // only reliably fills company_logo_url when a company domain
                // was confidently resolved at discovery time — many rows,
                // especially older ones, simply have it null. Falls back to
                // the same geticon.dev domain-guess CompanyLogoAvatar's
                // mock-interview company picker already uses
                // (lib/companyData.ts) so most real companies still get a
                // reasonable logo instead of the generic briefcase icon.
                const logoUrl = a.company_logo_url ?? guessCompanyLogoUrl(a.company);
                return (
                  <JobAlertCard
                    key={a.id}
                    alert={a}
                    logoUrl={logoUrl}
                    togglingPin={togglingPinId === a.id}
                    onTogglePin={handleTogglePin}
                    onMarkApplied={handleMarkApplied}
                    animationDelayMs={index * 40}
                  />
                );
              })}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}

// useSearchParams() requires a Suspense boundary in the app router (same
// pattern as app/practice/mock-interviews/page.tsx).
export default function JobAlertsPage() {
  return (
    <Suspense fallback={null}>
      <JobAlertsPageInner />
    </Suspense>
  );
}
