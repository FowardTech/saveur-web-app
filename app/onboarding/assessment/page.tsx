"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Button } from "@/components/ui/Button";
import { BrandLockup } from "@/components/shell/BrandLockup";
import * as onboardingAssessmentService from "@/lib/onboardingAssessmentService";
import type {
  PersonalityAnswer,
  PersonalityQuestion,
  SkillsQuizAnswer,
  SkillsQuizQuestion,
  SkillsQuizResultDetail,
} from "@/lib/onboardingAssessmentService";

// Product request: "I want us to add prep test and many other personality
// test during onboarding and also when user enters the dashboard for the
// first time." Entirely server-driven (Saveur-Backend's
// onboarding_assessment_service.py) -- this page holds no question bank or
// scoring logic of its own, just renders whatever the API returns, same as
// mobile's src/more/CareerAssessment.tsx.
//
// Reached two ways (mirroring mobile's two entry points): right after
// app/onboarding/page.tsx's signup wizard finishes (?from=onboarding), and
// as a one-time automatic nudge on the first /dashboard visit if the user
// skipped it then (see components/dashboard/GettingStartedChecklist.tsx).
// useSearchParams() requires a Suspense boundary, same pattern as
// app/ai-coach/page.tsx's own wrapper.
export default function CareerAssessmentPage() {
  return (
    <Suspense fallback={null}>
      <CareerAssessmentPageInner />
    </Suspense>
  );
}

type Stage =
  | "intro"
  | "personality_loading"
  | "personality"
  | "personality_result"
  | "skills_intro"
  | "skills_loading"
  | "skills_quiz"
  | "skills_result";

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-3">
      <div className="h-full rounded-pill bg-brand transition-all" style={{ width: `${((current + 1) / total) * 100}%` }} />
    </div>
  );
}

function OptionRow({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-card border border-border bg-surface-1 px-4 py-3.5 text-left text-sm font-medium text-primary transition hover:border-brand/50 hover:bg-surface-3"
    >
      <span>{text}</span>
      <EvaIcon name="chevron-right-outline" size={16} />
    </button>
  );
}

