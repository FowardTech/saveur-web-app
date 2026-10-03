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
}

/** App Store "Today"-style tile: solid color backdrop, white line icon,
 * dark scrim fading in at the bottom, big bold title + description. Mirrors
 * the mobile Home FeatureCard. */
export function FeatureTile({ href, icon, backdrop, title, description, animationDelayMs }: FeatureTileProps) {
  return (
    <Link
      href={href}
      className={`group relative flex min-h-[300px] flex-col justify-end overflow-hidden rounded-[28px] shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${
        animationDelayMs != null ? "animate-card-in" : ""
      }`}
      style={{ backgroundColor: backdrop, ...(animationDelayMs != null ? { animationDelay: `${animationDelayMs}ms` } : {}) }}
    >
      <span className="pointer-events-none absolute left-5 top-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-white transition duration-300 group-hover:scale-105">
        <EvaIcon name={icon} size={30} />
      </span>
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent from-35% to-black/60" />
      <span className="relative flex flex-col gap-1.5 p-5 pt-[200px]">
        <span className="text-2xl font-extrabold leading-tight tracking-tight text-white">{title}</span>
        {description && <span className="text-sm font-medium text-white/90">{description}</span>}
      </span>
    </Link>
  );
}
