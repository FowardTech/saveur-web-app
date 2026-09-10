// Backs the "choose your username" signup step (components/auth/
// ChooseUsernameStep.tsx) — mirrors mobile's src/auth/Signup/
// ChooseUsername.tsx + services/authService.ts's username helpers, wired to
// the real Flask routes in Saveur-Backend's app/api/users.py (registered
// under both the /api/v1/users and mobile-facing /api/users alias
// blueprints — this app calls the /api/users alias, same as the rest of
// lib/*Service.ts and AuthProvider.tsx's syncProfile/refreshProfile calls).
//
// Note: the initial random username itself is NOT assigned here — it's
// auto-generated server-side (username_service.ensure_username) the moment
// POST /api/users/me (AuthProvider's syncProfile) first upserts the user
// row, so by the time ChooseUsernameStep ever mounts post-signup,
// profile.username is already populated with a valid suggestion. This file
// only covers the two additional actions the step offers on top of that:
// regenerating the suggestion, and live-checking a custom one as the user
// types.
import apiClient from "./apiClient";

export type UsernameUnavailableReason = "invalid_format" | "looks_like_name" | "taken";

export interface UsernameAvailability {
  available: boolean;
  reason: UsernameUnavailableReason | null;
}

/** GET /api/users/username-availability?username=X — live as-you-type check
 * (see Saveur-Backend app/api/users.py's username_availability()). Debounce
 * on the caller's side (ChooseUsernameStep debounces ~450ms, matching
 * mobile). */
export function checkUsernameAvailability(username: string): Promise<UsernameAvailability> {
  return apiClient.get<UsernameAvailability>("/api/users/username-availability", {
    params: { username },
  });
}

/** POST /api/users/me/regenerate-username — "Generate another" action on the
 * suggested-username tab. Overwrites the user's current username server-side
 * with a fresh random one; caller should refreshProfile() afterward to pick
 * up the new value (this endpoint's own response also echoes it back, but
 * AuthProvider's profile state is the single source of truth the rest of
 * the app reads from). */
export function regenerateUsername(): Promise<{ username: string }> {
  return apiClient.post<{ username: string }>("/api/users/me/regenerate-username", {});
}
