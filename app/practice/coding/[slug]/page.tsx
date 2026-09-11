"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import CodeMirror from "@uiw/react-codemirror";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import apiClient, { type ApiError } from "@/lib/apiClient";
import { useAuth } from "@/app/providers/AuthProvider";
import * as codingService from "@/lib/codingService";
import type { CodeReviewResult, TestRunResult } from "@/lib/codingService";
import { languageExtensionForLanguageId } from "@/lib/codingProjectsLanguage";

// Web counterpart to mobile's src/practice/CodingProblemSolve.tsx (the
// free-practice-hub solve screen, reached by browsing the problem list
// rather than a timed interview session — CodingInterview.tsx is a
// different, untouched flow). Was previously a static "coming soon"
// placeholder below the description/examples header (no editor dependency
// existed on web at all); now reuses the exact same @uiw/react-codemirror +
// language-pack dependency and CodeMirror language-extension helper the
// "Coding Projects" multi-file workspace already added to this repo (see
// lib/codingProjectsLanguage.ts's languageExtensionForLanguageId, added
// alongside this page) rather than pulling in a second editor library.
//
// Backend contract (Saveur-Backend/app/api/coding.py), all wrapped in
// lib/codingService.ts:
//   GET    /api/v1/coding/problem?slug=<slug>
//   GET    /api/v1/coding/languages
//   POST   /api/v1/coding/run-tests
//   POST   /api/v1/coding/review
//   POST   /api/v1/coding/problems/<slug>/attempt   -- called right after
//          every Run Tests, matching mobile's CodingProblemSolve.tsx, not
//          just on some final "submit" step that doesn't exist here.
//   POST/DELETE /api/v1/coding/problems/<slug>/bookmark
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

const LANGUAGE_LABELS: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  cpp: "C++",
  c: "C",
  go: "Go",
  rust: "Rust",
  csharp: "C#",
  ruby: "Ruby",
  php: "PHP",
  kotlin: "Kotlin",
  swift: "Swift",
};

function languageLabel(id: string): string {
  return LANGUAGE_LABELS[id] ?? id;
}

