import apiClient, { type ApiError } from "./apiClient";

// ---------------------------------------------------------------------------
// learningService — web port of Saveur/services/learningService.ts, backing
// both app/learning/page.tsx (the curriculum/tier overview, mobile:
// LearningCourses.tsx) and app/learning/course/[courseId]/page.tsx (the real
// module-by-module course session, mobile: CourseSession.tsx). Real backend
// contracts, confirmed against Saveur-Backend/app/api/learning.py:
//   POST /api/v1/learning/topic-check    -> {valid, canonical_topic, reason?, core_subtopics?}
//   GET  /api/v1/learning/progress       -> {by_course: {<course_id>: {completed_modules, last_module_index}}}
//   POST /api/v1/learning/progress       -> upserts one module's completion
//   GET  /api/v1/learning/syllabus       -> {titles: string[] | null}  (first-write-wins cache)
//   POST /api/v1/learning/syllabus       -> saves a generated syllabus
//   GET  /api/v1/learning/module-content -> {content: {...} | null}     (first-write-wins cache)
//   POST /api/v1/learning/module-content -> saves a generated module
//   POST /api/v1/learning/certificates/issue -> re-verifies real progress, issues a badge
//   POST /api/v1/learning/visual         -> {image_url} (best-effort illustration)
//   POST /api/v1/coach/advice            -> {reply} (the actual content-generation call —
//     module bodies, syllabus titles, and check-answer feedback are all generated through
//     THIS endpoint, exactly like mobile's coachService.askOneOff, not through a
//     dedicated /learning/module endpoint — see askCoachOneOff below)
// ---------------------------------------------------------------------------

function askCoachOneOff(prompt: string, language?: string): Promise<string> {
  return apiClient
    .post<{ reply?: string; message?: string; text?: string; response?: string }>("/api/v1/coach/advice", {
      question: prompt,
      history: [],
      // Deliberately omitted: persist_to_history — these one-off generation
      // calls (module text, syllabus titles, answer feedback) must never be
      // written into the user's real Coach conversation thread, same
      // reasoning mobile's askOneOff docstring gives.
      language,
    })
    .then((data) => data.reply ?? data.message ?? data.response ?? data.text ?? "");
}

// Same curated career-path list as mobile's CAREER_PATHS — a fixed list
// since the picker needs a finite dropdown, not a type-anything box (the
// specific-topic field right below it is still free text).
export const CAREER_PATHS: string[] = [
  "Software Engineering",
  "Product Management",
  "Data Science & Analytics",
  "UX/UI Design",
  "Digital Marketing",
  "Sales & Business Development",
  "Finance & Accounting",
  "Human Resources",
  "Project Management",
  "Customer Success & Support",
  "Operations & Supply Chain",
  "Business Analysis",
  "Cybersecurity",
  "Cloud & DevOps",
  "Legal & Compliance",
  "Healthcare & Life Sciences",
  "Education & Training",
  "Consulting & Strategy",
  "Entrepreneurship & Startups",
  "Other / General Career Skills",
];

export type CourseLevel = "basic" | "intermediate" | "advanced";
export const COURSE_LEVELS: CourseLevel[] = ["basic", "intermediate", "advanced"];
export const MODULES_PER_LEVEL: Record<CourseLevel, number> = {
  basic: 4,
  intermediate: 5,
  advanced: 6,
};

export function slugifyTopic(topic: string): string {
  return (
    topic
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-+|-+$)/g, "") || "topic"
  );
}

export function courseIdFor(topic: string, level: CourseLevel): string {
  return `${slugifyTopic(topic)}::${level}`;
}

export interface TopicCheckResult {
  valid: boolean;
  canonicalTopic: string;
  reason?: string;
  coreSubtopics: string[];
}

/**
 * POST /api/v1/learning/topic-check — real AI judgment call on whether a
 * typed "Learn Anything" topic is a coherent professional/career skill area
 * worth building a certificate-bearing course around ("a user cannot just
 * be getting certificate on just anyhow topics" — product direction). Fails
 * open (treats the topic as valid, no subtopic guidance) on any error, same
 * as mobile's checkTopic, so a transient hiccup never blocks a legitimate
 * topic.
 */
