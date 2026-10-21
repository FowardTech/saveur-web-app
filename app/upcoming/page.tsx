"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { CompanyLogoAvatar } from "@/components/practice/CompanyLogoAvatar";
import { guessCompanyLogoUrl } from "@/lib/companyData";
import { interviewTypeSlug } from "@/lib/interviewData";
import * as scheduledInterviewService from "@/lib/scheduledInterviewService";
import type { ScheduledInterview } from "@/lib/scheduledInterviewService";

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Every scheduled mock interview, grouped by day. A session scheduled for
 * today also shows on the dashboard; later ones live only here (mirrors the
 * mobile drawer's "Upcoming" screen). */
export default function UpcomingPage() {
  const { t, i18n } = useTranslation();
  const [sessions, setSessions] = useState<ScheduledInterview[] | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () =>
    scheduledInterviewService
      .listUpcoming()
      .then(setSessions)
      .catch(() => setSessions([]));

  useEffect(() => {
    load();
  }, []);

  const dayLabel = (ms: number) => {
    const diff = Math.round((startOfDay(ms) - startOfDay(Date.now())) / 86400000);
    if (diff === 0) return t("web:upcoming.today", { defaultValue: "Today" });
    if (diff === 1) return t("web:upcoming.tomorrow", { defaultValue: "Tomorrow" });
    return new Date(ms).toLocaleDateString(i18n.language, { weekday: "long", month: "short", day: "numeric" });
  };
  const timeLabel = (ms: number) => new Date(ms).toLocaleTimeString(i18n.language, { hour: "numeric", minute: "2-digit" });

  async function cancel(s: ScheduledInterview) {
    setSessions((prev) => prev?.filter((x) => x.id !== s.id));
    try {
      await scheduledInterviewService.cancelScheduled(s.id);
    } finally {
      load();
    }
  }

  const hrefFor = (s: ScheduledInterview) =>
    `/practice/mock-interviews?type=${encodeURIComponent(s.interviewTypeSlug)}${s.company ? `&company=${encodeURIComponent(s.company)}` : ""}${
      s.role ? `&role=${encodeURIComponent(s.role)}` : ""
    }`;

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-10">
          <PageHeader
            title={t("web:upcoming.title", { defaultValue: "Upcoming" })}
            subtitle={t("web:upcoming.subtitle", { defaultValue: "All your scheduled mock interviews in one place." })}
          />
          <div>
            <LinkButton href="/practice/schedule">{t("web:upcoming.schedule", { defaultValue: "Schedule a session" })}</LinkButton>
          </div>

          {notice && <p className="rounded-card bg-tint-blue px-4 py-3 text-sm text-tint-blue-text">{notice}</p>}

          {sessions === undefined ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title={t("web:upcoming.emptyTitle", { defaultValue: "No upcoming sessions" })}
              description={t("web:upcoming.emptyBody", { defaultValue: "Schedule a mock interview and it will show up here." })}
              action={<LinkButton href="/practice/schedule">{t("web:upcoming.schedule", { defaultValue: "Schedule a session" })}</LinkButton>}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map((s, i) => {
                const ready = s.scheduledAt <= Date.now();
                const showDay = i === 0 || startOfDay(sessions[i - 1].scheduledAt) !== startOfDay(s.scheduledAt);
                const typeLabel = t(`web:practice.mockInterviews.types.${interviewTypeSlug(s.interviewTypeLabel)}`, {
                  defaultValue: s.interviewTypeLabel,
                });
                return (
                  <div key={s.id} className="flex flex-col gap-2">
                    {showDay && <h2 className={`text-sm font-bold text-hint ${i === 0 ? "" : "mt-3"}`}>{dayLabel(s.scheduledAt)}</h2>}
                    <div className="flex items-center gap-3 rounded-card border border-border bg-surface-2 p-4">
                      {s.company ? (
                        <CompanyLogoAvatar logoUrl={guessCompanyLogoUrl(s.company)} companyName={s.company} size={44} />
                      ) : (
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
                          <EvaIcon name="calendar-outline" size={20} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-primary">{typeLabel}</p>
                        <p className="truncate text-sm text-hint">
                          {[timeLabel(s.scheduledAt), s.role, s.company].filter(Boolean).join(" · ")}
                        </p>
                        <p className="truncate text-xs text-hint">
                          {s.mode} · {s.durationMin} {t("web:upcoming.min", { defaultValue: "min" })}
                        </p>
                      </div>
                      {ready ? (
                        <Link
                          href={hrefFor(s)}
                          className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
                        >
                          {t("web:upcoming.start", { defaultValue: "Start" })}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setNotice(
                              t("web:dashboard.upcomingSessionNotReady", {
                                defaultValue: "Not quite time yet — this session unlocks at {{time}}.",
                                time: new Date(s.scheduledAt).toLocaleString(i18n.language, {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                  hour: "numeric",
                                  minute: "2-digit",
                                }),
                              }),
                            );
                            window.setTimeout(() => setNotice(null), 4000);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-surface-3 px-3 py-2 text-sm font-semibold text-hint"
                        >
                          <EvaIcon name="lock-outline" size={14} />
                          {t("web:upcoming.locked", { defaultValue: "Locked" })}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => cancel(s)}
                        aria-label={t("web:dashboard.upcomingSessionCancel", { defaultValue: "Cancel this session" }).toString()}
                        className="rounded-full p-1.5 text-hint transition hover:bg-surface-3 hover:text-primary"
                      >
                        <EvaIcon name="close-outline" size={18} />
                      </button>
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
