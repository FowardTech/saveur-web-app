"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import apiClient, { type ApiError } from "@/lib/apiClient";
import { ShareToUserModal } from "@/components/jobAlerts/ShareToUserModal";
import { useAuth } from "@/app/providers/AuthProvider";

// Web counterpart to mobile's src/practice/InterviewFeedback.tsx — the
// screen a completed Practice History row (PracticeSessionItem.tsx) taps
// through to. app/applications/page.tsx's Practice History tab used to
// render each session as a plain, unlinked row (dead click). This pulls
// the same two real endpoints mobile's feedbackService.ts /
// interviewService.ts already use for a given session:
//   GET /api/v1/interviews/sessions/<id>  -> session header + transcript
//   GET /api/v1/feedback/session/<id>     -> scores, STAR breakdown, summary
// A full video "replay" (mobile's InterviewReplay screen) is a much larger
// feature (video playback + synced transcript scrubbing) that doesn't exist
// on web yet — out of scope here. This page surfaces everything else that's
// already real, queryable data: scores, STAR breakdown, written summary,
// strengths/improvements, and the raw Q&A transcript.
interface SessionMessage {
  role: string;
  text: string;
  at: string;
}

interface SessionDetail {
  id: number;
  type: string;
  role?: string;
  company?: string;
  mode?: string;
  persona?: string;
  difficulty?: string;
  status: string;
  language?: string;
  started_at: string;
  has_video: boolean;
  duration_min?: number | null;
  messages: SessionMessage[];
}

interface FeedbackScores {
  confidence: number;
  communication: number;
  technical: number;
  leadership: number;
  problem_solving: number;
  creativity: number;
  critical_thinking: number;
}

interface StarItem {
  letter: "S" | "T" | "A" | "R";
  label: string;
  score: number;
  note?: string;
}

interface FeedbackDetail {
  status: "ready" | "pending";
  overall_score: number;
  scores: FeedbackScores;
  star_breakdown: StarItem[];
  summary: string | null;
  strengths: string[];
  improvements: string[];
}

const SKILL_ORDER: Array<keyof FeedbackScores> = [
  "confidence",
  "communication",
  "technical",
  "leadership",
  "problem_solving",
  "creativity",
  "critical_thinking",
];

const SKILL_DEFAULT_LABELS: Record<keyof FeedbackScores, string> = {
  confidence: "Confidence",
  communication: "Communication",
  technical: "Technical Skill",
  leadership: "Leadership",
  problem_solving: "Problem Solving",
  creativity: "Creativity",
  critical_thinking: "Critical Thinking",
};

