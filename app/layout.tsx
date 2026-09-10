import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "./providers/ThemeProvider";
import { AuthProvider } from "./providers/AuthProvider";
import { I18nProvider } from "./providers/I18nProvider";

// Plus Jakarta Sans, self-hosted via the @fontsource/plus-jakarta-sans
// package (next/font/local reads its .woff2 files at build time — no
// runtime/build-time network call to fonts.googleapis.com, unlike
// next/font/google, so this keeps working in network-restricted CI/build
// environments). Weights mirror the mobile app's three named cuts:
// PlusJakartaSans-Regular (400), -Medium (500), -Bold (700).
const plusJakartaSans = localFont({
  src: [
    {
      path: "../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

// MontserratAlternates-Black (900) — mobile's dedicated wordmark font for
// the "Saveur" brand text specifically (components/BrandWordmark.tsx),
// distinct from the app's body font (Plus Jakarta Sans above). Self-hosted
// from public/fonts the same way — copied from the mobile repo's own
// assets/fonts/MontserratAlternates-Black.ttf — rather than next/font/google,
// for the same network-restricted-build-environment reason as above. Only
// ever applied via the `font-brand` Tailwind token to the wordmark text
// itself, never to body copy.
const montserratAlternates = localFont({
  src: "../public/fonts/MontserratAlternates-Black.ttf",
  weight: "900",
  style: "normal",
  variable: "--font-montserrat-alternates",
  display: "swap",
});

// NEXT_PUBLIC_SITE_URL isn't set anywhere yet (no web deployment domain is
// confirmed in this repo's env files) — falls back to the app.saveurnow.com
// convention the rest of this app follows (api.saveurnow.com is already
// live). Needed so the relative image paths below resolve to absolute URLs
// in the actual <meta> tags — social platforms/crawlers won't follow
// relative og:image URLs. Update the env var once the real production
// domain is confirmed.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://app.saveurnow.com";

const TITLE = "Saveur — AI Career Coaching";
const DESCRIPTION =
  "Saveur helps you land your next role with AI mock interviews, coding practice, resume tools, a personalized career roadmap, and job alerts.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  manifest: "/manifest.webmanifest",
  // Real Saveur logo badge (see public/logo-badge.png) for link-preview
  // cards on social/chat platforms — previously unset, so shares of this
  // app showed no image at all.
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Saveur",
    images: [{ url: "/logo-badge.png", width: 1024, height: 1024, alt: "Saveur" }],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/logo-badge.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${montserratAlternates.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-page text-primary">
        <ThemeProvider>
          <AuthProvider>
            <I18nProvider>{children}</I18nProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
