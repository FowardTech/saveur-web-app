import apiClient from "./apiClient";
import { BillingPlanWire, planFromWire, type BillingPlan } from "./types";

// Real backend contract confirmed against Saveur-Backend/app/api/billing.py
// (Blueprint url_prefix="/api/v1/billing" — there is no un-versioned
// `/api/plans` / `/api/checkout` alias the way /api/users/me has one, so
// this deliberately targets the v1 paths rather than the shorter ones).
//   GET  /api/v1/billing/plans     — public, optional auth
//   POST /api/v1/billing/checkout  — {plan_code, success_url, cancel_url} -> {url}
//   POST /api/v1/billing/portal    — {return_url} -> {url}

export async function getPlans(): Promise<BillingPlan[]> {
  const data = await apiClient.get<BillingPlanWire[]>("/api/v1/billing/plans", { auth: true });
  return (data ?? []).map(planFromWire);
}

export async function createCheckoutSession(params: {
  planCode: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const data = await apiClient.post<{ url: string }>("/api/v1/billing/checkout", {
    plan_code: params.planCode,
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
