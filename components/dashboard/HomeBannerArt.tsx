// Illustrations for HomeBanner.tsx and WelcomeModal.tsx (product report:
// "the illustrations you added ... are ones you created yourself ... use
// real illustrations, pick ones that fit from online"). These now render
// real, freely-licensed illustrations from unDraw (https://undraw.co —
// license: free for commercial and personal use, no attribution required;
// see public/illustrations/README for the full set) instead of hand-drawn
// shape mockups, saved locally as static SVGs under public/illustrations/
// so they render without any external network call.
interface ArtProps {
  size: number;
}

// HomeBanner's dashboard hero — "today's mission" (unDraw "Goals").
export function ArtMissionPhone({ size }: ArtProps) {
  return <img src="/illustrations/goals.svg" width={size} height={size} alt="" aria-hidden="true" />;
}

// WelcomeModal's intro art — a friendly welcome scene (unDraw "Welcome").
export function ArtWelcomeWave({ size }: ArtProps) {
  return <img src="/illustrations/welcome.svg" width={size} height={size} alt="" aria-hidden="true" />;
}
