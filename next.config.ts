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
  // Dev-only: lets you open the dev server from another device on the same
  // LAN (e.g. testing on a phone, or a second computer) via `npm run dev`'s
  // printed network URL (http://<your-machine's-LAN-IP>:3000) — Next.js
  // blocks cross-origin dev requests (including the HMR websocket) by
  // default for safety, which otherwise breaks the page with a "Blocked
  // cross-origin request to Next.js dev resource /_next/hmr" warning and
  // silently-stale/never-updating client bundles. Only takes literal
  // hostnames/IPs (no regex/wildcard support in Next.js's own config type)
  // — the IP below is whatever this machine's LAN address was when this was
  // added; if it changes (different network, DHCP renewal), add the new one
  // here too. Has zero effect in production builds — `next start` / a real
  // deployment ignores this entirely.
  allowedDevOrigins: ["192.168.2.55"],
};

export default nextConfig;
