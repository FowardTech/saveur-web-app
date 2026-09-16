"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { EvaIcon, type EvaIconName } from "@/components/icons/EvaIcon";
import { useAuth } from "@/app/providers/AuthProvider";

// BUG FIX (product report: "The web tour guid is not professional at all.
// Its supposed to move all around the screen pointing to every section in
// the dashboard"): this used to be a centered modal step-carousel with no
// connection to the real page at all (see git history for the old
// version's own comment explaining why a carousel was chosen over a
// spotlight — that reasoning was about a walkthrough spanning MULTIPLE
// routes, which doesn't apply here since every one of these steps lives on
// the single /dashboard page). This is now a real spotlight tour: it finds
// the actual on-page section for each step via a `data-tour="..."`
// attribute (added to the real elements in app/dashboard/page.tsx),
// scrolls it into view, dims everything else, and cuts a highlighted hole
// around the real element with a tooltip pointing at it — moving from
// section to section exactly as asked, rather than floating in the center
// of the screen unconnected to anything.
//
// Mobile stores "seen" purely in local AsyncStorage, not a backend field
// (confirmed: no has_seen_tour/tour_completed column exists anywhere in
// Saveur-Backend) — this still mirrors that with a localStorage flag, same
// `saveur.<feature>.<uid>` convention as AnnouncementBanner/
// GettingStartedChecklist, rather than inventing new backend state mobile
// doesn't have either.
const TOUR_STORAGE_KEY_PREFIX = "saveur.appTourSeen.";

interface TourStep {
  selector: string;
  icon: EvaIconName;
  titleKey: string;
  titleDefault: string;
  bodyKey: string;
  bodyDefault: string;
}

// Each selector targets a `data-tour="..."` attribute added directly in
// app/dashboard/page.tsx, on a wrapper div around the real section rather
// than inside the section's own component — several of these
// (CoachingReportCard, GettingStartedChecklist) are self-contained and can
// legitimately render nothing for a given account, so anchoring the
// attribute on a stable wrapper (present regardless of that component's
// internal state) keeps the tour from ever pointing at an element that
// might not exist. GettingStartedChecklist/UpcomingSessionCard/
// ContinueWatchingCard/AnnouncementBanner are deliberately NOT tour steps
// for the same reason — they're real "may render nothing" sections, and a
// spotlight step with nothing to highlight is worse than not having the
// step at all. measureStep() below still defensively skips any step whose
// element can't be found or has zero size, in case a future account state
// ever hides one of the five stable steps too.
const STEPS: TourStep[] = [
  {
    selector: '[data-tour="dashboard-greeting"]',
    icon: "home-outline",
    titleKey: "web:tour.welcomeTitle",
    titleDefault: "Welcome to Saveur",
    bodyKey: "web:tour.welcomeBody",
    bodyDefault: "Your career coach, job search, and interview prep — all in one app. Let's take a quick look around your dashboard.",
  },
  {
    // BUG FIX (task #43 redundancy audit): this used to be two consecutive
    // steps -- this one saying "keeps you pointed at... jumping into a
    // mock interview", immediately followed by a second step on a
    // separate "Promo banner" card saying almost the same thing again
    // ("One tap here matches you with an AI interviewer... feedback in
    // minutes"). That second card was a near-duplicate of this banner and
    // has been removed (see app/dashboard/page.tsx and HomeBanner.tsx),
    // its "Start now" button folded into this banner instead -- so this
    // single step now covers what used to take two.
    selector: '[data-tour="dashboard-home-banner"]',
    icon: "flash-outline",
    titleKey: "web:tour.momentumTitle",
    titleDefault: "Your momentum, at a glance",
    bodyKey: "web:tour.momentumBody",
    bodyDefault: "One tap here matches you with an AI interviewer for your target role and gives you real feedback in minutes.",
  },
  {
    selector: '[data-tour="dashboard-quick-actions"]',
    icon: "grid-outline",
    titleKey: "web:tour.quickActionsTitle",
    titleDefault: "Everything else, one tap away",
    bodyKey: "web:tour.quickActionsBody",
    bodyDefault: "Your AI Coach, Resume Builder, Job Tracker, Learning Courses, and more all live here — the fastest way to jump into any tool.",
  },
  {
    selector: '[data-tour="dashboard-coaching-report"]',
    icon: "award-outline",
    titleKey: "web:tour.coachingReportTitle",
    titleDefault: "Track your progress",
    bodyKey: "web:tour.coachingReportBody",
    bodyDefault: "Once you've done a couple of mock interviews, your coaching report shows up here with real strengths and areas to improve.",
  },
];

function tourStorageKey(uid?: string | null): string {
  return `${TOUR_STORAGE_KEY_PREFIX}${uid || "anon"}`;
}

/** Clears the "seen" flag — used by the "Show app tour" replay entry in
 * Settings, which then navigates back to /dashboard where the tour is
 * mounted. */
export function resetAppTour(uid?: string | null): void {
  try {
    window.localStorage.removeItem(tourStorageKey(uid));
  } catch {
    // Private browsing / storage disabled — nothing to clean up.
  }
}

