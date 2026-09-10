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
 * Mirrors the destinations mobile's push-tap routing (navigationRef.ts) and
 * in-app notification list send users to for the same notification kinds —
 * only the ones with a real web route today are mapped; everything else
 * just marks read and stays put. */
export function notificationHref(n: AppNotification): string | undefined {
  switch (n.type) {
    case "job_alert":
      return "/job-alerts";
    case "career_event":
      return "/career/events";
    case "feedback_ready":
    case "video_ready":
    case "practical_feedback_ready":
      return "/practice/history";
    case "roadmap_ready":
      return "/career/roadmap";
    case "payment":
    case "payment_failed":
      return "/settings/payment";
    default:
      return undefined;
  }
}
