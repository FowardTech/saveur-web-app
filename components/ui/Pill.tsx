import type { EvaIconName } from "@/components/icons/EvaIcon";
import { EvaIcon } from "@/components/icons/EvaIcon";

interface PillProps {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  /** Small lock badge + reduced interactivity styling — mirrors mobile's
   * LockBadge treatment on gated pills (e.g. Video practice mode, Premium
   * personas) without actually disabling the click handler, since the
   * gate itself (e.g. the upgrade prompt) is handled by the caller's
   * onClick. */
  locked?: boolean;
  icon?: EvaIconName;
  leading?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}

/**
 * Shared pill/chip control — generalizes the onboarding step's local `Chip`
 * component (app/onboarding/page.tsx) into a reusable primitive so every
 * screen with mobile-style pill filters/selectors (interview setup, career
 * roadmap filters, job alert filters, etc.) renders the exact same visual,
 * matching mobile's `chip`/`difficultyPill`/`modeCard` convention: a real
 * border in both selected and unselected states (not just a background
 * color) so an unselected pill still reads as tappable.
 */
export function Pill({ selected, onClick, children, locked, icon, leading, className = "", disabled, type = "button" }: PillProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex items-center gap-1.5 rounded-pill border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
        selected
          ? "border-brand bg-brand text-white"
          : "border-border bg-surface-1 text-hint hover:border-brand/50 hover:text-primary"
      } ${className}`}
    >
      {locked && (
        <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-surface-4 text-primary shadow-sm">
          <EvaIcon name="lock-outline" size={10} />
        </span>
      )}
      {leading}
      {icon && <EvaIcon name={icon} size={16} className={selected ? "text-white" : ""} />}
      {children}
    </button>
  );
}

/** A pill-shaped card variant with an icon on top, a title, and an optional
 * one-line description underneath — matches mobile's `modeCard`/`personaCard`
 * (practice-mode / persona picker) rather than the flatter, single-line
 * `chip` the Pill component above renders. */
export function PillCard({
  selected,
  onClick,
  icon,
  title,
  description,
  locked,
  className = "",
}: {
  selected?: boolean;
  onClick?: () => void;
  icon: EvaIconName;
  title: string;
  description?: string;
  locked?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 rounded-card border-2 px-3 py-4 text-center transition ${
        selected ? "border-brand bg-brand/5" : "border-border bg-surface-1 hover:border-brand/40"
      } ${className}`}
    >
      {locked && (
        <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface-4 text-primary shadow-sm">
          <EvaIcon name="lock-outline" size={11} />
        </span>
      )}
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${selected ? "bg-brand text-white" : "bg-surface-3 text-hint"}`}>
        <EvaIcon name={icon} size={18} />
      </span>
      <span className={`text-sm font-semibold ${selected ? "text-brand" : "text-primary"}`}>{title}</span>
      {description && <span className="text-xs leading-snug text-hint">{description}</span>}
    </button>
  );
}
