"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AppShell } from "@/components/shell/AppShell";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { Button } from "@/components/ui/Button";
import { EvaIcon } from "@/components/icons/EvaIcon";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { useAuth } from "@/app/providers/AuthProvider";
import { type ApiError } from "@/lib/apiClient";
import {
  COURSE_LEVELS,
  MODULES_PER_LEVEL,
  courseIdFor,
  getCourseProgress,
  markModuleProgress,
  getSavedSyllabus,
  saveSyllabus,
  generateSyllabus,
  getSavedModuleContent,
  saveModuleContent,
  generateModule,
  getAnswerFeedback,
  generateVisual,
  issueCertificateIfEligible,
  isLLMUnavailable,
  getModuleVideos,
  setVideoSaved,
  type CourseLevel,
  type CourseModule,
  type Certificate,
  type CourseVideo,
} from "@/lib/learningService";
import { InAppVideoPlayer } from "@/components/learning/InAppVideoPlayer";

// Real module-by-module course viewer — web port of Saveur/src/more/
// CourseSession.tsx, replacing the "that full course viewer is coming to
// the web app in a future pass" placeholder that used to sit on
// app/learning/page.tsx's tier cards.
//
// Investigation finding (answers "is the placeholder there because of the
// Lovable AI billing issue?"): no. The AI generation path itself
// (POST /api/v1/coach/advice, the exact same endpoint the AI Coach tab
// already uses in production) is fully built and working server-side —
// Saveur-Backend/app/__init__.py already has a dedicated LLMUnavailable
// handler for the Lovable/OpenAI-billing-outage case, returning a clean
// 503 {error: "llm_unavailable", message: "This feature isn't available
// right now..."} instead of ever silently failing. The placeholder existed
// purely because nobody had ported CourseSession.tsx's screen to web yet —
// lib/learningService.ts's old header comment said so explicitly ("no
// per-module course-session viewer on web yet"). This page is that port.
// If a real billing/quota outage DOES happen at runtime, isLLMUnavailable()
// below is what surfaces it honestly instead of masking it.
const LEVEL_LABEL_DEFAULTS: Record<CourseLevel, string> = {
  basic: "Basic",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function CourseSessionInner() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const searchParams = useSearchParams();
  const { loading: authLoading } = useAuth();

  const courseId = decodeURIComponent(params?.courseId ?? "");
  const [slug, levelRaw] = courseId.split("::");
  const level: CourseLevel = (COURSE_LEVELS as string[]).includes(levelRaw) ? (levelRaw as CourseLevel) : "basic";
  const totalModules = MODULES_PER_LEVEL[level];
  const topic = searchParams.get("topic")?.trim() || titleCaseSlug(slug || "topic");
  const coreSubtopics = (searchParams.get("subtopics") || "").split("|").map((s) => s.trim()).filter(Boolean);
  const language = i18n.language;

  const [moduleIndex, setModuleIndex] = useState(0);
  const [hasResumed, setHasResumed] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [syllabus, setSyllabus] = useState<string[] | null>(null);
  const [moduleCache, setModuleCache] = useState<Record<number, CourseModule>>({});
  const [imageCache, setImageCache] = useState<Record<number, string | null>>({});
  const [isLoadingModule, setIsLoadingModule] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorIsLLM, setLoadErrorIsLLM] = useState(false);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [earnedCertificate, setEarnedCertificate] = useState<Certificate | null>(null);

  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isCheckingAnswer, setIsCheckingAnswer] = useState(false);

  // Recommended Videos (product report: "What about the recommended videos
  // in the learning modules. You did not implement that too in the web
  // app") — get-or-fetch per module, mirrors mobile's CourseSession.tsx
  // videosByModule cache exactly. Guarded by the `!== undefined` check
  // (rather than listing videosByModule itself as an effect dependency) so
  // revisiting an already-fetched module via Previous/Next never re-runs
  // the search.
  const [videosByModule, setVideosByModule] = useState<Record<number, CourseVideo[]>>({});
  const [playerVideo, setPlayerVideo] = useState<CourseVideo | null>(null);

  // Resume where the learner left off, same as mobile's CourseSession —
  // reads real GET /api/v1/learning/progress instead of always restarting
  // at module 0.
  useEffect(() => {
    if (authLoading || !courseId) return;
    let cancelled = false;
    getCourseProgress(courseId).then((progress) => {
      if (cancelled) return;
      const resumeIndex = Math.min(progress.lastModuleIndex, Math.max(totalModules - 1, 0));
      if (progress.completedModules > 0 && resumeIndex > 0) {
        setModuleIndex(resumeIndex);
      }
      if (progress.completedModules > 0) {
        setShowIntro(false);
      }
      setHasResumed(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, courseId]);

  // Syllabus — reuse-before-regenerate, same as mobile: first check for one
  // already saved for this (user, course, language); only generate (and
  // save) fresh titles the first time this course is ever opened.
  useEffect(() => {
    if (!hasResumed) return;
    let cancelled = false;
    (async () => {
      const saved = await getSavedSyllabus(courseId, language);
      if (saved) {
        if (!cancelled) setSyllabus(saved);
        return;
      }
      const titles = await generateSyllabus(topic, totalModules, level, coreSubtopics, language);
      if (cancelled) return;
      setSyllabus(titles);
      saveSyllabus(courseId, titles, language);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasResumed, courseId]);

  const loadModule = useCallback(
    async (index: number, titles: string[]) => {
      if (moduleCache[index]) {
        setIsLoadingModule(false);
        return;
      }
      setIsLoadingModule(true);
      setLoadError(null);
      setLoadErrorIsLLM(false);
      try {
        const saved = await getSavedModuleContent(courseId, index, language);
        if (saved) {
          setModuleCache((prev) => ({ ...prev, [index]: saved.module }));
          if (saved.imageUrl) setImageCache((prev) => ({ ...prev, [index]: saved.imageUrl }));
          return;
        }
        const mod = await generateModule(topic, index, totalModules, titles[index], level, language);
        setModuleCache((prev) => ({ ...prev, [index]: mod }));
        // Best-effort, non-blocking illustration — never gates the lesson.
        generateVisual(`${topic}: ${titles[index]}`).then((url) => {
          setImageCache((prev) => ({ ...prev, [index]: url }));
          saveModuleContent(courseId, index, mod, url, language);
        });
      } catch (e) {
        const apiErr = e as ApiError;
        if (apiErr.status === 402 || apiErr.status === 403) {
          setPremiumRequired(true);
        } else if (isLLMUnavailable(apiErr)) {
          setLoadErrorIsLLM(true);
          setLoadError(
            apiErr.message ||
              t("web:learning.session.llmUnavailable", {
                defaultValue: "This feature isn't available right now. Please try again in a few minutes.",
              })
          );
        } else {
          setLoadError(
            apiErr.message || t("web:learning.session.loadErrorDefault", { defaultValue: "Could not load this module." })
          );
        }
      } finally {
        setIsLoadingModule(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topic, totalModules, level, language, courseId, moduleCache]
  );

  useEffect(() => {
    if (!syllabus) return;
    // loadModule's very first statements (setIsLoadingModule/setLoadError)
    // run synchronously, so calling it directly here would flip state in
    // the same tick as this effect — queueMicrotask defers just far enough
    // to satisfy the "don't setState synchronously inside an effect body"
    // rule without introducing any visible delay before the skeleton shows.
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) loadModule(moduleIndex, syllabus);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syllabus, moduleIndex]);

  const currentModule = moduleCache[moduleIndex];
  const currentImage = imageCache[moduleIndex];

  useEffect(() => {
    if (!currentModule || videosByModule[moduleIndex] !== undefined) return;
    getModuleVideos(courseId, moduleIndex, topic, currentModule.title, language).then((videos) => {
      setVideosByModule((prev) => ({ ...prev, [moduleIndex]: videos }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentModule, moduleIndex, courseId, topic]);
  const currentVideos = videosByModule[moduleIndex];

  async function onToggleSaveVideo(video: CourseVideo) {
    const nextSaved = !video.isSaved;
    setVideosByModule((prev) => ({
      ...prev,
      [moduleIndex]: (prev[moduleIndex] ?? []).map((v) => (v.videoId === video.videoId ? { ...v, isSaved: nextSaved } : v)),
    }));
    const ok = await setVideoSaved(video, nextSaved, { topic, moduleTitle: currentModule?.title, courseId });
    if (!ok) {
      // Revert the optimistic toggle on failure.
      setVideosByModule((prev) => ({
        ...prev,
        [moduleIndex]: (prev[moduleIndex] ?? []).map((v) => (v.videoId === video.videoId ? { ...v, isSaved: !nextSaved } : v)),
      }));
    }
  }

  async function onCheckAnswer() {
    if (!answer.trim() || !currentModule?.checkQuestion || isCheckingAnswer) return;
    setIsCheckingAnswer(true);
    try {
      const result = await getAnswerFeedback(topic, currentModule.checkQuestion, answer, language);
      setFeedback(result);
    } finally {
      setIsCheckingAnswer(false);
    }
  }

  function onNext() {
    setAnswer("");
    setFeedback(null);
    markModuleProgress(courseId, moduleIndex, true);
    if (moduleIndex + 1 >= totalModules) {
      setIsComplete(true);
      if (level === "advanced") {
        issueCertificateIfEligible(topic).then((cert) => {
          if (cert) setEarnedCertificate(cert);
        });
      }
    } else {
      setModuleIndex((i) => i + 1);
    }
  }

  function onPrevious() {
    if (moduleIndex === 0) return;
    setAnswer("");
    setFeedback(null);
    setModuleIndex((i) => i - 1);
  }

  const backHref = "/learning";

  if (premiumRequired) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-10">
        <BackLink href={backHref} t={t} />
        <div className="flex flex-col items-start gap-2 rounded-card border border-border bg-surface-2 p-6">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-tint-purple text-tint-purple-text">
            <EvaIcon name="lock-outline" size={20} />
          </span>
          <h1 className="font-semibold text-primary">
            {t("web:learning.session.premiumRequiredTitle", { defaultValue: "Learning Courses is a Premium feature" })}
          </h1>
          <p className="text-sm text-hint">
            {t("web:learning.session.premiumRequiredSubtitle", {
              defaultValue: "Structured, AI-taught courses with badges are part of Pro Premium / Pro Yearly.",
            })}
          </p>
        </div>
      </div>
    );
  }

  if (isComplete) {
    const nextLevelIdx = COURSE_LEVELS.indexOf(level) + 1;
    const nextLevel = COURSE_LEVELS[nextLevelIdx];
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 pb-10 text-center">
        <BackLink href={backHref} t={t} />
        <span className="mt-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-tint-orange text-tint-orange-text">
          <EvaIcon name="award-outline" size={36} />
        </span>
        <h1 className="text-xl font-bold text-primary">
          {t("web:learning.session.tierComplete", {
            defaultValue: "{{level}} Tier Complete!",
            level: t(`web:learning.levels.${level}`, { defaultValue: LEVEL_LABEL_DEFAULTS[level] }),
          })}
        </h1>
        <p className="max-w-sm text-sm text-hint">
          {t("web:learning.session.tierCompleteDescription", {
            defaultValue: "You've finished all {{count}} {{level}} modules of {{topic}}.",
            count: totalModules,
            level: t(`web:learning.levels.${level}`, { defaultValue: LEVEL_LABEL_DEFAULTS[level] }).toLowerCase(),
            topic,
          })}
        </p>

        {earnedCertificate ? (
          <div className="mt-2 w-full rounded-card bg-tint-mint p-5">
            <p className="font-semibold text-tint-mint-text">
              {t("web:learning.session.certificateEarned", { defaultValue: "Badge Earned" })}
            </p>
            <p className="mt-1 text-sm text-hint">
              {t("web:learning.session.certificateSubtitle", {
                defaultValue: "{{topic}} — Basic, Intermediate & Advanced",
                topic,
              })}
            </p>
            <p className="mt-1.5 text-sm text-primary">{earnedCertificate.code}</p>
          </div>
        ) : nextLevel ? (
          <p className="text-sm font-semibold text-brand">
            {t("web:learning.session.nextLevelUnlocked", {
              defaultValue: "{{level}} unlocked!",
              level: t(`web:learning.levels.${nextLevel}`, { defaultValue: LEVEL_LABEL_DEFAULTS[nextLevel] }),
            })}
          </p>
        ) : null}

        {nextLevel ? (
          <Button
            className="mt-2 w-full"
            onClick={() =>
              router.push(
                `/learning/course/${encodeURIComponent(courseIdFor(topic, nextLevel))}?topic=${encodeURIComponent(topic)}`
              )
            }
          >
            {t("web:learning.session.continueNextLevel", {
              defaultValue: "Continue to {{level}}",
              level: t(`web:learning.levels.${nextLevel}`, { defaultValue: LEVEL_LABEL_DEFAULTS[nextLevel] }),
            })}
          </Button>
        ) : (
          <Link
            href={backHref}
            className="mt-2 inline-flex w-full items-center justify-center rounded-pill bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            {earnedCertificate
              ? t("web:learning.session.exploreAnotherTopic", { defaultValue: "Explore Another Topic" })
              : t("web:learning.session.backToCourses", { defaultValue: "Back to Courses" })}
          </Link>
        )}
      </div>
    );
  }

  if (hasResumed && showIntro) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 pb-10">
        <div className="w-full">
          <BackLink href={backHref} t={t} />
        </div>
        <span className="mt-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-brand/10 text-brand">
          <EvaIcon name="book-open-outline" size={32} />
        </span>
        <h1 className="text-xl font-bold text-primary">{topic}</h1>
        <p className="text-sm text-hint">
          {t("web:learning.session.introSubtitle", {
            defaultValue: "{{level}} · {{count}} modules",
            level: t(`web:learning.levels.${level}`, { defaultValue: LEVEL_LABEL_DEFAULTS[level] }),
            count: totalModules,
          })}
        </p>

        {syllabus ? (
          <div className="mt-4 w-full divide-y divide-border rounded-card border border-border bg-surface-2">
            {syllabus.map((title, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-primary">{title}</p>
                  <p className="text-xs text-hint">
                    {t("web:learning.session.moduleLabel", { defaultValue: "Module {{n}}", n: i + 1 })}
                  </p>
                </div>
                <EvaIcon name="chevron-right-outline" size={18} className="shrink-0 text-hint" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex w-full flex-col gap-3">
            {Array.from({ length: totalModules }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-card border border-border bg-surface-2 p-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <SkeletonText width="w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        <Button className="mt-2 w-full" disabled={!syllabus} onClick={() => setShowIntro(false)}>
          {t("web:learning.session.getStarted", { defaultValue: "Get Started" })}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 pb-16">
      <BackLink href={backHref} t={t} />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-hint">
          {t("web:learning.session.moduleProgress", {
            defaultValue: "{{level}} · Module {{current}} of {{total}}",
            level: t(`web:learning.levels.${level}`, { defaultValue: LEVEL_LABEL_DEFAULTS[level] }),
            current: moduleIndex + 1,
            total: totalModules,
          })}
        </p>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-1.5 rounded-full bg-brand transition-all"
          style={{ width: `${Math.round(((moduleIndex + 1) / totalModules) * 100)}%` }}
        />
      </div>

      {isLoadingModule ? (
        <div className="flex flex-col gap-3 py-4">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-40 w-full rounded-card" />
          <SkeletonText width="w-full" />
          <SkeletonText width="w-full" />
          <SkeletonText width="w-5/6" />
          <SkeletonText width="w-full" className="mt-3" />
          <SkeletonText width="w-2/3" />
          <p className="mt-1 text-center text-sm text-hint">
            {t("web:learning.session.writingModule", { defaultValue: "Writing this module…" })}
          </p>
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span
            className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${
              loadErrorIsLLM ? "bg-tint-orange text-tint-orange-text" : "bg-surface-3 text-hint"
            }`}
          >
            <EvaIcon name="alert-circle-outline" size={20} />
          </span>
          <p className="text-sm text-danger">{loadError}</p>
          <button
            type="button"
            className="text-sm font-semibold text-brand"
            onClick={() => syllabus && loadModule(moduleIndex, syllabus)}
          >
            {t("common:try_again", { defaultValue: "Try again" })}
          </button>
        </div>
      ) : currentModule ? (
        <>
          <h2 className="text-lg font-bold text-primary">{currentModule.title}</h2>

          {currentImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentImage} alt="" className="h-44 w-full rounded-card object-cover" />
          ) : null}

          {currentModule.body.split(/\n{2,}/).map((para, i) => (
            <p key={i} className="whitespace-pre-line text-sm leading-relaxed text-primary">
              {para}
            </p>
          ))}

          {currentModule.checkQuestion ? (
            <div className="rounded-card border border-border bg-surface-2 p-4">
              <h3 className="font-semibold text-primary">
                {t("web:learning.session.checkUnderstanding", { defaultValue: "Check your understanding" })}
              </h3>
              <p className="mt-2 text-sm text-hint">{currentModule.checkQuestion}</p>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={t("web:learning.session.answerPlaceholder", { defaultValue: "Type your answer…" }) as string}
                rows={3}
                className="mt-3 w-full rounded-lg border border-border bg-surface-1 p-3 text-sm text-primary outline-none focus:border-brand"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!answer.trim() || isCheckingAnswer}
                onClick={onCheckAnswer}
                className="mt-3"
              >
                {isCheckingAnswer
                  ? t("web:learning.session.checking", { defaultValue: "Checking…" })
                  : t("web:learning.session.checkMyAnswer", { defaultValue: "Check my answer" })}
              </Button>
              {feedback ? <p className="mt-3 text-sm text-success-text">{feedback}</p> : null}
            </div>
          ) : null}

          {currentVideos && currentVideos.length > 0 && (
            <div className="mt-2">
              <h3 className="mb-3 font-semibold text-primary">
                {t("web:learning.session.recommendedVideos", { defaultValue: "Recommended Videos" })}
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {currentVideos.map((video) => (
                  <div key={video.videoId} className="w-56 shrink-0 overflow-hidden rounded-card border border-border bg-surface-2">
                    <button type="button" onClick={() => setPlayerVideo(video)} className="relative block w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={video.thumbnailUrl} alt="" className="h-32 w-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <EvaIcon name="play-circle-outline" size={32} className="text-white drop-shadow" />
                      </span>
                    </button>
                    <div className="flex items-start gap-2 p-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-primary">{video.title}</p>
                        {video.channel && <p className="truncate text-xs text-hint">{video.channel}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleSaveVideo(video)}
                        aria-label={video.isSaved ? "Unsave video" : "Save video"}
                        className={`shrink-0 ${video.isSaved ? "text-warning-text" : "text-hint"}`}
                      >
                        <EvaIcon name="star-outline" size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <Button variant="ghost" disabled={moduleIndex === 0} onClick={onPrevious}>
              {t("web:learning.session.previous", { defaultValue: "Previous" })}
            </Button>
            <Button onClick={onNext}>
              {moduleIndex + 1 >= totalModules
                ? t("web:learning.session.finish", { defaultValue: "Finish" })
                : t("web:learning.session.nextModule", { defaultValue: "Next Module" })}
            </Button>
          </div>
        </>
      ) : null}
      <InAppVideoPlayer
        video={playerVideo}
        context={{ topic, moduleTitle: currentModule?.title, courseId }}
        onClose={() => setPlayerVideo(null)}
      />
    </div>
  );
}

function BackLink({ href, t }: { href: string; t: (key: string, opts?: Record<string, unknown>) => string }) {
  return (
    <Link href={href} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-hint hover:text-primary">
      <EvaIcon name="chevron-left-outline" size={16} />
      {t("web:learning.session.back", { defaultValue: "Back to Learning" })}
    </Link>
  );
}

export default function CourseSessionPage() {
  return (
    <RequireAuth>
      <AppShell>
        <Suspense fallback={<div className="mx-auto max-w-6xl py-10 text-sm text-hint">Loading…</div>}>
          <CourseSessionInner />
        </Suspense>
      </AppShell>
    </RequireAuth>
  );
}