export async function checkTopic(topic: string, language?: string): Promise<TopicCheckResult> {
  try {
    const data = await apiClient.post<{
      valid?: boolean;
      canonical_topic?: string;
      reason?: string;
      core_subtopics?: string[];
    }>("/api/v1/learning/topic-check", { topic, language });
    return {
      valid: data.valid ?? true,
      canonicalTopic: data.canonical_topic ?? topic,
      reason: data.reason,
      coreSubtopics: data.core_subtopics ?? [],
    };
  } catch {
    return { valid: true, canonicalTopic: topic, coreSubtopics: [] };
  }
}

export interface CourseProgressSummary {
  completedModules: number;
  lastModuleIndex: number;
}

/** GET /api/v1/learning/progress?course_id=... — resumed progress for one
 * tier's course_id (`<topic-slug>::<level>`). */
export async function getCourseProgress(courseId: string): Promise<CourseProgressSummary> {
  try {
    const data = await apiClient.get<{
      by_course?: Record<string, { completed_modules?: number; last_module_index?: number }>;
    }>("/api/v1/learning/progress", { params: { course_id: courseId } });
    const entry = data.by_course?.[courseId];
    return {
      completedModules: entry?.completed_modules ?? 0,
      lastModuleIndex: entry?.last_module_index ?? 0,
    };
  } catch {
    return { completedModules: 0, lastModuleIndex: 0 };
  }
}

/**
 * POST /api/v1/learning/progress — marks a module completed as the learner
 * finishes it. Best-effort, same tolerance as mobile's markModuleProgress: a
 * save hiccup shouldn't block moving to the next module, but that module
 * then won't count toward resume or certificate eligibility until it's
 * successfully recorded.
 */
export async function markModuleProgress(courseId: string, moduleIndex: number, completed = true): Promise<void> {
  try {
    await apiClient.post("/api/v1/learning/progress", { course_id: courseId, module_index: moduleIndex, completed });
  } catch {
    // best-effort
  }
}

export interface CourseModule {
  index: number;
  title: string;
  body: string;
  checkQuestion?: string;
}

/**
 * GET /api/v1/learning/syllabus?course_id=... — the syllabus already saved
 * for this (user, course, language), if any. Checked before generateSyllabus
 * so re-opening or reviewing a course always shows the same module list it
 * started with, instead of regenerating fresh titles via AI on every visit.
 */
export async function getSavedSyllabus(courseId: string, language?: string): Promise<string[] | null> {
  try {
    const data = await apiClient.get<{ titles?: string[] | null }>("/api/v1/learning/syllabus", {
      params: { course_id: courseId, language },
    });
    return data.titles && data.titles.length ? data.titles : null;
  } catch {
    return null;
  }
}

/** POST /api/v1/learning/syllabus — first-write-wins server-side, so calling
 * this redundantly is always safe. */
export async function saveSyllabus(courseId: string, titles: string[], language?: string): Promise<void> {
  try {
    await apiClient.post("/api/v1/learning/syllabus", { course_id: courseId, titles, language });
  } catch {
    // best-effort — worst case the syllabus regenerates next visit
  }
}

/**
 * Asks the coach endpoint for a short numbered syllabus, exactly like
 * mobile's generateSyllabus. `coreSubtopics` (from checkTopic) keeps the
 * syllabus grounded in the topic's real professional subject matter rather
 * than the AI free-associating under that name. Falls back to generic
 * "Topic — Part N" titles on any failure or a short/malformed reply — never
 * blocks starting the course over a syllabus-naming hiccup.
 */
