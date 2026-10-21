import apiClient from "./apiClient";

export interface CreditPack {
  code: string;
  name: string;
  credits: number;
  amount: number; // cents
  currency: string;
}

export interface CreditsOverview {
  enabled: boolean;
  monthly: number;
  topup: number;
  total: number;
  allowance: number;
  tier: "free" | "pro" | "premium";
  resets_at: string;
  costs: Record<string, number>;
  packs: CreditPack[];
}

export interface CreditTransaction {
  id: number;
  delta: number;
  kind: "monthly_grant" | "spend" | "refund" | "topup" | "admin";
  action: string | null;
  balance_after: number;
  note: string | null;
  created_at: string;
}

export const getCredits = () => apiClient.get<CreditsOverview>("/api/v1/credits");
export const getCreditHistory = (limit = 50) => apiClient.get<CreditTransaction[]>("/api/v1/credits/history", { params: { limit: String(limit) } });

/** Starts a Stripe Checkout for a top-up pack and returns the hosted URL. */
export async function createPackCheckout(packCode: string, successUrl: string, cancelUrl: string): Promise<string> {
  const data = await apiClient.post<{ url: string }>("/api/v1/credits/checkout", {
    pack_code: packCode,
    success_url: successUrl,
    cancel_url: cancelUrl,
  });
  return data.url;
}

/** Called on return from Stripe; the webhook is the fallback, this is the fast path. */
export const confirmPackPurchase = (sessionId: string) =>
  apiClient.post<{ total: number }>("/api/v1/credits/confirm", { session_id: sessionId });

/** Human label for a ledger action key (falls back to a prettified key). */
export function actionLabel(t: (k: string, o?: Record<string, unknown>) => string, action: string | null): string {
  if (!action) return "";
  const pretty = action.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return t(`web:credits.actions.${action}`, { defaultValue: pretty });
}
