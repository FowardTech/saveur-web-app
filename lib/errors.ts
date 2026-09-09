/**
 * Extracts a displayable message from a caught error, regardless of shape.
 *
 * Bug this fixes: every catch block that did `err instanceof Error ?
 * err.message : "<generic fallback>"` was silently discarding real,
 * already-computed error text whenever the error came from `apiClient`
 * (lib/apiClient.ts) — that module deliberately throws plain `ApiError`
 * OBJECTS, not `Error` instances (e.g. `{message: "No internet connection.
 * Please check your connection and try again.", code: "ERR_NETWORK"}`), so
 * `instanceof Error` was always false for those and every apiClient failure
 * showed the same generic per-screen fallback instead of the specific
 * reason. This checks for a `.message` string on ANY object shape — Error
 * instances, ApiError objects, and Firebase's FirebaseError (which IS a
 * real Error subclass, so it was already working) all satisfy this.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string" && err.message) {
    return err.message;
  }
  return fallback;
}
