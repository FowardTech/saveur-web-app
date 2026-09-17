// Illustration for app/learning/page.tsx's hero (product report: "the
// illustrations you added ... are ones you created yourself ... use real
// illustrations, pick ones that fit from online"). Real, freely-licensed
// illustration from unDraw (https://undraw.co — free for commercial and
// personal use, no attribution required), saved locally under
// public/illustrations/ so it renders without any external network call.
interface ArtProps {
  size: number;
}

// unDraw "Online learning" — reads immediately as "courses/curriculum".
export function ArtLearningCourses({ size }: ArtProps) {
  return <img src="/illustrations/online-learning.svg" width={size} height={size} alt="" aria-hidden="true" />;
}
