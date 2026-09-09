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

export const metadata: Metadata = {
  title: "Saveur — AI Career Coaching",
  description:
    "Saveur helps you land your next role with AI mock interviews, coding practice, resume tools, a personalized career roadmap, and job alerts.",
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
