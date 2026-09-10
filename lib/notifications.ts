import apiClient from "./apiClient";

// Real backend contract — Saveur-Backend/app/api/notifications.py
//   GET  /api/v1/notifications       -> Notification[]
//   POST /api/v1/notifications/read  -> {ids: [...]}
export interface NotificationJobAlert {
  id: string;
  title: string;
  company: string;
  location?: string;
  apply_url?: string;
  applied?: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type?: string;
  read: boolean;
  data?: Record<string, unknown> | null;
  created_at: string;
  job_alert?: NotificationJobAlert;
}

export async function listNotifications(): Promise<AppNotification[]> {
  return apiClient.get<AppNotification[]>("/api/v1/notifications");
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await apiClient.post("/api/v1/notifications/read", { ids });
}

export async function registerDeviceToken(token: string, platform: string = "web"): Promise<void> {
  await apiClient.post("/api/v1/notifications/device-token", { token, platform });
}

/** Where tapping a notification of this `type` should navigate, if anywhere.
 * Mirrors the destinations mobile's push-tap routing
 * (services/pushNotificationService.ts's handleDataTap +
 * navigation/navigationRef.ts) and in-app notification list send users to
 * for the same notification kinds — real backend `kind` values confirmed
 * against Saveur-Backend's Notification.kind write sites (grep `kind="` /
 * `kind = ` across app/services + app/tasks + app/api). Only the ones with
 * a real web route today are mapped; anything else (admin_broadcast, test,
 * weekly_career_report — no web page for that last one yet) just marks
 * itself read and stays put, same as mobile's own generic fallback. */
export function notificationHref(n: AppNotification): string | undefined {
  const data = n.data ?? {};
  switch (n.type) {
    case "job_alert":
      // The backend embeds the full job on the notification itself (see
      // Saveur-Backend's notification_service.py) — land straight on that
      // alert's own details/apply screen (app/job-alerts/[id]/page.tsx)
      // when we have its id, same as mobile's bell-tap routing
      // (src/home/Notification/index.tsx) does, rather than just the list.
      return n.job_alert?.id ? `/job-alerts/${n.job_alert.id}` : "/job-alerts";
    case "career_event":
      // Career Events is now the default tab of the merged Networking
      // Assistant screen (app/career/networking/page.tsx), not its own
      // route — see that file's own comment.
      return "/career/networking?tab=events";
    case "feedback_ready":
    case "video_ready":
    case "practical_feedback_ready":
      // Practice History is now the second tab of the merged Interviews
      // screen (app/applications/page.tsx), not its own route — see that
      // file's own comment.
      return "/applications?tab=history";
    case "roadmap_ready":
    case "roadmap_step_unlocked":
    case "roadmap_complete":
      // roadmap_step_unlocked/roadmap_complete (career_roadmap_service.py)
      // reuse the same destination as roadmap_ready — same parity fix
      // mobile's handleDataTap already applies.
      return "/career/roadmap";
    case "payment":
    case "payment_failed":
      return "/settings/payment";
    case "goal_tip":
      // BUG FIX (product report: clicking "Today's Tip" in the notification
      // center didn't redirect anywhere) — no web destination existed for
      // this kind at all before app/goals/today-tip/page.tsx (mirrors
      // mobile's GoalTipDetail.tsx, reached the same way).
      return "/goals/today-tip";
    case "daily_challenge":
      // "Today's Surprise Challenge" lives inline on the Progress page
      // (app/progress/page.tsx), not its own route.
      return "/progress";
    case "daily_industry_news":
      return "/news";
    case "daily_leaderboard_tip":
      return "/progress/leaderboard";
    case "curriculum_week_unlocked":
    case "curriculum_complete":
      return "/learning";
    case "post_offer_step_unlocked":
    case "post_offer_plan_complete":
    case "next_step_plan":
      return "/whats-next";
    case "content_shared": {
      const shareId = data.share_id;
      return typeof shareId === "string" || typeof shareId === "number"
        ? `/shared-with-me/${shareId}`
        : "/shared-with-me";
    }
    case "connection_request":
      return "/shared-with-me?tab=requests";
    case "connection_accepted":
      return "/shared-with-me";
    case "stale_applications":
      return "/applications";
    default:
      return undefined;
  }
}
