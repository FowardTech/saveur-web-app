"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { API_BASE_URL } from "@/lib/apiClient";
import { getErrorMessage } from "@/lib/errors";

/** Official LinkedIn "in" brand glyph. Eva Icons (used everywhere else in
 * this app via EvaIcon) is a generic UI icon set with no real brand/logo
 * icons, so `<EvaIcon name="linkedin" />` silently fell back to EvaIcon's
 * unknown-icon placeholder (a plain circle) instead of a LinkedIn mark. This
 * button's background is already LinkedIn's brand blue (#0A66C2), so the
 * glyph itself is rendered as a plain white "in" mark via `currentColor`. */
function LinkedInGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

/** "Continue with LinkedIn" — mirrors GoogleButton's shape, but drives the
 * hand-rolled OAuth-code-exchange flow in Saveur-Backend's
 * app/api/linkedin_auth.py instead of a Firebase-native popup provider
 * (Firebase has no built-in LinkedIn provider — see that file's module
 * docstring). Flow: fetch the authorize URL from /start, then a full-page
 * redirect (LinkedIn requires this, no popup) to LinkedIn's own page. LinkedIn
 * redirects back to the backend's /callback, which 302s the browser to
 * /auth/linkedin/callback?token=...&is_new_user=... on this app — see that
 * page for the rest of the flow. */
export function LinkedInButton({ label }: { label?: string }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolvedLabel = label ?? t("web:auth.continueWithLinkedIn", { defaultValue: "Continue with LinkedIn" });
  const unavailableMessage = t("web:auth.linkedinUnavailableDefault", { defaultValue: "LinkedIn sign-in isn't available right now. Please try again later." });

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/linkedin/start?platform=web`);
      if (!res.ok) throw new Error(unavailableMessage);
      const data = await res.json();
      if (!data?.url) throw new Error(unavailableMessage);
      window.location.href = data.url;
    } catch (err: unknown) {
      // A raw "Failed to fetch" TypeError (as opposed to an HTTP error
      // response, which the `!res.ok` branch above already turns into a
      // friendlier message) means the request never got a response at all —
      // almost always the backend's CORS_ORIGINS not allowing this origin,
      // or a genuine connectivity problem. Neither is meaningful to a user,
      // so swap it for the same "check your connection" wording apiClient
      // uses for the equivalent case elsewhere in the app.
      const raw = getErrorMessage(err, t("web:auth.linkedinFailedDefault", { defaultValue: "LinkedIn sign-in failed. Please try again." }));
      const message = raw === "Failed to fetch"
        ? t("web:auth.linkedinConnectionError", { defaultValue: "Couldn't reach the server. Please check your connection and try again." })
        : raw;
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center justify-center gap-2 rounded-pill border border-border bg-[#0A66C2] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0958a8] disabled:opacity-60"
      >
        <LinkedInGlyph size={16} />
        {loading ? t("web:auth.redirecting", { defaultValue: "Redirecting…" }) : resolvedLabel}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
