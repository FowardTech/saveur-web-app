// Illustrations for GettingStartedChecklist.tsx. Real, free IconScout
// illustrations (see HomeBannerArt.tsx's own comment for how these were
// sourced/licensed): road-to-knowledge.svg is "Free Maps Illustration" (a
// dashed route across a map, matching the "here's the path, keep going"
// framing), winners.svg is "Free The best team gets the trophy
// Illustration" by Ilusiku Studio. Saved as static SVGs under
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
