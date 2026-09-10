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
