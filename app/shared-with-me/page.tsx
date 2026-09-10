"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { EvaIcon, type EvaIconName } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import * as sharesService from "@/lib/sharesService";
import type { ReceivedShareProps, PendingConnectionRequest } from "@/lib/sharesService";
import type { ApiError } from "@/lib/apiClient";
import { useAuth } from "@/app/providers/AuthProvider";

// Web counterpart to Saveur/src/more/SharedWithMe.tsx — the receiving/inbox
// side of the same in-app, user-to-user sharing system
// components/jobAlerts/ShareToUserModal.tsx already ports the SENDING side
// of (see that component + lib/sharesService.ts for the full contract,
// confirmed against Saveur-Backend's app/api/shares.py +
// app/services/shares_service.py). Two tabs, matching mobile's real labels
// exactly: "Shared with Me" (received content — feedback/video/job) and
// "Pending Requests" (incoming connection requests this user hasn't
// accepted/declined yet — product request item: "Before a user can share
// something with another Saveur user they must send a request first...").
// Tapping a received-share row opens app/shared-with-me/[id]/page.tsx,
// mirroring mobile's SharedContentDetail.tsx.
const ICON_BY_TYPE: Record<string, EvaIconName> = {
  feedback: "checkmark-circle-2-outline",
  video: "video-outline",
  job: "briefcase-outline",
};

function relativeTime(ms: number): string {
  const diffSec = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(ms).toLocaleDateString();
}

function previewLine(share: ReceivedShareProps, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (share.contentType === "job") {
    return [share.preview.title, share.preview.company].filter(Boolean).join(" · ") || "";
  }
  const role = share.preview.role || share.preview.interviewType || "";
  const score = typeof share.preview.overallScore === "number" ? t("web:sharedWithMe.score", { defaultValue: "Score: {{score}}%", score: share.preview.overallScore }) : null;
  return [role, score].filter(Boolean).join(" · ");
}

type Tab = "received" | "requests";

