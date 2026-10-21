import { type EvaIconName } from "@/components/icons/EvaIcon";
import { FeatureTile } from "@/components/ui/FeatureTile";

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

/** Indeed-style tool card (same flat look as FeatureTile). The `tint` prop is
 * accepted for compatibility but no longer colors the icon tile. */
export function ActionCard({ href, icon, title, description, animationDelayMs }: ActionCardProps) {
  return (
    <FeatureTile href={href} icon={icon} title={title} description={description} animationDelayMs={animationDelayMs} />
  );
}
