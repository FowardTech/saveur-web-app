"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { trackApplication } from "@/lib/applicationTrackingService";

// Web counterpart to Saveur/src/more/WebViewScreen.tsx's application-
// tracking, for the "Apply" action on a job posting. Read that file's own
// header comment for the full mechanism it uses on mobile (a native WebView
// component the app fully controls, so it can read the loaded page's
// current URL and inject JS into its DOM regardless of origin) and why
// NEITHER of its two auto-detection signals (URL-looks-like-a-thank-you-page,
// injected-script scans the rendered page for confirmation text) is
// possible here: a window.open()'d tab is a separate, cross-origin browsing
// context once it navigates to the employer's/ATS's own domain — same-origin
// policy blocks this app from reading its URL or injecting anything into it,
// by design, and a large fraction of real ATS platforms (Workday, Greenhouse,
// LinkedIn, etc.) also block being iframed at all via
// X-Frame-Options/frame-ancestors, so there's no iframe-based workaround
// either. This is a hard browser limitation, not a gap to engineer around.
//
// What IS fully portable from mobile: its fallback path (WebViewScreen.tsx's
// `beforeRemove` listener, ~lines 361-389) — ask "did you apply?" only if the
// user plausibly engaged with the application (spent real time away, and
// actually came back) rather than just glanced and bounced. A browser tab
// can't observe in-page navigation on a cross-origin page, but it CAN
// observe the one thing that matters just as much: the user left this tab
// (Page Visibility API) and came back after a realistic dwell time. That's
// promoted to the PRIMARY (not just fallback) mechanism here, since true
// auto-detection isn't reachable on web at all — every tracked application
// from this flow is therefore `source: 'manual_confirm'`.
//
// Same 25s dwell threshold as mobile's own FALLBACK_MIN_DWELL_MS (real users
// skimming a posting and starting an application take at least that long;
// shorter than that is almost always someone who opened the tab and bounced
// straight back).
const MIN_DWELL_MS = 25000;

export interface ApplyTrackingJob {
  company: string;
  role: string;
  location?: string | null;
  applyUrl?: string | null;
  companyLogoUrl?: string | null;
  // Skip the whole return-to-tab watch entirely for a job already marked
  // applied (or otherwise tracked elsewhere) — nothing to ask about, and
  // re-prompting on every reopen of an already-tracked posting would just be
  // annoying. Callers that have no such concept (e.g. a job shared by
  // another user, with no "applied" state of its own) simply omit this.
  alreadyApplied?: boolean;
}

type Feedback = { tone: "success" | "danger"; text: string } | null;

export function useApplyTracking(job: ApplyTrackingJob) {
  const { t } = useTranslation();
  const [promptOpen, setPromptOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // Refs, not state — read from a visibility/focus event handler and a
  // click handler, neither of which should cause (or need) a re-render.
  const jobRef = useRef(job);
  const openedAtRef = useRef<number | null>(null);
  const leftRef = useRef(false);
  const promptedRef = useRef(false);
  const trackedRef = useRef(false);

  // Keeps jobRef current without mutating it during render (React refs
  // should only ever be read/written from an effect or event handler).
  useEffect(() => {
    jobRef.current = job;
  }, [job]);

  useEffect(() => {
    function onPossibleReturn() {
      if (document.visibilityState === "hidden") {
        // Only counts as "actually left" if there's a pending apply-open to
        // return from — an unrelated tab switch shouldn't arm this.
        if (openedAtRef.current) leftRef.current = true;
        return;
      }
      if (!openedAtRef.current || !leftRef.current || promptedRef.current || trackedRef.current) return;
      if (jobRef.current.alreadyApplied) return;
      if (Date.now() - openedAtRef.current < MIN_DWELL_MS) return;
      promptedRef.current = true;
      setFeedback(null);
      setPromptOpen(true);
    }
    document.addEventListener("visibilitychange", onPossibleReturn);
    // Belt-and-suspenders: some browsers fire `focus` on the original
    // window more reliably than `visibilitychange` when a popup/new tab
    // that had focus is closed rather than just backgrounded.
    window.addEventListener("focus", onPossibleReturn);
    return () => {
      document.removeEventListener("visibilitychange", onPossibleReturn);
      window.removeEventListener("focus", onPossibleReturn);
    };
  }, []);

  const openApply = useCallback(() => {
    const url = jobRef.current.applyUrl;
    if (!url) return;
    const popup = window.open(url, "_blank", "noopener,noreferrer");
    // Popup blocked, or otherwise never actually opened a real second
    // context to leave/return from — nothing to watch. Also skip arming the
    // watch (but still let the tab open) for a job already marked applied.
    if (!popup || jobRef.current.alreadyApplied) return;
    openedAtRef.current = Date.now();
    leftRef.current = false;
    promptedRef.current = false;
    trackedRef.current = false;
  }, []);

  const dismissPrompt = useCallback(() => {
    setPromptOpen(false);
  }, []);

  // Returns whether tracking actually succeeded, so a caller that wants to
  // sync its own "applied" state locally (e.g. flipping an alert's badge
  // without waiting on a refetch) only does so when it's real.
  const confirmApplied = useCallback(async (): Promise<boolean> => {
    if (isSubmitting || trackedRef.current) return trackedRef.current;
    setIsSubmitting(true);
    setFeedback(null);
    let succeeded = false;
    try {
      await trackApplication({
        company: jobRef.current.company,
        role: jobRef.current.role,
        location: jobRef.current.location,
        applyUrl: jobRef.current.applyUrl,
        companyLogoUrl: jobRef.current.companyLogoUrl,
        source: "manual_confirm",
      });
      trackedRef.current = true;
      succeeded = true;
      setFeedback({
        tone: "success",
        text: t("web:jobAlerts.details.applicationTrackedBody", {
          defaultValue: "Added {{role}} at {{company}} to your Application Tracker.",
          role: jobRef.current.role,
          company: jobRef.current.company,
        }),
      });
      setTimeout(() => setPromptOpen(false), 1200);
    } catch {
      // Mirrors mobile: don't interrupt the apply flow over a tracking
      // failure — the application itself already went through on the
      // employer's site regardless of whether we managed to log it here.
      setPromptOpen(false);
    } finally {
      setIsSubmitting(false);
    }
    return succeeded;
  }, [isSubmitting, t]);

  return { openApply, promptOpen, isSubmitting, feedback, confirmApplied, dismissPrompt };
}