export async function generateSyllabus(
  topic: string,
  totalModules: number,
  level: CourseLevel = "basic",
  coreSubtopics: string[] = [],
  language?: string
): Promise<string[]> {
  const fallback = Array.from({ length: totalModules }, (_, i) => `${topic} — Part ${i + 1}`);
  const levelDescription =
    level === "basic"
      ? "foundational, beginner-level"
      : level === "intermediate"
      ? "practical, intermediate-level"
      : "in-depth, advanced/expert-level";
  const subtopicsHint = coreSubtopics.length
    ? ` Ground the modules specifically in these real professional subtopics of "${topic}": ${coreSubtopics.join(", ")}.`
    : "";
  try {
    const prompt =
      `Create a numbered list of exactly ${totalModules} short module titles (3-6 words each) ` +
      `for a ${levelDescription} course teaching "${topic}" as a real professional/career skill.` +
      subtopicsHint +
      ` Reply with ONLY the numbered list, one title per line, no other commentary.`;
    const reply = await askCoachOneOff(prompt, language);
    const lines = reply
      .split("\n")
      .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
      .filter(Boolean);
    if (lines.length >= totalModules) return lines.slice(0, totalModules);
    return lines.length ? [...lines, ...fallback.slice(lines.length)] : fallback;
  } catch {
    return fallback;
  }
}

/**
 * GET /api/v1/learning/module-content — the already-generated content for
 * this module, if any. Checked before generateModule so a module already
 * taught to this learner always shows the exact content (and check-question)
 * they originally saw and answered against — never a freshly regenerated
 * variant, even via Previous or re-opening a completed course.
 */
export async function getSavedModuleContent(
  courseId: string,
  moduleIndex: number,
  language?: string
): Promise<{ module: CourseModule; imageUrl: string | null } | null> {
  try {
    const data = await apiClient.get<{
      content?: { title: string; body: string; check_question?: string | null; image_url?: string | null } | null;
    }>("/api/v1/learning/module-content", {
      params: { course_id: courseId, module_index: String(moduleIndex), language },
    });
    if (!data.content) return null;
    return {
      module: {
        index: moduleIndex,
        title: data.content.title,
        body: data.content.body,
        checkQuestion: data.content.check_question ?? undefined,
      },
      imageUrl: data.content.image_url ?? null,
    };
  } catch {
    return null;
  }
}

/** POST /api/v1/learning/module-content — first-write-wins server-side, same
 * as saveSyllabus above. */
export async function saveModuleContent(
  courseId: string,
  moduleIndex: number,
  mod: CourseModule,
  imageUrl?: string | null,
  language?: string
): Promise<void> {
  try {
    await apiClient.post("/api/v1/learning/module-content", {
      course_id: courseId,
      module_index: moduleIndex,
      title: mod.title,
      body: mod.body,
      check_question: mod.checkQuestion ?? null,
      image_url: imageUrl ?? null,
      language,
    });
  } catch {
    // best-effort — worst case this module regenerates next visit
  }
}

/**
 * Generates one module's actual teaching content through the real AI coach
 * endpoint — the AI acting as instructor, not just answering a question.
 * Mirrors mobile's generateModule exactly (same prompt shape), including the
 * "last line ending in '?' becomes the check-understanding question"
 * parsing convention.
 *
 * Unlike every other function in this file, this one does NOT swallow
 * errors — a failure here (most commonly a 503 `llm_unavailable` from the
 * upstream Lovable/OpenAI provider being out of quota or mid-billing-issue,
 * see Saveur-Backend/app/__init__.py's LLMUnavailable handler) must reach
 * the caller so the module viewer can show an honest "couldn't generate this
 * lesson, try again" error state instead of silently failing or faking a
 * placeholder success.
 */
export async function generateModule(
  topic: string,
  moduleIndex: number,
  totalModules: number,
  moduleTitle: string,
  level: CourseLevel = "basic",
  language?: string
): Promise<CourseModule> {
  const depthHint =
    level === "basic"
      ? "Assume no prior background — build fundamentals clearly."
      : level === "intermediate"
      ? "Assume the learner already knows the basics — go beyond definitions into real practical application."
      : "Assume solid working knowledge already — go deep into expert-level nuance, trade-offs, and real-world edge cases professionals actually deal with.";
  const prompt =
    `You are an expert instructor teaching a structured ${level}-level course on "${topic}". This ` +
    `is module ${moduleIndex + 1} of ${totalModules}, titled "${moduleTitle}". ${depthHint} Teach ` +
    `this module clearly and step by step, assuming the student already completed the earlier ` +
    `modules but nothing after this one. Include one concrete, worked example (real code if the ` +
    `topic is technical/coding). End with exactly one short check-for-understanding question on ` +
    `its own final line. Keep the whole response focused and roughly 150-250 words, formatted as ` +
    `plain paragraphs (no numbered module headers, since the app already shows those separately).`;

  const reply = await askCoachOneOff(prompt, language);
  const lines = reply
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  let checkQuestion: string | undefined;
  let bodyLines = lines;
  if (lines.length > 1 && lines[lines.length - 1].endsWith("?")) {
    checkQuestion = lines[lines.length - 1];
    bodyLines = lines.slice(0, -1);
  }

  return {
    index: moduleIndex,
    title: moduleTitle,
    body: bodyLines.join("\n\n") || reply,
    checkQuestion,
  };
}

