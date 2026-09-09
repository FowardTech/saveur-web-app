"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { EvaIcon } from "@/components/icons/EvaIcon";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Real backend contract — Saveur-Backend/app/api/coding.py
//   GET /api/v1/coding/problems -> [{slug, title, difficulty, category, status, bookmarked}]
// Gated behind the "coding_practice" paid add-on (@require_addon) — a user
// who hasn't purchased it gets a 402 here, shown as a clear message below
// rather than a raw error.
interface CodingProblem {
  slug: string;
  title: string;
  difficulty: string;
  category: string;
  status: string | null;
  bookmarked: boolean;
}

const difficultyTint: Record<string, string> = {
  beginner: "bg-tint-mint text-tint-mint-text",
  intermediate: "bg-tint-orange text-tint-orange-text",
  advanced: "bg-tint-rose text-tint-rose-text",
};

export default function CodingPracticePage() {
  const [problems, setProblems] = useState<CodingProblem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addonRequired, setAddonRequired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiClient.get<CodingProblem[]>("/api/v1/coding/problems");
        if (!cancelled) setProblems(data);
      } catch (err) {
        if (cancelled) return;
        const apiErr = err as ApiError;
        if (apiErr.status === 402) {
          setAddonRequired(true);
        } else {
          setError(apiErr.message || "Couldn't load coding problems right now.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell>
      <div className="mx-auto flex max-w-5xl flex-col gap-8 pb-10">
        <PageHeader title="Coding Practice" subtitle="Real problems, instant AI review." />

        {addonRequired && (
          <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
              <EvaIcon name="lock-outline" size={20} />
            </span>
            <h2 className="font-semibold text-primary">Coding Practice is a paid add-on</h2>
            <p className="text-sm text-hint">
              Purchase the Coding Practice add-on from your account to unlock the full problem set and code review.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        {!addonRequired && !error && problems === null && (
          <p className="text-sm text-hint">Loading problems…</p>
        )}

        {problems && problems.length === 0 && (
          <p className="text-sm text-hint">No problems available right now — check back soon.</p>
        )}

        {problems && problems.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {problems.map((p) => (
              <div key={p.slug} className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${difficultyTint[p.difficulty] ?? "bg-surface-3 text-hint"}`}>
                    {p.difficulty}
                  </span>
                  {p.bookmarked && <EvaIcon name="star" size={16} className="text-brand" />}
                </div>
                <div>
                  <h3 className="font-medium text-primary">{p.title}</h3>
                  <p className="mt-1 text-xs text-hint">{p.category}</p>
                </div>
                {p.status && (
                  <span className="w-fit rounded-pill bg-tint-mint px-2.5 py-1 text-xs font-medium text-tint-mint-text">
                    {p.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
