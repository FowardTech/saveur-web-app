// Shared app-side (camelCase) types. Mirrors the shape of the mobile app's
// constants/Types.tsx UserProfileProps closely enough to keep the two
// clients' mental models in sync, trimmed to what this first web pass
// actually uses.

export interface UserProfile {
  uid?: string;
  email: string;
  name: string;
  firstName?: string;
  username?: string;
  goals: string[];
  industries: string[];
  preferredCountries: string[];
  desiredRoles: string[];
  locale?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  homeAddress?: string;
  notificationsEnabled: boolean;
  jobAlertDailyLimit: number;
  country?: string | null;
  // Account-level "has this user dismissed the first-login welcome modal
  // yet" flag — see Saveur-Backend's app/models/user.py's
  // has_seen_welcome_modal. Deliberately backend-persisted (not just a
  // localStorage flag): "first login" is a one-time-per-account event, so a
  // user who logs in from a second browser/device must not see the modal
  // again either.
  hasSeenWelcomeModal?: boolean;
}

// Wire (snake_case) shape as returned by the backend's User.to_dict() —
// see Saveur-Backend's app/api/users.py. Only the fields this web app
// reads/writes are declared; the backend may send more.
export interface UserProfileWire {
  uid?: string;
  id?: string;
  email: string;
  name: string;
  first_name?: string;
  username?: string;
  goals?: string[];
  industries?: string[];
  preferred_countries?: string[];
  desired_roles?: string[];
  locale?: string;
  avatar_url?: string;
  phone_number?: string;
  home_address?: string;
  notifications_enabled?: boolean;
  job_alert_daily_limit?: number;
  country?: string | null;
  has_seen_welcome_modal?: boolean;
}

export function profileFromWire(wire: UserProfileWire): UserProfile {
  return {
    uid: wire.uid ?? wire.id,
    email: wire.email,
    name: wire.name,
    firstName: wire.first_name ?? wire.name?.split(" ")[0],
    username: wire.username,
    goals: wire.goals ?? [],
    industries: wire.industries ?? [],
    preferredCountries: wire.preferred_countries ?? [],
    desiredRoles: wire.desired_roles ?? [],
    locale: wire.locale,
    avatarUrl: wire.avatar_url,
    phoneNumber: wire.phone_number ?? "",
    homeAddress: wire.home_address ?? "",
    // subscriptionTier deliberately removed (see lib/billingService.ts's
    // header comment) — Saveur-Backend's User.to_dict() has never sent a
    // `subscription_tier` field, so this was always silently `undefined` ??
    // "free" here regardless of the user's real plan. Real entitlement
    // state now comes from GET /api/v1/billing/subscription via
    // AuthProvider's isPro/isPremium (lib/billingService.ts's
    // getSubscriptionStatus/isProTier/isPremiumTier).
    notificationsEnabled: wire.notifications_enabled ?? true,
    jobAlertDailyLimit: wire.job_alert_daily_limit ?? 10,
    country: wire.country ?? null,
    hasSeenWelcomeModal: wire.has_seen_welcome_modal ?? false,
  };
}

// Only the fields the backend's PATCH /api/users/me accepts (see
// Saveur-Backend app/api/users.py's update_me()).
export function profileToWirePatch(partial: Partial<UserProfile>): Record<string, unknown> {
  const wire: Record<string, unknown> = {};
  if (partial.name !== undefined) wire.name = partial.name;
  // Custom username (product request item: "users have the option to
  // either type in their desired username or generate a username from
  // signup") — see components/auth/ChooseUsernameStep.tsx. Backend re-
  // validates + re-checks availability server-side on every PATCH (see
  // Saveur-Backend app/api/users.py's update_me()); this is never trusted
  // as the final word, only the live-typing UX's optimistic check.
  if (partial.username !== undefined) wire.username = partial.username;
  if (partial.locale !== undefined) wire.locale = partial.locale;
  if (partial.country !== undefined) wire.country = partial.country;
  if (partial.goals !== undefined) wire.goals = partial.goals;
  if (partial.industries !== undefined) wire.industries = partial.industries;
  if (partial.preferredCountries !== undefined) wire.preferred_countries = partial.preferredCountries;
  if (partial.desiredRoles !== undefined) wire.desired_roles = partial.desiredRoles;
  if (partial.notificationsEnabled !== undefined) wire.notifications_enabled = partial.notificationsEnabled;
  if (partial.jobAlertDailyLimit !== undefined) wire.job_alert_daily_limit = partial.jobAlertDailyLimit;
  if (partial.phoneNumber !== undefined) wire.phone_number = partial.phoneNumber;
  if (partial.homeAddress !== undefined) wire.home_address = partial.homeAddress;
  if (partial.hasSeenWelcomeModal !== undefined) wire.has_seen_welcome_modal = partial.hasSeenWelcomeModal;
  return wire;
}

/** True when the profile hasn't been through onboarding yet — used to
 * decide whether a freshly signed-in user should land on /onboarding
 * instead of /dashboard. Heuristic: no goals and no desired roles set. */
export function needsOnboarding(profile: UserProfile | null): boolean {
  if (!profile) return false;
  return (profile.goals?.length ?? 0) === 0 && (profile.desiredRoles?.length ?? 0) === 0;
}

export interface BillingPlan {
  id: string;
  code: string | null;
  // Real backend plan_tier values (Saveur-Backend/app/api/billing.py) —
  // "pro" is Saveur Basic, "premium"/"team"/"enterprise" are all Saveur
  // Premium-equivalent (see entitlements_service.py's PREMIUM_TIERS). This
  // was missing "pro" entirely before, which every actual Basic-tier plan
  // catalog row reports.
  tier: "free" | "pro" | "premium" | "premium_plus" | "team" | "enterprise";
  name: string;
  amount: number; // minor currency unit
  currency: string;
  interval: "month" | "year" | null;
  features: string[];
  recommended: boolean;
  isCurrent?: boolean;
}

export interface BillingPlanWire {
  id: string;
  code: string | null;
  // Real backend plan_tier values (Saveur-Backend/app/api/billing.py) —
  // "pro" is Saveur Basic, "premium"/"team"/"enterprise" are all Saveur
  // Premium-equivalent (see entitlements_service.py's PREMIUM_TIERS). This
  // was missing "pro" entirely before, which every actual Basic-tier plan
  // catalog row reports.
  tier: "free" | "pro" | "premium" | "premium_plus" | "team" | "enterprise";
  name: string;
  amount: number;
  currency: string;
  interval?: "month" | "year" | null;
  features?: string[];
  recommended?: boolean;
  popular?: boolean;
  is_recommended?: boolean;
  is_current?: boolean;
}

export function planFromWire(wire: BillingPlanWire): BillingPlan {
  return {
    id: wire.id,
    code: wire.code ?? null,
    tier: wire.tier,
    name: wire.name,
    amount: wire.amount ?? 0,
    currency: wire.currency ?? "usd",
    interval: wire.interval ?? null,
    features: wire.features ?? [],
    recommended: wire.recommended ?? wire.popular ?? wire.is_recommended ?? false,
    isCurrent: wire.is_current,
  };
}

export function formatPrice(amount: number, currency: string): string {
  const symbols: Record<string, string> = { usd: "$", eur: "€", gbp: "£" };
  const symbol = symbols[currency?.toLowerCase()] ?? "";
  return `${symbol}${(amount / 100).toFixed(2)}`;
}
