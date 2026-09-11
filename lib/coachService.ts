import apiClient from "./apiClient";

// Real backend contract — Saveur-Backend/app/api/coach.py's
// GET /api/v1/coach/suggested-topics. Ported from mobile's
// Saveur/services/coachService.ts (same endpoint, same personalized
// client-side fallback), since the web AI Coach greeting screen never had
// suggested topics at all (product report: "suggested topics are not in
// the web version add it too").
//
// Tries the real backend first (which can genuinely personalize using the
// user's full history), and if that's unavailable, falls back to building
// topics from data the web client already has (profile.goals/desiredRoles,
// collected at onboarding) rather than a fixed list — so even the fallback
// differs per account instead of being static.

export interface SuggestedTopic {
  id: string;
  title: string;
}

interface SuggestedTopicsWire {
  topics?: Array<{ id?: string; title?: string; prompt?: string }>;
}

export interface SuggestedTopicsContext {
  goals?: string[];
  desiredRoles?: string[];
  language?: string;
}

function buildFallbackTopics(context?: SuggestedTopicsContext): SuggestedTopic[] {
  const role = context?.desiredRoles?.[0];
  const goal = context?.goals?.[0];
  const topics: SuggestedTopic[] = [];
  if (role) {
    topics.push({ id: "role_prep", title: `What should I focus on to prepare for a ${role} interview?` });
  }
  if (goal) {
    topics.push({ id: "goal_next_step", title: `What's my next step toward "${goal}"?` });
  }
  topics.push(
    { id: "resume_review", title: "Can you review my resume and suggest improvements?" },
    { id: "salary_negotiation", title: "How should I approach negotiating my salary?" },
    { id: "interview_nerves", title: "How do I stay calm and confident during interviews?" }
  );
  return topics.slice(0, 3);
}

export async function getSuggestedTopics(context?: SuggestedTopicsContext): Promise<SuggestedTopic[]> {
  try {
    const data = await apiClient.get<SuggestedTopicsWire>("/api/v1/coach/suggested-topics", {
      params: { language: context?.language ?? "en" },
    });
    const list = (data.topics ?? [])
      .map((t, i) => ({ id: t.id ?? `topic_${i}`, title: t.title ?? t.prompt ?? "" }))
      .filter((t) => t.title);
    if (list.length > 0) return list;
  } catch {
    // Not implemented yet / offline — fall through to the personalized
    // client-side fallback below rather than showing nothing.
  }
  return buildFallbackTopics(context);
}
