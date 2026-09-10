import apiClient from "./apiClient";

// Mirrors mobile's services/moreMenuBadgesService.ts — same single
// GET /api/v1/more/badges round trip, fanned out to whichever nav rows care
// (Sidebar.tsx: Job Alerts, Career Events, and a combined Settings badge).
export interface MoreBadges {
  jobAlertsUnreadCount: number;
  careerEventsUnreadCount: number;
  dailyIndustryNewsUnread: boolean;
  weeklyCareerReportUnread: boolean;
}

interface MoreBadgesWire {
  job_alerts_unread_count?: number;
  career_events_unread_count?: number;
  daily_industry_news_unread?: boolean;
  weekly_career_report_unread?: boolean;
}

const EMPTY_BADGES: MoreBadges = {
  jobAlertsUnreadCount: 0,
  careerEventsUnreadCount: 0,
  dailyIndustryNewsUnread: false,
  weeklyCareerReportUnread: false,
};

/** Fails soft — badges are a nice-to-have indicator, not core functionality,
 * so a failed fetch (offline, a free-tier user who's never hit a premium
 * gate, etc.) just shows no badges rather than breaking the sidebar. */
export async function getMoreBadges(): Promise<MoreBadges> {
  try {
    const data = await apiClient.get<MoreBadgesWire>("/api/v1/more/badges");
    return {
      jobAlertsUnreadCount: Number(data?.job_alerts_unread_count) || 0,
      careerEventsUnreadCount: Number(data?.career_events_unread_count) || 0,
      dailyIndustryNewsUnread: Boolean(data?.daily_industry_news_unread),
      weeklyCareerReportUnread: Boolean(data?.weekly_career_report_unread),
    };
  } catch (err) {
    console.warn("[moreBadges] getMoreBadges failed", err);
    return EMPTY_BADGES;
  }
}

/** Maps a NavLeaf's `badgeKey` to a count for the given badges snapshot —
 * shared by Sidebar's top-level and grouped-child rows. Returns undefined
 * (not 0) when there's nothing to show, so callers can render "no pill". */
export function badgeCountFor(badgeKey: string | undefined, badges: MoreBadges | null): number | undefined {
  if (!badgeKey || !badges) return undefined;
  if (badgeKey === "jobAlerts") return badges.jobAlertsUnreadCount || undefined;
  if (badgeKey === "careerEvents") return badges.careerEventsUnreadCount || undefined;
  if (badgeKey === "settings") {
    const combined = (badges.dailyIndustryNewsUnread ? 1 : 0) + (badges.weeklyCareerReportUnread ? 1 : 0);
    return combined || undefined;
  }
  return undefined;
}
