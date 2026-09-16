import apiClient from "./apiClient";

// appRatingService — web port of Saveur (mobile)'s services/appRatingService.ts.
// BUG FIX (product report: "you did not implement ratings in the web app...
// just the way it is in the mobile app"): backend has always fully supported
// this (Saveur-Backend/app/api/ratings.py) -- web simply never called it.
//
// Due-ness is server-authoritative (GET /status), not a client-side
// localStorage timer -- survives clearing site data, and a user can't dodge
// this QA signal forever just by wiping local storage. See
// components/dashboard/RatingModal.tsx for the UI and app/dashboard/page.tsx
// for the due-check wiring.
export interface AppRating {
  id: number;
  score: number;
  comment: string | null;
  createdAt: string;
}

interface RatingWire {
  id?: number;
  score?: number;
  comment?: string | null;
  created_at?: string | null;
}

function fromWire(r: RatingWire): AppRating {
  return {
    id: r.id ?? 0,
    score: r.score ?? 0,
    comment: r.comment ?? null,
    createdAt: r.created_at ?? "",
  };
}

/** GET /api/v1/ratings/status. Fails closed (false) on any error -- a
 * broken network call should never itself be the reason the dashboard
 * suddenly shows a modal. */
export async function isRatingPromptDue(): Promise<boolean> {
  try {
    const data = await apiClient.get<{ due?: boolean }>("/api/v1/ratings/status");
    return Boolean(data?.due);
  } catch {
    return false;
  }
}

/** POST /api/v1/ratings -- {score: 1-5}. Also marks the prompt as shown
 * server-side, so the next due-check naturally waits a full interval again. */
export async function submitRating(score: number, comment?: string): Promise<AppRating> {
  const data = await apiClient.post<RatingWire>("/api/v1/ratings", {
    score,
    comment: comment?.trim() || undefined,
  });
  return fromWire(data);
}

/** POST /api/v1/ratings/dismiss -- closed without rating; still updates the
 * server-side "last shown" timestamp so the next due-check waits a full
 * interval, same as submitting. */
export async function dismissRatingPrompt(): Promise<void> {
  await apiClient.post("/api/v1/ratings/dismiss");
}

/** GET /api/v1/ratings/mine -- the signed-in user's own past ratings, newest
 * first (product direction: visible to the user who submitted them, not
 * just an admin view). Backs app/settings/ratings/page.tsx. */
export async function getMyRatings(): Promise<AppRating[]> {
  const data = await apiClient.get<{ ratings?: RatingWire[] }>("/api/v1/ratings/mine");
  return (data.ratings ?? []).map(fromWire);
}
