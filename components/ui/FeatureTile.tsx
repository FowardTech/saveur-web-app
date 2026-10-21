import Link from "next/link";
import { EvaIcon, type EvaIconName } from "@/components/icons/EvaIcon";

interface FeatureTileProps {
  href: string;
  /** Line icon shown in the neutral icon tile. */
  icon: EvaIconName;
  /** Unused — kept so existing callers keep compiling (tiles are no longer colored). */
  backdrop?: string;
  title: string;
  description?: string;
  animationDelayMs?: number;
  /** Unused — kept for API compatibility. */
  compact?: boolean;
}

/** Indeed-style tool card: flat white card with a thin warm-gray outline, a
 * small gray icon tile, bold dark title, gray description and a chevron.
 * Replaces the old full-color "App Store Today" tile. */
export function FeatureTile({ href, icon, title, description, animationDelayMs }: FeatureTileProps) {
  return (
    <Link
      href={href}
      className={`group flex items-start gap-3 rounded-card border border-border bg-surface-2 p-4 transition hover:border-brand/40 hover:bg-surface-1 ${
        animationDelayMs != null ? "animate-card-in" : ""
      }`}
      style={animationDelayMs != null ? { animationDelay: `${animationDelayMs}ms` } : undefined}
    >
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-primary">
        <EvaIcon name={icon} size={22} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-bold leading-snug text-primary">{title}</span>
        {description && <span className="line-clamp-2 text-sm text-hint">{description}</span>}
      </span>
      <EvaIcon name="chevron-right-outline" size={18} className="mt-1 shrink-0 text-hint transition group-hover:text-brand" />
    </Link>
  );
}
