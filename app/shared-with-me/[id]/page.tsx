"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { CompanyLogoAvatar } from "@/components/practice/CompanyLogoAvatar";
import { guessCompanyLogoUrl } from "@/lib/companyData";
import * as sharesService from "@/lib/sharesService";
import type { SharedContentDetailProps } from "@/lib/sharesService";
import type { ApiError } from "@/lib/apiClient";
import { useAuth } from "@/app/providers/AuthProvider";

// Web counterpart to Saveur/src/more/SharedContentDetail.tsx — viewer for
// one piece of content another Saveur user shared. Reached from
// app/shared-with-me/page.tsx's inbox list. Renders a read-only view of
// whatever `content_type` the share is (feedback / video / job — the only
// three Saveur-Backend's app/services/shares_service.py CONTENT_TYPES
// supports; mobile has no share flow for resumes, dream companies, or
// roadmaps), reusing the same score/STAR-breakdown visual convention
// app/practice/session/[id]/page.tsx already established for feedback, and
// the same card layout app/job-alerts/[id]/page.tsx uses for a job — just
// without any of the owner-only actions those screens have.
const SCORE_KEYS = ["confidence", "communication", "technical", "leadership", "problem_solving", "creativity", "critical_thinking"] as const;

const SKILL_DEFAULT_LABELS: Record<(typeof SCORE_KEYS)[number], string> = {
  confidence: "Confidence",
  communication: "Communication",
  technical: "Technical Skill",
  leadership: "Leadership",
  problem_solving: "Problem Solving",
  creativity: "Creativity",
  critical_thinking: "Critical Thinking",
};

// Loose shape of SharedContentDetailProps.content (a plain `Record<string,
// unknown>` in lib/sharesService.ts, since its real shape depends on
// content_type) — every field optional since a job share only ever
// populates the job fields and a feedback/video share only the feedback
// fields. Field names mirror Saveur-Backend's JobAlert.to_dict() and
// app/api/feedback.py's _feedback_payload/_replay_payload exactly (same
// contract mobile's SharedContentDetail.tsx consumes).
interface SharedContentAnnotation {
  label: string;
  t_ms: number;
}
interface SharedContentShape {
  // job
  title?: string;
  company?: string;
  location?: string;
  apply_url?: string;
  company_logo_url?: string;
  posted_at?: string;
  // feedback / video context
  role?: string;
  interview_type?: string;
  // feedback
  status?: string;
  overall_score?: number;
  scores?: Record<string, number>;
  summary?: string;
  // video
  video_url?: string;
  annotations?: SharedContentAnnotation[];
}

