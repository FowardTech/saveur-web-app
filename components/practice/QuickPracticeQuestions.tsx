"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Button } from "@/components/ui/Button";
import { SkeletonRows } from "@/components/ui/Skeleton";
import apiClient, { type ApiError } from "@/lib/apiClient";

// Product report: "I checked the dashboard of those web apps... there is a
// lot of designs and features" -- specifically resume.io's Interview Prep
// page has a row of ready-made "5 min" question cards sitting above the
// full role-specific "45 min" mock interview setup. This section is that
// lighter, browse-first-then-practice-one-question tier -- deliberately
// separate from the full session wizard right below it on this same page.
//
// Real backend contract:
//   GET /api/v1/interviews/question-library?type=&role=&language=
//     -> {questions: [{id, text, type}]}
//   POST /api/v1/coach/star  body {question, answer, language}
//     -> {breakdown: [{letter, label, score, note}], overall_note}
// Both already free (no @require_pro) -- no session created, no add-on/
// free-tier-cap gating touched at all.

interface LibraryQuestion {
  id: string;
  text: string;
  type: string;
}

interface StarItem {
  letter: "S" | "T" | "A" | "R";
  label: string;
  score: number;
  note?: string;
}

interface StarResult {
  breakdown: StarItem[];
  overall_note?: string;
}

export function QuickPracticeQuestions({ interviewType, role }: { interviewType: string; role: string }) {
  const { t, i18n } = useTranslation();
  const [questions, setQuestions] = useState<LibraryQuestion[] | null>(null);
  const [active, setActive] = useState<LibraryQuestion | null>(null);

  useEffect(() => {
    let cancelled = false;
    setQuestions(null);
    apiClient
      .get<{ questions: LibraryQuestion[] }>("/api/v1/interviews/question-library", {
        params: { type: interviewType, role: role || undefined, language: i18n.language },
      })
      .then((data) => {
        if (!cancelled) setQuestions(data.questions || []);
      })
      .catch(() => {
        if (!cancelled) setQuestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [interviewType, role, i18n.language]);

  if (questions !== null && questions.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-hint">{t("web:practice.mockInterviews.quickQuestionsTitle", { defaultValue: "Quick practice questions" })}</h2>
        <p className="text-xs text-hint">
          {t("web:practice.mockInterviews.quickQuestionsSubtitle", { defaultValue: "Answer one question and get instant feedback — no full session needed." })}
        </p>
      </div>

      {questions === null ? (
        <SkeletonRows count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {questions.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setActive(q)}
              className="flex flex-col items-start gap-3 rounded-card border border-border bg-surface-2 p-4 text-left transition hover:border-brand/50"
            >
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-tint-purple px-2.5 py-1 text-xs font-semibold text-tint-purple-text">
                <EvaIcon name="clock-outline" size={12} />
                {t("web:practice.mockInterviews.fiveMin", { defaultValue: "5 min" })}
              </span>
              <p className="text-sm font-medium text-primary">{q.text}</p>
            </button>
          ))}
        </div>
      )}

      {active && (
        <AnswerQuestionModal
          question={active}
          language={i18n.language}
          onClose={() => setActive(null)}
        />
      )}
    </section>
  );
}

function AnswerQuestionModal({
  question,
  language,
  onClose,
}: {
  question: LibraryQuestion;
  language: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StarResult | null>(null);

  async function handleGetFeedback() {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const data = await apiClient.post<StarResult>("/api/v1/coach/star", {
        question: question.text,
        answer: answer.trim(),
        language,
      });
      setResult(data);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr.message || t("web:practice.mockInterviews.starFeedbackFailed", { defaultValue: "Couldn't grade your answer. Please try again." }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-card border border-border bg-surface-2 p-6 sm:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-semibold text-primary">{question.text}</h2>
          <button type="button" onClick={onClose} aria-label={t("common:actions.close", { defaultValue: "Close" })} className="shrink-0">
            <EvaIcon name="close-outline" size={20} className="text-hint" />
          </button>
        </div>

        {!result && (
          <div className="flex flex-col gap-3">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={6}
              placeholder={t("web:practice.mockInterviews.answerPlaceholder", { defaultValue: "Type your answer…" })}
              className="w-full resize-none rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="button" disabled={!answer.trim() || submitting} onClick={handleGetFeedback} className="w-full">
              {submitting
                ? t("web:practice.mockInterviews.gradingLabel", { defaultValue: "Grading…" })
                : t("web:practice.mockInterviews.getFeedback", { defaultValue: "Get feedback" })}
            </Button>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-4">
            {result.breakdown && result.breakdown.length > 0 && (
              <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-hint">
                  {t("web:practice.session.starBreakdown", { defaultValue: "STAR breakdown" })}
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {result.breakdown.map((s) => (
                    <div key={s.letter} className="rounded-lg bg-surface-2 p-3 text-center">
                      <p className="text-lg font-bold text-primary">{s.letter}</p>
                      <p className="text-xs text-hint">{s.label}</p>
                      <p className="mt-1 text-sm font-semibold text-primary">{s.score}%</p>
                    </div>
                  ))}
                </div>
                {result.breakdown.some((s) => s.note) && (
                  <ul className="flex flex-col gap-1.5">
                    {result.breakdown.filter((s) => s.note).map((s) => (
                      <li key={s.letter} className="text-sm text-primary">
                        <span className="font-semibold">{s.letter}:</span> {s.note}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {result.overall_note && <p className="text-sm text-primary">{result.overall_note}</p>}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setResult(null);
                setAnswer("");
              }}
              className="w-full"
            >
              {t("web:practice.mockInterviews.tryAnotherAnswer", { defaultValue: "Try another answer" })}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
