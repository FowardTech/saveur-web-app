import Link from "next/link";
import { EvaIcon, type EvaIconName } from "@/components/icons/EvaIcon";

interface FeatureTileProps {
  href: string;
  /** White line icon shown large at the top of the tile. */
  icon: EvaIconName;
  /** Plain solid backdrop color. */
  backdrop: string;
  title: string;
  description?: string;
  animationDelayMs?: number;
  /** Smaller tile (used on the dashboard quick actions). */
  compact?: boolean;
}

/** App Store "Today"-style tile: solid color backdrop, white line icon,
 * dark scrim fading in at the bottom, big bold title + description. Mirrors
 * the mobile Home FeatureCard. */
export function FeatureTile({ href, icon, backdrop, title, description, animationDelayMs, compact }: FeatureTileProps) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-col justify-end overflow-hidden shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${
        compact ? "min-h-[150px] rounded-[22px]" : "min-h-[300px] rounded-[28px]"
      } ${animationDelayMs != null ? "animate-card-in" : ""}`}
      style={{ backgroundColor: backdrop, ...(animationDelayMs != null ? { animationDelay: `${animationDelayMs}ms` } : {}) }}
    >
      <span
        className={`pointer-events-none absolute inline-flex items-center justify-center bg-white/20 text-white transition duration-300 group-hover:scale-105 ${
          compact ? "left-4 top-4 h-10 w-10 rounded-xl" : "left-5 top-5 h-14 w-14 rounded-2xl"
        }`}
      >
        <EvaIcon name={icon} size={compact ? 20 : 30} />
      </span>
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent from-35% to-black/60" />
      <span className={`relative flex flex-col ${compact ? "gap-0.5 p-4 pt-[80px]" : "gap-1.5 p-5 pt-[200px]"}`}>
        <span className={`font-extrabold leading-tight tracking-tight text-white ${compact ? "text-base" : "text-2xl"}`}>{title}</span>
        {description && <span className={`font-medium text-white/90 ${compact ? "line-clamp-2 text-xs" : "text-sm"}`}>{description}</span>}
      </span>
    </Link>
  );
}
