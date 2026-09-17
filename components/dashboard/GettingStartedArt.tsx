// Illustrations for GettingStartedChecklist.tsx. REVERTED from unDraw back
// to original hand-drawn flat-shape scenes, sized up -- see
// HomeBannerArt.tsx's own comment for the full licensing writeup (same
// reasoning applies here). Identical scenes to mobile's src/home/
// HomeHeroArt.tsx ArtRoadmapPath/ArtTrophy, saved as static SVGs under
// public/illustrations/ so they render without any external network call.
interface ArtProps {
  size: number;
}

// In-progress state — "here's the path, keep going".
export function ArtRoadmapPath({ size }: ArtProps) {
  return <img src="/illustrations/road-to-knowledge.svg" width={size} height={size} alt="" aria-hidden="true" />;
}

// Completed state — "you made it, you're ready".
export function ArtTrophy({ size }: ArtProps) {
  return <img src="/illustrations/winners.svg" width={size} height={size} alt="" aria-hidden="true" />;
}