function CareerAssessmentPageInner() {
  const { t } = useTranslation(["common", "web"]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const fromOnboarding = searchParams.get("from") === "onboarding";

  const [stage, setStage] = useState<Stage>("intro");
  const [error, setError] = useState<string | null>(null);

  const [personalityQuestions, setPersonalityQuestions] = useState<PersonalityQuestion[]>([]);
  const [personalityIndex, setPersonalityIndex] = useState(0);
  const [personalityAnswers, setPersonalityAnswers] = useState<PersonalityAnswer[]>([]);
  const [narrative, setNarrative] = useState("");
  const [isSubmittingPersonality, setIsSubmittingPersonality] = useState(false);

  const [quizId, setQuizId] = useState<string | null>(null);
  const [skillsQuestions, setSkillsQuestions] = useState<SkillsQuizQuestion[]>([]);
  const [skillsIndex, setSkillsIndex] = useState(0);
  const [skillsAnswers, setSkillsAnswers] = useState<SkillsQuizAnswer[]>([]);
  const [skillsScore, setSkillsScore] = useState({ score: 0, total: 0 });
  const [skillsDetail, setSkillsDetail] = useState<SkillsQuizResultDetail[]>([]);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  const targetRole = profile?.desiredRoles?.[0] || "";
  const targetIndustry = profile?.industries?.[0] || "";

  const markSeen = useCallback(() => {
    if (typeof window === "undefined" || !profile?.uid) return;
    try {
      window.localStorage.setItem(`careerAssessmentPromptSeen:${profile.uid}`, "1");
    } catch {
      // best-effort — a storage failure shouldn't block finishing the flow
    }
  }, [profile?.uid]);

  const finish = useCallback(() => {
    markSeen();
    router.push("/dashboard");
  }, [markSeen, router]);

  const startPersonality = useCallback(async () => {
    setStage("personality_loading");
    setError(null);
    try {
      const questions = await onboardingAssessmentService.getPersonalityQuestions();
      setPersonalityQuestions(questions);
      setPersonalityIndex(0);
      setPersonalityAnswers([]);
      setStage("personality");
    } catch {
      setError(t("web:careerAssessment.loadFailed", { defaultValue: "Couldn't load the assessment right now." }));
      setStage("intro");
    }
  }, [t]);

  const onSelectPersonalityOption = useCallback(
    async (optionIndex: number) => {
      const question = personalityQuestions[personalityIndex];
      if (!question) return;
      const nextAnswers = [...personalityAnswers, { questionId: question.id, optionIndex }];
      setPersonalityAnswers(nextAnswers);
      if (personalityIndex + 1 < personalityQuestions.length) {
        setPersonalityIndex(personalityIndex + 1);
        return;
      }
      setIsSubmittingPersonality(true);
      try {
        const result = await onboardingAssessmentService.submitPersonality(nextAnswers);
        setNarrative(result.narrative);
        setStage("personality_result");
      } catch {
        setError(t("web:careerAssessment.submitFailed", { defaultValue: "Couldn't save your answers right now." }));
        setStage("personality_result");
      } finally {
        setIsSubmittingPersonality(false);
      }
    },
    [personalityAnswers, personalityIndex, personalityQuestions, t]
  );

  const startSkillsQuiz = useCallback(async () => {
    setStage("skills_loading");
    setError(null);
    setIsGeneratingQuiz(true);
    try {
      const result = await onboardingAssessmentService.generateSkillsQuiz(targetRole, targetIndustry);
      setQuizId(result.quizId);
      setSkillsQuestions(result.questions);
      setSkillsIndex(0);
      setSkillsAnswers([]);
      setStage("skills_quiz");
    } catch {
      setError(t("web:careerAssessment.quizGenerateFailed", { defaultValue: "Couldn't put together your quiz right now." }));
      setStage("skills_intro");
    } finally {
      setIsGeneratingQuiz(false);
    }
  }, [t, targetIndustry, targetRole]);

  const onSelectSkillsOption = useCallback(
    async (selectedIndex: number) => {
      const question = skillsQuestions[skillsIndex];
      if (!question || !quizId) return;
      const nextAnswers = [...skillsAnswers, { questionId: question.id, selectedIndex }];
      setSkillsAnswers(nextAnswers);
      if (skillsIndex + 1 < skillsQuestions.length) {
        setSkillsIndex(skillsIndex + 1);
        return;
      }
      try {
        const result = await onboardingAssessmentService.submitSkillsQuiz(quizId, nextAnswers, targetRole);
        setSkillsScore({ score: result.score, total: result.total });
        setSkillsDetail(result.detail);
      } catch {
        setSkillsScore({ score: 0, total: skillsQuestions.length });
      } finally {
        setStage("skills_result");
      }
    },
    [quizId, skillsAnswers, skillsIndex, skillsQuestions, targetRole]
  );

  let body: React.ReactNode;

  if (stage === "intro") {
    body = (
      <>
        <h1 className="text-2xl font-bold text-primary">
          {t("web:careerAssessment.introTitle", { defaultValue: "Let's get to know how you work" })}
        </h1>
        <p className="mt-3 text-sm text-hint">
          {t("web:careerAssessment.introSubtitle", {
            defaultValue:
              "A quick 2-minute career personality assessment, plus an optional skills-readiness quiz for your target role — both help your AI Coach personalize its advice from day one.",
          })}
        </p>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        <Button size="lg" className="mt-6 w-full" onClick={startPersonality}>
          {t("web:careerAssessment.startButton", { defaultValue: "Start (2 min)" })}
        </Button>
        <button type="button" onClick={finish} className="mt-3 w-full text-center text-sm text-hint hover:underline">
          {t("web:careerAssessment.skipForNow", { defaultValue: "Skip for now" })}
        </button>
      </>
    );
  } else if (stage === "personality_loading" || stage === "skills_loading") {
    body = (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  } else if (stage === "personality") {
    const question = personalityQuestions[personalityIndex];
    body = (
      <>
        <ProgressBar current={personalityIndex} total={personalityQuestions.length} />
        <p className="mt-4 text-xs font-medium text-hint">
          {t("web:careerAssessment.questionOf", {
            current: personalityIndex + 1,
            total: personalityQuestions.length,
            defaultValue: `Question ${personalityIndex + 1} of ${personalityQuestions.length}`,
          })}
        </p>
        <h2 className="mt-2 mb-5 text-lg font-bold text-primary">{question?.text}</h2>
        {isSubmittingPersonality ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {question?.options.map((opt, i) => (
              <OptionRow key={`${question.id}_${i}`} text={opt} onClick={() => onSelectPersonalityOption(i)} />
            ))}
          </div>
        )}
      </>
    );
  } else if (stage === "personality_result") {
    body = (
      <>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-tint-mint">
          <EvaIcon name="checkmark-circle-2" size={28} />
        </div>
        <h2 className="mt-4 text-center text-xl font-bold text-primary">
          {t("web:careerAssessment.personalityDoneTitle", { defaultValue: "Your working style" })}
        </h2>
        {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}
        {narrative && <p className="mt-4 text-center text-sm text-primary">{narrative}</p>}
        <Button size="lg" className="mt-6 w-full" onClick={() => setStage("skills_intro")}>
          {t("web:careerAssessment.continueButton", { defaultValue: "Continue" })}
        </Button>
      </>
    );
  } else if (stage === "skills_intro") {
    body = (
      <>
        <h1 className="text-2xl font-bold text-primary">
          {t("web:careerAssessment.skillsIntroTitle", { defaultValue: "Want a quick skills check?" })}
        </h1>
        <p className="mt-3 text-sm text-hint">
          {targetRole
            ? t("web:careerAssessment.skillsIntroSubtitleRole", {
                role: targetRole,
                defaultValue: `5 quick multiple-choice questions on ${targetRole} fundamentals — see where you stand before your first mock interview.`,
              })
            : t("web:careerAssessment.skillsIntroSubtitleGeneric", {
                defaultValue: "5 quick multiple-choice questions to gauge your readiness before your first mock interview.",
              })}
        </p>
        {error && <p className="mt-4 text-sm text-danger">{error}</p>}
        <Button size="lg" className="mt-6 w-full" onClick={startSkillsQuiz} disabled={isGeneratingQuiz}>
          {t("web:careerAssessment.takeQuizButton", { defaultValue: "Take the quiz" })}
        </Button>
        <button type="button" onClick={finish} className="mt-3 w-full text-center text-sm text-hint hover:underline">
          {t("web:careerAssessment.skipQuiz", { defaultValue: "Skip and go to my dashboard" })}
        </button>
      </>
    );
  } else if (stage === "skills_quiz") {
    const question = skillsQuestions[skillsIndex];
    body = (
      <>
        <ProgressBar current={skillsIndex} total={skillsQuestions.length} />
        <p className="mt-4 text-xs font-medium text-hint">
          {t("web:careerAssessment.questionOf", {
            current: skillsIndex + 1,
            total: skillsQuestions.length,
            defaultValue: `Question ${skillsIndex + 1} of ${skillsQuestions.length}`,
          })}
        </p>
        <h2 className="mt-2 mb-5 text-lg font-bold text-primary">{question?.text}</h2>
        <div className="flex flex-col gap-2.5">
          {question?.options.map((opt, i) => (
            <OptionRow key={`${question.id}_${i}`} text={opt} onClick={() => onSelectSkillsOption(i)} />
          ))}
        </div>
      </>
    );
  } else if (stage === "skills_result") {
    body = (
      <>
        <p className="text-center text-4xl font-bold text-primary">
          {skillsScore.score}/{skillsScore.total}
        </p>
        <p className="mt-1 text-center text-sm text-hint">
          {t("web:careerAssessment.skillsResultSubtitle", { defaultValue: "Here's a quick recap:" })}
        </p>
        <div className="mt-5 flex flex-col divide-y divide-border">
          {skillsDetail.map((d, i) => (
            <div key={d.questionId} className="flex gap-2.5 py-3">
              <EvaIcon
                name={d.correct ? "checkmark-circle-2" : "close-circle"}
                size={18}
                className={d.correct ? "mt-0.5 text-tint-mint-text" : "mt-0.5 text-danger"}
              />
              <div>
                <p className="text-sm font-semibold text-primary">
                  {i + 1}. {d.text}
                </p>
                {d.explanation && <p className="mt-0.5 text-xs text-hint">{d.explanation}</p>}
              </div>
            </div>
          ))}
        </div>
        <Button size="lg" className="mt-6 w-full" onClick={finish}>
          {t("web:careerAssessment.finishButton", { defaultValue: "Go to my dashboard" })}
        </Button>
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="flex items-center justify-between px-6 py-5">
        <BrandLockup size={28} textClassName="text-lg" />
        {/* Only offer a way back to the dashboard when this wasn't reached
            as part of first-time signup (there's no dashboard to return to
            yet in that case) — e.g. a retake from Settings or the
            first-visit nudge, both of which land here with no `from`
            param. */}
        {!fromOnboarding && (
          <button type="button" onClick={() => router.push("/dashboard")} className="text-sm font-medium text-hint hover:text-primary">
            {t("web:careerAssessment.backToDashboard", { defaultValue: "Back to dashboard" })}
          </button>
        )}
      </header>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-lg rounded-card border border-border bg-surface-2 p-6 shadow-sm sm:p-8">{body}</div>
      </div>
    </div>
  );
}
