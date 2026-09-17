import type { ReactNode } from "react";
import { EvaIcon, type EvaIconName } from "@/components/icons/EvaIcon";

export type EmptyStateIllustration = "list" | "search" | "inbox";

interface EmptyStateProps {
  title: string;
  description?: string;
  /** Which built-in inline-SVG illustration to show — "list" (a generic
   * "nothing here yet" empty list/card, the default), "search" (no results
   * for a query/filter), or "inbox" (no messages/notifications/requests).
   * Ignored when `icon` is passed instead. */
  illustration?: EmptyStateIllustration;
  /** Escape hatch for the older icon-in-a-circle treatment a few screens
   * already used (e.g. a lock icon for "requires a paid plan") — takes
   * priority over `illustration` when set, so those call sites don't need
   * to be forced into one of the three generic illustrations above. */
  icon?: EvaIconName;
  action?: ReactNode;
  className?: string;
}

/** Shared "nothing here yet" panel — icon/illustration + title + optional
 * description + optional action, in the same bordered-card treatment
 * several screens already hand-rolled individually (see e.g. the old
 * proRequired/unsupported panels in app/ai-coach/voice/page.tsx). Centralizing
 * it here means every screen that adopts it automatically gets a real
 * illustration instead of plain text, with no per-page SVG work.
 *
 * The three illustrations are original hand-drawn flat-shape scenes (see
 * components/dashboard/HomeBannerArt.tsx's own comment for the full
 * licensing writeup on why these moved off unDraw), saved locally under
 * public/illustrations/ so they render without any external network
 * call. */
export function EmptyState({ title, description, illustration = "list", icon, action, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-card border border-border bg-surface-2 px-6 py-10 text-center ${className}`}
    >
      {icon ? (
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 text-hint">
          <EvaIcon name={icon} size={20} />
        </span>
      ) : (
        <EmptyIllustration variant={illustration} />
      )}
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
        {description && <p className="max-w-xs text-sm text-hint">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

function EmptyIllustration({ variant }: { variant: EmptyStateIllustration }) {
  if (variant === "search") return <EmptySearchArt />;
  if (variant === "inbox") return <EmptyInboxArt />;
  return <EmptyListArt />;
}

// Generic "empty list" — for any screen whose main content is a list/grid
// of items the user hasn't created yet (job alerts, career diary entries,
// resume variants, etc.).
function EmptyListArt() {
  return <img src="/illustrations/empty.svg" width="112" height="112" alt="" aria-hidden="true" />;
}

// "No results" — for a search/filter that came back empty (e.g. a company
// filter with no matching job alerts).
function EmptySearchArt() {
  return <img src="/illustrations/searching.svg" width="112" height="112" alt="" aria-hidden="true" />;
}

// "Empty inbox" — for message/notification/request-style lists (Shared With
// Me, Applications, notifications).
function EmptyInboxArt() {
  return <img src="/illustrations/empty-mailbox.svg" width="112" height="112" alt="" aria-hidden="true" />;
}