const SPOTLIGHT_PADDING = 10;
const TOOLTIP_WIDTH = 320;
const TOOLTIP_MARGIN = 16;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measureStep(selector: string): Rect | null {
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function AppTour() {
  const { t } = useTranslation();
  const { profile, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  const rafRef = useRef<number | null>(null);

  const uid = profile?.uid;

  // Portal target needs `document`, which doesn't exist during SSR for a
  // "use client" component — same guard as the video-interview full-screen
  // fix elsewhere in this app.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (loading || !profile || !uid) return;
    // Sequenced after WelcomeModal (mirrors mobile's overlay-priority
    // queue, simplified: web has no multi-modal priority system, so this
    // just waits for that one specific higher-priority modal to have
    // already been dismissed at least once, current or prior session,
    // before this one becomes eligible at all).
    if (!profile.hasSeenWelcomeModal) return;
    try {
      if (window.localStorage.getItem(tourStorageKey(uid))) return;
    } catch {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStepIndex(0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, [loading, profile, uid]);

  // Also reacts to the "Show app tour" replay entry clearing localStorage
  // while this component is already mounted (Settings navigates back to
  // /dashboard afterward, remounting this anyway, but a same-tab
  // storage-event listener makes it robust either way).
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === tourStorageKey(uid) && e.newValue === null) {
        setStepIndex(0);
        setOpen(true);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [uid]);

  // Scrolls the current step's real element into view, then continuously
  // re-measures its position every animation frame while the tour is open
  // — this is what makes the spotlight track scrolling/resizing/layout
  // shifts smoothly instead of needing a separate scroll/resize listener
  // for every possible cause of the target moving. If a step's element
  // can't be found (or is a display:none / zero-size element), it's
  // auto-skipped forward so the tour never gets stuck pointing at nothing.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const step = STEPS[stepIndex];
    const el = document.querySelector<HTMLElement>(step.selector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      // Nothing to spotlight for this step right now — skip forward
      // (or close, if this was the last step) rather than showing a
      // spotlight around nothing.
      if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1);
      else close();
      return;
    }

    function tick() {
      if (cancelled) return;
      setRect(measureStep(step.selector));
      rafRef.current = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex]);

  function close() {
    setOpen(false);
    try {
      window.localStorage.setItem(tourStorageKey(uid), "1");
    } catch {
      // Best-effort — worst case the tour just shows again next visit.
    }
  }

  if (!open || !mounted) return null;

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  // Tooltip placement: prefer below the spotlighted element; flip above it
  // if there isn't enough room before the viewport bottom. Horizontally
  // centered on the target but clamped so it never runs off either edge.
  let tooltipTop: number | null = null;
  let tooltipLeft = TOOLTIP_MARGIN;
  let placement: "below" | "above" | "center" = "center";
  if (rect && typeof window !== "undefined") {
    const spaceBelow = window.innerHeight - (rect.top + rect.height + SPOTLIGHT_PADDING);
    const spaceAbove = rect.top - SPOTLIGHT_PADDING;
    if (spaceBelow >= 180 || spaceBelow >= spaceAbove) {
      placement = "below";
      tooltipTop = rect.top + rect.height + SPOTLIGHT_PADDING + 12;
    } else {
      placement = "above";
      tooltipTop = rect.top - SPOTLIGHT_PADDING - 12;
    }
    tooltipLeft = Math.min(
      Math.max(rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2, TOOLTIP_MARGIN),
      window.innerWidth - TOOLTIP_WIDTH - TOOLTIP_MARGIN
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      {/* Dimmed backdrop with a cut-out "spotlight" hole around the real
          element — a single box-shadow (rather than an SVG mask) is enough
          to dim the whole screen except this one rounded rectangle, and it
          transitions smoothly as `rect` updates every frame while
          scrolling/resizing. Blocks interaction with the rest of the page
          (pointer-events: auto here) so the only way through the tour is
          its own Back/Next/Skip controls. */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()}>
        {rect ? (
          <div
            className="absolute rounded-xl ring-2 ring-brand transition-all duration-200 ease-out"
            style={{
              top: rect.top - SPOTLIGHT_PADDING,
              left: rect.left - SPOTLIGHT_PADDING,
              width: rect.width + SPOTLIGHT_PADDING * 2,
              height: rect.height + SPOTLIGHT_PADDING * 2,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-black/72" />
        )}
      </div>

      {/* Tooltip card, positioned next to the spotlighted element (or
          centered if we don't have a measured rect yet on the very first
          frame). */}
      <div
        className="absolute w-[320px] max-w-[calc(100vw-2rem)] rounded-card border border-border bg-surface-2 p-5 shadow-2xl transition-all duration-200 ease-out"
        style={
          rect && tooltipTop !== null
            ? placement === "above"
              ? { left: tooltipLeft, bottom: window.innerHeight - tooltipTop }
              : { left: tooltipLeft, top: tooltipTop }
            : { left: "50%", top: "50%", transform: "translate(-50%, -50%)" }
        }
      >
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
            <EvaIcon name={step.icon} size={18} />
          </span>
          <button type="button" onClick={close} className="p-1 text-xs font-medium text-hint hover:text-primary">
            {t("web:tour.skip", { defaultValue: "Skip" })}
          </button>
        </div>

        <h2 className="mt-3 text-base font-bold text-primary">{t(step.titleKey, { defaultValue: step.titleDefault })}</h2>
        <p className="mt-1.5 text-sm text-hint">{t(step.bodyKey, { defaultValue: step.bodyDefault })}</p>

        <div className="mt-4 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === stepIndex ? "bg-brand" : "bg-surface-4"}`} />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            className="p-2 text-sm font-medium text-hint disabled:opacity-40"
          >
            {t("web:tour.back", { defaultValue: "Back" })}
          </button>
          <button
            type="button"
            onClick={() => (isLast ? close() : setStepIndex((i) => i + 1))}
            className="rounded-pill bg-brand px-4 py-1.5 text-sm font-bold text-white"
          >
            {isLast ? t("web:tour.getStarted", { defaultValue: "Get started" }) : t("web:tour.next", { defaultValue: "Next" })}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default AppTour;
