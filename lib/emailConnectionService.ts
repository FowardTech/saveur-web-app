import apiClient from "./apiClient";

// ---------------------------------------------------------------------------
// Web counterpart to Saveur/services/emailConnectionService.ts — "Connect
// Gmail" / "Connect Outlook" for the Job Tracker inbox auto-scan feature
// (see Saveur-Backend's app/api/gmail_auth.py / outlook_auth.py for the
// OAuth flow this drives, app/services/inbox_scan_service.py for what
// happens once connected).
//
// The OAuth dance itself is identical to mobile's (GET /start -> provider
// consent page -> backend /callback exchanges the code and stores the
// encrypted refresh token) — what differs is only how the browser gets
// back into this app afterward. Mobile opens the system browser and
// catches a saveur:// custom-scheme redirect; a web browser can't do that,
// so /start here is called with `?platform=web`, which the backend encodes
// into its signed OAuth state and uses at /callback time to 302 straight
// back to THIS origin's /applications page instead
// (`?email_connected=gmail&ok=1&email=...` or `&error=...` — see
// app/applications/page.tsx's own comment for how it reads that).
//
// Because that's a full top-level navigation away from and back to this
// site (not a popup + postMessage), connect() below doesn't return a
// promise that resolves with the result the way mobile's does — it simply
// navigates the browser to the authorize URL. The caller (applications
// page) picks the result back up from the query string on the next mount.
// ---------------------------------------------------------------------------

export type EmailProvider = "gmail" | "outlook";

export interface EmailConnectionProps {
  provider: EmailProvider;
  emailAddress: string | null;
  isActive: boolean;
  connectedAt: number | null;
  lastSyncedAt: number | null;
  lastSyncError: string | null;
}

interface EmailConnectionWire {
  provider: EmailProvider;
  email_address: string | null;
  is_active: boolean;
  connected_at: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

function fromWire(wire: EmailConnectionWire): EmailConnectionProps {
  return {
    provider: wire.provider,
    emailAddress: wire.email_address,
    isActive: wire.is_active,
    connectedAt: wire.connected_at ? new Date(wire.connected_at).getTime() : null,
    lastSyncedAt: wire.last_synced_at ? new Date(wire.last_synced_at).getTime() : null,
    lastSyncError: wire.last_sync_error,
  };
}

/** GET /api/v1/email-connections — every active inbox connection for the
 * signed-in user (0, 1, or 2 rows — Gmail and/or Outlook). */
export async function listConnections(): Promise<EmailConnectionProps[]> {
  const { data } = await apiClient.get<{ data: EmailConnectionWire[] }>("/api/v1/email-connections");
  return (data ?? []).map(fromWire);
}

/** DELETE /api/v1/email-connections/{provider} — stops auto-scanning that
 * inbox immediately and best-effort revokes the token on Google's side for
 * Gmail. */
export async function disconnect(provider: EmailProvider): Promise<void> {
  await apiClient.delete(`/api/v1/email-connections/${provider}`);
}

/** Fetches the provider's authorize URL and navigates the whole browser
 * tab there — the consent page needs the full top-level frame, not an
 * XHR. The backend's /callback lands the browser back on this same
 * /applications page once the user approves (or cancels/errors) — see this
 * module's own header comment. */
export async function connect(provider: EmailProvider): Promise<void> {
  const body = await apiClient.get<{ url: string }>(`/api/v1/auth/${provider}/start`, {
    params: { platform: "web" },
  });
  window.location.assign(body.url);
}
