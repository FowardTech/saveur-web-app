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
 * The three illustrations are simple, brand-colored inline SVGs (no image
 * assets) built from this app's existing surface/border/brand CSS variables
 * (see app/globals.css's `:root`/`.dark` blocks), so they stay in sync with
 * the rest of the UI automatically in both light and dark mode — same
 * simple line-art spirit as EvaIcon rather than a photo or a busy vector
 * scene. */
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

// Generic "empty list" — a lone card with a few placeholder lines, for any
// screen whose main content is a list/grid of items the user hasn't created
// yet (job alerts, career diary entries, resume variants, etc.).
function EmptyListArt() {
  return (
    <svg width="88" height="88" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="48" cy="48" r="40" fill="var(--surface-3)" />
      <rect x="28" y="30" width="40" height="36" rx="6" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="2" />
      <line x1="36" y1="42" x2="60" y2="42" stroke="var(--border)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="36" y1="50" x2="60" y2="50" stroke="var(--border)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="36" y1="58" x2="52" y2="58" stroke="var(--border)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="67" cy="27" r="5" fill="var(--brand)" opacity="0.85" />
    </svg>
  );
}

// "No results" — a magnifying glass, for a search/filter that came back
// empty (e.g. a company filter with no matching job alerts).
function EmptySearchArt() {
  return (
    <svg width="88" height="88" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="48" cy="48" r="40" fill="var(--surface-3)" />
      <circle cx="44" cy="42" r="16" fill="var(--surface-2)" stroke="var(--border)" strokeWidth="2.5" />
      <line x1="55" y1="53" x2="68" y2="66" stroke="var(--border)" strokeWidth="3" strokeLinecap="round" />
      <line x1="38" y1="42" x2="50" y2="42" stroke="var(--brand)" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
    </svg>
  );
}

// "Empty inbox" — a tray, for message/notification/request-style lists
// (Shared With Me, Applications, notifications).
function EmptyInboxArt() {
  return (
    <svg width="88" height="88" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="48" cy="48" r="40" fill="var(--surface-3)" />
      <path
        d="M28 46 L38 46 L44 54 L52 54 L58 46 L68 46 L68 64 Q68 68 64 68 L32 68 Q28 68 28 64 Z"
        fill="var(--surface-2)"
        stroke="var(--border)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M28 46 L34 30 Q35 28 37 28 L59 28 Q61 28 62 30 L68 46"
        fill="none"
        stroke="var(--border)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle cx="66" cy="26" r="5" fill="var(--brand)" opacity="0.85" />
    </svg>
  );
}
