// Illustrations for GettingStartedChecklist.tsx (product report: "the
// illustrations you added ... are ones you created yourself ... use real
// illustrations, pick ones that fit from online"). Real, freely-licensed
// illustrations from unDraw (https://undraw.co — free for commercial and
// personal use, no attribution required), saved locally under
// public/illustrations/ so they render without any external network call.
interface ArtProps {
  size: number;
}

// In-progress state — "here's the path, keep going" (unDraw "Road to
// Knowledge").
export function ArtRoadmapPath({ size }: ArtProps) {
  return <img src="/illustrations/road-to-knowledge.svg" width={size} height={size} alt="" aria-hidden="true" />;
}

// Completed state — "you made it, you're ready" (unDraw "Winners").
export function ArtTrophy({ size }: ArtProps) {
  return <img src="/illustrations/winners.svg" width={size} height={size} alt="" aria-hidden="true" />;
}