function SharedWithMeInner() {
  const { t } = useTranslation();
  const { loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab");
  const tab: Tab = tabParam === "requests" ? "requests" : "received";
  function setTab(next: Tab) {
    router.replace(`/shared-with-me${next === "requests" ? "?tab=requests" : ""}`);
  }

  const [shares, setShares] = useState<ReceivedShareProps[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [requests, setRequests] = useState<PendingConnectionRequest[] | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await sharesService.listReceivedShares();
      setShares(data);
      setLoadError(null);
    } catch (e) {
      setLoadError((e as ApiError).message || t("common:somethingWentWrong", { defaultValue: "Something went wrong. Please try again." }));
    }
  }, [t]);

  const loadRequests = useCallback(async () => {
    try {
      const data = await sharesService.listPendingConnectionRequests();
      setRequests(data);
      setRequestsError(null);
    } catch (e) {
      setRequestsError((e as ApiError).message || t("common:somethingWentWrong", { defaultValue: "Something went wrong. Please try again." }));
    }
  }, [t]);

  useEffect(() => {
    if (authLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  async function onRespond(requestId: string, accept: boolean) {
    if (respondingId) return;
    setRespondingId(requestId);
    try {
      await sharesService.respondToConnectionRequest(requestId, accept);
      setRequests((prev) => (prev ? prev.filter((r) => r.id !== requestId) : prev));
    } catch {
      // Advisory only — a refresh will resync if this failed silently.
      loadRequests();
    } finally {
      setRespondingId(null);
    }
  }

  const requestsCount = requests?.length ?? 0;

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-10">
          <PageHeader
            title={t("web:sharedWithMe.title", { defaultValue: "Shared with Me" })}
            subtitle={t("web:sharedWithMe.subtitle", { defaultValue: "Feedback, replays, and jobs other Saveur users have shared with you." })}
          />

          <div className="flex flex-wrap gap-2">
            <Pill selected={tab === "received"} onClick={() => setTab("received")}>
              {t("web:sharedWithMe.tabs.received", { defaultValue: "Shared with Me" })}
            </Pill>
            <Pill selected={tab === "requests"} onClick={() => setTab("requests")}>
              {requestsCount > 0
                ? t("web:sharedWithMe.tabs.requestsCount", { defaultValue: "Pending Requests ({{count}})", count: requestsCount })
                : t("web:sharedWithMe.tabs.requests", { defaultValue: "Pending Requests" })}
            </Pill>
          </div>

          {tab === "received" ? (
            <div className="flex flex-col gap-3">
              {loadError && <p className="text-sm text-danger">{loadError}</p>}

              {shares === null && !loadError && <SkeletonRows count={3} />}

              {shares && shares.length === 0 && !loadError && (
                <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                    <EvaIcon name="people-outline" size={20} />
                  </span>
                  <h2 className="font-semibold text-primary">{t("web:sharedWithMe.emptyTitle", { defaultValue: "Nothing shared yet" })}</h2>
                  <p className="text-sm text-hint">
                    {t("web:sharedWithMe.emptyBody", {
                      defaultValue: "When another Saveur user shares feedback, a video replay, or a job with you, it shows up here.",
                    })}
                  </p>
                </div>
              )}

              {shares &&
                shares.length > 0 &&
                shares.map((share) => (
                  <Link
                    key={share.id}
                    href={`/shared-with-me/${share.id}`}
                    className={`flex items-center gap-3 rounded-card border bg-surface-2 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                      !share.read ? "border-accent-purple" : "border-border"
                    }`}
                  >
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                      <EvaIcon name={ICON_BY_TYPE[share.contentType] ?? "share-outline"} size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm text-primary ${!share.read ? "font-semibold" : "font-medium"}`}>
                        {t("web:sharedWithMe.sharedBy", { defaultValue: "@{{username}} shared with you", username: share.senderUsername })}
                      </p>
                      <p className="truncate text-sm text-hint">{previewLine(share, t)}</p>
                      <p className="mt-1 text-xs text-hint">{relativeTime(share.createdAt)}</p>
                    </div>
                    {!share.read && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent-purple" />}
                  </Link>
                ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {requestsError && <p className="text-sm text-danger">{requestsError}</p>}

              {requests === null && !requestsError && <SkeletonRows count={3} />}

              {requests && requests.length === 0 && !requestsError && (
                <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                    <EvaIcon name="people-outline" size={20} />
                  </span>
                  <h2 className="font-semibold text-primary">{t("web:sharedWithMe.pendingEmptyTitle", { defaultValue: "No pending requests" })}</h2>
                  <p className="text-sm text-hint">
                    {t("web:sharedWithMe.pendingEmptyBody", {
                      defaultValue: "When another Saveur user asks to connect with you, it shows up here — accept to start sharing with each other.",
                    })}
                  </p>
                </div>
              )}

              {requests &&
                requests.length > 0 &&
                requests.map((req) => (
                  <div key={req.id} className="flex items-center gap-3 rounded-card border border-border bg-surface-2 p-4 shadow-sm">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                      <EvaIcon name="people-outline" size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-primary">
                        {t("web:sharedWithMe.connectionRequestFrom", { defaultValue: "@{{username}} wants to connect", username: req.requesterUsername })}
                      </p>
                      <p className="mt-1 text-xs text-hint">{relativeTime(req.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button size="sm" onClick={() => onRespond(req.id, true)} disabled={respondingId === req.id}>
                        {t("common:actions.accept", { defaultValue: "Accept" })}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onRespond(req.id, false)} disabled={respondingId === req.id}>
                        {t("common:actions.decline", { defaultValue: "Decline" })}
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}

// useSearchParams() requires a Suspense boundary in the app router (same
// pattern as app/career/networking/page.tsx).
export default function SharedWithMePage() {
  return (
    <Suspense fallback={null}>
      <SharedWithMeInner />
    </Suspense>
  );
}
