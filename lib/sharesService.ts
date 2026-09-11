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

// ---------------------------------------------------------------------------
// "Shared with Me" inbox — the receiving side of the same in-app sharing
// system above. Web port of Saveur (mobile)'s src/more/SharedWithMe.tsx +
// src/more/SharedContentDetail.tsx (see app/shared-with-me/page.tsx and
// app/shared-with-me/[id]/page.tsx). Same GET /api/v1/shares,
// GET /api/v1/shares/{id}, and connection-request endpoints mobile's
// services/sharesService.ts uses — contract confirmed against
// Saveur-Backend's app/services/shares_service.py (list_received,
// get_share_detail, list_pending_requests, respond_connection_request).
// ---------------------------------------------------------------------------

export interface SharedContentPreview {
  role?: string;
  company?: string;
  interviewType?: string;
  overallScore?: number;
  title?: string;
  location?: string;
}

export interface ReceivedShareProps {
  id: string;
  senderUsername: string;
  contentType: SharedContentType;
  contentId: string;
  message?: string;
  createdAt: number;
  read: boolean;
  preview: SharedContentPreview;
}

interface WireShare {
  id: string;
  sender_username: string;
  content_type: SharedContentType;
  content_id: string;
  message?: string | null;
  created_at: string | null;
  read: boolean;
  preview?: {
    role?: string;
    company?: string;
    interview_type?: string;
    overall_score?: number;
    title?: string;
    location?: string;
  };
}

function fromWire(w: WireShare): ReceivedShareProps {
  return {
    id: w.id,
    senderUsername: w.sender_username,
    contentType: w.content_type,
    contentId: w.content_id,
    message: w.message ?? undefined,
    createdAt: w.created_at ? new Date(w.created_at).getTime() : Date.now(),
    read: !!w.read,
    preview: {
      role: w.preview?.role,
      company: w.preview?.company,
      interviewType: w.preview?.interview_type,
      overallScore: w.preview?.overall_score,
      title: w.preview?.title,
      location: w.preview?.location,
    },
  };
}

/** GET /api/v1/shares — everything shared TO the current user, newest
 * first. Used by app/shared-with-me/page.tsx. */
export async function listReceivedShares(): Promise<ReceivedShareProps[]> {
  const data = await apiClient.get<WireShare[]>("/api/v1/shares");
  return (data ?? []).map(fromWire);
}

// The full, viewable payload for one share — shape of `content` depends on
// contentType: feedback/video get feedback.py's existing score/STAR/voice/
// camera (+ transcript/annotations/video_url for video) fields plus
// role/company/interviewType/mode/difficulty context; job gets the same
// JobAlert fields the Job Details page already renders.
export interface SharedContentDetailProps {
  id: string;
  senderUsername: string;
  contentType: SharedContentType;
  message?: string;
  createdAt: number;
  content: Record<string, unknown>;
}

/** GET /api/v1/shares/{id} — the full content for one share (marks it read
 * server-side the first time the recipient opens it). Throws on failure
 * (not found, or the original content was since deleted) so
 * app/shared-with-me/[id]/page.tsx can show a real error instead of a blank
 * screen. */
export async function getShareDetail(shareId: string): Promise<SharedContentDetailProps> {
  const data = await apiClient.get<{
    id: string;
    sender_username: string;
    content_type: SharedContentType;
    message?: string | null;
    created_at: string | null;
    content: Record<string, unknown>;
  }>(`/api/v1/shares/${shareId}`);
  return {
    id: data.id,
    senderUsername: data.sender_username,
    contentType: data.content_type,
    message: data.message ?? undefined,
    createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
    content: data.content,
  };
}

// ---------------------------------------------------------------------------
// Connections — the "Pending Requests" tab of the same inbox (product
// request item: "Before a user can share something with another Saveur user
// they must send a request first... If the other user did not accept it
// should go to pending requests until the user accept or declines").
// ---------------------------------------------------------------------------

export interface PendingConnectionRequest {
  id: string;
  requesterUsername: string;
  createdAt: number;
}

interface WirePendingConnection {
  id: string;
  requester_username: string;
  created_at: string | null;
}

/** GET /api/v1/shares/connections/pending — incoming connection requests
 * awaiting this user's accept/decline. */
export async function listPendingConnectionRequests(): Promise<PendingConnectionRequest[]> {
  const data = await apiClient.get<WirePendingConnection[]>("/api/v1/shares/connections/pending");
  return (data ?? []).map((w) => ({
    id: w.id,
    requesterUsername: w.requester_username,
    createdAt: w.created_at ? new Date(w.created_at).getTime() : Date.now(),
  }));
}

/** POST /api/v1/shares/connections/{id}/accept or /decline — respond to an
 * incoming connection request. Throws on failure (not found, already
 * responded). */
export async function respondToConnectionRequest(
  requestId: string,
  accept: boolean
): Promise<{ id: string; status: "accepted" | "declined" }> {
  const data = await apiClient.post<{ id: string; status: string }>(
    `/api/v1/shares/connections/${requestId}/${accept ? "accept" : "decline"}`
  );
  return { id: data.id, status: data.status as "accepted" | "declined" };
}

/** Combined count for the "Shared with Me" sidebar badge (product request:
 * badge that row like the mobile-parity ones do, even though neither
 * mobile's own MoreSrc.tsx row nor GET /api/v1/more/badges knows anything
 * about shares/connections — see lib/navigation.ts's Shared with Me entry
 * and lib/moreBadges.ts's `sharedWithMeUnreadCount` field for the rest of
 * the wiring). Sums two distinct "you haven't seen/actioned this yet"
 * signals: shares received but not yet opened (`read: false`), and
 * connection requests still awaiting accept/decline — both represent
 * unactioned inbound items on the same /shared-with-me screen, so they're
 * combined into one pill rather than showing only one of the two. Fails
 * soft (returns 0), same contract as getMoreBadges in lib/moreBadges.ts. */
export async function getSharedWithMeBadgeCount(): Promise<number> {
  try {
    const [shares, pending] = await Promise.all([listReceivedShares(), listPendingConnectionRequests()]);
    const unreadShares = shares.filter((s) => !s.read).length;
    return unreadShares + pending.length;
  } catch (err) {
    console.warn("[sharesService] getSharedWithMeBadgeCount failed", err);
    return 0;
  }
}
