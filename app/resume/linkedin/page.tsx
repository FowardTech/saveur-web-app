"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/linkedin_optimizer.py
//   POST /api/v1/linkedin/optimize -> {headline, about, experience_bullets, overall_feedback, profile_strength_score}
//   body: {headline?, about?, experience_bullets?: string[], target_role?}
// Pro Premium-gated (@require_premium). Note: this critiques pasted profile
// text — the backend can't read a live LinkedIn profile (see that file's
// own docstring), so there's no auto-prefill from a connected account here.
interface Suggestion {
  suggestion: string;
  feedback: string;
}

interface OptimizeResult {
  headline: Suggestion | null;
  about: Suggestion | null;
  experience_bullets: { original: string; suggestion: string }[];
  overall_feedback: string;
  profile_strength_score: number | null;
}

export default function LinkedInOptimizerPage() {
  const [headline, setHeadline] = useState("");
  const [about, setAbout] = useState("");
  const [bulletsText, setBulletsText] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [result, setResult] = useState<OptimizeResult | null>(null);

  const canSubmit = headline.trim() || about.trim() || bulletsText.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const bullets = bulletsText
        .split("\n")
        .map((b) => b.trim())
        .filter(Boolean);
      const data = await apiClient.post<OptimizeResult>("/api/v1/linkedin/optimize", {
        headline: headline.trim() || undefined,
        about: about.trim() || undefined,
        experience_bullets: bullets.length ? bullets : undefined,
        target_role: targetRole.trim() || undefined,
      });
      setResult(data);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setPremiumRequired(true);
      } else {
        setError(apiErr.message || "Couldn't optimize your profile right now.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-10">
          <PageHeader title="LinkedIn Optimizer" subtitle="Paste your current profile text for an AI critique and rewrite." />

          {premiumRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">LinkedIn Optimizer is a Premium feature</h2>
              <p className="text-sm text-hint">Upgrade your plan to get AI feedback on your LinkedIn profile.</p>
            </div>
          )}

          {!premiumRequired && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
              <TextField label="Target role (optional)" placeholder="e.g. Product Manager" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
              <TextField label="Current headline" placeholder="Paste your current LinkedIn headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-primary">Current about section</span>
                <textarea
                  rows={4}
                  placeholder="Paste your current About section"
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-primary">Experience bullets (one per line)</span>
                <textarea
                  rows={4}
                  placeholder={"Led a team of 5 engineers...\nShipped a redesign that grew signups 20%..."}
                  value={bulletsText}
                  onChange={(e) => setBulletsText(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </label>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" disabled={loading || !canSubmit} className="mt-1 w-full">
                {loading ? "Analyzing…" : "Optimize my profile"}
              </Button>
            </form>
          )}

          {result && (
            <div className="flex flex-col gap-4">
              <div className="rounded-card border border-border bg-gradient-to-br from-brand/15 via-accent-purple/10 to-transparent p-5">
                <p className="text-sm font-medium text-primary">
                  {result.profile_strength_score != null ? `Profile strength: ${result.profile_strength_score}/100` : ""}
                </p>
                <p className="mt-2 text-sm text-hint">{result.overall_feedback}</p>
              </div>

              {result.headline && (
                <div className="rounded-card border border-border bg-surface-2 p-5">
                  <h3 className="text-sm font-semibold text-primary">Headline</h3>
                  <p className="mt-2 text-sm text-primary">{result.headline.suggestion}</p>
                  <p className="mt-1.5 text-xs text-hint">{result.headline.feedback}</p>
                </div>
              )}

              {result.about && (
                <div className="rounded-card border border-border bg-surface-2 p-5">
                  <h3 className="text-sm font-semibold text-primary">About</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-primary">{result.about.suggestion}</p>
                  <p className="mt-1.5 text-xs text-hint">{result.about.feedback}</p>
                </div>
              )}

              {result.experience_bullets?.length > 0 && (
                <div className="rounded-card border border-border bg-surface-2 p-5">
                  <h3 className="text-sm font-semibold text-primary">Experience bullets</h3>
                  <div className="mt-2 flex flex-col gap-3">
                    {result.experience_bullets.map((b, i) => (
                      <div key={i} className="text-sm">
                        <p className="text-hint line-through">{b.original}</p>
                        <p className="mt-0.5 text-primary">{b.suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
