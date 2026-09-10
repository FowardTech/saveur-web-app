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
  /** Key into the `/api/v1/more/badges` response (see lib/moreBadges.ts) —
   * when set, Sidebar renders a small unread-count pill at the end of this
   * row, mirroring mobile MainDrawer.tsx's per-row `badge` treatment. */
  badgeKey?: "jobAlerts" | "careerEvents" | "settings";
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
      // Mobile drawer: "Recent Interviews" lands on the real "Interviews"
      // screen (src/requests/RequestsSrc.tsx) with its Practice History tab
      // pre-selected (`initialTab: 1`) rather than its own screen — same
      // structure here: this points at the merged app/applications/page.tsx
      // with ?tab=history, not a separate route.
      { label: "Recent Interviews", labelKey: "recentInterviews", href: "/applications?tab=history", icon: "clock-outline" },
    ],
  },
  {
    label: "Career Tools",
    labelKey: "careerTools",
    icon: "compass-outline",
    children: [
      { label: "Career Roadmap", labelKey: "careerRoadmap", href: "/career/roadmap", icon: "compass-outline" },
      { label: "Career DNA", labelKey: "careerDna", href: "/career/dna", icon: "activity-outline" },
      // Mobile: ONE "Networking Assistant" screen (src/more/
      // NetworkingAssistant.tsx) with a 2-tab pill switcher — "Career
      // Events" (index 0, default) and "Your Contacts" (index 1). This used
      // to be two separate web pages/nav rows ("Networking Assistant" and
      // "Career Events"); merged into one route (app/career/networking/
      // page.tsx) with the same 2 tabs, so the redundant second nav entry
      // is gone too. badgeKey stays "careerEvents" — same unread-count
      // source the old standalone Career Events row used, now surfaced on
      // this one row since Events is this page's default landing tab.
      { label: "Networking Assistant", labelKey: "networkingAssistant", href: "/career/networking", icon: "people-outline", badgeKey: "careerEvents" },
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
  { label: "Job Alerts", labelKey: "jobAlerts", href: "/job-alerts", icon: "briefcase-outline", badgeKey: "jobAlerts" },
  // Mobile: MoreSrc.tsx's "Applications" row, landing on the same real
  // "Interviews" screen (src/requests/RequestsSrc.tsx) as "Recent
  // Interviews" above, just defaulting to the Applications tab instead of
  // Practice History — see app/applications/page.tsx's own comment for why
  // this is one merged route with two differently-labeled entry points
  // rather than either a single nav row or two separate pages. Label
  // renamed from "Application Tracker" to "Applications" to match MoreSrc's
  // real row label (t('more:tab_interviews', {defaultValue: 'Applications'}));
  // labelKey stays `applicationTracker` on purpose so existing translations
  // aren't invalidated (same convention as this file's own "Support" rename
  // below). Top-level here (not nested under Practice) since it's a
  // Basic-and-up job-search tool in its own right, same tier/prominence as
  // Job Alerts.
  { label: "Applications", labelKey: "applicationTracker", href: "/applications", icon: "award-outline" },
  // Mobile: MoreSrc.tsx's "My Progress" row (title: t('more:my_progress'))
  // sits immediately after "Applications" and before the Resume Tools rows
  // in its flat DATA list — see that row's own comment for the "everything
  // that used to be on Home now lives here" claim, which app/progress/
  // page.tsx's own header comment explains is now stale (streak/XP/check-in
  // moved again, to what mobile calls Leaderboard.tsx -> app/progress/
  // leaderboard/page.tsx here). Placed at the same relative position here,
  // right after Applications, since web's grouped nav sections don't have a
  // literal "between these two rows" slot the way mobile's flat list does.
  { label: "My Progress", labelKey: "myProgress", href: "/progress", icon: "trending-up-outline" },
  // Mobile: MoreSrc.tsx's "Career Goal" row, which now opens
  // src/more/GoalsScreen.tsx first (Career/Weekly targets/Progress hub)
  // instead of jumping straight to the goal picker — see that screen's own
  // header comment. Placed right after "My Progress" since both are
  // glance-value progress surfaces reachable from the same part of
  // mobile's flat More list.
  { label: "Goals", labelKey: "goals", href: "/goals", icon: "flash-outline" },
];

// Sidebar secondary / bottom section.
export const secondaryNav: NavLeaf[] = [
  { label: "Referral Program", labelKey: "referralProgram", href: "/referral", icon: "gift-outline" },
  // Mobile: MoreSrc.tsx's More list places "Shared with Me" directly after
  // "Refer & Earn" (src/more/MoreSrc.tsx) — same relative position here.
  // Receiving side of the same in-app sharing system Job Alerts' "Share
  // with a Saveur user" (ShareToUserModal) already uses — see
  // lib/sharesService.ts and app/shared-with-me/page.tsx. No badgeKey:
  // mobile's own row (src/more/MoreSrc.tsx) has no badgeCount/badgeDot for
  // this either, and GET /api/v1/more/badges doesn't report an unread-shares
  // or pending-connection-requests count today.
  { label: "Shared with Me", labelKey: "sharedWithMe", href: "/shared-with-me", icon: "share-outline" },
  // Mobile drawer: MoreSrc.tsx places this row directly above Subscription
  // — a one-time-purchase catalog (Coding Practice, etc.) independent of
  // subscription tier, see src/more/AddOns.tsx.
  { label: "Add-ons", labelKey: "addons", href: "/addons", icon: "pricetags-outline" },
  { label: "Subscription", labelKey: "subscription", href: "/subscription", icon: "credit-card-outline" },
  // badgeKey "settings" folds Daily Industry News + Weekly Career Report
  // unread flags together (0/1/2) — same combined-row treatment mobile's
  // drawer gives its own "More" row (see MainDrawer.tsx's `badge:` on the
  // Profile item) now that neither of those two screens has its own web
  // route/nav slot yet.
  { label: "Settings", labelKey: "settings", href: "/settings", icon: "settings-2-outline", badgeKey: "settings" },
  // Renamed from "Live Support" -> "Support" (product request) — labelKey
  // stays `liveSupport` on purpose, to avoid invalidating the existing
  // `common:nav.liveSupport` translation key across all 12 locales; only
  // the literal English defaultValue text changes.
  { label: "Support", labelKey: "liveSupport", href: "/support", icon: "headphones-outline" },
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