function formatMs(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(ms: number, locale?: string) {
  return new Date(ms).toLocaleDateString(locale);
}

export default function SharedContentDetailPage() {
  const { t, i18n } = useTranslation();
  const { loading: authLoading } = useAuth();
  const params = useParams<{ id: string }>();
  const shareId = params?.id;

  const [share, setShare] = useState<SharedContentDetailProps | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !shareId) return;
    let cancelled = false;
    sharesService
      .getShareDetail(shareId)
      .then((data) => {
        if (!cancelled) setShare(data);
      })
      .catch((err) => {
        if (cancelled) return;
        const apiErr = err as ApiError;
        if (apiErr.status === 404 || apiErr.status === 410) {
          setShare(null);
        } else {
          setError(apiErr.message || t("web:sharedWithMe.detail.loadFailedDefault", { defaultValue: "Couldn't load this shared item." }));
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, shareId]);

  function skillLabel(key: (typeof SCORE_KEYS)[number]) {
    return t(`web:practice.session.skills.${key}`, { defaultValue: SKILL_DEFAULT_LABELS[key] });
  }

  const content = (share?.content ?? {}) as SharedContentShape;
  const hasVideo = share?.contentType === "video" && !!content.video_url;
  // Same "still generating" guard as the practice session detail page and
  // mobile's SharedContentDetail.tsx — a feedback/video share opened while
  // feedback.py's background generation job is still running reports
  // status:"pending" with a placeholder 0% score; treat a missing `status`
  // (older shares, predating this field) as ready.
  const isFeedbackPending = (share?.contentType === "feedback" || share?.contentType === "video") && content.status === "pending";

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-10">
          <Link href="/shared-with-me" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-hint hover:text-primary">
            <EvaIcon name="chevron-left-outline" size={16} />
            {t("web:sharedWithMe.detail.back", { defaultValue: "Back to Shared with Me" })}
          </Link>

          {share === undefined && !error && (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 rounded-card" />
              <Skeleton className="h-40 rounded-card" />
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          {share === null && !error && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 text-hint">
                <EvaIcon name="alert-circle-outline" size={20} />
              </span>
              <h1 className="font-semibold text-primary">{t("web:sharedWithMe.detail.notFoundTitle", { defaultValue: "This shared item is no longer available" })}</h1>
              <p className="text-sm text-hint">{t("web:sharedWithMe.detail.notFoundSubtitle", { defaultValue: "It may have been removed by the person who shared it." })}</p>
            </div>
          )}

          {share && (
            <>
              <p className="text-sm text-hint">
                {t("web:sharedWithMe.sharedBy", { defaultValue: "@{{username}} shared with you", username: share.senderUsername })}
              </p>

              {share.message && (
                <div className="rounded-card border border-border bg-surface-2 p-4">
                  <p className="text-sm italic text-primary">&ldquo;{share.message}&rdquo;</p>
                </div>
              )}

              {share.contentType === "job" ? (
                <div className="flex flex-col gap-5 rounded-card border border-border bg-surface-2 p-6">
                  <div className="flex items-start gap-3">
                    <CompanyLogoAvatar
                      logoUrl={content.company_logo_url ?? guessCompanyLogoUrl(content.company ?? "")}
                      companyName={content.company ?? ""}
                      size={56}
                      className="shrink-0 bg-tint-mint"
                    />
                    <div className="flex-1">
                      <h1 className="text-lg font-bold text-primary">{content.title}</h1>
                      <p className="mt-1 text-sm text-hint">{[content.company, content.location].filter(Boolean).join(" · ")}</p>
                      {content.posted_at && (
                        <p className="mt-1 text-xs text-hint">
                          {t("web:sharedWithMe.detail.postedOn", { defaultValue: "Posted {{date}}", date: formatDate(Date.parse(content.posted_at), i18n.language) })}
                        </p>
                      )}
                    </div>
                  </div>
                  {content.apply_url ? (
                    <Button onClick={() => window.open(content.apply_url, "_blank", "noopener,noreferrer")} className="w-full justify-center">
                      {t("web:sharedWithMe.detail.openPosting", { defaultValue: "Open posting" })}
                      <EvaIcon name="external-link-outline" size={16} />
                    </Button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-6">
                    <p className="text-sm text-hint">
                      {[content.role, content.company].filter(Boolean).join(" · ") || content.interview_type}
                    </p>
                    {isFeedbackPending ? (
                      <div className="flex items-center gap-2">
                        <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-hint border-t-transparent" />
                        <p className="text-sm text-hint">
                          {t("web:sharedWithMe.detail.feedbackPending", { defaultValue: "This feedback is still being generated — check back in a moment." })}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold text-primary">{content.overall_score ?? 0}%</span>
                        <span className="text-sm text-hint">{t("web:sharedWithMe.detail.overallScore", { defaultValue: "Overall Score" })}</span>
                      </div>
                    )}
                  </div>

                  {hasVideo && (
                    <div className="overflow-hidden rounded-card border border-border bg-surface-2">
                      <video src={content.video_url} controls className="aspect-video w-full bg-black" />
                    </div>
                  )}

                  {hasVideo && content.annotations && content.annotations.length > 0 && (
                    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-2 p-6">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">
                        {t("web:sharedWithMe.detail.flaggedMoments", { defaultValue: "Flagged Moments" })}
                      </h2>
                      {content.annotations.map((a, i) => (
                        <div key={i} className="flex items-center justify-between border-b border-border py-2 last:border-b-0">
                          <span className="text-sm text-primary">{a.label}</span>
                          <span className="text-sm font-medium text-primary">{formatMs(a.t_ms)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!isFeedbackPending && content.scores && (
                    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-6">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">
                        {t("web:practice.session.scores", { defaultValue: "Skill scores" })}
                      </h2>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {SCORE_KEYS.map((key) => (
                          <div key={key} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-primary">{skillLabel(key)}</span>
                              <span className="font-medium text-primary">{content.scores?.[key] ?? 0}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(0, Math.min(100, content.scores?.[key] ?? 0))}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isFeedbackPending && content.summary && (
                    <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-2 p-6">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">
                        {t("web:practice.session.summary", { defaultValue: "Summary" })}
                      </h2>
                      <p className="whitespace-pre-wrap text-sm text-primary">{content.summary}</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
