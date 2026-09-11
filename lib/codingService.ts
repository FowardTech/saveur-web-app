import apiClient from "./apiClient";

// ---------------------------------------------------------------------------
// codingService — web client for the single-file "Coding Practice" problem
// hub/detail (Saveur-Backend/app/api/coding.py), i.e. the LeetCode-style
// problem bank reached from app/practice/coding/page.tsx and
// app/practice/coding/[slug]/page.tsx — NOT the multi-file "Coding Projects"
// workspace (that's lib/codingProjectsService.ts). Same paid
// "coding_practice" add-on, same 402 pattern every caller already handles.
//
// Mirrors mobile's services/codingService.ts wire shapes 1:1 (snake_case on
// the wire, camelCase in the app types) so behavior matches exactly — see
// that file's own comments for the product-report history behind each
// field/endpoint.
// ---------------------------------------------------------------------------

export interface CodingTestCase {
  input: string;
  expectedOutput: string;
}

export interface TestRunResult extends CodingTestCase {
  passed: boolean;
  actualOutput?: string;
  stderr?: string;
}

export interface RunTestsSummary {
  results: TestRunResult[];
  passedCount: number;
  totalCount: number;
  score?: number;
  /** Present ("ai") only when Judge0 isn't configured/active and the
   * backend fell back to AI-predicted grading (see Saveur-Backend's
   * code_validator_service.py) — absent for a real Judge0 run. Lets the UI
   * show an "AI-graded" disclosure the same way mobile's
   * CodingProblemSolve.tsx does, instead of implying a real sandboxed run
   * happened. */
  engine?: "judge0" | "ai";
}

export interface CodeReviewResult {
  complexityNote: string;
  feedback: string[];
}

export interface CodingProblem {
  slug: string;
  title: string;
  difficulty?: string;
  category?: string;
  description: string;
  testCases: CodingTestCase[];
  /** Per-language starter code, keyed by the same language ids
   * getLanguages() returns (e.g. "javascript", "python"). */
  starterCode: Record<string, string>;
}

export interface CodingProblemSummary {
  slug: string;
  title: string;
  difficulty: string;
  category: string;
  status: "attempted" | "solved" | null;
  bookmarked: boolean;
}

interface ProblemWire {
  slug?: string;
  title?: string;
  difficulty?: string;
  category?: string;
  description?: string;
  test_cases?: Array<{ stdin?: string; expected_output?: string }>;
  starter_code?: Record<string, string>;
}

function problemFromWire(data: ProblemWire): CodingProblem {
  return {
    slug: data.slug ?? "problem",
    title: data.title ?? "",
    difficulty: data.difficulty,
    category: data.category,
    description: data.description ?? "",
    testCases: (data.test_cases ?? []).map((c) => ({
      input: c.stdin ?? "",
      expectedOutput: c.expected_output ?? "",
    })),
    starterCode: data.starter_code ?? {},
  };
}

/** GET /api/v1/coding/problem?slug=<slug> — one specific problem's full
 * detail (description, examples, test cases, per-language starter code). */
export async function getProblem(slug: string): Promise<CodingProblem> {
  const data = await apiClient.get<ProblemWire>("/api/v1/coding/problem", { params: { slug } });
  return problemFromWire(data);
}

interface ProblemSummaryWire {
  slug: string;
  title: string;
  difficulty: string;
  category: string;
  status: "attempted" | "solved" | null;
  bookmarked: boolean;
}

/** GET /api/v1/coding/problems — used here only to look up this one
 * problem's current `bookmarked` state (the /problem detail endpoint itself
 * doesn't carry that field) — same approach mobile's CodingProblemSolve.tsx
 * takes rather than adding a new endpoint. */
export async function listProblems(): Promise<CodingProblemSummary[]> {
  const data = await apiClient.get<ProblemSummaryWire[]>("/api/v1/coding/problems");
  return (data ?? []).map((p) => ({
    slug: p.slug,
    title: p.title,
    difficulty: p.difficulty,
    category: p.category,
    status: p.status,
    bookmarked: !!p.bookmarked,
  }));
}

