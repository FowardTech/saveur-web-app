import { courseIdFor } from "./learningService";
import { NEW_JOB_COURSE_TITLE, NEW_JOB_COURSE_MODULES } from "./courseCatalog";
import { hasAddon, ADDON_CODES } from "./billingService";

// Web port of Saveur/services/suggestedActions.ts — the AI Coach's
// SUGGESTED_ACTION marker (Saveur-Backend/app/api/coach.py) tells the client
// which of ~40 screens it thinks the user should go to next; this is the
// single source of truth for what each id actually opens on web.
//
// Product report: "The AI career coach navigating to screens is not working
// on web." Root cause: app/ai-coach/page.tsx only ever read
// `suggested_course` off the advice response (rendering it as a plain,
// non-clickable <span>) and silently DISCARDED `suggested_action` entirely
// — the field was never even read into state, let alone wired to a chip or
// a navigation call. This file + the ai-coach page changes that use it are
// the actual fix, not a backend bug — the backend was already sending
// suggested_action correctly the whole time.
//
// A handful of mobile's ~44 ids have no web page to land on at all yet
// (faq, policy, about, saved_videos, weekly_career_report, emotional_coach,
// student_verification, my_ratings, career_goal) — SCREEN_MAP simply omits
// them, same as mobile's own `if (!entry) return;` for a genuinely-unmapped
// id, so the coach just won't offer a chip for those rather than linking
// somewhere wrong. Nothing here pretends a page exists that doesn't.

export type SuggestedActionId =
  | "mock_interview"
  | "daily_challenge"
  | "new_job_course"
  | "networking_assistant"
  | "continue_learning"
  | "application_tracker"
  | "career_goal"
  | "job_preferences"
  | "my_progress"
  | "goals_hub"
  | "leaderboard"
  | "faq"
  | "policy"
  | "about"
  | "resume_builder"
  | "my_documents"
  | "jd_analyzer"
  | "saved_videos"
  | "weekly_career_report"
  | "daily_industry_news"
  | "resume_variants"
  | "generated_documents"
  | "linkedin_optimizer"
  | "emotional_coach"
  | "company_intelligence"
  | "student_verification"
  | "salary_negotiation"
  | "system_design_whiteboard"
  | "learning_courses"
  | "career_diary"
  | "my_ratings"
  | "career_roadmap"
  | "career_dna"
  | "dream_companies"
  | "practical_scenarios"
  | "referral_program"
  | "security_settings"
  | "job_alerts"
  | "subscription"
  | "payment_history"
  | "shared_with_me"
  | "schedule_interview"
  | "cover_letter_generator"
  | "coding_practice"
  | "addons"
  | "career_events";

interface ActionMeta {
  title: string;
  icon: string;
}

// Title/icon only for ids this file can actually navigate to (SCREEN_MAP
// below, plus the 5 special-cased ids handled in runSuggestedAction) — an
// id with no real destination has nothing to show a title for either.
export const ACTION_META: Partial<Record<SuggestedActionId, ActionMeta>> = {
  mock_interview: { title: "a Mock Interview", icon: "mic-outline" },
  daily_challenge: { title: "today's Daily Challenge", icon: "flash-outline" },
  new_job_course: { title: "the Starting Your New Job course", icon: "briefcase-outline" },
  networking_assistant: { title: "the Networking Assistant", icon: "people-outline" },
  continue_learning: { title: "where you left off learning", icon: "play-circle-outline" },
  application_tracker: { title: "your Application Tracker", icon: "briefcase-outline" },
  job_preferences: { title: "your Job Preferences", icon: "options-2-outline" },
  my_progress: { title: "your Progress", icon: "trending-up-outline" },
  goals_hub: { title: "your Goals", icon: "flag-outline" },
  leaderboard: { title: "the Leaderboard", icon: "award-outline" },
  resume_builder: { title: "the Resume Builder", icon: "file-text-outline" },
  my_documents: { title: "My Documents", icon: "folder-outline" },
  jd_analyzer: { title: "the JD Analyzer", icon: "search-outline" },
  daily_industry_news: { title: "Today's Industry News", icon: "globe-2-outline" },
  resume_variants: { title: "your Resume Evolution", icon: "file-text-outline" },
  generated_documents: { title: "your Generated Documents", icon: "download-outline" },
  linkedin_optimizer: { title: "the LinkedIn Optimizer", icon: "linkedin-outline" },
  company_intelligence: { title: "Company Intelligence", icon: "briefcase-outline" },
  salary_negotiation: { title: "Salary Negotiation practice", icon: "trending-up-outline" },
  system_design_whiteboard: { title: "System Design Practice", icon: "grid-outline" },
  learning_courses: { title: "Learning Courses", icon: "book-open-outline" },
  career_diary: { title: "your Career Diary", icon: "edit-2-outline" },
  career_roadmap: { title: "your Career Roadmap", icon: "map-outline" },
  career_dna: { title: "your Career DNA", icon: "activity-outline" },
  dream_companies: { title: "your Dream Companies", icon: "star-outline" },
  practical_scenarios: { title: "a Practical Scenario", icon: "layers-outline" },
  referral_program: { title: "the Referral Program", icon: "gift-outline" },
  security_settings: { title: "Security Settings", icon: "shield-outline" },
  job_alerts: { title: "your Job Alerts", icon: "bell-outline" },
  subscription: { title: "your Subscription", icon: "credit-card-outline" },
  payment_history: { title: "your Payment History", icon: "credit-card-outline" },
  shared_with_me: { title: "Shared With Me", icon: "share-outline" },
  schedule_interview: { title: "Schedule an Interview", icon: "calendar-outline" },
  cover_letter_generator: { title: "the Cover Letter Generator", icon: "file-text-outline" },
  coding_practice: { title: "Coding Practice", icon: "code-outline" },
  addons: { title: "the Add-ons screen", icon: "star-outline" },
  career_events: { title: "Career Events", icon: "calendar-outline" },
};