/**
 * Real interactivity for the module's check-for-understanding question — the
 * learner types an answer, this asks the coach endpoint for brief feedback
 * on it. Falls back to a plain acknowledgment on failure (unlike
 * generateModule above), since a feedback hiccup shouldn't block moving to
 * the next module the way a missing lesson body would.
 */
export async function getAnswerFeedback(
  topic: string,
  checkQuestion: string,
  answer: string,
  language?: string
): Promise<string> {
  try {
    const prompt =
      `You're teaching a course on "${topic}". You asked the student: "${checkQuestion}". ` +
      `Their answer: "${answer}". In 2-3 sentences, tell them whether they've got it, and gently ` +
      `correct anything they got wrong or incomplete. Be encouraging but specific.`;
    const reply = await askCoachOneOff(prompt, language);
    return reply.trim() || "Thanks for answering — let's keep going.";
  } catch {
    return "Thanks for answering — let's keep going.";
  }
}

/**
 * POST /api/v1/learning/visual — a best-effort illustrative image for the
 * module (Lovable AI Gateway or OpenAI direct — see
 * openai_service.generate_image). Returns null on any failure (including a
 * transient provider outage) rather than throwing — the image is a bonus on
 * top of the text lesson, never something the lesson should block on.
 */
export async function generateVisual(prompt: string): Promise<string | null> {
  try {
    const data = await apiClient.post<{ image_url?: string; url?: string }>("/api/v1/learning/visual", { prompt });
    return data.image_url ?? data.url ?? null;
  } catch {
    return null;
  }
}

export interface Certificate {
  topic: string;
  code: string;
  levelsCompleted: CourseLevel[];
  issuedAt: number | null;
}

/**
 * POST /api/v1/learning/certificates/issue — call once the learner finishes
 * the final module of the Advanced tier. The backend independently
 * re-verifies each tier's completion against real CourseProgress rows before
 * issuing anything (see app/api/learning.py's issue_certificate), so this
 * can't be spoofed by calling it early; returns null if a tier genuinely
 * isn't complete yet.
 */
export async function issueCertificateIfEligible(topic: string): Promise<Certificate | null> {
  try {
    const tiers = COURSE_LEVELS.map((level) => ({
      level,
      course_id: courseIdFor(topic, level),
      total_modules: MODULES_PER_LEVEL[level],
    }));
    const data = await apiClient.post<{
      topic?: string;
      code?: string;
      levels_completed?: string[];
      issued_at?: string | null;
      error?: string;
    }>("/api/v1/learning/certificates/issue", { topic, tiers });
    if (!data.code) return null;
    return {
      topic: data.topic ?? topic,
      code: data.code,
      levelsCompleted: (data.levels_completed ?? []) as CourseLevel[],
      issuedAt: data.issued_at ? new Date(data.issued_at).getTime() : null,
    };
  } catch {
    return null;
  }
}

/** True when an ApiError came from the backend's shared LLMUnavailable
 * handler (Saveur-Backend/app/__init__.py) — an upstream AI provider
 * (Lovable AI Gateway by default, or OpenAI direct) rejected the call, most
 * commonly for billing/quota reasons. The handler already scrubs the raw
 * provider error and returns a clean, human-readable `message`, so callers
 * should just display `err.message` rather than inventing their own copy —
 * this helper only exists to let the UI pick a distinct icon/tone for "AI is
 * temporarily unavailable" vs. a generic network/validation error. */
export function isLLMUnavailable(err: unknown): boolean {
  return (err as ApiError | undefined)?.error === "llm_unavailable";
}

