"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/career_events.py
//   GET  /api/v1/career-events         -> {data: CareerEvent[]}, auto-refreshes server-side if due
//   POST /api/v1/career-events/refresh -> {ok, status: "refreshing"|"paused"|"cooldown", message?, retry_after_seconds?}
//   POST /api/v1/career-events/{id}/save -> {saved?: bool} (toggle "interested")
//   POST /api/v1/career-events/read    -> {ids: [...]}
// Mobile: src/more/NetworkingAssistant.tsx's "Career Events" tab (index 0) —
// this is its own route on web since /career/networking is a single-purpose
// outreach-message form, not a tabbed screen.
interface CareerEvent {
  id: string;
  title: string;
  organizer?: string;
  location?: string;
  matched_country?: string;
  matched_role?: string;
  url: string;
  source?: string;
  logo_url?: string;
  event_date?: string;
  created_at: string;
  read: boolean;
  saved?: boolean;
}

function formatEventDate(iso?: string) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function CareerEventsPage() {
  const { t } = useTranslation();
  const [events, setEvents] = useState<CareerEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [proRequired, setProRequired] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiClient.get<{ data: CareerEvent[] }>("/api/v1/career-events");
      setEvents(data.data);
      const unreadIds = data.data.filter((e) => !e.read).map((e) => e.id);
      if (unreadIds.length) {
        apiClient.post("/api/v1/career-events/read", { ids: unreadIds }).catch(() => {});
        setEvents((prev) => (prev ? prev.map((e) => ({ ...e, read: true })) : prev));
      }
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setProRequired(true);
      } else {
        setError(apiErr.message || t("web:career.events.loadFailedDefault", { defaultValue: "Couldn't load career events." }));
      }
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    setRefreshMessage(null);
    try {
      const data = await apiClient.post<{ ok: boolean; status: string; message?: string }>("/api/v1/career-events/refresh");
      if (data.message) setRefreshMessage(data.message);
      await load();
    } catch (err) {
      setError((err as ApiError).message || t("web:career.events.refreshFailedDefault", { defaultValue: "Couldn't refresh events right now." }));
    } finally {
      setRefreshing(false);
    }
  }

  async function handleToggleSave(ev: CareerEvent) {
    setSavingId(ev.id);
    try {
      const updated = await apiClient.post<CareerEvent>(`/api/v1/career-events/${ev.id}/save`, { saved: !ev.saved });
      setEvents((prev) => (prev ? prev.map((e) => (e.id === ev.id ? updated : e)) : prev));
    } catch (err) {
      setError((err as ApiError).message || t("web:career.events.saveFailedDefault", { defaultValue: "Couldn't update that event right now." }));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-8 pb-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PageHeader
              title={t("web:career.events.title", { defaultValue: "Career Events" })}
              subtitle={t("web:career.events.subtitle", { defaultValue: "Career fairs and networking events matched to your target roles and countries." })}
            />
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing || proRequired}>
              {refreshing ? t("web:career.events.refreshing", { defaultValue: "Refreshing…" }) : t("web:career.events.refreshEvents", { defaultValue: "Refresh events" })}
            </Button>
          </div>

          {proRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:career.events.proRequiredTitle", { defaultValue: "Career Events requires a paid plan" })}</h2>
              <p className="text-sm text-hint">{t("web:career.events.proRequiredSubtitle", { defaultValue: "Upgrade to Saveur Basic or above for AI-matched career events." })}</p>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          {refreshMessage && <p className="text-sm text-hint">{refreshMessage}</p>}

          {events && events.length === 0 && !proRequired && (
            <p className="text-sm text-hint">{t("web:career.events.empty", { defaultValue: "No events matched yet — try refreshing, or check back after your next scan." })}</p>
          )}

          {events && events.length > 0 && (
            <div className="flex flex-col gap-3">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-start justify-between gap-4 rounded-card border border-border bg-surface-2 p-4 shadow-sm">
                  <a href={ev.url} target="_blank" rel="noopener noreferrer" className="flex flex-1 items-start gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tint-orange text-tint-orange-text">
                      <EvaIcon name="calendar-outline" size={20} />
                    </span>
                    <div className="flex-1">
                      <h3 className="font-medium text-primary">{ev.title}</h3>
                      <p className="text-sm text-hint">
                        {[ev.organizer, ev.location].filter(Boolean).join(" · ")}
                      </p>
                      {formatEventDate(ev.event_date) && (
                        <p className="mt-1 text-xs font-medium text-brand">{formatEventDate(ev.event_date)}</p>
                      )}
                    </div>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleToggleSave(ev)}
                    disabled={savingId === ev.id}
                    aria-label={t("web:career.events.markInterested", { defaultValue: "Mark interested" })}
                    className="shrink-0 text-hint transition hover:text-brand disabled:opacity-50"
                  >
                    <EvaIcon name="star-outline" size={18} className={ev.saved ? "text-brand" : undefined} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
