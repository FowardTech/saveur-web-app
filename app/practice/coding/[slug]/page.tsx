"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Skeleton } from "@/components/ui/Skeleton";
import apiClient, { type ApiError } from "@/lib/apiClient";
import { useAuth } from "@/app/providers/AuthProvider";

// Web counterpart to mobile's src/practice/CodingProblemSolve.tsx — that
// screen is a full Judge0/AI-backed dark-IDE code editor (language picker,
// Run / Run Tests / Get AI Code Review) which doesn't exist on web yet (no
// Monaco/CodeMirror dependency anywhere in this repo). Rather than leaving
// the coding-practice cards as a dead click (app/practice/coding/page.tsx
// used to render plain <div>s with no onClick/link at all), this is a real
// "problem detail" landing page: the same GET /api/v1/coding/problem?slug=
// call CodingProblemSolve.tsx makes, rendering the description, examples,
// and starter code so the click does something meaningful. The full
// interactive coding environment (editor + Run/Run Tests/AI review) is a
// separate, larger follow-up — flagged clearly below rather than silently
// missing.
interface CodingProblemDetail {
  slug: string;
  title: string;
  difficulty: string;
  category?: string;
  description: string;
  test_cases: Array<{ stdin?: string; expected_output?: string }>;
  starter_code: Record<string, string>;
}

const difficultyTint: Record<string, string> = {
  beginner: "bg-tint-mint text-tint-mint-text",
  intermediate: "bg-tint-orange text-tint-orange-text",
  advanced: "bg-tint-rose text-tint-rose-text",
};

export default function CodingProblemDetailPage() {
  const { t } = useTranslation();
  const { loading: authLoading } = useAuth();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [problem, setProblem] = useState<CodingProblemDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [addonRequired, setAddonRequired] = useState(false);

  useEffect(() => {
    if (authLoading || !slug) return;
    let cancelled = false;
    apiClient
      .get<CodingProblemDetail>("/api/v1/coding/problem", { params: { slug } })
      .then((data) => {
        if (!cancelled) setProblem(data);
      })
      .catch((err) => {
        if (cancelled) return;
        const apiErr = err as ApiError;
        if (apiErr.status === 402) {
          setAddonRequired(true);
        } else if (apiErr.status === 404) {
          setProblem(null);
        } else {
          setError(apiErr.message || t("web:practice.coding.detail.loadFailedDefault", { defaultValue: "Couldn't load this problem right now." }));
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, slug]);

  function difficultyLabel(value: string) {
    return t(`web:practice.codingDifficulty.${value}`, { defaultValue: value });
  }

  const starterLanguages = problem ? Object.keys(problem.starter_code || {}) : [];

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-10">
          <Link href="/practice/coding" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-hint hover:text-primary">
            <EvaIcon name="chevron-left-outline" size={16} />
            {t("web:practice.coding.detail.back", { defaultValue: "Back to Coding Practice" })}
          </Link>

          {problem === undefined && !addonRequired && !error && (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-24 rounded-card" />
              <Skeleton className="h-40 rounded-card" />
            </div>
          )}

          {addonRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h1 className="font-semibold text-primary">{t("web:practice.coding.addonRequiredTitle", { defaultValue: "Coding Practice is a paid add-on" })}</h1>
              <p className="text-sm text-hint">
                {t("web:practice.coding.addonRequiredSubtitle", {
                  defaultValue: "Purchase the Coding Practice add-on from your account to unlock the full problem set and code review.",
                })}
              </p>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          {problem === null && !addonRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface-3 text-hint">
                <EvaIcon name="alert-circle-outline" size={20} />
              </span>
              <h1 className="font-semibold text-primary">{t("web:practice.coding.detail.notFoundTitle", { defaultValue: "This problem isn't available" })}</h1>
              <p className="text-sm text-hint">{t("web:practice.coding.detail.notFoundSubtitle", { defaultValue: "It may have been removed from the problem bank." })}</p>
            </div>
          )}

          {problem && (
            <>
              <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-pill px-2.5 py-1 text-xs font-medium ${difficultyTint[problem.difficulty] ?? "bg-surface-3 text-hint"}`}>
                    {difficultyLabel(problem.difficulty)}
                  </span>
                  {problem.category && <span className="text-xs text-hint">{problem.category}</span>}
                </div>
                <h1 className="text-xl font-bold text-primary">{problem.title}</h1>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-primary">{problem.description}</p>
              </div>

              {problem.test_cases && problem.test_cases.length > 0 && (
                <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">
                    {t("web:practice.coding.detail.examples", { defaultValue: "Examples" })}
                  </h2>
                  {problem.test_cases.map((c, i) => (
                    <div key={i} className="rounded-lg bg-surface-1 p-3 font-mono text-xs text-primary">
                      <p>
                        <span className="text-hint">{t("web:practice.coding.detail.input", { defaultValue: "Input" })}: </span>
                        {c.stdin || "—"}
                      </p>
                      <p className="mt-1">
                        <span className="text-hint">{t("web:practice.coding.detail.output", { defaultValue: "Output" })}: </span>
                        {c.expected_output || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {starterLanguages.length > 0 && (
                <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">
                    {t("web:practice.coding.detail.starterCode", { defaultValue: "Starter code" })}
                  </h2>
                  <pre className="overflow-x-auto rounded-lg bg-surface-1 p-3 font-mono text-xs text-primary">
                    {problem.starter_code[starterLanguages[0]]}
                  </pre>
                </div>
              )}

              <div className="flex items-start gap-3 rounded-card border border-dashed border-border bg-surface-1 p-4">
                <EvaIcon name="info-outline" size={18} className="mt-0.5 shrink-0 text-hint" />
                <p className="text-sm text-hint">
                  {t("web:practice.coding.detail.editorComingSoon", {
                    defaultValue:
                      "The full interactive coding environment (write, run, and get an AI code review) isn't on the web yet — it's available in the Saveur mobile app today, and coming to web in a future update.",
                  })}
                </p>
              </div>
            </>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
