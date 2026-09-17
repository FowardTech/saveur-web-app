import Link from "next/link";
import { EvaIcon, type EvaIconName } from "@/components/icons/EvaIcon";

interface ActionCardProps {
  href: string;
  icon: EvaIconName;
  title: string;
  description?: string;
  tint?: { bg: string; text: string };
  /** Optional stagger delay (ms) for the shared .animate-card-in entrance
   * (globals.css) — opt-in so existing callers (e.g. the landing page's
   * feature showcase) that don't pass it render exactly as before. */
  animationDelayMs?: number;
}

/** Matches the mobile app's ActionCard: rounded-12 card, soft tinted icon
 * badge, subtle shadow. Used for both the dashboard quick-actions grid and
 * the landing page's feature showcase.
 *
 * BUG FIX (product report: "most cards are white ... I want more designs
 * and colors throughout the whole web app ... differentiate them uniquely"):
 * the `tint` prop already cycled through 4 pastel colors (lib/navigation.ts
 * tintCycle), but only reached the small icon badge -- the card body itself
 * stayed flat bg-surface-2 (white) regardless of tint, so four "differently
 * colored" quick-action cards all still looked like one plain white grid.
 * Now the tint colors the whole card (it's already a very light pastel --
 * globals.css's --tint-* values -- so text-primary/text-hint keep working
 * contrast on it), with the icon badge inverted to a white/surface-1 circle
 * so the icon still pops against its now-colored card instead of blending
 * into it. */
export function ActionCard({ href, icon, title, description, tint, animationDelayMs }: ActionCardProps) {
  const cardBg = tint?.bg ?? "bg-tint-mint";
  const badgeText = tint?.text ?? "text-tint-mint-text";
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-3 rounded-card border border-border ${cardBg} p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${
        animationDelayMs != null ? "animate-card-in" : ""
      }`}
      style={animationDelayMs != null ? { animationDelay: `${animationDelayMs}ms` } : undefined}
    >
      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-1 ${badgeText}`}>
        <EvaIcon name={icon} size={20} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-medium text-primary">{title}</span>
        {description && <span className="text-sm text-hint">{description}</span>}
      </span>
    </Link>
  );
}
