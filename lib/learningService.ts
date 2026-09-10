import apiClient from "./apiClient";

// ---------------------------------------------------------------------------
// learningService — web port of the pieces of Saveur/services/learningService.ts
// that back the "Learn Anything" flow on app/learning/page.tsx (mobile:
// src/more/LearningCourses.tsx). Real backend contracts, confirmed against
// Saveur-Backend/app/api/learning.py:
//   POST /api/v1/learning/topic-check -> {valid, canonical_topic, reason?, core_subtopics?}
//   GET  /api/v1/learning/progress?course_id=... -> {by_course: {<course_id>: {completed_modules, last_module_index}}}
// Course-level content generation (POST /api/v1/coach/advice via
// generateModule/generateSyllabus on mobile) isn't ported here — there's no
// per-module course-session viewer on web yet (CourseSession.tsx has no web
// counterpart), so this stays scoped to what app/learning/page.tsx actually
// renders: real AI topic validation + real tier progress.
// ---------------------------------------------------------------------------

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
