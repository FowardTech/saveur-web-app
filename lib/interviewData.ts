import type { EvaIconName } from "@/components/icons/EvaIcon";

// Shared between app/practice/mock-interviews/page.tsx (the setup wizard)
// and app/practice/page.tsx (the practice hub's "Interview Types" quick
// grid — mirrors mobile's FindScreen.tsx typesGrid, which jumps straight
// into the setup wizard pre-filled with a type). Ported from mobile's
// constants/Data.ts DATA_INTERVIEW_TYPES + services/interviewService.ts's
// TYPE_TO_WIRE mapping.
export interface InterviewTypeDef {
  label: string;
  wire: string;
  icon: EvaIconName;
}

export const INTERVIEW_TYPES: InterviewTypeDef[] = [
  { label: "Behavioral", wire: "behavioral", icon: "message-square-outline" },
  { label: "Technical", wire: "technical", icon: "settings-2-outline" },
  { label: "Coding", wire: "coding", icon: "code-outline" },
  { label: "System Design", wire: "system-design", icon: "grid-outline" },
  { label: "Product Management", wire: "PM", icon: "briefcase-outline" },
  { label: "Sales", wire: "sales", icon: "trending-up-outline" },
  { label: "Marketing", wire: "marketing", icon: "pie-chart-outline" },
  { label: "Finance", wire: "finance", icon: "credit-card-outline" },
  { label: "Healthcare", wire: "healthcare", icon: "heart-outline" },
  { label: "Customer Service", wire: "customer-service", icon: "headphones-outline" },
  { label: "Government", wire: "government", icon: "shield-outline" },
  { label: "Consulting", wire: "consulting", icon: "bulb-outline" },
  { label: "Executive", wire: "executive", icon: "award-outline" },
  { label: "Graduate", wire: "graduate", icon: "book-open-outline" },
  { label: "Internship", wire: "internship", icon: "clipboard-outline" },
  { label: "Sports", wire: "sports", icon: "activity-outline" },
];

export function interviewTypeSlug(label: string): string {
  return label.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
}

export function interviewTypeFromSlug(slug: string | null | undefined): InterviewTypeDef | undefined {
  if (!slug) return undefined;
  return INTERVIEW_TYPES.find((t) => interviewTypeSlug(t.label) === slug);
}