export function actionTitle(id: SuggestedActionId): string {
  return ACTION_META[id]?.title ?? id;
}

// Plain single-route destinations — the vast majority of the list.
const SCREEN_MAP: Partial<Record<SuggestedActionId, string>> = {
  mock_interview: "/practice/mock-interviews",
  daily_challenge: "/progress",
  networking_assistant: "/career/networking",
  job_preferences: "/settings/profile",
  my_progress: "/progress",
  goals_hub: "/goals",
  leaderboard: "/progress/leaderboard",
  resume_builder: "/resume/builder",
  my_documents: "/documents",
  jd_analyzer: "/jd-analyzer",
  daily_industry_news: "/news",
  resume_variants: "/resume/variants",
  generated_documents: "/documents/generated",
  linkedin_optimizer: "/resume/linkedin",
  company_intelligence: "/career/company-intelligence",
  salary_negotiation: "/career/salary-negotiation",
  learning_courses: "/learning",
  career_diary: "/career-diary",
  career_roadmap: "/career/roadmap",
  career_dna: "/career/dna",
  dream_companies: "/career/dream-companies",
  practical_scenarios: "/practice/scenarios",
  referral_program: "/referral",
  security_settings: "/settings/security",
  job_alerts: "/job-alerts",
  subscription: "/subscription",
  payment_history: "/settings/payment",
  shared_with_me: "/shared-with-me",
  schedule_interview: "/practice/schedule",
  cover_letter_generator: "/resume/cover-letter",
  addons: "/addons",
  application_tracker: "/applications",
  // No standalone whiteboard tool on web (System Design is a plain
  // interview type now, same as mobile's own comment on why this isn't
  // add-on gated) — lands on the Practice hub, which already knows how to
  // start one, same fallback reasoning as mobile's own dispatcher.
  system_design_whiteboard: "/practice",
  // Web has its own dedicated Career Events page (mobile folds this into
  // the top of NetworkingAssistant instead, since it never got one) — a
  // more precise destination than mobile's own fallback here.
  career_events: "/career/events",
};

interface Router {
  push: (href: string) => void;
}

/**
 * Actually performs the navigation for a SUGGESTED_ACTION id — mirrors
 * mobile's runSuggestedAction 1:1, including its two async special cases
 * (continue_learning, coding_practice's add-on gate). `router` just needs a
 * `push(href)` — pass the App Router's `useRouter()` return value.
 */
export async function runSuggestedAction(id: SuggestedActionId, router: Router): Promise<void> {
  if (id === "new_job_course") {
    const courseId = courseIdFor(NEW_JOB_COURSE_TITLE, "basic");
    const qs = new URLSearchParams({ topic: NEW_JOB_COURSE_TITLE, totalModules: String(NEW_JOB_COURSE_MODULES) });
    router.push(`/learning/course/${encodeURIComponent(courseId)}?${qs.toString()}`);
    return;
  }

  if (id === "continue_learning") {
    // Web doesn't yet port mobile's deriveContinueCourse/getContinueVideo
    // "what's actually in progress right now" lookup — the course catalog
    // itself (which already shows real per-course progress, see
    // app/learning/page.tsx) is still a reasonable, honest landing spot
    // rather than guessing, same as mobile's own final fallback when
    // nothing is genuinely in progress.
    router.push("/learning");
    return;
  }

  if (id === "coding_practice") {
    const owned = await hasAddon(ADDON_CODES.codingPractice).catch(() => false);
    router.push(owned ? "/practice/coding" : "/addons");
    return;
  }

  const path = SCREEN_MAP[id];
  if (!path) return;
  router.push(path);
}
