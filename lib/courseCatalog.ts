// Web port of Saveur (mobile)'s constants/Data.ts DATA_COURSES — a static
// catalog of pre-authored courses rendered as a third section on the
// Learning Courses screen (mobile: src/more/LearningCourses.tsx lines
// ~763-818), below "AI Curriculum Builder" and "Learn Anything". This was
// missing entirely on web, which meant there was no catalog entry point
// into the real module-by-module viewer besides the free-text "Learn
// Anything" flow.
//
// Fields mirror mobile's CourseProps exactly except `completedModules`,
// which was always a stale static mock number on mobile too (see mobile's
// own comment on catalogProgress()) — real per-course progress instead
// comes from GET /api/v1/learning/progress's by_course map, computed the
// same way "Learn Anything" and the curriculum builder already do (see
// courseIdFor in lib/learningService.ts).
export interface CatalogCourse {
  id: string;
  title: string;
  description: string;
  durationMin: number;
  category: "Behavioral" | "Technical" | "Salary Negotiation" | "Resume" | "System Design" | "Networking" | "Onboarding";
  totalModules: number;
}

// Kept as its own export (not just inlined into DATA_COURSES) to mirror
// mobile's NEW_JOB_COURSE_TITLE/NEW_JOB_COURSE_MODULES — same title means
// the same course_id (courseIdFor) and shared progress with any other entry
// point that references this exact course by name.
export const NEW_JOB_COURSE_TITLE = "Starting Your New Job";
export const NEW_JOB_COURSE_MODULES = 5;

export const DATA_COURSES: CatalogCourse[] = [
  {
    id: "course_star",
    title: "Mastering the STAR Method",
    description: "Structure compelling behavioral answers using Situation, Task, Action, Result.",
    durationMin: 35,
    category: "Behavioral",
    totalModules: 5,
  },
  {
    id: "course_system_design",
    title: "System Design Fundamentals",
    description: "Learn the building blocks interviewers expect in a system design round.",
    durationMin: 60,
    category: "System Design",
    totalModules: 6,
  },
  {
    id: "course_salary_negotiation",
    title: "Negotiating Your Offer",
    description: "Practical tactics for negotiating salary, equity, and other perks.",
    durationMin: 25,
    category: "Salary Negotiation",
    totalModules: 4,
  },
  {
    id: "course_resume",
    title: "Resume Writing That Gets Interviews",
    description: "Turn vague bullet points into quantified, ATS-friendly achievements.",
    durationMin: 30,
    category: "Resume",
    totalModules: 5,
  },
  {
    id: "course_algo_patterns",
    title: "Common Coding Interview Patterns",
    description: "Two pointers, sliding window, and other patterns that show up again and again.",
    durationMin: 50,
    category: "Technical",
    totalModules: 6,
  },
  {
    id: "course_networking",
    title: "Networking Without the Cringe",
    description: "How to reach out, follow up, and build a genuine professional network.",
    durationMin: 20,
    category: "Networking",
    totalModules: 3,
  },
  {
    id: "course_executive_presence",
    title: "Executive Presence in Interviews",
    description: "Communicate with clarity and confidence in senior-level interviews.",
    durationMin: 40,
    category: "Behavioral",
    totalModules: 5,
  },
  {
    id: "course_new_job_onboarding",
    title: NEW_JOB_COURSE_TITLE,
    description: "Workplace norms, relating to coworkers, and thriving in your first 90 days on the job.",
    durationMin: 35,
    category: "Onboarding",
    totalModules: NEW_JOB_COURSE_MODULES,
  },
];