export default function CodingProblemDetailPage() {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const { loading: authLoading } = useAuth();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const [problem, setProblem] = useState<CodingProblemDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [addonRequired, setAddonRequired] = useState(false);

  const [bookmarked, setBookmarked] = useState(false);

  const [language, setLanguage] = useState<string>("");
  const [code, setCode] = useState("");
  const codeEditedRef = useRef(false);

  const [runningTests, setRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<TestRunResult[] | null>(null);
  const [testEngine, setTestEngine] = useState<"judge0" | "ai" | undefined>(undefined);
  const [runTestsError, setRunTestsError] = useState<string | null>(null);
  const [justSolved, setJustSolved] = useState(false);

  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<CodeReviewResult | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !slug) return;
    let cancelled = false;
    apiClient
      .get<CodingProblemDetail>("/api/v1/coding/problem", { params: { slug } })
      .then((data) => {
        if (cancelled) return;
        setProblem(data);
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
    codingService
      .listProblems()
      .then((list) => {
        if (cancelled) return;
        const match = list.find((p) => p.slug === slug);
        if (match) setBookmarked(match.bookmarked);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, slug]);

  // Once the problem loads, default the language picker + editor to its
  // first available starter-code language — matches mobile's
  // CodingProblemSolve.tsx defaulting to starter_code's available languages.
  // Only auto-fills if the user hasn't started typing yet (codeEditedRef),
  // same guard mobile uses so a slow re-fetch never clobbers real work.
  useEffect(() => {
    if (!problem || codeEditedRef.current) return;
    const languages = Object.keys(problem.starter_code || {});
    if (!languages.length) return;
    const lang = languages.includes(language) ? language : languages[0];
    setLanguage(lang);
    setCode(problem.starter_code[lang] ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem]);

  function difficultyLabel(value: string) {
    return t(`web:practice.codingDifficulty.${value}`, { defaultValue: value });
  }

  const starterLanguages = problem ? Object.keys(problem.starter_code || {}) : [];
  const testCases = problem?.test_cases ?? [];

  function onSelectLanguage(lang: string) {
    setLanguage(lang);
    codeEditedRef.current = false;
    setCode(problem?.starter_code?.[lang] ?? "");
    setTestResults(null);
    setTestEngine(undefined);
    setRunTestsError(null);
    setReviewResult(null);
    setReviewError(null);
  }

  function onResetToStarter() {
    if (!problem) return;
    codeEditedRef.current = false;
    setCode(problem.starter_code?.[language] ?? "");
  }

  async function onToggleBookmark() {
    if (!slug) return;
    const next = !bookmarked;
    setBookmarked(next);
    try {
      await codingService.setBookmark(slug, next);
    } catch {
      setBookmarked(!next);
    }
  }

  async function onRunTests() {
    if (runningTests || !problem || !slug) return;
    // Same guard as mobile's CodingProblemSolve.tsx / the backend's own
    // defense-in-depth: an empty submission can't possibly pass, and the
    // AI-judge fallback can otherwise hallucinate a pass for code it never
    // actually traced.
    if (!code || !code.trim()) {
      setRunTestsError(t("web:practice.coding.detail.noCodeWritten", { defaultValue: "Your editor is empty — add your solution before running the tests." }));
      return;
    }
    setRunningTests(true);
    setRunTestsError(null);
    setTestResults(null);
    setJustSolved(false);
    try {
      const cases = testCases.map((c) => ({ input: c.stdin ?? "", expectedOutput: c.expected_output ?? "" }));
      const { results, engine } = await codingService.runTests(language, code, cases);
      setTestResults(results);
      setTestEngine(engine);
      const passedCount = results.filter((r) => r.passed).length;
      // Persists this attempt's outcome right after every Run Tests, not
      // just a final "submit" (there isn't one on this screen) — matches
      // mobile's CodingProblemSolve.tsx exactly.
      try {
        const { status } = await codingService.recordAttempt(slug, language, passedCount, results.length);
        if (status === "solved") setJustSolved(true);
      } catch {
        // Non-fatal — the run itself already succeeded and is visible on
        // screen; a failed progress-sync shouldn't block that feedback.
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setRunTestsError(apiErr.message || t("web:practice.coding.detail.runTestsFailedDefault", { defaultValue: "Could not run your test cases. Please try again." }));
    } finally {
      setRunningTests(false);
    }
  }

  async function onGetReview() {
    if (!problem || reviewLoading) return;
    setReviewLoading(true);
    setReviewError(null);
    setReviewResult(null);
    try {
      // BUG FIX ground: pass along whatever real Run Tests result is
      // already in state, if any, so the review is grounded in real
      // correctness rather than only ever commenting on style — see the
      // backend's own bug-fix docstring on POST /coding/review.
      const review = await codingService.getCodeReview(
        code,
        language,
        `${problem.title}\n\n${problem.description}`,
        testResults ? testResults.filter((r) => r.passed).length : undefined,
        testResults ? testResults.length : undefined
      );
      setReviewResult(review);
    } catch (err) {
      const apiErr = err as ApiError;
      setReviewError(apiErr.message || t("web:practice.coding.detail.reviewFailedDefault", { defaultValue: "Couldn't get a review right now. Please try again." }));
    } finally {
      setReviewLoading(false);
    }
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-10">
          <div className="flex items-center justify-between gap-3">
            <Link href="/practice/coding" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-hint hover:text-primary">
              <EvaIcon name="chevron-left-outline" size={16} />
              {t("web:practice.coding.detail.back", { defaultValue: "Back to Coding Practice" })}
            </Link>
            {problem && (
              <button
                type="button"
                onClick={onToggleBookmark}
                className="inline-flex items-center gap-1.5 rounded-pill border border-border px-3 py-1.5 text-xs font-medium text-hint hover:bg-surface-3"
                title={t(bookmarked ? "web:practice.coding.detail.bookmarked" : "web:practice.coding.detail.bookmark", { defaultValue: bookmarked ? "Bookmarked" : "Bookmark" }).toString()}
              >
                <EvaIcon name="star-outline" size={14} className={bookmarked ? "text-brand" : undefined} />
                {t(bookmarked ? "web:practice.coding.detail.bookmarked" : "web:practice.coding.detail.bookmark", { defaultValue: bookmarked ? "Bookmarked" : "Bookmark" })}
              </button>
            )}
          </div>

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

              {testCases.length > 0 && (
                <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-6">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">
                    {t("web:practice.coding.detail.examples", { defaultValue: "Examples" })}
                  </h2>
                  {testCases.map((c, i) => (
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

              {/* Real interactive editor — replaces the old "coming to web
                  in a future update" placeholder. */}
              {starterLanguages.length > 0 && (
                <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">
                      {t("web:practice.coding.detail.yourCode", { defaultValue: "Your Code" })}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                      {starterLanguages.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                          {starterLanguages.map((lang) => (
                            <button
                              key={lang}
                              type="button"
                              onClick={() => onSelectLanguage(lang)}
                              className={`rounded-pill px-3 py-1 text-xs font-medium transition ${
                                lang === language ? "bg-brand text-white" : "bg-surface-3 text-hint hover:bg-surface-4"
                              }`}
                            >
                              {languageLabel(lang)}
                            </button>
                          ))}
                        </div>
                      )}
                      <button type="button" onClick={onResetToStarter} className="inline-flex items-center gap-1 text-xs font-medium text-hint hover:text-primary">
                        <EvaIcon name="refresh-outline" size={13} />
                        {t("web:practice.coding.detail.resetStarter", { defaultValue: "Reset to starter code" })}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-lg border border-border">
                    <CodeMirror
                      value={code}
                      height="360px"
                      theme={resolvedTheme === "dark" ? "dark" : "light"}
                      extensions={languageExtensionForLanguageId(language)}
                      onChange={(value) => {
                        codeEditedRef.current = true;
                        setCode(value);
                      }}
                    />
                  </div>

                  {runTestsError && <p className="text-sm text-danger">{runTestsError}</p>}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" onClick={onRunTests} disabled={runningTests}>
                      <EvaIcon name="play-circle-outline" size={16} />
                      {runningTests
                        ? t("web:practice.coding.detail.runningTests", { defaultValue: "Running tests…" })
                        : t("web:practice.coding.detail.runTests", { defaultValue: "Run Tests" })}
                    </Button>
                  </div>

                  {testResults && (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {testEngine === "ai" && (
                          <span className="inline-flex items-center gap-1.5 rounded-pill bg-tint-purple px-2.5 py-1 text-xs font-medium text-tint-purple-text">
                            <EvaIcon name="activity-outline" size={12} />
                            {t("web:practice.coding.detail.aiGraded", { defaultValue: "AI-graded result" })}
                          </span>
                        )}
                        <span
                          className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${
                            testResults.every((r) => r.passed) ? "bg-tint-mint text-tint-mint-text" : "bg-tint-orange text-tint-orange-text"
                          }`}
                        >
                          {t("web:practice.coding.detail.testsPassedCount", {
                            defaultValue: "{{passed}} / {{total}} test cases passed",
                            passed: testResults.filter((r) => r.passed).length,
                            total: testResults.length,
                          })}
                        </span>
                      </div>

                      {justSolved && (
                        <div className="flex items-center gap-2 rounded-lg border border-tint-mint bg-tint-mint/20 px-3 py-2">
                          <EvaIcon name="checkmark-circle-2-outline" size={16} className="text-tint-mint-text" />
                          <span className="text-sm font-medium text-tint-mint-text">
                            {t("web:practice.coding.detail.solvedBanner", { defaultValue: "Solved! Great work." })}
                          </span>
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        {testResults.map((r, i) => (
                          <div key={i} className="flex flex-col gap-1.5 rounded-lg bg-surface-1 p-3 font-mono text-xs text-primary">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-hint">
                                {t("web:practice.coding.detail.testCaseLabel", { defaultValue: "Test case {{n}}", n: i + 1 })}
                              </span>
                              <span className={`rounded-pill px-2 py-0.5 text-[10px] font-bold ${r.passed ? "bg-tint-mint text-tint-mint-text" : "bg-tint-rose text-tint-rose-text"}`}>
                                {r.passed
                                  ? t("web:practice.coding.detail.passBadge", { defaultValue: "PASS" })
                                  : t("web:practice.coding.detail.failBadge", { defaultValue: "FAIL" })}
                              </span>
                            </div>
                            <p>
                              <span className="text-hint">{t("web:practice.coding.detail.input", { defaultValue: "Input" })}: </span>
                              {r.input || "—"}
                            </p>
                            <p>
                              <span className="text-hint">{t("web:practice.coding.detail.expectedOutput", { defaultValue: "Expected Output" })}: </span>
                              {r.expectedOutput || "—"}
                            </p>
                            {r.actualOutput !== undefined && (
                              <p>
                                <span className="text-hint">{t("web:practice.coding.detail.actualOutput", { defaultValue: "Actual Output" })}: </span>
                                {r.actualOutput || "—"}
                              </p>
                            )}
                            {r.stderr && (
                              <p className="text-danger">
                                <span className="text-hint">{t("web:practice.coding.detail.stderr", { defaultValue: "Errors" })}: </span>
                                {r.stderr}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AI Code Review */}
              {starterLanguages.length > 0 && (
                <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-hint">
                      {t("web:practice.coding.detail.aiCodeReview", { defaultValue: "AI Code Review" })}
                    </h2>
                    <Button type="button" variant="outline" size="sm" onClick={onGetReview} disabled={reviewLoading}>
                      <EvaIcon name="bulb-outline" size={14} />
                      {reviewLoading
                        ? t("web:practice.coding.detail.gettingReview", { defaultValue: "Getting review…" })
                        : t("web:practice.coding.detail.getReview", { defaultValue: "Get AI Code Review" })}
                    </Button>
                  </div>

                  {reviewError && <p className="text-sm text-danger">{reviewError}</p>}

                  {!reviewError && !reviewResult && !reviewLoading && (
                    <p className="text-sm text-hint">
                      {t("web:practice.coding.detail.reviewEmptyState", {
                        defaultValue: "Run your tests first, then request a review — the AI will ground its feedback in whether your code actually passed.",
                      })}
                    </p>
                  )}

                  {reviewResult && (
                    <div className="flex flex-col gap-3">
                      {reviewResult.complexityNote && (
                        <p className="rounded-lg bg-surface-1 p-3 text-sm text-primary">
                          <span className="font-semibold text-hint">{t("web:practice.coding.detail.complexity", { defaultValue: "Complexity" })}: </span>
                          {reviewResult.complexityNote}
                        </p>
                      )}
                      {reviewResult.feedback.length > 0 && (
                        <ul className="flex flex-col gap-2">
                          {reviewResult.feedback.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-primary">
                              <EvaIcon name="checkmark-circle-outline" size={14} className="mt-0.5 shrink-0 text-brand" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
