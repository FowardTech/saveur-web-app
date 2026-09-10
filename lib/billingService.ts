import apiClient from "./apiClient";
import { BillingPlanWire, planFromWire, type BillingPlan } from "./types";

// Real backend contract confirmed against Saveur-Backend/app/api/billing.py
// (Blueprint url_prefix="/api/v1/billing" — there is no un-versioned
// `/api/plans` / `/api/checkout` alias the way /api/users/me has one, so
// this deliberately targets the v1 paths rather than the shorter ones).
//   GET  /api/v1/billing/plans     — public, optional auth
//   POST /api/v1/billing/checkout  — {plan_code, success_url, cancel_url} -> {url}
//                                     OR {addon_code, success_url, cancel_url} -> {url}
//                                     (one-time mode="payment" Checkout Session —
//                                     see billing.py's checkout() addon_code branch)
//   POST /api/v1/billing/portal    — {return_url} -> {url}
//   GET  /api/v1/billing/addons           — Add-ons catalog (app/addons/page.tsx)
//   POST /api/v1/billing/addons/confirm   — {payment_intent_id?, session_id?} -> {addon_code, unlocked}

export async function getPlans(): Promise<BillingPlan[]> {
  const data = await apiClient.get<BillingPlanWire[]>("/api/v1/billing/plans", { auth: true });
  return (data ?? []).map(planFromWire);
}

// ---------------------------------------------------------------------------
// Real entitlement source of truth (Saveur-Backend/app/api/billing.py's
// GET /api/v1/billing/subscription -> _subscription_status_payload()).
//
// BUG FIX: every gated web page/component used to derive Pro/Premium status
// from `profile.subscriptionTier` (lib/types.ts's UserProfile field, read
// from a `subscription_tier` key on GET /api/users/me) — but
// Saveur-Backend's User.to_dict() (app/models/user.py) has never sent a
// `subscription_tier` field at all; the only subscription-adjacent field it
// sends is a bare `"plan"` with no status, insufficient on its own (a
// canceled/past-due paid plan should NOT count as entitled — see
// entitlements_service.is_pro/is_premium's own ACTIVE_STATUSES check).
// `profile.subscriptionTier` was therefore always `undefined` at runtime,
// silently falling back to "free" (profileFromWire's `?? "free"`) for EVERY
// user regardless of their real plan — every client-side isPremium/isPro
// check built on it (app/practice/mock-interviews/page.tsx's Video-mode +
// Interview Laboratory persona gates, app/subscription/page.tsx and
// app/settings/payment/page.tsx's "current plan" display) was silently
// broken, always reading as free-tier.
//
// This is the real fetch mobile's services/billingService.ts +
// entitlementsService.ts (isProTier/isPremiumTier) use — GET
// /api/v1/billing/subscription, which DOES include `status` alongside
// `plan`/`tier`. Wired into AuthProvider (app/providers/AuthProvider.tsx) so
// every page can read `isPro`/`isPremium` from `useAuth()` instead of each
// screen re-deriving (or mis-deriving) it locally.
// ---------------------------------------------------------------------------

export interface SubscriptionStatus {
  /** Backend plan_tier value — "free" | "pro" | "premium" | "premium_plus" |
   * "team" | "enterprise". Never shown to users as-is (see
   * entitlements_service.py's own docstring: "pro" -> "Saveur Basic",
   * "premium" -> "Saveur Premium"). */
  tier: string;
  status: string;
  provider?: string;
  periodEnd: number | null;
  cancelAtPeriodEnd: boolean;
  sessionsUsed: number;
  sessionsLimit: number | null;
}

interface SubscriptionStatusWire {
  plan: string;
  tier: string;
  status: string;
  provider?: string;
  period_end: number | null;
  cancel_at_period_end?: boolean;
  sessions_used: number;
  sessions_limit: number | null;
}

function subscriptionStatusFromWire(wire: SubscriptionStatusWire): SubscriptionStatus {
  return {
    tier: wire.tier ?? wire.plan ?? "free",
    status: wire.status ?? "active",
    provider: wire.provider,
    periodEnd: wire.period_end ?? null,
    cancelAtPeriodEnd: !!wire.cancel_at_period_end,
    sessionsUsed: wire.sessions_used ?? 0,
    sessionsLimit: wire.sessions_limit ?? null,
  };
}

const ACTIVE_STATUSES = new Set(["active", "trialing"]);
// Mirrors mobile's services/entitlementsService.ts UNLIMITED_TIERS /
// Saveur-Backend's entitlements_service.py PREMIUM_TIERS exactly.
const UNLIMITED_TIERS = new Set(["pro", "premium", "premium_plus", "team", "enterprise"]);
const PREMIUM_TIERS = new Set(["premium", "team", "enterprise"]);

/** GET /api/v1/billing/subscription. */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const data = await apiClient.get<SubscriptionStatusWire>("/api/v1/billing/subscription");
  return subscriptionStatusFromWire(data);
}

/** Any active/trialing paid plan (Saveur Basic and up) — matches
 * entitlements_service.py's is_pro / mobile's isProTier. Use this for
 * anything gated by @require_pro on the backend (AI Coach, Job Alerts,
 * Resume Builder, Cover Letter Generator, JD Analyzer, Networking
 * Assistant, Company Intelligence, Salary Negotiation, Coding Practice add-on
 * screen listing, etc.). */
