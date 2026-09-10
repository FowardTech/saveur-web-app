"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/interviews.py
//   GET /api/v1/interviews/sessions -> Session[]
// Mobile: drawer's "Recent Interviews" entry, landing on the Practice
// History tab of src/requests/PracticeHistory/PracticeHistoryTab.tsx.
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

function formatDate(iso: string) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function PracticeHistoryPage() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient.get<Session[]>("/api/v1/interviews/sessions");
        setSessions(data);
      } catch (err) {
        setError((err as ApiError).message || t("web:practice.history.loadFailedDefault", { defaultValue: "Couldn't load your practice history." }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function typeLabel(type: string) {
    return t(`web:practice.mockInterviews.types.${type}`, { defaultValue: fallbackLabelFor(type) });
  }

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      (sessions ?? []).filter((s) => {
        if (!q) return true;
        return [typeLabel(s.type), s.company, s.role, s.mode, s.difficulty].filter(Boolean).join(" ").toLowerCase().includes(q);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, q]
  );

  const isPastDue = (s: Session) => {
    const startMs = Date.parse(s.started_at);
    const endMs = startMs + (s.duration_min ?? 30) * 60 * 1000;
    return Date.now() > endMs;
  };

  const upcoming = filtered.filter((s) => ["scheduled", "in_progress"].includes((s.status || "").toLowerCase()) && !isPastDue(s));
  const past = filtered.filter((s) => !upcoming.includes(s));

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:practice.history.title", { defaultValue: "Recent Interviews" })}
            subtitle={t("web:practice.history.subtitle", { defaultValue: "Every mock interview session you've run, upcoming and past." })}
          />

          {error && <p className="text-sm text-danger">{error}</p>}

          {sessions === null && !error && <SkeletonRows count={4} />}

          {sessions && sessions.length > 0 && (
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("web:practice.history.searchPlaceholder", { defaultValue: "Search by type, mode, or company…" })}
              className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          )}

          {sessions && sessions.length === 0 && (
            <p className="text-sm text-hint">{t("web:practice.history.empty", { defaultValue: "No sessions yet — start a mock interview to see it here." })}</p>
          )}

          {sessions && sessions.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-hint">{t("web:practice.history.noMatch", { defaultValue: "No sessions match your search." })}</p>
          )}

          {upcoming.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">{t("web:practice.history.upcoming", { defaultValue: "Upcoming" })}</h2>
              {upcoming.map((s) => (
                <SessionRow key={s.id} session={s} typeLabel={typeLabel} />
              ))}
            </div>
          )}

          {past.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">{t("web:practice.history.past", { defaultValue: "Past" })}</h2>
              {past.map((s) => (
                <SessionRow key={s.id} session={s} typeLabel={typeLabel} />
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}

function SessionRow({ session, typeLabel }: { session: Session; typeLabel: (t: string) => string }) {
  const { t } = useTranslation();
  const scorePct = session.overall_score != null ? Math.round(session.overall_score) : null;
  return (
    <div className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface-2 p-4">
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
            {formatDate(session.started_at)}
            {session.duration_min ? ` · ${t("web:practice.history.durationMin", { defaultValue: "{{min}} min", min: session.duration_min })}` : ""}
          </p>
        </div>
      </div>
      {scorePct != null && (
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint-mint text-xs font-semibold text-tint-mint-text">
          {scorePct}%
        </span>
      )}
    </div>
  );
}
