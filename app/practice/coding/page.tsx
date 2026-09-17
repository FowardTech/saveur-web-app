"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonCard } from "@/components/ui/Skeleton";
import apiClient, { type ApiError } from "@/lib/apiClient";
import { useAuth } from "@/app/providers/AuthProvider";

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
  const { t } = useTranslation();
  // BUG FIX (real root cause of "Request failed with status 401" on every
  // page refresh): this effect used to fire unconditionally on mount
  // (`[]` deps), completely independent of RequireAuth's own render
  // gating below -- RequireAuth only controls whether ITS `children` (the
  // AppShell/content this component returns) get rendered, it has no
  // effect on THIS component's own body, which mounts with the route and
  // runs its effects immediately. AuthProvider's onAuthStateChanged
  // handler sets `firebaseUser` before awaiting the backend profile/
  // subscription sync and only then flips `loading` false, so this effect
  // was firing its authenticated fetch before the token/session was
  // actually ready to rely on, every single load. Gating on `!loading`
  // defers it to the provider's real "ready" signal.
  const { loading } = useAuth();
  const [problems, setProblems] = useState<CodingProblem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addonRequired, setAddonRequired] = useState(false);

  useEffect(() => {
    if (loading) return;
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
          setError(apiErr.message || t("web:practice.coding.loadFailedDefault", { defaultValue: "Couldn't load coding problems right now." }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  function difficultyLabel(value: string) {
    return t(`web:practice.codingDifficulty.${value}`, { defaultValue: value });
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:practice.coding.title", { defaultValue: "Coding Practice" })}
            subtitle={t("web:practice.coding.subtitle", { defaultValue: "Real problems, instant AI review." })}
          />

          <Link
            href="/practice/coding/projects"
            className="flex items-center justify-between rounded-card border border-border bg-surface-2 p-4 hover:border-brand/40"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="folder-outline" size={16} />
              </span>
              <div>
                <p className="text-sm font-semibold text-primary">{t("web:practice.coding.projectsLinkTitle", { defaultValue: "My Projects" })}</p>
                <p className="text-xs text-hint">
                  {t("web:practice.coding.projectsLinkSubtitle", { defaultValue: "Build a multi-file web page or script, save it, and run or preview it — like a lightweight VS Code." })}
                </p>
              </div>
            </div>
            <EvaIcon name="chevron-right-outline" size={16} className="text-hint" />
          </Link>

          {addonRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:practice.coding.addonRequiredTitle", { defaultValue: "Coding Practice is a paid add-on" })}</h2>
              <p className="text-sm text-hint">
                {t("web:practice.coding.addonRequiredSubtitle", {
                  defaultValue: "Purchase the Coding Practice add-on from your account to unlock the full problem set and code review.",
                })}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          {!addonRequired && !error && problems === null && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {problems && problems.length === 0 && (
            <p className="text-sm text-hint">{t("web:practice.coding.empty", { defaultValue: "No problems available right now — check back soon." })}</p>
          )}

          {problems && problems.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {problems.map((p) => (
                <Link
                  key={p.slug}
                  href={`/practice/coding/${p.slug}`}
                  className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${difficultyTint[p.difficulty] ?? "bg-surface-3 text-hint"}`}>
                      {difficultyLabel(p.difficulty)}
                    </span>
                    {p.bookmarked && <EvaIcon name="star-outline" size={16} className="text-brand" />}
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
                </Link>
              ))}
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
