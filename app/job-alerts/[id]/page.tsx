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
import apiClient, { type ApiError } from "@/lib/apiClient";
import { JobFitAnalysis } from "@/components/jobAlerts/JobFitAnalysis";
import { ShareToUserModal } from "@/components/jobAlerts/ShareToUserModal";
import { useAuth } from "@/app/providers/AuthProvider";

// Web counterpart to Saveur/src/more/JobAlertDetails.tsx — the landing
// screen a tap on a Job Alerts list card (app/job-alerts/page.tsx) opens.
// Unlike app/ads/[id]/page.tsx (which has no single-ad backend endpoint to
// call), Saveur-Backend's app/api/job_alerts.py DOES expose a real
// GET /api/v1/job-alerts/<id> (added for the "share a job" deep-link
// flow — see that route's own comment), so this fetches the single alert
// directly instead of re-fetching the whole list and finding it client-side.
// Same @require_pro gate as the list page (job_alerts.py), surfaced the
// same way the list page already does (a 402/403 becomes a "Pro required"
// state, not a redirect).
interface JobAlertDetail {
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

function formatDate(iso: string, locale?: string) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleDateString(locale);
}

export default function JobAlertDetailsPage() {
  const { t, i18n } = useTranslation();
  const { loading: authLoading } = useAuth();
  const params = useParams<{ id: string }>();
  const alertId = params?.id;

  const [alert, setAlert] = useState<JobAlertDetail | null | undefined>(undefined);
  const [proRequired, setProRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (authLoading || !alertId) return;
    let cancelled = false;
    apiClient
      .get<JobAlertDetail>(`/api/v1/job-alerts/${alertId}`)
      .then((data) => {
        if (cancelled) return;
        setAlert(data);
        // Best-effort, matching mobile's JobAlertDetails.tsx — this detail
        // page can be reached before the list page's own read-marking
        // effect ever ran (a direct link/bookmark), so mark it read here
        // too if it isn't already.
        if (!data.read) {
          apiClient.post("/api/v1/job-alerts/read", { ids: [data.id] }).catch(() => {});
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const apiErr = err as ApiError;
        if (apiErr.status === 402 || apiErr.status === 403) {
          setProRequired(true);
        } else if (apiErr.status === 404) {
          setAlert(null);
        } else {
          setError(apiErr.message || t("web:jobAlerts.details.loadFailedDefault", { defaultValue: "Couldn't load this job alert." }));
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, alertId]);

  function onApply() {
    if (!alert?.apply_url) return;
    // Mobile opens the real application page in-app via WebViewScreen with
    // application-submission tracking; this is a web app, so the natural
    // equivalent is just a new tab — no in-app WebView to build.
    window.open(alert.apply_url, "_blank", "noopener,noreferrer");
  }

  // Web counterpart of mobile's jobShareService.shareJob (share-outline
  // icon, plain OS share sheet). Mobile builds a deferred AppsFlyer OneLink
  // (or a saveur:// / share.saveurnow.com/j/<id> fallback) because its
  // recipient needs to land back in the NATIVE app after install+signup —
  // that whole apparatus only makes sense for a mobile deep link. A web
  // recipient just needs a URL they can open in a browser, so this shares
  // this page's own URL directly via the real Web Share API where
  // available (navigator.share — mobile Safari/Chrome, some desktop
  // browsers), falling back to copying the link to the clipboard where
  // it isn't (Firefox and most desktop browsers lack navigator.share).
  async function onShareJob() {
    if (!alert) return;
    const shareData = {
      title: alert.title,
      text: `Check out this job: ${alert.title} at ${alert.company} — via Saveur.`,
      url: window.location.href,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User dismissed the share sheet, or the browser rejected it — no
        // action needed either way, same as mobile's Share.share().catch(() => {}).
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // Clipboard API blocked (no HTTPS context, permission denied) —
      // nothing more we can do without a real error UI for what's a
      // low-stakes convenience action.
    }
  }

  const logoUrl = alert ? alert.company_logo_url ?? guessCompanyLogoUrl(alert.company) : null;

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-10">
          <div className="flex items-center justify-between gap-3">
            <Link href="/job-alerts" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-hint hover:text-primary">
              <EvaIcon name="chevron-left-outline" size={16} />
              {t("web:jobAlerts.details.back", { defaultValue: "Back to Job Alerts" })}
            </Link>
            {alert && (
              <div className="flex items-center gap-1.5">
                {shareCopied && <span className="text-xs font-medium text-success-text">{t("web:jobAlerts.details.linkCopied", { defaultValue: "Link copied" })}</span>}
                <button
                  type="button"
                  onClick={() => setShareModalOpen(true)}
                  aria-label={t("web:jobAlerts.details.shareToSaveurUser", { defaultValue: "Share with a Saveur user" })}
                  title={t("web:jobAlerts.details.shareToSaveurUser", { defaultValue: "Share with a Saveur user" })}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-hint hover:bg-surface-3 hover:text-primary"
                >
                  <EvaIcon name="people-outline" size={18} />
                </button>
                <button
                  type="button"
                  onClick={onShareJob}
                  aria-label={t("web:jobAlerts.details.shareJob", { defaultValue: "Share this job" })}
                  title={t("web:jobAlerts.details.shareJob", { defaultValue: "Share this job" })}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-hint hover:bg-surface-3 hover:text-primary"
                >
                  <EvaIcon name="share-outline" size={18} />
                </button>
              </div>
            )}
          </div>

          {alert === undefined && !proRequired && !error && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-24 rounded-card" />
            </div>
          )}

          {proRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h1 className="font-semibold text-primary">{t("web:jobAlerts.details.proRequiredTitle", { defaultValue: "Job Details requires a paid plan" })}</h1>
              <p className="text-sm text-hint">{t("web:jobAlerts.details.proRequiredSubtitle", { defaultValue: "Viewing full job alert details is a Basic feature." })}</p>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          {alert === null && !proRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 text-hint">
                <EvaIcon name="alert-circle-outline" size={20} />
              </span>
              <h1 className="font-semibold text-primary">{t("web:jobAlerts.details.notFoundTitle", { defaultValue: "This job alert is no longer available" })}</h1>
              <p className="text-sm text-hint">{t("web:jobAlerts.details.notFoundSubtitle", { defaultValue: "It may have expired or been removed." })}</p>
            </div>
          )}

          {alert && (
            <>
              <div className="flex flex-col gap-5 rounded-card border border-border bg-surface-2 p-6">
                <div className="flex items-start gap-3">
                  <CompanyLogoAvatar logoUrl={logoUrl} companyName={alert.company} size={56} className="shrink-0 bg-tint-mint" />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-lg font-bold text-primary">{alert.title}</h1>
                      {alert.applied && (
                        <span className="inline-flex items-center rounded-pill bg-tint-purple px-2 py-0.5 text-xs font-medium text-tint-purple-text">
                          {t("web:jobAlerts.appliedBadge", { defaultValue: "Applied" })}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-hint">
                      {alert.company}
                      {alert.location ? ` · ${alert.location}` : ""}
                    </p>
                  </div>
                </div>

                {alert.matched_role && (
                  <div className="flex items-start gap-2 text-sm text-primary">
                    <EvaIcon name="checkmark-circle-2-outline" size={18} className="mt-0.5 shrink-0 text-hint" />
                    <p>
                      {t("web:jobAlerts.details.matchesTargetRole", { defaultValue: "Matches your target role:" })}{" "}
                      <span className="font-semibold">{alert.matched_role}</span>
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  {alert.source && (
                    <div className="flex items-center gap-2.5 text-sm text-hint">
                      <EvaIcon name="briefcase-outline" size={16} />
                      <span>{t("web:jobAlerts.details.viaSource", { defaultValue: "Via {{source}}", source: alert.source })}</span>
                    </div>
                  )}
                  {alert.posted_at && (
                    <div className="flex items-center gap-2.5 text-sm text-hint">
                      <EvaIcon name="clock-outline" size={16} />
                      <span>{t("web:jobAlerts.details.postedOn", { defaultValue: "Posted {{date}}", date: formatDate(alert.posted_at, i18n.language) })}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* "Analyzing this role's requirements…" — auto-runs on
                  mount, silently hides itself on failure. See
                  components/jobAlerts/JobFitAnalysis.tsx's own header
                  comment for the full mobile-parity rationale. */}
              <JobFitAnalysis applyUrl={alert.apply_url} jobTitle={alert.title} />

              <p className="text-center text-sm text-hint">
                {alert.applied
                  ? t("web:jobAlerts.details.alreadyAppliedNote", {
                      defaultValue: "You've already applied to this job — you can still reopen it if you need to.",
                    })
                  : t("web:jobAlerts.details.applyTakesYouTo", {
                      defaultValue: "Applying takes you to {{source}} to finish your application.",
                      source: alert.source ?? t("web:jobAlerts.details.theEmployersSite", { defaultValue: "the employer's site" }),
                    })}
              </p>

              {alert.apply_url ? (
                <Button onClick={onApply} className="w-full justify-center">
                  {alert.applied
                    ? t("web:jobAlerts.details.reopenListing", { defaultValue: "Reopen listing" })
                    : alert.source
                    ? t("web:jobAlerts.details.applyOnSource", { defaultValue: "Apply on {{source}}", source: alert.source })
                    : t("web:jobAlerts.details.applyForThisJob", { defaultValue: "Apply for this job" })}
                  <EvaIcon name="external-link-outline" size={16} />
                </Button>
              ) : null}
            </>
          )}
        </div>
        {alert && (
          <ShareToUserModal
            open={shareModalOpen}
            onClose={() => setShareModalOpen(false)}
            contentType="job"
            contentId={alert.id}
          />
        )}
      </AppShell>
    </RequireAuth>
  );
}
