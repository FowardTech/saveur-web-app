// Illustration for app/learning/page.tsx's hero. Real, free IconScout
// illustration (see HomeBannerArt.tsx's own comment for how these were
// sourced/licensed) -- "Free Online learning female student holding laptop
// near mobile Illustration" by Arslan Haider. Saved as a static SVG under
// public/illustrations/ so it renders without any external network call.
interface ArtProps {
  size: number;
}

export function ArtLearningCourses({ size }: ArtProps) {
  return <img src="/illustrations/online-learning.svg" width={size} height={size} alt="" aria-hidden="true" />;
}
