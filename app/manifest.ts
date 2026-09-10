import type { MetadataRoute } from "next";

// Next's app/manifest.ts convention — served at /manifest.webmanifest (see
// layout.tsx's metadata.manifest). Minimal on purpose: this is about basic
// installability + the logo showing up in an "Add to Home Screen" prompt,
// not full PWA offline support (no service worker, no offline caching).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Saveur — AI Career Coaching",
    short_name: "Saveur",
    description:
      "AI mock interviews, coding practice, resume tools, a personalized career roadmap, and job alerts.",
    start_url: "/dashboard",
    display: "standalone",
    // Matches app/globals.css's --brand token.
    theme_color: "#0063f8",
    background_color: "#f5f5f6",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/logo-badge.png", sizes: "1024x1024", type: "image/png" },
    ],
  };
}
