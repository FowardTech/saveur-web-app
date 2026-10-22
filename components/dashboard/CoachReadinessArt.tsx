// Original illustrations for the "AI coach readiness" card on the dashboard.
// Drawn inline (no external assets) for a solid brand-blue background:
// white/translucent shapes with a single warm accent. `done` = coach ready
// (shield + check + rising bars), otherwise = setup in progress (target +
// route flag). Replaces the stock IconScout art that looked out of place.
interface ArtProps {
  size: number;
}

const ACCENT = "#FFC83D";

export function CoachReadyArt({ size }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" fill="none" aria-hidden="true">
      <circle cx="80" cy="80" r="70" fill="#fff" fillOpacity="0.12" />
      <circle cx="80" cy="80" r="52" fill="#fff" fillOpacity="0.12" />
      {/* rising bars */}
      <rect x="24" y="96" width="14" height="34" rx="5" fill="#fff" fillOpacity="0.35" />
      <rect x="122" y="84" width="14" height="46" rx="5" fill="#fff" fillOpacity="0.35" />
      {/* shield */}
      <path d="M80 28 116 41v31c0 22-15 38-36 48-21-10-36-26-36-48V41L80 28Z" fill="#fff" />
      <path d="M80 28 116 41v31c0 22-15 38-36 48V28Z" fill="#000" fillOpacity="0.06" />
      {/* check */}
      <circle cx="80" cy="73" r="19" fill="#2773EE" />
      <path d="m70 73.5 7.5 7.5L91 66" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      {/* sparkles */}
      <path d="M130 38v14M123 45h14" stroke={ACCENT} strokeWidth="4" strokeLinecap="round" />
      <path d="M30 52v10M25 57h10" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="40" cy="30" r="4" fill={ACCENT} />
      <circle cx="136" cy="112" r="3.5" fill="#fff" fillOpacity="0.8" />
    </svg>
  );
}

export function CoachSetupArt({ size }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" fill="none" aria-hidden="true">
      <circle cx="80" cy="84" r="68" fill="#fff" fillOpacity="0.12" />
      {/* target */}
      <circle cx="80" cy="84" r="46" fill="#fff" />
      <circle cx="80" cy="84" r="33" fill="#2773EE" fillOpacity="0.18" />
      <circle cx="80" cy="84" r="20" fill="#fff" />
      <circle cx="80" cy="84" r="9" fill="#2773EE" />
      {/* arrow */}
      <path d="m80 84 38-38" stroke={ACCENT} strokeWidth="6" strokeLinecap="round" />
      <path d="m110 40 12-2-2 12" stroke={ACCENT} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      {/* sparkles */}
      <path d="M28 40v12M22 46h12" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="134" cy="112" r="4" fill={ACCENT} />
      <circle cx="30" cy="124" r="3.5" fill="#fff" fillOpacity="0.8" />
    </svg>
  );
}
