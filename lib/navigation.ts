import type { EvaIconName } from "@/components/icons/EvaIcon";

export interface NavLeaf {
  label: string;
  /** i18next key under the `common:nav` namespace — `label` above is always
   * passed as the `defaultValue`, so English is unaffected if a locale is
   * ever missing this key. */
  labelKey?: string;
  href: string;
  icon: EvaIconName;
  description?: string;
  descriptionKey?: string;
}

export interface NavGroup {
  label: string;
  labelKey?: string;
  icon: EvaIconName;
  children: NavLeaf[];
}

export type NavItem = NavLeaf | NavGroup;

export function isNavGroup(item: NavItem): item is NavGroup {
  return "children" in item;
}

// Sidebar primary sections — mirrors the mobile app's drawer taxonomy.
export const primaryNav: NavItem[] = [
  { label: "Home", labelKey: "home", href: "/dashboard", icon: "home-outline" },
  { label: "AI Coach", labelKey: "aiCoach", href: "/ai-coach", icon: "message-circle-outline" },
  {
    label: "Practice",
    labelKey: "practice",
    icon: "clipboard-outline",
    children: [
      { label: "Mock Interviews", labelKey: "mockInterviews", href: "/practice/mock-interviews", icon: "mic-outline" },
      { label: "Coding Practice", labelKey: "codingPractice", href: "/practice/coding", icon: "code-outline" },
      { label: "Practical Scenarios", labelKey: "practicalScenarios", href: "/practice/scenarios", icon: "clipboard-outline" },
    ],
  },
  {
    label: "Career Tools",
    labelKey: "careerTools",
    icon: "compass-outline",
    children: [
      { label: "Career Roadmap", labelKey: "careerRoadmap", href: "/career/roadmap", icon: "compass-outline" },
      { label: "Career DNA", labelKey: "careerDna", href: "/career/dna", icon: "activity-outline" },
      { label: "Networking Assistant", labelKey: "networkingAssistant", href: "/career/networking", icon: "people-outline" },
      { label: "Dream Companies", labelKey: "dreamCompanies", href: "/career/dream-companies", icon: "star-outline" },
      { label: "Company Intelligence", labelKey: "companyIntelligence", href: "/career/company-intelligence", icon: "search-outline" },
      { label: "Salary Negotiation", labelKey: "salaryNegotiation", href: "/career/salary-negotiation", icon: "bar-chart-2-outline" },
    ],
  },
  {
    label: "Resume Tools",
    labelKey: "resumeTools",
    icon: "file-text-outline",
    children: [
      { label: "Resume Builder", labelKey: "resumeBuilder", href: "/resume/builder", icon: "edit-2-outline" },
      { label: "Cover Letter Generator", labelKey: "coverLetterGenerator", href: "/resume/cover-letter", icon: "file-text-outline" },
      { label: "LinkedIn Optimizer", labelKey: "linkedinOptimizer", href: "/resume/linkedin", icon: "linkedin-outline" },
      { label: "Resume Variants", labelKey: "resumeVariants", href: "/resume/variants", icon: "layers-outline" },
    ],
  },
  { label: "Learning Courses", labelKey: "learningCourses", href: "/learning", icon: "book-open-outline" },
  { label: "Job Alerts", labelKey: "jobAlerts", href: "/job-alerts", icon: "briefcase-outline" },
];

// Sidebar secondary / bottom section.
export const secondaryNav: NavLeaf[] = [
  { label: "Referral Program", labelKey: "referralProgram", href: "/referral", icon: "gift-outline" },
  { label: "Subscription", labelKey: "subscription", href: "/subscription", icon: "credit-card-outline" },
  { label: "Settings", labelKey: "settings", href: "/settings", icon: "settings-2-outline" },
  { label: "Live Support", labelKey: "liveSupport", href: "/support", icon: "headphones-outline" },
];

// Quick-action cards shown on the dashboard — a flattened, curated subset of
// the nav above, matching mobile Home's ActionCard grid.
export const quickActions: NavLeaf[] = [
  {
    label: "Mock Interview",
    labelKey: "mockInterviews",
    href: "/practice/mock-interviews",
    icon: "mic-outline",
    description: "Practice live with an AI interviewer",
    descriptionKey: "web:dashboard.quickActions.mockInterview",
  },
  {
    label: "Coding Practice",
    labelKey: "codingPractice",
    href: "/practice/coding",
    icon: "code-outline",
    description: "Sharpen your technical skills",
    descriptionKey: "web:dashboard.quickActions.codingPractice",
  },
  {
    label: "Practical Scenarios",
    labelKey: "practicalScenarios",
    href: "/practice/scenarios",
    icon: "clipboard-outline",
    description: "Work through real on-the-job situations",
    descriptionKey: "web:dashboard.quickActions.practicalScenarios",
  },
  {
    label: "Resume Builder",
    labelKey: "resumeBuilder",
    href: "/resume/builder",
    icon: "edit-2-outline",
    description: "Build an ATS-friendly resume",
    descriptionKey: "web:dashboard.quickActions.resumeBuilder",
  },
  {
    label: "Career Roadmap",
    labelKey: "careerRoadmap",
    href: "/career/roadmap",
    icon: "compass-outline",
    description: "See your personalized path forward",
    descriptionKey: "web:dashboard.quickActions.careerRoadmap",
  },
  {
    label: "Learning Courses",
    labelKey: "learningCourses",
    href: "/learning",
    icon: "book-open-outline",
    description: "Level up with guided courses",
    descriptionKey: "web:dashboard.quickActions.learningCourses",
  },
  {
    label: "Job Alerts",
    labelKey: "jobAlerts",
    href: "/job-alerts",
    icon: "briefcase-outline",
    description: "Get matched to new openings daily",
    descriptionKey: "web:dashboard.quickActions.jobAlerts",
  },
  {
    label: "AI Coach",
    labelKey: "aiCoach",
    href: "/ai-coach",
    icon: "message-circle-outline",
    description: "Chat through your career questions",
    descriptionKey: "web:dashboard.quickActions.aiCoach",
  },
];

// Tint badge colors cycled across quick-action / feature cards, matching
// the mobile ActionCard's soft icon-badge treatment.
export const tintCycle: Array<{ bg: string; text: string }> = [
  { bg: "bg-tint-orange", text: "text-tint-orange-text" },
  { bg: "bg-tint-mint", text: "text-tint-mint-text" },
  { bg: "bg-tint-rose", text: "text-tint-rose-text" },
  { bg: "bg-tint-purple", text: "text-tint-purple-text" },
];
