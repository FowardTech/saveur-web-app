import apiClient from "./apiClient";

// Web port of Saveur (mobile)'s services/sharesService.ts — "share to a
// Saveur user" by username (product request item: "The users can share it
// to other users of these app using their usernames"). Backed by
// Saveur-Backend's app/api/shares.py + app/services/shares_service.py —
// this is a plain, generic REST contract (not push-notification/deep-link
// based like jobShareService's OS-share fallback), so it's fully portable
// to web: same endpoints, same shapes, just fetch() instead of RN's Share
// API. Only the "job" content type is wired up on web today (Job Details is
// the one screen that needs it here); the type stays broader since the
// backend contract already supports feedback/video too.
export type SharedContentType = "feedback" | "video" | "job";

export interface RecipientLookupResult {
  exists: boolean;
  connected: boolean;
}

/** GET /api/v1/shares/recipient-lookup?username=X — live as-you-type check
 * for the share composer. Swallows errors into {exists:false,
 * connected:false} (advisory only — real validation happens server-side on
 * submit). */
export async function checkRecipientExists(username: string): Promise<RecipientLookupResult> {
  try {
    const data = await apiClient.get<{ exists: boolean; connected: boolean }>("/api/v1/shares/recipient-lookup", {
      params: { username },
    });
    return { exists: !!data.exists, connected: !!data.connected };
  } catch {
    return { exists: false, connected: false };
  }
}

/** POST /api/v1/shares/connections — send a connection request to a
 * recipient by username. If the recipient already has an unanswered
 * request out to the sender, the backend auto-accepts instead of leaving
 * two pending rows (`autoAccepted: true`). Throws on failure (recipient not
 * found, already connected, request already sent, etc.). */
export async function sendConnectionRequest(recipientUsername: string): Promise<{
  id: string;
  status: "pending" | "accepted" | "declined";
  autoAccepted: boolean;
}> {
  const data = await apiClient.post<{ id: string; status: string; auto_accepted: boolean }>("/api/v1/shares/connections", {
    recipient_username: recipientUsername,
  });
  return { id: data.id, status: data.status as "pending" | "accepted" | "declined", autoAccepted: !!data.auto_accepted };
}

/** POST /api/v1/shares — shares one piece of content to another Saveur user
 * by username. Requires an accepted connection (see sendConnectionRequest
 * above) — throws with a real error code on failure so the composer can
 * show the actual reason. */
export async function shareContent(params: {
  recipientUsername: string;
  contentType: SharedContentType;
  contentId: string | number;
  message?: string;
}): Promise<void> {
  await apiClient.post("/api/v1/shares", {
    recipient_username: params.recipientUsername,
    content_type: params.contentType,
    content_id: String(params.contentId),
    message: params.message,
  });
}
