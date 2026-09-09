import { evaIconPaths } from "@/lib/eva-icons.generated";

export type EvaIconName = keyof typeof evaIconPaths;

interface EvaIconProps {
  name: EvaIconName | (string & {});
  size?: number;
  className?: string;
  strokeWidth?: number;
}

/**
 * Thin wrapper around the `eva-icons` SVG set (the same icon library the
 * mobile app uses via `@ui-kitten/eva-icons`). Icon markup is pre-extracted
 * at build time into lib/eva-icons.generated.ts (see
 * scripts/generate-icons.mjs) so this component stays a plain, dependency-
 * free SVG renderer — no icon font, no runtime fetch. Color is controlled
 * entirely via `currentColor`, so wrap this in an element with a Tailwind
 * text-* class (or pass a className with a text color) to recolor it.
 */
export function EvaIcon({ name, size = 20, className }: EvaIconProps) {
  const inner = evaIconPaths[name as string];
  if (!inner) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`EvaIcon: unknown icon "${name}" — did you add it to scripts/generate-icons.mjs?`);
    }
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

export default EvaIcon;