function fallbackLabelFor(type: string) {
  return type
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function formatSessionDate(iso: string) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function PracticeSessionDetailPage() {
  const { t } = useTranslation();
  const { loading: authLoading } = useAuth();
  const params = useParams<{ id: string }>();
  const sessionId = params?.id;

  const [session, setSession] = useState<SessionDetail | null | undefined>(undefined);
  const [feedback, setFeedback] = useState<FeedbackDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const loadFeedback = useCallback(
    (id: string) => {
      setFeedbackError(null);
      apiClient
        .get<FeedbackDetail>(`/api/v1/feedback/session/${id}`)
        .then((data) => setFeedback(data))
        .catch((err) => {
          setFeedbackError((err as ApiError).message || t("web:practice.session.feedbackLoadFailed", { defaultValue: "Couldn't load feedback for this session." }));
        });
    },
    [t]
  );

  useEffect(() => {
    if (authLoading || !sessionId) return;
    let cancelled = false;
    apiClient
      .get<SessionDetail>(`/api/v1/interviews/sessions/${sessionId}`)
      .then((data) => {
        if (cancelled) return;
        setSession(data);
        loadFeedback(sessionId);
      })
      .catch((err) => {
        if (cancelled) return;
        const apiErr = err as ApiError;
        if (apiErr.status === 404) {
          setSession(null);
        } else {
          setError(apiErr.message || t("web:practice.session.loadFailedDefault", { defaultValue: "Couldn't load this session right now." }));
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, sessionId]);

  function sessionTypeLabel(type: string) {
    return t(`web:practice.mockInterviews.types.${type}`, { defaultValue: fallbackLabelFor(type) });
  }

  function skillLabel(key: keyof FeedbackScores) {
    return t(`web:practice.session.skills.${key}`, { defaultValue: SKILL_DEFAULT_LABELS[key] });
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-10">
          <div className="flex items-center justify-between gap-3">
            <Link href="/applications?tab=history" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-hint hover:text-primary">
              <EvaIcon name="chevron-left-outline" size={16} />
              {t("web:practice.session.back", { defaultValue: "Back to Practice History" })}
            </Link>
            {sessionId && (
              <button
                type="button"
                onClick={() => setShareModalOpen(true)}
                aria-label={t("web:jobAlerts.details.shareToSaveurUser", { defaultValue: "Share with a Saveur user" })}
                title={t("web:jobAlerts.details.shareToSaveurUser", { defaultValue: "Share with a Saveur user" })}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-hint hover:bg-surface-3 hover:text-primary"
              >
                <EvaIcon name="people-outline" size={18} />
              </button>
            )}
          </div>

          {session === undefined && !error && (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 rounded-card" />
              <Skeleton className="h-40 rounded-card" />
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          {session === null && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 text-hint">
                <EvaIcon name="alert-circle-outline" size={20} />
              </span>
              <h1 className="font-semibold text-primary">{t("web:practice.session.notFoundTitle", { defaultValue: "This session isn't available" })}</h1>
              <p className="text-sm text-hint">{t("web:practice.session.notFoundSubtitle", { defaultValue: "It may have been removed." })}</p>
            </div>
          )}

          {session && (
            <>
              <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-lg font-bold text-primary">
                      {sessionTypeLabel(session.type)}
                      {session.company ? ` · ${session.company}` : ""}
                    </h1>
                    <p className="mt-1 text-sm text-hint">
                      {formatSessionDate(session.started_at)}
                      {session.duration_min ? ` · ${t("web:practice.history.durationMin", { defaultValue: "{{min}} min", min: session.duration_min })}` : ""}
                      {session.difficulty ? ` · ${session.difficulty}` : ""}
                    </p>
                  </div>
                  {feedback && feedback.status === "ready" && (
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-tint-mint text-sm font-semibold text-tint-mint-text">
                      {Math.round(feedback.overall_score)}%
                    </span>
                  )}
                </div>
              </div>

              {feedbackError && <p className="text-sm text-danger">{feedbackError}</p>}

              {feedback === null && !feedbackError && (
                <div className="flex flex-col gap-3">
                  <Skeleton className="h-24 rounded-card" />
                </div>
              )}

              {feedback && feedback.status === "pending" && (
                <div className="flex flex-col items-start gap-3 rounded-card border border-border bg-surface-2 p-6">
                  <p className="text-sm text-hint">
                    {t("web:practice.session.feedbackPending", { defaultValue: "Feedback for this session is still being generated — check back in a bit." })}
                  </p>
                  <Button variant="outline" size="sm" onClick={() => sessionId && loadFeedback(sessionId)}>
                    {t("common:actions.refresh", { defaultValue: "Refresh" })}
                  </Button>
                </div>
              )}

              {feedback && feedback.status === "ready" && (
                <>
                  {feedback.summary && (
                    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-2 p-6">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">
                        {t("web:practice.session.summary", { defaultValue: "Summary" })}
                      </h2>
                      <p className="whitespace-pre-wrap text-sm text-primary">{feedback.summary}</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-6">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">
                      {t("web:practice.session.scores", { defaultValue: "Skill scores" })}
                    </h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {SKILL_ORDER.map((key) => (
                        <div key={key} className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-primary">{skillLabel(key)}</span>
                            <span className="font-medium text-primary">{feedback.scores[key]}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, feedback.scores[key]))}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {feedback.star_breakdown && feedback.star_breakdown.length > 0 && (
                    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-6">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">
                        {t("web:practice.session.starBreakdown", { defaultValue: "STAR breakdown" })}
                      </h2>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {feedback.star_breakdown.map((s) => (
                          <div key={s.letter} className="rounded-lg bg-surface-1 p-3 text-center">
                            <p className="text-lg font-bold text-primary">{s.letter}</p>
                            <p className="text-xs text-hint">{s.label}</p>
                            <p className="mt-1 text-sm font-semibold text-primary">{s.score}%</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(feedback.strengths?.length > 0 || feedback.improvements?.length > 0) && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {feedback.strengths?.length > 0 && (
                        <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-2 p-6">
                          <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">
                            {t("web:practice.session.strengths", { defaultValue: "Strengths" })}
                          </h2>
                          <ul className="flex flex-col gap-1.5 text-sm text-primary">
                            {feedback.strengths.map((s, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <EvaIcon name="checkmark-circle-2-outline" size={16} className="mt-0.5 shrink-0 text-success-text" />
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {feedback.improvements?.length > 0 && (
                        <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-2 p-6">
                          <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">
                            {t("web:practice.session.improvements", { defaultValue: "Areas to improve" })}
                          </h2>
                          <ul className="flex flex-col gap-1.5 text-sm text-primary">
                            {feedback.improvements.map((s, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <EvaIcon name="arrow-up-outline" size={16} className="mt-0.5 shrink-0 text-hint" />
                                <span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {session.messages && session.messages.length > 0 && (
                <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-6">
                  <button
                    type="button"
                    onClick={() => setShowTranscript((v) => !v)}
                    className="flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-hint"
                  >
                    {t("web:practice.session.transcript", { defaultValue: "Transcript" })}
                    <EvaIcon name={showTranscript ? "chevron-up-outline" : "chevron-down-outline"} size={16} />
                  </button>
                  {showTranscript && (
                    <div className="flex flex-col gap-3">
                      {session.messages.map((m, i) => (
                        <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[85%] rounded-card px-3.5 py-2.5 text-sm ${
                              m.role === "user" ? "bg-brand text-white" : "bg-surface-1 text-primary"
                            }`}
                          >
                            {m.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        {sessionId && (
          <ShareToUserModal
            open={shareModalOpen}
            onClose={() => setShareModalOpen(false)}
            contentType="feedback"
            contentId={sessionId}
          />
        )}
      </AppShell>
    </RequireAuth>
  );
}
