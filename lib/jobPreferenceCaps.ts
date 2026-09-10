// Per-tier desired-roles / preferred-countries caps — mirrors mobile's
// src/more/JobPreferences.tsx and src/auth/Signup/SignupSecondStep.tsx
// (both read from these same numbers) and Saveur-Backend's
// entitlements_service.job_role_country_caps(), which is the real
// server-side source of truth and backstop (app/api/users.py's update_me
// truncates desired_roles/preferred_countries to these exact numbers on
// every save, regardless of what the client sent).
//
// These numbers are technically admin-configurable server-side
// (app_config_service's "job_alerts" section — max_desired_roles_basic/
// max_preferred_countries_basic etc.), but there is no client-facing way to
// read the LIVE admin value today: GET /api/v1/content/config's public
// config doesn't include a "job_alerts" section, and neither
// GET /api/v1/job-alerts nor GET /api/v1/users/me returns a max_* field.
// Mobile's own JobPreferences.tsx / SignupSecondStep.tsx don't fetch this
// live either — they hardcode the same defaults job_role_country_caps()
// falls back to (1/3 Basic, 10/10 Premium, 5/3 free) and rely entirely on
// the server-side truncation in update_me as the real backstop if an admin
// ever changes the live config out from under a stale client build. This
// mirrors that exact, intentional pattern rather than inventing a new
// backend field for a case mobile itself doesn't cover — see this
// session's PR notes for the fuller "did we confirm this is a real gap"
// write-up.
export const MAX_DESIRED_ROLES_FREE = 5;
export const MAX_PREFERRED_COUNTRIES_FREE = 3;
export const MAX_DESIRED_ROLES_BASIC = 1;
export const MAX_PREFERRED_COUNTRIES_BASIC = 3;
export const MAX_DESIRED_ROLES_PREMIUM = 10;
export const MAX_PREFERRED_COUNTRIES_PREMIUM = 10;

export interface JobRoleCountryCaps {
  maxDesiredRoles: number;
  maxPreferredCountries: number;
}

/** (maxDesiredRoles, maxPreferredCountries) for the given account's current
 * tier — pass useAuth()'s isPro/isPremium straight through. Same tier
 * precedence as entitlements_service.job_role_country_caps: Premium first,
 * then plain Pro/Basic, else the free-tier default. */
export function jobRoleCountryCaps(isPro: boolean, isPremium: boolean): JobRoleCountryCaps {
  if (isPremium) {
    return { maxDesiredRoles: MAX_DESIRED_ROLES_PREMIUM, maxPreferredCountries: MAX_PREFERRED_COUNTRIES_PREMIUM };
  }
  if (isPro) {
    return { maxDesiredRoles: MAX_DESIRED_ROLES_BASIC, maxPreferredCountries: MAX_PREFERRED_COUNTRIES_BASIC };
  }
  return { maxDesiredRoles: MAX_DESIRED_ROLES_FREE, maxPreferredCountries: MAX_PREFERRED_COUNTRIES_FREE };
}
