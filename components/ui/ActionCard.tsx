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
 * the landing page's feature showcase. */
export function ActionCard({ href, icon, title, description, tint, animationDelayMs }: ActionCardProps) {
  const badgeBg = tint?.bg ?? "bg-tint-mint";
  const badgeText = tint?.text ?? "text-tint-mint-text";
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${
        animationDelayMs != null ? "animate-card-in" : ""
      }`}
      style={animationDelayMs != null ? { animationDelay: `${animationDelayMs}ms` } : undefined}
    >
      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${badgeBg} ${badgeText}`}>
        <EvaIcon name={icon} size={20} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-medium text-primary">{title}</span>
        {description && <span className="text-sm text-hint">{description}</span>}
      </span>
    </Link>
  );
}
