import type { EvaIconName } from "@/components/icons/EvaIcon";

export interface NavLeaf {
  label: string;
  href: string;
  icon: EvaIconName;
  description?: string;
}

export interface NavGroup {
  label: string;
  icon: EvaIconName;
  children: NavLeaf[];
}

export type NavItem = NavLeaf | NavGroup;

export function isNavGroup(item: NavItem): item is NavGroup {
  return "children" in item;
}

// Sidebar primary sections — mirrors the mobile app's drawer taxonomy.
export const primaryNav: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: "home-outline" },
  { label: "AI Coach", href: "/ai-coach", icon: "message-circle-outline" },
  {
    label: "Practice",
    icon: "clipboard-outline",
    children: [
      { label: "Mock Interviews", href: "/practice/mock-interviews", icon: "mic-outline" },
      { label: "Coding Practice", href: "/practice/coding", icon: "code-outline" },
      { label: "Practical Scenarios", href: "/practice/scenarios", icon: "clipboard-outline" },
    ],
  },
  {
    label: "Career Tools",
    icon: "compass-outline",
    children: [
      { label: "Career Roadmap", href: "/career/roadmap", icon: "compass-outline" },
      { label: "Career DNA", href: "/career/dna", icon: "activity-outline" },
      { label: "Networking Assistant", href: "/career/networking", icon: "people-outline" },
      { label: "Dream Companies", href: "/career/dream-companies", icon: "star-outline" },
      { label: "Company Intelligence", href: "/career/company-intelligence", icon: "search-outline" },
      { label: "Salary Negotiation", href: "/career/salary-negotiation", icon: "bar-chart-2-outline" },
    ],
  },
  {
    label: "Resume Tools",
    icon: "file-text-outline",
    children: [
      { label: "Resume Builder", href: "/resume/builder", icon: "edit-2-outline" },
      { label: "Cover Letter Generator", href: "/resume/cover-letter", icon: "file-text-outline" },
      { label: "LinkedIn Optimizer", href: "/resume/linkedin", icon: "linkedin-outline" },
      { label: "Resume Variants", href: "/resume/variants", icon: "layers-outline" },
    ],
  },
  { label: "Learning Courses", href: "/learning", icon: "book-open-outline" },
  { label: "Job Alerts", href: "/job-alerts", icon: "briefcase-outline" },
];

// Sidebar secondary / bottom section.
export const secondaryNav: NavLeaf[] = [
  { label: "Referral Program", href: "/referral", icon: "gift-outline" },
  { label: "Subscription", href: "/subscription", icon: "credit-card-outline" },
  { label: "Settings", href: "/settings", icon: "settings-2-outline" },
  { label: "Live Support", href: "/support", icon: "headphones-outline" },
];

// Quick-action cards shown on the dashboard — a flattened, curated subset of
// the nav above, matching mobile Home's ActionCard grid.
export const quickActions: NavLeaf[] = [
  {
    label: "Mock Interview",
    href: "/practice/mock-interviews",
    icon: "mic-outline",
    description: "Practice live with an AI interviewer",
  },
  {
    label: "Coding Practice",
    href: "/practice/coding",
    icon: "code-outline",
    description: "Sharpen your technical skills",
  },
  {
    label: "Practical Scenarios",
    href: "/practice/scenarios",
    icon: "clipboard-outline",
    description: "Work through real on-the-job situations",
  },
  {
    label: "Resume Builder",
    href: "/resume/builder",
    icon: "edit-2-outline",
    description: "Build an ATS-friendly resume",
  },
  {
    label: "Career Roadmap",
    href: "/career/roadmap",
    icon: "compass-outline",
    description: "See your personalized path forward",
  },
  {
    label: "Learning Courses",
    href: "/learning",
    icon: "book-open-outline",
    description: "Level up with guided courses",
  },
  {
    label: "Job Alerts",
    href: "/job-alerts",
    icon: "briefcase-outline",
    description: "Get matched to new openings daily",
  },
  {
    label: "AI Coach",
    href: "/ai-coach",
    icon: "message-circle-outline",
    description: "Chat through your career questions",
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
