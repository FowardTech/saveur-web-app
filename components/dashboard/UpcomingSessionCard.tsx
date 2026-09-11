"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { interviewTypeSlug } from "@/lib/interviewData";
import * as scheduledInterviewService from "@/lib/scheduledInterviewService";
import type { ScheduledInterview } from "@/lib/scheduledInterviewService";

/**
 * Web counterpart to mobile's src/home/UpcomingSessionHomeCard.tsx — the
 * DISPLAY half of the "Upcoming Session" feature (the scheduling half is
 * app/practice/schedule/page.tsx, reached from the "Schedule a session"
 * entry point on the Practice hub, same split mobile uses between
 * FindScreen.tsx and Home). Self-contained: fetches its own data via
 * GET /api/v1/interviews/scheduled and renders nothing when there's nothing
 * upcoming, so it's always safe to mount unconditionally on the dashboard.
 *
 * Tapping the card pre-fills app/practice/mock-interviews/page.tsx via the
 * same `?type=`/`?company=`/`?role=` query-param convention other deep links
 * on this app already use (e.g. the Dream Company Dashboard's quick
 * actions) — durationMin/difficulty/mode aren't carried over that way since
 * mock-interviews' own prefill only reads those three params today, same
 * partial-prefill scope as every other deep link into that page.
 */
export function UpcomingSessionCard() {
  const { t, i18n } = useTranslation();
  const [session, setSession] = useState<ScheduledInterview | null | undefined>(undefined);
  const [canceling, setCanceling] = useState(false);

  const load = () => {
    scheduledInterviewService
      .listUpcoming()
      .then((list) => setSession(list[0] ?? null))
      .catch(() => setSession(null));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCancel(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!session || canceling) return;
    setCanceling(true);
    const prev = session;
    setSession(null); // optimistic — matches mobile's clear-then-resync-on-failure flow
    try {
      await scheduledInterviewService.cancelScheduled(prev.id);
      load();
    } catch {
      setSession(prev); // resync if the cancel actually failed server-side
    } finally {
      setCanceling(false);
    }
  }

  if (session === undefined || session === null) return null;

  const prefillHref = `/practice/mock-interviews?type=${encodeURIComponent(session.interviewTypeSlug)}${
    session.company ? `&company=${encodeURIComponent(session.company)}` : ""
  }${session.role ? `&role=${encodeURIComponent(session.role)}` : ""}`;

  const typeLabel = t(`web:practice.mockInterviews.types.${interviewTypeSlug(session.interviewTypeLabel)}`, {
    defaultValue: session.interviewTypeLabel,
  });

  return (
    <Link
      href={prefillHref}
      className="relative flex items-center gap-3 rounded-card bg-brand p-4 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
        <EvaIcon name="calendar-outline" size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {t("web:dashboard.upcomingSessionTitle", { defaultValue: "Upcoming session" })}: {typeLabel}
          {session.role ? ` · ${session.role}` : ""}
        </p>
        <p className="truncate text-sm text-white/85">
          {new Date(session.scheduledAt).toLocaleString(i18n.language, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </p>
      </div>
      <EvaIcon name="arrow-forward-outline" size={18} className="shrink-0 text-white" />
      <button
        type="button"
        onClick={onCancel}
        disabled={canceling}
        aria-label={t("web:dashboard.upcomingSessionCancel", { defaultValue: "Cancel this session" })}
        className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/20 text-white transition hover:bg-black/30 disabled:opacity-60"
      >
        <EvaIcon name="close-outline" size={14} />
      </button>
    </Link>
  );
}
