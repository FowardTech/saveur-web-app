// Illustrations for HomeBanner.tsx and WelcomeModal.tsx. REVERTED from
// unDraw back to original hand-drawn flat-shape scenes, sized up (product
// report: "The recent illustrations you added are too small make them
// moderate. Also i dont want illustrations from undraw. I would prefer
// humaan[s], icons8 and iconscout"). Checked live licensing on all three
// named sources: Humaaans is CC0/no-attribution but a mix-and-match
// person-parts library (Sketch/Figma), not ready-made themed scene SVGs;
// Icons8 and IconScout's free tiers both require a live attribution link
// unless a paid plan is purchased, which this app doesn't have. Per the
// user's choice, these are original artwork (same construction, and in
// goals.svg's case the exact same scene, as mobile's src/home/
// HomeHeroArt.tsx ArtMissionPhone/ArtWelcomeWave) saved as static SVGs
// under public/illustrations/ so they render without any external network
// call.
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
