import { EvaIcon, type EvaIconName } from "@/components/icons/EvaIcon";

export interface StatMiniCardProps {
  icon: EvaIconName;
  iconTint: string;
  title: string;
  value: string;
  valueColor: string;
  caption: string;
  /** Only rendered when set — matches mobile's optional progress bar. */
  progressPercent?: number;
  progressColor?: string;
  backgroundColor: string;
  className?: string;
}

/** Pastel-tinted stat tile — port of mobile's components/StatMiniCard.tsx
 * (icon + title row, bold value, optional progress bar, caption). Used by
 * the Career Roadmap "Milestone Overview" grid and elsewhere a small stat
 * tile fits, matching the "use this look and feel throughout the whole
 * app" home-redesign direction mobile followed. */
export function StatMiniCard({ icon, iconTint, title, value, valueColor, caption, progressPercent, progressColor, backgroundColor, className = "" }: StatMiniCardProps) {
  const showProgress = typeof progressPercent === "number";
  const clamped = Math.max(0, Math.min(100, progressPercent ?? 0));
  return (
    <div className={`flex flex-1 flex-col rounded-card p-3.5 ${className}`} style={{ backgroundColor }}>
      <div className="flex items-center gap-1.5">
        <span style={{ color: iconTint }}>
          <EvaIcon name={icon} size={14} />
        </span>
        <span className="text-xs font-bold" style={{ color: iconTint }}>
          {title}
        </span>
      </div>
      <span className="mt-2 text-lg font-bold" style={{ color: valueColor }}>
        {value}
      </span>
      {showProgress && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-black/[0.08]">
          <div className="h-full rounded-pill" style={{ width: `${clamped}%`, backgroundColor: progressColor ?? valueColor }} />
        </div>
      )}
      <span className="mt-2 text-xs text-hint">{caption}</span>
    </div>
  );
}
