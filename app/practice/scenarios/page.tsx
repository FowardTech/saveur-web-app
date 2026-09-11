"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { EvaIcon, type EvaIconName } from "@/components/icons/EvaIcon";
import type { ApiError } from "@/lib/apiClient";
import * as practicalService from "@/lib/practicalService";
import type { PracticalSessionSummary, PracticalStep, PracticalTaskFeedback } from "@/lib/practicalService";

// Real backend contract — Saveur-Backend/app/api/practical.py
//   GET  /api/v1/practical/types              -> {types: string[]}
//   POST /api/v1/practical/sessions           -> {session: {...}, step: {...}}
//   POST /api/v1/practical/sessions/:id/choose      -> {status, step?}
//   POST /api/v1/practical/sessions/:id/submit-task -> {status, step?, task_feedback}
// Gated behind the "practical_scenario" paid add-on (@require_addon).
//
// Pill-based type selection ported from Saveur/src/practice/
// PracticalScenarioSetup.tsx's ALL_TYPES/TYPE_ICONS/TYPE_LABEL_KEYS — this
// screen has no constants/Data.ts DATA_ array of its own (unlike the mock
// interview wizard's INTERVIEW_TYPES); mobile defines the 6 types + their
// icons locally in that one file, mirrored here 1:1.
const PRACTICAL_TYPES: { value: string; icon: EvaIconName }[] = [
  { value: "healthcare", icon: "heart-outline" },
  { value: "sales", icon: "trending-up-outline" },
  { value: "marketing", icon: "bar-chart-2-outline" },
  { value: "finance", icon: "pie-chart-outline" },
  { value: "consulting", icon: "briefcase-outline" },
  { value: "science", icon: "bulb-outline" },
];

const TOTAL_STEPS_ESTIMATE = 6; // mirrors Saveur-Backend/app/api/practical.py's MAX_STEPS

function fallbackLabelFor(type: string) {
  return type[0].toUpperCase() + type.slice(1);
}

// Small inline spinner — matches components/jobAlerts/JobFitAnalysis.tsx's
// "Analyzing this role's requirements…" convention for a real AI call that
// can take several seconds, rather than a bare disabled button with no
// feedback.
function InlineSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-card border border-border bg-surface-2 px-5 py-4">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-hint border-t-transparent" aria-hidden="true" />
      <span className="text-sm text-hint">{label}</span>
    </div>
  );
}

