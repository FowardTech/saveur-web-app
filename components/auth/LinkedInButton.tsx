"use client";

import { useState } from "react";
import { API_BASE_URL } from "@/lib/apiClient";
import { EvaIcon } from "@/components/icons/EvaIcon";

/** "Continue with LinkedIn" — mirrors GoogleButton's shape, but drives the
 * hand-rolled OAuth-code-exchange flow in Saveur-Backend's
 * app/api/linkedin_auth.py instead of a Firebase-native popup provider
 * (Firebase has no built-in LinkedIn provider — see that file's module
 * docstring). Flow: fetch the authorize URL from /start, then a full-page
 * redirect (LinkedIn requires this, no popup) to LinkedIn's own page. LinkedIn
 * redirects back to the backend's /callback, which 302s the browser to
 * /auth/linkedin/callback?token=...&is_new_user=... on this app — see that
 * page for the rest of the flow. */
export function LinkedInButton({ label = "Continue with LinkedIn" }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/linkedin/start?platform=web`);
      if (!res.ok) throw new Error("LinkedIn sign-in isn't available right now. Please try again later.");
      const data = await res.json();
      if (!data?.url) throw new Error("LinkedIn sign-in isn't available right now. Please try again later.");
      window.location.href = data.url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "LinkedIn sign-in failed. Please try again.";
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
        <EvaIcon name="linkedin" size={16} />
        {loading ? "Redirecting…" : label}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
