// Illustration for app/learning/page.tsx's hero (task #46 visual quality
// pass: "Learning" was explicitly called out as looking sparse/unfinished
// compared to other pages -- it opened with a header and nothing else,
// unlike the dashboard's illustrated HomeBanner). Ported 1:1 from mobile's
// src/home/HomeHeroArt.tsx (react-native-svg -> plain SVG is a direct
// prop-name match) -- same porting approach as HomeBannerArt.tsx and
// GettingStartedArt.tsx.
interface ArtProps {
  size: number;
}

// An open book, brand-blue right page facing forward with a bookmark
// ribbon at the spine -- reads immediately as "courses/curriculum".
export function ArtLearningCourses({ size }: ArtProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="62" r="48" fill="#0063f80f" />
      <ellipse cx="60" cy="100" rx="34" ry="5" fill="rgba(0,0,0,0.06)" />

      <path d="M58 38 L20 46 L20 90 L58 96 Z" fill="#C7DBFF" />
      <rect x="27" y="58" width="24" height="4" rx="2" fill="#FFFFFF" />
      <rect x="27" y="68" width="24" height="4" rx="2" fill="#FFFFFF" />
      <rect x="27" y="78" width="18" height="4" rx="2" fill="#FFFFFF" />

      <path d="M62 38 L100 46 L100 90 L62 96 Z" fill="#0063f8" />
      <rect x="69" y="58" width="24" height="4" rx="2" fill="#EAF2FF" />
      <rect x="69" y="68" width="24" height="4" rx="2" fill="#EAF2FF" />
      <rect x="69" y="78" width="18" height="4" rx="2" fill="#EAF2FF" />

      <rect x="58" y="36" width="4" height="62" rx="2" fill="#0047B3" />
      <path d="M56 20h8v22l-4-3-4 3z" fill="#FFC94A" />
    </svg>
  );
}
