"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { PageHeader } from "@/components/ui/PageHeader";
import { TextField } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useAuth } from "@/app/providers/AuthProvider";
import apiClient, { type ApiError } from "@/lib/apiClient";
import {
  CAREER_PATHS,
  COURSE_LEVELS,
  MODULES_PER_LEVEL,
  checkTopic,
  courseIdFor,
  getCourseProgress,
  type CourseLevel,
  type CourseProgressSummary,
  type TopicCheckResult,
} from "@/lib/learningService";
import { DATA_COURSES } from "@/lib/courseCatalog";

// Real backend contract — Saveur-Backend/app/api/learning.py
//   GET  /api/v1/learning/curriculum -> {curriculum: {goal, weeks: Week[]} | null}
//   POST /api/v1/learning/curriculum -> Curriculum (body: {goal, weeks_count?})  -- Premium-gated
//   GET  /api/v1/learning/progress   -> {progress: [...], by_course: {course_id: {completed_modules, last_module_index}}}
//   GET  /api/v1/learning/certificates -> {items: Certificate[]}
//   POST /api/v1/learning/topic-check -> {valid, canonical_topic, reason?, core_subtopics?} (lib/learningService.ts)
// Learning Courses is "AI-taught, on any free-text topic" rather than a
// fixed catalog (see coach.py's module docstring), so this page centers on
// the learner's saved week-by-week Curriculum plus their course progress
// summary, rather than a browsable list of pre-made courses.
//
// Mobile parity (src/more/LearningCourses.tsx):
//  1. AI Curriculum Builder now AUTO-GENERATES from the goal/role the user
//     already gave at signup instead of always making them retype it here —
//     "the app and the AI already knows everything about the user... it
//     should be able to create the curriculum for the user." Only fires
//     when BOTH profile.goals[0] AND profile.desiredRoles[0] are set (later
//     product feedback: showing the builder from just one signal "can
//     confuse the user with the learn anything feature" below it) — see
//     hasGoalAndRole. generateCurriculum is idempotent/first-write-wins
//     server-side, so firing this once per mount the moment we know there's
//     no saved curriculum yet is safe.
//  2. "Learn anything" (teach_me_anything) — a real AI-vetted free-text
//     topic ("a user cannot just be getting certificate on just anyhow
//     topics"), taught across Basic -> Intermediate -> Advanced tiers, each
//     unlocking once the previous tier's modules are genuinely completed.
//     "Start"/"Continue"/"Review" now navigate into the real module-by-
//     module viewer at app/learning/course/[courseId]/page.tsx (mobile:
//     CourseSession.tsx) instead of the old "full course viewer is coming
//     to the web app in a future pass" placeholder — see that route's own
//     header comment for the investigation into why the placeholder existed
//     (a missing web port, NOT a Lovable AI billing outage).
interface Week {
  week: number;
  topic: string;
  level?: string;
  completed?: boolean;
  unlocked?: boolean;
  course_id?: string;
}

interface Curriculum {
  goal: string;
  weeks: Week[];
}

interface ProgressByCourse {
  [courseId: string]: { completed_modules: number; last_module_index: number };
}

interface Certificate {
  code: string;
  topic: string;
  levels_completed?: string[];
}