export function isProTier(status: SubscriptionStatus | null | undefined): boolean {
  if (!status) return false;
  return UNLIMITED_TIERS.has(status.tier) && ACTIVE_STATUSES.has(status.status);
}

/** Stricter check — true only for Saveur Premium/Premium (Yearly), matching
 * entitlements_service.py's is_premium / mobile's isPremiumTier. A plain
 * Basic (tier "pro") subscriber does NOT pass this. Use for anything gated
 * by @require_premium on the backend (Career Roadmap, Learning Courses,
 * LinkedIn Optimizer, Dream Companies, Career DNA, Resume Variants, Video
 * interview mode, Interview Laboratory personas, etc.). */
export function isPremiumTier(status: SubscriptionStatus | null | undefined): boolean {
  if (!status) return false;
  return PREMIUM_TIERS.has(status.tier) && ACTIVE_STATUSES.has(status.status);
}

export async function createCheckoutSession(params: {
  /** Mutually exclusive with addonCode — pass exactly one. */
  planCode?: string;
  /** One-time Add-on purchase (app/addons/page.tsx) instead of a
   * subscription — see billing.py's checkout() addon_code branch, which
   * mirrors mobile's in-app PaymentSheet addon_code flow but through the
   * same hosted Checkout Session redirect this app already uses for
   * subscriptions. */
  addonCode?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const data = await apiClient.post<{ url: string }>("/api/v1/billing/checkout", {
    plan_code: params.planCode,
    addon_code: params.addonCode,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });
  return data.url;
}

export async function createPortalSession(returnUrl: string): Promise<string> {
  const data = await apiClient.post<{ url: string }>("/api/v1/billing/portal", {
    return_url: returnUrl,
  });
  return data.url;
}

// ---------------------------------------------------------------------------
// Paid Add-ons (app/addons/page.tsx) — one-time-purchase catalog independent
// of subscription tier, ported from mobile's services/billingService.ts
// (fromAddonWire et al., ~line 665-690) and services/entitlementsService.ts's
// hasAddon/addonCodeForInterviewType (used by the Coding gate in
// app/practice/mock-interviews/page.tsx).
// ---------------------------------------------------------------------------

export interface AddonProps {
  code: string;
  name: string;
  description: string | null;
  amount: number; // minor currency unit (cents)
  currency: string;
  unlocked: boolean;
}

interface AddonWire {
  code: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  is_active: boolean;
  unlocked: boolean;
}

function fromAddonWire(wire: AddonWire): AddonProps {
  return {
    code: wire.code,
    name: wire.name,
    description: wire.description,
    amount: wire.amount ?? 0,
    currency: wire.currency ?? "usd",
    unlocked: !!wire.unlocked,
  };
}

/** GET /api/v1/billing/addons — every active add-on plus this user's
 * unlocked state. */
export async function listAddons(): Promise<AddonProps[]> {
  const data = await apiClient.get<AddonWire[]>("/api/v1/billing/addons");
  return (data ?? []).map(fromAddonWire);
}

/** Whether the current user has purchased a given add-on. Fails CLOSED on a
 * network error, same as mobile's entitlementsService.hasAddon — this gates
 * a feature that costs real money, so a failed lookup should never be
 * treated as "unlocked." */
export async function hasAddon(addonCode: string): Promise<boolean> {
  try {
    const addons = await listAddons();
    return addons.some((addon) => addon.code === addonCode && addon.unlocked);
  } catch {
    return false;
  }
}

/**
 * POST /api/v1/billing/addons/confirm — call this on the Stripe success
 * redirect (see app/addons/success/page.tsx). Accepts either
 * `paymentIntentId` (unused on web today, kept for parity with mobile's
 * PaymentSheet flow) or `sessionId` (the hosted Checkout flow's
 * `?session_id={CHECKOUT_SESSION_ID}` redirect param) — the backend
 * resolves a session id to its underlying payment_intent_id server-side
 * before granting the unlock.
 */
export async function confirmAddonPurchase(params: { paymentIntentId?: string; sessionId?: string }): Promise<{ addonCode: string; unlocked: boolean }> {
  const data = await apiClient.post<{ addon_code: string; unlocked: boolean }>("/api/v1/billing/addons/confirm", {
    payment_intent_id: params.paymentIntentId,
    session_id: params.sessionId,
  });
  return { addonCode: data.addon_code, unlocked: !!data.unlocked };
}

/** Mirrors mobile's entitlementsService.ts ADDON_CODES/addonCodeForInterviewType
 * — only Coding is gated by a paid add-on today (System Design was un-gated
 * once its paid drawing-canvas feature was removed — see that file's own
 * comment). Kept here as the single mapping the web's mock-interview setup
 * wizard reads, mirroring mobile 1:1. */
export const ADDON_CODES = {
  codingPractice: "coding_practice",
  practicalScenario: "practical_scenario",
} as const;

export function addonCodeForInterviewType(interviewType: string): string | null {
  if (interviewType === "Coding") return ADDON_CODES.codingPractice;
  return null;
}
