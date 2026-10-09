"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/app/providers/AuthProvider";
import * as documentsService from "@/lib/documentsService";
import * as onboardingAssessmentService from "@/lib/onboardingAssessmentService";
import type { EvaIconName } from "@/components/icons/EvaIcon";

// "Coach readiness" — product report: "when users login for the first time
// the app dont really tell them what is the first thing they should do ...
// something that is necessary for the users to do in order for the AI career
// coach to give the maximum help". These four inputs are exactly what the
// backend coach (Saveur-Backend app/api/coach.py) builds its context from:
// the uploaded resume text/ATS score, desired roles + preferred countries,
// the user's career goal, and the Career DNA personality assessment.
// Shared by the dashboard card and the first-login prompt so both always
// agree on what is "done".

export interface ReadinessStep {
  key: "resume" | "roles" | "goal" | "assessment";
  icon: EvaIconName;
  label: string;
  why: string;
  href: string;
  done: boolean;
}

export interface CoachReadiness {
  loading: boolean;
  steps: ReadinessStep[];
  doneCount: number;
  total: number;
  percent: number;
  allDone: boolean;
  /** First incomplete step, i.e. "start here". */
  next: ReadinessStep | null;
}

export function useCoachReadiness(): CoachReadiness {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [hasResume, setHasResume] = useState<boolean | undefined>(undefined);
  const [assessmentDone, setAssessmentDone] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!profile?.uid) return;
    let cancelled = false;
    documentsService
      .listDocuments()
      .then((docs) => !cancelled && setHasResume(docs.some((d) => d.kind === "resume")))
      .catch(() => !cancelled && setHasResume(false));
    onboardingAssessmentService
      .getStatus()
      .then((s) => !cancelled && setAssessmentDone(s.personalityCompleted))
      .catch(() => !cancelled && setAssessmentDone(true)); // fail open: don't nag on a failed check
    return () => {
      cancelled = true;
    };
  }, [profile?.uid]);

  return useMemo(() => {
    const steps: ReadinessStep[] = [
      {
        key: "resume",
        icon: "file-text-outline",
        label: t("web:dashboard.coachReadiness.resumeLabel", { defaultValue: "Upload your resume" }),
        why: t("web:dashboard.coachReadiness.resumeWhy", { defaultValue: "Your coach reads it to tailor advice to your real experience and ATS score." }),
        href: "/documents",
        done: !!hasResume,
      },
      {
        key: "roles",
        icon: "briefcase-outline",
        label: t("web:dashboard.coachReadiness.rolesLabel", { defaultValue: "Choose your target roles & countries" }),
        why: t("web:dashboard.coachReadiness.rolesWhy", { defaultValue: "Powers job matches, your roadmap and role-specific interview practice." }),
        href: "/settings/profile#target-roles",
        done: (profile?.desiredRoles?.length ?? 0) > 0 && (profile?.preferredCountries?.length ?? 0) > 0,
      },
      {
        key: "goal",
        icon: "flag-outline",
        label: t("web:dashboard.coachReadiness.goalLabel", { defaultValue: "Pick your career goal" }),
        why: t("web:dashboard.coachReadiness.goalWhy", { defaultValue: "Shapes your coaching, daily tips and the plan we build for you." }),
        href: "/settings/profile#career-goal",
        done: (profile?.goals?.length ?? 0) > 0,
      },
      {
        key: "assessment",
        icon: "activity-outline",
        label: t("web:dashboard.coachReadiness.assessmentLabel", { defaultValue: "Take the career assessment" }),
        why: t("web:dashboard.coachReadiness.assessmentWhy", { defaultValue: "Builds your Career DNA so advice fits your strengths and work style." }),
        href: "/onboarding/assessment",
        done: !!assessmentDone,
      },
    ];
    const loading = !profile || hasResume === undefined || assessmentDone === undefined;
    const doneCount = steps.filter((s) => s.done).length;
    return {
      loading,
      steps,
      doneCount,
      total: steps.length,
      percent: Math.round((doneCount / steps.length) * 100),
      allDone: doneCount === steps.length,
      next: steps.find((s) => !s.done) ?? null,
    };
  }, [t, profile, hasResume, assessmentDone]);
}
