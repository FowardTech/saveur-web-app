import { evaIconPaths } from "@/lib/eva-icons.generated";

// Stroke-style icons that Eva doesn't ship (lucide paths, ISC license).
const S = (inner: string) =>
  `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</g>`;
const customIconPaths: Record<string, string> = {
  "audio-lines": S('<path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/>'),
  "thumbs-up": S('<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>'),
  "thumbs-down": S('<path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/>'),
  copy: S('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'),
  retry: S('<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>'),
  check: S('<path d="M20 6 9 17l-5-5"/>'),
};
const allIconPaths: Record<string, string> = { ...evaIconPaths, ...customIconPaths };

export type EvaIconName = keyof typeof evaIconPaths | keyof typeof customIconPaths;

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
  const inner = allIconPaths[name as string];
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
      stroke="currentColor"
      strokeWidth={0.6}
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

export default EvaIcon;
