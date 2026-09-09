"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import apiClient, { type ApiError } from "@/lib/apiClient";
import { useAuth } from "@/app/providers/AuthProvider";

// Real backend contract — Saveur-Backend/app/api/job_alerts.py
//   GET  /api/v1/job-alerts -> {data: JobAlert[], next_cursor: string | null}
//   POST /api/v1/job-alerts/refresh -> kicks a background discovery run
// Preferences (target roles/countries) are edited via PATCH /api/v1/users/me
// (desired_roles/preferred_countries) — same fields Settings > Profile uses,
// per app/api/users.py's update_me() and job_role_country_caps' per-tier caps.
interface JobAlert {
  id: string;
  title: string;
  company: string;
  location?: string;
  apply_url?: string;
  posted_at?: string;
  read: boolean;
  pinned: boolean;
  company_logo_url?: string;
}

export default function JobAlertsPage() {
  const { profile, updateProfile } = useAuth();
  const [alerts, setAlerts] = useState<JobAlert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proRequired, setProRequired] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rolesText, setRolesText] = useState("");
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (profile) setRolesText((profile.desiredRoles || []).join(", "));
  }, [profile]);

  async function load() {
    try {
      const data = await apiClient.get<{ data: JobAlert[] }>("/api/v1/job-alerts");
      setAlerts(data.data);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setProRequired(true);
      } else {
        setError(apiErr.message || "Couldn't load your job alerts.");
      }
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await apiClient.post("/api/v1/job-alerts/refresh");
      await load();
    } catch (err) {
      setError((err as ApiError).message || "Couldn't refresh alerts right now.");
    } finally {
      setRefreshing(false);
    }
  }

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
      setError((err as ApiError).message || "Couldn't save your preferences.");
    } finally {
      setSavingPrefs(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-8 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PageHeader title="Job Alerts" subtitle="Daily matches for your target roles." />
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || proRequired}>
            {refreshing ? "Refreshing…" : "Refresh alerts"}
          </Button>
        </div>

        {proRequired && (
          <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
              <EvaIcon name="lock-outline" size={20} />
            </span>
            <h2 className="font-semibold text-primary">Job Alerts requires a paid plan</h2>
            <p className="text-sm text-hint">Upgrade to Saveur Basic or above to get daily job matches.</p>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <form onSubmit={handleSavePreferences} className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-5 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium text-primary">Target roles (comma-separated)</span>
            <input
              type="text"
              value={rolesText}
              onChange={(e) => setRolesText(e.target.value)}
              placeholder="e.g. Backend Engineer, Product Manager"
              className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </label>
          <Button type="submit" size="md" disabled={savingPrefs}>
            {savingPrefs ? "Saving…" : "Save"}
          </Button>
        </form>

        {alerts && alerts.length === 0 && !proRequired && (
          <p className="text-sm text-hint">No job alerts yet — check back after your next refresh.</p>
        )}

        {alerts && alerts.length > 0 && (
          <div className="flex flex-col gap-3">
            {alerts.map((a) => (
              <a
                key={a.id}
                href={a.apply_url || "#"}
                target={a.apply_url ? "_blank" : undefined}
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface-2 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tint-mint text-tint-mint-text font-semibold">
                    {a.company?.[0]?.toUpperCase() || "?"}
                  </span>
                  <div>
                    <h3 className="font-medium text-primary">{a.title}</h3>
                    <p className="text-sm text-hint">
                      {a.company}
                      {a.location ? ` · ${a.location}` : ""}
                    </p>
                  </div>
                </div>
                {a.pinned && <EvaIcon name="star" size={16} className="shrink-0 text-brand" />}
              </a>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
