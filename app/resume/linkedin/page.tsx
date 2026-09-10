"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { CircularProgress } from "@/components/ui/CircularProgress";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/linkedin_optimizer.py
//   POST /api/v1/linkedin/optimize -> {headline, about, experience_bullets, overall_feedback, profile_strength_score}
//   body: {headline?, about?, experience_bullets?: string[], target_role?}
//   GET  /api/v1/linkedin/history  -> {history: [{id, target_role, profile_strength_score, created_at}]}
// Pro Premium-gated (@require_premium). Note: this critiques pasted profile
// text — the backend can't read a live LinkedIn profile (see that file's
// own docstring), so there's no auto-prefill from a connected account here.
//
// Mobile parity (src/more/LinkedInOptimizer.tsx): profile strength used to
// render here as plain "Profile strength: N/100" text — mobile explicitly
// redesigned this to a ring ("the one profile-quality score in this app not
// already shown as a ring"). The "Score history" card (GET .../history) was
// missing entirely even though the endpoint already exists.
interface Suggestion {
  suggestion: string;
  feedback: string;
}

interface HistoryEntry {
  id: number;
  target_role: string | null;
  profile_strength_score: number | null;
  created_at: string | null;
}

interface OptimizeResult {
  headline: Suggestion | null;
  about: Suggestion | null;
  experience_bullets: { original: string; suggestion: string }[];
  overall_feedback: string;
  profile_strength_score: number | null;
}

export default function LinkedInOptimizerPage() {
  const { t } = useTranslation();
  const [headline, setHeadline] = useState("");
  const [about, setAbout] = useState("");
  const [bulletsText, setBulletsText] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    apiClient
      .get<{ history: HistoryEntry[] }>("/api/v1/linkedin/history")
      .then((data) => setHistory(data.history ?? []))
      .catch(() => {});
  }, []);

  const previousScore = history.find((h) => h.profile_strength_score != null)?.profile_strength_score ?? null;
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
      apiClient
        .get<{ history: HistoryEntry[] }>("/api/v1/linkedin/history")
        .then((h) => setHistory(h.history ?? []))
        .catch(() => {});
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setPremiumRequired(true);
      } else {
        setError(apiErr.message || t("web:resume.linkedin.optimizeFailedDefault", { defaultValue: "Couldn't optimize your profile right now." }));
      }
    } finally {
      setLoading(false);
    }
  }

  function formatHistoryDate(iso: string | null) {
    if (!iso) return "";
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return "";
    return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-2xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:resume.linkedin.title", { defaultValue: "LinkedIn Optimizer" })}
            subtitle={t("web:resume.linkedin.subtitle", { defaultValue: "Paste your current profile text for an AI critique and rewrite." })}
          />

          {premiumRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:resume.linkedin.premiumRequiredTitle", { defaultValue: "LinkedIn Optimizer is a Premium feature" })}</h2>
              <p className="text-sm text-hint">{t("web:resume.linkedin.premiumRequiredSubtitle", { defaultValue: "Upgrade your plan to get AI feedback on your LinkedIn profile." })}</p>
            </div>
          )}

          {!premiumRequired && history.length > 0 && (
            <div className="rounded-card border border-border bg-surface-2 p-5">
              <h3 className="text-sm font-semibold text-primary">{t("web:resume.linkedin.scoreHistory", { defaultValue: "Score history" })}</h3>
              <div className="mt-2.5 flex flex-col gap-2">
                {history.slice(0, 5).map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-sm">
                    <span className="text-hint">
                      {formatHistoryDate(h.created_at)}
                      {h.target_role ? ` · ${h.target_role}` : ""}
                    </span>
                    <span className="font-semibold text-primary">{h.profile_strength_score != null ? `${h.profile_strength_score}%` : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!premiumRequired && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
              <TextField
                label={t("web:resume.linkedin.targetRoleLabel", { defaultValue: "Target role (optional)" })}
                placeholder={t("web:resume.linkedin.targetRolePlaceholder", { defaultValue: "e.g. Product Manager" })}
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              />
              <TextField
                label={t("web:resume.linkedin.currentHeadlineLabel", { defaultValue: "Current headline" })}
                placeholder={t("web:resume.linkedin.currentHeadlinePlaceholder", { defaultValue: "Paste your current LinkedIn headline" })}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-primary">{t("web:resume.linkedin.currentAboutLabel", { defaultValue: "Current about section" })}</span>
                <textarea
                  rows={4}
                  placeholder={t("web:resume.linkedin.currentAboutPlaceholder", { defaultValue: "Paste your current About section" })}
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-primary">{t("web:resume.linkedin.bulletsLabel", { defaultValue: "Experience bullets (one per line)" })}</span>
                <textarea
                  rows={4}
                  placeholder={t("web:resume.linkedin.bulletsPlaceholder", { defaultValue: "Led a team of 5 engineers...\nShipped a redesign that grew signups 20%..." })}
                  value={bulletsText}
                  onChange={(e) => setBulletsText(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </label>
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" disabled={loading || !canSubmit} className="mt-1 w-full">
                {loading ? t("web:resume.linkedin.analyzing", { defaultValue: "Analyzing…" }) : t("web:resume.linkedin.optimizeProfile", { defaultValue: "Optimize my profile" })}
              </Button>
            </form>
          )}

          {result && (
            <div className="flex flex-col gap-4">
              {result.profile_strength_score != null && (
                <div className="flex flex-col items-center gap-2 rounded-card border border-border bg-surface-2 p-6 text-center">
                  <CircularProgress progress={result.profile_strength_score} size={88} strokeWidth={8}>
                    <span className="text-xl font-bold text-primary">{result.profile_strength_score}%</span>
                  </CircularProgress>
                  <p className="text-xs text-hint">{t("web:resume.linkedin.currentProfileStrength", { defaultValue: "Current profile strength" })}</p>
                  {previousScore != null && (
                    <p className={`text-xs font-medium ${result.profile_strength_score >= previousScore ? "text-success-text" : "text-warning-text"}`}>
                      {result.profile_strength_score >= previousScore
                        ? t("web:resume.linkedin.scoreUp", { defaultValue: "+{{delta}} since last time", delta: result.profile_strength_score - previousScore })
                        : t("web:resume.linkedin.scoreDown", { defaultValue: "{{delta}} since last time", delta: result.profile_strength_score - previousScore })}
                    </p>
                  )}
                </div>
              )}
              <div className="rounded-card border border-border bg-surface-2 p-5">
                <p className="text-sm text-hint">{result.overall_feedback}</p>
              </div>

              {result.headline && (
                <div className="rounded-card border border-border bg-surface-2 p-5">
                  <h3 className="text-sm font-semibold text-primary">{t("web:resume.linkedin.headlineLabel", { defaultValue: "Headline" })}</h3>
                  <p className="mt-2 text-sm text-primary">{result.headline.suggestion}</p>
                  <p className="mt-1.5 text-xs text-hint">{result.headline.feedback}</p>
                </div>
              )}

              {result.about && (
                <div className="rounded-card border border-border bg-surface-2 p-5">
                  <h3 className="text-sm font-semibold text-primary">{t("web:resume.linkedin.aboutLabel", { defaultValue: "About" })}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-primary">{result.about.suggestion}</p>
                  <p className="mt-1.5 text-xs text-hint">{result.about.feedback}</p>
                </div>
              )}

              {result.experience_bullets?.length > 0 && (
                <div className="rounded-card border border-border bg-surface-2 p-5">
                  <h3 className="text-sm font-semibold text-primary">{t("web:resume.linkedin.experienceBulletsLabel", { defaultValue: "Experience bullets" })}</h3>
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