const LEVEL_LABEL_KEYS: Record<CourseLevel, string> = {
  basic: "basic",
  intermediate: "intermediate",
  advanced: "advanced",
};
const LEVEL_DEFAULTS: Record<CourseLevel, string> = {
  basic: "Basic",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export default function LearningPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { profile, isPremium, loading: authLoading } = useAuth();
  const [curriculum, setCurriculum] = useState<Curriculum | null | undefined>(undefined);
  const [byCourse, setByCourse] = useState<ProgressByCourse>({});
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [goal, setGoal] = useState("");
  const [generating, setGenerating] = useState(false);

  async function load() {
    try {
      const [curr, prog, certs] = await Promise.all([
        apiClient.get<{ curriculum: Curriculum | null }>("/api/v1/learning/curriculum"),
        apiClient.get<{ by_course: ProgressByCourse }>("/api/v1/learning/progress"),
        apiClient.get<{ items: Certificate[] }>("/api/v1/learning/certificates").catch(() => ({ items: [] })),
      ]);
      setCurriculum(curr.curriculum);
      setByCourse(prog.by_course || {});
      setCertificates(certs.items || []);
    } catch (err) {
      setError((err as ApiError).message || t("web:learning.loadFailedDefault", { defaultValue: "Couldn't load your learning progress." }));
      setCurriculum(null);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    // Intentional fetch-on-mount — load() sets state once its async GETs
    // resolve, not synchronously in this effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!goal.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const data = await apiClient.post<Curriculum>("/api/v1/learning/curriculum", { goal: goal.trim() });
      setCurriculum(data);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 402 || apiErr.status === 403) {
        setPremiumRequired(true);
      } else {
        setError(apiErr.message || t("web:learning.buildFailedDefault", { defaultValue: "Couldn't build a curriculum right now." }));
      }
    } finally {
      setGenerating(false);
    }
  }

  // ---------------------------------------------------------------------
  // Auto-generate the curriculum from whatever goal/role the user already
  // gave at signup, instead of always making them retype it here. Fires
  // exactly once per mount, guarded by a ref (not just curriculum state) so
  // a re-render never fires a second background attempt while the first is
  // still in flight — mirrors mobile's hasAutoGeneratedRef.
  // ---------------------------------------------------------------------
  const hasGoalAndRole = !!(profile?.goals?.[0]?.trim() && profile?.desiredRoles?.[0]?.trim());
  const hasAutoGeneratedRef = useRef(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  useEffect(() => {
    if (authLoading || curriculum === undefined || curriculum || hasAutoGeneratedRef.current || !hasGoalAndRole) return;
    const signupGoal = profile?.desiredRoles?.[0]?.trim() || profile?.goals?.[0]?.trim();
    if (!signupGoal) return;
    hasAutoGeneratedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGoal(signupGoal);
    setIsAutoGenerating(true);
    apiClient
      .post<Curriculum>("/api/v1/learning/curriculum", { goal: signupGoal })
      .then((data) => setCurriculum(data))
      .catch((err) => {
        const apiErr = err as ApiError;
        if (apiErr.status === 402 || apiErr.status === 403) setPremiumRequired(true);
        // Otherwise fails open — curriculum stays null and the manual
        // "type your goal" box below becomes the fallback, same as mobile.
      })
      .finally(() => setIsAutoGenerating(false));
  }, [authLoading, curriculum, hasGoalAndRole, profile?.goals, profile?.desiredRoles]);

  const curriculumLoaded = curriculum !== undefined;
  const showCurriculumBuilder = curriculumLoaded && (hasGoalAndRole || !!curriculum);

  // ---------------------------------------------------------------------
  // "Learn anything" — real AI topic validation (POST /api/v1/learning/
  // topic-check) + real tiered progress (GET /api/v1/learning/progress),
  // ported from mobile's teach_me_anything flow. No per-module course
  // viewer exists on web yet (CourseSession.tsx has no web counterpart), so
  // "Start" surfaces the same "full flow coming to web in a future pass"
  // placeholder already used by app/practice/scenarios/page.tsx and
  // app/practice/mock-interviews/page.tsx for the same reason.
  // ---------------------------------------------------------------------
  const [careerPath, setCareerPath] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [isCheckingTopic, setIsCheckingTopic] = useState(false);
  const [topicCheck, setTopicCheck] = useState<TopicCheckResult | null>(null);
  const [tierProgress, setTierProgress] = useState<Record<CourseLevel, CourseProgressSummary> | null>(null);

  const effectiveTopic = careerPath ? (customTopic.trim() ? `${customTopic.trim()} (${careerPath})` : careerPath) : "";

  async function onCheckTopic(e: React.FormEvent) {
    e.preventDefault();
    const topic = effectiveTopic.trim();
    if (!topic || !careerPath || isCheckingTopic) return;
    setIsCheckingTopic(true);
    setTopicCheck(null);
    setTierProgress(null);
    try {
      const result = await checkTopic(topic, i18n.language);
      setTopicCheck(result);
      if (result.valid) {
        const entries = await Promise.all(
          COURSE_LEVELS.map((level) => getCourseProgress(courseIdFor(result.canonicalTopic, level)))
        );
        const progress = {} as Record<CourseLevel, CourseProgressSummary>;
        COURSE_LEVELS.forEach((level, i) => {
          progress[level] = entries[i];
        });
        setTierProgress(progress);
      }
    } finally {
      setIsCheckingTopic(false);
    }
  }

  function isTierUnlocked(level: CourseLevel): boolean {
    const idx = COURSE_LEVELS.indexOf(level);
    if (idx === 0) return true;
    const prevLevel = COURSE_LEVELS[idx - 1];
    const prevCompleted = tierProgress?.[prevLevel]?.completedModules ?? 0;
    return prevCompleted >= MODULES_PER_LEVEL[prevLevel];
  }

  const courseIds = Object.keys(byCourse);

  // Was fully free with no page-level gate at all — mobile's
  // LearningCourses.tsx gates the ENTIRE screen behind Premium, all-or-
  // nothing, before rendering anything else (`if (!isPremium) return
  // <ProLockGate variant="premium" .../>`), but this page never checked
  // isPremium at the page level: only a REACTIVE 402/403 catch on the
  // curriculum-build action (`premiumRequired` above), which left the
  // career-path picker, topic-check, and tier Start/Continue buttons fully
  // usable by a free-plan user. Same lock-screen pattern already
  // established by app/news/page.tsx and app/whats-next/page.tsx (isPremium
  // from useAuth(), checked before any real content renders).
  if (!isPremium) {
    return (
      <RequireAuth>
        <AppShell>
          <div className="mx-auto flex max-w-6xl flex-col gap-6">
            <PageHeader title={t("web:learning.title", { defaultValue: "Learning Courses" })} />
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">
                {t("web:learning.premiumGateTitle", { defaultValue: "Learning Courses" })}
              </h2>
              <p className="text-sm text-hint">
                {t("web:learning.premiumGateDescription", {
                  defaultValue:
                    "AI-taught, module-by-module courses on any career topic, with a badge on completion — Learning Courses is a Premium feature.",
                })}
              </p>
            </div>
          </div>
        </AppShell>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <AppShell>
        <div className="mx-auto flex max-w-6xl flex-col gap-8 pb-10">
          <PageHeader
            title={t("web:learning.title", { defaultValue: "Learning Courses" })}
            subtitle={t("web:learning.subtitle", { defaultValue: "An AI-built, week-by-week curriculum toward your career goal — or teach yourself anything." })}
          />

          {error && <p className="text-sm text-danger">{error}</p>}
          {curriculum === undefined && <SkeletonRows count={4} />}

          {certificates.length > 0 && (
            <div className="rounded-card border border-border bg-surface-2 p-5">
              <h2 className="font-semibold text-primary">{t("web:learning.yourBadges", { defaultValue: "Your Badges" })}</h2>
              <div className="mt-3 flex flex-col gap-3">
                {certificates.map((c) => (
                  <div key={c.code} className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tint-orange text-tint-orange-text">
                      <EvaIcon name="award-outline" size={18} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-primary">{c.topic}</p>
                      <p className="text-xs text-hint">
                        {t("web:learning.badgeTiersCode", { defaultValue: "Basic · Intermediate · Advanced — {{code}}", code: c.code })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {premiumRequired && (
            <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
                <EvaIcon name="lock-outline" size={20} />
              </span>
              <h2 className="font-semibold text-primary">{t("web:learning.premiumRequiredTitle", { defaultValue: "Building a curriculum is a Premium feature" })}</h2>
              <p className="text-sm text-hint">{t("web:learning.premiumRequiredSubtitle", { defaultValue: "Upgrade your plan to generate a guided, multi-week learning plan." })}</p>
            </div>
          )}

          {showCurriculumBuilder && !premiumRequired && (
            <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-primary">{t("web:learning.curriculumBuilderTitle", { defaultValue: "AI Curriculum Builder" })}</h2>
                {curriculum && (
                  <button
                    type="button"
                    onClick={async () => {
                      await apiClient.delete("/api/v1/learning/curriculum").catch(() => {});
                      setCurriculum(null);
                      setGoal("");
                      hasAutoGeneratedRef.current = false;
                    }}
                    className="text-sm font-semibold text-danger"
                  >
                    {t("web:learning.startOver", { defaultValue: "Start over" })}
                  </button>
                )}
              </div>

              {curriculum ? (
                <>
                  <p className="text-sm font-semibold text-primary">{t("web:learning.goalPrefix", { defaultValue: "Goal: {{goal}}", goal: curriculum.goal })}</p>
                  <div className="flex flex-col gap-3">
                    {curriculum.weeks.map((w) => (
                      <div key={w.week} className="flex items-center gap-4 rounded-card border border-border bg-surface-1 p-4">
                        <span
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            w.completed ? "bg-tint-mint text-tint-mint-text" : w.unlocked ? "bg-brand/10 text-brand" : "bg-surface-3 text-hint"
                          }`}
                        >
                          {w.completed ? <EvaIcon name="checkmark-outline" size={16} /> : w.week}
                        </span>
                        <div className="flex-1">
                          <h3 className="font-medium text-primary">{w.topic}</h3>
                          <p className="text-xs text-hint">
                            {t("web:learning.weekLabel", { defaultValue: "Week {{week}}", week: w.week })}
                            {w.level ? ` · ${w.level}` : ""}
                            {!w.unlocked && !w.completed ? ` · ${t("web:learning.locked", { defaultValue: "Locked" })}` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : isAutoGenerating ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                  <p className="text-sm text-hint">
                    {t("web:learning.autoBuilding", { defaultValue: "Building your curriculum from your goal — {{goal}}…", goal })}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleGenerate} className="flex flex-col gap-4">
                  <TextField
                    label={t("web:learning.careerGoalLabel", { defaultValue: "Career goal" })}
                    placeholder={t("web:learning.careerGoalPlaceholder", { defaultValue: "e.g. Become a backend engineer" })}
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    required
                  />
                  <Button type="submit" disabled={generating || !goal.trim()} className="mt-1 w-full">
                    {generating ? t("web:learning.building", { defaultValue: "Building…" }) : t("web:learning.buildCurriculum", { defaultValue: "Build my curriculum" })}
                  </Button>
                </form>
              )}
            </div>
          )}

          {courseIds.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-lg font-bold text-primary">{t("web:learning.courseProgressTitle", { defaultValue: "Course progress" })}</h2>
              {courseIds.map((courseId) => {
                const slugTopic = courseId.split("::")[0].replace(/-/g, " ");
                const displayTopic = slugTopic.replace(/\b\w/g, (c) => c.toUpperCase());
                return (
                  <Link
                    key={courseId}
                    href={`/learning/course/${encodeURIComponent(courseId)}?${new URLSearchParams({ topic: displayTopic }).toString()}`}
                    className="flex items-center justify-between rounded-card border border-border bg-surface-2 p-4 transition hover:bg-surface-3"
                  >
                    <span className="text-sm text-primary capitalize">{slugTopic}</span>
                    <span className="text-xs text-hint">
                      {t("web:learning.modulesCompleted", { defaultValue: "{{count}} module(s) completed", count: byCourse[courseId].completed_modules })}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* "Learn anything" (teach_me_anything) — real AI-vetted free-text
              topic -> tiered Basic/Intermediate/Advanced course. */}
          <div className="flex flex-col gap-4 rounded-card border border-border bg-surface-2 p-6">
            <div>
              <h2 className="font-semibold text-primary">{t("web:learning.teachMeAnything", { defaultValue: "Learn anything" })}</h2>
              <p className="mt-1 text-sm text-hint">
                {t("web:learning.teachMeAnythingDescription", {
                  defaultValue: "Pick a career path, and optionally a specific topic under it — the AI checks it, then builds a real Basic → Intermediate → Advanced course, with a badge when you finish all three.",
                })}
              </p>
            </div>

            <form onSubmit={onCheckTopic} className="flex flex-col gap-4">
              <SelectField
                label={t("web:learning.careerPathLabel", { defaultValue: "Career path" })}
                value={careerPath}
                onChange={(e) => {
                  setCareerPath(e.target.value);
                  setTopicCheck(null);
                  setTierProgress(null);
                }}
                required
              >
                <option value="">{t("web:learning.careerPathPlaceholder", { defaultValue: "Select a career path" })}</option>
                {CAREER_PATHS.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </SelectField>
              <TextField
                label={t("web:learning.specificTopicLabel", { defaultValue: "Specific topic (optional)" })}
                placeholder={t("web:learning.customTopicPlaceholder", { defaultValue: "e.g. Roadmapping, Salary Negotiation" })}
                value={customTopic}
                onChange={(e) => {
                  setCustomTopic(e.target.value);
                  setTopicCheck(null);
                }}
              />
              <Button type="submit" disabled={!careerPath || isCheckingTopic} className="w-full">
                {isCheckingTopic ? t("web:learning.checkingTopic", { defaultValue: "Checking…" }) : t("web:learning.checkTopic", { defaultValue: "Check topic" })}
              </Button>
            </form>

            {topicCheck && !topicCheck.valid && (
              <div className="rounded-lg bg-tint-orange p-3">
                <p className="text-sm text-warning-text">
                  {topicCheck.reason ||
                    t("web:learning.topicRejectedGeneric", {
                      defaultValue: "That doesn't look like a specific professional or career skill yet — try something more concrete.",
                    })}
                </p>
              </div>
            )}

            {topicCheck?.valid && (
              <div className="flex flex-col gap-3">
                <div>
                  <h3 className="font-semibold text-primary">{topicCheck.canonicalTopic}</h3>
                  {topicCheck.coreSubtopics.length > 0 && (
                    <p className="mt-1 text-xs text-hint">
                      {t("web:learning.coversSubtopics", {
                        defaultValue: "Covers: {{subtopics}}",
                        subtopics: topicCheck.coreSubtopics.slice(0, 4).join(", "),
                      })}
                      {topicCheck.coreSubtopics.length > 4 ? "…" : ""}
                    </p>
                  )}
                </div>

                {COURSE_LEVELS.map((level) => {
                  const unlocked = isTierUnlocked(level);
                  const total = MODULES_PER_LEVEL[level];
                  const completed = tierProgress?.[level]?.completedModules ?? 0;
                  const isTierComplete = completed >= total;
                  return (
                    <div key={level} className="flex items-center gap-4 rounded-card border border-border bg-surface-1 p-4">
                      <span
                        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          isTierComplete ? "bg-tint-mint text-tint-mint-text" : unlocked ? "bg-brand/10 text-brand" : "bg-surface-3 text-hint"
                        }`}
                      >
                        <EvaIcon name={isTierComplete ? "checkmark-outline" : unlocked ? "book-open-outline" : "lock-outline"} size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-primary">
                          {t(`web:learning.levels.${LEVEL_LABEL_KEYS[level]}`, { defaultValue: LEVEL_DEFAULTS[level] })}
                        </p>
                        <p className="text-xs text-hint">
                          {isTierComplete
                            ? t("web:learning.completed", { defaultValue: "Completed" })
                            : t("web:learning.modulesProgress", { defaultValue: "{{completed}}/{{total}} modules", completed, total })}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={unlocked ? "primary" : "outline"}
                        disabled={!unlocked}
                        onClick={() => {
                          if (!unlocked || !topicCheck) return;
                          const courseId = courseIdFor(topicCheck.canonicalTopic, level);
                          const subtopics = topicCheck.coreSubtopics.join("|");
                          const qs = new URLSearchParams({ topic: topicCheck.canonicalTopic });
                          if (subtopics) qs.set("subtopics", subtopics);
                          router.push(`/learning/course/${encodeURIComponent(courseId)}?${qs.toString()}`);
                        }}
                      >
                        {!unlocked
                          ? t("web:learning.locked", { defaultValue: "Locked" })
                          : isTierComplete
                          ? t("web:learning.review", { defaultValue: "Review" })
                          : completed > 0
                          ? t("web:learning.continue", { defaultValue: "Continue" })
                          : t("web:learning.start", { defaultValue: "Start" })}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Course catalog — web port of the pre-built catalog DATA_COURSES
              from mobile's constants/Data.ts, rendered as a third section
              below "AI Curriculum Builder" and "Learn Anything" (mobile:
              LearningCourses.tsx lines ~763-818). Was completely missing on
              web, so there was no entry point into the module-by-module
              viewer besides the free-text "Learn Anything" flow. No section
              header here, matching mobile — DATA_COURSES.map() sits directly
              below the "Learn anything" card with nothing introducing it.
              Progress is real (GET /api/v1/learning/progress's by_course,
              already fetched above into `byCourse`), computed the same way
              as mobile's catalogProgress() — courseIdFor(title, "basic") —
              not a static mock number. */}
          <div className="flex flex-col gap-3">
            {DATA_COURSES.map((course) => {
              const catalogCourseId = courseIdFor(course.title, "basic");
              const completedModules = byCourse[catalogCourseId]?.completed_modules ?? 0;
              const totalModules = course.totalModules;
              const progressPct = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
              const isCourseComplete = completedModules >= totalModules;
              return (
                <div key={course.id} className="rounded-card border border-border bg-surface-2 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center rounded-pill bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                      {course.category}
                    </span>
                    <span className="text-xs text-hint">
                      {t("web:learning.catalog.durationMin", { defaultValue: "{{min}} min", min: course.durationMin })}
                    </span>
                  </div>
                  <h3 className="mt-3 font-semibold text-primary">{course.title}</h3>
                  <p className="mt-1 text-sm text-hint">{course.description}</p>

                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <div
                      className={`h-1.5 rounded-full transition-all ${isCourseComplete ? "bg-success" : "bg-brand"}`}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-hint">
                      {t("web:learning.catalog.modulesCount", {
                        defaultValue: "{{completed}}/{{total}} modules",
                        completed: completedModules,
                        total: totalModules,
                      })}
                    </span>
                    <span className={`text-xs font-semibold ${isCourseComplete ? "text-success" : "text-hint"}`}>
                      {isCourseComplete ? t("web:learning.completed", { defaultValue: "Completed" }) : `${progressPct}%`}
                    </span>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant={isCourseComplete ? "outline" : "primary"}
                    className="mt-4 w-full"
                    onClick={() => {
                      const qs = new URLSearchParams({ topic: course.title });
                      router.push(`/learning/course/${encodeURIComponent(catalogCourseId)}?${qs.toString()}`);
                    }}
                  >
                    {isCourseComplete
                      ? t("web:learning.review", { defaultValue: "Review" })
                      : completedModules > 0
                      ? t("web:learning.continue", { defaultValue: "Continue" })
                      : t("web:learning.start", { defaultValue: "Start" })}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