// ---------------------------------------------------------------------------
// Recommended Videos — web port of mobile's CourseVideo/getModuleVideos etc.
// (Saveur/services/learningService.ts). Product report: "What about the
// recommended videos in the learning modules. You did not implement that
// too in the web app" — confirmed a genuine gap (this section didn't exist
// on web at all, not a bug): after each module, mobile auto-suggests real
// matching YouTube videos (a real web search server-side, never an
// ungrounded LLM guess — see Saveur-Backend/app/services/
// learning_video_service.py's anti-hallucination gate) and plays them in an
// in-app player. Real backend contract, confirmed against
// Saveur-Backend/app/api/learning.py:
//   POST /api/v1/learning/videos       -> {course_id, module_index, videos: Video[], language}
//   POST /api/v1/learning/videos/watch -> {ok, video}  (telemetry only, never blocks playback)
//   POST /api/v1/learning/videos/save  -> {ok, video}  (bookmark toggle)
// GET /videos/saved and /videos/continue (mobile's Saved Videos list screen
// + Home's Continue-Watching card) are deliberately NOT ported here — this
// pass only covers the specific per-module recommendation feature reported
// missing; a standalone Saved Videos screen doesn't exist on web yet at
// all, same as several other mobile-only screens noted separately.
export interface CourseVideo {
  videoId: string;
  title: string;
  channel: string | null;
  url: string;
  embedUrl: string;
  thumbnailUrl: string;
  isSaved?: boolean;
}

interface CourseVideoWire {
  video_id: string;
  title: string;
  channel: string | null;
  url: string;
  embed_url: string;
  thumbnail_url: string;
  is_saved?: boolean;
}

function fromVideoWire(w: CourseVideoWire): CourseVideo {
  return {
    videoId: w.video_id,
    title: w.title,
    channel: w.channel,
    url: w.url,
    embedUrl: w.embed_url,
    thumbnailUrl: w.thumbnail_url,
    isSaved: w.is_saved,
  };
}

export interface CourseVideoContext {
  topic?: string;
  moduleTitle?: string;
  courseId?: string;
}

/**
 * Get-or-fetch — the first call for a given (course, module, language) runs
 * a real search server-side and caches it; every later call (reopening the
 * module, reviewing a finished course) just returns the same cached list
 * instantly. Returns [] on any failure rather than throwing — a missing
 * videos section is a much smaller loss than breaking the module itself,
 * same tolerance generateVisual above already has.
 */
export async function getModuleVideos(
  courseId: string,
  moduleIndex: number,
  topic: string,
  moduleTitle: string,
  language?: string
): Promise<CourseVideo[]> {
  try {
    const data = await apiClient.post<{ videos?: CourseVideoWire[] }>("/api/v1/learning/videos", {
      course_id: courseId,
      module_index: moduleIndex,
      topic,
      module_title: moduleTitle,
      language,
    });
    return (data.videos ?? []).map(fromVideoWire);
  } catch {
    return [];
  }
}

function videoRequestBody(video: CourseVideo, context?: CourseVideoContext) {
  return {
    video_id: video.videoId,
    title: video.title,
    channel: video.channel,
    url: video.url,
    embed_url: video.embedUrl,
    thumbnail_url: video.thumbnailUrl,
    source: "youtube",
    topic: context?.topic,
    module_title: context?.moduleTitle,
    course_id: context?.courseId,
  };
}

/** Logs that this video was actually opened in the in-app player (product
 * request item, already shipped for mobile: "the AI career coach [should]
 * know the content of every video the user watches"). Fire-and-forget: a
 * failure here should never block or interrupt playback. */
export async function logVideoWatch(video: CourseVideo, context?: CourseVideoContext): Promise<void> {
  try {
    await apiClient.post("/api/v1/learning/videos/watch", videoRequestBody(video, context));
  } catch {
    // best-effort
  }
}

/** Toggles the "Save Video" bookmark. Returns whether the call actually
 * succeeded so the UI can revert an optimistic toggle on failure. */
export async function setVideoSaved(video: CourseVideo, saved: boolean, context?: CourseVideoContext): Promise<boolean> {
  try {
    await apiClient.post("/api/v1/learning/videos/save", { ...videoRequestBody(video, context), saved });
    return true;
  } catch {
    return false;
  }
}
