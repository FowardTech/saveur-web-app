"use client";

import { useEffect, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { getAppConfig, getStudentEligibilityConfig } from "@/lib/appConfigService";
import * as studentVerificationService from "@/lib/studentVerificationService";
import type { StudentProfile, University } from "@/lib/studentVerificationService";
import type { ApiError } from "@/lib/apiClient";

// Student verification + discounted billing — web port of mobile's
// src/more/StudentVerification.tsx (product report: "I noticed that you
// did not implement the student package in the onboarding and in the
// dashboard. Why?"). Real, worldwide university search, school-email
// one-time-code verification, and server-enforced final-year-only
// eligibility — same backend contract mobile already uses, so this is a
// client-only build, no backend changes.
//
// Used in two places, same component either way:
//  - app/onboarding/page.tsx, as an optional step right after choosing a
//    username (mirrors mobile's SignupThirdStep.tsx -> ChooseUsername.tsx
//    -> StudentVerification chain) — `onDone` is provided, so Skip/Continue
//    advance the wizard.
//  - app/settings/student/page.tsx, reachable any time from Settings
//    (mobile's More menu "Student Package and Verification" entry,
//    src/more/MoreSrc.tsx) — `onDone` is omitted, so there's no Skip
//    (nothing to skip) and no Continue (nowhere further to go).
function studentPerks(t: TFunction, discountPercent: number): { icon: string; title: string; body: string }[] {
  return [
    {
      icon: "percent-outline",
      title: t("web:settings.student.perkDiscountTitle", { defaultValue: "{{percent}}% off Saveur Basic", percent: discountPercent }),
      body: t("web:settings.student.perkDiscountBody", { defaultValue: "Discounted pricing for as long as you're a final-year student — until your graduation date." }),
    },
    {
      icon: "bulb-outline",
      title: t("web:settings.student.perkAiTitle", { defaultValue: "AI tailored to student life" }),
      body: t("web:settings.student.perkAiBody", { defaultValue: "Your AI Coach, resumes, cover letters, interview prep, and salary guidance all shift to focus on coursework, internships, and landing your first role." }),
    },
    {
      icon: "award-outline",
      title: t("web:settings.student.perkBadgeTitle", { defaultValue: "A verified student badge" }),
      body: t("web:settings.student.perkBadgeBody", { defaultValue: "Shows on your profile until you graduate." }),
    },
  ];
}

function yearLabel(value: string, t: TFunction): string {
  const map: Record<string, string> = {
    "1st_year": t("web:settings.student.year1", { defaultValue: "1st Year" }),
    "2nd_year": t("web:settings.student.year2", { defaultValue: "2nd Year" }),
    "3rd_year": t("web:settings.student.year3", { defaultValue: "3rd Year" }),
    final_year: t("web:settings.student.yearFinal", { defaultValue: "Final Year" }),
  };
  return map[value] ?? value;
}

function defaultGraduationDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 6);
  return d.toISOString().slice(0, 10);
}
function minGraduationDate(): string {
  return new Date().toISOString().slice(0, 10);
}
function maxGraduationDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2);
  return d.toISOString().slice(0, 10);
}
function formatDate(iso: string, locale: string): string {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function StudentVerificationStep({ onDone }: { onDone?: () => void }) {
  const { t, i18n } = useTranslation();

  const [status, setStatus] = useState<StudentProfile | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [discountPercent, setDiscountPercent] = useState(3);

  const [universityQuery, setUniversityQuery] = useState("");
  const [universityResults, setUniversityResults] = useState<University[]>([]);
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [schoolEmail, setSchoolEmail] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState<string | null>(null);
  const [graduationDate, setGraduationDate] = useState(defaultGraduationDate());

  const [step, setStep] = useState<"form" | "code">("form");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justVerified, setJustVerified] = useState(false);

  useEffect(() => {
    studentVerificationService.getStatus().then(setStatus).finally(() => setIsLoadingStatus(false));
    getAppConfig().then(() => setDiscountPercent(getStudentEligibilityConfig().discount_percent));
  }, []);

  useEffect(() => {
    const query = universityQuery.trim();
    if (query.length < 3) {
      setUniversityResults([]);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const handle = setTimeout(() => {
      studentVerificationService
        .searchUniversities(query)
        .then((results) => {
          if (!cancelled) setUniversityResults(results);
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [universityQuery]);

  const selectedYearOption = studentVerificationService.YEAR_OPTIONS.find((o) => o.value === yearOfStudy);
  // Live, client-side-only hint — the actual enforcement happens
  // server-side in start_verification, this just surfaces the same
  // reasoning before the round trip so the user isn't surprised by the
  // rejection.
  const emailWarning = studentVerificationService.schoolEmailWarning(schoolEmail, selectedUniversity);
  const canSendCode =
    !!selectedUniversity &&
    !!schoolEmail.trim() &&
    emailWarning?.severity !== "block" &&
    !!selectedYearOption?.isEligible &&
    !isSubmitting;

  async function onSendCode() {
    if (!canSendCode || !selectedUniversity) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await studentVerificationService.sendVerificationCode({
        universityName: selectedUniversity.name,
        universityCountry: selectedUniversity.countryCode,
        schoolEmail: schoolEmail.trim(),
        yearOfStudy: "final_year",
        graduationDate,
        universityDomains: selectedUniversity.domains,
      });
      setStep("code");
    } catch (e) {
      setError((e as ApiError).message || t("web:settings.student.verifyFailed", { defaultValue: "Couldn't send a verification code. Please try again." }));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onConfirmCode() {
    if (!code.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const profile = await studentVerificationService.confirmVerificationCode(code.trim());
      setStatus(profile);
      setJustVerified(true);
    } catch (e) {
      setError((e as ApiError).message || t("web:settings.student.codeInvalid", { defaultValue: "That code doesn't match. Please try again." }));
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = t("web:settings.student.title", { defaultValue: "Student Package and Verification" });

  if (isLoadingStatus) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold text-primary">{title}</h1>
        <div className="h-24 animate-pulse rounded-lg bg-surface-3" />
      </div>
    );
  }

  // Already verified — nothing left to do here but show the active state
  // (mirrors mobile's own early-return for this same condition).
  if (status?.studentDiscountActive || justVerified) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold text-primary">{title}</h1>
        <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-1 p-5">
          <EvaIcon name="checkmark-circle-2-outline" size={24} className="text-success" />
          <p className="font-semibold text-primary">
            {t("web:settings.student.discountActiveTitle", { defaultValue: "Student discount active" })}
          </p>
          <p className="text-sm text-hint">
            {t("web:settings.student.discountActiveBody", {
              defaultValue: "{{university}} · {{percent}}% off until {{date}}",
              university: status?.universityName ?? "",
              percent: discountPercent,
              date: status?.graduationDate ? formatDate(status.graduationDate, i18n.language) : "",
            })}
          </p>
        </div>
        {onDone && (
          <Button type="button" onClick={onDone} className="w-fit">
            {t("common:actions.continue", { defaultValue: "Continue" })}
          </Button>
        )}
      </div>
    );
  }

  if (status?.graduated) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold text-primary">{title}</h1>
        <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-1 p-5">
          <p className="font-semibold text-primary">
            {t("web:settings.student.graduatedTitle", { defaultValue: "Congratulations on graduating!" })}
          </p>
          <p className="text-sm text-hint">
            {t("web:settings.student.graduatedBody", { defaultValue: "Your student discount period has ended." })}
          </p>
        </div>
        {onDone && (
          <Button type="button" onClick={onDone} className="w-fit">
            {t("common:actions.continue", { defaultValue: "Continue" })}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-bold text-primary">{title}</h1>
        {onDone && (
          <button type="button" onClick={onDone} className="shrink-0 text-sm font-medium text-hint hover:text-primary">
            {t("common:actions.skip", { defaultValue: "Skip" })}
          </button>
        )}
      </div>

      {step === "form" ? (
        <>
          <p className="text-sm text-hint">
            {onDone
              ? t("web:settings.student.signupDescription", {
                  defaultValue: "Are you a final-year student? Get {{percent}}% off Saveur Basic until graduation — verify your school email to unlock it. You can always do this later from Settings.",
                  percent: discountPercent,
                })
              : t("web:settings.student.description", {
                  defaultValue: "Final-year students get {{percent}}% off Saveur Basic until graduation. Verify your school email to unlock it.",
                  percent: discountPercent,
                })}
          </p>

          <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-1 p-4">
            {studentPerks(t, discountPercent).map((perk, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <EvaIcon name={perk.icon} size={18} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-primary">{perk.title}</p>
                  <p className="mt-0.5 text-sm text-hint">{perk.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-primary">{t("web:settings.student.universityLabel", { defaultValue: "University" })}</span>
            <input
              placeholder={t("web:settings.student.universitySearchPlaceholder", { defaultValue: "Search for your university…" })}
              value={selectedUniversity ? selectedUniversity.name : universityQuery}
              onChange={(e) => {
                setUniversityQuery(e.target.value);
                setSelectedUniversity(null);
              }}
              className="w-full rounded-lg border border-border bg-surface-1 px-3.5 py-2.5 text-sm text-primary placeholder:text-hint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            {isSearching && <EvaIcon name="loader-outline" size={16} className="animate-spin text-hint" />}
            {!selectedUniversity && universityResults.length > 0 && (
              <div className="flex flex-col overflow-hidden rounded-lg border border-border">
                {universityResults.map((u, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setSelectedUniversity(u);
                      setUniversityQuery(u.name);
                      setUniversityResults([]);
                    }}
                    className="flex flex-col items-start gap-0.5 border-b border-border px-3.5 py-2.5 text-left last:border-b-0 hover:bg-surface-3"
                  >
                    <span className="text-sm text-primary">{u.name}</span>
                    <span className="text-xs text-hint">{u.country}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <TextField
            label={t("web:settings.student.schoolEmailLabel", { defaultValue: "School email" })}
            placeholder={t("web:settings.student.schoolEmailPlaceholder", { defaultValue: "you@university.edu" })}
            type="email"
            autoCapitalize="none"
            value={schoolEmail}
            onChange={(e) => setSchoolEmail(e.target.value)}
            className={emailWarning ? (emailWarning.severity === "block" ? "border-danger" : "border-warning-text") : ""}
          />
          {emailWarning ? (
            <p className={`text-xs font-medium ${emailWarning.severity === "block" ? "text-danger" : "text-warning-text"}`}>
              {emailWarning.message}
            </p>
          ) : (
            <p className="text-xs text-hint">
              {t("web:settings.student.schoolEmailHint", { defaultValue: "Must be your official school-issued email — personal providers like Gmail don't qualify." })}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-primary">{t("web:settings.student.yearOfStudyLabel", { defaultValue: "Year of study" })}</span>
            <div className="flex flex-wrap gap-2">
              {studentVerificationService.YEAR_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setYearOfStudy(opt.value)}
                  className={`rounded-pill border px-3.5 py-2 text-sm font-medium transition ${
                    yearOfStudy === opt.value
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-border bg-surface-1 text-hint hover:border-brand/50 hover:text-primary"
                  }`}
                >
                  {yearLabel(opt.value, t)}
                </button>
              ))}
            </div>
            {yearOfStudy && !selectedYearOption?.isEligible && (
              <p className="text-xs font-medium text-warning-text">
                {t("web:settings.student.finalYearOnly", { defaultValue: "Student pricing is only available to final-year students." })}
              </p>
            )}
          </div>

          <TextField
            label={t("web:settings.student.graduationDateLabel", { defaultValue: "Expected graduation date" })}
            type="date"
            value={graduationDate}
            min={minGraduationDate()}
            max={maxGraduationDate()}
            onChange={(e) => setGraduationDate(e.target.value)}
          />

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="button" onClick={onSendCode} disabled={!canSendCode} className="mt-1 w-full">
            {isSubmitting
              ? t("common:actions.loading", { defaultValue: "Loading…" })
              : t("web:settings.student.sendCode", { defaultValue: "Send Verification Code" })}
          </Button>
          {onDone && (
            <Button type="button" variant="ghost" onClick={onDone} className="w-full">
              {t("web:settings.student.skipForNow", { defaultValue: "I'm not a student — skip for now" })}
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-hint">
            {t("web:settings.student.enterCodeDescription", { defaultValue: "We sent a 6-digit code to {{email}}.", email: schoolEmail })}
          </p>
          <TextField
            label={t("web:settings.student.codeLabel", { defaultValue: "Verification code" })}
            placeholder={t("web:settings.student.codePlaceholder", { defaultValue: "6-digit code" })}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="button" onClick={onConfirmCode} disabled={!code.trim() || isSubmitting} className="w-full">
            {isSubmitting ? t("common:actions.loading", { defaultValue: "Loading…" }) : t("web:settings.student.verifyCode", { defaultValue: "Verify" })}
          </Button>
          <Button type="button" variant="outline" onClick={() => setStep("form")} className="w-full">
            {t("common:actions.back", { defaultValue: "Back" })}
          </Button>
          {onDone && (
            <Button type="button" variant="ghost" onClick={onDone} className="w-full">
              {t("web:settings.student.skipForNow", { defaultValue: "I'm not a student — skip for now" })}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
