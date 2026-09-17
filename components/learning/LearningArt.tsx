// Illustration for app/learning/page.tsx's hero. REVERTED from unDraw back
// to an original hand-drawn open-book scene, sized up -- see
// HomeBannerArt.tsx's own comment for the full licensing writeup (same
// reasoning applies here). Identical scene to mobile's src/home/
// HomeHeroArt.tsx ArtLearningCourses, saved as a static SVG under
// public/illustrations/ so it renders without any external network call.
interface ArtProps {
  size: number;
}

export function ArtLearningCourses({ size }: ArtProps) {
  return <img src="/illustrations/online-learning.svg" width={size} height={size} alt="" aria-hidden="true" />;
}
