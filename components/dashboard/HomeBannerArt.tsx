// Illustrations for HomeBanner.tsx and WelcomeModal.tsx (task #37: "Add
// real illustrations to web dashboard, not SVG shapes"). Ported 1:1 from
// mobile's src/home/HomeHeroArt.tsx (react-native-svg -> plain SVG is a
// direct prop-name match: Svg/Circle/Ellipse/Path/Rect/Polygon become
// svg/circle/ellipse/path/rect/polygon, and strokeWidth/strokeLinecap/
// strokeLinejoin/rx/ry/cx/cy/fill/points are valid React DOM SVG attribute
// names unchanged) rather than the placeholder rect-mockup / plain blurred-
// circle treatment those two components had before — see
// components/dashboard/GettingStartedArt.tsx's header comment for the same
// porting rationale applied to that card.
interface ArtProps {
  size: number;
}

// HomeBanner's dashboard hero — "today's mission" phone-on-a-podium scene
// (mobile's Home hero card), replacing the banner's previous zero-
// illustration treatment (two blurred gradient circles + one small floating
// icon badge, no actual picture).
export function ArtMissionPhone({ size }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" aria-hidden="true">
      <circle cx="70" cy="72" r="56" fill="#0063f80f" />

      <ellipse cx="66" cy="120" rx="40" ry="10" fill="rgba(0,0,0,0.06)" />
      <ellipse cx="66" cy="114" rx="40" ry="10" fill="#C7DBFF" />

      <rect x="34" y="30" width="64" height="90" rx="14" fill="#0063f8" />
      <rect x="42" y="40" width="48" height="62" rx="6" fill="#EAF2FF" />
      <circle cx="66" cy="58" r="11" fill="#C7DBFF" />
      <path d="M50 88c0-10 7.2-17 16-17s16 7 16 17z" fill="#C7DBFF" />
      <rect x="48" y="94" width="36" height="4" rx="2" fill="#C7DBFF" />

      <circle cx="102" cy="46" r="14" fill="#0EAD69" />
      <path d="M95 46l5 5 9-10" stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />

      <circle cx="108" cy="92" r="12" fill="#FFC94A" />
      <path d="M108 84.5l2.3 4.7 5.2 0.7-3.8 3.7 0.9 5.1-4.6-2.4-4.6 2.4 0.9-5.1-3.8-3.7 5.2-0.7z" fill="#FFFFFF" />

      <polygon points="24,50 26,56 32,58 26,60 24,66 22,60 16,58 22,56" fill="#0063f8" opacity={0.5} />
      <circle cx="112" cy="24" r="3" fill="#0063f8" opacity={0.45} />
    </svg>
  );
}

// WelcomeModal's intro art — a waving figure with a chat-bubble accent (the
// AI Coach "greeting" beat), replacing the modal's previous fake-document-
// preview mockup (a bordered rect with a few colored bars and a dot
// standing in for "app screenshot").
export function ArtWelcomeWave({ size }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="62" r="48" fill="#0063f80f" />
      <ellipse cx="56" cy="104" rx="30" ry="5" fill="rgba(0,0,0,0.06)" />

      <circle cx="52" cy="52" r="14" fill="#0063f8" />
      <path d="M32 100c0-15.5 9-26 20-26s20 10.5 20 26z" fill="#0063f8" />

      <path d="M64 78c8-2 14-10 14-20" stroke="#0063f8" strokeWidth={7} strokeLinecap="round" fill="none" />
      <circle cx="78" cy="58" r="6.5" fill="#0063f8" />

      <path
        d="M78 20h28a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8h-8l-6 8v-8h-14a8 8 0 0 1-8-8V28a8 8 0 0 1 8-8z"
        fill="#FFC94A"
      />
      <circle cx="88" cy="34" r="2.6" fill="#FFFFFF" />
      <circle cx="97" cy="34" r="2.6" fill="#FFFFFF" />
      <circle cx="106" cy="34" r="2.6" fill="#FFFFFF" />
    </svg>
  );
}
