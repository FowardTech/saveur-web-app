import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pins the workspace root to this project — without it, Next.js/Turbopack
  // gets confused by the sibling package-lock.json files that live one
  // level up in the shared ReactNativeProjects folder (unrelated projects,
  // not a monorepo) and warns about an inferred root on every build.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
