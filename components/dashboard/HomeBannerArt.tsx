// Illustrations for HomeBanner.tsx and WelcomeModal.tsx (product report:
// "i asked you to use illustrations from humaaan and icon8 and iconscout
// but you are still using the ones you created why?"). Both of these are
// now real, free IconScout illustrations (downloaded via "Copy SVG" on
// iconscout.com, which per IconScout's Simple License does not require
// attribution): goals.svg is "Free Mountaineer Reached Finish Spot
// Illustration" by senoa studio, welcome.svg is "Free Say hello to new
// people Illustration" by Ilusiku Studio. Saved as static SVGs under
// public/illustrations/ so they render without any external network call.
interface ArtProps {
  size: number;
}

// HomeBanner's dashboard hero — "today's mission".
export function ArtMissionPhone({ size }: ArtProps) {
  return <img src="/illustrations/goals.svg" width={size} height={size} alt="" aria-hidden="true" />;
}

// WelcomeModal's intro art — a friendly welcome scene.
export function ArtWelcomeWave({ size }: ArtProps) {
  return <img src="/illustrations/welcome.svg" width={size} height={size} alt="" aria-hidden="true" />;
}
