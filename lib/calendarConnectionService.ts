import apiClient from "./apiClient";

// ---------------------------------------------------------------------------
// Web counterpart to Saveur/services/calendarConnectionService.ts —
// "Connect Google Calendar" / "Connect Outlook Calendar", the inbox-free
// way to auto-detect the Interviewing stage (an interview invite almost
// always comes with a calendar event — see Saveur-Backend's
// app/services/google_calendar_service.py's module comment). Structurally
// identical to lib/emailConnectionService.ts — see that file's own header
// comment for the full web-vs-mobile OAuth redirect story.
// ---------------------------------------------------------------------------

export type CalendarProvider = "google" | "outlook";

export interface CalendarConnectionProps {
  provider: CalendarProvider;
  emailAddress: string | null;
  isActive: boolean;
  connectedAt: number | null;
  lastSyncedAt: number | null;
  lastSyncError: string | null;
}

interface CalendarConnectionWire {
  provider: CalendarProvider;
  email_address: string | null;
  is_active: boolean;
  connected_at: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
}

function fromWire(wire: CalendarConnectionWire): CalendarConnectionProps {
  return {
    provider: wire.provider,
    emailAddress: wire.email_address,
    isActive: wire.is_active,
    connectedAt: wire.connected_at ? new Date(wire.connected_at).getTime() : null,
    lastSyncedAt: wire.last_synced_at ? new Date(wire.last_synced_at).getTime() : null,
    lastSyncError: wire.last_sync_error,
  };
}

/** GET /api/v1/calendar-connections — every active calendar connection for
 * the signed-in user (0, 1, or 2 rows — Google and/or Outlook). */
export async function listConnections(): Promise<CalendarConnectionProps[]> {
  const { data } = await apiClient.get<{ data: CalendarConnectionWire[] }>("/api/v1/calendar-connections");
  return (data ?? []).map(fromWire);
}

/** DELETE /api/v1/calendar-connections/{provider} — stops auto-scanning
 * that calendar immediately. */
export async function disconnect(provider: CalendarProvider): Promise<void> {
  await apiClient.delete(`/api/v1/calendar-connections/${provider}`);
}

/** Fetches the provider's authorize URL and navigates the whole browser tab
 * there — see lib/emailConnectionService.ts's connect() for why this is a
 * full navigation rather than an awaited popup. */
export async function connect(provider: CalendarProvider): Promise<void> {
  const path = provider === "google" ? "google-calendar" : "outlook-calendar";
  const body = await apiClient.get<{ url: string }>(`/api/v1/auth/${path}/start`, {
    params: { platform: "web" },
  });
  window.location.assign(body.url);
}
