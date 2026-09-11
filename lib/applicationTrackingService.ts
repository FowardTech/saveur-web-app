import apiClient from "./apiClient";

// Web counterpart to Saveur/services/applicationsService.ts's addApplication
// — specifically the shape trackApplication() in Saveur/src/more/
// WebViewScreen.tsx sends (see that file's own comments for the full
// design). POSTs straight to the same real backend endpoint
// (Saveur-Backend/app/api/tracker.py), same wire field names
// (toWireCreate's snake_case: company/role/location/applied_date/stage/
// apply_url/source/company_logo_url).
//
// `source` here is NOT the job board (LinkedIn/Indeed/etc, that's a
// separate field on the job alert itself, never sent to the tracker) — it's
// how this application got tracked. Mobile has two values
// ('auto_detected' | 'manual_confirm') because its native WebView can watch
// the loaded page's own DOM/URL for a real submission signal. A browser
// tab/window opened via window.open() is a separate, cross-origin browsing
// context this app has zero visibility into once it navigates away — there
// is no way to observe a real submission on web, so 'auto_detected' is not
// a reachable value here at all. See hooks/useApplyTracking.ts for the
// "did you actually apply?" return-to-tab heuristic that's the sole (and,
// given the constraint above, honest) way this ever fires on web.
export type ApplicationTrackingSource = "auto_detected" | "manual_confirm";

export interface TrackApplicationInput {
  company: string;
  role: string;
  location?: string | null;
  applyUrl?: string | null;
  companyLogoUrl?: string | null;
  source: ApplicationTrackingSource;
}

export async function trackApplication(input: TrackApplicationInput): Promise<void> {
  await apiClient.post("/api/v1/tracker/applications", {
    company: input.company,
    role: input.role,
    location: input.location ?? "",
    applied_date: Date.now(),
    stage: "Applied",
    apply_url: input.applyUrl ?? undefined,
    company_logo_url: input.companyLogoUrl ?? undefined,
    source: input.source,
  });
}