export default function PracticalScenariosSetupPage() {
  const { t } = useTranslation();

  // --- Setup form state ------------------------------------------------
  const [type, setType] = useState(PRACTICAL_TYPES[0].value);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addonRequired, setAddonRequired] = useState(false);

  // --- In-progress session state ----------------------------------------
  const [session, setSession] = useState<PracticalSessionSummary | null>(null);
  const [step, setStep] = useState<PracticalStep | null>(null);
  const [completed, setCompleted] = useState(false);

  // Choice-step advancing.
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [choiceError, setChoiceError] = useState<string | null>(null);
  const [choiceErrorIsLLM, setChoiceErrorIsLLM] = useState(false);

  // Task-step submission.
  const [taskResponse, setTaskResponse] = useState("");
  const [submittingTask, setSubmittingTask] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskErrorIsLLM, setTaskErrorIsLLM] = useState(false);
  const [taskFeedback, setTaskFeedback] = useState<PracticalTaskFeedback | null>(null);
  const [pendingNextStep, setPendingNextStep] = useState<PracticalStep | null>(null);

  function labelFor(value: string) {
    return t(`web:practice.scenarios.types.${value}`, { defaultValue: fallbackLabelFor(value) });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAddonRequired(false);
    try {
      const data = await practicalService.createSession(type as practicalService.PracticalType, role.trim() || undefined);
      setSession(data.session);
      setStep(data.step);
      setCompleted(false);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402) {
        setAddonRequired(true);
      } else {
        setError(apiErr.message || t("web:practice.scenarios.startFailedDefault", { defaultValue: "Couldn't start a scenario. Please try again." }));
      }
    } finally {
      setLoading(false);
    }
  }

  function resetSession() {
    setSession(null);
    setStep(null);
    setCompleted(false);
    setChoosingId(null);
    setChoiceError(null);
    setChoiceErrorIsLLM(false);
    setTaskResponse("");
    setSubmittingTask(false);
    setTaskError(null);
    setTaskErrorIsLLM(false);
    setTaskFeedback(null);
    setPendingNextStep(null);
  }

  // --- Choice steps -------------------------------------------------------
  async function onChoose(choiceId: string) {
    if (!session || choosingId) return;
    setChoosingId(choiceId);
    setChoiceError(null);
    setChoiceErrorIsLLM(false);
    try {
      const result = await practicalService.chooseOption(session.id, choiceId);
      if (result.status === "completed") {
        setCompleted(true);
        setStep(null);
      } else {
        setStep(result.step);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      if (practicalService.isLLMUnavailable(apiErr)) {
        setChoiceErrorIsLLM(true);
        setChoiceError(
          apiErr.message || t("web:practice.scenarios.llmUnavailable", { defaultValue: "This feature isn't available right now. Please try again in a few minutes." })
        );
      } else {
        setChoiceError(apiErr.message || t("web:practice.scenarios.chooseFailedDefault", { defaultValue: "Couldn't continue the scenario. Please try again." }));
      }
    } finally {
      setChoosingId(null);
    }
  }

  // --- Task steps -----------------------------------------------------------
  async function onSubmitTask() {
    if (!session || !taskResponse.trim() || submittingTask) return;
    setSubmittingTask(true);
    setTaskError(null);
    setTaskErrorIsLLM(false);
    try {
      const result = await practicalService.submitTask(session.id, taskResponse.trim());
      // Show the grading before advancing — the learner reviews it, then
      // taps Continue (see below) to move to the next step / completion.
      setTaskFeedback(result.taskFeedback);
      setPendingNextStep(result.status === "active" ? result.step : null);
    } catch (err) {
      const apiErr = err as ApiError;
      // Deliberately do NOT clear taskResponse here (in either branch) — a
      // failed grading call must not make the learner retype their answer.
      if (practicalService.isLLMUnavailable(apiErr)) {
        setTaskErrorIsLLM(true);
        setTaskError(
          apiErr.message || t("web:practice.scenarios.llmUnavailable", { defaultValue: "This feature isn't available right now. Please try again in a few minutes." })
        );
      } else {
        setTaskError(apiErr.message || t("web:practice.scenarios.taskGradingFailedDefault", { defaultValue: "Couldn't grade your submission right now. Please try again." }));
      }
    } finally {
      setSubmittingTask(false);
    }
  }

  function onContinueAfterTask() {
    if (pendingNextStep) {
      setStep(pendingNextStep);
    } else {
      setCompleted(true);
      setStep(null);
    }
    setTaskResponse("");
    setTaskFeedback(null);
    setPendingNextStep(null);
    setTaskError(null);
    setTaskErrorIsLLM(false);
  }

  const showSetupForm = !session && !addonRequired;
  const showActiveStep = session && step && !completed;

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:practice.scenarios.title", { defaultValue: "Practical Scenarios" })}
            subtitle={t("web:practice.scenarios.subtitle", { defaultValue: "Hands-on, multi-step judgment scenarios for non-engineering roles." })}
          />

          {addonRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:practice.scenarios.addonRequiredTitle", { defaultValue: "Practical Scenarios is a paid add-on" })}</h2>
              <p className="text-sm text-hint">
                {t("web:practice.scenarios.addonRequiredSubtitle", {
                  defaultValue: "Purchase the Practical Scenarios add-on from your account to unlock this practice mode.",
                })}
              </p>
            </div>
          )}

          {showSetupForm && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-primary">
                  {t("web:practice.scenarios.scenarioTypeLabel", { defaultValue: "Choose a field" })}
                </span>
                <div className="flex flex-wrap gap-2">
                  {PRACTICAL_TYPES.map((pt) => (
                    <Pill key={pt.value} selected={pt.value === type} icon={pt.icon} onClick={() => setType(pt.value)}>
                      {labelFor(pt.value)}
                    </Pill>
                  ))}
                </div>
              </div>
              <TextField
                label={t("web:practice.scenarios.roleLabel", { defaultValue: "Role (optional)" })}
                placeholder={t("web:practice.scenarios.rolePlaceholder", { defaultValue: "e.g. Registered Nurse, Account Executive" })}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
              {error && <p className="text-sm text-danger">{error}</p>}
              <Button type="submit" disabled={loading} className="mt-1 w-full">
                {loading ? t("web:practice.scenarios.startingLabel", { defaultValue: "Starting…" }) : t("web:practice.scenarios.startScenario", { defaultValue: "Start scenario" })}
              </Button>
            </form>
          )}

          {showActiveStep && (
            <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
              <p className="text-sm font-medium text-hint">
                {t("web:practice.scenarios.stepProgress", {
                  defaultValue: "Step {{step}} of ~{{total}}",
                  step: step.order,
                  total: TOTAL_STEPS_ESTIMATE,
                })}
              </p>

              <div className="rounded-lg bg-surface-1 p-4">
                <p className="text-sm text-primary">{step.situation}</p>
              </div>

              {step.stepType === "choice" ? (
                <>
                  <h2 className="text-sm font-semibold text-primary">
                    {t("web:practice.scenarios.whatDoYouDo", { defaultValue: "What do you do?" })}
                  </h2>

                  {choosingId ? (
                    <InlineSpinner label={t("web:practice.scenarios.continuingScenario", { defaultValue: "Seeing what happens next…" }).toString()} />
                  ) : (
                    <div className="flex flex-col gap-2">
                      {step.choices.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => onChoose(c.id)}
                          className="flex items-start gap-3 rounded-lg border border-border px-3.5 py-2.5 text-left text-sm text-primary transition hover:border-brand/50 hover:bg-surface-1"
                        >
                          <span className="font-semibold uppercase text-hint">{c.id}.</span>
                          <span>{c.text}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {choiceError && (
                    <div className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface-1 p-4">
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                          choiceErrorIsLLM ? "bg-tint-orange text-tint-orange-text" : "bg-surface-3 text-hint"
                        }`}
                      >
                        <EvaIcon name="alert-circle-outline" size={16} />
                      </span>
                      <p className="text-sm text-danger">{choiceError}</p>
                    </div>
                  )}
                </>
              ) : (
                // Hands-on task step — the AI poses a real written deliverable
                // instead of multiple-choice options (see practical.py's
                // TASK_STEP_NUMBERS). Rendered as a distinctly-styled callout
                // (not just more body text) so this visually reads as "now do
                // a real task" vs. "pick an option".
                <>
                  {taskFeedback ? (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start gap-3 rounded-lg border border-tint-mint bg-tint-mint p-4">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-tint-mint-text">
                          <EvaIcon name="checkmark-circle-2-outline" size={18} />
                        </span>
                        <div className="flex flex-col gap-1">
                          <h3 className="text-sm font-semibold text-tint-mint-text">
                            {t("web:practice.scenarios.taskFeedbackTitle", { defaultValue: "Feedback on your submission" })}
                          </h3>
                          <p className="text-sm text-primary">{taskFeedback.feedback}</p>
                        </div>
                      </div>

                      {(taskFeedback.strengths.length > 0 || taskFeedback.improvements.length > 0) && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {taskFeedback.strengths.length > 0 && (
                            <div className="flex flex-col gap-2 rounded-lg bg-surface-1 p-4">
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-hint">
                                {t("web:practice.scenarios.strengths", { defaultValue: "Strengths" })}
                              </h4>
                              <ul className="flex flex-col gap-1.5 text-sm text-primary">
                                {taskFeedback.strengths.map((s, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <EvaIcon name="checkmark-circle-2-outline" size={14} className="mt-0.5 shrink-0 text-success-text" />
                                    <span>{s}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {taskFeedback.improvements.length > 0 && (
                            <div className="flex flex-col gap-2 rounded-lg bg-surface-1 p-4">
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-hint">
                                {t("web:practice.scenarios.improvements", { defaultValue: "Areas to improve" })}
                              </h4>
                              <ul className="flex flex-col gap-1.5 text-sm text-primary">
                                {taskFeedback.improvements.map((s, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <EvaIcon name="arrow-forward-outline" size={14} className="mt-0.5 shrink-0 text-hint" />
                                    <span>{s}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      <Button onClick={onContinueAfterTask} className="w-fit">
                        {pendingNextStep
                          ? t("web:practice.scenarios.continueScenario", { defaultValue: "Continue" })
                          : t("web:practice.scenarios.finishScenario", { defaultValue: "Finish scenario" })}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-2 rounded-lg border-2 border-tint-purple bg-tint-purple p-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-tint-purple-text">
                            <EvaIcon name="edit-2-outline" size={14} />
                          </span>
                          <h3 className="text-sm font-semibold text-tint-purple-text">
                            {t("web:practice.scenarios.taskPromptLabel", { defaultValue: "Your hands-on task" })}
                          </h3>
                        </div>
                        <p className="text-sm text-primary">{step.taskPrompt}</p>
                      </div>

                      <label className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-primary">
                          {t("web:practice.scenarios.taskResponseLabel", { defaultValue: "Your response" })}
                        </span>
                        <textarea
                          rows={6}
                          value={taskResponse}
                          onChange={(e) => setTaskResponse(e.target.value)}
                          disabled={submittingTask}
                          placeholder={t("web:practice.scenarios.taskResponsePlaceholder", { defaultValue: "Write your response here…" }).toString()}
                          className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
                        />
                      </label>

                      {submittingTask && (
                        <InlineSpinner label={t("web:practice.scenarios.gradingTask", { defaultValue: "Grading your submission — this can take a few seconds…" }).toString()} />
                      )}

                      {taskError && (
                        <div className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface-1 p-4">
                          <span
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                              taskErrorIsLLM ? "bg-tint-orange text-tint-orange-text" : "bg-surface-3 text-hint"
                            }`}
                          >
                            <EvaIcon name="alert-circle-outline" size={16} />
                          </span>
                          <p className="text-sm text-danger">{taskError}</p>
                          <button type="button" className="text-sm font-semibold text-brand" onClick={onSubmitTask}>
                            {t("common:try_again", { defaultValue: "Try again" })}
                          </button>
                        </div>
                      )}

                      {!submittingTask && (
                        <Button onClick={onSubmitTask} disabled={!taskResponse.trim()} className="w-fit">
                          {t("web:practice.scenarios.submitTask", { defaultValue: "Submit" })}
                        </Button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {completed && (
            <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-mint text-tint-mint-text">
                  <EvaIcon name="checkmark-circle-2-outline" size={22} />
                </span>
                <div>
                  <h2 className="font-semibold text-primary">{t("web:practice.scenarios.scenarioComplete", { defaultValue: "Scenario complete" })}</h2>
                  <p className="text-sm text-hint">
                    {t("web:practice.scenarios.feedbackGenerating", {
                      defaultValue: "Your judgment feedback for this session is being generated in the background.",
                    })}
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={resetSession} className="w-fit">
                {t("web:practice.scenarios.startAnother", { defaultValue: "Start another scenario" })}
              </Button>
            </div>
          )}
        </div>
      </AppShell>
    </RequireAuth>
  );
}
