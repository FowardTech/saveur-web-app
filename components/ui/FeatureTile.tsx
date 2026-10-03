import Link from "next/link";

interface FeatureTileProps {
  href: string;
  /** Path to a 3D illustration (transparent PNG). */
  art: string;
  /** Plain solid backdrop color. */
  backdrop: string;
  title: string;
  description?: string;
  animationDelayMs?: number;
}

/** App Store "Today"-style tile: solid color backdrop, large 3D illustration,
 * dark scrim fading in at the bottom, big bold title + description. Mirrors
 * the mobile Home FeatureCard. */
export function FeatureTile({ href, art, backdrop, title, description, animationDelayMs }: FeatureTileProps) {
  return (
    <Link
      href={href}
      className={`group relative flex min-h-[300px] flex-col justify-end overflow-hidden rounded-[28px] shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${
        animationDelayMs != null ? "animate-card-in" : ""
      }`}
      style={{ backgroundColor: backdrop, ...(animationDelayMs != null ? { animationDelay: `${animationDelayMs}ms` } : {}) }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={art}
        alt=""
        className="pointer-events-none absolute left-1/2 top-5 h-[170px] w-[170px] -translate-x-1/2 object-contain transition duration-300 group-hover:scale-105"
      />
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent from-35% to-black/60" />
      <span className="relative flex flex-col gap-1.5 p-5 pt-[200px]">
        <span className="text-2xl font-extrabold leading-tight tracking-tight text-white">{title}</span>
        {description && <span className="text-sm font-medium text-white/90">{description}</span>}
      </span>
    </Link>
  );
}