/** POST/DELETE /api/v1/coding/problems/<slug>/bookmark */
export async function setBookmark(slug: string, bookmarked: boolean): Promise<boolean> {
  const data = bookmarked
    ? await apiClient.post<{ bookmarked?: boolean }>(`/api/v1/coding/problems/${slug}/bookmark`)
    : await apiClient.delete<{ bookmarked?: boolean }>(`/api/v1/coding/problems/${slug}/bookmark`);
  return !!data.bookmarked;
}

/** POST /api/v1/coding/problems/<slug>/attempt — records a Run Tests result
 * against a specific problem so solved/attempted status persists (matches
 * mobile's CodingProblemSolve.tsx behavior of calling this right after
 * every Run Tests, not just on a final submit). */
export async function recordAttempt(
  slug: string,
  language: string,
  passed: number,
  total: number
): Promise<{ status: "attempted" | "solved" }> {
  const data = await apiClient.post<{ status?: "attempted" | "solved" }>(`/api/v1/coding/problems/${slug}/attempt`, {
    language,
    passed,
    total,
  });
  return { status: data.status ?? "attempted" };
}

/** GET /api/v1/coding/languages — static list of Judge0-backed language
 * keys (e.g. "python", "javascript", "java", "cpp", ...), not gated behind
 * the add-on. */
export async function getLanguages(): Promise<string[]> {
  return apiClient.get<string[]>("/api/v1/coding/languages", { auth: false });
}

interface RunTestsWire {
  total?: number;
  passed?: number;
  failed?: number;
  score?: number;
  engine?: "judge0" | "ai";
  results?: Array<{
    passed?: boolean;
    actual_output?: string | null;
    stderr?: string | null;
    expected_output?: string | null;
  }>;
}

/** POST /api/v1/coding/run-tests — body {language, code, cases:
 * [{stdin, expected_output}]}. Diffs real (or AI-predicted, if Judge0 isn't
 * configured/active) output against each test case's expected output. */
export async function runTests(language: string, code: string, cases: CodingTestCase[]): Promise<RunTestsSummary> {
  const data = await apiClient.post<RunTestsWire>("/api/v1/coding/run-tests", {
    language,
    code,
    cases: cases.map((c) => ({ stdin: c.input, expected_output: c.expectedOutput })),
  });
  const rawResults = data.results ?? [];
  const results: TestRunResult[] = cases.map((testCase, i) => {
    const r = rawResults[i];
    return {
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      passed: r?.passed ?? false,
      actualOutput: r?.actual_output ?? undefined,
      stderr: r?.stderr ?? undefined,
    };
  });
  return {
    results,
    passedCount: data.passed ?? results.filter((r) => r.passed).length,
    totalCount: data.total ?? results.length,
    score: data.score,
    engine: data.engine,
  };
}

interface ReviewWire {
  complexity_note?: string;
  feedback?: string[];
  error?: string;
}

/** POST /api/v1/coding/review — body {language, code, problem, testsPassed?,
 * testsTotal?}. testsPassed/testsTotal ground the review in the last real
 * Run Tests result so the AI can state correctness plainly instead of only
 * ever commenting on style (see the backend's own bug-fix docstring on this
 * endpoint). No `responseLanguage` sent — same as every other AI endpoint
 * this web app already calls, the backend falls back to the user's stored
 * profile.locale on its own. */
export async function getCodeReview(
  code: string,
  language: string,
  problem: string,
  testsPassed?: number,
  testsTotal?: number
): Promise<CodeReviewResult> {
  const data = await apiClient.post<ReviewWire>("/api/v1/coding/review", {
    language,
    code,
    problem,
    testsPassed,
    testsTotal,
  });
  return {
    complexityNote: data.complexity_note ?? "",
    feedback: data.feedback ?? [],
  };
}
