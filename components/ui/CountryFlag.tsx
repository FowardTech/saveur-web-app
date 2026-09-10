import { countryFlagEmoji } from "@/lib/countries";
import { EvaIcon } from "@/components/icons/EvaIcon";

const SIZE_PX: Record<"sm" | "md", number> = { sm: 18, md: 22 };

interface CountryFlagProps {
  /** Canonical English country name from lib/countries.ts's COUNTRIES. */
  country: string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Round flag badge for a country: the Unicode regional-indicator flag emoji
 * for that country inside a small circular, fixed-size, flex-centered
 * badge. "Remote - Anywhere" (and anything else with no mapped ISO code)
 * has no real flag — renders a globe icon in the same circular treatment
 * instead of inventing a fake flag, matching product's own "don't fabricate
 * a flag for a non-country" guidance.
 *
 * Used everywhere a country name appears (onboarding's country step,
 * settings' job-preferences editor) so the treatment stays identical across
 * both places.
 */
export function CountryFlag({ country, size = "sm", className = "" }: CountryFlagProps) {
  const flag = countryFlagEmoji(country);
  const px = SIZE_PX[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-3 ${className}`}
      style={{ width: px, height: px }}
      aria-hidden="true"
    >
      {flag ? (
        <span className="leading-none" style={{ fontSize: px * 0.7 }}>
          {flag}
        </span>
      ) : (
        <EvaIcon name="globe-2-outline" size={px * 0.6} className="text-hint" />
      )}
    </span>
  );
}
