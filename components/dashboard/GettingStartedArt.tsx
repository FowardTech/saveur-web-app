// Illustrations for GettingStartedChecklist.tsx (product report: "I need a
// beautiful illustration or a nice image on this card placed on the right
// side... a readiness indication should appear in the card [once all tasks
// are complete]"). Ported 1:1 from mobile's src/home/HomeHeroArt.tsx
// (react-native-svg -> plain SVG is a direct prop-name match: Svg/Circle/
// Ellipse/Path/Rect become svg/circle/ellipse/path/rect, strokeWidth/
// strokeLinecap/strokeDasharray/rx/ry/cx/cy/fill are valid React DOM SVG
// attribute names unchanged) rather than drawn as new placeholder shapes —
// see that file's own header comment for why these read as real scenes
// (a winding road with a planted flag; a trophy with handles, base, and
// sparkles) instead of the plain rect/circle mockup shapes task #37 flagged
// elsewhere in this dashboard.
interface ArtProps {
  size: number;
}

// In-progress state — "here's the path, keep going".
export function ArtRoadmapPath({ size }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="62" r="48" fill="#0063f80f" />
      <ellipse cx="60" cy="100" rx="34" ry="5" fill="rgba(0,0,0,0.06)" />

      <path
        d="M22 92c8-14 0-22 12-30s6-18 18-24 8-16 22-18"
        stroke="#0063f8"
        strokeWidth={12}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M22 92c8-14 0-22 12-30s6-18 18-24 8-16 22-18"
        stroke="#EAF2FF"
        strokeWidth={2.5}
        strokeDasharray="6 7"
        strokeLinecap="round"
        fill="none"
      />

      <rect x="74" y="14" width="4" height="26" rx="2" fill="#F5B430" />
      <path d="M78 15l16 6-16 6z" fill="#FFC94A" />
    </svg>
  );
}

// Completed state — "you made it, you're ready" (the readiness indicator).
export function ArtTrophy({ size }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="62" r="48" fill="#FFC94A1a" />
      <ellipse cx="60" cy="98" rx="26" ry="5" fill="rgba(0,0,0,0.06)" />

      <path d="M38 34h44v18a22 22 0 0 1-44 0z" fill="#FFC94A" />
      <path d="M38 38c-10 0-14 6-14 12s4 10 12 11" stroke="#F5B430" strokeWidth={5} strokeLinecap="round" fill="none" />
      <path d="M82 38c10 0 14 6 14 12s-4 10-12 11" stroke="#F5B430" strokeWidth={5} strokeLinecap="round" fill="none" />
      <rect x="54" y="70" width="12" height="14" fill="#F5B430" />
      <rect x="42" y="84" width="36" height="8" rx="3" fill="#F5B430" />
      <rect x="36" y="92" width="48" height="7" rx="3.5" fill="#7C4DEF" />

      <path d="M26 30l2.4 5.6L34 38l-5.6 2.4L26 46l-2.4-5.6L18 38l5.6-2.4z" fill="#8B5CF6" />
      <circle cx="92" cy="26" r="4" fill="#0063f8" />
    </svg>
  );
}
